import { describe, expect, it } from 'vitest';
import { alreadySetText, exampleNoteText, needsInputHint, prepareLead } from './presentation';

describe('prepareLead', () => {
	it('says what Sakala did, then what is left', () => {
		expect(prepareLead({ project: 'kopi', prepared: 9, needsYou: 2, databaseDecision: true })).toBe(
			'Sakala sudah membaca kopi dan menyiapkan 9 variabel. Tinggal pilihan database dan 2 variabel yang perlu kamu isi.'
		);
	});

	it('asks only for a look when nothing waits for the user', () => {
		expect(
			prepareLead({ project: 'kopi', prepared: 3, needsYou: 0, databaseDecision: false })
		).toBe('Sakala sudah membaca kopi dan menyiapkan 3 variabel. Periksa sebentar, lalu deploy.');
	});

	it('does not count variables it did not prepare', () => {
		expect(prepareLead({ project: 'kopi', prepared: 0, needsYou: 0, databaseDecision: true })).toBe(
			'Sakala sudah membaca kopi. Tinggal pilihan database.'
		);
	});
});

describe('row hints', () => {
	it('shows an example only when there is one', () => {
		expect(needsInputHint({ hint: 'smtp.mailgun.org' })).toBe(
			'Contoh: smtp.mailgun.org. Kosongkan kalau belum perlu.'
		);
		expect(needsInputHint({ hint: null })).toBe('Kosongkan kalau belum perlu.');
	});

	it('says what a production value replaced', () => {
		expect(exampleNoteText({ kind: 'production-override', from: 'local' })).toBe(
			'Diubah dari local untuk production.'
		);
		expect(exampleNoteText({ kind: 'project-url' })).toBe('Alamat proyek ini.');
	});

	it('lists existing keys in one line, or nothing', () => {
		expect(alreadySetText(['APP_KEY', 'APP_NAME'])).toBe(
			'Sudah ada di proyek, tidak diubah: APP_KEY, APP_NAME.'
		);
		expect(alreadySetText([])).toBeNull();
	});
});
