import { beforeNavigate } from '$app/navigation';
import { updated } from '$app/state';
import { toast } from 'svelte-sonner';
import { CONNECTION_ERROR_COPY } from '$lib/components/feedback/connection-copy';

export const NEW_VERSION_MESSAGE =
	'Versi baru Sakala sudah tersedia. Halaman dimuat ulang saat kamu pindah halaman.';

const NEW_VERSION_TOAST_ID = 'app-version';
const CONNECTION_TOAST_ID = 'app-connection';

/**
 * A tab left open across a deploy still runs the old build, whose code-split chunks are gone from
 * the server. Instead of a reload in the middle of whatever the user is doing, the Console notices
 * the new version, says so once, and makes the next navigation a full page load, which fetches the
 * new build.
 *
 * Only SvelteKit's `updated` says a new version exists: it polls `/_app/version.json`
 * (`version.pollInterval` in vite.config.ts). Vite fires `vite:preloadError` when a chunk fails to
 * load, which happens after a deploy but also when the browser is offline. So a failed chunk asks
 * SvelteKit to check the version at once, and only a check that finds a new one is announced as
 * such; otherwise the chunk could not be reached, and the toast says what every other connection
 * failure in the Console says. The failing import is left to SvelteKit, which already answers a
 * navigation it cannot load with a full load of the same URL.
 *
 * Call once, from the root layout.
 */
export function useAppVersion() {
	$effect(() => {
		if (updated.current) toast.info(NEW_VERSION_MESSAGE, { id: NEW_VERSION_TOAST_ID });
	});

	$effect(() => {
		const onPreloadError = async () => {
			if (updated.current) return;
			if (await updated.check()) return;
			toast.error(CONNECTION_ERROR_COPY.title, {
				id: CONNECTION_TOAST_ID,
				description: CONNECTION_ERROR_COPY.description
			});
		};
		const listener = () => void onPreloadError();
		window.addEventListener('vite:preloadError', listener);
		return () => window.removeEventListener('vite:preloadError', listener);
	});

	beforeNavigate(({ to, willUnload }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});
}
