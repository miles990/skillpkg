---
name: code-reviewer
version: 1.0.0
description: 程式碼審查，包裝 PAL MCP 的 codereview 功能
author: miles990
tags:
  - code-review
  - quality
  - security
  - performance
dependencies:
  mcp:
    - package: "pal-mcp-server"
      required: true
      note: "使用 pal.codereview 進行審查"
interface:
  input:
    - name: files
      type: array
      description: "要審查的檔案路徑列表"
      required: true
    - name: review_type
      type: string
      description: "審查類型：full, security, performance, quick"
      required: false
      default: "full"
    - name: context
      type: object
      description: "額外上下文（如變更原因）"
      required: false
  output:
    - name: review_result
      type: object
      description: "審查結果"
    - name: issues
      type: array
      description: "發現的問題列表"
    - name: next_action
      type: string
      description: "建議的下一步"
triggers:
  - pattern: "程式碼審查"
    description: "需要審查程式碼時"
  - pattern: "Milestone 完成"
    description: "Milestone 完成後自動審查"
  - pattern: "提交前"
    description: "git commit 前審查"
---

# Code Reviewer

> 審查程式碼 → 找出問題 → 提供建議

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  不重複造輪子，直接使用 PAL MCP 的專業審查能力                  │
│                                                                 │
│  本 Skill 職責：                                                │
│  • 定義何時觸發審查                                             │
│  • 準備審查所需的上下文                                         │
│  • 整理審查結果                                                 │
│  • 與其他 Skill 協作                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 使用方式

### 基本審查

```javascript
// 調用 PAL codereview
await mcp__pal__codereview({
  step: "審查 M1 完成的程式碼",
  step_number: 1,
  total_steps: 2,
  next_step_required: true,
  findings: "初始審查",
  relevant_files: [
    "/path/to/file1.js",
    "/path/to/file2.js"
  ],
  review_type: "full",
  model: "gemini-2.5-pro"
})
```

### 審查類型

| 類型 | 說明 | 適用時機 |
|------|------|----------|
| `full` | 完整審查（品質、安全、效能、架構） | Milestone 完成後 |
| `security` | 安全專項審查 | 處理敏感資料時 |
| `performance` | 效能專項審查 | 優化相關變更 |
| `quick` | 快速審查 | 小幅修改 |

### 審查標準

```markdown
PAL codereview 會檢查：

品質 (Quality)：
• 程式碼可讀性
• 命名規範
• 註解完整性
• 錯誤處理

安全 (Security)：
• 輸入驗證
• SQL 注入
• XSS 防護
• 敏感資料處理

效能 (Performance)：
• 複雜度分析
• 資源使用
• 快取策略
• N+1 問題

架構 (Architecture)：
• 設計模式
• 模組化程度
• 依賴管理
• 可維護性
```

## 審查流程

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 收集檔案列表                                                │
│     → 從 plan 或手動指定要審查的檔案                            │
│                                                                 │
│  2. 準備上下文                                                  │
│     → 變更原因、相關需求、已知限制                              │
│                                                                 │
│  3. 調用 PAL codereview                                         │
│     → 執行審查，取得結果                                        │
│                                                                 │
│  4. 整理結果                                                    │
│     → 按嚴重程度排序問題                                        │
│                                                                 │
│  5. 輸出建議                                                    │
│     → 需要修正的問題、改進建議                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 輸出格式

```yaml
review_result:
  summary: "審查摘要"
  files_reviewed: 5
  total_issues: 3

  issues:
    - severity: "high"
      type: "security"
      file: "/path/to/file.js"
      line: 42
      description: "未驗證用戶輸入"
      suggestion: "加入輸入驗證"

    - severity: "medium"
      type: "quality"
      file: "/path/to/file.js"
      line: 100
      description: "函式過長"
      suggestion: "考慮拆分成多個小函式"

  positives:
    - "錯誤處理完整"
    - "命名清晰易懂"

  next_action: "修正 high severity 問題"
```

## 與其他 Skill 的協作

```
┌─────────────────────────────────────────────────────────────────┐
│  在 PDCA 循環中的位置                                           │
│                                                                 │
│  Plan → Do → [Check: code-reviewer] → Act                      │
│               ↓                         ↓                       │
│           發現問題                   修正問題                    │
│               ↓                         ↓                       │
│          回到 Do                    繼續下一步                   │
└─────────────────────────────────────────────────────────────────┘
```

## 最小範例

```markdown
用戶：審查這個檔案
AI：

1. 收集檔案：src/api/user.js
2. 調用 PAL codereview
3. 結果：

審查結果：
┌─────────────────────────────────────────────────────┐
│  📋 Code Review 完成                                │
│                                                     │
│  檔案：src/api/user.js                              │
│  問題：2 個                                         │
│                                                     │
│  🔴 High: 第 42 行 - 未驗證用戶輸入                 │
│     建議：加入 validation middleware                │
│                                                     │
│  🟡 Medium: 第 100 行 - 函式過長（150 行）          │
│     建議：拆分成多個小函式                          │
│                                                     │
│  ✅ 優點：                                          │
│     • 錯誤處理完整                                  │
│     • API 設計符合 RESTful                          │
│                                                     │
│  建議：先修正 High 嚴重度問題                       │
└─────────────────────────────────────────────────────┘

需要我幫您修正這些問題嗎？
```

## 設計原則

1. **不重複造輪子** - 直接使用 PAL codereview 的能力
2. **適時觸發** - 在正確的時機進行審查
3. **結構化輸出** - 方便追蹤和處理問題
4. **嚴重程度分級** - 優先處理重要問題
5. **正面回饋** - 也指出做得好的地方

## 限制與邊界

- 依賴 PAL MCP 的可用性
- 審查品質取決於 PAL codereview 的能力
- 大型專案需要分批審查
- 無法取代人工審查，只是輔助
