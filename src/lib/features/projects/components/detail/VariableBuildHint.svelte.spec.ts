import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetRateLimit } from '$lib/api/rate-limit';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import {
	baseProject,
	personalWorkspace,
	PROJECT_ID
} from '../../../../../../tests/e2e/fixtures/project-detail';
import { VARIABLE_BUILD_COPY } from '../../presentation';
import EnvironmentVariablesTab from './EnvironmentVariablesTab.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Body = Record<string, unknown>;

const PREFIXES = ['NEXT_PUBLIC_', 'NUXT_PUBLIC_', 'VITE_', 'PUBLIC_'];

const variableChanges = (overrides: Body = {}) => ({
	requires_build: false,
	reason: null,
	build_time_prefixes: PREFIXES,
	build_time_keys: ['NODE_ENV'],
	...overrides
});

const stack = (framework: string | null, provider = 'node') => ({
	builder: 'railpack',
	provider,
	framework,
	package_manager: 'npm',
	monorepo: null
});

const staticSite = {
	...baseProject,
	stack: stack('vite'),
	variable_changes: variableChanges({ requires_build: true, reason: 'static_site' })
};
const nextApp = {
	...baseProject,
	stack: stack('next'),
	variable_changes: variableChanges({ requires_build: true, reason: 'prerender_framework' })
};
const expressServer = {
	...baseProject,
	stack: stack('express'),
	variable_changes: variableChanges()
};
const unknownStack = {
	...baseProject,
	stack: stack(null, 'shell'),
	variable_changes: variableChanges({ requires_build: true, reason: 'unknown_stack' })
};

const API_URL = {
	id: 1,
	key: 'API_URL',
	value: 'https://api.toko.test',
	is_secret: false,
	created_at: '2026-01-01T00:00:00Z'
};

let project: Body;

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function answer(request: Request): Response {
	const { pathname } = new URL(request.url);
	if (pathname === '/sanctum/csrf-cookie') return new Response(null, { status: 204 });
	if (pathname === '/api/v1/app/workspaces') {
		return json(200, {
			data: [{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 }]
		});
	}
	if (pathname.endsWith('/environment-variables')) return json(200, { data: [API_URL] });
	return json(200, { data: project });
}

const renderTab = () =>
	render(QueryTestHost, {
		props: { component: EnvironmentVariablesTab, props: { projectId: PROJECT_ID } }
	});
const hint = () => page.getByTestId('variable-build-hint');
const addSave = () => page.getByRole('button', { name: 'Simpan', exact: true });

async function openAdd(key: string) {
	await page.getByRole('button', { name: 'Tambah variabel' }).click();
	await page.getByLabelText('Nama variabel').fill(key);
}

beforeEach(() => {
	project = expressServer;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
});

describe('Variabel tab, what the next redeploy does', () => {
	it('says a static site builds, and the save button reads it', async () => {
		project = staticSite;
		await renderTab();
		await openAdd('API_URL');

		await expect.element(hint()).toHaveTextContent(VARIABLE_BUILD_COPY.staticSite);
		await expect.element(hint()).toHaveAttribute('data-needs-build', 'true');
		await expect.element(addSave()).toHaveAccessibleDescription(VARIABLE_BUILD_COPY.staticSite);
	});

	it('names Next.js when editing a variable of a prerendering app', async () => {
		project = nextApp;
		await renderTab();
		await page.getByRole('button', { name: 'Ubah API_URL' }).click();

		const expected =
			'Perubahan ini butuh build ulang karena Next.js bisa membuat halaman saat build, jadi nilai variabel ikut tersimpan di hasil build.';
		await expect.element(hint()).toHaveTextContent(expected);
		await expect
			.element(page.getByRole('button', { name: 'Simpan perubahan' }))
			.toHaveAccessibleDescription(expected);
	});

	it('on a plain server, follows the name typed: a runtime key reuses, a prefix builds', async () => {
		await renderTab();
		await openAdd('API_URL');
		await expect.element(hint()).toHaveTextContent(VARIABLE_BUILD_COPY.reuse);
		await expect.element(hint()).toHaveAttribute('data-needs-build', 'false');

		await page.getByLabelText('Nama variabel').fill('vite_api_url');
		const expected = VARIABLE_BUILD_COPY.buildTimePrefix('VITE_');
		// The name field writes upper case, so a lower-case paste still matches the prefix.
		await expect.element(hint()).toHaveTextContent(expected);
		await expect.element(addSave()).toHaveAccessibleDescription(expected);
	});

	it('is honest when Sakala cannot read the stack', async () => {
		project = unknownStack;
		await renderTab();
		await openAdd('API_URL');

		await expect.element(hint()).toHaveTextContent(VARIABLE_BUILD_COPY.unknownStack);
	});

	it('decides a pasted .env as a batch: one build-time key makes it build', async () => {
		await renderTab();
		await page.getByRole('button', { name: 'Tempel dari .env' }).click();
		await page
			.getByRole('textbox', { name: 'Isi file .env' })
			.fill('SECRET_KEY=abc\nNEXT_PUBLIC_URL=https://x');

		const expected = VARIABLE_BUILD_COPY.buildTimePrefix('NEXT_PUBLIC_');
		await expect.element(hint()).toHaveTextContent(expected);
		await expect
			.element(page.getByRole('button', { name: 'Simpan 2 variabel' }))
			.toHaveAccessibleDescription(expected);

		await page
			.getByRole('textbox', { name: 'Isi file .env' })
			.fill('SECRET_KEY=abc\nMAIL_HOST=smtp');
		await expect.element(hint()).toHaveTextContent(VARIABLE_BUILD_COPY.reuse);
	});

	it('says it in the delete confirmation too', async () => {
		project = staticSite;
		await renderTab();
		await page.getByRole('button', { name: 'Hapus API_URL' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Hapus variabel' }))
			.toHaveAccessibleDescription(VARIABLE_BUILD_COPY.staticSite);
	});

	it('reaches the save button by keyboard with the hint as its description', async () => {
		await renderTab();
		page.getByRole('button', { name: 'Tambah variabel' }).element().focus();
		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByLabelText('Nama variabel')).toHaveFocus();
		await userEvent.keyboard('NODE_ENV');
		await userEvent.tab();
		await userEvent.keyboard('production');
		await userEvent.tab();

		await expect.element(addSave()).toHaveFocus();
		await expect
			.element(addSave())
			.toHaveAccessibleDescription(VARIABLE_BUILD_COPY.buildTimeKey('NODE_ENV'));
	});

	it('says nothing without a live image to reuse, rather than promise a restart', async () => {
		project = { ...expressServer, active_deployment_id: null };
		await renderTab();
		await openAdd('API_URL');

		await expect.element(hint()).not.toBeInTheDocument();
		await expect.element(addSave()).toHaveAccessibleDescription('');
	});

	it('keeps the old prefix rule with an older API, and says nothing else', async () => {
		project = { ...baseProject };
		await renderTab();
		await openAdd('API_URL');
		await expect.element(hint()).not.toBeInTheDocument();

		await page.getByLabelText('Nama variabel').fill('VITE_API_URL');
		await expect.element(hint()).toHaveTextContent(VARIABLE_BUILD_COPY.buildTimePrefix('VITE_'));
	});

	it('says the database variables never build, even on a static site', async () => {
		project = {
			...staticSite,
			databases: [
				{
					id: 'db-1',
					name: 'toko-db',
					status: 'ready',
					region: null,
					variables: ['DATABASE_URL', 'DB_HOST'],
					overridden_variables: []
				}
			]
		};
		await renderTab();

		await expect
			.element(page.getByTestId('database-variables-build'))
			.toHaveTextContent(VARIABLE_BUILD_COPY.database);
	});
});
