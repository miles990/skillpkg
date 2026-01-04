# Smart Agent Core - 需求規格

> 智慧 Agent 核心技能套件：自我學習、規劃、協作

## 1. 專案概述

### 1.1 目標

建立一套可複用的核心 Skills，讓 AI Agent 具備：
- 自我學習能力（遇到不會的能自己學）
- 任務規劃能力（複雜任務能拆解執行）
- 協作能力（多個 Skills 能串聯協作）
- 經驗累積（學到的經驗能傳承）

### 1.2 核心原則

| 原則 | 說明 |
|------|------|
| **不造輪子** | 組合現有 MCP 工具，不重新實作 |
| **可組合** | Skills 之間能串聯協作 |
| **可攜帶** | 透過 skillpkg 安裝，跨平台使用 |
| **漸進式** | 可單獨安裝，也可安裝完整套件 |

## 2. 現有資源（複用）

### 2.1 MCP 工具（直接使用）

| MCP | 功能 | 用途 |
|-----|------|------|
| **skillpkg** | 技能管理 | 搜尋/安裝/載入 skills |
| **cipher** | 記憶系統 | 經驗儲存與檢索 |
| **pal** | 多模型協作 | thinkdeep, codereview, consensus |
| **context7** | 文件查詢 | 查最新 API/SDK 文件 |

### 2.2 現有 Skills（整合）

| Skill | 狀態 | 處理方式 |
|-------|------|----------|
| evolve v2.1 | 已存在 | 精簡後合併到 smart-learning-loop |
| smart-learning-loop | 已建立 | 作為學習迴圈核心 |

## 3. 功能需求

### 3.1 核心 Skills（必須）

| Skill | 職責 | 依賴 MCP |
|-------|------|----------|
| **smart-learning-loop** | 自我學習迴圈 | skillpkg, cipher |
| **research** | 需求分析/資料收集 | context7, cipher |
| **plan-master** | 任務規劃/分解 | cipher |
| **goal-verifier** | 目標驗證/方向確認 | - |

### 3.2 工作流程 Skills（建議）

| Skill | 職責 | 依賴 MCP |
|-------|------|----------|
| **code-reviewer** | 程式碼審查 | pal (codereview) |
| **test-helper** | 測試輔助 | - |
| **git-helper** | Git 操作 | - |
| **debug-helper** | 除錯輔助 | pal (debug) |

### 3.3 Skill 協作

Skills 必須支援三種協作模式：

```
1. 串聯 (Pipeline)
   research → plan → implement → review → ship

2. 分工 (Delegation)
   smart-learning-loop 委派給 skillpkg/cipher

3. 組合 (Composition)
   full-stack-dev = research + frontend + backend + test
```

## 4. 非功能需求

### 4.1 可攜帶性

- 透過 `skillpkg install` 安裝
- 支援 Claude Code / Codex / Copilot / Cursor

### 4.2 介面標準

每個 Skill 必須定義：
```yaml
interface:
  input:
    - name: task
      type: string
      required: true
  output:
    - name: result
      type: string
```

### 4.3 經驗傳承

- 用 cipher 儲存經驗
- 結構化格式（情境、問題、解法、驗證）

## 5. 驗收標準

### 5.1 功能驗收

- [ ] 可透過 skillpkg 安裝單一 skill
- [ ] 可透過 skillpkg 安裝完整套件
- [ ] Skills 能正確協作（串聯、分工、組合）
- [ ] 經驗能正確儲存到 cipher

### 5.2 品質驗收

- [ ] 每個 SKILL.md 有完整的 frontmatter
- [ ] 每個 Skill 有使用範例
- [ ] 有協作流程範例

## 6. 範圍外

以下不在本專案範圍：
- ❌ 新的 MCP 工具開發
- ❌ UI/TUI 介面
- ❌ 獨立專案/獨立 repo
