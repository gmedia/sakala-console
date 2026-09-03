import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	updateProject,
	deleteProject,
	triggerRedeploy,
	addEnvironmentVariable,
	deleteEnvironmentVariable
} from './api';
import { projectKeys } from './queries';
import type { UpdateProjectPayload, Project, Deployment } from './type';

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

export function createDeleteProjectMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (id: string) => deleteProject(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: projectKeys.all });
		}
	}));
}

export function createRedeployMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; idempotencyKey: string }) =>
			triggerRedeploy(variables.projectId, variables.idempotencyKey),
		onSuccess: (_: Deployment, variables) => {
			queryClient.invalidateQueries({ queryKey: projectKeys.deployments(variables.projectId) });
			queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
		}
	}));
}

export function createAddEnvironmentVariableMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: {
			projectId: string;
			data: { key: string; value: string; is_secret: boolean };
		}) => addEnvironmentVariable(variables.projectId, variables.data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: projectKeys.environmentVariables(variables.projectId)
			});
		}
	}));
}

export function createDeleteEnvironmentVariableMutation() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (variables: { projectId: string; id: string }) =>
			deleteEnvironmentVariable(variables.projectId, variables.id),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: projectKeys.environmentVariables(variables.projectId)
			});
		}
	}));
}
