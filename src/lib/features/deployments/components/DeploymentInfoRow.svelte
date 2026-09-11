<script lang="ts">
	import InfoItem from './InfoItem.svelte';
	import { getTimeLabel, type BannerStatus } from '../status-config';

	let {
		commitHash,
		branch,
		trigger,
		status,
		timestamp
	}: {
		commitHash: string;
		branch: string;
		trigger: string;
		status: BannerStatus;
		timestamp: string;
	} = $props();

	let shortHash = $derived(commitHash.slice(0, 7));
	let timeLabel = $derived(getTimeLabel(status));
</script>

<div class="w-full bg-white px-3 py-5 rounded-lg flex items-center justify-around gap-6 mt-6">
	<InfoItem label="Commit" value={shortHash} />
	<InfoItem label="Branch" value={branch} />
	<InfoItem label="Trigger" value={trigger} />
	<InfoItem label={timeLabel} value={timestamp} />
</div>
