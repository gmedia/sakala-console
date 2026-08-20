import { describe, it, expect } from 'vitest';
import {
	validateProjectName,
	validateBranch,
	sanitizePortInput,
	validatePort,
	validateBuildCommand,
	validateConfigureProjectStep,
	isConfigureProjectStepValid,
	type ConfigureProjectStepErrors
} from './configureProjectStep';

describe('validateProjectName', () => {
	it('should return error message for empty project name', () => {
		expect(validateProjectName('')).toBe('Nama proyek wajib diisi.');
	});
	it('should return error message for whitespace-only project name', () => {
		expect(validateProjectName('   ')).toBe('Nama proyek wajib diisi.');
	});
	it('should return null for valid project name', () => {
		expect(validateProjectName('My Project')).toBeNull();
	});
});

describe('validateBranch', () => {
	it('should return error message for empty branch', () => {
		expect(validateBranch('')).toBe('Branch wajib diisi.');
	});
	it('should return null for valid branch', () => {
		expect(validateBranch('main')).toBeNull();
	});
});

describe('sanitizePortInput', () => {
	it('should remove non-digit characters from port input', () => {
		expect(sanitizePortInput('80a80')).toBe('8080');
	});

	it('should remove characters and symbols from port input', () => {
		expect(sanitizePortInput('po:rt-80!80')).toBe('8080');
	});

	it('should return the same value for valid port input', () => {
		expect(sanitizePortInput('3000')).toBe('3000');
	});

	it('should return empty string when input is empty', () => {
		expect(sanitizePortInput('')).toBe('');
	});

	it('should return empty string when input has no digits at all', () => {
		expect(sanitizePortInput('abc-def')).toBe('');
	});
});

describe('validatePort', () => {
	it('should return error message for empty port', () => {
		expect(validatePort('')).toBe('Port wajib diisi.');
	});

	it('should return error message for non-numeric port', () => {
		expect(validatePort('80a0')).toBe('Port hanya boleh berisi angka');
	});

	it('should return error message for whitespace in middle of port', () => {
		expect(validatePort('80 80')).toBe('Port hanya boleh berisi angka');
	});

	it('should return null for valid port', () => {
		expect(validatePort('8080')).toBeNull();
	});

	it('should return error message for port below minimum (0)', () => {
		expect(validatePort('0')).toBe('Port harus antara 1-65535.');
	});

	it('should return error message for port above maximum (65536)', () => {
		expect(validatePort('65536')).toBe('Port harus antara 1-65535.');
	});

	it('should return null for minimum valid port (1)', () => {
		expect(validatePort('1')).toBeNull();
	});

	it('should return null for maximum valid port (65535)', () => {
		expect(validatePort('65535')).toBeNull();
	});
});

describe('validateBuildCommand', () => {
	it('should return error message for empty build command', () => {
		expect(validateBuildCommand('')).toBe('Build command wajib diisi.');
	});

	it('should return error message for whitespace-only build command', () => {
		expect(validateBuildCommand('   ')).toBe('Build command wajib diisi.');
	});

	it('should return null for valid build command', () => {
		expect(validateBuildCommand('npm run build')).toBeNull();
	});
});

describe('validateConfigureProjectStep', () => {
	const validInput = {
		projectName: 'My Project',
		branch: 'main',
		port: '8080',
		buildCommand: 'npm run build'
	};

	it('should return all null errors for valid input', () => {
		const result = validateConfigureProjectStep(validInput);

		expect(result).toEqual<ConfigureProjectStepErrors>({
			projectName: null,
			branch: null,
			port: null,
			buildCommand: null
		});
	});

	it('should return error for only fields that are invalid', () => {
		const result = validateConfigureProjectStep({
			...validInput,
			projectName: '',
			port: 'qweasd'
		});
		expect(result).toEqual<ConfigureProjectStepErrors>({
			projectName: 'Nama proyek wajib diisi.',
			branch: null,
			port: 'Port hanya boleh berisi angka',
			buildCommand: null
		});
	});

	it('should return errors for all fields that are invalid', () => {
		const result = validateConfigureProjectStep({
			projectName: '',
			branch: '',
			port: 'qweasd',
			buildCommand: ''
		});
		expect(result).toEqual<ConfigureProjectStepErrors>({
			projectName: 'Nama proyek wajib diisi.',
			branch: 'Branch wajib diisi.',
			port: 'Port hanya boleh berisi angka',
			buildCommand: 'Build command wajib diisi.'
		});
	});
});

describe('isConfigureProjectStepValid', () => {
	it('should return true when all errors are null', () => {
		const errors: ConfigureProjectStepErrors = {
			projectName: null,
			branch: null,
			port: null,
			buildCommand: null
		};
		expect(isConfigureProjectStepValid(errors)).toBe(true);
	});

	it('should return false when one field has an error', () => {
		const errors: ConfigureProjectStepErrors = {
			projectName: 'Nama proyek wajib diisi.',
			branch: null,
			port: null,
			buildCommand: null
		};
		expect(isConfigureProjectStepValid(errors)).toBe(false);
	});

	it('should return false when multiple fields have errors', () => {
		const errors: ConfigureProjectStepErrors = {
			projectName: 'Nama proyek wajib diisi.',
			branch: 'Branch wajib diisi.',
			port: null,
			buildCommand: null
		};
		expect(isConfigureProjectStepValid(errors)).toBe(false);
	});

	it('should return false when all fields have errors', () => {
		const errors: ConfigureProjectStepErrors = {
			projectName: 'Nama proyek wajib diisi.',
			branch: 'Branch wajib diisi.',
			port: 'Port hanya boleh berisi angka',
			buildCommand: 'Build command wajib diisi.'
		};
		expect(isConfigureProjectStepValid(errors)).toBe(false);
	});
});
