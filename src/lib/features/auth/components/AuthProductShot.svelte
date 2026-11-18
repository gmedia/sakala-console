<script lang="ts">
	import firstDeployLive from '$lib/assets/first-deploy-live.webp';

	/**
	 * A real Console screen, not an illustration: the first deployment of a demo project going live
	 * on staging, cropped to the content so no account details show, with the log already blurred.
	 * The file is twice the size it is shown at.
	 */
	const SHOT_WIDTH = 1152;
	const SHOT_HEIGHT = 576;

	type Props = { class?: string };

	let { class: className = '' }: Props = $props();
</script>

<figure class="overflow-hidden rounded-card border border-white/30 bg-primary-800 {className}">
	<figcaption class="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white">
		<span>Setelah deploy pertama berhasil</span>
		<span class="rounded-full border border-white px-2 font-mono text-xs">contoh</span>
	</figcaption>
	<img
		src={firstDeployLive}
		width={SHOT_WIDTH}
		height={SHOT_HEIGHT}
		decoding="async"
		alt="Layar Sakala Console setelah deploy pertama berhasil: judul portfolio-mahasiswa sudah live, alamat publiknya dengan tombol Buka situs dan Salin, tahapan deployment yang semuanya selesai, dan panel log yang diburamkan."
		class="block h-auto w-full bg-background"
	/>
</figure>
