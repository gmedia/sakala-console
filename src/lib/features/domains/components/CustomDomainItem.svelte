<script lang="ts">
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Trash from 'phosphor-svelte/lib/Trash';
	import {
		DOMAIN_KIND,
		DOMAIN_STATUS,
		type ProjectDomain
	} from '$lib/api/resources/project-domains';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { createCheckDomainMutation } from '../mutations';
	import {
		DOMAIN_COPY,
		checkWaitSeconds,
		domainCheckErrorMessage,
		domainStatusView,
		hasAddressesWarning
	} from '../presentation';
	import { dnsRecordRows } from '../records';
	import DnsRecordList from './DnsRecordList.svelte';
	import DomainChecks from './DomainChecks.svelte';

	type Props = {
		domain: ProjectDomain;
		projectId: string;
		/** Viewers read the domain without the controls the API would refuse them. */
		readOnly: boolean;
		onDelete: (domain: ProjectDomain) => void;
	};

	let { domain, projectId, readOnly, onDelete }: Props = $props();

	const checkMutation = createCheckDomainMutation();

	const view = $derived(domainStatusView(domain));
	const records = $derived(dnsRecordRows(domain));
	const isApex = $derived(domain.kind === DOMAIN_KIND.apex);
	const idBase = $derived(`domain-${domain.id}`);

	let checkError = $state('');
	let announcement = $state('');
	let waitUntil = $state(0);
	let now = $state(Date.now());
	let ticker: ReturnType<typeof setInterval> | undefined;

	const waitSeconds = $derived(Math.max(Math.ceil((waitUntil - now) / 1000), 0));

	function startWait(seconds: number) {
		waitUntil = Date.now() + seconds * 1000;
		now = Date.now();
		clearInterval(ticker);
		ticker = setInterval(() => {
			now = Date.now();
			if (now >= waitUntil) {
				clearInterval(ticker);
				checkError = '';
			}
		}, 1000);
	}

	onDestroy(() => clearInterval(ticker));

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let checking = false;

	async function checkNow() {
		if (checking || waitSeconds > 0) return;
		checking = true;
		checkError = '';
		try {
			const checked = await checkMutation.mutateAsync({ projectId, domainId: domain.id });
			const passed = checked.status === DOMAIN_STATUS.verified && !checked.failing_since;
			announcement = passed
				? DOMAIN_COPY.checkedActive(checked.hostname)
				: DOMAIN_COPY.checkedStill(checked.hostname);
			if (passed && domain.status !== DOMAIN_STATUS.verified) toast.success(announcement);
		} catch (error) {
			const wait = checkWaitSeconds(error);
			if (wait !== null) startWait(wait);
			checkError = domainCheckErrorMessage(error);
		} finally {
			checking = false;
		}
	}
</script>

{#snippet recordSteps()}
	<DnsRecordList records={records.rows} zone={records.zone} />
	{#if isApex}
		<details class="text-sm">
			<summary
				class="inline-flex min-h-6 cursor-pointer items-center font-medium text-primary-dark underline underline-offset-2"
				>{DOMAIN_COPY.learn}</summary
			>
			<p class="mt-1 text-foreground/80">{DOMAIN_COPY.apexLearn}</p>
		</details>
	{/if}
{/snippet}

<li
	class="flex flex-col gap-3 p-3 sm:p-4"
	data-testid="custom-domain"
	data-state={view.kind}
	aria-labelledby="{idBase}-name"
>
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div class="flex min-w-0 flex-col gap-0.5">
			<h3
				id="{idBase}-name"
				class="font-mono text-sm font-semibold wrap-anywhere text-foreground sm:text-base"
			>
				{domain.hostname}
			</h3>
			<span class="text-xs text-muted">
				{isApex ? DOMAIN_COPY.kindApex : DOMAIN_COPY.kindSubdomain}
			</span>
		</div>
		<Badge tone={view.tone}><span data-testid="custom-domain-status">{view.label}</span></Badge>
	</div>

	<p class="text-sm wrap-anywhere text-foreground/80" data-testid="custom-domain-summary">
		{view.summary}
	</p>

	{#if hasAddressesWarning(domain)}
		<p class="text-xs text-muted" data-testid="custom-domain-addresses">
			{DOMAIN_COPY.addressesWarning}
		</p>
	{/if}

	{#if view.recordsOpen}
		<div class="flex flex-col gap-2">
			<h4 class="text-sm font-semibold text-foreground">{DOMAIN_COPY.stepsTitle}</h4>
			{@render recordSteps()}
		</div>
	{:else if domain.status !== DOMAIN_STATUS.released}
		<details class="group flex flex-col gap-2" data-testid="custom-domain-records">
			<summary
				class="inline-flex min-h-6 cursor-pointer items-center self-start text-sm font-medium text-primary-dark underline underline-offset-2"
			>
				{DOMAIN_COPY.recordsActiveTitle}
			</summary>
			<div class="mt-2 flex flex-col gap-2">
				<p class="text-xs text-muted">{DOMAIN_COPY.recordsKeep}</p>
				{@render recordSteps()}
			</div>
		</details>
	{/if}

	{#if view.showChecks}
		<DomainChecks {domain} />
	{/if}

	{#if !readOnly}
		<div class="flex flex-wrap items-center gap-2">
			{#if view.canCheck}
				<Button
					variant="secondary"
					size="sm"
					onclick={checkNow}
					disabled={checkMutation.isPending || waitSeconds > 0}
					aria-busy={checkMutation.isPending}
					aria-describedby={checkError ? `${idBase}-check-error` : undefined}
				>
					{#if checkMutation.isPending}
						<CircleNotch
							size={16}
							weight="bold"
							class="animate-spin motion-reduce:animate-none"
							aria-hidden="true"
						/>
						{DOMAIN_COPY.checking}
					{:else}
						<ArrowClockwise size={16} aria-hidden="true" />
						{waitSeconds > 0 ? DOMAIN_COPY.checkWait(waitSeconds) : DOMAIN_COPY.checkNow}
					{/if}
				</Button>
			{/if}
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onDelete(domain)}
				aria-label="{DOMAIN_COPY.delete} {domain.hostname}"
			>
				<Trash size={16} aria-hidden="true" />
				{DOMAIN_COPY.delete}
			</Button>
		</div>
		{#if checkError}
			<p id="{idBase}-check-error" role="alert" class="text-sm text-error-dark">{checkError}</p>
		{/if}
		<span role="status" class="sr-only">{announcement}</span>
	{/if}
</li>
