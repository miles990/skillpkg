# Skills Marketplace 整合任務清單

## Milestone 概覽

| Milestone | 說明 | 任務數 |
|-----------|------|--------|
| M1 | 子目錄 SKILL.md 支援 | 4 |
| M2 | Marketplace Client | 3 |
| M3 | CLI 命令 | 3 |
| M4 | MCP 工具 | 3 |
| M5 | 測試與文件 | 3 |

---

## M1: 子目錄 SKILL.md 支援 (P0 基礎)

> 先完成此 Milestone 才能進行後續整合

### 1.1 擴展 ParsedSource 類型
- [x] 修改 `packages/core/src/fetcher/types.ts`
- [x] 新增 `subpath?: string` 欄位到 `ParsedSource`
- [x] 驗證：編譯通過

### 1.2 修改 source-parser.ts
- [x] 更新 `parseSource()` 支援 `github:user/repo#path/to/skill`
- [x] 更新 `normalizeSource()` 保留 subpath
- [x] 驗證：單元測試通過

### 1.3 修改 fetcher.ts
- [x] 更新 `fetchFromGitHub()` 接受 subpath 參數
- [x] 當有 subpath 時直接使用 `{subpath}/SKILL.md`
- [x] 更新 `fetchByType()` 傳遞 subpath
- [x] 驗證：可安裝子目錄 skill

### 1.4 整合測試
- [x] 測試 `github:user/repo` (現有格式) - 向後相容
- [x] 測試 `github:user/repo#path` (新格式)
- [x] 驗證：`npm test` 通過 (232 tests)

**M1 驗收**：✅ 完成
- `github:ComposioHQ/awesome-claude-skills#artifacts-builder` 成功
- `github:mhattingpete/claude-skills-marketplace#engineering-workflow-plugin/skills/feature-planning` 成功

---

## M2: Marketplace Client

### 2.1 建立 marketplace 模組
- [ ] 新增 `packages/core/src/marketplace/types.ts`
- [ ] 新增 `packages/core/src/marketplace/client.ts`
- [ ] 新增 `packages/core/src/marketplace/index.ts`
- [ ] 驗證：編譯通過

### 2.2 實作 MarketplaceClient
- [ ] 實作 `search()` 方法
- [ ] 實作 `browse()` 方法
- [ ] 實作 `toInstallSource()` 轉換
- [ ] 實作 5 分鐘快取
- [ ] 驗證：API 呼叫成功

### 2.3 導出模組
- [ ] 更新 `packages/core/src/index.ts`
- [ ] 導出 `MarketplaceClient`, types
- [ ] 驗證：CLI/MCP 可 import

**M2 驗收**：`MarketplaceClient.search('git')` 返回結果

---

## M3: CLI 命令

### 3.1 新增 search 命令
- [ ] 新增 `packages/cli/src/commands/search.ts`
- [ ] 註冊到 `packages/cli/src/index.ts`
- [ ] 支援 `--category`, `--sort`, `--page` 參數
- [ ] 驗證：`skillpkg search git` 有輸出

### 3.2 新增 browse 命令
- [ ] 新增 `packages/cli/src/commands/browse.ts`
- [ ] 註冊到 `packages/cli/src/index.ts`
- [ ] 列出類別或類別內容
- [ ] 驗證：`skillpkg browse development` 有輸出

### 3.3 整合安裝提示
- [ ] search/browse 結果顯示安裝命令
- [ ] 複製友善的 source URL
- [ ] 驗證：可直接複製安裝

**M3 驗收**：`skillpkg search git` → 複製 source → `skillpkg install <source>` 成功

---

## M4: MCP 工具

### 4.1 新增 search_skills 工具
- [ ] 新增 `packages/mcp-server/src/tools/search-skills.ts`
- [ ] 註冊到 tools index
- [ ] 返回可安裝的 source URLs
- [ ] 驗證：MCP 工具可用

### 4.2 新增 browse_skills 工具
- [ ] 新增 `packages/mcp-server/src/tools/browse-skills.ts`
- [ ] 支援類別瀏覽
- [ ] 驗證：MCP 工具可用

### 4.3 更新 recommend_skill
- [ ] 整合 marketplace 搜尋
- [ ] 優先返回有星數的 skills
- [ ] 驗證：推薦結果包含 marketplace skills

**M4 驗收**：Claude Code 中使用 `search_skills` 並成功安裝結果

---

## M5: 測試與文件

### 5.1 單元測試
- [ ] `packages/core/src/marketplace/__tests__/client.test.ts`
- [ ] `packages/core/src/fetcher/__tests__/subpath.test.ts`
- [ ] 驗證：`npm test` 通過

### 5.2 整合測試
- [ ] 測試 marketplace 搜尋 → 安裝流程
- [ ] 測試 API 不可用時的錯誤處理
- [ ] 測試快取行為

### 5.3 更新文件
- [ ] 更新 README.md 說明新功能
- [ ] 更新 CLI help 文字
- [ ] 新增使用範例

**M5 驗收**：所有測試通過，文件完整

---

## 狀態圖例

- `[ ]` 待處理 (pending)
- `[~]` 進行中 (in_progress)
- `[x]` 已完成 (completed)
- `[!]` 阻擋中 (blocked)

---

## 依賴關係

```
M1 ─────────────────────────────────────────────┐
 │                                              │
 ▼                                              ▼
M2 ──────────────────────┬──────────────────── M5
 │                       │
 ▼                       ▼
M3                      M4
```

- M1 必須先完成（其他 Milestone 依賴子目錄支援）
- M2 可與 M1 並行後半段
- M3, M4 依賴 M2
- M5 在 M3, M4 完成後進行

---

## 預估時程

| Milestone | 預估 | 說明 |
|-----------|------|------|
| M1 | 1 session | 核心修改 |
| M2 | 1 session | API client |
| M3 | 0.5 session | CLI 簡單 |
| M4 | 0.5 session | 類似 CLI |
| M5 | 1 session | 測試文件 |

總計：約 4 個 session
