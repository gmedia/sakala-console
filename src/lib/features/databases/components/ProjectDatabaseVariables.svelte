<script lang="ts">
	// Links come from resolveRoute() in the routes helpers, some with a query string or anchor.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Database from 'phosphor-svelte/lib/Database';
	import Warning from 'phosphor-svelte/lib/Warning';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		isLaravelStack,
		LARAVEL_RELEASE_COMMAND,
		RELEASE_COMMAND_DOCS_URL,
		RELEASE_COMMAND_LABEL
	} from '$lib/features/projects/build-help';
	import { settingsHref } from '$lib/features/projects/overview/links';
	import { SETTINGS_ANCHORS } from '$lib/features/projects/settings-anchors';
	import type { Project } from '$lib/features/projects/type';
	import { DATABASE_VARIABLES, databaseStatusView } from '../presentation';
	import { databaseVariableRows } from '../project-variables';
	import { databaseHref, databasesHref } from '../routes';

	type Props = {
		project: Pick<Project, 'id' | 'databases' | 'workspace' | 'stack' | 'release_command'>;
		readOnly: boolean;
	};

	let { project, readOnly }: Props = $props();

	const database = $derived(project.databases?.[0] ?? null);
	const rows = $derived(database ? databaseVariableRows(database) : []);
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
				<Database size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
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
		<p class="text-sm text-muted">
			Disuntik Sakala saat deploy, jadi tidak bisa diubah di sini dan nilainya tidak ditampilkan.
			Variabel proyek dengan nama yang sama menang.
		</p>
		{#if database.status !== 'ready'}
			<p class="text-sm text-foreground">{view.description}</p>
		{/if}

		<ul
			class="@container flex w-full flex-col divide-y divide-border rounded-control border border-border bg-surface"
		>
			{#each rows as row (row.name)}
				<li
					class="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 @2xl:grid-cols-[14.5rem_minmax(0,1fr)_auto] @2xl:px-6"
					data-testid={`database-variable-${row.name}`}
				>
					<span class="min-w-0 font-mono text-sm font-semibold wrap-anywhere text-foreground">
						{row.name}
					</span>
					<span
						class="col-span-2 row-start-2 min-w-0 text-sm @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1"
					>
						{#if row.overridden}
							<span class="text-foreground">
								Nilai dari variabel proyek yang dipakai, bukan dari {database.name}.
							</span>
						{:else}
							<span class="text-muted">dari database {database.name}, nilai disembunyikan</span>
						{/if}
					</span>
					<span class="col-start-2 row-start-1 @2xl:col-start-3">
						{#if row.overridden}
							<Badge tone="warning">Ditimpa proyek</Badge>
						{:else}
							<Badge tone="neutral">Otomatis</Badge>
						{/if}
					</span>
				</li>
			{/each}
		</ul>

		{#if rows.some((row) => row.overridden)}
			<p
				class="flex items-start gap-2 text-sm text-foreground"
				data-testid="database-variables-conflict"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span>
					Hapus variabel proyek yang bertanda "Menimpa database" di atas kalau aplikasimu harus
					memakai nilai dari database.
				</span>
			</p>
		{/if}

		{#if needsReleaseHint}
			<div
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="database-release-hint-laravel"
			>
				<p>
					Proyek Laravel ini belum menjalankan migration. Isi {RELEASE_COMMAND_LABEL.toLowerCase()}
					dengan <code class="font-mono text-xs">{LARAVEL_RELEASE_COMMAND}</code> supaya tabelnya dibuat
					setiap deploy, sebelum versi baru menerima trafik.
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
		Butuh PostgreSQL? Pasang database workspace ke proyek ini, dan Sakala menambahkan
		<code class="font-mono text-xs text-foreground">{DATABASE_VARIABLES[0]}</code> serta variabel
		<code class="font-mono text-xs text-foreground">DB_*</code> saat deploy.
		<a
			href={databasesHref({ projectId: project.id })}
			class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
		>
			Pilih atau buat database
		</a>
	</p>
{/if}
