<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import type { ProjectDomain } from '$lib/api/resources/project-domains';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { SETTINGS_SECTION_IDS } from '$lib/features/projects/settings-anchors';
	import { createDeleteDomainMutation } from '../mutations';
	import { parentZone } from '../names';
	import {
		DOMAIN_COPY,
		domainDeleteErrorMessage,
		domainQuota,
		domainQuotaText
	} from '../presentation';
	import { createProjectDomainsQuery, isDomainsOffError } from '../queries';
	import AddDomainForm from './AddDomainForm.svelte';
	import CustomDomainItem from './CustomDomainItem.svelte';

	type Props = {
		projectId: string;
		/** `<slug>.<project domain>`, which keeps working beside any custom domain. */
		defaultDomain: string | null;
		limits?: PilotLimits;
		/** Viewers read the list without the controls the API would refuse them. */
		readOnly: boolean;
	};

	let { projectId, defaultDomain, limits, readOnly }: Props = $props();

	const sectionId = SETTINGS_SECTION_IDS.domains;
	const domainsQuery = createProjectDomainsQuery(
		() => projectId,
		() => true
	);
	const deleteMutation = createDeleteDomainMutation();

	const domains = $derived(domainsQuery.data ?? []);
	const quota = $derived(domainQuota(limits));
	const forbiddenZones = $derived(
		[parentZone(limits?.custom_domains?.target), parentZone(defaultDomain)].filter(
			(zone): zone is string => Boolean(zone)
		)
	);

	let removing = $state<ProjectDomain | null>(null);
	let deleteError = $state('');
	let statusMessage = $state('');

	function added(domain: ProjectDomain) {
		statusMessage = DOMAIN_COPY.added(domain.hostname);
		toast.success(statusMessage);
		void tick().then(() =>
			document.getElementById(`domain-${domain.id}-name`)?.scrollIntoView({ block: 'nearest' })
		);
	}

	async function confirmDelete() {
		const domain = removing;
		if (!domain || deleteMutation.isPending) return;
		deleteError = '';
		try {
			await deleteMutation.mutateAsync({ projectId, domainId: domain.id });
			removing = null;
			statusMessage = DOMAIN_COPY.deleted(domain.hostname);
			toast.success(statusMessage);
		} catch (error) {
			deleteError = domainDeleteErrorMessage(error);
		}
	}

	// The section renders after the workspace's limits arrive, later than the page's own anchor
	// handling, so a link to #domain scrolls here itself once.
	let arrived = false;
	$effect(() => {
		if (arrived || domainsQuery.isPending || page.url.hash !== `#${sectionId}`) return;
		arrived = true;
		void tick().then(() => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }));
	});
</script>

<section
	id={sectionId}
	aria-labelledby="{sectionId}-title"
	class="surface-card flex scroll-mt-4 flex-col gap-4 p-4 sm:p-6"
	data-testid="domains-section"
>
	<div>
		<h2 id="{sectionId}-title" class="font-sans text-base font-semibold text-foreground">
			{DOMAIN_COPY.section}
		</h2>
		<p class="mt-1 text-sm text-foreground/70">{DOMAIN_COPY.intro(defaultDomain)}</p>
	</div>

	{#if domainsQuery.isPending}
		<div class="flex flex-col gap-2" role="status" aria-label="Memuat domain">
			<div class="skeleton h-10 w-full"></div>
			<div class="skeleton h-24 w-full"></div>
		</div>
	{:else if domainsQuery.isError}
		<p class="text-sm text-muted" data-testid="domains-unavailable">
			{isDomainsOffError(domainsQuery.error) ? DOMAIN_COPY.unavailable : DOMAIN_COPY.loadFailed}
		</p>
	{:else}
		{#if !readOnly}
			{#if quota?.max === 0}
				<p class="text-sm text-foreground/80" data-testid="domain-quota">
					{domainQuotaText(quota)}
				</p>
			{:else}
				<AddDomainForm
					{projectId}
					{forbiddenZones}
					blocked={quota?.full ?? false}
					onAdded={added}
				/>
				{#if quota}
					<!-- Right under the form, so a closed form says why where it is closed. -->
					<p class="-mt-2 text-xs text-foreground/70" data-testid="domain-quota">
						{domainQuotaText(quota)}
					</p>
				{/if}
			{/if}
		{/if}

		{#if domains.length > 0}
			<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
				{#each domains as domain (domain.id)}
					<CustomDomainItem
						{domain}
						{projectId}
						{readOnly}
						onDelete={(item) => {
							deleteError = '';
							removing = item;
						}}
					/>
				{/each}
			</ul>
		{:else if quota?.max !== 0 || readOnly}
			<div class="rounded-control border border-dashed border-border p-4 text-center">
				<p class="text-sm font-medium text-foreground">{DOMAIN_COPY.emptyTitle}</p>
				{#if !readOnly}
					<p class="mt-1 text-sm text-foreground/70">{DOMAIN_COPY.emptyDescription}</p>
				{/if}
			</div>
		{/if}

		<div class="flex flex-col gap-2 text-xs text-foreground/70">
			{#if readOnly}
				<p>{DOMAIN_COPY.readOnly}</p>
			{:else if domains.length > 0}
				<details data-testid="allowed-hosts-hint">
					<summary
						class="inline-flex min-h-6 cursor-pointer items-center font-medium text-primary-dark underline underline-offset-2"
						>{DOMAIN_COPY.allowedHostsTitle}</summary
					>
					<p class="mt-1">{DOMAIN_COPY.allowedHostsBody}</p>
					<ul class="mt-1 flex flex-col gap-0.5">
						{#each DOMAIN_COPY.allowedHosts as item (item.framework)}
							<li>
								{item.framework}: <code class="font-mono text-foreground">{item.setting}</code>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
		<span role="status" class="sr-only">{statusMessage}</span>
	{/if}
</section>

{#if !readOnly}
	<Dialog
		open={removing !== null}
		title={removing ? DOMAIN_COPY.deleteTitle(removing.hostname) : ''}
		description={DOMAIN_COPY.deleteDescription}
		confirmLabel={DOMAIN_COPY.deleteConfirm}
		variant="destructive"
		loading={deleteMutation.isPending}
		onConfirm={confirmDelete}
		onCancel={() => (removing = null)}
	>
		{#if deleteError}
			<p role="alert" class="text-sm text-error-dark">{deleteError}</p>
		{/if}
	</Dialog>
{/if}
