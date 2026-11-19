<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Hammer from 'phosphor-svelte/lib/Hammer';
	import Button from '$lib/components/ui/Button.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import { cn } from '$lib/utils/cn';
	import { REDEPLOY_COPY } from '../../presentation';
	import type { RedeployOptions } from '../../type';

	type Props = {
		onRedeploy: (options: RedeployOptions) => void;
		variant?: 'primary' | 'secondary';
		/** The button's words, for a state such as another deployment running. */
		label?: string;
		busy?: boolean;
		disabled?: boolean;
		/** Only where there is a live image to reuse: without one, every redeploy builds. */
		offerForceBuild?: boolean;
		iconSize?: number;
		class?: string;
	};

	let {
		onRedeploy,
		variant = 'primary',
		label = REDEPLOY_COPY.action,
		busy = false,
		disabled = false,
		offerForceBuild = false,
		iconSize = 18,
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	const ids = {
		reuseLabel: `${uid}-reuse-label`,
		reuseDescription: `${uid}-reuse-description`,
		forceLabel: `${uid}-force-label`,
		forceDescription: `${uid}-force-description`
	};

	const itemClass =
		'flex cursor-pointer gap-3 rounded-control px-3 py-2.5 text-left outline-none data-highlighted:bg-background-soft';
</script>

<div class={cn('flex', className)}>
	<Button
		{variant}
		class={cn('min-w-0 flex-1', offerForceBuild && 'rounded-r-none')}
		onclick={() => onRedeploy({})}
		{disabled}
		aria-busy={busy}
	>
		{#if busy}
			<CircleNotch
				size={iconSize}
				weight="bold"
				class="animate-spin motion-reduce:animate-none"
				aria-hidden="true"
			/>
		{:else}
			<ArrowsClockwise size={iconSize} weight="bold" aria-hidden="true" />
		{/if}
		{label}
	</Button>

	{#if offerForceBuild}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				{disabled}
				aria-label={REDEPLOY_COPY.menuLabel}
				title={REDEPLOY_COPY.menuLabel}
				data-testid="redeploy-menu-trigger"
				class={buttonClasses(
					variant,
					'icon',
					cn(
						'-ml-px rounded-l-none',
						variant === 'primary' ? 'border-l-white/40' : 'hover:border-l-border-strong'
					)
				)}
			>
				<CaretDown size={16} weight="bold" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					sideOffset={4}
					align="end"
					collisionPadding={8}
					class="z-50 w-80 max-w-[calc(100vw-1rem)] rounded-overlay border border-border bg-surface p-1 shadow-overlay"
				>
					<!-- Named by the label alone; the description is read after it, as a description. -->
					<DropdownMenu.Item
						class={itemClass}
						aria-labelledby={ids.reuseLabel}
						aria-describedby={ids.reuseDescription}
						onSelect={() => onRedeploy({})}
					>
						<ArrowsClockwise
							size={16}
							weight="bold"
							class="mt-0.5 shrink-0 text-foreground"
							aria-hidden="true"
						/>
						<span class="flex min-w-0 flex-col gap-0.5">
							<span id={ids.reuseLabel} class="text-sm font-semibold text-foreground"
								>{REDEPLOY_COPY.reuse.label}</span
							>
							<span id={ids.reuseDescription} class="text-xs text-muted"
								>{REDEPLOY_COPY.reuse.description}</span
							>
						</span>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class={itemClass}
						aria-labelledby={ids.forceLabel}
						aria-describedby={ids.forceDescription}
						onSelect={() => onRedeploy({ forceBuild: true })}
					>
						<Hammer
							size={16}
							weight="bold"
							class="mt-0.5 shrink-0 text-foreground"
							aria-hidden="true"
						/>
						<span class="flex min-w-0 flex-col gap-0.5">
							<span id={ids.forceLabel} class="text-sm font-semibold text-foreground"
								>{REDEPLOY_COPY.forceBuild.label}</span
							>
							<span id={ids.forceDescription} class="text-xs text-muted"
								>{REDEPLOY_COPY.forceBuild.description}</span
							>
						</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	{/if}
</div>
