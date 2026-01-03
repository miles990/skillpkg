# MCP 配置管理 任務清單

## Overview

| Milestone | 名稱 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | 資料結構擴展 | 2 | [ ] |
| M2 | ConfigManager 擴展 | 2 | [ ] |
| M3 | Syncer 擴展 | 2 | [ ] |
| M4 | CLI 命令 | 3 | [ ] |
| M5 | 整合測試 | 1 | [ ] |

**總計: 10 個任務**

---

## M1: 資料結構擴展

> 擴展 skillpkg.json schema 支援 MCP 配置

### Tasks

- [ ] 1.1 定義 MCP 型別
  - McpConfig interface (package/command 模式)
  - McpTargetConfig interface
  - 更新 SkillpkgConfig 加入 `mcp` 欄位

- [ ] 1.2 定義 MCP Target 常數
  - CLAUDE_CODE_TARGET (首要支援)
  - 預留 CURSOR_TARGET 結構

### 驗收標準
- [ ] 型別編譯通過
- [ ] 現有測試不受影響

---

## M2: ConfigManager 擴展

> 在現有 ConfigManager 加入 MCP 管理方法

### Tasks

- [ ] 2.1 實作 MCP 讀寫方法
  - getMcp(): 取得所有 MCP 配置
  - addMcp(name, config): 新增 MCP
  - removeMcp(name): 移除 MCP
  - hasMcp(name): 檢查是否存在

- [ ] 2.2 實作名稱推斷與更新
  - inferMcpName(source): 從套件名推斷名稱
  - updateMcp(name, config): 更新版本

### 驗收標準
- [ ] 可讀寫 skillpkg.json 的 mcp 欄位
- [ ] 相容無 mcp 欄位的舊配置
- [ ] 單元測試通過

---

## M3: Syncer 擴展

> 在現有 Syncer 加入 MCP 同步功能

### Tasks

- [ ] 3.1 實作 MCP 配置生成
  - generateMcpEntry(): 從 McpConfig 產生平台格式
  - 支援 package 模式 (`npx -y package`)
  - 支援 command 模式 (自訂命令)

- [ ] 3.2 實作 MCP 同步
  - syncMcpToTarget(): 同步到目標平台
  - 合併現有 mcpServers (不覆蓋其他設定)
  - 支援 dry-run 預覽

### 驗收標準
- [ ] 可產生 ~/.claude.json 的 mcpServers 區段
- [ ] 合併不破壞現有設定
- [ ] dry-run 正確顯示差異

---

## M4: CLI 命令

> 實作 skillpkg mcp 子命令群

### Tasks

- [ ] 4.1 實作 mcp add/remove/list
  - `skillpkg mcp add <source> [--as name]`
  - `skillpkg mcp remove <name>` (別名: rm)
  - `skillpkg mcp list [--json]`
  - `skillpkg mcp` (無參數顯示說明)

- [ ] 4.2 實作 mcp update
  - `skillpkg mcp update [name] [--version ver]`
  - 更新指定或全部 MCP 版本

- [ ] 4.3 擴展 sync 命令
  - `skillpkg sync` 同時同步 skills + MCP
  - `skillpkg sync --mcp-only` 只同步 MCP
  - 顯示 MCP 同步結果

### 驗收標準
- [ ] 所有 CLI 命令可用
- [ ] --help 正確顯示
- [ ] 錯誤訊息清楚

---

## M5: 整合測試

> 端對端測試

### Tasks

- [ ] 5.1 整合測試與文件
  - 完整 add → sync 流程測試
  - 多 MCP 管理測試
  - 更新 README.md 新增 MCP 章節

### 驗收標準
- [ ] 所有測試通過
- [ ] 文件包含使用範例

---

## 依賴關係

```
M1 (型別) ──► M2 (ConfigManager) ──► M4 (CLI)
                     │
                     ▼
               M3 (Syncer) ──► M4 (CLI)
                                   │
                                   ▼
                              M5 (測試)
```

## 預估工作量

| Milestone | 預估 | 說明 |
|-----------|------|------|
| M1 | 小 | 型別定義 |
| M2 | 小 | 擴展現有模組 |
| M3 | 小 | 擴展現有模組 |
| M4 | 中 | CLI 整合 |
| M5 | 小 | 測試與文件 |
