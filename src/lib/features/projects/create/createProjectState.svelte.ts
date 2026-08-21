import { mockRepositories } from '$lib/features/projects/mock/mock';
import type { Repository, CreateProjectPayload, CreateProjectResult } from '../type';
import { parseGitUrl } from './parseGitUrl';

type WizardStep = 1 | 2 | 3;
type RepositorySubstep = 'select-repository' | 'prepare-deployment';
type EnvVar = { id: number; key: string; value: string; visible?: boolean };
type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';
type DeployStatus = 'idle' | 'deploying' | 'cancelling' | 'cancelled' | 'success' | 'failed';

export function createProjectWizardState() {
	let currentPage = $state(1);
	let perPage = $state(5);
	let currentStep = $state<WizardStep>(1);
	let repositorySource = $state<'github' | 'git-url'>('github');
	let repositorySubstep = $state<RepositorySubstep>('select-repository');
	let hasEnteredConfig = $state(false);
	let selectedRepositoryId = $state<string | null>(null);
	let lastAppliedRepoKey: string | null = null;
	let githubConnected = $state(true);
	let checkingGithubConnection = $state(true);
	let gitUrl = $state('');
	let projectName = $state('');
	let projectNameTouched = false;
	let selectedBranch = $state('');
	let selectedPort = $state('3000');
	let buildCommand = $state('npm run build');
	let envVars = $state<EnvVar[]>([]);
	const envVisible = $state(false);
	let nextEnvId = 1;

	let createdProject = $state<CreateProjectResult | null>(null);

	let scanStatus = $state<ScanStatus>('idle');
	let builderDetected = $state<boolean | null>(null);
	let scanAttempt = $state(0);

	let deployStatus = $state<DeployStatus>('idle');

	const githubRepository = $derived(
		mockRepositories.find((repo) => repo.id === selectedRepositoryId) ?? null
	);

	const gitUrlRepository = $derived.by<Repository | null>(() => {
		if (repositorySource !== 'git-url' || !gitUrl) return null;

		const parsed = parseGitUrl(gitUrl);
		if (!parsed) return null;

		return {
			id: gitUrl,
			name: parsed.name,
			full_name: parsed.fullName,
			clone_url: gitUrl,
			default_branch: 'main',
			pushed_at: '2024-01-01T00:00:00Z',
			private: false
		};
	});

	const selectedRepository = $derived(
		repositorySource === 'github' ? githubRepository : gitUrlRepository
	);

	function repoKey(repo: Repository | null): string | null {
		return repo?.full_name ?? null;
	}

	function resolveRepository(id: string | null): Repository | null {
		if (repositorySource === 'github') {
			return mockRepositories.find((repo) => repo.id === id) ?? null;
		}
		return null;
	}

	function applyRepositoryDefaults(repo: Repository | null) {
		const key = repoKey(repo);
		if (key === null) return;

		if (key === lastAppliedRepoKey) return;
		lastAppliedRepoKey = key;

		selectedBranch = repo?.default_branch ?? '';
		if (!projectNameTouched) {
			projectName = repo?.full_name.split('/')[1] ?? '';
		}

		scanStatus = 'idle';
		builderDetected = null;
		scanAttempt = 0;
	}

	async function checkGithubConnection() {
		checkingGithubConnection = true;
		try {
			githubConnected = true;
		} catch {
			githubConnected = false;
		} finally {
			checkingGithubConnection = false;
		}
	}

	function addEnvVar(key: string, value: string) {
		const trimmedKey = key.trim();
		const trimmedValue = value.trim();
		if (!trimmedKey || !trimmedValue) return;

		envVars.push({
			id: nextEnvId++,
			key: trimmedKey,
			value: trimmedValue,
			visible: envVisible
		});
	}

	function removeEnvVar(id: number) {
		envVars = envVars.filter((env) => env.id !== id);
	}

	function toggleEnvVisible(id: number) {
		const target = envVars.find((env) => env.id === id);
		if (target) target.visible = !target.visible;
	}

	async function cancelDeployment() {
		if (deployStatus !== 'deploying') return;

		deployStatus = 'cancelling';
		try {
			await new Promise((resolve) => setTimeout(resolve, 800));
			deployStatus = 'cancelled';
		} catch {
			deployStatus = 'deploying';
			throw new Error('Gagal membatalkan deployment');
		}
	}

	return {
		get repositorySource() {
			return repositorySource;
		},
		set repositorySource(v) {
			repositorySource = v;
		},
		get selectedRepositoryId() {
			return selectedRepositoryId;
		},
		set selectedRepositoryId(v: string | null) {
			selectedRepositoryId = v;
			applyRepositoryDefaults(resolveRepository(v));
		},
		get gitUrl() {
			return gitUrl;
		},
		set gitUrl(v: string) {
			gitUrl = v;
		},

		get selectedBranch() {
			return selectedBranch;
		},
		set selectedBranch(v) {
			selectedBranch = v;
			scanStatus = 'idle';
			builderDetected = null;
			scanAttempt = 0;
		},

		get selectedPort() {
			return selectedPort;
		},
		set selectedPort(v) {
			selectedPort = v;
		},

		get projectName() {
			return projectName;
		},
		set projectName(v) {
			projectName = v;
			projectNameTouched = true;
		},

		get buildCommand() {
			return buildCommand;
		},

		set buildCommand(v) {
			buildCommand = v;
		},

		get perPage() {
			return perPage;
		},

		set perPage(v) {
			perPage = v;
		},

		get currentPage() {
			return currentPage;
		},
		set currentPage(v) {
			currentPage = v;
		},

		get currentStep() {
			return currentStep;
		},
		get repositorySubstep() {
			return repositorySubstep;
		},
		get selectedRepository() {
			return selectedRepository;
		},
		get githubConnected() {
			return githubConnected;
		},
		get checkingGithubConnection() {
			return checkingGithubConnection;
		},
		get envVars() {
			return envVars;
		},
		get createProjectPayload(): CreateProjectPayload {
			return {
				project_name: projectName,
				repository_url: selectedRepository?.clone_url ?? '',
				branch: selectedBranch
			};
		},
		get createdProject() {
			return createdProject;
		},
		get scanning() {
			return scanStatus === 'scanning';
		},
		get scanFailed() {
			return scanStatus === 'failed';
		},
		get builderDetected() {
			return builderDetected;
		},
		get scanAttempt() {
			return scanAttempt;
		},
		get deployStatus() {
			return deployStatus;
		},
		get hasUnsavedProgress() {
			if (currentStep === 1) {
				return hasEnteredConfig;
			}
			return true;
		},
		get exitDialogContent() {
			if (currentStep === 1 && hasEnteredConfig) {
				return {
					title: 'Batalkan Pembuatan Proyek?',
					description:
						'Konfigurasi yang sudah kamu isi belum disimpan. Kalau dibatalkan sekarang, semua isian ini akan hilang.'
				};
			}
			if (currentStep === 2) {
				return {
					title: 'Batalkan Proses ini?',
					description:
						'Sakala sedang menganalisis konfigurasi repositorymu. Kalau dibatalkan sekarang, proses deteksi akan dihentikan dan project ini belum akan dibuat.'
				};
			}
			return {
				title: 'Batalkan Pembuatan Proyek?',
				description: 'Semua isian akan hilang.'
			};
		},
		startScan() {
			scanStatus = 'scanning';
			builderDetected = null;
			scanAttempt++;
		},
		completeScan(detected: boolean) {
			scanStatus = 'completed';
			builderDetected = detected;
		},
		failScan() {
			scanStatus = 'failed';
			builderDetected = null;
		},
		startDeploy() {
			deployStatus = 'deploying';
		},
		confirmCancelled() {
			deployStatus = 'cancelled';
		},
		completeDeploy(success: boolean) {
			deployStatus = success ? 'success' : 'failed';
		},
		cancelDeployment,
		isDeploymentInProgress() {
			return deployStatus === 'deploying';
		},

		checkGithubConnection,
		addEnvVar,
		removeEnvVar,
		toggleEnvVisible,

		confirmGitUrl() {
			applyRepositoryDefaults(gitUrlRepository);
		},

		connectGithub() {
			githubConnected = true;
		},
		goToPrepareDeployment() {
			repositorySubstep = 'prepare-deployment';
			hasEnteredConfig = true;
		},
		backToSelectRepository() {
			repositorySubstep = 'select-repository';
		},
		goToAutoDetect(result: CreateProjectResult) {
			createdProject = result;
			currentStep = 2;
		},
		goToDeploy() {
			currentStep = 3;
			deployStatus = 'deploying';
		}
	};
}

export type ProjectWizardState = ReturnType<typeof createProjectWizardState>;
