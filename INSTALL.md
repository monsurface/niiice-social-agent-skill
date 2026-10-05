# AI Threads 客戶端改寫安裝

一般版與 Lite 都可使用。用客戶自己的 Claude Code／Codex 模型改寫，MCP 提供客戶品牌與寫作規則，成稿可存回工作台。這條改寫路線不扣 Niiice AI 生成額度；客戶自己的 AI 訂閱／API 用量照其供應商計算。MCP／草稿的伺服器及資料庫服務仍由 Niiice 提供。

## 1. 安裝 Skill

下載 `https://niiiceturbo.com/agent-skills/niiice-threads.zip`，解壓縮。在解壓後含 `install.cjs` 的目錄執行（Node 18+，Windows／macOS／Linux 同指令）：

```text
node install.cjs --client both
node install.cjs --client both --apply
```

第一行預覽，第二行安裝；只裝一個工具可以把 `both` 換成 `claude-code` 或 `codex`。Claude Code 安裝在家目錄 `.claude/skills/niiice-threads`，Codex 安裝在 `.agents/skills/niiice-threads`。不會改其他 Skill、MCP 設定或 AI 帳號；同檔可重跑，不同版本的既有檔案先備份／移開再安裝。

## 2. 連接自己的帳號

在 AI Threads 工作台的「MCP 設定」建立產草稿連線並複製 URL。預設先用只產草稿權限；需要排程或立即發布時再在工作台開啟對應能力。URL 含 token，視同密碼，不要傳給別人或貼進公開檔案。

Claude Code：

```text
claude mcp add --transport http --scope user niiice-social-compose "<自己的產草稿 MCP URL>"
claude mcp list
```

Codex：

```text
codex mcp add niiice-social-compose --url "<自己的產草稿 MCP URL>"
codex mcp list
```

將 `<自己的產草稿 MCP URL>` 換成工作台給的 URL。這些設定只在客戶電腦執行；交付包不含客戶 token，也不需要公司的 API key。CLI 及顯示的設定位置若因版本不同，以工具的 `mcp add --help` 為準。

## 3. 開始改稿

重新開啟 AI 工具，在 Claude Code 使用 `/niiice-threads`，在 Codex 使用 `$niiice-threads`，或說「用 niiice-threads 幫我改寫這段原文」。

驗收一次：`get_compose_options` → `get_compose_brief` → 客戶模型交稿。想保存時要求「把這版存成草稿」，再查 `get_draft` 核對文案。寫稿不會自動發布。

平台的 AI 檢查、生成、配圖及自動回覆仍可能吃平台額度，Skill 預設不呼叫。Lite 遇 `plan_no_generation` 不需升級就能繼續用自己的模型改稿。

原生 MCP 有問題時，請讓 AI 讀 Skill 內的 `references/connection.md` 使用同包的零依賴 CLI；不要換別人的 token。到期、撤銷或權限錯誤請回工作台檢查連線。

## 4. 其他工具的設定範例

Cursor 在個人家目錄的 `.cursor/mcp.json` 合併下列設定，保留既有 server；存檔後重新啟動。設定格式依 [Cursor 官方 MCP 文件](https://cursor.com/help/customization/mcp)。

```json
{
  "mcpServers": {
    "niiice-social-compose": {
      "url": "<自己的產草稿 MCP URL>"
    }
  }
}
```

VS Code 使用命令面板「MCP: Open User Configuration」開啟個人設定，合併以下 server。依 [VS Code 官方設定文件](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)，HTTP server 用 `type:http` 與 `url`。

```json
{
  "servers": {
    "niiice-social-compose": {
      "type": "http",
      "url": "<自己的產草稿 MCP URL>"
    }
  }
}
```

同一份 `niiice-threads/SKILL.md` 工作流程可以提供給支援自訂指令／Skill 的工具。以上兩種是依官方文件提供的設定範例，未宣稱做過客戶帳號端到端驗收。含 token 的設定留在個人設定位置，不加入專案 Git。

其他 Streamable HTTP MCP 客戶端採相同 URL、JSON-RPC POST；不需額外公司的 API key。瀏覽器型客戶端需由維護者核准其確切 Origin 才能連線；桌面／CLI 客戶端一般不帶 Origin。

設定依 [Claude Code MCP](https://code.claude.com/docs/en/mcp)、[Claude Code Skills](https://code.claude.com/docs/en/skills)、[Codex MCP](https://developers.openai.com/codex/mcp/) 與 [Codex Skills](https://developers.openai.com/codex/skills/) 核對；安裝位置與命令另以本機 CLI `--help` 驗證。
