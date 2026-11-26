<script lang="ts">
	import type { Database } from '$lib/api/resources/databases';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { LARAVEL_RELEASE_COMMAND } from '$lib/features/projects/build-help';
	import { DATABASE_HELP_LINKS, DATABASE_PANEL_COPY as COPY, deriveDatabaseSteps } from '../panel';

	/** Next steps and guides only: the database's facts sit under its name, like a project's header. */
	type Props = { database: Database; canManage: boolean };

	let { database, canManage }: Props = $props();

	const steps = $derived(deriveDatabaseSteps(database, canManage));
</script>

<PanelNextSteps {steps} testid="database-next-steps" />

<PanelHelp links={DATABASE_HELP_LINKS} testid="database-help">
	<LearnMore topic={COPY.migrationTopic} label={COPY.migration} testid="database-release-hint">
		<p>{COPY.releaseBody}</p>
		<p class="flex flex-col gap-1">
			<span>{COPY.laravel}</span>
			<code
				class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
				>{LARAVEL_RELEASE_COMMAND}</code
			>
		</p>
	</LearnMore>
</PanelHelp>
