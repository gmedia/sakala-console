<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { currentUserQuery } from '$lib/features/auth/queries';

	const hasError = $derived(Boolean(page.url.searchParams.get('error')));
	const errorParam = $derived(page.url.searchParams.get('error'));
	const userQuery = currentUserQuery(() => !hasError);

	$effect(() => {
		if (userQuery.isSuccess && userQuery.data) {
			const user = userQuery.data;
			const returnUrl = localStorage.getItem('return_url');

			if (returnUrl) {
				localStorage.removeItem('return_url');
			}

			if (returnUrl && returnUrl.startsWith('/')) {
				goto(resolve(returnUrl as '/'), { replaceState: true });
				return;
			}

			if (user.onboarding_completed_at) {
				goto(resolve('/projects'), { replaceState: true });
			} else {
				goto(resolve('/onboarding'), { replaceState: true });
			}
		}
	});
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-4">
	{#if errorParam}
		<div
			class="max-w-md w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg space-y-3"
		>
			<h3 class="font-semibold text-lg">Gagal Masuk</h3>
			<p class="text-sm">
				{#if errorParam === 'access denied'}
					Anda membatalkan izin masuk dengan GitHub.
				{:else}
					Terjadi kesalahan koneksi atau sesi telah kadaluwarsa.
				{/if}
			</p>
			<a
				href={resolve('/login')}
				class="inline-block bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700"
			>
				Coba Lagi
			</a>
		</div>
	{:else if userQuery.isPending || userQuery.isLoading}
		<div class="flex items-center gap-3 text-zinc-600">
			<div
				class="w-5 h-5 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"
			></div>
			<span class="text-sm font-medium">Memverifikasi sesi Anda...</span>
		</div>
	{:else if userQuery.isError}
		<div
			class="max-w-md w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg space-y-3"
		>
			<h3 class="font-semibold text-lg">Autentikasi Gagal</h3>
			<p class="text-sm">Sesi tidak dapat diverifikasi. Silakan lakukan login ulang.</p>
			<a
				href={resolve('/login')}
				class="inline-block bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700"
			>
				Kembali ke Login
			</a>
		</div>
	{/if}
</div>

<div class="min-h-screen flex flex-col items-center justify-center p-4">
	{#if errorParam}
		<div
			class="max-w-md w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg space-y-3"
		>
			<h3 class="font-semibold text-lg">Gagal Masuk</h3>
			<p class="text-sm">
				{#if errorParam === 'access_denied'}
					Anda membatalkan izin masuk dengan GitHub.
				{:else}
					Terjadi kesalahan koneksi atau sesi telah kadaluwarsa.
				{/if}
			</p>
			<a
				href={resolve('/login')}
				class="inline-block bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700"
			>
				Coba Lagi
			</a>
		</div>
	{:else if userQuery.isPending || userQuery.isLoading}
		<div class="flex items-center gap-3 text-zinc-600">
			<div
				class="w-5 h-5 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"
			></div>
			<span class="text-sm font-medium">Memverifikasi sesi Anda...</span>
		</div>
	{:else if userQuery.isError}
		<div
			class="max-w-md w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg space-y-3"
		>
			<h3 class="font-semibold text-lg">Autentikasi Gagal</h3>
			<p class="text-sm">Sesi tidak dapat diverifikasi. Silakan lakukan login ulang.</p>
			<a
				href={resolve('/login')}
				class="inline-block bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700"
			>
				Kembali ke Login
			</a>
		</div>
	{/if}
</div>
