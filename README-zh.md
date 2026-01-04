# skillpkg

> **AI Agent Skills 套件管理器** — 安裝一次，到處使用。

[![npm version](https://img.shields.io/npm/v/skillpkg-cli.svg)](https://www.npmjs.com/package/skillpkg-cli)
[![npm version](https://img.shields.io/npm/v/skillpkg-mcp-server.svg)](https://www.npmjs.com/package/skillpkg-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Standard-blue)](https://agentskills.io)

AI agent skills 的套件管理器。支援 **Claude Code**、**OpenAI Codex**、**GitHub Copilot**、**Cursor**，以及任何採用 [Agent Skills 開放標準](https://agentskills.io) 的平台。

[English](./README.md) | 繁體中文

## 痛點

```
😫 「每個專案都要手動複製同樣的 skill 檔案」
😫 「團隊用不同的 AI 工具，skills 無法共用」
😫 「想讓 AI 即時學習新技能，但沒有標準方法」
😫 「手動管理 skill 依賴簡直是惡夢」
```

## 解決方案

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   skillpkg = AI Agent Skills 的 npm                             │
│                                                                 │
│   ┌─────────────┐                      ┌─────────────────────┐  │
│   │  SKILL.md   │                      │  Claude Code        │  │
│   │  (GitHub)   │ ───► skillpkg ───►   │  OpenAI Codex       │  │
│   │  (Gist)     │      安裝 & 同步      │  GitHub Copilot     │  │
│   │  (URL)      │                      │  Cursor             │  │
│   └─────────────┘                      └─────────────────────┘  │
│                                                                 │
│   一個 skill，所有平台，零摩擦。                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 為什麼選擇 skillpkg？

| 沒有 skillpkg | 有 skillpkg |
|---------------|-------------|
| 手動複製 skills 到每個專案 | `skillpkg install` 一次搞定 |
| Skills 只能用在單一平台 | 同步到 Claude、Codex、Copilot、Cursor |
| 沒有依賴管理 | 自動解析 skill 和 MCP 依賴 |
| AI 無法學習新技能 | MCP Server 讓 AI 自主學習 |
| 沒有標準格式 | 業界標準 SKILL.md 格式 |

## 支援平台

skillpkg 實作 [Agent Skills 開放標準](https://agentskills.io)，支援所有官方採用者：

| 平台 | 輸出路徑 | 狀態 |
|------|---------|------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `.claude/skills/` | ✅ 支援 |
| [OpenAI Codex](https://openai.com/index/introducing-codex/) | `.codex/skills/` | ✅ 支援 |
| [GitHub Copilot](https://github.com/features/copilot) | `.github/skills/` | ✅ 支援 |
| [Cursor](https://cursor.com) | `.cursor/skills/` | ✅ 支援 |

## 快速開始

### 安裝 CLI

```bash
npm install -g skillpkg-cli
```

### 搜尋 Skills

```bash
# 搜尋 GitHub、awesome-lists 和本地 skills
skillpkg search "git commit"

# 輸出範例：
# Found 8 skills:
#   commit-helper  ⭐120  github:anthropics/commit-helper
#   git-expert     ⭐85   github:user/git-skills#expert
```

### 安裝 Skill

```bash
# 從 GitHub 安裝
skillpkg install anthropics/commit-helper

# 從子目錄安裝
skillpkg install github:user/repo#skills/my-skill

# 全域安裝（所有專案都能用）
skillpkg install -g anthropics/commit-helper
```

### 同步到所有平台

```bash
# 同步已安裝的 skills 到所有偵測到的 AI 平台
skillpkg sync

# 同步到指定平台
skillpkg sync --target claude-code,codex,copilot,cursor
```

## 功能特色

- **多來源搜尋** — 搜尋 GitHub、awesome-lists 和本地 skills
- **跨平台同步** — 一個 skill 可用於 Claude、Codex、Copilot、Cursor
- **完整目錄支援** — 包含腳本、模板、資源的 skills 完整支援
- **依賴管理** — 自動解析 skill 和 MCP server 依賴
- **子路徑安裝** — 從 repo 子目錄安裝：`user/repo#path/to/skill`
- **專案設定** — `skillpkg.json` 讓團隊設定可重現
- **MCP Server** — 讓 AI agents 自主安裝和管理 skills
- **開放標準** — 基於 [Agent Skills 規格](https://agentskills.io)

## CLI 指令

| 指令 | 說明 |
|------|------|
| `skillpkg init` | 初始化專案，建立 `skillpkg.json` |
| `skillpkg new [name]` | 建立新 skill (SKILL.md) |
| `skillpkg install [source]` | 安裝 skill，自動解析依賴 |
| `skillpkg uninstall <skill>` | 移除 skill（檢查依賴） |
| `skillpkg list` | 列出已安裝的 skills |
| `skillpkg sync [skill]` | 同步 skills 到 AI 平台 |
| `skillpkg search <query>` | 搜尋 skills |
| `skillpkg info <skill>` | 取得 skill 詳細資訊 |
| `skillpkg status` | 顯示專案狀態 |

### 安裝來源

```bash
# GitHub repository
skillpkg install user/repo
skillpkg install github:user/repo

# GitHub 子目錄
skillpkg install github:user/repo#skills/my-skill

# GitHub Gist
skillpkg install gist:abc123def

# 直接 URL
skillpkg install https://example.com/SKILL.md

# 本地路徑
skillpkg install ./my-local-skill
```

## MCP Server — AI 自主學習

透過 [Model Context Protocol](https://modelcontextprotocol.io/) 讓 AI agents 搜尋、安裝和管理 skills。

### Claude Code 設定

```bash
claude mcp add skillpkg -- npx -y skillpkg-mcp-server
```

### Claude Desktop 設定

加入 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "skillpkg": {
      "command": "npx",
      "args": ["-y", "skillpkg-mcp-server"]
    }
  }
}
```

### AI 自主學習運作方式

```
使用者：幫我寫出更好的 git commits

Claude：我來搜尋相關的 skill...
        → search_skills("git commit helper")

        找到 "commit-helper" - 安裝中...
        → install_skill("anthropics/commit-helper")

        載入 skill 指令...
        → load_skill("commit-helper")

        現在我可以幫你寫出符合規範的 commits！
```

### 可用的 MCP 工具

| 工具 | 說明 |
|------|------|
| `search_skills` | 跨來源搜尋 skills |
| `recommend_skill` | AI 驅動的 skill 推薦 |
| `install_skill` | 安裝並解析依賴 |
| `load_skill` | 載入 skill 指令 |
| `sync_skills` | 同步到 AI 平台 |
| `list_skills` | 列出已安裝 skills |
| `create_skill` | 建立新 SKILL.md |

## SKILL.md 格式

[Agent Skills 開放標準](https://agentskills.io) 使用 SKILL.md — Markdown 加上 YAML frontmatter：

```markdown
---
name: my-skill
version: 1.0.0
description: 用於 X 的實用 skill
dependencies:
  skills:
    - github:some/other-skill
  mcp:
    - package: "@some/mcp-server"
---

# My Skill

給 AI agent 的指令...

## 使用時機

- 情境 A
- 情境 B

## 使用方式

1. 步驟一
2. 步驟二
```

### Skill 目錄結構

Skills 可以包含額外檔案：

```
my-skill/
├── SKILL.md              # 必要：skill 定義
├── scripts/
│   └── helper.py         # Python 腳本
├── templates/
│   └── component.tsx     # 模板檔案
└── examples/
    └── usage.md          # 範例
```

## 專案設定

建立 `skillpkg.json` 進行團隊級 skill 管理：

```json
{
  "name": "my-project",
  "skills": {
    "commit-helper": "github:anthropics/commit-helper",
    "code-reviewer": "github:my-org/code-reviewer"
  },
  "mcp": {
    "context7": {
      "package": "@context7/mcp-server"
    }
  },
  "sync_targets": {
    "claude-code": true,
    "codex": true,
    "copilot": true,
    "cursor": true
  }
}
```

然後執行 `skillpkg install` 即可設定整個團隊。

## 套件

| 套件 | 說明 |
|------|------|
| [skillpkg-cli](https://www.npmjs.com/package/skillpkg-cli) | 命令列工具 |
| [skillpkg-mcp-server](https://www.npmjs.com/package/skillpkg-mcp-server) | AI agents 用的 MCP Server |
| [skillpkg-core](https://www.npmjs.com/package/skillpkg-core) | 核心函式庫（供整合用） |

## 使用情境

### 個人開發者

```bash
# 全域安裝你最愛的 skills
skillpkg install -g anthropics/commit-helper
skillpkg install -g my-org/code-reviewer

# 現在每個專案都能用了
```

### 團隊協作

```bash
# 在 repo 中分享 skillpkg.json
git add skillpkg.json
git commit -m "Add team AI skills"

# 新成員只需執行：
skillpkg install
```

### AI 工具開發者

```bash
# 建立可在任何平台使用的 skills
skillpkg new my-awesome-skill

# 發布到 GitHub，使用者這樣安裝：
skillpkg install your-org/my-awesome-skill
```

## 環境變數

| 變數 | 說明 |
|------|------|
| `GITHUB_TOKEN` | GitHub API token（提高請求限制） |
| `SKILLPKG_HOME` | 自訂全域儲存路徑 |

## 開發

```bash
git clone https://github.com/miles990/skillpkg.git
cd skillpkg
pnpm install
pnpm build
pnpm test  # 246 個測試
```

## 相關專案

- [Agent Skills Specification](https://agentskills.io) — 開放標準
- [awesome-claude-skills](https://github.com/anthropics/awesome-claude-skills) — 精選 skill 列表
- [Model Context Protocol](https://modelcontextprotocol.io/) — AI 工具整合協定

## 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 授權

MIT License — 詳見 [LICENSE](LICENSE)。

---

**關鍵字**：AI agent skills、Claude Code skills、OpenAI Codex skills、GitHub Copilot skills、Cursor skills、SKILL.md、AI 程式助手、LLM skills、agent skills 套件管理器、AI skill 管理、跨平台 AI skills

Made with AI, for AI.
