# MCP Tool Usage Guide

> 什麼情況下使用哪個工具？這份指南幫助 AI Agent 做出正確選擇。

## Tool Overview

| Tool | 主要用途 | 何時使用 |
|------|----------|----------|
| `recommend_skills` | 根據目標推薦 skills | 任務開始時分析需要什麼能力 |
| `install_skill` | 安裝 skill | 確定需要某個 skill 後 |
| `load_skill` | 載入 skill 內容 | 需要學習/應用 skill 時 |
| `list_skills` | 列出已安裝 | 檢查當前有哪些能力 |
| `search_skills` | 搜尋外部 skills | 本地沒有合適的 skill |
| `uninstall_skill` | 移除 skill | 清理不需要的 skill |
| `sync_skills` | 同步到平台 | 確保各平台 skill 一致 |
| `skill_info` | 查看詳情 | 需要了解某個 skill 的細節 |
| `skill_status` | 查看整體狀態 | 了解當前 skill 生態 |
| `create_skill` | 建立新 skill | 從經驗萃取新 skill |
| `fetch_skill_content` | 預覽遠端 skill | 安裝前先了解內容 |

---

## recommend_skills

### 描述
分析用戶目標，使用 MatchingEngine 匹配關鍵詞，推薦相關的 domain 和 software skills。

### ✅ Use When

- 用戶開始一個新任務時
- Phase 1.5 能力邊界評估時
- 用戶說「我想做 X」或「幫我 Y」
- 不確定需要哪些 skills 時
- 需要了解任務需要什麼能力時

### ❌ Avoid When

- 已經知道需要什麼 skills（直接 install/load）
- 只是查詢 skill 列表（用 list_skills）
- 查找特定名稱的 skill（用 search_skills）

### 範例

```
✅ Good: recommend_skills({ goal: "建立一個量化交易回測系統" })
✅ Good: recommend_skills({ goal: "設計一個電商網站" })
❌ Bad: recommend_skills({ goal: "python" })  // 太簡單，直接用 install_skill
```

---

## install_skill

### 描述
從 GitHub、Gist、URL 或本地路徑安裝 skill，自動解析依賴。

### ✅ Use When

- `recommend_skills` 推薦了需要的 skill
- 用戶明確要求安裝某個 skill
- Phase 1.5 檢測到能力缺口
- 需要學習新領域知識時
- `search_skills` 找到了合適的 skill

### ❌ Avoid When

- Skill 已經安裝（先用 `list_skills` 檢查）
- 用戶說不需要新 skill
- 只是查詢資訊，不需要實際安裝
- 不確定需要什麼（先用 `recommend_skills`）

### 範例

```
✅ Good: install_skill({ source: "github:miles990/claude-software-skills#python" })
✅ Good: install_skill({ source: "quant-trading" })  // 從 registry
❌ Bad: 不檢查就安裝（先 list_skills 確認未安裝）
```

---

## load_skill

### 描述
載入已安裝 skill 的完整內容（instructions），讓 AI 可以學習和應用。

### ✅ Use When

- 需要使用某個 skill 的知識時
- `install_skill` 完成後需要學習
- 任務執行中需要參考 skill 指引
- 需要驗證是否真的學會了

### ❌ Avoid When

- Skill 未安裝（先 install）
- 只需要 skill 基本資訊（用 skill_info）
- 列出所有 skills（用 list_skills）
- Token 限制很緊（考慮 layer 參數）

### 範例

```
✅ Good: load_skill({ id: "python" })
✅ Good: load_skill({ id: "quant-trading", layer: "core" })  // 載入核心部分
❌ Bad: load_skill({ id: "not-installed-skill" })
```

---

## list_skills

### 描述
列出所有已安裝的 skills，包含版本和來源資訊。

### ✅ Use When

- 需要知道目前有哪些能力
- 安裝前確認是否已有
- 任務開始時評估現有資源
- 需要選擇要載入哪個 skill

### ❌ Avoid When

- 需要詳細 skill 資訊（用 skill_info）
- 搜尋外部 skills（用 search_skills）
- 需要推薦（用 recommend_skills）

### 範例

```
✅ Good: list_skills({ scope: "all" })
✅ Good: list_skills({ scope: "local" })  // 只看專案 skills
```

---

## search_skills

### 描述
搜尋 GitHub 和 Registry 中的 skills，找到可安裝的選項。

### ✅ Use When

- 本地沒有需要的 skill
- `recommend_skills` 觸發 research mode
- 需要找特定領域的 skills
- 探索有什麼可用的 skills

### ❌ Avoid When

- Skill 已經安裝（用 list_skills + load_skill）
- 知道確切來源（直接 install_skill）
- 只需要推薦（用 recommend_skills）

### 範例

```
✅ Good: search_skills({ query: "ComfyUI workflow" })
✅ Good: search_skills({ query: "量化交易", source: "github" })
```

---

## uninstall_skill

### 描述
移除已安裝的 skill，檢查依賴關係。

### ✅ Use When

- 用戶明確要求移除
- Skill 確認不再需要
- 需要清理測試用的 skills
- 解決 skill 衝突

### ❌ Avoid When

- Skill 有其他 skill 依賴它
- 不確定是否需要（保留）
- 用戶沒有明確要求移除

### 範例

```
✅ Good: uninstall_skill({ id: "test-skill" })
❌ Bad: uninstall_skill({ id: "python" })  // 如果有其他 skill 依賴它
```

---

## sync_skills

### 描述
同步已安裝的 skills 到各平台目錄（如 .claude/skills/）。

### ✅ Use When

- 安裝新 skills 後（通常自動執行）
- 平台 skill 目錄不同步時
- 手動修改 skills 後
- 跨平台使用時

### ❌ Avoid When

- 已設定 auto-sync（會自動執行）
- 沒有安裝任何 skills

### 範例

```
✅ Good: sync_skills({ target: "claude-code" })
✅ Good: sync_skills({ dryRun: true })  // 先預覽
```

---

## skill_info

### 描述
查看特定 skill 的詳細資訊，包含版本、依賴、路徑等。

### ✅ Use When

- 需要了解 skill 的依賴關係
- 確認 skill 版本
- 查看 skill 來源

### ❌ Avoid When

- 需要完整 instructions（用 load_skill）
- 列出所有 skills（用 list_skills）

### 範例

```
✅ Good: skill_info({ name: "quant-trading" })
```

---

## skill_status

### 描述
顯示整體專案狀態，包含 skills、MCP servers、同步狀態。

### ✅ Use When

- 開始工作前了解環境
- 診斷問題時
- 需要全面視圖時

### ❌ Avoid When

- 只需要 skill 列表（用 list_skills）
- 需要特定 skill 資訊（用 skill_info）

### 範例

```
✅ Good: skill_status()
```

---

## create_skill

### 描述
從經驗或模板建立新的 skill，輸出 SKILL.md 格式。

### ✅ Use When

- Phase 4.5 知識蒸餾時
- 發現可複用的模式
- 用戶要求建立自訂 skill
- 從 learnings 萃取 skill

### ❌ Avoid When

- 只需要記錄經驗（用 memory）
- 已有類似 skill（先搜尋）

### 範例

```
✅ Good: create_skill({
  name: "react-performance",
  description: "React 效能優化模式"
})
```

---

## fetch_skill_content

### 描述
從遠端來源（GitHub、URL）預覽 skill 內容，不實際安裝。

### ✅ Use When

- 安裝前想先了解內容
- 比較多個 skills
- 驗證來源是否正確

### ❌ Avoid When

- 已決定要安裝（直接 install）
- 查看已安裝的 skill（用 load_skill）

### 範例

```
✅ Good: fetch_skill_content({ source: "github:user/repo" })
```

---

## Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  用戶輸入任務                                                    │
│                                                                 │
│  "幫我建立一個量化交易系統"                                      │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────┐
│  Step 1: 推薦 Skills                                          │
│                                                               │
│  recommend_skills({ goal: "建立一個量化交易系統" })            │
│  → domain: quant-trading, investment-analysis                 │
│  → software: python, database                                 │
└───────────────────────────────┬───────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────┐
│  Step 2: 檢查已安裝                                           │
│                                                               │
│  list_skills({ scope: "all" })                                │
│  → python ✓ (已安裝)                                          │
│  → quant-trading ✗ (未安裝)                                   │
└───────────────────────────────┬───────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────┐
│  Step 3: 安裝缺少的 Skills                                    │
│                                                               │
│  install_skill({ source: "quant-trading" })                   │
│  → 自動安裝依賴：investment-analysis, database                │
└───────────────────────────────┬───────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────┐
│  Step 4: 載入並學習                                           │
│                                                               │
│  load_skill({ id: "quant-trading" })                          │
│  → 獲取完整 instructions                                      │
│  → 應用到任務中                                               │
└───────────────────────────────────────────────────────────────┘
```

## Integration with Self-Evolving Agent

在 `/evolve` 工作流程中的使用時機：

| Phase | Tools to Use |
|-------|-------------|
| Phase 1 目標分析 | `recommend_skills` |
| Phase 1.5 能力評估 | `list_skills`, `load_skill` |
| 能力缺口 | `search_skills`, `install_skill` |
| Phase 2 執行 | `load_skill` (參考指引) |
| Phase 4 記錄 | `create_skill` (萃取新 skill) |
