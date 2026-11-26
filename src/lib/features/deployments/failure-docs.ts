import { DEPLOY_FAILURE_GUIDE_URL } from '$lib/config/project';

/**
 * Failure codes with a heading of their own in "Saat Deploy Gagal" (sakala-landing
 * `src/content/docs/deploy-gagal.md`, section "Masalah yang bisa kamu perbaiki"). The heading id
 * is the code itself. Keep this list in step with the page: a code that is not here gets no link.
 */
const CODES_WITH_OWN_SECTION: ReadonlySet<string> = new Set([
	'repository_not_found',
	'repository_access_denied',
	'repository_access_revoked',
	'repository_auth_failed',
	'repository_credential_unavailable',
	'repository_commit_not_found',
	'runtime_build_failed',
	'runtime_root_directory_invalid',
	'release_command_failed',
	'release_command_timeout',
	'runtime_app_crashed',
	'runtime_app_exec_denied',
	'runtime_port_conflict',
	'runtime_app_not_listening',
	'runtime_app_unhealthy',
	'runtime_app_host_blocked',
	'runtime_health_check_failed',
	'runtime_timeout',
	'runtime_app_out_of_memory',
	'runtime_replicas_exceeded'
]);

/** The heading of the table that lists the failures on Sakala's side, one row for several codes. */
const SAKALA_SIDE_SECTION = 'gangguan-di-sisi-sakala';

/** The codes in that table: nothing to change in the repository, only to deploy again or report. */
const SAKALA_SIDE_CODES: ReadonlySet<string> = new Set([
	'repository_credential_expired',
	'repository_access_check_failed',
	'repository_checkout_failed',
	'runtime_repository_failed',
	'runtime_execution_failed',
	'runtime_container_failed',
	'runtime_workload_not_found',
	'runtime_workload_not_running',
	'runtime_reporting_failed',
	'runtime_filesystem_failed',
	'runtime_routing_failed',
	'command_lease_expired',
	'command_expired',
	'runtime_capacity_exceeded',
	'runtime_disk_pressure',
	'runtime_preflight_failed',
	'runtime_dependency_failed',
	'invalid_runtime_configuration',
	'invalid_runtime_command',
	'unsupported_runtime_command',
	'runtime_cancelled'
]);

export const FAILURE_DOCS_COPY = {
	/** Read after the code, which is the link's visible text. */
	link: 'baca penjelasan kode ini',
	newTab: '(tab baru)'
} as const;

/** Where the failure code is explained, or `null` when the guide has no place for it yet. */
export function failureDocsHref(code: string | null | undefined): string | null {
	if (!code) return null;
	if (CODES_WITH_OWN_SECTION.has(code)) return `${DEPLOY_FAILURE_GUIDE_URL}#${code}`;
	if (SAKALA_SIDE_CODES.has(code)) return `${DEPLOY_FAILURE_GUIDE_URL}#${SAKALA_SIDE_SECTION}`;
	return null;
}
