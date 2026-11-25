<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AdminCustomDomain } from '$lib/api/resources/admin/custom-domains';
	import { DOMAIN_STATUS } from '$lib/api/resources/project-domains';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import { getErrorMessage } from '$lib/api/errors';
	import { createPilotLimitsQuery } from '$lib/features/projects/queries';
	import {
		customDomainsEnabled,
		domainChecks,
		domainStatusView,
		formatDomainTime
	} from '$lib/features/domains/presentation';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import { createAdminCustomDomainsQuery } from '../../queries';
	import { createCustomDomainControlMutation } from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';

	const STATUS_OPTIONS = [
		{ value: DOMAIN_STATUS.pending, label: 'Menunggu DNS' },
		{ value: DOMAIN_STATUS.verified, label: 'Aktif' },
		{ value: DOMAIN_STATUS.failed, label: 'Gagal' },
		{ value: DOMAIN_STATUS.disabled, label: 'Nonaktif' },
		{ value: DOMAIN_STATUS.released, label: 'Dipakai proyek lain' }
	];
	/** `failing=1`: verified domains whose checks fail now. Booleans go to Laravel as 1. */
	const FAILING = '1';
	const SPEC = {
		search: 'text',
		status: STATUS_OPTIONS.map((option) => option.value),
		failing: [FAILING]
	} as const;

	const COPY = {
		title: 'Custom domain',
		description:
			'Domain milik pengguna yang diarahkan ke proyek. Nonaktifkan yang dipakai untuk penyalahgunaan.',
		off: 'Custom domain tidak aktif di server ini',
		offText: 'Server ini berjalan dengan SAKALA_CUSTOM_DOMAINS_ENABLED mati.',
		disable: 'Nonaktifkan',
		enable: 'Aktifkan lagi',
		disableTitle: 'Nonaktifkan custom domain?',
		disableConsequence:
			'Domain berhenti melayani sekarang dan tidak aktif lagi sendiri. Pemilik proyek menerima alasan ini lewat notifikasi dan email.',
		disableHint: 'Alasan dikirim ke pemilik proyek dan masuk audit log. Minimal 3 karakter.',
		enableTitle: (hostname: string) => `Aktifkan lagi ${hostname}?`,
		enableText: 'Sakala memeriksa DNS-nya sekarang. Domain aktif lagi kalau DNS-nya lolos.',
		disabled: (hostname: string) => `${hostname} dinonaktifkan.`,
		enabled: (hostname: string) => `Penonaktifan admin untuk ${hostname} dicabut.`
	} as const;

	const limitsQuery = createPilotLimitsQuery();
	const enabled = $derived(customDomainsEnabled(limitsQuery.data));

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const listQuery = createAdminCustomDomainsQuery(
		() => toApiParams(list),
		() => enabled
	);
	const control = createCustomDomainControlMutation();
	const hasFilters = $derived(Boolean(list.search || list.status || list.failing));

	let disabling = $state<AdminCustomDomain | null>(null);
	let enabling = $state<AdminCustomDomain | null>(null);
	let enableError = $state('');
	let statusMessage = $state('');

	function detail(row: AdminCustomDomain): string | null {
		const domain = row.domain;
		if (domain.admin_disabled) return domain.admin_disabled_reason;
		if (domain.status === DOMAIN_STATUS.verified && domain.disable_at) {
			return `Nonaktif ${formatDomainTime(domain.disable_at)}`;
		}
		const failing = domainChecks(domain).rows.filter((check) => check.state === 'fail');
		return failing.length ? failing.map((check) => check.label).join(', ') : null;
	}

	async function confirmEnable() {
		const row = enabling;
		if (!row) return;
		enableError = '';
		try {
			await control.mutateAsync({ id: row.domain.id, action: 'enable' });
			statusMessage = COPY.enabled(row.domain.hostname);
			enabling = null;
		} catch (error) {
			enableError = getErrorMessage(error, 'Permintaan gagal. Coba lagi.');
		}
	}
</script>

<AdminPageHeader
	title={COPY.title}
	crumbs={[{ label: COPY.title }]}
	description={COPY.description}
/>

{#if limitsQuery.isPending}
	<div class="skeleton h-40 w-full rounded-card" role="status" aria-label="Memuat"></div>
{:else if !enabled}
	<EmptyState title={COPY.off} description={COPY.offText} />
{:else}
	<ListToolbar
		id="custom-domains"
		searchLabel="Cari nama domain"
		search={list.search}
		onSearch={(value) => url.update({ search: value }, { replace: true })}
		{hasFilters}
		onReset={() => url.update({ search: null, status: null, failing: null })}
	>
		{#snippet filters()}
			<FilterSelect
				id="custom-domains-status"
				label="Status"
				value={list.status}
				options={STATUS_OPTIONS}
				onChange={(value) => url.update({ status: value })}
			/>
			<FilterSelect
				id="custom-domains-failing"
				label="Pemeriksaan"
				value={list.failing}
				options={[{ value: FAILING, label: 'DNS bermasalah' }]}
				onChange={(value) => url.update({ failing: value })}
			/>
		{/snippet}
	</ListToolbar>

	{#if listQuery.isError && !listQuery.data}
		<AdminError
			error={listQuery.error}
			what="daftar custom domain"
			onRetry={() => listQuery.refetch()}
		/>
	{:else}
		<AdminTable
			caption="Custom domain"
			columns={[
				{ label: 'Domain' },
				{ label: 'Proyek' },
				{ label: 'Status' },
				{ label: 'Diperiksa' },
				{ label: 'Aksi', srOnly: true }
			]}
			loading={listQuery.isPending}
			fetching={listQuery.isPlaceholderData}
			empty={listQuery.data?.data.length === 0}
			emptyTitle={hasFilters ? 'Tidak ada domain yang cocok' : 'Belum ada custom domain'}
			emptyText={hasFilters
				? 'Ubah pencarian atau hapus filter.'
				: 'Belum ada proyek yang menambahkan domain.'}
		>
			{#snippet rows()}
				{#each listQuery.data?.data ?? [] as row (row.domain.id)}
					{@const view = domainStatusView(row.domain)}
					{@const note = detail(row)}
					<tr class="hover:bg-background" data-testid="admin-custom-domain">
						<td class="px-4 py-3">
							<span class="font-mono font-medium wrap-anywhere">{row.domain.hostname}</span>
						</td>
						<td class="px-4 py-3">
							{#if row.project}
								<a
									href={resolve(`/admin/projects/${row.project.id}`)}
									class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
									>{row.project.name}</a
								>
							{:else}-{/if}
						</td>
						<td class="px-4 py-3">
							<Badge tone={view.tone}>{view.label}</Badge>
							{#if note}
								<p class="mt-1 line-clamp-2 max-w-xs text-xs wrap-anywhere text-muted">{note}</p>
							{/if}
						</td>
						<td class="px-4 py-3 whitespace-nowrap">
							{row.domain.last_check.checked_at
								? formatDomainTime(row.domain.last_check.checked_at)
								: '-'}
						</td>
						<td class="px-4 py-3 text-right">
							{#if row.domain.admin_disabled}
								<Button
									variant="secondary"
									size="sm"
									onclick={() => {
										enableError = '';
										enabling = row;
									}}
									aria-label="{COPY.enable} {row.domain.hostname}"
								>
									{COPY.enable}
								</Button>
							{:else if row.domain.status !== DOMAIN_STATUS.released}
								<Button
									variant="secondary"
									size="sm"
									onclick={() => {
										control.reset();
										disabling = row;
									}}
									aria-label="{COPY.disable} {row.domain.hostname}"
								>
									{COPY.disable}
								</Button>
							{/if}
						</td>
					</tr>
				{/each}
			{/snippet}
		</AdminTable>
		<ListPagination
			meta={listQuery.data?.meta}
			noun="domain"
			busy={listQuery.isFetching}
			onPageChange={(page) => url.update({ page })}
		/>
	{/if}
	<span role="status" class="sr-only">{statusMessage}</span>
{/if}

<ReasonDialog
	open={disabling !== null}
	id="custom-domain-disable"
	title={COPY.disableTitle}
	subject={disabling?.domain.hostname ?? ''}
	consequence={COPY.disableConsequence}
	reasonHint={COPY.disableHint}
	confirmLabel={COPY.disable}
	variant="destructive"
	error={control.error}
	onConfirm={async (reason) => {
		const row = disabling;
		if (!row) return;
		try {
			await control.mutateAsync({ id: row.domain.id, action: 'disable', reason });
			statusMessage = COPY.disabled(row.domain.hostname);
			disabling = null;
		} catch {
			// Shown through `error`.
		}
	}}
	onCancel={() => {
		control.reset();
		disabling = null;
	}}
/>

<Dialog
	open={enabling !== null}
	title={enabling ? COPY.enableTitle(enabling.domain.hostname) : ''}
	description={COPY.enableText}
	confirmLabel={COPY.enable}
	loading={control.isPending}
	onConfirm={confirmEnable}
	onCancel={() => (enabling = null)}
>
	{#if enableError}
		<p role="alert" class="text-sm text-error-dark">{enableError}</p>
	{/if}
</Dialog>
