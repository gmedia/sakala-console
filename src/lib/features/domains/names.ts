import { parse as parseDomain } from 'tldts';
import { DOMAIN_KIND } from '$lib/api/resources/project-domains';

/*
 * Domain names the way sakala-api reads them (CustomDomainNameParser), so most mistakes show before
 * sending. The API stays the judge: it also refuses `xn--` labels that are not valid punycode and
 * any zone its operator forbids, which the Console cannot know. The messages are the API's own,
 * compared with its captured 422 answers in `names.spec.ts`.
 *
 * The Public Suffix List comes from `tldts` with private domains on, as php-domain-parser resolves
 * them in the API: `github.io` is a suffix, `nama.github.io` an apex. IDN goes through the
 * browser's WHATWG URL parser, which applies UTS #46 like the API's intl.
 */

/** What DNS providers call the zone's own name in their Name or Host field. */
export const APEX_HOST = '@';

/** The longest name DNS carries (CustomDomainPolicy::MAX_HOSTNAME_LENGTH). */
export const MAX_HOSTNAME_LENGTH = 253;

/** One LDH label: letters, digits, inner hyphens, 1 to 63 characters, lowercase. */
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PORT_PATTERN = /:\d+$/;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const ASCII_PATTERN = /^[\x20-\x7e]*$/;

const PSL_OPTIONS = { allowPrivateDomains: true } as const;

export const DOMAIN_NAME_COPY = {
	empty: 'Isi nama domain, misalnya www.contoh.com.',
	wildcard:
		'Wildcard seperti *.contoh.com belum didukung. Tambahkan setiap nama satu per satu, misalnya www.contoh.com.',
	ip: 'Isi nama domain, bukan alamat IP.',
	invalid:
		'Nama domain ini tidak valid. Pakai huruf, angka, dan tanda hubung, dipisah titik, misalnya www.contoh.com.',
	oneLabel: 'Nama domain harus punya minimal dua bagian, misalnya contoh.com.',
	tooLong: `Nama domain paling panjang ${MAX_HOSTNAME_LENGTH} karakter.`,
	label:
		'Setiap bagian nama domain hanya boleh berisi huruf, angka, dan tanda hubung, tidak diawali atau diakhiri tanda hubung, dan paling panjang 63 karakter.',
	forbidden: (zone: string) =>
		`Domain di bawah ${zone} milik Sakala dan tidak bisa dipakai sebagai custom domain. Alamat proyekmu di Sakala sudah aktif tanpa perlu ditambahkan.`,
	publicSuffix: (name: string) =>
		`${name} adalah akhiran domain publik yang dipakai banyak orang, bukan domain milik satu orang. Pakai domain yang kamu daftarkan di bawahnya, misalnya nama.${name}.`,
	unknownSuffix:
		'Akhiran domain ini tidak dikenal. Pakai domain yang sudah kamu daftarkan di registrar, misalnya contoh.com atau nama.my.id.'
} as const;

export type DomainKind = (typeof DOMAIN_KIND)[keyof typeof DOMAIN_KIND];

export type ParsedDomainName =
	{ ok: true; hostname: string; kind: DomainKind } | { ok: false; message: string };

/** Lowercase, without spaces, scheme, path, port, or trailing dot, as the API strips a pasted URL. */
export function stripDomainInput(input: string): string {
	let name = input.trim().toLowerCase();
	const scheme = name.indexOf('://');
	if (scheme !== -1) name = name.slice(scheme + 3);
	name = name.replace(/[/?#].*$/, '').replace(PORT_PATTERN, '');
	return name.replace(/\.+$/, '');
}

function isIpAddress(name: string): boolean {
	const bare = name.replace(/^\[|\]$/g, '');
	return IPV4_PATTERN.test(bare) || bare.includes(':');
}

/** An international name in punycode, or null when the browser cannot convert it. */
function toAscii(name: string): string | null {
	if (ASCII_PATTERN.test(name)) return name;
	try {
		return new URL(`http://${name}/`).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/** The zone a name sits in, such as the zone of the custom domain target or of the project address. */
export function parentZone(name: string | null | undefined): string | null {
	const dot = name?.indexOf('.') ?? -1;
	return name && dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
}

/**
 * The final form of what someone typed, and whether it is an apex or a subdomain, or the reason the
 * API would refuse it. `forbiddenZones` are Sakala's own zones the Console knows of: the zone of the
 * custom domain target and of the project's own address.
 */
export function parseDomainName(
	input: string,
	forbiddenZones: readonly string[] = []
): ParsedDomainName {
	const name = stripDomainInput(input);
	if (!name) return { ok: false, message: DOMAIN_NAME_COPY.empty };
	if (name.includes('*')) return { ok: false, message: DOMAIN_NAME_COPY.wildcard };
	if (isIpAddress(name)) return { ok: false, message: DOMAIN_NAME_COPY.ip };

	const hostname = toAscii(name);
	if (!hostname) return { ok: false, message: DOMAIN_NAME_COPY.invalid };
	const labels = hostname.split('.');
	if (labels.length < 2) return { ok: false, message: DOMAIN_NAME_COPY.oneLabel };
	if (hostname.length > MAX_HOSTNAME_LENGTH)
		return { ok: false, message: DOMAIN_NAME_COPY.tooLong };
	if (labels.some((label) => !LABEL_PATTERN.test(label))) {
		return { ok: false, message: DOMAIN_NAME_COPY.label };
	}

	const zone = forbiddenZones.find((item) => hostname === item || hostname.endsWith(`.${item}`));
	if (zone) return { ok: false, message: DOMAIN_NAME_COPY.forbidden(zone) };

	const parsed = parseDomain(hostname, PSL_OPTIONS);
	if (parsed.publicSuffix === hostname) {
		return { ok: false, message: DOMAIN_NAME_COPY.publicSuffix(hostname) };
	}
	if (!parsed.isIcann && !parsed.isPrivate) {
		return { ok: false, message: DOMAIN_NAME_COPY.unknownSuffix };
	}
	return {
		ok: true,
		hostname,
		kind: parsed.domain === hostname ? DOMAIN_KIND.apex : DOMAIN_KIND.subdomain
	};
}

/**
 * The domain someone registered at a registrar, whose DNS zone holds the records: `contoh.com` for
 * `www.contoh.com`, `kampus.ac.id` for `himpunan.kampus.ac.id`. The API's `kind` decides an apex; a
 * subdomain's comes from the list, and `null` when the list does not know it.
 */
export function registeredDomainOf(hostname: string, kind: string): string | null {
	if (kind === DOMAIN_KIND.apex) return hostname;
	const parsed = parseDomain(hostname, PSL_OPTIONS);
	// An unknown suffix still gets a guess from the list's default rule; the API refuses those.
	if (!parsed.isIcann && !parsed.isPrivate) return null;
	const domain = parsed.domain;
	return domain && domain !== hostname && hostname.endsWith(`.${domain}`) ? domain : null;
}

/**
 * What to type in a DNS provider's "Name" or "Host" field, which most providers want relative to
 * the zone: `_sakala.www` and `www` for `www.contoh.com`, `@` for the apex itself. `null` when the
 * zone is unknown, so only the full name can be shown.
 */
export function dnsHostLabel(recordName: string, registeredDomain: string | null): string | null {
	if (!registeredDomain) return null;
	if (recordName === registeredDomain) return APEX_HOST;
	const suffix = `.${registeredDomain}`;
	return recordName.endsWith(suffix) ? recordName.slice(0, -suffix.length) : null;
}

/** The `www` name an apex suggests when its provider cannot flatten a CNAME. */
export function wwwOf(apex: string): string {
	return `www.${apex}`;
}
