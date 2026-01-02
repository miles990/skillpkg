import { describe, it, expect } from 'vitest';
import { parse, stringify, parseAndValidate, validate } from '../index.js';

// Valid skill.yaml content
const validSkillYaml = `
schema: "1.0"
name: test-skill
version: "1.0.0"
description: A test skill for unit testing
instructions: |
  # Test Skill

  This is a test skill for unit testing.

  ## Usage

  Use this skill to test the parser.
author:
  name: Test Author
  email: test@example.com
triggers:
  - test
  - testing
capabilities:
  - file:read
  - shell:execute
platforms:
  claude-code:
    allowed-tools:
      - Read
      - Write
`;

// Minimal valid skill
const minimalSkillYaml = `
schema: "1.0"
name: minimal-skill
version: "0.1.0"
description: Minimal skill
instructions: Do something
`;

describe('Parser', () => {
  describe('parse()', () => {
    it('should parse a valid skill.yaml', () => {
      const result = parse(validSkillYaml);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('test-skill');
      expect(result.data?.version).toBe('1.0.0');
      expect(result.data?.triggers).toEqual(['test', 'testing']);
      expect(result.data?.capabilities).toEqual(['file:read', 'shell:execute']);
    });

    it('should parse a minimal skill.yaml', () => {
      const result = parse(minimalSkillYaml);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('minimal-skill');
    });

    it('should include warnings for best practices', () => {
      const result = parse(minimalSkillYaml);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      // Should warn about missing author
      expect(result.warnings?.some((w) => w.includes('author'))).toBe(true);
    });

    it('should return errors for invalid YAML syntax', () => {
      const invalidYaml = `
schema: "1.0"
name: test
  invalid: indentation
`;
      const result = parse(invalidYaml);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('YAML_SYNTAX');
    });

    it('should return errors for missing required fields', () => {
      const missingFields = `
schema: "1.0"
name: test-skill
`;
      const result = parse(missingFields);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.message.includes('version'))).toBe(true);
    });

    it('should return errors for invalid name format', () => {
      const invalidName = `
schema: "1.0"
name: InvalidName
version: "1.0.0"
description: Test
instructions: Test
`;
      const result = parse(invalidName);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.message.includes('name'))).toBe(true);
    });

    it('should return errors for invalid version format', () => {
      const invalidVersion = `
schema: "1.0"
name: test-skill
version: "1.0"
description: Test
instructions: Test
`;
      const result = parse(invalidVersion);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.message.includes('version'))).toBe(true);
    });

    it('should return errors for invalid capability', () => {
      const invalidCapability = `
schema: "1.0"
name: test-skill
version: "1.0.0"
description: Test
instructions: Test
capabilities:
  - invalid:capability
`;
      const result = parse(invalidCapability);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should allow skipping validation', () => {
      const missingFields = `
schema: "1.0"
name: test-skill
`;
      const result = parse(missingFields, { validate: false });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle empty content', () => {
      const result = parse('');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle null content', () => {
      const result = parse('null');

      expect(result.success).toBe(false);
      expect(result.errors?.[0].message).toContain('object');
    });
  });

  describe('validate()', () => {
    it('should validate a valid skill object', () => {
      const skill = {
        schema: '1.0',
        name: 'test-skill',
        version: '1.0.0',
        description: 'Test description',
        instructions: 'Test instructions',
      };

      const result = validate(skill);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid skill', () => {
      const invalidSkill = {
        schema: '1.0',
        name: 'InvalidName', // Invalid: not kebab-case
        version: '1.0.0',
        description: 'Test',
        instructions: 'Test',
      };

      const result = validate(invalidSkill);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return warnings for best practices', () => {
      const skill = {
        schema: '1.0',
        name: 'test-skill',
        version: '1.0.0',
        description: 'Test description',
        instructions: 'Test instructions',
      };

      const result = validate(skill);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject unknown fields', () => {
      const skillWithUnknown = {
        schema: '1.0',
        name: 'test-skill',
        version: '1.0.0',
        description: 'Test',
        instructions: 'Test',
        unknownField: 'value',
      };

      const result = validate(skillWithUnknown);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('unknownField'))).toBe(true);
    });
  });

  describe('stringify()', () => {
    it('should stringify a skill object to YAML', () => {
      const skill = {
        schema: '1.0',
        name: 'test-skill',
        version: '1.0.0',
        description: 'Test description',
        instructions: 'Test instructions',
      };

      const yaml = stringify(skill);

      expect(yaml).toContain('schema: "1.0"');
      expect(yaml).toContain('name:');
      expect(yaml).toContain('test-skill');
      expect(yaml).toContain('version: "1.0.0"');
    });

    it('should be able to round-trip parse and stringify', () => {
      const result = parse(validSkillYaml);
      expect(result.success).toBe(true);

      const yaml = stringify(result.data!);
      const reparsed = parse(yaml);

      expect(reparsed.success).toBe(true);
      expect(reparsed.data?.name).toBe(result.data?.name);
      expect(reparsed.data?.version).toBe(result.data?.version);
    });
  });

  describe('parseAndValidate()', () => {
    it('should return skill and validation result', () => {
      const result = parseAndValidate(validSkillYaml);

      expect(result.skill).toBeDefined();
      expect(result.validation.valid).toBe(true);
      expect(result.parseErrors).toBeUndefined();
    });

    it('should return parse errors for invalid YAML', () => {
      const result = parseAndValidate('{ invalid: yaml: syntax }');

      expect(result.skill).toBeNull();
      expect(result.parseErrors).toBeDefined();
    });

    it('should return null skill for validation errors', () => {
      const invalidSkill = `
schema: "1.0"
name: InvalidName
version: "1.0.0"
description: Test
instructions: Test
`;
      const result = parseAndValidate(invalidSkill);

      expect(result.skill).toBeNull();
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Edge cases', () => {
  it('should handle single character name (invalid)', () => {
    const result = parse(`
schema: "1.0"
name: x
version: "1.0.0"
description: Test
instructions: Test
`);
    expect(result.success).toBe(false);
  });

  it('should handle very long description (invalid)', () => {
    const longDesc = 'x'.repeat(501);
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0"
description: ${longDesc}
instructions: Test
`);
    expect(result.success).toBe(false);
  });

  it('should handle special characters in instructions', () => {
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0"
description: Test
instructions: |
  # Title

  \`\`\`javascript
  const x = "hello";
  \`\`\`

  <tag>content</tag>
`);
    expect(result.success).toBe(true);
    expect(result.data?.instructions).toContain('```javascript');
  });

  it('should handle author as string', () => {
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0"
description: Test
instructions: Test
author: John Doe
`);
    expect(result.success).toBe(true);
    expect(result.data?.author).toBe('John Doe');
  });

  it('should handle author as object', () => {
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0"
description: Test
instructions: Test
author:
  name: John Doe
  email: john@example.com
`);
    expect(result.success).toBe(true);
    expect(result.data?.author).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  it('should handle prerelease versions', () => {
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0-beta.1"
description: Test
instructions: Test
`);
    expect(result.success).toBe(true);
    expect(result.data?.version).toBe('1.0.0-beta.1');
  });

  it('should handle build metadata in versions', () => {
    const result = parse(`
schema: "1.0"
name: test-skill
version: "1.0.0+build.123"
description: Test
instructions: Test
`);
    expect(result.success).toBe(true);
    expect(result.data?.version).toBe('1.0.0+build.123');
  });
});
