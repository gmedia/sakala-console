<script lang="ts">
	let { label, value, testId }: { label: string; value: string; testId?: string } = $props();
</script>

<div class="flex min-w-0 flex-wrap items-baseline justify-center gap-x-2">
	<p class="text-sm font-montserrat">{label}</p>
	<p class="min-w-0 text-base wrap-anywhere font-semibold font-montserrat" data-testid={testId}>
		{value}
	</p>
</div>
