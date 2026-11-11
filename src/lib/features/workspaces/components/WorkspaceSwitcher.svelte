<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown';
	import Check from 'phosphor-svelte/lib/Check';
	import EnvelopeSimple from 'phosphor-svelte/lib/EnvelopeSimple';
	import GearSix from 'phosphor-svelte/lib/GearSix';
	import Plus from 'phosphor-svelte/lib/Plus';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import UserIcon from 'phosphor-svelte/lib/User';
	import { cn } from '$lib/utils/cn';
	import { useActiveWorkspace } from '../access.svelte';
	import { ROLE_LABELS, projectCountLabel, workspaceLabel } from '../presentation';
	import { createMyInvitationsQuery } from '../queries';
	import CreateWorkspaceDialog from './CreateWorkspaceDialog.svelte';

	let { onNavigate }: { onNavigate?: () => void } = $props();

	const workspaces = useActiveWorkspace();
	const invitationsQuery = createMyInvitationsQuery();
	const invitationCount = $derived(invitationsQuery.data?.length ?? 0);

	let createOpen = $state(false);
	let triggerRef = $state<HTMLElement | null>(null);

	const active = $derived(workspaces.active);

	const itemClass =
		'flex min-h-control-md cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-foreground outline-none data-highlighted:bg-background-soft';

	// The project list follows the active workspace, so switching lands there.
	function handleSelect(id: string) {
		if (id === active?.id) return;
		workspaces.select(id);
		onNavigate?.();
		void goto(resolve('/projects'));
	}

	/** Takes an already resolved path. */
	function navigate(href: string) {
		onNavigate?.();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the caller
		void goto(href);
	}
</script>

{#if active}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			bind:ref={triggerRef}
			data-testid="workspace-switcher"
			aria-label={`Workspace aktif: ${workspaceLabel(active)}. Ganti workspace`}
			class="flex w-full cursor-pointer items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-background-soft"
		>
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-dark"
				aria-hidden="true"
			>
				{#if active.type === 'personal'}
					<UserIcon size={16} />
				{:else}
					<UsersThree size={16} />
				{/if}
			</span>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-sm font-semibold text-foreground">{workspaceLabel(active)}</span>
				<span class="truncate text-xs text-muted">
					{active.type === 'personal'
						? `Workspace pribadi · ${projectCountLabel(active.projects_count)}`
						: `Workspace tim · ${ROLE_LABELS[active.role]} · ${projectCountLabel(active.projects_count)}`}
				</span>
			</span>
			{#if invitationCount > 0}
				<span
					class="rounded-full bg-primary px-1.5 text-xs font-semibold text-white tabular-nums"
					aria-label={`${invitationCount} undangan menunggu`}
				>
					{invitationCount}
				</span>
			{/if}
			<CaretUpDown size={16} class="shrink-0 text-muted" aria-hidden="true" />
		</DropdownMenu.Trigger>

		<DropdownMenu.Portal>
			<DropdownMenu.Content
				sideOffset={4}
				align="start"
				class="z-50 w-(--bits-dropdown-menu-anchor-width) min-w-60 rounded-overlay border border-border bg-surface p-1 shadow-overlay"
			>
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading class="px-3 pt-2 pb-1 text-xs font-medium text-muted">
						Workspace
					</DropdownMenu.GroupHeading>
					<DropdownMenu.RadioGroup value={active.id} onValueChange={handleSelect}>
						{#each workspaces.workspaces as workspace (workspace.id)}
							<DropdownMenu.RadioItem value={workspace.id} class={itemClass}>
								{#snippet children({ checked })}
									<span class="flex min-w-0 flex-1 flex-col py-1.5">
										<span class="truncate font-medium">{workspaceLabel(workspace)}</span>
										<span class="truncate text-xs text-muted">
											{workspace.type === 'personal'
												? 'Workspace pribadi'
												: ROLE_LABELS[workspace.role]} · {projectCountLabel(
												workspace.projects_count
											)}
										</span>
									</span>
									<Check
										size={16}
										class={cn('shrink-0 text-primary-dark', !checked && 'invisible')}
										aria-hidden="true"
									/>
								{/snippet}
							</DropdownMenu.RadioItem>
						{/each}
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Group>

				<DropdownMenu.Separator class="my-1 h-px bg-border" />

				{#if active.type === 'team'}
					<DropdownMenu.Item
						class={itemClass}
						onSelect={() => navigate(resolve(`/workspaces/${active.id}`))}
					>
						<GearSix size={16} class="shrink-0" aria-hidden="true" />
						{active.role === 'owner' ? 'Kelola workspace' : 'Anggota workspace'}
					</DropdownMenu.Item>
				{/if}
				{#if invitationCount > 0}
					<DropdownMenu.Item
						class={itemClass}
						onSelect={() => navigate(resolve('/workspace-invitations'))}
					>
						<EnvelopeSimple size={16} class="shrink-0" aria-hidden="true" />
						Undangan ({invitationCount})
					</DropdownMenu.Item>
				{/if}
				<DropdownMenu.Item class={itemClass} onSelect={() => (createOpen = true)}>
					<Plus size={16} class="shrink-0" aria-hidden="true" />
					Buat workspace tim
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{:else if !workspaces.isSettled}
	<div class="skeleton h-13 w-full" role="status" aria-label="Memuat workspace"></div>
{/if}

<CreateWorkspaceDialog bind:open={createOpen} />
