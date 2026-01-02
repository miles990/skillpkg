/**
 * login command - Authenticate with a registry
 */
import {
  setToken,
  removeToken,
  isAuthenticated,
  getUsername,
  createRegistryClient,
  DEFAULT_REGISTRY_URL,
} from 'skillpkg-core';
import { logger, colors, createPrompt } from '../ui/index.js';

interface LoginCommandOptions {
  registry?: string;
  token?: string;
}

/**
 * login command handler
 */
export async function loginCommand(options: LoginCommandOptions): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;

  logger.header('Login to Registry');
  logger.log(`Registry: ${colors.cyan(registryUrl)}`);
  logger.blank();

  // Check if already logged in
  if (await isAuthenticated(registryUrl)) {
    const username = await getUsername(registryUrl);
    logger.info(`Already logged in as ${colors.cyan(username || 'unknown')}`);

    const { confirm } = await createPrompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to re-authenticate?',
        default: false,
      },
    ]);

    if (!confirm) {
      return;
    }
  }

  // Get token from option or prompt
  let token = options.token;

  if (!token) {
    logger.log('To get a token, visit:');
    logger.log(`  ${colors.cyan(`${registryUrl}/tokens`)}`);
    logger.blank();

    const answers = await createPrompt<{ token: string }>([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your auth token:',
      },
    ]);
    token = answers.token;
  }

  if (!token || token.trim() === '') {
    logger.error('Token is required');
    process.exit(1);
  }

  // Verify token by making a test request
  logger.info('Verifying token...');

  const client = createRegistryClient({ registryUrl });

  // Check if registry is reachable
  const isOnline = await client.ping();
  if (!isOnline) {
    logger.warn('Could not verify token (registry unreachable)');
    logger.log('Token saved locally. It will be verified on next request.');
  }

  // Save token
  await setToken(registryUrl, token.trim());

  logger.blank();
  logger.success('Successfully logged in!');
  logger.blank();
  logger.log('You can now:');
  logger.item(`${colors.cyan('skillpkg publish')} - Publish skills`);
  logger.item(`${colors.cyan('skillpkg logout')} - Log out`);
  logger.blank();
}

/**
 * logout command handler
 */
export async function logoutCommand(options: { registry?: string }): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;

  logger.header('Logout from Registry');

  if (!(await isAuthenticated(registryUrl))) {
    logger.info('Not currently logged in');
    return;
  }

  const username = await getUsername(registryUrl);
  const removed = await removeToken(registryUrl);

  if (removed) {
    logger.success(`Logged out ${username ? `(${colors.cyan(username)})` : ''}`);
  } else {
    logger.error('Failed to log out');
  }
}

/**
 * whoami command handler - Show current logged in user
 */
export async function whoamiCommand(options: { registry?: string }): Promise<void> {
  const registryUrl = options.registry || DEFAULT_REGISTRY_URL;

  if (!(await isAuthenticated(registryUrl))) {
    logger.log('Not logged in');
    logger.log(`Run ${colors.cyan('skillpkg login')} to authenticate`);
    return;
  }

  const username = await getUsername(registryUrl);
  logger.log(username || 'Logged in (username unknown)');
}
