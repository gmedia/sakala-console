import { goto } from '$app/navigation';
import { resolveRoute } from '$app/paths';
import { toast } from 'svelte-sonner';
import { ApiError } from '$lib/api/errors';
import { createRollbackMutation } from './mutations';
import { getRollbackErrorMessage, ROLLBACK_COPY } from './rollback';

/** The deployment the dialog asks about. */
export type RollbackRequest = { id: string; sequence: number };

/**
 * "Kembalikan ke versi ini": the dialog's state and its one request. A key per opened dialog makes
 * a retry after a lost answer return the same deployment instead of starting a second one.
 */
export function useDeploymentRollback(projectId: () => string) {
	const rollback = createRollbackMutation(projectId);

	let target = $state<RollbackRequest | null>(null);
	let errorMessage = $state('');
	let idempotencyKey = '';
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	function open(next: RollbackRequest) {
		target = next;
		errorMessage = '';
		idempotencyKey = crypto.randomUUID();
	}

	function close() {
		if (submitting) return;
		target = null;
		errorMessage = '';
	}

	function confirm() {
		const current = target;
		if (!current || submitting) return;

		submitting = true;
		errorMessage = '';
		rollback.mutate(
			{ deploymentId: current.id, idempotencyKey },
			{
				onSuccess: (response) => {
					target = null;
					toast.success(ROLLBACK_COPY.started(current.sequence));
					void goto(
						resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
							id: projectId(),
							deploymentId: response.data.id
						})
					);
				},
				onError: (error) => {
					errorMessage = getRollbackErrorMessage(error, current.sequence);
					// A refusal created nothing; only an answer that never came keeps its key.
					if (error instanceof ApiError) idempotencyKey = crypto.randomUUID();
				},
				onSettled: () => {
					submitting = false;
				}
			}
		);
	}

	return {
		open,
		close,
		confirm,
		get target() {
			return target;
		},
		get isPending() {
			return rollback.isPending;
		},
		get errorMessage() {
			return errorMessage;
		}
	};
}
