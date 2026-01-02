/**
 * Spinner utilities with ora
 */
import ora, { type Ora } from 'ora';

/**
 * Create a spinner instance
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: 'dots',
  });
}

/**
 * Run an async task with a spinner
 */
export async function withSpinner<T>(
  text: string,
  task: () => Promise<T>,
  options: {
    successText?: string;
    failText?: string;
  } = {}
): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await task();
    spinner.succeed(options.successText || text);
    return result;
  } catch (error) {
    spinner.fail(options.failText || text);
    throw error;
  }
}
