#!/usr/bin/env node
/**
 * Writes the Content-Security-Policy that docker/Caddyfile imports. It runs during the image build,
 * right after the bundle, because that is when both inputs exist: the public env file that decides
 * which API and Reverb this image talks to, and the HTML whose inline script needs a hash. So a
 * self-hosted or staging image gets its own origins without a second place to configure them.
 *
 * With a fourth argument it also writes what docker/entrypoint.sh needs to point the same image at
 * another installation when the container starts: `csp.caddy.template`, the same policy with the
 * API and Reverb origins left as placeholders, and `build.env`, the public values this image was
 * built with. Both hold only what the browser already sees.
 *
 * Usage: node docker/security-headers.mjs <env-file> <build-dir> <output-file> [<runtime-template-dir>]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultTreeAdapter as adapter, parse } from 'parse5';

const HOST_PATTERN = /^[a-z0-9.-]+$/i;

/**
 * @param {string | undefined} value
 * @returns {string} the origin, so a path in the setting cannot widen or break the policy
 */
function httpOrigin(value) {
	if (!value) throw new Error('PUBLIC_API_URL is required to build the Content-Security-Policy.');
	const url = new URL(value);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`PUBLIC_API_URL must be http or https, got ${url.protocol}`);
	}
	return url.origin;
}

/**
 * Mirrors src/lib/realtime/env.ts: without a key, realtime is off and no socket is ever opened.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
function reverbOrigin(env) {
	const { PUBLIC_REVERB_KEY: key, PUBLIC_REVERB_HOST: host, PUBLIC_REVERB_PORT: port } = env;
	if (!key || !host) return null;
	if (!HOST_PATTERN.test(host)) throw new Error(`PUBLIC_REVERB_HOST is not a host name: ${host}`);
	if (port && !/^\d+$/.test(port)) throw new Error(`PUBLIC_REVERB_PORT is not a number: ${port}`);
	const scheme = env.PUBLIC_REVERB_SCHEME === 'https' ? 'wss' : 'ws';
	return `${scheme}://${host}${port ? `:${port}` : ''}`;
}

/**
 * SvelteKit starts the app from one inline script, so the policy allows exactly that script.
 *
 * The HTML is parsed the way a browser parses it (parse5 follows the WHATWG spec), so the hash is
 * taken over the same source text the browser hashes, and a comment or an odd closing tag such as
 * `</script >` cannot make the list differ from what the browser runs.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScriptHashes(html) {
	const hashes = new Set();
	for (const script of scriptElements(parse(html))) {
		if (adapter.getAttrList(script).some((attribute) => attribute.name === 'src')) continue;
		const source = adapter
			.getChildNodes(script)
			.filter((child) => adapter.isTextNode(child))
			.map((text) => adapter.getTextNodeContent(text))
			.join('');
		if (!source.trim()) continue;
		hashes.add(`'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`);
	}
	return [...hashes];
}

/**
 * Every script element in document order, including those inside `<template>` content.
 *
 * @param {import('parse5').DefaultTreeAdapterMap['parentNode']} parent
 * @returns {Generator<import('parse5').DefaultTreeAdapterMap['element']>}
 */
function* scriptElements(parent) {
	for (const child of adapter.getChildNodes(parent)) {
		if (!adapter.isElementNode(child)) continue;
		if (adapter.getTagName(child) === 'script') yield child;
		if (adapter.getTagName(child) === 'template') {
			const template = /** @type {import('parse5').DefaultTreeAdapterMap['template']} */ (child);
			yield* scriptElements(adapter.getTemplateContent(template));
		}
		yield* scriptElements(child);
	}
}

/** Stand-ins that docker/entrypoint.sh replaces with origins it has validated. */
export const API_ORIGIN_PLACEHOLDER = '__SAKALA_API_ORIGIN__';
export const REVERB_ORIGIN_PLACEHOLDER = '__SAKALA_REVERB_ORIGIN__';

/**
 * The public values docker/entrypoint.sh may override; nothing else from the env file is kept. The
 * site links (PUBLIC_DOCS_URL and the rest, src/lib/config/site-links.ts) are not here: the build
 * does not read them, so there is no built value to keep.
 */
export const PUBLIC_KEYS = [
	'PUBLIC_API_URL',
	'PUBLIC_APP_URL',
	'PUBLIC_REVERB_HOST',
	'PUBLIC_REVERB_PORT',
	'PUBLIC_REVERB_SCHEME',
	'PUBLIC_REVERB_KEY'
];

/**
 * @param {{ env: Record<string, string | undefined>, scriptHashes: string[] }} input
 * @returns {string}
 */
export function buildContentSecurityPolicy({ env, scriptHashes }) {
	return renderPolicy({
		api: httpOrigin(env.PUBLIC_API_URL),
		reverb: reverbOrigin(env),
		scriptHashes
	});
}

/**
 * The policy with both origins left for docker/entrypoint.sh. The Reverb placeholder always
 * appears, so the entrypoint can drop it when realtime is off.
 *
 * @param {string[]} scriptHashes
 * @returns {string}
 */
export function buildPolicyTemplate(scriptHashes) {
	return renderPolicy({
		api: API_ORIGIN_PLACEHOLDER,
		reverb: REVERB_ORIGIN_PLACEHOLDER,
		scriptHashes
	});
}

/**
 * One `KEY=value` line per public value, unquoted, for a POSIX shell to read without evaluating it.
 * A value the shell could misread is refused, which fails the build instead of the container.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function renderBuildEnv(env) {
	const lines = [];
	for (const key of PUBLIC_KEYS) {
		const value = env[key];
		if (value === undefined) continue;
		if (/[\s"'`$\\]/.test(value))
			throw new Error(`${key} contains a character the entrypoint cannot read.`);
		lines.push(`${key}=${value}`);
	}
	return `${lines.join('\n')}\n`;
}

/**
 * @param {{ api: string, reverb: string | null, scriptHashes: string[] }} input
 * @returns {string}
 */
function renderPolicy({ api, reverb, scriptHashes }) {
	return [
		"default-src 'self'",
		`script-src 'self' ${scriptHashes.join(' ')}`.trim(),
		// Svelte transitions and the positioning of menus set inline styles.
		"style-src 'self' 'unsafe-inline'",
		// Avatars come from GitHub, Google, or wherever the installation stores them.
		`img-src 'self' data: blob: https: ${api}`,
		"font-src 'self'",
		`connect-src ${["'self'", api, reverb].filter(Boolean).join(' ')}`,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'"
	].join('; ');
}

/**
 * @param {string} policy
 * @returns {string}
 */
export function renderCaddySnippet(policy) {
	if (policy.includes('"') || /[\r\n]/.test(policy)) {
		throw new Error('The Content-Security-Policy contains a character Caddy cannot quote.');
	}
	return `# Generated by docker/security-headers.mjs during the image build.\nheader Content-Security-Policy "${policy}"\n`;
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function htmlFiles(directory) {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((file) => file.endsWith('.html'))
		.map((file) => join(directory, file));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [envFile, buildDirectory, outputFile, templateDirectory] = process.argv.slice(2);
	if (!envFile || !buildDirectory || !outputFile) {
		throw new Error(
			'Usage: security-headers.mjs <env-file> <build-dir> <output-file> [<runtime-template-dir>]'
		);
	}

	const scriptHashes = [
		...new Set(
			htmlFiles(buildDirectory).flatMap((file) => inlineScriptHashes(readFileSync(file, 'utf8')))
		)
	];
	const env = parseEnv(readFileSync(envFile, 'utf8'));
	const policy = buildContentSecurityPolicy({ env, scriptHashes });
	writeFileSync(outputFile, renderCaddySnippet(policy));
	console.log(`Content-Security-Policy: ${policy}`);

	if (templateDirectory) {
		mkdirSync(templateDirectory, { recursive: true });
		writeFileSync(
			join(templateDirectory, 'csp.caddy.template'),
			renderCaddySnippet(buildPolicyTemplate(scriptHashes))
		);
		writeFileSync(join(templateDirectory, 'build.env'), renderBuildEnv(env));
	}
}
