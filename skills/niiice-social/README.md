# niiice-social CLI

讀取及寫入 Niiice Turbo 社群 MCP 的 Node 18+ 零依賴 CLI。來源維護於 AI_STYLE_WALL；本 repo 的 SKILL.md 與 CLI 與來源保持 byte-exact。

```text
node scripts/niiice-social.cjs setup --url "<自己的產草稿 MCP URL>" --read-url "<自己的讀取 MCP URL>"
node scripts/niiice-social.cjs options
node scripts/niiice-social.cjs brief --account <帳號ID> --purpose knowledge
node scripts/niiice-social.cjs direct-draft --accounts <帳號ID> --content-file <UTF-8稿件> --brief <brief_id> --id <穩定UUID>
```

最後一行只預覽，已授權存稿才追加 `--confirm`；串文先預覽切段再帶 `--chain 0`。改稿由客戶自己的模型完成；Lite 收到 plan_no_generation 不重試平台生成。

完整 CLI 指令及各種能力見 [SKILL.md](SKILL.md)，Claude Code／Codex 安裝與其他工具範例見 [INSTALL.md](../../INSTALL.md)。設定只留個人電腦；逾時先查既有結果並沿用識別字。
