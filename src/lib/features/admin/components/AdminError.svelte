<script lang="ts">
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import Button from '$lib/components/ui/Button.svelte';
	import { ApiError, NetworkError, getErrorMessage } from '$lib/api/errors';
	import { isRateLimitError } from '$lib/api/rate-limit';

	type Props = {
		error: unknown;
		/** What failed to load, for the heading: "daftar pengguna". */
		what: string;
		onRetry?: () => void;
	};

	let { error, what, onRetry }: Props = $props();

	const copy = $derived.by(() => {
		if (error instanceof ApiError && error.isForbidden) {
			return {
				title: 'Kamu tidak lagi punya akses admin',
				text: 'API menolak permintaan ini. Peran adminmu mungkin baru dicabut. Muat ulang halaman untuk memastikan.',
				retry: false
			};
		}
		if (error instanceof ApiError && error.status === 404) {
			return {
				title: `${capitalize(what)} tidak ditemukan`,
				text: 'Datanya sudah dihapus, atau alamatnya salah.',
				retry: false
			};
		}
		if (error instanceof NetworkError) {
			return {
				title: `Gagal memuat ${what}`,
				text: 'Sakala API tidak bisa dijangkau. Cek koneksimu, lalu coba lagi.',
				retry: true
			};
		}
		if (isRateLimitError(error) || (error instanceof ApiError && error.isServerError)) {
			return { title: `Gagal memuat ${what}`, text: getErrorMessage(error, ''), retry: true };
		}
		return {
			title: `Gagal memuat ${what}`,
			text: getErrorMessage(error, 'Jawaban API tidak sesuai bentuk yang dikenal Console.'),
			retry: true
		};
	});

	function capitalize(text: string) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}
</script>

<div
	class="surface-card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center"
	role="alert"
>
	<span
		class="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"
	>
		<WarningIcon size={20} aria-hidden="true" />
	</span>
	<div class="min-w-0 flex-1">
		<p class="text-sm font-semibold text-foreground">{copy.title}</p>
		<p class="mt-0.5 text-sm text-muted">{copy.text}</p>
	</div>
	{#if copy.retry && onRetry}
		<Button variant="secondary" onclick={onRetry}>Coba lagi</Button>
	{/if}
</div>
