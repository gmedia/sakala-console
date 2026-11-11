<script lang="ts">
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ApiError, NetworkError } from '$lib/api/errors';
	import { isRateLimitError, rateLimitWait } from '$lib/api/rate-limit';
	import {
		getPendingOAuthProvider,
		setLastLoginProvider,
		clearPendingOAuthProvider,
		loginPathWithReturnTo
	} from '$lib/features/auth/utils/oauth';
	import { noteSessionEnded, rememberSession } from '$lib/features/auth/session-notice';
	import { getOnboardingRedirect } from '$lib/features/auth/onboarding-redirect';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import LoadingSkeleton from '$lib/components/feedback/LoadingSkeleton.svelte';
	import LegalAcceptanceScreen from './LegalAcceptanceScreen.svelte';
	import CellSignalSlashIcon from 'phosphor-svelte/lib/CellSignalSlashIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const currentUser = useCurrentUser();

	// Accepting comes first. Onboarding follows once the user is refetched after accepting.
	const onboardingRedirect = $derived(
		currentUser.data && !currentUser.data.legal_acceptance_required
			? getOnboardingRedirect(currentUser.data, page.url.pathname)
			: null
	);
	// On the way to onboarding the app shell does not render, so it never flashes after login. The
	// other way stays mounted: finishing onboarding navigates on from the page's own onSuccess, which
	// TanStack Query skips once the component is gone.
	const holdForOnboarding = $derived(onboardingRedirect === '/onboarding');

	$effect(() => {
		if (currentUser.isError) {
			const err = currentUser.error;
			if (err instanceof ApiError && err.isUnauthenticated) {
				noteSessionEnded();
				clearPendingOAuthProvider();
				goto(resolve(loginPathWithReturnTo(page.url) as '/login'), { replaceState: true });
			}
		}
		if (currentUser.isSuccess && currentUser.data) {
			rememberSession();
			const pendingProvider = getPendingOAuthProvider();
			if (pendingProvider) {
				setLastLoginProvider(pendingProvider);
				clearPendingOAuthProvider();
			}
			if (onboardingRedirect) {
				goto(resolve(onboardingRedirect), { replaceState: true });
			}
		}
	});

	// Settings stays open: exporting data and deleting the account do not wait for an acceptance.
	const needsLegalAcceptance = $derived(
		currentUser.data?.legal_acceptance_required === true &&
			!page.url.pathname.startsWith('/settings')
	);

	// The limit passes by itself, so this waits it out instead of asking the user to reload into it.
	let retryIn = $state(0);
	$effect(() => {
		const wait = rateLimitWait(currentUser.error);
		if (wait === undefined) {
			retryIn = 0;
			return;
		}
		const deadline = Date.now() + wait;
		retryIn = Math.ceil(wait / 1_000);
		const timer = setInterval(() => {
			retryIn = Math.max(Math.ceil((deadline - Date.now()) / 1_000), 0);
			if (retryIn === 0) {
				clearInterval(timer);
				void currentUser.refetch();
			}
		}, 1_000);
		return () => clearInterval(timer);
	});

	function formatWait(seconds: number): string {
		if (seconds <= 0) return 'beberapa saat';
		return seconds < 60 ? `${seconds} detik` : `${Math.ceil(seconds / 60)} menit`;
	}

	function getErrorConfig(error: unknown) {
		if (isRateLimitError(error)) {
			return {
				title: 'Terlalu banyak permintaan',
				description: `Server membatasi jumlah permintaan dari akunmu untuk sementara. Ini bukan masalah pada akunmu. Halaman ini mencoba lagi otomatis dalam ${formatWait(retryIn)}.`,
				icon: ClockIcon,
				iconClass: 'text-muted',
				iconBackgroundClass: 'bg-muted/10',
				buttonText: 'Coba sekarang',
				onRetry: () => currentUser.refetch()
			};
		}

		if (error instanceof NetworkError) {
			return {
				title: 'Tidak ada koneksi internet',
				description:
					'Sakala butuh koneksi internet buat memuat data proyek dan status deploymentmu. Cek koneksi kamu lalu coba lagi.',
				icon: CellSignalSlashIcon,
				iconClass: 'text-error-base',
				iconBackgroundClass: 'bg-background-soft',
				statusIndicator: 'Terputus dari sakala.dev',
				statusIndicatorClass: 'text-warning-dark',
				buttonText: 'Coba lagi',
				onRetry: () => currentUser.refetch()
			};
		}

		if (error instanceof ApiError && error.isForbidden) {
			return {
				title: 'Kamu tidak memiliki akses',
				description:
					'Akunmu tidak memiliki izin untuk membuka halaman ini. Hubungi admin Sakala kalau ini keliru, atau masuk dengan akun lain.',
				icon: WarningIcon,
				iconClass: 'text-error-base',
				iconBackgroundClass: 'bg-error/20',
				buttonText: 'Coba lagi',
				onRetry: () => currentUser.refetch(),
				links: [{ label: 'Masuk dengan akun lain', href: resolve('/login') }]
			};
		}

		if (error instanceof ApiError && error.isCsrfExpired) {
			return {
				title: 'Sesi kedaluwarsa',
				description: 'Sesimu sudah tidak berlaku. Muat ulang halaman untuk melanjutkan.',
				icon: ArrowsClockwiseIcon,
				iconClass: 'text-muted',
				iconBackgroundClass: 'bg-muted/10',
				buttonIcon: ArrowsClockwiseIcon,
				buttonText: 'Muat ulang halaman',
				onRetry: () => window.location.reload()
			};
		}

		return {
			title:
				error instanceof ApiError && error.isServerError
					? 'Server sedang bermasalah'
					: 'Gagal memuat akunmu',
			iconText:
				error instanceof ApiError && error.isServerError ? `Error ${error.status}` : undefined,
			description:
				error instanceof ApiError && error.isServerError
					? 'Ada gangguan di sisi server Sakala. Ini bukan karena kesalahanmu. Muat ulang halaman beberapa saat lagi.'
					: 'Sakala belum bisa memuat data akunmu. Muat ulang halaman untuk mencoba lagi.',
			icon: WarningIcon,
			iconClass: 'text-error-base',
			iconBackgroundClass: 'bg-error/10',
			buttonIcon: ArrowsClockwiseIcon,
			buttonText: 'Muat ulang halaman',
			onRetry: () => window.location.reload()
		};
	}
</script>

{#if currentUser.isPending}
	<main
		id="main-content"
		tabindex="-1"
		class="flex min-h-screen items-center justify-center outline-none"
	>
		<LoadingSkeleton />
	</main>
{:else if currentUser.isError && !(isRateLimitError(currentUser.error) && currentUser.data)}
	{#if currentUser.error instanceof ApiError && currentUser.error.isUnauthenticated}
		<div class="min-h-screen"></div>
	{:else}
		{@const errorConfig = getErrorConfig(currentUser.error)}
		<main
			id="main-content"
			tabindex="-1"
			class="flex min-h-screen items-center justify-center p-4 outline-none"
		>
			<ErrorBlock {...errorConfig} headingTag="h1" />
		</main>
	{/if}
{:else if needsLegalAcceptance}
	<LegalAcceptanceScreen />
{:else if holdForOnboarding}
	<main
		id="main-content"
		tabindex="-1"
		class="flex min-h-screen items-center justify-center outline-none"
	>
		<LoadingSkeleton />
	</main>
{:else if currentUser.data}
	{@render children()}
{/if}
