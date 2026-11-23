import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Deployment, PaginatedDeployments } from '../type';
import {
	MARKER_MAX_PAGES,
	MARKER_PAGE_SIZE,
	commitTitle,
	deploymentMarkers,
	getDeploymentsSince,
	markerFilterFor
} from './deployment-markers';
import { metricsRangeOption } from './ranges';

const getDeployments = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ getDeployments }));

const T0 = Date.parse('2026-11-23T08:00:00Z') / 1_000;
const iso = (seconds: number) => new Date(seconds * 1_000).toISOString();

function deployment(sequence: number, overrides: Partial<Deployment> = {}): Deployment {
	const finished = T0 + sequence * 600;
	return {
		id: `dep-${sequence}`,
		sequence,
		status: 'succeeded',
		commit_message: `fix: langkah ${sequence}`,
		created_at: iso(finished - 120),
		finished_at: iso(finished),
		...overrides
	} as Deployment;
}

function pageOf(data: Deployment[], lastPage: number): PaginatedDeployments {
	return {
		data,
		meta: {
			current_page: 1,
			from: 1,
			last_page: lastPage,
			per_page: MARKER_PAGE_SIZE,
			to: data.length,
			total: data.length
		}
	} as PaginatedDeployments;
}

afterEach(() => getDeployments.mockReset());

describe('commitTitle', () => {
	it('keeps the subject line only', () => {
		expect(commitTitle('feat: keranjang\n\nDetail panjang')).toBe('feat: keranjang');
	});

	it('skips leading blank lines and trims', () => {
		expect(commitTitle('\n  \n  fix: harga  \nbody')).toBe('fix: harga');
	});

	it.each([null, '', '  \n '])('has no title for %j', (message) => {
		expect(commitTitle(message)).toBeNull();
	});
});

describe('deploymentMarkers', () => {
	const window: [number, number] = [T0 + 1_000, T0 + 5_000];

	it('marks successful deployments that finished in the window, oldest first', () => {
		const markers = deploymentMarkers(
			[deployment(9), deployment(5), deployment(2), deployment(1)],
			window
		);
		expect(markers).toEqual([
			{ t: T0 + 1_200, deploymentId: 'dep-2', sequence: 2, title: 'fix: langkah 2' },
			{ t: T0 + 3_000, deploymentId: 'dep-5', sequence: 5, title: 'fix: langkah 5' }
		]);
	});

	it('includes a deployment that finished exactly at either edge', () => {
		const edge = deployment(3, { finished_at: iso(window[0]) });
		const end = deployment(4, { finished_at: iso(window[1]) });
		expect(deploymentMarkers([end, edge], window).map((m) => m.sequence)).toEqual([3, 4]);
	});

	it.each(['failed', 'cancelled', 'building', 'queued'] as const)(
		'leaves out a %s deployment',
		(status) => {
			expect(deploymentMarkers([deployment(3, { status })], window)).toEqual([]);
		}
	);

	it('leaves out a deployment without a readable finish time', () => {
		expect(deploymentMarkers([deployment(3, { finished_at: null })], window)).toEqual([]);
		expect(deploymentMarkers([deployment(3, { finished_at: 'nanti' })], window)).toEqual([]);
	});

	it('keeps a deployment without a commit message, untitled', () => {
		expect(
			deploymentMarkers([deployment(3, { commit_message: null })], window)[0].title
		).toBeNull();
	});
});

describe('markerFilterFor', () => {
	it.each([
		['1h', '7_days'],
		['24h', '7_days'],
		['7d', '30_days'],
		['30d', '30_days']
	] as const)('asks the API for %s with %s', (range, filter) => {
		expect(markerFilterFor(metricsRangeOption(range))).toBe(filter);
	});
});

describe('getDeploymentsSince', () => {
	const since = T0 + 1_000;

	it('stops at the first page when that page already reaches the window start', async () => {
		getDeployments.mockResolvedValueOnce(pageOf([deployment(3), deployment(1)], 4));

		const read = await getDeploymentsSince('p1', since, '7_days');

		expect(read).toEqual({ deployments: [deployment(3), deployment(1)], complete: true });
		expect(getDeployments).toHaveBeenCalledTimes(1);
		expect(getDeployments).toHaveBeenCalledWith('p1', {
			page: 1,
			per_page: MARKER_PAGE_SIZE,
			filter: '7_days'
		});
	});

	it('walks back until a page is older than the window start', async () => {
		getDeployments
			.mockResolvedValueOnce(pageOf([deployment(9), deployment(8)], 3))
			.mockResolvedValueOnce(pageOf([deployment(7), deployment(1)], 3));

		const read = await getDeploymentsSince('p1', since, '7_days');

		expect(read.deployments.map((d) => d.sequence)).toEqual([9, 8, 7, 1]);
		expect(read.complete).toBe(true);
		expect(getDeployments).toHaveBeenCalledTimes(2);
	});

	it('stops at the last page', async () => {
		getDeployments.mockResolvedValueOnce(pageOf([deployment(9)], 1));

		const read = await getDeploymentsSince('p1', since, '30_days');

		expect(read.complete).toBe(true);
		expect(getDeployments).toHaveBeenCalledTimes(1);
	});

	it('stops at an empty list', async () => {
		getDeployments.mockResolvedValueOnce(pageOf([], 1));

		expect(await getDeploymentsSince('p1', since, '7_days')).toEqual({
			deployments: [],
			complete: true
		});
	});

	it(`says the walk is partial after ${MARKER_MAX_PAGES} pages`, async () => {
		getDeployments.mockImplementation(async () => pageOf([deployment(99)], 50));

		const read = await getDeploymentsSince('p1', since, '30_days');

		expect(read.complete).toBe(false);
		expect(getDeployments).toHaveBeenCalledTimes(MARKER_MAX_PAGES);
	});
});
