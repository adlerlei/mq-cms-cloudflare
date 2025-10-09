// MQ-CMS Admin Panel - Cloudflare Worker Version - Complete Implementation

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
        'carousel_top_left': '左上輪播區',
        'carousel_top_right': '右上輪播區',
        'carousel_bottom_left': '左下輪播區',
        'carousel_bottom_right': '右下輪播區',
        'footer_content': '頁尾內容區'
    },
};

const stateSubscribers = [];

function setState(newState) {
    const oldLayout = appState.activeLayout;
    appState = { ...appState, ...newState };

    if (newState.activeLayout && newState.activeLayout !== oldLayout) {
        console.log(`Layout changed from ${oldLayout} to ${appState.activeLayout}. Re-rendering UI and fetching data...`);
        stateSubscribers.forEach(callback => callback(appState));
        fetchLayoutData(appState.activeLayout);
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
    tbody.innerHTML = appState.devices.length === 0
        ? '<tr><td colspan="4" class="has-text-centered">尚無設備連接。</td></tr>'
        : appState.devices.map(device => {
            const layoutOptions = appState.layouts.map(l => `<option value="${l.name}" ${device.layoutName === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
            return `<tr>
                <td>${device.id}</td>
                <td><div class="select is-small"><select class="device-layout-assign" data-device-id="${device.id}">${layoutOptions}</select></div></td>
                <td>${device.last_seen ? new Date(device.last_seen).toLocaleString() : '從未'}</td>
                <td class="has-text-right">
                    <button class="button is-danger is-small delete-device-button" data-device-id="${device.id}">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
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
    const tbody = document.getElementById('mediaTableBody');
    if (!tbody) {
        console.error('mediaTableBody element not found');
        return;
    }

    console.log('Rendering media library with materials:', appState.materials);
    
    if (!appState.materials || appState.materials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="has-text-centered">目前沒有任何媒體檔案。</td></tr>';
        return;
    }

    tbody.innerHTML = appState.materials.map(material => {
        const assignment = appState.assignments.find(a => a.content_id === material.id && a.content_type === 'single_media');
        const assignedSection = assignment ? appState.available_sections[assignment.section_key] : null;
        
        const preview = material.type === 'image' 
            ? `<img src="${material.url}" alt="${material.filename}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">`
            : `<video src="${material.url}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;" muted></video>`;
        
        const statusBadge = assignedSection 
            ? `<span class="tag is-success">${assignedSection}</span>`
            : '<span class="tag is-light">未指派</span>';
            
        return `
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
        `;
    }).join('');
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
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification is-${type}`;
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    
    document.body.prepend(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Handle delete button
    notification.querySelector('.delete').addEventListener('click', () => {
        notification.remove();
    });
}

// --- EVENT HANDLERS ---
async function handleCreateLayout(e) {
    e.preventDefault();
    const input = document.getElementById('newLayoutName');
    const name = input.value.trim();
    if (!name) return alert('Layout name is required.');

    try {
        const newLayout = { name, created_at: new Date().toISOString() };
        const response = await fetchWithAuth('/api/layouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLayout)
        });
        if (!response.ok) throw new Error('Failed to create layout.');
        
        input.value = '';
        showNotification(`版面 "${name}" 建立成功。`, 'success');
        
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
    if (!confirm(`確定要刪除設備 "${deviceId}" 嗎？\n\n刪除後該設備需要重新連接並註冊。`)) return;

    console.log(`Deleting device: id=${deviceId}`);

    try {
        const response = await fetchWithAuth(`/api/devices/${deviceId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete device.');
        
        showNotification(`設備 "${deviceId}" 刪除成功。`, 'success');
        await refreshDevicesOnly();
    } catch (error) {
        console.error('Delete device error:', error);
        showNotification(`刪除失敗：${error.message}`, 'danger');
    }
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
        const offset = parseInt(formData.get('carousel_offset') || '0');
        
        if (!groupId || !sectionKey) {
            showNotification('請選擇輪播組和指派區塊', 'warning');
            return;
        }
        
        try {
            const response = await fetchWithAuth(`/api/assignments?layout=${appState.activeLayout}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: generateId(),
                    section_key: sectionKey,
                    content_type: 'group_reference',
                    content_id: groupId,
                    offset: offset,
                    created_at: new Date().toISOString()
                })
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

async function handleDeleteMedia(mediaId) {
    const media = appState.materials.find(m => m.id === mediaId);
    if (!media || !confirm(`確定要刪除媒體檔案 "${media.filename}" 嗎？`)) return;

    console.log(`Deleting media: id=${mediaId}, layout=${appState.activeLayout}`);

    try {
        const response = await fetchWithAuth(`/api/materials/${mediaId}?layout=${appState.activeLayout}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete media.');
        
        showNotification(`媒體檔案 "${media.filename}" 刪除成功。`, 'success');
        await fetchLayoutData(appState.activeLayout);
    } catch (error) {
        console.error('Delete media error:', error);
        showNotification(`刪除失敗：${error.message}`, 'danger');
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
        const previewUrl = `/display.html?deviceId=preview-${layoutName}`;
        window.open(previewUrl, '_blank');
    });
    document.body.addEventListener('change', e => {
        if (e.target.matches('.device-layout-assign')) handleDeviceAssign(e.target);
    });
    document.body.addEventListener('click', e => {
        if (e.target.matches('.delete-device-button') || e.target.closest('.delete-device-button')) {
            const button = e.target.matches('.delete-device-button') ? e.target : e.target.closest('.delete-device-button');
            handleDeleteDevice(button.dataset.deviceId);
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
        if (e.target.matches('.delete-group-button') || e.target.closest('.delete-group-button')) {
            const button = e.target.matches('.delete-group-button') ? e.target : e.target.closest('.delete-group-button');
            handleDeleteGroup(button.dataset.groupId);
        }
        if (e.target.matches('.delete-media-button') || e.target.closest('.delete-media-button')) {
            const button = e.target.matches('.delete-media-button') ? e.target : e.target.closest('.delete-media-button');
            handleDeleteMedia(button.dataset.mediaId);
        }
        if (e.target.matches('.reassign-media-button') || e.target.closest('.reassign-media-button')) {
            const button = e.target.matches('.reassign-media-button') ? e.target : e.target.closest('.reassign-media-button');
            openReassignModal(button.dataset.mediaId, button.dataset.filename);
        }
    });

    // Event listeners for settings
    document.getElementById('globalSettingsForm').addEventListener('submit', handleGlobalSettings);

    // Event listeners for modals
    document.addEventListener('click', e => {
        if (e.target.matches('.modal-background') || e.target.matches('.delete')) {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        }
    });

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