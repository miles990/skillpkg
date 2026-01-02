import { describe, it, expect } from 'vitest';
import { VERSION, SCHEMA_VERSION } from '../index.js';

describe('Core module', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });

  it('should export SCHEMA_VERSION', () => {
    expect(SCHEMA_VERSION).toBe('1.0');
  });
});
