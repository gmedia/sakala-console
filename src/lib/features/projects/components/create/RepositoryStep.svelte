<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import RepositoryList from '../repository/RepositoryList.svelte';
	import RepositoryListSkeleton from '../repository/RepositoryListSkeleton.svelte';
	import RepositorySourceTab from '../repository/RepositorySourceTab.svelte';
	import GitUrlForm from '../repository/GitUrlForm.svelte';
	import { searchRepositories } from '../../filters';
	import type { Repository } from '../../type';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import {
		GithubLogoIcon,
		ArrowRightIcon,
		WarningCircleIcon,
		CircleNotchIcon
	} from 'phosphor-svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	type Props = {
		repositories: Repository[];
		githubConnected: boolean;
		loading?: boolean;
		errorMessage?: string | null;
		onRetry?: () => void;
		onNext: () => void;
		onConnectGithub: () => void;
		onSelectRepository?: (id: string, repo: Repository) => void;
		onValidateGitUrl?: (url: string) => Promise<Repository>;
	};

	let {
		repositories,
		githubConnected,
		loading = false,
		errorMessage = null,
		onRetry,
		onNext,
		onConnectGithub,
		onSelectRepository,
		onValidateGitUrl
	}: Props = $props();

	const wizard = getCreateProjectContext();

	let searchQuery = $state('');
	const filteredRepositories = $derived(searchRepositories(repositories, searchQuery));

	let isGitUrlValid = $state(false);
	let gitUrlTouched = $state(false);
	let gitUrlApiError = $state<string | null>(null);
	let isValidating = $state(false);

	const isDisabled = $derived(
		wizard.repositorySource === 'github'
			? loading || Boolean(errorMessage) || !githubConnected
				? true
				: wizard.selectedRepositoryId === null
			: !isGitUrlValid || wizard.gitUrl.trim() === '' || isValidating
	);

	async function handleNext() {
		if (wizard.repositorySource === 'git-url') {
			if (!isGitUrlValid) {
				gitUrlTouched = true;
				return;
			}
			gitUrlApiError = null;

			if (onValidateGitUrl) {
				const targetUrl = wizard.gitUrl.trim();
				isValidating = true;
				try {
					const validatedRepo = await onValidateGitUrl(targetUrl);
					if (wizard.gitUrl.trim() !== targetUrl) {
						return;
					}
					wizard.confirmGitUrl(validatedRepo);
					onNext();
				} catch (err: unknown) {
					if (wizard.gitUrl.trim() !== targetUrl) {
						return;
					}
					gitUrlTouched = true;
					const anyErr = err as {
						isValidationError?: boolean;
						errors?: Record<string, string[]>;
						message?: string;
					};
					if (anyErr?.isValidationError && anyErr?.errors) {
						gitUrlApiError =
							anyErr.errors.repository_url?.[0] ||
							anyErr.message ||
							'Repository GitHub publik tidak valid atau tidak ditemukan.';
					} else if (anyErr?.message) {
						gitUrlApiError = anyErr.message;
					} else {
						gitUrlApiError =
							'Gagal memvalidasi repository GitHub. Silakan periksa kembali URL atau koneksi kamu.';
					}
				} finally {
					isValidating = false;
				}
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

	$effect(() => {
		void wizard.gitUrl;
		gitUrlApiError = null;
	});
</script>

<div class="flex flex-col mt-3 gap-4">
	<div>
		<p class="text-lg font-montserrat-semibold">Pilih Repository</p>
		<p class="font-montserrat">Pilih repository yang ingin kamu deploy ke Sakala.</p>
	</div>

	<RepositorySourceTab bind:value={wizard.repositorySource} />

	{#if wizard.repositorySource === 'github'}
		{#if loading}
			<div class="flex flex-col overflow-hidden rounded-xl border border-muted/40">
				{#each [0, 1, 2, 3, 4] as index (index)}
					<RepositoryListSkeleton />
				{/each}
			</div>
		{:else if errorMessage}
			<div class="flex flex-col items-center justify-center py-6">
				<EmptyState
					icon={WarningCircleIcon}
					tone="failed"
					title="Gagal Memuat Repository"
					description={errorMessage}
					class="bg-background border-none shadow-none sm:py-4"
				>
					{#snippet action()}
						{#if onRetry}
							<Button variant="outline" onclick={onRetry}>Coba Lagi</Button>
						{/if}
					{/snippet}
				</EmptyState>
			</div>
		{:else if !githubConnected}
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
			<SearchInput bind:value={searchQuery} placeholder="Cari repository.." class="w-full px-2" />
			<RepositoryList
				repositories={filteredRepositories}
				loading={false}
				selectedId={wizard.selectedRepositoryId}
				onSelect={(id) => {
					wizard.selectedRepositoryId = id;
					const found = repositories.find((r) => String(r.id) === String(id));
					if (found && onSelectRepository) {
						onSelectRepository(id, found);
					}
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
			disabled={isValidating}
			apiErrorMessage={gitUrlApiError}
			onValidityChange={(isValid) => (isGitUrlValid = isValid)}
		/>
	{/if}

	<Button
		variant="primary"
		class="w-full py-3 cursor-pointer"
		disabled={isDisabled}
		onclick={handleNext}
	>
		{#if isValidating}
			<CircleNotchIcon class="h-5 w-5 animate-spin" />
			Memvalidasi...
		{:else}
			Lanjut
			<ArrowRightIcon class="h-5 w-5" />
		{/if}
	</Button>
</div>
