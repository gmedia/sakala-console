<script lang="ts">
	import OnboardingError from './OnboardingError.svelte';
	import OnboardingShell from './OnboardingShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		isPending?: boolean;
		errorMessage?: string | null;
		onFinish: () => void;
		onBack?: () => void;
	};

	let { isPending = false, errorMessage, onFinish, onBack }: Props = $props();

	const steps = [
		{
			title: 'Pilih repository GitHub',
			description: 'Repository publik, atau yang kamu beri akses lewat GitHub App.'
		},
		{
			title: 'Atur branch dan environment variable',
			description: 'Sakala memeriksa proyeknya lebih dulu, jadi kamu tahu apa yang terdeteksi.'
		},
		{
			title: 'Deploy, lalu baca log-nya',
			description:
				'Kalau berhasil, proyekmu punya URL publik. Kalau gagal, log menunjukkan tahapnya.'
		}
	];
</script>

<OnboardingShell
	step={3}
	title="Siap deploy"
	description="Tinggal tiga langkah sampai proyek pertamamu punya URL publik."
>
	{#if errorMessage}
		<OnboardingError title="Onboarding belum bisa diselesaikan." description={errorMessage} />
	{/if}

	<ol class="surface-card divide-y divide-border">
		{#each steps as step, index (step.title)}
			<li class="flex gap-3 p-4">
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-dark"
				>
					{index + 1}
				</span>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-foreground">{step.title}</p>
					<p class="mt-0.5 text-sm text-muted">{step.description}</p>
				</div>
			</li>
		{/each}
	</ol>

	<p class="text-sm text-muted">
		Butuh panduan? Baca
		<a
			href="https://sakala.dev/docs/deploy-pertama"
			target="_blank"
			rel="noreferrer noopener"
			class="wrap-anywhere text-primary-dark underline underline-offset-2"
		>
			panduan deploy pertama</a
		>, yang selalu bisa dibuka dari menu.
	</p>

	{#snippet footer()}
		<Button variant="secondary" onclick={onBack} disabled={!onBack || isPending}>Kembali</Button>
		<Button onclick={onFinish} disabled={isPending}>
			{isPending ? 'Memproses...' : 'Buat proyek pertama'}
		</Button>
	{/snippet}
</OnboardingShell>
