<script lang="ts">
	import InfoItem from './InfoItem.svelte';
	import { getTimeLabel, type BannerStatus } from '../status-config';

	let {
		commitSha,
		branch,
		trigger,
		status,
		timestamp,
		lastUpdate,
		resourceLimit = null
	}: {
		commitSha: string;
		branch: string;
		trigger: string;
		status: BannerStatus;
		timestamp: string;
		lastUpdate: string;
		resourceLimit?: string | null;
	} = $props();

	let shortHash = $derived(commitSha.slice(0, 7));
	let timeLabel = $derived(getTimeLabel(status));
</script>

<div
	data-testid="deployment-info"
	class="w-full bg-surface px-3 py-5 rounded-control flex flex-wrap items-center justify-around gap-x-6 gap-y-3 mt-6"
>
	<InfoItem label="Commit" value={shortHash} testId="deployment-commit" />
	<InfoItem label="Branch" value={branch} testId="deployment-branch" />
	<InfoItem label="Trigger" value={trigger} testId="deployment-trigger" />
	<InfoItem label={timeLabel} value={timestamp} testId="deployment-primary-time" />
	<InfoItem label="Pembaruan terakhir" value={lastUpdate} testId="deployment-updated-time" />
	{#if resourceLimit}
		<InfoItem label="Batas resource" value={resourceLimit} testId="deployment-resources" />
	{/if}
</div>
