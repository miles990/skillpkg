# 通用 Registry 整合設計文件

## 架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                  AI 驅動的 Skill Discovery                       │
│                                                                 │
│  ┌─────────────┐                    ┌─────────────────────────┐ │
│  │   MCP 工具   │ ←── 主要介面 ────→ │   AI Agent             │ │
│  │             │                    │                         │ │
│  │ search_     │                    │ • 搜尋多來源            │ │
│  │ skills      │                    │ • 分析 SKILL.md 內容    │ │
│  │             │                    │ • 決策：使用/改造/新建  │ │
│  │ fetch_      │                    │                         │ │
│  │ skill_      │                    │                         │ │
│  │ content     │                    │                         │ │
│  └─────────────┘                    └─────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    packages/core                            ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ ││
│  │  │ registry/   │    │ fetcher/    │    │ store/          │ ││
│  │  │ manager.ts  │────│ fetcher.ts  │────│ (現有)          │ ││
│  │  │ providers/* │    │ (含 subpath)│    │                 │ ││
│  │  └─────────────┘    └─────────────┘    └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   Local     │    │   Awesome   │    │   GitHub    │        │
│   │  Installed  │    │   Repos     │    │  (補充)     │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                             │                                   │
│                             ▼                                   │
│                 ┌───────────────────────┐                      │
│                 │ • anthropics/skills   │                      │
│                 │ • ComposioHQ/awesome  │                      │
│                 │ • travisvn/awesome    │                      │
│                 │ • VoltAgent/awesome   │                      │
│                 └───────────────────────┘                      │
│                                                                 │
│  ┌─────────────┐                                               │
│  │   CLI       │ ←── 只顯示結果                                │
│  │ search      │                                               │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 資料來源

### 優先順序

```
┌─────────────────────────────────────────────────────────────────┐
│  有 API Key：  local → skillsmp (40K+) → github                 │
│  無 API Key：  local → awesome (~30) → github                   │
└─────────────────────────────────────────────────────────────────┘
```

| 優先級 | 來源 | 數量 | 需要 API Key | 說明 |
|--------|------|------|--------------|------|
| 1 | `local` | 已安裝 | ❌ | 永遠優先 |
| 2 | `skillsmp` | 40,000+ | ✅ | **主要來源** |
| 2 | `awesome` | ~30 | ❌ | 無 Key 時的 fallback |
| 3 | `github` | 不定 | ❌ | 補充搜尋 |

### Skillsmp.com 設定 (主要來源)

```typescript
const SKILLSMP_CONFIG = {
  baseUrl: 'https://skillsmp.com/api/v1',
  endpoints: {
    search: '/skills/search',      // 關鍵字搜尋
    aiSearch: '/skills/ai-search', // AI 語意搜尋
  },
};
```

### Awesome Repos 清單 (Fallback)

```typescript
// 無 API Key 時使用
const AWESOME_REPOS = [
  'anthropics/skills',                    // 官方範例
  'ComposioHQ/awesome-claude-skills',     // 社群精選
];
```

## 去重機制

### 去重 Key

使用 **normalized source URL** 作為去重 key：

```typescript
function normalizeSourceForDedup(source: string): string {
  // github:User/Repo#Path → github:user/repo#path (小寫)
  const parsed = parseSource(source);
  if (parsed.type === 'github') {
    const key = parsed.subpath
      ? `github:${parsed.value.toLowerCase()}#${parsed.subpath.toLowerCase()}`
      : `github:${parsed.value.toLowerCase()}`;
    return key;
  }
  return source.toLowerCase();
}
```

### 去重邏輯

```typescript
function deduplicateSkills(skills: SkillInfo[]): SkillInfo[] {
  const seen = new Map<string, SkillInfo>();

  for (const skill of skills) {
    const key = normalizeSourceForDedup(skill.source);

    // 保留第一個出現的 (優先級高的來源先加入)
    if (!seen.has(key)) {
      seen.set(key, skill);
    }
  }

  return Array.from(seen.values());
}
```

### 去重範例

```
輸入 (來自多個 awesome repos):
  1. [ComposioHQ] git-helper → github:alice/tools#git-helper
  2. [travisvn]   git-helper → github:alice/tools#git-helper  ← 重複
  3. [ComposioHQ] code-review → github:bob/review
  4. [VoltAgent]  test-helper → github:carol/test

輸出 (去重後):
  1. git-helper   → github:alice/tools#git-helper
  2. code-review  → github:bob/review
  3. test-helper  → github:carol/test
```

## MCP 工具設計

### 1. search_skills

```typescript
{
  name: 'search_skills',
  description: 'Search for skills from multiple sources. Returns deduplicated results.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keywords (e.g., "git commit", "code review")'
      },
      sources: {
        type: 'array',
        items: { type: 'string', enum: ['local', 'skillsmp', 'awesome', 'github'] },
        description: 'Sources to search. Auto-detected: skillsmp (if API key) or awesome (fallback).'
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Max results (after deduplication)'
      }
    },
    required: ['query']
  }
}

// Response
interface SearchResult {
  skills: SkillInfo[];
  sources_queried: string[];
  duplicates_removed: number;  // 去重數量
  errors?: Record<string, string>;
}

interface SkillInfo {
  name: string;
  description: string;
  source: string;           // 可安裝的 source URL
  stars?: number;
  forks?: number;
  last_updated?: string;
  author?: string;
  provider: string;         // 來自哪個 registry
  found_in?: string[];      // 出現在哪些 awesome repos
}
```

### 2. fetch_skill_content

```typescript
{
  name: 'fetch_skill_content',
  description: 'Fetch the full content of a SKILL.md file for analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Skill source (github:user/repo#path or local:name)'
      }
    },
    required: ['source']
  }
}

// Response
interface FetchResult {
  content: string;           // SKILL.md 原始內容
  metadata: {
    name: string;
    description: string;
    allowed_tools?: string[];
    model?: string;
  };
  source: string;
}
```

## Provider 實作

### AwesomeProvider

```typescript
// packages/core/src/registry/providers/awesome.ts

const AWESOME_REPOS = [
  'anthropics/skills',
  'ComposioHQ/awesome-claude-skills',
  'travisvn/awesome-claude-skills',
  'VoltAgent/awesome-claude-skills',
];

export class AwesomeProvider implements RegistryProvider {
  readonly id = 'awesome';
  private cache: Map<string, SkillInfo[]> = new Map();
  private cacheExpiry: number = 30 * 60 * 1000; // 30 分鐘快取

  async search({ query, limit = 20 }: SearchOptions): Promise<SkillInfo[]> {
    const allSkills: SkillInfo[] = [];

    for (const repo of AWESOME_REPOS) {
      const skills = await this.fetchSkillsFromRepo(repo);
      allSkills.push(...skills);
    }

    // 篩選符合 query 的
    const matched = allSkills.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description?.toLowerCase().includes(query.toLowerCase())
    );

    return matched.slice(0, limit);
  }

  private async fetchSkillsFromRepo(repo: string): Promise<SkillInfo[]> {
    // 檢查快取
    const cacheKey = repo;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 抓取 repo 目錄結構
    const url = `https://api.github.com/repos/${repo}/contents`;
    const response = await fetch(url, { headers: this.getHeaders() });
    const contents = await response.json();

    // 找出所有包含 SKILL.md 的目錄
    const skills: SkillInfo[] = [];
    for (const item of contents) {
      if (item.type === 'dir') {
        const hasSkill = await this.checkHasSkillMd(repo, item.path);
        if (hasSkill) {
          skills.push({
            name: item.name,
            description: '',  // 需要 fetch 才能取得
            source: `github:${repo}#${item.path}`,
            provider: this.id,
            found_in: [repo],
          });
        }
      }
    }

    // 快取結果
    this.cache.set(cacheKey, skills);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheExpiry);

    return skills;
  }
}
```

### GitHubProvider (補充用)

```typescript
// packages/core/src/registry/providers/github.ts

export class GitHubProvider implements RegistryProvider {
  readonly id = 'github';

  async search({ query, limit = 20 }: SearchOptions): Promise<SkillInfo[]> {
    // 使用 topic 搜尋而非 filename
    const searchQuery = `${query} topic:claude-skill OR topic:skillpkg-skill`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&per_page=${limit}`;

    const response = await fetch(url, { headers: this.getHeaders() });
    const data = await response.json();

    return data.items?.map((repo: any) => ({
      name: repo.name,
      description: repo.description || '',
      source: `github:${repo.full_name}`,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      last_updated: repo.pushed_at,
      author: repo.owner.login,
      provider: this.id,
    })) || [];
  }
}
```

### SkillsmpProvider (可選，需 API Key)

```typescript
// packages/core/src/registry/providers/skillsmp.ts

export class SkillsmpProvider implements RegistryProvider {
  readonly id = 'skillsmp';
  private apiKey: string | null = null;
  private cache: Map<string, SkillInfo[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 分鐘快取

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search({ query, limit = 20 }: SearchOptions): Promise<SkillInfo[]> {
    if (!this.apiKey) {
      throw new Error('Skillsmp API key not configured. Run: skillpkg config set skillsmp.apiKey YOUR_KEY');
    }

    // 檢查快取
    const cacheKey = `${query}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const url = `https://skillsmp.com/api/v1/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Skillsmp API error: ${response.status}`);
    }

    const data = await response.json();
    const skills: SkillInfo[] = data.skills?.map((s: any) => ({
      name: s.name,
      description: s.description || '',
      source: s.github_url ? `github:${this.extractGithubPath(s.github_url)}` : `skillsmp:${s.id}`,
      stars: s.stars || 0,
      author: s.author,
      provider: this.id,
    })) || [];

    // 快取結果
    this.cache.set(cacheKey, skills);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheExpiry);

    return skills;
  }

  private extractGithubPath(url: string): string {
    // https://github.com/user/repo → user/repo
    const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : url;
  }
}
```

### Registry Manager (含去重與自動來源選擇)

```typescript
// packages/core/src/registry/manager.ts

export class RegistryManager {
  private providers: Map<string, RegistryProvider> = new Map();

  // 自動決定使用哪些來源
  private getDefaultSources(): string[] {
    const skillsmp = this.providers.get('skillsmp') as SkillsmpProvider;

    // 有 API Key → skillsmp，無 → awesome (fallback)
    if (skillsmp?.isConfigured()) {
      return ['local', 'skillsmp'];
    }
    return ['local', 'awesome'];
  }

  async search(
    options: SearchOptions,
    sources?: string[]
  ): Promise<SearchResult> {
    // 自動選擇來源（若未指定）
    const effectiveSources = sources || this.getDefaultSources();

    const activeProviders = effectiveSources
      .map(s => this.providers.get(s))
      .filter(Boolean) as RegistryProvider[];

    // 並行查詢
    const results = await Promise.allSettled(
      activeProviders.map(p => p.search(options))
    );

    // 收集結果
    const allSkills: SkillInfo[] = [];
    const errors: Record<string, string> = {};

    results.forEach((result, i) => {
      const provider = activeProviders[i];
      if (result.status === 'fulfilled') {
        allSkills.push(...result.value);
      } else {
        errors[provider.id] = result.reason?.message || 'Unknown error';
      }
    });

    // 去重
    const beforeCount = allSkills.length;
    const deduplicated = this.deduplicateSkills(allSkills);
    const duplicatesRemoved = beforeCount - deduplicated.length;

    return {
      skills: deduplicated.slice(0, options.limit || 20),
      sources_queried: sources,
      duplicates_removed: duplicatesRemoved,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  }

  private deduplicateSkills(skills: SkillInfo[]): SkillInfo[] {
    const seen = new Map<string, SkillInfo>();

    for (const skill of skills) {
      const key = this.normalizeSource(skill.source);

      if (seen.has(key)) {
        // 合併 found_in 資訊
        const existing = seen.get(key)!;
        existing.found_in = [
          ...(existing.found_in || []),
          ...(skill.found_in || []),
        ];
      } else {
        seen.set(key, { ...skill });
      }
    }

    return Array.from(seen.values());
  }

  private normalizeSource(source: string): string {
    return source.toLowerCase().replace(/\/+$/, '');
  }
}
```

## CLI 設計

```typescript
// packages/cli/src/commands/search.ts

program
  .command('search <query>')
  .description('Search for skills')
  .option('-s, --source <sources>', 'Sources: local,awesome,github', 'local,awesome')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (query, options) => {
    const sources = options.source.split(',');
    const { skills, duplicates_removed, errors } = await manager.search(
      { query, limit: parseInt(options.limit) },
      sources
    );

    console.log(`\nFound ${skills.length} skills (${duplicates_removed} duplicates removed):\n`);

    for (const skill of skills) {
      console.log(`  ${skill.name}${skill.stars ? ` ⭐${skill.stars}` : ''}`);
      if (skill.description) {
        console.log(`  ${skill.description.slice(0, 60)}...`);
      }
      console.log(`  ${chalk.cyan(skill.source)}`);
      if (skill.found_in && skill.found_in.length > 1) {
        console.log(`  ${chalk.gray(`Also in: ${skill.found_in.slice(1).join(', ')}`)}`);
      }
      console.log();
    }

    console.log(`Install: ${chalk.green('skillpkg install <source>')}`);
  });
```

**輸出範例：**
```
$ skillpkg search "git"

Found 8 skills (3 duplicates removed):

  git-helper  ⭐120
  Git operations and commit message helper
  github:alice/tools#git-helper
  Also in: travisvn/awesome-claude-skills

  conventional-commits  ⭐85
  Conventional commit format enforcer
  github:bob/commits

  ...

Install: skillpkg install <source>
```

## 使用流程

### AI 典型流程

```
1. 用戶：「我需要一個幫我寫 commit message 的 skill」

2. AI 呼叫 search_skills({ query: "git commit" })
   → 搜尋 local + awesome (預設)
   → 自動去重
   → 返回 5 個結果

3. AI 看到 git-helper 出現在多個 awesome repos
   → 呼叫 fetch_skill_content({ source: "github:alice/tools#git-helper" })
   → 讀取 SKILL.md 分析

4. AI 決定：
   A. 符合需求 → install_skill
   B. 需要改造 → 參考建新
   C. 不符合 → 繼續搜尋或用 github source 擴大範圍
```

## 快取策略

| 來源 | 快取時間 | 原因 |
|------|----------|------|
| local | 無 | 即時讀取 |
| skillsmp | 5 分鐘 | 主要來源，API 限制 |
| awesome | 30 分鐘 | Fallback，內容穩定 |
| github | 5 分鐘 | 補充，結果可能變化 |
