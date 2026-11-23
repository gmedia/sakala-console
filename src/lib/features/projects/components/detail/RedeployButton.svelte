<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Hammer from 'phosphor-svelte/lib/Hammer';
	import Power from 'phosphor-svelte/lib/Power';
	import Button from '$lib/components/ui/Button.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import { cn } from '$lib/utils/cn';
	import { REDEPLOY_COPY } from '../../presentation';
	import { RESTART_COPY } from '../../restart';
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
		/**
		 * Restart in the same menu, for a project that runs or crash-loops. `pending` while a restart
		 * waits for its node.
		 */
		restart?: { pending: boolean; onSelect: () => void } | null;
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
		restart = null,
		iconSize = 18,
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	const ids = {
		reuseLabel: `${uid}-reuse-label`,
		reuseDescription: `${uid}-reuse-description`,
		forceLabel: `${uid}-force-label`,
		forceDescription: `${uid}-force-description`,
		restartLabel: `${uid}-restart-label`,
		restartDescription: `${uid}-restart-description`
	};

	const hasMenu = $derived(offerForceBuild || restart !== null);
	const menuLabel = $derived(
		restart ? REDEPLOY_COPY.menuLabelWithRestart : REDEPLOY_COPY.menuLabel
	);

	const itemClass =
		'flex cursor-pointer gap-3 rounded-control px-3 py-2.5 text-left outline-none data-highlighted:bg-background-soft';
</script>

<div class={cn('flex', className)}>
	<Button
		{variant}
		class={cn('min-w-0 flex-1', hasMenu && 'rounded-r-none')}
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

	{#if hasMenu}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				{disabled}
				aria-label={menuLabel}
				title={menuLabel}
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
					{#if offerForceBuild}
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
					{/if}
					{#if restart}
						{#if offerForceBuild}
							<DropdownMenu.Separator class="my-1 h-px bg-border" />
						{/if}
						<DropdownMenu.Item
							class={cn(itemClass, 'data-disabled:cursor-not-allowed data-disabled:opacity-60')}
							aria-labelledby={ids.restartLabel}
							aria-describedby={ids.restartDescription}
							disabled={restart.pending}
							onSelect={restart.onSelect}
							data-testid="restart-menu-item"
						>
							<Power
								size={16}
								weight="bold"
								class="mt-0.5 shrink-0 text-foreground"
								aria-hidden="true"
							/>
							<span class="flex min-w-0 flex-col gap-0.5">
								<span id={ids.restartLabel} class="text-sm font-semibold text-foreground"
									>{restart.pending ? RESTART_COPY.pending : RESTART_COPY.action}</span
								>
								<span id={ids.restartDescription} class="text-xs text-muted"
									>{RESTART_COPY.description}</span
								>
							</span>
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	{/if}
</div>
