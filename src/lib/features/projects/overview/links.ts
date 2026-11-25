import { resolveRoute } from '$app/paths';
import type { NextStep } from './next-steps';
import {
	SETTINGS_ANCHORS,
	SETTINGS_PAGES,
	settingsTarget,
	type SettingsPage
} from '../settings-anchors';
import { databaseHref } from '$lib/features/databases/routes';
import type { TopologyLink } from './topology';

/** The address card's id, which the diagram's address box jumps to. */
export const ADDRESS_SECTION_ID = 'alamat-dan-domain';

function deploymentsHref(projectId: string): string {
	return resolveRoute('/(app)/projects/[id]/deployments', { id: projectId });
}

/** The Variabel tab; an anchor such as `isi-dari-env-example` opens that part of it. */
export function variablesHref(projectId: string, anchor?: string): string {
	const base = resolveRoute('/(app)/projects/[id]/environments', { id: projectId });
	return anchor ? `${base}#${anchor}` : base;
}

/** One settings sub-page. */
export function settingsPageHref(projectId: string, page: SettingsPage): string {
	const id = projectId;
	switch (page) {
		case SETTINGS_PAGES.general:
			return resolveRoute('/(app)/projects/[id]/settings/general', { id });
		case SETTINGS_PAGES.build:
			return resolveRoute('/(app)/projects/[id]/settings/build', { id });
		case SETTINGS_PAGES.domains:
			return resolveRoute('/(app)/projects/[id]/settings/domain', { id });
		case SETTINGS_PAGES.processes:
			return resolveRoute('/(app)/projects/[id]/settings/processes', { id });
		case SETTINGS_PAGES.schedules:
			return resolveRoute('/(app)/projects/[id]/settings/schedules', { id });
		case SETTINGS_PAGES.danger:
			return resolveRoute('/(app)/projects/[id]/settings/danger', { id });
	}
}

/**
 * A section or field of the settings: the sub-page that holds it, plus the field's id, which the
 * page opens and scrolls to once it renders. No anchor means the first page, Umum.
 */
export function settingsHref(projectId: string, anchor?: string): string {
	const target = settingsTarget(anchor);
	const base = settingsPageHref(projectId, target.page);
	return target.anchor ? `${base}#${target.anchor}` : base;
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
		? variablesHref(projectId, action.anchor)
		: settingsHref(projectId, action.anchor);
}
