<script lang="ts">
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import { LEGAL_LINKS } from '$lib/config/project';
	import LegalLink from '$lib/features/auth/components/LegalLink.svelte';
	import { useExportAccountData } from '$lib/features/auth/mutations';
	import { describeTruncatedExport, EXPORT_FILE_NAME, saveJsonFile } from '../account-export';

	const exportData = useExportAccountData();

	let status = $state('');
	let error = $state('');

	async function handleExport() {
		status = '';
		error = '';
		try {
			const data = await exportData.mutateAsync();
			saveJsonFile(EXPORT_FILE_NAME, data);
			status = ['Salinan datamu sudah diunduh.', describeTruncatedExport(data)]
				.filter(Boolean)
				.join(' ');
		} catch (cause) {
			error =
				cause instanceof ApiError && cause.isRateLimited
					? 'Salinan data sudah terlalu sering diunduh. Tunggu sekitar satu jam, lalu coba lagi.'
					: getErrorMessage(cause, 'Salinan data belum bisa diunduh. Coba lagi.');
		}
	}
</script>

<section aria-labelledby="account-data-title" class="surface-card space-y-4 p-6">
	<div>
		<h2 id="account-data-title" class="font-sans text-base font-semibold text-foreground">
			Salinan datamu
		</h2>
		<p class="mt-1 text-sm text-muted">
			File JSON berisi data akun, proyek, deployment, notifikasi, masukan, dan nama environment
			variable tanpa nilainya. Log deployment dan jejak audit tidak termasuk.
		</p>
	</div>

	<div class="flex flex-wrap items-center justify-end gap-3">
		<span role="status" class="mr-auto text-sm text-foreground/70">{status}</span>
		{#if error}
			<p role="alert" class="mr-auto text-sm text-error-dark">{error}</p>
		{/if}
		<Button variant="secondary" disabled={exportData.isPending} onclick={handleExport}>
			<DownloadSimple size={16} aria-hidden="true" />
			{exportData.isPending ? 'Menyiapkan...' : 'Unduh data saya'}
		</Button>
	</div>

	<p
		class="flex flex-wrap gap-x-4 border-t border-border pt-4 text-xs text-muted [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center"
	>
		<LegalLink href={LEGAL_LINKS.terms}>Syarat Layanan</LegalLink>
		<LegalLink href={LEGAL_LINKS.acceptableUse}>Kebijakan Penggunaan Wajar</LegalLink>
		<LegalLink href={LEGAL_LINKS.privacy}>Pemberitahuan Privasi</LegalLink>
	</p>
</section>
