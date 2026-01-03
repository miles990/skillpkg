# SKILL.md 統一格式 - 設計文件

## 設計理念

**SKILL.md 是唯一格式** - 不需要轉換，不支援 skill.yaml。
**skillpkg new** - 專門用於建立新 skill。

## 架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                      命令結構                                   │
│                                                                 │
│  skillpkg init        → skillpkg.json（專案配置）               │
│  skillpkg new [name]  → SKILL.md（新建 skill）                  │
│  skillpkg install     → 讀取 SKILL.md                           │
│  skillpkg sync        → 複製 SKILL.md 到目標                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      skillpkg-core                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SkillReader (簡化)                          │   │
│  │                                                          │   │
│  │  readSkill(path):                                       │   │
│  │    - 讀取 SKILL.md                                       │   │
│  │    - 解析 frontmatter + content                         │   │
│  │    - 若無 SKILL.md 則報錯                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SkillCreator (新增)                         │   │
│  │                                                          │   │
│  │  create(name, options):                                 │   │
│  │    - 產生 SKILL.md 模板                                  │   │
│  │    - 可選建立目錄                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Syncer (簡化)                               │   │
│  │                                                          │   │
│  │  syncSkill():                                           │   │
│  │    - 直接複製 SKILL.md                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
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
  author?: string;
  tags?: string[];
  dependencies?: {
    mcp?: McpDependency[];
  };
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
  filePath: string;         // SKILL.md 路徑
}
```

## 模組設計

### 1. SkillReader (packages/core/src/skill/)

```typescript
// 簡化：只讀 SKILL.md
export async function readSkill(dirPath: string): Promise<ParsedSkill> {
  const skillMdPath = path.join(dirPath, 'SKILL.md');

  if (!await exists(skillMdPath)) {
    throw new Error(`SKILL.md not found in ${dirPath}`);
  }

  const raw = await fs.readFile(skillMdPath, 'utf-8');
  const { data, content } = matter(raw);  // gray-matter

  return {
    metadata: validateMetadata(data),
    content: content.trim(),
    rawContent: raw,
    filePath: skillMdPath
  };
}
```

### 2. SkillCreator (packages/core/src/skill/)

```typescript
export interface CreateOptions {
  name: string;
  description?: string;
  createDir?: boolean;  // 是否建立目錄
}

export class SkillCreator {
  /**
   * 建立新 skill
   */
  async create(options: CreateOptions): Promise<string> {
    const { name, description, createDir = true } = options;

    const targetDir = createDir ? name : '.';
    const skillMdPath = path.join(targetDir, 'SKILL.md');

    if (createDir) {
      await fs.mkdir(targetDir, { recursive: true });
    }

    const template = this.generateTemplate(name, description);
    await fs.writeFile(skillMdPath, template);

    return skillMdPath;
  }

  /**
   * 產生 SKILL.md 模板
   */
  generateTemplate(name: string, description?: string): string {
    const metadata = {
      name: this.normalizeName(name),
      version: '1.0.0',
      description: description || 'A helpful skill'
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
}
```

### 3. CLI new 命令

```typescript
// packages/cli/src/commands/new.ts

program
  .command('new [name]')
  .description('Create a new skill (generates SKILL.md)')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (name, options) => {
    const creator = new SkillCreator();

    if (options.interactive || !name) {
      // 互動式詢問
      name = await input({ message: 'Skill name:' });
      const description = await input({ message: 'Description:' });
      await creator.create({ name, description });
    } else {
      await creator.create({ name });
    }

    console.log(`✓ Created ${name}/SKILL.md`);
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${name}`);
    console.log('  Edit SKILL.md with your instructions');
  });
```

### 4. Syncer 簡化

```typescript
// 簡化：直接複製
export async function syncSkill(
  skill: ParsedSkill,
  targetDir: string
): Promise<void> {
  const targetPath = path.join(targetDir, `${skill.metadata.name}.md`);
  await fs.copyFile(skill.filePath, targetPath);
}
```

## 檔案變更清單

```
packages/core/src/
├── skill/
│   ├── reader.ts         ← 簡化（只讀 SKILL.md）
│   ├── creator.ts        ← 新增（取代 writer.ts）
│   └── types.ts          ← 簡化
├── syncer/
│   └── syncer.ts         ← 簡化（直接複製）
└── index.ts              ← 更新導出

packages/cli/src/
├── commands/
│   ├── new.ts            ← 新增
│   └── init.ts           ← 保持（專案配置）
└── cli.ts                ← 註冊 new 命令
```

## 依賴

```json
{
  "gray-matter": "^4.0.3"  // 解析 SKILL.md frontmatter
}
```

## 測試策略

1. **單元測試**
   - readSkill() 讀取 SKILL.md
   - readSkill() 無 SKILL.md 時報錯
   - SkillCreator.create() 產生正確格式

2. **整合測試**
   - `skillpkg new my-skill` 建立目錄和 SKILL.md
   - `skillpkg install ./my-skill` 可讀取
   - `skillpkg sync` 正確複製
