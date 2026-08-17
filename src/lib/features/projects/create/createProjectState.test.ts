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

		wizard.selectedRepositoryId = mockRepositories[2].id;
		expect(wizard.selectedBranch).toBe(mockRepositories[2].default_branch);
		expect(wizard.selectedBranch).not.toBe(mockRepositories[0].default_branch);
	});

	it('sets selectedBranch and projectName when a valid git url is confirmed', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/foo/bar';

		wizard.confirmGitUrl();

		expect(wizard.selectedBranch).toBe('main');
		expect(wizard.projectName).toBe('bar');
	});

	it('does not overwrite manually set selectedBranch when git url changes but the repo identity stays the same', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/foo/bar';
		wizard.confirmGitUrl();

		wizard.selectedBranch = 'develop';

		wizard.gitUrl = 'https://github.com/foo/bar.git';
		wizard.confirmGitUrl();

		expect(wizard.selectedBranch).toBe('develop');
	});

	it('resets selectedBranch to the new repo default when the repo identity actually changes', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/foo/bar';
		wizard.confirmGitUrl();
		wizard.selectedBranch = 'develop';

		wizard.gitUrl = 'https://github.com/foo/baz';
		wizard.confirmGitUrl();

		expect(wizard.selectedBranch).toBe('main');
	});

	it('github and git-url flows apply defaults consistently based on repo identity', () => {
		const wizardA = createProjectWizardState();
		wizardA.selectedRepositoryId = mockRepositories[0].id;
		expect(wizardA.selectedBranch).toBe(mockRepositories[0].default_branch);

		const wizardB = createProjectWizardState();
		wizardB.repositorySource = 'git-url';
		wizardB.gitUrl = 'https://github.com/foo/bar';
		wizardB.confirmGitUrl();
		expect(wizardB.selectedBranch).toBe('main');
	});
});

describe('createProjectWizardState - createProjectPayload', () => {
	it('should return null when no repository is selected', () => {
		const wizard = createProjectWizardState();
		const payload = wizard.createProjectPayload;
		expect(payload).toEqual({
			project_name: '',
			repository_url: '',
			branch: ''
		});
	});

	it('should fill repository_url and branch when a repository is selected', () => {
		const wizard = createProjectWizardState();
		const repo = mockRepositories[0];

		wizard.selectedRepositoryId = repo.id;

		const payload = wizard.createProjectPayload;

		expect(payload.repository_url).toBe(repo.clone_url);
		expect(payload.branch).toBe(repo.default_branch);
		expect(payload.project_name).toBe(repo.full_name.split('/')[1]);
	});

	it('it should not replace project_name if it was manually set when a repository is selected', () => {
		const wizard = createProjectWizardState();
		const repo = mockRepositories[0];

		wizard.projectName = 'custom-project-name';
		wizard.selectedRepositoryId = repo.id;

		expect(wizard.createProjectPayload.project_name).toBe('custom-project-name');
	});

	it('repository_url change follows repository that is selected', () => {
		const wizard = createProjectWizardState();
		if (mockRepositories.length < 2) {
			return;
		}

		const [firstRepo, secondRepo] = mockRepositories;

		wizard.selectedRepositoryId = firstRepo.id;
		expect(wizard.createProjectPayload.repository_url).toBe(firstRepo.clone_url);

		wizard.selectedRepositoryId = secondRepo.id;
		expect(wizard.createProjectPayload.repository_url).toBe(secondRepo.clone_url);
	});

	it('repository_url should empty when selectedRepositoryId is not found', () => {
		const wizard = createProjectWizardState();
		wizard.selectedRepositoryId = 'non-existent-id';
		expect(wizard.createProjectPayload.repository_url).toBe('');
	});
});
