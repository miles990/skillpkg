/**
 * JSON Schema for skill.yaml validation
 */

/**
 * JSON Schema for skill.yaml
 * Using plain object instead of JSONSchemaType for flexibility
 */
export const skillSchema = {
  type: 'object',
  properties: {
    schema: {
      type: 'string',
      pattern: '^\\d+\\.\\d+$',
      description: 'Schema version (e.g., "1.0")',
    },
    name: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
      minLength: 2,
      maxLength: 100,
      description: 'Unique skill identifier in kebab-case',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$',
      description: 'Semantic version (e.g., "1.0.0")',
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      description: 'Short description of the skill',
    },
    instructions: {
      type: 'string',
      minLength: 1,
      description: 'Markdown instructions for the AI agent',
    },
    author: {
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            url: { type: 'string', format: 'uri' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      ],
      description: 'Author name or object with name, email, url',
    },
    license: {
      type: 'string',
      description: 'License identifier (e.g., "MIT")',
    },
    repository: {
      type: 'string',
      format: 'uri',
      description: 'Repository URL',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keywords for search',
    },
    triggers: {
      oneOf: [
        {
          // Legacy format: simple array of strings
          type: 'array',
          items: { type: 'string' },
        },
        {
          // New format: structured triggers for matching engine
          type: 'object',
          properties: {
            keywords: {
              type: 'object',
              properties: {
                primary: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Primary keywords (weight: 1.0) - direct match triggers',
                },
                secondary: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Secondary keywords (weight: 0.6) - candidate match',
                },
              },
              additionalProperties: false,
            },
            context_boost: {
              type: 'array',
              items: { type: 'string' },
              description: 'Context words that boost score (+0.2 when co-occurring)',
            },
            context_penalty: {
              type: 'array',
              items: { type: 'string' },
              description: 'Context words that reduce score (-0.3 when co-occurring)',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Priority for tie-breaking (default: medium)',
            },
          },
          additionalProperties: false,
        },
      ],
      description: 'Trigger words or structured matching configuration',
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['file:read', 'file:write', 'shell:execute', 'web:search', 'web:fetch', 'mcp:*'],
      },
      description: 'Required capabilities',
    },
    platforms: {
      type: 'object',
      properties: {
        'claude-code': {
          type: 'object',
          properties: {
            'allowed-tools': {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        codex: {
          type: 'object',
          properties: {
            sandbox: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        copilot: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['edit', 'chat'] },
          },
          additionalProperties: false,
        },
        cline: {
          type: 'object',
          properties: {
            customRules: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
      description: 'Platform-specific configurations',
    },
    dependencies: {
      oneOf: [
        {
          // Legacy format: Record<string, string> (name -> version)
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        {
          // New format: { skills?, software-skills?, mcp? }
          type: 'object',
          properties: {
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skill dependencies (names or sources)',
            },
            'software-skills': {
              type: 'array',
              items: { type: 'string' },
              description: 'Software skill dependencies for domain skills (cross-domain)',
            },
            mcp: {
              type: 'array',
              items: { type: 'string' },
              description: 'MCP server dependencies',
            },
          },
          additionalProperties: false,
        },
      ],
      description: 'Skill, software-skill, and MCP dependencies',
    },
  },
  required: ['schema', 'name', 'version', 'description', 'instructions'],
  additionalProperties: false,
} as const;

/**
 * Human-readable field descriptions for error messages
 */
export const fieldDescriptions: Record<string, string> = {
  schema: 'Schema version (e.g., "1.0")',
  name: 'Unique skill identifier in kebab-case (e.g., "my-skill")',
  version: 'Semantic version (e.g., "1.0.0")',
  description: 'Short description of the skill (max 500 chars)',
  instructions: 'Markdown instructions for the AI agent',
  author: 'Author name or object with name, email, url',
  license: 'License identifier (e.g., "MIT")',
  repository: 'Repository URL',
  keywords: 'Keywords for search',
  triggers: 'Trigger words or structured matching config (keywords.primary/secondary, context_boost/penalty, priority)',
  capabilities: 'Required capabilities (file:read, shell:execute, etc.)',
  platforms: 'Platform-specific configurations',
  dependencies: 'Skill, software-skill, and MCP dependencies',
};
