/** The public repository of this Console. */
export const REPOSITORY_URL = 'https://github.com/gmedia/sakala-console';

/** Published by sakala-landing. The versions a person accepts come from `GET auth/options`. */
export const LEGAL_LINKS = {
	terms: 'https://sakala.dev/syarat',
	acceptableUse: 'https://sakala.dev/penggunaan-wajar',
	privacy: 'https://sakala.dev/privasi'
} as const;

/** Where the owner of a suspended project appeals. */
export const ABUSE_EMAIL = 'abuse@sakala.dev';
