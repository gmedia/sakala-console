import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { resetRateLimit } from '$lib/api/rate-limit';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { getDomainFixture } from '$lib/testing/domain-fixtures';
import {
	baseProject,
	personalWorkspace
} from '../../../../../../tests/e2e/fixtures/project-detail';
import { SETTINGS_HELP_LINKS, SETTINGS_PANEL_COPY } from '../../settings-panel';
import type { Project } from '../../type';
import ProjectSettingsPanel from './ProjectSettingsPanel.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));

type Body = Record<string, unknown>;

let workspace: Body;
let domains: Body[];

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** The limits captured with custom domains on, plus workers and schedules on. */
function limitsBody() {
	const body = getDomainFixture('pilot-limits-domains').body as { data: Body };
	return {
		data: {
			...body.data,
			workers: { enabled: true },
			schedules: { ...(body.data.schedules as Body), enabled: true }
		}
	};
}

function answer(request: Request): Response {
	const { pathname } = new URL(request.url);
	if (pathname === '/api/v1/app/workspaces') {
		return json(200, {
			data: [{ ...workspace, projects_count: 1, active_deployments_count: 0 }]
		});
	}
	if (pathname.endsWith('/pilot-limits')) return json(200, limitsBody());
	if (pathname.endsWith('/domains')) return json(200, { data: domains });
	if (pathname.endsWith('/processes') || pathname.endsWith('/schedules')) {
		return json(200, { data: [] });
	}
	if (pathname.endsWith('/deployments')) {
		return json(200, {
			data: [],
			meta: { current_page: 1, from: null, last_page: 1, per_page: 6, to: null, total: 0 }
		});
	}
	return json(404, { message: 'Not found' });
}

const laravelProject = {
	...baseProject,
	stack: { builder: 'railpack', provider: 'php', framework: 'laravel' }
} as unknown as Project;

function renderPanel(options: { project?: Project; isDirty?: boolean; flags?: boolean } = {}) {
	const flags = options.flags ?? true;
	return render(QueryTestHost, {
		props: {
			component: ProjectSettingsPanel,
			props: {
				project: options.project ?? laravelProject,
				isDirty: options.isDirty ?? false,
				limits: parsePilotLimitsResponse(limitsBody()),
				workers: flags,
				schedules: flags
			}
		}
	});
}

const panel = () => page.getByTestId('settings-summary');

beforeEach(() => {
	workspace = personalWorkspace;
	domains = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
});

describe('ProjectSettingsPanel', () => {
	it('sums up status, address, branch, and port', async () => {
		renderPanel();

		await expect.element(panel()).toBeVisible();
		await expect.element(page.getByTestId('settings-summary-status')).toHaveTextContent('Live');
		await expect
			.element(page.getByTestId('settings-summary-address'))
			.toHaveTextContent('toko-kopi-web.sakala.app');
		await expect.element(page.getByTestId('settings-summary-port')).toHaveTextContent('3000');
		await expect.element(page.getByTestId('settings-summary-unsaved')).not.toBeInTheDocument();
	});

	it('marks unsaved changes with a badge and one sentence', async () => {
		renderPanel({ isDirty: true });

		await expect
			.element(page.getByTestId('settings-summary-unsaved'))
			.toHaveTextContent(`${SETTINGS_PANEL_COPY.unsaved} ${SETTINGS_PANEL_COPY.unsavedNote}`);
	});

	it('shows a serving custom domain as the address, with the Sakala one beside it', async () => {
		domains = [{ ...(getDomainFixture('domain-check-verified').body as { data: Body }).data }];
		renderPanel();

		await expect
			.element(page.getByTestId('settings-summary-address'))
			.toHaveTextContent('www.kopi-senja.com');
		await expect.element(panel().getByText(SETTINGS_PANEL_COPY.sakalaAddress)).toBeVisible();
	});

	it('links up to three next steps that apply, each to its place on the page', async () => {
		renderPanel();

		const links = page.getByTestId('settings-next-steps').getByRole('link');
		await expect.element(links.nth(0)).toHaveTextContent('Atur release command');
		await expect.element(links.nth(0)).toHaveAttribute('href', '#releaseCommand');
		await expect.element(links.nth(1)).toHaveAttribute('href', '#domain');
		await expect.element(links.nth(2)).toHaveAttribute('href', '#proses');
		expect(links.all()).toHaveLength(3);
	});

	it('suggests nothing about features the installation has off', async () => {
		renderPanel({ project: baseProject as unknown as Project, flags: false });

		await expect.element(page.getByTestId('settings-summary-status')).toBeVisible();
		await expect.element(page.getByTestId('settings-next-steps')).not.toBeInTheDocument();
		const requested = vi
			.mocked(fetch)
			.mock.calls.map(([input]) => new URL(String(input instanceof Request ? input.url : input)));
		expect(requested.some((url) => /\/(processes|schedules)$/.test(url.pathname))).toBe(false);
	});

	it('gives a viewer the summary and guides, without next steps', async () => {
		const team = { ...personalWorkspace, id: 'team-workspace', type: 'team', role: 'viewer' };
		workspace = team;
		renderPanel({
			project: {
				...laravelProject,
				workspace: { id: team.id, name: team.name, slug: team.slug, type: team.type }
			} as Project
		});

		await expect.element(page.getByTestId('settings-help')).toBeVisible();
		await expect.element(page.getByTestId('settings-next-steps')).not.toBeInTheDocument();
	});

	it('opens every guide in a new tab, named for screen readers', async () => {
		renderPanel();

		for (const link of SETTINGS_HELP_LINKS) {
			const anchor = page
				.getByTestId('settings-help')
				.getByRole('link', { name: `${link.label} (tab baru)` });
			await expect.element(anchor).toHaveAttribute('href', link.href);
			await expect.element(anchor).toHaveAttribute('target', '_blank');
		}
	});
});
