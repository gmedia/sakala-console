import { useQueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import { ApiError } from '$lib/api/errors';
import { createRestartProjectMutation } from '../mutations';
import { projectKeys } from '../queries';
import {
	canRestart,
	getRestartErrorMessage,
	isRestartPending,
	RESTART_COPY,
	RESTART_OUTCOMES,
	type RestartOutcome
} from '../restart';
import type { Project } from '../type';

/** Same pace and limit as a wake: the node reports back in seconds, polling is only the fallback. */
export const RESTART_REFRESH_MS = 5_000;
export const RESTART_REFRESH_LIMIT_MS = 2 * 60_000;

type RestartProject = Pick<Project, 'id' | 'runtime_status' | 'status'> &
	Partial<Pick<Project, 'restart' | 'active_deployment_id'>>;

/**
 * Restart from the project header: a confirmation, the request, then the project's `restart` until
 * the node reports back. The broadcast at the end says how it went and refreshes the project;
 * without realtime the project is read again every few seconds, which only shows that the restart
 * is no longer open, so nothing is claimed then.
 */
export function useProjectRestart(
	project: () => RestartProject,
	outcome: () => RestartOutcome | null = () => null
) {
	const client = useQueryClient();
	const restart = createRestartProjectMutation();

	let dialogOpen = $state(false);
	let errorMessage = $state('');
	/** A restart the node could not do, said under the header. */
	let failureMessage = $state('');
	let followingSince = $state<number | null>(null);
	let idempotencyKey = '';
	/** The command this page asked for, so its end is recognised on the channel. */
	let commandId: string | null = null;
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	const pending = $derived(isRestartPending(project()));
	const available = $derived(canRestart(project()));

	$effect(() => {
		if (!pending || followingSince === null) return;
		const id = project().id;
		const started = followingSince;
		const timer = setInterval(() => {
			if (Date.now() - started >= RESTART_REFRESH_LIMIT_MS) {
				followingSince = null;
				return;
			}
			void client.invalidateQueries({ queryKey: projectKeys.detail(id), exact: true });
		}, RESTART_REFRESH_MS);
		return () => clearInterval(timer);
	});

	// The end of a restart this page asked for, as the broadcast tells it. One heard before this page
	// asked, or for another member's restart, is not this page's to announce.
	let announced: string | null = null;
	$effect(() => {
		const end = outcome();
		if (!end || end.commandId === announced) return;
		announced = end.commandId;
		if (commandId === null || end.commandId !== commandId) return;
		commandId = null;
		followingSince = null;
		if (end.outcome === RESTART_OUTCOMES.succeeded) toast.success(RESTART_COPY.done);
		else failureMessage = RESTART_COPY.failedOnNode;
	});

	function openDialog() {
		errorMessage = '';
		failureMessage = '';
		idempotencyKey = crypto.randomUUID();
		dialogOpen = true;
	}

	function closeDialog() {
		if (submitting) return;
		dialogOpen = false;
		errorMessage = '';
	}

	function confirm() {
		if (submitting) return;
		submitting = true;
		errorMessage = '';
		restart.mutate(
			{ projectId: project().id, idempotencyKey },
			{
				onSuccess: (control) => {
					commandId = control.command?.id ?? null;
					dialogOpen = false;
					followingSince = Date.now();
					toast.success(RESTART_COPY.requested);
				},
				onError: (error) => {
					errorMessage = getRestartErrorMessage(error);
					if (error instanceof ApiError) idempotencyKey = crypto.randomUUID();
				},
				onSettled: () => {
					submitting = false;
				}
			}
		);
	}

	return {
		openDialog,
		closeDialog,
		confirm,
		get dialogOpen() {
			return dialogOpen;
		},
		/** Offered: the project runs or crash-loops, and no restart is open. */
		get available() {
			return available;
		},
		/** A restart is open, or being asked for. */
		get pending() {
			return pending || restart.isPending;
		},
		get isSubmitting() {
			return restart.isPending;
		},
		get errorMessage() {
			return errorMessage;
		},
		get failureMessage() {
			return failureMessage;
		}
	};
}
