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
	class="mt-6 rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
>
	<div class="flex items-start gap-2">
		<WarningCircleIcon size={24} />
		<div>
			<p class="font-montserrat-semibold">{title}</p>
			{description}
		</div>
	</div>
</div>
