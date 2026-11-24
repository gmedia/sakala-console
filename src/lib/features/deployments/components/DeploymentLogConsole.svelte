<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import { formatLogTime } from '$lib/features/deployments/deployment-presentation';
	import type { DeploymentLogLine } from '$lib/features/deployments/deployment-logs';
	import type { LogLevel } from '$lib/features/deployments/log-classification';
	import { cn } from '$lib/utils/cn';
	import { JOB_PROCESS } from '$lib/features/workloads/rules';

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
		/** By `sequence`, from `classifyLogLines`. A line without one is normal. */
		levels?: ReadonlyMap<number, LogLevel>;
		/**
		 * Lines the search or "Hanya error" leaves out. They stay in the DOM, hidden, because
		 * recreating 2,000 rows when a filter is cleared took about 500 ms.
		 */
		hiddenSequences?: ReadonlySet<number>;
		/** The line a permalink points at (`#L120`), shown highlighted. */
		highlighted?: number | null;
		/** A line number was clicked: the page puts it in the address. */
		onSelectLine?: (sequence: number) => void;
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
		levels,
		hiddenSequences,
		highlighted = null,
		onSelectLine,
		toolbar,
		children
	}: Props = $props();

	const levelOf = (sequence: number): LogLevel => levels?.get(sequence) ?? 'normal';

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

	function reveal(line: HTMLElement | null | undefined): boolean {
		if (!scroller || !line) return false;
		following = false;
		const offset = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
		// At once: two smooth scrolls at the same time, this one and the page's, cancel each other.
		scroller.scrollTop += offset - scroller.clientHeight / 3;
		scroller.focus({ preventScroll: true });
		return true;
	}

	/** Puts the first error line in view. False when no loaded line is one. */
	export function revealFirstError(): boolean {
		return reveal(scroller?.querySelector<HTMLElement>('[data-level="error"]'));
	}

	/** Puts a line in view by its number. False when it is not loaded or filtered out. */
	export function revealLine(sequence: number): boolean {
		return reveal(scroller?.querySelector<HTMLElement>(`[data-sequence="${sequence}"]`));
	}

	function handleSelectLine(event: MouseEvent, sequence: number) {
		event.preventDefault();
		onSelectLine?.(sequence);
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
			{@const level = levelOf(line.sequence)}
			<!-- stderr alone is not an error: tools write progress there. Only `level` colours a line. -->
			<div
				data-stream={line.stream}
				data-level={level}
				data-sequence={line.sequence}
				hidden={hiddenSequences?.has(line.sequence)}
				data-highlighted={highlighted === line.sequence ? '' : undefined}
				class={cn(
					'grid grid-cols-[4ch_1.25rem_minmax(0,1fr)] gap-x-2 border-l-2 border-transparent pr-3 pl-1 hover:bg-white/5 sm:grid-cols-[5ch_8ch_6ch_minmax(0,1fr)] sm:gap-x-3 sm:pr-4 sm:pl-2',
					level === 'error' && 'border-terminal-error',
					highlighted === line.sequence && 'border-primary-300 bg-white/10 hover:bg-white/10'
				)}
			>
				<a
					href="#L{line.sequence}"
					onclick={(event) => handleSelectLine(event, line.sequence)}
					class="text-right text-terminal-muted tabular-nums no-underline hover:text-terminal-text hover:underline focus-visible:outline-white"
					aria-label="Tautan ke baris {line.sequence}"
				>
					{line.sequence}
				</a>
				<span class="hidden text-terminal-muted tabular-nums sm:block">
					{formatLogTime(line.recorded_at)}
				</span>
				<span
					class={cn(
						'flex items-start text-xs leading-5 sm:leading-6',
						level === 'error'
							? 'text-terminal-error'
							: level === 'warning'
								? 'text-terminal-warning'
								: 'text-terminal-muted'
					)}
				>
					{#if level === 'error'}
						<XCircle
							size={14}
							weight="bold"
							class="mt-[0.1875rem] shrink-0 sm:mt-[0.3125rem] sm:mr-1"
							aria-hidden="true"
						/>
						<span class="sr-only sm:not-sr-only">error</span>
					{:else if level === 'warning'}
						<span aria-hidden="true" class="sm:hidden">!</span>
						<span class="sr-only sm:not-sr-only">warn</span>
					{:else if line.stream !== 'stdout'}
						<span class="sr-only sm:not-sr-only">{line.stream}</span>
					{/if}
				</span>
				<span
					class={cn(
						'wrap-anywhere whitespace-pre-wrap',
						level === 'error'
							? 'text-terminal-error'
							: level === 'warning'
								? 'text-terminal-warning'
								: line.stream === 'system'
									? 'text-terminal-muted'
									: 'text-terminal-text'
					)}
					>{#if line.process && line.process !== JOB_PROCESS}<span
							class="mr-2 text-terminal-muted"
							data-testid="log-line-process">[{line.process}]</span
						>{/if}{line.message}</span
				>
			</div>
		{:else}
			<div class="px-3 py-1 sm:px-4">{@render children?.()}</div>
		{/each}

		{#if live && lines.length > 0 && following}
			<div class="px-3 sm:px-4" aria-hidden="true">
				<span
					data-testid="log-cursor"
					class="ml-[calc(4ch+1.25rem+1rem-0.5rem)] inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-terminal-text motion-reduce:animate-none sm:ml-[calc(19ch+2.25rem)]"
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
