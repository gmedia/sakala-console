<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { AdminFeedback, FeedbackStatus } from '$lib/api/resources/admin/audit';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import { createAdminFeedbackQuery } from '../../queries';
	import { createFeedbackStatusMutation } from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import {
		FEEDBACK_CATEGORIES,
		FEEDBACK_CATEGORY_OPTIONS,
		FEEDBACK_STATUS_OPTIONS,
		feedbackStatus,
		formatWibDateTime
	} from '../../format';

	const SPEC = {
		search: 'text',
		status: FEEDBACK_STATUS_OPTIONS.map((option) => option.value),
		category: FEEDBACK_CATEGORY_OPTIONS.map((option) => option.value)
	} as const;

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createAdminFeedbackQuery(() => toApiParams(list));
	const hasFilters = $derived(Boolean(list.search || list.status || list.category));

	const mutation = createFeedbackStatusMutation();
	let editing = $state<AdminFeedback | null>(null);
	let nextStatus = $state<FeedbackStatus>('acknowledged');
	let error = $state<unknown>(null);

	function edit(feedback: AdminFeedback) {
		error = null;
		nextStatus =
			feedback.status === 'open'
				? 'acknowledged'
				: feedback.status === 'acknowledged'
					? 'resolved'
					: 'open';
		editing = feedback;
	}

	async function save(reason: string) {
		if (!editing) return;
		error = null;
		try {
			await mutation.mutateAsync({ id: editing.id, status: nextStatus, reason });
			editing = null;
			toast.success(`Status masukan menjadi ${feedbackStatus(nextStatus).label}.`);
		} catch (caught) {
			error = caught;
		}
	}
</script>

<AdminPageHeader
	title="Masukan"
	crumbs={[{ label: 'Masukan' }]}
	description="Masukan yang dikirim pengguna dari Console. Tandai yang sudah ditindaklanjuti supaya tidak dibaca dua kali."
/>

<ListToolbar
	id="feedback"
	searchLabel="Cari isi masukan"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	{hasFilters}
	onReset={() => url.update({ search: null, status: null, category: null })}
>
	{#snippet filters()}
		<FilterSelect
			id="feedback-status"
			label="Status"
			value={list.status}
			options={FEEDBACK_STATUS_OPTIONS}
			onChange={(value) => url.update({ status: value })}
		/>
		<FilterSelect
			id="feedback-category"
			label="Kategori"
			value={list.category}
			options={FEEDBACK_CATEGORY_OPTIONS}
			onChange={(value) => url.update({ category: value })}
		/>
	{/snippet}
</ListToolbar>

{#if query.isError && !query.data}
	<AdminError error={query.error} what="masukan" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar masukan"
		columns={[
			{ label: 'Masukan' },
			{ label: 'Pengirim' },
			{ label: 'Konteks' },
			{ label: 'Dikirim' },
			{ label: 'Status' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle={hasFilters ? 'Tidak ada masukan yang cocok' : 'Belum ada masukan'}
		emptyText={hasFilters ? 'Ubah pencarian atau hapus filter.' : ''}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as feedback (feedback.id)}
				{@const status = feedbackStatus(feedback.status)}
				<tr class="align-top">
					<td class="max-w-md px-4 py-3">
						<p class="text-xs font-medium text-muted">
							{FEEDBACK_CATEGORIES[feedback.category] ?? feedback.category}
						</p>
						<!-- Written by the user: always text, never HTML. -->
						<p class="mt-1 wrap-anywhere whitespace-pre-line">{feedback.message}</p>
					</td>
					<td class="px-4 py-3">
						<a
							href={resolve(`/admin/users/${String(feedback.user.id)}`)}
							class="inline-flex min-h-6 items-center underline underline-offset-2"
							>@{feedback.user.username}</a
						>
						<p class="text-xs text-muted">
							{feedback.consent ? 'Boleh dihubungi' : 'Tidak minta dihubungi'}
						</p>
					</td>
					<td class="px-4 py-3">
						{#if feedback.project}
							{#if feedback.project.deleted}{feedback.project.name} (dihapus){:else}
								<a
									href={resolve(`/admin/projects/${feedback.project.id}`)}
									class="inline-flex min-h-6 items-center underline underline-offset-2"
									>{feedback.project.name}</a
								>
							{/if}
						{:else}<span class="text-muted">Umum</span>{/if}
						{#if feedback.deployment_id}
							<p>
								<a
									href={resolve(`/admin/deployments/${feedback.deployment_id}`)}
									class="inline-flex min-h-6 items-center text-xs underline underline-offset-2"
									>Deployment terkait</a
								>
							</p>
						{/if}
					</td>
					<td class="px-4 py-3 whitespace-nowrap">{formatWibDateTime(feedback.created_at)}</td>
					<td class="px-4 py-3">
						<div class="flex flex-col items-start gap-2">
							<Badge tone={status.tone}>{status.label}</Badge>
							<Button size="sm" variant="secondary" onclick={() => edit(feedback)}>
								Ubah status<span class="sr-only"> masukan dari @{feedback.user.username}</span>
							</Button>
						</div>
					</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="masukan"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}

<ReasonDialog
	open={editing !== null}
	id="feedback-status"
	title="Ubah status masukan"
	subject={editing
		? `Masukan dari @${editing.user.username}: "${editing.message.slice(0, 80)}${editing.message.length > 80 ? '…' : ''}"`
		: ''}
	consequence="Status hanya untuk admin; pengirim tidak diberi tahu."
	confirmLabel="Simpan status"
	{error}
	fieldsInvalid={editing?.status === nextStatus}
	onCancel={() => (editing = null)}
	onConfirm={save}
>
	{#snippet fields()}
		<div class="space-y-1.5">
			<label for="feedback-next-status" class="block text-sm font-medium">Status baru</label>
			<select
				id="feedback-next-status"
				class="control-input cursor-pointer"
				bind:value={nextStatus}
			>
				{#each FEEDBACK_STATUS_OPTIONS as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	{/snippet}
</ReasonDialog>
