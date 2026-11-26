import { describe, expect, it } from 'vitest';
import {
	getReplicaHealth,
	maxReplicasOf,
	MIN_REPLICAS,
	REPLICAS_COPY,
	replicasAvailable,
	replicasHint,
	replicasOf,
	replicasSchema
} from './replicas';

describe('replica health in the header', () => {
	it('says nothing for a single container', () => {
		expect(getReplicaHealth({ serving_replicas: 1, replicas_ready: 1 })).toBeNull();
	});

	it('says nothing when nothing serves, or for an API without replicas', () => {
		expect(getReplicaHealth({ serving_replicas: null, replicas_ready: null })).toBeNull();
		expect(getReplicaHealth({})).toBeNull();
	});

	it('reads calm when every replica passes the health check', () => {
		expect(getReplicaHealth({ serving_replicas: 3, replicas_ready: 3 })).toEqual({
			label: '3/3 replika sehat',
			tone: 'neutral'
		});
	});

	it('warns only when fewer replicas are ready than the deployment runs', () => {
		expect(getReplicaHealth({ serving_replicas: 3, replicas_ready: 2 })).toEqual({
			label: '2/3 replika sehat',
			tone: 'warning'
		});
	});

	it('gives the count without a health claim before the node reports', () => {
		expect(getReplicaHealth({ serving_replicas: 3, replicas_ready: null })).toEqual({
			label: '3 replika',
			tone: 'neutral'
		});
	});
});

describe('the replicas setting', () => {
	it('defaults to one replica for an API that does not report the fields', () => {
		expect(maxReplicasOf({})).toBe(MIN_REPLICAS);
		expect(replicasOf({})).toBe(MIN_REPLICAS);
		expect(maxReplicasOf({ max_replicas: 4 })).toBe(4);
	});

	it('is only available when the workspace allows more than one', () => {
		expect(replicasAvailable(1)).toBe(false);
		expect(replicasAvailable(2)).toBe(true);
		expect(replicasHint(1)).toBe(REPLICAS_COPY.shortUnavailable);
		expect(replicasHint(3)).toBe('Paling banyak 3 di workspace ini.');
	});

	it('accepts whole numbers from 1 to the workspace maximum', () => {
		const schema = replicasSchema(3);
		expect(schema.parse('1')).toBe(1);
		expect(schema.parse(' 3 ')).toBe(3);
		for (const value of ['0', '4', '', '2.5', '-1', 'dua']) {
			expect(schema.safeParse(value).error?.issues[0]?.message).toBe(
				'Isi jumlah replika dengan bilangan bulat 1 sampai 3.'
			);
		}
	});
});
