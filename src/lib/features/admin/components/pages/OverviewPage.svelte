<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import UserPlus from 'phosphor-svelte/lib/UserPlus';
	import SquaresFour from 'phosphor-svelte/lib/SquaresFour';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import Button from '$lib/components/ui/Button.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import TimeRangeFilter from '../TimeRangeFilter.svelte';
	import MetricCard from '../MetricCard.svelte';
	import ChartCard from '../ChartCard.svelte';
	import ColumnChart from '../ColumnChart.svelte';
	import BarList from '../BarList.svelte';
	import OutcomeDonut from '../OutcomeDonut.svelte';
	import { createAdminCountQuery, createAdminOverviewQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import { rangePatch, rangeToParams, readRange, type RangeKey } from '../../url-state';
	import {
		FAILURE_CATEGORIES,
		RANGE_LABELS,
		bucketGrowth,
		failureCategoryLabel,
		formatNumber,
		formatRange,
		formatShare,
		formatWibDate,
		formatWibDateTime,
		onboardingSourceLabel,
		trend
	} from '../../format';

	const RANGES: readonly RangeKey[] = ['7d', '30d', '90d', 'custom'];

	const url = useListUrl();
	const range = $derived(readRange(url.search, RANGES, '30d'));
	const params = $derived(rangeToParams(range));

	const overviewQuery = createAdminOverviewQuery(() => params);
	const openFeedbackQuery = createAdminCountQuery('feedback', () => ({ status: 'open' }));
	const offlineAgentsQuery = createAdminCountQuery('agents', () => ({ status: 'offline' }));

	const data = $derived(overviewQuery.data);
	const loading = $derived(overviewQuery.isPending);
	const rangeText = $derived(data ? formatRange(data.range) : RANGE_LABELS[range.range]);
	const failuresHref = $derived(
		`${resolve('/admin/failures')}?${new URLSearchParams(rangeToParams(range) as Record<string, string>)}`
	);

	const outcomes = $derived(data?.period.deployments);
	const finished = $derived(outcomes ? outcomes.succeeded + outcomes.failed : 0);
	const successRate = $derived(outcomes ? formatShare(outcomes.succeeded, finished) : null);

	const growth = $derived(data ? bucketGrowth(data.user_growth) : null);
	const growthTotal = $derived(data?.user_growth.reduce((sum, point) => sum + point.count, 0) ?? 0);
	const failedCategories = $derived(data?.failure_categories.filter((row) => row.count > 0) ?? []);
	const sourceTotal = $derived(
		data?.new_user_sources.reduce((sum, row) => sum + row.count, 0) ?? 0
	);

	type Attention = { key: string; text: string; href?: string; link?: string };

	// What needs a look first: failing deploys, unanswered feedback, nodes that went quiet.
	const attention = $derived.by((): Attention[] => {
		if (!data || !outcomes) return [];
		const items: Attention[] = [];
		if (outcomes.failed > 0) {
			const change = trend(outcomes.failed, data.previous_period.deployments.failed, false);
			const top = failedCategories[0];
			items.push({
				key: 'failures',
				text: `${formatNumber(outcomes.failed)} deployment gagal (${formatShare(outcomes.failed, finished) ?? '-'} dari yang selesai, ${change.direction === 'flat' ? 'sama dengan periode sebelumnya' : data.previous_period.deployments.failed === 0 ? 'periode sebelumnya tidak ada' : `${change.text} dibanding periode sebelumnya`}).${top ? ` Kategori terbanyak: ${failureCategoryLabel(top.category)}.` : ''}`,
				href: failuresHref,
				link: 'Lihat kegagalan'
			});
		}
		if ((openFeedbackQuery.data ?? 0) > 0) {
			items.push({
				key: 'feedback',
				text: `${formatNumber(openFeedbackQuery.data!)} masukan berstatus Baru dan belum ditanggapi.`,
				href: `${resolve('/admin/feedback')}?status=open`,
				link: 'Buka masukan'
			});
		}
		if ((offlineAgentsQuery.data ?? 0) > 0) {
			items.push({
				key: 'agents',
				text: `${formatNumber(offlineAgentsQuery.data!)} runtime node offline. Deployment tidak bisa dijadwalkan ke node itu.`,
				href: `${resolve('/admin/agents')}?status=offline`,
				link: 'Lihat node'
			});
		}
		return items;
	});
</script>

<AdminPageHeader
	title="Overview"
	description="Adopsi dan kesehatan Sakala dalam satu rentang waktu. Semua angka di halaman ini memakai rentang yang sama."
>
	{#snippet meta()}
		{#if data}
			<span>Dihitung {formatWibDateTime(data.generated_at)} · dibaca ulang tiap 5 menit</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		<TimeRangeFilter
			id="overview"
			value={range}
			allowed={RANGES}
			onChange={(next) => url.update(rangePatch(next))}
		/>
		<Button
			variant="secondary"
			size="lg"
			class="self-end"
			disabled={overviewQuery.isFetching}
			onclick={() => overviewQuery.refetch()}
		>
			<ArrowsClockwise size={16} aria-hidden="true" />
			Muat ulang
		</Button>
	{/snippet}
	<p class="text-sm text-foreground">
		Rentang: <strong>{rangeText}</strong> <span class="text-muted">(hari penuh WIB)</span>
	</p>
</AdminPageHeader>

{#if overviewQuery.isError && !data}
	<AdminError error={overviewQuery.error} what="overview" onRetry={() => overviewQuery.refetch()} />
{:else}
	<div class="flex flex-col gap-6">
		<section aria-labelledby="attention-heading" class="surface-card p-5">
			<h2 id="attention-heading" class="text-base text-foreground">Perlu perhatian</h2>
			{#if loading}
				<span class="skeleton mt-3 block h-4 w-2/3"></span>
			{:else if attention.length === 0}
				<p class="mt-2 text-sm text-muted">
					Tidak ada deployment gagal, masukan baru, atau node offline untuk ditindaklanjuti.
				</p>
			{:else}
				<ul class="mt-3 flex flex-col gap-2">
					{#each attention as item (item.key)}
						<li
							class="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
						>
							<span class="text-foreground">{item.text}</span>
							{#if item.href}
								<a
									href={item.href}
									class="inline-flex min-h-6 shrink-0 items-center font-medium text-primary-dark underline underline-offset-2"
									>{item.link}</a
								>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section aria-labelledby="period-heading">
			<h2 id="period-heading" class="sr-only">Angka rentang ini</h2>
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					label="Pengguna baru"
					help="Akun yang terdaftar di rentang ini. Panah: dibanding rentang sama panjang sebelumnya."
					icon={UserPlus}
					{loading}
					value={formatNumber(data?.period.new_users ?? 0)}
					trend={data ? trend(data.period.new_users, data.previous_period.new_users) : null}
				/>
				<MetricCard
					label="Proyek baru"
					help="Proyek yang dibuat di rentang ini, termasuk yang sudah dihapus."
					icon={SquaresFour}
					{loading}
					value={formatNumber(data?.period.new_projects ?? 0)}
					trend={data ? trend(data.period.new_projects, data.previous_period.new_projects) : null}
				/>
				<MetricCard
					label="Deployment berhasil"
					help="Deployment yang dibuat di rentang ini dan berstatus Berhasil."
					icon={CheckCircle}
					{loading}
					value={formatNumber(outcomes?.succeeded ?? 0)}
					trend={data
						? trend(data.period.deployments.succeeded, data.previous_period.deployments.succeeded)
						: null}
				/>
				<MetricCard
					label="Deployment gagal"
					help="Deployment yang dibuat di rentang ini dan berstatus Gagal. Naik berarti memburuk."
					icon={XCircle}
					tone="error"
					{loading}
					value={formatNumber(outcomes?.failed ?? 0)}
					trend={data
						? trend(data.period.deployments.failed, data.previous_period.deployments.failed, false)
						: null}
				/>
			</div>
		</section>

		<section aria-labelledby="pilot-heading" class="surface-card p-5">
			<h2 id="pilot-heading" class="text-base text-foreground">Validasi pilot</h2>
			<p class="mt-0.5 text-xs text-muted">
				Apakah orang memakai Sakala sampai men-deploy, dan kembali lagi. {rangeText}.
			</p>
			<dl class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{#each [{ label: 'Aktivasi', value: data ? formatNumber(data.pilot.activated_users) : '', help: 'Pengguna yang menyelesaikan onboarding di rentang ini.' }, { label: 'Pen-deploy unik', value: data ? formatNumber(data.pilot.unique_deployers) : '', help: 'Pengguna berbeda yang meminta deployment.' }, { label: 'Pen-deploy berulang', value: data ? formatNumber(data.pilot.repeat_deployers) : '', help: 'Pengguna yang meminta dua deployment atau lebih.' }, { label: 'Keberhasilan deploy', value: successRate ?? 'Belum ada', help: 'Berhasil dibagi berhasil ditambah gagal. Yang dibatalkan atau masih berjalan tidak dihitung.' }, { label: 'Masukan', value: data ? formatNumber(data.pilot.feedback_count) : '', help: 'Masukan yang dikirim lewat Console di rentang ini.' }] as stat (stat.label)}
					<div>
						<dt class="text-sm font-medium text-foreground">{stat.label}</dt>
						<dd class="mt-1">
							{#if loading}
								<span class="skeleton block h-7 w-12"></span>
							{:else}
								<span class="font-display text-2xl font-semibold text-foreground">{stat.value}</span
								>
							{/if}
							<span class="mt-1 block text-xs text-muted">{stat.help}</span>
						</dd>
					</div>
				{/each}
			</dl>
			{#if data}
				<p class="mt-4 border-t border-border pt-3 text-xs text-muted">
					Sepanjang waktu: {formatNumber(data.totals.users)} pengguna, {formatNumber(
						data.totals.projects
					)}
					proyek, {formatNumber(data.totals.active_projects)} proyek sedang melayani trafik.
				</p>
			{/if}
		</section>

		<div class="grid gap-6 xl:grid-cols-5">
			<ChartCard
				class="xl:col-span-3"
				title="Pertumbuhan pengguna"
				subtitle={`Pendaftaran baru per ${growth?.unit ?? 'hari'}, ${rangeText}`}
				{loading}
				empty={growthTotal === 0}
				emptyText="Tidak ada pendaftaran baru di rentang ini."
			>
				{#if growth}
					<ColumnChart
						summary={`${formatNumber(growthTotal)} pendaftaran baru, dikelompokkan per ${growth.unit}.`}
						columns={growth.buckets.map((bucket) => ({
							label: bucket.label,
							value: bucket.count,
							description: `${bucket.start === bucket.end ? formatWibDate(`${bucket.start}T00:00:00+07:00`) : `${bucket.start} sampai ${bucket.end}`}: ${bucket.count}`
						}))}
					/>
				{/if}
				{#snippet table()}
					<table class="w-full text-left text-sm">
						<thead
							><tr
								><th scope="col" class="py-1 pr-4 font-medium text-muted"
									>{growth?.unit === 'minggu' ? 'Minggu mulai' : 'Tanggal'}</th
								><th scope="col" class="py-1 text-right font-medium text-muted">Pendaftaran</th></tr
							></thead
						>
						<tbody>
							{#each growth?.buckets ?? [] as bucket (bucket.start)}
								<tr class="border-t border-border"
									><td class="py-1 pr-4">{bucket.start}</td><td class="py-1 text-right tabular-nums"
										>{bucket.count}</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				{/snippet}
			</ChartCard>

			<ChartCard
				class="xl:col-span-2"
				title="Status deployment"
				subtitle={`${formatNumber(outcomes?.total ?? 0)} deployment dibuat, ${rangeText}`}
				{loading}
				empty={(outcomes?.total ?? 0) === 0}
				emptyText="Tidak ada deployment di rentang ini."
			>
				{#if outcomes}
					<OutcomeDonut
						centerValue={successRate ?? '-'}
						centerLabel="berhasil"
						summary={`${outcomes.succeeded} berhasil, ${outcomes.failed} gagal, ${outcomes.cancelled} dibatalkan, ${outcomes.in_progress} masih berjalan.`}
						segments={[
							{
								key: 'succeeded',
								label: 'Berhasil',
								value: outcomes.succeeded,
								color: 'var(--color-success)'
							},
							{
								key: 'failed',
								label: 'Gagal',
								value: outcomes.failed,
								color: 'var(--color-error)'
							},
							{
								key: 'cancelled',
								label: 'Dibatalkan',
								value: outcomes.cancelled,
								color: 'var(--color-border-strong)'
							},
							{
								key: 'in_progress',
								label: 'Masih berjalan',
								value: outcomes.in_progress,
								color: 'var(--color-primary-300)'
							}
						]}
					/>
				{/if}
			</ChartCard>

			<ChartCard
				class="xl:col-span-3"
				title="Alasan deployment gagal"
				subtitle={`Kategori dari classifier API, ${rangeText}. Pilih kategori untuk melihat deployment-nya.`}
				{loading}
				empty={failedCategories.length === 0}
				emptyText="Tidak ada deployment gagal di rentang ini."
			>
				<BarList
					tone="error"
					unit="kasus"
					rows={failedCategories.map((row) => ({
						key: row.category,
						label: failureCategoryLabel(row.category),
						value: row.count,
						help: FAILURE_CATEGORIES[row.category]?.help,
						href: `${failuresHref}&category=${row.category}`
					}))}
				/>
				{#if data && data.top_failure_codes.length}
					<p class="text-xs text-muted">
						Kode terbanyak:
						{data.top_failure_codes
							.slice(0, 3)
							.map((row) => `${row.code ?? 'tanpa kode'} (${row.count})`)
							.join(', ')}
					</p>
				{/if}
			</ChartCard>

			<ChartCard
				class="xl:col-span-2"
				title="Sumber pengguna baru"
				subtitle={`Jawaban onboarding "dari mana tahu Sakala", ${rangeText}`}
				{loading}
				empty={sourceTotal === 0}
				emptyText="Tidak ada pengguna baru di rentang ini."
			>
				<BarList
					total={sourceTotal}
					rows={(data?.new_user_sources ?? []).map((row) => ({
						key: row.source ?? 'none',
						label: onboardingSourceLabel(row.source),
						value: row.count
					}))}
				/>
			</ChartCard>
		</div>
	</div>
{/if}
