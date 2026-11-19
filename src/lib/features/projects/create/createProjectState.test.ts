import { describe, expect, it } from 'vitest';
import { createProjectWizardState } from './createProjectState.svelte';
import type { Repository } from '../type';
import { STARTER_EXAMPLES } from '$lib/config/starter-examples';

const repo = (overrides: Partial<Repository> = {}): Repository => ({
	id: '101',
	name: 'toko-kopi',
	full_name: 'rani/toko-kopi',
	clone_url: 'https://github.com/rani/toko-kopi.git',
	default_branch: 'main',
	pushed_at: '2026-09-20T00:00:00Z',
	private: false,
	...overrides
});

describe('createProjectWizardState: steps', () => {
	it('starts on the repository step, with nothing to warn about', () => {
		const wizard = createProjectWizardState();

		expect(wizard.currentStep).toBe(1);
		expect(wizard.hasUnsavedProgress).toBe(false);
		expect(wizard.createdProjectId).toBeNull();
	});

	it('moves to configuration and back, keeping what was entered', () => {
		const wizard = createProjectWizardState();
		wizard.selectGithubRepository('inst-1', repo());
		wizard.goToPrepareDeployment();
		wizard.projectName = 'nama-sendiri';

		expect(wizard.currentStep).toBe(2);
		expect(wizard.hasUnsavedProgress).toBe(true);

		wizard.backToSelectRepository();

		expect(wizard.currentStep).toBe(1);
		expect(wizard.projectName).toBe('nama-sendiri');
		expect(wizard.selectedRepository?.id).toBe('101');
	});

	it('moves to auto detect once the project exists', () => {
		const wizard = createProjectWizardState();

		wizard.markProjectCreated({ id: 'p-1', name: 'toko-kopi' });

		expect(wizard.currentStep).toBe(3);
		expect(wizard.createdProjectId).toBe('p-1');
		expect(wizard.createdProjectName).toBe('toko-kopi');
	});

	it('resumes on auto detect after a reload, without the form', () => {
		const wizard = createProjectWizardState();

		wizard.resumeCreatedProject('p-1');

		expect(wizard.currentStep).toBe(3);
		expect(wizard.createdProjectId).toBe('p-1');
	});
});

describe('createProjectWizardState: GitHub repository', () => {
	it('applies the default branch and name of the selected repository', () => {
		const wizard = createProjectWizardState();

		wizard.selectGithubRepository('inst-1', repo({ default_branch: 'trunk' }));

		expect(wizard.selectedInstallationId).toBe('inst-1');
		expect(wizard.selectedRepositoryId).toBe('101');
		expect(wizard.selectedBranch).toBe('trunk');
		expect(wizard.projectName).toBe('toko-kopi');
	});

	it('follows a new repository, except for a name the user typed', () => {
		const wizard = createProjectWizardState();
		wizard.selectGithubRepository('inst-1', repo());
		wizard.projectName = 'nama-sendiri';

		wizard.selectGithubRepository(
			'inst-1',
			repo({ id: '102', full_name: 'rani/lain', default_branch: 'develop' })
		);

		expect(wizard.selectedBranch).toBe('develop');
		expect(wizard.projectName).toBe('nama-sendiri');
	});

	it('does not reset a chosen branch when the same repository is selected again', () => {
		const wizard = createProjectWizardState();
		wizard.selectGithubRepository('inst-1', repo());
		wizard.selectedBranch = 'develop';

		wizard.selectGithubRepository('inst-1', repo());

		expect(wizard.selectedBranch).toBe('develop');
	});

	it('forgets the repository when another installation is chosen, since it belongs to the old one', () => {
		const wizard = createProjectWizardState();
		wizard.selectGithubRepository('inst-1', repo());

		wizard.selectedInstallationId = 'inst-2';

		expect(wizard.selectedRepositoryId).toBeNull();
		expect(wizard.selectedRepository).toBeNull();
	});
});

describe('createProjectWizardState: public URL', () => {
	it('knows no repository until the API has validated it, and invents no default branch', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/my-org/my-app';

		expect(wizard.selectedRepository).toBeNull();
		expect(wizard.selectedBranch).toBe('');
	});

	it('takes branch and name from the validated repository', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/my-org/my-app';

		wizard.confirmGitUrl(
			repo({ id: '123456', full_name: 'my-org/my-app', default_branch: 'production' })
		);

		expect(wizard.selectedBranch).toBe('production');
		expect(wizard.projectName).toBe('my-app');
		expect(wizard.selectedRepository?.id).toBe('123456');
	});

	it('keeps the validated repository when the same URL is typed without .git', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/my-org/my-app.git';
		wizard.confirmGitUrl(repo({ id: '123456', full_name: 'my-org/my-app' }));

		wizard.gitUrl = 'https://github.com/my-org/my-app';

		expect(wizard.selectedRepository?.id).toBe('123456');
	});

	it('drops the validated repository when the URL points somewhere else', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'https://github.com/my-org/my-app';
		wizard.confirmGitUrl(repo({ id: '123456', full_name: 'my-org/my-app' }));

		wizard.gitUrl = 'https://github.com/my-org/other';

		expect(wizard.selectedRepository).toBeNull();
	});

	it('switching source clears what belonged to the other one', () => {
		const wizard = createProjectWizardState();
		wizard.selectGithubRepository('inst-1', repo());

		wizard.repositorySource = 'git-url';
		expect(wizard.selectedRepositoryId).toBeNull();

		wizard.gitUrl = 'https://github.com/a/b';
		wizard.repositorySource = 'github';
		expect(wizard.gitUrl).toBe('');
	});
});

describe('createProjectWizardState: environment variables', () => {
	it('adds and removes variables', () => {
		const wizard = createProjectWizardState();

		wizard.addEnvVar('APP_ENV', 'production', false);
		wizard.addEnvVar('API_KEY', 'abc', true);
		expect(wizard.envVars.map((env) => env.key)).toEqual(['APP_ENV', 'API_KEY']);

		wizard.removeEnvVar(wizard.envVars[0].id);
		expect(wizard.envVars.map((env) => env.key)).toEqual(['API_KEY']);
	});

	it('forgets the values once all are stored', () => {
		const wizard = createProjectWizardState();
		wizard.addEnvVar('API_KEY', 'abc', true);

		wizard.startEnvSave();
		expect(wizard.envSaveStatus).toBe('saving');
		wizard.markEnvSaved();
		wizard.finishEnvSave([]);

		expect(wizard.envSaveStatus).toBe('done');
		expect(wizard.envSavedCount).toBe(1);
		expect(wizard.envVars).toEqual([]);
	});

	it('keeps what failed so it can be retried, and drops it when the user moves on', () => {
		const wizard = createProjectWizardState();
		wizard.addEnvVar('API_KEY', 'abc', true);
		const [env] = wizard.envVars;

		wizard.startEnvSave();
		wizard.finishEnvSave([{ env, message: 'Gagal' }]);

		expect(wizard.envSaveStatus).toBe('partial');
		expect(wizard.envFailures).toHaveLength(1);

		wizard.dismissEnvFailures();

		expect(wizard.envSaveStatus).toBe('done');
		expect(wizard.envFailures).toEqual([]);
		expect(wizard.envVars).toEqual([]);
	});
});

describe('createProjectWizardState: what batch 4 added', () => {
	it('sends the typed URL in the one form the API stores', () => {
		const wizard = createProjectWizardState();
		wizard.repositorySource = 'git-url';
		wizard.gitUrl = 'github.com/rani/toko-kopi/tree/main/';
		expect(wizard.gitRepositoryUrl).toBe('https://github.com/rani/toko-kopi');
		wizard.gitUrl = 'https://gitlab.com/rani/toko-kopi';
		expect(wizard.gitRepositoryUrl).toBe('');
	});

	it('adds pasted variables and changes an existing draft only when the plan says so', () => {
		const wizard = createProjectWizardState();
		wizard.addEnvVar('APP_ENV', 'local', true);
		const planned = (key: string, value: string) => ({
			key,
			value,
			isSecret: false,
			looksSecret: false
		});

		wizard.importEnvVars({
			toAdd: [planned('APP_DEBUG', 'false')],
			toOverwrite: [],
			kept: ['APP_ENV']
		});
		expect(wizard.envVars.map((env) => [env.key, env.value])).toEqual([
			['APP_ENV', 'local'],
			['APP_DEBUG', 'false']
		]);

		wizard.importEnvVars({ toAdd: [], toOverwrite: [planned('APP_ENV', 'production')], kept: [] });
		expect(wizard.envVars.find((env) => env.key === 'APP_ENV')).toMatchObject({
			value: 'production',
			isSecret: false
		});
	});

	it('an example fills the wizard, and a second example replaces what the first added', () => {
		const wizard = createProjectWizardState();
		const laravel = STARTER_EXAMPLES.find((example) => example.id === 'laravel')!;
		const staticSite = STARTER_EXAMPLES.find((example) => example.id === 'static-site')!;

		wizard.buildCommand = 'npm run build';
		wizard.configuredPort = '8080';
		wizard.applyStarterExample(laravel);
		expect(wizard.releaseCommand).toBe('php artisan migrate --force');
		// Laravel builds from its own Dockerfile: nothing typed earlier may override it.
		expect(wizard.buildCommand).toBe('');
		expect(wizard.startCommand).toBe('');
		expect(wizard.configuredPort).toBe('');
		expect(wizard.repositorySource).toBe('git-url');
		expect(wizard.gitRepositoryUrl).toBe(laravel.repository);
		expect(wizard.rootDirectory).toBe('laravel');
		expect(wizard.projectName).toBe('contoh-laravel');
		expect(wizard.envVars.map((env) => env.key)).toEqual(['APP_KEY']);

		wizard.applyStarterExample(staticSite);
		expect(wizard.rootDirectory).toBe('static-site');
		expect(wizard.releaseCommand).toBe('');
		expect(wizard.projectName).toBe('contoh-situs-statis');
		expect(wizard.envVars).toEqual([]);
	});

	it('keeps the example suggestion when the repository is confirmed, and drops it for another URL', () => {
		const wizard = createProjectWizardState();
		wizard.applyStarterExample(STARTER_EXAMPLES[0]);
		wizard.confirmGitUrl(repo({ name: 'sakala-examples', full_name: 'gmedia/sakala-examples' }));
		expect(wizard.projectName).toBe(STARTER_EXAMPLES[0].projectName);

		wizard.gitUrl = 'https://github.com/rani/toko-kopi';
		expect(wizard.starterExample).toBeNull();
	});

	it('remembers whether the first deployment should start by itself', () => {
		const wizard = createProjectWizardState();
		wizard.markProjectCreated({ id: 'p-1', name: 'toko-kopi' }, { deploy: true });
		expect(wizard.deployAfterCreate).toBe(true);
		expect(wizard.currentStep).toBe(3);

		const resumed = createProjectWizardState();
		resumed.resumeCreatedProject('p-1');
		expect(resumed.deployAfterCreate).toBe(false);
	});
});
