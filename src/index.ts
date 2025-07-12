// src/index.ts

// ====================================================
// Types and Interfaces
// ====================================================
interface MediaMaterial {
	id: string;
	filename: string;
	type: 'image' | 'video';
	url: string;
	uploaded_at: string;
}

interface Assignment {
	id: string;
	section_key: string;
	content_type: 'single_media' | 'group_reference';
	content_id: string;
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

// 輔助函數：生成唯一ID
function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ====================================================
// Durable Object: MessageBroadcaster
// ====================================================
export class MessageBroadcaster {
	private connections: Set<WebSocket>;
	private state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.connections = new Set();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// 處理材料相關API
		if (url.pathname === '/api/materials') {
			if (request.method === 'GET') {
				const materials = await this.getMaterials();
				return new Response(JSON.stringify(materials), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} else if (request.method === 'POST') {
				const material = await request.json() as MediaMaterial;
				await this.saveMaterial(material);
				return new Response(JSON.stringify({ success: true }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		} else if (url.pathname.startsWith('/api/materials/') && request.method === 'DELETE') {
			const filename = decodeURIComponent(url.pathname.replace('/api/materials/', ''));
			await this.deleteMaterial(filename);
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
			});
		}

		// 處理指派相關API
		else if (url.pathname === '/api/assignments') {
			if (request.method === 'GET') {
				const assignments = await this.getAssignments();
				return new Response(JSON.stringify(assignments), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} else if (request.method === 'POST') {
				try {
					const formData = await request.formData();
					const sectionKey = formData.get('section_key') as string;
					const contentType = formData.get('content_type') as 'single_media' | 'group_reference';
					const contentId = formData.get('content_id') as string;
					
					if (!sectionKey || !contentType || !contentId) {
						return new Response(JSON.stringify({ 
							error: 'Missing required fields', 
							details: { sectionKey, contentType, contentId } 
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}
					
					const assignment: Assignment = {
						id: generateId(),
						section_key: sectionKey,
						content_type: contentType,
						content_id: contentId,
						created_at: new Date().toISOString()
					};
					
					await this.saveAssignment(assignment);
					
					// 通知所有客戶端播放列表已更新
					this.broadcast(JSON.stringify({ type: 'playlist_updated' }));
					
					return new Response(JSON.stringify({ success: true, assignment }), {
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error: any) {
					console.error('Error creating assignment:', error);
					return new Response(JSON.stringify({ 
						error: 'Failed to create assignment', 
						details: error.message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			}
		} else if (url.pathname.startsWith('/api/assignments/') && request.method === 'DELETE') {
			try {
				const assignmentId = url.pathname.replace('/api/assignments/', '');
				if (!assignmentId) {
					return new Response(JSON.stringify({ error: 'Assignment ID is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
				
				await this.deleteAssignment(assignmentId);
				
				// 通知所有客戶端播放列表已更新
				this.broadcast(JSON.stringify({ type: 'playlist_updated' }));
				
				return new Response(JSON.stringify({ success: true }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				console.error('Error deleting assignment:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to delete assignment', 
					details: error.message 
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 處理群組相關API
		else if (url.pathname === '/api/groups') {
			if (request.method === 'GET') {
				const groups = await this.getGroups();
				return new Response(JSON.stringify(groups), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} else if (request.method === 'POST') {
				try {
					const formData = await request.formData();
					const groupName = formData.get('group_name') as string;
					
					if (!groupName || !groupName.trim()) {
						return new Response(JSON.stringify({ 
							error: 'Group name is required' 
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}
					
					const group: CarouselGroup = {
						id: generateId(),
						name: groupName.trim(),
						materials: [],
						created_at: new Date().toISOString()
					};
					
					await this.saveGroup(group);
					
					// 通知所有客戶端群組已更新
					this.broadcast(JSON.stringify({ type: 'groups_updated' }));
					
					return new Response(JSON.stringify({ success: true, group }), {
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error: any) {
					console.error('Error creating group:', error);
					return new Response(JSON.stringify({ 
						error: 'Failed to create group', 
						details: error.message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			}
		} else if (url.pathname.startsWith('/api/groups/') && request.method === 'DELETE') {
			try {
				const groupId = url.pathname.replace('/api/groups/', '');
				if (!groupId) {
					return new Response(JSON.stringify({ error: 'Group ID is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
				
				await this.deleteGroup(groupId);
				
				// 通知所有客戶端群組已更新
				this.broadcast(JSON.stringify({ type: 'groups_updated' }));
				
				return new Response(JSON.stringify({ success: true }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				console.error('Error deleting group:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to delete group', 
					details: error.message 
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		} else if (url.pathname.match(/\/api\/groups\/[^\/]+\/images$/) && request.method === 'PUT') {
			const groupId = url.pathname.split('/')[3];
			const requestData = await request.json() as { image_ids: string[] };
			const { image_ids } = requestData;
			const groups = await this.getGroups();
			const materials = await this.getMaterials();
			
			const group = groups.find(g => g.id === groupId);
			if (group) {
				group.materials = image_ids.map((id: string) => 
					materials.find(m => m.id === id)
				).filter(Boolean) as MediaMaterial[];
				await this.updateGroup(groupId, group);
			}
			
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
			});
		}
		
		// 處理群組材料相關API
		else if (url.pathname.match(/\/api\/groups\/[^\/]+\/materials$/) && request.method === 'POST') {
			try {
				const groupId = url.pathname.split('/')[3];
				const formData = await request.formData();
				const action = formData.get('action') as string;
				
				if (action === 'add_materials') {
					const materialIds = formData.getAll('material_ids[]') as string[];
					const groups = await this.getGroups();
					const materials = await this.getMaterials();
					
					const group = groups.find(g => g.id === groupId);
					if (!group) {
						return new Response(JSON.stringify({ error: 'Group not found' }), {
							status: 404,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}
					
					// 添加新材料到群組
					const newMaterials = materialIds.map(id => 
						materials.find(m => m.id === id)
					).filter(Boolean) as MediaMaterial[];
					
					group.materials = [...(group.materials || []), ...newMaterials];
					await this.updateGroup(groupId, group);
					
					// 通知所有客戶端群組已更新
					this.broadcast(JSON.stringify({ type: 'groups_updated' }));
					
					return new Response(JSON.stringify({ success: true, group }), {
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
				
				return new Response(JSON.stringify({ error: 'Invalid action' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				console.error('Error adding materials to group:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to add materials to group', 
					details: error.message 
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		} else if (url.pathname.match(/\/api\/groups\/[^\/]+\/materials$/) && request.method === 'PUT') {
			try {
				const groupId = url.pathname.split('/')[3];
				const formData = await request.formData();
				const action = formData.get('action') as string;
				
				if (action === 'update_materials') {
					const materialIds = formData.getAll('material_ids[]') as string[];
					const groups = await this.getGroups();
					const materials = await this.getMaterials();
					
					const group = groups.find(g => g.id === groupId);
					if (!group) {
						return new Response(JSON.stringify({ error: 'Group not found' }), {
							status: 404,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}
					
					// 更新群組材料
					group.materials = materialIds.map(id => 
						materials.find(m => m.id === id)
					).filter(Boolean) as MediaMaterial[];
					
					await this.updateGroup(groupId, group);
					
					// 通知所有客戶端群組已更新
					this.broadcast(JSON.stringify({ type: 'groups_updated' }));
					
					return new Response(JSON.stringify({ success: true, group }), {
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
				
				return new Response(JSON.stringify({ error: 'Invalid action' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				console.error('Error updating group materials:', error);
				return new Response(JSON.stringify({ 
					error: 'Failed to update group materials', 
					details: error.message 
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 處理 CORS 預檢請求
		else if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization'
				}
			});
		}

		// 處理登入API
		else if (url.pathname === '/api/login' && request.method === 'POST') {
			const { username, password } = await request.json();
			
			// 簡單的硬編碼認證 (生產環境應使用更安全的方式)
			if (username === 'admin' && password === 'admin123') {
				// 生成簡單的 JWT token (這裡只是模擬，生產環境需要真正的 JWT)
				const token = btoa(JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }));
				return new Response(JSON.stringify({ 
					access_token: token,
					message: '登入成功'
				}), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} else {
				return new Response(JSON.stringify({ 
					message: '帳號或密碼錯誤'
				}), {
					status: 401,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 處理設定相關API
		else if (url.pathname === '/api/settings') {
			if (request.method === 'GET') {
				const settings = await this.getSettings();
				return new Response(JSON.stringify(settings), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} else if (request.method === 'PUT') {
				const settings = await request.json() as Settings;
				await this.saveSettings(settings);
				return new Response(JSON.stringify({ success: true }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();
			this.connections.add(server);

			const closeOrErrorHandler = () => {
				this.connections.delete(server);
				this.broadcast(JSON.stringify({ type: 'user_left', count: this.connections.size }));
			};

			server.addEventListener('close', closeOrErrorHandler);
			server.addEventListener('error', closeOrErrorHandler);

			server.send(JSON.stringify({ type: 'welcome', count: this.connections.size }));
			this.broadcast(JSON.stringify({ type: 'user_joined', count: this.connections.size }));

			return new Response(null, { status: 101, webSocket: client });
		} else if (request.method === 'POST' && url.pathname === '/api/message') {
			const message = await request.text();
			this.broadcast(message);
			return new Response('Message broadcasted', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
		} else if (request.method === 'POST' && url.pathname === '/api/playlist_updated') {
			// 處理播放列表更新的內部廣播
			const message = JSON.stringify({ type: 'playlist_updated' });
			this.broadcast(message);
			return new Response('Playlist update broadcasted', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
		} else if (url.pathname === '/stats') {
			return new Response(JSON.stringify({ connectionCount: this.connections.size }), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		}

		return new Response('Not found', { status: 404 });
	}

	private broadcast(message: string) {
		for (const conn of this.connections) {
			if (conn.readyState === WebSocket.READY_STATE_OPEN) {
				conn.send(message);
			}
		}
	}

	// 數據存儲方法
	async getMaterials(): Promise<MediaMaterial[]> {
		const materials = await this.state.storage.get('materials') || [];
		return materials as MediaMaterial[];
	}

	async saveMaterial(material: MediaMaterial): Promise<void> {
		const materials = await this.getMaterials();
		materials.push(material);
		await this.state.storage.put('materials', materials);
	}

	async deleteMaterial(materialId: string): Promise<void> {
		const materials = await this.getMaterials();
		// 可以根據ID或filename刪除
		const filtered = materials.filter(m => m.id !== materialId && m.filename !== materialId);
		await this.state.storage.put('materials', filtered);
	}

	async getAssignments(): Promise<Assignment[]> {
		const assignments = await this.state.storage.get('assignments') || [];
		return assignments as Assignment[];
	}

	async saveAssignment(assignment: Assignment): Promise<void> {
		const assignments = await this.getAssignments();
		assignments.push(assignment);
		await this.state.storage.put('assignments', assignments);
	}

	async deleteAssignment(assignmentId: string): Promise<void> {
		const assignments = await this.getAssignments();
		const filtered = assignments.filter(a => a.id !== assignmentId);
		await this.state.storage.put('assignments', filtered);
	}

	async getGroups(): Promise<CarouselGroup[]> {
		const groups = await this.state.storage.get('groups') || [];
		return groups as CarouselGroup[];
	}

	async saveGroup(group: CarouselGroup): Promise<void> {
		const groups = await this.getGroups();
		groups.push(group);
		await this.state.storage.put('groups', groups);
	}

	async updateGroup(groupId: string, updatedGroup: CarouselGroup): Promise<void> {
		const groups = await this.getGroups();
		const index = groups.findIndex(g => g.id === groupId);
		if (index !== -1) {
			groups[index] = updatedGroup;
			await this.state.storage.put('groups', groups);
		}
	}

	async deleteGroup(groupId: string): Promise<void> {
		const groups = await this.getGroups();
		const filtered = groups.filter(g => g.id !== groupId);
		await this.state.storage.put('groups', filtered);
	}

	async getSettings(): Promise<Settings> {
		const settings = await this.state.storage.get('settings') || {
			header_interval: 5,
			carousel_interval: 6,
			footer_interval: 7
		};
		return settings as Settings;
	}

	async saveSettings(settings: Settings): Promise<void> {
		await this.state.storage.put('settings', settings);
	}
}

// ====================================================
// Worker Entrypoint
// ====================================================

export interface Env {
	ASSETS: Fetcher;
	MESSAGE_BROADCASTER: DurableObjectNamespace;
	MEDIA_BUCKET: R2Bucket; // R2 儲存桶綁定
}

// 輔助函數：獲取文件類型
function getFileType(filename: string): 'image' | 'video' {
	const ext = filename.toLowerCase().split('.').pop() || '';
	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
	const videoExts = ['mp4', 'webm', 'mov', 'avi'];
	
	if (imageExts.includes(ext)) return 'image';
	if (videoExts.includes(ext)) return 'video';
	return 'image'; // 默認為圖片
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 處理 CORS 預檢請求
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization'
				}
			});
		}

		// 處理媒體文件的直接訪問 - 從R2提供文件
		if (url.pathname.startsWith('/media/')) {
			try {
				const filename = decodeURIComponent(url.pathname.replace('/media/', ''));
				const object = await env.MEDIA_BUCKET.get(filename);
				
				if (!object) {
					return new Response('File not found', { status: 404 });
				}
				
				const headers = new Headers();
				headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
				headers.set('Cache-Control', 'public, max-age=31536000'); // 1年緩存
				headers.set('Access-Control-Allow-Origin', '*');
				
				return new Response(object.body, { headers });
			} catch (error: any) {
				console.error('Error serving media file:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		}

		// 處理完整媒體數據API
		if (url.pathname === '/api/media_with_settings') {
			try {
				const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
				const stub = env.MESSAGE_BROADCASTER.get(id);
				
				// 獲取所有數據
				const materialsResponse = await stub.fetch(new Request('http://localhost/api/materials'));
				const assignmentsResponse = await stub.fetch(new Request('http://localhost/api/assignments'));
				const groupsResponse = await stub.fetch(new Request('http://localhost/api/groups'));
				const settingsResponse = await stub.fetch(new Request('http://localhost/api/settings'));
				
				const materials = await materialsResponse.json();
				const assignments = await assignmentsResponse.json();
				const groups = await groupsResponse.json();
				const settings = await settingsResponse.json();
				
				const response = {
					materials,
					assignments,
					groups,
					settings,
					available_sections: {
						header_video: '頁首影片區',
						carousel_top_left: '左上輪播區',
						carousel_top_right: '右上輪播區',
						carousel_bottom_left: '左下輪播區',
						carousel_bottom_right: '右下輪播區',
						footer_content: '頁尾內容區'
					}
				};
				
				return new Response(JSON.stringify(response), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				console.error('Error fetching media with settings:', error);
				return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 處理媒體檔案相關的 API 請求
		if (url.pathname === '/api/media') {
			if (request.method === 'POST') {
				// 上傳檔案到 R2
				console.log('🚀 POST /api/media route called - starting file upload process');
				
				try {
					console.log('📝 Attempting to read FormData from request...');
					const formData = await request.formData();
					console.log('✅ Successfully read FormData from request');
					
					console.log('📁 Attempting to get file from FormData...');
					const file = formData.get('file') as File;
					
					if (!file) {
						console.log('❌ No file found in FormData');
						return new Response(JSON.stringify({ error: 'No file provided' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}

					console.log(`✅ Successfully got file from FormData - Name: "${file.name}", Size: ${file.size} bytes`);

					// 生成檔案名稱（使用時間戳避免重複）
					const timestamp = Date.now();
					const fileExtension = file.name.split('.').pop();
					const key = `${timestamp}-${file.name}`;
					console.log(`🔑 Generated file key: "${key}"`);

					// 將檔案轉換為 ArrayBuffer 並上傳到 R2
					console.log('🔄 Converting file to ArrayBuffer...');
					const arrayBuffer = await file.arrayBuffer();
					console.log(`✅ File converted to ArrayBuffer, size: ${arrayBuffer.byteLength} bytes`);
					
					console.log('☁️ Calling env.MEDIA_BUCKET.put() to upload to R2...');
					await env.MEDIA_BUCKET.put(key, arrayBuffer, {
						httpMetadata: {
							contentType: file.type,
						},
					});
					console.log('✅ Successfully uploaded file to R2');

					// 保存媒體信息到Durable Object
					const material: MediaMaterial = {
						id: generateId(),
						filename: key,
						type: getFileType(file.name),
						url: `/media/${key}`,
						uploaded_at: new Date().toISOString()
					};
					
					const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
					const stub = env.MESSAGE_BROADCASTER.get(id);
					await stub.fetch(new Request('http://localhost/api/materials', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(material)
					}));

					// 通知所有客戶端播放列表已更新
					try {
						const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
						const stub = env.MESSAGE_BROADCASTER.get(id);
						await stub.fetch(new Request('http://localhost/api/playlist_updated', {
							method: 'POST',
							body: JSON.stringify({ type: 'playlist_updated' })
						}));
						console.log('📢 Broadcasted playlist_updated message');
					} catch (broadcastError) {
						console.log('⚠️ Failed to broadcast playlist update:', broadcastError);
					}

					const response = {
						success: true, 
						key: key,
						originalName: file.name,
						size: file.size,
						type: file.type,
						material: material
					};
					console.log('📤 Sending success response:', response);

					return new Response(JSON.stringify(response), {
						status: 200,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error: any) {
					console.log('❌ Error caught in POST /api/media:', error);
					console.log('❌ Error message:', error?.message);
					console.log('❌ Error stack:', error?.stack);
					
					return new Response(JSON.stringify({ error: 'Upload failed', details: error?.message || 'Unknown error' }), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			} else if (request.method === 'GET') {
				// 獲取檔案列表 - 從Durable Object獲取
				try {
					const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
					const stub = env.MESSAGE_BROADCASTER.get(id);
					const response = await stub.fetch(new Request('http://localhost/api/materials'));
					const materials = await response.json();
					
					return new Response(JSON.stringify(materials), {
						status: 200,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error: any) {
					return new Response(JSON.stringify({ error: 'Failed to fetch file list', details: error?.message || 'Unknown error' }), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			}
		}

		// 處理刪除特定檔案的請求 DELETE /api/media/[filename]
		if (url.pathname.startsWith('/api/media/') && request.method === 'DELETE') {
			try {
				// 從 URL 中提取檔案名稱
				const filename = decodeURIComponent(url.pathname.replace('/api/media/', ''));
				
				if (!filename) {
					return new Response(JSON.stringify({ error: 'No filename provided' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}

				// 從 R2 中刪除檔案
				await env.MEDIA_BUCKET.delete(filename);

				// 從Durable Object中刪除媒體記錄
				const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
				const stub = env.MESSAGE_BROADCASTER.get(id);
				await stub.fetch(new Request(`http://localhost/api/materials/${filename}`, {
					method: 'DELETE'
				}));

				// 通知所有客戶端播放列表已更新
				try {
					const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
					const stub = env.MESSAGE_BROADCASTER.get(id);
					await stub.fetch(new Request('http://localhost/api/playlist_updated', {
						method: 'POST',
						body: JSON.stringify({ type: 'playlist_updated' })
					}));
					console.log('📢 Broadcasted playlist_updated message after deletion');
				} catch (broadcastError) {
					console.log('⚠️ Failed to broadcast playlist update after deletion:', broadcastError);
				}

				return new Response(JSON.stringify({ 
					success: true, 
					message: `File "${filename}" deleted successfully` 
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error: any) {
				return new Response(JSON.stringify({ error: 'Delete failed', details: error?.message || 'Unknown error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 將 WebSocket 和其他 API 請求轉發給 Durable Object
		if (url.pathname === '/ws' || 
			url.pathname.startsWith('/ws/api/') ||
			(url.pathname.startsWith('/api/') && 
			 !url.pathname.startsWith('/api/media') && 
			 url.pathname !== '/api/media_with_settings')) {
			const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
			const stub = env.MESSAGE_BROADCASTER.get(id);
			
			// 對於 /ws/api/ 路徑，需要重寫 URL 去掉 /ws 前綴
			if (url.pathname.startsWith('/ws/api/')) {
				const newUrl = new URL(request.url);
				newUrl.pathname = url.pathname.replace('/ws', '');
				const newRequest = new Request(newUrl.toString(), {
					method: request.method,
					headers: request.headers,
					body: request.body
				});
				return stub.fetch(newRequest);
			}
			
			return stub.fetch(request);
		}

		// 其他所有請求都交給靜態資源服務處理
		try {
			return await env.ASSETS.fetch(request);
		} catch (e) {
			let notFoundResponse = new Response('Not found', { status: 404 });
			try {
				const notFoundAsset = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url), request));
				notFoundResponse = new Response(notFoundAsset.body, {
					status: 404,
					headers: notFoundAsset.headers,
				});
			} catch (err) {}
			return notFoundResponse;
		}
	},
};