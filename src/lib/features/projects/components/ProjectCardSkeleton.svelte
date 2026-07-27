<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
</script>

<Card class="relative rounded-xl border border-muted/30">
	<div class="flex items-center justify-between gap-2">
		<div class="h-6 w-2/3 animate-pulse rounded-md bg-background-soft"></div>
		<div class="h-5 w-16 shrink-0 animate-pulse rounded-full bg-background-soft"></div>
	</div>
	<div class="mb-5 mt-2 h-4 w-1/3 animate-pulse rounded-md bg-background-soft"></div>
	<div class="h-40 w-full animate-pulse rounded-xl bg-background-soft"></div>
	<div class="flex w-full items-center justify-between mt-4">
		<div class="mt-4 mb-2 h-4 w-24 animate-pulse rounded-md bg-background-soft"></div>
		<div class="h-9 w-24 animate-pulse rounded-md bg-background-soft"></div>
	</div>
</Card>
