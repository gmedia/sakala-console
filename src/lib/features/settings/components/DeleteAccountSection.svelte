<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import {
		ApiError,
		getErrorMessage,
		getFieldError,
		REAUTHENTICATION_REQUIRED
	} from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { useDeleteAccount } from '$lib/features/auth/mutations';
	import { useAuthOptions, useCurrentUser } from '$lib/features/auth/queries';
	import { redirectToGithubAuth, redirectToGoogleAuth } from '$lib/features/auth/utils/oauth';
	import { createPilotLimitsQuery } from '$lib/features/projects/queries';

	const currentUser = useCurrentUser();
	const authOptions = useAuthOptions();
	const limits = createPilotLimitsQuery();
	const deleteAccount = useDeleteAccount();

	const user = $derived(currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');
	const hasPassword = $derived(user?.has_password ?? true);
	const retentionDays = $derived(limits.data?.deleted_project_retention_days);
	const providers = $derived(authOptions.data?.providers);

	let open = $state(false);
	let email = $state('');
	let password = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let generalError = $state('');
	let needsReauthentication = $state(false);

	const canDelete = $derived(
		email.trim().toLowerCase() === user?.email.toLowerCase() &&
			(!hasPassword || password.length > 0)
	);

	function reset() {
		email = '';
		password = '';
		emailError = '';
		passwordError = '';
		generalError = '';
		needsReauthentication = false;
	}

	function close() {
		open = false;
		reset();
	}

	async function handleConfirm() {
		if (!canDelete || deleteAccount.isPending) return;
		emailError = '';
		passwordError = '';
		generalError = '';
		needsReauthentication = false;

		try {
			await deleteAccount.mutateAsync({
				email: email.trim(),
				...(hasPassword ? { current_password: password } : {})
			});
		} catch (error) {
			emailError = getFieldError(error, 'email') ?? '';
			passwordError = getFieldError(error, 'current_password') ?? '';
			needsReauthentication = error instanceof ApiError && error.code === REAUTHENTICATION_REQUIRED;
			if (!emailError && !passwordError) {
				generalError = getErrorMessage(error, 'Akun belum bisa dihapus. Coba lagi.');
			}
		}
	}
</script>

<section aria-labelledby="delete-account-title" class="surface-card space-y-4 p-6">
	<div>
		<h2 id="delete-account-title" class="font-sans text-base font-semibold text-foreground">
			Hapus akun
		</h2>
		{#if isAdmin}
			<p class="mt-1 text-sm text-foreground" data-testid="delete-account-admin">
				Akun admin tidak bisa dihapus sendiri, supaya Sakala tidak kehilangan satu-satunya orang
				yang bisa menangani laporan. Minta maintainer lain mencabut peran admin kamu dulu, lalu
				kembali ke sini.
			</p>
		{:else}
			<p class="mt-1 text-sm text-muted">
				Akun dan semua proyekmu dihapus, dan tindakan ini tidak bisa dibatalkan. Unduh salinan
				datamu dulu kalau masih perlu.
			</p>
		{/if}
	</div>

	{#if !isAdmin}
		<div class="flex justify-end">
			<Button
				variant="secondary"
				class="hover:border-error hover:text-error"
				onclick={() => (open = true)}
			>
				<Trash size={16} aria-hidden="true" />
				Hapus akun saya
			</Button>
		</div>
	{/if}
</section>

<Dialog
	{open}
	title="Hapus akunmu untuk selamanya?"
	class="max-w-lg"
	confirmLabel="Hapus akun saya"
	variant="destructive"
	initialFocus={() => document.getElementById('delete-account-email')}
	confirmDisabled={!canDelete}
	loading={deleteAccount.isPending}
	onConfirm={handleConfirm}
	onCancel={close}
>
	<ul class="list-outside list-disc space-y-1.5 pl-5 text-sm text-foreground">
		<li>Semua proyekmu berhenti melayani, dan alamatnya tidak bisa dipakai lagi.</li>
		<li>Environment variable semua proyek langsung dihapus.</li>
		<li data-testid="delete-account-retention">
			{#if retentionDays !== undefined}
				Data proyek lainnya tidak lagi terhubung ke akunmu, lalu dihapus permanen setelah {retentionDays}
				hari.
			{:else}
				Data proyek lainnya tidak lagi terhubung ke akunmu, lalu dihapus permanen setelah masa
				simpannya berakhir.
			{/if}
		</li>
		<li>Akun, notifikasi, masukan, dan sambungan GitHub atau Google di Sakala langsung dihapus.</li>
		<li>Akses GitHub App di sisi GitHub perlu kamu cabut sendiri.</li>
	</ul>

	<div class="mt-5 space-y-4">
		<FormField
			id="delete-account-email"
			label="Ketik email akunmu untuk konfirmasi"
			type="email"
			autocomplete="off"
			placeholder={user?.email}
			bind:value={email}
			error={emailError}
			disabled={deleteAccount.isPending}
		/>
		{#if hasPassword}
			<FormField
				id="delete-account-password"
				label="Kata sandi saat ini"
				type="password"
				autocomplete="current-password"
				placeholder="Masukkan kata sandi saat ini"
				bind:value={password}
				error={passwordError}
				disabled={deleteAccount.isPending}
			/>
		{:else}
			<p class="text-sm text-muted">
				Akunmu tanpa kata sandi, jadi Sakala bisa meminta kamu masuk ulang lewat GitHub atau Google
				dulu.
			</p>
		{/if}
	</div>

	{#if generalError}
		<p role="alert" class="mt-3 text-sm text-error-dark">{generalError}</p>
	{/if}

	{#if needsReauthentication}
		<div class="mt-3 flex flex-wrap gap-2">
			{#if providers?.github}
				<Button variant="secondary" onclick={() => redirectToGithubAuth('/settings')}>
					Masuk ulang lewat GitHub
				</Button>
			{/if}
			{#if providers?.google}
				<Button variant="secondary" onclick={() => redirectToGoogleAuth('/settings')}>
					Masuk ulang lewat Google
				</Button>
			{/if}
		</div>
	{/if}
</Dialog>
