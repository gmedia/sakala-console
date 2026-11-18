import { z } from 'zod';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import type { Project } from './type';

/**
 * sakala-api `Project::DEFAULT_REPLICAS`: one container, the fewest a project runs, and what a
 * workspace without a `max_replicas` in its limit profile is held to.
 */
export const MIN_REPLICAS = 1;

export const REPLICAS_COPY = {
	label: 'Replika',
	help: 'Replika menjalankan beberapa salinan aplikasimu dan membagi pengunjung di antaranya. Cocok untuk aplikasi stateless: file atau sesi yang disimpan di disk container tidak ikut terbagi. Perubahan berlaku pada deploy berikutnya.',
	unavailable: 'Replika belum aktif untuk workspace ini.'
} as const;

/** The most replicas the project may run, `1` from an API that does not report it. */
export function maxReplicasOf(project: Pick<Project, 'max_replicas'>): number {
	return Math.max(MIN_REPLICAS, project.max_replicas ?? MIN_REPLICAS);
}

/** Whether the workspace allows more than one replica, which is when the setting means anything. */
export function replicasAvailable(maxReplicas: number): boolean {
	return maxReplicas > MIN_REPLICAS;
}

/** The project's setting, `1` from an API that does not report it. */
export function replicasOf(project: Pick<Project, 'replicas'>): number {
	return project.replicas ?? MIN_REPLICAS;
}

export function replicasRangeMessage(maxReplicas: number): string {
	return `Isi jumlah replika dengan bilangan bulat ${MIN_REPLICAS} sampai ${maxReplicas}.`;
}

/** The help under the field: the explanation, and the workspace's maximum when there is a choice. */
export function replicasHint(maxReplicas: number): string {
	return replicasAvailable(maxReplicas)
		? `${REPLICAS_COPY.help} Paling banyak ${maxReplicas} replika di workspace ini.`
		: REPLICAS_COPY.unavailable;
}

/**
 * The text of the field, checked against the workspace's maximum the way sakala-api's
 * UpdateProjectRequest does, which stays the final check.
 */
export function replicasSchema(maxReplicas: number) {
	return z
		.string()
		.trim()
		.refine(
			(value) =>
				/^\d+$/.test(value) && Number(value) >= MIN_REPLICAS && Number(value) <= maxReplicas,
			{ message: replicasRangeMessage(maxReplicas) }
		)
		.transform(Number);
}

export type ReplicaHealth = { label: string; tone: BadgeTone };

/**
 * How many replicas of the serving deployment pass the router's health check, for the header.
 * `null` for a single container, or when nothing serves, so the header says nothing extra. A node
 * that has not reported yet gets the count without a claim about health.
 */
export function getReplicaHealth(
	project: Pick<Project, 'serving_replicas' | 'replicas_ready'>
): ReplicaHealth | null {
	const desired = project.serving_replicas;
	if (desired == null || desired <= MIN_REPLICAS) return null;

	const ready = project.replicas_ready;
	if (ready == null) return { label: `${desired} replika`, tone: 'neutral' };

	return {
		label: `${ready}/${desired} replika sehat`,
		tone: ready < desired ? 'warning' : 'neutral'
	};
}
