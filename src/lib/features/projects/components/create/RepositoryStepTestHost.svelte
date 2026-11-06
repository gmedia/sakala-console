<script lang="ts">
	import RepositoryStep from './RepositoryStep.svelte';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import type { Repository } from '../../type';

	import type { GithubInstallation } from '$lib/api/resources/github';
	import type { ProjectWizardState } from '../../create/createProjectState.svelte';

	type Props = {
		repositories?: Repository[];
		githubConnected?: boolean;
		loading?: boolean;
		errorMessage?: string | null;
		onRetry?: () => void;
		onNext?: () => void;
		onConnectGithub?: () => void;
		onSelectRepository?: (id: string, repo: Repository) => void;
		onValidateGitUrl?: (url: string) => Promise<Repository>;
		onReady?: (wizard: ProjectWizardState) => void;
		installations?: GithubInstallation[];
		installationId?: string | null;
		onInstallationChange?: (id: string) => void;
		configureUrl?: string | null;
		addAccountUrl?: string | null;
		reconnectUrl?: string | null;
		total?: number;
		currentPage?: number;
		lastPage?: number;
		onPageChange?: (page: number) => void;
		onSearch?: (search: string) => void;
		blocked?: boolean;
	};

	let {
		repositories = [],
		githubConnected = true,
		loading = false,
		errorMessage = null,
		onRetry = () => {},
		onNext = () => {},
		onConnectGithub = () => {},
		onSelectRepository,
		onValidateGitUrl = () => Promise.reject(new Error('not used')),
		onReady,
		...rest
	}: Props = $props();

	const wizard = initCreateProjectContext();
	$effect(() => {
		onReady?.(wizard);
	});
</script>

<RepositoryStep
	{repositories}
	{githubConnected}
	{loading}
	{errorMessage}
	{onRetry}
	{onNext}
	{onConnectGithub}
	{onSelectRepository}
	{onValidateGitUrl}
	{...rest}
/>
