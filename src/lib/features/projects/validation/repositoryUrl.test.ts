import { describe, expect, it } from 'vitest';
import { validateRepositoryUrl } from './repositoryUrl';

describe('validateRepositoryUrl', () => {
	it('should return error message for empty URL', () => {
		expect(validateRepositoryUrl('')).toBe('Repository URL wajib diisi.');
	});

	it('should return error message for whitespace input', () => {
		expect(validateRepositoryUrl('   ')).toBe('Repository URL wajib diisi.');
	});

	it('should return error message for invalid URL', () => {
		expect(validateRepositoryUrl('invalid-url')).toBe('Repository URL tidak valid.');
	});

	it('should return error message for URL with insufficient path segments', () => {
		expect(validateRepositoryUrl('https://github.com/username')).toBe(
			'Format repository GitHub tidak valid.'
		);
	});

	it('should return error message for URL without repo path', () => {
		expect(validateRepositoryUrl('https://github.com')).toBe(
			'Format repository GitHub tidak valid.'
		);
	});

	it('should return null for valid GitHub repository URL', () => {
		expect(validateRepositoryUrl('https://github.com/username/nama-repo.git')).toBeNull();
	});

	it('should return null for valid GitHub repository URL without .git', () => {
		expect(validateRepositoryUrl('https://github.com/username/nama-repo')).toBeNull();
	});
});
