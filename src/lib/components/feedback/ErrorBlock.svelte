<script lang="ts">
	import CellSignalSlashIcon from 'phosphor-svelte/lib/CellSignalSlashIcon';
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import Card from '../ui/Card.svelte';
	import Button from '../ui/Button.svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	type Props = {
		title?: string;
		titleClass?: string;
		description?: string;
		icon?: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
		iconClass?: string;
		iconText?: string;
		iconTextClass?: string;
		iconBackgroundClass?: string;
		statusIndicator?: string;
		statusIndicatorClass?: string;
		buttonIcon?: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
		buttonText?: string;
		onRetry?: () => void;
		/** Ways out of this screen, for errors that retrying alone cannot solve. */
		links?: { label: string; href: ResolvedPathname }[];
		/** A full-page error owns the page's main heading. */
		headingTag?: 'h1' | 'h2';
	};

	let {
		title = 'Terjadi kesalahan',
		titleClass,
		description = 'Gagal memuat data. Silakan periksa koneksi kamu dan coba lagi.',
		icon: Icon = CellSignalSlashIcon,
		iconText,
		iconTextClass = 'text-error-base',
		iconClass = 'text-error-base',
		iconBackgroundClass = 'bg-error/10',
		statusIndicator,
		statusIndicatorClass = 'text-muted',
		buttonIcon: ButtonIcon = ArrowCounterClockwiseIcon,
		buttonText,
		onRetry,
		links = [],
		headingTag = 'h2'
	}: Props = $props();
</script>

<div>
	<div class="mb-6 flex justify-center">
		<SakalaLogo class="h-10" />
	</div>
	<Card class="sm:py-1">
		<div
			class="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-2 p-4 text-center"
			role="alert"
			aria-live="assertive"
		>
			{#if Icon}
				<div class={`flex size-12 items-center justify-center rounded-full ${iconBackgroundClass}`}>
					<Icon size={28} aria-hidden="true" class={iconClass} />
				</div>
				<p class={`text-base font-semibold ${iconTextClass}`}>{iconText}</p>
			{/if}

			<svelte:element this={headingTag} class={`text-xl ${titleClass || ''}`}>
				{title}
			</svelte:element>

			{#if description}
				<p class="mt-1 text-sm text-foreground">{description}</p>
			{/if}

			{#if statusIndicator}
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-error-dark"></span>
					<p class={`text-sm font-medium ${statusIndicatorClass}`}>
						{statusIndicator}
					</p>
				</div>
			{/if}

			{#if onRetry && buttonText && ButtonIcon}
				<Button size="lg" class="mt-4 w-full" onclick={onRetry}>
					<ButtonIcon class="h-5 w-5" />
					{buttonText}
				</Button>
			{/if}

			{#each links as link, index (link.href)}
				<Button
					size="lg"
					class="mt-2 w-full"
					variant={index === 0 && !onRetry ? 'primary' : 'secondary'}
					href={link.href}
				>
					{link.label}
				</Button>
			{/each}
		</div>
	</Card>
</div>
