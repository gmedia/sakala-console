<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import RepositoryList from '../repository/RepositoryList.svelte';
	import RepositorySourceTab from '../repository/RepositorySourceTab.svelte';
	import GitUrlForm from '../repository/GitUrlForm.svelte';
	import { searchRepositories } from '../../filters';
	import { ArrowRight } from '@lucide/svelte';
	import type { Repository } from '../../type';

	type Props = {
		repositorySource: 'github' | 'git-url';
		selectedRepositoryId: string | null;
		repositories: Repository[];
		gitUrl: string;
		currentPage: number;
		perPage: number;
		onNext: () => void;
	};

	let {
		repositorySource = $bindable(),
		selectedRepositoryId = $bindable(),
		repositories,
		gitUrl = $bindable(),
		currentPage = $bindable(),
		perPage,
		onNext
	}: Props = $props();

	let searchQuery = $state('');
	const filteredRepositories = $derived(searchRepositories(repositories, searchQuery));

	let isGitUrlValid = $state(false);
	let gitUrlTouched = $state(false);

	const isDisabled = $derived(
		repositorySource === 'github' ? selectedRepositoryId === null : false
	);

	function handleNext() {
		if (repositorySource === 'git-url' && !isGitUrlValid) {
			gitUrlTouched = true;
			return;
		}
		onNext();
	}

	$effect(() => {
		if (repositorySource === 'github') {
			gitUrl = '';
		} else {
			selectedRepositoryId = null;
		}
		currentPage = 1;
		gitUrlTouched = false;
	});
</script>

<div class="flex flex-col mt-3 gap-4">
	<div>
		<p class="text-lg font-montserrat-semibold">Pilih Repository</p>
		<p class="font-montserrat">Pilih repository yang ingin kamu deploy ke Sakala.</p>
	</div>

	<RepositorySourceTab bind:value={repositorySource} />

	{#if repositorySource === 'github'}
		<SearchInput bind:value={searchQuery} placeholder="Cari repository.." class="w-full px-2" />
		<RepositoryList
			repositories={filteredRepositories}
			loading={false}
			selectedId={selectedRepositoryId}
			onSelect={(id) => {
				selectedRepositoryId = id;
			}}
			{currentPage}
			{perPage}
			onPageChange={(page) => (currentPage = page)}
		/>
	{:else}
		<GitUrlForm
			bind:value={gitUrl}
			bind:touched={gitUrlTouched}
			onValidityChange={(isValid) => (isGitUrlValid = isValid)}
		/>
	{/if}

	<Button
		variant="primary"
		class="w-full py-3 cursor-pointer"
		disabled={isDisabled}
		onclick={handleNext}
	>
		Lanjut
		<ArrowRight class="h-5 w-5" />
	</Button>
</div>
