import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('MQ CMS Worker', () => {
	it('handles unknown routes with 404', async () => {
		const request = new IncomingRequest('http://example.com/nonexistent');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it('handles media API endpoint', async () => {
		const request = new IncomingRequest('http://example.com/api/media');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
	});

	it('handles media with settings API endpoint', async () => {
		const request = new IncomingRequest('http://example.com/api/media_with_settings');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toHaveProperty('materials');
		expect(data).toHaveProperty('assignments');
		expect(data).toHaveProperty('groups');
		expect(data).toHaveProperty('settings');
	});

	// Note: WebSocket tests are commented out due to Durable Object storage isolation issues
	// it('handles WebSocket upgrade requests', async () => {
	// 	const request = new IncomingRequest('http://example.com/ws', {
	// 		headers: { 'Upgrade': 'websocket' }
	// 	});
	// 	const ctx = createExecutionContext();
	// 	const response = await worker.fetch(request, env, ctx);
	// 	await waitOnExecutionContext(ctx);
	// 	expect(response.status).toBe(101);
	// });
});
