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
		required?: boolean;
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
		required,
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

<div class="space-y-1.5">
	<label for={id} class="block text-sm font-medium text-foreground">{label}</label>
	<div class="relative">
		<input
			{id}
			type={isPassword && revealed ? 'text' : type}
			bind:value
			{placeholder}
			{autocomplete}
			{inputmode}
			{required}
			{spellcheck}
			{disabled}
			{readonly}
			{oninput}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class={cn('control-input', isPassword && 'pr-11', inputClass)}
		/>
		{#if isPassword}
			<button
				type="button"
				onclick={() => (revealed = !revealed)}
				class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted hover:text-foreground"
				aria-label={`${revealed ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`}
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
		<p id="{id}-error" class="text-xs text-error-base">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="text-xs text-foreground/70">{hint}</p>
	{/if}
</div>
