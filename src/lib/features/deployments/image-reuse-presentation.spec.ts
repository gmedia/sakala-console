import { describe, expect, it } from 'vitest';
import { BUILT_FROM_SCRATCH, type DeploymentBuild } from '$lib/api/resources/deployment-build';
import type { DeploymentEvent } from '$lib/api/resources/deployment';
import {
	getFallbackNoteSegments,
	getImageBuildState,
	getReuseRowLabel,
	getReusedStepSegments,
	IMAGE_REUSE_SKIPPED_EVENT,
	segmentsToText
} from './image-reuse-presentation';

const SOURCE_ID = 'dep-12';

const reused: DeploymentBuild = {
	mode: 'reused',
	image_source_deployment_id: SOURCE_ID,
	image_source_sequence: 12,
	fallback_reason: null
};

const fallback: DeploymentBuild = {
	mode: 'built',
	image_source_deployment_id: SOURCE_ID,
	image_source_sequence: 12,
	fallback_reason: 'image_missing'
};

function skippedEvent(reason: unknown): DeploymentEvent {
	return {
		sequence: 3,
		level: 'warning',
		type: IMAGE_REUSE_SKIPPED_EVENT,
		message: 'Image tidak ditemukan',
		metadata: { source_deployment_id: SOURCE_ID, reason },
		occurred_at: '2026-11-19T10:00:00Z'
	};
}

describe('getImageBuildState', () => {
	it('reads a deployment from before image reuse, or one without the field, as built', () => {
		expect(getImageBuildState(BUILT_FROM_SCRATCH)).toEqual({ kind: 'built' });
		expect(getImageBuildState(undefined)).toEqual({ kind: 'built' });
	});

	it('names the deployment whose image a reused deployment runs', () => {
		expect(getImageBuildState(reused)).toEqual({
			kind: 'reused',
			source: { deploymentId: SOURCE_ID, sequence: 12 }
		});
	});

	it('reads a build with a fallback reason as a fallback, with that reason', () => {
		expect(getImageBuildState(fallback)).toEqual({
			kind: 'fallback',
			source: { deploymentId: SOURCE_ID, sequence: 12 },
			reason: 'image_missing'
		});
	});

	it('takes the agent event as a fallback before the refreshed deployment arrives', () => {
		expect(getImageBuildState(reused, [skippedEvent('image_not_owned')])).toEqual({
			kind: 'fallback',
			source: { deploymentId: SOURCE_ID, sequence: 12 },
			reason: 'image_not_owned'
		});
	});

	it('reads a reason it does not know as image_unavailable', () => {
		expect(getImageBuildState(reused, [skippedEvent('disk_on_fire')])).toMatchObject({
			kind: 'fallback',
			reason: 'image_unavailable'
		});
	});
});

describe('the step of a reused image', () => {
	it('links the source deployment number inside the sentence', () => {
		const segments = getReusedStepSegments({ deploymentId: SOURCE_ID, sequence: 12 });

		expect(segmentsToText(segments)).toBe('Memakai image dari deployment #12 (tanpa build)');
		expect(segments.filter((segment) => segment.deploymentId)).toEqual([
			{ text: '#12', deploymentId: SOURCE_ID }
		]);
	});

	it('says the source deployment was deleted, without a link', () => {
		const segments = getReusedStepSegments({ deploymentId: null, sequence: null });

		expect(segmentsToText(segments)).toBe(
			'Memakai image dari deployment yang sudah dihapus (tanpa build)'
		);
		expect(segments.some((segment) => segment.deploymentId)).toBe(false);
	});
});

describe('the fallback note', () => {
	const source = { deploymentId: SOURCE_ID, sequence: 12 };

	it('says the image is gone from the server, so Sakala built from scratch', () => {
		expect(segmentsToText(getFallbackNoteSegments(source, 'image_missing'))).toBe(
			'Image dari deployment #12 sudah tidak ada di server, jadi Sakala menjalankan build dari awal.'
		);
	});

	it('says an image from before this release cannot be reused', () => {
		expect(segmentsToText(getFallbackNoteSegments(source, 'image_metadata_missing'))).toBe(
			'Image dari deployment #12 dibuat sebelum Sakala bisa memakai ulang image, jadi Sakala menjalankan build dari awal.'
		);
	});

	it('keeps any other reason plain', () => {
		expect(segmentsToText(getFallbackNoteSegments(source, 'image_not_owned'))).toBe(
			'Image dari deployment #12 tidak bisa dipakai ulang, jadi Sakala menjalankan build dari awal.'
		);
	});

	it('speaks of the previous deployment when the source was deleted', () => {
		const segments = getFallbackNoteSegments(
			{ deploymentId: null, sequence: null },
			'image_missing'
		);
		expect(segmentsToText(segments)).toBe(
			'Image dari deployment sebelumnya sudah tidak ada di server, jadi Sakala menjalankan build dari awal.'
		);
		expect(segments.some((segment) => segment.deploymentId)).toBe(false);
	});

	it('says a rollback builds the old commit again, linking the image it planned to use', () => {
		const segments = getFallbackNoteSegments(source, 'image_missing', { rollback: true });
		expect(segmentsToText(segments)).toBe(
			'Image #12 sudah tidak ada di server, jadi Sakala build ulang commit ini.'
		);
		expect(segments.find((segment) => segment.deploymentId)?.text).toBe('#12');
	});

	it('speaks of this version when the image source of a rollback was deleted', () => {
		expect(
			segmentsToText(
				getFallbackNoteSegments({ deploymentId: null, sequence: null }, 'image_missing', {
					rollback: true
				})
			)
		).toBe('Image versi ini sudah tidak ada di server, jadi Sakala build ulang commit ini.');
	});
});

describe('getReuseRowLabel', () => {
	it('labels a reused deployment with its image source', () => {
		expect(getReuseRowLabel(reused)).toEqual({
			label: 'Tanpa build · image #12',
			accessible: 'tanpa build, memakai image deployment #12'
		});
	});

	it('keeps the label short when the source was deleted', () => {
		expect(
			getReuseRowLabel({ ...reused, image_source_deployment_id: null, image_source_sequence: null })
		).toEqual({
			label: 'Tanpa build',
			accessible: 'tanpa build, memakai image deployment yang sudah dihapus'
		});
	});

	it('gives a built deployment, a fallback, or an older API no label', () => {
		expect(getReuseRowLabel(BUILT_FROM_SCRATCH)).toBeNull();
		expect(getReuseRowLabel(fallback)).toBeNull();
		expect(getReuseRowLabel(undefined)).toBeNull();
	});
});
