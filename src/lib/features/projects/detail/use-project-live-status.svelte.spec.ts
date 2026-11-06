import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { createRecentDeploymentsQuery } from '../queries';
import type { Project } from '../type';
import { useProjectLiveStatus } from './use-project-live-status.svelte';

const client = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	setQueryData: vi.fn(),
	setQueriesData: vi.fn()
}));

vi.mock('@tanstack/svelte-query', () => ({
	useQueryClient: () => client
}));

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: vi.fn()
}));

vi.mock('../queries', () => ({
	createRecentDeploymentsQuery: vi.fn(),
	isRunningDeployment: (deployment: { status: string }) =>
		!['succeeded', 'failed', 'cancelled'].includes(deployment.status),
	projectKeys: {
		detail: (id: string) => ['projects', id],
		deployments: (id: string) => ['projects', id, 'deployments']
	},
	requestProjectRefresh: (
		queryClient: { invalidateQueries: (filters: unknown) => void },
		id: string
	) => queryClient.invalidateQueries({ queryKey: ['projects', id], exact: true })
}));

const UPDATED = '.deployment.updated';

const project = (overrides: Partial<Project> = {}) =>
	({
		id: 'proj_1',
		status: 'active',
		runtime_status: 'running',
		active_deployment_id: 'dep_active',
		...overrides
	}) as Project;

const deployment = (id: string, status: string, sequence: number) => ({
	id,
	status,
	sequence,
	queue_state: null,
	cancel_requested_at: null
});

function recentStub() {
	const state = $state<{ data: { data: ReturnType<typeof deployment>[] } | undefined }>({
		data: { data: [] }
	});
	return state;
}

let recent: ReturnType<typeof recentStub>;
let handlers: Record<string, (payload: unknown) => void>;
let channelName: () => string | null;
let destroy: () => void;

function setup(current: () => Project = () => project()) {
	let live!: ReturnType<typeof useProjectLiveStatus>;
	destroy = $effect.root(() => {
		live = useProjectLiveStatus(current);
	});
	flushSync();
	return live;
}

beforeEach(() => {
	vi.clearAllMocks();
	handlers = {};
	recent = recentStub();
	vi.mocked(createRecentDeploymentsQuery).mockReturnValue(recent as never);
	vi.mocked(usePrivateChannel).mockImplementation((name, events) => {
		channelName = name as () => string | null;
		Object.assign(handlers, events);
	});
});

afterEach(() => destroy?.());

describe('useProjectLiveStatus', () => {
	it('listens to the active deployment while nothing runs, because a crash arrives there', () => {
		setup();

		expect(channelName()).toBe('deployment.dep_active');
	});

	it('listens to the running deployment while there is one (U-15)', () => {
		recent.data = { data: [deployment('dep_run', 'building', 5)] };
		setup();

		expect(channelName()).toBe('deployment.dep_run');
	});

	it('has no channel for a project with nothing deployed', () => {
		setup(() => project({ active_deployment_id: null }));

		expect(channelName()).toBeNull();
	});

	it('applies project_runtime_status at once, so a crash shows without waiting (U-14)', () => {
		setup();

		handlers[UPDATED]({ sequence: 1, project_runtime_status: 'crashed' });

		const updater = client.setQueryData.mock.calls[0][1] as (current: Project) => Project;
		expect(updater(project()).runtime_status).toBe('crashed');
		expect(client.invalidateQueries).toHaveBeenCalled();
	});

	it('ignores a realtime event that arrives out of order', () => {
		setup();

		handlers[UPDATED]({ sequence: 5 });
		client.invalidateQueries.mockClear();
		handlers[UPDATED]({ sequence: 4, project_runtime_status: 'crashed' });

		expect(client.setQueryData).not.toHaveBeenCalled();
		expect(client.invalidateQueries).not.toHaveBeenCalled();
	});

	it('re-reads the project when the newest deployment moves on (U-15)', () => {
		recent.data = { data: [deployment('dep_run', 'building', 5)] };
		const live = setup();
		expect(live.header.kind).toBe('deploying');
		expect(client.invalidateQueries).not.toHaveBeenCalled();

		recent.data = { data: [deployment('dep_run', 'succeeded', 5)] };
		flushSync();

		expect(client.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ['projects', 'proj_1'],
			exact: true
		});
		expect(live.header.kind).toBe('live');
	});

	it('a step forward reaches the list without a read', () => {
		recent.data = { data: [deployment('dep_run', 'building', 5)] };
		setup();

		handlers[UPDATED]({ sequence: 1, deployment_id: 'dep_run', status: 'deploying' });

		const updater = client.setQueriesData.mock.calls[0][1] as (list: unknown) => {
			data: { status: string }[];
		};
		expect(updater({ data: [deployment('dep_run', 'building', 5)] }).data[0].status).toBe(
			'deploying'
		);
		expect(client.invalidateQueries).not.toHaveBeenCalled();
	});

	it('the end of a deployment reads the project once', () => {
		recent.data = { data: [deployment('dep_run', 'building', 5)] };
		setup();

		handlers[UPDATED]({ sequence: 1, deployment_id: 'dep_run', status: 'succeeded' });

		expect(client.invalidateQueries).toHaveBeenCalledOnce();
	});
});
