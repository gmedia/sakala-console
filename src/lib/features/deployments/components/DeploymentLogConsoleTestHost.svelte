<script lang="ts">
	import '../../../../app.css';
	import DeploymentLogConsole from './DeploymentLogConsole.svelte';
	import type { DeploymentLogLine } from '../deployment-logs';
	import type { LogLevel } from '../log-classification';

	let {
		initialLines,
		onJumpToLatest,
		paused = false,
		levels
	}: {
		initialLines: DeploymentLogLine[];
		onJumpToLatest?: () => void;
		paused?: boolean;
		levels?: ReadonlyMap<number, LogLevel>;
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

<div style="width: 320px; height: 240px">
	<DeploymentLogConsole {lines} {levels} bind:following {paused} {onJumpToLatest} />
</div>
<p data-testid="following">{following ? 'mengikuti' : 'tidak mengikuti'}</p>
