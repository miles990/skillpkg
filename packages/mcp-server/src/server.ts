/**
 * SkillpkgMcpServer - MCP Server implementation
 *
 * Provides MCP tools for AI agents to manage skills.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerOptions, ToolHandler, ToolResult } from './types.js';

export class SkillpkgMcpServer {
  private options: ServerOptions;
  private tools: Map<string, ToolHandler> = new Map();
  private server: Server | null = null;
  private transport: StdioServerTransport | null = null;
  private running = false;

  constructor(options: ServerOptions = {}) {
    this.options = {
      scope: options.scope || 'local',
      projectPath: options.projectPath || process.cwd(),
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Log to stderr to avoid MCP protocol interference
    console.error('[skillpkg-mcp] Starting MCP server...');

    // Initialize MCP Server
    this.server = new Server(
      {
        name: 'skillpkg',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: { listChanged: true },
        },
      }
    );

    // Register request handlers
    this.setupRequestHandlers();

    // Start stdio transport
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);

    this.running = true;
    console.error('[skillpkg-mcp] Server started');
  }

  /**
   * Setup MCP request handlers
   */
  private setupRequestHandlers(): void {
    if (!this.server) return;

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map((handler) => ({
        name: handler.name,
        description: handler.description,
        inputSchema: handler.inputSchema,
      }));

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<CallToolResult> => {
        const { name, arguments: args } = request.params;

        const handler = this.tools.get(name);
        if (!handler) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown tool "${name}". Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        try {
          const result = await handler.execute(args);
          return result as CallToolResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.error('[skillpkg-mcp] Stopping server...');

    if (this.server) {
      await this.server.close();
      this.server = null;
    }

    this.transport = null;
    this.running = false;
    console.error('[skillpkg-mcp] Server stopped');
  }

  /**
   * Register a tool handler
   */
  registerTool(handler: ToolHandler): void {
    this.tools.set(handler.name, handler);
  }

  /**
   * Register multiple tool handlers
   */
  registerTools(handlers: ToolHandler[]): void {
    for (const handler of handlers) {
      this.registerTool(handler);
    }
  }

  /**
   * Get registered tools
   */
  getTools(): ToolHandler[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get server options
   */
  getOptions(): ServerOptions {
    return { ...this.options };
  }

  /**
   * Create error result
   */
  static createErrorResult(message: string): ToolResult {
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }

  /**
   * Create success result
   */
  static createSuccessResult(data: unknown): ToolResult {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return {
      content: [{ type: 'text', text }],
    };
  }
}
