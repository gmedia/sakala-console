import type { DeploymentEvent } from '$lib/api/resources/deployment';
import {
	toFallbackReason,
	type DeploymentBuild,
	type DeploymentBuildFallbackReason
} from '$lib/api/resources/deployment-build';

/** Sent by the agent instead of the checkout, analysis, and build events when it reused the image. */
export const IMAGE_REUSED_EVENT = 'deployment.image.reused';
/** Sent by the agent before the checkout when the planned image could not be used, so it builds. */
export const IMAGE_REUSE_SKIPPED_EVENT = 'deployment.image.reuse_skipped';

/** The deployment that built the image. Both are null once that deployment was deleted. */
export type ImageSource = { deploymentId: string | null; sequence: number | null };

export type ImageBuildState =
	| { kind: 'built' }
	| { kind: 'reused'; source: ImageSource }
	| { kind: 'fallback'; source: ImageSource; reason: DeploymentBuildFallbackReason };

/** A piece of a sentence. The one with `deploymentId` names the source deployment and links to it. */
export type ImageSourceSegment = { text: string; deploymentId?: string };

export const IMAGE_REUSE_COPY = {
	stepLead: 'Memakai image dari deployment',
	stepTail: '(tanpa build)',
	stepSourceDeleted: 'Memakai image dari deployment yang sudah dihapus (tanpa build)',
	noteLead: 'Image dari deployment',
	noteSourceDeleted: 'Image dari deployment sebelumnya',
	noteOutcome: 'jadi Sakala menjalankan build dari awal.',
	/** A rollback that could not reuse its image builds the old commit again. */
	rollbackNoteLead: 'Image',
	rollbackNoteSourceDeleted: 'Image versi ini',
	rollbackNoteOutcome: 'jadi Sakala build ulang commit ini.',
	rowLabel: 'Tanpa build',
	rowSource: 'image',
	/** For a screen reader, which reads the dot as nothing or as a symbol. */
	rowAccessible: 'tanpa build, memakai image deployment',
	rowAccessibleSourceDeleted: 'tanpa build, memakai image deployment yang sudah dihapus'
} as const;

/** Why the image could not be reused, in the words of the note. */
const FALLBACK_REASON_COPY: Record<DeploymentBuildFallbackReason, string> = {
	image_missing: 'sudah tidak ada di server',
	image_metadata_missing: 'dibuat sebelum Sakala bisa memakai ulang image',
	image_not_owned: 'tidak bisa dipakai ulang',
	invalid_reference: 'tidak bisa dipakai ulang',
	image_unavailable: 'tidak bisa dipakai ulang'
};

/**
 * Reuse or build, by the deployment and its events. An agent event can arrive before the refreshed
 * deployment does, so a `reuse_skipped` event already makes a planned reuse a fallback.
 */
export function getImageBuildState(
	build: DeploymentBuild | null | undefined,
	events: readonly DeploymentEvent[] = []
): ImageBuildState {
	const source: ImageSource = {
		deploymentId: build?.image_source_deployment_id ?? null,
		sequence: build?.image_source_sequence ?? null
	};
	const skipped = events.findLast((event) => event.type === IMAGE_REUSE_SKIPPED_EVENT);

	if (build?.fallback_reason) {
		return { kind: 'fallback', source, reason: build.fallback_reason };
	}
	if (skipped) {
		return { kind: 'fallback', source, reason: toFallbackReason(skipped.metadata?.reason) };
	}
	if (build?.mode === 'reused') return { kind: 'reused', source };
	return { kind: 'built' };
}

function sourceRef(source: ImageSource): ImageSourceSegment | null {
	if (source.sequence === null) return null;
	const text = `#${source.sequence}`;
	return source.deploymentId ? { text, deploymentId: source.deploymentId } : { text };
}

/** The timeline step that stands in for checkout, analysis, and build. */
export function getReusedStepSegments(source: ImageSource): ImageSourceSegment[] {
	const ref = sourceRef(source);
	if (!ref) return [{ text: IMAGE_REUSE_COPY.stepSourceDeleted }];
	return [
		{ text: `${IMAGE_REUSE_COPY.stepLead} ` },
		ref,
		{ text: ` ${IMAGE_REUSE_COPY.stepTail}` }
	];
}

/**
 * Says calmly why a planned reuse built after all: a fallback is normal, not a failure. A rollback
 * says it builds the old commit again ("Image #3 sudah tidak ada di server, jadi Sakala build ulang
 * commit ini.").
 */
export function getFallbackNoteSegments(
	source: ImageSource,
	reason: DeploymentBuildFallbackReason,
	options: { rollback?: boolean } = {}
): ImageSourceSegment[] {
	const outcome = options.rollback
		? IMAGE_REUSE_COPY.rollbackNoteOutcome
		: IMAGE_REUSE_COPY.noteOutcome;
	const tail = ` ${FALLBACK_REASON_COPY[reason]}, ${outcome}`;
	const ref = sourceRef(source);
	if (!ref) {
		const lead = options.rollback
			? IMAGE_REUSE_COPY.rollbackNoteSourceDeleted
			: IMAGE_REUSE_COPY.noteSourceDeleted;
		return [{ text: `${lead}${tail}` }];
	}
	const lead = options.rollback ? IMAGE_REUSE_COPY.rollbackNoteLead : IMAGE_REUSE_COPY.noteLead;
	return [{ text: `${lead} ` }, ref, { text: tail }];
}

export function segmentsToText(segments: readonly ImageSourceSegment[]): string {
	return segments.map((segment) => segment.text).join('');
}

/** The short label of a reused deployment in a list, or null for one that was built. */
export function getReuseRowLabel(
	build: DeploymentBuild | null | undefined
): { label: string; accessible: string } | null {
	if (build?.mode !== 'reused') return null;
	const sequence = build.image_source_sequence;
	if (sequence === null) {
		return {
			label: IMAGE_REUSE_COPY.rowLabel,
			accessible: IMAGE_REUSE_COPY.rowAccessibleSourceDeleted
		};
	}
	return {
		label: `${IMAGE_REUSE_COPY.rowLabel} · ${IMAGE_REUSE_COPY.rowSource} #${sequence}`,
		accessible: `${IMAGE_REUSE_COPY.rowAccessible} #${sequence}`
	};
}
