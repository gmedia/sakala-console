import type { Page, Route } from '@playwright/test';
import { pilotLimits } from './create-project';
import { personalWorkspace } from './project-detail';

/*
 * The inspection the agent sends for sakala-examples/laravel (protocol revision 4), and the
 * workspace database endpoints the first deploy calls, answered like sakala-api.
 */

export const LARAVEL_ENV_EXAMPLE = {
	file: '.env.example',
	entries: [
		{ key: 'APP_NAME', example_value: 'Buku tamu Sakala' },
		{ key: 'APP_ENV', example_value: 'local' },
		{ key: 'APP_KEY', example_value: null },
		{ key: 'APP_DEBUG', example_value: 'true' },
		{ key: 'APP_URL', example_value: 'http://localhost' },
		{ key: 'LOG_LEVEL', example_value: 'debug' },
		{ key: 'DB_CONNECTION', example_value: 'sqlite' },
		{ key: 'DB_HOST', example_value: '127.0.0.1' },
		{ key: 'DB_PORT', example_value: '5432' },
		{ key: 'DB_DATABASE', example_value: 'laravel' },
		{ key: 'DB_USERNAME', example_value: 'root' },
		{ key: 'DB_PASSWORD', example_value: null },
		{ key: 'DB_URL', example_value: null },
		{ key: 'SESSION_DRIVER', example_value: 'database' },
		{ key: 'SESSION_DOMAIN', example_value: 'null' },
		{ key: 'MAIL_MAILER', example_value: 'log' },
		{ key: 'MAIL_HOST', example_value: '127.0.0.1' },
		{ key: 'MAIL_PASSWORD', example_value: 'null' },
		{ key: 'MAIL_FROM_NAME', example_value: '${APP_NAME}' },
		{ key: 'MAILGUN_SECRET', example_value: 'key-from-mailgun' },
		{ key: 'PORT', example_value: '8000' }
	],
	truncated: false
};

export const LARAVEL_DATABASE_HINT = {
	likely: true,
	engine: 'sqlite',
	signals: [
		{ kind: 'env_variable', file: '.env.example', name: 'DB_CONNECTION' },
		{ kind: 'laravel_migrations', file: 'database/migrations', name: null }
	],
	suggested_release_command: 'php artisan migrate --force'
};

/** A succeeded inspection of the Laravel example, as `ProjectResource` carries it. */
export function laravelInspection(overrides: { database_hint?: Record<string, unknown> } = {}) {
	return {
		preview_status: 'succeeded',
		inspection: {
			repository_url: 'https://github.com/gmedia/sakala-examples',
			commit_sha: '0123456789abcdef',
			dockerfile_found: true,
			env_example_found: true,
			compose_found: false,
			manifests: ['Dockerfile', 'composer.json'],
			package_manager: 'composer',
			inspected_at: '2026-11-19T10:00:10Z',
			env_example: LARAVEL_ENV_EXAMPLE,
			database_hint: { ...LARAVEL_DATABASE_HINT, ...overrides.database_hint }
		},
		stack: { builder: 'dockerfile', provider: 'php', framework: 'laravel', package_manager: null },
		workspace: {
			id: personalWorkspace.id,
			name: personalWorkspace.name,
			slug: personalWorkspace.slug,
			type: 'personal'
		}
	};
}

/** Pilot limits with room for one more database, or with none offered at all. */
export function databaseLimits({ available = true, used = 0 } = {}) {
	return {
		body: {
			data: {
				...pilotLimits,
				quotas: {
					...pilotLimits.quotas,
					max_databases: 2,
					current_databases_count: used,
					max_database_storage_mb: 512,
					current_database_storage_bytes: 0
				},
				databases: { available }
			}
		}
	};
}

export const NEW_DATABASE_ID = '01a1d0aa-0000-7000-8000-000000000001';

export function provisioningDatabase(projectId: string) {
	return {
		id: NEW_DATABASE_ID,
		name: 'contoh-laravel',
		engine: 'postgresql',
		status: 'provisioning',
		region: 'jkt',
		size_bytes: null,
		size_checked_at: null,
		projects: [{ id: projectId, name: 'contoh-laravel', slug: 'contoh-laravel' }],
		connection: null,
		last_failure: null,
		password_rotation: null,
		created_at: '2026-11-19T10:01:00Z',
		updated_at: '2026-11-19T10:01:00Z'
	};
}

/** The project's `databases` entry while the API waits, then after it started the deployment. */
export function attachedDatabase(
	status: 'provisioning' | 'ready',
	deployWhenReady: { status: string; deployment_id: string | null; skipped_reason?: string | null }
) {
	return {
		id: NEW_DATABASE_ID,
		name: 'contoh-laravel',
		status,
		region: 'jkt',
		variables: status === 'ready' ? ['DATABASE_URL', 'DB_CONNECTION', 'DB_HOST'] : [],
		overridden_variables: [],
		deploy_when_ready: {
			requested_at: '2026-11-19T10:01:00Z',
			skipped_reason: null,
			...deployWhenReady
		}
	};
}

export type DatabaseRequests = { list: number; create: Record<string, unknown>[] };

/** `GET` and `POST .../workspaces/{id}/databases`; a create answers 201 `provisioning`. */
export async function mockWorkspaceDatabases(
	page: Page,
	{
		projectId,
		databases = [],
		create
	}: {
		projectId: string;
		databases?: unknown[];
		create?: (body: Record<string, unknown>) => { status: number; body: unknown } | undefined;
	}
): Promise<DatabaseRequests> {
	const requests: DatabaseRequests = { list: 0, create: [] };
	await page.route(/\/api\/v1\/app\/workspaces\/[^/]+\/databases$/, (route: Route) => {
		const request = route.request();
		if (request.method() === 'POST') {
			const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
			requests.create.push(body);
			const reply = create?.(body) ?? {
				status: 201,
				body: { data: provisioningDatabase(projectId) }
			};
			return route.fulfill({
				status: reply.status,
				contentType: 'application/json',
				body: JSON.stringify(reply.body)
			});
		}
		requests.list += 1;
		return route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ data: databases })
		});
	});
	return requests;
}
