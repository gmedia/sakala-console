<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { formatDuration } from '$lib/utils/date';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import MetricCard from '../MetricCard.svelte';
	import TimeRangeFilter from '../TimeRangeFilter.svelte';
	import { createFailedDeploymentsQuery, createFailureSummaryQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import {
		rangePatch,
		rangeToParams,
		readListState,
		readRange,
		toApiParams,
		type RangeKey
	} from '../../url-state';
	import {
		FAILURE_CATEGORIES,
		FAILURE_CATEGORY_OPTIONS,
		RANGE_LABELS,
		failureCategoryLabel,
		formatNumber,
		formatRange,
		formatWibDateTime,
		trend
	} from '../../format';

	const RANGES: readonly RangeKey[] = ['7d', '30d', '90d', 'all', 'custom'];
	const SPEC = {
		search: 'text',
		category: FAILURE_CATEGORY_OPTIONS.map((option) => option.value),
		code: 'id'
	} as const;

	const url = useListUrl();
	const range = $derived(readRange(url.search, RANGES, '30d'));
	const list = $derived(readListState(url.search, SPEC));
	const rangeParams = $derived(rangeToParams(range));

	const summaryQuery = createFailureSummaryQuery(() => rangeParams);
	const listQuery = createFailedDeploymentsQuery(() => ({ ...toApiParams(list), ...rangeParams }));

	const summary = $derived(summaryQuery.data);
	const rangeText = $derived(summary ? formatRange(summary.range) : RANGE_LABELS[range.range]);
	const topCategories = $derived(
		summary?.categories.filter((row) => row.count > 0).slice(0, 3) ?? []
	);
	const hasFilters = $derived(Boolean(list.search || list.category || list.code));
</script>

<AdminPageHeader
	title="Analisis kegagalan"
	crumbs={[{ label: 'Analisis kegagalan' }]}
	description="Deployment yang gagal di semua proyek, dikelompokkan dengan kategori yang sama yang dilihat pemilik proyek."
>
	{#snippet meta()}
		<span>Dibaca ulang tiap 5 menit</span>
	{/snippet}
	{#snippet actions()}
		<TimeRangeFilter
			id="failures"
			value={range}
			allowed={RANGES}
			onChange={(next) => url.update(rangePatch(next))}
		/>
	{/snippet}
	<p class="text-sm">
		Rentang: <strong>{rangeText}</strong> <span class="text-muted">(hari penuh WIB)</span>
	</p>
</AdminPageHeader>

<section aria-labelledby="failure-summary" class="mb-6">
	<h2 id="failure-summary" class="mb-3 text-base">Kategori error</h2>
	{#if summaryQuery.isError && !summary}
		<AdminError
			error={summaryQuery.error}
			what="ringkasan kegagalan"
			onRetry={() => summaryQuery.refetch()}
		/>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricCard
				label="Semua deployment gagal"
				help={summary?.previous_total === null
					? 'Sepanjang waktu, tanpa pembanding.'
					: 'Panah: dibanding rentang sama panjang sebelumnya. Naik berarti memburuk.'}
				loading={summaryQuery.isPending}
				tone="error"
				value={formatNumber(summary?.total ?? 0)}
				trend={summary && summary.previous_total !== null
					? trend(summary.total, summary.previous_total, false)
					: null}
			/>
			{#each topCategories as row (row.category)}
				<MetricCard
					label={failureCategoryLabel(row.category)}
					help={FAILURE_CATEGORIES[row.category]?.help ?? ''}
					value={formatNumber(row.count)}
					tone="error"
					trend={row.previous_count !== null ? trend(row.count, row.previous_count, false) : null}
				/>
			{/each}
		</div>
		{#if summary && summary.total === 0}
			<p class="mt-3 text-sm text-muted">Tidak ada deployment gagal di rentang ini.</p>
		{/if}
	{/if}
</section>

<section aria-labelledby="failure-list">
	<h2 id="failure-list" class="mb-3 text-base">Deployment gagal</h2>
	<ListToolbar
		id="failures"
		searchLabel="Cari nama atau slug proyek"
		search={list.search}
		onSearch={(value) => url.update({ search: value }, { replace: true })}
		{hasFilters}
		onReset={() => url.update({ search: null, category: null, code: null })}
	>
		{#snippet filters()}
			<FilterSelect
				id="failures-category"
				label="Kategori"
				value={list.category}
				options={FAILURE_CATEGORY_OPTIONS}
				onChange={(value) => url.update({ category: value })}
			/>
			<FilterSelect
				id="failures-code"
				label="Kode"
				value={list.code}
				options={(summary?.codes ?? [])
					.filter((row) => row.code !== null)
					.map((row) => ({ value: row.code!, label: `${row.code} (${row.count})` }))}
				onChange={(value) => url.update({ code: value })}
			/>
		{/snippet}
	</ListToolbar>

	{#if listQuery.isError && !listQuery.data}
		<AdminError
			error={listQuery.error}
			what="daftar kegagalan"
			onRetry={() => listQuery.refetch()}
		/>
	{:else}
		<AdminTable
			caption="Deployment gagal"
			columns={[
				{ label: 'Proyek' },
				{ label: 'Waktu' },
				{ label: 'Kategori' },
				{ label: 'Alasan gagal' },
				{ label: 'Durasi' },
				{ label: 'Detail', srOnly: true }
			]}
			loading={listQuery.isPending}
			fetching={listQuery.isPlaceholderData}
			empty={listQuery.data?.data.length === 0}
			emptyTitle={hasFilters ? 'Tidak ada kegagalan yang cocok' : 'Tidak ada deployment gagal'}
			emptyText={hasFilters
				? 'Ubah pencarian atau hapus filter.'
				: 'Di rentang ini semua deployment selesai tanpa gagal, atau belum ada deployment.'}
		>
			{#snippet rows()}
				{#each listQuery.data?.data ?? [] as row (row.id)}
					<tr class="hover:bg-background">
						<td class="px-4 py-3">
							{#if row.project}
								<span class="font-medium">{row.project.name}</span>
								<p class="text-xs text-muted">
									#{row.sequence}{row.project.deleted ? ' · proyek dihapus' : ''}
								</p>
							{:else}-{/if}
						</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatWibDateTime(row.created_at)}</td>
						<td class="px-4 py-3">
							<Badge tone="error">{failureCategoryLabel(row.failure.category)}</Badge>
							{#if row.failure.code}<p class="mt-1 font-mono text-xs text-muted">
									{row.failure.code}
								</p>{/if}
						</td>
						<td class="max-w-md px-4 py-3">
							<p class="line-clamp-2 wrap-anywhere">{row.failure.summary ?? 'Tanpa ringkasan'}</p>
							{#if row.failure.detail}<p
									class="line-clamp-1 font-mono text-xs wrap-anywhere text-muted"
								>
									{row.failure.detail}
								</p>{/if}
						</td>
						<td class="px-4 py-3 whitespace-nowrap"
							>{row.duration_seconds === null ? '-' : formatDuration(row.duration_seconds)}</td
						>
						<td class="px-4 py-3 text-right">
							<a
								href={resolve(`/admin/deployments/${row.id}`)}
								class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
							>
								Detail<span class="sr-only">
									deployment #{row.sequence} {row.project?.name ?? ''}</span
								>
							</a>
						</td>
					</tr>
				{/each}
			{/snippet}
		</AdminTable>
		<ListPagination
			meta={listQuery.data?.meta}
			noun="kegagalan"
			busy={listQuery.isFetching}
			onPageChange={(page) => url.update({ page })}
		/>
	{/if}
</section>
