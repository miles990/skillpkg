/**
 * Registry authentication module
 */
import { readFile, writeFile, chmod, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

/**
 * Auth token data
 */
export interface AuthToken {
  token: string;
  registry: string;
  createdAt: string;
  expiresAt?: string;
  username?: string;
}

/**
 * Auth file structure
 */
interface AuthFile {
  tokens: Record<string, AuthToken>;
}

/**
 * Get auth file path
 */
function getAuthPath(): string {
  return join(homedir(), '.skillpkg', 'auth.json');
}

/**
 * Load auth file
 */
async function loadAuthFile(): Promise<AuthFile> {
  const authPath = getAuthPath();

  if (!existsSync(authPath)) {
    return { tokens: {} };
  }

  try {
    const content = await readFile(authPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { tokens: {} };
  }
}

/**
 * Save auth file with secure permissions (600)
 */
async function saveAuthFile(auth: AuthFile): Promise<void> {
  const authPath = getAuthPath();
  const dir = dirname(authPath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Write file
  await writeFile(authPath, JSON.stringify(auth, null, 2), 'utf-8');

  // Set secure permissions (readable/writable only by owner)
  try {
    await chmod(authPath, 0o600);
  } catch {
    // Ignore permission errors on Windows
  }
}

/**
 * Get token for a registry URL
 */
export async function getToken(registryUrl: string): Promise<string | null> {
  const auth = await loadAuthFile();
  const normalizedUrl = normalizeRegistryUrl(registryUrl);
  const tokenData = auth.tokens[normalizedUrl];

  if (!tokenData) {
    return null;
  }

  // Check if token is expired
  if (tokenData.expiresAt) {
    const expiresAt = new Date(tokenData.expiresAt);
    if (expiresAt < new Date()) {
      // Token expired, remove it
      delete auth.tokens[normalizedUrl];
      await saveAuthFile(auth);
      return null;
    }
  }

  return tokenData.token;
}

/**
 * Save token for a registry URL
 */
export async function setToken(
  registryUrl: string,
  token: string,
  options?: {
    expiresIn?: number; // seconds
    username?: string;
  }
): Promise<void> {
  const auth = await loadAuthFile();
  const normalizedUrl = normalizeRegistryUrl(registryUrl);

  const tokenData: AuthToken = {
    token,
    registry: normalizedUrl,
    createdAt: new Date().toISOString(),
    username: options?.username,
  };

  if (options?.expiresIn) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + options.expiresIn);
    tokenData.expiresAt = expiresAt.toISOString();
  }

  auth.tokens[normalizedUrl] = tokenData;
  await saveAuthFile(auth);
}

/**
 * Remove token for a registry URL
 */
export async function removeToken(registryUrl: string): Promise<boolean> {
  const auth = await loadAuthFile();
  const normalizedUrl = normalizeRegistryUrl(registryUrl);

  if (!auth.tokens[normalizedUrl]) {
    return false;
  }

  delete auth.tokens[normalizedUrl];
  await saveAuthFile(auth);
  return true;
}

/**
 * Get all saved tokens
 */
export async function listTokens(): Promise<AuthToken[]> {
  const auth = await loadAuthFile();
  return Object.values(auth.tokens);
}

/**
 * Check if authenticated for a registry
 */
export async function isAuthenticated(registryUrl: string): Promise<boolean> {
  const token = await getToken(registryUrl);
  return token !== null;
}

/**
 * Get username for a registry
 */
export async function getUsername(registryUrl: string): Promise<string | null> {
  const auth = await loadAuthFile();
  const normalizedUrl = normalizeRegistryUrl(registryUrl);
  return auth.tokens[normalizedUrl]?.username ?? null;
}

/**
 * Normalize registry URL (remove trailing slash, ensure https)
 */
function normalizeRegistryUrl(url: string): string {
  let normalized = url.trim();

  // Add https if no protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
