# Design Document: skillpkg MCP Server

## Overview

skillpkg MCP Server 是一個實作 Anthropic MCP (Model Context Protocol) 的服務，讓 AI Agent 能透過標準化協議存取 skillpkg 的功能。Server 使用 stdio transport，可被 Claude Desktop、Cursor 等 MCP 客戶端呼叫。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Architecture                             │
│                                                                 │
│  ┌──────────────┐     stdio      ┌──────────────────────────┐  │
│  │  MCP Client  │ ◄────────────► │    skillpkg serve        │  │
│  │  (Claude/    │                │                          │  │
│  │   Cursor)    │                │  ┌────────────────────┐  │  │
│  └──────────────┘                │  │   MCP Server       │  │  │
│                                  │  │   (Tool Router)    │  │  │
│                                  │  └─────────┬──────────┘  │  │
│                                  │            │             │  │
│                                  │  ┌─────────▼──────────┐  │  │
│                                  │  │   Tool Handlers    │  │  │
│                                  │  │  ├─ search_skills  │  │  │
│                                  │  │  ├─ load_skill     │  │  │
│                                  │  │  ├─ install_skill  │  │  │
│                                  │  │  ├─ list_skills    │  │  │
│                                  │  │  ├─ uninstall_skill│  │  │
│                                  │  │  ├─ search_registry│  │  │
│                                  │  │  └─ skill_info     │  │  │
│                                  │  └─────────┬──────────┘  │  │
│                                  │            │             │  │
│                                  │  ┌─────────▼──────────┐  │  │
│                                  │  │   skillpkg-core    │  │  │
│                                  │  │  (Existing Logic)  │  │  │
│                                  │  └────────────────────┘  │  │
│                                  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Registry Architecture (GitHub-based)

```
┌─────────────────────────────────────────────────────────────────┐
│  github.com/skillpkg/registry                                   │
│                                                                 │
│  ├── skills/                      # 所有 skills                 │
│  │   ├── self-evolving-agent/                                  │
│  │   │   ├── skill.yaml                                        │
│  │   │   └── README.md                                         │
│  │   ├── code-reviewer/                                        │
│  │   └── comfyui-expert/                                       │
│  │                                                              │
│  ├── index.json                   # 自動生成的索引              │
│  │   {                                                         │
│  │     "skills": [{                                            │
│  │       "name": "self-evolving-agent",                        │
│  │       "description": "...",                                 │
│  │       "version": "1.0.0",                                   │
│  │       "stars": 42,             ← GitHub stars               │
│  │       "updatedAt": "2025-01-02"                             │
│  │     }]                                                      │
│  │   }                                                         │
│  │                                                              │
│  └── .github/workflows/                                        │
│      ├── validate-pr.yml          # PR 驗證 skill.yaml 格式    │
│      └── update-index.yml         # merge 後更新 index.json    │
└─────────────────────────────────────────────────────────────────┘
```

### Registry URLs

| 用途 | URL |
|------|-----|
| Index | `https://raw.githubusercontent.com/skillpkg/registry/main/index.json` |
| Skill | `https://raw.githubusercontent.com/skillpkg/registry/main/skills/{name}/skill.yaml` |
| README | `https://raw.githubusercontent.com/skillpkg/registry/main/skills/{name}/README.md` |
| Stars API | `https://api.github.com/repos/skillpkg/registry` |

### 數據映射

| MCP 欄位 | GitHub 來源 |
|----------|-------------|
| `rating` | GitHub stars (正規化到 1-5) |
| `downloads` | index.json 中的 install_count (透過 CI 追蹤) |
| `updatedAt` | skill 目錄最後 commit 時間 |
| `author` | skill.yaml 中的 author 欄位 |

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | Usage |
|-----------|----------|-------|
| `LocalStore` | `skillpkg-core/store/local.ts` | 讀取/寫入本地 skills |
| `GlobalStore` | `skillpkg-core/store/global.ts` | 讀取/寫入全域 skills |
| `RegistryClient` | `skillpkg-core/registry/client.ts` | 搜尋/下載 registry skills |
| `parse()` | `skillpkg-core/parser/` | 解析 skill.yaml |
| `createInstaller` | `skillpkg-core/installer/` | 安裝 skills |

### Integration Points

- **CLI Commands**: MCP tools 與 CLI commands 共用相同的 core 邏輯
- **Store**: 使用現有的 LocalStore/GlobalStore 存取 skills
- **Registry**: 使用現有的 RegistryClient 與 registry 互動

## Architecture

### Package Structure

```
packages/
├── core/                    # 現有 (不變)
│   ├── store/
│   ├── parser/
│   ├── registry/
│   └── installer/
├── cli/                     # 現有 (新增 serve command)
│   ├── commands/
│   │   ├── serve.ts         # NEW: 啟動 MCP Server
│   │   └── ... (existing)
│   └── index.ts
└── mcp-server/              # NEW: MCP Server 套件
    ├── server.ts            # MCP Server 主程式
    ├── tools/               # Tool handlers
    │   ├── index.ts
    │   ├── search-skills.ts
    │   ├── load-skill.ts
    │   ├── install-skill.ts
    │   ├── list-skills.ts
    │   ├── uninstall-skill.ts
    │   ├── search-registry.ts
    │   └── skill-info.ts
    ├── types.ts             # MCP 相關型別
    └── index.ts
```

## Components and Interfaces

### Component 1: MCP Server (`server.ts`)

- **Purpose:** 處理 MCP 協議、路由 tool 呼叫
- **Interfaces:**
  ```typescript
  class SkillpkgMcpServer {
    constructor(options?: ServerOptions)
    start(): Promise<void>
    stop(): Promise<void>
  }

  interface ServerOptions {
    scope?: 'local' | 'global'  // 預設 scope
    projectPath?: string        // 專案路徑
  }
  ```
- **Dependencies:** `@modelcontextprotocol/sdk`, `skillpkg-core`
- **Reuses:** 無，全新組件

### Component 2: Tool Handlers (`tools/`)

每個 tool 是一個獨立模組，遵循相同介面：

- **Purpose:** 處理特定 MCP tool 的邏輯
- **Interfaces:**
  ```typescript
  interface ToolHandler {
    name: string
    description: string
    inputSchema: JSONSchema
    execute(args: unknown): Promise<ToolResult>
  }

  interface ToolResult {
    content: Array<{
      type: 'text'
      text: string
    }>
    isError?: boolean
  }
  ```
- **Dependencies:** `skillpkg-core`
- **Reuses:** Store, Parser, Registry, Installer from core

### Component 3: Serve Command (`cli/commands/serve.ts`)

- **Purpose:** CLI 進入點，啟動 MCP Server
- **Interfaces:**
  ```bash
  skillpkg serve [options]
    --scope <scope>     # local | global (default: local)
    --project <path>    # Project path for local scope
  ```
- **Dependencies:** `skillpkg-mcp-server`
- **Reuses:** CLI framework (commander)

## Data Models

### Tool: search_skills

```typescript
// Input
interface SearchSkillsInput {
  query: string           // 搜尋關鍵字
  source?: 'all' | 'local' | 'registry'  // 預設 'all'
  limit?: number          // 預設 20
}

// Output
interface SearchSkillsOutput {
  results: Array<{
    id: string            // skill identifier
    name: string
    description: string
    version: string
    source: 'local' | 'registry'
    installed: boolean    // 是否已安裝
    rating: number        // 評分 (1-5)
    downloads: number     // 下載次數
    updatedAt: string     // 最後更新 ISO timestamp
    tags: string[]        // 標籤
    relevanceScore: number // 綜合相關性分數
  }>
  total: number
  query: string
}
```

### Tool: load_skill

```typescript
// Input
interface LoadSkillInput {
  id: string              // skill id
}

// Output
interface LoadSkillOutput {
  id: string
  name: string
  version: string
  description: string
  instructions: string    // 完整 instructions 內容
  author?: {
    name: string
    url?: string
  }
}
```

### Tool: install_skill

```typescript
// Input
interface InstallSkillInput {
  source: string          // skill name, GitHub URL, HTTP URL, gist:id, 或本地路徑
  scope?: 'local' | 'global'  // 預設 'local'
}

// Output
interface InstallSkillOutput {
  success: boolean
  skill: {
    id: string
    name: string
    version: string
    source: string        // 安裝來源
    installedAt: string   // ISO timestamp
  }
  message: string
}
```

### Tool: list_skills

```typescript
// Input
interface ListSkillsInput {
  scope?: 'all' | 'local' | 'global'  // 預設 'all'
}

// Output
interface ListSkillsOutput {
  skills: Array<{
    id: string
    name: string
    description: string
    version: string
    scope: 'local' | 'global'
    installedAt: string
  }>
  total: number
}
```

### Tool: uninstall_skill

```typescript
// Input
interface UninstallSkillInput {
  id: string
  scope?: 'local' | 'global'
}

// Output
interface UninstallSkillOutput {
  success: boolean
  message: string
}
```

### Tool: search_registry

```typescript
// Input
interface SearchRegistryInput {
  query: string
  limit?: number          // 預設 20
}

// Output
interface SearchRegistryOutput {
  results: Array<{
    name: string
    description: string
    version: string
    author: string
    downloads: number
  }>
  total: number
}
```

### Tool: skill_info

```typescript
// Input
interface SkillInfoInput {
  name: string            // skill name in registry
}

// Output
interface SkillInfoOutput {
  name: string
  description: string
  version: string
  author: {
    name: string
    email?: string
    url?: string
  }
  repository?: string
  license?: string
  platforms?: string[]
  tags?: string[]
  readme?: string         // README 內容（如有）
}
```

### Tool: recommend_skill

```typescript
// Input
interface RecommendSkillInput {
  query: string           // 任務描述或關鍵字
  criteria?: 'auto' | 'popular' | 'highest_rated' | 'newest'  // 預設 'auto'
}

// Output
interface RecommendSkillOutput {
  recommendation: {
    id: string
    name: string
    description: string
    version: string
    rating: number
    downloads: number
    updatedAt: string
    author: string
    tags: string[]
  }
  reason: string          // 推薦理由
  alternatives: Array<{   // 備選方案 (最多 3 個)
    name: string
    description: string
    rating: number
  }>
  installCommand: string  // 安裝指令提示
}
```

### Relevance Scoring Algorithm

```typescript
function calculateRelevanceScore(skill: SkillMetadata, query: string): number {
  // 文字相關性 (0-40 分)
  const textRelevance = calculateTextMatch(skill, query) * 40

  // 評分權重 (0-25 分)
  const ratingScore = (skill.rating / 5) * 25

  // 熱門程度 (0-20 分) - log scale
  const popularityScore = Math.min(Math.log10(skill.downloads + 1) / 4, 1) * 20

  // 新鮮度 (0-15 分) - 30天內滿分，逐漸衰減
  const daysSinceUpdate = daysBetween(skill.updatedAt, now())
  const freshnessScore = Math.max(0, 1 - daysSinceUpdate / 180) * 15

  return textRelevance + ratingScore + popularityScore + freshnessScore
}
```

## Source Detection Logic

`install_skill` 需要自動偵測來源類型：

```typescript
function detectSourceType(source: string): SourceType {
  // GitHub URL
  if (source.startsWith('github:') ||
      source.includes('github.com/')) {
    return 'github'
  }

  // Gist
  if (source.startsWith('gist:') ||
      source.includes('gist.github.com/')) {
    return 'gist'
  }

  // HTTP URL (zip/tarball)
  if (source.startsWith('http://') ||
      source.startsWith('https://')) {
    return 'url'
  }

  // Local path
  if (source.startsWith('./') ||
      source.startsWith('/') ||
      source.startsWith('~')) {
    return 'local'
  }

  // Default: registry
  return 'registry'
}

type SourceType = 'registry' | 'github' | 'gist' | 'url' | 'local'
```

## Error Handling

### Error Scenarios

1. **Skill Not Found**
   - **Handling:** 回傳 error result，建議搜尋或安裝
   - **User Impact:** AI 收到建議訊息，可選擇搜尋或安裝

2. **Registry Unavailable**
   - **Handling:** 回傳 error，但本地功能仍可用
   - **User Impact:** AI 知道只能使用本地 skills

3. **Installation Failed**
   - **Handling:** 回傳詳細錯誤訊息和可能的解決方案
   - **User Impact:** AI 可以嘗試其他安裝方式

4. **Invalid Source Format**
   - **Handling:** 回傳 error，列出支援的格式
   - **User Impact:** AI 可以修正 source 格式

### Error Response Format

```typescript
interface ErrorResult {
  content: [{
    type: 'text'
    text: string  // 包含錯誤訊息和建議
  }]
  isError: true
}

// Example
{
  content: [{
    type: 'text',
    text: `Error: Skill "foo" not found locally.

Suggestions:
- Search registry: search_skills({ query: "foo" })
- Install from registry: install_skill({ source: "foo" })
- Check available skills: list_skills()`
  }],
  isError: true
}
```

## Testing Strategy

### Unit Testing

- **Tool Handlers**: 每個 tool 獨立測試輸入驗證和輸出格式
- **Source Detection**: 測試各種來源格式的偵測
- **Error Handling**: 測試各種錯誤情況的回應

### Integration Testing

- **MCP Protocol**: 測試完整的 MCP request/response 流程
- **Store Integration**: 測試與 LocalStore/GlobalStore 的整合
- **Registry Integration**: 測試與 Registry API 的整合

### End-to-End Testing

- **Claude Desktop**: 手動測試與 Claude Desktop 的整合
- **Full Workflow**: 測試 search → install → load → use 完整流程

## Configuration

### MCP Client Configuration

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "skillpkg": {
      "command": "skillpkg",
      "args": ["serve"],
      "env": {
        "SKILLPKG_SCOPE": "local"
      }
    }
  }
}

// With global scope
{
  "mcpServers": {
    "skillpkg": {
      "command": "skillpkg",
      "args": ["serve", "--scope", "global"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SKILLPKG_SCOPE` | Default scope for operations | `local` |
| `SKILLPKG_REGISTRY_URL` | Custom registry URL | (default registry) |
| `SKILLPKG_PROJECT_PATH` | Project path for local scope | (current directory) |
