# Smart Agent Core

> 智慧 Agent 核心技能套件：自我學習、規劃、協作、經驗傳承

## 概覽

Smart Agent Core 是一套讓 AI Agent 具備自我學習和任務規劃能力的核心技能套件。

```
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Agent Core                           │
│                                                                 │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │learning │ │research │ │  plan   │ │  goal   │  核心 Skills │
│   │  loop   │ │         │ │ master  │ │verifier │              │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │  code   │ │  test   │ │   git   │ │  debug  │  工作流 Skills│
│   │reviewer │ │ helper  │ │ helper  │ │ helper  │              │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    MCP 工具層                            │   │
│   │   skillpkg  │  cipher  │   pal   │  context7            │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 安裝

### 安裝完整套件

```bash
skillpkg install github:miles990/skillpkg#skills/smart-agent-core
```

### 只安裝核心 Skills

```bash
skillpkg install github:miles990/skillpkg#skills/smart-learning-loop
skillpkg install github:miles990/skillpkg#skills/research
skillpkg install github:miles990/skillpkg#skills/plan-master
skillpkg install github:miles990/skillpkg#skills/goal-verifier
```

### 同步到 AI 平台

```bash
skillpkg sync
```

## Skills 清單

### 核心 Skills（必須）

| Skill | 職責 | 觸發時機 |
|-------|------|----------|
| **smart-learning-loop** | 遇到能力缺口時自動學習 | 不知道怎麼做、連續失敗 |
| **research** | 任務開始前收集資料 | 新任務開始 |
| **plan-master** | 將任務拆解為 Milestones | 研究完成後 |
| **goal-verifier** | 驗證目標和方向 | Milestone 完成後 |

### 工作流程 Skills（建議）

| Skill | 職責 | 依賴 MCP |
|-------|------|----------|
| **code-reviewer** | 程式碼審查 | pal.codereview |
| **test-helper** | 測試策略與案例設計 | - |
| **git-helper** | Git 操作與 commit 規範 | - |
| **debug-helper** | 問題診斷與修復 | pal.debug |

## 工作流程

### 開發流程

```
[用戶任務]
    │
    ▼
[research] ──────────────► 研究報告
    │
    ▼
[plan-master] ───────────► 任務計劃（Milestones）
    │
    ▼
┌───────────────────────────────────────────────────────┐
│  對每個 Milestone 執行 PDCA：                          │
│                                                       │
│  Plan → Do → Check → Act                              │
│         │      │                                      │
│         │   [code-reviewer]                           │
│         │   [test-helper]                             │
│         │      │                                      │
│         │   失敗 → [debug-helper] → 修正              │
│         │                                             │
│         └──────────────────────────────────────────── │
│                         │                             │
│  缺少能力 → [smart-learning-loop] → 學習技能          │
│                         │                             │
│  Milestone 完成 → [goal-verifier] → 確認方向          │
│                         │                             │
│  提交 → [git-helper] → commit & push                  │
└───────────────────────────────────────────────────────┘
    │
    ▼
[目標達成]
```

### 學習流程

```
[遇到不會的]
    │
    ▼
[smart-learning-loop]
    │
    ├── 查經驗 (cipher)
    │
    ├── 搜技能 (skillpkg)
    │
    ├── 安裝學習
    │
    ├── 驗證
    │
    └── 記錄經驗 (cipher)
```

## MCP 依賴

| MCP | 必要性 | 用途 |
|-----|--------|------|
| skillpkg | **必須** | 技能搜尋、安裝、載入 |
| cipher | **必須** | 經驗記憶與檢索 |
| pal | 推薦 | codereview, debug |
| context7 | 推薦 | 查詢最新文件 |

### 設定 MCP

```bash
# skillpkg
claude mcp add skillpkg -- npx -y skillpkg-mcp-server

# cipher (需要 Anthropic 帳號)
claude mcp add cipher -- npx -y @anthropic/cipher-mcp

# pal
claude mcp add pal -- npx -y pal-mcp-server

# context7
claude mcp add context7 -- npx -y @context7/mcp-server
```

## 使用範例

### 範例 1：開發新功能

```
用戶：幫我建立一個 Todo App

AI 執行流程：
1. [research] 分析需求，查詢 React 最新文件
2. [plan-master] 拆解為 4 個 Milestones
3. 執行 M1，完成後 [goal-verifier] 確認
4. 執行 M2，遇到不會 → [smart-learning-loop] 學習
5. [code-reviewer] 審查 → 發現問題 → 修正
6. [test-helper] 設計測試案例
7. [git-helper] 提交程式碼
8. 重複直到完成
```

### 範例 2：Debug

```
錯誤：TypeError: Cannot read property 'map' of undefined

AI 執行流程：
1. [debug-helper] 分析錯誤 → 類型 B（執行錯誤）
2. 診斷：users 為 undefined
3. 解法：加入 loading 狀態檢查
4. 修正程式碼
5. [test-helper] 加入測試案例
```

## 協作模式

Skills 之間支援三種協作模式：

### 1. 串聯 (Pipeline)

```
research → plan-master → 執行 → code-reviewer → git-helper
```

### 2. 分工 (Delegation)

```
smart-learning-loop
    ├── skillpkg MCP（搜尋技能）
    ├── cipher MCP（查經驗）
    └── pal MCP（深度分析）
```

### 3. 組合 (Composition)

```
development workflow = research + plan-master + ... + git-helper
```

## 設計原則

1. **不造輪子** - 組合現有 MCP 工具
2. **可組合** - Skills 之間能串聯協作
3. **可攜帶** - 透過 skillpkg 安裝，跨平台使用
4. **漸進式** - 可單獨安裝，也可安裝完整套件
5. **經驗累積** - 學到的經驗傳承給未來

## License

MIT
