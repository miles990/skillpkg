# MCP 配置管理功能需求規格

## 概述

讓 skillpkg 能夠管理 MCP (Model Context Protocol) servers 的配置，並同步到 AI 平台。

**核心理念：MCP 不需要預先安裝，只需要配置。Claude Code 會透過 npx 自動下載執行。**

## 目標

1. 統一管理 skills 和 MCP servers 配置
2. 簡化 MCP server 的配置流程
3. 自動生成 Claude Code / Cursor 等平台的 MCP 配置
4. 團隊共享：git commit skillpkg.json → 環境一致

## 功能需求

### FR-1: MCP 新增命令

```bash
# 新增 npm 套件（自動推斷名稱）
skillpkg mcp add @context7/mcp-server
skillpkg mcp add skillpkg-mcp-server

# 指定別名
skillpkg mcp add @context7/mcp-server --as context7

# 從 GitHub
skillpkg mcp add github:anthropics/mcp-server-filesystem --as filesystem

# 自訂配置
skillpkg mcp add my-server --command node --args ./my-mcp.js
```

### FR-2: MCP 列表命令

```bash
skillpkg mcp list
# 輸出:
# NAME          PACKAGE                      TYPE
# context7      @context7/mcp-server         npm
# skillpkg      skillpkg-mcp-server          npm
# my-server     (custom command)             custom

skillpkg mcp list --json  # JSON 輸出
```

### FR-3: MCP 移除命令

```bash
skillpkg mcp remove context7
skillpkg mcp rm context7  # 別名
```

### FR-3.5: MCP 更新命令

```bash
# 更新指定 MCP 到最新版
skillpkg mcp update context7

# 更新全部 MCP
skillpkg mcp update

# 更新到指定版本
skillpkg mcp update context7 --version 2.0.0
```

**版本處理邏輯：**
- 無版本 → `npx -y package` (永遠最新)
- 有版本 → `npx -y package@version` (鎖定版本)
- `update` → 移除版本鎖定，改為最新

### FR-4: 統一同步命令

```bash
# 同步 skills + MCP 到所有平台
skillpkg sync

# 只同步 MCP
skillpkg sync --mcp-only

# 同步到指定平台
skillpkg sync --target claude-code

# 預覽
skillpkg sync --dry-run
```

產生的配置 (`~/.claude.json`):
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "skillpkg": {
      "command": "npx",
      "args": ["-y", "skillpkg-mcp-server"]
    }
  }
}
```

### FR-5: skillpkg.json MCP 區段

```json
{
  "name": "my-project",
  "skills": {
    "code-reviewer": "github:user/code-reviewer"
  },
  "mcp": {
    "context7": {
      "package": "@context7/mcp-server"
    },
    "skillpkg": {
      "package": "skillpkg-mcp-server"
    },
    "custom-server": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "env": {
        "API_KEY": "${MCP_API_KEY}"
      }
    }
  },
  "sync_targets": {
    "claude-code": true
  }
}
```

### FR-6: Skill 依賴 MCP 提示

當 skill 宣告 MCP 依賴時，安裝後提示：

```yaml
# SKILL.md
---
dependencies:
  mcp:
    - name: context7
      package: "@context7/mcp-server"
---
```

```bash
skillpkg install my-skill
# 輸出:
# ✓ Installed my-skill
#
# ℹ This skill requires MCP server: context7
#   Add it with: skillpkg mcp add @context7/mcp-server --as context7
```

### FR-7: MCP 無參數顯示說明

```bash
skillpkg mcp
# 輸出:
# MCP Server Management
#
# Commands:
#   add <package> [--as name]  Add MCP server configuration
#   remove <name>              Remove MCP server configuration
#   list [--json]              List configured MCP servers
#
# After adding MCP servers, run 'skillpkg sync' to update platform config.
```

## 非功能需求

### NFR-1: 彈性
- 不驗證 npm 套件是否存在（彈性優先）
- 支援自訂 command/args（不只是 npm 套件）
- 可手動編輯 skillpkg.json

### NFR-2: 配置目標
- Claude Code (`~/.claude.json`) - 首要支援
- Cursor (預留)
- VSCode + Continue (預留)

### NFR-3: 安全性
- 環境變數支援 (`${VAR_NAME}`)
- 不在配置檔中儲存敏感資訊
- sync 時警告未設定的環境變數

## 驗收標準

- [ ] `skillpkg mcp add` 可新增 MCP 配置（支援版本）
- [ ] `skillpkg mcp list` 顯示已配置的 MCP servers
- [ ] `skillpkg mcp remove` 可移除 MCP 配置
- [ ] `skillpkg mcp update` 可更新 MCP 版本
- [ ] `skillpkg sync` 可同步 skills + MCP 到平台
- [ ] 安裝 skill 時提示 MCP 依賴
