import type { StarterExampleEnvValue } from '$lib/config/starter-examples';
import { generateSecret, SECRET_FORMATS } from '../secret-generation';

export function resolveStarterEnvValue(value: StarterExampleEnvValue): string {
	return value.kind === 'fixed' ? value.value : generateSecret(SECRET_FORMATS.laravelAppKey);
}
