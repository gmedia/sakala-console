/** The public repository of this Console. */
export const REPOSITORY_URL = 'https://github.com/gmedia/sakala-console';

/** Published by sakala-landing. The versions a person accepts come from `GET auth/options`. */
export const LEGAL_LINKS = {
	terms: 'https://sakala.dev/syarat',
	acceptableUse: 'https://sakala.dev/penggunaan-wajar',
	privacy: 'https://sakala.dev/privasi'
} as const;

/** Published by sakala-landing: the guide to a first deploy, linked from the sidebar and onboarding. */
export const DEPLOY_GUIDE_URL = 'https://sakala.dev/docs/deploy-pertama';

/** Where the owner of a suspended project appeals. */
export const ABUSE_EMAIL = 'abuse@sakala.dev';

/**
 * The hosted service runs Sakala Edge in front of every node (ADR-019), so the project overview
 * draws it between the address and the node. A self-hosted install without Edge would show a hop
 * it does not have; making this a runtime setting is a follow-up.
 */
export const SAKALA_EDGE_IN_FRONT = true;
