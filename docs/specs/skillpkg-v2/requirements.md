# skillpkg v2.0 - Requirements Specification

> Project AI Workflow Manager - package.json for AI workflows

## 1. Overview

### 1.1 Problem Statement

AI coding assistants (Claude Code, Cursor, Codex, Copilot, Windsurf) lack:
1. **Portable workflow definitions** - Each tool has different config locations
2. **Dependency management** - Skills depend on other skills or MCP servers
3. **Cross-tool compatibility** - No unified way to share skills across tools
4. **State tracking** - No record of what's installed or why

### 1.2 Solution

skillpkg v2.0 transforms from "skill marketplace" to **"Project AI Workflow Manager"**:
- `skillpkg.json` as the single source of truth (like package.json)
- Dependency resolution for skill-to-skill and skill-to-MCP relationships
- Sync mechanism to distribute skills to multiple AI tools
- State tracking for installation history and dependencies

### 1.3 Value Proposition

```
Before skillpkg v2.0:
- Manually copy skills to each tool's directory
- Forget which MCP servers a skill needs
- Skills work in Claude Code but not Cursor
- No way to share project's AI workflow config

After skillpkg v2.0:
- Define once in skillpkg.json
- Auto-install dependencies (skills + MCP)
- One command sync to all tools
- Share skillpkg.json like package.json
```

## 2. Core Requirements

### 2.1 skillpkg.json - Project Configuration

**Must Have:**
- `name`: Project identifier
- `skills`: Map of skill name to source (github:user/repo, url, local path)
- `mcp`: Map of MCP server name to install config
- `sync_targets`: Which tools to sync to (claude-code, cursor, codex, copilot, windsurf)

**Should Have:**
- `reminders`: Array of reminder strings (shown on session start)
- `hooks`: Map of hook name to script path
- `workflow`: Default workflow settings

**Example:**
```json
{
  "name": "omniflow-studio",
  "version": "1.0.0",
  "skills": {
    "evolve": "github:miles990/self-evolving-agent",
    "git-helper": "github:miles990/git-helper",
    "code-review": "local:./custom-skills/code-review"
  },
  "mcp": {
    "cipher": {
      "package": "@byterover/cipher",
      "required": true
    },
    "context7": {
      "package": "@context7/mcp",
      "required": false
    }
  },
  "reminders": [
    "New features must create specs/ first",
    "PDCA: Plan -> Do -> Check -> Act",
    "Commit after each Milestone"
  ],
  "sync_targets": {
    "claude-code": true,
    "cursor": true,
    "codex": false
  }
}
```

### 2.2 Dependency Management

**Skill Dependencies:**
- Skills can depend on other skills
- Declared in skill's metadata (SKILL.md frontmatter)
- Auto-installed when installing parent skill

**MCP Dependencies:**
- Skills can require MCP servers
- Declared in skill's metadata
- Auto-prompt for MCP installation

**Example skill with dependencies:**
```yaml
---
name: evolve
dependencies:
  skills:
    - skillpkg  # Depends on skillpkg skill
  mcp:
    - cipher    # Requires cipher MCP
---
```

### 2.3 Sync Mechanism

**Target Directories:**
| Tool | Skill Directory | Config File |
|------|-----------------|-------------|
| Claude Code | `.claude/skills/` | `.mcp.json` |
| Cursor | `.cursorrules` or `.cursor/rules/` | `.cursor/mcp.json` |
| Codex | `AGENTS.md` (single file) | - |
| Copilot | `.github/copilot-instructions.md` | - |
| Windsurf | `.windsurfrules` | `.windsurf/mcp.json` |

**Sync Command:**
```bash
skillpkg sync              # Sync to all enabled targets
skillpkg sync claude-code  # Sync to specific target
```

**Sync Behavior:**
- Copy SKILL.md files to target directories
- Convert format if needed (e.g., SKILL.md -> .cursorrules)
- Update .mcp.json with MCP dependencies

### 2.4 State Tracking (state.json)

**Track:**
- Installed skills (version, source, installed_by, depended_by)
- Installed MCP servers (package, installed_by_skill)
- Dependency graph
- Last sync timestamps

**Example:**
```json
{
  "$schema": "skillpkg-state-v1",
  "skills": {
    "evolve": {
      "version": "2.1.0",
      "source": "github:miles990/self-evolving-agent",
      "installed_by": "user",
      "installed_at": "2025-01-03T00:12:00Z",
      "depended_by": []
    },
    "skillpkg": {
      "version": "1.0.0",
      "source": "github:miles990/skillpkg-skill",
      "installed_by": "evolve",
      "installed_at": "2025-01-03T00:12:05Z",
      "depended_by": ["evolve"]
    }
  },
  "mcp": {
    "cipher": {
      "package": "@byterover/cipher",
      "installed_by_skill": "evolve",
      "installed_at": "2025-01-03T00:12:10Z"
    }
  },
  "sync_history": {
    "claude-code": "2025-01-03T00:15:00Z",
    "cursor": "2025-01-03T00:15:00Z"
  }
}
```

### 2.5 MCP Wrapper Skills

**Concept:**
Create "MCP wrapper skills" that instruct Claude to auto-install MCP servers.

**How it works:**
1. Skill contains MCP metadata and install instructions
2. When skill loads, Claude reads instructions
3. Claude checks if MCP is installed
4. If not, Claude prompts to install

**Example MCP Wrapper Skill:**
```markdown
---
name: mcp-cipher
description: Auto-installer for Cipher MCP
mcp_config:
  package: "@byterover/cipher"
  command: "cipher"
  args: ["--mode", "mcp"]
---

# MCP Cipher Installer

This skill ensures Cipher MCP is installed for memory functionality.

## Installation Check

Before using memory features, verify:
1. Run `npm list -g @byterover/cipher`
2. If not found, run `npm install -g @byterover/cipher`
3. Add to .mcp.json if not present

## .mcp.json Config
\`\`\`json
{
  "mcpServers": {
    "cipher": {
      "command": "cipher",
      "args": ["--mode", "mcp"]
    }
  }
}
\`\`\`
```

## 3. Commands

### 3.1 Core Commands

| Command | Description |
|---------|-------------|
| `skillpkg init` | Create skillpkg.json in current project |
| `skillpkg install <source>` | Install skill (and dependencies) |
| `skillpkg uninstall <name>` | Uninstall skill (check dependents first) |
| `skillpkg sync [target]` | Sync skills to AI tool directories |
| `skillpkg list` | List installed skills |
| `skillpkg status` | Show install status and sync state |

### 3.2 Dependency Commands

| Command | Description |
|---------|-------------|
| `skillpkg deps <name>` | Show dependencies of a skill |
| `skillpkg why <name>` | Show why a skill is installed (who depends on it) |
| `skillpkg tree` | Show full dependency tree |

### 3.3 MCP Commands

| Command | Description |
|---------|-------------|
| `skillpkg mcp list` | List MCP servers in project |
| `skillpkg mcp install <package>` | Install MCP server |
| `skillpkg mcp sync` | Sync MCP config to all targets |

## 4. Non-Functional Requirements

### 4.1 Cross-Platform
- macOS, Linux, Windows support
- No symlinks (use file copy)
- Handle path differences

### 4.2 Backward Compatibility
- v1.x skills work in v2.x
- skill.yaml format still supported
- SKILL.md format preferred

### 4.3 Performance
- Install: < 5 seconds for single skill
- Sync: < 2 seconds for all targets
- State read: < 100ms

### 4.4 Error Handling
- Clear error messages for missing dependencies
- Prompt before overwriting existing files
- Rollback on partial failure

## 5. Acceptance Criteria

### 5.1 Installation Flow
- [ ] User runs `skillpkg install github:user/skill`
- [ ] System resolves skill dependencies
- [ ] System prompts for MCP dependencies if needed
- [ ] System installs skill and dependencies
- [ ] System updates state.json
- [ ] System prompts to sync

### 5.2 Sync Flow
- [ ] User runs `skillpkg sync`
- [ ] System reads skillpkg.json
- [ ] System copies skills to enabled targets
- [ ] System converts format if needed
- [ ] System updates sync_history in state.json

### 5.3 Uninstall Flow
- [ ] User runs `skillpkg uninstall <name>`
- [ ] System checks for dependents
- [ ] If dependents exist, warn and confirm
- [ ] System removes skill
- [ ] System removes orphan dependencies
- [ ] System updates state.json

## 6. Out of Scope (v2.0)

- Cloud sync / team sharing
- Private skill registry
- Skill versioning and lockfile
- Auto-update mechanism
- GUI / web interface
