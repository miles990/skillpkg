# Requirements Document: skillpkg v2.0

## Introduction

skillpkg v2.0 transforms from a "skill marketplace" into a **Project AI Workflow Manager** - essentially a `package.json` for AI workflows. It provides a unified configuration file (`skillpkg.json`) to define project skills, MCP dependencies, and sync settings across multiple AI coding tools (Claude Code, Cursor, Codex, Copilot, Windsurf).

**Problem Statement:**
- AI coding assistants have different config locations and formats
- Skills may depend on other skills or MCP servers (no dependency management)
- No cross-tool compatibility - skills work in one tool but not another
- No state tracking - unclear what's installed or why

**Value Proposition:**
- Define once in `skillpkg.json`, sync to all tools
- Automatic dependency resolution (skill→skill, skill→MCP)
- State tracking for installation history
- Team-shareable configuration

## Alignment with Product Vision

skillpkg aims to be the standard package manager for AI agent skills. v2.0 focuses on:
- **Project-centric workflow**: Skills defined per-project, not globally
- **Cross-tool compatibility**: One config works across all AI tools
- **Dependency management**: Like npm for skills

## Requirements

### Requirement 1: Project Configuration (skillpkg.json)

**User Story:** As a developer, I want a single configuration file to define my project's AI skills, so that I can version control and share my AI workflow setup.

#### Acceptance Criteria

1. WHEN user runs `skillpkg init` THEN system SHALL create a `skillpkg.json` file with project name and empty skills/mcp sections
2. WHEN `skillpkg.json` exists THEN system SHALL read skills, mcp, reminders, and sync_targets from it
3. IF skill is installed THEN system SHALL update `skillpkg.json` with the skill source
4. WHEN user edits `skillpkg.json` manually THEN system SHALL validate the format on next command

### Requirement 2: Dependency Resolution

**User Story:** As a developer, I want skills to automatically install their dependencies, so that I don't have to manually track what each skill needs.

#### Acceptance Criteria

1. WHEN skill has `dependencies.skills` in metadata THEN system SHALL resolve and install those skills first
2. WHEN skill has `dependencies.mcp` in metadata THEN system SHALL prompt user to install required MCP servers
3. IF circular dependency is detected THEN system SHALL abort and show error message
4. WHEN dependency is installed THEN system SHALL record `installed_by` in state.json

### Requirement 3: Sync Mechanism

**User Story:** As a developer, I want to sync my skills to Claude Code with one command, so that my skills are available in Claude Code sessions.

> **v2.0 Scope:** 僅支援 Claude Code，其他工具未來版本再擴展

#### Acceptance Criteria

1. WHEN user runs `skillpkg sync` THEN system SHALL copy skills to all enabled targets in `sync_targets`
2. WHEN syncing to Claude Code THEN system SHALL copy SKILL.md files to `.claude/skills/{name}/SKILL.md`
3. IF target has MCP config file THEN system SHALL update it with MCP configurations

> **v2.0 實作範圍:** 僅實作 claude-code target，其他 targets 架構預留但不實作

### Requirement 4: State Tracking

**User Story:** As a developer, I want to see what skills are installed and why, so that I can manage my project's AI dependencies.

#### Acceptance Criteria

1. WHEN skill is installed THEN system SHALL record in `state.json`: version, source, installed_by, installed_at, depended_by
2. WHEN querying dependents THEN system SHALL return list of skills that depend on the queried skill
3. WHEN uninstalling skill with dependents THEN system SHALL warn user and require confirmation
4. WHEN skill is uninstalled THEN system SHALL update depended_by of its dependencies

### Requirement 5: Uninstall with Dependency Check

**User Story:** As a developer, I want to safely uninstall skills without breaking dependencies, so that I don't accidentally break other skills.

#### Acceptance Criteria

1. WHEN user runs `skillpkg uninstall <name>` THEN system SHALL check if other skills depend on it
2. IF skill has dependents THEN system SHALL show warning with list of dependents
3. WHEN `--force` flag is provided THEN system SHALL uninstall regardless of dependents
4. WHEN skill is uninstalled THEN system SHALL identify orphan dependencies and offer to remove them

### Requirement 6: CLI Commands

**User Story:** As a developer, I want intuitive CLI commands to manage my project's AI workflow, so that I can quickly install, sync, and check status.

#### Acceptance Criteria

1. WHEN user runs `skillpkg init` THEN system SHALL interactively create skillpkg.json
2. WHEN user runs `skillpkg install <source>` THEN system SHALL install skill with dependencies
3. WHEN user runs `skillpkg sync [target]` THEN system SHALL sync to specified or all enabled targets
4. WHEN user runs `skillpkg status` THEN system SHALL show installed skills, MCP, and sync status
5. WHEN user runs `skillpkg deps <name>` THEN system SHALL show skill's dependencies
6. WHEN user runs `skillpkg why <name>` THEN system SHALL show who depends on this skill

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: ConfigManager, StateManager, DependencyResolver, Syncer as separate modules
- **Modular Design**: Core library separate from CLI and MCP server
- **Dependency Management**: Minimal external dependencies
- **Clear Interfaces**: TypeScript interfaces for all data structures

### Performance
- Install single skill: < 5 seconds
- Sync to all targets: < 2 seconds
- State read: < 100ms

### Cross-Platform Compatibility
- Support macOS, Linux, Windows
- No symlinks (use file copy for cross-platform)
- Handle path differences between platforms

### Backward Compatibility
- v1.x skills work in v2.x
- skill.yaml format still supported
- SKILL.md format preferred

### Error Handling
- Clear error messages for missing dependencies
- Prompt before overwriting existing files
- Rollback on partial failure
