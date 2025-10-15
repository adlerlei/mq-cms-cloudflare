// MQ-CMS Admin Panel - Cloudflare Worker Version - Complete Implementation

// --- LAYOUT TEMPLATES CONFIGURATION ---
const LAYOUT_TEMPLATES = {
    "default": {
        name: "預設佈局（六區塊）",
        sections: {
            "header_video": "頁首影片區",
            "top_left": "左上輪播區",
            "top_right": "右上輪播區",
            "bottom_left": "左下輪播區",
            "bottom_right": "右下輪播區",
            "footer_content": "頁尾內容區"
        }
    },
    "dual_video": {
        name: "雙影片佈局",
        sections: {
            "header_video": "頁首影片區",
            "header_1_video": "第二頁首影片區",
            "bottom_left": "左下輪播區",
            "bottom_right": "右下輪播區",
            "footer_content": "頁尾內容區"
        }
    }
};

// --- STATE MANAGEMENT ---
let appState = {
    layouts: [],
    devices: [],
    activeLayout: 'default',
    media: [],
    groups: [],
    assignments: [],
    materials: [],
    settings: {},
    available_sections: {
        'header_video': '頁首影片區',
        'top_left': '左上輪播區',
        'top_right': '右上輪播區',
        'bottom_left': '左下輪播區',
        'bottom_right': '右下輪播區',
        'footer_content': '頁尾內容區'
    }
};

const stateSubscribers = [];

// 根据当前 layout 的 template 更新 available_sections
function updateAvailableSections() {
    const currentLayout = appState.layouts.find(l => l.name === appState.activeLayout);
    const template = currentLayout?.template || 'default';
    const templateConfig = LAYOUT_TEMPLATES[template] || LAYOUT_TEMPLATES['default'];
    
    appState.available_sections = { ...templateConfig.sections };
    console.log(`[updateAvailableSections] Layout: ${appState.activeLayout}, Template: ${template}, Sections:`, appState.available_sections);
}

function setState(newState) {
    const oldLayout = appState.activeLayout;
    appState = { ...appState, ...newState };

    if (newState.activeLayout && newState.activeLayout !== oldLayout) {
        console.log(`Layout changed from ${oldLayout} to ${appState.activeLayout}. Re-rendering UI and fetching data...`);
        updateAvailableSections(); // 更新可用区块
        stateSubscribers.forEach(callback => callback(appState));
        fetchLayoutData(appState.activeLayout);
    } else if (newState.layouts) {
        // layouts 数据更新时也需要更新 available_sections
        updateAvailableSections();
        stateSubscribers.forEach(callback => callback(appState));
    } else {
        stateSubscribers.forEach(callback => callback(appState));
    }
}

function subscribe(callback) {
    stateSubscribers.push(callback);
}

// --- API HELPERS ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config = { ...options, headers };
    const response = await fetch(url, config);

    if (response.status === 401) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    return response;
}

// --- DATA FETCHING ---
async function getInitialAdminData() {
    try {
        const [layoutsRes, devicesRes] = await Promise.all([
            fetchWithAuth('/api/layouts'),
            fetchWithAuth('/api/devices')
        ]);
        if (!layoutsRes.ok || !devicesRes.ok) throw new Error('Could not fetch layouts or devices');

        const layouts = await layoutsRes.json();
        const devices = await devicesRes.json();

        setState({ layouts, devices, activeLayout: 'default' });
        await fetchLayoutData('default');
    } catch (error) {
        console.error('Failed to get initial admin data:', error);
        alert('Could not load admin data. Please refresh.');
    }
}

async function fetchLayoutData(layoutName) {
    try {
        const response = await fetchWithAuth(`/api/config?deviceId=admin-view-${layoutName}`);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const data = await response.json();
        console.log(`Fetched data for layout '${layoutName}':`, data);

        // Ensure materials have the correct type property
        const materials = (data.materials || []).map(material => ({
            ...material,
            type: material.type || getFileType(material.filename)
        }));

        console.log('Processed materials:', materials);
        console.log('Materials count:', materials.length);

        appState = { ...appState, ...data, materials };
        console.log('Updated appState.materials:', appState.materials);
        
        // 更新可用区块（因为这里直接修改 appState，不经过 setState）
        updateAvailableSections();
        
        render();
    } catch (error) {
        console.error(`Failed to fetch data for layout '${layoutName}':`, error);
        alert(`Could not load data for layout '${layoutName}'.`);
    }
}

async function refreshDevicesOnly() {
    try {
        const response = await fetchWithAuth('/api/devices');
        if (!response.ok) throw new Error('Could not fetch devices');
        
        const devices = await response.json();
        appState = { ...appState, devices };
        renderDevices();
    } catch (error) {
        console.error('Failed to refresh devices:', error);
    }
}

function getFileType(filename) {
    if (!filename) return 'unknown';
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
    return 'unknown';
}

// --- RENDER FUNCTIONS ---
function renderLayouts() {
    const selector = document.getElementById('layoutSelector');
    const deleteBtn = document.getElementById('deleteLayoutButton');
    if (!selector || !deleteBtn) return;
    selector.innerHTML = appState.layouts.map(l => `<option value="${l.name}" ${l.name === appState.activeLayout ? 'selected' : ''}>${l.name}</option>`).join('');
    deleteBtn.disabled = appState.activeLayout === 'default';
}

function renderDevices() {
    const tbody = document.getElementById('deviceListBody');
    if (!tbody) return;
    
    if (appState.devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="has-text-centered">尚無設備連接。</td></tr>';
        return;
    }
    
    tbody.innerHTML = appState.devices.map(device => {
        const layoutOptions = appState.layouts.map(l => 
            `<option value="${l.name}" ${device.layoutName === l.name ? 'selected' : ''}>${l.name}</option>`
        ).join('');
        
        // Device name with icon
        const deviceName = device.name || '未命名設備';
        const deviceIcon = '🖥️';
        
        // Truncate UUID (first 8 chars)
        const shortId = device.id.substring(0, 8) + '...';
        const copyBtn = `<button class="button is-text is-small copy-id-button" data-device-id="${device.id}" title="複製完整 ID">
            <i class="fas fa-copy"></i>
        </button>`;
        
        // Status indicator (online/abnormal/offline)
        const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
        const now = Date.now();
        const diffMinutes = (now - lastSeen) / 1000 / 60;
        let statusIcon, statusText, statusClass;
        
        if (!device.last_seen) {
            statusIcon = '⚪';
            statusText = '從未連接';
            statusClass = 'has-text-grey-light';
        } else if (diffMinutes < 5) {
            statusIcon = '🟢';
            statusText = '正常運行';
            statusClass = 'has-text-success';
        } else if (diffMinutes < 30) {
            statusIcon = '🟡';
            statusText = '連接異常';
            statusClass = 'has-text-warning';
        } else {
            statusIcon = '🔴';
            statusText = '已離線';
            statusClass = 'has-text-danger';
        }
        
        return `<tr>
            <td>
                <div class="is-flex is-align-items-center">
                    <span class="mr-2">${deviceIcon}</span>
                    <strong>${deviceName}</strong>
                </div>
                <div class="is-size-7 has-text-grey mt-1">
                    <span class="is-family-monospace">${shortId}</span>
                    ${copyBtn}
                </div>
            </td>
            <td>
                <div class="select is-small is-fullwidth">
                    <select class="device-layout-assign" data-device-id="${device.id}">
                        ${layoutOptions}
                    </select>
                </div>
            </td>
            <td>
                <span class="${statusClass}">
                    ${statusIcon} ${statusText}
                </span>
            </td>
            <td class="has-text-right">
                <div class="buttons is-right">
                    <button class="button is-info is-small edit-device-button" data-device-id="${device.id}" title="編輯設備資訊">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="button is-danger is-small delete-device-button" data-device-id="${device.id}" title="刪除設備">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderSectionAssignments() {
    const sectionSelect = document.getElementById('sectionKeySelect');
    if (sectionSelect) {
        sectionSelect.innerHTML = Object.entries(appState.available_sections)
            .map(([key, name]) => `<option value="${key}">${name}</option>`)
            .join('');
    }
}

function renderCarouselGroups() {
    const groupSelect = document.getElementById('carouselGroupSelect');
    const groupsTableBody = document.getElementById('groupsTableBody');
    
    if (groupSelect) {
        groupSelect.innerHTML = '<option value="" disabled selected>-- 選擇輪播組 --</option>' +
            appState.groups.map(group => `<option value="${group.id}">${group.name} (${group.materials.length} 張圖片)</option>`).join('');
    }
    
    if (groupsTableBody) {
        groupsTableBody.innerHTML = appState.groups.length === 0
            ? '<tr><td colspan="3" class="has-text-centered">尚無輪播組。</td></tr>'
            : appState.groups.map(group => 
                `<tr>
                    <td>${group.name}</td>
                    <td><span class="tag is-info">${group.materials.length}</span></td>
                    <td class="has-text-right">
                        <div class="buttons is-right">
                            <button class="button is-primary is-small edit-group-button" data-group-id="${group.id}">
                                <i class="fas fa-edit"></i> 編輯
                            </button>
                            <button class="button is-danger is-small delete-group-button" data-group-id="${group.id}">
                                <i class="fas fa-trash"></i> 刪除
                            </button>
                        </div>
                    </td>
                </tr>`
            ).join('');
    }
}

function renderMediaLibrary() {
    console.log('Rendering media library with materials:', appState.materials);
    console.log('Assignments:', appState.assignments);
    console.log('Groups:', appState.groups);
    
    // Only table view is supported
    renderMediaLibraryTable();
}

function renderMediaLibraryTable() {
    const tbody = document.getElementById('mediaTableBody');
    if (!tbody) {
        console.error('mediaTableBody element not found');
        return;
    }
    
    const allItems = [];
    
    // Collect all material IDs that are in groups (to filter them out)
    const materialsInGroups = new Set();
    if (appState.groups && appState.groups.length > 0) {
        appState.groups.forEach(group => {
            if (group.materials && Array.isArray(group.materials)) {
                group.materials.forEach(matId => materialsInGroups.add(matId));
            }
        });
    }
    console.log('Materials in groups:', Array.from(materialsInGroups));
    
    // Add individual media files (exclude those in groups)
    if (appState.materials && appState.materials.length > 0) {
        appState.materials.forEach(material => {
            // Skip materials that are in groups
            if (materialsInGroups.has(material.id)) {
                console.log(`Skipping material ${material.filename} (in a group)`);
                return;
            }
            
            const assignment = appState.assignments.find(a => a.content_id === material.id && a.content_type === 'single_media');
            const assignedSection = assignment ? appState.available_sections[assignment.section_key] : null;
            
            const preview = material.type === 'image' 
                ? `<img src="${material.url}" alt="${material.filename}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">`
                : `<video src="${material.url}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;" muted></video>`;
            
            const statusBadge = assignedSection 
                ? `<span class="tag is-success">${assignedSection}</span>`
                : '<span class="tag is-light">未指派</span>';
                
            allItems.push(`
                <tr>
                    <td>
                        <div class="media">
                            <div class="media-left">
                                ${preview}
                            </div>
                            <div class="media-content">
                                <p class="is-size-7"><strong>${material.filename}</strong></p>
                                <p class="is-size-7 has-text-grey">${formatFileSize(material.size)}</p>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="tag ${material.type === 'image' ? 'is-info' : 'is-warning'}">${material.type === 'image' ? '圖片' : '影片'}</span>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="has-text-right">
                        <div class="buttons is-right">
                            ${!assignedSection ? `
                                <button class="button is-primary is-small reassign-media-button" 
                                        data-media-id="${material.id}" data-filename="${material.filename}">
                                    <i class="fas fa-arrow-right"></i> 指派
                                </button>
                            ` : `
                                <button class="button is-info is-small reassign-media-button" 
                                        data-media-id="${material.id}" data-filename="${material.filename}">
                                    <i class="fas fa-edit"></i> 重新指派
                                </button>
                            `}
                            <button class="button is-danger is-small delete-media-button" 
                                    data-media-id="${material.id}" data-filename="${material.filename}">
                                <i class="fas fa-trash"></i> 刪除
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });
    }
    
    // Add assigned groups
    if (appState.assignments && appState.assignments.length > 0) {
        const groupAssignments = appState.assignments.filter(a => a.content_type === 'group_reference');
        console.log('Group assignments found:', groupAssignments.length);
        
        groupAssignments.forEach(assignment => {
            console.log('Processing assignment:', assignment.id, 'content_id:', assignment.content_id);
            const group = appState.groups.find(g => g.id === assignment.content_id);
            if (!group) {
                console.warn('Group not found for assignment:', assignment.content_id);
                console.log('Available groups:', appState.groups.map(g => g.id));
                return; // Skip if group not found
            }
            console.log('Found group:', group.name);
            
            const assignedSection = appState.available_sections[assignment.section_key];
            const offset = assignment.offset || 0;
            
            allItems.push(`
                <tr>
                    <td>
                        <div class="media">
                            <div class="media-left">
                                <span class="icon is-large has-text-primary">
                                    <i class="fas fa-images fa-2x"></i>
                                </span>
                            </div>
                            <div class="media-content">
                                <p class="is-size-7"><strong>🎭 ${group.name}</strong></p>
                                <p class="is-size-7 has-text-grey">${group.materials.length} 張圖片輪播</p>
                                ${offset > 0 ? `<p class="is-size-7 has-text-info">偏移: 從第 ${offset + 1} 張開始</p>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="tag is-primary">輪播組</span>
                    </td>
                    <td>
                        <span class="tag is-success">${assignedSection}</span>
                    </td>
                    <td class="has-text-right">
                        <div class="buttons is-right">
                            <button class="button is-danger is-small delete-assignment-button" 
                                    data-assignment-id="${assignment.id}" data-content-name="${group.name}">
                                <i class="fas fa-trash"></i> 移除指派
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });
    }
    
    console.log('Total items to render:', allItems.length);
    
    if (allItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="has-text-centered">目前沒有任何媒體檔案或群組指派。</td></tr>';
    } else {
        tbody.innerHTML = allItems.join('');
        console.log('Rendered', allItems.length, 'items to mediaTableBody');
    }
}

function renderSettings() {
    document.getElementById('header_interval').value = appState.settings.header_interval || 5;
    document.getElementById('carousel_interval').value = appState.settings.carousel_interval || 6;
    document.getElementById('footer_interval').value = appState.settings.footer_interval || 7;
}

function render() {
    renderLayouts();
    renderDevices();
    renderSectionAssignments();
    renderCarouselGroups();
    renderMediaLibrary();
    renderSettings();
}

// --- UTILITY FUNCTIONS ---
function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            max-width: 600px;
            width: 90%;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification is-${type}`;
    notification.style.cssText = `
        margin-bottom: 10px;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    
    container.appendChild(notification);
    
    // Trigger fade-in animation
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });
    
    // Auto-hide duration based on type
    const duration = {
        'success': 2000,  // 2秒 - 成功消息
        'info': 3000,     // 3秒 - 信息消息
        'warning': 4000,  // 4秒 - 警告消息
        'danger': 5000    // 5秒 - 错误消息
    }[type] || 3000;
    
    // Auto-hide with fade-out
    const autoHideTimer = setTimeout(() => {
        fadeOutAndRemove(notification);
    }, duration);
    
    // Handle delete button
    notification.querySelector('.delete').addEventListener('click', () => {
        clearTimeout(autoHideTimer);
        fadeOutAndRemove(notification);
    });
    
    // Helper function to fade out and remove
    function fadeOutAndRemove(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            element.remove();
            // Remove container if empty
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }
}

// --- EVENT HANDLERS ---
async function handleCreateLayout(e) {
    e.preventDefault();
    const input = document.getElementById('newLayoutName');
    const templateSelect = document.getElementById('layoutTemplateSelect');
    const name = input.value.trim();
    const template = templateSelect.value;
    
    if (!name) return alert('Layout name is required.');
    if (!template) return alert('Template is required.');

    try {
        const newLayout = { 
            name, 
            template,
            created_at: new Date().toISOString() 
        };
        const response = await fetchWithAuth('/api/layouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLayout)
        });
        if (!response.ok) throw new Error('Failed to create layout.');
        
        input.value = '';
        templateSelect.value = 'default';
        showNotification(`版面 "${name}" (${template === 'default' ? '預設佈局' : '雙影片佈局'}) 建立成功。`, 'success');
        
        const newLayouts = [...appState.layouts, newLayout];
        setState({ layouts: newLayouts });
    } catch (error) {
        showNotification(`錯誤：${error.message}`, 'danger');
    }
}

async function handleDeleteLayout() {
    const layoutName = appState.activeLayout;
    if (layoutName === 'default' || !confirm(`確定要刪除版面 "${layoutName}" 嗎？此動作無法復原。`)) return;

    try {
        const response = await fetchWithAuth(`/api/layouts/${layoutName}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete layout.');
        
        showNotification(`版面 "${layoutName}" 刪除成功。`, 'success');
        
        const newLayouts = appState.layouts.filter(l => l.name !== layoutName);
        setState({ layouts: newLayouts, activeLayout: 'default' });
    } catch (error) {
        showNotification(`錯誤：${error.message}`, 'danger');
    }
}

async function handleDeviceAssign(select) {
    const { deviceId } = select.dataset;
    const layoutName = select.value;
    try {
        const response = await fetchWithAuth('/api/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: deviceId, layoutName, last_seen: new Date().toISOString() })
        });
        if (!response.ok) throw new Error('Assignment failed.');
        
        const newDevices = appState.devices.map(d => d.id === deviceId ? { ...d, layoutName } : d);
        setState({ devices: newDevices });
        showNotification(`設備 "${deviceId}" 已指派到版面 "${layoutName}"。`, 'success');
    } catch (error) {
        showNotification(`錯誤：${error.message}`, 'danger');
    }
}

async function handleDeleteDevice(deviceId) {
    const device = appState.devices.find(d => d.id === deviceId);
    const deviceName = device?.name || deviceId;
    
    if (!confirm(`確定要刪除設備 "${deviceName}" 嗎？\n\n刪除後該設備需要重新連接並註冊。`)) return;

    console.log(`Deleting device: id=${deviceId}`);

    try {
        const response = await fetchWithAuth(`/api/devices/${deviceId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete device.');
        
        showNotification(`設備 "${deviceName}" 刪除成功。`, 'success');
        await refreshDevicesOnly();
    } catch (error) {
        console.error('Delete device error:', error);
        showNotification(`刪除失敗：${error.message}`, 'danger');
    }
}

function openEditDeviceModal(deviceId) {
    const device = appState.devices.find(d => d.id === deviceId);
    if (!device) return;
    
    document.getElementById('editDeviceId').value = device.id;
    document.getElementById('editDeviceName').value = device.name || '';
    document.getElementById('editDeviceAddress').value = device.address || '';
    document.getElementById('editDeviceNotes').value = device.notes || '';
    document.getElementById('editDeviceIdDisplay').value = device.id;
    
    openModal('editDeviceModal');
}

async function handleSaveDevice() {
    const deviceId = document.getElementById('editDeviceId').value;
    const name = document.getElementById('editDeviceName').value.trim();
    const address = document.getElementById('editDeviceAddress').value.trim();
    const notes = document.getElementById('editDeviceNotes').value.trim();
    
    if (!name) {
        showNotification('請輸入設備名稱', 'warning');
        return;
    }
    
    console.log(`Saving device: id=${deviceId}, name=${name}`);
    
    try {
        const response = await fetchWithAuth(`/api/devices/${deviceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address, notes })
        });
        
        if (!response.ok) throw new Error('Failed to update device.');
        
        showNotification(`設備 "${name}" 更新成功。`, 'success');
        closeModal('editDeviceModal');
        await refreshDevicesOnly();
    } catch (error) {
        console.error('Save device error:', error);
        showNotification(`儲存失敗：${error.message}`, 'danger');
    }
}

function copyDeviceId() {
    const idInput = document.getElementById('editDeviceIdDisplay');
    idInput.select();
    document.execCommand('copy');
    showNotification('設備 ID 已複製到剪貼簿', 'info');
}

function copyDeviceIdFromList(deviceId) {
    // 創建臨時輸入框
    const tempInput = document.createElement('input');
    tempInput.value = deviceId;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showNotification('設備 ID 已複製到剪貼簿', 'info');
}

async function handleMediaUpload(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const mediaType = formData.get('type');
    
    console.log('Upload form submitted:', {
        type: mediaType,
        layout: appState.activeLayout,
        hasFile: !!formData.get('file'),
        fileName: formData.get('file')?.name
    });
    
    // Handle group reference assignment (doesn't need file upload)
    if (mediaType === 'group_reference') {
        const groupId = formData.get('carousel_group_id');
        const sectionKey = formData.get('section_key');
        const offset = parseInt(formData.get('offset') || '0');
        
        console.log('Group assignment request:', { groupId, sectionKey, offset, layout: appState.activeLayout });
        
        if (!groupId || !sectionKey) {
            showNotification('請選擇輪播組和指派區塊', 'warning');
            return;
        }
        
        const assignmentData = {
            id: generateId(),
            section_key: sectionKey,
            content_type: 'group_reference',
            content_id: groupId,
            offset: offset,
            created_at: new Date().toISOString()
        };
        
        console.log('Sending assignment:', assignmentData);
        
        try {
            const response = await fetchWithAuth(`/api/assignments?layout=${appState.activeLayout}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignmentData)
            });
            
            if (!response.ok) throw new Error('Failed to assign group.');
            
            showNotification('輪播組指派成功！', 'success');
            form.reset();
            // Reset form field visibility
            document.getElementById('fileUploadField').style.display = 'block';
            document.getElementById('carouselGroupField').style.display = 'none';
            document.getElementById('carouselOffsetField').style.display = 'none';
            await fetchLayoutData(appState.activeLayout);
        } catch (error) {
            showNotification(`指派失敗：${error.message}`, 'danger');
        }
        return;
    }
    
    // Handle file upload (image or video)
    const file = formData.get('file');
    if (!file || !file.name) {
        showNotification('請選擇要上傳的檔案', 'warning');
        return;
    }
    
    // Add current layout to formData
    formData.append('layout', appState.activeLayout);
    
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const progressContainer = document.getElementById('upload-progress-container');

    // Show progress
    progressContainer.style.display = 'block';
    progressBar.value = 0;
    progressText.textContent = '0%';

    try {
        await uploadWithProgress('/api/media', formData, (progress) => {
            progressBar.value = progress;
            progressText.textContent = `${progress}%`;
        });

        showNotification('媒體上傳成功！', 'success');
        form.reset();
        // Reset form field visibility
        document.getElementById('fileUploadField').style.display = 'block';
        document.getElementById('carouselGroupField').style.display = 'none';
        document.getElementById('carouselOffsetField').style.display = 'none';
        document.querySelector('.file-name').textContent = '未選擇任何檔案';
        console.log('Upload successful, refreshing layout data...');
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Upload error:', error);
        showNotification(`上傳失敗：${error.message}`, 'danger');
    } finally {
        progressContainer.style.display = 'none';
    }
}

function uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = localStorage.getItem('jwt_token');

        xhr.open('POST', url, true);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100);
                onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('網路錯誤'));
        });

        xhr.send(formData);
    });
}

async function handleCreateGroup(e) {
    e.preventDefault();
    const form = e.target;
    const groupName = form.group_name.value.trim();
    
    if (!groupName) return;

    try {
        const response = await fetchWithAuth(`/api/groups?layout=${appState.activeLayout}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: generateId(),
                name: groupName,
                materials: [],
                created_at: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error('Failed to create group.');
        
        showNotification(`輪播組 "${groupName}" 建立成功。`, 'success');
        form.reset();
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        showNotification(`建立失敗：${error.message}`, 'danger');
    }
}

async function handleDeleteGroup(groupId) {
    const group = appState.groups.find(g => g.id === groupId);
    if (!group || !confirm(`確定要刪除輪播組 "${group.name}" 嗎？`)) return;

    console.log(`Deleting group: id=${groupId}, layout=${appState.activeLayout}`);

    try {
        const response = await fetchWithAuth(`/api/groups/${groupId}?layout=${appState.activeLayout}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete group.');
        
        showNotification(`輪播組 "${group.name}" 刪除成功。`, 'success');
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Delete group error:', error);
        showNotification(`刪除失敗：${error.message}`, 'danger');
    }
}

function enableDragSort(container) {
    let draggedElement = null;
    
    container.querySelectorAll('.image-list-item').forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedElement = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            container.classList.remove('drag-over');
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedElement !== this) {
                const items = Array.from(container.querySelectorAll('.image-list-item'));
                const draggedIndex = items.indexOf(draggedElement);
                const targetIndex = items.indexOf(this);
                
                if (draggedIndex < targetIndex) {
                    this.parentNode.insertBefore(draggedElement, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedElement, this);
                }
            }
        });
    });
    
    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    
    container.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
}

function openEditGroupModal(groupId) {
    const group = appState.groups.find(g => g.id === groupId);
    if (!group) return;
    
    document.getElementById('modalGroupId').value = group.id;
    document.getElementById('modalGroupName').textContent = group.name;
    
    // Render selected images
    const selectedList = document.getElementById('selectedImagesList');
    if (group.materials && group.materials.length > 0) {
        selectedList.innerHTML = group.materials.map((materialId, index) => {
            const material = appState.materials.find(m => m.id === materialId);
            if (!material) return '';
            
            return `
                <div class="image-list-item" data-material-id="${materialId}" draggable="true">
                    <img src="${material.url}" alt="${material.original_filename}">
                    <div class="image-item-info">
                        <p>${material.original_filename}</p>
                        <div class="tags">
                            <span class="tag is-light">順序: ${index + 1}</span>
                            <span class="tag is-info">${formatFileSize(material.size)}</span>
                        </div>
                    </div>
                    <button class="button is-danger is-small remove-image-button" data-material-id="${materialId}">
                        <i class="fas fa-times"></i> 移除
                    </button>
                </div>
            `;
        }).join('');
        
        // Enable drag and drop sorting
        enableDragSort(selectedList);
    } else {
        selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
    }
    
    openModal('editCarouselGroupModal');
}

async function handleSaveGroupChanges() {
    const groupId = document.getElementById('modalGroupId').value;
    const group = appState.groups.find(g => g.id === groupId);
    if (!group) {
        console.error('[handleSaveGroupChanges] Group not found:', groupId);
        return;
    }
    
    // Get current order from DOM
    const imageItems = document.querySelectorAll('#selectedImagesList .image-list-item');
    const materials = Array.from(imageItems).map(item => item.dataset.materialId);
    
    console.log(`[handleSaveGroupChanges] Saving group changes. GroupId=${groupId}, Old materials:`, group.materials);
    console.log(`[handleSaveGroupChanges] New materials from DOM (count=${materials.length}):`, materials);
    
    const updatedGroup = {
        ...group,
        materials: materials
    };
    
    console.log(`[handleSaveGroupChanges] Updated group object:`, updatedGroup);
    
    try {
        const response = await fetchWithAuth(`/api/groups/${groupId}?layout=${appState.activeLayout}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedGroup)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[handleSaveGroupChanges] Update failed:', errorText);
            throw new Error('Failed to update group.');
        }
        
        const result = await response.json();
        console.log('[handleSaveGroupChanges] Update success:', result);
        
        showNotification(`輪播組 "${group.name}" 更新成功。`, 'success');
        closeModal('editCarouselGroupModal');
        await fetchLayoutData(appState.activeLayout);
        console.log('[handleSaveGroupChanges] Layout data refreshed. Groups:', appState.groups);
    } catch (error) {
        console.error('Update group error:', error);
        showNotification(`更新失敗：${error.message}`, 'danger');
    }
}

async function handleUploadToGroup() {
    const fileInput = document.getElementById('groupImageUpload');
    const files = fileInput.files;
    const groupId = document.getElementById('modalGroupId').value;
    const group = appState.groups.find(g => g.id === groupId);
    
    console.log(`[handleUploadToGroup] Starting upload. GroupId=${groupId}, Group found:`, group);
    
    if (!files || files.length === 0) {
        showNotification('請選擇至少一張圖片', 'warning');
        return;
    }
    
    const progressContainer = document.getElementById('groupUploadProgress');
    progressContainer.style.display = 'block';
    
    try {
        // Upload each file
        const uploadedMaterialIds = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('layout', appState.activeLayout);
            formData.append('group_id', groupId);
            
            console.log(`[handleUploadToGroup] Uploading file ${i + 1}/${files.length}: ${file.name}`);
            
            const response = await fetchWithAuth('/api/media', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[handleUploadToGroup] Upload failed:`, errorText);
                throw new Error(`Failed to upload ${file.name}`);
            }
            
            const result = await response.json();
            console.log(`[handleUploadToGroup] Upload success. Material ID:`, result.material.id);
            uploadedMaterialIds.push(result.material.id);
            
            // Update progress
            const progress = ((i + 1) / files.length) * 100;
            progressContainer.querySelector('progress').value = progress;
        }
        
        console.log(`[handleUploadToGroup] All files uploaded. Material IDs:`, uploadedMaterialIds);
        console.log(`[handleUploadToGroup] Current group materials:`, group.materials);
        
        // Update group with new materials
        const updatedGroup = {
            ...group,
            materials: [...(group.materials || []), ...uploadedMaterialIds]
        };
        
        console.log(`[handleUploadToGroup] Updated group object:`, updatedGroup);
        
        const updateResponse = await fetchWithAuth(`/api/groups/${groupId}?layout=${appState.activeLayout}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedGroup)
        });
        
        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error(`[handleUploadToGroup] Group update failed:`, errorText);
            throw new Error('Failed to update group after upload.');
        }
        
        const updateResult = await updateResponse.json();
        console.log(`[handleUploadToGroup] Group update success:`, updateResult);
        
        showNotification(`成功上傳 ${files.length} 張圖片到群組 "${group.name}"`, 'success');
        
        // Reset upload form
        fileInput.value = '';
        document.getElementById('groupUploadFileName').textContent = '未選擇任何檔案';
        document.getElementById('uploadToGroupButton').disabled = true;
        
        // Refresh layout data and reopen modal
        console.log(`[handleUploadToGroup] Refreshing layout data...`);
        await fetchLayoutData(appState.activeLayout);
        console.log(`[handleUploadToGroup] Layout data refreshed. Groups:`, appState.groups);
        openEditGroupModal(groupId);
        
    } catch (error) {
        console.error('Upload to group error:', error);
        showNotification(`上傳失敗：${error.message}`, 'danger');
    } finally {
        progressContainer.style.display = 'none';
        progressContainer.querySelector('progress').value = 0;
    }
}

async function handleDeleteMedia(mediaId) {
    const media = appState.materials.find(m => m.id === mediaId);
    if (!media) return;
    
    // Check if this material is used in any groups
    const groupsUsingThis = appState.groups.filter(g => 
        g.materials && g.materials.includes(mediaId)
    );
    
    if (groupsUsingThis.length > 0) {
        const groupNames = groupsUsingThis.map(g => g.name).join('、');
        const confirmed = confirm(
            `⚠️ 警告：此媒體檔案正在被以下群組使用：\n\n` +
            `${groupNames}\n\n` +
            `刪除後，這些群組的輪播將會缺少此圖片。\n\n` +
            `建議：先從群組中移除此圖片，再刪除媒體檔案。\n\n` +
            `確定要繼續刪除嗎？`
        );
        
        if (!confirmed) {
            showNotification('已取消刪除操作', 'info');
            return;
        }
    } else {
        if (!confirm(`確定要刪除媒體檔案 "${media.filename}" 嗎？`)) return;
    }

    console.log(`Deleting media: id=${mediaId}, layout=${appState.activeLayout}`);

    try {
        const response = await fetchWithAuth(`/api/materials/${mediaId}?layout=${appState.activeLayout}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete media.');
        
        showNotification(`媒體檔案 "${media.filename}" 刪除成功。`, 'success');
        
        // If material was in groups, warn user to update those groups
        if (groupsUsingThis.length > 0) {
            const groupNames = groupsUsingThis.map(g => g.name).join('、');
            showNotification(
                `⚠️ 注意：請記得更新群組「${groupNames}」以移除此圖片的引用！`, 
                'warning'
            );
        }
        
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Delete media error:', error);
        showNotification(`刪除失敗：${error.message}`, 'danger');
    }
}

async function handleDeleteAssignment(assignmentId, contentName) {
    if (!confirm(`確定要移除 "${contentName}" 的指派嗎？\n\n此操作不會刪除群組本身，只是移除它在區塊的指派。`)) return;

    console.log(`Deleting assignment: id=${assignmentId}, layout=${appState.activeLayout}`);

    try {
        const response = await fetchWithAuth(`/api/assignments/${assignmentId}?layout=${appState.activeLayout}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete assignment.');
        
        showNotification(`"${contentName}" 的指派已移除。`, 'success');
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Delete assignment error:', error);
        showNotification(`移除指派失敗：${error.message}`, 'danger');
    }
}

async function handleGlobalSettings(e) {
    e.preventDefault();
    const form = e.target;
    
    const settings = {
        header_interval: parseInt(form.header_interval.value),
        carousel_interval: parseInt(form.carousel_interval.value),
        footer_interval: parseInt(form.footer_interval.value)
    };

    try {
        const response = await fetchWithAuth(`/api/settings?layout=${appState.activeLayout}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to update settings.');
        
        appState.settings = settings;
        showNotification('設定儲存成功。', 'success');
    } catch (error) {
        showNotification(`儲存失敗：${error.message}`, 'danger');
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- MODAL HANDLING ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('is-active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('is-active');
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!localStorage.getItem('jwt_token')) {
        return window.location.href = '/login.html';
    }
    
    document.getElementById('authCheckingScreen').style.display = 'none';
    document.getElementById('mainContent').classList.add('authenticated');
    
    // Subscribe to state changes
    subscribe(render);
    
    // Load initial data
    getInitialAdminData();

    // Event listeners for layouts and devices
    document.getElementById('layoutSelector').addEventListener('change', e => setState({ activeLayout: e.target.value }));
    document.getElementById('createLayoutForm').addEventListener('submit', handleCreateLayout);
    document.getElementById('deleteLayoutButton').addEventListener('click', handleDeleteLayout);
    document.getElementById('previewLayoutButton').addEventListener('click', () => {
        const layoutName = appState.activeLayout;
        const previewUrl = `/display.html?deviceId=preview-${layoutName}&t=${Date.now()}`;
        window.open(previewUrl, '_blank');
    });
    document.body.addEventListener('change', e => {
        if (e.target.matches('.device-layout-assign')) handleDeviceAssign(e.target);
    });
    document.body.addEventListener('click', e => {
        // Delete device
        if (e.target.matches('.delete-device-button') || e.target.closest('.delete-device-button')) {
            const button = e.target.matches('.delete-device-button') ? e.target : e.target.closest('.delete-device-button');
            handleDeleteDevice(button.dataset.deviceId);
        }
        // Edit device
        if (e.target.matches('.edit-device-button') || e.target.closest('.edit-device-button')) {
            const button = e.target.matches('.edit-device-button') ? e.target : e.target.closest('.edit-device-button');
            openEditDeviceModal(button.dataset.deviceId);
        }
        // Copy device ID from list
        if (e.target.matches('.copy-id-button') || e.target.closest('.copy-id-button')) {
            const button = e.target.matches('.copy-id-button') ? e.target : e.target.closest('.copy-id-button');
            e.stopPropagation();
            copyDeviceIdFromList(button.dataset.deviceId);
        }
    });

    // Event listeners for media upload
    document.getElementById('uploadForm').addEventListener('submit', handleMediaUpload);
    
    // Media type selector
    document.getElementById('mediaTypeSelect').addEventListener('change', function(e) {
        const type = e.target.value;
        const fileField = document.getElementById('fileUploadField');
        const groupField = document.getElementById('carouselGroupField');
        const offsetField = document.getElementById('carouselOffsetField');
        const sectionKeyField = document.getElementById('sectionKeyField');
        
        if (type === 'group_reference') {
            fileField.style.display = 'none';
            groupField.style.display = 'block';
            offsetField.style.display = 'block';
            sectionKeyField.style.display = 'block';
        } else {
            fileField.style.display = 'block';
            groupField.style.display = 'none';
            offsetField.style.display = 'none';
            sectionKeyField.style.display = 'block';
        }
    });
    
    // Ensure form fields are visible on page load
    document.getElementById('fileUploadField').style.display = 'block';
    document.getElementById('carouselGroupField').style.display = 'none';
    document.getElementById('carouselOffsetField').style.display = 'none';

    // File input display
    document.querySelector('.file-input').addEventListener('change', function(e) {
        const fileName = e.target.files[0]?.name || '未選擇任何檔案';
        document.querySelector('.file-name').textContent = fileName;
    });

    // Event listeners for group management
    document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);
    document.body.addEventListener('click', e => {
        // Edit group button
        if (e.target.matches('.edit-group-button') || e.target.closest('.edit-group-button')) {
            const button = e.target.matches('.edit-group-button') ? e.target : e.target.closest('.edit-group-button');
            openEditGroupModal(button.dataset.groupId);
        }
        // Delete group button
        if (e.target.matches('.delete-group-button') || e.target.closest('.delete-group-button')) {
            const button = e.target.matches('.delete-group-button') ? e.target : e.target.closest('.delete-group-button');
            handleDeleteGroup(button.dataset.groupId);
        }
        // Delete media button
        if (e.target.matches('.delete-media-button') || e.target.closest('.delete-media-button')) {
            const button = e.target.matches('.delete-media-button') ? e.target : e.target.closest('.delete-media-button');
            handleDeleteMedia(button.dataset.mediaId);
        }
        // Delete assignment button (for group assignments)
        if (e.target.matches('.delete-assignment-button') || e.target.closest('.delete-assignment-button')) {
            const button = e.target.matches('.delete-assignment-button') ? e.target : e.target.closest('.delete-assignment-button');
            handleDeleteAssignment(button.dataset.assignmentId, button.dataset.contentName);
        }
        // Reassign media button
        if (e.target.matches('.reassign-media-button') || e.target.closest('.reassign-media-button')) {
            const button = e.target.matches('.reassign-media-button') ? e.target : e.target.closest('.reassign-media-button');
            openReassignModal(button.dataset.mediaId, button.dataset.filename);
        }
        // Remove image from group button
        if (e.target.matches('.remove-image-button') || e.target.closest('.remove-image-button')) {
            const button = e.target.matches('.remove-image-button') ? e.target : e.target.closest('.remove-image-button');
            const materialId = button.dataset.materialId;
            const imageItem = button.closest('.image-list-item');
            if (imageItem && confirm('確定要從群組中移除此圖片嗎？')) {
                imageItem.remove();
                // Check if list is empty
                const selectedList = document.getElementById('selectedImagesList');
                if (selectedList.children.length === 0) {
                    selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
                }
            }
        }
    });
    
    // Group image upload file input change
    const groupImageUpload = document.getElementById('groupImageUpload');
    if (groupImageUpload) {
        groupImageUpload.addEventListener('change', function(e) {
            const files = e.target.files;
            const uploadButton = document.getElementById('uploadToGroupButton');
            const fileNameDisplay = document.getElementById('groupUploadFileName');
            
            if (files && files.length > 0) {
                fileNameDisplay.textContent = files.length === 1 ? files[0].name : `已選擇 ${files.length} 張圖片`;
                uploadButton.disabled = false;
            } else {
                fileNameDisplay.textContent = '未選擇任何檔案';
                uploadButton.disabled = true;
            }
        });
    }
    
    // Upload to group button
    const uploadToGroupButton = document.getElementById('uploadToGroupButton');
    if (uploadToGroupButton) {
        uploadToGroupButton.addEventListener('click', handleUploadToGroup);
    }
    
    // Save group changes button
    const saveGroupChangesButton = document.getElementById('saveGroupChangesButton');
    if (saveGroupChangesButton) {
        saveGroupChangesButton.addEventListener('click', handleSaveGroupChanges);
    }
    
    // Cancel group changes button
    const cancelGroupChangesButton = document.getElementById('cancelGroupChangesButton');
    if (cancelGroupChangesButton) {
        cancelGroupChangesButton.addEventListener('click', () => closeModal('editCarouselGroupModal'));
    }

    // Event listeners for settings
    document.getElementById('globalSettingsForm').addEventListener('submit', handleGlobalSettings);

    // Event listeners for modals
    document.addEventListener('click', e => {
        if (e.target.matches('.modal-background') || e.target.matches('.delete')) {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        }
    });

    // Edit device modal buttons
    document.getElementById('saveDeviceButton').addEventListener('click', handleSaveDevice);
    document.getElementById('cancelDeviceButton').addEventListener('click', () => closeModal('editDeviceModal'));
    document.getElementById('copyDeviceIdButton').addEventListener('click', copyDeviceId);

    // Logout button
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login.html';
    });

    // Initialize WebSocket
    initializeWebSocket();
});

function openReassignModal(mediaId, filename) {
    document.getElementById('reassignMediaId').value = mediaId;
    document.getElementById('reassignMediaFilename').textContent = filename;
    
    // Populate section select
    const select = document.getElementById('reassignSectionSelect');
    select.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>' +
        Object.entries(appState.available_sections)
            .map(([key, name]) => `<option value="${key}">${name}</option>`)
            .join('');
    
    openModal('reassignMediaModal');
}

document.getElementById('confirmReassignButton').addEventListener('click', async () => {
    const mediaId = document.getElementById('reassignMediaId').value;
    const sectionKey = document.getElementById('reassignSectionSelect').value;
    
    if (!sectionKey) return;

    console.log(`Assigning media: mediaId=${mediaId}, sectionKey=${sectionKey}, layout=${appState.activeLayout}`);

    try {
        const response = await fetchWithAuth(`/api/assignments?layout=${appState.activeLayout}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: generateId(),
                section_key: sectionKey,
                content_type: 'single_media',
                content_id: mediaId,
                created_at: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error('Failed to assign media.');
        
        showNotification('媒體指派成功。', 'success');
        closeModal('reassignMediaModal');
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Assign media error:', error);
        showNotification(`指派失敗：${error.message}`, 'danger');
    }
});

function initializeWebSocket() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'section_updated' && data.layout === appState.activeLayout) {
            fetchLayoutData(appState.activeLayout);
        } else if (data.type === 'device_assigned' || data.type === 'device_deleted') {
            refreshDevicesOnly();
        }
    };

    socket.onclose = () => {
        console.log('WebSocket closed. Reconnecting in 5 seconds...');
        setTimeout(initializeWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        socket.close();
    };
}