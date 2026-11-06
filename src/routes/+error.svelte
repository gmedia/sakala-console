<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';

	const isNotFound = $derived(page.status === 404);
	const links = [
		{ label: 'Buka Proyek', href: resolve('/projects') },
		{ label: 'Ke Halaman Masuk', href: resolve('/login') }
	];
</script>

<svelte:head>
	<title>{isNotFound ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan'} | Sakala Console</title>
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="flex min-h-screen items-center justify-center bg-background p-4 outline-none"
>
	<ErrorBlock
		headingTag="h1"
		icon={isNotFound ? MagnifyingGlassIcon : WarningIcon}
		iconText={`Error ${page.status}`}
		title={isNotFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}
		description={isNotFound
			? 'Alamat ini tidak ada di Sakala Console. Mungkin tautannya salah ketik atau halamannya sudah dipindah.'
			: 'Halaman ini gagal dimuat. Muat ulang halaman, atau lanjut ke Proyek.'}
		{links}
	/>
</main>
