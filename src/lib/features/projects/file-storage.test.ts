import { describe, expect, it } from 'vitest';
import { FILE_STORAGE_GUIDE_URL } from '$lib/config/project';
import { FILE_STORAGE_COPY, fileStorageNote, projectFileStorageGuideUrl } from './file-storage';

const env = (...keys: string[]) => keys.map((key) => ({ key }));
const stack = (provider: string | null, framework: string | null = null) => ({
	provider,
	framework
});

describe('fileStorageNote', () => {
	it('speaks up for a Laravel app, whose uploads go to its own disk by default', () => {
		expect(fileStorageNote({ stack: stack('php', 'Laravel'), envEntries: [] })).toEqual({
			guideUrl: `${FILE_STORAGE_GUIDE_URL}#laravel`
		});
	});

	it.each(['FILESYSTEM_DISK', 'FILESYSTEM_DRIVER'])(
		'treats %s in .env.example as Laravel, even when the framework was not detected',
		(key) => {
			expect(fileStorageNote({ stack: stack('php'), envEntries: env('APP_NAME', key) })).toEqual({
				guideUrl: `${FILE_STORAGE_GUIDE_URL}#laravel`
			});
		}
	);

	it.each(['UPLOAD_DIR', 'UPLOAD_PATH', 'UPLOADS_DIR', 'UPLOADS_PATH'])(
		'speaks up for an upload folder named %s, linking the Node section for a Node app',
		(key) => {
			expect(fileStorageNote({ stack: stack('node'), envEntries: env(key) })).toEqual({
				guideUrl: `${FILE_STORAGE_GUIDE_URL}#node`
			});
		}
	);

	it('links the whole guide when the framework has no section of its own', () => {
		expect(fileStorageNote({ stack: stack('python'), envEntries: env('UPLOAD_DIR') })).toEqual({
			guideUrl: FILE_STORAGE_GUIDE_URL
		});
		expect(fileStorageNote({ stack: null, envEntries: env('UPLOAD_PATH') })).toEqual({
			guideUrl: FILE_STORAGE_GUIDE_URL
		});
	});

	it('stays quiet without a clear sign, so the note is rare enough to be read', () => {
		expect(fileStorageNote({ stack: stack('node'), envEntries: [] })).toBeNull();
		expect(
			fileStorageNote({
				stack: stack('node', 'next'),
				envEntries: env('DATABASE_URL', 'AWS_BUCKET', 'CACHE_DRIVER', 'upload_dir')
			})
		).toBeNull();
		expect(fileStorageNote({ stack: undefined, envEntries: [] })).toBeNull();
	});
});

describe('projectFileStorageGuideUrl', () => {
	it('opens the section for the project framework, or the whole guide', () => {
		expect(projectFileStorageGuideUrl(stack('php', 'laravel'))).toBe(
			`${FILE_STORAGE_GUIDE_URL}#laravel`
		);
		expect(projectFileStorageGuideUrl(stack('node', 'vite'))).toBe(
			`${FILE_STORAGE_GUIDE_URL}#node`
		);
		expect(projectFileStorageGuideUrl(stack('python', 'django'))).toBe(FILE_STORAGE_GUIDE_URL);
		expect(projectFileStorageGuideUrl(null)).toBe(FILE_STORAGE_GUIDE_URL);
	});
});

describe('FILE_STORAGE_COPY', () => {
	it('says what is lost, when, and where uploads go instead', () => {
		expect(FILE_STORAGE_COPY.note).toContain(
			'hilang saat proyek tidur, di-restart, atau di-deploy ulang'
		);
		expect(FILE_STORAGE_COPY.note).toContain('object storage yang kompatibel dengan S3');
	});
});
