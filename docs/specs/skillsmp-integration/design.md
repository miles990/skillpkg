# 通用 Registry 整合設計文件

## 架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                        skillpkg                                 │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   CLI       │    │   MCP       │    │   Core              │ │
│  │             │    │             │    │                     │ │
│  │ search      │    │ search_     │    │ ┌─────────────────┐ │ │
│  │ browse      │────│ skills      │────│ │ registry/       │ │ │
│  │ install     │    │ browse_     │    │ │  manager.ts     │ │ │
│  │             │    │ skills      │    │ │  types.ts       │ │ │
│  └─────────────┘    └─────────────┘    │ └────────┬────────┘ │ │
│                                         │          │          │ │
│                                         │ ┌────────▼────────┐ │ │
│                                         │ │ providers/      │ │ │
│                                         │ │  local.ts       │ │ │
│                                         │ │  github.ts      │ │ │
│                                         │ │  skillsmp.ts    │ │ │
│                                         │ └────────┬────────┘ │ │
│                                         │          │          │ │
│                                         │ ┌────────▼────────┐ │ │
│                                         │ │ fetcher/        │ │ │
│                                         │ │  (擴展 subpath) │ │ │
│                                         │ └─────────────────┘ │ │
│                                         └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │   Local     │    │   GitHub    │    │  SkillsMP   │
   │  Installed  │    │  Search API │    │    API      │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## 模組設計

### 1. Registry Types (`packages/core/src/registry/types.ts`)

```typescript
/**
 * 搜尋選項
 */
export interface SearchOptions {
  query: string;
  category?: string;
  sort?: 'stars' | 'updated' | 'relevance';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * 搜尋結果中的 Skill 資訊
 */
export interface SkillInfo {
  /** 唯一識別碼 (provider 內) */
  id: string;
  /** Skill 名稱 */
  name: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author: string;
  /** 可安裝的 source URL */
  source: string;
  /** GitHub 星數 */
  stars?: number;
  /** 最後更新時間 */
  updatedAt?: string;
  /** 來源 provider */
  provider: string;
}

/**
 * 搜尋結果
 */
export interface SearchResult {
  skills: SkillInfo[];
  total: number;
  hasMore: boolean;
  /** 各 provider 的狀態 */
  providerStatus: Record<string, 'success' | 'error' | 'disabled'>;
}

/**
 * Registry Provider 介面
 */
export interface RegistryProvider {
  /** Provider 唯一識別碼 */
  readonly id: string;
  /** 顯示名稱 */
  readonly name: string;
  /** 是否啟用 */
  enabled: boolean;
  /** 優先級 (數字越小越優先) */
  priority: number;

  /**
   * 搜尋 skills
   */
  search(options: SearchOptions): Promise<SkillInfo[]>;

  /**
   * 取得單一 skill 詳情
   */
  getSkill(id: string): Promise<SkillInfo | null>;

  /**
   * 檢查 provider 是否可用
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Registry 設定
 */
export interface RegistryConfig {
  enabled: boolean;
  priority: number;
  /** Provider 特定設定 */
  options?: Record<string, unknown>;
}
```

### 2. Registry Manager (`packages/core/src/registry/manager.ts`)

```typescript
export class RegistryManager {
  private providers: Map<string, RegistryProvider> = new Map();

  /**
   * 註冊 provider
   */
  register(provider: RegistryProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * 取得所有啟用的 providers (按優先級排序)
   */
  getEnabledProviders(): RegistryProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 搜尋所有 registries
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const providers = this.getEnabledProviders();
    const results = await Promise.allSettled(
      providers.map(p => p.search(options))
    );

    // 合併結果
    const skills: SkillInfo[] = [];
    const status: Record<string, 'success' | 'error' | 'disabled'> = {};

    results.forEach((result, i) => {
      const provider = providers[i];
      if (result.status === 'fulfilled') {
        skills.push(...result.value);
        status[provider.id] = 'success';
      } else {
        status[provider.id] = 'error';
      }
    });

    // 去重 (相同 source 只保留優先級高的)
    const deduped = this.deduplicateSkills(skills);

    return {
      skills: deduped.slice(0, options.limit || 20),
      total: deduped.length,
      hasMore: deduped.length > (options.limit || 20),
      providerStatus: status,
    };
  }

  /**
   * 去重邏輯
   */
  private deduplicateSkills(skills: SkillInfo[]): SkillInfo[] {
    const seen = new Map<string, SkillInfo>();
    for (const skill of skills) {
      // 用 source URL 作為 key
      const key = skill.source.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, skill);
      }
    }
    return Array.from(seen.values());
  }
}

/**
 * 建立預設的 RegistryManager
 */
export function createRegistryManager(): RegistryManager {
  const manager = new RegistryManager();

  // 註冊內建 providers
  manager.register(new LocalProvider());
  manager.register(new GitHubProvider());
  manager.register(new SkillsMarketplaceProvider());

  return manager;
}
```

### 3. Providers 實作

#### 3.1 Local Provider

```typescript
// packages/core/src/registry/providers/local.ts

export class LocalProvider implements RegistryProvider {
  readonly id = 'local';
  readonly name = 'Installed Skills';
  enabled = true;
  priority = 0;  // 最高優先級

  constructor(private storeManager: StoreManager) {}

  async search(options: SearchOptions): Promise<SkillInfo[]> {
    const skills = await this.storeManager.listSkills();
    const query = options.query.toLowerCase();

    return skills
      .filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      )
      .map(s => ({
        id: s.name,
        name: s.name,
        description: s.description || '',
        author: '',
        source: `local:${s.name}`,
        provider: this.id,
      }));
  }

  async getSkill(id: string): Promise<SkillInfo | null> {
    const skill = await this.storeManager.getSkill(id);
    if (!skill) return null;

    return {
      id: skill.name,
      name: skill.name,
      description: skill.description,
      author: typeof skill.author === 'string' ? skill.author : skill.author?.name || '',
      source: `local:${skill.name}`,
      provider: this.id,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;  // 永遠可用
  }
}
```

#### 3.2 GitHub Provider

```typescript
// packages/core/src/registry/providers/github.ts

export class GitHubProvider implements RegistryProvider {
  readonly id = 'github';
  readonly name = 'GitHub';
  enabled = true;
  priority = 10;

  async search(options: SearchOptions): Promise<SkillInfo[]> {
    // 使用 GitHub Search API
    // 搜尋包含 SKILL.md 的 repos
    const query = `${options.query} filename:SKILL.md`;
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=20`;

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return data.items.map((item: any) => ({
      id: `${item.repository.full_name}#${item.path}`,
      name: item.repository.name,
      description: item.repository.description || '',
      author: item.repository.owner.login,
      source: this.toSource(item.repository.full_name, item.path),
      stars: item.repository.stargazers_count,
      provider: this.id,
    }));
  }

  /**
   * 轉換為可安裝的 source URL
   */
  private toSource(repo: string, path: string): string {
    // path: "docs/skills/my-skill/SKILL.md"
    // 移除 SKILL.md 取得目錄
    const dir = path.replace(/\/SKILL\.md$/i, '');
    if (dir && dir !== path) {
      return `github:${repo}#${dir}`;
    }
    return `github:${repo}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'skillpkg',
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data.resources?.search?.remaining > 0;
    } catch {
      return false;
    }
  }
}
```

#### 3.3 Skills Marketplace Provider

```typescript
// packages/core/src/registry/providers/skillsmp.ts

const API_BASE = 'https://skillsmp.com/api/skills';

export class SkillsMarketplaceProvider implements RegistryProvider {
  readonly id = 'skillsmp';
  readonly name = 'Skills Marketplace';
  enabled = true;
  priority = 5;

  async search(options: SearchOptions): Promise<SkillInfo[]> {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.category) params.set('category', options.category);
    if (options.sort) params.set('sort', options.sort);
    if (options.limit) params.set('limit', String(options.limit));

    const url = `${API_BASE}?${params}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();

    return data.skills.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      author: s.author,
      source: this.toSource(s.repo, s.path),
      stars: s.stars,
      updatedAt: s.updatedAt,
      provider: this.id,
    }));
  }

  private toSource(repo: string, path?: string): string {
    // repo: "https://github.com/user/repo"
    const match = repo.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) return repo;

    const userRepo = match[1];
    if (path) {
      return `github:${userRepo}#${path}`;
    }
    return `github:${userRepo}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(API_BASE + '?limit=1');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 4. Fetcher 子目錄支援

#### 4.1 擴展 source-parser.ts

```typescript
export interface ParsedSource {
  type: SourceType;
  value: string;
  subpath?: string;  // 新增
  original: string;
}

export function parseSource(source: string): ParsedSource {
  // github:user/repo#path/to/skill
  if (source.startsWith('github:')) {
    const rest = source.slice(7);

    // 檢查 # 分隔符
    const hashIndex = rest.indexOf('#');
    if (hashIndex !== -1) {
      return {
        type: 'github',
        value: rest.slice(0, hashIndex),
        subpath: rest.slice(hashIndex + 1),
        original: source,
      };
    }

    // 檢查 user/repo/path 格式 (3+ segments)
    const parts = rest.split('/');
    if (parts.length > 2) {
      return {
        type: 'github',
        value: `${parts[0]}/${parts[1]}`,
        subpath: parts.slice(2).join('/'),
        original: source,
      };
    }

    return {
      type: 'github',
      value: rest,
      original: source,
    };
  }

  // user/repo#path 格式
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/.test(source)) {
    const hashIndex = source.indexOf('#');
    if (hashIndex !== -1) {
      return {
        type: 'github',
        value: source.slice(0, hashIndex),
        subpath: source.slice(hashIndex + 1),
        original: source,
      };
    }
  }

  // ... 其他格式保持不變
}

export function normalizeSource(source: string): string {
  const parsed = parseSource(source);

  if (parsed.type === 'github') {
    if (parsed.subpath) {
      return `github:${parsed.value}#${parsed.subpath}`;
    }
    return `github:${parsed.value}`;
  }

  // ... 其他格式
}
```

#### 4.2 修改 fetcher.ts

```typescript
async function fetchFromGitHub(
  repo: string,
  options: FetcherOptions
): Promise<Skill | null> {
  const parsed = parseSource(`github:${repo}`);
  const token = options.githubToken || process.env.GITHUB_TOKEN;

  let skillFile: string;

  if (parsed.subpath) {
    // 直接使用指定路徑
    skillFile = `${parsed.subpath}/SKILL.md`;
  } else {
    // 使用現有的 detectSkillMd
    const detection = await detectSkillMd(parsed.value, token);
    if (!detection.hasSkill || !detection.skillFile) {
      return null;
    }
    skillFile = detection.skillFile;
  }

  const rawUrl = `https://raw.githubusercontent.com/${parsed.value}/HEAD/${skillFile}`;
  // ... 其餘不變
}
```

## CLI 命令設計

```typescript
// skillpkg search <query> [options]
program
  .command('search <query>')
  .description('Search for skills in registries')
  .option('-r, --registry <name>', 'Search specific registry only')
  .option('-c, --category <name>', 'Filter by category')
  .option('-s, --sort <field>', 'Sort by: stars, updated, relevance')
  .option('-l, --limit <n>', 'Limit results', '10')
  .action(searchCommand);
```

## MCP 工具設計

```typescript
{
  name: 'search_skills',
  description: 'Search for skills across all registries',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords' },
      registry: { type: 'string', description: 'Specific registry (local, github, skillsmp)' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  }
}
```

## 向後相容

| 現有功能 | 影響 |
|----------|------|
| `github:user/repo` | ✅ 完全相容 |
| `user/repo` | ✅ 完全相容 |
| 新增 `#path` 語法 | ✅ 擴展功能 |
