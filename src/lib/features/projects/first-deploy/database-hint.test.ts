import { describe, expect, it } from 'vitest';
import { FILE_STORAGE_GUIDE_URL } from '$lib/config/project';
import {
	databaseEngineGuideUrl,
	databaseEngineNote,
	databaseSignalsSentence,
	ENGINE_NOTES
} from './database-hint';

const signal = (kind: string, file: string, name: string | null) => ({ kind, file, name });

describe('databaseSignalsSentence', () => {
	it('names each finding in plain words', () => {
		expect(
			databaseSignalsSentence([
				signal('env_variable', '.env.example', 'DATABASE_URL'),
				signal('package_dependency', 'package.json', '@prisma/client')
			])
		).toBe(
			'Sakala menemukan DATABASE_URL di .env.example dan paket @prisma/client di package.json.'
		);
	});

	it.each([
		[
			signal('laravel_migrations', 'database/migrations', null),
			'migration Laravel di database/migrations'
		],
		[
			signal('prisma_schema', 'prisma/schema.prisma', 'postgresql'),
			'skema Prisma (postgresql) di prisma/schema.prisma'
		],
		[
			signal('django_settings', 'kopi/settings.py', 'dj_database_url'),
			'pengaturan database Django (dj_database_url) di kopi/settings.py'
		],
		[
			signal('rails_database_config', 'config/database.yml', 'postgresql'),
			'konfigurasi database Rails di config/database.yml'
		]
	])('says %j as "%s"', (item, phrase) => {
		expect(databaseSignalsSentence([item])).toBe(`Sakala menemukan ${phrase}.`);
	});

	it('ignores kinds it does not know', () => {
		expect(
			databaseSignalsSentence([
				signal('docker_compose_service', 'compose.yml', 'postgres'),
				signal('env_variable', '.env.example', 'DB_HOST')
			])
		).toBe('Sakala menemukan DB_HOST di .env.example.');
		expect(databaseSignalsSentence([signal('future_kind', 'x', null)])).toBeNull();
		expect(databaseSignalsSentence([])).toBeNull();
	});

	it('counts the findings after the third instead of listing all', () => {
		const many = ['DATABASE_URL', 'DB_HOST', 'DB_CONNECTION', 'PGHOST', 'MYSQL_URL'].map((name) =>
			signal('env_variable', '.env.example', name)
		);
		expect(databaseSignalsSentence(many)).toBe(
			'Sakala menemukan DATABASE_URL di .env.example, DB_HOST di .env.example, DB_CONNECTION di .env.example, dan 2 tanda lain.'
		);
	});
});

describe('databaseEngineNote', () => {
	it('is honest that MySQL apps get PostgreSQL, naming what Laravel needs', () => {
		const reachable = { sakalaDatabase: true };
		expect(databaseEngineNote('mysql', { laravel: true, ...reachable })).toBe(
			ENGINE_NOTES.mysqlLaravel
		);
		expect(ENGINE_NOTES.mysqlLaravel).toContain('DB_CONNECTION=pgsql');
		expect(databaseEngineNote('mysql', { laravel: false, ...reachable })).toBe(ENGINE_NOTES.mysql);
	});

	it('warns that SQLite data is lost on sleep, restart, and deploy, and points at a Sakala database', () => {
		const note = databaseEngineNote('sqlite', { laravel: true, sakalaDatabase: true });
		expect(note).toContain('hilang saat proyek tidur, di-restart, atau di-deploy ulang');
		expect(note).toContain('Database dari Sakala');
	});

	it('does not suggest a Sakala database the workspace cannot get', () => {
		const note = databaseEngineNote('sqlite', { laravel: true, sakalaDatabase: false });
		expect(note).toBe(ENGINE_NOTES.sqliteWithoutSakalaDatabase);
		expect(note).toContain('hilang saat proyek tidur, di-restart, atau di-deploy ulang');
		expect(note).not.toContain('Sakala menyimpan');
	});

	it('links the SQLite section of the file storage guide, and nothing for other engines', () => {
		expect(databaseEngineGuideUrl('sqlite')).toBe(`${FILE_STORAGE_GUIDE_URL}#berkas-sqlite`);
		expect(databaseEngineGuideUrl('mysql')).toBeNull();
		expect(databaseEngineGuideUrl('postgresql')).toBeNull();
		expect(databaseEngineGuideUrl('unknown')).toBeNull();
	});

	it('says nothing for PostgreSQL or an unknown engine', () => {
		const context = { laravel: false, sakalaDatabase: true };
		expect(databaseEngineNote('postgresql', context)).toBeNull();
		expect(databaseEngineNote('unknown', context)).toBeNull();
	});
});
