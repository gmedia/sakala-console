import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as headers from '../../../docker/security-headers.mjs';

const { buildContentSecurityPolicy, inlineScriptHashes, renderCaddySnippet } = headers as {
	buildContentSecurityPolicy: (input: {
		env: Record<string, string | undefined>;
		scriptHashes: string[];
	}) => string;
	inlineScriptHashes: (html: string) => string[];
	renderCaddySnippet: (policy: string) => string;
};

const directive = (policy: string, name: string) =>
	policy.split('; ').find((part) => part.startsWith(`${name} `));

/** What the browser computes for an inline script: sha256 over the exact text between the tags. */
const hashOf = (source: string) =>
	`'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;

/** The shape of the inline script adapter-static writes into every page. */
const SVELTEKIT_START = `
				{
					__sveltekit_1x2y3z = {
						base: new URL(".", location).pathname.slice(0, -1)
					};

					const element = document.currentScript.parentElement;

					Promise.all([
						import("./_app/immutable/entry/start.Dk2.js"),
						import("./_app/immutable/entry/app.Bq9.js")
					]).then(([kit, app]) => {
						kit.start(app, element);
					});
				}
			`;

const page = (body: string) =>
	`<!doctype html>\n<html lang="id">\n\t<head>\n\t\t<meta charset="utf-8" />\n\t\t<script src="/runtime-config.js"></script>\n\t</head>\n\t<body>\n\t\t<div style="display: contents">${body}</div>\n\t</body>\n</html>\n`;

describe('Content-Security-Policy for the image', () => {
	const staging = {
		PUBLIC_API_URL: 'https://api.staging.example.org/some/path',
		PUBLIC_REVERB_KEY: 'public-key',
		PUBLIC_REVERB_HOST: 'ws.staging.example.org',
		PUBLIC_REVERB_PORT: '443',
		PUBLIC_REVERB_SCHEME: 'https'
	};

	it('never lets another site frame the console', () => {
		const policy = buildContentSecurityPolicy({ env: staging, scriptHashes: [] });
		expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
	});

	it('names the API and Reverb of this installation, not a fixed one', () => {
		const connect = directive(
			buildContentSecurityPolicy({ env: staging, scriptHashes: [] }),
			'connect-src'
		);
		expect(connect).toBe(
			"connect-src 'self' https://api.staging.example.org wss://ws.staging.example.org:443"
		);
	});

	it('opens no socket when realtime is off, and uses ws on plain http', () => {
		const off = buildContentSecurityPolicy({
			env: { PUBLIC_API_URL: 'http://api.sakala.localhost:8000', PUBLIC_REVERB_KEY: '' },
			scriptHashes: []
		});
		expect(directive(off, 'connect-src')).toBe(
			"connect-src 'self' http://api.sakala.localhost:8000"
		);

		const local = buildContentSecurityPolicy({
			env: {
				PUBLIC_API_URL: 'http://api.sakala.localhost:8000',
				PUBLIC_REVERB_KEY: 'k',
				PUBLIC_REVERB_HOST: 'localhost',
				PUBLIC_REVERB_PORT: '8080',
				PUBLIC_REVERB_SCHEME: 'http'
			},
			scriptHashes: []
		});
		expect(directive(local, 'connect-src')).toContain('ws://localhost:8080');
	});

	it('allows the inline script by hash and no other inline script', () => {
		const hashes = inlineScriptHashes(
			'<script src="/a.js"></script><script>start()</script><script>start()</script><script></script>'
		);
		expect(hashes).toHaveLength(1);
		expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);

		const script = directive(
			buildContentSecurityPolicy({ env: staging, scriptHashes: hashes }),
			'script-src'
		);
		expect(script).toBe(`script-src 'self' ${hashes[0]}`);
		expect(script).not.toContain('unsafe-inline');
	});

	it('fails the image build instead of shipping a policy that blocks the API', () => {
		expect(() => buildContentSecurityPolicy({ env: {}, scriptHashes: [] })).toThrow(
			/PUBLIC_API_URL/
		);
		expect(() =>
			buildContentSecurityPolicy({ env: { PUBLIC_API_URL: 'ftp://x' }, scriptHashes: [] })
		).toThrow(/http or https/);
	});

	it('refuses a Reverb host that would break out of the header', () => {
		expect(() =>
			buildContentSecurityPolicy({
				env: {
					PUBLIC_API_URL: 'https://api.example.org',
					PUBLIC_REVERB_KEY: 'k',
					PUBLIC_REVERB_HOST: 'x"; script-src *'
				},
				scriptHashes: []
			})
		).toThrow(/host name/);
		expect(() => renderCaddySnippet('default-src "x"')).toThrow(/quote/);
	});
});

describe('inline script hashes', () => {
	it('hashes the SvelteKit start script exactly as the browser sees it', () => {
		expect(inlineScriptHashes(page(`<script>${SVELTEKIT_START}</script>`))).toEqual([
			hashOf(SVELTEKIT_START)
		]);
	});

	it('ends the script where the browser ends it, whatever the case or trailing space', () => {
		expect(inlineScriptHashes(page('<script>start()</script >'))).toEqual([hashOf('start()')]);
		expect(inlineScriptHashes(page('<SCRIPT>start()</SCRIPT>'))).toEqual([hashOf('start()')]);
		expect(inlineScriptHashes(page('<Script type="module">start()</sCrIpT\t\n>'))).toEqual([
			hashOf('start()')
		]);
	});

	it('ignores scripts loaded from a file and scripts with nothing to run', () => {
		expect(
			inlineScriptHashes(
				page(
					'<script src="/a.js"></script><script SRC=/b.js>ignored()</script><script></script><script> \n\t</script>'
				)
			)
		).toEqual([]);
	});

	it('lists every distinct inline script once, in document order', () => {
		expect(
			inlineScriptHashes(
				page('<script>first()</script><p><script>second()</script></p><script>first()</script>')
			)
		).toEqual([hashOf('first()'), hashOf('second()')]);
		expect(inlineScriptHashes(page('<template><script>cloned()</script></template>'))).toEqual([
			hashOf('cloned()')
		]);
	});

	it('does not count a script tag written inside a comment or inside another script', () => {
		expect(
			inlineScriptHashes(page('<!-- <script>evil()</script> --><script>start()</script>'))
		).toEqual([hashOf('start()')]);
		const nested = 'const html = "<script>evil()<\\/script>"; start()';
		expect(inlineScriptHashes(page(`<script>${nested}</script>`))).toEqual([hashOf(nested)]);
	});
});
