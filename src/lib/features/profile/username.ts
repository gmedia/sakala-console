/** The same rule as `UpdateProfileRequest` in sakala-api; the API still has the final say. */
const USERNAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const USERNAME_MAX_LENGTH = 50;
export const USERNAME_RULE_HINT =
	'Huruf kecil, angka, dan tanda hubung di antaranya. Maksimal 50 karakter.';

export function usernameError(username: string): string | null {
	if (!username) return 'Username tidak boleh kosong.';
	if (username.length > USERNAME_MAX_LENGTH) return 'Username maksimal 50 karakter.';
	if (!USERNAME_PATTERN.test(username)) {
		return 'Username hanya boleh berisi huruf kecil, angka, dan tanda hubung di antaranya. Contoh: budi-santoso.';
	}
	return null;
}
