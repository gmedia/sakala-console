<script lang="ts">
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import Question from 'phosphor-svelte/lib/Question';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { ProjectDomain } from '$lib/api/resources/project-domains';
	import { CHECK_STATE_LABELS, DOMAIN_COPY, domainChecks, formatDomainTime } from '../presentation';

	let { domain }: { domain: ProjectDomain } = $props();

	const checks = $derived(domainChecks(domain));
</script>

<div class="flex flex-col gap-2" data-testid="domain-checks">
	{#if domain.last_check.checked_at}
		<p class="text-xs text-muted">
			{DOMAIN_COPY.checksAt(formatDomainTime(domain.last_check.checked_at))}
		</p>
	{/if}
	<ul class="flex flex-col gap-1.5">
		{#each checks.rows as row (row.id)}
			<li class="flex flex-col gap-1" data-testid="domain-check" data-state={row.state}>
				<p class="flex items-center gap-2 text-sm">
					{#if row.state === 'pass'}
						<CheckCircle size={18} weight="fill" class="shrink-0 text-success" aria-hidden="true" />
					{:else if row.state === 'fail'}
						<WarningCircle size={18} weight="fill" class="shrink-0 text-error" aria-hidden="true" />
					{:else}
						<Question size={18} class="shrink-0 text-muted" aria-hidden="true" />
					{/if}
					<span class="font-medium text-foreground">{row.label}</span>
					<span class={row.state === 'fail' ? 'text-error-dark' : 'text-muted'}>
						{CHECK_STATE_LABELS[row.state]}
					</span>
				</p>
				{#each row.reasons as reason (reason.code)}
					<p class="ml-6.5 text-sm wrap-anywhere text-foreground/80" data-reason={reason.code}>
						{reason.message}
					</p>
				{/each}
			</li>
		{/each}
	</ul>
	{#each checks.general as reason (reason.code)}
		<p
			class="rounded-control border border-warning/20 bg-accent-soft px-3 py-2 text-sm wrap-anywhere text-foreground"
			data-reason={reason.code}
		>
			{reason.message}
		</p>
	{/each}
</div>
