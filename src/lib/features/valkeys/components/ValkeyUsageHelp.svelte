<script lang="ts">
	import { VALKEY_MODE } from '$lib/api/resources/valkeys';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { VALKEY_PANEL_COPY as COPY } from '../panel';
	import { LARAVEL_VALKEY_SUGGESTIONS } from '../variables';

	/**
	 * Short how-to for the two stacks the pilot runs, Laravel and Node, accurate to the API docs.
	 * Folded in the panel's Bantuan card: needed once, while wiring an app up.
	 */
	let { mode }: { mode: string } = $props();
</script>

{#if mode === VALKEY_MODE.cache}
	<p class="text-sm text-foreground" data-testid="valkey-usage-cache-warning">
		Mode cache: jangan untuk antrean atau sesi.
	</p>
{/if}

<LearnMore topic="memakai Valkey di Laravel" label={COPY.laravel} testid="valkey-usage-laravel">
	<p>
		Koneksi redis Laravel membaca <code class="font-mono text-xs">REDIS_URL</code> sendiri. Untuk memakai
		Valkey sebagai antrean dan cache, tambahkan variabel proyek:
	</p>
	<pre
		class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs whitespace-pre-wrap text-foreground">{LARAVEL_VALKEY_SUGGESTIONS.map(
			({ key, value }) => `${key}=${value}`
		).join('\n')}</pre>
	<p>
		Jangan menambahkan <code class="font-mono text-xs">/0</code> di akhir REDIS_URL. Laravel memakai
		database 0 untuk antrean dan 1 untuk cache; nomor di URL menyatukan keduanya, sehingga
		<code class="font-mono text-xs">cache:clear</code> ikut menghapus job.
	</p>
	<p>
		Laravel memakai phpredis secara bawaan. Kalau ekstensi itu tidak ada di image aplikasimu, pasang
		paket <code class="font-mono text-xs">predis/predis</code> dan tambahkan
		<code class="font-mono text-xs">REDIS_CLIENT=predis</code>.
	</p>
</LearnMore>

<LearnMore topic="memakai Valkey di Node.js" label={COPY.node} testid="valkey-usage-node">
	<p>
		Buat koneksi dari <code class="font-mono text-xs">process.env.REDIS_URL</code>, misalnya dengan
		ioredis. BullMQ butuh mode persisten, karena di mode cache job bisa dibuang saat Valkey penuh,
		dan koneksi worker-nya perlu
		<code class="font-mono text-xs">maxRetriesPerRequest: null</code>.
	</p>
</LearnMore>
