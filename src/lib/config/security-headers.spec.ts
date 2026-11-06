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
