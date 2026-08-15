import { describe, expect, it } from 'vitest';
import { createProjectWizardState } from './createProjectState.svelte';
import { mockRepositories } from '../mock';

describe('createProjectWizardState', () => {
	it('start step 1 with substep select-repository', () => {
		const wizard = createProjectWizardState();
		expect(wizard.currentStep).toBe(1);
		expect(wizard.repositorySubstep).toBe('select-repository');
	});

	it('should set to prepare-deployment when goToPrepareDeployment is called', () => {
		const wizard = createProjectWizardState();
		wizard.goToPrepareDeployment();
		expect(wizard.repositorySubstep).toBe('prepare-deployment');
	});

	it('selectedBranch should be set default_branch when selectedRepository is set', () => {
		const wizard = createProjectWizardState();
		wizard.selectedRepositoryId = mockRepositories[0].id;
		expect(wizard.selectedBranch).toBe(mockRepositories[0].default_branch);
	});

	it('selectedBranch should reset to new repository default_branch when repository changes', () => {
		const wizard = createProjectWizardState();

		wizard.selectedRepositoryId = mockRepositories[0].id;
		expect(wizard.selectedBranch).toBe(mockRepositories[0].default_branch);

		wizard.selectedRepositoryId = mockRepositories[1].id;
		expect(wizard.selectedBranch).toBe(mockRepositories[1].default_branch);
		expect(wizard.selectedBranch).not.toBe(mockRepositories[0].default_branch);
	});
});
