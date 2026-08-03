<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import type { StatusDeployment } from '../type';

	type Props = {
		status: StatusDeployment;
		title?: string;
	};

	let { status, title }: Props = $props();
</script>

<div class="flex items-center gap-1">
	<StatusIndicator {status} size="lg" showLabel={false} />
	<span class="ml-3 text-md text-muted-foreground">{title}</span>
</div>
