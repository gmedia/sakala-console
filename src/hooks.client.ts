import type { HandleClientError } from '@sveltejs/kit';
import { isConnectionFailure } from '$lib/api/errors';

/**
 * A page whose code never arrived (offline, `ERR_NETWORK_CHANGED` while the route's chunk loads)
 * reaches the root error page as a 500. Marking it lets that page say the connection failed
 * instead of blaming the server.
 */
export const handleError: HandleClientError = ({ error, message }) => ({
	message,
	connection: isConnectionFailure(error)
});
