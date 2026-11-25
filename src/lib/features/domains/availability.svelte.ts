import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { ProjectDomain } from '$lib/api/resources/project-domains';
import type { WorkspaceSummary } from '$lib/api/resources/workspaces';
import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
import { customDomainsEnabled, servingDomain } from './presentation';
import { createProjectDomainsQuery } from './queries';

/**
 * A project's custom domains (ADR-024), only where the workspace's pilot limits say the
 * installation turned them on (`custom_domains.enabled`). Until the limits arrive, or when they
 * cannot be read, the feature reads as off: nothing new appears and no domain endpoint is called.
 */
export function useProjectCustomDomains(
	project: () => { id: string; workspace?: WorkspaceSummary | null } | null | undefined
) {
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project()?.workspace),
		() => ({ enabled: Boolean(project()) })
	);
	const enabled = $derived(customDomainsEnabled(limitsQuery.data));
	const domainsQuery = createProjectDomainsQuery(
		() => project()?.id ?? '',
		() => enabled
	);

	return {
		get enabled(): boolean {
			return enabled;
		},
		get limits(): PilotLimits | undefined {
			return limitsQuery.data;
		},
		get query() {
			return domainsQuery;
		},
		get domains(): ProjectDomain[] | undefined {
			return enabled ? domainsQuery.data : undefined;
		},
		/** The custom domain visitors reach the project on, or `null`. */
		get serving(): string | null {
			return enabled ? servingDomain(domainsQuery.data) : null;
		}
	};
}
