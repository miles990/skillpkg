# skillpkg

> **Agent Skills Package Manager** — Install once, use everywhere.

[![npm version](https://img.shields.io/npm/v/skillpkg-cli.svg)](https://www.npmjs.com/package/skillpkg-cli)
[![npm version](https://img.shields.io/npm/v/skillpkg-mcp-server.svg)](https://www.npmjs.com/package/skillpkg-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Standard-blue)](https://agentskills.io)

The package manager for AI agent skills. Works with **Claude Code**, **OpenAI Codex**, **GitHub Copilot**, **Cursor**, and any platform that adopts the [Agent Skills open standard](https://agentskills.io).

English | [繁體中文](./README-zh.md)

## The Problem

```
😫 "I have to copy the same skill files to every project"
😫 "My team uses different AI coding tools, skills aren't portable"
😫 "I want AI to learn new skills on-the-fly, but there's no standard way"
😫 "Managing skill dependencies manually is a nightmare"
```

## The Solution

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   skillpkg = npm for AI Agent Skills                            │
│                                                                 │
│   ┌─────────────┐                      ┌─────────────────────┐  │
│   │  SKILL.md   │                      │  Claude Code        │  │
│   │  (GitHub)   │ ───► skillpkg ───►   │  OpenAI Codex       │  │
│   │  (Gist)     │      install         │  GitHub Copilot     │  │
│   │  (URL)      │      & sync          │  Cursor             │  │
│   └─────────────┘                      └─────────────────────┘  │
│                                                                 │
│   One skill. All platforms. Zero friction.                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why skillpkg?

| Without skillpkg | With skillpkg |
|------------------|---------------|
| Copy skills manually to each project | `skillpkg install` once |
| Skills only work on one platform | Sync to Claude, Codex, Copilot, Cursor |
| No dependency management | Automatic skill & MCP dependency resolution |
| AI can't learn new skills | MCP Server enables AI self-learning |
| No standard format | Industry-standard SKILL.md format |

## Supported Platforms

skillpkg implements the [Agent Skills open standard](https://agentskills.io) and supports all official adopters:

| Platform | Output Path | Status |
|----------|-------------|--------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `.claude/skills/` | ✅ Supported |
| [OpenAI Codex](https://openai.com/index/introducing-codex/) | `.codex/skills/` | ✅ Supported |
| [GitHub Copilot](https://github.com/features/copilot) | `.github/skills/` | ✅ Supported |
| [Cursor](https://cursor.com) | `.cursor/skills/` | ✅ Supported |

## Quick Start

### Install CLI

```bash
npm install -g skillpkg-cli
```

### Search for Skills

```bash
# Search across GitHub, awesome-lists, and local skills
skillpkg search "git commit"

# Example output:
# Found 8 skills:
#   commit-helper  ⭐120  github:anthropics/commit-helper
#   git-expert     ⭐85   github:user/git-skills#expert
```

### Install a Skill

```bash
# From GitHub
skillpkg install anthropics/commit-helper

# From subdirectory
skillpkg install github:user/repo#skills/my-skill

# Install globally (available in all projects)
skillpkg install -g anthropics/commit-helper
```

### Sync to All Platforms

```bash
# Sync installed skills to all detected AI platforms
skillpkg sync

# Sync to specific platforms
skillpkg sync --target claude-code,codex,copilot,cursor
```

## Features

- **Multi-source search** — Search GitHub, awesome-lists, and local skills
- **Cross-platform sync** — One skill works on Claude, Codex, Copilot, Cursor
- **Full directory support** — Skills with scripts, templates, resources fully supported
- **Dependency management** — Automatic skill & MCP server dependency resolution
- **Subpath installation** — Install from repo subdirectories: `user/repo#path/to/skill`
- **Project configuration** — `skillpkg.json` for reproducible team setups
- **MCP Server** — Enable AI agents to install and manage skills autonomously
- **Open standard** — Based on [Agent Skills specification](https://agentskills.io)

## CLI Commands

| Command | Description |
|---------|-------------|
| `skillpkg init` | Initialize project with `skillpkg.json` |
| `skillpkg new [name]` | Create a new skill (SKILL.md) |
| `skillpkg install [source]` | Install skill with dependency resolution |
| `skillpkg uninstall <skill>` | Remove a skill (checks dependencies) |
| `skillpkg list` | List installed skills |
| `skillpkg sync [skill]` | Sync skills to AI platforms |
| `skillpkg search <query>` | Search for skills |
| `skillpkg info <skill>` | Get skill details |
| `skillpkg status` | Show project status |

### Install Sources

```bash
# GitHub repository
skillpkg install user/repo
skillpkg install github:user/repo

# GitHub subdirectory
skillpkg install github:user/repo#skills/my-skill

# GitHub Gist
skillpkg install gist:abc123def

# Direct URL
skillpkg install https://example.com/SKILL.md

# Local path
skillpkg install ./my-local-skill
```

### Install Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install to global store (available in all projects) |
| `--dry-run` | Preview installation without making changes |
| `--essential-only` | Install only SKILL.md without additional files (scripts, templates) |

The `--essential-only` option is useful when you only need the core skill instructions without auxiliary files like scripts, templates, or examples. This reduces the installed size and keeps your skills directory lean.

## MCP Server — AI Self-Learning

Enable AI agents to search, install, and manage skills via [Model Context Protocol](https://modelcontextprotocol.io/).

### Setup for Claude Code

```bash
claude mcp add skillpkg -- npx -y skillpkg-mcp-server
```

### Setup for Claude Desktop

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

### How AI Self-Learning Works

```
User: Help me write better git commits

Claude: I'll search for a relevant skill...
        → search_skills("git commit helper")

        Found "commit-helper" - Installing...
        → install_skill("anthropics/commit-helper")

        Loading skill instructions...
        → load_skill("commit-helper")

        Now I can help you write conventional commits!
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Search for skills across sources |
| `recommend_skill` | Get AI-powered skill recommendations |
| `install_skill` | Install with dependency resolution |
| `load_skill` | Load skill instructions |
| `sync_skills` | Sync to AI platforms |
| `list_skills` | List installed skills |
| `create_skill` | Create new SKILL.md |

## SKILL.md Format

The [Agent Skills open standard](https://agentskills.io) uses SKILL.md — Markdown with YAML frontmatter:

```markdown
---
name: my-skill
version: 1.0.0
description: A helpful skill for X
dependencies:
  skills:
    - github:some/other-skill
  mcp:
    - package: "@some/mcp-server"
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

### Skill Directory Structure

Skills can include additional files:

```
my-skill/
├── SKILL.md              # Required: skill definition
├── scripts/
│   └── helper.py         # Python scripts
├── templates/
│   └── component.tsx     # Template files
└── examples/
    └── usage.md          # Examples
```

## Project Configuration

Create `skillpkg.json` for team-wide skill management:

```json
{
  "name": "my-project",
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
    "claude-code": true,
    "codex": true,
    "copilot": true,
    "cursor": true
  }
}
```

Then run `skillpkg install` to set up the entire team.

## Packages

| Package | Description |
|---------|-------------|
| [skillpkg-cli](https://www.npmjs.com/package/skillpkg-cli) | Command-line interface |
| [skillpkg-mcp-server](https://www.npmjs.com/package/skillpkg-mcp-server) | MCP Server for AI agents |
| [skillpkg-core](https://www.npmjs.com/package/skillpkg-core) | Core library (for integrations) |

## Use Cases

### For Individual Developers

```bash
# Install your favorite skills globally
skillpkg install -g anthropics/commit-helper
skillpkg install -g my-org/code-reviewer

# They're now available in every project
```

### For Teams

```bash
# Share skillpkg.json in your repo
git add skillpkg.json
git commit -m "Add team AI skills"

# New team members just run:
skillpkg install
```

### For AI Tool Builders

```bash
# Create skills that work everywhere
skillpkg new my-awesome-skill

# Publish to GitHub, users install with:
skillpkg install your-org/my-awesome-skill
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token (higher rate limits) |
| `SKILLPKG_HOME` | Custom global storage path |

## Development

```bash
git clone https://github.com/miles990/skillpkg.git
cd skillpkg
pnpm install
pnpm build
pnpm test  # 246 tests
```

## Related Projects

- [Agent Skills Specification](https://agentskills.io) — The open standard
- [awesome-claude-skills](https://github.com/anthropics/awesome-claude-skills) — Curated skill list
- [Model Context Protocol](https://modelcontextprotocol.io/) — AI tool integration

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License — see [LICENSE](LICENSE).

---

**Keywords**: AI agent skills, Claude Code skills, OpenAI Codex skills, GitHub Copilot skills, Cursor skills, SKILL.md, AI coding assistant, LLM skills, agent skills package manager, AI skill management, cross-platform AI skills

Made with AI, for AI.
