import type { PanelStep } from '$lib/components/panel/panel';
import type { Valkey } from '$lib/api/resources/valkeys';
import { valkeyMemoryNotice } from './presentation';

/** Ids on the store's page the panel's next steps land on. */
export const VALKEY_ANCHORS = {
	projects: 'valkey-projects',
	resize: 'valkey-resize'
} as const;

/** The words of the store page's side panel (docs/UI_GUIDELINES.md, text budget). */
export const VALKEY_PANEL_COPY = {
	label: 'Langkah dan bantuan Valkey',
	autoRegion: 'region otomatis',
	projects: (count: string) => `${count} proyek`,
	created: (date: string) => `dibuat ${date}`,
	learnMode: (mode: string) => `mode ${mode.toLowerCase()}`,
	modeHelp: (mode: string) => `Mode ${mode.toLowerCase()}`,
	attach: 'Pasang ke proyek',
	resize: 'Perbesar ukuran',
	laravel: 'Laravel',
	node: 'Node.js'
} as const;

type StepValkey = Pick<Valkey, 'status' | 'projects' | 'usage' | 'maxmemory_mb' | 'mode'>;

/**
 * Up to two next steps that apply to the store now, for someone who may change it: attach it to a
 * project while none uses it, and make it bigger while it is nearly full. A store still being made,
 * locked, or removed gets none: neither step would go through.
 */
export function deriveValkeySteps(valkey: StepValkey, canManage: boolean): PanelStep[] {
	if (!canManage || valkey.status !== 'ready') return [];
	const steps: PanelStep[] = [];
	if (valkey.projects.length === 0) {
		steps.push({
			id: 'attach',
			label: VALKEY_PANEL_COPY.attach,
			href: `#${VALKEY_ANCHORS.projects}`
		});
	}
	if (valkeyMemoryNotice(valkey)) {
		steps.push({
			id: 'resize',
			label: VALKEY_PANEL_COPY.resize,
			href: `#${VALKEY_ANCHORS.resize}`
		});
	}
	return steps;
}
