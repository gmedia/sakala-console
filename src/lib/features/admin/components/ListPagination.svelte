<script lang="ts">
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { PageMeta } from '$lib/api/resources/admin/common';
	import { formatNumber } from '../format';

	type Props = {
		meta: PageMeta | undefined;
		noun: string;
		busy?: boolean;
		onPageChange: (page: number) => void;
	};

	let { meta, noun, busy = false, onPageChange }: Props = $props();
</script>

{#if meta && meta.total > 0}
	<div class="mt-3 flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
		<p class="text-sm text-muted" aria-live="polite">
			Menampilkan {formatNumber(meta.from ?? 0)}–{formatNumber(meta.to ?? 0)} dari {formatNumber(
				meta.total
			)}
			{noun}
		</p>
		<Pagination
			currentPage={meta.current_page}
			totalPages={meta.last_page}
			disabled={busy}
			{onPageChange}
		/>
	</div>
{/if}
