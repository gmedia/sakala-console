<script lang="ts">
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	type Props = {
		title: string;
		description: string;
	};

	let { title = 'Gagal menyimpan pilihanmu.', description }: Props = $props();
</script>

<div
	role="alert"
	class="rounded-control border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
>
	<div class="flex items-start gap-2">
		<WarningCircleIcon size={20} class="shrink-0" aria-hidden="true" />
		<div>
			<p class="font-semibold">{title}</p>
			{description}
		</div>
	</div>
</div>
