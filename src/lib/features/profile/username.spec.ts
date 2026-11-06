import { describe, expect, it } from 'vitest';
import { usernameError } from './username';

describe('usernameError follows UpdateProfileRequest', () => {
	it.each(['rani', 'rani-wulandari', 'r4ni-2', 'a'.repeat(50)])('accepts %s', (username) => {
		expect(usernameError(username)).toBeNull();
	});

	it.each(['', 'Rani', 'rani_w', 'rani wulan', '-rani', 'rani-', 'ra--ni', 'a'.repeat(51)])(
		'rejects "%s"',
		(username) => {
			expect(usernameError(username)).not.toBeNull();
		}
	);
});
