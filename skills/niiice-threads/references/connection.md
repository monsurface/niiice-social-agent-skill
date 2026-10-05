# 連線與 CLI 後備

先依安裝包的 `INSTALL.md` 安裝 Skill，並在 AI Threads 的「MCP 設定」建立產草稿連線。預設只開草稿權限；需要排程／立即發布再由客戶開啟。一般版與 Lite 使用各自帳號的連線。

Claude Code：`claude mcp add --transport http --scope user niiice-social-compose "<客戶自己的產草稿 MCP URL>"`

Codex：`codex mcp add niiice-social-compose --url "<客戶自己的產草稿 MCP URL>"`

以 `claude mcp list`／`codex mcp list` 及工具清單確認連線；不需要公司的 OpenRouter key、Supabase key 或跨系統 shared secret。

若原生 MCP 無法使用，可用本 Skill 安裝目錄內的 `scripts/niiice-social.cjs`（Node 18+、無 npm 依賴）。下例 `<cli>` 代表該檔案的絕對路徑：

```text
node <cli> setup --url <客戶自己的產草稿 MCP URL>
node <cli> options
node <cli> brief --account <帳號ID> --purpose knowledge --length short
node <cli> direct-draft --accounts <帳號ID> --content-file <UTF-8文案檔> --brief <brief_id> --id <穩定UUID>
```

最後一行只有預覽。使用者已授權存草稿時追加 `--confirm`；串文追加 `--chain 0`，先用 `split-preview --text <完整文案>` 核對切段結果。CLI 不替你生成：改稿由目前 Claude Code／Codex 模型完成。

設定存在使用者的 `~/.config/niiice-social/config.json`；Windows 也從使用者家目錄解析。只在客戶電腦執行設定，不把 token 交回維護者或寫進交付包。重設或撤銷連線後以新 URL 更新客戶自己的設定。
