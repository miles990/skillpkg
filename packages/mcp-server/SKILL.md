---
name: mcp-setup
description: "Help users configure MCP (Model Context Protocol) servers for Claude Code and other AI platforms."
version: 0.4.0
---

# MCP Server Configuration

Help users install and configure MCP (Model Context Protocol) servers for AI platforms.

## Configuration File

MCP servers are configured in `~/.claude.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## Popular MCP Servers

### 1. skillpkg (Skills Manager)
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

Tools: `list_skills`, `install_skill`, `search_skills`, `load_skill`, `sync_skills`

### 2. Context7 (Documentation)
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    }
  }
}
```

Tools: `resolve-library-id`, `query-docs`

### 3. Filesystem
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/allowed/dir"]
    }
  }
}
```

### 4. GitHub
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 5. Brave Search
```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    }
  }
}
```

## Quick Setup Commands

```bash
# View current config
cat ~/.claude.json

# Edit config (macOS)
open -e ~/.claude.json

# Edit config (with VS Code)
code ~/.claude.json

# Validate JSON
cat ~/.claude.json | python3 -m json.tool
```

## Adding a New MCP Server

1. Find the package name (usually on npm or GitHub)
2. Add entry to `~/.claude.json` under `mcpServers`
3. Restart Claude Code to load the new server

## Common Issues

### Server Not Loading
- Check JSON syntax is valid
- Verify package name is correct
- Check if environment variables are set

### Permission Errors
- Ensure `~/.claude.json` is readable
- Check file permissions: `chmod 644 ~/.claude.json`

### Environment Variables
Use `${VAR_NAME}` syntax in config:
```json
{
  "env": {
    "API_KEY": "${MY_API_KEY}"
  }
}
```

Set in shell:
```bash
export MY_API_KEY="your-key"
```

## Full Example Config

```json
{
  "mcpServers": {
    "skillpkg": {
      "command": "npx",
      "args": ["-y", "skillpkg-mcp-server"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```
