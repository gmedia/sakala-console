<script lang="ts">
	import Lightbulb from 'phosphor-svelte/lib/Lightbulb';
	import { LARAVEL_VALKEY_SUGGESTIONS } from '../variables';

	/** Short how-to for the two stacks the pilot runs, Laravel and Node, accurate to the API docs. */
	let { mode }: { mode: string } = $props();
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-5"
	aria-labelledby="valkey-usage-title"
	data-testid="valkey-usage-hint"
>
	<h2 id="valkey-usage-title" class="flex items-center gap-2 text-base text-foreground">
		<Lightbulb size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
		Cara memakai Valkey
	</h2>

	<div class="flex flex-col gap-1.5 text-sm" data-testid="valkey-usage-laravel">
		<h3 class="text-sm font-semibold text-foreground">Laravel</h3>
		<p class="text-foreground">
			Koneksi redis Laravel membaca <code class="font-mono text-xs">REDIS_URL</code> sendiri. Untuk memakai
			Valkey sebagai antrean dan cache, tambahkan variabel proyek:
		</p>
		<pre
			class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs whitespace-pre-wrap text-foreground">{LARAVEL_VALKEY_SUGGESTIONS.map(
				({ key, value }) => `${key}=${value}`
			).join('\n')}</pre>
		<p class="text-muted">
			Jangan menambahkan <code class="font-mono text-xs">/0</code> di akhir REDIS_URL. Laravel
			memakai database 0 untuk antrean dan 1 untuk cache; nomor di URL menyatukan keduanya, sehingga
			<code class="font-mono text-xs">cache:clear</code> ikut menghapus job.
		</p>
		<p class="text-muted">
			Laravel memakai phpredis secara bawaan. Kalau ekstensi itu tidak ada di image aplikasimu,
			pasang paket <code class="font-mono text-xs">predis/predis</code> dan tambahkan
			<code class="font-mono text-xs">REDIS_CLIENT=predis</code>.
		</p>
	</div>

	<div
		class="flex flex-col gap-1.5 border-t border-border pt-4 text-sm"
		data-testid="valkey-usage-node"
	>
		<h3 class="text-sm font-semibold text-foreground">Node.js</h3>
		<p class="text-foreground">
			Buat koneksi dari <code class="font-mono text-xs">process.env.REDIS_URL</code>, misalnya
			dengan ioredis. BullMQ butuh mode persisten, karena di mode cache job bisa dibuang saat Valkey
			penuh, dan koneksi worker-nya perlu
			<code class="font-mono text-xs">maxRetriesPerRequest: null</code>.
		</p>
		{#if mode === 'cache'}
			<p class="text-foreground" data-testid="valkey-usage-cache-warning">
				Valkey ini mode cache, jadi jangan dipakai untuk antrean atau sesi.
			</p>
		{/if}
	</div>
</section>
