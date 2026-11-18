import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import { RELEASE_COMMAND_LABEL } from '../build-help';
import {
	getPortDisplay,
	getProjectPublicUrl,
	getPublicUrlLabel,
	type ProjectHeaderKind,
	type ProjectHeaderState
} from '../presentation';
import { MIN_REPLICAS, replicasOf } from '../replicas';
import type { Project } from '../type';

/** Where a box of the diagram leads. The component turns these into routes. */
export type TopologyTarget = 'address' | 'deployments' | 'variables' | 'release_command';

/** How a box is drawn. `live` is the one serving traffic; the rest follow the header's status. */
export type TopologyTone = 'live' | 'neutral' | 'running' | 'warning' | 'error';

export type TopologyNode = {
	id: 'address' | 'edge' | 'node' | 'app';
	/** What the box is: Alamat, Sakala Edge, Node, Aplikasi. */
	label: string;
	/** The fact the box carries, such as the domain or the region. */
	value: string | null;
	/** `value` is code-like (a domain, a slug), so it is set in the mono face. */
	mono: boolean;
	/** The status badge, the same one the header shows. Only the app has it. */
	badge: { label: string; tone: BadgeTone } | null;
	/** Short facts in one line: replicas and port. */
	facts: string[];
	/** One sentence on what the box does or why it is in this state. */
	detail: string | null;
	tone: TopologyTone;
	target: TopologyTarget | null;
};

export type AttachedItem = {
	id: 'variables' | 'release_command';
	label: string;
	value: string;
	mono: boolean;
	/** Nothing is set yet, so the value reads as an absence, not as data. */
	empty: boolean;
	target: TopologyTarget;
};

export type Topology = {
	/** The visitor's path, in order: what the ordered list renders. */
	path: TopologyNode[];
	/**
	 * What the app is wired to. A managed database (ADR-020) joins this list once the API reports
	 * one; until then nothing stands in for it, so the diagram never shows a feature that is not there.
	 */
	attached: AttachedItem[];
	/** The whole diagram in one or two sentences, read before the boxes. */
	summary: string;
};

/** The environment variable list is a read of its own, so the diagram can be ahead of it. */
export type VariablesState =
	{ state: 'loading' } | { state: 'error' } | { state: 'ready'; count: number };

export type TopologyOptions = {
	/**
	 * Whether Sakala Edge stands in front of the nodes. The hosted service runs it (ADR-019); a
	 * self-hosted install may not, and then visitors reach the node's router directly.
	 */
	edge: boolean;
};

export const TOPOLOGY_COPY = {
	title: 'Alur pengunjung',
	pathLabel: 'Jalur dari alamat ke aplikasi',
	attachedTitle: 'Terpasang ke aplikasi',
	address: 'Alamat',
	edgeLabel: 'Edge',
	edge: 'Sakala Edge',
	edgeDetail: 'Meneruskan pengunjung ke node yang menjalankan aplikasimu.',
	node: 'Node',
	nodeDetail: 'Server Sakala yang menjalankan container aplikasimu.',
	app: 'Aplikasi',
	variables: 'Environment variable',
	regionAuto: 'Region otomatis',
	noAddress: 'Belum ada alamat',
	variablesLoading: 'Memuat...',
	variablesError: 'Belum bisa dimuat',
	variablesNone: 'Belum ada',
	releaseNone: 'Belum diatur',
	links: {
		address: 'Salin atau buka alamat',
		deployments: 'Lihat riwayat',
		variables: 'Buka Variabel',
		release_command: 'Atur di Pengaturan'
	} satisfies Record<TopologyTarget, string>
} as const;

/** Kinds where a version answers visitors, so the path describes what happens now. */
const SERVING_KINDS: readonly ProjectHeaderKind[] = ['live', 'live_failed_attempt', 'crashed'];

/** No version has ever answered, so the path is what will happen after the first deploy. */
function isBeforeFirstVersion(
	project: Pick<Project, 'active_deployment_id'>,
	kind: ProjectHeaderKind
) {
	if (kind === 'not_deployed') return true;
	if (kind === 'failed' || kind === 'deploying') return !project.active_deployment_id;
	return false;
}

const countFormat = new Intl.NumberFormat('id-ID');

function regionValue(region: string | null | undefined): string {
	return region ? `Region ${region}` : TOPOLOGY_COPY.regionAuto;
}

/** "region ap-jkt-1" or "region yang dipilih otomatis", inside a sentence. */
function regionPhrase(region: string | null | undefined): string {
	return region ? `region ${region}` : 'region yang dipilih otomatis';
}

function replicaPhrase(count: number): string {
	return `${countFormat.format(count)} replika`;
}

type ReplicaReading = { fact: string | null; phrase: string | null; unhealthy: number };

/**
 * Replicas of the version that serves, from the node's heartbeat. Before a heartbeat, or for one
 * container, the count is said without a claim about health.
 */
function readReplicas(project: Project, serving: boolean): ReplicaReading {
	if (!serving) {
		const configured = replicasOf(project);
		return configured > MIN_REPLICAS
			? { fact: `Diatur ${replicaPhrase(configured)}`, phrase: null, unhealthy: 0 }
			: { fact: null, phrase: null, unhealthy: 0 };
	}
	const desired = project.serving_replicas ?? MIN_REPLICAS;
	const ready = project.replicas_ready;
	if (desired <= MIN_REPLICAS || ready == null) {
		const text = replicaPhrase(desired);
		return { fact: text, phrase: text, unhealthy: 0 };
	}
	return {
		fact: `${countFormat.format(ready)}/${countFormat.format(desired)} replika sehat`,
		phrase: `${countFormat.format(ready)} dari ${replicaPhrase(desired)} sehat`,
		unhealthy: Math.max(0, desired - ready)
	};
}

function appDetail(
	kind: ProjectHeaderKind,
	beforeFirst: boolean,
	unhealthy: number
): string | null {
	switch (kind) {
		case 'sleeping':
			return 'Kunjungan pertama membangunkannya.';
		case 'deploying':
			return beforeFirst
				? 'Deploy pertama sedang berjalan.'
				: 'Deploy baru sedang berjalan. Versi sebelumnya masih melayani.';
		case 'not_deployed':
			return 'Belum ada versi yang berjalan.';
		case 'failed':
			return 'Deploy terakhir gagal, belum ada versi yang melayani.';
		case 'live_failed_attempt':
			return 'Deploy terakhir gagal. Versi sebelumnya masih melayani.';
		case 'crashed':
			return 'Terus berhenti dan dimulai ulang.';
		case 'stopped':
			return 'Dihentikan dan tidak melayani.';
		case 'suspended':
			return 'Ditangguhkan admin Sakala, trafiknya diputus.';
		case 'live':
			return unhealthy > 0
				? `${replicaPhrase(unhealthy)} belum lolos health check. Pengunjung dilayani replika yang sehat.`
				: null;
		default:
			return null;
	}
}

function appTone(kind: ProjectHeaderKind, unhealthy: number): TopologyTone {
	if (kind === 'live') return unhealthy > 0 ? 'warning' : 'live';
	if (kind === 'live_failed_attempt') return 'warning';
	if (kind === 'deploying') return 'running';
	if (kind === 'failed' || kind === 'crashed') return 'error';
	if (kind === 'suspended') return 'warning';
	return 'neutral';
}

function addressDetail(kind: ProjectHeaderKind, beforeFirst: boolean): string {
	if (kind === 'suspended') return 'Tidak meneruskan pengunjung selama ditangguhkan.';
	if (beforeFirst) return 'Bisa dibuka setelah deploy pertama berhasil.';
	return 'Alamat bawaan dari Sakala.';
}

function variablesItem(variables: VariablesState): AttachedItem {
	const base = {
		id: 'variables',
		label: TOPOLOGY_COPY.variables,
		mono: false,
		target: 'variables'
	} as const;
	if (variables.state === 'loading') {
		return { ...base, value: TOPOLOGY_COPY.variablesLoading, empty: true };
	}
	if (variables.state === 'error')
		return { ...base, value: TOPOLOGY_COPY.variablesError, empty: true };
	if (variables.count === 0) return { ...base, value: TOPOLOGY_COPY.variablesNone, empty: true };
	return { ...base, value: `${countFormat.format(variables.count)} variabel`, empty: false };
}

function releaseItem(project: Pick<Project, 'release_command'>): AttachedItem {
	const command = project.release_command?.trim() || null;
	return {
		id: 'release_command',
		label: RELEASE_COMMAND_LABEL,
		value: command ?? TOPOLOGY_COPY.releaseNone,
		mono: command !== null,
		empty: command === null,
		target: 'release_command'
	};
}

function attachedSentence(variables: VariablesState, release: AttachedItem): string {
	const releasePart = release.empty
		? 'belum punya release command'
		: 'menjalankan release command sebelum setiap versi baru menerima trafik';
	if (variables.state !== 'ready') return `Aplikasi ${releasePart}.`;
	const variablesPart =
		variables.count === 0
			? 'belum punya environment variable'
			: `memakai ${countFormat.format(variables.count)} environment variable`;
	return `Aplikasi ${variablesPart} dan ${releasePart}.`;
}

/**
 * The visitor's path for one project, from what the API reports and the header already derived:
 * the address, Sakala Edge, the node, and the app with what is attached to it.
 */
export function deriveTopology(
	project: Project,
	header: Pick<ProjectHeaderState, 'kind' | 'badge' | 'serving'>,
	variables: VariablesState,
	options: TopologyOptions
): Topology {
	const kind = header.kind;
	const beforeFirst = isBeforeFirstVersion(project, kind);
	const serving = header.serving || SERVING_KINDS.includes(kind);
	const publicUrl = getProjectPublicUrl(project);
	const domain = publicUrl ? getPublicUrlLabel(publicUrl) : project.default_domain || null;
	const port = getPortDisplay(project).current;
	const replicas = readReplicas(project, serving);

	const address: TopologyNode = {
		id: 'address',
		label: TOPOLOGY_COPY.address,
		value: domain ?? TOPOLOGY_COPY.noAddress,
		mono: domain !== null,
		badge: null,
		facts: [],
		detail: addressDetail(kind, beforeFirst),
		tone: 'neutral',
		target: 'address'
	};
	const edge: TopologyNode = {
		id: 'edge',
		label: TOPOLOGY_COPY.edgeLabel,
		value: TOPOLOGY_COPY.edge,
		mono: false,
		badge: null,
		facts: [],
		detail: TOPOLOGY_COPY.edgeDetail,
		tone: 'neutral',
		target: null
	};
	const node: TopologyNode = {
		id: 'node',
		label: TOPOLOGY_COPY.node,
		value: regionValue(project.region),
		mono: false,
		badge: null,
		facts: [],
		detail: TOPOLOGY_COPY.nodeDetail,
		tone: 'neutral',
		target: null
	};
	const app: TopologyNode = {
		id: 'app',
		label: TOPOLOGY_COPY.app,
		value: null,
		mono: false,
		badge: { label: header.badge.label, tone: header.badge.variant },
		facts: [replicas.fact, `port ${port}`].filter((fact): fact is string => fact !== null),
		detail: appDetail(kind, beforeFirst, replicas.unhealthy),
		tone: appTone(kind, replicas.unhealthy),
		target: 'deployments'
	};

	const release = releaseItem(project);
	return {
		path: options.edge ? [address, edge, node, app] : [address, node, app],
		attached: [variablesItem(variables), release],
		summary: `${pathSentence(kind, beforeFirst, {
			domain: domain ?? 'alamat proyek',
			edge: options.edge,
			region: project.region,
			port,
			replicas: replicas.phrase
		})} ${attachedSentence(variables, release)}`
	};
}

type SentenceFacts = {
	domain: string;
	edge: boolean;
	region: string | null | undefined;
	port: number;
	replicas: string | null;
};

/** The path in words, in the order of the boxes. */
function pathSentence(kind: ProjectHeaderKind, beforeFirst: boolean, facts: SentenceFacts): string {
	const forward = facts.edge
		? `Sakala Edge meneruskannya ke node di ${regionPhrase(facts.region)}`
		: `pengunjung diteruskan ke node di ${regionPhrase(facts.region)}`;
	const visit = `Pengunjung membuka ${facts.domain}, lalu ${forward}`;
	const running = facts.replicas
		? `tempat aplikasi berjalan dengan ${facts.replicas} di port ${facts.port}`
		: `tempat aplikasi berjalan di port ${facts.port}`;

	if (kind === 'suspended') {
		return `Proyek ini ditangguhkan, jadi pengunjung yang membuka ${facts.domain} tidak diteruskan ke aplikasi.`;
	}
	if (beforeFirst) {
		const when =
			kind === 'deploying' ? 'Setelah deploy ini selesai' : 'Setelah deploy pertama berhasil';
		const via = facts.edge ? 'diteruskan Sakala Edge ke node' : 'diteruskan ke node';
		return `${when}, pengunjung yang membuka ${facts.domain} ${via} di ${regionPhrase(facts.region)}, lalu ke aplikasi di port ${facts.port}.`;
	}
	switch (kind) {
		case 'sleeping':
			return `${visit}, tempat aplikasi sedang tidur. Kunjungan pertama membangunkannya, jadi pengunjung itu menunggu sebentar.`;
		case 'crashed':
			return `${visit}, tempat aplikasi terus berhenti dan dimulai ulang, jadi alamatnya kadang tidak bisa dibuka.`;
		case 'stopped':
			return `${visit}, tetapi aplikasinya sedang dihentikan, jadi pengunjung belum dilayani.`;
		case 'failed':
			return `${visit}, tetapi deploy terakhir gagal dan belum ada versi yang melayani.`;
		case 'deploying':
			return `${visit}, ${running}. Deploy baru sedang berjalan dan versi sebelumnya masih melayani.`;
		case 'live_failed_attempt':
			return `${visit}, ${running}. Deploy terakhir gagal, jadi versi sebelumnya yang melayani.`;
		default:
			return `${visit}, ${running}.`;
	}
}

export type AddressAvailability = { reachable: boolean; note: string | null };

/**
 * Whether opening the address reaches the app (or its wake page), and why not when it does not.
 * The header decides what is reachable, so the address card and the header always agree.
 */
export function getAddressAvailability(
	project: Pick<Project, 'active_deployment_id'>,
	header: Pick<ProjectHeaderState, 'kind' | 'serving' | 'showUrl'>
): AddressAvailability {
	if (header.kind === 'suspended') {
		return { reachable: false, note: 'Tidak bisa dibuka selama proyek ditangguhkan.' };
	}
	if (header.serving || header.showUrl === true) return { reachable: true, note: null };
	if (isBeforeFirstVersion(project, header.kind)) {
		return { reachable: false, note: 'Bisa dibuka setelah deploy pertama berhasil.' };
	}
	return {
		reachable: false,
		note: 'Belum bisa dibuka karena aplikasinya tidak berjalan. Redeploy untuk menyalakannya lagi.'
	};
}
