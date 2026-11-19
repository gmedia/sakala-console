import { describe, expect, it } from 'vitest';
import { baseProject, failedDeployment } from '../../../../../tests/e2e/fixtures/project-detail';
import { deriveProjectHeaderState } from '../presentation';
import type { Deployment, Project } from '../type';
import {
	deriveReplicaCells,
	deriveTopology,
	getAddressAvailability,
	TOPOLOGY_COPY,
	type Topology,
	type TopologyBlockId,
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

const block = (topology: Topology, id: TopologyBlockId) =>
	[...topology.path, topology.attached]
		.flatMap((group) => group.blocks)
		.find((item) => item.id === id);

describe('the canvas groups', () => {
	it('puts the address and Sakala Edge in Jaringan, then the node and app in their region', () => {
		const topology = topologyOf();
		expect(topology.path.map((group) => group.label)).toEqual(['Jaringan', 'Region otomatis']);
		expect(topology.path.map((group) => group.blocks.map((item) => item.id))).toEqual([
			['address', 'edge'],
			['node', 'app']
		]);
		expect(topology.attached.label).toBe('Terpasang');
	});

	it('names the region group and the node by the region slug when the project has one', () => {
		const topology = topologyOf({ region: 'id-jkt' });
		expect(topology.path[1].label).toBe('Region id-jkt');
		expect(block(topology, 'node')).toMatchObject({ fact: 'id-jkt', mono: true });
		expect(block(topologyOf(), 'node')).toMatchObject({ fact: 'otomatis', mono: false });
	});

	it('leaves Sakala Edge out of the blocks and the description when the install has none', () => {
		const topology = topologyOf({}, { edge: false });
		expect(topology.path[0].blocks.map((item) => item.id)).toEqual(['address']);
		expect(topology.summary).not.toContain('Sakala Edge');
	});

	it('never stands in for a database the API does not report', () => {
		expect(topologyOf().attached.blocks.map((item) => item.id)).toEqual([
			'variables',
			'release_command'
		]);
		expect(topologyOf({ databases: [] }).attached.blocks).toHaveLength(2);
	});

	it('puts the attached database first in Terpasang, with its status and a link to its page', () => {
		const topology = topologyOf({
			databases: [
				{
					id: 'db-1',
					name: 'toko-kopi-db',
					status: 'locked',
					region: 'jkt',
					variables: ['DATABASE_URL'],
					overridden_variables: ['DB_HOST']
				}
			]
		});
		expect(topology.attached.blocks.map((item) => item.id)).toEqual([
			'database',
			'variables',
			'release_command'
		]);
		const database = block(topology, 'database');
		expect(database).toMatchObject({
			fact: 'toko-kopi-db',
			mono: true,
			badge: { label: 'Terkunci', tone: 'warning' },
			tone: 'warning'
		});
		expect(database?.detail.link).toEqual({
			label: TOPOLOGY_COPY.links.database,
			target: 'database',
			workspaceId: baseProject.workspace.id,
			databaseId: 'db-1'
		});
		expect(database?.detail.body.join(' ')).toContain('menimpa DB_HOST');
		expect(topology.summary).toContain('memakai database toko-kopi-db, statusnya terkunci');
	});

	it('counts the database variables apart from the project ones, without the overridden ones', () => {
		const attached = {
			id: 'db-1',
			name: 'toko-kopi-db',
			status: 'ready',
			region: 'jkt',
			variables: [
				'DATABASE_URL',
				'DB_CONNECTION',
				'DB_HOST',
				'DB_PORT',
				'DB_DATABASE',
				'DB_USERNAME',
				'DB_PASSWORD'
			],
			overridden_variables: ['DB_HOST']
		};
		const topology = topologyOf(
			{ databases: [attached] },
			{ variables: { state: 'ready', count: 1 } }
		);
		const variables = block(topology, 'variables');
		expect(variables?.fact).toBe('1 variabel + 6 dari database');
		expect(variables?.detail.body.join(' ')).toContain(
			'6 variabel lagi (DATABASE_URL, DB_CONNECTION, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD) datang dari database toko-kopi-db'
		);
		expect(topology.summary).toContain('yang memberi 6 variabel koneksi');

		const onlyDatabase = topologyOf(
			{ databases: [{ ...attached, overridden_variables: [] }] },
			{ variables: { state: 'ready', count: 0 } }
		);
		expect(block(onlyDatabase, 'variables')?.fact).toBe('7 dari database');
	});
});

describe('a deploy over a live version', () => {
	it('keeps the app block Live, with the new version as a second badge', () => {
		const topology = topologyOf(
			{ runtime_status: 'running' },
			{ deployments: [{ ...failedDeployment, id: 'dep_new', sequence: 99, status: 'building' }] }
		);
		expect(block(topology, 'app')).toMatchObject({
			badge: { label: 'Live', tone: 'success' },
			activity: { label: 'Men-deploy versi baru', tone: 'running' },
			tone: 'live'
		});
	});
});

describe('one fact per block', () => {
	it('gives the hostname, Edge active, the port, the variable count, and whether a release command is set', () => {
		const topology = topologyOf({ release_command: 'php artisan migrate --force' });
		expect(block(topology, 'address')).toMatchObject({
			fact: 'toko-kopi-web.sakala.app',
			mono: true
		});
		expect(block(topology, 'edge')?.fact).toBe(TOPOLOGY_COPY.edgeActive);
		expect(block(topology, 'app')).toMatchObject({
			fact: 'port 3000',
			badge: { label: 'Live', tone: 'success' }
		});
		expect(block(topology, 'variables')?.fact).toBe('3 variabel');
		expect(block(topology, 'release_command')?.fact).toBe('diatur');
		expect(block(topology, 'release_command')?.detail.value).toBe('php artisan migrate --force');
	});

	it('reads an absence as an absence, and does not claim a count it has not read', () => {
		expect(block(topologyOf({ release_command: '  ' }), 'release_command')?.fact).toBe(
			'belum diatur'
		);
		expect(
			block(topologyOf({}, { variables: { state: 'ready', count: 0 } }), 'variables')?.fact
		).toBe('belum ada');
		expect(block(topologyOf({}, { variables: { state: 'loading' } }), 'variables')?.fact).toBe(
			TOPOLOGY_COPY.variablesLoading
		);
		expect(block(topologyOf({}, { variables: { state: 'error' } }), 'variables')?.fact).toBe(
			TOPOLOGY_COPY.variablesError
		);
	});

	it('moves the explanations into the details, each with the place to act', () => {
		const topology = topologyOf();
		expect(block(topology, 'app')?.detail.link).toEqual({
			label: 'Lihat riwayat',
			target: 'deployments'
		});
		expect(block(topology, 'variables')?.detail.link?.target).toBe('variables');
		expect(block(topology, 'release_command')?.detail.link?.target).toBe('release_command');
		expect(block(topology, 'address')?.detail.link?.target).toBe('address');
		// Nothing to change about Edge or the node from the Console.
		expect(block(topology, 'edge')?.detail.link).toBeNull();
		expect(block(topology, 'node')?.detail.link).toBeNull();
	});

	it('says Edge cuts traffic for a suspended project', () => {
		const topology = topologyOf({
			status: 'suspended',
			suspension: { reason: null, suspended_at: null }
		});
		expect(block(topology, 'edge')?.fact).toBe(TOPOLOGY_COPY.edgeCut);
		expect(block(topology, 'app')?.badge?.label).toBe('Ditangguhkan');
		expect(topology.summary).toMatch(/^Proyek ini ditangguhkan/);
	});
});

describe('replica cells', () => {
	it('fills one teal cell per healthy replica, and marks the rest not ready', () => {
		expect(deriveReplicaCells({ serving_replicas: 3, replicas_ready: 2 }, true)).toEqual({
			cells: ['ready', 'ready', 'unready'],
			label: '2/3',
			accessibleLabel: '2 dari 3 replika sehat'
		});
	});

	it('draws outlines without a health claim before the node reports', () => {
		expect(deriveReplicaCells({ serving_replicas: 2, replicas_ready: null }, true)).toEqual({
			cells: ['unknown', 'unknown'],
			label: '2',
			accessibleLabel: '2 replika, kesehatannya belum dilaporkan'
		});
	});

	it('draws the setting as idle cells while nothing runs', () => {
		expect(deriveReplicaCells({ replicas: 3, serving_replicas: null }, false)).toEqual({
			cells: ['idle', 'idle', 'idle'],
			label: '3',
			accessibleLabel: '3 replika diatur, tidak ada yang berjalan'
		});
		// An API from before replicas: one container.
		expect(deriveReplicaCells({}, false).cells).toEqual(['idle']);
	});

	it('never draws more ready cells than replicas, nor fewer than none', () => {
		expect(deriveReplicaCells({ serving_replicas: 2, replicas_ready: 5 }, true).label).toBe('2/2');
		expect(deriveReplicaCells({ serving_replicas: 2, replicas_ready: -1 }, true).cells).toEqual([
			'unready',
			'unready'
		]);
	});
});

describe('the app block by state', () => {
	it('is live with every replica healthy', () => {
		const app = block(topologyOf({ serving_replicas: 3, replicas_ready: 3 }), 'app');
		expect(app?.tone).toBe('live');
		expect(app?.replicas?.label).toBe('3/3');
		expect(app?.detail.body).toContain(
			'Semua replika lolos health check, dan pengunjung dibagi di antaranya.'
		);
	});

	it('warns when some replicas fail the health check, and says how many', () => {
		const topology = topologyOf({ serving_replicas: 3, replicas_ready: 1 });
		const app = block(topology, 'app');
		expect(app?.tone).toBe('warning');
		expect(app?.detail.body).toContain(
			'2 replika belum lolos health check. Pengunjung dilayani replika yang sehat.'
		);
		expect(topology.summary).toContain('1 dari 3 replika sehat');
	});

	it('dims the runtime and keeps the network awake while the app sleeps', () => {
		const topology = topologyOf({ runtime_status: 'sleeping', replicas: 2 });
		expect(topology.asleep).toBe(true);
		expect(block(topology, 'app')?.tone).toBe('asleep');
		expect(block(topology, 'node')?.tone).toBe('asleep');
		expect(block(topology, 'edge')?.tone).toBe('neutral');
		expect(block(topology, 'app')?.replicas?.cells).toEqual(['idle', 'idle']);
		expect(block(topology, 'app')?.detail.body[0]).toMatch(/Kunjungan pertama membangunkannya/);
		expect(topology.summary).toContain('tempat aplikasi sedang tidur');
	});

	it('marks a failed first deploy as an error and describes the path as a future', () => {
		const topology = topologyOf(
			{ runtime_status: 'failed', status: 'draft', active_deployment_id: null },
			{ deployments: [failedDeployment] }
		);
		expect(block(topology, 'app')?.tone).toBe('error');
		expect(topology.summary).toMatch(/^Setelah deploy pertama berhasil, pengunjung/);
	});

	it('says the previous version serves when only the newest attempt failed', () => {
		const topology = topologyOf({}, { deployments: [failedDeployment] });
		expect(block(topology, 'app')?.tone).toBe('warning');
		expect(topology.summary).toContain(
			'Deploy terakhir gagal, jadi versi sebelumnya yang melayani.'
		);
	});

	it('describes a never-deployed project in words for screen readers', () => {
		const topology = topologyOf({
			runtime_status: 'not_deployed',
			status: 'draft',
			active_deployment_id: null,
			serving_replicas: null
		});
		expect(block(topology, 'app')?.badge?.label).toBe('Belum deploy');
		expect(topology.summary).toBe(
			'Setelah deploy pertama berhasil, pengunjung yang membuka toko-kopi-web.sakala.app diteruskan Sakala Edge ke node di region yang dipilih otomatis, lalu ke aplikasi di port 3000. Aplikasi memakai 3 environment variable dan belum punya release command.'
		);
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
