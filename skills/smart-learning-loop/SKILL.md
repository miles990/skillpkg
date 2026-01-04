---
name: smart-learning-loop
version: 1.1.0
description: 通用的自我學習迴圈模式，遇到能力缺口時自動搜尋、習得、驗證技能
author: miles990
tags:
  - learning
  - self-evolving
  - meta-skill
  - autonomous
dependencies:
  mcp:
    - package: "skillpkg-mcp-server"
      required: true
    - package: "@anthropic/cipher-mcp"
      required: false
      note: "推薦使用，用於經驗記憶"
interface:
  input:
    - name: task
      type: string
      description: "當前任務描述"
      required: true
    - name: gap
      type: string
      description: "識別到的能力缺口"
      required: true
    - name: context
      type: object
      description: "上下文資料（來自前一個 skill）"
      required: false
  output:
    - name: result
      type: string
      description: "學習結果：成功/失敗/部分成功"
    - name: skills_acquired
      type: array
      description: "本次習得的技能列表"
    - name: experience
      type: object
      description: "結構化經驗記錄"
    - name: next_action
      type: string
      description: "建議的下一步動作"
triggers:
  - pattern: "我不知道如何"
    description: "識別到知識缺口"
  - pattern: "連續失敗"
    description: "同一任務連續失敗 2 次以上"
  - pattern: "需要特定工具"
    description: "任務需要特定框架/工具知識"
  - pattern: "不熟悉的領域"
    description: "用戶詢問陌生領域問題"
---

# Smart Learning Loop

> 遇到不會的 → 搜尋技能 → 安裝學習 → 驗證 → 記住經驗

## 核心理念

```
┌─────────────────────────────────────────────────────────────────┐
│  不是給你更多知識，而是教你如何「學會學習」                     │
│                                                                 │
│  傳統模式：卡住 → 放棄 或 盲目嘗試                              │
│  學習迴圈：卡住 → 識別缺口 → 找資源 → 學習 → 驗證 → 記住       │
└─────────────────────────────────────────────────────────────────┘
```

## 觸發時機

當你遇到以下情況時，啟動學習迴圈：

| 情況 | 觸發 |
|------|------|
| 「我不知道如何...」 | ✅ |
| 連續失敗 2 次以上 | ✅ |
| 需要特定工具/框架知識 | ✅ |
| 用戶問了你不熟悉的領域 | ✅ |

## 學習迴圈流程

### Step 1: 識別能力缺口

```markdown
問自己：
1. 我卡在哪裡？
2. 是缺「知識」還是缺「工具」？
3. 如果有 X 技能，我就能繼續了嗎？

輸出：明確的技能需求描述
例如：「需要 ComfyUI 工作流程建立的知識」
```

### Step 2: 搜尋經驗（如有 Cipher）

```javascript
// 先查過去經驗
await mcp__cipher__ask_cipher({
  message: "我之前有處理過 ComfyUI 相關的任務嗎？學到了什麼？"
})
```

- 有經驗 → 直接應用，跳到 Step 5
- 無經驗 → 繼續 Step 3

### Step 3: 搜尋並安裝技能

```javascript
// 搜尋推薦技能
await mcp__skillpkg__recommend_skill({
  query: "ComfyUI workflow game assets",
  criteria: "popular"
})

// 查看推薦結果，選擇最適合的
// 安裝技能
await mcp__skillpkg__install_skill({
  source: "recommended-skill-name",
  scope: "local"
})

// 載入技能指令
await mcp__skillpkg__load_skill({
  id: "recommended-skill-name"
})
```

### Step 4: 驗證學習

安裝技能後，必須驗證真的學會了：

```markdown
驗證任務設計原則：
- 範圍小、可快速完成
- 涵蓋核心能力
- 有明確成功標準

例如：
技能：comfyui-expert
驗證：生成一張 256x256 測試圖片
標準：PNG 格式、尺寸正確
結果：✅ 成功 → 繼續主任務
       ❌ 失敗 → 回到 Step 3 換技能
```

### Step 5: 記錄經驗（如有 Cipher）

```javascript
// 記錄這次學習經驗
await mcp__cipher__ask_cipher({
  message: `請記住這次學習經驗：

  任務：用 ComfyUI 生成遊戲道具
  問題：不知道如何生成透明背景
  解法：安裝 comfyui-expert skill，使用 RemBG 節點
  效果：成功生成透明背景 PNG
  注意：需要 4GB+ GPU 記憶體

  下次遇到類似問題可以參考。`
})
```

## 失敗處理

當學習迴圈本身失敗時：

```markdown
┌─────────────────────────────────────────────────────────────────┐
│  失敗類型              處理方式                                 │
├─────────────────────────────────────────────────────────────────┤
│  找不到相關技能        → 用 WebSearch 搜尋教學                  │
│  技能安裝失敗          → 檢查依賴，嘗試替代技能                  │
│  驗證失敗              → 重新閱讀技能說明，或換技能              │
│  連續 3 次失敗         → 暫停，詢問用戶方向                      │
└─────────────────────────────────────────────────────────────────┘
```

## 最小範例

```markdown
用戶：幫我用 ComfyUI 生成遊戲道具圖片

AI 內心獨白：
1. 識別缺口：我不熟悉 ComfyUI
2. 查經驗：(Cipher) 沒有相關經驗
3. 搜技能：recommend_skill("ComfyUI game assets")
   → 推薦 comfyui-expert
4. 安裝：install_skill("comfyui-expert")
5. 載入：load_skill("comfyui-expert")
6. 驗證：生成測試圖 → 成功
7. 記錄：(Cipher) 存下這次經驗
8. 執行主任務：用學到的技能完成用戶需求
```

## 與其他工具整合

| MCP 工具 | 用途 | 必要性 |
|----------|------|--------|
| skillpkg | 技能搜尋/安裝/載入 | **必要** |
| cipher | 經驗記憶與檢索 | 推薦 |
| pal | 複雜問題多模型諮詢 | 可選 |
| context7 | 查詢最新文檔 | 可選 |

## 設計原則

1. **不造輪子** - 組合現有 MCP 工具
2. **最小介入** - 只在真的卡住時才觸發
3. **可驗證** - 每次學習都要驗證效果
4. **可累積** - 經驗記錄下來，避免重複學習
5. **可回退** - 失敗時有明確的處理路徑

## 進階：策略池

當同一問題有多種解法時，維護策略優先級：

```yaml
strategies:
  - name: "ComfyUI + RemBG"
    priority: 1
    status: untried
  - name: "Stable Diffusion API"
    priority: 2
    status: untried
  - name: "DALL-E + 後處理"
    priority: 3
    status: untried

# 失敗時自動切換到下一個策略
# 不重複嘗試已失敗的策略
```

## Skill 協作模式

Skills 之間如何協作？這裡定義三種協作模式：

### 模式 1: 串聯 (Pipeline)

一個 Skill 的輸出作為另一個 Skill 的輸入：

```
┌─────────────────────────────────────────────────────────────────┐
│  [research-skill] → [code-reviewer] → [git-helper]              │
│       ↓                   ↓                ↓                   │
│   收集需求資料       審查程式碼       提交變更                  │
└─────────────────────────────────────────────────────────────────┘

範例：
1. research-skill 分析問題，產出研究報告
2. 根據報告寫程式碼
3. code-reviewer 審查程式碼，產出修改建議
4. 修正後用 git-helper 提交
```

**實作方式：**
```javascript
// 在 context 中傳遞前一個 skill 的結果
const researchResult = await executeWithSkill("research", task);
const codeResult = await writeCode(researchResult);
const reviewResult = await executeWithSkill("code-reviewer", codeResult);
```

### 模式 2: 分工 (Delegation)

主 Skill 將子任務委派給專門的 Skill：

```
┌─────────────────────────────────────────────────────────────────┐
│                    [smart-learning-loop]                        │
│                           │                                     │
│           ┌───────────────┼───────────────┐                    │
│           ↓               ↓               ↓                    │
│    [skillpkg MCP]   [cipher MCP]    [pal MCP]                  │
│     技能搜尋/安裝     經驗記憶      多模型諮詢                  │
└─────────────────────────────────────────────────────────────────┘

這就是 smart-learning-loop 的運作方式：
- 自己負責「學習迴圈」的流程控制
- 將具體工作委派給專門的 MCP 工具
```

**實作方式：**
```javascript
// 主 skill 協調多個子 skill
async function learningLoop(gap) {
  // 委派給 cipher 查經驗
  const experience = await mcp__cipher__ask_cipher({ query: gap });

  if (!experience) {
    // 委派給 skillpkg 找技能
    const skill = await mcp__skillpkg__recommend_skill({ query: gap });
    await mcp__skillpkg__install_skill({ source: skill.name });
  }
}
```

### 模式 3: 組合 (Composition)

多個 Skill 組合成一個更強大的 Skill：

```
┌─────────────────────────────────────────────────────────────────┐
│  [full-stack-dev] = [research] + [frontend] + [backend] + [test]│
│                                                                 │
│  這個組合 skill：                                               │
│  • 依賴其他 skills 作為「能力模組」                             │
│  • 定義它們如何協作                                             │
│  • 處理它們之間的資料傳遞                                       │
└─────────────────────────────────────────────────────────────────┘
```

**在 SKILL.md 中宣告依賴：**
```yaml
---
name: full-stack-dev
dependencies:
  skills:
    - github:org/research-skill
    - github:org/frontend-skill
    - github:org/backend-skill
    - github:org/test-skill
---
```

### 協作協議

為了讓 Skills 能順利協作，建議遵循以下協議：

| 項目 | 規範 |
|------|------|
| **輸入格式** | 明確定義 skill 接受的輸入格式 |
| **輸出格式** | 明確定義 skill 產出的輸出格式 |
| **狀態傳遞** | 用 context/memory 傳遞狀態 |
| **錯誤處理** | 失敗時返回結構化錯誤 |

**範例：標準化介面**
```yaml
# 在 SKILL.md 中定義
interface:
  input:
    - name: task
      type: string
      required: true
    - name: context
      type: object
      required: false
  output:
    - name: result
      type: string
    - name: artifacts
      type: array
    - name: next_action
      type: string
```

### 協作範例：完整開發流程

```markdown
用戶：幫我開發一個 Todo App

協作流程：
1. [smart-learning-loop] 評估：需要哪些技能？
   → 識別缺口：需要 React 開發知識

2. [smart-learning-loop] 委派給 skillpkg：
   → install("react-expert")
   → install("test-helper")

3. [research-skill] 分析需求：
   → 輸出：功能規格、技術選型

4. [react-expert] 實作前端：
   → 輸入：功能規格
   → 輸出：React 組件程式碼

5. [test-helper] 撰寫測試：
   → 輸入：React 組件
   → 輸出：測試檔案

6. [code-reviewer] 審查：
   → 輸入：所有程式碼
   → 輸出：修改建議

7. [git-helper] 提交：
   → 輸入：審查通過的程式碼
   → 輸出：Git commit

8. [smart-learning-loop] 記錄經驗到 Cipher：
   → 「Todo App 開發：用了 react-expert + test-helper，效果良好」
```

### 用 skillpkg.json 管理協作

```json
{
  "name": "my-project",
  "skills": {
    "smart-learning-loop": "github:miles990/smart-learning-loop",
    "code-reviewer": "github:org/code-reviewer",
    "git-helper": "github:org/git-helper"
  },
  "skill_workflows": {
    "development": ["research", "implement", "review", "commit"],
    "learning": ["identify-gap", "search-skill", "install", "verify"]
  }
}
```

## 限制與邊界

- 這是一個「學習模式」，不是萬能解答
- 依賴 skillpkg 生態系統中的技能
- 複雜問題可能需要多輪學習迴圈
- 某些領域可能沒有現成技能，需要 fallback 到 WebSearch
- Skill 協作需要各 Skill 遵循協作協議
