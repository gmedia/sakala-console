import { ApiError, CUSTOM_DOMAIN_ERROR_CODES, getErrorMessage } from '$lib/api/errors';
import { parseDomainRefusal } from '$lib/api/resources/domain-refusals';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import {
	DNS_RECORD_TYPE,
	DOMAIN_CHECK_REASON,
	DOMAIN_KIND,
	DOMAIN_STATUS,
	ROUTING_MATCH,
	type DomainCheckReason,
	type ProjectDomain
} from '$lib/api/resources/project-domains';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import { DISPLAY_TIMEZONE } from '$lib/features/workloads/time';

/*
 * What a project's custom domains (ADR-024) look like to the person who manages their DNS. Copy is
 * deliberately short (maintainer, 25 Nov 2026: walls of text scare students): a badge and one
 * sentence per state, the records as numbered steps with copy buttons, and longer explanations
 * behind "Pelajari". The API's check messages name the exact record to change, so they are shown
 * as they are, but only for a check that failed.
 *
 * Nothing here reads the Public Suffix List: the header, the overview, and the admin pages import
 * this module, and the list (tldts) is loaded only with the Domain section (`records.ts`, `names.ts`).
 */

/** While a domain waits for DNS the API checks it every minute for 30 minutes, then every 15. */
export const DOMAIN_PENDING_POLL_MS = 30_000;

/** How long "Periksa sekarang" waits after a 429 that did not say (the API's limit is per minute). */
export const DOMAIN_CHECK_DEFAULT_WAIT_SECONDS = 60;

const timeFormat = new Intl.DateTimeFormat('id-ID', {
	timeZone: DISPLAY_TIMEZONE,
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZoneName: 'short'
});

/** `28 Nov, 16.27 WIB`: short, and always with its zone. */
export function formatDomainTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '-' : timeFormat.format(date);
}

export const DOMAIN_COPY = {
	section: 'Domain',
	intro: (defaultDomain: string | null) =>
		defaultDomain
			? `Hubungkan domain milikmu. ${defaultDomain} tetap aktif.`
			: 'Hubungkan domain milikmu. Alamat bawaan Sakala tetap aktif.',
	inputLabel: 'Nama domain',
	inputPlaceholder: 'www.contoh.com',
	add: 'Tambah domain',
	added: (hostname: string) => `${hostname} ditambahkan.`,
	loadFailed: 'Daftar domain belum bisa dimuat. Muat ulang halaman ini.',
	sectionLoadFailed: 'Bagian Domain belum bisa dimuat. Muat ulang halaman ini.',
	unavailable: 'Custom domain belum bisa dipakai di instalasi Sakala ini.',
	emptyTitle: 'Belum ada domain',
	emptyDescription: 'Tambahkan domain, lalu pasang dua record DNS yang muncul.',
	readOnly: 'Hanya pemilik dan anggota workspace yang bisa mengatur domain.',
	quotaZero: 'Workspace ini belum punya kuota custom domain. Minta ke admin Sakala.',
	quota: (current: number, max: number) => `Kuota workspace: ${current} dari ${max} terpakai.`,
	quotaFull: (max: number) =>
		`Kuota ${max} custom domain workspace habis. Hapus domain yang tidak dipakai.`,
	apexTitle: (apex: string) => `${apex} adalah domain utama.`,
	apexShort: 'Provider DNS-mu harus mendukung ALIAS atau CNAME flattening.',
	apexLearn:
		'Domain utama (tanpa www) tidak bisa memakai CNAME biasa. Cloudflare meratakannya otomatis (CNAME flattening); provider lain menyebutnya ALIAS atau ANAME. Kalau provider-mu tidak punya, pakai www, lalu buat redirect dari domain utama ke www di provider.',
	useWww: (www: string) => `Pakai ${www}`,
	learn: 'Pelajari',
	stepsTitle: 'Pasang di DNS provider',
	recordsActiveTitle: 'Record DNS',
	recordsKeep: 'Biarkan kedua record tetap terpasang.',
	recordName: 'Nama',
	recordValue: 'Nilai',
	txtTag: 'Bukti pemilik',
	pointTag: 'Arahkan ke Sakala',
	aliasNote: 'Cloudflare: CNAME dengan nama @. Provider lain: ALIAS atau ANAME.',
	cloudflareProxy: 'Cloudflare: pilih DNS only (awan abu-abu).',
	fullNameHint: (zone: string) =>
		`Provider meminta nama lengkap? Tambahkan .${zone} di belakangnya.`,
	apexNameHint: (zone: string) => `@ berarti ${zone} sendiri.`,
	addressesWarning: 'Terdeteksi lewat alamat IP. Kalau itu record A manual, ganti dengan ALIAS.',
	checksAt: (time: string) => `Diperiksa ${time}`,
	checkNow: 'Periksa sekarang',
	checking: 'Memeriksa...',
	checkWait: (seconds: number) => `Tunggu ${seconds} detik`,
	checkRateLimited: (seconds: number) =>
		`Terlalu sering diperiksa. Coba lagi dalam ${seconds} detik.`,
	checkFailed: 'Pemeriksaan belum bisa dijalankan. Coba lagi sebentar lagi.',
	checkedActive: (hostname: string) => `${hostname} aktif.`,
	checkedStill: (hostname: string) => `${hostname} belum lolos.`,
	delete: 'Hapus',
	deleteTitle: (hostname: string) => `Hapus ${hostname}?`,
	deleteDescription:
		'Domain berhenti melayani dalam sekitar 10 detik. Alamat bawaan Sakala tetap aktif.',
	deleteConfirm: 'Hapus domain',
	deleted: (hostname: string) => `${hostname} dihapus.`,
	deleteFailed: 'Domain belum terhapus. Muat ulang halaman, lalu hapus lagi.',
	addFailed: 'Domain belum ditambahkan. Muat ulang halaman, lalu coba lagi.',
	allowedHostsTitle: 'Aplikasimu menolak domain baru?',
	allowedHostsBody: 'Tambahkan domainnya ke pengaturan host framework-mu:',
	allowedHosts: [
		{ framework: 'Vite', setting: 'preview.allowedHosts' },
		{ framework: 'Django', setting: 'ALLOWED_HOSTS' },
		{ framework: 'Laravel', setting: 'APP_URL' }
	],
	kindApex: 'Domain utama',
	kindSubdomain: 'Subdomain'
} as const;

/** Whether the installation offers custom domains, from the workspace's limits. */
export function customDomainsEnabled(limits: PilotLimits | undefined): boolean {
	return limits?.custom_domains?.enabled === true;
}

export type DomainQuota = { max: number; current: number; full: boolean };

/** The workspace's quota, or `null` from an API that does not send it. */
export function domainQuota(limits: PilotLimits | undefined): DomainQuota | null {
	const max = limits?.quotas.max_custom_domains;
	const current = limits?.quotas.current_custom_domains_count;
	if (max === undefined || current === undefined) return null;
	return { max, current, full: current >= max };
}

export function domainQuotaText(quota: DomainQuota): string {
	if (quota.max === 0) return DOMAIN_COPY.quotaZero;
	return quota.full
		? DOMAIN_COPY.quotaFull(quota.max)
		: DOMAIN_COPY.quota(quota.current, quota.max);
}

export type DomainStateKind =
	| 'pending'
	| 'active'
	| 'failing'
	| 'waiting_for_node'
	| 'failed'
	| 'disabled'
	| 'admin_disabled'
	| 'released'
	| 'unknown';

export type DomainStatusView = {
	kind: DomainStateKind;
	label: string;
	tone: BadgeTone;
	/** One short sentence: what this means, and the time that matters, in WIB. */
	summary: string;
	/** Whether the per-check results tell the person what to fix. */
	showChecks: boolean;
	/** Whether the records are what the person needs now, or reference to keep. */
	recordsOpen: boolean;
	/** Whether "Periksa sekarang" can change anything. */
	canCheck: boolean;
};

/** The state a domain is in, from its status and the fields that refine it. */
export function domainStateKind(domain: ProjectDomain): DomainStateKind {
	switch (domain.status) {
		case DOMAIN_STATUS.pending:
			return 'pending';
		case DOMAIN_STATUS.verified:
			if (domain.failing_since) return 'failing';
			return domain.waiting_for_node ? 'waiting_for_node' : 'active';
		case DOMAIN_STATUS.failed:
			return 'failed';
		case DOMAIN_STATUS.disabled:
			return domain.admin_disabled ? 'admin_disabled' : 'disabled';
		case DOMAIN_STATUS.released:
			return 'released';
		default:
			return 'unknown';
	}
}

export function domainStatusView(
	domain: ProjectDomain,
	now: number = Date.now()
): DomainStatusView {
	const kind = domainStateKind(domain);
	const base = { showChecks: false, recordsOpen: true, canCheck: true };
	switch (kind) {
		case 'pending':
			return {
				...base,
				kind,
				label: 'Menunggu DNS',
				tone: 'queued',
				summary:
					domain.last_check.checked_at && domain.next_check_at
						? `Belum lolos. Diperiksa lagi ${formatDomainTime(domain.next_check_at)}.`
						: 'Pasang dua record di bawah. Sakala memeriksanya otomatis.',
				showChecks: Boolean(domain.last_check.checked_at)
			};
		case 'active':
			return {
				...base,
				kind,
				label: 'Aktif',
				tone: 'success',
				summary: domain.verified_at
					? `Aktif sejak ${formatDomainTime(domain.verified_at)}.`
					: 'Aktif.',
				recordsOpen: false
			};
		case 'failing':
			return {
				...base,
				kind,
				label: 'DNS bermasalah',
				tone: 'warning',
				summary: domain.disable_at
					? `Dinonaktifkan ${formatDomainTime(domain.disable_at)} kalau DNS belum diperbaiki.`
					: 'DNS gagal diperiksa. Perbaiki record di bawah.',
				showChecks: true
			};
		case 'waiting_for_node':
			return {
				...base,
				kind,
				label: 'Menunggu server',
				tone: 'info',
				summary:
					'DNS sudah benar, tapi server proyek ini belum mendukung custom domain. Pengunjung masih melihat 404.',
				recordsOpen: false,
				canCheck: false
			};
		case 'failed':
			return {
				...base,
				kind,
				label: 'Gagal',
				tone: 'error',
				summary: 'Belum lolos dalam 72 jam. Perbaiki record, lalu periksa lagi.',
				showChecks: true
			};
		case 'disabled': {
			const until = domain.reactivation_ends_at;
			const stillChecked = until !== null && Date.parse(until) > now;
			return {
				...base,
				kind,
				label: 'Nonaktif',
				tone: 'error',
				summary: stillChecked
					? `DNS gagal 72 jam. Aktif lagi otomatis setelah diperbaiki, sampai ${formatDomainTime(until)}.`
					: 'DNS gagal 72 jam. Perbaiki record, lalu periksa lagi.',
				showChecks: domain.last_check.reasons.length > 0
			};
		}
		case 'admin_disabled':
			return {
				...base,
				kind,
				label: 'Dinonaktifkan admin',
				tone: 'error',
				summary: domain.admin_disabled_reason
					? `Alasan dari admin Sakala: ${domain.admin_disabled_reason}`
					: 'Admin Sakala menonaktifkan domain ini.',
				recordsOpen: false,
				canCheck: false
			};
		case 'released':
			return {
				...base,
				kind,
				label: 'Dipakai proyek lain',
				tone: 'muted',
				summary: 'Domain ini sudah aktif di proyek lain. Hapus dari sini.',
				recordsOpen: false,
				canCheck: false
			};
		default:
			return {
				...base,
				kind,
				label: domain.status,
				tone: 'neutral',
				summary: 'Status ini belum dikenal Console. Muat ulang halaman.'
			};
	}
}

export type DomainCheckId = 'txt' | 'routing' | 'caa';
export type DomainCheckState = 'pass' | 'fail' | 'unknown';

export type DomainCheckRow = {
	id: DomainCheckId;
	label: string;
	state: DomainCheckState;
	/** The API's messages for this check, which name the record to change. */
	reasons: DomainCheckReason[];
};

const CHECK_OF_REASON: Record<string, DomainCheckId> = {
	[DOMAIN_CHECK_REASON.txtMissing]: 'txt',
	[DOMAIN_CHECK_REASON.txtMismatch]: 'txt',
	[DOMAIN_CHECK_REASON.cnameRequired]: 'routing',
	[DOMAIN_CHECK_REASON.pointsElsewhere]: 'routing',
	[DOMAIN_CHECK_REASON.extraAddresses]: 'routing',
	[DOMAIN_CHECK_REASON.noAddress]: 'routing',
	[DOMAIN_CHECK_REASON.caaForbidsIssuer]: 'caa'
};

export const CHECK_STATE_LABELS: Record<DomainCheckState, string> = {
	pass: 'Lolos',
	fail: 'Perbaiki',
	unknown: 'Belum pasti'
};

/**
 * The three parts of a check (ownership, pointing, CAA), and the reasons that belong to none of them:
 * a DNS error leaves every part unknown, and `domain_taken` means all records passed.
 */
export function domainChecks(domain: ProjectDomain): {
	rows: DomainCheckRow[];
	general: DomainCheckReason[];
} {
	const reasons = domain.last_check.reasons;
	const dnsError = reasons.some((reason) => reason.code === DOMAIN_CHECK_REASON.dnsError);
	const routingType =
		domain.kind === DOMAIN_KIND.apex ? DNS_RECORD_TYPE.alias : DNS_RECORD_TYPE.cname;
	const labels: Record<DomainCheckId, string> = {
		txt: `${DNS_RECORD_TYPE.txt} kepemilikan`,
		routing: `${routingType} ke Sakala`,
		caa: 'CAA sertifikat'
	};
	const rows = (['txt', 'routing', 'caa'] as const).map((id): DomainCheckRow => {
		const own = reasons.filter((reason) => CHECK_OF_REASON[reason.code] === id);
		const state: DomainCheckState = own.length ? 'fail' : dnsError ? 'unknown' : 'pass';
		return { id, label: labels[id], state, reasons: own };
	});
	return { rows, general: reasons.filter((reason) => !CHECK_OF_REASON[reason.code]) };
}

/** An apex found by its addresses: flattening, or a manual A record that breaks later. */
export function hasAddressesWarning(domain: ProjectDomain): boolean {
	return (
		domain.kind === DOMAIN_KIND.apex &&
		domain.status === DOMAIN_STATUS.verified &&
		domain.last_check.routing_match === ROUTING_MATCH.addresses
	);
}

/**
 * The custom domain visitors reach the project on: the oldest active one. A failing one still
 * serves until it is disabled; one waiting for its node does not serve yet.
 */
export function servingDomain(domains: readonly ProjectDomain[] | undefined): string | null {
	return (
		domains?.find((domain) => domain.status === DOMAIN_STATUS.verified && !domain.waiting_for_node)
			?.hostname ?? null
	);
}

/** Why adding was refused, in words that say what to do next. */
export function domainAddErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.code === CUSTOM_DOMAIN_ERROR_CODES.limitExceeded) {
			const details = parseDomainRefusal(CUSTOM_DOMAIN_ERROR_CODES.limitExceeded, error.details);
			if (details?.limit === 0) return DOMAIN_COPY.quotaZero;
			if (details) return DOMAIN_COPY.quotaFull(details.limit);
		}
		if (error.code === CUSTOM_DOMAIN_ERROR_CODES.taken) {
			const details = parseDomainRefusal(CUSTOM_DOMAIN_ERROR_CODES.taken, error.details);
			if (details) {
				return `${details.hostname} sudah aktif di proyek lain. Hapus dulu di sana, lalu tambahkan di sini.`;
			}
		}
		if (error.isForbidden) return DOMAIN_COPY.readOnly;
		if (error.status === 404) return DOMAIN_COPY.unavailable;
	}
	return getErrorMessage(error, DOMAIN_COPY.addFailed);
}

/** Seconds to wait before "Periksa sekarang" may run again, or `null` when it was not a 429. */
export function checkWaitSeconds(error: unknown): number | null {
	if (!(error instanceof ApiError) || !error.isRateLimited) return null;
	return Math.max(error.retryAfterSeconds ?? DOMAIN_CHECK_DEFAULT_WAIT_SECONDS, 1);
}

export function domainCheckErrorMessage(error: unknown): string {
	const wait = checkWaitSeconds(error);
	if (wait !== null) return DOMAIN_COPY.checkRateLimited(wait);
	if (error instanceof ApiError) {
		if (error.isForbidden) return DOMAIN_COPY.readOnly;
		if (error.status === 404) return DOMAIN_COPY.unavailable;
	}
	return getErrorMessage(error, DOMAIN_COPY.checkFailed);
}

export function domainDeleteErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.isForbidden) return DOMAIN_COPY.readOnly;
		if (error.status === 404) return DOMAIN_COPY.unavailable;
	}
	return getErrorMessage(error, DOMAIN_COPY.deleteFailed);
}
