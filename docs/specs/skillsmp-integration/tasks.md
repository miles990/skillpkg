# Skills Registry 整合任務清單

## Milestone 概覽

| Milestone | 說明 | 任務數 | 狀態 |
|-----------|------|--------|------|
| M1 | 子目錄 SKILL.md 支援 | 4 | ✅ 完成 |
| M2 | Discovery Manager 核心 | 3 | ✅ 完成 |
| M3 | MCP 工具 | 2 | ✅ 完成 |
| M4 | CLI search 命令 | 1 | ⏳ |
| M5 | 測試與文件 | 2 | ⏳ |

---

## M1: 子目錄 SKILL.md 支援 ✅ 完成

> 支援 `github:user/repo#path/to/skill` 格式

- [x] 擴展 ParsedSource 類型，新增 `subpath` 欄位
- [x] 修改 source-parser.ts 支援 `#path` 語法
- [x] 修改 fetcher.ts 接受 subpath 參數
- [x] 整合測試通過 (232 tests)

**驗收**：✅ 已完成

---

## M2: Discovery Manager 核心 ✅ 完成

> 建立多來源搜尋模組，含去重機制
>
> **注意**：使用 `discovery/` 模組而非 `registry/`，避免與現有 registry 模組衝突

### 2.1 建立 discovery 模組
- [x] 新增 `packages/core/src/discovery/types.ts`
- [x] 新增 `packages/core/src/discovery/manager.ts`
- [x] 新增 `packages/core/src/discovery/index.ts`
- [x] 驗證：編譯通過

### 2.2 實作 Providers
- [x] 實作 `LocalProvider` (搜尋已安裝，重用 StoreManager)
- [x] 實作 `SkillsmpProvider` (**主要來源**)
  - skillsmp.com API 整合
  - 40,000+ skills
  - 需要 API Key
- [x] 實作 `AwesomeProvider` (Fallback，無 Key 時使用)
  - anthropics/skills
  - ComposioHQ/awesome-claude-skills
- [x] 實作 `GitHubProvider` (補充搜尋，重用 github/search.ts)
- [x] 實作快取 (skillsmp/github 5min, awesome 30min)
- [x] 實作自動來源選擇 (`getDefaultSources()`)
- [x] 驗證：編譯通過 (232 tests)

### 2.3 實作去重機制
- [x] 實作 `normalizeSourceForDedup()`
- [x] 實作 `deduplicateSkills()` 含 `foundIn` 合併
- [x] 驗證：編譯通過

**M2 驗收**：✅ 已完成
```typescript
manager.search({ query: "git" })
// → 返回去重後的結果，含 duplicatesRemoved 數量
```

---

## M3: MCP 工具 ✅ 完成

> AI 使用的主要介面

### 3.1 實作 search_skills
- [x] 更新 `packages/mcp-server/src/tools/search-skills.ts`
- [x] 整合 DiscoveryManager
- [x] 預設搜尋 `local` + `awesome`（無 API Key 時）
- [x] 返回含 `duplicatesRemoved` 的結果
- [x] 驗證：編譯通過

### 3.2 實作 fetch_skill_content
- [x] 新增 `packages/mcp-server/src/tools/fetch-skill-content.ts`
- [x] 支援 GitHub source (含 subpath)
- [x] 支援 local source
- [x] 解析並返回 metadata
- [x] 驗證：編譯通過 (232 tests)

**M3 驗收**：✅ 已完成
```
search_skills({ query: "git" })
→ 返回多來源搜尋結果 (已去重，含 duplicatesRemoved)

fetch_skill_content({ source: "github:user/repo#path" })
→ 返回 SKILL.md 內容 + metadata
```

---

## M4: CLI search 命令

> 只顯示結果，供人類複製 source URL

### 4.1 實作 search 命令
- [ ] 新增 `packages/cli/src/commands/search.ts`
- [ ] 顯示：name, stars, description, source URL
- [ ] 顯示去重數量
- [ ] 顯示 `Also in:` (若出現在多個 repos)
- [ ] 驗證：`skillpkg search git` 有輸出

**M4 驗收**：
```bash
$ skillpkg search "git"

Found 8 skills (3 duplicates removed):

  git-helper  ⭐120
  github:alice/tools#git-helper
  Also in: travisvn/awesome-claude-skills

Install: skillpkg install <source>
```

---

## M5: 測試與文件

### 5.1 單元測試
- [ ] `discovery/__tests__/manager.test.ts` (含去重測試)
- [ ] `discovery/__tests__/awesome.test.ts`
- [ ] `mcp-server/tools/__tests__/search-skills.test.ts`
- [ ] 驗證：`npm test` 通過

### 5.2 更新文件
- [ ] 更新 README.md
- [ ] 更新 CLI help

**M5 驗收**：所有測試通過，文件完整

---

## 狀態圖例

- `[ ]` 待處理
- `[~]` 進行中
- `[x]` 已完成
- `[!]` 阻擋中

---

## 依賴關係

```
M1 ✅ ─────────────────────────────────────────┐
 │                                             │
 ▼                                             ▼
M2 ──────────────────────┬────────────────── M5
 │                       │
 ▼                       ▼
M3                      M4
```

---

## 設計決策記錄

| 決策 | 選擇 | 原因 |
|------|------|------|
| 主要來源 | skillsmp.com | 40K+ skills，AI 組合學習需要大量樣本 |
| Fallback | awesome repos | 無 API Key 時仍可使用基本功能 |
| 自動來源選擇 | 有 Key → skillsmp，無 → awesome | 開箱即用，設定後更強大 |
| GitHub 搜尋 | topic 而非 filename | 更精準，減少雜訊 |
| 去重 key | normalized source URL | 準確識別相同 skill |
| 快取時間 | skillsmp/github 5min, awesome 30min | 平衡新鮮度和 API 限制 |
