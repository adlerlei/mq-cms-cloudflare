// src/index.ts

// ====================================================
// Types and Interfaces
// ====================================================
interface MediaMaterial {
	id: string;
	filename: string;
	original_filename?: string;
	type: 'image' | 'video';
	url: string;
	size?: number;
	uploaded_at: string;
	group_id?: string;
}

interface Assignment {
	id: string;
	section_key: string;
	content_type: 'single_media' | 'group_reference';
	content_id: string;
	offset?: number;
	created_at: string;
}

interface CarouselGroup {
	id: string;
	name: string;
	materials: MediaMaterial[];
	created_at: string;
}

interface Settings {
	header_interval: number;
	carousel_interval: number;
	footer_interval: number;
}

interface Device {
	id: string;
	layoutName: string;
	last_seen: string;
}

interface Layout {
	name: string;
	created_at: string;
}

interface SectionUpdateNotification {
	type: 'section_updated';
	layout: string;
	section_key: string;
	action: 'upload' | 'delete' | 'assign' | 'unassign' | 'group_update';
	content_type?: 'single_media' | 'group_reference';
	content_id?: string;
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function layoutKey(layoutName: string, key: string): string {
	return `layout_${layoutName}_${key}`;
}

// ====================================================
// Durable Object: MessageBroadcaster
// ====================================================
export class MessageBroadcaster {
	private connections: Set<WebSocket>;
	private state: DurableObjectState;
	private pingInterval: number = 30000;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.connections = new Set();
		this.setupHeartbeat();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const layoutName = url.searchParams.get('layout') || 'default';

		const handleApi = async (path: string, method: string): Promise<Response | null> => {
			if (path === '/api/materials' && method === 'GET') {
				const materials = await this.getMaterials(layoutName);
				return new Response(JSON.stringify(materials), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/materials' && method === 'POST') {
				const material = await request.json() as MediaMaterial;
				await this.saveMaterial(layoutName, material);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path.startsWith('/api/materials/') && method === 'DELETE') {
				const materialId = decodeURIComponent(path.replace('/api/materials/', ''));
				await this.deleteMaterial(layoutName, materialId);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/assignments' && method === 'GET') {
				const assignments = await this.getAssignments(layoutName);
				return new Response(JSON.stringify(assignments), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/assignments' && method === 'POST') {
				const assignment = await request.json() as Assignment;
				await this.saveAssignment(layoutName, assignment);
				this.broadcastSectionUpdate(layoutName, assignment.section_key, 'assign', assignment.content_type, assignment.content_id);
				return new Response(JSON.stringify({ success: true, assignment }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path.startsWith('/api/assignments/') && method === 'DELETE') {
				const assignmentId = decodeURIComponent(path.replace('/api/assignments/', ''));
                const assignments = await this.getAssignments(layoutName);
                const assignmentToDelete = assignments.find(a => a.id === assignmentId);
				await this.deleteAssignment(layoutName, assignmentId);
                if(assignmentToDelete) {
				    this.broadcastSectionUpdate(layoutName, assignmentToDelete.section_key, 'unassign', assignmentToDelete.content_type, assignmentToDelete.content_id);
                }
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/groups' && method === 'GET') {
				const groups = await this.getGroups(layoutName);
				return new Response(JSON.stringify(groups), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/groups' && method === 'POST') {
				const group = await request.json() as CarouselGroup;
				await this.saveGroup(layoutName, group);
				return new Response(JSON.stringify({ success: true, group }), { headers: { 'Content-Type': 'application/json' } });
			}
            if (path.startsWith('/api/groups/') && method === 'PUT') {
                const groupId = decodeURIComponent(path.replace('/api/groups/', ''));
                const updatedGroup = await request.json() as CarouselGroup;
                await this.updateGroup(layoutName, groupId, updatedGroup);
				this.getAffectedSections(layoutName, groupId, 'group_reference').then(sections => {
					sections.forEach(sectionKey => this.broadcastSectionUpdate(layoutName, sectionKey, 'group_update', 'group_reference', groupId));
				});
                return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
            }
			if (path.startsWith('/api/groups/') && method === 'DELETE') {
				const groupId = decodeURIComponent(path.replace('/api/groups/', ''));
				await this.deleteGroup(layoutName, groupId);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/settings' && method === 'GET') {
				const settings = await this.getSettings(layoutName);
				return new Response(JSON.stringify(settings), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/settings' && method === 'PUT') {
				const settings = await request.json() as Settings;
				await this.saveSettings(layoutName, settings);
				this.broadcast(JSON.stringify({ type: 'settings_updated', layout: layoutName }));
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
            // Global (non-layout-specific) endpoints
			if (path === '/api/layouts' && method === 'GET') {
				const layouts = await this.getLayouts();
				return new Response(JSON.stringify(layouts), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/layouts' && method === 'POST') {
				const newLayout = await request.json() as Layout;
				await this.saveLayout(newLayout);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path.startsWith('/api/layouts/') && method === 'DELETE') {
				const name = decodeURIComponent(path.replace('/api/layouts/', ''));
				if (name === 'default') return new Response('Cannot delete default layout', { status: 400 });
				await this.deleteLayout(name);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/devices' && method === 'GET') {
				const devices = await this.getDevices();
				return new Response(JSON.stringify(devices), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/assign' && method === 'POST') {
				const device = await request.json() as Device;
				await this.saveDevice(device);
				this.broadcast(JSON.stringify({ type: 'device_assigned', deviceId: device.id, layoutName: device.layoutName }));
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
            if (path === '/api/login' && method === 'POST') {
                const { username, password } = await request.json();
                if (username === 'admin' && password === 'admin123') {
                    const token = btoa(JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }));
                    return new Response(JSON.stringify({ access_token: token, message: '登入成功' }), { headers: { 'Content-Type': 'application/json' } });
                } else {
                    return new Response(JSON.stringify({ message: '帳號或密碼錯誤' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
                }
            }
			return null;
		};

		const response = await handleApi(url.pathname, request.method);
		if (response) return response;

		if (request.headers.get('Upgrade') === 'websocket') {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			server.accept();
			this.connections.add(server);
			server.addEventListener('close', () => this.connections.delete(server));
			server.addEventListener('error', () => this.connections.delete(server));
			return new Response(null, { status: 101, webSocket: client });
		}

		return new Response('Not found', { status: 404 });
	}

	private broadcast(message: string) {
		this.connections.forEach(conn => {
			if (conn.readyState === WebSocket.READY_STATE_OPEN) conn.send(message);
		});
	}

	private broadcastSectionUpdate(layout: string, sectionKey: string, action: string, contentType?: string, contentId?: string) {
		const notification: SectionUpdateNotification = { type: 'section_updated', layout, section_key: sectionKey, action: action as any, content_type: contentType as any, content_id: contentId };
		this.broadcast(JSON.stringify(notification));
	}

	private async getAffectedSections(layoutName: string, contentId: string, contentType: 'single_media' | 'group_reference'): Promise<string[]> {
		const assignments = await this.getAssignments(layoutName);
		return assignments.filter(a => a.content_id === contentId && a.content_type === contentType).map(a => a.section_key);
	}

	// Storage methods... (already implemented in previous step)
	async getMaterials(layoutName: string): Promise<MediaMaterial[]> { const key = layoutKey(layoutName, 'materials'); return (await this.state.storage.get<MediaMaterial[]>(key)) || []; }
	async saveMaterial(layoutName: string, material: MediaMaterial): Promise<void> { const materials = await this.getMaterials(layoutName); materials.push(material); await this.state.storage.put(layoutKey(layoutName, 'materials'), materials); }
	async deleteMaterial(layoutName: string, materialId: string): Promise<void> { const materials = await this.getMaterials(layoutName); const filtered = materials.filter(m => m.id !== materialId); await this.state.storage.put(layoutKey(layoutName, 'materials'), filtered); }
	async getAssignments(layoutName: string): Promise<Assignment[]> { const key = layoutKey(layoutName, 'assignments'); return (await this.state.storage.get<Assignment[]>(key)) || []; }
	async saveAssignment(layoutName: string, assignment: Assignment): Promise<void> { const assignments = await this.getAssignments(layoutName); assignments.push(assignment); await this.state.storage.put(layoutKey(layoutName, 'assignments'), assignments); }
	async deleteAssignment(layoutName: string, assignmentId: string): Promise<void> { const assignments = await this.getAssignments(layoutName); const filtered = assignments.filter(a => a.id !== assignmentId); await this.state.storage.put(layoutKey(layoutName, 'assignments'), filtered); }
	async getGroups(layoutName: string): Promise<CarouselGroup[]> { const key = layoutKey(layoutName, 'groups'); return (await this.state.storage.get<CarouselGroup[]>(key)) || []; }
	async saveGroup(layoutName: string, group: CarouselGroup): Promise<void> { const groups = await this.getGroups(layoutName); groups.push(group); await this.state.storage.put(layoutKey(layoutName, 'groups'), groups); }
	async updateGroup(layoutName: string, groupId: string, updatedGroup: CarouselGroup): Promise<void> { const groups = await this.getGroups(layoutName); const index = groups.findIndex(g => g.id === groupId); if (index !== -1) { groups[index] = updatedGroup; await this.state.storage.put(layoutKey(layoutName, 'groups'), groups); } }
	async deleteGroup(layoutName: string, groupId: string): Promise<void> { const groups = await this.getGroups(layoutName); const filtered = groups.filter(g => g.id !== groupId); await this.state.storage.put(layoutKey(layoutName, 'groups'), filtered); }
	async getSettings(layoutName: string): Promise<Settings> { const key = layoutKey(layoutName, 'settings'); return (await this.state.storage.get<Settings>(key)) || { header_interval: 5, carousel_interval: 6, footer_interval: 7 }; }
	async saveSettings(layoutName: string, settings: Settings): Promise<void> { await this.state.storage.put(layoutKey(layoutName, 'settings'), settings); }
	async getLayouts(): Promise<Layout[]> { const layouts = await this.state.storage.get<Layout[]>('layouts') || []; if (!layouts.some(l => l.name === 'default')) { layouts.unshift({ name: 'default', created_at: new Date().toISOString() }); await this.state.storage.put('layouts', layouts); } return layouts; }
	async saveLayout(layout: Layout): Promise<void> { const layouts = await this.getLayouts(); if (!layouts.some(l => l.name === layout.name)) { layouts.push(layout); await this.state.storage.put('layouts', layouts); } }
	async deleteLayout(layoutName: string): Promise<void> { let layouts = await this.getLayouts(); layouts = layouts.filter(l => l.name !== layoutName); await this.state.storage.put('layouts', layouts); }
	async getDevices(): Promise<Device[]> { return (await this.state.storage.get<Device[]>('devices')) || []; }
	async saveDevice(device: Device): Promise<void> { let devices = await this.getDevices(); const index = devices.findIndex(d => d.id === device.id); if (index !== -1) { devices[index] = device; } else { devices.push(device); } await this.state.storage.put('devices', devices); }

	private async setupHeartbeat(): Promise<void> { if (await this.state.storage.getAlarm() === null) { await this.state.storage.setAlarm(Date.now() + this.pingInterval); } }
	async alarm(): Promise<void> { this.broadcast(JSON.stringify({ type: 'ping' })); await this.state.storage.setAlarm(Date.now() + this.pingInterval); }
}

// ====================================================
// Worker Entrypoint
// ====================================================
export interface Env { ASSETS: Fetcher; MESSAGE_BROADCASTER: DurableObjectNamespace; MEDIA_BUCKET: R2Bucket; VITEST_POOL_ID?: string; }
function getFileType(filename: string): 'image' | 'video' { const ext = (filename.split('.').pop() || '').toLowerCase(); if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'; if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video'; return 'image'; }

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
		const stub = env.MESSAGE_BROADCASTER.get(id);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
		}

		if (url.pathname === '/api/config') {
			const deviceId = url.searchParams.get('deviceId');
			if (!deviceId) return new Response('deviceId is required', { status: 400 });

			const devicesResponse = await stub.fetch('http://localhost/api/devices');
			const devices = await devicesResponse.json() as Device[];
			const device = devices.find(d => d.id === deviceId);
			const layoutName = device ? device.layoutName : 'default';

			// Only auto-assign for real devices, not admin views
			if (!env.VITEST_POOL_ID && !deviceId.startsWith('admin-view-')) {
				const assignRequest = new Request('http://localhost/api/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deviceId, layoutName, last_seen: new Date().toISOString() }) });
				ctx.waitUntil(stub.fetch(assignRequest));
			}

			const [materials, assignments, groups, settings] = await Promise.all([
				stub.fetch(`http://localhost/api/materials?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/assignments?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/groups?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/settings?layout=${layoutName}`).then(res => res.json()),
			]);
			
			const response = { layout: layoutName, materials, assignments, groups, settings, available_sections: { header_video: '頁首影片區', carousel_top_left: '左上輪播區', carousel_top_right: '右上輪播區', carousel_bottom_left: '左下輪播區', carousel_bottom_right: '右下輪播區', footer_content: '頁尾內容區' } };
			return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
		}

		if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
			return stub.fetch(request);
		}

		// Handle static file serving with ASSETS binding
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		// Fallback if ASSETS binding is not available
		return new Response('Static assets not configured properly', { status: 500 });
	},
};