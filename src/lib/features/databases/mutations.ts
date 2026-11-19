import { createMutation, useQueryClient, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	attachDatabase,
	createDatabase,
	deleteDatabase,
	detachDatabase,
	getDatabaseCredentials,
	installDatabaseExtension,
	renameDatabase,
	rotateDatabasePassword,
	type CreateDatabasePayload,
	type Database,
	type DatabaseExtension
} from '$lib/api/resources/databases';

type Target = { workspaceId: string; databaseId: string };

/** The answer is the database as it is now, so the detail shows it without another read. */
function storeDatabase(client: QueryClient, workspaceId: string, database: Database) {
	client.setQueryData(queryKeys.workspaces.database(workspaceId, database.id), database);
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.databases(workspaceId) });
}

/** Counts and storage come from pilot-limits, and project resources name the attached database. */
function refreshAround(client: QueryClient, workspaceId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.databases(workspaceId) });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
	void client.invalidateQueries({ queryKey: queryKeys.projects.all });
}

export function createCreateDatabaseMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			workspaceId,
			payload
		}: {
			workspaceId: string;
			payload: CreateDatabasePayload;
		}) => createDatabase(workspaceId, payload),
		onSuccess: (database, { workspaceId }) => {
			client.setQueryData(queryKeys.workspaces.database(workspaceId, database.id), database);
			refreshAround(client, workspaceId);
		}
	}));
}

export function createRenameDatabaseMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId, name }: Target & { name: string }) =>
			renameDatabase(workspaceId, databaseId, name),
		onSuccess: (database, { workspaceId }) => {
			storeDatabase(client, workspaceId, database);
			void client.invalidateQueries({ queryKey: queryKeys.projects.all });
		}
	}));
}

export function createDeleteDatabaseMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId }: Target) => deleteDatabase(workspaceId, databaseId),
		onSuccess: (database, { workspaceId }) => {
			client.setQueryData(queryKeys.workspaces.database(workspaceId, database.id), database);
			refreshAround(client, workspaceId);
		}
	}));
}

export function createAttachDatabaseMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId, projectId }: Target & { projectId: string }) =>
			attachDatabase(workspaceId, databaseId, projectId),
		onSuccess: (_attachment, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createDetachDatabaseMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId, projectId }: Target & { projectId: string }) =>
			detachDatabase(workspaceId, databaseId, projectId),
		// A 404 means it was detached already, so the list is stale either way.
		onSettled: (_result, _error, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createRotatePasswordMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId }: Target) =>
			rotateDatabasePassword(workspaceId, databaseId),
		onSuccess: (database, { workspaceId }) => storeDatabase(client, workspaceId, database)
	}));
}

export function createInstallExtensionMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			workspaceId,
			databaseId,
			extension
		}: Target & { extension: DatabaseExtension }) =>
			installDatabaseExtension(workspaceId, databaseId, extension),
		onSuccess: (database, { workspaceId }) => storeDatabase(client, workspaceId, database)
	}));
}

/**
 * A mutation, not a query: every read is audited, so it runs only when someone presses Tampilkan,
 * and the password never enters the query cache.
 */
export function createRevealCredentialsMutation() {
	return createMutation(() => ({
		mutationFn: ({ workspaceId, databaseId }: Target) =>
			getDatabaseCredentials(workspaceId, databaseId)
	}));
}
