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
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	type Props = {
		repositories: Repository[];
		githubConnected: boolean;
		onNext: () => void;
		onConnectGithub: () => void;
	};

	let { repositories, githubConnected, onNext, onConnectGithub }: Props = $props();

	const wizard = getCreateProjectContext();

	let searchQuery = $state('');
	const filteredRepositories = $derived(searchRepositories(repositories, searchQuery));

	let isGitUrlValid = $state(false);
	let gitUrlTouched = $state(false);

	const isDisabled = $derived(
		wizard.repositorySource === 'github'
			? githubConnected
				? wizard.selectedRepositoryId === null
				: true
			: false
	);

	function handleNext() {
		if (wizard.repositorySource === 'git-url') {
			if (!isGitUrlValid) {
				gitUrlTouched = true;
				return;
			}
			wizard.confirmGitUrl();
		}
		onNext();
	}

	$effect(() => {
		if (wizard.repositorySource === 'github') {
			wizard.gitUrl = '';
		} else {
			wizard.selectedRepositoryId = null;
		}
		wizard.currentPage = 1;
		gitUrlTouched = false;
	});

	$effect(() => {
		void searchQuery;
		wizard.currentPage = 1;
	});
</script>

<div class="flex flex-col mt-3 gap-4">
	<div>
		<p class="text-lg font-montserrat-semibold">Pilih Repository</p>
		<p class="font-montserrat">Pilih repository yang ingin kamu deploy ke Sakala.</p>
	</div>

	<RepositorySourceTab bind:value={wizard.repositorySource} />

	{#if wizard.repositorySource === 'github'}
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
				selectedId={wizard.selectedRepositoryId}
				onSelect={(id) => {
					wizard.selectedRepositoryId = id;
				}}
				currentPage={wizard.currentPage}
				perPage={wizard.perPage}
				onPageChange={(page) => (wizard.currentPage = page)}
			/>
		{/if}
	{:else}
		<GitUrlForm
			bind:value={wizard.gitUrl}
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
