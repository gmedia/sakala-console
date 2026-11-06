<script lang="ts">
	import { validateRepositoryUrl } from '../../validation/repositoryUrl';

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

	const validationError = $derived(validateRepositoryUrl(value));
	const displayError = $derived((touched ? validationError : null) || apiErrorMessage);

	$effect(() => {
		onValidityChange?.(validationError === null);
	});

	function handleBlur() {
		touched = true;
	}
</script>

<div class="flex flex-col gap-2">
	<label for="git-url" class="font-montserrat-semibold">URL repository publik</label>
	<input
		id="git-url"
		type="text"
		aria-describedby="git-url-help"
		bind:value
		{disabled}
		onblur={handleBlur}
		placeholder="https://github.com/username/nama-repo.git"
		class="w-full rounded-md border {displayError
			? 'border-error-dark'
			: 'border-border-strong'} bg-white p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-muted/10 disabled:cursor-not-allowed disabled:bg-muted/10 disabled:opacity-60"
		aria-invalid={displayError ? 'true' : 'false'}
	/>
	{#if displayError}
		<p id="git-url-help" class="text-sm text-error-dark font-montserrat">{displayError}</p>
	{:else}
		<p id="git-url-help" class="text-sm font-montserrat">
			Dipakai untuk repository publik yang belum terhubung ke akun GitHubmu. Repo harus bisa diakses
			tanpa login.
		</p>
	{/if}
</div>
