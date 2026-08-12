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

	it('isDeploymentInProgress should be true in step 3 with deployStatus deploying', () => {
		const wizard = createProjectWizardState();
		expect(wizard.isDeploymentInProgress()).toBe(false);
		wizard.goToAutoDetect();
		wizard.goToDeploy();
		expect(wizard.isDeploymentInProgress()).toBe(true);
	});

	it('selectedBranch should be set default_branch when selectedRepository is set', () => {
		const wizard = createProjectWizardState();
		wizard.selectedRepositoryId = mockRepositories[0].id;
		expect(wizard.selectedRepository?.default_branch).toBe(mockRepositories[0].default_branch);
	});
});
