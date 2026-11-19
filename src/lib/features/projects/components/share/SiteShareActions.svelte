<script lang="ts">
	import { onMount } from 'svelte';
	import QrCodeIcon from 'phosphor-svelte/lib/QrCodeIcon';
	import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetworkIcon';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { QR_QUIET_ZONE, qrPath } from './qr-path';

	type Props = {
		url: string;
		/** What the address is shown as, without the scheme. */
		label: string;
		projectName: string;
	};

	let { url, label, projectName }: Props = $props();

	/** Copying is the fallback when a share sheet is missing or refuses. */
	const SHARE_COPY_MESSAGES = {
		success: 'Alamat disalin. Tempel di chat untuk membagikannya.',
		failure: 'Browser menolak akses clipboard. Salin alamatnya secara manual.'
	};

	// Phones and some desktop browsers have a share sheet. Elsewhere Salin, next to this, does the job.
	let canShare = $state(false);
	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});

	async function share() {
		try {
			await navigator.share({ title: projectName, url });
		} catch (error) {
			// Closing the sheet is a choice, not a failure.
			if (error instanceof DOMException && error.name === 'AbortError') return;
			await copyWithToast(url, SHARE_COPY_MESSAGES);
		}
	}

	let qrOpen = $state(false);
	let qr = $state<{ d: string; size: number } | null>(null);
	let qrError = $state('');

	// The encoder loads with the dialog, so a page that never shows a QR code never downloads it.
	async function openQr() {
		qrOpen = true;
		if (qr) return;
		try {
			const { encode } = await import('uqr');
			qr = qrPath(encode(url, { ecc: 'M', border: QR_QUIET_ZONE }));
		} catch {
			qrError = 'Kode QR belum bisa dibuat. Salin alamatnya sebagai gantinya.';
		}
	}
</script>

{#if canShare}
	<Button variant="secondary" onclick={share}>
		<ShareNetworkIcon size={18} aria-hidden="true" />
		Bagikan
	</Button>
{/if}
<Button variant="secondary" onclick={openQr}>
	<QrCodeIcon size={18} aria-hidden="true" />
	Kode QR
</Button>

<Dialog
	bind:open={qrOpen}
	title="Buka dari HP"
	description="Arahkan kamera HP ke kode ini untuk membuka situsnya."
	cancelLabel="Tutup"
	hideConfirm
	onConfirm={() => (qrOpen = false)}
	class="text-center"
>
	<div class="flex flex-col items-center gap-3">
		{#if qr}
			<svg
				viewBox="0 0 {qr.size} {qr.size}"
				class="size-56 max-w-full rounded-control bg-white text-foreground"
				role="img"
				aria-label="Kode QR untuk {label}"
				shape-rendering="crispEdges"
				data-testid="site-qr"
			>
				<path d={qr.d} fill="currentColor" />
			</svg>
		{:else if qrError}
			<p class="text-sm text-error-dark" role="alert">{qrError}</p>
		{:else}
			<div class="size-56 animate-pulse rounded-control bg-muted/10" aria-hidden="true"></div>
		{/if}
		<p class="font-mono text-sm wrap-anywhere text-foreground"><BreakableUrl text={label} /></p>
	</div>
</Dialog>
