<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { formatDate } from '$lib/utils/date';
	import { Dot } from '@lucide/svelte';
	import type { Repository } from '../type';

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
		'flex cursor-pointer items-center border border-muted/40 gap-4 p-4 transition-colors focus-visible:outline-2 focus-visible:outline-primary',
		disabled && 'cursor-not-allowed opacity-50'
	)}
>
	<img
		src="/icons/github-logo.svg"
		alt="GitHub Logo"
		class="h-12 w-12 shrink-0 rounded-lg bg-muted/20 p-2"
	/>

	<div class="min-w-0 flex-1">
		<p class="truncate text-left font-montserrat-semibold font-medium">
			{repository.full_name}
		</p>
		<div class="mt-1 flex items-center gap-2 text-sm text-muted">
			<span>Diperbarui {formatDate(repository.pushed_at)}</span>
			<Dot class="h-6 w-6 fill-current text-muted-foreground" />
			<span>{repository.default_branch}</span>
		</div>
	</div>

	<span
		class={cn(
			'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
			selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
		)}
	></span>
</div>
