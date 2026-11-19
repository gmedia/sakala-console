import type { CreateProjectResource } from '$lib/api/resources/projects';
import type { StarterExample } from '$lib/config/starter-examples';
import type { EnvImportPlan } from '../env-import/plan-env-import';
import type { Repository } from '../type';
import { normalizeGithubRepositoryUrl } from '../validation/repositoryUrl';
import { parseGitUrl } from './parseGitUrl';
import { resolveStarterEnvValue } from './starter-example-env';

export type WizardStep = 1 | 2 | 3;
/** What happens once the project exists: its first deployment starts, or it waits. */
export type CreateIntent = 'deploy' | 'create';
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
	let releaseCommand = $state('');
	let rootDirectory = $state('');
	let autoDeploy = $state(false);

	let envVars = $state<WizardEnvVar[]>([]);
	let nextEnvId = 1;
	let envSaveStatus = $state<EnvSaveStatus>('idle');
	let envSavedCount = $state(0);
	let envFailures = $state<EnvSaveFailure[]>([]);

	let createdProjectId = $state<string | null>(null);
	let createdProjectName = $state<string | null>(null);
	/** "Buat dan deploy" was chosen, so the last step starts the first deployment by itself. */
	let deployAfterCreate = $state(false);
	let starterExample = $state<StarterExample | null>(null);
	/** Drafts an example added, so picking another example does not leave them behind. */
	let exampleEnvIds: number[] = [];

	const selectedRepository = $derived(
		repositorySource === 'github' ? githubRepository : validatedGitRepository
	);

	function applyRepositoryDefaults(repo: Repository) {
		const key = `${repo.full_name}#${repo.default_branch}`;
		if (key === lastAppliedRepoKey) return;
		lastAppliedRepoKey = key;

		selectedBranch = repo.default_branch;
		// An example suggests its own name: every example shares one repository.
		if (!projectNameTouched && !starterExample) {
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
			starterExample = null;
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
			const example = starterExample;
			if (example && parseGitUrl(url)?.fullName !== parseGitUrl(example.repository)?.fullName) {
				starterExample = null;
			}
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
		/** The typed URL in the one form the API stores, or empty while it names no repository. */
		get gitRepositoryUrl() {
			const result = normalizeGithubRepositoryUrl(gitUrl);
			return result.ok ? result.url : '';
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
		get releaseCommand() {
			return releaseCommand;
		},
		set releaseCommand(command: string) {
			releaseCommand = command;
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
		/** A pasted .env: new keys are added, existing drafts change only when the plan says so. */
		importEnvVars(plan: EnvImportPlan) {
			for (const env of plan.toOverwrite) {
				const draft = envVars.find((item) => item.key === env.key);
				if (draft) {
					draft.value = env.value;
					draft.isSecret = env.isSecret;
				}
			}
			for (const env of plan.toAdd) {
				envVars.push({ id: nextEnvId++, key: env.key, value: env.value, isSecret: env.isSecret });
			}
		},

		get starterExample() {
			return starterExample;
		},
		/**
		 * Fills the wizard from an example app: its public URL, folder, release command and the
		 * variables it needs. A name the user already typed stays.
		 */
		applyStarterExample(example: StarterExample) {
			repositorySource = 'git-url';
			clearGithubSelection();
			validatedGitRepository = null;
			gitUrl = example.repository;
			starterExample = example;
			rootDirectory = example.rootDirectory;
			releaseCommand = example.releaseCommand ?? '';
			// Each example leaves these to detection; an earlier entry would override it.
			configuredPort = '';
			buildCommand = '';
			startCommand = '';
			if (!projectNameTouched) projectName = example.projectName;
			envVars = envVars.filter((item) => !exampleEnvIds.includes(item.id));
			exampleEnvIds = [];
			for (const env of example.env) {
				if (envVars.some((item) => item.key === env.key)) continue;
				exampleEnvIds.push(nextEnvId);
				envVars.push({
					id: nextEnvId++,
					key: env.key,
					value: resolveStarterEnvValue(env.value),
					isSecret: true
				});
			}
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
		get deployAfterCreate() {
			return deployAfterCreate;
		},
		markProjectCreated(
			project: Pick<CreateProjectResource, 'id' | 'name'>,
			{ deploy }: { deploy: boolean } = { deploy: false }
		) {
			createdProjectId = project.id;
			createdProjectName = project.name;
			deployAfterCreate = deploy;
			currentStep = 3;
		},
		/** A reload lost the form, but the URL still says which project this wizard created. */
		resumeCreatedProject(projectId: string, { deploy }: { deploy: boolean } = { deploy: false }) {
			createdProjectId = projectId;
			deployAfterCreate = deploy;
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
