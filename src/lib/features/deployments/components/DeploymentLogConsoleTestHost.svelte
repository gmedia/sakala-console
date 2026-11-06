<script lang="ts">
	import '../../../../app.css';
	import DeploymentLogConsole from './DeploymentLogConsole.svelte';
	import type { DeploymentLogLine } from '../deployment-logs';

	let {
		initialLines,
		onJumpToLatest,
		paused = false
	}: {
		initialLines: DeploymentLogLine[];
		onJumpToLatest?: () => void;
		paused?: boolean;
	} = $props();

	let lines = $state<DeploymentLogLine[]>([]);
	let following = $state(true);

	export function setLines(next: DeploymentLogLine[]) {
		lines = next;
	}

	$effect.pre(() => {
		if (paused) following = false;
		if (lines.length === 0) lines = initialLines;
	});
</script>

<div style="width: 320px">
	<DeploymentLogConsole {lines} bind:following {paused} {onJumpToLatest} />
</div>
<p data-testid="following">{following ? 'mengikuti' : 'tidak mengikuti'}</p>
