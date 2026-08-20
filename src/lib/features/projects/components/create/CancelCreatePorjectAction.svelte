<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';

	function handleClick() {
		goto(resolve('/projects'));
	}
</script>

<Button variant="outline" onclick={handleClick} class="mb-4 px-3 border-2 border-muted text-muted">
	Batal
</Button>
