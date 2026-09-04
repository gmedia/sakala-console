import { vi, describe, it, expect, beforeEach } from 'vitest';

const validEnv = {
	host: 'api.staging.sakala.dev',
	key: 'abc123',
	port: 443,
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

function createMockConnectionState() {
	return { status: 'idle' };
}

function echoConstructorStub() {
	return createEchoInstanceStub();
}

async function importEchoModule(
	options: {
		browser?: boolean;
		env?: typeof validEnv | null;
		envError?: Error;
	} = {}
) {
	const { browser = true, env = validEnv, envError } = options;

	vi.doMock('$app/environment', () => ({ browser }));
	vi.doMock('./env', () => ({
		getRealtimeEnv: vi.fn(() => {
			if (envError) throw envError;
			return env;
		})
	}));

	const mockRealTimeState = createMockConnectionState();
	vi.doMock('./connection-state.svelte', () => ({
		bindConnectionState: vi.fn(),
		resetConnectionState: vi.fn(),
		realtimeState: mockRealTimeState
	}));
	vi.doMock('$lib/api/resources/broadcasting', () => ({
		authorizeChannel: vi.fn()
	}));

	const echoModule = await import('./echo');
	return { ...echoModule, realtimeState: mockRealTimeState };
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
		const { getEcho, realtimeState } = await importEchoModule({ env: null });

		const result = await getEcho();

		expect(result).toBeNull();
		expect(realtimeState.status).toBe('unavailable');
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
		EchoMock.mockImplementationOnce(function () {
			throw new Error('gagal koneksi sesaat');
		}).mockImplementation(function () {
			return createEchoInstanceStub();
		});

		const { getEcho, realtimeState } = await importEchoModule();

		const first = await getEcho();
		expect(first).toBeNull();
		expect(realtimeState.status).toBe('failed');

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

describe('getEcho - error thrown before try block', () => {
	beforeEach(() => {
		vi.resetModules();
		EchoMock.mockReset();
		vi.stubGlobal('window', {});
	});

	it('resolves to null (not an unhandled rejection) when getRealtimeEnv() throws synchronously', async () => {
		const { getEcho, realtimeState } = await importEchoModule({
			envError: new Error('error sebelum try')
		});

		await expect(getEcho()).resolves.toBeNull();
		expect(realtimeState.status).toBe('failed');
	});

	it('resets initPromise so the next call retries instead of re-awaiting the same rejected promise', async () => {
		const { getEcho } = await importEchoModule({
			envError: new Error('error sebelum try')
		});

		const first = await getEcho();
		expect(first).toBeNull();

		const second = await getEcho();
		expect(second).toBeNull();
	});
});

describe('authorizeChannel integration', () => {
	beforeEach(() => {
		vi.resetModules();
		EchoMock.mockReset();
		vi.stubGlobal('window', {});
	});

	it('callback(null, data) when authorizeChannel success', async () => {
		EchoMock.mockImplementation(echoConstructorStub);
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
		EchoMock.mockImplementation(echoConstructorStub);
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

	it('does not create Echo when disconnectEcho is called during initialization', async () => {
		let allowImport!: () => void;
		let importStarted = false;

		const importBlocker = new Promise<void>((resolve) => {
			allowImport = resolve;
		});

		vi.doMock('laravel-echo', async () => {
			importStarted = true;
			await importBlocker;
			return { default: EchoMock };
		});
		vi.doMock('pusher-js', () => ({ default: vi.fn() }));

		const { getEcho, disconnectEcho, realtimeState } = await importEchoModule();

		const pendingGetEcho = getEcho();

		await vi.waitFor(() => {
			expect(importStarted).toBe(true);
		});

		await disconnectEcho();
		const statusAfterDisconnect = realtimeState.status;

		allowImport();

		const result = await pendingGetEcho;
		expect(result).toBeNull();
		expect(EchoMock).not.toHaveBeenCalled();
		expect(realtimeState.status).toBe(statusAfterDisconnect);
	});
});
