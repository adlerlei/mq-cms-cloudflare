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
	name?: string;
	address?: string;
	notes?: string;
	layoutName: string;
	last_seen: string;
	created_at?: string;
}

interface Layout {
	name: string;
	template: string; // 模板类型：default, dual_video 等
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
			if (path === '/api/assignments/bulk' && method === 'PUT') {
				const assignments = await request.json() as Assignment[];
				await this.state.storage.put(layoutKey(layoutName, 'assignments'), assignments);
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
			if (path.startsWith('/api/layouts/') && method === 'PATCH') {
				const name = decodeURIComponent(path.replace('/api/layouts/', ''));
				const updates = await request.json() as Partial<Layout>;
				await this.updateLayout(name, updates);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path === '/api/devices' && method === 'GET') {
				const devices = await this.getDevices();
				return new Response(JSON.stringify(devices), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path.startsWith('/api/devices/') && method === 'DELETE') {
				const deviceId = decodeURIComponent(path.replace('/api/devices/', ''));
				await this.deleteDevice(deviceId);
				this.broadcast(JSON.stringify({ type: 'device_deleted', deviceId }));
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
			}
			if (path.startsWith('/api/devices/') && method === 'PUT') {
				const deviceId = decodeURIComponent(path.replace('/api/devices/', ''));
				const updates = await request.json() as Partial<Device>;
				await this.updateDevice(deviceId, updates);
				return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
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
	async getLayouts(): Promise<Layout[]> { const layouts = await this.state.storage.get<Layout[]>('layouts') || []; if (!layouts.some(l => l.name === 'default')) { layouts.unshift({ name: 'default', template: 'default', created_at: new Date().toISOString() }); await this.state.storage.put('layouts', layouts); } return layouts; }
	async saveLayout(layout: Layout): Promise<void> { const layouts = await this.getLayouts(); if (!layouts.some(l => l.name === layout.name)) { layouts.push(layout); await this.state.storage.put('layouts', layouts); } }
	async updateLayout(layoutName: string, updates: Partial<Layout>): Promise<void> { let layouts = await this.getLayouts(); const index = layouts.findIndex(l => l.name === layoutName); if (index !== -1) { layouts[index] = { ...layouts[index], ...updates }; await this.state.storage.put('layouts', layouts); } }
	async deleteLayout(layoutName: string): Promise<void> { let layouts = await this.getLayouts(); layouts = layouts.filter(l => l.name !== layoutName); await this.state.storage.put('layouts', layouts); }
	async getDevices(): Promise<Device[]> { return (await this.state.storage.get<Device[]>('devices')) || []; }
	async saveDevice(device: Device): Promise<void> { let devices = await this.getDevices(); const index = devices.findIndex(d => d.id === device.id); if (index !== -1) { devices[index] = { ...devices[index], ...device }; } else { devices.push({ ...device, created_at: device.created_at || new Date().toISOString() }); } await this.state.storage.put('devices', devices); }
	async updateDevice(deviceId: string, updates: Partial<Device>): Promise<void> { let devices = await this.getDevices(); const index = devices.findIndex(d => d.id === deviceId); if (index !== -1) { devices[index] = { ...devices[index], ...updates }; await this.state.storage.put('devices', devices); } }
	async deleteDevice(deviceId: string): Promise<void> { let devices = await this.getDevices(); devices = devices.filter(d => d.id !== deviceId); await this.state.storage.put('devices', devices); }

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

			// Determine layout name based on device ID
			let layoutName = 'default';
			if (deviceId.startsWith('admin-view-') || deviceId.startsWith('preview-')) {
				// Extract layout name from admin-view-{layoutName} or preview-{layoutName}
				layoutName = deviceId.replace('admin-view-', '').replace('preview-', '');
			} else {
				// For real devices, lookup their assigned layout
				const devicesResponse = await stub.fetch('http://localhost/api/devices');
				const devices = await devicesResponse.json() as Device[];
				const device = devices.find(d => d.id === deviceId);
				layoutName = device ? device.layoutName : 'default';

				// Auto-assign for real devices
				if (!env.VITEST_POOL_ID) {
					const assignRequest = new Request('http://localhost/api/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deviceId, layoutName, last_seen: new Date().toISOString() }) });
					ctx.waitUntil(stub.fetch(assignRequest));
				}
			}

			let [materials, assignments, groups, settings] = await Promise.all([
				stub.fetch(`http://localhost/api/materials?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/assignments?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/groups?layout=${layoutName}`).then(res => res.json()),
				stub.fetch(`http://localhost/api/settings?layout=${layoutName}`).then(res => res.json()),
			]);
			
			// Auto-cleanup orphan assignments
			const validMaterialIds = new Set((materials as any[]).map(m => m.id));
			const validGroupIds = new Set((groups as any[]).map(g => g.id));
			const originalLength = (assignments as any[]).length;
			assignments = (assignments as any[]).filter(a => {
				if (a.content_type === 'single_media') {
					return validMaterialIds.has(a.content_id);
				} else if (a.content_type === 'group_reference') {
					return validGroupIds.has(a.content_id);
				}
				return true;
			});
			
			// Save cleaned assignments if any were removed
			if (assignments.length !== originalLength) {
				console.log(`[Auto-cleanup] Removed ${originalLength - assignments.length} orphan assignments from ${layoutName}`);
				const saveRequest = new Request(`http://localhost/api/assignments/bulk?layout=${layoutName}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(assignments)
				});
				ctx.waitUntil(stub.fetch(saveRequest));
			}
			
			console.log(`[/api/config] deviceId=${deviceId}, layoutName=${layoutName}, materials count=${materials.length}, assignments count=${assignments.length}`);
			
			const response = { layout: layoutName, materials, assignments, groups, settings, available_sections: { header_video: '頁首影片區', carousel_top_left: '左上輪播區', carousel_top_right: '右上輪播區', carousel_bottom_left: '左下輪播區', carousel_bottom_right: '右下輪播區', footer_content: '頁尾內容區' } };
			return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
		}

		// Handle media upload
		if (url.pathname === '/api/media' && request.method === 'POST') {
			try {
				const formData = await request.formData();
				const file = formData.get('file') as File;
				const layoutName = formData.get('layout') as string || 'default';
				const sectionKey = formData.get('section_key') as string;

				console.log(`[/api/media] Upload request - layout=${layoutName}, file=${file?.name}, fileSize=${file?.size}, section_key=${sectionKey}`);

				if (!file || !file.name) {
					console.error('[/api/media] No file provided in request');
					return new Response(JSON.stringify({ 
						error: '未選擇檔案',
						message: '請確保已選擇要上傳的圖片或影片檔案'
					}), { 
						status: 400, 
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
					});
				}
				
				if (file.size === 0) {
					console.error('[/api/media] File size is 0');
					return new Response(JSON.stringify({ 
						error: '檔案無效',
						message: '上傳的檔案大小為 0，請選擇有效的檔案'
					}), { 
						status: 400, 
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
					});
				}

				// Generate unique filename
				const timestamp = Date.now();
				const originalFilename = file.name;
				const ext = originalFilename.split('.').pop();
				const uniqueFilename = `${timestamp}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

				// Upload to R2
				await env.MEDIA_BUCKET.put(uniqueFilename, file.stream(), {
					httpMetadata: {
						contentType: file.type,
					},
				});

				// Create material record
				const material: MediaMaterial = {
					id: generateId(),
					filename: uniqueFilename,
					original_filename: originalFilename,
					type: getFileType(originalFilename),
					url: `/media/${uniqueFilename}`,
					size: file.size,
					uploaded_at: new Date().toISOString(),
				};

				// Save to Durable Object
				const saveRequest = new Request(`http://localhost/api/materials?layout=${layoutName}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(material),
				});
				const saveResponse = await stub.fetch(saveRequest);
				console.log(`[/api/media] Material saved to layout=${layoutName}, material.id=${material.id}, response.ok=${saveResponse.ok}`);

				// If section_key is provided, auto-assign
				if (sectionKey) {
					const assignment: Assignment = {
						id: generateId(),
						section_key: sectionKey,
						content_type: 'single_media',
						content_id: material.id,
						created_at: new Date().toISOString(),
					};
					const assignRequest = new Request(`http://localhost/api/assignments?layout=${layoutName}`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(assignment),
					});
					await stub.fetch(assignRequest);
				}

				return new Response(JSON.stringify({ 
					success: true, 
					material,
					message: '上傳成功'
				}), { 
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
				});
			} catch (error) {
				console.error('Media upload error:', error);
				return new Response(JSON.stringify({ 
					error: '上傳失敗', 
					message: error instanceof Error ? error.message : '未知錯誤'
				}), { 
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
				});
			}
		}

		// Handle group deletion with cascade delete of materials
		if (url.pathname.match(/^\/api\/groups\/[^/]+$/) && request.method === 'DELETE') {
			try {
				const groupId = decodeURIComponent(url.pathname.replace('/api/groups/', ''));
				const layoutName = url.searchParams.get('layout') || 'default';
				
				console.log(`[DELETE /api/groups] Deleting group ${groupId} from layout ${layoutName}`);
				
				// Get group info from Durable Object
				const groupsResponse = await stub.fetch(`http://localhost/api/groups?layout=${layoutName}`);
				const groups = await groupsResponse.json() as CarouselGroup[];
				const group = groups.find(g => g.id === groupId);
				
				if (!group) {
					return new Response(JSON.stringify({ error: '群組不存在' }), { 
						status: 404, 
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
					});
				}
				
				// Get all materials from Durable Object
				const materialsResponse = await stub.fetch(`http://localhost/api/materials?layout=${layoutName}`);
				const allMaterials = await materialsResponse.json() as MediaMaterial[];
				
				// Find materials that belong to this group
				const groupMaterialIds = group.materials || [];
				const materialsToDelete = allMaterials.filter(m => groupMaterialIds.includes(m.id));
				
				console.log(`[DELETE /api/groups] Found ${materialsToDelete.length} materials to delete`);
				
				// Delete files from R2
				for (const material of materialsToDelete) {
					try {
						await env.MEDIA_BUCKET.delete(material.filename);
						console.log(`[DELETE /api/groups] Deleted R2 file: ${material.filename}`);
					} catch (error) {
						console.error(`[DELETE /api/groups] Failed to delete R2 file ${material.filename}:`, error);
					}
				}
				
				// Delete materials from Durable Object
				for (const material of materialsToDelete) {
					await stub.fetch(`http://localhost/api/materials/${material.id}?layout=${layoutName}`, { method: 'DELETE' });
				}
				
				// Delete assignments that reference this group
				const assignmentsResponse = await stub.fetch(`http://localhost/api/assignments?layout=${layoutName}`);
				const assignments = await assignmentsResponse.json() as Assignment[];
				const groupAssignments = assignments.filter(a => a.content_type === 'group_reference' && a.content_id === groupId);
				
				for (const assignment of groupAssignments) {
					await stub.fetch(`http://localhost/api/assignments/${assignment.id}?layout=${layoutName}`, { method: 'DELETE' });
					console.log(`[DELETE /api/groups] Deleted assignment ${assignment.id} for section ${assignment.section_key}`);
				}
				
				// Finally, delete the group itself
				await stub.fetch(`http://localhost/api/groups/${groupId}?layout=${layoutName}`, { method: 'DELETE' });
				
				console.log(`[DELETE /api/groups] Successfully deleted group ${groupId} and ${materialsToDelete.length} materials`);
				
				return new Response(JSON.stringify({ 
					success: true, 
					message: `已刪除群組及其包含的 ${materialsToDelete.length} 個媒體檔案` 
				}), { 
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
				});
			} catch (error) {
				console.error('[DELETE /api/groups] Error:', error);
				return new Response(JSON.stringify({ 
					error: '刪除群組失敗', 
					message: error instanceof Error ? error.message : '未知錯誤' 
				}), { 
					status: 500, 
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
				});
			}
		}

		// Handle media serving from R2
		if (url.pathname.startsWith('/media/')) {
			const filename = url.pathname.replace('/media/', '');
			const object = await env.MEDIA_BUCKET.get(filename);
			
			if (!object) {
				return new Response('File not found', { status: 404 });
			}

			return new Response(object.body, {
				headers: {
					'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
					'Cache-Control': 'public, max-age=31536000',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
			return stub.fetch(request);
		}

		// Handle display.html with template routing (支持 /display.html 和 /display)
		if ((url.pathname === '/display.html' || url.pathname === '/display') && env.ASSETS) {
			const deviceId = url.searchParams.get('deviceId');
			let templateHtml = 'default.html'; // 默认模板
			let layoutName: string | null = null;
			
			if (deviceId) {
				try {
					// 处理 preview 设备：从 deviceId 中提取 layoutName
					if (deviceId.startsWith('preview-')) {
						layoutName = deviceId.replace('preview-', '');
						console.log(`[Template Routing] Preview device, layoutName: ${layoutName}`);
					} else {
						// 真实设备：从设备信息中获取 layoutName
						const devicesResponse = await stub.fetch('http://localhost/api/devices');
						const devices = await devicesResponse.json() as Device[];
						const device = devices.find(d => d.id === deviceId);
						layoutName = device?.layoutName || null;
						console.log(`[Template Routing] Real device, layoutName: ${layoutName}`);
					}
					
					// 根据 layoutName 查找模板
					if (layoutName) {
						const layoutsResponse = await stub.fetch('http://localhost/api/layouts');
						const layouts = await layoutsResponse.json() as Layout[];
						const layout = layouts.find(l => l.name === layoutName);
						
						if (layout && layout.template) {
							const templateMap: Record<string, string> = {
								'default': 'default.html',
								'dual_video': 'dual_video.html',
								'driving_school': 'driving_school.html',
								'office': 'office.html'
							};
							templateHtml = templateMap[layout.template] || 'default.html';
							console.log(`[Template Routing] Layout: ${layoutName}, Template: ${layout.template}, HTML: ${templateHtml}`);
						}
					}
				} catch (error) {
					console.error('[Template Routing] Error:', error);
					// 发生错误时使用默认模板
				}
			}
			
			// 返回对应的模板 HTML（保留原始查询参数）
			const templateUrl = new URL(`/${templateHtml}`, request.url);
			templateUrl.search = url.search; // 保持原始的查询参数（如 ?deviceId=...）
			const templateRequest = new Request(templateUrl.toString(), {
				method: request.method,
				headers: request.headers,
			});
			return env.ASSETS.fetch(templateRequest);
		}

		// Handle root path /
		if (url.pathname === '/') {
			return new Response(null, {
				status: 302,
				headers: { 'Location': '/admin' }
			});
		}

		// Handle static file serving with ASSETS binding
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		// Fallback if ASSETS binding is not available
		return new Response('Static assets not configured properly', { status: 500 });
	},
};