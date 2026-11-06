<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { currentUserQuery } from '$lib/features/auth/queries';
	import {
		isValidInternalPath,
		setLastLoginProvider,
		clearPendingOAuthProvider,
		redirectToGithubAuth
	} from '$lib/features/auth/utils/oauth';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AuthStatusScreen from './AuthStatusScreen.svelte';
	import { ApiError, NetworkError } from '$lib/api/errors';

	const hasError = $derived(Boolean(page.url.searchParams.get('error')));
	const errorParam = $derived(page.url.searchParams.get('error'));
	const userQuery = currentUserQuery(() => !hasError);

	const isRetryableError = $derived(
		userQuery.error instanceof NetworkError ||
			(userQuery.error instanceof ApiError && !userQuery.error.isUnauthenticated)
	);

	$effect(() => {
		if (errorParam) {
			clearPendingOAuthProvider();
			localStorage.removeItem('return_url');
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
				return 'Terjadi kesalahan koneksi atau sesi telah kedaluwarsa.';
		}
	}
</script>

{#if errorParam}
	<AuthStatusScreen
		tone="error"
		title="Gagal masuk"
		description={getErrorMessage(errorParam)}
		focusHeading
	>
		<Button size="lg" class="w-full" onclick={() => redirectToGithubAuth(null)}>Coba lagi</Button>
		<Button href={resolve('/login')} variant="secondary" size="lg" class="w-full">
			Masuk dengan cara lain
		</Button>
	</AuthStatusScreen>
{:else if userQuery.isPending || userQuery.isLoading}
	<main
		id="main-content"
		tabindex="-1"
		class="flex min-h-screen flex-col items-center justify-center gap-6 p-4 outline-none"
	>
		<SakalaLogo class="h-10" />
		<div class="flex items-center gap-3 text-muted">
			<div
				class="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
			<h1 class="text-sm font-medium font-sans">Memverifikasi sesimu...</h1>
		</div>
	</main>
{:else if userQuery.isError}
	<AuthStatusScreen
		tone="error"
		title={userQuery.error instanceof NetworkError
			? 'Koneksi terganggu'
			: userQuery.error instanceof ApiError && userQuery.error.isServerError
				? 'Terjadi kesalahan server'
				: isRetryableError
					? 'Gagal memverifikasi sesi'
					: 'Autentikasi gagal'}
		description={userQuery.error instanceof NetworkError
			? 'Gagal terhubung ke server. Periksa koneksi internet kamu dan coba verifikasi ulang.'
			: isRetryableError
				? 'Sesi tidak dapat diverifikasi karena kendala sementara. Silakan coba lagi.'
				: 'Sesi tidak dapat diverifikasi atau telah kedaluwarsa. Silakan masuk ulang.'}
		focusHeading
	>
		{#if isRetryableError}
			<Button size="lg" class="w-full" onclick={() => userQuery.refetch()}>Coba lagi</Button>
		{/if}
		<Button
			href={resolve('/login')}
			variant={isRetryableError ? 'secondary' : 'primary'}
			size="lg"
			class="w-full"
		>
			Kembali ke halaman masuk
		</Button>
	</AuthStatusScreen>
{/if}
