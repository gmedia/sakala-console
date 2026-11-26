<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { tick } from 'svelte';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { getErrorMessage, getFieldError } from '$lib/api/errors';
	import { useChangePassword, useRequestEmailChange } from '$lib/features/auth/mutations';
	import { useAuthOptions, useCurrentUser } from '$lib/features/auth/queries';
	import {
		EMAIL_CHANGE_UNAVAILABLE_MESSAGE,
		resolveAuthAvailability
	} from '$lib/features/auth/availability';

	import AccountDataSection from './AccountDataSection.svelte';

	const MIN_PASSWORD_LENGTH = 8;

	const currentUserQuery = useCurrentUser();
	const user = $derived(currentUserQuery.data);
	const hasPassword = $derived(user?.has_password ?? true);

	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));

	const emailChange = useRequestEmailChange();
	const passwordChange = useChangePassword();

	let newEmail = $state('');
	let emailPassword = $state('');
	let emailErrors = $state<{ email?: string; currentPassword?: string; general?: string }>({});

	let isPasswordOpen = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordErrors = $state<{
		currentPassword?: string;
		password?: string;
		confirmation?: string;
		general?: string;
	}>({});
	let passwordSuccess = $state<string | null>(null);

	const emailFormatValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()));
	const canSubmitEmail = $derived(
		hasPassword &&
			emailFormatValid &&
			newEmail.trim().toLowerCase() !== user?.email.toLowerCase() &&
			emailPassword.length > 0 &&
			!emailChange.isPending
	);

	const newPasswordTooShort = $derived(
		newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH
	);
	const passwordMismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword);
	const canSubmitPassword = $derived(
		(!hasPassword || currentPassword.length > 0) &&
			newPassword.length >= MIN_PASSWORD_LENGTH &&
			newPassword === confirmPassword &&
			!passwordChange.isPending
	);

	async function focusField(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	async function handleEmailSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmitEmail) return;
		emailErrors = {};

		try {
			await emailChange.mutateAsync({ email: newEmail.trim(), current_password: emailPassword });
			newEmail = '';
			emailPassword = '';
		} catch (error) {
			const email = getFieldError(error, 'email');
			const password = getFieldError(error, 'current_password');
			emailErrors = {
				email,
				currentPassword: password,
				general:
					email || password ? undefined : getErrorMessage(error, 'Gagal meminta ganti email.')
			};
			if (password) void focusField('email-current-password');
			else if (email) void focusField('new-email');
		}
	}

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmitPassword) return;
		const wasFirstPassword = !hasPassword;
		passwordErrors = {};
		passwordSuccess = null;

		try {
			await passwordChange.mutateAsync({
				...(hasPassword ? { current_password: currentPassword } : {}),
				password: newPassword,
				password_confirmation: confirmPassword
			});
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			isPasswordOpen = false;
			passwordSuccess = wasFirstPassword
				? 'Kata sandi sudah dibuat. Sekarang kamu juga bisa masuk dengan email dan kata sandi.'
				: 'Kata sandi sudah diganti. Sesi di perangkat lain akan berakhir.';
		} catch (error) {
			const current = getFieldError(error, 'current_password');
			const password = getFieldError(error, 'password');
			const confirmation = getFieldError(error, 'password_confirmation');
			const hasFieldError = Boolean(current || password || confirmation);
			passwordErrors = {
				currentPassword: current,
				password,
				confirmation,
				general: hasFieldError
					? undefined
					: getErrorMessage(error, 'Gagal menyimpan kata sandi. Coba lagi.')
			};
			if (current) void focusField('current-password');
			else if (password) void focusField('new-password');
			else if (confirmation) void focusField('confirm-password');
		}
	}
</script>

<!-- Deleting the account is the page's `after`, so it stays last below the panel on a phone. -->
<div class="flex flex-col gap-4">
	<section aria-labelledby="email-card-title" class="surface-card flex flex-col gap-4 p-4 sm:p-6">
		<div class="flex flex-col gap-1">
			<h2 id="email-card-title" class="font-sans text-base font-semibold text-foreground">Email</h2>
			<p class="text-sm text-muted">
				Sekarang <strong class="font-semibold wrap-anywhere text-foreground">{user?.email}</strong>
			</p>
		</div>

		{#if user?.pending_email && availability.emailActionsAvailable}
			<div class="flex flex-col gap-1 rounded-card bg-primary-50 p-4" role="status">
				<p class="text-sm font-semibold text-primary-dark">Cek email baru</p>
				<p class="text-sm text-foreground">
					Buka tautan yang kami kirim ke <strong class="wrap-anywhere">{user.pending_email}</strong
					>; sampai itu, emailmu tetap {user.email}.
				</p>
				<p class="text-sm text-foreground">
					Tidak ada email? Cek folder spam, atau alamat itu sudah dipakai akun lain.
				</p>
			</div>
		{/if}

		{#if availability.isLoading}
			<div class="skeleton h-24" role="progressbar" aria-label="Memuat pilihan ganti email"></div>
		{:else if availability.emailDeliveryOff}
			<p class="text-sm text-muted" role="status">{EMAIL_CHANGE_UNAVAILABLE_MESSAGE}</p>
		{:else if hasPassword}
			<form class="flex flex-col gap-4" onsubmit={handleEmailSubmit} novalidate>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FormField
						id="new-email"
						label="Email baru"
						type="email"
						autocomplete="email"
						placeholder="nama@contoh.com"
						bind:value={newEmail}
						error={emailErrors.email}
					/>
					<FormField
						id="email-current-password"
						label="Kata sandi saat ini"
						type="password"
						autocomplete="current-password"
						bind:value={emailPassword}
						error={emailErrors.currentPassword}
					/>
				</div>
				<div class="flex flex-wrap items-center justify-end gap-3">
					{#if emailErrors.general}
						<p class="mr-auto text-sm text-error-base" role="alert">{emailErrors.general}</p>
					{/if}
					<Button type="submit" disabled={!canSubmitEmail}>
						{emailChange.isPending ? 'Mengirim...' : 'Ubah email'}
					</Button>
				</div>
			</form>
		{:else}
			<p class="text-sm text-muted">Buat kata sandi dulu di bawah, baru email bisa diganti.</p>
		{/if}
	</section>

	<section
		aria-labelledby="password-card-title"
		class="surface-card flex flex-col gap-4 p-4 sm:p-6"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-1">
				<h2 id="password-card-title" class="font-sans text-base font-semibold text-foreground">
					{hasPassword ? 'Ubah kata sandi' : 'Buat kata sandi'}
				</h2>
				<p class="text-sm text-muted">
					{hasPassword
						? 'Kata sandi baru mengakhiri sesi di perangkat lain.'
						: 'Supaya kamu juga bisa masuk tanpa GitHub atau Google.'}
				</p>
			</div>
			<Button
				variant="link"
				aria-expanded={isPasswordOpen}
				aria-controls="password-form"
				onclick={() => (isPasswordOpen = !isPasswordOpen)}
			>
				{isPasswordOpen ? 'Tutup' : hasPassword ? 'Ubah' : 'Buat'}
				{#if isPasswordOpen}
					<CaretUp size={16} aria-hidden="true" />
				{:else}
					<CaretDown size={16} aria-hidden="true" />
				{/if}
			</Button>
		</div>

		{#if passwordSuccess}
			<p class="text-sm text-primary-dark" role="status">{passwordSuccess}</p>
		{/if}

		{#if isPasswordOpen}
			<form
				id="password-form"
				class="flex flex-col gap-4"
				onsubmit={handlePasswordSubmit}
				novalidate
			>
				{#if hasPassword}
					<FormField
						id="current-password"
						label="Kata sandi saat ini"
						type="password"
						autocomplete="current-password"
						bind:value={currentPassword}
						error={passwordErrors.currentPassword}
					/>
				{/if}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FormField
						id="new-password"
						label="Kata sandi baru"
						type="password"
						autocomplete="new-password"
						hint="Minimal 8 karakter."
						bind:value={newPassword}
						error={passwordErrors.password ??
							(newPasswordTooShort ? 'Kata sandi baru minimal 8 karakter.' : undefined)}
					/>
					<FormField
						id="confirm-password"
						label="Konfirmasi kata sandi baru"
						type="password"
						autocomplete="new-password"
						bind:value={confirmPassword}
						error={passwordErrors.confirmation ??
							(passwordMismatch ? 'Konfirmasi kata sandi tidak cocok.' : undefined)}
					/>
				</div>
				<div class="flex flex-wrap items-center justify-end gap-3">
					{#if passwordErrors.general}
						<p class="mr-auto text-sm text-error-base" role="alert">{passwordErrors.general}</p>
					{/if}
					<Button type="submit" disabled={!canSubmitPassword}>
						{#if passwordChange.isPending}
							Menyimpan...
						{:else}
							{hasPassword ? 'Perbarui kata sandi' : 'Buat kata sandi'}
						{/if}
					</Button>
				</div>
			</form>
		{/if}
	</section>

	<AccountDataSection />
</div>
