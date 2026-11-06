<script lang="ts">
	import InfoItem from './InfoItem.svelte';
	import { getTimeLabel, type BannerStatus } from '../status-config';

	let {
		commitSha,
		commitUrl = null,
		branch,
		trigger,
		status,
		timestamp,
		lastUpdate,
		resourceLimit = null
	}: {
		commitSha: string;
		commitUrl?: string | null;
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

<dl
	data-testid="deployment-info"
	class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm"
>
	<InfoItem label="Commit" value={shortHash} href={commitUrl} mono testId="deployment-commit" />
	<InfoItem label="Branch" value={branch} mono testId="deployment-branch" />
	<InfoItem label="Trigger" value={trigger} testId="deployment-trigger" />
	<InfoItem label={timeLabel} value={timestamp} mono testId="deployment-primary-time" />
	<InfoItem label="Pembaruan" value={lastUpdate} mono testId="deployment-updated-time" />
	{#if resourceLimit}
		<InfoItem label="Batas" value={resourceLimit} testId="deployment-resources" />
	{/if}
</dl>
