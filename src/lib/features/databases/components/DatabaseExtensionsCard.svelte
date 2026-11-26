<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import {
		DATABASE_EXTENSIONS,
		type Database,
		type DatabaseExtension
	} from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import type { DatabaseAccess } from '../access';
	import { createInstallExtensionMutation } from '../mutations';
	import {
		DATABASE_COPY,
		EXTENSION_INFO,
		databaseErrorMessage,
		extensionFailure,
		isOnNode
	} from '../presentation';

	type Props = { database: Database; workspaceId: string; access: DatabaseAccess };

	let { database, workspaceId, access }: Props = $props();

	const installMutation = createInstallExtensionMutation();

	// What this visit asked for. The API has no list of installed extensions yet, so this is all
	// the page can say without claiming more than it knows.
	const requested = new SvelteSet<DatabaseExtension>();
	let pending = $state<DatabaseExtension | null>(null);
	let error = $state<string | null>(null);

	const onNode = $derived(isOnNode(database));
	const failure = $derived(extensionFailure(database));

	async function install(extension: DatabaseExtension) {
		if (pending) return;
		pending = extension;
		error = null;
		try {
			await installMutation.mutateAsync({ workspaceId, databaseId: database.id, extension });
			requested.add(extension);
			toast.success(`Pemasangan ${EXTENSION_INFO[extension].label} diminta.`);
		} catch (caught) {
			error = databaseErrorMessage(
				caught,
				'extension',
				'Extension belum terpasang. Muat ulang halaman, lalu pasang lagi.'
			);
		} finally {
			pending = null;
		}
	}
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="database-extensions-title"
	data-testid="database-extensions"
>
	<div class="flex min-w-0 flex-col gap-1">
		<h2 id="database-extensions-title" class="text-base text-foreground">Extension</h2>
		<!-- "Pelajari" sits beside the line it explains, and takes its own line once open. -->
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 [&>details[open]]:basis-full">
			<p class="text-sm text-muted">{DATABASE_COPY.extensionsLead}</p>
			<LearnMore topic="extension yang sudah terpasang">
				<p>{DATABASE_COPY.extensionsNote}</p>
			</LearnMore>
		</div>
	</div>

	{#if access.canManage && !onNode}
		<p class="text-sm text-muted">Extension bisa dipasang setelah database siap.</p>
	{/if}

	{#if failure}
		<p
			class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
			data-testid="extension-failure"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
			<span><span class="font-medium">Pemasangan terakhir gagal.</span> {failure.summary}</span>
		</p>
	{/if}

	<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
		{#each DATABASE_EXTENSIONS as extension (extension)}
			{@const info = EXTENSION_INFO[extension]}
			<li class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
				<div class="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
					<span class="font-mono text-sm font-semibold wrap-anywhere text-foreground"
						>{info.label}</span
					>
					<span class="text-sm text-muted">{info.description}</span>
				</div>
				{#if access.canManage}
					{#if requested.has(extension)}
						<span
							class="inline-flex min-h-8 items-center gap-1.5 text-sm text-foreground"
							data-testid={`extension-requested-${extension}`}
						>
							<Check size={16} class="text-success" aria-hidden="true" />
							Diminta
						</span>
					{:else}
						<Button
							variant="secondary"
							size="sm"
							disabled={!onNode || pending !== null}
							onclick={() => install(extension)}
							aria-label={`Pasang ${info.label}`}
						>
							{pending === extension ? 'Meminta...' : 'Pasang'}
						</Button>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>

	{#if error}
		<p role="alert" class="text-sm text-error-dark">{error}</p>
	{/if}
</section>
