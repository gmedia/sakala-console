<script lang="ts">
	import { validateRepositoryUrl } from '../../validation/repository-url';

	let {
		value = $bindable(),
		touched = $bindable(false),
		onValidityChange
	}: {
		value: string;
		touched?: boolean;
		onValidityChange: (isValid: boolean) => void;
	} = $props();

	const validationError = $derived(validateRepositoryUrl(value));
	const displayError = $derived(touched ? validationError : null);

	$effect(() => {
		onValidityChange?.(validationError === null);
	});

	function handleBlur() {
		touched = true;
	}
</script>

<div class="flex flex-col gap-2">
	<p class="font-montserrat-semibold">URL repository publik</p>
	<input
		type="text"
		bind:value
		onblur={handleBlur}
		placeholder="https : // github.com/username/nama-repo.git"
		class="w-full rounded-md border {displayError
			? 'border-error'
			: 'border-muted/30'} bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-muted/10"
		aria-invalid={displayError ? 'true' : 'false'}
	/>
	{#if displayError}
		<p class="text-sm text-red-500 font-montserrat">{displayError}</p>
	{:else}
		<p class="text-sm font-montserrat">
			Dipakai untuk repository publik yang belum terhubung ke akun GitHubmu. Repo harus bisa diakses
			tanpa login.
		</p>
	{/if}
</div>
