import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { resetRateLimit } from '$lib/api/rate-limit';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { baseProject, PROJECT_ID } from '../../../../../../tests/e2e/fixtures/project-detail';
import { MONITORING_COPY } from '../../monitoring/format';
import { METRICS_POLL_MS } from '../../monitoring/ranges';
import MonitoringTab from './MonitoringTab.svelte';

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));

const MIB = 1024 * 1024;
const STEP = 900;
const METRICS_PATH = `/api/v1/app/projects/${PROJECT_ID}/metrics`;
const DEPLOYMENTS_PATH = `/api/v1/app/projects/${PROJECT_ID}/deployments`;

type Body = Record<string, unknown>;

let runtimeStatus: string;
let metricsBody: Body;
let failMetrics: number;
let metricsRequests: string[];
let projectCreatedAt: string;
let deploymentList: Body[];
let deploymentRequests: URLSearchParams[];

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const iso = (seconds: number) => new Date(seconds * 1_000).toISOString();

/** Two steps, as the API sends them: wrapped in `data`, `t` in ISO 8601. */
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
				// Both replicas' limits together.
				memory_limit_bytes: 1024 * MIB,
				replicas: [
					{ t: t(2), count: 2 },
					{ t: t(1), count: 2 }
				],
				restarts: [
					{ t: t(2), count: 1 },
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
	if (url.pathname === METRICS_PATH) {
		metricsRequests.push(url.searchParams.get('range') ?? '');
		if (failMetrics > 0) {
			failMetrics--;
			return json(500, { message: 'Server Error' });
		}
		return json(200, metricsBody);
	}
	if (url.pathname === DEPLOYMENTS_PATH) {
		deploymentRequests.push(url.searchParams);
		return json(200, {
			data: deploymentList,
			meta: {
				current_page: 1,
				from: 1,
				last_page: 1,
				per_page: 6,
				to: deploymentList.length,
				total: deploymentList.length
			}
		});
	}
	return json(200, {
		data: { ...baseProject, runtime_status: runtimeStatus, created_at: projectCreatedAt }
	});
}

const renderTab = () =>
	render(QueryTestHost, {
		props: {
			component: MonitoringTab,
			props: { projectId: PROJECT_ID },
			client: new QueryClient({
				defaultOptions: { queries: { retry: false, staleTime: 30_000 } }
			})
		}
	});

const card = (id: string) => page.getByTestId(`metric-${id}`);

beforeEach(() => {
	runtimeStatus = 'running';
	metricsBody = series();
	failMetrics = 0;
	metricsRequests = [];
	projectCreatedAt = baseProject.created_at;
	deploymentList = [];
	deploymentRequests = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init)))
	);
});

afterEach(() => {
	resetRateLimit();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('MonitoringTab, states', () => {
	it('shows four charts, each with its numbers in words', async () => {
		await renderTab();

		await expect
			.element(card('cpu'))
			.toHaveAccessibleDescription('Terakhir 12,5%, tertinggi 150% dalam 24 jam terakhir.');
		await expect.element(card('cpu')).toHaveTextContent(MONITORING_COPY.cpuNote);
		await expect
			.element(card('memory'))
			.toHaveAccessibleDescription('Terakhir 256 MiB, tertinggi 300 MiB dalam 24 jam terakhir.');
		await expect
			.element(card('memory'))
			.toHaveTextContent('Batas 1 GiB untuk 2 replika (512 MiB per replika).');
		await expect
			.element(card('replicas'))
			.toHaveAccessibleDescription('Terakhir 2 replika, paling banyak 2 dalam 24 jam terakhir.');
		await expect
			.element(card('restarts'))
			.toHaveAccessibleDescription('3 restart dalam 24 jam terakhir.');
		await expect.element(page.getByRole('figure', { name: 'CPU' })).toBeVisible();

		// The canvas is drawn, and kept from screen readers, which get the summary instead.
		await expect
			.poll(() => document.querySelectorAll('[data-testid^="metric-"] canvas').length)
			.toBe(4);
		const chart = document.querySelector('[data-testid="metric-cpu"] .time-series-chart');
		expect(chart?.getAttribute('aria-hidden')).toBe('true');
	});

	it('explains an empty series inside its own card', async () => {
		metricsBody = series({ restarts: [] });
		await renderTab();

		await expect
			.element(card('restarts'))
			.toHaveAccessibleDescription(MONITORING_COPY.noPointsInRange);
		await expect.element(card('cpu')).toHaveTextContent('Terakhir 12,5%');
		expect(document.querySelector('[data-testid="metric-restarts"] canvas')).toBeNull();
	});

	it('shows the empty state before any sample exists, and offers the longest range', async () => {
		metricsBody = { data: { range: '24h', step_seconds: STEP, series: EMPTY_SERIES } };
		await renderTab();

		await expect
			.element(page.getByRole('heading', { name: 'Belum ada data metrik dalam 24 jam terakhir' }))
			.toBeVisible();
		await expect.element(page.getByText(MONITORING_COPY.empty.description)).toBeVisible();
		await expect.element(card('cpu')).not.toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Lihat 30 hari terakhir' }));

		await expect.element(page.getByRole('radio', { name: '30 hari' })).toBeChecked();
		await expect
			.element(page.getByRole('heading', { name: 'Belum ada data metrik dalam 30 hari terakhir' }))
			.toBeVisible();
		// Already the longest: nothing wider to offer.
		await expect.element(page.getByRole('button', { name: /^Lihat / })).not.toBeInTheDocument();
		expect(metricsRequests).toEqual(['24h', '30d']);
	});

	it('says when the charts were read, and that they keep up while the project runs', async () => {
		await renderTab();

		await expect
			.element(page.getByTestId('metrics-freshness'))
			.toHaveTextContent(/^Diperbarui pukul \d{2}\.\d{2}, dibaca ulang tiap menit\.$/);

		await userEvent.click(page.getByRole('radio', { name: '7 hari' }));

		await expect.element(card('cpu')).toHaveAccessibleDescription(/7 hari terakhir/);
		await expect
			.element(page.getByTestId('metrics-freshness'))
			.toHaveTextContent(/^Diperbarui pukul \d{2}\.\d{2}\.$/);
	});

	it('says no samples are collected while the project sleeps', async () => {
		runtimeStatus = 'sleeping';
		await renderTab();

		await expect.element(page.getByText(MONITORING_COPY.sleeping)).toBeVisible();
		await expect.element(card('cpu')).toBeVisible();
	});

	it('does not mention sleep for a running project', async () => {
		await renderTab();

		await expect.element(card('cpu')).toBeVisible();
		await expect.element(page.getByText(MONITORING_COPY.sleeping)).not.toBeInTheDocument();
	});

	it('shows an error with a retry that loads the charts', async () => {
		failMetrics = 1;
		await renderTab();

		const alert = page.getByRole('alert');
		await expect.element(alert).toHaveTextContent(MONITORING_COPY.error);
		await userEvent.click(page.getByRole('button', { name: MONITORING_COPY.retry }));

		await expect.element(card('cpu')).toBeVisible();
		await expect.element(alert).not.toBeInTheDocument();
		expect(metricsRequests).toEqual(['24h', '24h']);
	});
});

describe('MonitoringTab, range', () => {
	it('starts at 24 hours and reads another range when one is picked', async () => {
		await renderTab();

		const group = page.getByRole('radiogroup', { name: MONITORING_COPY.rangeLabel });
		await expect.element(group.getByRole('radio', { name: '24 jam' })).toBeChecked();
		await expect.element(card('cpu')).toHaveAccessibleDescription(/24 jam terakhir/);

		await userEvent.click(group.getByRole('radio', { name: '7 hari' }));

		await expect.element(group.getByRole('radio', { name: '7 hari' })).toBeChecked();
		await expect.element(card('cpu')).toHaveAccessibleDescription(/7 hari terakhir/);
		expect(metricsRequests).toEqual(['24h', '7d']);
	});

	it('moves between ranges with the arrow keys', async () => {
		await renderTab();

		const group = page.getByRole('radiogroup', { name: MONITORING_COPY.rangeLabel });
		await userEvent.click(group.getByRole('radio', { name: '24 jam' }));
		await userEvent.keyboard('{ArrowLeft}');

		await expect.element(group.getByRole('radio', { name: '6 jam' })).toBeChecked();
		await expect.poll(() => metricsRequests).toEqual(['24h', '6h']);
	});
});

describe('MonitoringTab, requests', () => {
	const MINUTES = 5;

	async function requestsOver(minutes: number) {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
		});
		await renderTab();
		await vi.advanceTimersByTimeAsync(1_000);
		const atLoad = metricsRequests.length;
		await vi.advanceTimersByTimeAsync(minutes * 60_000);
		return metricsRequests.length - atLoad;
	}

	function hideTab() {
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
		document.dispatchEvent(new Event('visibilitychange'));
	}

	it('reads a running project once a minute on a short range', { timeout: 30_000 }, async () => {
		const polled = await requestsOver(MINUTES);
		// The interval starts once the project's status is known, a moment after the first read.
		const perInterval = (MINUTES * 60_000) / METRICS_POLL_MS;
		expect(polled).toBeGreaterThanOrEqual(perInterval - 1);
		expect(polled).toBeLessThanOrEqual(perInterval);
	});

	it('reads nothing more while the tab is hidden', { timeout: 30_000 }, async () => {
		hideTab();
		expect(await requestsOver(MINUTES)).toBe(0);
		expect(metricsRequests).toHaveLength(1);
	});

	it('reads nothing more while the project sleeps', { timeout: 30_000 }, async () => {
		runtimeStatus = 'sleeping';
		expect(await requestsOver(MINUTES)).toBe(0);
	});

	it('reads nothing more for a stopped project', { timeout: 30_000 }, async () => {
		runtimeStatus = 'stopped';
		expect(await requestsOver(MINUTES)).toBe(0);
	});
});

describe('MonitoringTab, a new project', () => {
	const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

	it('opens a five-minute-old project on 1 hour and says when its data starts', async () => {
		projectCreatedAt = minutesAgo(5);
		const now = Math.floor(Date.now() / 1_000);
		const point = (secondsAgo: number) => iso(now - secondsAgo);
		metricsBody = {
			data: {
				range: '1h',
				step_seconds: 60,
				series: {
					cpu_percent: [
						{ t: point(180), avg: 3, max: 5 },
						{ t: point(120), avg: 4, max: 6 }
					],
					memory_bytes: [{ t: point(120), avg: 90 * MIB, max: 95 * MIB }],
					memory_limit_bytes: 512 * MIB,
					replicas: [{ t: point(120), count: 1 }],
					restarts: [{ t: point(120), count: 0 }]
				}
			}
		};
		await renderTab();

		const group = page.getByRole('radiogroup', { name: MONITORING_COPY.rangeLabel });
		await expect.element(group.getByRole('radio', { name: '1 jam' })).toBeChecked();
		await expect
			.element(page.getByTestId('metrics-data-start'))
			.toHaveTextContent(/^Data mulai \d{1,2} \w{3}, \d{2}\.\d{2}\.$/);
		await expect.element(card('cpu')).toHaveAccessibleDescription(/1 jam terakhir/);
		// The age is known before the first read, so no day of empty chart is asked for first.
		expect(metricsRequests).toEqual(['1h']);
	});

	it('does not offer a wider range to a project younger than this one', async () => {
		projectCreatedAt = minutesAgo(5);
		metricsBody = { data: { range: '1h', step_seconds: 60, series: EMPTY_SERIES } };
		await renderTab();

		await expect
			.element(page.getByRole('heading', { name: 'Belum ada data metrik dalam 1 jam terakhir' }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: /^Lihat / })).not.toBeInTheDocument();
	});

	it('keeps a picked range, and treats picking the fitting one as no pick', async () => {
		projectCreatedAt = minutesAgo(5);
		await renderTab();

		const group = page.getByRole('radiogroup', { name: MONITORING_COPY.rangeLabel });
		await userEvent.click(group.getByRole('radio', { name: '24 jam' }));
		await expect.element(group.getByRole('radio', { name: '24 jam' })).toBeChecked();
		await userEvent.click(group.getByRole('radio', { name: '1 jam' }));
		await expect.element(group.getByRole('radio', { name: '1 jam' })).toBeChecked();
		expect(metricsRequests).toEqual(['1h', '24h']);
	});

	it('shows no note when the data fills the range', async () => {
		// An old project, with a point right at the start of the day.
		const now = Math.floor(Date.now() / 1_000);
		metricsBody = series({
			cpu_percent: [
				{ t: iso(now - 86_400 + 60), avg: 10, max: 20 },
				{ t: iso(now - STEP), avg: 12.5, max: 30 }
			]
		});
		await renderTab();

		await expect.element(card('cpu')).toBeVisible();
		await expect.element(page.getByTestId('metrics-data-start')).not.toBeInTheDocument();
	});
});

describe('MonitoringTab, deployment markers', () => {
	const secondsAgo = (seconds: number) => iso(Math.floor(Date.now() / 1_000) - seconds);
	const deployed = (sequence: number, finishedSecondsAgo: number, overrides: Body = {}) => ({
		id: `dep-${sequence}`,
		project_id: PROJECT_ID,
		sequence,
		status: 'succeeded',
		commit_message: `feat: perubahan ${sequence}\n\nbadan pesan`,
		created_at: secondsAgo(finishedSecondsAgo + 120),
		finished_at: secondsAgo(finishedSecondsAgo),
		...overrides
	});

	it('lists the successful deployments of the range, newest first, with their commit title', async () => {
		deploymentList = [
			deployed(4, 600),
			deployed(3, 1_200, { status: 'failed' }),
			deployed(2, 3 * 3_600, { commit_message: null }),
			deployed(1, 3 * 86_400)
		];
		await renderTab();

		const section = page.getByRole('region', { name: MONITORING_COPY.markers.title });
		await expect.element(section).toBeVisible();
		const links = section.getByRole('link');
		await expect.element(links.nth(0)).toHaveTextContent('Deployment #4');
		await expect
			.element(links.nth(0))
			.toHaveAttribute('href', `/projects/${PROJECT_ID}/deployments/dep-4`);
		await expect.element(links.nth(1)).toHaveTextContent('Deployment #2');
		expect(links.all()).toHaveLength(2);
		await expect.element(section).toHaveTextContent('feat: perubahan 4');
		await expect.element(section).not.toHaveTextContent('badan pesan');
		await expect.element(section).toHaveTextContent(MONITORING_COPY.markers.manual);
		expect(deploymentRequests[0].get('filter')).toBe('7_days');
		expect(deploymentRequests[0].get('per_page')).toBe('6');
	});

	it('shows the deployment under the cursor in a tooltip', async () => {
		deploymentList = [deployed(7, 6 * 3_600)];
		await renderTab();
		await expect
			.element(page.getByRole('region', { name: MONITORING_COPY.markers.title }))
			.toBeVisible();

		const over = document.querySelector('[data-testid="metric-cpu"] .u-over') as HTMLElement;
		const box = over.getBoundingClientRect();
		const end = Math.floor(Date.now() / 1_000);
		const share = (end - 6 * 3_600 - (end - 86_400)) / 86_400;
		const clientX = box.left + share * box.width;
		over.dispatchEvent(
			new MouseEvent('mousemove', { clientX, clientY: box.top + box.height / 2, bubbles: true })
		);

		const tooltip = page.getByTestId('chart-marker-tooltip');
		await expect.element(tooltip).toHaveTextContent('Deployment #7');
		await expect.element(tooltip).toHaveTextContent('feat: perubahan 7');

		over.dispatchEvent(
			new MouseEvent('mousemove', { clientX: box.left + 2, clientY: box.top + 2, bubbles: true })
		);
		await expect.element(tooltip).not.toBeInTheDocument();
	});

	it('shows no list without a deployment in the range', async () => {
		deploymentList = [deployed(1, 3 * 86_400)];
		await renderTab();

		await expect.element(card('cpu')).toBeVisible();
		await expect
			.element(page.getByRole('region', { name: MONITORING_COPY.markers.title }))
			.not.toBeInTheDocument();
	});
});
