import { describe, expect, it } from 'vitest';
import { missingEnvExampleKeys, missingEnvVariablesNote } from './missing-env-variables';

const example = {
	file: '.env.example' as const,
	entries: [
		{ key: 'APP_KEY', example_value: null },
		{ key: 'PORT', example_value: '3000' },
		{ key: 'DATABASE_URL', example_value: null },
		{ key: 'JWT_SECRET', example_value: null },
		{ key: 'SMTP_PASSWORD', example_value: 'ganti-saya' },
		{ key: 'APP_NAME', example_value: 'Toko' }
	]
};
const href = '/projects/p-1/environments#isi-dari-env-example';

describe('missingEnvExampleKeys', () => {
	it('lists what the project has not set, without what Sakala fills', () => {
		expect(
			missingEnvExampleKeys(example, { existingKeys: ['APP_KEY'], databaseProvided: true })
		).toEqual(['JWT_SECRET', 'SMTP_PASSWORD', 'APP_NAME']);
	});

	it('counts the database variables when no database is attached', () => {
		expect(
			missingEnvExampleKeys(example, { existingKeys: ['APP_KEY'], databaseProvided: false })
		).toContain('DATABASE_URL');
	});
});

describe('missingEnvVariablesNote', () => {
	it('names three keys and counts the rest, with the way to fill them', () => {
		const note = missingEnvVariablesNote(example, {
			existingKeys: [],
			databaseProvided: false,
			href
		});

		expect(note?.sentence).toBe(
			'.env.example di repository-mu menyebut 5 variabel yang belum ada di proyek ini: APP_KEY, DATABASE_URL, JWT_SECRET, dan 2 lainnya. Aplikasi yang membacanya saat mulai bisa gagal menjawab pengecekan Sakala.'
		);
		expect(note?.href).toBe(href);
		expect(note?.action).toBe('Isi di tab Variabel');
	});

	it('says nothing when every variable is set', () => {
		expect(
			missingEnvVariablesNote(example, {
				existingKeys: ['APP_KEY', 'JWT_SECRET', 'SMTP_PASSWORD', 'APP_NAME'],
				databaseProvided: true,
				href
			})
		).toBeNull();
	});
});
