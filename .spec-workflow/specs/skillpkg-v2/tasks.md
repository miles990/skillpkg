# Tasks Document: skillpkg v2.0

## Milestone 1: Config & State Management

- [ ] 1.1 Define skillpkg.json JSON Schema
  - File: packages/core/src/config/schemas/skillpkg.schema.json
  - Create JSON Schema for skillpkg.json validation
  - Include skills, mcp, reminders, hooks, sync_targets fields
  - Purpose: Enable IDE autocomplete and validation
  - _Leverage: packages/core/src/parser/schema.ts for reference_
  - _Requirements: 1_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Schema Designer specializing in JSON Schema | Task: Create comprehensive JSON Schema for skillpkg.json following Requirement 1, supporting IDE autocomplete and validation | Restrictions: Follow JSON Schema draft-07 standard, ensure backward compatibility | Success: Schema validates all valid configs, rejects invalid ones, provides helpful error messages | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (schema fields, validation rules), then mark as [x]_

- [ ] 1.2 Implement ConfigManager class
  - File: packages/core/src/config/config-manager.ts
  - Implement loadProjectConfig(), saveProjectConfig(), initProject()
  - Add addSkill(), removeSkill() helper methods
  - Purpose: Read/write skillpkg.json with validation
  - _Leverage: packages/core/src/parser/validator.ts_
  - _Requirements: 1_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer specializing in file I/O and validation | Task: Create ConfigManager class for skillpkg.json operations following Requirement 1 | Restrictions: Use ajv for validation, handle file not found gracefully | Success: Can read/write/validate skillpkg.json, proper error messages | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (class methods, interfaces), then mark as [x]_

- [ ] 1.3 Define state.json schema and StateManager class
  - File: packages/core/src/state/state-manager.ts
  - Track skills (version, source, installed_by, depended_by)
  - Track mcp (package, installed_by_skill)
  - Track sync_history per target
  - Purpose: Maintain installation state and dependency graph
  - _Leverage: None (new module)_
  - _Requirements: 4_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend Developer specializing in state management | Task: Create StateManager class for state.json following Requirement 4 | Restrictions: Atomic writes, handle concurrent access | Success: Can track/query skill states and dependencies | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (class methods, state schema), then mark as [x]_

- [ ] 1.4 Add getDependents() and canUninstall() to StateManager
  - File: packages/core/src/state/state-manager.ts (continue)
  - getDependents(skillName): Returns skills that depend on this skill
  - canUninstall(skillName): Check if safe to uninstall
  - Purpose: Support dependency-aware uninstall
  - _Leverage: packages/core/src/state/state-manager.ts_
  - _Requirements: 5_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend Developer with graph algorithms expertise | Task: Add dependency query methods following Requirement 5 | Restrictions: O(n) complexity max, handle circular refs | Success: Correctly identifies all dependents | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (methods added), then mark as [x]_

- [ ] 1.5 Write unit tests for ConfigManager and StateManager
  - File: packages/core/src/config/__tests__/config-manager.test.ts
  - File: packages/core/src/state/__tests__/state-manager.test.ts
  - Test read/write operations, validation, edge cases
  - Purpose: Ensure reliability of config/state management
  - _Leverage: vitest testing framework_
  - _Requirements: 1, 4_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer with TypeScript testing expertise | Task: Create comprehensive unit tests for ConfigManager and StateManager | Restrictions: Mock file system, test edge cases | Success: >80% coverage, all edge cases handled | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (test cases), then mark as [x]_

## Milestone 2: Dependency Resolution

- [ ] 2.1 Extend SKILL.md parser for dependencies field
  - File: packages/core/src/parser/schema.ts (modify)
  - Add dependencies: { skills?: string[], mcp?: string[] } to schema
  - Update parser to extract dependencies from frontmatter
  - Purpose: Support skill dependency declaration
  - _Leverage: packages/core/src/parser/parser.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Parser Developer | Task: Extend SKILL.md parser schema following Requirement 2 | Restrictions: Backward compatible, optional field | Success: Parses dependencies from existing and new skills | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (schema changes), then mark as [x]_

- [ ] 2.2 Create DependencyResolver class
  - File: packages/core/src/resolver/dependency-resolver.ts
  - Implement resolveDependencies(source, installed): Recursive resolution
  - Implement detectCircular(): Check for circular dependencies
  - Purpose: Resolve skill→skill and skill→MCP dependencies
  - _Leverage: packages/core/src/importer/importer.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Algorithm Developer specializing in graph traversal | Task: Create DependencyResolver with recursive resolution and circular detection following Requirement 2 | Restrictions: Handle transitive deps, detect cycles early | Success: Correctly resolves dependency tree, aborts on circular | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (class methods, algorithms), then mark as [x]_

- [ ] 2.3 Add MCP dependency checking
  - File: packages/core/src/resolver/dependency-resolver.ts (continue)
  - checkMcpDependencies(mcpNames): Check against .mcp.json
  - Return missing MCP list with install instructions
  - Purpose: Identify missing MCP servers
  - _Leverage: packages/core/src/resolver/dependency-resolver.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Integration Developer | Task: Add MCP dependency checking following Requirement 2 | Restrictions: Read .mcp.json, provide clear install instructions | Success: Correctly identifies missing MCPs | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (methods), then mark as [x]_

- [ ] 2.4 Create McpManager class with built-in registry
  - File: packages/core/src/mcp/mcp-manager.ts
  - Define MCP_REGISTRY with common MCPs (cipher, context7, filesystem, etc.)
  - Implement isInstalled(mcpName): Check if MCP is available
  - Implement getInstallConfig(mcpName): Get registry or custom config
  - Purpose: Central MCP registry and installation management
  - _Leverage: None (new module)_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Integration Developer | Task: Create McpManager class with built-in MCP registry following design.md | Restrictions: Support both registry and custom MCPs from skillpkg.json | Success: Can lookup and verify MCP installations | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (MCP_REGISTRY, class methods), then mark as [x]_

- [ ] 2.5 Implement MCP auto-installation in McpManager
  - File: packages/core/src/mcp/mcp-manager.ts (continue)
  - Implement install(mcpName): Execute npm install command
  - Implement updateMcpConfig(projectPath, mcpName): Update .mcp.json
  - Implement ensureMcpInstalled(projectPath, mcpName, options): Full flow
  - Purpose: Automatic MCP installation capability
  - _Leverage: packages/core/src/mcp/mcp-manager.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Integration Developer | Task: Add MCP installation methods to McpManager | Restrictions: Handle install failures gracefully, prompt before install | Success: Can auto-install MCPs with user confirmation | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (install methods), then mark as [x]_

- [ ] 2.6 Integrate McpManager with DependencyResolver
  - File: packages/core/src/resolver/dependency-resolver.ts (modify)
  - When skill has MCP dependencies, use McpManager to check/install
  - Return missing MCPs with install options
  - Purpose: Seamless MCP dependency resolution
  - _Leverage: packages/core/src/mcp/mcp-manager.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration Developer | Task: Connect DependencyResolver with McpManager | Restrictions: Don't auto-install without user consent | Success: MCP deps resolved and installable | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (integration points), then mark as [x]_

- [ ] 2.7 Write unit tests for McpManager and DependencyResolver
  - File: packages/core/src/mcp/__tests__/mcp-manager.test.ts
  - File: packages/core/src/resolver/__tests__/dependency-resolver.test.ts
  - Test registry lookup, install verification, MCP installation
  - Test single-level, multi-level, circular dependencies
  - Purpose: Ensure correct MCP and dependency resolution
  - _Leverage: vitest_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create tests for McpManager and DependencyResolver | Restrictions: Mock command execution, test all scenarios | Success: All MCP and resolution scenarios tested | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (test cases), then mark as [x]_

## Milestone 3: Sync Mechanism

> **v2.0 Scope:** 僅支援 Claude Code，其他工具未來版本再擴展

- [ ] 3.1 Define SyncTargetConfig for Claude Code
  - File: packages/core/src/sync/targets.ts
  - Define config for claude-code: `.claude/skills/{name}/SKILL.md`
  - Include: skillsDir, mcpConfigFile (.mcp.json)
  - Purpose: Configure how skills sync to Claude Code
  - _Leverage: packages/core/src/adapters/claude-code.ts for reference_
  - _Requirements: 3_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration Developer | Task: Define Claude Code sync target config following Requirement 3 | Restrictions: Follow Claude Code conventions | Success: Claude Code target properly configured | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (target config), then mark as [x]_

- [ ] 3.2 Create Syncer class
  - File: packages/core/src/sync/syncer.ts
  - Implement syncToClaudeCode(projectPath, skills)
  - Copy SKILL.md to `.claude/skills/{name}/SKILL.md`
  - Purpose: Sync skills to Claude Code directory
  - _Leverage: packages/core/src/sync/targets.ts_
  - _Requirements: 3_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: File System Developer | Task: Create Syncer class for Claude Code following Requirement 3 | Restrictions: Atomic operations, handle errors gracefully | Success: Skills correctly synced to .claude/skills/ | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (class methods), then mark as [x]_

- [ ] 3.3 Add MCP config sync to .mcp.json
  - File: packages/core/src/sync/syncer.ts (continue)
  - syncMcpConfig(projectPath, mcpConfig)
  - Update .mcp.json with MCP configurations
  - Purpose: Sync MCP configuration for Claude Code
  - _Leverage: packages/core/src/sync/syncer.ts_
  - _Requirements: 3_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Config Sync Developer | Task: Add MCP config sync to .mcp.json following Requirement 3 | Restrictions: Merge with existing config, don't overwrite user settings | Success: MCP config correctly synced to .mcp.json | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (methods), then mark as [x]_

- [ ] 3.4 Write unit tests for Syncer
  - File: packages/core/src/sync/__tests__/syncer.test.ts
  - Test sync to Claude Code
  - Test MCP config sync
  - Purpose: Ensure correct sync behavior
  - _Leverage: vitest, mock file system_
  - _Requirements: 3_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create tests for Syncer | Restrictions: Mock file system | Success: All Claude Code sync scenarios tested | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (test cases), then mark as [x]_

## Milestone 4: Installer Updates

- [ ] 4.1 Update install flow with dependency resolution and MCP auto-install
  - File: packages/core/src/store/skill-store.ts (modify)
  - Integrate DependencyResolver before installation
  - Install skill dependencies in correct order
  - Use McpManager to check/install MCP dependencies
  - Prompt user for MCP installation (with --yes flag for auto-accept)
  - Record installed_by in state.json
  - Purpose: Auto-install skill and MCP dependencies
  - _Leverage: packages/core/src/resolver/dependency-resolver.ts, packages/core/src/mcp/mcp-manager.ts_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Package Manager Developer | Task: Update install flow with skill deps AND MCP auto-install following Requirement 2 | Restrictions: Maintain backward compat, prompt before MCP install, atomic operations | Success: All dependencies (skill + MCP) auto-installed in order | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (flow changes), then mark as [x]_

- [ ] 4.2 Update uninstall flow with dependency check
  - File: packages/core/src/store/skill-store.ts (modify)
  - Check dependents before uninstall
  - Support --force flag
  - Clean up orphan dependencies
  - Purpose: Safe uninstall with dependency awareness
  - _Leverage: packages/core/src/state/state-manager.ts_
  - _Requirements: 5_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Package Manager Developer | Task: Update uninstall flow following Requirement 5 | Restrictions: Warn before removing deps, support force | Success: Safe uninstall with orphan cleanup | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (flow changes), then mark as [x]_

- [ ] 4.3 Implement installFromConfig()
  - File: packages/core/src/store/skill-store.ts (continue)
  - Read skillpkg.json and install all listed skills
  - Similar to `npm install` from package.json
  - Purpose: Install all project skills from config
  - _Leverage: packages/core/src/config/config-manager.ts_
  - _Requirements: 1_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Package Manager Developer | Task: Implement installFromConfig following Requirement 1 | Restrictions: Skip already installed, handle partial failures | Success: All config skills installed | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (method), then mark as [x]_

- [ ] 4.4 Write integration tests for install/uninstall
  - File: packages/core/src/store/__tests__/skill-store.integration.test.ts
  - Test install with dependencies
  - Test uninstall with dependents
  - Test installFromConfig
  - Purpose: Ensure correct install/uninstall behavior
  - _Leverage: vitest_
  - _Requirements: 2, 5_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create integration tests for install/uninstall | Restrictions: Use temp directories, clean up | Success: All scenarios tested | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (test cases), then mark as [x]_

## Milestone 5: CLI Commands

- [ ] 5.1 Add `skillpkg init` command
  - File: packages/cli/src/commands/init.ts
  - Interactive prompts for project name, sync targets
  - Create skillpkg.json
  - Purpose: Initialize new project with skillpkg
  - _Leverage: packages/core/src/config/config-manager.ts_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: CLI Developer | Task: Create init command following Requirement 6 | Restrictions: Interactive prompts, handle existing config | Success: Creates valid skillpkg.json | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (command implementation), then mark as [x]_

- [ ] 5.2 Add `skillpkg sync` command
  - File: packages/cli/src/commands/sync.ts
  - Support: skillpkg sync [target] --dry-run
  - Show progress and results
  - Purpose: Sync skills to AI tools
  - _Leverage: packages/core/src/sync/syncer.ts_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: CLI Developer | Task: Create sync command following Requirement 6 | Restrictions: Support dry-run, show progress | Success: Syncs to all targets correctly | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (command implementation), then mark as [x]_

- [ ] 5.3 Add dependency commands (deps, why, tree)
  - File: packages/cli/src/commands/deps.ts
  - skillpkg deps <name>: Show skill dependencies
  - skillpkg why <name>: Show who depends on skill
  - skillpkg tree: Show full dependency tree
  - Purpose: Query dependency information
  - _Leverage: packages/core/src/state/state-manager.ts_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: CLI Developer | Task: Create dependency query commands following Requirement 6 | Restrictions: Clear output format, handle missing skills | Success: Correct dependency info displayed | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (commands), then mark as [x]_

- [ ] 5.4 Add `skillpkg status` command
  - File: packages/cli/src/commands/status.ts
  - Show installed skills with versions
  - Show MCP status
  - Show sync status per target
  - Purpose: Overview of project AI workflow
  - _Leverage: packages/core/src/state/state-manager.ts_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: CLI Developer | Task: Create status command following Requirement 6 | Restrictions: Clear table format, show warnings | Success: Complete status overview | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (command implementation), then mark as [x]_

- [ ] 5.5 Update install/uninstall commands
  - File: packages/cli/src/commands/install.ts (modify)
  - File: packages/cli/src/commands/uninstall.ts (modify)
  - Show dependency resolution output
  - Add --force flag for uninstall
  - Prompt for sync after install
  - Purpose: Enhanced install/uninstall UX
  - _Leverage: packages/core/src/store/skill-store.ts_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: CLI Developer | Task: Update install/uninstall commands following Requirement 6 | Restrictions: Show deps, support force | Success: Clear feedback during install/uninstall | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (changes), then mark as [x]_

## Milestone 6: MCP Server Updates

- [ ] 6.1 Update install_skill MCP tool
  - File: packages/mcp-server/src/tools/install.ts (modify)
  - Return dependency info in result
  - Return missing MCP list
  - Prompt for sync
  - Purpose: MCP tool reflects new features
  - _Leverage: packages/core/src/store/skill-store.ts_
  - _Requirements: 2, 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Developer | Task: Update install_skill tool | Restrictions: Maintain backward compat | Success: Returns deps and MCP info | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (tool changes), then mark as [x]_

- [ ] 6.2 Update uninstall_skill MCP tool
  - File: packages/mcp-server/src/tools/uninstall.ts (modify)
  - Return dependents warning
  - Support force parameter
  - Purpose: MCP tool reflects uninstall changes
  - _Leverage: packages/core/src/store/skill-store.ts_
  - _Requirements: 5, 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Developer | Task: Update uninstall_skill tool | Restrictions: Return warnings, support force | Success: Safe uninstall via MCP | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (tool changes), then mark as [x]_

- [ ] 6.3 Add sync_skills MCP tool
  - File: packages/mcp-server/src/tools/sync.ts (new)
  - Sync skills to specified target
  - Return sync results
  - Purpose: Enable sync via MCP
  - _Leverage: packages/core/src/sync/syncer.ts_
  - _Requirements: 3, 6_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: MCP Developer | Task: Create sync_skills tool | Restrictions: Support all targets | Success: Skills synced via MCP | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (new tool), then mark as [x]_

## Milestone 7: Migration & Polish

- [ ] 7.1 Implement migrate command
  - File: packages/cli/src/commands/migrate.ts (new)
  - Detect v1.x installations (skills without skillpkg.json)
  - Generate skillpkg.json from installed skills
  - Generate state.json
  - Purpose: Smooth upgrade from v1.x
  - _Leverage: packages/core/src/config/config-manager.ts_
  - _Requirements: Non-functional: Backward Compatibility_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Migration Developer | Task: Create migrate command | Restrictions: Don't break existing installs | Success: v1.x users can upgrade smoothly | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (migration logic), then mark as [x]_

- [ ] 7.2 Create built-in mcp-installer skill
  - File: skills/mcp-installer/SKILL.md (new)
  - Document MCP Registry 概念和支援的 MCP servers
  - 說明自動安裝、手動安裝、查詢、自訂配置
  - 包含 triggers: 安裝 MCP, 設定 MCP, MCP 依賴
  - Purpose: 教 AI 如何使用 skillpkg 的 MCP 安裝功能
  - _Leverage: packages/core/src/mcp/registry.ts (MCP_REGISTRY)_
  - _Requirements: 2_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Skill Author | Task: Create mcp-installer skill following design.md Built-in Skills section | Restrictions: Keep it concise, include all supported MCPs from registry | Success: AI can understand how to use skillpkg MCP features | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (skill content), then mark as [x]_

- [ ] 7.3 Update README and documentation
  - File: README.md (modify)
  - File: docs/migration.md (new)
  - Document skillpkg.json format
  - Document sync targets
  - Add migration guide
  - Purpose: User documentation
  - _Leverage: existing docs_
  - _Requirements: All_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Technical Writer | Task: Update documentation | Restrictions: Clear examples, cover all features | Success: Users can understand and use v2.0 | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (docs), then mark as [x]_

- [ ] 7.4 E2E testing
  - File: packages/core/src/__tests__/e2e.test.ts (new)
  - Test full workflow: init → install → sync → uninstall
  - Test migration from v1.x
  - Purpose: Validate complete user journeys
  - _Leverage: vitest_
  - _Requirements: All_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: E2E Test Engineer | Task: Create end-to-end tests | Restrictions: Test real workflows, clean up | Success: All user journeys validated | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (test scenarios), then mark as [x]_

- [ ] 7.5 Version bump and release
  - File: packages/*/package.json
  - Bump versions to 0.3.0
  - Update CHANGELOG.md
  - npm publish
  - Purpose: Release v2.0
  - _Leverage: npm_
  - _Requirements: All_
  - _Prompt: Implement the task for spec skillpkg-v2, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Release Engineer | Task: Prepare and execute release | Restrictions: Follow semver, update changelogs | Success: v0.3.0 published to npm | Instructions: Mark task as [-] in tasks.md before starting, use log-implementation tool after completion with artifacts (version changes), then mark as [x]_
