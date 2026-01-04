---
name: research
version: 1.0.0
description: 任務開始前的需求分析與資料收集，整合文件查詢與經驗檢索
author: miles990
tags:
  - research
  - analysis
  - planning
  - context-gathering
dependencies:
  mcp:
    - package: "@anthropic/cipher-mcp"
      required: false
      note: "用於查詢過去經驗"
    - package: "@context7/mcp-server"
      required: false
      note: "用於查詢最新文件"
interface:
  input:
    - name: task
      type: string
      description: "要分析的任務描述"
      required: true
    - name: context
      type: object
      description: "額外上下文（如專案資訊）"
      required: false
  output:
    - name: research_report
      type: object
      description: "結構化研究報告"
    - name: next_action
      type: string
      description: "建議的下一步（通常是 plan-master）"
triggers:
  - pattern: "新任務開始"
    description: "任何新任務開始前"
  - pattern: "需要了解"
    description: "需要收集資訊時"
  - pattern: "技術選型"
    description: "需要評估技術方案時"
---

# Research Skill

> 收到任務 → 分析需求 → 查文件 → 查經驗 → 輸出研究報告

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  在動手之前，先搞清楚狀況                                       │
│                                                                 │
│  傳統模式：收到任務 → 直接開始做 → 遇到問題再查                  │
│  研究模式：收到任務 → 分析需求 → 收集資料 → 有備而戰             │
└─────────────────────────────────────────────────────────────────┘
```

## 研究流程

### Step 1: 任務解析

```markdown
問自己：
1. 這個任務的核心目標是什麼？
2. 有哪些明確的需求？
3. 有哪些隱含的約束？
4. 成功的標準是什麼？

輸出：結構化的需求分析
```

### Step 2: 查詢過去經驗（如有 Cipher）

```javascript
// 先查是否有類似經驗
await mcp__cipher__ask_cipher({
  message: "我之前有處理過類似的任務嗎？學到了什麼教訓？"
})
```

- 有經驗 → 納入參考
- 無經驗 → 繼續收集資料

### Step 3: 查詢相關文件（如有 Context7）

```javascript
// 查詢相關技術文件
await mcp__plugin_context7_context7__resolve_library_id({
  query: "任務相關的技術",
  libraryName: "相關框架或工具"
})

await mcp__plugin_context7_context7__query_docs({
  libraryId: "/org/project",
  query: "具體問題"
})
```

### Step 4: 綜合分析

整合所有收集的資訊，形成研究報告：

```yaml
research_report:
  task: "原始任務描述"

  analysis:
    requirements:
      - "功能需求 1"
      - "功能需求 2"
    constraints:
      - "技術約束"
      - "時間約束"
    tech_stack:
      - "需要的技術 1"
      - "需要的技術 2"

  findings:
    relevant_docs:
      - source: "文件來源"
        summary: "關鍵發現"
    past_experience:
      - context: "過去情境"
        lesson: "學到的教訓"

  recommendations:
    approach: "建議的實作方法"
    risks:
      - "潛在風險 1"
      - "潛在風險 2"
    alternatives:
      - "替代方案"
```

### Step 5: 輸出與交接

```markdown
輸出：
- research_report: 完整的研究報告
- next_action: "plan" (交給 plan-master 進行任務規劃)
```

## 最小範例

```markdown
用戶：幫我用 FastAPI 建立一個 REST API

AI 執行 research skill：

1. 任務解析：
   - 目標：建立 REST API
   - 技術：FastAPI
   - 約束：未明確（需確認）

2. 查經驗 (Cipher)：
   → 找到過去 FastAPI 專案經驗
   → 教訓：記得加 CORS middleware

3. 查文件 (Context7)：
   → FastAPI 最新版本是 0.115.x
   → 新增了 Annotated 語法支援

4. 研究報告：
   {
     task: "用 FastAPI 建立 REST API",
     analysis: {
       requirements: ["RESTful 端點", "JSON 回應"],
       tech_stack: ["FastAPI", "Pydantic", "Uvicorn"]
     },
     findings: {
       past_experience: ["記得加 CORS"],
       relevant_docs: ["使用 Annotated 語法"]
     },
     recommendations: {
       approach: "使用 FastAPI + Pydantic v2"
     }
   }

5. next_action: "plan"
   → 交給 plan-master 進行任務規劃
```

## 與其他 Skill 的協作

```
┌─────────────────────────────────────────────────────────────────┐
│  協作流程                                                       │
│                                                                 │
│  [用戶任務] → [research] → [plan-master] → [執行] → [goal-verifier]
│                   │              │                      │        │
│                   ↓              ↓                      ↓        │
│              研究報告        任務計劃              驗證結果       │
└─────────────────────────────────────────────────────────────────┘
```

## 與 MCP 工具整合

| MCP 工具 | 用途 | 必要性 |
|----------|------|--------|
| cipher | 查詢過去經驗 | 推薦 |
| context7 | 查詢最新文件 | 推薦 |
| pal.thinkdeep | 深度分析複雜問題 | 可選 |

## 設計原則

1. **先調研後動手** - 避免盲目開始
2. **整合多源資訊** - 經驗 + 文件 + 分析
3. **結構化輸出** - 方便下游 skill 使用
4. **標準交接** - 輸出格式統一
5. **可選依賴** - 沒有 MCP 也能運作（降級模式）

## 限制與邊界

- 這是「研究」不是「執行」，不會產出程式碼
- 依賴 MCP 工具的品質和可用性
- 複雜任務可能需要多輪研究
- 研究報告是「建議」，最終決策權在用戶
