import { QueryClient, QueryObserver } from '@tanstack/svelte-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '$lib/api/query-keys';
import { parseWorkspaceList, type Workspace } from '$lib/api/resources/workspaces';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import { forgetWorkspace } from './forget';
import { workspaceSelection } from './selection.svelte';

const [personal, team] = parseWorkspaceList(getWorkspaceFixture('workspaces').body);
const USER_ID = 41;

let client: QueryClient;

afterEach(() => client.clear());

/** A client as the team page leaves it: the list, the team's reads, and reads across workspaces. */
function seeded() {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	client.setQueryData(queryKeys.auth.currentUser, { id: USER_ID });
	client.setQueryData<Workspace[]>(queryKeys.workspaces.list, [personal, team]);
	for (const key of [
		queryKeys.workspaces.members(team.id),
		queryKeys.workspaces.invitations(team.id),
		queryKeys.workspaces.limits(team.id),
		queryKeys.projects.list({ page: 1, workspace_id: team.id })
	]) {
		client.setQueryData(key, { stale: true });
	}
	client.setQueryData(queryKeys.workspaces.limits(null), { personal: true });
	workspaceSelection.select(USER_ID, team.id);
	return client;
}

/** Every read the client still holds, as a JSON key. */
const keys = () =>
	client
		.getQueryCache()
		.getAll()
		.map((query) => JSON.stringify(query.queryKey));

describe('forgetWorkspace', () => {
	it('drops every read about the workspace and keeps the others', () => {
		seeded();
		forgetWorkspace(client, team.id);

		expect(keys()).not.toContainEqual(expect.stringContaining(team.id));
		expect(keys()).toContain(JSON.stringify(queryKeys.workspaces.limits(null)));
		expect(keys()).toContain(JSON.stringify(queryKeys.auth.currentUser));
	});

	it('takes the workspace out of the cached list at once and returns it', () => {
		seeded();
		expect(forgetWorkspace(client, team.id)).toEqual(team);
		expect(client.getQueryData<Workspace[]>(queryKeys.workspaces.list)).toEqual([personal]);
	});

	it('makes the personal workspace the active one, and the remembered choice', () => {
		seeded();
		expect(workspaceSelection.get(USER_ID)).toBe(team.id);
		forgetWorkspace(client, team.id);
		expect(workspaceSelection.get(USER_ID)).toBe(personal.id);
	});

	it('cancels a read about the workspace that is still on its way', async () => {
		seeded();
		let signal: AbortSignal | undefined;
		const pending = client
			.fetchQuery({
				queryKey: queryKeys.workspaces.members(team.id),
				queryFn: (context) => {
					signal = context.signal;
					return new Promise(() => {});
				}
			})
			.catch((error: unknown) => error);

		forgetWorkspace(client, team.id);

		expect(signal?.aborted).toBe(true);
		await pending;
		expect(keys()).not.toContain(JSON.stringify(queryKeys.workspaces.members(team.id)));
	});

	it('never asks for the workspace again, even with the team page still watching it', async () => {
		seeded();
		const teamFetch = vi.fn().mockResolvedValue([]);
		const otherFetch = vi.fn().mockResolvedValue([]);
		const watchers = [
			new QueryObserver(client, {
				queryKey: queryKeys.workspaces.members(team.id),
				queryFn: teamFetch,
				staleTime: Infinity
			}),
			new QueryObserver(client, {
				queryKey: queryKeys.workspaces.limits(team.id),
				queryFn: teamFetch,
				staleTime: Infinity
			}),
			new QueryObserver(client, {
				queryKey: queryKeys.workspaces.list,
				queryFn: otherFetch,
				staleTime: Infinity
			}),
			new QueryObserver(client, {
				queryKey: queryKeys.workspaces.limits(null),
				queryFn: otherFetch,
				staleTime: Infinity
			})
		];
		const unsubscribe = watchers.map((watcher) => watcher.subscribe(() => {}));

		forgetWorkspace(client, team.id);
		await vi.waitFor(() => expect(otherFetch).toHaveBeenCalledTimes(2));

		expect(teamFetch).not.toHaveBeenCalled();
		unsubscribe.forEach((stop) => stop());
	});
});
