<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(resolveRoute('/login'), { replaceState: true });
	});
</script>
