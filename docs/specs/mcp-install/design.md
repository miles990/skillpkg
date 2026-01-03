# MCP 配置管理設計文件

## 設計理念

**MCP 不需要預先安裝** - Claude Code 透過 `npx -y` 自動下載執行。
skillpkg 只需管理配置，不需要 npm registry 驗證。

## 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                      skillpkg CLI                           │
│                                                             │
│  skillpkg mcp add      skillpkg mcp list                   │
│  skillpkg mcp remove   skillpkg mcp update                 │
│  skillpkg sync                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      skillpkg-core                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ConfigManager (擴展)                    │   │
│  │                                                      │   │
│  │  既有:                    新增:                      │   │
│  │  - getSkills()           - getMcp()                 │   │
│  │  - setSkills()           - setMcp()                 │   │
│  │                          - addMcp()                 │   │
│  │                          - removeMcp()              │   │
│  │                          - updateMcp()              │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Syncer (擴展)                           │   │
│  │                                                      │   │
│  │  既有:                    新增:                      │   │
│  │  - syncSkillsToTarget()  - syncMcpToTarget()        │   │
│  │                          - generateMcpConfig()      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Target Platforms                         │
│                                                             │
│  ~/.claude.json                                             │
│  {                                                          │
│    "mcpServers": { ... }  ← MCP 配置                        │
│  }                                                          │
│                                                             │
│  .claude/skills/           ← Skills (既有)                  │
└─────────────────────────────────────────────────────────────┘
```

## 資料結構

### McpConfig (skillpkg.json 中的 MCP 配置)

```typescript
interface McpConfig {
  // npm 套件模式
  package?: string;      // e.g., "@context7/mcp-server"
  version?: string;      // e.g., "1.0.0" (可選，無則用最新)

  // 或自訂命令模式
  command?: string;      // e.g., "node"
  args?: string[];       // e.g., ["./my-mcp.js"]

  // 共用
  env?: Record<string, string>;  // 環境變數
}

// skillpkg.json
interface SkillpkgConfig {
  name: string;
  version?: string;
  skills: Record<string, string>;
  mcp?: Record<string, McpConfig>;  // 新增，可選
  sync_targets?: Record<string, boolean>;
}
```

### MCP Target 配置

```typescript
interface McpTargetConfig {
  id: string;
  displayName: string;
  configPath: string;           // e.g., ~/.claude.json
  configFormat: 'json' | 'yaml';
  mcpKey: string;               // e.g., "mcpServers"
}

const MCP_TARGETS: Record<string, McpTargetConfig> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    configPath: '~/.claude.json',
    configFormat: 'json',
    mcpKey: 'mcpServers'
  }
  // 未來: cursor, vscode-continue, etc.
};
```

### 產生的 MCP Server Entry

```typescript
// 從 McpConfig 產生平台配置
function generateMcpEntry(name: string, config: McpConfig): object {
  if (config.package) {
    // npm 套件模式
    const pkg = config.version
      ? `${config.package}@${config.version}`
      : config.package;
    return {
      command: 'npx',
      args: ['-y', pkg],
      ...(config.env && { env: config.env })
    };
  } else {
    // 自訂命令模式
    return {
      command: config.command,
      args: config.args,
      ...(config.env && { env: config.env })
    };
  }
}
```

## 模組擴展

### 1. ConfigManager 擴展 (packages/core/src/config/)

```typescript
// 新增方法
export class ConfigManager {
  // 既有方法...

  // MCP 相關
  getMcp(): Record<string, McpConfig>;

  addMcp(name: string, config: McpConfig): void;

  removeMcp(name: string): boolean;

  updateMcp(name: string, config: Partial<McpConfig>): void;

  hasMcp(name: string): boolean;
}
```

### 2. Syncer 擴展 (packages/core/src/syncer/)

```typescript
// 新增方法
export class Syncer {
  // 既有方法...

  // MCP 同步
  async syncMcpToTarget(
    mcpConfigs: Record<string, McpConfig>,
    target: McpTargetConfig,
    options?: SyncOptions
  ): Promise<McpSyncResult>;

  // 產生 MCP 配置
  generateMcpConfig(
    mcpConfigs: Record<string, McpConfig>,
    target: McpTargetConfig
  ): Record<string, object>;

  // 合併到現有配置
  async mergeMcpConfig(
    targetPath: string,
    mcpKey: string,
    newConfig: Record<string, object>
  ): Promise<void>;
}
```

### 3. CLI 命令 (packages/cli/src/commands/mcp.ts)

```typescript
// skillpkg mcp add <source> [--as name] [--command cmd] [--args args]
export async function mcpAddCommand(
  source: string,
  options: { as?: string; command?: string; args?: string }
);

// skillpkg mcp list [--json]
export async function mcpListCommand(options: { json?: boolean });

// skillpkg mcp remove <name>
export async function mcpRemoveCommand(name: string);

// skillpkg mcp update [name] [--version ver]
export async function mcpUpdateCommand(
  name?: string,
  options: { version?: string }
);
```

## 流程圖

### Add 流程

```
skillpkg mcp add @context7/mcp-server --as context7
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 1. 解析來源                              │
│    - 分析是 npm 套件還是自訂命令         │
│    - 提取套件名稱和版本（如有）          │
└─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 2. 決定名稱                              │
│    - 有 --as: 使用指定名稱              │
│    - 無 --as: 從套件名推斷              │
│      @context7/mcp-server → context7    │
│      skillpkg-mcp-server → skillpkg     │
└─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 3. 建立 McpConfig                        │
│    {                                    │
│      "package": "@context7/mcp-server"  │
│    }                                    │
└─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 4. 更新 skillpkg.json                    │
│    configManager.addMcp("context7", config)│
└─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 5. 提示同步                              │
│    "Run 'skillpkg sync' to update       │
│     ~/.claude.json"                     │
└─────────────────────────────────────────┘
```

### Sync 流程

```
skillpkg sync
      │
      ▼
┌─────────────────────────────────────────┐
│ 1. 載入 skillpkg.json                    │
│    - skills: { ... }                    │
│    - mcp: { ... }                       │
│    - sync_targets: { claude-code: true }│
└─────────────────────────────────────────┘
      │
      ├──────────────────────────────────────┐
      ▼                                      ▼
┌─────────────────────┐          ┌─────────────────────┐
│ 2a. 同步 Skills     │          │ 2b. 同步 MCP        │
│ → .claude/skills/   │          │ → ~/.claude.json    │
│ (既有邏輯)          │          │ (新增邏輯)          │
└─────────────────────┘          └─────────────────────┘
      │                                      │
      └──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────┐
│ 3. 顯示結果                              │
│    ✓ Synced 3 skills to .claude/skills/ │
│    ✓ Synced 2 MCP servers to ~/.claude.json│
└─────────────────────────────────────────┘
```

## 名稱推斷邏輯

```typescript
function inferMcpName(source: string): string {
  // @scope/package-name → package-name (去 -mcp-server 後綴)
  // @context7/mcp-server → context7
  // skillpkg-mcp-server → skillpkg
  // @anthropic/mcp-server-github → github

  const match = source.match(/(?:@[\w-]+\/)?([\w-]+?)(?:-mcp-server|-mcp)?$/);
  return match ? match[1] : source;
}
```

## 錯誤處理

| 錯誤情況 | 處理方式 |
|----------|----------|
| 名稱已存在 | 提示使用 --force 覆蓋 |
| 無 skillpkg.json | 提示執行 `skillpkg init` |
| 目標配置檔無法寫入 | 顯示權限錯誤 |
| 環境變數未設定 | sync 時警告但不阻擋 |

## 與既有模組的關係

```
packages/core/src/
├── config/
│   ├── config-manager.ts  ← 擴展 (getMcp, addMcp, etc.)
│   └── schema.ts          ← 更新 (加入 mcp 欄位)
├── syncer/
│   ├── syncer.ts          ← 擴展 (syncMcpToTarget)
│   └── targets.ts         ← 新增 MCP_TARGETS
└── index.ts               ← 導出新功能
```
