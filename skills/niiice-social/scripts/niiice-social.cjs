#!/usr/bin/env node
/**
 * niiice-social — Niiice Turbo 社群 MCP 的零依賴 CLI（2026-08-17，工單 Phase B／C・B4）。
 *
 * 只用 Node ≥18 內建的 fetch／fs／path／os，沒有任何 npm 依賴：`npx skills add` 或直接 `node` 就能跑。
 * 它是 Streamable HTTP MCP client 的最小子集：每次呼叫都 `initialize` → `tools/list`｜`tools/call`
 * （server 是無狀態的，initialize 便宜；若 server 回 `Mcp-Session-Id`，同一次執行內會帶回去）。
 *
 * 兩條連線（都在 Niiice Turbo 的「MCP 設定」裡建立）：
 * - 產草稿連線（compose／publish scope）＝ `NIIICE_SOCIAL_MCP_URL`／config.mcpUrl —— 寫入類捷徑都打這條
 * - 讀取連線（read_only）＝ `NIIICE_SOCIAL_READ_MCP_URL`／config.readMcpUrl —— `inbox`、`--read` 打這條
 *
 * 安全規則（與 SKILL.md 同義）：
 * - 所有會寫入／消耗額度的捷徑（draft／upload-media／attach-media／schedule／cancel-schedule）
 *   **沒帶 `--confirm` 就只印預覽、不送出**；帶了才送。
 * - 重試一律用同一個 `--id`（client_request_id）；換 id ＝ 再生成一份／再排一次。
 * - 排程只能排 ≥30 分鐘後、不能立即發布；`schedule` 必帶 `preview-schedule` 回的 `--token`。
 * - CLI 不會替你說「已發布」：排好只是「已排程」。
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "niiice-social-cli", version: "1.0.0" };
const CONFIG_DIR_NAME = "niiice-social";
const CONFIG_FILE_NAME = "config.json";
const CONFIRM_FLAG = "--confirm";
const CLIENT_REQUEST_ID_MIN = 8;
const CLIENT_REQUEST_ID_MAX = 120;

/* ------------------------------------------------------------------ */
/* config                                                               */
/* ------------------------------------------------------------------ */

function configDir(env = process.env, homedir = os.homedir) {
  const override = String(env.NIIICE_SOCIAL_CONFIG_DIR || "").trim();
  if (override) return override;
  const xdg = String(env.XDG_CONFIG_HOME || "").trim();
  return path.join(xdg || path.join(homedir(), ".config"), CONFIG_DIR_NAME);
}

function configPath(env, homedir) {
  return path.join(configDir(env, homedir), CONFIG_FILE_NAME);
}

function readConfigFile(env, homedir) {
  const file = configPath(env, homedir);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfigFile(patch, env, homedir) {
  const dir = configDir(env, homedir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, CONFIG_FILE_NAME);
  const merged = { ...readConfigFile(env, homedir), ...patch };
  for (const key of Object.keys(merged)) if (merged[key] === undefined || merged[key] === "") delete merged[key];
  fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows 沒有 POSIX mode，忽略 */
  }
  return file;
}

/**
 * 解析順序（env 優先，其次 config 檔）：
 * - 產草稿 URL：`NIIICE_SOCIAL_MCP_URL` → config.mcpUrl
 * - 讀取 URL：`NIIICE_SOCIAL_READ_MCP_URL` → config.readMcpUrl
 */
function resolveConfig(env = process.env, homedir = os.homedir) {
  const file = readConfigFile(env, homedir);
  const mcpUrl = String(env.NIIICE_SOCIAL_MCP_URL || file.mcpUrl || "").trim();
  const readMcpUrl = String(env.NIIICE_SOCIAL_READ_MCP_URL || file.readMcpUrl || "").trim();
  return {
    mcpUrl: mcpUrl || null,
    readMcpUrl: readMcpUrl || null,
    source: {
      mcpUrl: env.NIIICE_SOCIAL_MCP_URL ? "env" : file.mcpUrl ? "config" : null,
      readMcpUrl: env.NIIICE_SOCIAL_READ_MCP_URL ? "env" : file.readMcpUrl ? "config" : null,
    },
    configPath: configPath(env, homedir),
  };
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || ""));
}

/** 印出來時遮 token（URL 最後一段就是 token）。 */
function maskUrl(url) {
  if (!url) return "—";
  return String(url).replace(/(\/api\/mcp\/[^/]+\/)([^/?#]+)/, (_m, prefix, token) => `${prefix}${token.slice(0, 20)}…${token.slice(-4)}`);
}

/* ------------------------------------------------------------------ */
/* argv                                                                 */
/* ------------------------------------------------------------------ */

/** `--key value`／`--key=value`／`--flag`；第一個非 `--` 的是指令，其餘進 positional。 */
function parseArgs(argv) {
  const out = { command: null, positional: [], flags: {} };
  const list = Array.isArray(argv) ? [...argv] : [];
  while (list.length) {
    const item = String(list.shift());
    if (item.startsWith("--")) {
      const eq = item.indexOf("=");
      if (eq > 2) {
        out.flags[item.slice(2, eq)] = item.slice(eq + 1);
        continue;
      }
      const key = item.slice(2);
      const next = list[0];
      if (next !== undefined && !String(next).startsWith("--")) {
        out.flags[key] = String(list.shift());
      } else {
        out.flags[key] = true;
      }
      continue;
    }
    if (!out.command) out.command = item;
    else out.positional.push(item);
  }
  return out;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* JSON-RPC over Streamable HTTP                                        */
/* ------------------------------------------------------------------ */

class McpHttpError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "McpHttpError";
    this.status = status;
    this.body = body;
  }
}

async function readRpcBody(response) {
  const type = String(response.headers?.get?.("content-type") || "");
  const text = await response.text();
  if (type.includes("text/event-stream")) {
    // 最小 SSE 解析：取最後一個 data: JSON（我們的 server 一律回 JSON，這只是相容別的 Streamable HTTP server）
    let last = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        last = JSON.parse(payload);
      } catch {
        /* 忽略非 JSON 的 data 行 */
      }
    }
    return last;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/**
 * 一次 JSON-RPC request。`session` 是同一次執行內共用的 `{ id, sessionId }`。
 * HTTP 4xx／5xx 或 JSON-RPC error 都 throw；tools/call 的 `isError` 不 throw（交給呼叫端印出來、決定 exit code）。
 */
async function rpc(url, method, params, session, deps) {
  const fetchImpl = deps.fetch;
  session.id = (session.id || 0) + 1;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
  const body = { jsonrpc: "2.0", id: session.id, method };
  if (params !== undefined) body.params = params;
  const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = response.headers?.get?.("mcp-session-id");
  if (sid) session.sessionId = sid;
  const payload = await readRpcBody(response);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?._raw || `HTTP ${response.status}`;
    throw new McpHttpError(`MCP HTTP ${response.status}：${typeof message === "string" ? message : JSON.stringify(message)}`, { status: response.status, body: payload });
  }
  if (payload?.error) {
    throw new McpHttpError(`MCP 錯誤 ${payload.error.code ?? ""}：${payload.error.message || JSON.stringify(payload.error)}`, { status: response.status, body: payload });
  }
  return payload?.result;
}

async function initialize(url, session, deps) {
  const result = await rpc(
    url,
    "initialize",
    { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    session,
    deps,
  );
  // 通知不需要回應；server 回 202。失敗也不影響後續（無狀態 server）
  try {
    await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION, ...(session.sessionId ? { "Mcp-Session-Id": session.sessionId } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
  } catch {
    /* 忽略 */
  }
  return result;
}

async function mcpToolsList(url, deps) {
  const session = {};
  await initialize(url, session, deps);
  const result = await rpc(url, "tools/list", {}, session, deps);
  return Array.isArray(result?.tools) ? result.tools : [];
}

async function mcpCall(url, name, args, deps) {
  const session = {};
  await initialize(url, session, deps);
  return rpc(url, "tools/call", { name, arguments: args || {} }, session, deps);
}

/* ------------------------------------------------------------------ */
/* 輸出                                                                 */
/* ------------------------------------------------------------------ */

function contentText(result) {
  const parts = Array.isArray(result?.content) ? result.content : [];
  const texts = parts.filter((part) => part && part.type === "text" && typeof part.text === "string").map((part) => part.text);
  if (texts.length) return texts.join("\n");
  if (result?.structuredContent !== undefined) return JSON.stringify(result.structuredContent, null, 2);
  return JSON.stringify(result ?? null, null, 2);
}

function printToolResult(io, result, { raw = false } = {}) {
  if (raw) {
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    io.stdout(`${contentText(result)}\n`);
  }
  return result?.isError ? 1 : 0;
}

/** 沒帶 --confirm 的寫入捷徑：只印「會送什麼」，不送。 */
function printDryRun(io, { url, tool, args, hint }) {
  io.stdout(
    [
      `【預覽，尚未送出】${tool} → ${maskUrl(url)}`,
      JSON.stringify(args, null, 2),
      hint || `確認無誤後加上 ${CONFIRM_FLAG} 再執行一次才會送出。`,
      "",
    ].join("\n"),
  );
  return 0;
}

function requireComposeUrl(config) {
  if (!config.mcpUrl) {
    throw new Error(
      `尚未設定產草稿 MCP URL。先執行：niiice-social setup --url <MCP URL>（到 Niiice Turbo 社群管理 → MCP 設定 → AI 產草稿連線 複製），或設環境變數 NIIICE_SOCIAL_MCP_URL。`,
    );
  }
  return config.mcpUrl;
}

function requireReadUrl(config) {
  if (!config.readMcpUrl) {
    throw new Error(
      `尚未設定讀取 MCP URL。先執行：niiice-social setup --read-url <讀取 MCP URL>（MCP 設定 → 安全連接您的 AI 助手 複製），或設環境變數 NIIICE_SOCIAL_READ_MCP_URL。`,
    );
  }
  return config.readMcpUrl;
}

function requireFlag(flags, key, hint) {
  const value = flags[key];
  if (value === undefined || value === true || String(value).trim() === "") {
    throw new Error(`缺少 --${key}${hint ? `：${hint}` : ""}`);
  }
  return String(value).trim();
}

function requireClientRequestId(flags) {
  const id = requireFlag(flags, "id", `client_request_id（${CLIENT_REQUEST_ID_MIN}–${CLIENT_REQUEST_ID_MAX} 字，重試要用同一個）`);
  if (id.length < CLIENT_REQUEST_ID_MIN || id.length > CLIENT_REQUEST_ID_MAX) {
    throw new Error(`--id 長度須為 ${CLIENT_REQUEST_ID_MIN}–${CLIENT_REQUEST_ID_MAX} 字（目前 ${id.length}）`);
  }
  return id;
}

function parseJsonFlag(value) {
  if (value === undefined || value === true) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw new Error("--json 必須是一個 JSON 物件字串，例如 --json '{\"draft_id\":\"d-1\"}'");
  }
}

const HELP = `niiice-social — Niiice Turbo 社群 MCP CLI（零依賴）

設定
  setup --url <產草稿 MCP URL> [--read-url <讀取 MCP URL>]   存到 ~/.config/niiice-social/config.json（env NIIICE_SOCIAL_MCP_URL／NIIICE_SOCIAL_READ_MCP_URL 優先）
  config                                                     顯示目前用哪個 URL（遮 token）

通用
  tools [--read]                                             tools/list（--read 打讀取連線）
  call <tool> [--json '{...}'] [--read] [--raw]              tools/call；印 content 文字（--raw 印整包 JSON）

捷徑（產草稿連線）
  options                                                    get_compose_options
  draft --topic <主題> --accounts a,b --id <client_request_id> [--purpose] [--tone] [--length] [--hook] [--cta]
        [--task-input] [--instructions] [--media url1,url2] [--confirm]     create_post_draft（沒 --confirm 只印預覽）
  get-draft <draft_id> | --draft <draft_id>                  get_draft
  drafts [--limit N]                                         list_recent_drafts
  upload-media --url <圖片網址> [--alt 說明] [--confirm]     upload_media_by_url（沒 --confirm 只印預覽）
  attach-media --draft <id> --urls u1,u2 [--confirm]         attach_media_to_draft（沒 --confirm 只印預覽）
  preview-schedule --draft <id> --at <ISO 時間>              preview_schedule（零副作用；需 publish 等級連線）
  schedule --draft <id> --at <ISO 時間> --token <confirmation_token> --id <client_request_id> [--confirm]
                                                             schedule_draft（沒 --confirm 只印預覽；只能排 ≥30 分鐘後）
  cancel-schedule --draft <id> --id <client_request_id> [--confirm]   cancel_scheduled_draft

捷徑（讀取連線）
  inbox                                                      get_social_inbox_summary

規則：重試用同一個 --id；排程要先 preview-schedule 拿 --token 並向使用者確認；排好只是「已排程」，不是已發布。
`;

/* ------------------------------------------------------------------ */
/* commands                                                             */
/* ------------------------------------------------------------------ */

async function run(argv, deps = {}) {
  const io = {
    stdout: deps.stdout || ((text) => process.stdout.write(text)),
    stderr: deps.stderr || ((text) => process.stderr.write(text)),
  };
  const env = deps.env || process.env;
  const homedir = deps.homedir || os.homedir;
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("需要 Node 18+（內建 fetch）");
  const net = { fetch: fetchImpl };
  const { command, positional, flags } = parseArgs(argv);
  const raw = flags.raw === true;
  const confirm = flags.confirm === true;

  if (!command || command === "help" || flags.help === true) {
    io.stdout(HELP);
    return 0;
  }

  if (command === "setup") {
    const patch = {};
    if (flags.url !== undefined) {
      const url = requireFlag(flags, "url", "產草稿 MCP URL");
      if (!isHttpUrl(url)) throw new Error("--url 必須是 http(s) 網址");
      patch.mcpUrl = url;
    }
    if (flags["read-url"] !== undefined) {
      const url = requireFlag(flags, "read-url", "讀取 MCP URL");
      if (!isHttpUrl(url)) throw new Error("--read-url 必須是 http(s) 網址");
      patch.readMcpUrl = url;
    }
    if (!Object.keys(patch).length) throw new Error("setup 至少要帶 --url 或 --read-url");
    const file = writeConfigFile(patch, env, homedir);
    io.stdout(`已寫入 ${file}\n${patch.mcpUrl ? `產草稿 MCP：${maskUrl(patch.mcpUrl)}\n` : ""}${patch.readMcpUrl ? `讀取 MCP：${maskUrl(patch.readMcpUrl)}\n` : ""}提醒：這個檔案含 token（視同密碼），請勿提交到版本控制。\n`);
    return 0;
  }

  const config = resolveConfig(env, homedir);

  if (command === "config") {
    io.stdout(
      [
        `設定檔：${config.configPath}`,
        `產草稿 MCP：${maskUrl(config.mcpUrl)}${config.source.mcpUrl ? `（來源 ${config.source.mcpUrl}）` : ""}`,
        `讀取 MCP：${maskUrl(config.readMcpUrl)}${config.source.readMcpUrl ? `（來源 ${config.source.readMcpUrl}）` : ""}`,
        "",
      ].join("\n"),
    );
    return 0;
  }

  const useRead = flags.read === true;
  const composeUrl = () => requireComposeUrl(config);
  const readUrl = () => requireReadUrl(config);
  const callAndPrint = async (url, tool, args) => printToolResult(io, await mcpCall(url, tool, args, net), { raw });

  switch (command) {
    case "tools": {
      const url = useRead ? readUrl() : composeUrl();
      const tools = await mcpToolsList(url, net);
      if (raw) {
        io.stdout(`${JSON.stringify(tools, null, 2)}\n`);
      } else {
        io.stdout(`${useRead ? "讀取連線" : "產草稿連線"}（${maskUrl(url)}）可用工具 ${tools.length} 顆：\n`);
        for (const tool of tools) io.stdout(`- ${tool.name}${tool.title ? `｜${tool.title}` : ""}\n`);
      }
      return 0;
    }
    case "call": {
      const tool = positional[0];
      if (!tool) throw new Error("call 需要工具名稱：niiice-social call <tool> --json '{...}'");
      const args = parseJsonFlag(flags.json);
      return callAndPrint(useRead ? readUrl() : composeUrl(), tool, args);
    }
    case "options":
      return callAndPrint(composeUrl(), "get_compose_options", {});
    case "draft": {
      const url = composeUrl();
      const topic = requireFlag(flags, "topic", "這篇要講什麼");
      const accounts = csv(requireFlag(flags, "accounts", "帳號 id，逗號分隔（先用 options 查）"));
      if (!accounts.length) throw new Error("--accounts 至少一個帳號 id");
      const id = requireClientRequestId(flags);
      const args = { account_ids: accounts, topic, client_request_id: id, confirm_generation: true };
      const optional = {
        purpose: flags.purpose,
        tone: flags.tone,
        length: flags.length,
        hook_type: flags.hook,
        cta_type: flags.cta,
        task_input: flags["task-input"],
        instructions: flags.instructions,
        language: flags.language,
      };
      for (const [key, value] of Object.entries(optional)) if (typeof value === "string" && value.trim()) args[key] = value.trim();
      const media = csv(flags.media);
      if (media.length) args.media_urls = media;
      if (!confirm) {
        return printDryRun(io, { url, tool: "create_post_draft", args, hint: `這會排入生成佇列並使用 AI 額度。確認主題、帳號、任務與語氣無誤後加上 ${CONFIRM_FLAG} 才會送出；重試請沿用同一個 --id。` });
      }
      return callAndPrint(url, "create_post_draft", args);
    }
    case "get-draft": {
      const draftId = positional[0] || (typeof flags.draft === "string" ? flags.draft : "");
      if (!draftId) throw new Error("get-draft 需要 draft_id：niiice-social get-draft <draft_id>");
      return callAndPrint(composeUrl(), "get_draft", { draft_id: draftId });
    }
    case "drafts": {
      const args = {};
      if (typeof flags.limit === "string" && Number.isFinite(Number(flags.limit))) args.limit = Number(flags.limit);
      return callAndPrint(composeUrl(), "list_recent_drafts", args);
    }
    case "upload-media": {
      const url = composeUrl();
      const image = requireFlag(flags, "url", "公開的 http(s) 圖片網址");
      if (!isHttpUrl(image)) throw new Error("--url 必須是 http(s) 圖片網址");
      const args = { url: image };
      if (typeof flags.alt === "string" && flags.alt.trim()) args.alt = flags.alt.trim();
      if (!confirm) return printDryRun(io, { url, tool: "upload_media_by_url", args, hint: `這會把圖片抓下來存進 Niiice Turbo。確認網址無誤後加上 ${CONFIRM_FLAG} 才會送出（同一個網址重傳會拿回同一份）。` });
      return callAndPrint(url, "upload_media_by_url", args);
    }
    case "attach-media": {
      const url = composeUrl();
      const draftId = requireFlag(flags, "draft", "draft_id");
      const urls = csv(requireFlag(flags, "urls", "upload-media 回傳的 media_url，逗號分隔"));
      if (!urls.length) throw new Error("--urls 至少一個 media_url");
      const args = { draft_id: draftId, media_urls: urls };
      if (!confirm) return printDryRun(io, { url, tool: "attach_media_to_draft", args, hint: `這會覆寫草稿目前的媒體清單。確認後加上 ${CONFIRM_FLAG} 才會送出。` });
      return callAndPrint(url, "attach_media_to_draft", args);
    }
    case "preview-schedule": {
      const draftId = requireFlag(flags, "draft", "draft_id");
      const at = requireFlag(flags, "at", "ISO 8601 含時區，例如 2026-08-20T10:30:00+08:00（至少 30 分鐘後）");
      return callAndPrint(composeUrl(), "preview_schedule", { draft_id: draftId, scheduled_at: at });
    }
    case "schedule": {
      const url = composeUrl();
      const draftId = requireFlag(flags, "draft", "draft_id");
      const at = requireFlag(flags, "at", "與 preview-schedule 相同的時間");
      const token = requireFlag(flags, "token", "preview-schedule 回傳的 confirmation_token");
      const id = requireClientRequestId(flags);
      const args = { draft_id: draftId, scheduled_at: at, confirmation_token: token, client_request_id: id };
      if (!confirm) {
        return printDryRun(io, { url, tool: "schedule_draft", args, hint: `這會把草稿排程到各帳號（不是立即發布；到期才由系統發出）。請先向使用者唸出 preview-schedule 的時間與帳號並取得同意，再加上 ${CONFIRM_FLAG} 送出；重試沿用同一個 --id。` });
      }
      return callAndPrint(url, "schedule_draft", args);
    }
    case "cancel-schedule": {
      const url = composeUrl();
      const draftId = requireFlag(flags, "draft", "draft_id");
      const id = requireClientRequestId(flags);
      const args = { draft_id: draftId, client_request_id: id };
      if (!confirm) return printDryRun(io, { url, tool: "cancel_scheduled_draft", args, hint: `這會取消這份草稿還沒發出去的排程（已發出的不會被收回）。確認後加上 ${CONFIRM_FLAG} 才會送出。` });
      return callAndPrint(url, "cancel_scheduled_draft", args);
    }
    case "inbox":
      return callAndPrint(readUrl(), "get_social_inbox_summary", {});
    default:
      throw new Error(`未知指令：${command}\n${HELP}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  try {
    const code = await run(argv);
    process.exitCode = code;
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  run,
  main,
  parseArgs,
  resolveConfig,
  configPath,
  writeConfigFile,
  mcpCall,
  mcpToolsList,
  contentText,
  maskUrl,
  McpHttpError,
  HELP,
  PROTOCOL_VERSION,
};
