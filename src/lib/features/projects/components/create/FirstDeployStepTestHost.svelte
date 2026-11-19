<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import FirstDeployStep from './FirstDeployStep.svelte';

	// The footer's Keluar reads the wizard, so the step needs one around it, as in the wizard.
	let props: ComponentProps<typeof FirstDeployStep> = $props();
	initCreateProjectContext();
</script>

<FirstDeployStep {...props} />
