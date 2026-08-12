<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import RepositoryList from '../repository/RepositoryList.svelte';
	import RepositorySourceTab from '../repository/RepositorySourceTab.svelte';
	import GitUrlForm from '../repository/GitUrlForm.svelte';
	import { searchRepositories } from '../../filters';
	import type { Repository } from '../../type';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import { GithubLogoIcon, ArrowRightIcon } from 'phosphor-svelte';

	type Props = {
		repositorySource: 'github' | 'git-url';
		selectedRepositoryId: string | null;
		repositories: Repository[];
		gitUrl: string;
		currentPage: number;
		perPage: number;
		githubConnected: boolean;
		onNext: () => void;
		onConnectGithub: () => void;
	};

	let {
		repositorySource = $bindable(),
		selectedRepositoryId = $bindable(),
		repositories,
		gitUrl = $bindable(),
		currentPage = $bindable(),
		perPage,
		githubConnected,
		onNext,
		onConnectGithub
	}: Props = $props();

	let searchQuery = $state('');
	const filteredRepositories = $derived(searchRepositories(repositories, searchQuery));

	let isGitUrlValid = $state(false);
	let gitUrlTouched = $state(false);

	const isDisabled = $derived(
		repositorySource === 'github' ? (githubConnected ? selectedRepositoryId === null : true) : false
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
		{#if !githubConnected}
			<div class="flex flex-col items-center justify-center pb-6 border-b border-muted">
				<EmptyState
					icon={GithubLogoIcon}
					class="bg-background border-none shadow-none sm:py-4"
					title="Belum ada akun GitHub yang terhubung"
					description="Hubungkan akun GitHub kamu supaya Sakala bisa menampilkan repository yang bisa kamu deploy."
				/>
				<Button class="max-w-max p-3 inline-flex" onclick={onConnectGithub}>
					<GithubLogoIcon class="w-6 h-6" />
					Hubungkan GitHub
				</Button>
			</div>
			<div class="text-center">
				<p class="text-muted">
					Tidak ingin menghubungkan akun? <span class="text-primary">Gunakan Public Git URL</span>
				</p>
			</div>
		{:else}
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
		{/if}
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
		<ArrowRightIcon class="h-5 w-5" />
	</Button>
</div>
