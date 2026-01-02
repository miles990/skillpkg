# Design Document: skillpkg v2.0

## Overview

skillpkg v2.0 extends the existing skill package manager with project-centric configuration (`skillpkg.json`), dependency management, and multi-tool sync capabilities. It builds upon the existing `adapters`, `parser`, `store`, and `importer` modules.

## Code Reuse Analysis

### Existing Components to Leverage

| Module | Purpose | Reuse Strategy |
|--------|---------|----------------|
| `adapters/` | Tool-specific implementations (claude-code, cursor, copilot, codex) | Extend for sync functionality |
| `parser/` | SKILL.md/skill.yaml parsing | Extend to parse `dependencies` field |
| `store/` | Skill storage management | Extend for state.json management |
| `importer/` | GitHub/URL skill import | Reuse for dependency fetching |
| `github/` | GitHub search API | Reuse for skill discovery |

### Integration Points

- **Adapters**: Add `sync()` method to each adapter
- **Parser**: Add `dependencies` field to schema
- **Store**: Add `state.json` alongside existing skill storage

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        skillpkg v2.0                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │    CLI      │   │ MCP Server  │   │    TUI      │          │
│  │  (existing) │   │  (existing) │   │  (future)   │          │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────┐          │
│  │                    CORE                          │          │
│  ├──────────────────────────────────────────────────┤          │
│  │  NEW MODULES:                                    │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │          │
│  │  │ config/  │  │ resolver/│  │    sync/     │  │          │
│  │  │(skillpkg │  │(Deps/MCP)│  │ (Multi-tool) │  │          │
│  │  │ .json)   │  │          │  │              │  │          │
│  │  └──────────┘  └──────────┘  └──────────────┘  │          │
│  │                                                  │          │
│  │  EXISTING (to extend):                          │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │          │
│  │  │ store/   │  │ parser/  │  │  adapters/   │  │          │
│  │  │(+state)  │  │(+deps)   │  │  (+sync)     │  │          │
│  │  └──────────┘  └──────────┘  └──────────────┘  │          │
│  │                                                  │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  FILE SYSTEM:                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │  skillpkg.json      (Project config - NEW)       │          │
│  │  .skillpkg/                                      │          │
│  │    ├── skills/      (Existing)                   │          │
│  │    ├── cache/       (Existing)                   │          │
│  │    └── state.json   (NEW)                        │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Component 1: ConfigManager (NEW)

**Purpose:** Read/write `skillpkg.json` project configuration

**File:** `packages/core/src/config/config-manager.ts`

**Interfaces:**
```typescript
interface SkillpkgConfig {
  name: string;
  version?: string;
  skills: Record<string, string>;      // name -> source
  mcp?: Record<string, McpConfig>;
  reminders?: string[];
  hooks?: Record<string, string>;
  sync_targets?: Record<SyncTarget, boolean>;
}

interface McpConfig {
  package: string;
  required?: boolean;
  command?: string;
  args?: string[];
}

type SyncTarget = 'claude-code';  // v2.0 僅支援 Claude Code

class ConfigManager {
  loadProjectConfig(projectPath: string): Promise<SkillpkgConfig>;
  saveProjectConfig(projectPath: string, config: SkillpkgConfig): Promise<void>;
  initProject(projectPath: string, name: string): Promise<void>;
  addSkill(projectPath: string, name: string, source: string): Promise<void>;
  removeSkill(projectPath: string, name: string): Promise<void>;
}
```

**Dependencies:** `ajv` (schema validation), `fs/promises`

**Reuses:** Schema validation pattern from `parser/validator.ts`

### Component 2: StateManager (NEW)

**Purpose:** Track installation state, dependencies, and sync history

**File:** `packages/core/src/state/state-manager.ts`

**Interfaces:**
```typescript
interface SkillState {
  version: string;
  source: string;
  installed_by: 'user' | string;
  installed_at: string;
  depended_by: string[];
}

interface McpState {
  package: string;
  installed_by_skill?: string;
  installed_at: string;
}

interface State {
  $schema: string;
  skills: Record<string, SkillState>;
  mcp: Record<string, McpState>;
  sync_history: Record<SyncTarget, string>;
}

class StateManager {
  loadState(projectPath: string): Promise<State>;
  saveState(projectPath: string, state: State): Promise<void>;
  recordSkillInstall(projectPath: string, name: string, info: SkillInstallInfo): Promise<void>;
  recordSkillUninstall(projectPath: string, name: string): Promise<void>;
  getDependents(state: State, skillName: string): string[];
  canUninstall(state: State, skillName: string): { canUninstall: boolean; dependents: string[] };
}
```

**Dependencies:** `fs/promises`

**Reuses:** None (new module)

### Component 3: DependencyResolver (NEW)

**Purpose:** Resolve skill→skill and skill→MCP dependencies

**File:** `packages/core/src/resolver/dependency-resolver.ts`

**Interfaces:**
```typescript
interface SkillDependencies {
  skills?: string[];
  mcp?: string[];
}

interface ResolvedDependency {
  name: string;
  source: string;
  type: 'skill' | 'mcp';
  transitive: boolean;
}

class DependencyResolver {
  resolveDependencies(skillSource: string, installed: Set<string>): Promise<ResolvedDependency[]>;
  buildDependencyTree(skillName: string, state: State): DependencyNode;
  detectCircular(dependencies: ResolvedDependency[]): string[] | null;
}
```

**Dependencies:** `parser` module

**Reuses:** `importer` for fetching skill metadata

### Component 4: Syncer (NEW)

**Purpose:** Sync skills to multiple AI tool directories

**File:** `packages/core/src/sync/syncer.ts`

**Interfaces:**
```typescript
interface SyncTargetConfig {
  skillsDir: string;
  mcpConfigFile?: string;
  singleFile?: boolean;
  transformer?: (content: string) => string;
}

interface SyncResult {
  success: boolean;
  skillsSynced: string[];
  errors: string[];
}

class Syncer {
  syncToTarget(projectPath: string, target: SyncTarget, skills: Map<string, string>): Promise<SyncResult>;
  syncAll(projectPath: string): Promise<Map<SyncTarget, SyncResult>>;
  transformForTarget(content: string, target: SyncTarget): string;
  syncMcpConfig(projectPath: string, target: SyncTarget, mcp: Record<string, McpConfig>): Promise<void>;
}
```

**Dependencies:** `adapters` module, `fs/promises`

**Reuses:** Adapter implementations from `adapters/` for target-specific logic

### Component 5: Extended Parser (EXTEND)

**Purpose:** Parse `dependencies` field from SKILL.md frontmatter

**File:** `packages/core/src/parser/schema.ts` (extend)

**Changes:**
```typescript
// Add to existing SkillMetadata
interface SkillMetadata {
  // ... existing fields
  dependencies?: {
    skills?: string[];
    mcp?: string[];
  };
}
```

**Reuses:** Existing `parser.ts` and `validator.ts`

### Component 6: Extended Adapters (EXTEND)

**Purpose:** Add sync capability to Claude Code adapter

**Files:** `packages/core/src/adapters/claude-code.ts`

> **v2.0 Scope:** 僅擴展 Claude Code adapter，其他 adapters 未來版本再處理

**Changes:**
```typescript
// Add to ClaudeCodeAdapter
class ClaudeCodeAdapter extends BaseAdapter {
  // ... existing methods
  sync(skills: Map<string, string>): Promise<SyncResult>;
  getSyncConfig(): SyncTargetConfig;
}
```

**Reuses:** Existing claude-code adapter implementation

## Data Models

### skillpkg.json Schema
```typescript
{
  "$schema": "https://skillpkg.dev/schemas/skillpkg.json",
  "name": string,           // Required
  "version": string,        // Optional, semver
  "skills": {
    [name: string]: string  // source (github:user/repo, url, local path)
  },
  "mcp": {
    [name: string]: {
      "package": string,    // npm package name
      "required": boolean,  // default: false
      "command": string,    // executable command
      "args": string[]      // command arguments
    }
  },
  "reminders": string[],
  "hooks": {
    [name: string]: string  // script path
  },
  "sync_targets": {
    "claude-code": boolean,
    "cursor": boolean,
    "codex": boolean,
    "copilot": boolean,
    "windsurf": boolean
  }
}
```

### state.json Schema
```typescript
{
  "$schema": "skillpkg-state-v1",
  "skills": {
    [name: string]: {
      "version": string,
      "source": string,
      "installed_by": "user" | string,
      "installed_at": string,        // ISO 8601
      "depended_by": string[]
    }
  },
  "mcp": {
    [name: string]: {
      "package": string,
      "installed_by_skill": string | null,
      "installed_at": string
    }
  },
  "sync_history": {
    [target: string]: string         // ISO 8601
  }
}
```

## Sync Target Configurations

> **v2.0 Scope:** 僅支援 Claude Code，其他工具未來版本再擴展

| Target | Skills Directory | MCP Config | Format |
|--------|------------------|------------|--------|
| claude-code | `.claude/skills/{name}/SKILL.md` | `.mcp.json` | Directory per skill |

<!-- Future targets (out of scope for v2.0):
| cursor | `.cursor/rules/{name}.md` | `.cursor/mcp.json` | File per skill |
| codex | `AGENTS.md` | - | Single combined file |
| copilot | `.github/copilot-instructions.md` | - | Single combined file |
| windsurf | `.windsurf/rules/{name}.md` | `.windsurf/mcp.json` | File per skill |
-->

## Error Handling

### Error Scenarios

1. **Circular Dependency Detected**
   - **Handling:** Abort installation, show dependency chain
   - **User Impact:** "Circular dependency detected: A → B → C → A"

2. **Uninstall with Dependents**
   - **Handling:** Show dependents, require `--force` or user confirmation
   - **User Impact:** "Cannot uninstall X: depended on by Y, Z. Use --force to override."

3. **MCP Installation Failed**
   - **Handling:** Log error, continue with skill install, mark MCP as not installed
   - **User Impact:** "Warning: MCP 'cipher' failed to install. Skill may not work correctly."

4. **Sync Target Not Writable**
   - **Handling:** Skip target, report error
   - **User Impact:** "Failed to sync to cursor: Permission denied. Skipped."

5. **Invalid skillpkg.json**
   - **Handling:** Show validation errors with line numbers
   - **User Impact:** "Invalid skillpkg.json at line 5: 'skills' must be an object"

## Testing Strategy

### Unit Testing
- **ConfigManager**: Read/write/validate operations
- **StateManager**: State updates, dependency queries
- **DependencyResolver**: Resolution, circular detection
- **Syncer**: Format transformation

### Integration Testing
- Full install flow with dependencies
- Sync to multiple targets
- Uninstall with dependency cleanup

### E2E Testing
- CLI command workflows
- MCP server tool invocations

## MCP Dependency Handling

### Overview

skillpkg v2.0 內建 **MCP Registry**，當 skill 依賴 MCP 時，可自動安裝並配置。

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP 依賴處理流程                                                │
│                                                                 │
│  skill 依賴 MCP (e.g., cipher)                                  │
│           ↓                                                     │
│  DependencyResolver 解析                                        │
│           ↓                                                     │
│  檢查 .mcp.json 是否已配置                                       │
│           ↓                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  未配置 → 查詢 MCP_REGISTRY                              │   │
│  │           ↓                                              │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  找到配置：                                       │    │   │
│  │  │  "需要安裝 cipher MCP"                           │    │   │
│  │  │  "執行: npm install -g @byterover/cipher"        │    │   │
│  │  │  "是否自動安裝？ [Y/n]"                          │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │           ↓                                              │   │
│  │  用戶確認 → 執行安裝 → 更新 .mcp.json                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component: McpManager (NEW)

**Purpose:** 管理 MCP 依賴的檢測、安裝、配置

**File:** `packages/core/src/mcp/mcp-manager.ts`

**Interfaces:**
```typescript
interface McpInstallConfig {
  name: string;
  package: string;           // npm package name
  command: string;           // executable command
  args: string[];            // default args
  installCmd: string;        // install command
  verifyCmd?: string;        // verify installation
  description?: string;
}

// 內建 MCP Registry
const MCP_REGISTRY: Record<string, McpInstallConfig> = {
  cipher: {
    name: "cipher",
    package: "@byterover/cipher",
    command: "cipher",
    args: ["--mode", "mcp"],
    installCmd: "npm install -g @byterover/cipher",
    verifyCmd: "cipher --version",
    description: "Memory system for AI coding agents"
  },
  context7: {
    name: "context7",
    package: "@context7/mcp",
    command: "context7-mcp",
    args: [],
    installCmd: "npm install -g @context7/mcp",
    description: "Documentation lookup for libraries"
  },
  // ... 更多常見 MCP
};

class McpManager {
  // 檢查 MCP 是否已安裝
  async isInstalled(mcpName: string): Promise<boolean>;

  // 從 registry 取得安裝配置
  getInstallConfig(mcpName: string): McpInstallConfig | null;

  // 安裝 MCP (執行 npm install)
  async install(mcpName: string): Promise<InstallResult>;

  // 更新 .mcp.json 配置
  async updateMcpConfig(projectPath: string, mcpName: string): Promise<void>;

  // 完整流程：檢查 → 提示 → 安裝 → 配置
  async ensureMcpInstalled(
    projectPath: string,
    mcpName: string,
    options: { autoInstall?: boolean }
  ): Promise<EnsureResult>;
}
```

### MCP Registry (Built-in)

預設支援的 MCP servers：

| Name | Package | Description |
|------|---------|-------------|
| cipher | @byterover/cipher | Memory system for AI agents |
| context7 | @context7/mcp | Documentation lookup |
| github | @anthropic/mcp-github | GitHub integration |
| filesystem | @anthropic/mcp-filesystem | File system access |
| postgres | @anthropic/mcp-postgres | PostgreSQL integration |

### 自訂 MCP Registry

用戶可在 `skillpkg.json` 中定義額外的 MCP：

```json
{
  "mcp": {
    "my-custom-mcp": {
      "package": "@my-org/custom-mcp",
      "command": "custom-mcp",
      "args": ["--config", "default"],
      "required": true
    }
  }
}
```

### Integration with DependencyResolver

```typescript
// packages/core/src/resolver/dependency-resolver.ts

class DependencyResolver {
  constructor(private mcpManager: McpManager) {}

  async resolveMcpDependencies(
    mcpNames: string[],
    options: { autoInstall?: boolean }
  ): Promise<McpResolutionResult> {
    const results: McpResolutionResult = {
      installed: [],
      needsInstall: [],
      unknown: []
    };

    for (const name of mcpNames) {
      if (await this.mcpManager.isInstalled(name)) {
        results.installed.push(name);
      } else if (this.mcpManager.getInstallConfig(name)) {
        results.needsInstall.push(name);
      } else {
        results.unknown.push(name);
      }
    }

    // 自動安裝或提示
    if (results.needsInstall.length > 0) {
      if (options.autoInstall) {
        for (const name of results.needsInstall) {
          await this.mcpManager.install(name);
        }
      } else {
        // 顯示提示讓用戶確認
      }
    }

    return results;
  }
}
```

### CLI Output Example

```
$ skillpkg install github:user/my-skill

Resolving dependencies...
  ✓ skill: git-helper (already installed)
  ⚠ mcp: cipher (not installed)

Missing MCP dependencies:
┌──────────┬─────────────────────────┬─────────────────────────────────┐
│ Name     │ Package                 │ Description                     │
├──────────┼─────────────────────────┼─────────────────────────────────┤
│ cipher   │ @byterover/cipher       │ Memory system for AI agents     │
└──────────┴─────────────────────────┴─────────────────────────────────┘

Install missing MCP servers? [Y/n] y

Installing cipher...
  $ npm install -g @byterover/cipher
  ✓ Installed successfully

Updating .mcp.json...
  ✓ Added cipher configuration

✓ All dependencies resolved
✓ Skill installed: my-skill
```

## Built-in Skills

skillpkg 內建一個 skill，讓 AI 知道如何使用 skillpkg 的 MCP 安裝功能。

### mcp-installer Skill

**Purpose:** 教 AI 如何使用 skillpkg 安裝和管理 MCP servers

**Location:** `skills/mcp-installer/SKILL.md`

**功能說明：**
- 解釋 MCP Registry 的概念
- 說明如何安裝 MCP：`skillpkg install` 時自動處理依賴
- 說明如何手動安裝 MCP：`skillpkg mcp install <name>`
- 列出支援的 MCP servers（從 MCP_REGISTRY）
- 說明如何自訂 MCP 配置

**SKILL.md 範例結構：**
```markdown
---
name: mcp-installer
version: 2.0.0
description: 使用 skillpkg 安裝和管理 MCP servers
triggers:
  - 安裝 MCP
  - 設定 MCP
  - MCP 依賴
---

# MCP Installer

## 支援的 MCP Servers

skillpkg 內建以下 MCP 的安裝配置：

| Name | 用途 |
|------|------|
| cipher | AI 記憶系統 |
| context7 | 文件查詢 |
| github | GitHub 整合 |
| filesystem | 檔案系統存取 |

## 安裝 MCP

### 自動安裝（推薦）
當安裝的 skill 依賴 MCP 時，skillpkg 會自動提示安裝：
\`skillpkg install <skill-with-mcp-dep>\`

### 手動安裝
\`skillpkg mcp install cipher\`

## 查看已安裝的 MCP
\`skillpkg mcp list\`

## 自訂 MCP
在 skillpkg.json 中定義：
\`\`\`json
{
  "mcp": {
    "my-mcp": {
      "package": "@my-org/my-mcp",
      "command": "my-mcp",
      "args": []
    }
  }
}
\`\`\`
```

### Sync 行為

mcp-installer skill 在 sync 時會：
- **Claude Code**: 複製到 `.claude/skills/mcp-installer/SKILL.md`
- **其他工具**: 合併到對應的配置檔

## File Structure (Final)

```
skillpkg/
├── skills/                     # NEW - Built-in skills
│   └── mcp-installer/
│       └── SKILL.md
└── packages/
    └── core/
        └── src/
            ├── config/                 # NEW
            │   ├── config-manager.ts
            │   ├── schemas/
            │   │   └── skillpkg.schema.json
            │   └── index.ts
            ├── state/                  # NEW
            │   ├── state-manager.ts
            │   └── index.ts
            ├── mcp/                    # NEW
            │   ├── mcp-manager.ts
            │   ├── registry.ts
            │   └── index.ts
            ├── resolver/               # NEW
            │   ├── dependency-resolver.ts
            │   └── index.ts
            ├── sync/                   # NEW
            │   ├── syncer.ts
            │   ├── transformers.ts
            │   └── index.ts
            ├── adapters/               # EXTEND
            │   ├── base.ts            # Add sync interface
            │   └── claude-code.ts     # Add sync implementation (v2.0 scope)
            ├── parser/                 # EXTEND
            │   └── schema.ts          # Add dependencies field
            ├── store/                  # EXISTING
            ├── importer/               # EXISTING
            ├── github/                 # EXISTING
            ├── types.ts
            └── index.ts               # Export new modules
```
