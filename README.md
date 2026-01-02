# skillpkg

> **Agent Skills Package Manager** — Install once, use everywhere.

[![npm version](https://img.shields.io/npm/v/skillpkg-cli.svg)](https://www.npmjs.com/package/skillpkg-cli)
[![npm version](https://img.shields.io/npm/v/skillpkg-mcp-server.svg)](https://www.npmjs.com/package/skillpkg-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Manage, share, and sync AI agent skills across platforms. Works with **Claude Code**, **OpenAI Codex**, **GitHub Copilot**, and more.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   skillpkg = npm for AI Agent Skills                            │
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │  SKILL.md   │ ──► │   skillpkg  │ ──► │  Claude     │      │
│   │  (GitHub)   │     │   (管理器)   │     │  Codex      │      │
│   └─────────────┘     └─────────────┘     │  Copilot    │      │
│                                           └─────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Search skills on GitHub** — Find skills with `SKILL.md` files (industry standard)
- **Cross-platform sync** — One skill, multiple AI platforms
- **MCP Server** — Let AI agents install skills themselves
- **CLI & API** — Flexible integration options

## Quick Start

### Install CLI

```bash
npm install -g skillpkg-cli
```

### Search for Skills

```bash
# Search for skills on GitHub
skillpkg search "git commit"

# Example output:
# commit-helper ✓ SKILL.md ⭐1.2K
#   anthropics/claude-code-skills
#   AI-powered git commit message generator
```

### Install a Skill

```bash
# From GitHub (recommended)
skillpkg install github:anthropics/claude-code-skills

# Shorthand format
skillpkg install anthropics/claude-code-skills

# From local directory
skillpkg install ./my-skill

# Install globally
skillpkg install -g anthropics/claude-code-skills
```

### List Installed Skills

```bash
skillpkg list
skillpkg list -g  # global skills
```

### Sync to AI Platforms

```bash
# Sync all skills to detected platforms
skillpkg sync

# Sync specific skill to specific platforms
skillpkg sync my-skill --target claude-code,codex
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `skillpkg search <query>` | Search for skills on GitHub |
| `skillpkg install <source>` | Install a skill from GitHub, URL, or local path |
| `skillpkg list` | List installed skills |
| `skillpkg uninstall <skill>` | Remove an installed skill |
| `skillpkg sync [skill]` | Sync skills to AI platforms |
| `skillpkg import [path]` | Import existing skills from platform formats |
| `skillpkg export [skill]` | Export skills to various formats |
| `skillpkg init` | Create a new skill.yaml |
| `skillpkg info <skill>` | Get detailed skill information |

### Install Sources

```bash
# GitHub repository
skillpkg install github:user/repo
skillpkg install user/repo

# GitHub Gist
skillpkg install gist:abc123

# Direct URL
skillpkg install https://example.com/skill.yaml

# Local path
skillpkg install ./path/to/skill
skillpkg install /absolute/path/to/skill
```

## MCP Server

Enable AI agents (like Claude) to search, install, and manage skills via [Model Context Protocol](https://modelcontextprotocol.io/).

### Install

```bash
npm install -g skillpkg-mcp-server
```

### Configure for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skillpkg": {
      "command": "npx",
      "args": ["-y", "skillpkg-mcp-server"]
    }
  }
}
```

### Configure for Claude Code

```bash
claude mcp add skillpkg -- npx -y skillpkg-mcp-server
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_skills` | List installed skills |
| `search_skills` | Search for skills on GitHub |
| `recommend_skill` | Get skill recommendations for a use case |
| `install_skill` | Install a skill from various sources |
| `uninstall_skill` | Remove an installed skill |
| `load_skill` | Load a skill's instructions |
| `skill_info` | Get detailed information about a registry skill |

### Example: AI Self-Learning

```
User: Help me write better git commits

Claude: I'll search for a relevant skill...
        [Uses search_skills: "git commit helper"]

        Found "commit-helper" - Installing...
        [Uses install_skill: "anthropics/commit-helper"]

        Loading skill instructions...
        [Uses load_skill: "commit-helper"]

        Now I can help you write better commits!
```

## SKILL.md Format

The industry standard format for AI agent skills, used by Claude Code and OpenAI Codex.

```markdown
---
name: my-skill
version: 1.0.0
description: A helpful skill for doing X
---

# My Skill

Instructions for the AI agent...

## When to Use

- Scenario A
- Scenario B

## How to Use

1. Step one
2. Step two
```

### Where to Place SKILL.md

skillpkg searches these locations in order:

1. `SKILL.md` (root)
2. `skill.md` (root)
3. `skills/SKILL.md`
4. `skills/skill.md`
5. `.claude/skills/skill.md`

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [skillpkg-cli](https://www.npmjs.com/package/skillpkg-cli) | 0.2.0 | Command-line interface |
| [skillpkg-mcp-server](https://www.npmjs.com/package/skillpkg-mcp-server) | 0.3.0 | MCP Server for AI agents |
| [skillpkg-core](https://www.npmjs.com/package/skillpkg-core) | 0.2.0 | Core library |

## Storage Locations

| Scope | Path |
|-------|------|
| Local (project) | `.skillpkg/` |
| Global (user) | `~/.skillpkg/` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token for higher rate limits |
| `SKILLPKG_HOME` | Custom global storage path |

## Development

```bash
# Clone the repository
git clone https://github.com/miles990/skillpkg.git
cd skillpkg

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with AI, for AI.
