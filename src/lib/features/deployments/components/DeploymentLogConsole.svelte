<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { formatLogTime } from '$lib/features/deployments/deployment-presentation';
	import type { DeploymentLogLine } from '$lib/features/deployments/deployment-logs';

	const FOLLOW_THRESHOLD_PX = 24;

	type Props = {
		lines: readonly DeploymentLogLine[];
		following?: boolean;
		paused?: boolean;
		busy?: boolean;
		hasOlder?: boolean;
		loadingOlder?: boolean;
		hasNewer?: boolean;
		onLoadOlder?: () => void;
		onJumpToLatest?: () => void;
		labelledBy?: string;
		children?: Snippet;
	};

	let {
		lines,
		following = $bindable(true),
		paused = false,
		busy = false,
		hasOlder = false,
		loadingOlder = false,
		hasNewer = false,
		onLoadOlder,
		onJumpToLatest,
		labelledBy,
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
</script>

<div class="relative overflow-hidden rounded-lg bg-terminal font-jetbrains-mono-regular text-sm">
	{#if hasOlder}
		<div class="border-b border-white/10 px-4 py-2 text-center">
			<button
				type="button"
				onclick={onLoadOlder}
				disabled={loadingOlder}
				class="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-terminal-text hover:bg-white/10 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
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
		class="max-h-[min(70vh,36rem)] min-h-40 overflow-y-auto p-4 leading-relaxed [overflow-anchor:none] focus-visible:outline-white focus-visible:[outline-offset:-3px] sm:p-6"
	>
		{#each lines as line (line.sequence)}
			<div class="wrap-anywhere">
				<span class="text-terminal-muted">[{formatLogTime(line.recorded_at)}]</span>
				{#if line.stream !== 'stdout'}
					<span class="text-xs text-terminal-muted">{line.stream}</span>
				{/if}
				<span class="whitespace-pre-wrap text-terminal-text">{line.message}</span>
			</div>
		{:else}
			{@render children?.()}
		{/each}
	</div>

	{#if !following || hasNewer}
		<button
			type="button"
			onclick={handleJumpToLatest}
			class="absolute right-3 bottom-3 inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-terminal px-3 font-montserrat-semibold text-xs text-terminal-text shadow-lg hover:bg-white/10 focus-visible:outline-white"
		>
			<ArrowDown size={14} weight="bold" />
			{newLineCount > 0 ? `${newLineCount} baris baru, ke log terbaru` : 'Ke log terbaru'}
		</button>
	{/if}
</div>
