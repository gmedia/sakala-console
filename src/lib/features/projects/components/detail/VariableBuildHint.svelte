<script lang="ts">
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import Hammer from 'phosphor-svelte/lib/Hammer';
	import { cn } from '$lib/utils/cn';
	import { getVariableBuildHint } from '../../presentation';
	import type { Project } from '../../type';
	import {
		decideVariableBuild,
		projectVariableChanges,
		type VariableBuildProject
	} from '../../variable-build';

	type Props = {
		/** Read by the save control through `aria-describedby`. */
		id: string;
		project: (VariableBuildProject & Pick<Project, 'stack'>) | null | undefined;
		/** The project variables the save adds, changes, or deletes. */
		keys: readonly string[];
		class?: string;
	};

	let { id, project, keys, class: className = '' }: Props = $props();

	const decision = $derived(decideVariableBuild(project, projectVariableChanges(keys)));
	const hint = $derived(decision ? getVariableBuildHint(decision, project?.stack?.framework) : '');
</script>

<!--
	Not a live region: it is read with the save control it describes, so typing a name does not
	announce every change. The icons repeat the Redeploy menu's: hammer builds, arrows reuse.
-->
{#if decision}
	<p
		{id}
		class={cn('flex items-start gap-1.5 text-xs text-foreground/70', className)}
		data-testid="variable-build-hint"
		data-needs-build={decision.needsBuild}
	>
		{#if decision.needsBuild}
			<Hammer size={16} weight="bold" class="shrink-0" aria-hidden="true" />
		{:else}
			<ArrowsClockwise size={16} weight="bold" class="shrink-0" aria-hidden="true" />
		{/if}
		<span class="min-w-0">{hint}</span>
	</p>
{:else}
	<!-- Keeps the id the save control points at, with nothing to read. -->
	<span {id} hidden></span>
{/if}
