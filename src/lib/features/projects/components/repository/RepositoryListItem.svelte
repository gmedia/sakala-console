<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { formatDate } from '$lib/utils/date';
	import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
	import LockSimpleIcon from 'phosphor-svelte/lib/LockSimpleIcon';
	import DotIcon from 'phosphor-svelte/lib/DotIcon';
	import type { Repository } from '../../type';

	type Props = {
		repository: Repository;
		selected?: boolean;
		disabled?: boolean;
		onSelect?: (id: string) => void;
	};

	let { repository, selected = false, disabled = false, onSelect }: Props = $props();

	function handleClick() {
		if (disabled) return;
		onSelect?.(repository.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

<div
	role="radio"
	aria-checked={selected}
	aria-disabled={disabled}
	tabindex={disabled ? -1 : 0}
	onclick={handleClick}
	onkeydown={handleKeydown}
	class={cn(
		'flex cursor-pointer items-center gap-3 border border-border bg-surface p-3 transition-colors sm:gap-4 sm:p-4 focus-visible:outline-2 focus-visible:outline-primary',
		disabled && 'cursor-not-allowed opacity-50'
	)}
>
	<div class="min-w-0 flex-1">
		<div class="flex gap-2">
			<p class="min-w-0 text-left font-semibold wrap-anywhere">
				{repository.full_name}
			</p>
			{#if repository.private}
				<LockSimpleIcon class="h-5 w-5 shrink-0" aria-label="Repository privat" />
			{:else}
				<GlobeIcon class="h-5 w-5 shrink-0" aria-label="Repository publik" />
			{/if}
		</div>
		<div class="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-foreground/70">
			<span
				>{repository.pushed_at
					? `Diperbarui ${formatDate(repository.pushed_at)}`
					: 'Belum ada info update'}</span
			>
			<DotIcon class="hidden h-6 w-6 fill-current sm:block" aria-hidden="true" />
			<span>{repository.default_branch}</span>
		</div>
	</div>

	<span
		class={cn(
			'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
			selected ? 'border-primary bg-primary' : 'border-muted'
		)}
	></span>
</div>
