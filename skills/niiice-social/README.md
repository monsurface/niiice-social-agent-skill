# niiice-social（Agent Skill）

Niiice Turbo 社群 MCP 的一行安裝 skill：`SKILL.md`（給 AI agent 讀的使用規則）＋ `scripts/niiice-social.cjs`（零依賴 CLI，Node 18+）。

## 兩種接法

### 1. 一行安裝（skills 生態）

```bash
npx skills add monsurface/niiice-social-agent-skill
```

公開 repo ＝ **https://github.com/monsurface/niiice-social-agent-skill**（2026-08-17 建，`npx skills add` 從 repo 的 `skills/*/SKILL.md` 安裝，已實測 `--agent claude-code --copy` 裝得起來含 scripts）。**正本在這裡（`AI_STYLE_WALL/skills/niiice-social/`）**，公開 repo 是鏡像：改 `SKILL.md`／`scripts/niiice-social.cjs` 後要同步複製過去並 push（兩邊必須逐字相同；公開 repo 另有自己的對外 README，不要拿這份覆蓋）。

安裝後：

```bash
node ~/.claude/skills/niiice-social/scripts/niiice-social.cjs setup --url "<產草稿 MCP URL>" --read-url "<讀取 MCP URL>"
```

### 2. 直接接 MCP（不用 skill）

任何支援 Streamable HTTP 的 MCP client 都能直接接。Claude Code：

```bash
claude mcp add --transport http niiice-social <讀取 MCP URL>
claude mcp add --transport http niiice-social-compose <產草稿 MCP URL>
```

MCP URL 在 Niiice Turbo →「社群管理」左下「MCP 設定」複製（兩張卡各一條；產草稿卡建立時可勾「允許 AI 排程發布」）。URL 內含 token，視同密碼。

## CLI 速查

```
setup --url <產草稿 MCP URL> [--read-url <讀取 MCP URL>]
config
tools [--read]
call <tool> [--json '{...}'] [--read] [--raw]
options
draft --topic … --accounts a,b --id <crid> [--purpose --tone --length --hook --cta --task-input --instructions --media u1,u2] [--confirm]
get-draft <draft_id>
drafts [--limit N]
upload-media --url <圖片網址> [--alt …] [--confirm]
attach-media --draft <id> --urls u1,u2 [--confirm]
preview-schedule --draft <id> --at <ISO 含時區>
schedule --draft <id> --at <ISO> --token <confirmation_token> --id <crid> [--confirm]
cancel-schedule --draft <id> --id <crid> [--confirm]
direct-draft --accounts a,b --content <文字> --id <crid> [--first-comment …] [--link …] [--confirm]
split-preview --text <文字> [--parts 2-10]
preview-publish --draft <id>
publish --draft <id> --token <confirmation_token> --id <crid> [--confirm]
schedules [--id <schedule_id>] [--limit N]
update-schedule --id <schedule_id> [--content …] [--at …] [--urls …] [--topic-tag …] [--first-comment …] [--link …] [--confirm]
delete-schedule --id <schedule_id> [--confirm]
add-item --type faq|kb [--brand <id>|general] (--list <id> | --list-name <名稱>) --q/--a | --title/--content [--tags] [--confirm]
inbox
library [--brand <id>|general] [--kind faq|kb|datasets|all] [--per-list N]
```

- 寫入捷徑（`draft`／`direct-draft`／`upload-media`／`attach-media`／`schedule`／`cancel-schedule`／`publish`／`update-schedule`／`delete-schedule`／`add-item`）**沒帶 `--confirm` 只印預覽不送**。
- 設定解析順序：環境變數 `NIIICE_SOCIAL_MCP_URL`／`NIIICE_SOCIAL_READ_MCP_URL` → `~/.config/niiice-social/config.json`（`NIIICE_SOCIAL_CONFIG_DIR` 可改位置）。
- 排程只能排 ≥30 分鐘後、≤90 天；排好只是「已排程」不是已發布。
- **立即發布（2026-08-24 起）**：`publish` 需要連線建立時勾了「允許立即發布」，而且必帶 `preview-publish` 回的 token。發出去**收不回來**；沒開這個能力時 `tools` 就看不到那兩顆。

## 測試

`AI_STYLE_WALL/backend/tests/niiice-social-skill.test.js`（vitest，mock fetch）：JSON-RPC 流程（initialize → tools/list／tools/call）、`--confirm` 缺就不送、config 讀取順序、錯誤處理。
