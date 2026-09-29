<script lang="ts">
	let { label, value, testId }: { label: string; value: string; testId?: string } = $props();
</script>

<div class="min-w-0 flex items-center justify-center gap-2">
	<p class="text-sm text-muted-foreground font-montserrat">{label}</p>
	<p class="text-md truncate font-semibold font-montserrat" data-testid={testId}>{value}</p>
</div>
