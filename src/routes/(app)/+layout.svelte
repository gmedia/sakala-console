<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { ApiError, NetworkError } from '$lib/api/errors';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import LoadingSkeleton from '$lib/components/feedback/LoadingSkeleton.svelte';
	import { CellSignalSlashIcon, WarningIcon, ArrowsClockwiseIcon } from 'phosphor-svelte';

	let { children } = $props();

	const currentUser = useCurrentUser();

	$effect(() => {
		if (currentUser.isError) {
			const err = currentUser.error;
			if (err instanceof ApiError && err.isUnauthenticated) {
				const returnTo = encodeURIComponent($page.url.pathname + $page.url.search);
				goto(resolve(`/login?returnTo=${returnTo}`), { replaceState: true });
			}
		}
	});

	function getErrorConfig(error: unknown) {
		if (error instanceof NetworkError) {
			return {
				title: 'Tidak ada koneksi internet',
				description:
					'Sakala butuh koneksi internet buat memuat data project dan status deploymentmu. Cek koneksi kamu lalu coba lagi.',
				icon: CellSignalSlashIcon,
				iconClass: 'text-error-base',
				iconBackgroundClass: 'bg-[#F1F3F2]',
				statusIndicator: 'Terputus dari sakala.dev',
				statusIndicatorClass: 'text-warning-base',
				buttonText: 'Coba lagi',
				onRetry: () => currentUser.refetch()
			};
		}

		if (error instanceof ApiError && error.isForbidden) {
			return {
				title: 'Anda tidak memiliki akses',
				description:
					'Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin jika ini keliru.',
				icon: WarningIcon,
				iconClass: 'text-error-base',
				iconBackgroundClass: 'bg-error/20'
			};
		}

		if (error instanceof ApiError && error.isCsrfExpired) {
			return {
				title: 'Sesi kedaluwarsa',
				description: 'Sesi Anda sudah tidak berlaku. Muat ulang halaman untuk melanjutkan.',
				icon: ArrowsClockwiseIcon,
				iconClass: 'text-muted',
				iconBackgroundClass: 'bg-muted/10',
				buttonIcon: ArrowsClockwiseIcon,
				buttonText: 'Muat ulang halaman',
				onRetry: () => window.location.reload()
			};
		}

		return {
			title: 'Server sedang bermasalah',
			iconText: 'Error 500',
			description:
				'Ada gangguan di sisi server Sakala. Ini bukan karena kesalahanmu, tim kami sudah otomatis diberi tahu dan sedang menanganinya.',
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
	<div class="flex min-h-screen items-center justify-center">
		<LoadingSkeleton />
	</div>
{:else if currentUser.isError}
	{#if currentUser.error instanceof ApiError && currentUser.error.isUnauthenticated}
		<div class="min-h-screen"></div>
	{:else}
		{@const errorConfig = getErrorConfig(currentUser.error)}
		<div class="flex min-h-screen items-center justify-center p-4">
			<ErrorBlock {...errorConfig} onRetry={errorConfig.onRetry} />
		</div>
	{/if}
{:else if currentUser.isSuccess}
	<AppShell>
		{@render children()}
	</AppShell>
{/if}
