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
      type: 'array',
      items: { type: 'string' },
      description: 'Trigger words to activate the skill',
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
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Skill dependencies with version ranges',
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
  triggers: 'Trigger words to activate the skill',
  capabilities: 'Required capabilities (file:read, shell:execute, etc.)',
  platforms: 'Platform-specific configurations',
  dependencies: 'Skill dependencies with version ranges',
};
