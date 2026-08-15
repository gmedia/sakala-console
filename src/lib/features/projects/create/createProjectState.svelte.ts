import { mockRepositories } from '$lib/features/projects/mock';
import type { Repository } from '../type';
import { parseGitUrl } from './parseGitUrl';

type WizardStep = 1 | 2 | 3;
type RepositorySubstep = 'select-repository' | 'prepare-deployment';
type EnvVar = { id: number; key: string; value: string; visible?: boolean };

export function createProjectWizardState() {
	let repositorySource = $state<'github' | 'git-url'>('github');
	let selectedRepositoryId = $state<string | null>(null);
	let prevSelectedRepositoryId: string | null = null;
	let gitUrl = $state('');
	let selectedBranch = $state('');
	let selectedPort = $state('3000');
	let projectName = $state('');
	let currentPage = $state(1);
	let currentStep = $state<WizardStep>(1);
	let repositorySubstep = $state<RepositorySubstep>('select-repository');
	let githubConnected = $state(true);
	let checkingGithubConnection = $state(true);
	let envVars = $state<EnvVar[]>([]);
	const envVisible = $state(false);
	let nextEnvId = 1;

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

	$effect(() => {
		if (selectedRepository && selectedRepositoryId !== prevSelectedRepositoryId) {
			selectedBranch = selectedRepository.default_branch ?? '';
			prevSelectedRepositoryId = selectedRepositoryId;
		}
	});

	function resolveRepository(id: string | null): Repository | null {
		if (repositorySource === 'github') {
			return mockRepositories.find((repo) => repo.id === id) ?? null;
		}
		return null;
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
			const repo = resolveRepository(v);
			selectedBranch = repo?.default_branch ?? '';
		},

		get gitUrl() {
			return gitUrl;
		},
		set gitUrl(v) {
			gitUrl = v;
		},

		get selectedBranch() {
			return selectedBranch;
		},
		set selectedBranch(v) {
			selectedBranch = v;
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

		checkGithubConnection,

		addEnvVar,

		removeEnvVar,

		toggleEnvVisible,

		connectGithub() {
			githubConnected = true;
		},
		goToPrepareDeployment() {
			repositorySubstep = 'prepare-deployment';
		},
		backToSelectRepository() {
			repositorySubstep = 'select-repository';
		},
		goToAutoDetect() {
			currentStep = 2;
		}
	};
}

export type ProjectWizardState = ReturnType<typeof createProjectWizardState>;
