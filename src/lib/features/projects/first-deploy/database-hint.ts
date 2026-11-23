import type { DatabaseHintEngine, DatabaseHintSignal } from '../type';

/**
 * Plain words for what the agent found (`database_hint.signals`, sakala-agent protocol revision 4).
 * A kind this Console does not know is ignored, as the contract asks.
 */

/** A sentence stays readable with three findings; the rest are counted (Miller's Law). */
export const MAX_SIGNALS_IN_SENTENCE = 3;

export const SIGNAL_KINDS = {
	envVariable: 'env_variable',
	laravelMigrations: 'laravel_migrations',
	prismaSchema: 'prisma_schema',
	djangoSettings: 'django_settings',
	railsDatabaseConfig: 'rails_database_config',
	packageDependency: 'package_dependency'
} as const;

type SignalPhrase = (signal: DatabaseHintSignal) => string;

const PHRASES: Record<string, SignalPhrase> = {
	[SIGNAL_KINDS.envVariable]: (signal) => `${signal.name ?? 'variabel database'} di ${signal.file}`,
	[SIGNAL_KINDS.laravelMigrations]: (signal) => `migration Laravel di ${signal.file}`,
	[SIGNAL_KINDS.prismaSchema]: (signal) =>
		signal.name
			? `skema Prisma (${signal.name}) di ${signal.file}`
			: `skema Prisma di ${signal.file}`,
	[SIGNAL_KINDS.djangoSettings]: (signal) =>
		`pengaturan database Django (${signal.name ?? 'DATABASES'}) di ${signal.file}`,
	[SIGNAL_KINDS.railsDatabaseConfig]: (signal) => `konfigurasi database Rails di ${signal.file}`,
	[SIGNAL_KINDS.packageDependency]: (signal) =>
		`paket ${signal.name ?? ''} di ${signal.file}`.trim()
};

const listFormat = new Intl.ListFormat('id', { type: 'conjunction' });
const countFormat = new Intl.NumberFormat('id-ID');

/**
 * "Sakala menemukan DATABASE_URL di .env.example dan paket @prisma/client di package.json.", or
 * `null` when no finding is one this Console can put in words.
 */
export function databaseSignalsSentence(signals: readonly DatabaseHintSignal[]): string | null {
	const phrases = signals.flatMap((signal) => {
		const phrase = PHRASES[signal.kind];
		return phrase ? [phrase(signal)] : [];
	});
	if (phrases.length === 0) return null;

	const shown = phrases.slice(0, MAX_SIGNALS_IN_SENTENCE);
	const rest = phrases.length - shown.length;
	const items = rest > 0 ? [...shown, `${countFormat.format(rest)} tanda lain`] : shown;
	return `Sakala menemukan ${listFormat.format(items)}.`;
}

export const ENGINE_NOTES = {
	mysqlLaravel:
		'Sakala menyediakan PostgreSQL, bukan MySQL. Laravel tetap jalan karena Sakala mengisi DB_CONNECTION=pgsql, tapi query yang khusus MySQL mungkin perlu diubah.',
	mysql:
		'Sakala menyediakan PostgreSQL, bukan MySQL. Aplikasimu perlu driver PostgreSQL, dan query yang khusus MySQL mungkin perlu diubah.',
	sqlite:
		'Data SQLite tersimpan di file di dalam container, dan file itu hilang setiap kali deploy. Database dari Sakala menyimpan datanya tetap ada.',
	/**
	 * When this workspace cannot get a Sakala database now (none offered, or no quota left, which
	 * is the production default), the note does not point at an option that is disabled.
	 */
	sqliteWithoutSakalaDatabase:
		'Data SQLite tersimpan di file di dalam container, dan file itu hilang setiap kali deploy. Kalau datanya perlu tetap ada, simpan di database di luar container, lalu isi alamat koneksinya sebagai environment variable.'
} as const;

/**
 * An honest note when the app was written for another engine than the PostgreSQL Sakala offers.
 * `sakalaDatabase` says whether this project can get a Sakala database now: a new one can be
 * made, or the workspace has one it can use.
 */
export function databaseEngineNote(
	engine: DatabaseHintEngine,
	{ laravel, sakalaDatabase }: { laravel: boolean; sakalaDatabase: boolean }
): string | null {
	if (engine === 'mysql') return laravel ? ENGINE_NOTES.mysqlLaravel : ENGINE_NOTES.mysql;
	if (engine === 'sqlite') {
		return sakalaDatabase ? ENGINE_NOTES.sqlite : ENGINE_NOTES.sqliteWithoutSakalaDatabase;
	}
	return null;
}
