/**
 * Ids of settings tab fields that other pages link to (`/projects/{id}/settings#releaseCommand`).
 * The project overview's next steps land on them, so they stay stable.
 */
export const SETTINGS_ANCHORS = {
	releaseCommand: 'releaseCommand',
	autoDeploy: 'auto-deploy',
	replicas: 'replicas'
} as const;

/** Ids on the Variabel tab that other pages link to (`/projects/{id}/environments#isi-dari-env-example`). */
export const VARIABLES_ANCHORS = {
	/** Opens the suggestions from the repository's `.env.example`. */
	envExample: 'isi-dari-env-example'
} as const;
