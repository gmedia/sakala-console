import { readRuntimeConfig } from './runtime';
import { DOCS_PAGES, docsPageUrl, resolveSiteLinks } from './site-links';

/** The public repository of this Console. */
export const REPOSITORY_URL = 'https://github.com/gmedia/sakala-console';

// Only the container sets these (./runtime.ts); the build has no say, and nothing set means the
// hosted links (./site-links.ts). Not read through `$env`, which component tests cannot load.
const siteLinks = resolveSiteLinks(readRuntimeConfig());

/**
 * Published by sakala-landing for the hosted service, or by the operator of a self-hosted one. The
 * versions a person accepts come from `GET auth/options`.
 */
export const LEGAL_LINKS = siteLinks.legal;

/** The guide to a first deploy, linked from the sidebar and onboarding. */
export const DEPLOY_GUIDE_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.firstDeploy);

/**
 * sakala-landing's `src/content/docs/deploy-gagal.md`: what each failure code means and how to fix
 * it. Its headings are the codes, so `#runtime_app_crashed` lands on one.
 */
export const DEPLOY_FAILURE_GUIDE_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.deployFailure);

/** sakala-landing's guide to the release command, the one the setting's help points at. */
export const RELEASE_COMMAND_DOCS_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.releaseCommand);

/**
 * Horizon D of the public roadmap lists custom domains; the domain card says so instead of offering
 * one.
 */
export const CUSTOM_DOMAIN_ROADMAP_URL = docsPageUrl(
	siteLinks.docsUrl,
	DOCS_PAGES.roadmap,
	'horizon-d--operasi-yang-andal'
);

/**
 * sakala-landing's `src/content/docs/penyimpanan-file.md`: files an app writes inside its container
 * are lost when the container stops, and where to keep them instead. The anchors are its headings.
 */
export const FILE_STORAGE_GUIDE_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.fileStorage);
export const FILE_STORAGE_GUIDE_ANCHORS = {
	laravel: 'laravel',
	node: 'node',
	sqlite: 'berkas-sqlite'
} as const;

export type FileStorageGuideAnchor =
	(typeof FILE_STORAGE_GUIDE_ANCHORS)[keyof typeof FILE_STORAGE_GUIDE_ANCHORS];

/** The guide, or one of its sections. */
export function fileStorageGuideUrl(anchor?: FileStorageGuideAnchor | null): string {
	return docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.fileStorage, anchor);
}

/**
 * sakala-landing's `src/content/docs/bucket-terkelola.md` (ADR-021): what a managed bucket gives,
 * the injected variables, presigned URLs, rotation, limits, and backup. `meminta-kuota` is its
 * section on opening buckets for a workspace.
 */
export const BUCKET_GUIDE_ANCHORS = { requestQuota: 'meminta-kuota', laravel: 'laravel' } as const;
export type BucketGuideAnchor = (typeof BUCKET_GUIDE_ANCHORS)[keyof typeof BUCKET_GUIDE_ANCHORS];

export function bucketGuideUrl(anchor?: BucketGuideAnchor | null): string {
	return docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.managedBuckets, anchor);
}

/**
 * sakala-landing's `src/content/docs/database-terkelola.md`: what a managed database gives, the
 * injected variables, migrations, rotation, extensions, limits, and backup.
 */
export const DATABASE_GUIDE_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.managedDatabases);

/**
 * sakala-landing's `src/content/docs/monorepo.md`: which pushes deploy which project of a monorepo,
 * shared files at the root, and force pushes. A skipped push in the history links to its section.
 */
export const MONOREPO_GUIDE_URL = docsPageUrl(
	siteLinks.docsUrl,
	DOCS_PAGES.monorepo,
	'push-di-monorepo'
);

/**
 * sakala-landing's `src/content/docs/variabel-dan-secret.md`: project variables, secrets, the ones
 * Sakala fills in for an attached database, bucket, or Valkey, and when a change needs a build.
 */
export const VARIABLES_GUIDE_URL = docsPageUrl(siteLinks.docsUrl, DOCS_PAGES.variables);

/**
 * sakala-landing's `src/content/docs/batas-pilot.md`: the limits a workspace starts with, what a
 * limit profile changes, and when projects sleep. The workspace page links its first section.
 */
export const WORKSPACE_LIMITS_GUIDE_URL = docsPageUrl(
	siteLinks.docsUrl,
	DOCS_PAGES.pilotLimits,
	'batas-per-workspace'
);

/** Where the owner of a suspended project appeals. */
export const ABUSE_EMAIL = siteLinks.abuseEmail;

/**
 * The hosted service runs Sakala Edge in front of every node (ADR-019), so the project overview
 * draws it between the address and the node. A self-hosted install without Edge would show a hop
 * it does not have; making this a runtime setting is a follow-up.
 */
export const SAKALA_EDGE_IN_FRONT = true;
