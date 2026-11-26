import type { PanelHelpLink, PanelStep } from '$lib/components/panel/panel';
import type { Bucket } from '$lib/api/resources/buckets';
import { bucketGuideUrl } from '$lib/config/project';
import { bucketUsageMeter } from './presentation';

/** Ids on the bucket's page the panel's next steps land on. */
export const BUCKET_ANCHORS = {
	projects: 'bucket-projects',
	quota: 'bucket-quota-settings'
} as const;

/** The words of the bucket page's side panel and fact line (docs/UI_GUIDELINES.md, text budget). */
export const BUCKET_PANEL_COPY = {
	label: 'Langkah dan bantuan bucket',
	kind: 'S3 privat',
	autoRegion: 'region otomatis',
	quota: (size: string) => `kuota ${size}`,
	projects: (count: string) => `${count} proyek`,
	created: (date: string) => `dibuat ${date}`,
	attach: 'Pasang ke proyek',
	raiseQuota: 'Naikkan kuota',
	guide: 'Panduan bucket',
	laravel: 'Laravel',
	laravelTopic: 'memakai bucket di Laravel',
	laravelLead: 'Tambahkan variabel proyek ini supaya upload masuk ke bucket:',
	laravelWhy:
		'Sakala tidak mengisinya sendiri, supaya berkas yang memang disimpan lokal tidak ikut pindah.',
	privacy: 'Privat dan backup',
	privacyTopic: 'akses berkas dan backup bucket'
} as const;

/** Guides for the Bantuan card; each opens in a new tab. */
export const BUCKET_HELP_LINKS: readonly PanelHelpLink[] = [
	{ label: BUCKET_PANEL_COPY.guide, href: bucketGuideUrl() }
];

type StepBucket = Pick<
	Bucket,
	'status' | 'projects' | 'size_bytes' | 'quota_mb' | 'pending_quota_mb'
>;

/**
 * Up to two next steps that apply to the bucket now, for someone who may change it: attach it while
 * no project uses it, and raise its quota once it is nearly full, while the workspace still has room
 * (`maxQuotaMb`, its own quota included; `null` when the API decides). Both go away by themselves
 * once done, so they need no way to hide them. A bucket that is not ready gets none.
 */
export function deriveBucketSteps(
	bucket: StepBucket,
	canManage: boolean,
	maxQuotaMb: number | null
): PanelStep[] {
	if (!canManage || bucket.status !== 'ready') return [];
	const steps: PanelStep[] = [];
	if (bucket.projects.length === 0) {
		steps.push({
			id: 'attach',
			label: BUCKET_PANEL_COPY.attach,
			href: `#${BUCKET_ANCHORS.projects}`
		});
	}
	const roomToGrow = maxQuotaMb === null || maxQuotaMb > bucket.quota_mb;
	if (
		bucket.pending_quota_mb === null &&
		roomToGrow &&
		bucket.size_bytes !== null &&
		bucketUsageMeter(bucket).level !== 'ok'
	) {
		steps.push({
			id: 'quota',
			label: BUCKET_PANEL_COPY.raiseQuota,
			href: `#${BUCKET_ANCHORS.quota}`
		});
	}
	return steps;
}
