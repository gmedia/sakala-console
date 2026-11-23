<script lang="ts">
	// bucketsHref() resolves the route and adds the project to the query string.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { cn } from '$lib/utils/cn';
	import { BUCKET_COPY } from '../presentation';
	import { bucketsHref } from '../routes';

	/** "Buat bucket untuk proyek ini": the bucket list, which opens the create dialog for the project. */
	let { projectId, class: className }: { projectId: string; class?: string } = $props();
</script>

<a
	href={bucketsHref({ projectId })}
	class={cn(
		'inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2',
		className
	)}
	data-testid="create-project-bucket">{BUCKET_COPY.createForProject}</a
>
