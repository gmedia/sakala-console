import { QueryClient } from '@tanstack/svelte-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '$lib/api/query-keys';
import { listWorkspaces, parseWorkspaceList, type Workspace } from '$lib/api/resources/workspaces';
import { NetworkError } from '$lib/api/errors';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import { createWorkspaceAccessLostHandler } from './access-lost';
import { workspaceSelection } from './selection.svelte';

vi.mock('$lib/api/resources/workspaces', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/workspaces')>()),
	listWorkspaces: vi.fn()
}));

const [personal, team] = parseWorkspaceList(getWorkspaceFixture('workspaces').body);
const USER_ID = 42;

let client: QueryClient;
const notify = vi.fn();
const leave = vi.fn();

beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	client.setQueryData(queryKeys.auth.currentUser, { id: USER_ID });
	client.setQueryData<Workspace[]>(queryKeys.workspaces.list, [personal, team]);
	client.setQueryData(queryKeys.workspaces.members(team.id), []);
	workspaceSelection.select(USER_ID, team.id);
	vi.mocked(listWorkspaces).mockReset();
	notify.mockReset();
	leave.mockReset();
});

afterEach(() => client.clear());

const handler = () => createWorkspaceAccessLostHandler(client, { notify, leave });

describe('createWorkspaceAccessLostHandler', () => {
	it('forgets a workspace the user was removed from, says so once, and leaves its page', async () => {
		vi.mocked(listWorkspaces).mockResolvedValue([personal]);

		await handler()(team.id);

		expect(notify).toHaveBeenCalledExactlyOnceWith(team);
		expect(leave).toHaveBeenCalledExactlyOnceWith(team.id);
		expect(client.getQueryData(queryKeys.workspaces.members(team.id))).toBeUndefined();
		expect(workspaceSelection.get(USER_ID)).toBe(personal.id);
	});

	it('checks the list once for a burst of failing reads about the same workspace', async () => {
		let answer: (list: Workspace[]) => void = () => {};
		vi.mocked(listWorkspaces).mockReturnValue(new Promise((resolve) => (answer = resolve)));
		const handle = handler();

		const first = handle(team.id);
		void handle(team.id);
		void handle(team.id);
		answer([personal]);
		await first;

		expect(listWorkspaces).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledTimes(1);
	});

	it('keeps a workspace the user still belongs to, with the fresh list', async () => {
		const demoted = { ...team, role: 'member' as const };
		vi.mocked(listWorkspaces).mockResolvedValue([personal, demoted]);

		await handler()(team.id);

		expect(notify).not.toHaveBeenCalled();
		expect(leave).not.toHaveBeenCalled();
		expect(client.getQueryData(queryKeys.workspaces.list)).toEqual([personal, demoted]);
		expect(workspaceSelection.get(USER_ID)).toBe(team.id);
	});

	it('forgets nothing when the list cannot be read either', async () => {
		vi.mocked(listWorkspaces).mockRejectedValue(new NetworkError());

		await handler()(team.id);

		expect(notify).not.toHaveBeenCalled();
		expect(client.getQueryData(queryKeys.workspaces.members(team.id))).toEqual([]);
	});

	it('names a workspace that a refreshed list already dropped', async () => {
		const handle = handler();
		client.setQueryData<Workspace[]>(queryKeys.workspaces.list, [personal]);
		vi.mocked(listWorkspaces).mockResolvedValue([personal]);

		await handle(team.id);

		expect(notify).toHaveBeenCalledExactlyOnceWith(team);
	});

	it('forgets the names it saw when the session ends', async () => {
		const handle = handler();
		client.removeQueries();
		vi.mocked(listWorkspaces).mockResolvedValue([personal]);

		await handle(team.id);

		expect(notify).not.toHaveBeenCalled();
	});

	it('does not announce a workspace the user never had, but still leaves its page', async () => {
		vi.mocked(listWorkspaces).mockResolvedValue([personal]);

		await handler()('someone-elses-team');

		expect(notify).not.toHaveBeenCalled();
		expect(leave).toHaveBeenCalledExactlyOnceWith('someone-elses-team');
	});
});
