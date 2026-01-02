# Tasks Document: skillpkg MCP Server

## M0: Registry 建立

- [ ] 0.1 建立 skillpkg/registry repo
  - 在 GitHub 建立 `skillpkg/registry` repository
  - 建立基本目錄結構：`skills/`, `index.json`
  - Purpose: 作為 skill 的中央儲存庫
  - _Requirements: REQ-2, REQ-7_
  - _Prompt: Role: DevOps Engineer | Task: Create GitHub repo skillpkg/registry with structure: skills/ directory, empty index.json, README.md explaining the registry. | Restrictions: Public repo, MIT license | Success: Repo created with correct structure | After completing: Mark task [-] → [x] in tasks.md, log implementation_

- [ ] 0.2 建立 GitHub Actions workflows
  - File: `.github/workflows/validate-pr.yml`, `.github/workflows/update-index.yml`
  - validate-pr: 驗證 PR 中的 skill.yaml 格式
  - update-index: merge 後自動更新 index.json
  - Purpose: 自動化 registry 維護
  - _Leverage: skillpkg-core validate function_
  - _Requirements: REQ-2, REQ-7_
  - _Prompt: Role: DevOps Engineer | Task: Create GitHub Actions: (1) validate-pr.yml - validate skill.yaml on PR, (2) update-index.yml - regenerate index.json on merge. Use skillpkg-core for validation. | Restrictions: Use Node.js actions | Success: PRs are validated, index.json auto-updates | After completing: Mark task [-] → [x] in tasks.md, log implementation_

- [ ] 0.3 新增初始 skills
  - 將 self-evolving-agent, code-reviewer 等 skills 加入 registry
  - Purpose: 有初始內容可供測試
  - _Leverage: omniflow-studio/.claude/skills/_
  - _Requirements: REQ-2_
  - _Prompt: Role: Content Manager | Task: Add initial skills to registry: self-evolving-agent, code-reviewer, research from omniflow-studio. Follow skill.yaml format. | Restrictions: Ensure valid format | Success: At least 3 skills in registry | After completing: Mark task [-] → [x] in tasks.md, log implementation_

## M1: 基礎設施 ✅

- [x] 1.1 建立 mcp-server 套件結構
  - File: `packages/mcp-server/package.json`, `packages/mcp-server/tsconfig.json`
  - 建立新的 monorepo 套件 `skillpkg-mcp-server`
  - 加入依賴：`@modelcontextprotocol/sdk`, `skillpkg-core`
  - Purpose: 建立 MCP Server 套件基礎架構
  - _Leverage: packages/core/package.json, packages/cli/package.json_
  - _Requirements: REQ-1_
  - _Prompt: Role: TypeScript Developer specializing in monorepo setup | Task: Implement the task for spec mcp-server, first run spec-workflow-guide to get the workflow guide. Create new package `skillpkg-mcp-server` under packages/mcp-server with proper package.json and tsconfig.json. Add dependencies: @modelcontextprotocol/sdk, skillpkg-core. Follow existing package patterns. | Restrictions: Must follow existing monorepo structure, use consistent versioning | Success: Package compiles, dependencies resolve correctly | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 1.2 定義 MCP 相關型別
  - File: `packages/mcp-server/src/types.ts`
  - 定義 ToolHandler interface、各 Tool 的 Input/Output types
  - Purpose: 建立型別安全基礎
  - _Leverage: design.md Data Models section_
  - _Requirements: REQ-2 ~ REQ-8_
  - _Prompt: Role: TypeScript Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create types.ts with ToolHandler interface and all tool input/output types as defined in design.md Data Models section. | Restrictions: Follow existing type patterns, export all types | Success: Types compile without errors, cover all tools | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 1.3 建立套件入口點
  - File: `packages/mcp-server/src/index.ts`
  - Export SkillpkgMcpServer class 和相關型別
  - Purpose: 提供套件公開 API
  - _Leverage: packages/core/src/index.ts_
  - _Requirements: REQ-1_
  - _Prompt: Role: TypeScript Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create index.ts that exports SkillpkgMcpServer class and all public types. | Restrictions: Only export public API | Success: Package can be imported correctly | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

## M2: MCP Server 核心 ✅

- [x] 2.1 實作 MCP Server 主程式
  - File: `packages/mcp-server/src/server.ts`
  - 使用 @modelcontextprotocol/sdk 建立 Server
  - 實作 stdio transport、tool registration
  - Purpose: MCP Server 核心邏輯
  - _Leverage: @modelcontextprotocol/sdk documentation_
  - _Requirements: REQ-1_
  - _Prompt: Role: Backend Developer with MCP expertise | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create SkillpkgMcpServer class using @modelcontextprotocol/sdk. Implement start(), stop(), registerTools(). Use stdio transport. Log to stderr. | Restrictions: Must follow MCP protocol spec, handle errors gracefully | Success: Server starts/stops correctly, responds to MCP handshake | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 2.2 實作 Tool Router
  - File: `packages/mcp-server/src/server.ts` (extend)
  - 實作 tool call routing、參數驗證
  - Purpose: 路由 MCP tool calls 到對應 handler
  - _Leverage: existing server.ts from 2.1_
  - _Requirements: REQ-1_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Extend server.ts to route tool calls to handlers. Add input validation using JSON schema. Return proper MCP responses. | Restrictions: Validate all inputs, return proper error format | Success: Tool calls routed correctly, invalid inputs rejected with error | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

## M3: Tool Handlers ✅

- [x] 3.1 實作 search_skills handler
  - File: `packages/mcp-server/src/tools/search-skills.ts`
  - 搜尋本地 + Registry skills，回傳 metadata
  - Purpose: 讓 AI 搜尋可用 skills
  - _Leverage: skillpkg-core LocalStore, GlobalStore, RegistryClient_
  - _Requirements: REQ-2_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create search-skills.ts handler. Use LocalStore/GlobalStore for local search, RegistryClient for registry search. Support source filter (all/local/registry). Return metadata only (~100 tokens per skill). | Restrictions: Do not return full instructions, limit results | Success: Search returns matching skills from specified sources | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.2 實作 load_skill handler
  - File: `packages/mcp-server/src/tools/load-skill.ts`
  - 載入完整 skill instructions
  - Purpose: 按需載入 skill 內容
  - _Leverage: skillpkg-core LocalStore, GlobalStore, parse_
  - _Requirements: REQ-3_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create load-skill.ts handler. Load full skill instructions from store. Return id, name, version, description, instructions. Error if not installed. | Restrictions: Only load installed skills | Success: Returns full instructions for installed skill, error for missing | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.3 實作 install_skill handler
  - File: `packages/mcp-server/src/tools/install-skill.ts`
  - 從多種來源安裝 skills (Registry, GitHub, URL, Gist, Local)
  - Purpose: 讓 AI 自主安裝新 skills
  - _Leverage: skillpkg-core createInstaller, source detection from design.md_
  - _Requirements: REQ-4_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create install-skill.ts handler. Implement source detection (registry/github/gist/url/local). Use createInstaller for installation. Support scope option. | Restrictions: Validate sources, no code execution | Success: Installs from all supported sources, returns installed skill info | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.4 實作 list_skills handler
  - File: `packages/mcp-server/src/tools/list-skills.ts`
  - 列出已安裝 skills
  - Purpose: 讓 AI 知道有哪些 skills
  - _Leverage: skillpkg-core LocalStore, GlobalStore_
  - _Requirements: REQ-5_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create list-skills.ts handler. List skills from LocalStore and/or GlobalStore based on scope. Return metadata for each skill. | Restrictions: Filter by scope correctly | Success: Returns list of installed skills with metadata | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.5 實作 uninstall_skill handler
  - File: `packages/mcp-server/src/tools/uninstall-skill.ts`
  - 移除已安裝 skill
  - Purpose: 讓 AI 管理 skills
  - _Leverage: skillpkg-core LocalStore, GlobalStore_
  - _Requirements: REQ-6_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create uninstall-skill.ts handler. Remove skill from appropriate store. Return confirmation. | Restrictions: Error if skill not found | Success: Removes skill, returns confirmation | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.6 實作 search_registry handler
  - File: `packages/mcp-server/src/tools/search-registry.ts`
  - 搜尋遠端 Registry
  - Purpose: 讓 AI 發現新 skills
  - _Leverage: skillpkg-core RegistryClient_
  - _Requirements: REQ-7_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create search-registry.ts handler. Use RegistryClient to search. Return name, description, version, author, downloads. Support limit. | Restrictions: Handle registry unavailable gracefully | Success: Returns registry search results, graceful error on unavailable | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.7 實作 skill_info handler
  - File: `packages/mcp-server/src/tools/skill-info.ts`
  - 取得 skill 詳細資訊
  - Purpose: 讓 AI 在安裝前了解 skill
  - _Leverage: skillpkg-core RegistryClient_
  - _Requirements: REQ-8_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create skill-info.ts handler. Use RegistryClient to get full skill info. Return all metadata including readme if available. | Restrictions: Error if not found in registry | Success: Returns detailed skill info from registry | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.8 實作 recommend_skill handler
  - File: `packages/mcp-server/src/tools/recommend-skill.ts`
  - 智慧推薦最適合的 skill
  - 實作 relevance scoring algorithm
  - Purpose: 讓 AI 快速找到最佳 skill
  - _Leverage: skillpkg-core RegistryClient, design.md Relevance Scoring Algorithm_
  - _Requirements: REQ-9_
  - _Prompt: Role: Backend Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create recommend-skill.ts handler. Implement relevance scoring (text match 40%, rating 25%, popularity 20%, freshness 15%). Support criteria options. Return recommendation with reason and alternatives. | Restrictions: Use scoring algorithm from design.md | Success: Returns best skill with reason, alternatives provided | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [x] 3.9 建立 tools index
  - File: `packages/mcp-server/src/tools/index.ts`
  - Export 所有 tool handlers
  - Purpose: 統一 tools 入口
  - _Leverage: all tool handlers from 3.1-3.8_
  - _Requirements: REQ-1_
  - _Prompt: Role: TypeScript Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create tools/index.ts that exports all tool handlers as an array. | Restrictions: Export consistent format | Success: All handlers exported, can be imported by server | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

## M4: CLI 整合 (部分完成)

- [x] 4.1 新增 serve command (已在 mcp-server/src/cli.ts 實作獨立 CLI)
  - File: `packages/cli/src/commands/serve.ts`
  - 實作 `skillpkg serve` command
  - 支援 --scope, --project options
  - Purpose: CLI 進入點啟動 MCP Server
  - _Leverage: packages/cli/src/commands/*.ts patterns, skillpkg-mcp-server_
  - _Requirements: REQ-1_
  - _Prompt: Role: CLI Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create serve.ts command using commander. Import and start SkillpkgMcpServer. Add --scope (local/global) and --project options. | Restrictions: Follow existing CLI patterns | Success: `skillpkg serve` starts MCP server correctly | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [ ] 4.2 註冊 serve command
  - File: `packages/cli/src/cli.ts`
  - 在 CLI 主程式註冊 serve command
  - Purpose: 啟用 serve 功能
  - _Leverage: existing command registrations in cli.ts_
  - _Requirements: REQ-1_
  - _Prompt: Role: CLI Developer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Register serve command in cli.ts following existing patterns. | Restrictions: Follow existing registration pattern | Success: `skillpkg serve --help` shows command options | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [ ] 4.3 更新 CLI package.json
  - File: `packages/cli/package.json`
  - 加入 skillpkg-mcp-server 依賴
  - Purpose: CLI 可使用 MCP Server
  - _Leverage: existing dependencies_
  - _Requirements: REQ-1_
  - _Prompt: Role: Package Manager | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Add skillpkg-mcp-server as dependency in CLI package.json. | Restrictions: Use correct version | Success: Dependencies install correctly | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

## M5: 測試

- [ ] 5.1 建立 tool handler 單元測試
  - File: `packages/mcp-server/src/__tests__/tools/*.test.ts`
  - 測試每個 tool handler 的輸入驗證和輸出格式
  - Purpose: 確保 tool handlers 正確運作
  - _Leverage: vitest, mock stores_
  - _Requirements: REQ-2 ~ REQ-8_
  - _Prompt: Role: QA Engineer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create unit tests for all tool handlers. Mock stores and registry client. Test valid inputs, invalid inputs, error cases. | Restrictions: Mock external dependencies | Success: All handlers tested, edge cases covered | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [ ] 5.2 建立 MCP Server 整合測試
  - File: `packages/mcp-server/src/__tests__/server.test.ts`
  - 測試 MCP 協議流程
  - Purpose: 確保 MCP 協議正確實作
  - _Leverage: @modelcontextprotocol/sdk test utilities_
  - _Requirements: REQ-1_
  - _Prompt: Role: Integration Tester | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create integration tests for MCP server. Test tool listing, tool calls, error responses. | Restrictions: Test full MCP flow | Success: Server responds correctly to MCP protocol | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

## M6: 文件與發布

- [ ] 6.1 更新 README
  - File: `packages/mcp-server/README.md`
  - 說明安裝、設定、使用方式
  - Purpose: 使用者文件
  - _Requirements: All_
  - _Prompt: Role: Technical Writer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Create README.md with installation, configuration (claude_desktop_config.json example), and usage instructions. Document all available tools. | Restrictions: Clear and concise | Success: Users can set up and use MCP server | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [ ] 6.2 發布 skillpkg-mcp-server 到 npm
  - Publish `skillpkg-mcp-server` package
  - 更新 skillpkg-cli 版本
  - Purpose: 公開發布
  - _Requirements: All_
  - _Prompt: Role: Release Manager | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Build and publish skillpkg-mcp-server to npm. Update skillpkg-cli to new version with serve command. | Restrictions: Test before publish | Success: Packages published, npm install works | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_

- [ ] 6.3 更新 skillpkg skill.yaml
  - File: `/Users/user/Workspace/skillpkg/skill.yaml`
  - 新增 MCP Server 使用說明
  - Purpose: 讓使用者透過 skill 學習 MCP 功能
  - _Requirements: All_
  - _Prompt: Role: Technical Writer | Task: Implement the task for spec mcp-server, first run spec-workflow-guide. Update skill.yaml instructions to include MCP Server setup and usage. | Restrictions: Keep concise | Success: skill.yaml includes MCP documentation | After completing: Mark task [-] → [x] in tasks.md, log implementation with log-implementation tool_
