# Migration Guide: skillpkg v1.x → v2.0

This guide helps you migrate from skillpkg v1.x to v2.0.

## What's New in v2.0

### 1. Project Configuration (`skillpkg.json`)
v2.0 introduces a project-level configuration file, similar to `package.json`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "skills": {
    "commit-helper": "github:anthropics/commit-helper",
    "code-reviewer": "github:my-org/code-reviewer"
  },
  "mcp": {
    "context7": {
      "package": "@context7/mcp-server"
    }
  },
  "sync_targets": {
    "claude-code": true
  }
}
```

### 2. Dependency Resolution
Skills can now declare dependencies on other skills or MCP servers:

```yaml
# SKILL.md frontmatter
---
name: my-skill
version: 1.0.0
dependencies:
  skills:
    - name: base-helper
      source: github:user/base-helper
  mcp:
    - name: context7
      package: "@context7/mcp-server"
---
```

### 3. State Tracking (`state.json`)
v2.0 tracks installation state in `.skillpkg/state.json`:
- Which skills are installed
- Who installed each skill (user or dependency)
- Dependency relationships (depended_by)
- Sync history

### 4. New CLI Commands

| Command | Description |
|---------|-------------|
| `skillpkg init` | Initialize a project with skillpkg.json |
| `skillpkg sync` | Sync skills to AI platforms |
| `skillpkg status` | Show project status |
| `skillpkg deps <skill>` | Show dependencies |
| `skillpkg why <skill>` | Show why a skill is installed |
| `skillpkg tree` | Show dependency tree |
| `skillpkg migrate` | Migrate from v1.x to v2.0 |

## Migration Steps

### Automatic Migration

The easiest way to migrate is using the `migrate` command:

```bash
# Preview what will be migrated
skillpkg migrate --dry-run

# Run the migration
skillpkg migrate

# If you have existing v2.0 files, use --force to overwrite
skillpkg migrate --force
```

This command will:
1. Scan your existing `.skillpkg/` directory
2. Generate `skillpkg.json` with your installed skills
3. Generate `.skillpkg/state.json` with installation state

### Manual Migration

If you prefer manual migration:

#### Step 1: Create `skillpkg.json`

```bash
skillpkg init
```

Or create manually:

```json
{
  "name": "your-project-name",
  "version": "1.0.0",
  "skills": {},
  "sync_targets": {
    "claude-code": true
  }
}
```

#### Step 2: Add Your Skills

For each skill in `.skillpkg/skills/`, add an entry:

```json
{
  "skills": {
    "my-skill": "github:owner/repo",
    "local-skill": "local:.skillpkg/skills/local-skill"
  }
}
```

#### Step 3: Run Install

This will generate `state.json` and resolve dependencies:

```bash
skillpkg install
```

## Breaking Changes

### 1. Store Structure

**v1.x:**
```
.skillpkg/
├── registry.json     # Simple skill list
└── skills/
    └── my-skill/
        └── skill.yaml
```

**v2.0:**
```
.skillpkg/
├── state.json        # Dependency state (replaces registry.json)
└── skills/
    └── my-skill/
        └── skill.yaml

skillpkg.json          # Project config (new, at project root)
```

### 2. Install Command

**v1.x:**
```bash
skillpkg install my-skill    # Just installs the skill
```

**v2.0:**
```bash
skillpkg install my-skill    # Installs skill + dependencies
skillpkg install             # Installs all skills from skillpkg.json
```

### 3. Uninstall Command

**v1.x:**
```bash
skillpkg uninstall my-skill  # Always removes
```

**v2.0:**
```bash
skillpkg uninstall my-skill  # Warns if other skills depend on it
skillpkg uninstall my-skill --force  # Force remove even with dependents
```

### 4. List Command

**v1.x:**
```bash
skillpkg list
# my-skill  1.0.0
```

**v2.0:**
```bash
skillpkg list
# my-skill  1.0.0  [user]           # Shows who installed
# dep-skill 1.0.0  [my-skill]       # Shows it's a dependency
```

## Sync to AI Platforms

v2.0 introduces automatic syncing to AI platform directories:

```bash
# Sync all skills to all configured targets
skillpkg sync

# Sync specific skill
skillpkg sync my-skill

# Sync to specific platform
skillpkg sync --target claude-code

# Preview without changes
skillpkg sync --dry-run
```

### Configure Sync Targets

In `skillpkg.json`:

```json
{
  "sync_targets": {
    "claude-code": true,
    "codex": false,
    "cursor": false
  }
}
```

Currently implemented:
- `claude-code` → `.claude/skills/`

Reserved for future:
- `codex` → `.codex/skills/`
- `cursor` → `.cursor/skills/`
- `copilot` → `.github/copilot/skills/`
- `windsurf` → `.windsurf/skills/`

## MCP Server Updates

The MCP server now includes:

### Updated Tools
- `install_skill` - Now returns dependency info and MCP requirements
- `uninstall_skill` - Checks dependents before removal, supports `force`

### New Tool
- `sync_skills` - Sync installed skills to AI platforms

```json
// Example: Using sync_skills
{
  "scope": "local",
  "target": "claude-code",
  "dryRun": false
}
```

## Troubleshooting

### Migration fails with "Store is not properly initialized"

Your v1.x installation may be incomplete. Try:
```bash
# Check if .skillpkg exists
ls -la .skillpkg/

# If empty or missing, start fresh
skillpkg init
```

### Dependency conflicts

If you see circular dependency errors:
```bash
# Check the dependency tree
skillpkg tree

# Remove problematic skill
skillpkg uninstall problematic-skill --force
```

### Sync not working

Ensure your target is configured:
```json
// skillpkg.json
{
  "sync_targets": {
    "claude-code": true
  }
}
```

Then run:
```bash
skillpkg sync --dry-run  # Check what would be synced
skillpkg sync            # Actually sync
```

## Getting Help

- Report issues: https://github.com/miles990/skillpkg/issues
- Documentation: https://github.com/miles990/skillpkg#readme
