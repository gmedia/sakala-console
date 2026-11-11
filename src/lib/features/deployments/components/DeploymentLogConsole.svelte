<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { formatLogTime } from '$lib/features/deployments/deployment-presentation';
	import type { DeploymentLogLine } from '$lib/features/deployments/deployment-logs';
	import { cn } from '$lib/utils/cn';

	const FOLLOW_THRESHOLD_PX = 24;

	type Props = {
		lines: readonly DeploymentLogLine[];
		following?: boolean;
		paused?: boolean;
		busy?: boolean;
		/** The process may still write, so the last line gets a cursor. */
		live?: boolean;
		hasOlder?: boolean;
		loadingOlder?: boolean;
		hasNewer?: boolean;
		onLoadOlder?: () => void;
		onJumpToLatest?: () => void;
		labelledBy?: string;
		/** The bar on top of the terminal: title, follow, copy. */
		toolbar?: Snippet;
		children?: Snippet;
	};

	let {
		lines,
		following = $bindable(true),
		paused = false,
		busy = false,
		live = false,
		hasOlder = false,
		loadingOlder = false,
		hasNewer = false,
		onLoadOlder,
		onJumpToLatest,
		labelledBy,
		toolbar,
		children
	}: Props = $props();

	let scroller = $state<HTMLDivElement>();

	// The newest line the reader has seen: frozen while they are paused or scrolled up.
	let lastSeenSequence = $state<number | undefined>();
	const newLineCount = $derived.by(() => {
		if (following || lastSeenSequence === undefined) return 0;
		let count = 0;
		for (let index = lines.length - 1; index >= 0; index -= 1) {
			if (lines[index].sequence <= lastSeenSequence) break;
			count += 1;
		}
		return count;
	});

	let heightBeforeUpdate = 0;
	let topBeforeUpdate = 0;
	let previousFirstSequence: number | undefined;

	$effect.pre(() => {
		void lines;
		if (!scroller) return;
		heightBeforeUpdate = scroller.scrollHeight;
		topBeforeUpdate = scroller.scrollTop;
	});

	$effect(() => {
		const firstSequence = lines[0]?.sequence;
		if (!scroller) return;

		if (following) {
			scroller.scrollTop = scroller.scrollHeight;
			lastSeenSequence = lines.at(-1)?.sequence;
		} else if (
			firstSequence !== undefined &&
			previousFirstSequence !== undefined &&
			firstSequence < previousFirstSequence
		) {
			// Older lines were prepended: keep the line the reader was on in the same place.
			scroller.scrollTop = topBeforeUpdate + scroller.scrollHeight - heightBeforeUpdate;
		}

		previousFirstSequence = firstSequence;
	});

	function handleScroll() {
		if (!scroller) return;
		const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
		following = !paused && distance <= FOLLOW_THRESHOLD_PX;
	}

	function handleJumpToLatest() {
		following = true;
		onJumpToLatest?.();
	}

	/** Puts the first line written to stderr in view. False when no loaded line was. */
	export function revealFirstError(): boolean {
		const line = scroller?.querySelector<HTMLElement>('[data-stream="stderr"]');
		if (!scroller || !line) return false;

		following = false;
		const offset = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
		// At once: two smooth scrolls at the same time, this one and the page's, cancel each other.
		scroller.scrollTop += offset - scroller.clientHeight / 3;
		scroller.focus({ preventScroll: true });
		return true;
	}
</script>

<div
	class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-card bg-terminal font-mono text-xs leading-5 sm:text-sm sm:leading-6"
>
	{@render toolbar?.()}

	<!-- Keyboard users need focus to scroll this region. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={scroller}
		onscroll={handleScroll}
		role="log"
		tabindex="0"
		aria-labelledby={labelledBy}
		aria-label={labelledBy ? undefined : 'Log deployment'}
		aria-live={following && !busy ? 'polite' : 'off'}
		aria-busy={busy}
		class="min-h-40 flex-1 overflow-y-auto py-3 [overflow-anchor:none] focus-visible:[outline-offset:-3px] focus-visible:outline-white"
	>
		{#if hasOlder}
			<div class="mb-2 border-b border-white/10 px-3 pb-2 text-center sm:px-4">
				<button
					type="button"
					onclick={onLoadOlder}
					disabled={loadingOlder}
					class="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-control px-2 text-xs text-terminal-text hover:bg-white/10 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if loadingOlder}
						<CircleNotch size={14} weight="bold" class="animate-spin motion-reduce:animate-none" />
					{:else}
						<CaretUp size={14} weight="bold" />
					{/if}
					Muat log sebelumnya
				</button>
			</div>
		{/if}

		{#each lines as line (line.sequence)}
			<div
				data-stream={line.stream}
				class={cn(
					'grid grid-cols-[1ch_minmax(0,1fr)] gap-x-2 px-3 hover:bg-white/5 sm:grid-cols-[8ch_6ch_minmax(0,1fr)] sm:gap-x-3 sm:px-4',
					line.stream === 'stderr' && 'bg-terminal-error/10'
				)}
			>
				<span class="hidden text-terminal-muted tabular-nums sm:block">
					{formatLogTime(line.recorded_at)}
				</span>
				<span
					class={cn(
						'text-xs leading-5 sm:leading-6',
						line.stream === 'stderr' ? 'text-terminal-error' : 'text-terminal-muted'
					)}
				>
					{#if line.stream !== 'stdout'}
						<span class="sr-only sm:not-sr-only">{line.stream}</span>
						<span aria-hidden="true" class="sm:hidden">{line.stream === 'stderr' ? '!' : '>'}</span>
					{/if}
				</span>
				<span
					class={cn(
						'wrap-anywhere whitespace-pre-wrap',
						line.stream === 'stderr'
							? 'text-terminal-error'
							: line.stream === 'system'
								? 'text-terminal-muted'
								: 'text-terminal-text'
					)}>{line.message}</span
				>
			</div>
		{:else}
			<div class="px-3 py-1 sm:px-4">{@render children?.()}</div>
		{/each}

		{#if live && lines.length > 0 && following}
			<div class="px-3 sm:px-4" aria-hidden="true">
				<span
					data-testid="log-cursor"
					class="ml-[calc(1ch+0.5rem)] inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-terminal-text sm:ml-[calc(14ch+1.5rem)]"
				></span>
			</div>
		{/if}
	</div>

	{#if !following || hasNewer}
		<button
			type="button"
			onclick={handleJumpToLatest}
			class="absolute right-3 bottom-3 inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-control border border-white/20 bg-terminal px-3 font-sans text-xs font-semibold text-terminal-text shadow-overlay hover:bg-white/10 focus-visible:outline-white max-lg:min-h-control-lg"
		>
			<ArrowDown size={14} weight="bold" />
			{newLineCount > 0 ? `${newLineCount} baris baru, ke log terbaru` : 'Ke log terbaru'}
		</button>
	{/if}
</div>
