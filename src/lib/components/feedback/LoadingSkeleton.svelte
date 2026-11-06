<script lang="ts">
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
</script>

<!-- The app does not know how long this takes, so it shows no progress. The spinner waits 300 ms. -->
<div class="flex flex-col items-center gap-6 p-8" role="status" aria-label="Sedang memuat">
	<h1 class="sr-only">Sedang memuat Sakala</h1>
	<SakalaLogo class="h-10" />
	<span class="boot-spinner" aria-hidden="true"></span>
</div>

<style>
	.boot-spinner {
		display: block;
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 9999px;
		opacity: 0;
		animation:
			boot-spinner-show 1ms linear 300ms forwards,
			boot-spinner-turn 900ms linear infinite;
	}

	@keyframes boot-spinner-show {
		to {
			opacity: 1;
		}
	}

	@keyframes boot-spinner-turn {
		to {
			transform: rotate(360deg);
		}
	}

	/* The global reduced-motion rule stops both animations after one tick, so this one stays visible. */
	@media (prefers-reduced-motion: reduce) {
		.boot-spinner {
			opacity: 1;
		}
	}
</style>
