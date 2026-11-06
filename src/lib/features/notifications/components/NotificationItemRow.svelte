<script lang="ts">
	import Bell from 'phosphor-svelte/lib/Bell';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { Notification } from '$lib/api/resources/notifications';
	import { cn } from '$lib/utils/cn';
	import { formatNotificationTime } from '../presentation';

	type Props = {
		notification: Notification;
		variant?: 'compact' | 'full';
		onClick?: (notification: Notification) => void;
	};

	let { notification, variant = 'compact', onClick }: Props = $props();

	function getIcon(category: string | null) {
		switch (category) {
			case 'deployment_success':
				return CheckCircle;
			case 'deployment_failure':
			case 'project_issue':
				return WarningCircle;
			case 'account_security':
				return ShieldCheck;
			default:
				return Bell;
		}
	}

	const Icon = $derived(getIcon(notification.category));
	const isUnread = $derived(notification.read_at === null);
	const isFull = $derived(variant === 'full');
</script>

<button
	type="button"
	class={cn(
		'group flex w-full gap-3 rounded-xl text-left transition-colors hover:bg-background-soft focus-visible:bg-background-soft focus-visible:outline-none cursor-pointer',
		isFull ? 'items-start px-3 py-4 md:items-center' : 'items-center px-2.5 py-2'
	)}
	onclick={() => onClick?.(notification)}
>
	<div
		class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground/70 transition-colors group-hover:bg-black/10 group-hover:text-foreground"
	>
		<Icon size={16} class="size-4" aria-hidden="true" />
	</div>

	<div class="min-w-0 flex-1 pr-1">
		{#if notification.title}
			<p
				class={cn(
					'font-sans text-xs text-foreground md:text-sm',
					isUnread ? 'font-semibold' : 'font-medium',
					!isFull && 'truncate'
				)}
			>
				{notification.title}
			</p>
		{/if}
		{#if notification.message}
			<p
				class={cn(
					'font-sans text-xs text-foreground/80',
					isFull ? 'leading-relaxed md:text-sm' : 'truncate'
				)}
				title={isFull ? undefined : notification.message}
			>
				{notification.message}
			</p>
		{/if}
	</div>

	<span class="shrink-0 whitespace-nowrap font-sans text-xs text-muted">
		{formatNotificationTime(notification.created_at)}
	</span>

	{#if isUnread}
		<span
			data-testid="unread-dot"
			class="inline-block size-2 shrink-0 rounded-full bg-blue-600 ring-1 ring-white"
		>
			<span class="sr-only">Belum dibaca</span>
		</span>
	{:else}
		<span class="inline-block size-2 shrink-0 opacity-0" aria-hidden="true"></span>
	{/if}
</button>
