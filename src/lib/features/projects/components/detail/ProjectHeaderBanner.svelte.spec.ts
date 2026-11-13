import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from 'svelte-sonner';
import { PROJECT_WAKE_LIMIT_EXCEEDED } from '$lib/api/errors';
import { resetRateLimit } from '$lib/api/rate-limit';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import {
	baseProject,
	personalWorkspace,
	PROJECT_ID
} from '../../../../../../tests/e2e/fixtures/project-detail';
import ProjectHeaderBannerTestHost from './ProjectHeaderBannerTestHost.svelte';

type Handler = (payload: unknown) => void;
const channels = vi.hoisted(() => new Map<string, Set<(payload: unknown) => void>>());

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: (_name: unknown, events: Record<string, Handler>) => {
		for (const [name, handler] of Object.entries(events)) {
			if (!channels.has(name)) channels.set(name, new Set());
			channels.get(name)?.add(handler);
		}
	}
}));
vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const sleepingProject = { ...baseProject, runtime_status: 'sleeping' };
const counts = { projects_count: 1, active_deployments_count: 0 };
const ownWorkspace = { ...personalWorkspace, ...counts };
const teamWorkspace = {
	id: '01a1cb4a-de55-72db-b810-80611beec465',
	name: 'Kelas Web',
	slug: 'kelas-web',
	type: 'team',
	role: 'viewer',
	limit_profile: null,
	...counts,
	created_at: '2026-01-01T00:00:00+00:00'
};

const pilotLimits = {
	quotas: {
		max_projects_per_user: 5,
		max_active_deployments_per_user: 2,
		max_active_deployments_per_project: 1,
		current_projects_count: 1,
		current_active_deployments_count: 0,
		max_active_containers: 3,
		current_active_containers_count: 3
	},
	runtime_defaults: { memory_mb: 256, cpu_millis: 500, pids_limit: 128 },
	timeouts: { build_timeout_seconds: 600, start_timeout_seconds: 60, command_timeout_seconds: 60 },
	deleted_project_retention_days: 30,
	project_idle_sleep_minutes: 30
};

type Reply = { status: number; body?: unknown };

let project: Record<string, unknown>;
let workspaces: unknown[];
let wakeReply: () => Reply;
let wakeCalls: number;

function json({ status, body }: Reply) {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function answer(request: Request): Response {
	const { pathname } = new URL(request.url);
	if (pathname === '/sanctum/csrf-cookie') return new Response(null, { status: 204 });
	if (pathname === '/api/v1/app/workspaces')
		return json({ status: 200, body: { data: workspaces } });
	if (pathname === '/api/v1/app/pilot-limits')
		return json({ status: 200, body: { data: pilotLimits } });
	if (pathname.endsWith('/deployments')) {
		return json({
			status: 200,
			body: {
				data: [],
				meta: { current_page: 1, from: null, last_page: 1, per_page: 6, to: null, total: 0 }
			}
		});
	}
	if (pathname.endsWith('/wake') && request.method === 'POST') {
		wakeCalls += 1;
		return json(wakeReply());
	}
	return json({ status: 200, body: { data: project } });
}

function emit(name: string, payload: unknown) {
	for (const handler of channels.get(name) ?? []) handler(payload);
}

const renderBanner = () =>
	render(QueryTestHost, {
		props: { component: ProjectHeaderBannerTestHost, props: { projectId: PROJECT_ID } }
	});

beforeEach(() => {
	channels.clear();
	realtimeState.status = 'connected';
	project = { ...sleepingProject };
	workspaces = [ownWorkspace];
	wakeCalls = 0;
	wakeReply = () => ({ status: 202, body: { data: sleepingProject } });
	vi.mocked(toast.success).mockClear();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
});

describe('ProjectHeaderBanner, a sleeping project', () => {
	it('says Tidur, explains it calmly with the workspace window, and keeps the URL', async () => {
		await renderBanner();

		await expect.element(page.getByText('Tidur', { exact: true })).toBeVisible();
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(
				'Proyek ini sedang tidur karena tidak ada pengunjung selama 30 menit. Ini normal: proyek menyala lagi saat URL-nya dibuka.'
			);
		await expect
			.element(page.getByTestId('project-public-url'))
			.toHaveAttribute('href', baseProject.public_url);
		await expect.element(page.getByRole('button', { name: 'Bangunkan' })).toBeEnabled();
	});

	it('Bangunkan asks the API once, says so, and shows Live when the node reports', async () => {
		await renderBanner();
		const button = page.getByRole('button', { name: 'Bangunkan' });

		await button.click();

		await expect.poll(() => wakeCalls).toBe(1);
		await expect.poll(() => vi.mocked(toast.success).mock.calls.length).toBe(1);
		expect(vi.mocked(toast.success).mock.calls[0][0]).toContain('sedang dibangunkan');
		await expect.element(page.getByRole('button', { name: 'Membangunkan...' })).toBeDisabled();

		project = { ...baseProject, runtime_status: 'running' };
		emit('.deployment.updated', {
			sequence: 1,
			project_runtime_status: 'running',
			deployment_id: baseProject.active_deployment_id,
			status: 'succeeded'
		});

		await expect.element(page.getByText('Live', { exact: true })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Bangunkan|Membangunkan/ }))
			.not.toBeInTheDocument();
		expect(wakeCalls).toBe(1);
	});

	it('a full workspace says which limit and how full it is', async () => {
		wakeReply = () => ({
			status: 409,
			body: {
				message: 'Proyek ini belum bisa dibangunkan.',
				code: PROJECT_WAKE_LIMIT_EXCEEDED,
				limit: 3,
				current: 3
			}
		});
		await renderBanner();

		await page.getByRole('button', { name: 'Bangunkan' }).click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent(
				'Batas aplikasi aktif workspace sudah penuh, 3 dari 3. Coba lagi setelah ada proyek lain yang tidur atau dihapus.'
			);
		await expect.element(page.getByRole('button', { name: 'Bangunkan' })).toBeEnabled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('a viewer sees the notice and the URL, but no Bangunkan', async () => {
		workspaces = [ownWorkspace, teamWorkspace];
		project = {
			...sleepingProject,
			workspace: {
				id: teamWorkspace.id,
				name: teamWorkspace.name,
				slug: teamWorkspace.slug,
				type: 'team'
			}
		};
		await renderBanner();

		await expect.element(page.getByTestId('read-only-notice')).toBeVisible();
		await expect.element(page.getByText('Tidur', { exact: true })).toBeVisible();
		await expect.element(page.getByTestId('project-public-url')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Bangunkan' })).not.toBeInTheDocument();
	});
});
