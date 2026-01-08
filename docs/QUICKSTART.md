# skillpkg Quick Start

> 3 分鐘安裝你的第一個 AI Skill

## 什麼是 skillpkg？

skillpkg 是 AI 代理的技能包管理器，讓 Claude Code 可以按需學習新能力。

```
你的專案 + skillpkg → Claude 自動學習需要的技能 → 完成任務
```

---

## Step 1: 確認環境 (30 秒)

```bash
# 確認 Claude Code 已安裝
claude --version

# 確認在專案目錄
pwd
```

---

## Step 2: 使用 skillpkg (2 分鐘)

### 方式 A: 在 Claude Code 中使用（推薦）

skillpkg MCP Server 讓 Claude 可以自主管理技能：

```
# 在 Claude Code 對話中說：

搜尋 frontend 相關的技能

幫我安裝 backend 技能

列出已安裝的技能
```

Claude 會自動使用 `recommend_skill`、`install_skill` 等工具。

### 方式 B: 使用 CLI

```bash
# 搜尋技能
npx skillpkg-cli search "backend"

# 安裝技能
npx skillpkg-cli install miles990/claude-software-skills#skills/backend

# 列出已安裝
npx skillpkg-cli list

# 同步到 Claude Code
npx skillpkg-cli sync
```

---

## Step 3: 驗證安裝 (30 秒)

```bash
# 檢查 skills 目錄
ls .claude/skills/ 2>/dev/null || ls .skillpkg/skills/

# 或在 Claude Code 中說
列出所有已安裝的技能
```

---

## 常用指令速查

| 任務 | CLI | Claude Code 對話 |
|------|-----|------------------|
| 搜尋技能 | `npx skillpkg-cli search "keyword"` | `搜尋 keyword 相關技能` |
| 安裝技能 | `npx skillpkg-cli install source` | `安裝 skill-name 技能` |
| 列出技能 | `npx skillpkg-cli list` | `列出已安裝的技能` |
| 查看詳情 | `npx skillpkg-cli info name` | `查看 skill-name 的說明` |
| 同步技能 | `npx skillpkg-cli sync` | (自動) |

---

## 常見問題

### Q: 找不到 skillpkg 命令？

使用 `npx` 不需要全域安裝：
```bash
npx skillpkg-cli list
```

或全域安裝：
```bash
npm install -g skillpkg-cli
```

### Q: MCP Server 沒有回應？

確認 `.mcp.json` 存在且包含 skillpkg：
```bash
cat .mcp.json | grep skillpkg
```

重新啟動 Claude Code。

### Q: 技能安裝後沒有生效？

```bash
# 同步到 Claude Code
npx skillpkg-cli sync

# 或重啟 Claude Code session
```

---

## 下一步

| 目標 | 指令 |
|------|------|
| 安裝軟體技能包 | `npx skillpkg-cli install miles990/claude-software-skills` |
| 安裝領域技能包 | `npx skillpkg-cli install miles990/claude-domain-skills` |
| 了解 MCP 工具 | 查看 [mcp-tool-usage-guide.md](mcp-tool-usage-guide.md) |

---

## 成功！

```
✅ skillpkg 可以運作
✅ 可以搜尋和安裝技能
✅ Claude Code 可以使用技能

開始探索更多技能吧！
```
