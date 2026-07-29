<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';

	type Props = {
		onFinish: () => void;
		onBack?: () => void;
	};

	let { onFinish, onBack }: Props = $props();
</script>

<div class="mx-auto w-full py-12 px-6 md:px-93.5 text-center">
	<!-- Badge -->
	<div class="mb-10">
		<span
			class="inline-block rounded-lg border border-primary/40 bg-primary-50/50 px-3 py-1 font-mono text-[14px] text-primary"
		>
			Langkah 3 dari 3
		</span>
	</div>

	<!-- Heading -->
	<h1 class="text-3xl font-bold tracking-tight text-black sm:text-4xl">Siap Membangun</h1>
	<p class="mt-2 text-sm text-black">
		Selamat! Workspace Anda telah dikonfigurasi dengan sempurna. Sekarang saatnya mengubah ide
		menjadi kenyataan dengan Sakala.
	</p>

	<!-- Footer Navigation Controls -->
	<div class="mt-20 flex items-center justify-between pt-6 text-left">
		<button
			type="button"
			onclick={onBack}
			class="inline-flex items-center gap-2 text-[22px] font-medium text-black hover:text-primary"
		>
			<ArrowLeft size={16} />
			Kembali
		</button>

		<button
			type="button"
			onclick={onFinish}
			class="flex h-11.75 w-40.5 items-center justify-center rounded-lg bg-primary-200 text-[22px] font-normal text-white transition-colors hover:bg-primary hover:text-white"
		>
			Lanjutkan
		</button>
	</div>
</div>
