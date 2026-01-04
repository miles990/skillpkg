---
name: plan-master
version: 1.0.0
description: 將任務拆解為可執行的 Milestones，支援 PDCA 循環規劃
author: miles990
tags:
  - planning
  - task-decomposition
  - milestone
  - pdca
dependencies:
  mcp:
    - package: "@anthropic/cipher-mcp"
      required: false
      note: "用於參考過去類似任務的規劃"
interface:
  input:
    - name: task
      type: string
      description: "要規劃的任務描述"
      required: true
    - name: research_report
      type: object
      description: "來自 research skill 的研究報告"
      required: false
    - name: context
      type: object
      description: "額外上下文"
      required: false
  output:
    - name: plan
      type: object
      description: "結構化任務計劃（含 Milestones）"
    - name: next_action
      type: string
      description: "建議的下一步（通常是執行 M1）"
triggers:
  - pattern: "規劃任務"
    description: "需要將任務拆解時"
  - pattern: "研究完成"
    description: "research 完成後自動觸發"
  - pattern: "重新規劃"
    description: "需要調整計劃時"
---

# Plan Master

> 收到任務/研究報告 → 拆解子目標 → 定義 Milestones → 輸出可執行計劃

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  大目標拆小步，每步可驗證                                       │
│                                                                 │
│  傳統模式：收到任務 → 開始做 → 做到哪算哪                        │
│  規劃模式：收到任務 → 拆解 → 排序 → 逐步執行 → 持續驗證          │
└─────────────────────────────────────────────────────────────────┘
```

## 規劃流程

### Step 1: 理解目標

```markdown
問自己：
1. 最終要達成什麼？
2. 成功的標準是什麼？
3. 有什麼約束條件？
4. 有沒有類似的過去經驗可參考？
```

### Step 2: 查詢過去規劃經驗（如有 Cipher）

```javascript
// 查過去類似任務是怎麼規劃的
await mcp__cipher__ask_cipher({
  message: "我之前有規劃過類似的任務嗎？Milestone 怎麼分的？"
})
```

- 有經驗 → 參考並調整
- 無經驗 → 從頭規劃

### Step 3: 拆解 Milestones

每個 Milestone 必須滿足：

```
┌─────────────────────────────────────────────────────────────────┐
│  Milestone 設計原則                                             │
│                                                                 │
│  ✓ 獨立可驗證 - 完成後可以明確確認「做完了」                    │
│  ✓ 大小適中 - 1-5 個任務，不要太大也不要太碎                    │
│  ✓ 順序合理 - 依賴關係清楚，不能跳過前置                        │
│  ✓ 有驗收標準 - 每個 Milestone 有明確的完成條件                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: 定義任務細節

每個任務包含：

```yaml
task:
  id: "1.1"
  description: "任務描述"
  acceptance: "驗收標準"
  estimated_effort: "small | medium | large"
  dependencies: []
```

### Step 5: 輸出計劃

```yaml
plan:
  goal: "最終目標描述"
  success_criteria:
    - "成功標準 1"
    - "成功標準 2"

  milestones:
    - id: M1
      name: "基礎建設"
      description: "建立專案基礎結構"
      tasks:
        - id: "1.1"
          description: "初始化專案"
          acceptance: "npm init 完成"
        - id: "1.2"
          description: "安裝依賴"
          acceptance: "所有依賴安裝成功"
      dependencies: []
      acceptance: "專案可以啟動"

    - id: M2
      name: "核心功能"
      description: "實作核心功能"
      tasks:
        - id: "2.1"
          description: "實作 API"
          acceptance: "API 可正常呼叫"
      dependencies: [M1]
      acceptance: "核心功能測試通過"

  execution_order:
    - M1
    - M2

  risks:
    - "潛在風險"

  notes:
    - "注意事項"
```

## PDCA 整合

每個 Milestone 的執行都遵循 PDCA：

```
┌─────────────────────────────────────────────────────────────────┐
│  Plan   → 本 Milestone 要做什麼？預期結果？                      │
│  Do     → 執行各個任務                                          │
│  Check  → 驗證是否達到 acceptance criteria                      │
│  Act    → 通過 → 下一個 M / 失敗 → 診斷修正                     │
└─────────────────────────────────────────────────────────────────┘
```

## 最小範例

```markdown
用戶：幫我建立一個 Todo App

AI 執行 plan-master：

1. 理解目標：建立 Todo App
2. 查經驗：過去有 React 專案經驗
3. 拆解 Milestones：

plan:
  goal: "建立功能完整的 Todo App"
  success_criteria:
    - "可新增/刪除/完成 todo"
    - "資料持久化"

  milestones:
    - id: M1
      name: "專案初始化"
      tasks:
        - id: "1.1"
          description: "建立 React 專案"
          acceptance: "npm start 可啟動"
      acceptance: "空白頁面可顯示"

    - id: M2
      name: "核心 UI"
      tasks:
        - id: "2.1"
          description: "建立 TodoList 元件"
        - id: "2.2"
          description: "建立 TodoItem 元件"
      dependencies: [M1]
      acceptance: "可顯示靜態 todo 列表"

    - id: M3
      name: "互動功能"
      tasks:
        - id: "3.1"
          description: "實作新增 todo"
        - id: "3.2"
          description: "實作刪除 todo"
        - id: "3.3"
          description: "實作完成 todo"
      dependencies: [M2]
      acceptance: "CRUD 功能正常"

    - id: M4
      name: "持久化"
      tasks:
        - id: "4.1"
          description: "實作 localStorage 存取"
      dependencies: [M3]
      acceptance: "刷新頁面資料仍在"

  execution_order: [M1, M2, M3, M4]

4. next_action: "execute M1"
```

## 與其他 Skill 的協作

```
┌─────────────────────────────────────────────────────────────────┐
│  協作流程                                                       │
│                                                                 │
│  [research] → [plan-master] → [執行] → [goal-verifier]          │
│       │            │            │            │                  │
│       ↓            ↓            ↓            ↓                  │
│    研究報告      任務計劃     實際執行     驗證結果               │
│                                                                 │
│  執行過程中可能觸發：                                            │
│  • smart-learning-loop（遇到能力缺口）                          │
│  • code-reviewer（審查程式碼）                                  │
│  • debug-helper（診斷問題）                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 與 MCP 工具整合

| MCP 工具 | 用途 | 必要性 |
|----------|------|--------|
| cipher | 查詢過去規劃經驗 | 推薦 |
| pal.planner | 複雜任務的深度規劃 | 可選 |

## 設計原則

1. **可驗證** - 每個 Milestone 有明確驗收標準
2. **順序清晰** - 依賴關係明確
3. **大小適中** - 不要太大也不要太碎
4. **可調整** - 執行中發現問題可以修改計劃
5. **經驗累積** - 好的規劃模式記錄下來

## 計劃調整時機

```
┌─────────────────────────────────────────────────────────────────┐
│  何時需要調整計劃？                                             │
│                                                                 │
│  • 發現原計劃遺漏重要步驟                                       │
│  • 技術約束導致原方案不可行                                     │
│  • 用戶需求變更                                                 │
│  • 完成後發現需要額外工作                                       │
│                                                                 │
│  調整流程：                                                     │
│  識別問題 → 評估影響 → 更新計劃 → 通知用戶 → 繼續執行           │
└─────────────────────────────────────────────────────────────────┘
```

## 限制與邊界

- 這是「規劃」不是「執行」，不會產出程式碼
- 計劃是「指南」不是「鐵律」，需要靈活調整
- 複雜任務可能需要多輪規劃
- 依賴 research 的輸出品質
