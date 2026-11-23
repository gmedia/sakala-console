import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	parseBucket,
	parseBucketCredentials,
	revealBucketCredentials,
	rotateBucketKey,
	type Bucket
} from '$lib/api/resources/buckets';
import { getProject } from '$lib/features/projects/api';
import type { Project } from '$lib/features/projects/type';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromBucketFixture, getBucketFixture } from '$lib/testing/bucket-fixtures';
import { bucketAccess } from '../access';
import BucketConnectionCard from './BucketConnectionCard.svelte';

vi.mock('$app/navigation', () => ({ beforeNavigate: vi.fn(), goto: vi.fn() }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/buckets', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/buckets')>()),
	revealBucketCredentials: vi.fn(),
	rotateBucketKey: vi.fn()
}));
vi.mock('$lib/features/projects/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/features/projects/api')>()),
	getProject: vi.fn()
}));

const ready = parseBucket(getBucketFixture('bucket-show').body);
const provisioning = parseBucket(getBucketFixture('bucket-create').body);
const credentials = parseBucketCredentials(getBucketFixture('credentials').body);
const pending = parseBucket(getBucketFixture('rotate-key-redeploy').body);
const completed = parseBucket(getBucketFixture('bucket-show-rotation-completed').body);
const unknown = parseBucket(getBucketFixture('bucket-show-rotation-unknown').body);

function renderCard(role: 'owner' | 'member' | 'viewer', bucket: Bucket = ready) {
	render(QueryTestHost, {
		props: {
			component: BucketConnectionCard,
			props: { bucket, workspaceId: 'ws-1', access: bucketAccess(role, false) }
		}
	});
}

const card = () => page.getByTestId('bucket-connection');

beforeEach(() => {
	vi.mocked(revealBucketCredentials).mockReset();
	vi.mocked(rotateBucketKey).mockReset();
	vi.mocked(getProject).mockReset();
});

describe('BucketConnectionCard', () => {
	it('says the endpoint is public, and reads the audited secret only when an owner asks', async () => {
		vi.mocked(revealBucketCredentials).mockResolvedValue(credentials);
		renderCard('owner');
		await expect.element(card()).toHaveTextContent(/bisa dijangkau dari internet/);
		await expect.element(card()).toHaveTextContent(ready.connection!.endpoint);
		await expect.element(card()).toHaveTextContent(ready.connection!.access_key_id);
		await expect.element(card().getByText(/Sakala mencatatnya di log audit/)).toBeVisible();
		expect(revealBucketCredentials).not.toHaveBeenCalled();
		await expect.element(card()).not.toHaveTextContent(credentials.secret_access_key);

		await page.getByTestId('reveal-bucket-credentials').click();
		expect(revealBucketCredentials).toHaveBeenCalledWith('ws-1', ready.id);
		await expect.element(card()).toHaveTextContent(credentials.secret_access_key);
		await expect
			.element(page.getByTestId('bucket-env-block'))
			.toHaveTextContent(/AWS_ENDPOINT_URL_S3=https:\/\/s3\.sakala\.test/);

		await page.getByTestId('hide-bucket-credentials').click();
		await expect.element(card()).not.toHaveTextContent(credentials.secret_access_key);
		await expect.element(page.getByTestId('bucket-env-block')).not.toBeInTheDocument();
	});

	it('shows a member the connection without the secret, and why, without asking the API', async () => {
		renderCard('member');
		await expect.element(card()).toHaveTextContent(ready.connection!.bucket);
		await expect
			.element(page.getByTestId('bucket-credentials-owner-only'))
			.toHaveTextContent(/Secret key hanya bisa dilihat pemilik workspace/);
		await expect.element(page.getByTestId('reveal-bucket-credentials')).not.toBeInTheDocument();
		await expect.element(card().getByText('Secret access key')).not.toBeInTheDocument();
		expect(revealBucketCredentials).not.toHaveBeenCalled();
	});

	it('explains a read refused while a rotation is unsettled', async () => {
		vi.mocked(revealBucketCredentials).mockRejectedValue(
			errorFromBucketFixture('credentials-key-rotating')
		);
		renderCard('owner');
		await page.getByTestId('reveal-bucket-credentials').click();
		await expect
			.element(page.getByTestId('bucket-credentials-error'))
			.toHaveTextContent(/belum memastikan key mana yang berlaku/);
	});

	it('waits for the bucket to be ready before credentials exist', async () => {
		renderCard('owner', provisioning);
		await expect.element(page.getByTestId('bucket-credentials-not-ready')).toBeVisible();
		await expect.element(page.getByTestId('rotate-bucket-key')).toBeDisabled();
	});

	it('says an unknown rotation blocks reveal and deploys, and offers a new rotation', async () => {
		renderCard('owner', unknown);
		await expect.element(page.getByTestId('reveal-bucket-credentials')).toBeDisabled();
		await expect
			.element(page.getByTestId('key-rotation-unknown'))
			.toHaveTextContent(/Ganti secret key sekali lagi/);
		await expect.element(page.getByTestId('rotate-bucket-key')).toBeEnabled();
	});

	it('explains that the old secret stops at once, and redeploys the attached projects by default', async () => {
		vi.mocked(rotateBucketKey).mockResolvedValue(pending);
		renderCard('member');
		await page.getByTestId('rotate-bucket-key').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti secret key bucket?' });
		await expect.element(dialog).toHaveTextContent(/Secret key lama langsung berhenti berlaku/);
		await expect.element(dialog).toHaveTextContent(/Access key ID tetap sama/);
		const checkbox = dialog.getByRole('checkbox', {
			name: 'Redeploy otomatis proyek yang terpasang'
		});
		await expect.element(checkbox).toBeChecked();
		await dialog.getByRole('button', { name: 'Ganti secret key' }).click();
		expect(rotateBucketKey).toHaveBeenCalledWith('ws-1', ready.id, { redeploy_attached: true });
		await expect.element(dialog).not.toBeInTheDocument();
	});

	it('shows a pending rotation and blocks a second one', async () => {
		renderCard('owner', pending);
		await expect
			.element(page.getByTestId('key-rotation-pending'))
			.toHaveTextContent(/sedang mengganti secret key/);
		await expect.element(page.getByTestId('rotate-bucket-key')).toBeDisabled();
	});

	it('says when the key changed, and links the queued redeploy', async () => {
		const project = completed.projects[0];
		vi.mocked(getProject).mockResolvedValue({
			id: project.id,
			branch: 'main',
			active_deployment_id: 'dep-old',
			redeploy_required: true
		} as unknown as Project);
		renderCard('owner', completed);
		await expect
			.element(page.getByTestId('key-rotation-completed'))
			.toHaveTextContent(/Secret key (sudah|terakhir) diganti/);
		const row = page.getByTestId(`rotation-project-${project.id}`);
		await expect.element(row).toHaveTextContent(/Redeploy otomatis berjalan/);
		const deploymentId = completed.key_rotation!.redeploys![0].deployment_id!;
		await expect
			.element(row.getByRole('link', { name: /Lihat deployment/ }))
			.toHaveAttribute('href', `/projects/${project.id}/deployments/${deploymentId}`);
	});

	it('keeps the dialog open when a rotation is already running', async () => {
		vi.mocked(rotateBucketKey).mockRejectedValue(errorFromBucketFixture('rotate-key-busy'));
		renderCard('owner');
		await page.getByTestId('rotate-bucket-key').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti secret key bucket?' });
		await dialog.getByRole('button', { name: 'Ganti secret key' }).click();
		await expect.element(dialog.getByRole('alert')).toHaveTextContent(/masih berjalan/);
	});

	it('gives a viewer no way to reveal or rotate', async () => {
		renderCard('viewer', unknown);
		await expect.element(page.getByTestId('rotate-bucket-key')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('reveal-bucket-credentials')).not.toBeInTheDocument();
		await expect
			.element(page.getByTestId('key-rotation-unknown'))
			.toHaveTextContent(/pemilik atau anggota workspace/);
	});
});
