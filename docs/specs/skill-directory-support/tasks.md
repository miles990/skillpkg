# Skill Directory Support - 任務清單

## Milestone 概覽

| Milestone | 說明 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | 型別定義 | 2 | ✅ |
| M2 | Fetcher 擴展 | 3 | ✅ |
| M3 | Store 擴展 | 2 | ✅ |
| M4 | Syncer 擴展 | 2 | ✅ |
| M5 | 測試與驗證 | 2 | ✅ |

---

## M1: 型別定義

### 1.1 新增 SkillFile 型別
- [x] 在 `fetcher/types.ts` 新增 `SkillFile` interface
- [x] 擴展 `FetchResult` 加入 `files?: SkillFile[]`

### 1.2 擴展 Store 型別
- [x] `addSkill` options 加入 `files?: SkillFile[]`

**驗收**: ✅ 編譯通過

---

## M2: Fetcher 擴展

### 2.1 實作 listGitHubDirectory
- [x] 新增函式呼叫 GitHub Contents API
- [x] 遞迴處理子目錄
- [x] 返回所有檔案路徑

### 2.2 實作 downloadGitHubFiles
- [x] 並行下載多個檔案
- [x] 使用 raw.githubusercontent.com
- [x] 處理二進位檔案

### 2.3 修改 fetchFromGitHub
- [x] 整合 listGitHubDirectory
- [x] 整合 downloadGitHubFiles
- [x] 返回 skill + files

**驗收**: ✅ `fetchSkill("github:user/repo#skill")` 返回 files

---

## M3: Store 擴展

### 3.1 修改 addSkill
- [x] 接受 files 參數
- [x] 寫入所有檔案到 skill 目錄
- [x] 保持目錄結構

### 3.2 修改 getSkill (可選)
- [x] 新增 `getSkillFiles()` 方法 → 改為 SkillContent.sourcePath
- [x] 列舉 skill 目錄內容

**驗收**: ✅ 安裝後 `.skillpkg/skills/name/` 包含所有檔案

---

## M4: Syncer 擴展

### 4.1 修改 syncSkill
- [x] 複製完整目錄而非單一檔案
- [x] 保持目錄結構

### 4.2 修改 unsyncSkill
- [x] 移除完整目錄

**驗收**: ✅ 同步後 `.claude/skills/name/` 包含所有檔案

---

## M5: 測試與驗證

### 5.1 單元測試
- [x] fetcher 測試 (246 tests passed)
- [x] store 測試
- [x] syncer 測試

### 5.2 整合測試
- [x] 安裝含 scripts 的 skill (codebase-analysis)
- [x] 同步並驗證

**驗收**: ✅ 所有測試通過

---

## 狀態圖例

- `[ ]` 待處理
- `[~]` 進行中
- `[x]` 已完成
- `[!]` 阻擋中
