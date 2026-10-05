# Niiice 社群 Agent Skills

供 Niiice Turbo 客戶連接自己的社群 MCP。`niiice-threads` 提供一般版／Lite 的客戶模型改寫、讀品牌規則與存稿；`niiice-social` 提供社群讀取、平台生成、媒體、排程及互動，能力依連線 scope/cap。

## 安裝及連線

Claude Code／Codex 客戶交付包：[niiice-threads.zip](https://niiiceturbo.com/agent-skills/niiice-threads.zip)。解壓後執行：

```text
node install.cjs --client both
node install.cjs --client both --apply
```

先預覽再安裝；同檔可重跑、不同既有檔案不覆蓋。完整個人 MCP 設定、工具指令及 Cursor／VS Code 範例見 [INSTALL.md](INSTALL.md)。

也可用既有 Skill 安裝工具，從 repo 的 skills/*/SKILL.md 選取需要的 Skill：

```text
npx skills add monsurface/niiice-social-agent-skill
```

MCP URL 從客戶自己的 AI Threads 工作台「MCP 設定」取得，含長效憑證；只存個人設定，不貼到 Git 或公開對話。撤銷、到期或移除團隊權限後不能繼續使用，不能切到別人的身分。

## 費用與授權

`get_compose_brief` → 客戶自己的模型 → `create_direct_draft` 不扣平台 AI 生成額度；客戶 AI 訂閱／API 依供應商計量，Niiice 仍提供 MCP／資料庫與合規複核。平台生成、AI 檢查／擬稿、配圖及自動回覆可能使用平台額度。

草稿不會自動發布。排程／立即發布／留言互動各須連線開啟對應能力及使用者授權；發布工具先預覽並帶確認 token，CLI 寫入捷徑未帶 `--confirm` 只預覽。只能照真實結果回報。

CLI 1.1.0 使用 Node 18+，無 npm 依賴；提供 `brief`、UTF-8 `--content-file`、`--brief` 與 `--chain`。每次 HTTP 60 秒期限、不追 redirect、只用 HTTPS（本機 loopback HTTP 例外），MCP 憑證完整遮蔽。

## 來源及授權

Canonical source 在 AI_STYLE_WALL/skills；本 repo 的 SKILL.md／CLI 與來源 byte-exact 同步。niiice-threads 只含可攜工作流程與原創判準，不含私人 Threads 語料、公司 key 或客戶 token。

Proprietary，供 Niiice Turbo 使用者連接自己的帳號使用。由晨鈺有限公司（Niiice Design）維護。
