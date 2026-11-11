import type { CreateProjectResource } from '$lib/api/resources/projects';
import type { Repository } from '../type';
import { parseGitUrl } from './parseGitUrl';

export type WizardStep = 1 | 2 | 3;
export type RepositorySource = 'github' | 'git-url';
export type WizardEnvVar = { id: number; key: string; value: string; isSecret: boolean };
export type EnvSaveFailure = {
	env: WizardEnvVar;
	message: string;
	keyError?: string;
	valueError?: string;
};
/** `saving` and `partial` happen after the project exists, while its variables are being stored. */
export type EnvSaveStatus = 'idle' | 'saving' | 'partial' | 'done';

export function createProjectWizardState() {
	let currentStep = $state<WizardStep>(1);
	let repositorySource = $state<RepositorySource>('github');
	let hasEnteredConfig = $state(false);

	let selectedInstallationId = $state<string | null>(null);
	let selectedRepositoryId = $state<string | null>(null);
	let githubRepository = $state<Repository | null>(null);
	let gitUrl = $state('');
	let validatedGitRepository = $state<Repository | null>(null);
	let lastAppliedRepoKey: string | null = null;

	let projectName = $state('');
	let projectNameTouched = false;
	let selectedBranch = $state('');
	let configuredPort = $state('');
	let buildCommand = $state('');
	let startCommand = $state('');
	let rootDirectory = $state('');
	let autoDeploy = $state(false);

	let envVars = $state<WizardEnvVar[]>([]);
	let nextEnvId = 1;
	let envSaveStatus = $state<EnvSaveStatus>('idle');
	let envSavedCount = $state(0);
	let envFailures = $state<EnvSaveFailure[]>([]);

	let createdProjectId = $state<string | null>(null);
	let createdProjectName = $state<string | null>(null);

	const selectedRepository = $derived(
		repositorySource === 'github' ? githubRepository : validatedGitRepository
	);

	function applyRepositoryDefaults(repo: Repository) {
		const key = `${repo.full_name}#${repo.default_branch}`;
		if (key === lastAppliedRepoKey) return;
		lastAppliedRepoKey = key;

		selectedBranch = repo.default_branch;
		if (!projectNameTouched) {
			projectName = repo.full_name.split('/')[1] ?? '';
		}
	}

	function clearGithubSelection() {
		selectedRepositoryId = null;
		githubRepository = null;
	}

	return {
		get currentStep() {
			return currentStep;
		},
		get repositorySource() {
			return repositorySource;
		},
		set repositorySource(source: RepositorySource) {
			repositorySource = source;
			if (source === 'github') {
				validatedGitRepository = null;
				gitUrl = '';
			} else {
				clearGithubSelection();
			}
		},

		get selectedInstallationId() {
			return selectedInstallationId;
		},
		set selectedInstallationId(id: string | null) {
			if (id === selectedInstallationId) return;
			selectedInstallationId = id;
			clearGithubSelection();
		},
		get selectedRepositoryId() {
			return selectedRepositoryId;
		},
		selectGithubRepository(installationId: string, repo: Repository) {
			selectedInstallationId = installationId;
			selectedRepositoryId = String(repo.id);
			githubRepository = repo;
			applyRepositoryDefaults(repo);
		},
		get gitUrl() {
			return gitUrl;
		},
		set gitUrl(url: string) {
			gitUrl = url;
			if (validatedGitRepository) {
				const parsed = parseGitUrl(url);
				if (
					!parsed ||
					parsed.fullName.toLowerCase() !== validatedGitRepository.full_name.toLowerCase()
				) {
					validatedGitRepository = null;
				}
			}
		},
		confirmGitUrl(repo: Repository) {
			validatedGitRepository = repo;
			applyRepositoryDefaults(repo);
		},
		get selectedRepository() {
			return selectedRepository;
		},

		get projectName() {
			return projectName;
		},
		set projectName(name: string) {
			projectName = name;
			projectNameTouched = true;
		},
		get selectedBranch() {
			return selectedBranch;
		},
		set selectedBranch(branch: string) {
			selectedBranch = branch;
		},
		get configuredPort() {
			return configuredPort;
		},
		set configuredPort(port: string) {
			configuredPort = port;
		},
		get buildCommand() {
			return buildCommand;
		},
		set buildCommand(command: string) {
			buildCommand = command;
		},
		get startCommand() {
			return startCommand;
		},
		set startCommand(command: string) {
			startCommand = command;
		},
		get rootDirectory() {
			return rootDirectory;
		},
		set rootDirectory(directory: string) {
			rootDirectory = directory;
		},
		get autoDeploy() {
			return autoDeploy;
		},
		set autoDeploy(enabled: boolean) {
			autoDeploy = enabled;
		},

		get envVars() {
			return envVars;
		},
		addEnvVar(key: string, value: string, isSecret: boolean) {
			envVars.push({ id: nextEnvId++, key, value, isSecret });
		},
		removeEnvVar(id: number) {
			envVars = envVars.filter((env) => env.id !== id);
		},

		get envSaveStatus() {
			return envSaveStatus;
		},
		get envSavedCount() {
			return envSavedCount;
		},
		get envFailures() {
			return envFailures;
		},
		startEnvSave() {
			envSaveStatus = 'saving';
			envSavedCount = 0;
		},
		markEnvSaved() {
			envSavedCount += 1;
		},
		finishEnvSave(failures: EnvSaveFailure[]) {
			envFailures = failures;
			envSaveStatus = failures.length > 0 ? 'partial' : 'done';
			// Secrets have no business staying in memory once the API holds them.
			if (failures.length === 0) envVars = [];
		},
		/** The user gave up on the variables that failed, so their values are dropped as well. */
		dismissEnvFailures() {
			envFailures = [];
			envVars = [];
			envSaveStatus = 'done';
		},

		get createdProjectId() {
			return createdProjectId;
		},
		get createdProjectName() {
			return createdProjectName;
		},
		markProjectCreated(project: Pick<CreateProjectResource, 'id' | 'name'>) {
			createdProjectId = project.id;
			createdProjectName = project.name;
			currentStep = 3;
		},
		/** A reload lost the form, but the URL still says which project this wizard created. */
		resumeCreatedProject(projectId: string) {
			createdProjectId = projectId;
			currentStep = 3;
		},

		get hasUnsavedProgress() {
			return hasEnteredConfig;
		},
		goToPrepareDeployment() {
			currentStep = 2;
			hasEnteredConfig = true;
		},
		backToSelectRepository() {
			currentStep = 1;
		}
	};
}

export type ProjectWizardState = ReturnType<typeof createProjectWizardState>;
