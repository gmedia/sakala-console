<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmailIcon from '$lib/assets/email.svg';
</script>

<svelte:head><title>Overview | Sakala Console</title></svelte:head>
<header class="flex min-h-screen justify-center items-center flex-col">
	<div class="text-center w-full max-w-lg">
		<Badge tone="success1" class="text-md font-semibold">Menunggu Verifikasi</Badge>
		<h1 class="mt-3 text-3xl font-semibold tracking-[-0.035em]">Verifikasi Email Anda</h1>
		<p class="mt-2 max-w-2xl mx-auto leading-7">
			Untuk melanjutkan ke <span class="font-semibold text-[#0e6b64]">Sakala</span>, verifikasi
			idenitas Anda mellui Google untuk keamanan tambahan.
		</p>
	</div>
	<div class="flex gap-4 max-w-lg border-1 border-[#0e6b64] rounded-lg p-4 mt-8">
		<img src={EmailIcon} alt="Email" class="w-10 h-10 flex-shrink-0" />
		<div class="">
			<b class="">Cek Email</b>
			<p>Periksa kotak masuk email Anda untuk tautan konfirmasi.</p>
		</div>
	</div>
</header>
