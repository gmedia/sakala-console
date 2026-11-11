import { getContext, setContext } from 'svelte';
import { buildConfigurationSchema } from '../validation/createProjectSchema';
import type { Project, UpdateProjectPayload } from '../type';

const PROJECT_DETAIL_CONTEXT_KEY = Symbol('projectDetailContext');

/** What the settings form holds for the build fields: plain text, until it is validated. */
export type ProjectConfigDraft = {
	configured_port: string;
	build_command: string;
	start_command: string;
	root_directory: string;
	auto_deploy: boolean;
};

export function projectConfigDraftFrom(
	project: Pick<
		Project,
		'configured_port' | 'build_command' | 'start_command' | 'root_directory' | 'auto_deploy'
	>
): ProjectConfigDraft {
	return {
		configured_port: project.configured_port === null ? '' : String(project.configured_port),
		build_command: project.build_command ?? '',
		start_command: project.start_command ?? '',
		root_directory: project.root_directory ?? '',
		auto_deploy: project.auto_deploy
	};
}

/**
 * Only the fields that changed, because a PUT leaves the others alone. Throws on an invalid value:
 * sending a wrong port as `null` would quietly clear the saved one.
 */
export function buildConfigPayload(
	draft: ProjectConfigDraft,
	original: ProjectConfigDraft
): UpdateProjectPayload {
	const parsed = buildConfigurationSchema.parse(draft);
	const payload: UpdateProjectPayload = {};
	if (draft.configured_port.trim() !== original.configured_port) {
		payload.configured_port = parsed.configured_port;
	}
	if (draft.build_command.trim() !== original.build_command) {
		payload.build_command = parsed.build_command;
	}
	if (draft.start_command.trim() !== original.start_command) {
		payload.start_command = parsed.start_command;
	}
	if (draft.root_directory.trim() !== original.root_directory) {
		payload.root_directory = parsed.root_directory;
	}
	if (draft.auto_deploy !== original.auto_deploy) payload.auto_deploy = draft.auto_deploy;
	return payload;
}

function configIsDirty(draft: ProjectConfigDraft, original: ProjectConfigDraft): boolean {
	return (
		draft.configured_port.trim() !== original.configured_port ||
		draft.build_command.trim() !== original.build_command ||
		draft.start_command.trim() !== original.start_command ||
		draft.root_directory.trim() !== original.root_directory ||
		draft.auto_deploy !== original.auto_deploy
	);
}

export function createProjectDetailState() {
	let draftName = $state<string | null>(null);
	let draftBranch = $state<string | null>(null);
	let basicsDirty = $state(false);
	let draftConfig = $state<ProjectConfigDraft | null>(null);
	let originalConfig = $state<ProjectConfigDraft | null>(null);

	const configDirty = $derived(
		draftConfig && originalConfig ? configIsDirty(draftConfig, originalConfig) : false
	);

	function setDraft(name: string, branch: string, originalName: string, originalBranch: string) {
		draftName = name;
		draftBranch = branch;
		basicsDirty = name.trim() !== originalName.trim() || branch.trim() !== originalBranch.trim();
	}

	function setConfigDraft(draft: ProjectConfigDraft, original: ProjectConfigDraft) {
		draftConfig = draft;
		originalConfig = original;
	}

	function resetDraft() {
		draftName = null;
		draftBranch = null;
		basicsDirty = false;
		draftConfig = null;
		originalConfig = null;
	}

	return {
		get draftName() {
			return draftName;
		},
		get draftBranch() {
			return draftBranch;
		},
		get draftConfig() {
			return draftConfig;
		},
		get basicsDirty() {
			return basicsDirty;
		},
		get configDirty() {
			return configDirty;
		},
		get isDirty() {
			return basicsDirty || configDirty;
		},
		/** The changed build fields, for Save and for Redeploy. Throws when one is invalid. */
		configPayload(): UpdateProjectPayload {
			return draftConfig && originalConfig && configDirty
				? buildConfigPayload(draftConfig, originalConfig)
				: {};
		},
		setDraft,
		setConfigDraft,
		resetDraft
	};
}

export type ProjectDetailState = ReturnType<typeof createProjectDetailState>;

export function initProjectDetailContext(): ProjectDetailState {
	const state = createProjectDetailState();
	setContext(PROJECT_DETAIL_CONTEXT_KEY, state);
	return state;
}

export function getProjectDetailContext(): ProjectDetailState | undefined {
	return getContext<ProjectDetailState | undefined>(PROJECT_DETAIL_CONTEXT_KEY);
}
