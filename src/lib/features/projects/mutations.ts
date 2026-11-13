import {
	createMutation,
	useQueryClient,
	type QueryClient,
	type QueryFilters
} from '@tanstack/svelte-query';
import {
	updateProject,
	deleteProject,
	triggerRedeploy,
	addEnvironmentVariable,
	requestProjectInspection,
	wakeProject,
	updateEnvironmentVariable,
	deleteEnvironmentVariable
} from './api';
import { ApiError } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import { createProject, type StoreProjectRequest } from '$lib/api/resources/projects';
import { validateGithubRepository } from '$lib/api/resources/github';
import { projectKeys } from './queries';
import type {
	UpdateProjectPayload,
	Project,
	Deployment,
	CreateEnvVarPayload,
	UpdateEnvVarPayload,
	EnvironmentVariable
} from './type';

export function createValidateGithubRepositoryMutation() {
	return createMutation(() => ({
		mutationFn: (repositoryUrl: string) => validateGithubRepository(repositoryUrl)
	}));
}

export function createProjectMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: StoreProjectRequest) => createProject(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: projectKeys.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.pilotLimits });
		}
	}));
}

export function createUpdateProjectMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: ({ id, data }: { id: string; data: UpdateProjectPayload }) =>
			updateProject(id, data),
		onSuccess: (updatedProject: Project, { id }: { id: string; data: UpdateProjectPayload }) => {
			queryClient.setQueryData(projectKeys.detail(id), updatedProject);
			queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
		}
	}));
}

/** The 202 carries the project with `preview_status` back at `pending`, which restarts polling. */
export function createRequestInspectionMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (id: string) => requestProjectInspection(id),
		onSuccess: (project: Project, id: string) => {
			queryClient.setQueryData(projectKeys.detail(id), project);
		}
	}));
}

/**
 * A deleted project answers 404, so nothing under it may be read again. Reads in flight are
 * cancelled and its entries dropped before the lists are refreshed; otherwise the refresh would
 * refetch the project and its deployments while the page is still mounted.
 */
export async function forgetDeletedProject(queryClient: QueryClient, id: string): Promise<void> {
	const filters: QueryFilters[] = [
		{ queryKey: projectKeys.detail(id) },
		{ queryKey: [...queryKeys.deployments.all, 'detail', id] },
		{ queryKey: [...queryKeys.deployments.all, 'events', id] }
	];

	await Promise.all(filters.map((filter) => queryClient.cancelQueries(filter)));
	for (const filter of filters) queryClient.removeQueries(filter);

	void queryClient.invalidateQueries({ queryKey: projectKeys.all });
	void queryClient.invalidateQueries({ queryKey: queryKeys.pilotLimits });
}

export function createDeleteProjectMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (id: string) => deleteProject(id),
		// Awaited before the caller's onSuccess, so the cache is clean before it navigates away.
		onSuccess: (_: void, id: string) => forgetDeletedProject(queryClient, id)
	}));
}

export function createRedeployMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; branch: string; idempotencyKey?: string }) =>
			triggerRedeploy(variables.projectId, {
				branch: variables.branch,
				idempotencyKey: variables.idempotencyKey
			}),
		onSuccess: (_: Deployment, variables) => {
			queryClient.invalidateQueries({ queryKey: projectKeys.deployments(variables.projectId) });
			queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.pilotLimits });
		},
		onError: (error, variables) => {
			// A coded refusal (suspended, limit) means what the header knows is out of date.
			if (error instanceof ApiError && error.code) {
				queryClient.invalidateQueries({ queryKey: projectKeys.deployments(variables.projectId) });
				queryClient.invalidateQueries({
					queryKey: projectKeys.detail(variables.projectId),
					exact: true
				});
			}
		}
	}));
}

/**
 * The 202 carries the project still `sleeping`; the node reports `running` later. A coded refusal
 * (suspended, woken already, limit) means the cached project is out of date.
 */
export function createWakeProjectMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (projectId: string) => wakeProject(projectId),
		onSuccess: (project: Project, projectId: string) => {
			queryClient.setQueryData(projectKeys.detail(projectId), project);
			queryClient.invalidateQueries({ queryKey: queryKeys.pilotLimits });
		},
		onError: (error, projectId) => {
			if (error instanceof ApiError && error.code) {
				queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true });
				queryClient.invalidateQueries({ queryKey: queryKeys.pilotLimits });
			}
		}
	}));
}

/** `redeploy_required` lives on the project, and every change to a variable can flip it. */
function refreshAfterEnvChange(
	queryClient: ReturnType<typeof useQueryClient>,
	projectId: string,
	changed?: EnvironmentVariable
) {
	if (changed?.redeploy_required !== undefined) {
		const redeployRequired = changed.redeploy_required;
		queryClient.setQueryData<Project>(projectKeys.detail(projectId), (project) =>
			project ? { ...project, redeploy_required: redeployRequired } : project
		);
	}
	queryClient.invalidateQueries({ queryKey: projectKeys.environmentVariables(projectId) });
	queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true });
}

export function createAddEnvironmentVariableMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; data: CreateEnvVarPayload }) =>
			addEnvironmentVariable(variables.projectId, variables.data),
		onSuccess: (created, variables) => {
			refreshAfterEnvChange(queryClient, variables.projectId, created);
		}
	}));
}

export function createUpdateEnvironmentVariableMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; id: number; data: UpdateEnvVarPayload }) =>
			updateEnvironmentVariable(variables.projectId, variables.id, variables.data),
		onSuccess: (updated, variables) => {
			refreshAfterEnvChange(queryClient, variables.projectId, updated);
		}
	}));
}

export function createDeleteEnvironmentVariableMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; id: number }) =>
			deleteEnvironmentVariable(variables.projectId, variables.id),
		onSuccess: (_, variables) => {
			refreshAfterEnvChange(queryClient, variables.projectId);
		}
	}));
}
