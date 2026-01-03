# 專案腳手架 - 設計文件

## 設計理念

**最小可用配置** - 快速模式給出能立即使用的預設，互動模式提供客製化選項。

## 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│  skillpkg init [-i]                                         │
│                                                             │
│  ┌─────────────┐     ┌─────────────┐                       │
│  │  快速模式    │     │  互動模式    │                       │
│  │  (預設)     │     │  (-i flag)  │                       │
│  └──────┬──────┘     └──────┬──────┘                       │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌─────────────────────────────────────────┐               │
│  │          ProjectInitializer              │               │
│  │                                          │               │
│  │  - getDefaultConfig()                   │               │
│  │  - promptForOptions() (互動模式)         │               │
│  │  - generate()                           │               │
│  └─────────────────────────────────────────┘               │
│                        │                                    │
│                        ▼                                    │
│                 skillpkg.json                               │
└─────────────────────────────────────────────────────────────┘
```

## 資料結構

### ProjectConfig

```typescript
interface ProjectConfig {
  name: string;
  skills: Record<string, string>;
  mcp: Record<string, McpConfig>;
  sync_targets: Record<string, boolean>;
}

interface McpConfig {
  package?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}
```

### 預設配置

```typescript
const DEFAULT_PROJECT_CONFIG: Partial<ProjectConfig> = {
  skills: {},
  mcp: {
    context7: {
      package: '@context7/mcp-server'
    }
  },
  sync_targets: {
    'claude-code': true
  }
};

const OPTIONAL_MCP: Record<string, McpConfig & { description: string; requiresEnv?: string }> = {
  github: {
    package: '@anthropic/mcp-server-github',
    description: 'GitHub 操作',
    requiresEnv: 'GITHUB_TOKEN'
  },
  filesystem: {
    package: '@anthropic/mcp-server-filesystem',
    description: '檔案系統存取'
  }
};
```

## 模組設計

### ProjectInitializer (packages/core/src/project/)

```typescript
export class ProjectInitializer {
  /**
   * 取得預設配置
   */
  getDefaultConfig(projectName: string): ProjectConfig {
    return {
      name: projectName,
      ...DEFAULT_PROJECT_CONFIG
    };
  }

  /**
   * 互動式取得配置
   */
  async promptForOptions(): Promise<ProjectConfig> {
    const name = await input({ message: '專案名稱:' });

    const includeMcp = await confirm({
      message: '加入推薦 MCP?',
      default: true
    });

    const config = this.getDefaultConfig(name);

    if (includeMcp) {
      // 顯示可選 MCP 列表
      const selected = await checkbox({
        message: '選擇 MCP servers:',
        choices: Object.entries(OPTIONAL_MCP).map(([key, val]) => ({
          name: `${key} - ${val.description}`,
          value: key
        }))
      });

      for (const key of selected) {
        config.mcp[key] = OPTIONAL_MCP[key];
      }
    }

    return config;
  }

  /**
   * 產生 skillpkg.json
   */
  async generate(config: ProjectConfig): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile('skillpkg.json', content);
  }
}
```

### CLI 命令

```typescript
// packages/cli/src/commands/init.ts

program
  .command('init')
  .description('Initialize project configuration (skillpkg.json)')
  .option('-i, --interactive', '互動模式')
  .action(async (options) => {
    const initializer = new ProjectInitializer();

    const config = options.interactive
      ? await initializer.promptForOptions()
      : initializer.getDefaultConfig(path.basename(process.cwd()));

    await initializer.generate(config);

    console.log('✓ Created skillpkg.json');
    console.log('');
    console.log('Next steps:');
    console.log('  skillpkg sync    # Sync to Claude Code');
  });
```

注意：`skillpkg new` 命令用於建立 SKILL.md，見 skill-format spec。

## 檔案變更清單

```
packages/core/src/
├── project/
│   ├── initializer.ts    ← 新增
│   ├── defaults.ts       ← 新增 (預設配置)
│   └── index.ts          ← 新增
└── index.ts              ← 更新導出

packages/cli/src/
├── commands/
│   └── init.ts           ← 更新 (加入 --project)
└── index.ts
```

## 依賴

```json
{
  "@inquirer/prompts": "^5.0.0"  // 互動式詢問
}
```

## 測試策略

1. **單元測試**
   - getDefaultConfig() 返回正確結構
   - generate() 產生有效 JSON

2. **整合測試**
   - `skillpkg init --project` 產生 skillpkg.json
   - `skillpkg sync` 可正常執行
