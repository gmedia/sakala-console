import { describe, expect, it } from 'vitest';
import { feedbackPath, readFeedbackContext } from './context';

const PROJECT = '01a0cd45-c5a6-7170-9f8d-8322191f231f';
const DEPLOYMENT = '01a0cd92-b2e0-7327-97a1-d688062f30fa';

describe('feedback context', () => {
	it('carries the project and the deployment through the URL', () => {
		const path = feedbackPath('/feedback', { projectId: PROJECT, deploymentId: DEPLOYMENT });
		const params = new URL(path, 'https://sakala.test').searchParams;

		expect(readFeedbackContext(params)).toEqual({ projectId: PROJECT, deploymentId: DEPLOYMENT });
	});

	it('links without context when there is none', () => {
		expect(feedbackPath('/feedback')).toBe('/feedback');
	});

	it('ignores anything that is not a UUID', () => {
		const params = new URLSearchParams({ project: 'not-a-uuid', deployment: DEPLOYMENT });

		expect(readFeedbackContext(params)).toEqual({ projectId: null, deploymentId: null });
	});

	it('does not keep a deployment without its project', () => {
		const params = new URLSearchParams({ deployment: DEPLOYMENT });

		expect(readFeedbackContext(params).deploymentId).toBeNull();
	});
});
