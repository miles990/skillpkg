/**
 * Registry HTTP client
 */
import type {
  SearchOptions,
  SearchResult,
  SkillInfo,
  PublishOptions,
  PublishResult,
} from './types.js';
import { RegistryError } from './types.js';
import { getToken } from './auth.js';

/**
 * Default registry URL (placeholder - will be configured later)
 */
export const DEFAULT_REGISTRY_URL = 'https://registry.skillpkg.dev';

/**
 * Client options
 */
export interface ClientOptions {
  registryUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Registry client for communicating with skill registries
 */
export class RegistryClient {
  private readonly registryUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly retryDelay: number;

  constructor(options: ClientOptions = {}) {
    this.registryUrl = options.registryUrl || DEFAULT_REGISTRY_URL;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Search for skills in the registry
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const params = new URLSearchParams({
      q: query,
      page: String(options.page || 1),
      limit: String(options.limit || 20),
    });

    if (options.sort) {
      params.set('sort', options.sort);
    }
    if (options.order) {
      params.set('order', options.order);
    }

    const response = await this.request(`/api/v1/skills?${params}`);
    return response as SearchResult;
  }

  /**
   * Get detailed information about a skill
   */
  async getSkillInfo(name: string): Promise<SkillInfo> {
    const response = await this.request(`/api/v1/skills/${encodeURIComponent(name)}`);
    return response as SkillInfo;
  }

  /**
   * Get all versions of a skill
   */
  async getVersions(name: string): Promise<SkillInfo['versions']> {
    const info = await this.getSkillInfo(name);
    return info.versions;
  }

  /**
   * Download a skill tarball
   */
  async download(name: string, version: string = 'latest'): Promise<Buffer> {
    const url = `${this.registryUrl}/api/v1/skills/${encodeURIComponent(name)}/${version}/download`;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Publish a skill to the registry
   */
  async publish(
    tarball: Buffer,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const token = await getToken(this.registryUrl);
    if (!token) {
      throw new RegistryError(
        'Authentication required. Run `skillpkg login` first.',
        'AUTH_REQUIRED',
        401
      );
    }

    const formData = new FormData();
    formData.append('tarball', new Blob([tarball]), 'package.skillpkg');

    if (options.access) {
      formData.append('access', options.access);
    }
    if (options.tag) {
      formData.append('tag', options.tag);
    }

    const response = await this.fetchWithRetry(`${this.registryUrl}/api/v1/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return (await response.json()) as PublishResult;
  }

  /**
   * Unpublish a skill version from the registry
   */
  async unpublish(name: string, version?: string): Promise<void> {
    const token = await getToken(this.registryUrl);
    if (!token) {
      throw new RegistryError(
        'Authentication required. Run `skillpkg login` first.',
        'AUTH_REQUIRED',
        401
      );
    }

    const url = version
      ? `/api/v1/skills/${encodeURIComponent(name)}/${version}`
      : `/api/v1/skills/${encodeURIComponent(name)}`;

    const response = await this.fetchWithRetry(`${this.registryUrl}${url}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }
  }

  /**
   * Check if the registry is reachable
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(`${this.registryUrl}/api/v1/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get registry URL
   */
  getRegistryUrl(): string {
    return this.registryUrl;
  }

  /**
   * Make an authenticated request to the registry
   */
  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const token = await getToken(this.registryUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.fetchWithRetry(`${this.registryUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort (timeout)
        if ((error as Error).name === 'AbortError') {
          throw new RegistryError(
            `Request timeout after ${this.timeout}ms`,
            'TIMEOUT'
          );
        }

        // Wait before retrying
        if (attempt < this.retries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw new RegistryError(
      `Network error after ${this.retries} retries: ${lastError?.message}`,
      'NETWORK_ERROR'
    );
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code = 'HTTP_ERROR';

    try {
      const body = (await response.json()) as { message?: string; code?: string };
      if (body.message) {
        message = body.message;
      }
      if (body.code) {
        code = body.code;
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Map common status codes to specific error codes
    switch (response.status) {
      case 401:
        code = 'AUTH_REQUIRED';
        break;
      case 403:
        code = 'AUTH_FAILED';
        break;
      case 404:
        code = 'SKILL_NOT_IN_REGISTRY';
        break;
      case 409:
        code = 'VERSION_EXISTS';
        break;
      case 429:
        code = 'RATE_LIMITED';
        break;
    }

    throw new RegistryError(message, code, response.status);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new registry client
 */
export function createRegistryClient(options?: ClientOptions): RegistryClient {
  return new RegistryClient(options);
}
