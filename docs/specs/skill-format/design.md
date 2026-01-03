# SKILL.md 統一格式 設計文件

## 設計理念

**SKILL.md 就是最終產物** - 不需要轉換，直接使用。

## 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                      skillpkg CLI                           │
│                                                             │
│  skillpkg init       → 產生 SKILL.md                        │
│  skillpkg install    → 讀取 SKILL.md (或 skill.yaml)        │
│  skillpkg sync       → 複製 SKILL.md 到目標                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      skillpkg-core                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SkillReader (更新)                      │   │
│  │                                                      │   │
│  │  readSkill(path):                                   │   │
│  │    1. 嘗試讀取 SKILL.md                              │   │
│  │    2. 若無，嘗試讀取 skill.yaml                      │   │
│  │    3. 解析 frontmatter + content                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SkillWriter (新增)                      │   │
│  │                                                      │   │
│  │  writeSkill(path, metadata, content):               │   │
│  │    - 產生 SKILL.md 格式                              │   │
│  │                                                      │   │
│  │  generateTemplate(name):                            │   │
│  │    - 產生初始 SKILL.md 模板                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Syncer (簡化)                           │   │
│  │                                                      │   │
│  │  syncSkillToTarget():                               │   │
│  │    - 直接複製 SKILL.md（不再轉換）                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 資料結構

### SkillMetadata (Frontmatter)

```typescript
interface SkillMetadata {
  // 必填
  name: string;           // 小寫、連字號
  version: string;        // semver
  description: string;    // 一行說明

  // 可選
  author?: string | AuthorInfo;
  tags?: string[];
  triggers?: Trigger[];
  dependencies?: SkillDependencies;
}

interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

interface Trigger {
  pattern: string;
  description?: string;
}

interface SkillDependencies {
  skills?: string[];
  mcp?: McpDependency[];
}

interface McpDependency {
  name: string;
  package: string;
}
```

### ParsedSkill

```typescript
interface ParsedSkill {
  metadata: SkillMetadata;
  content: string;          // Markdown 內容（不含 frontmatter）
  rawContent: string;       // 完整檔案內容
  source: 'SKILL.md' | 'skill.yaml';
}
```

## 模組設計

### 1. SkillReader (packages/core/src/skill/)

```typescript
export class SkillReader {
  /**
   * 讀取 skill，優先 SKILL.md
   */
  async readSkill(dirPath: string): Promise<ParsedSkill> {
    const skillMdPath = path.join(dirPath, 'SKILL.md');
    const skillYamlPath = path.join(dirPath, 'skill.yaml');

    if (await exists(skillMdPath)) {
      return this.parseSkillMd(skillMdPath);
    }

    if (await exists(skillYamlPath)) {
      console.warn('⚠️ skill.yaml is deprecated, consider migrating to SKILL.md');
      return this.parseSkillYaml(skillYamlPath);
    }

    throw new Error('No SKILL.md or skill.yaml found');
  }

  /**
   * 解析 SKILL.md (frontmatter + content)
   */
  private async parseSkillMd(filePath: string): Promise<ParsedSkill> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);  // gray-matter

    return {
      metadata: this.validateMetadata(data),
      content: content.trim(),
      rawContent: raw,
      source: 'SKILL.md'
    };
  }
}
```

### 2. SkillWriter (packages/core/src/skill/)

```typescript
export class SkillWriter {
  /**
   * 產生 SKILL.md 模板
   */
  generateTemplate(name: string, options?: TemplateOptions): string {
    const metadata = {
      name: this.normalizeName(name),
      version: '1.0.0',
      description: options?.description || 'A helpful skill'
    };

    const content = `# ${this.toTitleCase(name)}

Add your skill instructions here...

## Usage

Describe how to use this skill.

## Examples

Provide usage examples.
`;

    return matter.stringify(content, metadata);
  }

  /**
   * 寫入 SKILL.md
   */
  async writeSkill(
    dirPath: string,
    metadata: SkillMetadata,
    content: string
  ): Promise<void> {
    const filePath = path.join(dirPath, 'SKILL.md');
    const output = matter.stringify(content, metadata);
    await fs.writeFile(filePath, output, 'utf-8');
  }
}
```

### 3. Syncer 簡化

```typescript
// 之前
async syncSkill(skill: Skill, targetDir: string) {
  // 轉換 skill.yaml → SKILL.md
  const content = this.convertToSkillMd(skill);
  await fs.writeFile(path.join(targetDir, 'SKILL.md'), content);
}

// 之後
async syncSkill(skill: ParsedSkill, targetDir: string) {
  // 直接複製
  await fs.writeFile(
    path.join(targetDir, 'SKILL.md'),
    skill.rawContent
  );
}
```

## 遷移策略

### Phase 1: 支援雙格式 (v0.5.0)

```
SKILL.md ──優先──► 讀取
skill.yaml ──備援──► 讀取（顯示警告）
```

### Phase 2: 新建一律 SKILL.md (v0.5.0)

```bash
skillpkg init
# 只產生 SKILL.md
```

### Phase 3: 提供遷移工具 (v0.6.0)

```bash
skillpkg migrate
# 將 skill.yaml 轉換為 SKILL.md
# 刪除 skill.yaml
```

### Phase 4: 移除 skill.yaml 支援 (v1.0.0)

```
僅支援 SKILL.md
```

## 檔案變更

```
packages/core/src/
├── skill/
│   ├── reader.ts         ← 更新（支援 SKILL.md）
│   ├── writer.ts         ← 新增
│   └── types.ts          ← 更新（ParsedSkill）
├── syncer/
│   └── syncer.ts         ← 簡化（直接複製）
└── index.ts              ← 導出新功能

packages/cli/src/
├── commands/
│   ├── init.ts           ← 更新（產生 SKILL.md）
│   └── migrate.ts        ← 新增
└── index.ts
```

## 依賴

```json
{
  "gray-matter": "^4.0.3"  // 解析 frontmatter
}
```

gray-matter 已是常用套件，可以解析 YAML frontmatter。
