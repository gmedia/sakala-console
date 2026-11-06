<script lang="ts">
	type Props = {
		message: string;
	};

	let { message }: Props = $props();
</script>

<p
	class="rounded-lg border border-primary/30 bg-primary-50 p-3 text-sm font-medium text-foreground"
	role="status"
>
	{message}
</p>
