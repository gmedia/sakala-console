<script lang="ts">
	import { CellSignalSlashIcon, ArrowCounterClockwiseIcon } from 'phosphor-svelte';
	import Card from '../ui/Card.svelte';
	import Button from '../ui/Button.svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import type { Component } from 'svelte';

	type Props = {
		title?: string;
		titleClass?: string;
		description?: string;
		icon?: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
		iconClass?: string;
		iconText?: string;
		iconBackgroundClass?: string;
		statusIndicator?: string;
		statusIndicatorClass?: string;
		buttonIcon?: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
		buttonText?: string;
		onRetry?: () => void;
	};

	let {
		title = 'Terjadi kesalahan',
		titleClass,
		description = 'Gagal memuat data. Silakan periksa koneksi anda dan coba lagi.',
		icon: Icon = CellSignalSlashIcon,
		iconText,
		iconClass = 'text-error-base',
		iconBackgroundClass = 'bg-error/20',
		statusIndicator,
		statusIndicatorClass = 'text-muted',
		buttonIcon: ButtonIcon = ArrowCounterClockwiseIcon,
		buttonText,
		onRetry
	}: Props = $props();
</script>

<div>
	<div class="flex justify-center mb-6">
		<SakalaLogo class="h-9.25 w-40.5" />
	</div>
	<Card class="sm:py-1">
		<div
			class="flex flex-col items-center justify-center gap-2 p-8 text-center rounded-xl max-w-md w-full mx-auto"
			role="alert"
			aria-live="assertive"
		>
			{#if Icon}
				<div class={`w-12 h-12 flex items-center p-2 rounded-full ${iconBackgroundClass}`}>
					<Icon size={42} aria-hidden="true" class={iconClass} />
				</div>
				<p class="text-base font-montserrat-semibold text-error-base">{iconText}</p>
			{/if}

			<h2 class={`text-base font-montserrat-semibold ${titleClass || ''}`}>{title}</h2>

			{#if description}
				<p class="mt-1 text-md font-montserrat-light">{description}</p>
			{/if}

			{#if statusIndicator}
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-error-dark"></span>
					<p class={`text-sm font-montserrat-medium ${statusIndicatorClass}`}>
						{statusIndicator}
					</p>
				</div>
			{/if}

			{#if onRetry && buttonText && ButtonIcon}
				<Button class="mt-4 w-full py-3" variant="primary" onclick={onRetry}>
					<ButtonIcon class="w-5 h-5" />
					{buttonText}
				</Button>
			{/if}
		</div>
	</Card>
</div>
