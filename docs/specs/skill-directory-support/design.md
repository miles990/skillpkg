# Skill Directory Support - 設計文件

## 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│  安裝流程                                                   │
│                                                             │
│  source: github:user/repo#skill-path                        │
│              │                                              │
│              ▼                                              │
│  ┌─────────────────────┐                                    │
│  │  Fetcher            │                                    │
│  │  ├─ listDirectory() │ ← NEW: 列舉目錄內容                │
│  │  ├─ fetchSkill()    │ ← 修改: 返回 files                 │
│  │  └─ downloadFiles() │ ← NEW: 批次下載                    │
│  └─────────┬───────────┘                                    │
│            │ FetchResult { skill, files }                   │
│            ▼                                                │
│  ┌─────────────────────┐                                    │
│  │  StoreManager       │                                    │
│  │  └─ addSkill()      │ ← 修改: 接受 files 參數            │
│  └─────────┬───────────┘                                    │
│            │                                                │
│            ▼                                                │
│  .skillpkg/skills/skill-name/                               │
│  ├── SKILL.md                                               │
│  ├── scripts/                                               │
│  │   └── setup.sh                                           │
│  └── resources/                                             │
│      └── template.md                                        │
└─────────────────────────────────────────────────────────────┘
```

## 資料結構

### SkillFile (新增)

```typescript
interface SkillFile {
  /** 相對路徑 (e.g., "scripts/setup.sh") */
  path: string;
  /** 檔案內容 */
  content: string;
  /** 是否為二進位 */
  binary?: boolean;
}
```

### FetchResult (擴展)

```typescript
interface FetchResult {
  success: boolean;
  skill?: Skill;
  files?: SkillFile[];  // NEW
  sourceUrl?: string;
  error?: string;
}
```

## 模組修改

### 1. fetcher.ts

```typescript
// NEW: 列舉 GitHub 目錄
async function listGitHubDirectory(
  repo: string,
  path: string,
  token?: string
): Promise<string[]>

// MODIFY: fetchFromGitHub 返回 files
async function fetchFromGitHub(
  repo: string,
  subpath: string | undefined,
  options: FetcherOptions
): Promise<{ skill: Skill | null; files: SkillFile[] }>

// NEW: 下載多個檔案
async function downloadGitHubFiles(
  repo: string,
  paths: string[],
  token?: string
): Promise<SkillFile[]>
```

### 2. store/manager.ts

```typescript
// MODIFY: addSkill 接受 files
async addSkill(
  skill: Skill,
  options: {
    source?: 'registry' | 'local' | 'import';
    sourceUrl?: string;
    files?: SkillFile[];  // NEW
  }
): Promise<void>
```

### 3. syncer/syncer.ts

```typescript
// MODIFY: syncSkill 複製完整目錄
async function syncSkillToTarget(
  skillDir: string,   // 改為傳入目錄而非單一檔案
  targetDir: string,
  skillName: string
): Promise<void>
```

## GitHub API 使用

### 列舉目錄

```
GET /repos/{owner}/{repo}/contents/{path}
```

回應：
```json
[
  { "name": "SKILL.md", "type": "file", "path": "skill/SKILL.md" },
  { "name": "scripts", "type": "dir", "path": "skill/scripts" }
]
```

### 下載檔案

使用 raw.githubusercontent.com (避免 API 限制)：
```
GET https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}
```

## 效能考量

1. **並行下載**: 使用 `Promise.all` 並行下載檔案
2. **大小限制**: 跳過超過 1MB 的檔案
3. **快取**: 重用現有 GitHub token 機制

## 向後相容

- 只有 SKILL.md 的 skills: `files` 為空陣列
- 現有 store 結構不變
- 現有 API 不變（files 為可選參數）
