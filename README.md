# niiice-social — Agent Skill for Niiice Turbo 社群 MCP

讓 Claude Code、Cursor、Codex 等 AI agent 直接操作 [Niiice Turbo](https://niiiceturbo.com) 的社群管理：
**產生 Facebook／Instagram／Threads 貼文草稿 → 以網址附圖 → 在你同意後排程**。

> ⛔ **不會立即發布。** 這個 skill 最多把貼文「排」進行事曆（最早 30 分鐘後），發出去的是到期的排程器；
> 排好之後你隨時能在 Niiice Turbo 的行事曆修改或刪除。要立刻發，請到發文工作台自己按。

## 安裝

```bash
npx skills add monsurface/niiice-social-agent-skill
```

或直接接 MCP（任何支援 Streamable HTTP 的 client）：

```bash
claude mcp add --transport http niiice-social         <讀取 MCP URL>
claude mcp add --transport http niiice-social-compose <產草稿 MCP URL>
```

## 設定

1. 到 Niiice Turbo →「社群管理」→ 左下「MCP 設定」，複製兩張卡的 MCP URL：
   - **安全連接您的 AI 助手**（讀取：貼文、留言、成效、雷達、企劃、用量）
   - **AI 產草稿連線**（產草稿＋附圖；建立時可勾「**允許 AI 排程發布**」才會多出排程能力）
2. 存到本機：

```bash
node skills/niiice-social/scripts/niiice-social.cjs setup \
  --url "<產草稿 MCP URL>" --read-url "<讀取 MCP URL>"
```

設定存在 `~/.config/niiice-social/config.json`（權限 0600）。環境變數
`NIIICE_SOCIAL_MCP_URL`／`NIIICE_SOCIAL_READ_MCP_URL` 優先於設定檔。

> 🔑 MCP URL 內含長效 token，**視同密碼**：不要貼到對話、log 或版本控制。外洩就到 MCP 設定撤銷或重建。

## 能做什麼

| 連線 | 能做 | 不能做 |
|---|---|---|
| 讀取 | 貼文、留言工作匣、成效與曲線、Threads 雷達、Outreach、品牌、行事曆、用量（17 顆唯讀工具） | 任何寫入 |
| 產草稿 | 產貼文草稿（用你的 AI 額度）、以網址上傳圖片並附到草稿 | 立即發布、回覆、刪除、隱藏、按讚 |
| 產草稿＋排程 | 以上加：預覽排程、排程（≥30 分鐘後、≤90 天）、取消排程 | **立即發布**（永遠不提供） |

## CLI 速查

```
setup --url <產草稿 MCP URL> [--read-url <讀取 MCP URL>]
config                                        # 看目前用哪個 URL（會遮 token）
tools [--read]                                # tools/list
call <tool> [--json '{...}'] [--read] [--raw] # 通用出口
options                                       # 可選帳號／品牌／任務／語氣／額度
draft --topic … --accounts a,b --id <crid> [--purpose --tone --length --hook --cta --media u1,u2] [--confirm]
get-draft <draft_id>
drafts [--limit N]
upload-media --url <圖片網址> [--alt …] [--confirm]
attach-media --draft <id> --urls u1,u2 [--confirm]
preview-schedule --draft <id> --at <ISO 含時區>
schedule --draft <id> --at <ISO> --token <confirmation_token> --id <crid> [--confirm]
cancel-schedule --draft <id> --id <crid> [--confirm]
inbox                                         # 未回覆留言摘要（讀取連線）
```

### 三條安全規則

1. **寫入捷徑沒帶 `--confirm` 只印預覽、不送出**（`draft`／`upload-media`／`attach-media`／`schedule`／`cancel-schedule`）。
2. **重試要用同一個 `--id`**：它是冪等鍵。收到「稍後再試」或 `confirmation_stale` 時**都不要換 id**——換了會產生兩份、扣兩次額度。
3. **排程 ≠ 發布**：排好只能說「已排程於 台北 …，到行事曆可改可刪」。

## 典型流程

```bash
node scripts/niiice-social.cjs options                       # 1. 看帳號 id、額度
node scripts/niiice-social.cjs draft --topic "本週選股邏輯" \
  --accounts <account_id> --id my-2026-08-17-1 --confirm     # 2. 產草稿（用額度）
node scripts/niiice-social.cjs get-draft <draft_id>          # 3. 輪詢到 ready
node scripts/niiice-social.cjs upload-media --url <圖片網址> --confirm
node scripts/niiice-social.cjs attach-media --draft <draft_id> --urls <media_url> --confirm
node scripts/niiice-social.cjs preview-schedule --draft <draft_id> --at 2026-08-18T10:00:00+08:00
# → 把預覽的時間與帳號唸給使用者確認，拿 confirmation_token（15 分鐘內有效）
node scripts/niiice-social.cjs schedule --draft <draft_id> --at 2026-08-18T10:00:00+08:00 \
  --token <confirmation_token> --id my-2026-08-17-sched-1 --confirm
```

## 需求

- Node.js 18+（用內建 `fetch`，零相依套件）
- 一組 Niiice Turbo 社群管理權限的帳號

## 授權

Proprietary — 供 Niiice Turbo 使用者連接自己的帳號使用。程式碼公開是為了讓 `npx skills add` 安裝與內容可稽核。

由晨鈺有限公司（Niiice Design）維護。
