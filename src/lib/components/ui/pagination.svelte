<script lang="ts">
	type Props = {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	};
	let { currentPage, totalPages, onPageChange }: Props = $props();
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-center gap-2 mt-6" aria-label="Pagination">
		<button
			disabled={currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
			class="flex items-center justify-center w-14 h-13 p-2 rounded-lg border bg-white border-muted/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<img src="/icons/chevron-left.svg" alt="prev" class="w-4 h-4" />
		</button>
		{#each Array.from({ length: totalPages }, (_, i) => i + 1) as page (page)}
			<button
				class:bg-primary={page === currentPage}
				class:text-white={page === currentPage}
				class:border-primary={page === currentPage}
				onclick={() => onPageChange(page)}
				class="font-montserrat-semibold rounded-lg px-4 border border-muted py-3"
			>
				{page}
			</button>
		{/each}
		<button
			disabled={currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
			class="flex items-center justify-center w-14 h-13 p-2 rounded-lg border bg-white border-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<img src="/icons/chevron-right.svg" alt="next" class="w-4 h-4" />
		</button>
	</nav>
{/if}
