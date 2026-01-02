# Requirements Document: skillpkg MCP Server

## Introduction

skillpkg MCP Server 將 skillpkg 從「CLI 同步工具」轉變為「AI 可呼叫的 MCP 服務」。這使得 AI Agent 能夠：
1. **按需載入** skills，解決 context 爆炸問題
2. **自主搜尋與安裝** 新 skills，實現 Self-Evolving Agent
3. **動態管理** skills 生命週期

核心價值：讓 AI 遇到不會的任務時，能自己找工具、學會、然後完成任務。

## Problem Statement

### 現有問題

```
目前 skillpkg sync 做法：
┌─────────────────────────────────────────────────────────┐
│  50+ skills 全部同步到 .claude/skills/                  │
│  → 啟動時載入 ~30,000 tokens                            │
│  → 實際只用 1-2 個 skill                                │
│  → Context 空間被浪費                                   │
│  → AI 無法自主學習新 skills                             │
└─────────────────────────────────────────────────────────┘
```

### 解決方案

```
MCP Server 按需載入：
┌─────────────────────────────────────────────────────────┐
│  AI 啟動時只載入 MCP tools (~200 tokens)                │
│  → 需要時才 search_skills / load_skill                  │
│  → 可以 install_skill 學習新技能                        │
│  → Context 空間有效利用                                 │
└─────────────────────────────────────────────────────────┘
```

## Requirements

### REQ-1: MCP Server 基礎架構

**User Story:** As an AI Agent, I want skillpkg to run as an MCP Server, so that I can call its functions through MCP protocol.

#### Acceptance Criteria

1. WHEN `skillpkg serve` is executed THEN system SHALL start an MCP server using stdio transport
2. WHEN MCP client connects THEN system SHALL respond with available tools list
3. IF server encounters an error THEN system SHALL return proper MCP error response
4. WHEN server starts THEN system SHALL log startup message to stderr (not stdout, to avoid MCP protocol interference)

### REQ-2: Skills 搜尋功能 (search_skills)

**User Story:** As an AI Agent, I want to search for skills by keyword, so that I can find relevant skills without loading all content.

#### Acceptance Criteria

1. WHEN `search_skills(query)` is called THEN system SHALL return matching skills with metadata only (~100 tokens per skill)
2. WHEN searching THEN system SHALL search both local installed skills AND remote registry
3. IF `source` parameter is "local" THEN system SHALL only search installed skills
4. IF `source` parameter is "registry" THEN system SHALL only search remote registry
5. WHEN results are returned THEN system SHALL include: id, name, description, version, source, rating, downloads, updatedAt
6. IF no matches found THEN system SHALL return empty array with helpful message
7. WHEN results are returned THEN system SHALL sort by relevance score (rating × downloads × recency)

### REQ-3: Skills 載入功能 (load_skill)

**User Story:** As an AI Agent, I want to load full skill instructions on demand, so that I only consume context when needed.

#### Acceptance Criteria

1. WHEN `load_skill(id)` is called for installed skill THEN system SHALL return full instructions content
2. IF skill is not installed THEN system SHALL return error with suggestion to install first
3. WHEN loading THEN system SHALL return: id, name, version, instructions (full content)
4. IF skill file is corrupted THEN system SHALL return descriptive error

### REQ-4: Skills 安裝功能 (install_skill)

**User Story:** As an AI Agent, I want to install skills from multiple sources, so that I can learn new capabilities autonomously.

#### Acceptance Criteria

1. WHEN `install_skill(source)` is called with skill name THEN system SHALL install from registry
2. WHEN source is GitHub URL (github.com/* or github:user/repo) THEN system SHALL clone/download from GitHub
3. WHEN source is HTTP URL ending with .zip/.tar.gz THEN system SHALL download and extract
4. WHEN source is gist URL or gist:id THEN system SHALL download from GitHub Gist
5. WHEN source is local path THEN system SHALL install from local directory
6. AFTER successful install THEN system SHALL return installed skill metadata
7. IF installation fails THEN system SHALL return descriptive error with recovery suggestion

### REQ-5: Skills 列表功能 (list_skills)

**User Story:** As an AI Agent, I want to list installed skills, so that I know what capabilities I have.

#### Acceptance Criteria

1. WHEN `list_skills()` is called THEN system SHALL return all installed skills with metadata
2. WHEN listing THEN system SHALL include: id, name, description, version, installed_at
3. IF `scope` is "global" THEN system SHALL list globally installed skills
4. IF `scope` is "local" THEN system SHALL list project-local skills
5. IF no skills installed THEN system SHALL return empty array with helpful message

### REQ-6: Skills 移除功能 (uninstall_skill)

**User Story:** As an AI Agent, I want to uninstall skills I no longer need, so that I can manage my capabilities.

#### Acceptance Criteria

1. WHEN `uninstall_skill(id)` is called THEN system SHALL remove the skill
2. IF skill not found THEN system SHALL return error
3. AFTER uninstall THEN system SHALL return confirmation message

### REQ-7: Registry 搜尋功能 (search_registry)

**User Story:** As an AI Agent, I want to search the skill registry, so that I can discover new skills to install.

#### Acceptance Criteria

1. WHEN `search_registry(query)` is called THEN system SHALL search remote registry
2. WHEN results returned THEN system SHALL include: name, description, version, author, downloads
3. IF registry unavailable THEN system SHALL return error with offline suggestion
4. WHEN `limit` parameter provided THEN system SHALL limit results count

### REQ-8: Skill 詳情功能 (skill_info)

**User Story:** As an AI Agent, I want to get detailed info about a skill before installing, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN `skill_info(name)` is called THEN system SHALL return full skill metadata from registry
2. WHEN returning info THEN system SHALL include: name, description, version, author, repository, dependencies, platforms
3. IF skill not found in registry THEN system SHALL return error

### REQ-9: 智慧推薦功能 (recommend_skill)

**User Story:** As an AI Agent, I want to get the best skill recommendation for my task, so that I can quickly acquire the right capability without manual comparison.

#### Acceptance Criteria

1. WHEN `recommend_skill(query)` is called THEN system SHALL return single best matching skill
2. WHEN recommending THEN system SHALL consider: rating, downloads, recency, relevance to query
3. IF `criteria` is "popular" THEN system SHALL prioritize downloads count
4. IF `criteria` is "highest_rated" THEN system SHALL prioritize rating
5. IF `criteria` is "newest" THEN system SHALL prioritize updatedAt
6. WHEN returning recommendation THEN system SHALL include: skill metadata + reason for recommendation
7. IF no suitable skill found THEN system SHALL return helpful message with alternative suggestions

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: MCP Server 邏輯與現有 CLI 邏輯分離
- **Reuse Core**: 使用 skillpkg-core 的現有功能 (Store, Parser, Registry Client)
- **Transport Abstraction**: MCP transport 層可替換 (stdio, HTTP future)

### Performance

- **Cold Start**: Server 啟動時間 < 500ms
- **Response Time**: 本地操作 < 100ms，Registry 操作 < 2s
- **Memory**: 常駐記憶體 < 50MB

### Security

- **Source Validation**: 從 URL 安裝時驗證來源合法性
- **No Code Execution**: 安裝過程不執行任何 skill 內的程式碼
- **Path Traversal**: 防止路徑穿越攻擊

### Reliability

- **Graceful Degradation**: Registry 不可用時，本地功能仍可用
- **Error Messages**: 所有錯誤都有清楚的訊息和建議

### Compatibility

- **MCP Protocol**: 遵循 Anthropic MCP Specification
- **Clients**: 支援 Claude Desktop, Cursor, Windsurf, 其他 MCP 客戶端
