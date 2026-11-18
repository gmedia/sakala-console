<script lang="ts">
	import GitBranch from 'phosphor-svelte/lib/GitBranch';
	import Rocket from 'phosphor-svelte/lib/Rocket';
	import Terminal from 'phosphor-svelte/lib/Terminal';
	import type { Component } from 'svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { DEPLOY_GUIDE_URL } from '$lib/config/project';
	import { ONBOARDING_DESTINATIONS, type OnboardingDestination } from '../constants';
	import OnboardingError from './OnboardingError.svelte';

	type Props = {
		pendingDestination: OnboardingDestination | null;
		errorMessage?: string | null;
		onCreateProject: () => void;
		onOpenProjects: () => void;
	};

	let { pendingDestination, errorMessage, onCreateProject, onOpenProjects }: Props = $props();

	// What a new account can do today, in the order the wizard does it: configuration comes before
	// detection, which reads the repository with the branch and settings already chosen.
	const capabilities: { icon: Component; text: string }[] = [
		{
			icon: GitBranch,
			text: 'Deploy dari repository GitHub, yang publik atau yang kamu beri akses lewat GitHub App.'
		},
		{
			icon: Rocket,
			text: 'Atur branch dan environment variable, lalu Sakala mendeteksi cara build dan menjalankan aplikasinya.'
		},
		{
			icon: Terminal,
			text: 'Baca log setiap deployment. Kalau gagal, log menunjukkan tahap yang gagal.'
		}
	];

	const isBusy = $derived(pendingDestination !== null);
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
	<SakalaLogo class="h-10 self-start" />

	<div class="space-y-2">
		<h1 class="text-2xl sm:text-3xl">Selamat datang di Sakala</h1>
		<p class="text-sm text-muted sm:text-base">
			Sakala men-deploy aplikasi dari repository GitHub dan memberinya URL publik.
		</p>
	</div>

	<section aria-labelledby="onboarding-capabilities" class="space-y-3">
		<h2 id="onboarding-capabilities" class="font-sans text-sm font-semibold text-foreground">
			Yang bisa kamu lakukan
		</h2>
		<ul class="space-y-3">
			{#each capabilities as capability (capability.text)}
				{@const Icon = capability.icon}
				<li class="flex items-start gap-3 text-sm text-foreground">
					<Icon size={20} class="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
					<span>{capability.text}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if errorMessage}
		<OnboardingError title="Belum bisa lanjut." description={errorMessage} />
	{/if}

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<Button
			size="lg"
			onclick={onCreateProject}
			disabled={isBusy}
			aria-busy={pendingDestination === ONBOARDING_DESTINATIONS.createProject}
		>
			{pendingDestination === ONBOARDING_DESTINATIONS.createProject
				? 'Membuka...'
				: 'Buat proyek pertama'}
		</Button>
		<Button variant="ghost" size="lg" onclick={onOpenProjects} disabled={isBusy}>
			{pendingDestination === ONBOARDING_DESTINATIONS.projects
				? 'Membuka...'
				: 'Lihat dashboard dulu'}
		</Button>
	</div>

	<p class="text-sm text-muted">
		Butuh panduan? Baca
		<!-- eslint-disable svelte/no-navigation-without-resolve -- a page on the landing site -->
		<a
			href={DEPLOY_GUIDE_URL}
			target="_blank"
			rel="noreferrer noopener"
			class="wrap-anywhere text-primary-dark underline underline-offset-2"
		>
			panduan deploy pertama</a
		><!-- eslint-enable svelte/no-navigation-without-resolve -->, yang juga bisa dibuka dari menu
		Panduan.
	</p>
</div>
