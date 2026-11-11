<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Project } from '$lib/api/resources/projects';
	import { getProjectListStatusPresentation } from '../../presentation';

	type Props = {
		runtimeStatus: Project['runtime_status'];
		/** The project's `suspension`; when set, the badge says Ditangguhkan like the project header. */
		suspension?: Project['suspension'];
	};

	let { runtimeStatus, suspension = null }: Props = $props();

	const presentation = $derived(
		getProjectListStatusPresentation({ runtime_status: runtimeStatus, suspension })
	);
</script>

<span data-testid="runtime-status-badge">
	<Badge tone={presentation.variant}>
		{presentation.label}
	</Badge>
</span>
