/**
 * Discovery providers - Multi-source skill discovery
 */

export {
  LocalProvider,
  createLocalProvider,
  type LocalProviderOptions,
} from './local.js';

export {
  SkillsmpProvider,
  createSkillsmpProvider,
  SKILLSMP_CONFIG,
  type SkillsmpProviderOptions,
} from './skillsmp.js';

export {
  AwesomeProvider,
  createAwesomeProvider,
  AWESOME_REPOS,
  type AwesomeProviderOptions,
} from './awesome.js';

export {
  GitHubProvider,
  createGitHubProvider,
  type GitHubProviderOptions,
} from './github.js';
