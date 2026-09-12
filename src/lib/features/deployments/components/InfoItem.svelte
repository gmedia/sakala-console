<script lang="ts">
	let { label, value }: { label: string; value: string } = $props();
</script>

<div class="min-w-0 flex items-center justify-center gap-2">
	<p class="text-sm text-muted-foreground font-montserrat">{label}</p>
	<p class="text-md truncate font-semibold font-montserrat">{value}</p>
</div>
