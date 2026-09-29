<script lang="ts">
	import { Bell, Megaphone, Rocket, WarningCircle, CheckCircle } from 'phosphor-svelte';
	import type { NotificationItem } from '../types';

	type Props = {
		notification: NotificationItem;
		onClick?: (notification: NotificationItem) => void;
	};

	let { notification, onClick }: Props = $props();

	function getIcon(type?: string) {
		switch (type) {
			case 'welcome':
			case 'info':
				return Megaphone;
			case 'deployment':
				return Rocket;
			case 'alert':
				return WarningCircle;
			case 'success':
				return CheckCircle;
			default:
				return Bell;
		}
	}

	const Icon = $derived(getIcon(notification.type));
</script>

<button
	type="button"
	class="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-background-soft focus-visible:bg-background-soft focus-visible:outline-none cursor-pointer"
	onclick={() => onClick?.(notification)}
>
	{#if notification.avatar}
		<img
			src={notification.avatar}
			alt="Notifikasi avatar"
			class="size-8 shrink-0 rounded-full object-cover ring-1 ring-border/50"
		/>
	{:else}
		<div
			class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground/70 transition-colors group-hover:bg-black/10 group-hover:text-foreground"
		>
			<Icon size={16} class="size-4" />
		</div>
	{/if}

	<div class="flex-1 min-w-0 pr-1">
		<p
			class="truncate font-sans text-xs font-normal text-foreground group-hover:text-foreground"
			title={notification.message}
		>
			{notification.message}
		</p>
	</div>

	<span class="shrink-0 font-sans text-xs text-muted">
		{notification.timestamp}
	</span>

	{#if !notification.is_read}
		<span
			data-testid="unread-dot"
			class="inline-block size-2 shrink-0 rounded-full bg-blue-600 ring-1 ring-white"
			aria-label="Belum dibaca"
		></span>
	{:else}
		<span class="inline-block size-2 shrink-0 opacity-0" aria-hidden="true"></span>
	{/if}
</button>
