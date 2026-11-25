import { createMutation, useQueryClient, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	addProjectDomain,
	checkProjectDomain,
	deleteProjectDomain,
	type ProjectDomain
} from '$lib/api/resources/project-domains';

type AddVariables = { projectId: string; hostname: string };
type DomainVariables = { projectId: string; domainId: string };

/** Claims count towards `max_custom_domains`, which pilot-limits reports. */
function refreshQuota(client: QueryClient) {
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
}

/** Puts one domain's new state in the list, so the result shows without another read. */
function storeDomain(client: QueryClient, projectId: string, domain: ProjectDomain) {
	client.setQueryData<ProjectDomain[]>(queryKeys.customDomains.list(projectId), (list) => {
		if (!list) return [domain];
		return list.some((item) => item.id === domain.id)
			? list.map((item) => (item.id === domain.id ? domain : item))
			: [...list, domain];
	});
}

export function createAddDomainMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, hostname }: AddVariables) => addProjectDomain(projectId, hostname),
		onSuccess: (domain: ProjectDomain, { projectId }: AddVariables) => {
			storeDomain(client, projectId, domain);
			refreshQuota(client);
		}
	}));
}

export function createCheckDomainMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, domainId }: DomainVariables) =>
			checkProjectDomain(projectId, domainId),
		onSuccess: (domain: ProjectDomain, { projectId }: DomainVariables) =>
			storeDomain(client, projectId, domain)
	}));
}

export function createDeleteDomainMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, domainId }: DomainVariables) =>
			deleteProjectDomain(projectId, domainId),
		onSuccess: (_: void, { projectId, domainId }: DomainVariables) => {
			client.setQueryData<ProjectDomain[]>(queryKeys.customDomains.list(projectId), (list) =>
				list?.filter((item) => item.id !== domainId)
			);
			refreshQuota(client);
		}
	}));
}
