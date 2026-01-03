# SKILL.md 統一格式 任務清單

## Overview

| Milestone | 名稱 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | SkillReader 更新 | 2 | [ ] |
| M2 | SkillWriter 新增 | 2 | [ ] |
| M3 | CLI 更新 | 2 | [ ] |
| M4 | Syncer 簡化 | 1 | [ ] |

**總計: 7 個任務**

---

## M1: SkillReader 更新

> 支援讀取 SKILL.md，保留 skill.yaml 相容

### Tasks

- [ ] 1.1 實作 SKILL.md 解析
  - 使用 gray-matter 解析 frontmatter
  - 定義 ParsedSkill 型別
  - 驗證必填欄位 (name, version, description)

- [ ] 1.2 實作雙格式讀取邏輯
  - 優先讀取 SKILL.md
  - 若無則讀取 skill.yaml (顯示警告)
  - 統一輸出 ParsedSkill 格式

### 驗收標準
- [ ] 可讀取 SKILL.md
- [ ] 向後相容 skill.yaml
- [ ] 單元測試通過

---

## M2: SkillWriter 新增

> 產生 SKILL.md 檔案

### Tasks

- [ ] 2.1 實作模板生成
  - generateTemplate(name, options)
  - 產生標準 SKILL.md 結構
  - 包含 frontmatter + 基本內容

- [ ] 2.2 實作寫入功能
  - writeSkill(path, metadata, content)
  - 使用 gray-matter stringify

### 驗收標準
- [ ] 可產生標準 SKILL.md
- [ ] 格式正確可被 SkillReader 讀取

---

## M3: CLI 更新

> 更新 CLI 使用新格式

### Tasks

- [ ] 3.1 更新 init 命令
  - 產生 SKILL.md（不是 skill.yaml）
  - 更新互動式問答
  - 更新說明文字

- [ ] 3.2 新增 migrate 命令
  - `skillpkg migrate` 轉換 skill.yaml → SKILL.md
  - 顯示轉換結果
  - 可選刪除舊檔案 (--delete)

### 驗收標準
- [ ] `skillpkg init` 產生 SKILL.md
- [ ] `skillpkg migrate` 可轉換格式

---

## M4: Syncer 簡化

> 移除轉換邏輯，直接複製

### Tasks

- [ ] 4.1 簡化同步邏輯
  - 直接複製 SKILL.md 到目標
  - 移除 skill.yaml → SKILL.md 轉換
  - 更新測試

### 驗收標準
- [ ] sync 直接複製 SKILL.md
- [ ] 所有測試通過

---

## 依賴關係

```
M1 (Reader) ──► M2 (Writer) ──► M3 (CLI)
                    │
                    ▼
               M4 (Syncer)
```

## 預估工作量

| Milestone | 預估 | 說明 |
|-----------|------|------|
| M1 | 小 | 解析邏輯 |
| M2 | 小 | 模板生成 |
| M3 | 小 | CLI 調整 |
| M4 | 小 | 簡化邏輯 |

## 新增依賴

```bash
npm install gray-matter
```
