import { isDocsBaseUrl, isEmailAddress, isHttpUrl, type PublicConfigKey } from './runtime';

/**
 * Where the Console sends people for documents it does not publish itself: the guides, the legal
 * documents, and the address for appeals. sakala-landing publishes them for the hosted service. A
 * self-hosted installation names its own through the `PUBLIC_*` settings below when the container
 * starts (./runtime.ts), because its operator publishes their own terms and may host their own
 * docs. Unlike the API and Reverb settings, the build does not read them: an image whose container
 * sets none links to the hosted documents.
 *
 * A setting that is missing, empty, or not valid keeps the hosted value, so the hosted Console
 * links exactly where it always did.
 */
export const SITE_LINK_DEFAULTS = {
	PUBLIC_DOCS_URL: 'https://sakala.dev/docs',
	PUBLIC_TERMS_URL: 'https://sakala.dev/syarat',
	PUBLIC_ACCEPTABLE_USE_URL: 'https://sakala.dev/penggunaan-wajar',
	PUBLIC_PRIVACY_URL: 'https://sakala.dev/privasi',
	PUBLIC_ABUSE_EMAIL: 'abuse@sakala.dev'
} as const satisfies Partial<Record<PublicConfigKey, string>>;

export type SiteLinkKey = keyof typeof SITE_LINK_DEFAULTS;
export type SiteLinkValues = Partial<Record<SiteLinkKey, string | undefined>>;

const validators: Record<SiteLinkKey, (value: string) => boolean> = {
	PUBLIC_DOCS_URL: isDocsBaseUrl,
	PUBLIC_TERMS_URL: isHttpUrl,
	PUBLIC_ACCEPTABLE_USE_URL: isHttpUrl,
	PUBLIC_PRIVACY_URL: isHttpUrl,
	PUBLIC_ABUSE_EMAIL: isEmailAddress
};

/**
 * Pages of sakala-landing's docs (`src/content/docs/`), relative to `PUBLIC_DOCS_URL`. Their
 * anchors are the pages' headings, so a self-hosted copy of the docs keeps them.
 */
export const DOCS_PAGES = {
	firstDeploy: 'deploy-pertama',
	deployFailure: 'deploy-gagal',
	fileStorage: 'penyimpanan-file',
	managedBuckets: 'bucket-terkelola',
	releaseCommand: 'perintah-rilis',
	roadmap: 'proyek/roadmap'
} as const;

export type DocsPage = (typeof DOCS_PAGES)[keyof typeof DOCS_PAGES];

export interface SiteLinks {
	/** The docs base, without a trailing slash. */
	docsUrl: string;
	legal: { terms: string; acceptableUse: string; privacy: string };
	abuseEmail: string;
}

function pick(values: SiteLinkValues, key: SiteLinkKey): string {
	const value = values[key]?.trim();
	if (!value) return SITE_LINK_DEFAULTS[key];
	if (validators[key](value)) return value;
	console.warn(`Ignoring ${key}: the value is not valid, using ${SITE_LINK_DEFAULTS[key]}.`);
	return SITE_LINK_DEFAULTS[key];
}

export function resolveSiteLinks(values: SiteLinkValues): SiteLinks {
	return {
		docsUrl: pick(values, 'PUBLIC_DOCS_URL').replace(/\/+$/, ''),
		legal: {
			terms: pick(values, 'PUBLIC_TERMS_URL'),
			acceptableUse: pick(values, 'PUBLIC_ACCEPTABLE_USE_URL'),
			privacy: pick(values, 'PUBLIC_PRIVACY_URL')
		},
		abuseEmail: pick(values, 'PUBLIC_ABUSE_EMAIL')
	};
}

/** One page of the docs under `docsUrl`, or one of its sections. */
export function docsPageUrl(docsUrl: string, page: DocsPage, anchor?: string | null): string {
	const url = `${docsUrl}/${page}`;
	return anchor ? `${url}#${anchor}` : url;
}
