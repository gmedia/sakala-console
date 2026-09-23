<script lang="ts">
	import RepositoryStep from './RepositoryStep.svelte';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import type { Repository } from '../../type';

	type Props = {
		repositories?: Repository[];
		githubConnected?: boolean;
		loading?: boolean;
		errorMessage?: string | null;
		onRetry?: () => void;
		onNext?: () => void;
		onConnectGithub?: () => void;
		onSelectRepository?: (id: string, repo: Repository) => void;
	};

	let {
		repositories = [],
		githubConnected = true,
		loading = false,
		errorMessage = null,
		onRetry = () => {},
		onNext = () => {},
		onConnectGithub = () => {},
		onSelectRepository
	}: Props = $props();

	initCreateProjectContext();
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
/>
