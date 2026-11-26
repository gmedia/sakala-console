<script lang="ts">
	// Links come from resolveRoute() in the routes helpers, some with a query string or anchor.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { DatabaseIcon } from '$lib/components/icons';
	import Badge from '$lib/components/ui/Badge.svelte';
	import InjectedVariables from '$lib/features/projects/components/detail/InjectedVariables.svelte';
	import {
		isLaravelStack,
		LARAVEL_RELEASE_COMMAND,
		RELEASE_COMMAND_DOCS_URL,
		RELEASE_COMMAND_LABEL
	} from '$lib/features/projects/build-help';
	import { settingsHref } from '$lib/features/projects/overview/links';
	import { SETTINGS_ANCHORS } from '$lib/features/projects/settings-anchors';
	import { VARIABLE_BUILD_COPY } from '$lib/features/projects/presentation';
	import type { Project } from '$lib/features/projects/type';
	import { decideVariableBuild, VARIABLE_SOURCES } from '$lib/features/projects/variable-build';
	import { DATABASE_VARIABLES, databaseStatusView } from '../presentation';
	import { databaseVariableRows } from '../project-variables';
	import { databaseHref, databasesHref } from '../routes';

	type Props = {
		project: Pick<
			Project,
			| 'id'
			| 'databases'
			| 'workspace'
			| 'stack'
			| 'release_command'
			| 'active_deployment_id'
			| 'variable_changes'
		>;
		readOnly: boolean;
	};

	let { project, readOnly }: Props = $props();

	const database = $derived(project.databases?.[0] ?? null);
	const rows = $derived(database ? databaseVariableRows(database) : []);
	// Never a build: builds cannot reach the database, so its variables are read at runtime only.
	const reusesImage = $derived(
		decideVariableBuild(
			project,
			rows.map((row) => ({ key: row.name, source: VARIABLE_SOURCES.database }))
		)?.needsBuild === false
	);
	const view = $derived(
		database ? databaseStatusView({ status: database.status, last_failure: null }) : null
	);
	const workspaceId = $derived(project.workspace?.id ?? null);
	const needsReleaseHint = $derived(
		Boolean(database) && isLaravelStack(project.stack) && !project.release_command?.trim()
	);
</script>

{#if database && view}
	<section
		class="mt-6 flex min-w-0 flex-col gap-3"
		aria-labelledby="database-variables-title"
		data-testid="database-variables"
	>
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
			<h2
				id="database-variables-title"
				class="flex min-w-0 items-center gap-2 text-base text-foreground"
			>
				<DatabaseIcon size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
				<span class="min-w-0 wrap-anywhere">
					Dari database <span class="font-mono">{database.name}</span>
				</span>
				<Badge tone={view.tone}>{view.label}</Badge>
			</h2>
			{#if workspaceId}
				<a
					href={databaseHref(workspaceId, database.id)}
					class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
				>
					Buka database
				</a>
			{/if}
		</div>
		{#if database.status !== 'ready'}
			<p class="text-sm text-foreground">{view.description}</p>
		{/if}

		<InjectedVariables {rows} source={`database ${database.name}`} testidPrefix="database-variable">
			{#snippet learnMore()}
				{#if reusesImage}
					<p data-testid="database-variables-build">{VARIABLE_BUILD_COPY.database}</p>
				{/if}
			{/snippet}
		</InjectedVariables>

		{#if rows.some((row) => row.overridden)}
			<p
				class="flex items-start gap-2 text-sm text-foreground"
				data-testid="database-variables-conflict"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span> Hapus variabel bertanda "Menimpa database" agar nilai database yang dipakai. </span>
			</p>
		{/if}

		{#if needsReleaseHint}
			<div
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="database-release-hint-laravel"
			>
				<p>
					Migration belum jalan. Isi {RELEASE_COMMAND_LABEL.toLowerCase()} dengan
					<code class="font-mono text-xs">{LARAVEL_RELEASE_COMMAND}</code>.
				</p>
				<p class="flex flex-wrap gap-x-4 gap-y-1">
					{#if !readOnly}
						<a
							href={settingsHref(project.id, SETTINGS_ANCHORS.releaseCommand)}
							class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
						>
							Atur {RELEASE_COMMAND_LABEL.toLowerCase()}
						</a>
					{/if}
					<a
						href={RELEASE_COMMAND_DOCS_URL}
						target="_blank"
						rel="noreferrer noopener"
						class="inline-flex min-h-6 items-center gap-1 font-medium text-primary-dark underline underline-offset-2"
					>
						Baca panduannya
						<ArrowSquareOut size={14} aria-hidden="true" />
						<span class="sr-only">(tab baru)</span>
					</a>
				</p>
			</div>
		{/if}
	</section>
{:else if !readOnly && project.databases !== undefined}
	<p class="mt-6 text-sm text-muted" data-testid="database-variables-none">
		Butuh PostgreSQL? Sakala mengisi
		<code class="font-mono text-xs text-foreground">{DATABASE_VARIABLES[0]}</code> dan
		<code class="font-mono text-xs text-foreground">DB_*</code> saat deploy.
		<a
			href={databasesHref({ projectId: project.id })}
			class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
		>
			Pilih atau buat database
		</a>
	</p>
{/if}
