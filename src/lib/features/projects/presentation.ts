import type { RuntimeStatus } from './type';

const runtimeStatuses = [
	'not_deployed',
	'deploying',
	'running',
	'stopped',
	'failed',
	'crashed'
] as const;

export function toRuntimeStatus(value: string): RuntimeStatus | null {
	if ((runtimeStatuses as readonly string[]).includes(value)) {
		return value as RuntimeStatus;
	}

	return null;
}
