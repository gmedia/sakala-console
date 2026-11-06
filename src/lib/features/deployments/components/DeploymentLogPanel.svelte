<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Check from 'phosphor-svelte/lib/Check';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Pause from 'phosphor-svelte/lib/Pause';
	import Play from 'phosphor-svelte/lib/Play';
	import type { Deployment } from '$lib/api/resources/deployment';
	import { revealElement } from '../focus-failure';
	import { formatDate } from '$lib/utils/date';
	import {
		formatLogsForClipboard,
		getLogRetentionStart,
		isLogRetentionExpired,
		LOG_RETENTION_DAYS
	} from '../deployment-logs';
	import { formatLogTime, TERMINAL_STATUSES } from '../deployment-presentation';
	import { useDeploymentLogs } from '../use-deployment-logs.svelte';
	import DeploymentLogConsole from './DeploymentLogConsole.svelte';

	type Props = {
		projectId: string;
		deployment: Deployment;
	};

	let { projectId, deployment }: Props = $props();

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

	let section = $state<HTMLElement>();
	let copyStatus = $state('');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (page.url.hash === '#deployment-logs' && section) revealElement(section);
		return () => clearTimeout(copyTimer);
	});

	async function handleCopy() {
		clearTimeout(copyTimer);

		try {
			await navigator.clipboard.writeText(formatLogsForClipboard(logs.lines, formatLogTime));
			copyStatus = `${logs.lines.length} baris tersalin`;
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

<section
	bind:this={section}
	id="deployment-logs"
	tabindex="-1"
	aria-labelledby="deployment-logs-title"
	class="scroll-mt-4 rounded-control focus:ring-2 focus:ring-primary focus:ring-offset-4 focus:outline-none"
>
	<div class="flex flex-wrap items-center justify-between gap-2 py-2">
		<h2 id="deployment-logs-title" class="font-semibold text-base">Log</h2>

		{#if logs.lines.length > 0}
			<div class="flex flex-wrap items-center gap-3">
				<span role="status" class="text-xs text-foreground/70">{copyStatus}</span>
				{#if !isTerminal}
					<Button
						variant="secondary"
						size="sm"
						onclick={logs.following ? logs.pause : logs.goToLatest}
					>
						{#if logs.following}
							<Pause size={14} />
							Jeda
						{:else}
							<Play size={14} />
							Ikuti log
						{/if}
					</Button>
				{/if}
				<Button
					variant="secondary"
					size="sm"
					onclick={handleCopy}
					title="Menyalin baris yang sudah dimuat"
				>
					{#if copied}
						<Check size={14} weight="bold" />
					{:else}
						<Copy size={14} />
					{/if}
					Salin log
				</Button>
			</div>
		{/if}
	</div>

	<DeploymentLogConsole
		lines={logs.lines}
		labelledBy="deployment-logs-title"
		bind:following={() => logs.following, (value) => (logs.following = value)}
		paused={logs.paused}
		busy={logs.isLoadingOlder}
		hasOlder={logs.hasOlderPages}
		loadingOlder={logs.isLoadingOlder}
		hasNewer={logs.hasNewerPages}
		onLoadOlder={logs.loadOlder}
		onJumpToLatest={logs.goToLatest}
	>
		<div class="text-terminal-text">
			{#if logs.isLoading}
				<p role="status">Memuat log...</p>
			{:else if logs.error}
				<p class="font-semibold">Log belum bisa dimuat</p>
				<p class="mt-1 text-terminal-muted">{logs.error.description}</p>
				{#if logs.error.showRetry}
					<button
						type="button"
						onclick={logs.retry}
						disabled={logs.isRetrying}
						class="mt-3 inline-flex min-h-8 cursor-pointer items-center rounded-control border border-white/20 px-3 font-semibold text-xs hover:bg-white/10 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
					>
						{logs.isRetrying ? 'Memuat...' : 'Coba lagi'}
					</button>
				{/if}
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
					Deployment ini selesai tanpa mencatat baris log. Cek timeline di atas untuk melihat tahap
					terakhirnya.
				</p>
			{/if}
		</div>
	</DeploymentLogConsole>

	{#if logs.lines.length > 0 && logs.error}
		<div
			role="alert"
			class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-error/30 bg-error-50 px-4 py-2 text-sm text-error-dark"
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
