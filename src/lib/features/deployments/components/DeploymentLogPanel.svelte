<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Check from 'phosphor-svelte/lib/Check';
	import Copy from 'phosphor-svelte/lib/Copy';
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import Pause from 'phosphor-svelte/lib/Pause';
	import Play from 'phosphor-svelte/lib/Play';
	import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
	import { revealElement } from '../focus-failure';
	import { formatDate } from '$lib/utils/date';
	import {
		formatLogsForClipboard,
		getLogRetentionStart,
		isLogRetentionExpired,
		LOG_RETENTION_DAYS
	} from '../deployment-logs';
	import { formatLogTime, TERMINAL_STATUSES } from '../deployment-presentation';
	import { classifyLogLines, getFailureWindow, type LogLevel } from '../log-classification';
	import {
		ALL_LOG_PROCESSES,
		filterLogLines,
		isJobOutput,
		logDownloadFileName,
		logProcessOptions,
		parseLinePermalink,
		linePermalinkHash
	} from '../log-tools';
	import { useDeploymentLogs } from '../use-deployment-logs.svelte';
	import DeploymentLogConsole from './DeploymentLogConsole.svelte';
	import { LOG_PROCESS_PARAM } from '$lib/features/workloads/routes';

	type Props = {
		projectId: string;
		deployment: Deployment;
		/** The agent's stage events, which place the failed stage in time. */
		events?: readonly DeploymentEvent[];
		/** For the downloaded file's name. */
		projectName?: string;
		/**
		 * Where a scheduled run's output can be read instead (ADR-022). Without it, the note about
		 * hidden run output does not link anywhere.
		 */
		scheduleHistoryHref?: string;
	};

	let {
		projectId,
		deployment,
		events = [],
		projectName = 'proyek',
		scheduleHistoryHref
	}: Props = $props();

	const isTerminal = $derived(TERMINAL_STATUSES.has(deployment.status));

	const logs = useDeploymentLogs(
		() => projectId,
		() => deployment.id,
		() => isTerminal
	);

	const retentionExpired = $derived(isLogRetentionExpired(deployment));
	const finishedLabel = $derived.by(() => {
		const start = getLogRetentionStart(deployment);
		return start ? formatDate(start) : null;
	});

	const failureWindow = $derived(getFailureWindow(deployment, events));
	const levels = $derived.by(() => {
		const byLine = new SvelteMap<number, LogLevel>();
		const classified = classifyLogLines(logs.lines, failureWindow);
		logs.lines.forEach((line, index) => byLine.set(line.sequence, classified[index]));
		return byLine;
	});
	const errorCount = $derived([...levels.values()].filter((level) => level === 'error').length);

	let query = $state('');
	let errorsOnly = $state(false);
	// Workers write into the same log (ADR-022); the filter appears once there is more than web.
	// A worker's crash links here with `?process=`, so the log opens on that worker.
	let processFilter = $state(page.url.searchParams.get(LOG_PROCESS_PARAM) ?? ALL_LOG_PROCESSES);
	const processOptions = $derived(logProcessOptions(logs.lines));
	const showProcessFilter = $derived(processOptions.length > 1);
	// Scheduled runs write here too, but are read in the schedule's run history.
	const jobLineCount = $derived(logs.lines.filter(isJobOutput).length);
	const ownLines = $derived(
		jobLineCount > 0 ? logs.lines.filter((line) => !isJobOutput(line)) : logs.lines
	);
	const filtering = $derived(
		errorsOnly || query.trim() !== '' || processFilter !== ALL_LOG_PROCESSES
	);
	const visibleLines = $derived(
		filterLogLines(logs.lines, {
			query,
			errorsOnly,
			process: processFilter,
			levelOf: (line) => levels.get(line.sequence)
		})
	);
	const hiddenSequences = $derived.by(() => {
		if (!filtering && jobLineCount === 0) return undefined;
		const shown = new Set(visibleLines.map((line) => line.sequence));
		return new Set(
			logs.lines.filter((line) => !shown.has(line.sequence)).map((line) => line.sequence)
		);
	});
	let searchInput = $state<HTMLInputElement>();

	// A permalink names a line by its number in the log, which stays the same across pages.
	let highlighted = $state<number | null>(parseLinePermalink(page.url.hash));
	let permalinkNote = $state('');
	let permalinkDone = false;

	let section = $state<HTMLElement>();
	let terminal = $state<DeploymentLogConsole>();
	let copyStatus = $state('');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (page.url.hash === '#deployment-logs' && section) revealElement(section);

		// `/` puts the cursor in the search, as on Render and Railway, unless the user is typing.
		function handleSlash(event: KeyboardEvent) {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
			if (!searchInput) return;
			event.preventDefault();
			searchInput.focus();
		}
		window.addEventListener('keydown', handleSlash);
		return () => {
			window.removeEventListener('keydown', handleSlash);
			clearTimeout(copyTimer);
		};
	});

	// Opening `#L120`: load older pages until line 120 is there, then show it.
	$effect(() => {
		const target = highlighted;
		if (permalinkDone || target === null || logs.isLoading || logs.isLoadingOlder) return;
		const lines = logs.lines;
		if (lines.some((line) => line.sequence === target)) {
			permalinkDone = true;
			void tick().then(() => {
				if (section) revealElement(section);
				terminal?.revealLine(target);
			});
		} else if (lines.length > 0 && target < lines[0].sequence && logs.hasOlderPages) {
			logs.loadOlder();
		} else if (lines.length > 0) {
			permalinkDone = true;
			permalinkNote = `Baris ${target} tidak ada di log yang tersimpan.`;
		}
	});

	function selectLine(sequence: number) {
		highlighted = sequence;
		permalinkDone = true;
		permalinkNote = '';
		const url = `${page.url.pathname}${page.url.search}${linePermalinkHash(sequence)}`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- this page, with a new hash
		replaceState(url, page.state);
	}

	/** To the first error when one is loaded, otherwise to the log as a whole. */
	export function revealError(): void {
		query = '';
		errorsOnly = false;
		if (section) revealElement(section);
		void tick().then(() => terminal?.revealFirstError());
	}

	/** The loaded lines of the stage that failed, oldest first, for the failure summary. */
	export function failureStageLines() {
		const window = failureWindow;
		if (!window) return [];
		return ownLines.filter((line) => {
			const time = Date.parse(line.recorded_at);
			return time >= window.start && time <= window.end;
		});
	}

	function handleDownload() {
		const text = formatLogsForClipboard(ownLines, formatLogTime);
		const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = logDownloadFileName(projectName, deployment.sequence);
		link.click();
		URL.revokeObjectURL(url);
		copyStatus = `${ownLines.length} baris diunduh`;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyStatus = ''), 4000);
	}

	async function handleCopy() {
		clearTimeout(copyTimer);

		try {
			await navigator.clipboard.writeText(formatLogsForClipboard(ownLines, formatLogTime));
			copyStatus = `${ownLines.length} baris tersalin`;
			copied = true;
		} catch {
			copied = false;
			copyStatus = 'Browser menolak akses clipboard. Salin barisnya secara manual.';
		}

		copyTimer = setTimeout(() => {
			copyStatus = '';
			copied = false;
		}, 4000);
	}
</script>

{#snippet toolbar()}
	<!-- One row where the terminal is wide, wrapping on narrow screens, so the log keeps its height. -->
	<div
		class="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-white/10 py-1.5 pr-1.5 pl-3 font-sans sm:pl-4"
	>
		<h2 id="deployment-logs-title" class="font-sans text-sm text-terminal-text">Log</h2>
		<span
			role="status"
			class="min-w-0 flex-1 basis-0 truncate text-xs text-terminal-muted {filtering
				? 'min-w-24'
				: ''}"
		>
			{copyStatus ||
				permalinkNote ||
				(filtering ? `${visibleLines.length} dari ${ownLines.length} baris` : '')}
		</span>

		{#if showProcessFilter}
			<div class="min-w-0">
				<label for="log-process" class="sr-only">Proses</label>
				<select
					id="log-process"
					bind:value={processFilter}
					class="min-h-control-sm max-w-40 rounded-control border border-white/25 bg-terminal py-1 pr-7 pl-2 font-mono text-xs text-terminal-text focus:border-white focus:outline-white max-lg:min-h-control-lg"
				>
					<option value={ALL_LOG_PROCESSES}>Semua proses</option>
					{#each processOptions as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>
		{/if}
		{#if ownLines.length > 0}
			<div class="relative min-w-0 flex-1 basis-40 sm:max-w-56">
				<MagnifyingGlass
					size={14}
					class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-terminal-muted"
					aria-hidden="true"
				/>
				<label for="log-search" class="sr-only">Cari di log</label>
				<input
					id="log-search"
					bind:this={searchInput}
					bind:value={query}
					type="search"
					autocomplete="off"
					spellcheck="false"
					placeholder="Cari (tekan /)"
					class="min-h-control-sm w-full rounded-control border border-white/25 bg-transparent py-1 pr-2 pl-8 font-mono text-xs text-terminal-text placeholder:text-terminal-muted focus:border-white focus:outline-white max-lg:min-h-control-lg"
				/>
			</div>
			<div class="flex flex-wrap items-center gap-1.5">
				<Button
					variant="terminal"
					size="sm"
					aria-pressed={errorsOnly}
					onclick={() => (errorsOnly = !errorsOnly)}
					class={errorsOnly ? 'bg-white/15' : ''}
				>
					{#if errorsOnly}
						<Check size={14} weight="bold" aria-hidden="true" />
					{/if}
					Hanya error{errorCount > 0 ? ` (${errorCount})` : ''}
				</Button>
				{#if !isTerminal}
					<Button
						variant="terminal"
						size="sm"
						onclick={logs.following ? logs.pause : logs.goToLatest}
					>
						{#if logs.following}
							<Pause size={14} aria-hidden="true" />
							Jeda
						{:else}
							<Play size={14} aria-hidden="true" />
							Ikuti log
						{/if}
					</Button>
				{/if}
				<Button
					variant="terminal"
					size="sm"
					onclick={handleCopy}
					title="Menyalin baris yang sudah dimuat"
					aria-label="Salin log"
				>
					{#if copied}
						<Check size={14} weight="bold" aria-hidden="true" />
					{:else}
						<Copy size={14} aria-hidden="true" />
					{/if}
					<span class="max-2xl:sr-only">Salin log</span>
				</Button>
				<Button
					variant="terminal"
					size="sm"
					onclick={handleDownload}
					aria-label="Unduh .txt"
					title={logs.hasOlderPages
						? 'Mengunduh baris yang sudah dimuat. Muat log sebelumnya dulu untuk menyertakan semuanya.'
						: 'Mengunduh seluruh log sebagai .txt'}
				>
					<DownloadSimple size={14} aria-hidden="true" />
					<span class="max-2xl:sr-only">Unduh .txt</span>
				</Button>
			</div>
		{/if}
	</div>
{/snippet}

<section
	bind:this={section}
	id="deployment-logs"
	tabindex="-1"
	aria-labelledby="deployment-logs-title"
	class="flex h-full min-h-0 scroll-mt-4 flex-col gap-2 rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
>
	<div class="min-h-0 flex-1">
		<DeploymentLogConsole
			bind:this={terminal}
			lines={(filtering || jobLineCount > 0) && visibleLines.length === 0 ? [] : logs.lines}
			{hiddenSequences}
			{levels}
			{highlighted}
			onSelectLine={selectLine}
			labelledBy="deployment-logs-title"
			bind:following={() => logs.following, (value) => (logs.following = value)}
			paused={logs.paused}
			busy={logs.isLoadingOlder}
			live={!isTerminal}
			hasOlder={logs.hasOlderPages}
			loadingOlder={logs.isLoadingOlder}
			hasNewer={logs.hasNewerPages}
			onLoadOlder={logs.loadOlder}
			onJumpToLatest={logs.goToLatest}
			{toolbar}
		>
			<div class="font-sans text-sm text-terminal-text">
				{#if ownLines.length === 0 && jobLineCount > 0 && !filtering}
					<p class="font-semibold">Belum ada log aplikasi yang dimuat</p>
					<p class="mt-1 text-terminal-muted">
						Baris yang dimuat hanya output jadwal. Muat log sebelumnya untuk melihat baris lain.
					</p>
				{:else if logs.lines.length > 0 && filtering}
					<p class="font-semibold">
						{errorsOnly && !query.trim()
							? 'Tidak ada baris error di log ini'
							: 'Tidak ada baris yang cocok'}
					</p>
					<p class="mt-1 text-terminal-muted">
						{errorsOnly && !query.trim()
							? failureWindow
								? 'Sakala tidak menemukan baris error di tahap yang gagal. Lihat semua baris, terutama bagian akhirnya.'
								: 'Deployment ini tidak gagal. Baris stderr biasanya hanya laporan proses, bukan error.'
							: 'Ubah kata pencarian, atau matikan Hanya error.'}
					</p>
				{:else if logs.isLoading}
					<p role="status">Memuat log...</p>
				{:else if logs.error}
					<p class="font-semibold">Log belum bisa dimuat</p>
					<p class="mt-1 text-terminal-muted">{logs.error.description}</p>
					{#if logs.error.showRetry}
						<button
							type="button"
							onclick={logs.retry}
							disabled={logs.isRetrying}
							class="mt-3 inline-flex min-h-8 cursor-pointer items-center rounded-control border border-white/20 px-3 text-xs font-semibold hover:bg-white/10 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 max-lg:min-h-control-lg"
						>
							{logs.isRetrying ? 'Memuat...' : 'Coba lagi'}
						</button>
					{/if}
				{:else if deployment.status === 'queued'}
					<p class="font-semibold">Belum ada log</p>
					<p class="mt-1 text-terminal-muted">
						Deployment ini masih mengantre. Log muncul di sini begitu prosesnya mulai.
					</p>
				{:else if !isTerminal}
					<p class="font-semibold">Menunggu log...</p>
					<p class="mt-1 text-terminal-muted">
						Baris pertama muncul di sini begitu proses mulai menulis log.
					</p>
				{:else if retentionExpired}
					<p class="font-semibold">Log sudah dihapus</p>
					<p class="mt-1 text-terminal-muted">
						Sakala menyimpan log selama {LOG_RETENTION_DAYS} hari setelah deployment selesai, dan deployment
						ini selesai pada {finishedLabel}. Jalankan deployment baru kalau kamu butuh log terbaru.
					</p>
				{:else}
					<p class="font-semibold">Tidak ada log untuk deployment ini</p>
					<p class="mt-1 text-terminal-muted">
						Deployment ini selesai tanpa mencatat baris log. Cek bagian Tahapan untuk melihat tahap
						terakhirnya.
					</p>
				{/if}
			</div>
		</DeploymentLogConsole>
	</div>

	{#if jobLineCount > 0}
		<p class="text-sm text-foreground/70" data-testid="log-job-output-note">
			{jobLineCount} baris output jadwal tidak ditampilkan di sini.
			{#if scheduleHistoryHref}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved by the caller -->
				<a
					href={scheduleHistoryHref}
					class="font-medium text-primary underline-offset-2 hover:underline"
					>Lihat di riwayat run jadwal</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->.
			{:else}
				Baca output itu di riwayat run jadwalnya.
			{/if}
		</p>
	{/if}

	{#if logs.lines.length > 0 && logs.error}
		<div
			role="alert"
			class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-error/30 bg-error-50 px-4 py-2 text-sm text-error-dark"
		>
			<span>{logs.error.description} Baris yang sudah tampil tidak hilang.</span>
			{#if logs.error.showRetry}
				<Button
					variant="secondary"
					size="sm"
					type="button"
					onclick={logs.retry}
					disabled={logs.isRetrying}
				>
					{logs.isRetrying ? 'Memuat...' : 'Coba lagi'}
				</Button>
			{/if}
		</div>
	{/if}
</section>
