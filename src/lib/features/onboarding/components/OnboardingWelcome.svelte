<script lang="ts">
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import { DEPLOY_GUIDE_URL } from '$lib/config/project';
	import { ONBOARDING_DESTINATIONS, type OnboardingDestination } from '../constants';
	import OnboardingError from './OnboardingError.svelte';

	type Props = {
		pendingDestination: OnboardingDestination | null;
		errorMessage?: string | null;
		onCreateProject: () => void;
		onOpenProjects: () => void;
		/** Opens the wizard at the example repositories, for someone without a repository yet. */
		onStartFromExample?: () => void;
	};

	let {
		pendingDestination,
		errorMessage,
		onCreateProject,
		onOpenProjects,
		onStartFromExample
	}: Props = $props();

	// What a new account can do today, in the order the wizard does it: configuration comes before
	// detection, which reads the repository with the branch and settings already chosen. Numbered,
	// since the order is the point.
	const capabilities = [
		'Pilih repository GitHub, yang publik atau lewat GitHub App.',
		'Atur branch dan environment variable, lalu Sakala mendeteksi cara build-nya.',
		'Baca log setiap deployment, termasuk tahap yang gagal.'
	] as const;

	const isBusy = $derived(pendingDestination !== null);
</script>

<!-- The focused template: one column at reading width, one primary action. -->
<div class="w-full px-4 py-8 sm:px-6 sm:py-12">
	<FocusedPageLayout>
		<div class="flex flex-col gap-8">
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
				<ol class="space-y-3">
					{#each capabilities as capability, index (capability)}
						<li class="flex items-start gap-3 text-sm text-foreground">
							<span
								class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-dark"
								aria-hidden="true">{index + 1}</span
							>
							<span class="pt-0.5">{capability}</span>
						</li>
					{/each}
				</ol>
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

			{#if onStartFromExample}
				<p class="-mt-4 text-sm text-muted">
					Belum punya repo?
					<Button variant="link" onclick={onStartFromExample} disabled={isBusy}>
						Coba dulu dengan repo contoh
					</Button>
				</p>
			{/if}

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
				><!-- eslint-enable svelte/no-navigation-without-resolve -->.
			</p>
		</div>
	</FocusedPageLayout>
</div>
