# SKILL.md 統一格式 - 任務清單

## Overview

| Milestone | 名稱 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | SkillReader 簡化 | 1 | [ ] |
| M2 | SkillCreator 新增 | 1 | [ ] |
| M3 | CLI new 命令 | 1 | [ ] |
| M4 | Syncer 簡化 | 1 | [ ] |

**總計: 4 個任務**

---

## M1: SkillReader 簡化

> 移除 skill.yaml 支援，只讀 SKILL.md

### Tasks

- [ ] 1.1 簡化 SkillReader
  - 移除 skill.yaml 解析邏輯
  - 只讀取 SKILL.md
  - 無 SKILL.md 時拋出明確錯誤
  - 使用 gray-matter 解析 frontmatter

**檔案:** `packages/core/src/parser/parser.ts` → 重構為 `packages/core/src/skill/reader.ts`

**_Prompt:**
```
Implement the task for spec skill-format, first run spec-workflow-guide to get the workflow guide then implement the task:

Role: TypeScript 開發者，熟悉 Node.js 檔案操作

Task: 簡化 SkillReader，移除 skill.yaml 支援
- 移除所有 skill.yaml 相關程式碼
- 只讀取 SKILL.md 檔案
- 使用 gray-matter 解析 frontmatter
- 無 SKILL.md 時拋出 Error: "SKILL.md not found in {path}"

Restrictions:
- 不保留向後相容
- 不讀取 skill.yaml

_Leverage:
- gray-matter 套件
- 現有 ParsedSkill 型別

_Requirements: FR-2

Success:
- readSkill() 只讀 SKILL.md
- 單元測試通過

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 執行測試驗證
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] 移除所有 skill.yaml 程式碼
- [ ] 單元測試通過

---

## M2: SkillCreator 新增

> 建立 SKILL.md 的模組

### Tasks

- [ ] 2.1 實作 SkillCreator
  - create(options) 建立新 skill
  - generateTemplate() 產生 SKILL.md 模板
  - 支援建立目錄

**檔案:** `packages/core/src/skill/creator.ts`

**_Prompt:**
```
Implement the task for spec skill-format, first run spec-workflow-guide to get the workflow guide then implement the task:

Role: TypeScript 開發者

Task: 實作 SkillCreator
- create(options) 建立新 skill（目錄 + SKILL.md）
- generateTemplate(name, description) 產生 SKILL.md 內容
- 使用 gray-matter stringify 產生 frontmatter

Restrictions:
- 不產生 skill.yaml

_Leverage:
- gray-matter 套件
- SkillMetadata 型別

_Requirements: FR-1

Success:
- SkillCreator.create() 建立目錄和 SKILL.md
- generateTemplate() 產生有效的 SKILL.md

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 執行測試驗證
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] create() 可建立 skill 目錄和 SKILL.md
- [ ] 單元測試通過

---

## M3: CLI new 命令

> 新增 skillpkg new 命令

### Tasks

- [ ] 3.1 新增 new 命令
  - `skillpkg new [name]` 建立新 skill
  - `skillpkg new -i` 互動模式
  - 整合 SkillCreator

**檔案:** `packages/cli/src/commands/new.ts`, `packages/cli/src/cli.ts`

**_Prompt:**
```
Implement the task for spec skill-format, first run spec-workflow-guide to get the workflow guide then implement the task:

Role: CLI 開發者

Task: 新增 skillpkg new 命令
- 建立 new.ts 命令檔
- `skillpkg new [name]` 建立 name/SKILL.md
- `skillpkg new` 在當前目錄建立 SKILL.md
- `skillpkg new -i` 互動式詢問名稱和描述
- 顯示成功訊息和下一步提示

_Leverage:
- SkillCreator
- @inquirer/prompts (input)

_Requirements: FR-1

Success:
- `skillpkg new my-skill` 建立 my-skill/SKILL.md
- `skillpkg new -i` 進入互動模式

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 手動測試命令
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] `skillpkg new my-skill` 正常運作
- [ ] `skillpkg new -i` 互動模式正常

---

## M4: Syncer 簡化

> 移除轉換邏輯，直接複製

### Tasks

- [ ] 4.1 簡化 Syncer
  - 直接複製 SKILL.md 到目標
  - 移除 skill.yaml → SKILL.md 轉換
  - 更新測試

**檔案:** `packages/core/src/syncer/syncer.ts`

**_Prompt:**
```
Implement the task for spec skill-format, first run spec-workflow-guide to get the workflow guide then implement the task:

Role: TypeScript 開發者

Task: 簡化 Syncer 直接複製 SKILL.md
- syncSkill() 直接複製 SKILL.md 檔案
- 移除所有 yaml → md 轉換邏輯
- 更新相關測試

_Requirements: FR-3

Success:
- sync 直接複製 SKILL.md
- 整合測試通過

Instructions:
1. 在 tasks.md 將此任務標記為 [-] in-progress
2. 實作程式碼
3. 執行測試驗證
4. 使用 log-implementation 記錄
5. 將任務標記為 [x] completed
```

### 驗收標準
- [ ] `skillpkg sync` 直接複製
- [ ] 所有測試通過

---

## 依賴關係

```
M1 (Reader) ──► M2 (Creator) ──► M3 (CLI new)
                    │
                    ▼
               M4 (Syncer)
```

## 預估工作量

| Milestone | 預估 | 說明 |
|-----------|------|------|
| M1 | 小 | 移除程式碼 |
| M2 | 小 | 新增模板生成 |
| M3 | 小 | CLI 命令 |
| M4 | 小 | 簡化邏輯 |

## 新增依賴

```bash
cd packages/core
npm install gray-matter
```
