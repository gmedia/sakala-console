import { getContext, setContext } from 'svelte';

const PROJECT_DETAIL_CONTEXT_KEY = Symbol('projectDetailContext');

export function createProjectDetailState() {
	let draftName = $state<string | null>(null);
	let draftBranch = $state<string | null>(null);
	let isDirty = $state(false);

	function setDraft(name: string, branch: string, originalName: string, originalBranch: string) {
		draftName = name;
		draftBranch = branch;
		isDirty = name.trim() !== originalName.trim() || branch.trim() !== originalBranch.trim();
	}

	function resetDraft() {
		draftName = null;
		draftBranch = null;
		isDirty = false;
	}

	return {
		get draftName() {
			return draftName;
		},
		get draftBranch() {
			return draftBranch;
		},
		get isDirty() {
			return isDirty;
		},
		setDraft,
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
