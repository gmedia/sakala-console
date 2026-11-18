import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { resetRateLimit } from '$lib/api/rate-limit';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import {
	baseProject,
	failedDeployment,
	personalWorkspace,
	PROJECT_ID,
	succeededDeployment
} from '../../../../../../tests/e2e/fixtures/project-detail';
import { dismissalStorageKey } from '../../overview/next-steps';
import ProjectOverview from './ProjectOverview.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));

const MIB = 1024 * 1024;
const STEP = 900;
const BASE = `/api/v1/app/projects/${PROJECT_ID}`;

type Body = Record<string, unknown>;

let project: Body;
let deployments: Body[];
let variables: Body[];
let metrics: Body;
let requests: string[];

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const iso = (seconds: number) => new Date(seconds * 1_000).toISOString();

function series(overrides: Body = {}) {
	const now = Math.floor(Date.now() / 1_000);
	const t = (stepsAgo: number) => iso(now - stepsAgo * STEP);
	return {
		data: {
			range: '24h',
			step_seconds: STEP,
			series: {
				cpu_percent: [
					{ t: t(2), avg: 40, max: 150 },
					{ t: t(1), avg: 12.5, max: 30 }
				],
				memory_bytes: [
					{ t: t(2), avg: 200 * MIB, max: 300 * MIB },
					{ t: t(1), avg: 256 * MIB, max: 280 * MIB }
				],
				memory_limit_bytes: 1024 * MIB,
				replicas: [
					{ t: t(2), count: 1 },
					{ t: t(1), count: 1 }
				],
				restarts: [
					{ t: t(2), count: 0 },
					{ t: t(1), count: 2 }
				],
				...overrides
			}
		}
	};
}

const EMPTY_SERIES = {
	cpu_percent: [],
	memory_bytes: [],
	memory_limit_bytes: null,
	replicas: [],
	restarts: []
};

function answer(request: Request): Response {
	const url = new URL(request.url);
	const path = url.pathname;
	requests.push(path);
	if (path === `${BASE}/metrics`) return json(200, metrics);
	if (path === `${BASE}/deployments`) {
		return json(200, {
			data: deployments,
			meta: {
				current_page: 1,
				from: 1,
				last_page: 1,
				per_page: 6,
				to: 1,
				total: deployments.length
			}
		});
	}
	if (path === `${BASE}/environment-variables`) return json(200, { data: variables });
	if (path === '/api/v1/app/workspaces') return json(200, { data: [personalWorkspace] });
	return json(200, { data: project });
}

const renderOverview = () =>
	render(QueryTestHost, {
		props: {
			component: ProjectOverview,
			props: { projectId: PROJECT_ID },
			client: new QueryClient({
				defaultOptions: { queries: { retry: false, staleTime: 30_000 } }
			})
		}
	});

const summary = () => page.getByTestId('topology-summary');
const appNode = () => page.getByTestId('topology-node-app');

beforeEach(() => {
	localStorage.clear();
	project = { ...baseProject };
	deployments = [{ ...succeededDeployment }];
	variables = [
		{ id: 1, key: 'DATABASE_URL', is_secret: true, created_at: '2026-01-01T00:00:00Z' },
		{ id: 2, key: 'APP_KEY', is_secret: true, created_at: '2026-01-01T00:00:00Z' }
	];
	metrics = series();
	requests = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('ProjectOverview, states', () => {
	it('live: the path in words, the boxes in order, and the numbers of the day', async () => {
		await renderOverview();

		await expect
			.element(summary())
			.toHaveTextContent(
				'Pengunjung membuka toko-kopi-web.sakala.app, lalu Sakala Edge meneruskannya ke node di region yang dipilih otomatis, tempat aplikasi berjalan dengan 1 replika di port 3000. Aplikasi memakai 2 environment variable dan belum punya release command.'
			);
		const path = page.getByRole('list', { name: 'Jalur dari alamat ke aplikasi' });
		await expect.element(path).toBeVisible();
		expect(path.getByRole('listitem').all()).toHaveLength(4);
		await expect.element(appNode()).toHaveTextContent('Live');
		await expect.element(page.getByTestId('overview-metric-memory')).toHaveTextContent('256 MiB');
		await expect.element(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '25');
		await expect.element(page.getByTestId('overview-metric-cpu')).toHaveTextContent('12,5%');
		await expect
			.element(page.getByTestId('overview-metric-restarts'))
			.toHaveTextContent('2 kali container dimulai ulang');
		await expect.element(page.getByRole('link', { name: 'Buka (tab baru)' })).toBeVisible();
	});

	it('partial replica health: says how many fail the health check', async () => {
		project = { ...baseProject, replicas: 3, serving_replicas: 3, replicas_ready: 2 };
		await renderOverview();

		await expect.element(appNode()).toHaveTextContent('2/3 replika sehat');
		await expect
			.element(appNode())
			.toHaveTextContent(
				'1 replika belum lolos health check. Pengunjung dilayani replika yang sehat.'
			);
		await expect.element(summary()).toHaveTextContent('2 dari 3 replika sehat');
	});

	it('sleeping: the app box and the sentence say the first visit wakes it', async () => {
		project = { ...baseProject, runtime_status: 'sleeping', serving_replicas: null };
		await renderOverview();

		await expect.element(appNode()).toHaveTextContent('Tidur');
		await expect.element(appNode()).toHaveTextContent('Kunjungan pertama membangunkannya.');
		await expect.element(summary()).toHaveTextContent('tempat aplikasi sedang tidur');
		await expect
			.element(page.getByTestId('overview-metrics'))
			.toHaveTextContent('Selama proyek tidur, metrik tidak dicatat');
		// Opening a sleeping project's address shows the page that wakes it, so the link stays.
		await expect.element(page.getByRole('link', { name: 'Buka (tab baru)' })).toBeVisible();
	});

	it('failed first deploy: nothing serves, and the address cannot be opened yet', async () => {
		project = {
			...baseProject,
			status: 'draft',
			runtime_status: 'failed',
			active_deployment_id: null,
			serving_replicas: null
		};
		deployments = [failedDeployment];
		await renderOverview();

		await expect.element(appNode()).toHaveTextContent('Gagal');
		await expect
			.element(appNode())
			.toHaveTextContent('Deploy terakhir gagal, belum ada versi yang melayani.');
		await expect.element(summary()).toHaveTextContent(/^Setelah deploy pertama berhasil/);
		await expect
			.element(page.getByTestId('overview-domain'))
			.toHaveTextContent('Bisa dibuka setelah deploy pertama berhasil.');
		await expect
			.element(page.getByRole('link', { name: 'Buka (tab baru)' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByTestId('overview-deployment-row')).toHaveTextContent('Gagal');
	});

	it('never deployed: no metrics request, empty history, and suggestions from real state', async () => {
		project = {
			...baseProject,
			status: 'draft',
			runtime_status: 'not_deployed',
			active_deployment_id: null,
			serving_replicas: null,
			auto_deploy: false,
			stack: { builder: 'railpack', provider: 'php', framework: 'laravel', package_manager: null }
		};
		deployments = [];
		await renderOverview();

		await expect.element(appNode()).toHaveTextContent('Belum deploy');
		await expect
			.element(page.getByTestId('overview-metrics'))
			.toHaveTextContent('Metrik muncul beberapa menit setelah aplikasi pertama kali berjalan.');
		await expect
			.element(page.getByTestId('overview-deployments'))
			.toHaveTextContent('Belum ada deployment.');
		await expect.element(page.getByTestId('next-step-release-command')).toBeVisible();
		await expect.element(page.getByTestId('next-step-auto-deploy')).toBeVisible();
		expect(requests).not.toContain(`${BASE}/metrics`);
	});

	it('no metrics yet: says so instead of drawing empty numbers', async () => {
		metrics = series(EMPTY_SERIES);
		await renderOverview();

		await expect
			.element(page.getByTestId('overview-metrics-empty'))
			.toHaveTextContent('Belum ada data metrik dalam 24 jam terakhir.');
		await expect.element(page.getByRole('meter')).not.toBeInTheDocument();
	});
});

describe('ProjectOverview, behaviour', () => {
	it('reads each endpoint once: the header and the overview share the project and the history', async () => {
		await renderOverview();
		await expect.element(page.getByTestId('overview-metric-cpu')).toBeVisible();

		const count = (path: string) => requests.filter((request) => request === path).length;
		expect(count(BASE)).toBe(1);
		expect(count(`${BASE}/deployments`)).toBe(1);
		expect(count(`${BASE}/metrics`)).toBe(1);
		expect(count(`${BASE}/environment-variables`)).toBe(1);
	});

	it('connectors are hidden from assistive technology; the attached group has its own heading', async () => {
		await renderOverview();
		await expect.element(summary()).toBeVisible();

		const connectors = document.querySelectorAll('.connector');
		expect(connectors.length).toBeGreaterThan(0);
		connectors.forEach((connector) => expect(connector.getAttribute('aria-hidden')).toBe('true'));
		await expect
			.element(page.getByRole('heading', { name: 'Terpasang ke aplikasi' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: /Environment variable\s*2 variabel/ }))
			.toHaveAttribute('href', `/projects/${PROJECT_ID}/environments`);
	});

	it('hides a suggestion for this project and remembers it', async () => {
		project = { ...baseProject, auto_deploy: false };
		await renderOverview();

		await userEvent.click(
			page.getByRole('button', { name: 'Sembunyikan saran: Nyalakan auto-deploy' })
		);
		await expect
			.element(
				page.getByText('Saran disembunyikan. Tidak ada saran lain untuk proyek ini sekarang.')
			)
			.toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Langkah berikutnya' })).toHaveFocus();
		expect(JSON.parse(localStorage.getItem(dismissalStorageKey(PROJECT_ID)) ?? '[]')).toEqual([
			'auto-deploy'
		]);
	});

	it('suggests nothing to a viewer of a team project', async () => {
		const team = { id: 'team-1', name: 'Tim', slug: 'tim', type: 'team' };
		project = { ...baseProject, auto_deploy: false, workspace: team };
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const request = new Request(input, init);
				if (new URL(request.url).pathname === '/api/v1/app/workspaces') {
					return json(200, {
						data: [
							{
								...personalWorkspace,
								...team,
								role: 'viewer',
								projects_count: 1,
								active_deployments_count: 0
							}
						]
					});
				}
				return answer(request);
			})
		);
		await renderOverview();

		await expect.element(summary()).toBeVisible();
		await expect.element(page.getByTestId('overview-next-steps')).not.toBeInTheDocument();
	});
});
