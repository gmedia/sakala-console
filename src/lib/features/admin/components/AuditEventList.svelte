<script lang="ts">
	import type { AuditEvent } from '$lib/api/resources/admin/audit';
	import { formatWibDateTime } from '../format';

	let { events }: { events: AuditEvent[] } = $props();

	function actor(event: AuditEvent): string {
		if (event.actor.name)
			return `${event.actor.name}${event.actor.username ? ` (@${event.actor.username})` : ''}`;
		return [event.actor.type, event.actor.id].filter(Boolean).join(' ') || 'Tidak diketahui';
	}

	function reason(event: AuditEvent): string | null {
		const value = event.metadata.reason;
		return typeof value === 'string' ? value : null;
	}
</script>

{#if events.length === 0}
	<p class="surface-card p-5 text-sm text-muted">Belum ada audit event.</p>
{:else}
	<ol class="surface-card divide-y divide-border">
		{#each events as event (event.id)}
			<li class="flex flex-col gap-1 px-5 py-3 text-sm">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<code class="font-mono text-xs font-medium text-foreground">{event.action}</code>
					<time class="text-xs text-muted" datetime={event.created_at ?? undefined}
						>{formatWibDateTime(event.created_at)}</time
					>
				</div>
				<p class="text-muted">
					oleh {actor(event)}{event.subject.type
						? `, pada ${event.subject.type} ${event.subject.id ?? ''}`
						: ''}
				</p>
				{#if reason(event)}
					<p class="wrap-anywhere text-foreground">Alasan: {reason(event)}</p>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
