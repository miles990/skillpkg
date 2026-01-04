# Smart Agent Core - 任務清單

## 概覽

| Milestone | 名稱 | 狀態 | 說明 |
|-----------|------|------|------|
| M1 | 核心 Skills (必須) | ✅ | 4 個必須的核心 skills |
| M2 | 工作流程 Skills | ✅ | 4 個提升效率的 skills |
| M3 | Bundle 與整合 | ✅ | 建立套件、更新 evolve |
| M4 | 測試與驗證 | ⏳ | 完整流程測試 |

---

## M1: 核心 Skills（必須）

> 目標：建立 4 個核心 skills，支援自我學習和任務規劃

### 1.1 smart-learning-loop
- [x] 建立 SKILL.md
- [x] 定義學習迴圈流程
- [x] 定義 Skill 協作模式
- [x] 定義標準介面 (input/output)
- [x] 新增觸發條件說明

### 1.2 research
- [x] 建立 SKILL.md
- [x] 定義需求分析流程
- [x] 整合 context7 MCP (查文件)
- [x] 整合 cipher MCP (查經驗)
- [x] 定義輸出格式 (research_report)

### 1.3 plan-master
- [x] 建立 SKILL.md
- [x] 定義任務拆解流程
- [x] 定義 Milestone 格式
- [x] 整合 cipher MCP (參考過去規劃)
- [x] 定義輸出格式 (plan)

### 1.4 goal-verifier
- [x] 建立 SKILL.md
- [x] 定義目標檢查清單
- [x] 定義觸發時機
- [x] 定義輸出格式 (verification)

**M1 驗收標準**：
- [x] 4 個 SKILL.md 都已建立
- [x] 每個 skill 有完整的 frontmatter
- [x] 每個 skill 有使用範例
- [x] 介面格式統一

---

## M2: 工作流程 Skills

> 目標：建立 4 個工作流程 skills，提升開發效率

### 2.1 code-reviewer
- [x] 建立 SKILL.md
- [x] 包裝 pal.codereview MCP
- [x] 定義審查標準
- [x] 定義輸出格式

### 2.2 test-helper
- [x] 建立 SKILL.md
- [x] 定義測試策略
- [x] 定義覆蓋率標準
- [x] 定義輸出格式

### 2.3 git-helper
- [x] 建立 SKILL.md
- [x] 定義 commit message 規範
- [x] 定義分支策略
- [x] 定義 PR 規範

### 2.4 debug-helper
- [x] 建立 SKILL.md
- [x] 包裝 pal.debug MCP
- [x] 定義失敗類型分類
- [x] 定義診斷流程

**M2 驗收標準**：
- [x] 4 個 SKILL.md 都已建立
- [x] 每個 skill 有完整的 frontmatter
- [x] 每個 skill 有使用範例

---

## M3: Bundle 與整合

> 目標：建立套件並更新 evolve

### 3.1 建立 smart-agent-core bundle
- [x] 建立 skillpkg.json
- [x] 定義 skills 依賴
- [x] 定義 mcp 依賴
- [x] 定義 skill_workflows
- [x] 建立 README.md

### 3.2 更新 evolve v3.0
- [x] 改為調用細分 skills
- [x] 保持向後相容
- [x] 更新版本號
- [x] 更新文件

**M3 驗收標準**：
- [x] `skillpkg install` 可安裝完整套件
- [x] 各 skills 可獨立安裝
- [x] evolve 正常運作

---

## M4: 測試與驗證

> 目標：驗證完整協作流程

### 4.1 單一 Skill 測試
- [ ] 測試 smart-learning-loop
- [ ] 測試 research
- [ ] 測試 plan-master
- [ ] 測試 goal-verifier

### 4.2 協作流程測試
- [ ] 測試串聯模式 (Pipeline)
- [ ] 測試分工模式 (Delegation)
- [ ] 測試 evolve 完整流程

### 4.3 跨平台測試
- [ ] Claude Code 測試
- [ ] (選) Codex 測試
- [ ] (選) Copilot 測試

**M4 驗收標準**：
- [ ] 所有單一 skill 測試通過
- [ ] 協作流程測試通過
- [ ] 至少在 Claude Code 上正常運作

---

## 執行順序

```
M1.1 (smart-learning-loop 完善)
    ↓
M1.2 (research) → M1.3 (plan-master) → M1.4 (goal-verifier)
    ↓
M2.1-2.4 (工作流程 skills，可平行)
    ↓
M3.1 (bundle) → M3.2 (evolve v3)
    ↓
M4 (測試)
```

---

## 備註

### 複用清單

| 現有資源 | 用途 |
|----------|------|
| skillpkg MCP | 技能搜尋/安裝 |
| cipher MCP | 經驗記憶 |
| pal MCP | codereview, debug |
| context7 MCP | 查文件 |
| evolve v2.1 | 參考流程設計 |

### 不做清單

- ❌ 新的 MCP 工具
- ❌ UI/TUI 介面
- ❌ 獨立 repo
