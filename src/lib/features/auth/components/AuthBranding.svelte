<script lang="ts">
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import AuthFlowSample from './AuthFlowSample.svelte';

	type Props = {
		mode: 'login' | 'register';
	};

	let { mode }: Props = $props();
</script>

<div
	class="relative hidden flex-col gap-10 bg-primary p-12 text-white lg:col-span-6 lg:flex xl:p-16"
>
	<SakalaLogo lockup="tagline" tone="white" class="h-16 self-start" />

	<div class="my-auto max-w-xl space-y-6">
		{#if mode === 'login'}
			<p class="font-display text-5xl font-semibold text-white">
				Build,<br />Deploy,<br />Baca log-nya.
			</p>
			<p class="text-xl text-white">
				Hubungkan repository GitHub, deploy dari sini, lalu pantau status dan log-nya kalau ada yang
				gagal.
			</p>
		{:else}
			<p class="font-display text-5xl font-semibold text-white">Mulai membangun.</p>
			<p class="text-xl text-white">
				Dari repository GitHub ke URL publik. Daftar, pilih repository, lalu deploy proyek
				pertamamu.
			</p>
		{/if}
		<AuthFlowSample />
	</div>

	<p class="text-sm text-white">&copy; 2026 Sakala Contributors, Apache-2.0</p>
</div>
