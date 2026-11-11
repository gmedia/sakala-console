<script lang="ts">
	import Bell from 'phosphor-svelte/lib/Bell';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { Notification } from '$lib/api/resources/notifications';
	import { cn } from '$lib/utils/cn';
	import { formatRelativeTime } from '$lib/utils/date';

	type Props = {
		notification: Notification;
		variant?: 'compact' | 'full';
		onClick?: (notification: Notification) => void;
	};

	let { notification, variant = 'compact', onClick }: Props = $props();

	/** The icon's shape and the title carry the meaning, and the colour helps scanning. */
	function getIcon(category: string | null) {
		switch (category) {
			case 'deployment_success':
				return { icon: CheckCircle, tone: 'bg-success/10 text-success' };
			case 'deployment_failure':
			case 'project_issue':
				return { icon: WarningCircle, tone: 'bg-error/10 text-error' };
			case 'account_security':
				return { icon: ShieldCheck, tone: 'bg-primary-50 text-primary-dark' };
			case 'workspace':
				return { icon: UsersThree, tone: 'bg-primary-50 text-primary-dark' };
			default:
				return { icon: Bell, tone: 'bg-background-soft text-foreground/70' };
		}
	}

	const icon = $derived(getIcon(notification.category));
	const Icon = $derived(icon.icon);
	const isUnread = $derived(notification.read_at === null);
	const isFull = $derived(variant === 'full');
</script>

<!-- Below `md` and in the popover, the time sits under the text, so a long title keeps its width. -->
<button
	type="button"
	class={cn(
		'grid w-full cursor-pointer grid-cols-[2rem_minmax(0,1fr)_0.5rem] gap-x-3 gap-y-0.5 rounded-control text-left transition-colors hover:bg-background-soft',
		isFull ? 'px-3 py-4 md:grid-cols-[2rem_minmax(0,1fr)_auto_0.5rem]' : 'px-2.5 py-2'
	)}
	onclick={() => onClick?.(notification)}
>
	<span class={cn('row-span-2 flex size-8 items-center justify-center rounded-full', icon.tone)}>
		<Icon size={16} aria-hidden="true" />
	</span>

	<span class="min-w-0">
		{#if notification.title}
			<span
				class={cn(
					'block text-sm wrap-break-word text-foreground',
					isUnread ? 'font-semibold' : 'font-medium'
				)}
			>
				{notification.title}
			</span>
		{/if}
		{#if notification.message}
			<span
				class={cn('block text-sm wrap-break-word text-foreground/80', !isFull && 'line-clamp-2')}
				title={isFull ? undefined : notification.message}
			>
				{notification.message}
			</span>
		{/if}
	</span>

	<span
		class={cn(
			'col-start-2 row-start-2 text-xs whitespace-nowrap text-muted',
			isFull && 'md:col-start-3 md:row-start-1'
		)}
	>
		{formatRelativeTime(notification.created_at)}
	</span>

	{#if isUnread}
		<span
			data-testid="unread-dot"
			class={cn(
				'col-start-3 row-start-1 mt-1.5 size-2 rounded-full bg-primary',
				isFull && 'md:col-start-4'
			)}
		>
			<span class="sr-only">Belum dibaca</span>
		</span>
	{/if}
</button>
