# skillpkg v2.0 - Tasks

## Overview

| Milestone | Description | Tasks | Status |
|-----------|-------------|-------|--------|
| M1 | Config & State Management | 5 | [x] |
| M2 | Dependency Resolution | 4 | [ ] |
| M3 | Sync Mechanism | 5 | [ ] |
| M4 | Installer Updates | 4 | [ ] |
| M5 | CLI Commands | 5 | [ ] |
| M6 | MCP Server Updates | 3 | [ ] |
| M7 | Migration & Polish | 4 | [ ] |

---

## M1: Config & State Management

> 建立 skillpkg.json 和 state.json 的讀寫管理

### Tasks

- [x] 1.1 定義 skillpkg.json schema
  - 建立 JSON Schema 檔案 (`packages/core/src/config/schemas/skillpkg.schema.json`)
  - 包含 skills, mcp, reminders, hooks, sync_targets
  - 加入 $schema 欄位支援 IDE 自動完成

- [x] 1.2 實作 ConfigManager class
  - `loadProjectConfig()` - 讀取 skillpkg.json
  - `saveProjectConfig()` - 寫入 skillpkg.json
  - `initProject()` - 初始化新專案
  - `addSkill()` / `removeSkill()` - 修改 skills

- [x] 1.3 定義 state.json schema
  - skills 狀態 (version, source, installed_by, depended_by)
  - mcp 狀態 (package, installed_by_skill)
  - sync_history (每個 target 的最後同步時間)

- [x] 1.4 實作 StateManager class
  - `loadState()` / `saveState()`
  - `recordSkillInstall()` / `recordSkillUninstall()`
  - `getDependents()` - 取得依賴此 skill 的其他 skill
  - `canUninstall()` - 檢查是否可安全移除

- [x] 1.5 建立測試案例
  - ConfigManager 單元測試 (27 tests)
  - StateManager 單元測試 (30 tests)
  - 邊界情況：空檔案、格式錯誤、缺少欄位

### 驗收標準
- [x] 可讀寫 skillpkg.json
- [x] 可讀寫 state.json
- [x] Schema 驗證正確
- [x] 測試覆蓋率 > 80% (149 tests passed)

---

## M2: Dependency Resolution

> 解析 skill 依賴關係（skill→skill, skill→MCP）

### Tasks

- [ ] 2.1 擴展 SKILL.md metadata 格式
  - 在 frontmatter 加入 dependencies 欄位
  - 支援 `skills:` 和 `mcp:` 依賴
  - 更新 parseSkillMetadata()

- [ ] 2.2 實作 DependencyResolver class
  - `resolveDependencies()` - 遞迴解析所有依賴
  - `buildDependencyTree()` - 建立依賴樹
  - `detectCircular()` - 檢測循環依賴

- [ ] 2.3 實作依賴安裝流程
  - 安裝前先解析完整依賴
  - 按依賴順序安裝（被依賴的先裝）
  - 記錄 installed_by 和 depended_by

- [ ] 2.4 建立測試案例
  - 單層依賴
  - 多層依賴（A→B→C）
  - 循環依賴檢測
  - MCP 依賴提示

### 驗收標準
- [ ] 正確解析 skill 依賴
- [ ] 正確解析 MCP 依賴
- [ ] 循環依賴會報錯
- [ ] depended_by 正確記錄

---

## M3: Sync Mechanism

> 同步 skills 到多個 AI 工具目錄

### Tasks

- [ ] 3.1 定義 sync target 配置
  - Claude Code: `.claude/skills/`
  - Cursor: `.cursor/rules/`
  - Codex: `AGENTS.md`
  - Copilot: `.github/copilot-instructions.md`
  - Windsurf: `.windsurf/rules/`

- [ ] 3.2 實作 Syncer class
  - `syncToTarget()` - 同步到單一目標
  - `syncAll()` - 同步到所有啟用的目標
  - `transformForTarget()` - 格式轉換

- [ ] 3.3 實作格式轉換
  - SKILL.md → 目錄結構（Claude Code, Cursor）
  - SKILL.md → 單檔合併（Codex, Copilot）
  - 保留 frontmatter 或移除

- [ ] 3.4 實作 MCP config 同步
  - 讀取 skillpkg.json 的 mcp 配置
  - 產生對應的 .mcp.json
  - 支援不同工具的 mcp 檔案位置

- [ ] 3.5 建立測試案例
  - 同步到各目標
  - 格式轉換正確性
  - 增量同步（只同步變更）

### 驗收標準
- [ ] 可同步到 5 種工具
- [ ] 格式轉換正確
- [ ] .mcp.json 正確產生
- [ ] sync_history 有更新

---

## M4: Installer Updates

> 更新安裝流程支援依賴和同步

### Tasks

- [ ] 4.1 更新 install 流程
  - 整合 DependencyResolver
  - 安裝前解析所有依賴
  - MCP 依賴提示安裝

- [ ] 4.2 更新 uninstall 流程
  - 檢查 dependents（誰依賴這個）
  - 有 dependents 時警告
  - 支援 `--force` 強制移除
  - 移除後清理孤兒依賴

- [ ] 4.3 實作 `installFromConfig()`
  - 讀取 skillpkg.json
  - 安裝所有列出的 skills
  - 類似 `npm install`

- [ ] 4.4 建立測試案例
  - 安裝帶依賴的 skill
  - 移除有依賴者的 skill
  - 從 config 批量安裝

### 驗收標準
- [ ] 依賴自動安裝
- [ ] MCP 依賴有提示
- [ ] 移除前檢查依賴
- [ ] 孤兒依賴可清理

---

## M5: CLI Commands

> 新增和更新 CLI 命令

### Tasks

- [ ] 5.1 新增 `skillpkg init` 命令
  - 互動式建立 skillpkg.json
  - 詢問專案名稱
  - 詢問要啟用的 sync targets

- [ ] 5.2 新增 `skillpkg sync` 命令
  - `skillpkg sync` - 同步到所有目標
  - `skillpkg sync <target>` - 同步到特定目標
  - `--dry-run` 預覽模式

- [ ] 5.3 新增依賴相關命令
  - `skillpkg deps <name>` - 顯示 skill 的依賴
  - `skillpkg why <name>` - 顯示誰依賴此 skill
  - `skillpkg tree` - 顯示完整依賴樹

- [ ] 5.4 新增 `skillpkg status` 命令
  - 顯示安裝的 skills
  - 顯示 MCP 狀態
  - 顯示同步狀態

- [ ] 5.5 更新現有命令
  - `install` 加入依賴解析輸出
  - `uninstall` 加入依賴檢查
  - `list` 加入依賴標示

### 驗收標準
- [ ] 所有命令可執行
- [ ] 幫助文字清晰
- [ ] 錯誤訊息友善

---

## M6: MCP Server Updates

> 更新 MCP server 的 tools

### Tasks

- [ ] 6.1 更新 install_skill tool
  - 返回依賴資訊
  - 返回需要的 MCP
  - 提示同步

- [ ] 6.2 更新 uninstall_skill tool
  - 檢查依賴者
  - 返回警告
  - 支援 force 參數

- [ ] 6.3 新增 sync tool
  - `sync_skills` - 同步到指定目標
  - 返回同步結果

### 驗收標準
- [ ] MCP tools 反映新功能
- [ ] 返回值包含依賴資訊

---

## M7: Migration & Polish

> 遷移工具和最終打磨

### Tasks

- [ ] 7.1 實作 migrate 命令
  - 從 v1.x 遷移到 v2.0
  - 產生 skillpkg.json
  - 產生 state.json

- [ ] 7.2 更新文件
  - README.md 更新
  - 新增 Migration Guide
  - 新增 skillpkg.json 範例

- [ ] 7.3 E2E 測試
  - 完整安裝流程
  - 完整同步流程
  - 遷移流程

- [ ] 7.4 發布準備
  - 版本號更新 (0.3.0)
  - CHANGELOG 更新
  - npm publish

### 驗收標準
- [ ] v1.x 可平滑升級
- [ ] 文件完整
- [ ] 測試通過
- [ ] 發布成功

---

## Dependencies Between Milestones

```
M1 (Config/State) ──┬──► M2 (Deps) ──┬──► M4 (Installer)
                    │                │
                    └──► M3 (Sync) ──┘
                                     │
                                     ▼
                              M5 (CLI) ──► M6 (MCP) ──► M7 (Polish)
```

## Estimated Effort

| Milestone | Estimated Time |
|-----------|----------------|
| M1 | 1 day |
| M2 | 1 day |
| M3 | 1.5 days |
| M4 | 0.5 day |
| M5 | 1 day |
| M6 | 0.5 day |
| M7 | 1 day |
| **Total** | **~6.5 days** |
