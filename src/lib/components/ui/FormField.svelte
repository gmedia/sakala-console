<script lang="ts">
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import type { FullAutoFill } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Props = {
		id: string;
		label: string;
		value: string;
		type?: 'text' | 'email' | 'password';
		placeholder?: string;
		hint?: string;
		error?: string | null;
		autocomplete?: FullAutoFill;
		inputmode?: 'text' | 'numeric';
		spellcheck?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		inputClass?: string;
		oninput?: () => void;
	};

	let {
		id,
		label,
		value = $bindable(),
		type = 'text',
		placeholder,
		hint,
		error,
		autocomplete,
		inputmode,
		spellcheck,
		disabled = false,
		readonly = false,
		inputClass,
		oninput
	}: Props = $props();

	let revealed = $state(false);

	const isPassword = $derived(type === 'password');
	const describedBy = $derived(error ? `${id}-error` : hint ? `${id}-hint` : undefined);
</script>

<div class="space-y-2">
	<label for={id} class="block font-sans text-sm font-medium text-foreground">{label}</label>
	<div class="relative">
		<input
			{id}
			type={isPassword && revealed ? 'text' : type}
			bind:value
			{placeholder}
			{autocomplete}
			{inputmode}
			{spellcheck}
			{disabled}
			{readonly}
			{oninput}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class={cn(
				'w-full rounded-xl border bg-white px-4 py-3 font-sans text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-background-soft/60 read-only:bg-background-soft/60',
				isPassword && 'pr-11',
				error
					? 'border-error-base focus:border-error-base focus:ring-error-base'
					: 'border-border-strong focus:border-primary-dark focus:ring-primary-dark',
				inputClass
			)}
		/>
		{#if isPassword}
			<button
				type="button"
				onclick={() => (revealed = !revealed)}
				class="absolute right-1 top-0.5 flex size-10 cursor-pointer items-center justify-center text-muted hover:text-foreground"
				aria-label={revealed ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
			>
				{#if revealed}
					<EyeSlash size={18} />
				{:else}
					<Eye size={18} />
				{/if}
			</button>
		{/if}
	</div>
	{#if error}
		<p id="{id}-error" class="font-sans text-xs text-error-base">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="font-sans text-xs text-foreground/70">{hint}</p>
	{/if}
</div>
