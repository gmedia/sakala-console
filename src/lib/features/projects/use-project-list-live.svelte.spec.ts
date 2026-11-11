import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { queryKeys } from '$lib/api/query-keys';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { inProgressDeploymentIds, useProjectListLive } from './use-project-list-live.svelte';

const invalidateQueries = vi.fn();

vi.mock('@tanstack/svelte-query', () => ({
	useQueryClient: () => ({ invalidateQueries })
}));

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: vi.fn()
}));

const open = new Map<string, Record<string, (payload: unknown) => void>>();
const subscribeCount = new Map<string, number>();

function listed(id: string, status: string | null) {
	return {
		latest_deployment:
			status === null
				? null
				: {
						id,
						sequence: 1,
						status,
						branch: 'main',
						commit_sha: null,
						commit_message: null,
						created_at: '2026-11-11T00:00:00Z',
						finished_at: null
					}
	};
}

describe('inProgressDeploymentIds', () => {
	it('names the deployments that can still change, once each', () => {
		expect(
			inProgressDeploymentIds([
				listed('d-1', 'building'),
				listed('d-2', 'succeeded'),
				listed('d-3', 'queued'),
				listed('d-1', 'building'),
				listed('d-4', null)
			])
		).toEqual(['d-1', 'd-3']);
	});
});

describe('useProjectListLive', () => {
	let projects = $state<ReturnType<typeof listed>[]>([]);
	let dispose: (() => void) | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		invalidateQueries.mockClear();
		open.clear();
		subscribeCount.clear();
		vi.mocked(usePrivateChannel).mockImplementation((name, events) => {
			const channel = name as string;
			$effect(() => {
				open.set(channel, events);
				subscribeCount.set(channel, (subscribeCount.get(channel) ?? 0) + 1);
				return () => open.delete(channel);
			});
		});
	});

	afterEach(() => {
		dispose?.();
		dispose = undefined;
		vi.useRealTimers();
	});

	function mount() {
		dispose = $effect.root(() => useProjectListLive(() => projects));
		flushSync();
	}

	it('listens on the channel of each deployment in progress, not on finished ones', () => {
		projects = [listed('d-1', 'building'), listed('d-2', 'succeeded')];
		mount();

		expect([...open.keys()]).toEqual(['deployment.d-1']);
	});

	it('re-reads the project list once for a burst of steps', () => {
		projects = [listed('d-1', 'cloning'), listed('d-2', 'queued')];
		mount();

		open.get('deployment.d-1')?.['.deployment.updated']({ status: 'building' });
		open.get('deployment.d-2')?.['.deployment.updated']({ status: 'cloning' });
		expect(invalidateQueries).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1_000);

		expect(invalidateQueries).toHaveBeenCalledTimes(1);
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.projects.lists });
	});

	it('keeps a channel open across re-reads, and closes it once the deployment finished', () => {
		projects = [listed('d-1', 'building')];
		mount();

		projects = [listed('d-1', 'deploying'), listed('d-2', 'queued')];
		flushSync();
		expect([...open.keys()].sort()).toEqual(['deployment.d-1', 'deployment.d-2']);
		expect(subscribeCount.get('deployment.d-1')).toBe(1);

		projects = [listed('d-1', 'succeeded'), listed('d-2', 'queued')];
		flushSync();
		expect([...open.keys()]).toEqual(['deployment.d-2']);
	});

	it('closes every channel when the list goes away', () => {
		projects = [listed('d-1', 'building'), listed('d-2', 'queued')];
		mount();

		dispose?.();
		dispose = undefined;

		expect(open.size).toBe(0);
	});
});
