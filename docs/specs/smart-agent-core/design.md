# Smart Agent Core - 設計文件

## 1. 架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Agent Core                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Skill Bundle                           │   │
│  │                   (skillpkg.json)                        │   │
│  │                                                         │   │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │   │learning │ │research │ │  plan   │ │  goal   │      │   │
│  │   │  loop   │ │         │ │ master  │ │verifier │      │   │
│  │   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘      │   │
│  │        │           │           │           │            │   │
│  │   ┌────┴───────────┴───────────┴───────────┴────┐      │   │
│  │   │              協作協議層                      │      │   │
│  │   │     (標準化 input/output interface)         │      │   │
│  │   └────┬───────────┬───────────┬───────────┬────┘      │   │
│  └────────│───────────│───────────│───────────│────────────┘   │
│           │           │           │           │                │
│  ┌────────▼───────────▼───────────▼───────────▼────────────┐   │
│  │                    MCP 工具層                            │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ skillpkg │ │  cipher  │ │   pal    │ │ context7 │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 目錄結構

```
skillpkg/skills/
├── smart-agent-core/           # Bundle 定義
│   ├── skillpkg.json           # 套件依賴
│   └── README.md               # 使用說明
│
├── smart-learning-loop/        # ✅ 已建立
│   └── SKILL.md
│
├── research/                   # 待建立
│   └── SKILL.md
│
├── plan-master/                # 待建立
│   └── SKILL.md
│
├── goal-verifier/              # 待建立
│   └── SKILL.md
│
├── code-reviewer/              # 待建立（包裝 pal.codereview）
│   └── SKILL.md
│
├── test-helper/                # 待建立
│   └── SKILL.md
│
├── git-helper/                 # 待建立
│   └── SKILL.md
│
└── debug-helper/               # 待建立（包裝 pal.debug）
    └── SKILL.md
```

## 3. Skill 詳細設計

### 3.1 smart-learning-loop（已建立）

**職責**：遇到能力缺口時自動學習

**流程**：
```
識別缺口 → 查經驗(cipher) → 搜技能(skillpkg) → 安裝 → 驗證 → 記錄
```

**依賴 MCP**：
- `skillpkg`: recommend_skill, install_skill, load_skill
- `cipher`: ask_cipher (儲存/查詢經驗)

### 3.2 research（待建立）

**職責**：任務開始前的需求分析與資料收集

**流程**：
```
收到任務 → 分析需求 → 查文件(context7) → 查經驗(cipher) → 輸出研究報告
```

**依賴 MCP**：
- `context7`: resolve-library-id, query-docs
- `cipher`: ask_cipher

**輸出格式**：
```yaml
research_report:
  task: "原始任務描述"
  analysis:
    requirements: [...]
    constraints: [...]
    tech_stack: [...]
  findings:
    relevant_docs: [...]
    past_experience: [...]
  recommendations:
    approach: "建議方法"
    risks: [...]
```

### 3.3 plan-master（待建立）

**職責**：將任務拆解為可執行的 Milestones

**流程**：
```
收到研究報告 → 拆解任務 → 定義 Milestones → 輸出任務清單
```

**依賴 MCP**：
- `cipher`: ask_cipher (查詢過去類似任務的規劃)

**輸出格式**：
```yaml
plan:
  goal: "最終目標"
  milestones:
    - id: M1
      name: "建立基礎結構"
      tasks:
        - id: "1.1"
          description: "..."
          acceptance: "..."
      dependencies: []
    - id: M2
      dependencies: [M1]
      ...
```

### 3.4 goal-verifier（待建立）

**職責**：在檢查點驗證目標和方向

**觸發時機**：
- Milestone 完成後
- 用戶說「繼續」但沒有明確指示
- 發現範圍蔓延

**輸出**：
```yaml
verification:
  current_goal: "..."
  progress: "70%"
  on_track: true/false
  next_step: "建議的下一步"
  concerns: [...]
```

### 3.5 code-reviewer（待建立）

**職責**：程式碼審查（包裝 pal.codereview）

**設計**：直接調用 `mcp__pal__codereview`，不重複實作

```yaml
# 簡化的 SKILL.md
---
name: code-reviewer
description: 程式碼審查，使用 PAL MCP 的 codereview 功能
dependencies:
  mcp:
    - package: "pal-mcp-server"
---

## 使用方式

當需要審查程式碼時，調用：
mcp__pal__codereview({
  step: "審查計劃",
  relevant_files: [...],
  ...
})
```

### 3.6 其他 Skills

| Skill | 包裝的 MCP 工具 |
|-------|----------------|
| debug-helper | pal.debug |
| test-helper | (原生能力，提供測試策略) |
| git-helper | (原生能力，提供 git 規範) |

## 4. 協作協議

### 4.1 標準介面

每個 Skill 必須在 SKILL.md 中定義：

```yaml
interface:
  input:
    - name: task
      type: string
      description: "任務描述"
      required: true
    - name: context
      type: object
      description: "上下文資料（前一個 skill 的輸出）"
      required: false
  output:
    - name: result
      type: string
      description: "執行結果"
    - name: artifacts
      type: array
      description: "產出的檔案或資料"
    - name: next_action
      type: string
      description: "建議的下一步"
```

### 4.2 協作範例

```
用戶：開發一個 REST API

[research]
  input: { task: "開發 REST API" }
  output: { result: "需要 FastAPI...", next_action: "plan" }
      │
      ▼
[plan-master]
  input: { task: "開發 REST API", context: research_output }
  output: { result: "M1: 建立專案...", next_action: "implement M1" }
      │
      ▼
[smart-learning-loop] (如果不會 FastAPI)
  → skillpkg.recommend("FastAPI")
  → skillpkg.install("fastapi-expert")
  → cipher.store("學會了 FastAPI...")
      │
      ▼
[code-reviewer]
  input: { task: "審查 M1 程式碼", context: { files: [...] } }
  output: { result: "發現 2 個問題...", next_action: "fix issues" }
      │
      ▼
[goal-verifier]
  input: { task: "確認 M1 完成", context: { ... } }
  output: { result: "M1 ✅", next_action: "continue to M2" }
```

## 5. Bundle 設計

### 5.1 smart-agent-core/skillpkg.json

```json
{
  "$schema": "https://skillpkg.dev/schemas/skillpkg.json",
  "name": "smart-agent-core",
  "version": "1.0.0",
  "description": "智慧 Agent 核心技能套件",

  "skills": {
    "smart-learning-loop": "github:miles990/skillpkg#skills/smart-learning-loop",
    "research": "github:miles990/skillpkg#skills/research",
    "plan-master": "github:miles990/skillpkg#skills/plan-master",
    "goal-verifier": "github:miles990/skillpkg#skills/goal-verifier",
    "code-reviewer": "github:miles990/skillpkg#skills/code-reviewer",
    "test-helper": "github:miles990/skillpkg#skills/test-helper",
    "git-helper": "github:miles990/skillpkg#skills/git-helper",
    "debug-helper": "github:miles990/skillpkg#skills/debug-helper"
  },

  "mcp": {
    "skillpkg": {
      "package": "skillpkg-mcp-server",
      "required": true
    },
    "cipher": {
      "package": "@anthropic/cipher-mcp",
      "required": true
    },
    "pal": {
      "package": "pal-mcp-server",
      "required": false,
      "note": "用於 code-reviewer 和 debug-helper"
    },
    "context7": {
      "package": "@context7/mcp-server",
      "required": false,
      "note": "用於 research"
    }
  },

  "skill_workflows": {
    "development": [
      "research",
      "plan-master",
      "smart-learning-loop",
      "code-reviewer",
      "test-helper",
      "goal-verifier",
      "git-helper"
    ],
    "learning": [
      "smart-learning-loop"
    ],
    "debugging": [
      "debug-helper",
      "test-helper"
    ]
  }
}
```

### 5.2 安裝方式

```bash
# 安裝完整套件
skillpkg install github:miles990/skillpkg#skills/smart-agent-core

# 只安裝核心（必須）
skillpkg install github:miles990/skillpkg#skills/smart-learning-loop
skillpkg install github:miles990/skillpkg#skills/research
skillpkg install github:miles990/skillpkg#skills/plan-master
skillpkg install github:miles990/skillpkg#skills/goal-verifier

# 同步到 Claude Code
skillpkg sync
```

## 6. 與 evolve v2.1 的整合

### 6.1 evolve 循環流程對照

```
┌─────────────────────────────────────────────────────────────────┐
│                  Self-Evolving Loop                             │
│                                                                 │
│    ┌──────────┐                                                │
│    │   目標   │  ← [research] + [goal-verifier]                │
│    └────┬─────┘                                                │
│         ↓                                                       │
│    ┌──────────────┐                                            │
│    │ 能力邊界評估 │  ← [smart-learning-loop]                   │
│    └──────┬───────┘                                            │
│           ↓                                                     │
│    ┌──────────────┐     ┌──────────────┐                       │
│    │ Skill 習得   │ ──→ │   驗證學習   │  ← [smart-learning-loop]│
│    └──────────────┘     └──────┬───────┘                       │
│         ↓                      ↓                               │
│    ┌──────────┐     ┌──────────┐     ┌──────────────┐          │
│    │   Plan   │ ──→ │    Do    │ ──→ │    Check     │          │
│    │  (規劃)  │     │  (執行)  │     │  (失敗診斷)  │          │
│    └──────────┘     └──────────┘     └──────┬───────┘          │
│         ↑               ↑                    │                  │
│         │               │                    ↓                  │
│  [plan-master]    [code-reviewer]    [debug-helper]            │
│                   [test-helper]      [goal-verifier]           │
│         ↑                                    │                  │
│         │           ┌──────────────┐         │                  │
│         └────────── │ 多策略選擇   │ ←───────┘                  │
│                     │ (策略池機制) │                            │
│                     └──────┬───────┘                            │
│                            │  ← [smart-learning-loop]          │
│                     ┌──────▼───────┐                            │
│                     │ 結構化經驗   │  ← [cipher MCP]            │
│                     │   Memory     │                            │
│                     └──────────────┘                            │
│                                                                 │
│    重複直到：目標達成 或 達到最大迭代次數                       │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Phase 對照表

| evolve Phase | 對應 Skill | 說明 |
|--------------|------------|------|
| **Phase 1: 目標分析** | | |
| - 目標明確性檢查 | goal-verifier | 檢查目標是否明確 |
| - 解析目標 | research | 分析需求、收集資料 |
| - 分解子目標 | plan-master | 拆解為 Milestones |
| - 評估現有能力 | smart-learning-loop | 能力邊界評估 |
| **Phase 1.5: 能力習得** | | |
| - 搜尋經驗 | cipher MCP | ask_cipher |
| - 搜尋技能 | smart-learning-loop | skillpkg.recommend |
| - 安裝驗證 | smart-learning-loop | skillpkg.install/load |
| **Phase 2: PDCA 循環** | | |
| - Plan (規劃) | plan-master | 制定執行計劃 |
| - Do (執行) | (實際編碼) | 使用學到的 skills |
| - Check (檢查) | code-reviewer, test-helper | 審查、測試 |
| - Act (改進) | debug-helper, goal-verifier | 診斷、調整 |
| **Phase 3: 反思學習** | | |
| - 失敗分析 | debug-helper | 診斷失敗原因 |
| - 策略調整 | smart-learning-loop | 策略池機制 |
| **Phase 4: 記憶系統** | | |
| - 儲存經驗 | cipher MCP | 結構化經驗格式 |
| - 檢索經驗 | cipher MCP | ask_cipher |

### 6.3 處理方式

1. **保留 evolve 作為「整合入口」**
   - evolve 是「協調者」，調用各個細分 skills
   - 用戶可以 `/evolve` 啟動完整流程

2. **Skills 可獨立使用**
   - `research` 可單獨用於需求分析
   - `plan-master` 可單獨用於任務規劃
   - `code-reviewer` 可單獨用於程式碼審查

3. **evolve 更新為 v3.0**
   - 內部改用 skills 協作
   - 減少重複程式碼
   - 更容易維護
