<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import RepositoryList from '../repository/RepositoryList.svelte';
	import RepositoryListSkeleton from '../repository/RepositoryListSkeleton.svelte';
	import RepositorySourceTab from '../repository/RepositorySourceTab.svelte';
	import GitUrlForm from '../repository/GitUrlForm.svelte';
	import type { Repository } from '../../type';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import type { GithubInstallation } from '$lib/api/resources/github';
	import GitBranch from 'phosphor-svelte/lib/GitBranch';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	type Props = {
		repositories: Repository[];
		githubConnected: boolean;
		loading?: boolean;
		fetching?: boolean;
		errorMessage?: string | null;
		/** Set when the API says the installation is no longer usable. */
		reconnectUrl?: string | null;
		onRetry?: () => void;
		onNext: () => void;
		onConnectGithub: () => void;
		onSelectRepository?: (id: string, repo: Repository) => void;
		onValidateGitUrl: (url: string) => Promise<Repository>;
		installations?: GithubInstallation[];
		installationId?: string | null;
		onInstallationChange?: (id: string) => void;
		configureUrl?: string | null;
		addAccountUrl?: string | null;
		total?: number;
		currentPage?: number;
		lastPage?: number;
		onPageChange?: (page: number) => void;
		search?: string;
		onSearch?: (search: string) => void;
		/** The pilot project quota is used up, so a new project would be refused. */
		blocked?: boolean;
	};

	let {
		repositories,
		githubConnected,
		loading = false,
		fetching = false,
		errorMessage = null,
		reconnectUrl = null,
		onRetry,
		onNext,
		onConnectGithub,
		onSelectRepository,
		onValidateGitUrl,
		installations = [],
		installationId = null,
		onInstallationChange,
		configureUrl = null,
		addAccountUrl = null,
		total = repositories.length,
		currentPage = 1,
		lastPage = 1,
		onPageChange,
		search = '',
		onSearch,
		blocked = false
	}: Props = $props();

	const wizard = getCreateProjectContext();

	// Reads the prop once: from here on this field is the source, and the wizard follows it.
	// svelte-ignore state_referenced_locally
	let searchQuery = $state(search);
	const isSearching = $derived(searchQuery.trim() !== '');
	const accountName = $derived(
		installations.find((installation) => installation.id === installationId)?.account_login
	);

	let isGitUrlValid = $state(false);
	let gitUrlTouched = $state(false);
	let gitUrlApiError = $state<string | null>(null);
	let isValidating = $state(false);

	const isDisabled = $derived.by(() => {
		if (blocked) return true;
		if (wizard.repositorySource !== 'github') {
			return !isGitUrlValid || wizard.gitUrl.trim() === '' || isValidating;
		}
		if (loading || errorMessage || !githubConnected) return true;
		return wizard.selectedRepositoryId === null;
	});

	function validationMessage(err: unknown): string {
		if (err instanceof ApiError && err.isValidationError) {
			return getFieldError(err, 'repository_url') ?? err.message;
		}
		return getErrorMessage(
			err,
			'Repository belum bisa diperiksa. Periksa kembali URL atau koneksi kamu, lalu coba lagi.'
		);
	}

	async function handleNext() {
		if (wizard.repositorySource === 'git-url') {
			if (!isGitUrlValid) {
				gitUrlTouched = true;
				return;
			}
			if (isValidating) return;
			gitUrlApiError = null;

			const targetUrl = wizard.gitUrl.trim();
			isValidating = true;
			try {
				const validatedRepo = await onValidateGitUrl(targetUrl);
				if (wizard.gitUrl.trim() !== targetUrl) return;
				wizard.confirmGitUrl(validatedRepo);
				onNext();
			} catch (err: unknown) {
				if (wizard.gitUrl.trim() !== targetUrl) return;
				gitUrlTouched = true;
				gitUrlApiError = validationMessage(err);
			} finally {
				isValidating = false;
			}
			return;
		}
		onNext();
	}

	function handleInstallationChange(event: Event) {
		searchQuery = '';
		onSearch?.('');
		onInstallationChange?.((event.currentTarget as HTMLSelectElement).value);
	}

	function clearSearch() {
		searchQuery = '';
		onSearch?.('');
	}

	$effect(() => {
		void wizard.repositorySource;
		gitUrlTouched = false;
	});

	$effect(() => {
		void wizard.gitUrl;
		gitUrlApiError = null;
	});
</script>

<div class="mt-3 flex flex-col gap-4">
	<div>
		<h2 tabindex="-1" data-step-heading class="text-xl outline-none">Pilih repository</h2>
		<p>Pilih repository yang ingin kamu deploy ke Sakala.</p>
	</div>

	<RepositorySourceTab bind:value={wizard.repositorySource} />

	{#if wizard.repositorySource === 'github'}
		{#if loading}
			<div class="flex flex-col overflow-hidden rounded-card border border-border">
				{#each [0, 1, 2, 3, 4] as index (index)}
					<RepositoryListSkeleton />
				{/each}
			</div>
		{:else if errorMessage && !reconnectUrl}
			<div class="flex flex-col items-center justify-center py-6">
				<EmptyState
					icon={WarningCircleIcon}
					tone="failed"
					title="Gagal memuat repository"
					description={errorMessage}
					class="border-none bg-background sm:py-4"
				>
					{#snippet action()}
						{#if onRetry}
							<Button variant="secondary" onclick={onRetry}>Coba lagi</Button>
						{/if}
					{/snippet}
				</EmptyState>
			</div>
		{:else if !githubConnected}
			<div class="flex flex-col items-center justify-center border-b border-muted pb-6">
				<EmptyState
					icon={GitBranch}
					class="border-none bg-background sm:py-4"
					title="Belum ada akun GitHub yang terhubung"
					description="Hubungkan akun GitHub kamu supaya Sakala bisa menampilkan repository yang bisa kamu deploy."
				/>
				<Button class="w-fit" onclick={onConnectGithub}>
					<SocialLogo name="github" />
					Hubungkan GitHub
				</Button>
			</div>
			<p class="text-center text-foreground/70">
				Tidak ingin menghubungkan akun?
				<Button variant="link" onclick={() => (wizard.repositorySource = 'git-url')}>
					Gunakan Public Git URL
				</Button>
			</p>
		{:else}
			{#if installations.length > 1}
				<div class="flex flex-col gap-1">
					<label for="github-installation" class="text-sm font-semibold"> Akun GitHub </label>
					<select
						id="github-installation"
						value={installationId}
						onchange={handleInstallationChange}
						class="control-input"
					>
						{#each installations as installation (installation.id)}
							<option value={installation.id}>
								{installation.account_login}{installation.status === 'active'
									? ''
									: ' (tidak aktif)'}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if errorMessage && reconnectUrl}
				<div class="flex flex-col items-center justify-center py-6">
					<EmptyState
						icon={WarningCircleIcon}
						tone="failed"
						title="Instalasi GitHub tidak aktif"
						description={errorMessage}
						class="border-none bg-background sm:py-4"
					>
						{#snippet action()}
							<div class="flex flex-wrap justify-center gap-2">
								<Button externalHref={reconnectUrl ?? undefined} sameTab>
									<SocialLogo name="github" />
									Hubungkan ulang GitHub
								</Button>
								{#if onRetry}
									<Button variant="secondary" onclick={onRetry}>Coba lagi</Button>
								{/if}
							</div>
						{/snippet}
					</EmptyState>
				</div>
			{:else}
				<SearchInput
					bind:value={searchQuery}
					placeholder="Cari repository..."
					class="w-full px-2"
					debounce={300}
					{onSearch}
				/>
				{#if repositories.length > 0}
					<RepositoryList
						{repositories}
						{total}
						{currentPage}
						{lastPage}
						{fetching}
						selectedId={wizard.selectedRepositoryId}
						onSelect={(id) => {
							const found = repositories.find((repo) => String(repo.id) === String(id));
							if (found) onSelectRepository?.(id, found);
						}}
						{onPageChange}
					/>
				{:else if isSearching}
					<EmptyState
						icon={MagnifyingGlassIcon}
						tone="muted"
						title="Tidak ada repository yang cocok"
						description={`Tidak ada repository dengan nama "${searchQuery.trim()}" di 1.000 repository pertama akun ini. Periksa ejaannya, atau atur akses Sakala kalau repository-nya memang belum dibagikan.`}
						class="border-none bg-transparent"
					>
						{#snippet action()}
							<div class="flex flex-wrap justify-center gap-2">
								<Button variant="secondary" onclick={clearSearch}>Hapus pencarian</Button>
								{#if configureUrl}
									<Button variant="secondary" externalHref={configureUrl} sameTab>
										Atur akses repository
									</Button>
								{/if}
							</div>
						{/snippet}
					</EmptyState>
				{:else}
					<EmptyState
						icon={FolderOpenIcon}
						tone="muted"
						title="Belum ada repository yang bisa dipilih"
						description={`Sakala belum diberi akses ke repository mana pun di ${accountName ?? 'akun ini'}. Atur aksesnya di GitHub, lalu kamu kembali ke halaman ini.`}
						class="border-none bg-transparent"
					>
						{#snippet action()}
							{#if configureUrl}
								<Button externalHref={configureUrl} sameTab>Atur akses repository</Button>
							{/if}
						{/snippet}
					</EmptyState>
				{/if}
				{#if addAccountUrl}
					<p class="text-sm text-foreground/70">
						Repository-mu ada di akun lain?
						<a
							class="text-primary underline-offset-2 hover:underline"
							href={addAccountUrl}
							rel="external"
						>
							Hubungkan akun GitHub lain
						</a>
					</p>
				{/if}
			{/if}
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

	{#if wizard.repositorySource === 'github' && wizard.selectedRepository}
		<p class="text-sm" data-testid="selected-repository">
			Terpilih:
			<span class="font-semibold wrap-anywhere">
				{wizard.selectedRepository.full_name}
			</span>
		</p>
	{/if}

	<Button size="lg" class="w-full" disabled={isDisabled} onclick={handleNext}>
		{#if isValidating}
			<CircleNotchIcon class="h-5 w-5 animate-spin" />
			Memvalidasi...
		{:else}
			Lanjut
			<ArrowRightIcon class="h-5 w-5" />
		{/if}
	</Button>
</div>
