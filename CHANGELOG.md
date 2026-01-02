# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-03

### Added

#### Project Configuration (`skillpkg.json`)
- New project-level configuration file for managing skills declaratively
- `skillpkg init` command to create a new project configuration
- `skillpkg install` (no args) installs all skills from `skillpkg.json`

#### Dependency Resolution
- Skills can now declare dependencies on other skills (`dependencies.skills`)
- Skills can declare MCP server requirements (`dependencies.mcp`)
- Automatic dependency resolution with topological sorting
- Circular dependency detection with clear error messages
- `skillpkg deps <skill>` - Show dependencies of a skill
- `skillpkg why <skill>` - Show why a skill is installed
- `skillpkg tree` - Show full dependency tree

#### State Management (`state.json`)
- Track installation state (who installed, version, source)
- Track dependency relationships (`depended_by`)
- Safe uninstall with dependency checking
- `--force` flag to force uninstall with dependents

#### Platform Sync
- `skillpkg sync` command to sync skills to AI platforms
- Incremental sync with content hash comparison
- Orphan cleanup (remove synced files for uninstalled skills)
- Support for claude-code target (`.claude/skills/`)
- Reserved targets for future: codex, cursor, copilot, windsurf

#### Migration
- `skillpkg migrate` command for v1.x to v2.0 migration
- Automatic generation of `skillpkg.json` and `state.json`
- `--dry-run` mode to preview migration

#### MCP Server
- `sync_skills` tool - Sync installed skills to AI platforms
- Updated `install_skill` - Returns dependency info and MCP requirements
- Updated `uninstall_skill` - Checks dependents, supports `force` parameter

### Changed

- `install` command now resolves and installs dependencies
- `uninstall` command now checks for dependents before removal
- `list` command shows who installed each skill (user/dependency)

## [0.2.1] - 2024-12-15

### Fixed

- Fixed skill.yaml parsing edge cases
- Improved error messages for invalid skill formats

## [0.2.0] - 2024-12-01

### Added

- Initial release with core functionality
- `install`, `uninstall`, `list` commands
- `search`, `info` commands for registry
- `import`, `export` commands
- `publish`, `login`, `logout` commands
- MCP Server with basic tools
- Support for SKILL.md and skill.yaml formats
