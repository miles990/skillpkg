# 專案腳手架 - 任務清單

## Overview

| Milestone | 名稱 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | ProjectInitializer | 2 | [ ] |
| M2 | CLI 整合 | 1 | [ ] |

**總計: 3 個任務**

---

## M1: ProjectInitializer

> 實作專案初始化邏輯

### Tasks

- [ ] 1.1 實作預設配置與生成
  - 定義 DEFAULT_PROJECT_CONFIG
  - 定義 OPTIONAL_MCP 列表
  - 實作 getDefaultConfig()
  - 實作 generate()

**檔案:** `packages/core/src/project/initializer.ts`, `packages/core/src/project/defaults.ts`

**_Prompt:**
```
Role: TypeScript 開發者

Task: 實作 ProjectInitializer
- 建立 defaults.ts 定義預設配置
- 建立 initializer.ts 實作初始化邏輯
- getDefaultConfig(name) 返回預設 ProjectConfig
- generate(config) 寫入 skillpkg.json

_Leverage:
- 現有 McpConfig 型別

Success:
- 可產生有效的 skillpkg.json
- 單元測試通過

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 執行測試驗證
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

- [ ] 1.2 實作互動模式
  - 使用 @inquirer/prompts
  - promptForOptions() 互動式取得配置
  - 顯示可選 MCP 列表

**檔案:** `packages/core/src/project/initializer.ts`

**_Prompt:**
```
Role: TypeScript 開發者，熟悉 CLI 互動

Task: 實作互動模式
- 使用 @inquirer/prompts 套件
- promptForOptions() 詢問專案名稱和 MCP 選項
- 返回完整的 ProjectConfig

_Leverage:
- @inquirer/prompts (input, confirm, checkbox)
- defaults.ts 中的 OPTIONAL_MCP

Success:
- 互動問答正常運作
- 返回正確的配置結構

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 手動測試互動流程
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] getDefaultConfig() 返回正確結構
- [ ] promptForOptions() 互動正常
- [ ] generate() 產生有效 JSON

---

## M2: CLI 整合

> 重構 init 命令為專案初始化

### Tasks

- [ ] 2.1 更新 init 命令
  - 移除原有 SKILL.md 生成邏輯
  - 加入 -i / --interactive flag
  - 整合 ProjectInitializer
  - 顯示下一步提示

**檔案:** `packages/cli/src/commands/init.ts`

**_Prompt:**
```
Implement the task for spec project-init, first run spec-workflow-guide to get the workflow guide then implement the task:

Role: CLI 開發者

Task: 重構 init 命令為專案初始化
- 移除原有 SKILL.md 生成邏輯（改到 new 命令）
- 加入 -i / --interactive 選項
- 呼叫 ProjectInitializer 產生 skillpkg.json
- 顯示 Next steps 提示

Success:
- skillpkg init 產生 skillpkg.json
- skillpkg init -i 進入互動模式

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 測試兩種模式
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] `skillpkg init` 產生 skillpkg.json
- [ ] `skillpkg init -i` 互動模式正常

---

## 依賴關係

```
M1 (Initializer) ──► M2 (CLI)
```

## 預估工作量

| Milestone | 預估 | 說明 |
|-----------|------|------|
| M1 | 小 | 配置生成邏輯 |
| M2 | 小 | CLI 整合 |

## 新增依賴

```bash
cd packages/core
npm install @inquirer/prompts
```
