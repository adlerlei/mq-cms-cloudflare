// MQ-CMS Admin Panel - Cloudflare Worker Version

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
        'header_video': '頁首內容',
        'carousel_top_left': '左上輪播',
        'carousel_top_right': '右上輪播',
        'carousel_bottom_left': '左下輪播',
        'carousel_bottom_right': '右下輪播',
        'footer_content': '頁尾內容'
    },
};

const stateSubscribers = [];

function setState(newState) {
    const oldLayout = appState.activeLayout;
    appState = { ...appState, ...newState };

    // If the layout changed, render the UI synchronously first
    if (newState.activeLayout && newState.activeLayout !== oldLayout) {
        console.log(`Layout changed from ${oldLayout} to ${appState.activeLayout}. Re-rendering UI and fetching data...`);
        // This synchronous call updates the UI, including the delete button state
        stateSubscribers.forEach(callback => callback(appState));
        // Then, start the asynchronous data fetch which will trigger another render when complete
        fetchLayoutData(appState.activeLayout);
    } else {
        // For all other state changes, just trigger a normal render
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
        
        const media = (data.materials || []).map(material => ({
            id: material.id,
            filename: material.filename,
            name: material.filename,
            type: getFileType(material.filename),
            url: material.url
        }));
        
        appState = { ...appState, media, ...data };
        stateSubscribers.forEach(callback => callback(appState));
    } catch (error) {
        console.error(`Failed to fetch data for layout '${layoutName}':`, error);
        alert(`Could not load data for layout '${layoutName}'.`);
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
        ? '<tr><td colspan="3" class="has-text-centered">尚無設備連接。</td></tr>'
        : appState.devices.map(device => {
            const layoutOptions = appState.layouts.map(l => `<option value="${l.name}" ${device.layoutName === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
            return `<tr><td>${device.id}</td><td><div class="select is-small"><select class="device-layout-assign" data-device-id="${device.id}">${layoutOptions}</select></div></td><td>${device.last_seen ? new Date(device.last_seen).toLocaleString() : '從未'}</td></tr>`;
        }).join('');
}

function render() {
    renderLayouts();
    renderDevices();
    // Other render functions would go here...
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
        alert(`Layout "${name}" created.`);
        
        const newLayouts = [...appState.layouts, newLayout];
        setState({ layouts: newLayouts });
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function handleDeleteLayout() {
    const layoutName = appState.activeLayout;
    if (layoutName === 'default' || !confirm(`Delete layout "${layoutName}"? This is irreversible.`)) return;

    try {
        const response = await fetchWithAuth(`/api/layouts/${layoutName}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete layout.');
        
        alert(`Layout "${layoutName}" deleted.`);
        
        const newLayouts = appState.layouts.filter(l => l.name !== layoutName);
        setState({ layouts: newLayouts, activeLayout: 'default' });
    } catch (error) {
        alert(`Error: ${error.message}`);
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
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('jwt_token')) {
        return window.location.href = '/login.html';
    }
    document.getElementById('authCheckingScreen').style.display = 'none';
    document.getElementById('mainContent').classList.add('authenticated');
    
    subscribe(render);
    getInitialAdminData();

    // Event listeners
    document.getElementById('layoutSelector').addEventListener('change', e => setState({ activeLayout: e.target.value }));
    document.getElementById('createLayoutForm').addEventListener('submit', handleCreateLayout);
    document.getElementById('deleteLayoutButton').addEventListener('click', handleDeleteLayout);
    document.body.addEventListener('change', e => {
        if (e.target.matches('.device-layout-assign')) handleDeviceAssign(e.target);
    });
    // Other event listeners for media, groups, etc. would be attached here.
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
        } else if (data.type === 'device_assigned') {
            getInitialAdminData();
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
initializeWebSocket();