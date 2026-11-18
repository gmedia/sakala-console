import { getContext, setContext } from 'svelte';
import { buildConfigurationSchema } from '../validation/createProjectSchema';
import { MIN_REPLICAS, replicasOf, replicasSchema } from '../replicas';
import type { Project, UpdateProjectPayload } from '../type';

const PROJECT_DETAIL_CONTEXT_KEY = Symbol('projectDetailContext');

/** What the settings form holds for the build fields: plain text, until it is validated. */
export type ProjectConfigDraft = {
	configured_port: string;
	build_command: string;
	start_command: string;
	root_directory: string;
	auto_deploy: boolean;
	replicas: string;
};

/** What the draft is checked against that the user does not edit. */
export type ProjectConfigLimits = { maxReplicas: number };

/** Before the project is known, only the fewest replicas is certain. */
const DEFAULT_CONFIG_LIMITS: ProjectConfigLimits = { maxReplicas: MIN_REPLICAS };

export function projectConfigDraftFrom(
	project: Pick<
		Project,
		| 'configured_port'
		| 'build_command'
		| 'start_command'
		| 'root_directory'
		| 'auto_deploy'
		| 'replicas'
	>
): ProjectConfigDraft {
	return {
		configured_port: project.configured_port === null ? '' : String(project.configured_port),
		build_command: project.build_command ?? '',
		start_command: project.start_command ?? '',
		root_directory: project.root_directory ?? '',
		auto_deploy: project.auto_deploy,
		replicas: String(replicasOf(project))
	};
}

function replicasChanged(draft: ProjectConfigDraft, original: ProjectConfigDraft): boolean {
	return draft.replicas.trim() !== original.replicas;
}

export type ProjectConfigErrors = Partial<Record<keyof ProjectConfigDraft, string>>;

/**
 * The field errors of a draft; no message means it can be sent. Replicas are only checked once
 * changed: a setting above a maximum an admin lowered later stays as it is until someone edits it.
 */
export function projectConfigErrors(
	draft: ProjectConfigDraft,
	original: ProjectConfigDraft,
	limits: ProjectConfigLimits
): ProjectConfigErrors {
	const errors: ProjectConfigErrors = {};
	const build = buildConfigurationSchema.safeParse(draft);
	if (!build.success) {
		const fields = build.error.flatten().fieldErrors;
		errors.configured_port = fields.configured_port?.[0];
		errors.build_command = fields.build_command?.[0];
		errors.start_command = fields.start_command?.[0];
		errors.root_directory = fields.root_directory?.[0];
	}
	if (replicasChanged(draft, original)) {
		const replicas = replicasSchema(limits.maxReplicas).safeParse(draft.replicas);
		if (!replicas.success) errors.replicas = replicas.error.issues[0]?.message;
	}
	return errors;
}

export function hasConfigErrors(errors: ProjectConfigErrors): boolean {
	return Object.values(errors).some(Boolean);
}

/**
 * Only the fields that changed, because a PUT leaves the others alone. Throws on an invalid value:
 * sending a wrong port as `null` would quietly clear the saved one.
 */
export function buildConfigPayload(
	draft: ProjectConfigDraft,
	original: ProjectConfigDraft,
	limits: ProjectConfigLimits = DEFAULT_CONFIG_LIMITS
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
	if (replicasChanged(draft, original)) {
		payload.replicas = replicasSchema(limits.maxReplicas).parse(draft.replicas);
	}
	return payload;
}

function configIsDirty(draft: ProjectConfigDraft, original: ProjectConfigDraft): boolean {
	return (
		draft.configured_port.trim() !== original.configured_port ||
		draft.build_command.trim() !== original.build_command ||
		draft.start_command.trim() !== original.start_command ||
		draft.root_directory.trim() !== original.root_directory ||
		draft.auto_deploy !== original.auto_deploy ||
		replicasChanged(draft, original)
	);
}

export function createProjectDetailState() {
	let draftName = $state<string | null>(null);
	let draftBranch = $state<string | null>(null);
	let basicsDirty = $state(false);
	let draftConfig = $state<ProjectConfigDraft | null>(null);
	let originalConfig = $state<ProjectConfigDraft | null>(null);
	let configLimits = $state<ProjectConfigLimits>(DEFAULT_CONFIG_LIMITS);

	const configDirty = $derived(
		draftConfig && originalConfig ? configIsDirty(draftConfig, originalConfig) : false
	);

	function setDraft(name: string, branch: string, originalName: string, originalBranch: string) {
		draftName = name;
		draftBranch = branch;
		basicsDirty = name.trim() !== originalName.trim() || branch.trim() !== originalBranch.trim();
	}

	function setConfigDraft(
		draft: ProjectConfigDraft,
		original: ProjectConfigDraft,
		limits: ProjectConfigLimits = DEFAULT_CONFIG_LIMITS
	) {
		draftConfig = draft;
		originalConfig = original;
		configLimits = limits;
	}

	function resetDraft() {
		draftName = null;
		draftBranch = null;
		basicsDirty = false;
		draftConfig = null;
		originalConfig = null;
		configLimits = DEFAULT_CONFIG_LIMITS;
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
				? buildConfigPayload(draftConfig, originalConfig, configLimits)
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
