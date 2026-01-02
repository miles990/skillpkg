# skillpkg-mcp-server

MCP Server for skillpkg - Enable AI agents to search, install, and manage skills via Model Context Protocol.

## Features

- **8 MCP Tools** for complete skill lifecycle management
- **Multi-source installation** - Registry, GitHub, Gist, URL, Local
- **Smart recommendations** with relevance scoring
- **Graceful degradation** when registry unavailable

## Installation

```bash
npm install skillpkg-mcp-server
```

## Quick Start

### As standalone MCP server

```bash
npx skillpkg-mcp-server
```

### In claude_desktop_config.json

```json
{
  "mcpServers": {
    "skillpkg": {
      "command": "npx",
      "args": ["skillpkg-mcp-server"]
    }
  }
}
```

### Programmatic usage

```typescript
import { SkillpkgMcpServer, createAllToolHandlers } from 'skillpkg-mcp-server';

const server = new SkillpkgMcpServer({ scope: 'local' });
server.registerTools(createAllToolHandlers());
await server.start();
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_skills` | List all installed skills with metadata |
| `load_skill` | Load a skill's full content including instructions |
| `install_skill` | Install a skill from various sources |
| `uninstall_skill` | Remove an installed skill |
| `search_skills` | Search installed and registry skills |
| `search_registry` | Search the skill registry only |
| `skill_info` | Get detailed info about a skill |
| `recommend_skill` | Get AI-powered skill recommendations |

## Tool Details

### list_skills

Lists all installed skills from local and/or global scope.

```json
{
  "scope": "all" // "local" | "global" | "all"
}
```

### load_skill

Loads a skill's full instructions. Required for AI to use the skill.

```json
{
  "id": "local:commit-helper" // or just "commit-helper"
}
```

### install_skill

Installs a skill from multiple sources:

```json
{
  "source": "commit-helper",        // Registry
  "source": "github:user/repo",     // GitHub repo
  "source": "gist:abc123",          // GitHub Gist
  "source": "https://example.com/skill.yaml", // URL
  "source": "./my-skill",           // Local path
  "scope": "local"                  // "local" | "global"
}
```

### recommend_skill

Get smart recommendations based on your needs:

```json
{
  "query": "help me write better commit messages",
  "criteria": "auto" // "auto" | "popular" | "highest_rated" | "newest"
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AI Agent                        │
│              (Claude, etc.)                      │
└─────────────────┬───────────────────────────────┘
                  │ MCP Protocol (stdio)
┌─────────────────▼───────────────────────────────┐
│            SkillpkgMcpServer                     │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐   │
│  │            Tool Handlers                  │   │
│  ├──────────────────────────────────────────┤   │
│  │ search_skills  │ load_skill   │ install  │   │
│  │ list_skills    │ uninstall    │ info     │   │
│  │ search_registry│ recommend    │          │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│                 skillpkg-core                    │
│        (Store, Registry, Parser)                 │
└─────────────────────────────────────────────────┘
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Test
pnpm test
```

## License

MIT
