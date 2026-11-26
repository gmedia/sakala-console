import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import {
	DATABASE_VARIABLES,
	databaseStatusView,
	type DatabaseStatusView
} from '$lib/features/databases/presentation';
import { RELEASE_COMMAND_LABEL } from '../build-help';
import {
	getPortDisplay,
	getProjectPublicUrl,
	getPublicUrlLabel,
	type ProjectHeaderKind,
	type ProjectHeaderState,
	WAKE_ESTIMATE
} from '../presentation';
import { MIN_REPLICAS, replicasOf } from '../replicas';
import type { Project, ProjectDatabase } from '../type';

/** Where a block's details lead. The component turns these into routes. */
export type TopologyTarget =
	'address' | 'deployments' | 'variables' | 'release_command' | 'database';

/** A database page needs its workspace and id, the other targets only the project. */
export type TopologyLink =
	| { label: string; target: Exclude<TopologyTarget, 'database'> }
	| { label: string; target: 'database'; workspaceId: string; databaseId: string };

/** How a block is drawn. `live` serves traffic, `asleep` is dimmed; the rest follow the header. */
export type TopologyTone = 'live' | 'neutral' | 'running' | 'warning' | 'error' | 'asleep';

export type TopologyBlockId =
	'address' | 'edge' | 'node' | 'app' | 'database' | 'variables' | 'release_command';

/**
 * One square per replica of the version that serves. `ready` passed the router's health check,
 * `unready` did not, `unknown` before the node reports, `idle` while nothing runs.
 */
export type ReplicaCell = 'ready' | 'unready' | 'unknown' | 'idle';

export type ReplicaCells = {
	cells: ReplicaCell[];
	/** Shown beside the squares: `2/3`, or `3` without a health reading. */
	label: string;
	/** What a screen reader hears for the squares, so health never rests on colour. */
	accessibleLabel: string;
};

/** What opens on demand: the explanation that used to sit inside the block, and where to go. */
export type BlockDetail = {
	body: string[];
	/** A value to show in full, such as the hostname or the release command. */
	value: string | null;
	link: TopologyLink | null;
};

export type TopologyBlock = {
	/** Also picks the icon, so the view model stays free of UI imports. */
	id: TopologyBlockId;
	name: string;
	/** The one fact the block carries. */
	fact: string;
	/** `fact` is code-like (a hostname, a slug), so it is set in the mono face. */
	mono: boolean;
	/** The header's own status badge. Only the app has it. */
	badge: { label: string; tone: BadgeTone } | null;
	/** A second badge for work beside that status, such as a new version deploying. */
	activity: { label: string; tone: BadgeTone } | null;
	replicas: ReplicaCells | null;
	tone: TopologyTone;
	detail: BlockDetail;
};

export type TopologyGroup = {
	id: 'network' | 'region' | 'attached';
	label: string;
	blocks: TopologyBlock[];
};

export type Topology = {
	/** The groups a visit passes through, in order: Jaringan, then the region. */
	path: TopologyGroup[];
	/**
	 * What the app is wired to: the managed database (ADR-020) when one is attached, the environment
	 * variables, and the release command. Without a database nothing stands in for it.
	 */
	attached: TopologyGroup;
	/** The whole diagram in words, the description a screen reader hears for it. */
	summary: string;
	/** The app sleeps, so the runtime blocks are dimmed and the app shows a moon. */
	asleep: boolean;
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
	/**
	 * The active custom domain visitors use (ADR-024), shown as the address; the Sakala address
	 * stays in its detail. Absent or `null` without one.
	 */
	customDomain?: string | null;
};

export const TOPOLOGY_COPY = {
	title: 'Alur pengunjung',
	hint: 'Pilih kotak untuk melihat penjelasannya.',
	pathLabel: 'Jalur dari alamat ke aplikasi',
	groups: { network: 'Jaringan', attached: 'Terpasang' },
	address: 'Alamat',
	customAddress: (defaultDomain: string) => `Custom domain. Alamat Sakala: ${defaultDomain}.`,
	edge: 'Sakala Edge',
	edgeActive: 'aktif',
	edgeCut: 'trafik diputus',
	edgeDetail:
		'Sakala Edge menerima pengunjung di alamat proyek, lalu meneruskannya ke node yang menjalankan aplikasimu.',
	node: 'Node',
	nodeDetail: 'Server Sakala yang menjalankan container aplikasimu.',
	app: 'Aplikasi',
	variables: 'Environment variable',
	database: 'Database',
	regionAuto: 'otomatis',
	noAddress: 'belum ada',
	variablesLoading: 'memuat...',
	variablesError: 'belum bisa dimuat',
	variablesNone: 'belum ada',
	releaseSet: 'diatur',
	releaseNone: 'belum diatur',
	links: {
		address: 'Salin atau buka alamat',
		deployments: 'Lihat riwayat',
		variables: 'Buka Variabel',
		release_command: 'Atur di Pengaturan',
		database: 'Buka database'
	} satisfies Record<TopologyTarget, string>
} as const;

/** Kinds where a version answers visitors, so replica health means something. */
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

/** The region group's frame label: `Region id-jkt`, or `Region otomatis` when placement picks. */
export function regionLabel(region: string | null | undefined): string {
	return `Region ${region || TOPOLOGY_COPY.regionAuto}`;
}

/** "region ap-jkt-1" or "region yang dipilih otomatis", inside a sentence. */
function regionPhrase(region: string | null | undefined): string {
	return region ? `region ${region}` : 'region yang dipilih otomatis';
}

function replicaPhrase(count: number): string {
	return `${countFormat.format(count)} replika`;
}

/**
 * The replica squares. While a version serves, one per replica it runs, coloured by the node's
 * health report; before a report, or while nothing runs, outlined squares for the setting.
 */
export function deriveReplicaCells(
	project: Pick<Project, 'replicas' | 'serving_replicas' | 'replicas_ready'>,
	serving: boolean
): ReplicaCells {
	if (!serving) {
		const configured = replicasOf(project);
		return {
			cells: Array<ReplicaCell>(configured).fill('idle'),
			label: countFormat.format(configured),
			accessibleLabel: `${replicaPhrase(configured)} diatur, tidak ada yang berjalan`
		};
	}
	const desired = Math.max(MIN_REPLICAS, project.serving_replicas ?? MIN_REPLICAS);
	const ready = project.replicas_ready;
	if (ready == null) {
		return {
			cells: Array<ReplicaCell>(desired).fill('unknown'),
			label: countFormat.format(desired),
			accessibleLabel: `${replicaPhrase(desired)}, kesehatannya belum dilaporkan`
		};
	}
	const healthy = Math.min(Math.max(ready, 0), desired);
	return {
		cells: Array.from({ length: desired }, (_, index): ReplicaCell =>
			index < healthy ? 'ready' : 'unready'
		),
		label: `${countFormat.format(healthy)}/${countFormat.format(desired)}`,
		accessibleLabel: `${countFormat.format(healthy)} dari ${replicaPhrase(desired)} sehat`
	};
}

/** The replicas inside the description: a health claim only when the node reported one. */
function sentenceReplicas(cells: ReplicaCells): string {
	return cells.cells.includes('unknown')
		? replicaPhrase(cells.cells.length)
		: cells.accessibleLabel;
}

/** What the app block's details say about its state, beyond the badge. */
function appExplanation(kind: ProjectHeaderKind, beforeFirst: boolean): string | null {
	switch (kind) {
		case 'sleeping':
			return `Aplikasi sedang tidur karena tidak ada pengunjung. Kunjungan pertama membangunkannya, jadi pengunjung itu menunggu sebentar, biasanya ${WAKE_ESTIMATE}.`;
		case 'deploying':
			return beforeFirst
				? 'Deploy pertama sedang berjalan.'
				: 'Deploy baru sedang berjalan. Versi sebelumnya masih melayani.';
		case 'not_deployed':
			return 'Belum ada versi yang berjalan. Aplikasi menyala setelah deploy pertama berhasil.';
		case 'failed':
			return 'Deploy terakhir gagal, jadi belum ada versi yang melayani.';
		case 'live_failed_attempt':
			return 'Deploy terakhir gagal. Versi sebelumnya masih melayani.';
		case 'crashed':
			return 'Aplikasi terus berhenti dan dimulai ulang, jadi alamatnya kadang tidak bisa dibuka.';
		case 'stopped':
			return 'Aplikasi dihentikan dan tidak melayani. Redeploy untuk menyalakannya lagi.';
		case 'suspended':
			return 'Proyek ditangguhkan admin Sakala, jadi trafiknya diputus.';
		default:
			return null;
	}
}

function replicaExplanation(cells: ReplicaCells): string | null {
	const unready = cells.cells.filter((cell) => cell === 'unready').length;
	if (unready > 0) {
		return `${replicaPhrase(unready)} belum lolos health check. Pengunjung dilayani replika yang sehat.`;
	}
	if (cells.cells.length > MIN_REPLICAS && cells.cells.every((cell) => cell === 'ready')) {
		return 'Semua replika lolos health check, dan pengunjung dibagi di antaranya.';
	}
	return null;
}

function appTone(kind: ProjectHeaderKind, cells: ReplicaCells, serving: boolean): TopologyTone {
	const unready = cells.cells.includes('unready');
	// A deploy over a live version: visitors still reach the live one.
	if (kind === 'live' || (kind === 'deploying' && serving)) return unready ? 'warning' : 'live';
	if (kind === 'live_failed_attempt') return 'warning';
	if (kind === 'deploying') return 'running';
	if (kind === 'failed' || kind === 'crashed') return 'error';
	if (kind === 'suspended') return 'warning';
	if (kind === 'sleeping') return 'asleep';
	return 'neutral';
}

function addressNote(kind: ProjectHeaderKind, beforeFirst: boolean): string {
	if (kind === 'suspended') {
		return 'Alamat ini tidak meneruskan pengunjung selama proyek ditangguhkan.';
	}
	if (beforeFirst) return 'Alamat bawaan dari Sakala. Bisa dibuka setelah deploy pertama berhasil.';
	if (kind === 'sleeping') return 'Alamat bawaan dari Sakala. Membukanya membangunkan aplikasi.';
	return 'Alamat bawaan dari Sakala, dibuat dari nama proyek.';
}

/**
 * The attached database's variables the app really receives: a project variable with the same name
 * wins, so those are not counted twice.
 */
export function databaseVariableNames(database: ProjectDatabase | null): string[] {
	if (!database) return [];
	const overridden = new Set(database.overridden_variables);
	return database.variables.filter((name) => !overridden.has(name));
}

/** `3 variabel`, `3 variabel + 7 dari database`, or `7 dari database`. */
function variablesFact(variables: VariablesState, fromDatabase: number): string {
	if (variables.state === 'loading') return TOPOLOGY_COPY.variablesLoading;
	if (variables.state === 'error') return TOPOLOGY_COPY.variablesError;
	const own = variables.count > 0 ? `${countFormat.format(variables.count)} variabel` : null;
	const injected = fromDatabase > 0 ? `${countFormat.format(fromDatabase)} dari database` : null;
	if (own && injected) return `${own} + ${injected}`;
	return own ?? injected ?? TOPOLOGY_COPY.variablesNone;
}

function variablesBlock(
	variables: VariablesState,
	database: ProjectDatabase | null
): TopologyBlock {
	const injected = databaseVariableNames(database);
	const fact = variablesFact(variables, injected.length);
	const databaseLine =
		database && injected.length > 0
			? `${countFormat.format(injected.length)} variabel lagi (${injected.join(', ')}) datang dari database ${database.name} saat deploy, tidak perlu diisi sendiri.`
			: null;
	return {
		id: 'variables',
		name: TOPOLOGY_COPY.variables,
		fact,
		mono: false,
		badge: null,
		activity: null,
		replicas: null,
		tone: 'neutral',
		detail: {
			body: [
				'Nilai yang dibaca aplikasimu saat berjalan, seperti alamat database atau API key. Perubahan berlaku setelah redeploy.',
				databaseLine
			].filter((line): line is string => line !== null),
			value: null,
			link: { label: TOPOLOGY_COPY.links.variables, target: 'variables' }
		}
	};
}

function releaseBlock(command: string | null): TopologyBlock {
	return {
		id: 'release_command',
		name: RELEASE_COMMAND_LABEL,
		fact: command ? TOPOLOGY_COPY.releaseSet : TOPOLOGY_COPY.releaseNone,
		mono: false,
		badge: null,
		activity: null,
		replicas: null,
		tone: 'neutral',
		detail: {
			body: [
				command
					? 'Dijalankan sekali setiap deployment, setelah build dan sebelum versi baru menerima trafik.'
					: 'Belum diatur. Isi kalau aplikasimu perlu menjalankan sesuatu sekali setiap deploy, misalnya migration database.'
			],
			value: command,
			link: { label: TOPOLOGY_COPY.links.release_command, target: 'release_command' }
		}
	};
}

/** Ready serves like the app does; the rest follow the database's own status tone. */
function databaseTone(status: string): TopologyTone {
	switch (status) {
		case 'provisioning':
			return 'running';
		case 'locked':
			return 'warning';
		case 'failed':
			return 'error';
		case 'deleting':
			return 'asleep';
		default:
			return 'neutral';
	}
}

function databaseBlock(
	database: ProjectDatabase,
	view: DatabaseStatusView,
	workspaceId: string | null
): TopologyBlock {
	const overridden = database.overridden_variables;
	return {
		id: 'database',
		name: TOPOLOGY_COPY.database,
		fact: database.name,
		mono: true,
		badge: { label: view.label, tone: view.tone },
		activity: null,
		replicas: null,
		tone: databaseTone(database.status),
		detail: {
			body: [
				view.description,
				`Aplikasi menerima ${DATABASE_VARIABLES[0]} dan variabel DB_* dari database ini saat deploy.`,
				overridden.length > 0
					? `Environment variable proyek menimpa ${overridden.join(', ')}, jadi nilai proyek yang dipakai.`
					: null
			].filter((line): line is string => line !== null),
			value: null,
			link: workspaceId
				? {
						label: TOPOLOGY_COPY.links.database,
						target: 'database',
						workspaceId,
						databaseId: database.id
					}
				: null
		}
	};
}

function attachedSentence(
	variables: VariablesState,
	command: string | null,
	database: { name: string; view: DatabaseStatusView; variableCount: number } | null
): string {
	const releasePart = command
		? 'menjalankan release command sebelum setiap versi baru menerima trafik'
		: 'belum punya release command';
	const databasePart = database
		? ` Aplikasi memakai database ${database.name}, statusnya ${database.view.label.toLowerCase()}, yang memberi ${countFormat.format(database.variableCount)} variabel koneksi.`
		: '';
	if (variables.state !== 'ready') return `Aplikasi ${releasePart}.${databasePart}`;
	const variablesPart =
		variables.count === 0
			? 'belum punya environment variable'
			: `memakai ${countFormat.format(variables.count)} environment variable`;
	return `Aplikasi ${variablesPart} dan ${releasePart}.${databasePart}`;
}

/**
 * The project's canvas, from what the API reports and the header already derived: the network a
 * visit enters, the region that runs the app, and what is attached to the app.
 */
export function deriveTopology(
	project: Project,
	header: Pick<ProjectHeaderState, 'kind' | 'badge' | 'serving'> &
		Partial<Pick<ProjectHeaderState, 'activity'>>,
	variables: VariablesState,
	options: TopologyOptions
): Topology {
	const kind = header.kind;
	const beforeFirst = isBeforeFirstVersion(project, kind);
	const serving = header.serving || SERVING_KINDS.includes(kind);
	const asleep = kind === 'sleeping';
	const publicUrl = getProjectPublicUrl(project);
	const defaultDomain = publicUrl ? getPublicUrlLabel(publicUrl) : project.default_domain || null;
	const customDomain = (defaultDomain && options.customDomain) || null;
	const domain = customDomain ?? defaultDomain;
	const port = getPortDisplay(project).current;
	const cells = deriveReplicaCells(project, serving);
	const command = project.release_command?.trim() || null;
	// A project uses one database at a time; the API sends a list of at most one.
	const attachedDatabase = project.databases?.[0] ?? null;
	const databaseView = attachedDatabase
		? databaseStatusView({ status: attachedDatabase.status, last_failure: null })
		: null;

	const address: TopologyBlock = {
		id: 'address',
		name: TOPOLOGY_COPY.address,
		fact: domain ?? TOPOLOGY_COPY.noAddress,
		mono: domain !== null,
		badge: null,
		activity: null,
		replicas: null,
		tone: 'neutral',
		detail: {
			body: customDomain
				? [TOPOLOGY_COPY.customAddress(defaultDomain!)]
				: [addressNote(kind, beforeFirst)],
			value: domain,
			link: { label: TOPOLOGY_COPY.links.address, target: 'address' }
		}
	};
	const edge: TopologyBlock = {
		id: 'edge',
		name: TOPOLOGY_COPY.edge,
		fact: kind === 'suspended' ? TOPOLOGY_COPY.edgeCut : TOPOLOGY_COPY.edgeActive,
		mono: false,
		badge: null,
		activity: null,
		replicas: null,
		tone: 'neutral',
		detail: { body: [TOPOLOGY_COPY.edgeDetail], value: null, link: null }
	};
	const node: TopologyBlock = {
		id: 'node',
		name: TOPOLOGY_COPY.node,
		fact: project.region || TOPOLOGY_COPY.regionAuto,
		mono: Boolean(project.region),
		badge: null,
		activity: null,
		replicas: null,
		tone: asleep ? 'asleep' : 'neutral',
		detail: {
			body: [
				TOPOLOGY_COPY.nodeDetail,
				project.region
					? `Proyek ini berjalan di region ${project.region}.`
					: 'Region-nya dipilih otomatis oleh Sakala, mengikuti workspace atau node yang punya kapasitas.'
			],
			value: null,
			link: null
		}
	};
	const app: TopologyBlock = {
		id: 'app',
		name: TOPOLOGY_COPY.app,
		fact: `port ${port}`,
		mono: false,
		badge: { label: header.badge.label, tone: header.badge.variant },
		activity: header.activity
			? { label: header.activity.label, tone: header.activity.variant }
			: null,
		replicas: cells,
		tone: appTone(kind, cells, serving),
		detail: {
			body: [
				appExplanation(kind, beforeFirst),
				replicaExplanation(cells),
				`Aplikasimu harus mendengarkan di port ${port}, yang juga ada di environment variable PORT.`
			].filter((line): line is string => line !== null),
			value: null,
			link: { label: TOPOLOGY_COPY.links.deployments, target: 'deployments' }
		}
	};

	return {
		path: [
			{
				id: 'network',
				label: TOPOLOGY_COPY.groups.network,
				blocks: options.edge ? [address, edge] : [address]
			},
			{ id: 'region', label: regionLabel(project.region), blocks: [node, app] }
		],
		attached: {
			id: 'attached',
			label: TOPOLOGY_COPY.groups.attached,
			blocks: [
				...(attachedDatabase && databaseView
					? [databaseBlock(attachedDatabase, databaseView, project.workspace?.id ?? null)]
					: []),
				variablesBlock(variables, attachedDatabase),
				releaseBlock(command)
			]
		},
		asleep,
		summary: `${pathSentence(kind, beforeFirst, {
			domain: domain ?? 'alamat proyek',
			edge: options.edge,
			region: project.region,
			port,
			replicas: serving ? sentenceReplicas(cells) : null
		})} ${attachedSentence(
			variables,
			command,
			attachedDatabase && databaseView
				? {
						name: attachedDatabase.name,
						view: databaseView,
						variableCount: databaseVariableNames(attachedDatabase).length
					}
				: null
		)}`
	};
}

type SentenceFacts = {
	domain: string;
	edge: boolean;
	region: string | null | undefined;
	port: number;
	/** `2 dari 3 replika sehat`, only while a version serves. */
	replicas: string | null;
};

/** The path in words, in the order of the blocks. */
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
			return `${visit}, tempat aplikasi sedang tidur. Kunjungan pertama membangunkannya, jadi pengunjung itu menunggu sebentar, biasanya ${WAKE_ESTIMATE}.`;
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
