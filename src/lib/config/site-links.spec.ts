import { afterEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_CONFIG_GLOBAL } from './runtime';
import { DOCS_PAGES, SITE_LINK_DEFAULTS, docsPageUrl, resolveSiteLinks } from './site-links';

const selfHosted = {
	PUBLIC_DOCS_URL: 'https://docs.example.com/sakala',
	PUBLIC_TERMS_URL: 'https://example.com/legal/terms',
	PUBLIC_ACCEPTABLE_USE_URL: 'https://example.com/legal?doc=aup',
	PUBLIC_PRIVACY_URL: 'https://example.com/legal#privacy',
	PUBLIC_ABUSE_EMAIL: 'ops@example.com'
};

describe('resolveSiteLinks', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('links to the hosted documents when nothing is set', () => {
		expect(resolveSiteLinks({})).toEqual({
			docsUrl: 'https://sakala.dev/docs',
			legal: {
				terms: 'https://sakala.dev/syarat',
				acceptableUse: 'https://sakala.dev/penggunaan-wajar',
				privacy: 'https://sakala.dev/privasi'
			},
			abuseEmail: 'abuse@sakala.dev'
		});
	});

	it('uses every link the installation names', () => {
		expect(resolveSiteLinks(selfHosted)).toEqual({
			docsUrl: 'https://docs.example.com/sakala',
			legal: {
				terms: 'https://example.com/legal/terms',
				acceptableUse: 'https://example.com/legal?doc=aup',
				privacy: 'https://example.com/legal#privacy'
			},
			abuseEmail: 'ops@example.com'
		});
	});

	it('overrides key by key and keeps the hosted value for the rest', () => {
		const links = resolveSiteLinks({ PUBLIC_PRIVACY_URL: 'https://example.com/privacy' });
		expect(links.legal.privacy).toBe('https://example.com/privacy');
		expect(links.legal.terms).toBe(SITE_LINK_DEFAULTS.PUBLIC_TERMS_URL);
		expect(links.docsUrl).toBe(SITE_LINK_DEFAULTS.PUBLIC_DOCS_URL);
	});

	it('drops trailing slashes from the docs base', () => {
		expect(resolveSiteLinks({ PUBLIC_DOCS_URL: 'https://example.com/docs//' }).docsUrl).toBe(
			'https://example.com/docs'
		);
	});

	it('treats an empty or blank value as unset, without a warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(
			resolveSiteLinks({ PUBLIC_DOCS_URL: '', PUBLIC_TERMS_URL: '  ', PUBLIC_ABUSE_EMAIL: '' })
		).toEqual(resolveSiteLinks({}));
		expect(warn).not.toHaveBeenCalled();
	});

	it('keeps the hosted value for a value that is not valid, and says so', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(
			resolveSiteLinks({
				PUBLIC_DOCS_URL: 'https://example.com/docs?x=1',
				PUBLIC_TERMS_URL: 'javascript:alert(1)',
				PUBLIC_ACCEPTABLE_USE_URL: 'ftp://example.com/aup',
				PUBLIC_PRIVACY_URL: 'example.com/privacy',
				PUBLIC_ABUSE_EMAIL: 'ops@example.com?subject=x'
			})
		).toEqual(resolveSiteLinks({}));
		expect(warn).toHaveBeenCalledTimes(5);
	});
});

describe('docsPageUrl', () => {
	it('appends the page and, when given, the section', () => {
		expect(docsPageUrl('https://sakala.dev/docs', DOCS_PAGES.deployFailure)).toBe(
			'https://sakala.dev/docs/deploy-gagal'
		);
		expect(docsPageUrl('https://docs.example.com', DOCS_PAGES.fileStorage, 'laravel')).toBe(
			'https://docs.example.com/penyimpanan-file#laravel'
		);
		expect(docsPageUrl('https://docs.example.com', DOCS_PAGES.firstDeploy, null)).toBe(
			'https://docs.example.com/deploy-pertama'
		);
	});
});

// $lib/config/project.ts resolves its links once, when it is first imported, so each case imports
// a fresh copy with the runtime config the container would have rendered.
describe('$lib/config/project links', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('keeps every hosted link when the container sets nothing', async () => {
		vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, {});
		const project = await import('./project');

		expect(project.LEGAL_LINKS).toEqual({
			terms: 'https://sakala.dev/syarat',
			acceptableUse: 'https://sakala.dev/penggunaan-wajar',
			privacy: 'https://sakala.dev/privasi'
		});
		expect(project.DEPLOY_GUIDE_URL).toBe('https://sakala.dev/docs/deploy-pertama');
		expect(project.DEPLOY_FAILURE_GUIDE_URL).toBe('https://sakala.dev/docs/deploy-gagal');
		expect(project.FILE_STORAGE_GUIDE_URL).toBe('https://sakala.dev/docs/penyimpanan-file');
		expect(project.fileStorageGuideUrl('berkas-sqlite')).toBe(
			'https://sakala.dev/docs/penyimpanan-file#berkas-sqlite'
		);
		expect(project.RELEASE_COMMAND_DOCS_URL).toBe('https://sakala.dev/docs/perintah-rilis');
		expect(project.CUSTOM_DOMAIN_ROADMAP_URL).toBe(
			'https://sakala.dev/docs/proyek/roadmap#horizon-d--operasi-yang-andal'
		);
		expect(project.ABUSE_EMAIL).toBe('abuse@sakala.dev');
	});

	it('builds every link from the settings the container renders', async () => {
		vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, selfHosted);
		const project = await import('./project');

		expect(project.LEGAL_LINKS).toEqual({
			terms: selfHosted.PUBLIC_TERMS_URL,
			acceptableUse: selfHosted.PUBLIC_ACCEPTABLE_USE_URL,
			privacy: selfHosted.PUBLIC_PRIVACY_URL
		});
		expect(project.DEPLOY_GUIDE_URL).toBe('https://docs.example.com/sakala/deploy-pertama');
		expect(project.DEPLOY_FAILURE_GUIDE_URL).toBe('https://docs.example.com/sakala/deploy-gagal');
		expect(project.fileStorageGuideUrl('node')).toBe(
			'https://docs.example.com/sakala/penyimpanan-file#node'
		);
		expect(project.RELEASE_COMMAND_DOCS_URL).toBe('https://docs.example.com/sakala/perintah-rilis');
		expect(project.CUSTOM_DOMAIN_ROADMAP_URL).toBe(
			'https://docs.example.com/sakala/proyek/roadmap#horizon-d--operasi-yang-andal'
		);
		expect(project.ABUSE_EMAIL).toBe('ops@example.com');
	});
});
