<script lang="ts">
	import type { Bucket } from '$lib/api/resources/buckets';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { BUCKET_HELP_LINKS, BUCKET_PANEL_COPY as COPY, deriveBucketSteps } from '../panel';
	import { BUCKET_COPY } from '../presentation';
	import { LARAVEL_FILESYSTEM_DISK } from '../variables';

	/** Next steps and guides only: the bucket's facts sit under its name, like a project's header. */
	type Props = {
		bucket: Bucket;
		canManage: boolean;
		/** The most MB this bucket may have, its own quota included; `null` when the API decides. */
		maxQuotaMb: number | null;
	};

	let { bucket, canManage, maxQuotaMb }: Props = $props();

	const steps = $derived(deriveBucketSteps(bucket, canManage, maxQuotaMb));
</script>

<PanelNextSteps {steps} testid="bucket-next-steps" />

<PanelHelp links={BUCKET_HELP_LINKS} testid="bucket-help">
	<LearnMore topic={COPY.laravelTopic} label={COPY.laravel} testid="bucket-usage-laravel">
		<p>{COPY.laravelLead}</p>
		<code
			class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
			>{LARAVEL_FILESYSTEM_DISK.key}={LARAVEL_FILESYSTEM_DISK.value}</code
		>
		<p>{COPY.laravelWhy}</p>
	</LearnMore>
	<LearnMore topic={COPY.privacyTopic} label={COPY.privacy} testid="bucket-usage-privacy">
		<p>{BUCKET_COPY.privateNote}</p>
		<p>{BUCKET_COPY.backupNote}</p>
	</LearnMore>
</PanelHelp>
