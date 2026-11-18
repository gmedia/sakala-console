import { describe, expect, it } from 'vitest';
import { baseProject, failedDeployment } from '../../../../../tests/e2e/fixtures/project-detail';
import { deriveProjectHeaderState } from '../presentation';
import type { Deployment, Project } from '../type';
import {
	deriveTopology,
	getAddressAvailability,
	TOPOLOGY_COPY,
	type VariablesState
} from './topology';

const project = (overrides: Partial<Project> = {}) =>
	({ ...baseProject, ...overrides }) as unknown as Project;

const READY: VariablesState = { state: 'ready', count: 3 };

function topologyOf(
	overrides: Partial<Project> = {},
	options: { variables?: VariablesState; deployments?: unknown[]; edge?: boolean } = {}
) {
	const subject = project(overrides);
	const header = deriveProjectHeaderState(subject, (options.deployments ?? []) as Deployment[]);
	return deriveTopology(subject, header, options.variables ?? READY, {
		edge: options.edge ?? true
	});
}

const node = (topology: ReturnType<typeof topologyOf>, id: string) =>
	topology.path.find((item) => item.id === id);

describe('the visitor path', () => {
	it('runs address, Sakala Edge, node, app, in that order', () => {
		const topology = topologyOf();
		expect(topology.path.map((item) => item.id)).toEqual(['address', 'edge', 'node', 'app']);
		expect(node(topology, 'address')?.value).toBe('toko-kopi-web.sakala.app');
		expect(node(topology, 'edge')?.value).toBe(TOPOLOGY_COPY.edge);
	});

	it('leaves Sakala Edge out of the boxes and the sentence when the install has none', () => {
		const topology = topologyOf({}, { edge: false });
		expect(topology.path.map((item) => item.id)).toEqual(['address', 'node', 'app']);
		expect(topology.summary).not.toContain('Sakala Edge');
		expect(topology.summary).toContain('pengunjung diteruskan ke node');
	});

	it('names the region slug, or says placement picks one', () => {
		expect(node(topologyOf({ region: 'id-jkt' }), 'node')?.value).toBe('Region id-jkt');
		expect(node(topologyOf({ region: null }), 'node')?.value).toBe('Region otomatis');
		// An API from before regions sends no field at all.
		expect(node(topologyOf(), 'node')?.value).toBe('Region otomatis');
	});

	it('links only the boxes that have somewhere to go', () => {
		const targets = topologyOf().path.map((item) => item.target);
		expect(targets).toEqual(['address', null, null, 'deployments']);
	});
});

describe('the app box', () => {
	it('is Live with every replica healthy and the port that serves', () => {
		const app = node(
			topologyOf({ serving_replicas: 3, replicas_ready: 3, serving_port: 8080 }),
			'app'
		);
		expect(app?.badge).toEqual({ label: 'Live', tone: 'success' });
		expect(app?.facts).toEqual(['3/3 replika sehat', 'port 8080']);
		expect(app?.tone).toBe('live');
		expect(app?.detail).toBeNull();
	});

	it('warns, and says how many replicas fail the health check, when some do', () => {
		const app = node(topologyOf({ serving_replicas: 3, replicas_ready: 1 }), 'app');
		expect(app?.facts[0]).toBe('1/3 replika sehat');
		expect(app?.tone).toBe('warning');
		expect(app?.detail).toBe(
			'2 replika belum lolos health check. Pengunjung dilayani replika yang sehat.'
		);
	});

	it('gives a count without a health claim before the node reports', () => {
		const app = node(topologyOf({ serving_replicas: 2, replicas_ready: null }), 'app');
		expect(app?.facts[0]).toBe('2 replika');
		expect(app?.tone).toBe('live');
	});

	it('says a sleeping app wakes on the first visit, and keeps the replica setting', () => {
		const topology = topologyOf({ runtime_status: 'sleeping', replicas: 2 });
		const app = node(topology, 'app');
		expect(app?.badge?.label).toBe('Tidur');
		expect(app?.facts).toEqual(['Diatur 2 replika', 'port 3000']);
		expect(app?.detail).toBe('Kunjungan pertama membangunkannya.');
		expect(topology.summary).toContain('tempat aplikasi sedang tidur');
		expect(topology.summary).toContain('Kunjungan pertama membangunkannya');
	});

	it('marks a failed first deploy as an error, with nothing serving', () => {
		const topology = topologyOf(
			{ runtime_status: 'failed', status: 'draft', active_deployment_id: null },
			{ deployments: [failedDeployment] }
		);
		expect(node(topology, 'app')?.tone).toBe('error');
		expect(node(topology, 'app')?.detail).toBe(
			'Deploy terakhir gagal, belum ada versi yang melayani.'
		);
		expect(topology.summary).toMatch(/^Setelah deploy pertama berhasil, pengunjung/);
	});

	it('says the previous version serves when only the newest attempt failed', () => {
		const topology = topologyOf({}, { deployments: [failedDeployment] });
		expect(node(topology, 'app')?.tone).toBe('warning');
		expect(topology.summary).toContain(
			'Deploy terakhir gagal, jadi versi sebelumnya yang melayani.'
		);
	});

	it('describes the path as a future for a project never deployed', () => {
		const topology = topologyOf({
			runtime_status: 'not_deployed',
			status: 'draft',
			active_deployment_id: null,
			serving_replicas: null
		});
		expect(node(topology, 'app')?.badge?.label).toBe('Belum deploy');
		expect(node(topology, 'app')?.facts).toEqual(['port 3000']);
		expect(node(topology, 'address')?.detail).toBe('Bisa dibuka setelah deploy pertama berhasil.');
		expect(topology.summary).toBe(
			'Setelah deploy pertama berhasil, pengunjung yang membuka toko-kopi-web.sakala.app diteruskan Sakala Edge ke node di region yang dipilih otomatis, lalu ke aplikasi di port 3000. Aplikasi memakai 3 environment variable dan belum punya release command.'
		);
	});

	it('says a suspended project is cut off, whatever the runtime still does', () => {
		const topology = topologyOf({
			status: 'suspended',
			suspension: { reason: null, suspended_at: null }
		});
		expect(node(topology, 'app')?.badge?.label).toBe('Ditangguhkan');
		expect(topology.summary).toMatch(/^Proyek ini ditangguhkan/);
	});
});

describe('what is attached to the app', () => {
	it('counts variables and shows the release command', () => {
		const [variables, release] = topologyOf({
			release_command: 'php artisan migrate --force'
		}).attached;
		expect(variables).toMatchObject({ value: '3 variabel', empty: false, target: 'variables' });
		expect(release).toMatchObject({
			value: 'php artisan migrate --force',
			mono: true,
			empty: false,
			target: 'release_command'
		});
	});

	it('reads an absence as an absence', () => {
		const [variables, release] = topologyOf(
			{ release_command: '   ' },
			{ variables: { state: 'ready', count: 0 } }
		).attached;
		expect(variables).toMatchObject({ value: 'Belum ada', empty: true });
		expect(release).toMatchObject({ value: 'Belum diatur', empty: true, mono: false });
	});

	it('does not claim a count it has not read', () => {
		const loading = topologyOf({}, { variables: { state: 'loading' } });
		expect(loading.attached[0].value).toBe(TOPOLOGY_COPY.variablesLoading);
		expect(loading.summary).not.toContain('environment variable');
		const failed = topologyOf({}, { variables: { state: 'error' } });
		expect(failed.attached[0].value).toBe(TOPOLOGY_COPY.variablesError);
	});

	it('never stands in for a database the API does not report', () => {
		expect(topologyOf().attached.map((item) => item.id)).toEqual(['variables', 'release_command']);
	});
});

describe('whether the address opens', () => {
	const availability = (overrides: Partial<Project>, deployments: unknown[] = []) => {
		const subject = project(overrides);
		return getAddressAvailability(
			subject,
			deriveProjectHeaderState(subject, deployments as Deployment[])
		);
	};

	it('opens while live or asleep, since a visit wakes it', () => {
		expect(availability({}).reachable).toBe(true);
		expect(availability({ runtime_status: 'sleeping' }).reachable).toBe(true);
	});

	it('says why not before the first version, while stopped, and while suspended', () => {
		expect(availability({ runtime_status: 'not_deployed', active_deployment_id: null }).note).toBe(
			'Bisa dibuka setelah deploy pertama berhasil.'
		);
		expect(availability({ runtime_status: 'stopped' }).note).toMatch(/^Belum bisa dibuka/);
		expect(
			availability({ status: 'suspended', suspension: { reason: null, suspended_at: null } })
		).toEqual({ reachable: false, note: 'Tidak bisa dibuka selama proyek ditangguhkan.' });
	});
});
