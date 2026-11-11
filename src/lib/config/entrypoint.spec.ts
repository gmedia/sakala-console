import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as headers from '../../../docker/security-headers.mjs';
import { readRuntimeConfig } from './runtime';

const { buildContentSecurityPolicy, buildPolicyTemplate, renderBuildEnv, renderCaddySnippet } =
	headers as {
		buildContentSecurityPolicy: (input: {
			env: Record<string, string | undefined>;
			scriptHashes: string[];
		}) => string;
		buildPolicyTemplate: (scriptHashes: string[]) => string;
		renderBuildEnv: (env: Record<string, string | undefined>) => string;
		renderCaddySnippet: (policy: string) => string;
	};

const entrypoint = resolve('docker/entrypoint.sh');
const scriptHashes = ["'sha256-abc='"];

// What the hosted image is built with: the published image must keep serving exactly this.
const builtWith = {
	PUBLIC_API_URL: 'https://api.sakala.dev',
	PUBLIC_APP_URL: 'https://app.sakala.dev',
	PUBLIC_REVERB_HOST: 'api.sakala.dev',
	PUBLIC_REVERB_PORT: '443',
	PUBLIC_REVERB_SCHEME: 'https',
	PUBLIC_REVERB_KEY: 'built-key'
};

const DEFAULT_CONFIG = 'window.__SAKALA_RUNTIME_CONFIG__ = {};\n';

let root: string;

function startContainer(env: Record<string, string>) {
	const result = spawnSync('sh', [entrypoint, 'true'], {
		encoding: 'utf8',
		env: {
			PATH: process.env.PATH ?? '/usr/bin:/bin',
			SAKALA_CONSOLE_TEMPLATE_DIR: join(root, 'template'),
			SAKALA_CONSOLE_RUNTIME_DIR: join(root, 'run'),
			SAKALA_CONSOLE_DEFAULT_CONFIG: join(root, 'runtime-config.js'),
			SAKALA_CONSOLE_DEFAULT_HEADERS: join(root, 'security-headers.caddy'),
			...env
		}
	});
	const read = (name: string) => readFileSync(join(root, 'run', name), 'utf8');
	return { ...result, read };
}

function browserConfig(script: string) {
	const window: Record<string, unknown> = {};
	runInNewContext(script, { window });
	return readRuntimeConfig(window);
}

const policyOf = (snippet: string) => snippet.split('\n').find((line) => line.startsWith('header'));

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'console-entrypoint-'));
	spawnSync('mkdir', ['-p', join(root, 'template')]);
	writeFileSync(
		join(root, 'template', 'csp.caddy.template'),
		renderCaddySnippet(buildPolicyTemplate(scriptHashes))
	);
	writeFileSync(join(root, 'template', 'build.env'), renderBuildEnv(builtWith));
	writeFileSync(join(root, 'runtime-config.js'), DEFAULT_CONFIG);
	writeFileSync(
		join(root, 'security-headers.caddy'),
		renderCaddySnippet(buildContentSecurityPolicy({ env: builtWith, scriptHashes }))
	);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('docker/entrypoint.sh', () => {
	it('serves the build-time files unchanged when the container sets nothing', () => {
		const container = startContainer({});
		expect(container.status).toBe(0);
		expect(container.read('runtime-config.js')).toBe(DEFAULT_CONFIG);
		expect(container.read('security-headers.caddy')).toBe(
			readFileSync(join(root, 'security-headers.caddy'), 'utf8')
		);
	});

	it('points the console and its policy at another installation', () => {
		const selfHosted = {
			PUBLIC_API_URL: 'https://api.example.com',
			PUBLIC_APP_URL: 'https://app.example.com',
			PUBLIC_REVERB_HOST: 'api.example.com',
			PUBLIC_REVERB_PORT: '443',
			PUBLIC_REVERB_SCHEME: 'https',
			PUBLIC_REVERB_KEY: 'self-hosted-key'
		};
		const container = startContainer(selfHosted);

		expect(container.status, container.stderr).toBe(0);
		expect(browserConfig(container.read('runtime-config.js'))).toEqual(selfHosted);
		// The same policy the build would have written for these values.
		expect(policyOf(container.read('security-headers.caddy'))).toBe(
			policyOf(renderCaddySnippet(buildContentSecurityPolicy({ env: selfHosted, scriptHashes })))
		);
		expect(container.stderr).toContain(
			'API https://api.example.com, realtime wss://api.example.com:443'
		);
	});

	it('keeps build-time values for every setting the container leaves out', () => {
		const container = startContainer({ PUBLIC_API_URL: 'http://API.Example.test:8000/base' });

		expect(container.status, container.stderr).toBe(0);
		expect(browserConfig(container.read('runtime-config.js'))).toEqual({
			...builtWith,
			PUBLIC_API_URL: 'http://API.Example.test:8000/base'
		});
		const policy = policyOf(container.read('security-headers.caddy'));
		expect(policy).toContain(
			"connect-src 'self' http://api.example.test:8000 wss://api.sakala.dev:443"
		);
		expect(policy).not.toContain('https://api.sakala.dev');
	});

	it('switches realtime off with an empty key and opens no socket in the policy', () => {
		const container = startContainer({
			PUBLIC_API_URL: 'https://api.example.com:443',
			PUBLIC_REVERB_KEY: ''
		});

		expect(container.status, container.stderr).toBe(0);
		expect(browserConfig(container.read('runtime-config.js')).PUBLIC_REVERB_KEY).toBe('');
		const policy = policyOf(container.read('security-headers.caddy'));
		expect(policy).toContain("connect-src 'self' https://api.example.com;");
		expect(policy).not.toContain('__SAKALA_');
		expect(container.stderr).toContain('realtime off');
	});

	it.each([
		['PUBLIC_API_URL', 'ftp://api.example.com', /http:\/\/ or https:\/\//],
		['PUBLIC_API_URL', 'javascript:alert(1)', /http:\/\/ or https:\/\//],
		['PUBLIC_API_URL', 'https://api.example.com"; script-src *', /not allowed/],
		['PUBLIC_API_URL', 'https://:8000', /host name/],
		['PUBLIC_API_URL', 'https://api.example.com:99999', /port/],
		['PUBLIC_API_URL', '', /PUBLIC_API_URL is empty/],
		['PUBLIC_APP_URL', 'app.example.com', /http:\/\/ or https:\/\//],
		['PUBLIC_REVERB_HOST', 'x"; script-src *', /host name/],
		['PUBLIC_REVERB_PORT', 'abc', /port/],
		['PUBLIC_REVERB_SCHEME', 'wss', /http or https/],
		['PUBLIC_REVERB_KEY', 'a key', /letters, digits/]
	])('refuses to start with %s=%j', (key, value, message) => {
		const container = startContainer({ [key]: value });
		expect(container.status).toBe(1);
		expect(container.stderr).toMatch(message);
	});
});
