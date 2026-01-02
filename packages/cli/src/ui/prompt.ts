/**
 * Prompt utilities using inquirer
 */
import inquirer from 'inquirer';

export type PromptQuestion = {
  type: 'input' | 'password' | 'confirm' | 'list' | 'checkbox';
  name: string;
  message: string;
  default?: unknown;
  choices?: Array<{ name: string; value: unknown } | string>;
  validate?: (input: unknown) => boolean | string;
};

/**
 * Create an interactive prompt
 */
export async function createPrompt<T extends Record<string, unknown>>(
  questions: PromptQuestion[]
): Promise<T> {
  return inquirer.prompt(questions as Parameters<typeof inquirer.prompt>[0]) as Promise<T>;
}

/**
 * Simple confirm prompt
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { result } = await createPrompt<{ result: boolean }>([
    {
      type: 'confirm',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

/**
 * Simple input prompt
 */
export async function input(
  message: string,
  defaultValue?: string
): Promise<string> {
  const { result } = await createPrompt<{ result: string }>([
    {
      type: 'input',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

/**
 * Simple password prompt
 */
export async function password(message: string): Promise<string> {
  const { result } = await createPrompt<{ result: string }>([
    {
      type: 'password',
      name: 'result',
      message,
    },
  ]);
  return result;
}

/**
 * Simple list selection prompt
 */
export async function select<T>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  const { result } = await createPrompt<{ result: T }>([
    {
      type: 'list',
      name: 'result',
      message,
      choices,
    },
  ]);
  return result;
}
