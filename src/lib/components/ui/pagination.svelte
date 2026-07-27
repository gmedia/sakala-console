<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	type Props = {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	};
	let { currentPage, totalPages, onPageChange }: Props = $props();
	const baseButton = 'cursor-pointer font-montserrat-semibold rounded-lg w-10 h-12 border';
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-center gap-2 mt-3" aria-label="Pagination">
		<button
			aria-label="Previous Page"
			disabled={currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
			class="{baseButton} flex items-center justify-center bg-white text-black border-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<ChevronLeft class="w-6 h-6" />
		</button>
		{#each Array.from({ length: totalPages }, (_, i) => i + 1) as page (page)}
			<button
				aria-label={`Page ${page}`}
				onclick={() => onPageChange(page)}
				class="{baseButton} {page === currentPage
					? 'bg-primary text-white border-primary'
					: 'bg-white text-black border-muted/30'}"
			>
				{page}
			</button>
		{/each}
		<button
			disabled={currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
			class="{baseButton} flex items-center justify-center bg-white text-black border-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<ChevronRight class="w-6 h-6" />
		</button>
	</nav>
{/if}
