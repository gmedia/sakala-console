<script lang="ts">
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Check from 'phosphor-svelte/lib/Check';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Button from '$lib/components/ui/Button.svelte';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { copyWithToast, URL_COPY_MESSAGES } from '$lib/utils/clipboard';
	import { ADDRESS_SECTION_ID } from '../../overview/links';
	import { getPublicUrlLabel } from '../../presentation';

	type Props = {
		/** The URL the API says the project answers on; `null` when it sent none. */
		publicUrl: string | null;
		/** The domain alone, for a project whose URL is not ready yet. */
		defaultDomain: string | null;
		/** Whether opening it reaches the app, or its wake page. A suspended or undeployed one does not. */
		reachable: boolean;
		/** Why it cannot be opened yet, when it cannot. */
		unreachableNote: string | null;
	};

	let { publicUrl, defaultDomain, reachable, unreachableNote }: Props = $props();

	/** Horizon D of the public roadmap lists custom domains; the card says so instead of offering one. */
	const ROADMAP_URL = 'https://sakala.dev/docs/proyek/roadmap#horizon-d--operasi-yang-andal';
	const COPIED_MS = 2_000;

	const COPY = {
		title: 'Alamat dan domain',
		defaultLabel: 'Alamat bawaan',
		defaultNote: 'Dibuat otomatis dari nama proyek.',
		customLabel: 'Domain sendiri',
		customNote: 'Belum tersedia. Memakai domainmu sendiri ada di roadmap Sakala.',
		roadmap: 'Lihat roadmap',
		copy: 'Salin',
		copied: 'Disalin',
		open: 'Buka',
		none: 'Alamat belum tersedia.'
	} as const;

	const label = $derived(publicUrl ? getPublicUrlLabel(publicUrl) : defaultDomain);

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copyUrl() {
		const value = publicUrl ?? (defaultDomain ? `https://${defaultDomain}` : null);
		if (!value || !(await copyWithToast(value, URL_COPY_MESSAGES))) return;
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), COPIED_MS);
	}
</script>

<section
	id={ADDRESS_SECTION_ID}
	tabindex="-1"
	aria-labelledby="overview-domain-title"
	class="surface-card flex min-w-0 scroll-mt-4 flex-col gap-4 p-4 focus-visible:outline-offset-2 sm:p-6"
	data-testid="overview-domain"
>
	<h2 id="overview-domain-title" class="text-base text-foreground">{COPY.title}</h2>

	<dl class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<dt class="text-xs font-medium text-muted">{COPY.defaultLabel}</dt>
			<dd class="flex flex-col gap-2">
				{#if label}
					<span
						class="font-mono text-sm font-medium wrap-anywhere text-foreground"
						data-testid="overview-domain-url"><BreakableUrl text={label} /></span
					>
					<span class="text-xs text-muted">{reachable ? COPY.defaultNote : unreachableNote}</span>
					<span class="flex flex-wrap gap-2">
						<Button variant="secondary" size="sm" onclick={copyUrl}>
							{#if copied}
								<Check size={16} class="text-success" aria-hidden="true" />
								{COPY.copied}
							{:else}
								<Copy size={16} aria-hidden="true" />
								{COPY.copy}
							{/if}
						</Button>
						{#if reachable && publicUrl}
							<Button variant="secondary" size="sm" externalHref={publicUrl}>
								<ArrowSquareOut size={16} aria-hidden="true" />
								{COPY.open}
								<span class="sr-only">(tab baru)</span>
							</Button>
						{/if}
					</span>
				{:else}
					<span class="text-sm text-muted">{COPY.none}</span>
				{/if}
			</dd>
		</div>
		<div class="flex flex-col gap-1.5 border-t border-border pt-4">
			<dt class="text-xs font-medium text-muted">{COPY.customLabel}</dt>
			<dd class="flex flex-col gap-1 text-sm text-foreground">
				<span>{COPY.customNote}</span>
				<a
					href={ROADMAP_URL}
					target="_blank"
					rel="external noopener noreferrer"
					class="inline-flex min-h-6 items-center self-start font-medium text-primary-dark underline underline-offset-2"
				>
					{COPY.roadmap}<span class="sr-only">(tab baru)</span>
				</a>
			</dd>
		</div>
	</dl>
</section>
