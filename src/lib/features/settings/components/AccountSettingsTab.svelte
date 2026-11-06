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

<div class="space-y-6">
	<section
		aria-labelledby="email-card-title"
		class="rounded-2xl border border-border/70 bg-white p-6 shadow-xs space-y-4"
	>
		<div>
			<h3 id="email-card-title" class="font-sans text-base font-semibold text-foreground">Email</h3>
			<p class="mt-0.5 font-sans text-xs text-muted">
				Alamat email dipakai untuk login dan notifikasi penting.
			</p>
		</div>

		<p class="font-sans text-sm text-foreground">
			Email saat ini: <strong class="font-semibold">{user?.email}</strong>
		</p>

		{#if user?.pending_email && availability.emailActionsAvailable}
			<div class="rounded-xl bg-primary-50 p-4" role="status">
				<p class="font-sans text-sm font-semibold text-primary-dark">Cek email baru</p>
				<p class="mt-1 font-sans text-xs text-foreground">
					Buka tautan konfirmasi yang kami kirim ke <strong>{user.pending_email}</strong>. Emailmu
					tetap {user.email} sampai tautan itu dibuka. Kalau tidak ada email masuk, cek folder spam, atau
					alamat itu mungkin sudah dipakai akun lain.
				</p>
			</div>
		{/if}

		{#if availability.isLoading}
			<div
				class="h-24 rounded-xl bg-zinc-100 motion-safe:animate-pulse"
				role="progressbar"
				aria-label="Memuat pilihan ganti email"
			></div>
		{:else if availability.emailDeliveryOff}
			<p class="font-sans text-xs text-muted" role="status">{EMAIL_CHANGE_UNAVAILABLE_MESSAGE}</p>
		{:else if hasPassword}
			<form class="space-y-3" onsubmit={handleEmailSubmit} novalidate>
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
					placeholder="Masukkan kata sandi saat ini"
					hint="Dipakai untuk memastikan ini memang kamu."
					bind:value={emailPassword}
					error={emailErrors.currentPassword}
				/>
				{#if emailErrors.general}
					<p class="font-sans text-xs text-error-base" role="alert">{emailErrors.general}</p>
				{/if}
				<Button
					type="submit"
					disabled={!canSubmitEmail}
					class="rounded-xl border-primary-dark bg-primary-dark px-5 py-2.5 font-sans text-sm shadow-xs hover:bg-primary-dark/90"
				>
					{emailChange.isPending ? 'Mengirim...' : 'Ubah Email'}
				</Button>
			</form>
		{:else}
			<p class="font-sans text-xs text-muted">
				Akunmu masuk lewat GitHub atau Google dan belum punya kata sandi. Buat kata sandi dulu di
				bawah, baru kamu bisa mengganti email.
			</p>
		{/if}
	</section>

	<section
		aria-labelledby="password-card-title"
		class="rounded-2xl border border-border/70 bg-white p-6 shadow-xs space-y-6"
	>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h3 id="password-card-title" class="font-sans text-base font-semibold text-foreground">
					{hasPassword ? 'Ubah Kata Sandi' : 'Buat Kata Sandi'}
				</h3>
				<p class="mt-0.5 font-sans text-xs text-muted">
					{hasPassword
						? 'Kata sandi baru mengakhiri sesi di perangkat lain.'
						: 'Dengan kata sandi, kamu juga bisa masuk tanpa GitHub atau Google.'}
				</p>
			</div>
			<button
				type="button"
				aria-expanded={isPasswordOpen}
				aria-controls="password-form"
				onclick={() => (isPasswordOpen = !isPasswordOpen)}
				class="flex min-h-6 shrink-0 items-center gap-1 font-sans text-sm font-semibold text-primary-dark hover:underline cursor-pointer"
			>
				{isPasswordOpen ? 'Tutup' : hasPassword ? 'Ubah' : 'Buat'}
				{#if isPasswordOpen}
					<CaretUp size={16} aria-hidden="true" />
				{:else}
					<CaretDown size={16} aria-hidden="true" />
				{/if}
			</button>
		</div>

		{#if passwordSuccess}
			<p class="font-sans text-sm text-primary-dark" role="status">{passwordSuccess}</p>
		{/if}

		{#if isPasswordOpen}
			<form id="password-form" class="space-y-5" onsubmit={handlePasswordSubmit} novalidate>
				{#if hasPassword}
					<FormField
						id="current-password"
						label="Kata sandi saat ini"
						type="password"
						autocomplete="current-password"
						placeholder="Masukkan kata sandi saat ini"
						bind:value={currentPassword}
						error={passwordErrors.currentPassword}
					/>
				{/if}
				<FormField
					id="new-password"
					label="Kata sandi baru"
					type="password"
					autocomplete="new-password"
					placeholder="Masukkan kata sandi baru"
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
					placeholder="Masukkan ulang kata sandi baru"
					bind:value={confirmPassword}
					error={passwordErrors.confirmation ??
						(passwordMismatch ? 'Konfirmasi kata sandi tidak cocok.' : undefined)}
				/>
				{#if passwordErrors.general}
					<p class="font-sans text-xs text-error-base" role="alert">{passwordErrors.general}</p>
				{/if}
				<div class="pt-2">
					<Button
						type="submit"
						disabled={!canSubmitPassword}
						class="w-full rounded-xl border-primary-dark bg-primary-dark py-3 font-sans text-sm shadow-xs hover:bg-primary-dark/90"
					>
						{#if passwordChange.isPending}
							Menyimpan...
						{:else}
							{hasPassword ? 'Perbarui Kata Sandi' : 'Buat Kata Sandi'}
						{/if}
					</Button>
				</div>
			</form>
		{/if}
	</section>
</div>
