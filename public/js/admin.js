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
    
    // 創建一個包含所有項目的數組：單獨的媒體 + 群組
    const allItems = [];
    
    // 添加單獨的媒體（不在任何群組中的）
    appState.media.forEach(item => {
        const isInGroup = appState.groups.some(group => 
            group.materials && group.materials.some(material => material.id === item.id)
        );
        
        if (!isInGroup) {
            const assignment = appState.assignments.find(a => a.content_id === item.id && a.content_type === 'single_media');
            
            let statusText = '在庫，未指派';
            let statusClass = 'is-italic';
            
            if (assignment) {
                const sectionName = appState.available_sections[assignment.section_key] || assignment.section_key;
                const offsetText = assignment.offset && assignment.offset > 0 ? ` (偏移: ${assignment.offset})` : '';
                statusText = `已指派到: ${sectionName}${offsetText}`;
                statusClass = 'tag is-success is-light';
            }
            
            allItems.push({
                type: 'media',
                item: item,
                statusText: statusText,
                statusClass: statusClass
            });
        }
    });
    
    // 添加群組
    appState.groups.forEach(group => {
        const assignment = appState.assignments.find(a => a.content_id === group.id && a.content_type === 'group_reference');
        const imageCount = group.materials ? group.materials.length : 0;
        
        let statusText = '在庫，未指派';
        let statusClass = 'is-italic';
        
        if (assignment) {
            const sectionName = appState.available_sections[assignment.section_key] || assignment.section_key;
            const offsetText = assignment.offset && assignment.offset > 0 ? ` (偏移: ${assignment.offset})` : '';
            statusText = `已指派到: ${sectionName}${offsetText}`;
            statusClass = 'tag is-success is-light';
        }
        
        allItems.push({
            type: 'group',
            item: group,
            imageCount: imageCount,
            statusText: statusText,
            statusClass: statusClass
        });
    });
    
    if (allItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="has-text-centered">目前媒體庫為空。</td></tr>';
        return;
    }
    
    let html = '';
    allItems.forEach(({ type, item, imageCount, statusText, statusClass }) => {
        if (type === 'media') {
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
        } else if (type === 'group') {
            html += `
                <tr>
                    <td>
                        <i class="fas fa-images fa-2x"></i>
                        <span>${item.name} (${imageCount})</span>
                    </td>
                    <td><span class="tag is-primary is-light">輪播群組</span></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td class="actions-cell has-text-right">
                        <button class="button is-small is-info reassign-group-button" 
                                data-group-id="${item.id}"
                                data-group-name="${item.name}">重新指派</button>
                        <button class="button is-small is-warning delete-group-button" 
                                data-item-id="${item.id}" 
                                data-item-type="carousel_group">刪除群組</button>
                    </td>
                </tr>
            `;
        }
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
                <td>${group.name} (${imageCount})</td>
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
    
    // 群組圖片上傳事件
    const groupImageUploadInput = document.getElementById('groupImageUpload');
    const groupUploadFileName = document.getElementById('groupUploadFileName');
    const uploadToGroupButton = document.getElementById('uploadToGroupButton');
    
    if (groupImageUploadInput && groupUploadFileName && uploadToGroupButton) {
        groupImageUploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                groupUploadFileName.textContent = `${e.target.files.length} 個檔案已選擇`;
                uploadToGroupButton.disabled = false;
            } else {
                groupUploadFileName.textContent = '未選擇任何檔案';
                uploadToGroupButton.disabled = true;
            }
        });
        
        uploadToGroupButton.addEventListener('click', handleGroupImageUpload);
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
    
    // 漢堡選單切換功能
    const navbarBurger = document.querySelector('.navbar-burger');
    const navbarMenu = document.querySelector('.navbar-menu');
    
    if (navbarBurger && navbarMenu) {
        navbarBurger.addEventListener('click', () => {
            // 切換 is-active 類別
            navbarBurger.classList.toggle('is-active');
            navbarMenu.classList.toggle('is-active');
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
            const offset = formData.get('offset');
            
            if (!groupId) {
                throw new Error('請選擇輪播組');
            }
            
            const assignmentFormData = new FormData();
            assignmentFormData.append('section_key', sectionKey);
            assignmentFormData.append('content_type', 'group_reference');
            assignmentFormData.append('content_id', groupId);
            if (offset !== null && offset !== '') {
                assignmentFormData.append('offset', offset);
            }
            
            const response = await fetch('/ws/api/assignments', {
                method: 'POST',
                body: assignmentFormData
            });
            
            if (!response.ok) {
                throw new Error(`群組指派API請求失敗: ${response.status}`);
            }
            
            const offsetText = offset && parseInt(offset) > 0 ? ` (偏移量: ${offset})` : '';
            alert(`群組指派成功！${offsetText}`);
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
    
    // 重新指派群組按鈕
    if (e.target.matches('.reassign-group-button')) {
        openReassignGroupModal(e.target);
    }
    
    // 刪除按鈕
    if (e.target.matches('.delete-media-button, .delete-group-button')) {
        handleDeleteItem(e.target);
    }
    
    // 編輯群組按鈕
    if (e.target.matches('.edit-group-images-button')) {
        openGroupEditModal(e.target);
    }
    
    // 群組內圖片切換按鈕
    if (e.target.matches('.toggle-button')) {
        handleImageToggle(e.target);
    }
    
    // 儲存群組變更按鈕
    if (e.target.matches('#saveGroupChangesButton')) {
        handleSaveGroupChanges(e.target);
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

function openReassignGroupModal(button) {
    const modal = document.getElementById('reassignMediaModal');
    const filenameSpan = document.getElementById('reassignMediaFilename');
    const mediaIdInput = document.getElementById('reassignMediaId');
    const mediaTypeInput = document.getElementById('reassignMediaType');
    const sectionSelect = document.getElementById('reassignSectionSelect');
    
    if (modal && filenameSpan && mediaIdInput && mediaTypeInput && sectionSelect) {
        filenameSpan.textContent = `群組: ${button.dataset.groupName}`;
        mediaIdInput.value = button.dataset.groupId;
        mediaTypeInput.value = 'group_reference';
        
        // 填充輪播區塊選項（群組只能指派到輪播區塊）
        sectionSelect.innerHTML = '<option value="" disabled selected>-- 請選擇輪播區塊 --</option>';
        const carouselSections = {
            'carousel_top_left': '左上輪播',
            'carousel_top_right': '右上輪播',
            'carousel_bottom_left': '左下輪播',
            'carousel_bottom_right': '右下輪播'
        };
        
        Object.entries(carouselSections).forEach(([key, name]) => {
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
    
    // 找到目標群組
    const targetGroup = appState.groups.find(g => g.id === groupId);
    const imageIdsInGroup = new Set(targetGroup ? (targetGroup.materials || []).map(m => m.id) : []);
    
    // 計算素材使用情況
    const materialUsage = {};
    appState.groups.forEach(g => {
        if (g.materials) {
            g.materials.forEach(material => {
                if (!materialUsage[material.id]) materialUsage[material.id] = [];
                if (g.id !== groupId) materialUsage[material.id].push(g.name);
            });
        }
    });
    
    // 渲染已選圖片
    if (selectedList) {
        selectedList.innerHTML = '';
        if (imageIdsInGroup.size === 0) {
            selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
        } else {
            if (targetGroup && targetGroup.materials) {
                targetGroup.materials.forEach(material => {
                    selectedList.appendChild(createDraggableImageItem(material, false, materialUsage));
                });
            }
        }
    }
    
    // 不再需要渲染可用圖片區塊
}

function createDraggableImageItem(material, isAvailable, usage) {
    const item = document.createElement('div');
    item.className = 'image-list-item';
    item.dataset.imageId = material.id;
    item.dataset.filename = material.filename;
    item.draggable = true;

    let tags = '';
    if (usage[material.id] && usage[material.id].length > 0) {
        tags += `<span class="tag is-info is-small" title="${usage[material.id].join(', ')}">在其他群組</span>`;
    }

    item.innerHTML = `
        <img src="${material.url}" alt="${material.filename}">
        <div class="image-item-info">
            <p>${material.filename}</p>
            <div class="tags">${tags}</div>
        </div>
        <button class="button is-small is-danger toggle-button" data-image-id="${material.id}">
            刪除
        </button>
    `;
    
    return item;
}

async function handleGroupImageUpload() {
    const groupId = document.getElementById('modalGroupId').value;
    const groupImageUploadInput = document.getElementById('groupImageUpload');
    const uploadToGroupButton = document.getElementById('uploadToGroupButton');
    const groupUploadProgress = document.getElementById('groupUploadProgress');
    const groupUploadFileName = document.getElementById('groupUploadFileName');
    
    const files = groupImageUploadInput.files;
    
    if (!groupId || files.length === 0) {
        alert('請選擇要上傳的檔案。');
        return;
    }
    
    uploadToGroupButton.classList.add('is-loading');
    uploadToGroupButton.disabled = true;
    if (groupUploadProgress) groupUploadProgress.style.display = 'block';
    
    try {
        // 逐個上傳檔案到媒體庫
        const uploadedMaterials = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/media', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`上傳 ${file.name} 失敗`);
            }
            
            const result = await response.json();
            if (result.success && result.material) {
                uploadedMaterials.push(result.material);
            }
        }
        
        // 將上傳的圖片加入群組
        if (uploadedMaterials.length > 0) {
            const groupUpdateFormData = new FormData();
            groupUpdateFormData.append('action', 'add_materials');
            uploadedMaterials.forEach(material => {
                groupUpdateFormData.append('material_ids[]', material.id);
            });
            
            const groupResponse = await fetch(`/ws/api/groups/${groupId}/materials`, {
                method: 'POST',
                body: groupUpdateFormData
            });
            
            if (!groupResponse.ok) {
                const errorData = await groupResponse.json();
                throw new Error(errorData.error || '將圖片加入群組失敗');
            }
            
            // 立即更新UI - 添加新上傳的圖片到已選列表
            const selectedList = document.getElementById('selectedImagesList');
            const placeholder = selectedList.querySelector('p');
            if (placeholder) placeholder.remove();
            
            // 計算使用情況（簡化版本）
            const materialUsage = {};
            
            // 添加新上傳的圖片到已選列表
            uploadedMaterials.forEach(material => {
                selectedList.appendChild(createDraggableImageItem(material, false, materialUsage));
            });
            
            alert(`成功上傳 ${uploadedMaterials.length} 張圖片到群組！`);
            
            // 重新載入數據以確保同步
            const data = await getInitialData();
            setState(data);
        }
        
        // 重置表單
        groupImageUploadInput.value = '';
        groupUploadFileName.textContent = '未選擇任何檔案';
        
    } catch (error) {
        console.error('上傳失敗:', error);
        alert('上傳失敗: ' + error.message);
    } finally {
        uploadToGroupButton.classList.remove('is-loading');
        uploadToGroupButton.disabled = true;
        if (groupUploadProgress) groupUploadProgress.style.display = 'none';
    }
}

async function handleImageToggle(button) {
    const item = button.closest('.image-list-item');
    const selectedList = document.getElementById('selectedImagesList');
    const imageId = button.dataset.imageId;
    const filename = item.dataset.filename;
    
    // 只允許從已選列表中刪除圖片
    if (selectedList && selectedList.contains(item)) {
        if (confirm(`確定要永久刪除這張圖片嗎？\n檔案名稱：${filename}\n⚠️ 警告：此操作會從系統中完全刪除此圖片，無法復原！`)) {
            try {
                // 先從UI中移除
                item.remove();
                
                // 從後端完全刪除這張圖片
                const response = await fetch(`/api/media/${imageId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('刪除圖片失敗');
                }
                
                // 如果已選列表為空，顯示佔位符
                if (selectedList.querySelectorAll('.image-list-item').length === 0) {
                    selectedList.innerHTML = '<p class="has-text-grey-light has-text-centered p-4">此群組尚無圖片</p>';
                }
                
                // 重新載入數據以確保同步
                const data = await getInitialData();
                setState(data);
                
                console.log(`圖片 ${filename} 已從系統中完全刪除`);
                
            } catch (error) {
                console.error('刪除圖片失敗:', error);
                alert('刪除圖片失敗: ' + error.message);
                
                // 如果刪除失敗，重新載入數據恢復UI狀態
                const data = await getInitialData();
                setState(data);
                loadGroupImages(document.getElementById('modalGroupId').value);
            }
        }
    }
}

async function handleSaveGroupChanges(button) {
    button.classList.add('is-loading');
    const groupId = document.getElementById('modalGroupId').value;
    const selectedImagesList = document.getElementById('selectedImagesList');
    const imageIds = [...selectedImagesList.querySelectorAll('.image-list-item')].map(item => item.dataset.imageId);
    
    try {
        const formData = new FormData();
        formData.append('action', 'update_materials');
        imageIds.forEach(id => {
            formData.append('material_ids[]', id);
        });
        
        const response = await fetch(`/ws/api/groups/${groupId}/materials`, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('儲存群組變更失敗');
        }
        
        alert('群組變更已儲存！');
        closeAllModals();
        
        // 重新載入數據
        const data = await getInitialData();
        setState(data);
        
    } catch (error) {
        console.error('儲存失敗:', error);
        alert('儲存失敗: ' + error.message);
    } finally {
        button.classList.remove('is-loading');
    }
}

async function handleConfirmReassign() {
    const mediaId = document.getElementById('reassignMediaId').value;
    const mediaType = document.getElementById('reassignMediaType').value;
    const sectionKey = document.getElementById('reassignSectionSelect').value;
    
    if (!sectionKey) {
        alert('請選擇要指派的區塊');
        return;
    }
    
    try {
        // 先刪除舊的指派（如果存在）
        const contentType = mediaType === 'group_reference' ? 'group_reference' : 'single_media';
        const existingAssignment = appState.assignments.find(a => a.content_id === mediaId && a.content_type === contentType);
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
        formData.append('content_type', contentType);
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
    
    // 根據項目類型顯示不同的確認訊息
    let confirmMessage = '確定要刪除此項目嗎？此操作無法復原。';
    if (itemType === 'carousel_group') {
        confirmMessage = '確定要刪除此輪播群組嗎？\n⚠️ 警告：這將會同時刪除群組內的所有圖片檔案！\n此操作無法復原。';
    }
    
    if (!confirm(confirmMessage)) {
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
            // 處理群組刪除 - 會同時刪除群組內的所有圖片
            const response = await fetch(`/ws/api/groups/${itemId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('群組及其內部所有圖片已刪除成功！');
                
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

// WebSocket 相關變數
let adminCurrentSocket = null;
let adminLastHeartbeatTime = 0;
let adminHeartbeatCheckTimer = null;
const ADMIN_HEARTBEAT_TIMEOUT = 65000; // 65秒，略長於兩個ping週期(30秒*2)
const ADMIN_RECONNECT_DELAY = 5000; // 5秒重連延遲

// WebSocket 初始化
function initializeWebSocket() {
    try {
        // 清理舊的連接和計時器
        if (adminCurrentSocket) {
            adminCurrentSocket.close();
            adminCurrentSocket = null;
        }
        if (adminHeartbeatCheckTimer) {
            clearTimeout(adminHeartbeatCheckTimer);
            adminHeartbeatCheckTimer = null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🔌 管理頁面正在連接 WebSocket:', wsUrl);
        
        adminCurrentSocket = new WebSocket(wsUrl);
        
        adminCurrentSocket.onopen = () => {
            console.log('✅ 管理頁面 WebSocket 連接成功');
            adminLastHeartbeatTime = Date.now();
            startAdminHeartbeatCheck();
        };
        
        adminCurrentSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 管理頁面收到 WebSocket 訊息:', data);
                
                // 更新最後心跳時間（任何訊息都算作心跳）
                adminLastHeartbeatTime = Date.now();
                
                if (data.type === 'ping') {
                    console.log('🏓 管理頁面收到伺服器ping，回應pong');
                    // 立即回應pong
                    if (adminCurrentSocket && adminCurrentSocket.readyState === WebSocket.OPEN) {
                        adminCurrentSocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    }
                } else if (data.type === 'playlist_updated' || data.type === 'media_updated') {
                    // 重新載入數據
                    getInitialData().then(setState);
                } else if (data.type === 'settings_updated') {
                    // 設定更新，重新載入數據
                    getInitialData().then(setState);
                }
            } catch (e) {
                console.error('管理頁面 WebSocket 訊息解析失敗:', e);
            }
        };
        
        adminCurrentSocket.onclose = (event) => {
            console.log('❌ 管理頁面 WebSocket 連接關閉，代碼:', event.code, '原因:', event.reason);
            adminCurrentSocket = null;
            
            // 停止心跳檢查
            if (adminHeartbeatCheckTimer) {
                clearTimeout(adminHeartbeatCheckTimer);
                adminHeartbeatCheckTimer = null;
            }
            
            // 延遲重新連接
            console.log(`⏰ 管理頁面 ${ADMIN_RECONNECT_DELAY/1000}秒後重新連接...`);
            setTimeout(initializeWebSocket, ADMIN_RECONNECT_DELAY);
        };
        
        adminCurrentSocket.onerror = (error) => {
            console.error('❌ 管理頁面 WebSocket 錯誤:', error);
        };
        
    } catch (error) {
        console.error('管理頁面 WebSocket 初始化失敗:', error);
        // 如果初始化失敗，也要重試
        setTimeout(initializeWebSocket, ADMIN_RECONNECT_DELAY);
    }
}

// 開始管理頁面心跳檢查
function startAdminHeartbeatCheck() {
    // 清理舊的計時器
    if (adminHeartbeatCheckTimer) {
        clearTimeout(adminHeartbeatCheckTimer);
    }
    
    adminHeartbeatCheckTimer = setTimeout(() => {
        const timeSinceLastHeartbeat = Date.now() - adminLastHeartbeatTime;
        
        if (timeSinceLastHeartbeat > ADMIN_HEARTBEAT_TIMEOUT) {
            console.warn(`⚠️ 管理頁面心跳超時 (${timeSinceLastHeartbeat}ms > ${ADMIN_HEARTBEAT_TIMEOUT}ms)，主動重連`);
            
            // 主動關閉連接並重新連接
            if (adminCurrentSocket) {
                adminCurrentSocket.close(1000, 'Heartbeat timeout');
            } else {
                // 如果socket已經不存在，直接重連
                initializeWebSocket();
            }
        } else {
            // 繼續下一次檢查
            startAdminHeartbeatCheck();
        }
    }, ADMIN_HEARTBEAT_TIMEOUT);
}

// 拖拽排序功能
function setupDragAndDrop() {
    let draggedItem = null;
    let draggedFromContainer = null;
    
    document.body.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('image-list-item')) {
            draggedItem = e.target;
            draggedFromContainer = e.target.parentElement;
            e.target.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            console.log('開始拖拽:', e.target.dataset.imageId);
        }
    });
    
    document.body.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('image-list-item')) {
            e.target.style.opacity = '';
            draggedItem = null;
            draggedFromContainer = null;
            console.log('拖拽結束');
        }
    });
    
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const selectedList = document.getElementById('selectedImagesList');
        if (!selectedList || !draggedItem) return;
        
        // 只允許在已選圖片列表內拖拽排序
        if (selectedList.contains(e.target) || e.target === selectedList) {
            const afterElement = getDragAfterElement(selectedList, e.clientY);
            
            if (afterElement == null) {
                // 移動到列表末尾
                if (selectedList.lastElementChild !== draggedItem) {
                    selectedList.appendChild(draggedItem);
                }
            } else {
                // 移動到指定位置
                if (afterElement !== draggedItem.nextSibling) {
                    selectedList.insertBefore(draggedItem, afterElement);
                }
            }
        }
    });
    
    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem) {
            console.log('拖拽完成，新順序已更新');
            // 可以在這裡添加自動保存邏輯
        }
    });
    
    // 為已選圖片列表添加拖拽區域樣式
    const selectedList = document.getElementById('selectedImagesList');
    if (selectedList) {
        selectedList.addEventListener('dragenter', (e) => {
            e.preventDefault();
            selectedList.classList.add('drag-over');
        });
        
        selectedList.addEventListener('dragleave', (e) => {
            if (!selectedList.contains(e.relatedTarget)) {
                selectedList.classList.remove('drag-over');
            }
        });
        
        selectedList.addEventListener('drop', (e) => {
            selectedList.classList.remove('drag-over');
        });
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.image-list-item:not([style*="opacity: 0.5"])')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 應用程式初始化
async function initializeApp() {
    if (!checkAuthentication()) {
        return;
    }
    
    // 設置事件處理器
    setupEventHandlers();
    
    // 設置拖拽排序
    setupDragAndDrop();
    
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