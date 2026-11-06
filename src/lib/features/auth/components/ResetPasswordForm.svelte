<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import { useResetPassword } from '../mutations';

	const MIN_PASSWORD_LENGTH = 8;

	// Read once and kept only in memory. A refresh loses them on purpose: the page then asks for a
	// new link instead of keeping the token in storage.
	const token = page.url.searchParams.get('token');
	const email = page.url.searchParams.get('email');
	const hasLink = Boolean(token && email);

	onMount(() => {
		if (page.url.search) {
			void goto(resolve('/reset-password'), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	});

	const resetPassword = useResetPassword();

	let password = $state('');
	let confirmation = $state('');
	let errors = $state<{ password?: string; confirmation?: string; general?: string }>({});
	let linkRejected = $state(false);
	let isDone = $state(false);

	async function focusField(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (resetPassword.isPending || !token || !email) return;
		errors = {};

		if (password.length < MIN_PASSWORD_LENGTH) {
			errors = { password: 'Kata sandi baru minimal 8 karakter.' };
			void focusField('new-password');
			return;
		}
		if (password !== confirmation) {
			errors = { confirmation: 'Konfirmasi kata sandi tidak cocok.' };
			void focusField('confirm-password');
			return;
		}

		try {
			await resetPassword.mutateAsync({
				token,
				email,
				password,
				password_confirmation: confirmation
			});
			isDone = true;
		} catch (error) {
			const passwordError = getFieldError(error, 'password');
			const confirmationError = getFieldError(error, 'password_confirmation');
			linkRejected = error instanceof ApiError && error.code === 'invalid_reset_token';
			errors = {
				password: passwordError,
				confirmation: confirmationError,
				general:
					passwordError || confirmationError
						? undefined
						: getErrorMessage(error, 'Gagal menyimpan kata sandi. Coba lagi.')
			};
			if (passwordError) void focusField('new-password');
			else if (confirmationError) void focusField('confirm-password');
		}
	}
</script>

<div class="space-y-6">
	{#if isDone}
		<div class="space-y-3 rounded-control border border-primary/20 bg-primary-50 p-6" role="status">
			<p class="font-semibold text-primary">Kata sandi sudah diganti</p>
			<p class="text-sm text-foreground">Masuk dengan kata sandi barumu.</p>
			<Button href={resolve('/login')}>Masuk</Button>
		</div>
	{:else if !hasLink}
		<div class="space-y-3 rounded-control border border-error/30 bg-error-50 p-6" role="alert">
			<p class="text-sm text-error">
				Tautan reset ini tidak lengkap, atau halaman ini sudah dimuat ulang. Minta tautan baru
				supaya kamu bisa membuat kata sandi baru.
			</p>
			<a
				href={resolve('/forgot-password')}
				class="inline-block text-sm font-semibold text-primary-dark hover:underline"
			>
				Minta tautan baru
			</a>
		</div>
	{:else}
		<form class="space-y-4" onsubmit={handleSubmit} novalidate>
			{#if errors.general}
				<div
					class="space-y-1 rounded-control border border-error/30 bg-error-50 p-3 text-xs font-medium text-error"
					role="alert"
				>
					<p>{errors.general}</p>
					{#if linkRejected}
						<a
							href={resolve('/forgot-password')}
							class="inline-block font-semibold text-primary-dark hover:underline"
						>
							Minta tautan baru
						</a>
					{/if}
				</div>
			{/if}
			<FormField id="reset-email" label="Email" type="email" value={email ?? ''} readonly />
			<FormField
				id="new-password"
				label="Kata sandi baru"
				type="password"
				autocomplete="new-password"
				placeholder="Kata sandi baru"
				hint="Minimal 8 karakter."
				bind:value={password}
				error={errors.password}
			/>
			<FormField
				id="confirm-password"
				label="Konfirmasi kata sandi baru"
				type="password"
				autocomplete="new-password"
				placeholder="Ulangi kata sandi baru"
				bind:value={confirmation}
				error={errors.confirmation}
			/>
			<Button size="lg" class="w-full" type="submit" disabled={resetPassword.isPending}>
				{resetPassword.isPending ? 'Menyimpan...' : 'Simpan kata sandi'}
			</Button>
		</form>
	{/if}
</div>
