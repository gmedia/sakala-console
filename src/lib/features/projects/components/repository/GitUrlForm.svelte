<script lang="ts">
	import {
		GITHUB_REPOSITORY_EXAMPLE,
		normalizeGithubRepositoryUrl
	} from '../../validation/repositoryUrl';

	let {
		value = $bindable(),
		touched = $bindable(false),
		apiErrorMessage = null,
		disabled = false,
		onValidityChange
	}: {
		value: string;
		touched?: boolean;
		apiErrorMessage?: string | null;
		disabled?: boolean;
		onValidityChange: (isValid: boolean) => void;
	} = $props();

	const result = $derived(normalizeGithubRepositoryUrl(value));
	const displayError = $derived((touched && !result.ok ? result.message : null) || apiErrorMessage);
	// The address that will be used, shown as soon as it differs from what was typed.
	const normalized = $derived(result.ok && result.changed ? result.url : null);

	$effect(() => {
		onValidityChange?.(result.ok);
	});
</script>

<div class="flex flex-col gap-2">
	<label for="git-url" class="font-semibold">URL repository GitHub publik</label>
	<input
		id="git-url"
		type="text"
		inputmode="url"
		autocomplete="off"
		spellcheck="false"
		aria-describedby="git-url-help"
		bind:value
		{disabled}
		onblur={() => (touched = true)}
		placeholder={GITHUB_REPOSITORY_EXAMPLE}
		class="control-input {displayError ? 'border-error' : ''}"
		aria-invalid={displayError ? 'true' : 'false'}
	/>
	{#if displayError}
		<p id="git-url-help" class="text-sm text-error-dark">{displayError}</p>
	{:else if normalized}
		<p id="git-url-help" class="text-sm wrap-anywhere" data-testid="git-url-normalized">
			Akan memakai <span class="font-mono font-medium">{normalized}</span>. Branch dipilih di
			langkah berikutnya.
		</p>
	{:else}
		<p id="git-url-help" class="text-sm">
			Untuk repository publik yang belum terhubung ke akun GitHub-mu. Alamat dari address bar,
			tombol Code, atau halaman branch juga bisa dipakai.
		</p>
	{/if}
</div>
