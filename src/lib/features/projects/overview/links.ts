import { resolveRoute } from '$app/paths';
import type { NextStep } from './next-steps';
import { SETTINGS_ANCHORS } from '../settings-anchors';
import { databaseHref } from '$lib/features/databases/routes';
import type { TopologyLink } from './topology';

/** The address card's id, which the diagram's address box jumps to. */
export const ADDRESS_SECTION_ID = 'alamat-dan-domain';

function deploymentsHref(projectId: string): string {
	return resolveRoute('/(app)/projects/[id]/deployments', { id: projectId });
}

function variablesHref(projectId: string): string {
	return resolveRoute('/(app)/projects/[id]/environments', { id: projectId });
}

/** A field of the settings tab; SvelteKit scrolls to the id once the tab renders. */
export function settingsHref(projectId: string, anchor?: string): string {
	const base = resolveRoute('/(app)/projects/[id]/settings', { id: projectId });
	return anchor ? `${base}#${anchor}` : base;
}

export function topologyHref(link: TopologyLink, projectId: string): string {
	switch (link.target) {
		case 'address':
			return `#${ADDRESS_SECTION_ID}`;
		case 'deployments':
			return deploymentsHref(projectId);
		case 'variables':
			return variablesHref(projectId);
		case 'release_command':
			return settingsHref(projectId, SETTINGS_ANCHORS.releaseCommand);
		case 'database':
			return databaseHref(link.workspaceId, link.databaseId);
	}
}

export function nextStepHref(action: NextStep['action'], projectId: string): string {
	return action.target === 'variables'
		? variablesHref(projectId)
		: settingsHref(projectId, action.anchor);
}
