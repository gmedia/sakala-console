<script lang="ts">
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	let progress = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			progress = progress + (92 - progress) * 0.15;
		}, 200);

		return () => clearInterval(interval);
	});
</script>

<div
	class="flex flex-col items-center justify-center p-8 space-y-4"
	aria-label="Sedang memuat data.."
	role="status"
>
	<div class="absolute flex justify-center top-[23%] left-[50%] -translate-x-1/2 -translate-y-1">
		<SakalaLogo class="h-9.25 w-40.5" />
	</div>

	<div class="relative w-full max-w-3xl flex justify-center">
		<img src="/icons/load.svg" alt="Loading..." aria-hidden="true" class="w-full h-auto" />
	</div>

	<div
		class="absolute flex flex-col items-center justify-center space-y-2 top-[50%] left-[51%] -translate-x-1/2 -translate-y-1/2 w-[55%]"
	>
		<h3 class="text-lg md:text-xl font-montserrat-semibold text-primary-300 tracking-wide">
			Memuat...
		</h3>
		<div
			class="w-72 h-4 md:h-5 bg-gray-200 rounded-full overflow-hidden shadow-inner relative"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progress)}
		>
			<div
				class="h-full bg-[#0F766E] transition-all duration-300 ease-out"
				style="width: {progress}%"
			>
				<div
					class="w-full h-full opacity-20"
					style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 20px);"
				></div>
			</div>
		</div>
		<p class="text-primary-300 font-montserrat-medium text-sm md:text-lg">
			Mohon tunggu ({Math.round(progress)}%)
		</p>
	</div>

	<span class="sr-only">Sedang memuat...</span>
</div>
