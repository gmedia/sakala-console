import { useQueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import { queryKeys } from '$lib/api/query-keys';
import { createWakeProjectMutation } from '../mutations';
import { getProjectWakeErrorMessage, PROJECT_WAKE_COPY } from '../presentation';
import { projectKeys } from '../queries';
import type { Project } from '../type';

/**
 * Between the 202 and the node's report nothing announces the wake without realtime, and idle
 * polling waits a minute. The header re-reads only the project, so 12 reads a minute stay well
 * inside `throttle:api` (60 a minute, shared with the page).
 */
export const WAKE_REFRESH_MS = 5_000;
/** A wake the node never finishes (a full node, for example) leaves it to the regular polling. */
export const WAKE_REFRESH_LIMIT_MS = 2 * 60_000;

/** Bangunkan from the project header: asks the API, then follows the project until it is up. */
export function useProjectWake(project: () => Pick<Project, 'id' | 'runtime_status'>) {
	const client = useQueryClient();
	const wake = createWakeProjectMutation();

	let errorMessage = $state('');
	let requestedAt = $state<number | null>(null);
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	const sleeping = $derived(project().runtime_status === 'sleeping');
	const awaitingNode = $derived(requestedAt !== null && sleeping);
	const isWaking = $derived(wake.isPending || awaitingNode);

	$effect(() => {
		if (!awaitingNode || requestedAt === null) return;
		const id = project().id;
		const started = requestedAt;
		const timer = setInterval(() => {
			if (Date.now() - started >= WAKE_REFRESH_LIMIT_MS) {
				requestedAt = null;
				return;
			}
			void client.invalidateQueries({ queryKey: projectKeys.detail(id), exact: true });
		}, WAKE_REFRESH_MS);
		return () => clearInterval(timer);
	});

	// Awake now: the slot it took shows in the workspace limits, and a later sleep starts fresh.
	$effect(() => {
		if (sleeping || requestedAt === null) return;
		requestedAt = null;
		void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
	});

	function trigger() {
		if (submitting || isWaking) return;

		submitting = true;
		errorMessage = '';
		wake.mutate(project().id, {
			onSuccess: () => {
				requestedAt = Date.now();
				toast.success(PROJECT_WAKE_COPY.requested);
			},
			onError: (error) => {
				errorMessage = getProjectWakeErrorMessage(error) ?? '';
			},
			onSettled: () => {
				submitting = false;
			}
		});
	}

	return {
		trigger,
		get isWaking() {
			return isWaking;
		},
		get errorMessage() {
			return errorMessage;
		}
	};
}
