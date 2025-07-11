// MQ-CMS Admin Panel - Cloudflare Worker Version
// Main application entry point and initialization

// 狀態管理
let appState = {
    media: [],
    groups: [],
    assignments: [],
    materials: [],
    settings: {},
    available_sections: {
        'header_video': '頁首內容',
        'carousel_top_left': '左上輪播',
        'carousel_top_right': '右上輪播',
        'carousel_bottom_left': '左下輪播',
        'carousel_bottom_right': '右下輪播',
        'footer_content': '頁尾內容'
    },
    users: []
};

// 狀態訂閱器
const stateSubscribers = [];

// 狀態管理函數
function setState(newState) {
    appState = { ...appState, ...newState };
    stateSubscribers.forEach(callback => callback(appState));
}

function subscribe(callback) {
    stateSubscribers.push(callback);
    return () => {
        const index = stateSubscribers.indexOf(callback);
        if (index > -1) stateSubscribers.splice(index, 1);
    };
}

// API 通信函數
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('jwt_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    const response = await fetch(url, config);
    
    if (response.status === 401) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login.html';
        return;
    }
    
    return response;
}

// 初始數據獲取
async function getInitialData() {
    try {
        // 使用完整的媒體數據API
        const response = await fetch('/api/media_with_settings');
        if (!response.ok) {
            throw new Error(`API請求失敗: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('獲取到的完整數據:', data);
        
        // 轉換materials為media格式以保持兼容性
        const media = (data.materials || []).map((material, index) => ({
            id: material.id || `media_${index}`,
            filename: material.filename || material,
            name: material.filename || material,
            type: material.type || getFileType(material.filename || material),
            url: material.url || `/media/${material.filename || material}`
        }));
        
        return {
            media,
            groups: data.groups || [],
            assignments: data.assignments || [],
            materials: data.materials || [],
            settings: data.settings || {
                header_interval: 5,
                carousel_interval: 6,
                footer_interval: 7
            },
            available_sections: data.available_sections || appState.available_sections
        };
    } catch (error) {
        console.error('獲取初始數據失敗:', error);
        return {
            media: [],
            groups: [],
            assignments: [],
            materials: [],
            settings: {
                header_interval: 5,
                carousel_interval: 6,
                footer_interval: 7
            }
        };
    }
}

function getFileType(filename) {
    if (!filename) return 'unknown';
    const ext = filename.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi'];
    
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    return 'unknown';
}

// 媒體上傳函數
async function uploadMediaWithProgress(formData, progressCallback) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressCallback(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    resolve(result);
                } catch (e) {
                    reject(new Error('無法解析回應'));
                }
            } else {
                reject(new Error(`上傳失敗: ${xhr.status}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('網路錯誤'));
        });
        
        const token = localStorage.getItem('jwt_token');
        xhr.open('POST', '/api/media');
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
    });
}

// UI 渲染函數
function renderMediaAndAssignments() {
    const tbody = document.getElementById('mediaTableBody');
    if (!tbody) return;
    
    if (appState.media.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="has-text-centered">目前媒體庫為空。</td></tr>';
        return;
    }
    
    let html = '';
    appState.media.forEach(item => {
        // 檢查這個媒體是否已被指派
        const assignment = appState.assignments.find(a => a.content_id === item.id && a.content_type === 'single_media');
        const isInGroup = appState.groups.some(group => 
            group.materials && group.materials.some(material => material.id === item.id)
        );
        
        let statusText = '在庫，未指派';
        let statusClass = 'is-italic';
        
        if (assignment) {
            const sectionName = appState.available_sections[assignment.section_key] || assignment.section_key;
            statusText = `已指派到: ${sectionName}`;
            statusClass = 'tag is-success is-light';
        } else if (isInGroup) {
            const group = appState.groups.find(group => 
                group.materials && group.materials.some(material => material.id === item.id)
            );
            statusText = `在輪播組: ${group ? group.name : '未知組'}`;
            statusClass = 'tag is-info is-light';
        }
        
        html += `
            <tr>
                <td>
                    ${item.type === 'image' ? 
                        `<img src="${item.url}" class="image-thumbnail">` : 
                        '<i class="fas fa-film fa-2x"></i>'
                    }
                    <span>${item.filename || item.name}</span>
                </td>
                <td><span class="tag is-info is-light">${item.type === 'image' ? '圖片素材' : '影片素材'}</span></td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td class="actions-cell has-text-right">
                    <button class="button is-small is-info reassign-media-button" 
                            data-media-id="${item.id}"
                            data-media-type="${item.type}"
                            data-media-filename="${item.filename || item.name}">重新指派</button>
                    <button class="button is-small is-warning delete-media-button" 
                            data-item-id="${item.id}" 
                            data-item-type="material"
                            data-filename="${item.filename}">刪除素材</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function renderCarouselGroups() {
    const tbody = document.getElementById('groupsTableBody');
    if (!tbody) return;
    
    if (appState.groups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="has-text-centered">目前沒有任何輪播圖片組。</td></tr>';
        return;
    }
    
    let html = '';
    appState.groups.forEach(group => {
        // 計算群組中的圖片數量
        const imageCount = group.materials ? group.materials.length : 0;
        
        html += `
            <tr>
                <td>${group.name}</td>
                <td>${imageCount}</td>
                <td class="actions-cell has-text-right">
                    <button class="button is-small is-link edit-group-images-button" 
                            data-group-id="${group.id}" 
                            data-group-name="${group.name}">編輯圖片</button>
                    <button class="button is-small is-danger delete-group-button" 
                            data-item-id="${group.id}" 
                            data-item-type="carousel_group">刪除</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function render() {
    renderMediaAndAssignments();
    renderCarouselGroups();
    
    // 更新設定表單
    const headerInterval = document.getElementById('header_interval');
    const carouselInterval = document.getElementById('carousel_interval');
    const footerInterval = document.getElementById('footer_interval');
    
    if (headerInterval) headerInterval.value = appState.settings.header_interval || 5;
    if (carouselInterval) carouselInterval.value = appState.settings.carousel_interval || 6;
    if (footerInterval) footerInterval.value = appState.settings.footer_interval || 7;
    
    // 更新區塊選項
    const sectionSelect = document.getElementById('sectionKeySelect');
    if (sectionSelect) {
        sectionSelect.innerHTML = '';
        Object.entries(appState.available_sections).forEach(([key, name]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            sectionSelect.appendChild(option);
        });
    }
    
    // 更新輪播組選項
    const carouselGroupSelect = document.getElementById('carouselGroupSelect');
    if (carouselGroupSelect) {
        carouselGroupSelect.innerHTML = '';
        appState.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            carouselGroupSelect.appendChild(option);
        });
    }
}

// 事件處理函數
function setupEventHandlers() {
    // 文件選擇事件
    const fileInput = document.querySelector('.file-input');
    const fileName = document.querySelector('.file-name');
    if (fileInput && fileName) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileName.textContent = e.target.files[0].name;
            } else {
                fileName.textContent = '未選擇任何檔案';
            }
        });
    }
    
    // 媒體類型選擇事件
    const mediaTypeSelect = document.getElementById('mediaTypeSelect');
    if (mediaTypeSelect) {
        mediaTypeSelect.addEventListener('change', toggleFormFields);
    }
    
    // 上傳表單提交
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUploadFormSubmit);
    }
    
    // 建立群組表單提交
    const createGroupForm = document.getElementById('createGroupForm');
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', handleCreateGroupSubmit);
    }
    
    // 設定表單提交
    const settingsForm = document.getElementById('globalSettingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmit);
    }
    
    // 廣播表單提交
    const broadcastForm = document.getElementById('broadcastForm');
    if (broadcastForm) {
        broadcastForm.addEventListener('submit', handleBroadcastSubmit);
    }
    
    // 登出按鈕
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('jwt_token');
            window.location.href = '/login.html';
        });
    }
    
    // Modal 按鈕事件
    const confirmReassignButton = document.getElementById('confirmReassignButton');
    if (confirmReassignButton) {
        confirmReassignButton.addEventListener('click', handleConfirmReassign);
    }
    
    const cancelReassignButton = document.getElementById('cancelReassignButton');
    if (cancelReassignButton) {
        cancelReassignButton.addEventListener('click', closeAllModals);
    }
    
    // 使用事件委託處理動態元素
    document.body.addEventListener('click', handleDynamicClicks);
}

function toggleFormFields() {
    const mediaType = document.getElementById('mediaTypeSelect').value;
    const fileField = document.getElementById('fileUploadField');
    const groupField = document.getElementById('carouselGroupField');
    const offsetField = document.getElementById('carouselOffsetField');
    
    if (mediaType === 'group_reference') {
        fileField.style.display = 'none';
        groupField.style.display = 'block';
        offsetField.style.display = 'block';
    } else {
        fileField.style.display = 'block';
        groupField.style.display = 'none';
        offsetField.style.display = 'none';
    }
}

async function handleUploadFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const mediaType = formData.get('type');
    const sectionKey = formData.get('section_key');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    
    progressContainer.style.display = 'block';
    
    try {
        if (mediaType === 'group_reference') {
            // 處理群組指派
            const groupId = formData.get('carousel_group_id');
            if (!groupId) {
                throw new Error('請選擇輪播組');
            }
            
            const assignmentFormData = new FormData();
            assignmentFormData.append('section_key', sectionKey);
            assignmentFormData.append('content_type', 'group_reference');
            assignmentFormData.append('content_id', groupId);
            
            const response = await fetch('/ws/api/assignments', {
                method: 'POST',
                body: assignmentFormData
            });
            
            if (!response.ok) {
                throw new Error(`群組指派API請求失敗: ${response.status}`);
            }
            
            alert('群組指派成功！');
        } else {
            // 處理檔案上傳
            const fileFormData = new FormData();
            fileFormData.append('file', formData.get('file'));
            
            const uploadResult = await uploadMediaWithProgress(fileFormData, (progress) => {
                progressBar.value = progress;
                progressText.textContent = `${Math.round(progress)}%`;
            });
            
            console.log('上傳結果:', uploadResult);
            
            // 上傳成功後自動指派
            if (uploadResult.success && uploadResult.material && sectionKey) {
                const assignmentFormData = new FormData();
                assignmentFormData.append('section_key', sectionKey);
                assignmentFormData.append('content_type', 'single_media');
                assignmentFormData.append('content_id', uploadResult.material.id);
                
                const assignResponse = await fetch('/ws/api/assignments', {
                    method: 'POST',
                    body: assignmentFormData
                });
                
                if (assignResponse.ok) {
                    alert('上傳並指派成功！');
                } else {
                    alert('上傳成功，但指派失敗。請手動重新指派。');
                }
            } else {
                alert('上傳成功！');
            }
        }
        
        e.target.reset();
        const fileName = document.querySelector('.file-name');
        if (fileName) fileName.textContent = '未選擇任何檔案';
        
        // 重新載入數據
        const data = await getInitialData();
        setState(data);
        
    } catch (error) {
        console.error('操作失敗:', error);
        alert('操作失敗: ' + error.message);
    } finally {
        progressContainer.style.display = 'none';
        progressBar.value = 0;
        progressText.textContent = '0%';
    }
}

async function handleCreateGroupSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const groupName = formData.get('group_name');
    
    if (!groupName || !groupName.trim()) {
        alert('請輸入群組名稱');
        return;
    }
    
    try {
        const response = await fetch('/ws/api/groups', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`建立群組API請求失敗: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('群組建立成功:', result);
        
        alert('群組建立成功！');
        e.target.reset();
        
        // 重新載入數據
        const data = await getInitialData();
        setState(data);
        
    } catch (error) {
        console.error('建立群組失敗:', error);
        alert('建立群組失敗: ' + error.message);
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    
    const headerInterval = document.getElementById('header_interval').value;
    const carouselInterval = document.getElementById('carousel_interval').value;
    const footerInterval = document.getElementById('footer_interval').value;
    
    const settings = {
        header_interval: parseInt(headerInterval),
        carousel_interval: parseInt(carouselInterval),
        footer_interval: parseInt(footerInterval)
    };
    
    try {
        const response = await fetch('/ws/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            throw new Error(`設定API請求失敗: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('設定儲存成功:', result);
        
        // 更新本地狀態
        setState({ settings });
        alert('設定已儲存！');
        
    } catch (error) {
        console.error('儲存設定失敗:', error);
        alert('儲存設定失敗: ' + error.message);
    }
}

async function handleBroadcastSubmit(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const styleInput = document.getElementById('styleInput');
    
    const message = messageInput.value.trim();
    const style = styleInput.value;
    
    if (!message) {
        alert('請輸入訊息內容');
        return;
    }
    
    try {
        const response = await fetch('/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: message,
                style: style || 'is-info'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`訊息已發送給 ${result.connectionCount || 0} 個客戶端`);
            messageInput.value = '';
            styleInput.selectedIndex = 0;
        } else {
            throw new Error('發送失敗');
        }
        
    } catch (error) {
        console.error('發送廣播失敗:', error);
        alert('發送廣播失敗: ' + error.message);
    }
}

function handleDynamicClicks(e) {
    // 重新指派按鈕
    if (e.target.matches('.reassign-media-button')) {
        openReassignMediaModal(e.target);
    }
    
    // 刪除按鈕
    if (e.target.matches('.delete-media-button, .delete-group-button')) {
        handleDeleteItem(e.target);
    }
    
    // 編輯群組按鈕
    if (e.target.matches('.edit-group-images-button')) {
        openGroupEditModal(e.target);
    }
    
    // Modal 關閉按鈕
    if (e.target.matches('.modal .delete, .modal-background')) {
        closeAllModals();
    }
}

function openReassignMediaModal(button) {
    const modal = document.getElementById('reassignMediaModal');
    const filenameSpan = document.getElementById('reassignMediaFilename');
    const mediaIdInput = document.getElementById('reassignMediaId');
    const mediaTypeInput = document.getElementById('reassignMediaType');
    const sectionSelect = document.getElementById('reassignSectionSelect');
    
    if (modal && filenameSpan && mediaIdInput && mediaTypeInput && sectionSelect) {
        filenameSpan.textContent = button.dataset.mediaFilename;
        mediaIdInput.value = button.dataset.mediaId;
        mediaTypeInput.value = button.dataset.mediaType;
        
        // 填充區塊選項
        sectionSelect.innerHTML = '<option value="" disabled selected>-- 請選擇區塊 --</option>';
        Object.entries(appState.available_sections).forEach(([key, name]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            sectionSelect.appendChild(option);
        });
        
        modal.classList.add('is-active');
    }
}

function openGroupEditModal(button) {
    const modal = document.getElementById('editCarouselGroupModal');
    const groupNameSpan = document.getElementById('modalGroupName');
    const groupIdInput = document.getElementById('modalGroupId');
    
    if (modal && groupNameSpan && groupIdInput) {
        groupNameSpan.textContent = button.dataset.groupName;
        groupIdInput.value = button.dataset.groupId;
        
        modal.classList.add('is-active');
        
        // 載入群組圖片數據
        loadGroupImages(button.dataset.groupId);
    }
}

async function loadGroupImages(groupId) {
    console.log('載入群組圖片:', groupId);
    
    const selectedList = document.getElementById('selectedImagesList');
    const availableList = document.getElementById('availableImagesList');
    
    if (selectedList) {
        selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
    }
    
    if (availableList) {
        let html = '';
        appState.media.filter(item => item.type === 'image').forEach(item => {
            html += `
                <div class="image-list-item">
                    <img src="${item.url}" alt="${item.filename}">
                    <div class="image-item-info">
                        <p>${item.filename}</p>
                        <div class="tags">
                            <span class="tag is-light">可用</span>
                        </div>
                    </div>
                    <button class="button is-small is-primary toggle-button" 
                            data-image-id="${item.id}">加入</button>
                </div>
            `;
        });
        availableList.innerHTML = html || '<p class="has-text-grey-light has-text-centered p-4">沒有可用圖片</p>';
    }
}

async function handleConfirmReassign() {
    const mediaId = document.getElementById('reassignMediaId').value;
    const sectionKey = document.getElementById('reassignSectionSelect').value;
    
    if (!sectionKey) {
        alert('請選擇要指派的區塊');
        return;
    }
    
    try {
        // 先刪除舊的指派（如果存在）
        const existingAssignment = appState.assignments.find(a => a.content_id === mediaId && a.content_type === 'single_media');
        if (existingAssignment) {
            const deleteResponse = await fetch(`/ws/api/assignments/${existingAssignment.id}`, {
                method: 'DELETE'
            });
            if (!deleteResponse.ok) {
                console.warn('刪除舊指派失敗，繼續建立新指派');
            }
        }
        
        // 建立新的指派
        const formData = new FormData();
        formData.append('section_key', sectionKey);
        formData.append('content_type', 'single_media');
        formData.append('content_id', mediaId);
        
        const response = await fetch('/ws/api/assignments', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`指派API請求失敗: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('指派成功:', result);
        
        alert('指派成功！');
        closeAllModals();
        
        // 重新載入數據
        const data = await getInitialData();
        setState(data);
        
    } catch (error) {
        console.error('指派失敗:', error);
        alert('指派失敗: ' + error.message);
    }
}

async function handleDeleteItem(button) {
    const itemId = button.dataset.itemId;
    const itemType = button.dataset.itemType;
    const filename = button.dataset.filename;
    
    if (!confirm('確定要刪除此項目嗎？此操作無法復原。')) {
        return;
    }
    
    try {
        if (itemType === 'material' && filename) {
            const response = await fetch(`/api/media/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('刪除成功！');
                
                // 重新載入數據
                const data = await getInitialData();
                setState(data);
            } else {
                throw new Error('刪除失敗');
            }
        } else if (itemType === 'carousel_group') {
            // 處理群組刪除
            const response = await fetch(`/ws/api/groups/${itemId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('刪除成功！');
                
                // 重新載入數據
                const data = await getInitialData();
                setState(data);
            } else {
                throw new Error('刪除失敗');
            }
        }
        
    } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗: ' + error.message);
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('is-active');
    });
}

// 認證檢查
function checkAuthentication() {
    const authScreen = document.getElementById('authCheckingScreen');
    const mainContent = document.getElementById('mainContent');
    const token = localStorage.getItem('jwt_token');
    
    if (!token) {
        // 沒有 token，重定向到登入頁面
        window.location.href = '/login.html';
        return false;
    }
    
    try {
        // 簡單驗證 token 格式和過期時間
        const payload = JSON.parse(atob(token));
        if (payload.exp && payload.exp < Date.now()) {
            // Token 已過期
            localStorage.removeItem('jwt_token');
            window.location.href = '/login.html';
            return false;
        }
    } catch (error) {
        // Token 格式錯誤
        localStorage.removeItem('jwt_token');
        window.location.href = '/login.html';
        return false;
    }
    
    // 認證通過，顯示主內容
    if (authScreen) authScreen.style.display = 'none';
    if (mainContent) mainContent.classList.add('authenticated');
    
    return true;
}

// WebSocket 初始化
function initializeWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket 連接成功');
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'playlist_updated' || data.type === 'media_updated') {
                    // 重新載入數據
                    getInitialData().then(setState);
                }
            } catch (e) {
                console.error('WebSocket 訊息解析失敗:', e);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket 連接關閉');
            // 5秒後重新連接
            setTimeout(initializeWebSocket, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket 錯誤:', error);
        };
        
    } catch (error) {
        console.error('WebSocket 初始化失敗:', error);
    }
}

// 應用程式初始化
async function initializeApp() {
    if (!checkAuthentication()) {
        return;
    }
    
    // 設置事件處理器
    setupEventHandlers();
    
    // 訂閱狀態更新
    subscribe(render);
    
    // 載入初始數據
    try {
        const data = await getInitialData();
        setState(data);
    } catch (error) {
        console.error('載入初始數據失敗:', error);
    }
    
    // 初始化 WebSocket
    initializeWebSocket();
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initializeApp);