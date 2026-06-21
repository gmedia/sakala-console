<script lang="ts">
	import { GitFork } from '@lucide/svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head><title>Login | Sakala Console</title></svelte:head>

<main class="paper-grid flex min-h-screen items-center justify-center px-5 py-12">
	<section class="surface-card w-full max-w-md p-7 sm:p-9">
		<SakalaLogo />
		<h1 class="mt-10 text-3xl font-semibold tracking-tight">Masuk untuk membawa project online.</h1>
		<p class="mt-3 leading-7 text-muted">
			GitHub akan menjadi identitas utama Sakala. Tombol login diaktifkan setelah endpoint OAuth dan
			session API selesai diuji.
		</p>
		<div class="mt-8">
			<Button disabled class="w-full"
				><GitFork size={18} aria-hidden="true" /> Lanjutkan dengan GitHub</Button
			>
		</div>
		<p class="mt-6 text-sm leading-6 text-muted">
			Belum tersedia? Ikuti progres terbuka di
			<a
				class="font-semibold text-primary hover:underline"
				href="https://github.com/gmedia/sakala-console"
			>
				GitHub
			</a>.
		</p>
	</section>
</main>
