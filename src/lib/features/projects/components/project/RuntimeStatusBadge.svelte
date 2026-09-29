<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Project } from '$lib/api/resources/projects';
	import { runtimeStatusPresentation, toRuntimeStatus } from '../../presentation';

	type Props = {
		runtimeStatus: Project['runtime_status'];
	};

	let { runtimeStatus }: Props = $props();

	const status = $derived(toRuntimeStatus(runtimeStatus));

	const presentation = $derived(
		status
			? runtimeStatusPresentation[status]
			: {
					label: 'Lainnya',
					variant: 'neutral' as const
				}
	);
</script>

<span data-testid="runtime-status-badge">
	<Badge tone={presentation.variant} label={presentation.label} class="tracking-wide">
		{presentation.label}
	</Badge>
</span>
