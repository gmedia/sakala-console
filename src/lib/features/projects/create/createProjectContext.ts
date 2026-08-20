import { getContext, setContext } from 'svelte';
import { createProjectWizardState, type ProjectWizardState } from './createProjectState.svelte';

const KEY = Symbol('createProjectWizardState');

export function initCreateProjectContext() {
	const state = createProjectWizardState();
	setContext(KEY, state);
	return state;
}

export function getCreateProjectContext(): ProjectWizardState {
	return getContext(KEY);
}
