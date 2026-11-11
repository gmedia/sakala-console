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
	let terminal = $state<DeploymentLogConsole>();
	let copyStatus = $state('');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (page.url.hash === '#deployment-logs' && section) revealElement(section);
		return () => clearTimeout(copyTimer);
	});

	/** To the first error when one is loaded, otherwise to the log as a whole. */
	export function revealError(): void {
		if (section) revealElement(section);
		terminal?.revealFirstError();
	}

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

{#snippet toolbar()}
	<div
		class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 py-1.5 pr-1.5 pl-3 font-sans sm:pl-4"
	>
		<h2 id="deployment-logs-title" class="font-sans text-sm text-terminal-text">Log</h2>
		<span role="status" class="min-w-0 flex-1 text-xs text-terminal-muted">{copyStatus}</span>

		{#if logs.lines.length > 0}
			<div class="flex items-center gap-1.5">
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
				>
					{#if copied}
						<Check size={14} weight="bold" aria-hidden="true" />
					{:else}
						<Copy size={14} aria-hidden="true" />
					{/if}
					Salin log
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
			lines={logs.lines}
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
