<script lang="ts">
	import { resolve } from '$app/paths';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { pageTitle } from '$lib/utils/page-title';
</script>

<svelte:head><title>{pageTitle('Akses ditolak')}</title></svelte:head>
<main
	id="main-content"
	tabindex="-1"
	class="flex min-h-screen items-center justify-center p-4 outline-none"
>
	<ErrorBlock
		headingTag="h1"
		icon={WarningIcon}
		iconText="Error 403"
		iconBackgroundClass="bg-error/20"
		title="Kamu tidak memiliki akses"
		description="Halaman ini hanya untuk admin Sakala. Hubungi admin Sakala kalau ini keliru, atau kembali ke proyekmu."
		links={[{ label: 'Buka proyek', href: resolve('/projects') }]}
	/>
</main>
