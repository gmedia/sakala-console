import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { toast } from 'svelte-sonner';
import { queryClient } from '$lib/api/query-client';
import { createWorkspaceAccessLostHandler } from './access-lost';

/** Registered in the root layout through `setWorkspaceAccessHandler`. */
export const handleWorkspaceAccessLost = createWorkspaceAccessLostHandler(queryClient, {
	notify: (workspace) =>
		toast.info(`Kamu bukan anggota ${workspace.name} lagi. Sekarang kamu di workspace pribadi.`, {
			id: `workspace-access-lost-${workspace.id}`
		}),
	leave: (workspaceId) => {
		if (
			page.route.id === '/(app)/workspaces/[workspaceId]' &&
			page.params.workspaceId === workspaceId
		) {
			void goto(resolve('/projects'), { replaceState: true });
		}
	}
});
