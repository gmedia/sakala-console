<script lang="ts">
	import { ArrowRight, GitFork } from '@lucide/svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
	<title>Masuk | Sakala Console</title>
</svelte:head>

<main class="paper-grid min-h-screen">
	<div class="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-12 sm:px-8">
		<section class="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
			<div class="max-w-2xl">
				<SakalaLogo />
				<p class="mt-12 text-xs font-bold tracking-[0.2em] text-primary uppercase">
					Sakala Console
				</p>
				<h1
					class="mt-4 text-5xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-6xl"
				>
					Project-mu tidak harus berhenti di localhost.
				</h1>
				<p class="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
					Hubungkan repository, ikuti proses deployment, lalu bagikan URL publik tanpa harus memulai
					dari konfigurasi server manual.
				</p>
			</div>

			<div class="surface-card relative overflow-hidden p-6 sm:p-8">
				<div class="absolute -top-20 -right-20 size-52 rounded-full bg-primary-soft blur-3xl"></div>
				<div class="relative">
					<span class="status-chip">Pengembangan aktif</span>
					<h2 class="mt-8 text-2xl font-semibold tracking-tight">Console sedang disiapkan.</h2>
					<p class="mt-3 leading-7 text-muted">
						Fondasi frontend dan API sedang dibangun terbuka. Login GitHub akan tersedia saat alur
						autentikasi siap diuji.
					</p>

					<div class="mt-8 grid gap-3">
						<Button externalHref="https://github.com/gmedia/sakala-console">
							<GitFork size={18} aria-hidden="true" />
							Lihat repository
						</Button>
						<Button externalHref="https://sakala.dev/docs" variant="secondary">
							Baca dokumentasi
							<ArrowRight size={18} aria-hidden="true" />
						</Button>
					</div>

					<p class="mt-8 border-t border-border pt-5 text-sm leading-6 text-muted">
						Sakala adalah project open-source yang didukung GMEDIA sebagai founding sponsor dan
						infrastructure supporter.
					</p>
				</div>
			</div>
		</section>
	</div>
</main>
