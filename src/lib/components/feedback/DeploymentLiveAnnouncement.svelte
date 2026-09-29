<script lang="ts">
	import type { BannerStatus } from '$lib/features/deployments/status-config';

	type Props = {
		status: BannerStatus;
	};

	let { status }: Props = $props();

	let previousStatus = $state<BannerStatus | null>(null);
	let announcement = $state('');

	$effect(() => {
		if (previousStatus === null) {
			previousStatus = status;
			return;
		}

		if (previousStatus === status) {
			return;
		}

		previousStatus = status;

		announcement = getStatusAnnouncement(status);
	});

	function getStatusAnnouncement(status: BannerStatus): string {
		switch (status) {
			case 'success':
				return 'Deployment berhasil.';

			case 'failed':
				return 'Deployment gagal. Periksa ringkasan error untuk informasi lebih lanjut.';

			default:
				return '';
		}
	}
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true">
	{announcement}
</div>
