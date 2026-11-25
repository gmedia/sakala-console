import {
	DNS_RECORD_TYPE,
	type DnsRecord,
	type ProjectDomain
} from '$lib/api/resources/project-domains';
import { dnsHostLabel, registeredDomainOf } from './names';
import { DOMAIN_COPY } from './presentation';

/*
 * The records of a domain as numbered steps. Apart from `presentation.ts` because it reads the
 * Public Suffix List (tldts, about 48 kB gzipped), which only the Domain section loads.
 */

export type DnsRecordRow = {
	type: string;
	/** A two-word tag of what the record is for. */
	tag: string;
	/** What to type in the provider's Name or Host field: relative to the zone, or the full name. */
	host: string;
	fullName: string;
	value: string;
	/** One short provider hint under the record. */
	hint: string | null;
};

/** The records as numbered steps, with the zone the names are relative to (`null`: unknown). */
export function dnsRecordRows(domain: ProjectDomain): {
	zone: string | null;
	rows: DnsRecordRow[];
} {
	const zone = registeredDomainOf(domain.hostname, domain.kind);
	const rows = domain.dns_records.map((record: DnsRecord): DnsRecordRow => {
		const isTxt = record.type === DNS_RECORD_TYPE.txt;
		const isAlias = record.type === DNS_RECORD_TYPE.alias;
		return {
			type: record.type,
			tag: isTxt ? DOMAIN_COPY.txtTag : DOMAIN_COPY.pointTag,
			host: dnsHostLabel(record.name, zone) ?? record.name,
			fullName: record.name,
			value: record.value,
			hint: isTxt ? null : isAlias ? DOMAIN_COPY.aliasNote : DOMAIN_COPY.cloudflareProxy
		};
	});
	return { zone, rows };
}
