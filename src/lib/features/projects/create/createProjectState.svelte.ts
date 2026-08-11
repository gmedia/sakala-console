import { mockRepositories } from '$lib/features/projects/mock';

type WizardStep = 1 | 2 | 3;
type RepositorySubstep = 'select-repository' | 'prepare-deployment';
type DeployStatus = 'idle' | 'deploying' | 'cancelling' | 'cancelled' | 'success' | 'failed';

export function createProjectWizardState() {
	let repositorySource = $state<'github' | 'git-url'>('github');
	let selectedRepositoryId = $state<string | null>(null);
	let gitUrl = $state('');
	let selectedBranch = $state('');
	let selectedPort = $state('3000');
	let projectName = $state('');
	let currentPage = $state(1);
	let currentStep = $state<WizardStep>(1);
	let repositorySubstep = $state<RepositorySubstep>('select-repository');
	let deployStatus = $state<DeployStatus>('idle');

	const selectedRepository = $derived(
		mockRepositories.find((repo) => repo.id === selectedRepositoryId) ?? null
	);

	$effect(() => {
		if (selectedRepository) {
			selectedBranch = selectedRepository.default_branch ?? '';
		}
	});

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
		set selectedRepositoryId(v) {
			selectedRepositoryId = v;
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

		get deployStatus() {
			return deployStatus;
		},
		set deployStatus(v) {
			deployStatus = v;
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

		goToPrepareDeployment() {
			repositorySubstep = 'prepare-deployment';
		},
		backToSelectRepository() {
			repositorySubstep = 'select-repository';
		},
		goToAutoDetect() {
			currentStep = 2;
		},
		goToDeploy() {
			currentStep = 3;
			deployStatus = 'deploying';
		},

		isDeploymentInProgress() {
			return currentStep === 3 && deployStatus === 'deploying';
		},

		async cancelDeployment() {
			deployStatus = 'cancelling';
			try {
				deployStatus = 'cancelled';
			} catch (error) {
				console.error('Error cancelling deployment:', error);
				deployStatus = 'deploying';
				throw error;
			}
		}
	};
}

export type ProjectWizardState = ReturnType<typeof createProjectWizardState>;
