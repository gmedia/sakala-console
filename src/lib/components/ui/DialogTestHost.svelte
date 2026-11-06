<script lang="ts">
	import Dialog from './Dialog.svelte';

	let { loading = false, onConfirm }: { loading?: boolean; onConfirm?: () => void } = $props();

	let open = $state(true);
	let closes = $state(0);
</script>

<p data-testid="closes">{closes}</p>
<button type="button" onclick={() => (open = true)}>Buka</button>

<Dialog
	{open}
	title="Hapus?"
	description="Tidak bisa dibatalkan."
	initialFocus="cancel"
	{loading}
	onConfirm={onConfirm ?? (() => {})}
	onCancel={() => {
		open = false;
		closes += 1;
	}}
/>
