<script lang="ts">
	type Props = {
		label: string;
	};

	let { label }: Props = $props();
</script>

<div class="flex items-center gap-3 text-xs text-muted">
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
	{label}
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
</div>
