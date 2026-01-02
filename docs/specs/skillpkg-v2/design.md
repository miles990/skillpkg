# skillpkg v2.0 - Design Document

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        skillpkg v2.0                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              │
│  │    CLI      │   │ MCP Server  │   │    TUI      │              │
│  │  skillpkg   │   │   (tools)   │   │  (future)   │              │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘              │
│         │                 │                 │                      │
│         └─────────────────┼─────────────────┘                      │
│                           │                                        │
│  ┌────────────────────────▼────────────────────────┐              │
│  │                    CORE                          │              │
│  ├──────────────────────────────────────────────────┤              │
│  │                                                  │              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │              │
│  │  │ Config   │  │ Resolver │  │    Syncer    │  │              │
│  │  │ Manager  │  │(Deps/MCP)│  │ (Multi-tool) │  │              │
│  │  └──────────┘  └──────────┘  └──────────────┘  │              │
│  │                                                  │              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │              │
│  │  │ Installer│  │  State   │  │   Loader     │  │              │
│  │  │          │  │ Manager  │  │ (SKILL.md)   │  │              │
│  │  └──────────┘  └──────────┘  └──────────────┘  │              │
│  │                                                  │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                     │
│  ┌──────────────────────────────────────────────────┐              │
│  │                  FILE SYSTEM                      │              │
│  ├──────────────────────────────────────────────────┤              │
│  │  .skillpkg/         (Local storage)              │              │
│  │    ├── skills/      (Installed skills)           │              │
│  │    ├── cache/       (Download cache)             │              │
│  │    └── state.json   (Installation state)         │              │
│  │                                                  │              │
│  │  skillpkg.json      (Project config)             │              │
│  │                                                  │              │
│  │  Target Directories:                             │              │
│  │    ├── .claude/skills/                           │              │
│  │    ├── .cursor/rules/                            │              │
│  │    ├── AGENTS.md                                 │              │
│  │    └── .github/copilot-instructions.md           │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Core Modules

### 2.1 ConfigManager

**Responsibility:** Read/write skillpkg.json and state.json

```typescript
// packages/core/src/config/config-manager.ts

interface SkillpkgConfig {
  name: string;
  version?: string;
  skills: Record<string, string>;  // name -> source
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
  env?: Record<string, string>;
}

type SyncTarget = 'claude-code' | 'cursor' | 'codex' | 'copilot' | 'windsurf';

class ConfigManager {
  // Read skillpkg.json from project root
  async loadProjectConfig(projectPath: string): Promise<SkillpkgConfig>;

  // Write skillpkg.json
  async saveProjectConfig(projectPath: string, config: SkillpkgConfig): Promise<void>;

  // Initialize new skillpkg.json
  async initProject(projectPath: string, name: string): Promise<void>;

  // Add skill to config
  async addSkill(projectPath: string, name: string, source: string): Promise<void>;

  // Remove skill from config
  async removeSkill(projectPath: string, name: string): Promise<void>;
}
```

### 2.2 StateManager

**Responsibility:** Track installation state and dependencies

```typescript
// packages/core/src/state/state-manager.ts

interface SkillState {
  version: string;
  source: string;
  installed_by: 'user' | string;  // 'user' or skill name
  installed_at: string;           // ISO timestamp
  depended_by: string[];          // Skills that depend on this
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
  sync_history: Record<SyncTarget, string>;  // target -> ISO timestamp
}

class StateManager {
  // Load state from .skillpkg/state.json
  async loadState(projectPath: string): Promise<State>;

  // Save state
  async saveState(projectPath: string, state: State): Promise<void>;

  // Record skill installation
  async recordSkillInstall(projectPath: string, name: string, info: Omit<SkillState, 'installed_at'>): Promise<void>;

  // Record skill uninstall
  async recordSkillUninstall(projectPath: string, name: string): Promise<void>;

  // Get dependents of a skill
  getDependents(state: State, skillName: string): string[];

  // Check if skill can be uninstalled (no dependents)
  canUninstall(state: State, skillName: string): { canUninstall: boolean; dependents: string[] };
}
```

### 2.3 DependencyResolver

**Responsibility:** Resolve skill and MCP dependencies

```typescript
// packages/core/src/resolver/dependency-resolver.ts

interface SkillMetadata {
  name: string;
  version: string;
  dependencies?: {
    skills?: string[];
    mcp?: string[];
  };
}

interface ResolvedDependency {
  name: string;
  source: string;
  type: 'skill' | 'mcp';
  transitive: boolean;  // true if dependency of dependency
}

class DependencyResolver {
  // Resolve all dependencies for a skill
  async resolveDependencies(
    skillSource: string,
    installedSkills: Set<string>
  ): Promise<ResolvedDependency[]>;

  // Parse skill metadata from SKILL.md
  parseSkillMetadata(content: string): SkillMetadata;

  // Build dependency tree
  buildDependencyTree(skillName: string, state: State): DependencyNode;

  // Detect circular dependencies
  detectCircular(dependencies: ResolvedDependency[]): string[] | null;
}

interface DependencyNode {
  name: string;
  dependencies: DependencyNode[];
}
```

### 2.4 Syncer

**Responsibility:** Sync skills to AI tool directories

```typescript
// packages/core/src/sync/syncer.ts

interface SyncTargetConfig {
  skillsDir: string;          // Where to copy SKILL.md files
  mcpConfigFile?: string;     // .mcp.json location
  singleFile?: boolean;       // Combine all skills into one file
  format?: 'markdown' | 'yaml' | 'custom';
  transformer?: (content: string) => string;
}

const SYNC_TARGETS: Record<SyncTarget, SyncTargetConfig> = {
  'claude-code': {
    skillsDir: '.claude/skills',
    mcpConfigFile: '.mcp.json',
    format: 'markdown',
  },
  'cursor': {
    skillsDir: '.cursor/rules',
    mcpConfigFile: '.cursor/mcp.json',
    format: 'markdown',
    // .cursorrules is for global rules
  },
  'codex': {
    skillsDir: '',  // Uses AGENTS.md
    singleFile: true,
    format: 'markdown',
    // Combines all skills into AGENTS.md
  },
  'copilot': {
    skillsDir: '.github',
    singleFile: true,
    format: 'markdown',
    // Uses .github/copilot-instructions.md
  },
  'windsurf': {
    skillsDir: '.windsurf/rules',
    mcpConfigFile: '.windsurf/mcp.json',
    format: 'markdown',
  },
};

class Syncer {
  // Sync all skills to specified target
  async syncToTarget(
    projectPath: string,
    target: SyncTarget,
    skills: Map<string, string>  // name -> content
  ): Promise<SyncResult>;

  // Sync to all enabled targets
  async syncAll(projectPath: string): Promise<Map<SyncTarget, SyncResult>>;

  // Convert SKILL.md format for target
  transformForTarget(content: string, target: SyncTarget): string;

  // Sync MCP config to target
  async syncMcpConfig(
    projectPath: string,
    target: SyncTarget,
    mcpConfig: Record<string, McpConfig>
  ): Promise<void>;
}

interface SyncResult {
  success: boolean;
  skillsSynced: string[];
  errors: string[];
}
```

### 2.5 Installer (Updated)

**Responsibility:** Install skills with dependency resolution

```typescript
// packages/core/src/installer/installer.ts

interface InstallOptions {
  scope: 'local' | 'global';
  skipDependencies?: boolean;
  force?: boolean;
}

interface InstallResult {
  success: boolean;
  installed: string[];
  mcpRequired: string[];
  errors: string[];
}

class Installer {
  constructor(
    private configManager: ConfigManager,
    private stateManager: StateManager,
    private resolver: DependencyResolver,
    private syncer: Syncer
  ) {}

  // Install skill with dependencies
  async install(
    projectPath: string,
    source: string,
    options: InstallOptions
  ): Promise<InstallResult>;

  // Uninstall skill (check dependents)
  async uninstall(
    projectPath: string,
    name: string,
    options: { force?: boolean }
  ): Promise<UninstallResult>;

  // Install all skills from skillpkg.json
  async installFromConfig(projectPath: string): Promise<InstallResult>;

  // Prompt for MCP installation
  async promptMcpInstall(mcpName: string, config: McpConfig): Promise<boolean>;
}

interface UninstallResult {
  success: boolean;
  removed: string[];
  warnings: string[];
}
```

## 3. File Structure

### 3.1 Project Structure
```
project/
├── skillpkg.json           # Project config (user-editable)
├── .skillpkg/
│   ├── skills/             # Installed skills (internal)
│   │   ├── evolve/
│   │   │   └── SKILL.md
│   │   └── git-helper/
│   │       └── SKILL.md
│   ├── cache/              # Download cache
│   └── state.json          # Installation state (auto-generated)
├── .claude/
│   └── skills/             # Synced for Claude Code
├── .cursor/
│   └── rules/              # Synced for Cursor
└── AGENTS.md               # Synced for Codex
```

### 3.2 skillpkg.json Schema
```json
{
  "$schema": "https://skillpkg.dev/schemas/skillpkg.json",
  "name": "string (required)",
  "version": "string (semver)",
  "skills": {
    "skill-name": "source-string"
  },
  "mcp": {
    "mcp-name": {
      "package": "string (required)",
      "required": "boolean",
      "command": "string",
      "args": ["array", "of", "strings"],
      "env": { "KEY": "value" }
    }
  },
  "reminders": ["array", "of", "strings"],
  "hooks": {
    "hook-name": "script-path"
  },
  "sync_targets": {
    "claude-code": "boolean",
    "cursor": "boolean",
    "codex": "boolean",
    "copilot": "boolean",
    "windsurf": "boolean"
  }
}
```

### 3.3 state.json Schema
```json
{
  "$schema": "skillpkg-state-v1",
  "skills": {
    "skill-name": {
      "version": "string",
      "source": "string",
      "installed_by": "user | skill-name",
      "installed_at": "ISO-8601",
      "depended_by": ["array"]
    }
  },
  "mcp": {
    "mcp-name": {
      "package": "string",
      "installed_by_skill": "string | null",
      "installed_at": "ISO-8601"
    }
  },
  "sync_history": {
    "target": "ISO-8601"
  }
}
```

## 4. Workflow Diagrams

### 4.1 Install Flow
```
skillpkg install github:user/skill
         │
         ▼
┌─────────────────────┐
│  Fetch skill.yaml   │
│  or SKILL.md        │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Parse metadata     │
│  Extract deps       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Resolve deps       │◄──────────────────┐
│  (recursive)        │                   │
└──────────┬──────────┘                   │
           ▼                              │
┌─────────────────────┐                   │
│  Already installed? │───Yes────────────►│
└──────────┬──────────┘                   │
           │No                            │
           ▼                              │
┌─────────────────────┐                   │
│  Install to         │                   │
│  .skillpkg/skills/  │                   │
└──────────┬──────────┘                   │
           ▼                              │
┌─────────────────────┐                   │
│  MCP deps?          │───Yes───┐         │
└──────────┬──────────┘         │         │
           │No                  ▼         │
           │         ┌─────────────────┐  │
           │         │ Prompt install  │  │
           │         │ MCP server      │  │
           │         └────────┬────────┘  │
           │                  ▼           │
           │         ┌─────────────────┐  │
           │         │ Update .mcp.json│  │
           │         └────────┬────────┘  │
           │                  │           │
           ▼◄─────────────────┘           │
┌─────────────────────┐                   │
│  Update state.json  │                   │
│  (installed_by,     │                   │
│   depended_by)      │                   │
└──────────┬──────────┘                   │
           ▼                              │
┌─────────────────────┐                   │
│  Skill deps?        │───Yes─────────────┘
└──────────┬──────────┘
           │No
           ▼
┌─────────────────────┐
│  Update             │
│  skillpkg.json      │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Prompt: sync now?  │
└─────────────────────┘
```

### 4.2 Sync Flow
```
skillpkg sync [target]
         │
         ▼
┌─────────────────────┐
│  Load skillpkg.json │
│  Load state.json    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Get sync targets   │
│  (enabled in config)│
└──────────┬──────────┘
           ▼
    ┌──────┴──────┐
    ▼             ▼
claude-code    cursor    ...
    │             │
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Copy    │  │ Copy    │
│ skills  │  │ skills  │
│ to dir  │  │ to dir  │
└────┬────┘  └────┬────┘
     │            │
     ▼            ▼
┌─────────┐  ┌─────────┐
│ Convert │  │ Convert │
│ format  │  │ format  │
│ if need │  │ if need │
└────┬────┘  └────┬────┘
     │            │
     ▼            ▼
┌─────────┐  ┌─────────┐
│ Sync    │  │ Sync    │
│.mcp.json│  │.mcp.json│
└────┬────┘  └────┬────┘
     │            │
     └──────┬─────┘
            ▼
┌─────────────────────┐
│  Update sync_history│
│  in state.json      │
└─────────────────────┘
```

### 4.3 Uninstall Flow
```
skillpkg uninstall <name>
         │
         ▼
┌─────────────────────┐
│  Load state.json    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Check dependents   │
│  (who needs this?)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Has dependents?    │───Yes───┐
└──────────┬──────────┘         │
           │No                  ▼
           │         ┌─────────────────┐
           │         │ Show dependents │
           │         │ Confirm force?  │
           │         └────────┬────────┘
           │                  │
           │         ┌────────┴────────┐
           │         │No              Yes
           │         ▼                 │
           │    ┌─────────┐            │
           │    │ Abort   │            │
           │    └─────────┘            │
           │                           │
           ▼◄──────────────────────────┘
┌─────────────────────┐
│  Remove from        │
│  .skillpkg/skills/  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Remove from        │
│  sync targets       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Find orphan deps   │
│  (no longer needed) │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Prompt: remove     │
│  orphan deps?       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Update state.json  │
│  Update skillpkg.json│
└─────────────────────┘
```

## 5. Format Conversion

### 5.1 SKILL.md to Different Targets

**Claude Code:** Direct copy (native format)
```
.claude/skills/evolve/SKILL.md
```

**Cursor:** Copy to rules directory
```
.cursor/rules/evolve.md
```

**Codex:** Combine into single AGENTS.md
```markdown
# AGENTS.md

<!-- Auto-generated by skillpkg. Do not edit manually. -->

## evolve

[content from evolve/SKILL.md]

---

## git-helper

[content from git-helper/SKILL.md]
```

**Copilot:** Combine into copilot-instructions.md
```markdown
# Copilot Instructions

<!-- Auto-generated by skillpkg. Do not edit manually. -->

## Skills

### evolve
[content]

### git-helper
[content]
```

### 5.2 MCP Config Sync

**Claude Code / Cursor:** .mcp.json format
```json
{
  "mcpServers": {
    "cipher": {
      "command": "cipher",
      "args": ["--mode", "mcp"]
    }
  }
}
```

## 6. Error Handling

### 6.1 Error Types
```typescript
class SkillpkgError extends Error {
  code: ErrorCode;
  details?: unknown;
}

enum ErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  UNINSTALL_HAS_DEPENDENTS = 'UNINSTALL_HAS_DEPENDENTS',
  SYNC_FAILED = 'SYNC_FAILED',
  MCP_INSTALL_FAILED = 'MCP_INSTALL_FAILED',
  INVALID_SKILL_FORMAT = 'INVALID_SKILL_FORMAT',
}
```

### 6.2 Rollback on Failure

On partial install failure:
1. Remove partially installed skill
2. Remove any installed dependencies
3. Restore previous state.json
4. Report what was rolled back

## 7. Migration from v1.x

### 7.1 Automatic Migration
- Detect existing .skillpkg/skills/ without skillpkg.json
- Generate skillpkg.json from installed skills
- Generate state.json from skill metadata

### 7.2 Manual Migration
```bash
skillpkg migrate  # Interactive migration wizard
```

## 8. Testing Strategy

### 8.1 Unit Tests
- ConfigManager: read/write operations
- StateManager: state updates, dependency tracking
- DependencyResolver: resolution, circular detection
- Syncer: format conversion, file operations

### 8.2 Integration Tests
- Full install flow with dependencies
- Sync to multiple targets
- Uninstall with dependency cleanup

### 8.3 E2E Tests
- CLI commands
- MCP server tools
