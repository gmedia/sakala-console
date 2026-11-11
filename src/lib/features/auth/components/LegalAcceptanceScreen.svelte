<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { getErrorMessage } from '$lib/api/errors';
	import { queryKeys } from '$lib/api/query-keys';
	import Button from '$lib/components/ui/Button.svelte';
	import { pageTitle } from '$lib/utils/page-title';
	import {
		CONSENT_REQUIRED_MESSAGE,
		isOutdatedLegalVersion,
		LEGAL_VERSIONS_UNAVAILABLE_MESSAGE,
		legalConsentError
	} from '../legal-consent';
	import { useAcceptLegalDocuments, useLogout } from '../mutations';
	import { useAuthOptions } from '../queries';
	import AuthSplitLayout from './AuthSplitLayout.svelte';
	import LegalConsentField from './LegalConsentField.svelte';

	const client = useQueryClient();
	const options = useAuthOptions();
	const accept = useAcceptLegalDocuments();
	const logout = useLogout();

	const legal = $derived(options.data?.legal);

	let checked = $state(false);
	let consentError = $state('');
	let generalError = $state('');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		consentError = '';
		generalError = '';
		if (!legal) return;
		if (!checked) {
			consentError = CONSENT_REQUIRED_MESSAGE;
			return;
		}

		try {
			await accept.mutateAsync({
				accept_terms: true,
				terms_version: legal.terms_version,
				acceptable_use_version: legal.acceptable_use_version
			});
		} catch (error) {
			if (isOutdatedLegalVersion(error)) {
				checked = false;
				void client.invalidateQueries({ queryKey: queryKeys.auth.options });
			}
			const fieldMessage = legalConsentError(error);
			if (fieldMessage) consentError = fieldMessage;
			else generalError = getErrorMessage(error, 'Persetujuan belum tersimpan. Coba lagi.');
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Persetujuan')}</title>
</svelte:head>

<AuthSplitLayout
	title="Satu langkah lagi"
	description="Sebelum memakai Sakala, baca dan setujui dokumen berikut."
>
	<div class="space-y-6">
		{#if options.isPending}
			<div class="skeleton h-32" role="status" aria-label="Memuat dokumen"></div>
		{:else if !legal}
			<div class="space-y-3" role="alert">
				<p class="text-sm text-foreground">{LEGAL_VERSIONS_UNAVAILABLE_MESSAGE}</p>
				<Button variant="secondary" disabled={options.isFetching} onclick={() => options.refetch()}>
					{options.isFetching ? 'Memuat...' : 'Coba lagi'}
				</Button>
			</div>
		{:else}
			<form class="space-y-6" onsubmit={handleSubmit} novalidate>
				<LegalConsentField
					id="legal-accept"
					bind:checked
					error={consentError}
					disabled={accept.isPending}
					onchange={() => (consentError = '')}
				/>

				{#if generalError}
					<p class="text-sm text-error-dark" role="alert">{generalError}</p>
				{/if}

				<Button type="submit" size="lg" class="w-full" disabled={accept.isPending}>
					{accept.isPending ? 'Menyimpan...' : 'Setuju dan lanjutkan'}
				</Button>
			</form>
		{/if}

		<!-- Nobody has to agree first in order to leave: the API keeps both of these open. -->
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
			<a
				href={resolve('/settings')}
				class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
			>
				Unduh data atau hapus akun
			</a>
			<Button variant="link" disabled={logout.isPending} onclick={() => logout.mutate()}>
				Keluar
			</Button>
		</div>
	</div>
</AuthSplitLayout>
