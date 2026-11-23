<script lang="ts">
	import Info from 'phosphor-svelte/lib/Info';
	import { getFallbackNoteSegments, type ImageBuildState } from '../image-reuse-presentation';
	import ImageSourceText from './ImageSourceText.svelte';

	type Props = {
		projectId: string;
		state: Extract<ImageBuildState, { kind: 'fallback' }>;
		/** A rollback builds the old commit again, and says so. */
		rollback?: boolean;
	};

	let { projectId, state, rollback = false }: Props = $props();

	const segments = $derived(getFallbackNoteSegments(state.source, state.reason, { rollback }));
</script>

<!-- A fallback is normal, so it reads as information beside the steps, not as a warning. -->
<p
	class="flex gap-2 rounded-control bg-background-soft px-3 py-2 text-sm text-foreground"
	data-testid="image-fallback-note"
>
	<Info size={16} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
	<span class="min-w-0 wrap-anywhere"><ImageSourceText {projectId} {segments} /></span>
</p>
