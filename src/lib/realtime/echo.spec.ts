import { vi, describe, it, expect, beforeEach } from 'vitest';

const validEnv = {
	host: 'api.staging.sakala.dev',
	key: 'abc123',
	port: '443',
	scheme: 'https' as const
};

const EchoMock = vi.fn();
vi.mock('laravel-echo', () => ({ default: EchoMock }));
vi.mock('pusher-js', () => ({ default: vi.fn() }));

function createEchoInstanceStub() {
	return {
		connector: { pusher: { connection: { bind: vi.fn() } } },
		disconnect: vi.fn(),
		private: vi.fn(),
		leave: vi.fn()
	};
}

function echoConstructorStub() {
	return createEchoInstanceStub();
}

async function importEchoModule(
	options: {
		browser?: boolean;
		env?: typeof validEnv | null;
	} = {}
) {
	const { browser = true, env = validEnv } = options;

	vi.doMock('$app/environment', () => ({ browser }));
	vi.doMock('./env', () => ({ getRealtimeEnv: vi.fn(() => env) }));
	vi.doMock('./connection-state.svelte', () => ({
		bindConnectionState: vi.fn(),
		resetConnectionState: vi.fn()
	}));
	vi.doMock('$lib/api/resources/broadcasting', () => ({
		authorizeChannel: vi.fn()
	}));

	return import('./echo');
}

describe('getEcho - browser-only & lazy', () => {
	beforeEach(() => {
		vi.resetModules();
		EchoMock.mockReset();
		vi.stubGlobal('window', {});
	});

	it('resolves to null without create instance when not in browser', async () => {
		const { getEcho } = await importEchoModule({ browser: false });
		const result = await getEcho();
		expect(result).toBeNull();
		expect(EchoMock).not.toHaveBeenCalled();
	});

	it('not create instance echo because module import', async () => {
		await importEchoModule({ browser: true });

		expect(EchoMock).not.toHaveBeenCalled();
	});

	it('resolves to null when env is invalid', async () => {
		const { getEcho } = await importEchoModule({ env: null });

		const result = await getEcho();

		expect(result).toBeNull();
		expect(EchoMock).not.toHaveBeenCalled();
	});

	it('returns the same instance when called multiple times', async () => {
		EchoMock.mockImplementation(echoConstructorStub);
		const { getEcho } = await importEchoModule();

		const [a, b, c] = await Promise.all([getEcho(), getEcho(), getEcho()]);

		expect(EchoMock).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it('retries creating echo instance on failure', async () => {
		EchoMock.mockImplementationOnce(() => {
			throw new Error('gagal koneksi sesaat');
		}).mockImplementation(function () {
			return createEchoInstanceStub();
		});

		const { getEcho } = await importEchoModule();

		const first = await getEcho();
		expect(first).toBeNull();

		const second = await getEcho();
		expect(second).not.toBeNull();
		expect(EchoMock).toHaveBeenCalledTimes(2);
	});

	it('bindConnectionState is called with instance when echo is successfully created', async () => {
		const instance = createEchoInstanceStub();
		EchoMock.mockImplementation(function () {
			return instance;
		});

		const { getEcho } = await importEchoModule();
		const echoConnectionState = await import('./connection-state.svelte');

		const result = await getEcho();

		expect(echoConnectionState.bindConnectionState).toHaveBeenCalledWith(result);
	});
});

describe('authorizeChannel integration', () => {
	beforeEach(() => {
		vi.resetModules();
		EchoMock.mockReset();
		vi.stubGlobal('window', {});
	});

	it('callback(null, data) when authorizeChannel success', async () => {
		EchoMock.mockImplementation(() => createEchoInstanceStub());
		const { getEcho } = await importEchoModule();
		const broadcasting = await import('$lib/api/resources/broadcasting');

		const authData = { auth: 'signed-auth-string' };
		vi.mocked(broadcasting.authorizeChannel).mockResolvedValue(authData);

		await getEcho();
		const constructorConfig = EchoMock.mock.calls[0][0];
		const authorizer = constructorConfig.authorizer({ name: 'private-deployment.1' });

		const callback = vi.fn();
		authorizer.authorize('socket-123', callback);
		await vi.waitFor(() => expect(callback).toHaveBeenCalled());

		expect(callback).toHaveBeenCalledWith(null, authData);
	});

	it('callback(Error, null) when authorizeChannel fails', async () => {
		EchoMock.mockImplementation(() => createEchoInstanceStub());
		const { getEcho } = await importEchoModule();
		const broadcasting = await import('$lib/api/resources/broadcasting');

		vi.mocked(broadcasting.authorizeChannel).mockRejectedValue(new Error('403 forbidden'));

		await getEcho();
		const constructorConfig = EchoMock.mock.calls[0][0];
		const authorizer = constructorConfig.authorizer({ name: 'private-deployment.1' });

		const callback = vi.fn();
		authorizer.authorize('socket-123', callback);
		await vi.waitFor(() => expect(callback).toHaveBeenCalled());

		expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
	});
});

describe('disconnectEcho', () => {
	beforeEach(() => {
		vi.resetModules();
		EchoMock.mockReset();
		vi.stubGlobal('window', {});
	});

	it('disconnects the echo instance, resets the connection state, and creates a new instance on the next call', async () => {
		const firstInstance = createEchoInstanceStub();
		const secondInstance = createEchoInstanceStub();
		EchoMock.mockImplementationOnce(function () {
			return firstInstance;
		}).mockImplementationOnce(function () {
			return secondInstance;
		});

		const { getEcho, disconnectEcho } = await importEchoModule();
		const connectionState = await import('./connection-state.svelte');

		const first = await getEcho();
		expect(first).toBe(firstInstance);

		await disconnectEcho();

		expect(firstInstance.disconnect).toHaveBeenCalled();
		expect(connectionState.resetConnectionState).toHaveBeenCalled();

		const second = await getEcho();
		expect(second).toBe(secondInstance);
		expect(second).not.toBe(first);
	});
});
