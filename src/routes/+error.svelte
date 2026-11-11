<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ApiError } from '$lib/api/errors';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';

	const isNotFound = $derived(page.status === 404);

	// Only a 401 says nobody is signed in. Anything else keeps the way to the projects.
	const currentUser = useCurrentUser();
	const isSignedOut = $derived(
		currentUser.error instanceof ApiError && currentUser.error.isUnauthenticated
	);
	const links = $derived(
		isSignedOut
			? [{ label: 'Masuk', href: resolve('/login') }]
			: [{ label: 'Buka proyek', href: resolve('/projects') }]
	);
</script>

<svelte:head>
	<title>{pageTitle(isNotFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan')}</title>
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
		iconClass={isNotFound ? 'text-muted' : undefined}
		iconTextClass={isNotFound ? 'text-muted' : undefined}
		iconBackgroundClass={isNotFound ? 'bg-background-soft' : undefined}
		title={isNotFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}
		description={isNotFound
			? 'Alamat ini tidak ada di Sakala Console. Mungkin tautannya salah ketik atau halamannya sudah dipindah.'
			: 'Halaman ini gagal dimuat. Muat ulang halaman, atau lanjut ke Proyek.'}
		{links}
	/>
</main>
