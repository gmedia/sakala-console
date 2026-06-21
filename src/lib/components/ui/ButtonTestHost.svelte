<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from './Button.svelte';
</script>

<Button href={resolve('/projects')} variant="secondary">Buka projects</Button>
