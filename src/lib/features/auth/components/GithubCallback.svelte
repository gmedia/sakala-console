<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { currentUserQuery } from '$lib/features/auth/queries';
	import {
		isValidInternalPath,
		setLastLoginProvider,
		clearPendingOAuthProvider
	} from '$lib/features/auth/utils/oauth';
	import { ApiError, NetworkError } from '$lib/api/errors';

	const hasError = $derived(Boolean(page.url.searchParams.get('error')));
	const errorParam = $derived(page.url.searchParams.get('error'));
	const userQuery = currentUserQuery(() => !hasError);

	const isRetryableError = $derived(
		userQuery.error instanceof NetworkError ||
			(userQuery.error instanceof ApiError && !userQuery.error.isUnauthenticated)
	);

	let errorHeading: HTMLHeadingElement | undefined = $state();
	let queryErrorHeading: HTMLHeadingElement | undefined = $state();

	$effect(() => {
		if (errorParam) {
			clearPendingOAuthProvider();
			localStorage.removeItem('return_url');
			if (errorHeading) {
				const el = errorHeading;
				setTimeout(() => el.focus(), 0);
			}
		}
	});

	$effect(() => {
		if (userQuery.isError && queryErrorHeading) {
			const el = queryErrorHeading;
			setTimeout(() => el.focus(), 0);
		}
	});

	$effect(() => {
		if (userQuery.isSuccess && userQuery.data) {
			const user = userQuery.data;
			setLastLoginProvider('github');
			clearPendingOAuthProvider();
			const savedReturnUrl = localStorage.getItem('return_url');
			if (savedReturnUrl) {
				localStorage.removeItem('return_url');
			}
			if (savedReturnUrl && isValidInternalPath(savedReturnUrl)) {
				goto(resolve(savedReturnUrl as '/'), { replaceState: true });
				return;
			}
			if (user.onboarding_completed_at) {
				goto(resolve('/projects'), { replaceState: true });
			} else {
				goto(resolve('/onboarding'), { replaceState: true });
			}
		}
	});

	function getErrorMessage(code: string) {
		switch (code) {
			case 'github_access_denied':
				return 'Kamu membatalkan izin masuk dengan GitHub.';
			case 'github_email_conflict':
				return 'Email GitHub kamu sudah terdaftar dengan metode login lain.';
			case 'github_email_unavailable':
				return 'Email publik tidak ditemukan di akun GitHub kamu.';
			case 'github_invalid_state':
				return 'Sesi login tidak valid. Silakan coba lagi.';
			case 'github_provider_failure':
				return 'Gagal terhubung dengan GitHub. Silakan coba beberapa saat lagi.';
			default:
				return 'Terjadi kesalahan koneksi atau sesi telah kadaluwarsa.';
		}
	}
</script>

<main
	id="main-content"
	tabindex="-1"
	class="min-h-screen flex flex-col items-center justify-center p-4 outline-none"
>
	{#if errorParam}
		<div
			class="max-w-md w-full bg-error-50 border border-error/30 text-error p-4 rounded-lg space-y-3"
		>
			<h1 class="font-semibold text-lg focus:outline-none" tabindex="-1" bind:this={errorHeading}>
				Gagal Masuk
			</h1>
			<p class="text-sm">
				{getErrorMessage(errorParam)}
			</p>
			<a
				href={resolve('/login')}
				class="inline-block bg-error text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-error-dark"
			>
				Coba Lagi
			</a>
		</div>
	{:else if userQuery.isPending || userQuery.isLoading}
		<div class="flex items-center gap-3 text-zinc-600">
			<div
				class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"
			></div>
			<h1 class="text-sm font-medium">Memverifikasi sesimu...</h1>
		</div>
	{:else if userQuery.isError}
		<div
			class="max-w-md w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg space-y-3"
		>
			<h1
				class="font-semibold text-lg focus:outline-none"
				tabindex="-1"
				bind:this={queryErrorHeading}
			>
				{#if userQuery.error instanceof NetworkError}
					Koneksi Terganggu
				{:else if userQuery.error instanceof ApiError && userQuery.error.isServerError}
					Terjadi Kesalahan Server
				{:else if isRetryableError}
					Gagal Memverifikasi Sesi
				{:else}
					Autentikasi Gagal
				{/if}
			</h1>

			<p class="text-sm">
				{#if userQuery.error instanceof NetworkError}
					Gagal terhubung ke server. Periksa koneksi internet kamu dan coba verifikasi ulang.
				{:else if isRetryableError}
					Sesi tidak dapat diverifikasi karena kendala sementara. Silakan coba lagi.
				{:else}
					Sesi tidak dapat diverifikasi atau telah kadaluwarsa. Silakan masuk ulang.
				{/if}
			</p>

			{#if isRetryableError}
				<button
					type="button"
					onclick={() => userQuery.refetch()}
					class="inline-block bg-warning text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-warning-dark cursor-pointer"
				>
					Coba Lagi
				</button>
			{:else}
				<a
					href={resolve('/login')}
					class="inline-block bg-warning text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-warning-dark"
				>
					Kembali ke halaman masuk
				</a>
			{/if}
		</div>
	{/if}
</main>
