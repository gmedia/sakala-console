import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'svelte-sonner';
import { copyWithToast, URL_COPY_MESSAGES } from './clipboard';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(toast.success).mockClear();
	vi.mocked(toast.error).mockClear();
});

describe('copyWithToast', () => {
	it('copies the text and confirms it in a toast', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await expect(copyWithToast('https://demo.sakala.app', URL_COPY_MESSAGES)).resolves.toBe(true);

		expect(writeText).toHaveBeenCalledWith('https://demo.sakala.app');
		expect(toast.success).toHaveBeenCalledWith('URL disalin.');
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('says so when the browser refuses, instead of claiming a copy', async () => {
		vi.stubGlobal('navigator', {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) }
		});

		await expect(copyWithToast('x', URL_COPY_MESSAGES)).resolves.toBe(false);

		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith(URL_COPY_MESSAGES.failure);
	});

	it('treats a browser without the clipboard API as a refusal', async () => {
		vi.stubGlobal('navigator', {});

		await expect(copyWithToast('x', URL_COPY_MESSAGES)).resolves.toBe(false);
		expect(toast.error).toHaveBeenCalledTimes(1);
	});
});
