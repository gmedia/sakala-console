<script lang="ts">
	import { AUDIT_ALIASES, type AuditEvent } from '$lib/api/resources/admin/audit';
	import Button from '$lib/components/ui/Button.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import TimeRangeFilter from '../TimeRangeFilter.svelte';
	import { createAuditEventsQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import {
		rangePatch,
		rangeToParams,
		readListState,
		readRange,
		toApiParams,
		type RangeKey
	} from '../../url-state';
	import { formatWibDateTime } from '../../format';

	const RANGES: readonly RangeKey[] = ['all', '7d', '30d', '90d', 'custom'];
	const SPEC = {
		action: 'id',
		actor_type: AUDIT_ALIASES,
		actor_id: 'id',
		subject_type: AUDIT_ALIASES,
		subject_id: 'id'
	} as const;
	const TYPE_OPTIONS = AUDIT_ALIASES.map((value) => ({ value, label: value }));

	const url = useListUrl();
	const range = $derived(readRange(url.search, RANGES, 'all'));
	const list = $derived(readListState(url.search, SPEC));

	// The API refuses an actor type without an actor ID, so the pair goes together or not at all.
	const params = $derived.by(() => {
		const { actor_type, actor_id, ...rest } = list;
		const paired =
			actor_type && actor_id ? { actor_type, actor_id } : { actor_type: '', actor_id: '' };
		return { ...toApiParams({ ...rest, ...paired }), ...rangeToParams(range) };
	});
	const query = createAuditEventsQuery(() => params);

	let action = $state('');
	let actorId = $state('');
	let subjectId = $state('');
	$effect.pre(() => {
		action = list.action;
		actorId = list.actor_id;
		subjectId = list.subject_id;
	});

	const hasFilters = $derived(
		Boolean(list.action || list.actor_type || list.actor_id || list.subject_type || list.subject_id)
	);

	function applyText(event: SubmitEvent) {
		event.preventDefault();
		url.update({ action: action.trim(), actor_id: actorId.trim(), subject_id: subjectId.trim() });
	}

	function actor(event: AuditEvent): string {
		if (event.actor.name)
			return `${event.actor.name}${event.actor.username ? ` (@${event.actor.username})` : ''}`;
		return [event.actor.type, event.actor.id].filter(Boolean).join(' ') || '-';
	}
</script>

<AdminPageHeader
	title="Audit"
	crumbs={[{ label: 'Audit' }]}
	description="Catatan setiap aksi admin dan kejadian penting, terbaru dulu. Alasan yang ditulis admin ada di setiap aksi."
>
	{#snippet actions()}
		<TimeRangeFilter
			id="audit"
			value={range}
			allowed={RANGES}
			onChange={(next) => url.update(rangePatch(next))}
		/>
	{/snippet}
</AdminPageHeader>

<form class="mb-4 flex flex-wrap items-end gap-3" onsubmit={applyText}>
	<div class="min-w-0 flex-1 basis-56">
		<label for="audit-action" class="mb-1 block text-xs font-medium text-muted">Aksi (persis)</label
		>
		<input
			id="audit-action"
			class="control-input font-mono"
			bind:value={action}
			placeholder="project.suspend_requested"
		/>
	</div>
	<FilterSelect
		id="audit-actor-type"
		label="Tipe pelaku"
		value={list.actor_type}
		options={TYPE_OPTIONS}
		onChange={(value) => url.update({ actor_type: value })}
	/>
	<div class="basis-32">
		<label for="audit-actor-id" class="mb-1 block text-xs font-medium text-muted">ID pelaku</label>
		<input id="audit-actor-id" class="control-input font-mono" bind:value={actorId} />
	</div>
	<FilterSelect
		id="audit-subject-type"
		label="Tipe subjek"
		value={list.subject_type}
		options={TYPE_OPTIONS}
		onChange={(value) => url.update({ subject_type: value })}
	/>
	<div class="basis-56">
		<label for="audit-subject-id" class="mb-1 block text-xs font-medium text-muted">ID subjek</label
		>
		<input id="audit-subject-id" class="control-input font-mono" bind:value={subjectId} />
	</div>
	<Button type="submit" variant="secondary" size="lg">Terapkan</Button>
	{#if hasFilters}
		<Button
			variant="secondary"
			size="lg"
			onclick={() =>
				url.update({
					action: null,
					actor_type: null,
					actor_id: null,
					subject_type: null,
					subject_id: null
				})}>Hapus filter</Button
		>
	{/if}
</form>
{#if list.actor_type && !list.actor_id}
	<p class="mb-3 text-sm text-warning" role="status">
		Isi ID pelaku juga; tipe pelaku saja tidak dipakai sebagai filter.
	</p>
{/if}

{#if query.isError && !query.data}
	<AdminError error={query.error} what="audit log" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Audit event"
		columns={[
			{ label: 'Waktu' },
			{ label: 'Aksi' },
			{ label: 'Pelaku' },
			{ label: 'Subjek' },
			{ label: 'Alasan dan rincian' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle="Tidak ada audit event"
		emptyText={hasFilters ? 'Ubah atau hapus filter.' : 'Belum ada yang tercatat di rentang ini.'}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as event (event.id)}
				{@const reason = typeof event.metadata.reason === 'string' ? event.metadata.reason : null}
				<tr class="align-top">
					<td class="px-4 py-3 whitespace-nowrap">{formatWibDateTime(event.created_at)}</td>
					<td class="px-4 py-3 font-mono text-xs font-medium">{event.action}</td>
					<td class="px-4 py-3">{actor(event)}</td>
					<td class="px-4 py-3">
						<span class="font-mono text-xs">{event.subject.type ?? '-'}</span>
						<p
							class="max-w-40 truncate font-mono text-xs text-muted"
							title={event.subject.id ?? ''}
						>
							{event.subject.id ?? ''}
						</p>
					</td>
					<td class="max-w-md px-4 py-3">
						{#if reason}<p class="wrap-anywhere">{reason}</p>{/if}
						<details class="mt-1">
							<summary
								class="inline-flex min-h-6 cursor-pointer items-center text-xs font-medium text-primary-dark"
								>Rincian</summary
							>
							<pre
								class="mt-1 overflow-x-auto rounded-control bg-background-soft p-2 font-mono text-xs">{JSON.stringify(
									event.metadata,
									null,
									2
								)}</pre>
							{#if event.ip_address || event.user_agent}
								<p class="mt-1 text-xs wrap-anywhere text-muted">
									{event.ip_address ?? ''}
									{event.user_agent ?? ''}
								</p>
							{/if}
						</details>
					</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="event"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}
