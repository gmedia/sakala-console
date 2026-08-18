<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import type { Repository } from '../type';

	type Props = {
		repository: Repository | null;
	};

	let { repository = $bindable() }: Props = $props();

	const title = `Mendeploy ${repository?.full_name.split('/')[1]}...`;
</script>

<EmptyState
	icon={RefreshCw}
	class="bg-transparent border-none shadow-none"
	{title}
	description="Jangan tutup halaman ini, prosesnya cuma beberapa detik lagi."
/>
