# 專案腳手架 - 需求規格

## 概述

`skillpkg init` 命令用於快速初始化專案的 skillpkg.json，包含推薦的 skills 和 MCP 配置。

**核心理念：一鍵啟動，快速進入 AI 開發環境。**

## 命令結構

```bash
skillpkg init           # 專案配置 → skillpkg.json
skillpkg init -i        # 互動式專案配置
skillpkg new [name]     # 新建 skill → SKILL.md（見 skill-format spec）
```

## 問題陳述

### 現況
- 新專案需要手動建立 skillpkg.json
- 不知道該安裝哪些 skills / MCP
- 每次都要重複相同的配置步驟

### 目標
- 一個命令完成專案初始化
- 根據專案類型推薦配置
- 可選互動式或快速模式

## 使用者故事

### US-1: 新專案開發者
**As a** 開始新專案的開發者
**I want to** 快速初始化 AI 開發環境
**So that** 我可以立即開始使用 Claude Code

**驗收標準:**
- `skillpkg init` 建立 skillpkg.json
- 包含推薦的 skills 和 MCP
- 執行 `skillpkg sync` 後即可使用

## 功能需求

### FR-1: 快速模式

```bash
skillpkg init
# 使用預設配置，不詢問
```

產生的 skillpkg.json：
```json
{
  "name": "my-project",
  "skills": {},
  "mcp": {
    "context7": {
      "package": "@context7/mcp-server"
    }
  },
  "sync_targets": {
    "claude-code": true
  }
}
```

### FR-2: 互動模式

```bash
skillpkg init -i
# 互動式詢問偏好
```

互動流程：
```
? 專案名稱: my-project
? 加入推薦 MCP? (Y/n)
  ✓ context7 - 文件查詢
  ○ github - GitHub 操作 (需要 token)
? 加入推薦 Skills? (Y/n)

✓ 建立 skillpkg.json

下一步:
  skillpkg sync    # 同步到 Claude Code
```

### FR-3: 預設推薦

| 類型 | 預設包含 | 說明 |
|------|----------|------|
| MCP | context7 | 文件查詢，無需 API key |
| Skills | (無) | 用戶自行選擇 |

### FR-4: 與 new 命令的分工

```bash
skillpkg init           # 產生 skillpkg.json（專案配置）
skillpkg new [name]     # 產生 SKILL.md（skill 開發）
```

## 非功能需求

### NFR-1: 簡單優先
- 快速模式不問問題
- 最少必要配置

### NFR-2: 可擴展
- 未來可加入更多模板/預設

## 驗收標準

- [ ] `skillpkg init` 產生 skillpkg.json
- [ ] `skillpkg init -i` 提供互動選擇
- [ ] 預設包含 context7 MCP
- [ ] `skillpkg sync` 可正常同步

## 範圍外

- 專案類型模板（React/Python 等）→ 未來版本
- 自訂模板系統 → 未來版本
