import { toast } from 'svelte-sonner';

type CopyMessages = { success: string; failure: string };

/**
 * Copies text and says how it went in a toast, since a copy button only swaps its icon, which a
 * screen reader does not announce. Resolves false when the browser refused, so the button can stay
 * as it was.
 */
export async function copyWithToast(text: string, messages: CopyMessages): Promise<boolean> {
	try {
		if (!navigator.clipboard) throw new Error('Clipboard API is not available');
		await navigator.clipboard.writeText(text);
		toast.success(messages.success);
		return true;
	} catch {
		toast.error(messages.failure);
		return false;
	}
}

export const URL_COPY_MESSAGES: CopyMessages = {
	success: 'URL disalin.',
	failure: 'Browser menolak akses clipboard. Salin URL-nya secara manual.'
};
