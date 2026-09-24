<script lang="ts">
	import RepositoryStep from './RepositoryStep.svelte';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import type { Repository } from '../../type';

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
		onValidateGitUrl,
		onReady
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
/>
