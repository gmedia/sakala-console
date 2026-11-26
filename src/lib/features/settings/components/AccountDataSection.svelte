<script lang="ts">
	import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
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

<!-- One row: what it is on the left, the download on the right; what the file holds is folded. -->
<section aria-labelledby="account-data-title" class="surface-card flex flex-col gap-3 p-4 sm:p-6">
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
			<h2 id="account-data-title" class="font-sans text-base font-semibold text-foreground">
				Salinan datamu
			</h2>
			<p class="text-sm text-muted">Satu file JSON berisi akun dan proyekmu.</p>
		</div>
		<Button variant="secondary" disabled={exportData.isPending} onclick={handleExport}>
			<DownloadSimple size={16} aria-hidden="true" />
			{exportData.isPending ? 'Menyiapkan...' : 'Unduh data saya'}
		</Button>
	</div>
	<span role="status" class="text-sm text-foreground/70 empty:hidden">{status}</span>
	{#if error}
		<p role="alert" class="text-sm text-error-dark">{error}</p>
	{/if}
	<LearnMore topic="isi salinan data" testid="account-data-contents">
		<p>
			File JSON berisi data akun, proyek, deployment, notifikasi, masukan, dan nama environment
			variable tanpa nilainya. Log deployment dan jejak audit tidak termasuk.
		</p>
	</LearnMore>
</section>
