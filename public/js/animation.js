// Version check
const PLAYER_VERSION = '5.3.3';

// Debug mode control - can be enabled via URL param (?debug=true) or keyboard shortcut (Ctrl+Shift+D)
let DEBUG_MODE = false;

// Global settings defaults
const DEFAULT_INTERVALS = {
  header_interval: 5000,
  carousel_interval: 6000,
  footer_interval: 7000,
};

// Globals for device and layout info
let currentDeviceId = null;
let currentLayoutName = null;

// Debug logging function - only logs when DEBUG_MODE is enabled
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// Always log errors and warnings
function errorLog(...args) {
    console.error(...args);
}

function warnLog(...args) {
    console.warn(...args);
}

// Debug info helper
function addDebugInfo(message) {
    const debugSections = document.getElementById('debug-sections');
    if (debugSections) {
        const div = document.createElement('div');
        div.textContent = message;
        div.style.marginBottom = '3px';
        debugSections.appendChild(div);
    }
}

// Get deviceId from URL, show error if not present
function getDeviceId() {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('deviceId');
    if (!deviceId) {
        errorLog("No deviceId provided in URL!");
        document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; padding: 50px;">Error: Missing deviceId parameter in URL.</div>';
    }
    return deviceId;
}

// Fetch layout-specific data for the current device
async function fetchMediaData() {
  if (!currentDeviceId) {
    errorLog("Cannot fetch data: deviceId is not set.");
    return null;
  }
  try {
    const apiUrl = `/api/config?deviceId=${currentDeviceId}&t=${Date.now()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }
    const data = await response.json();
    debugLog(`Successfully fetched config for device ${currentDeviceId}:`, data);
    debugLog(`📊 Data summary:`, {
      materials: data.materials?.length || 0,
      assignments: data.assignments?.length || 0,
      groups: data.groups?.length || 0,
      settings: data.settings
    });
    currentLayoutName = data.layout; // Store the current layout name
    return data;
  } catch (error) {
    errorLog('fetchMediaData error:', error);
    return null;
  }
}

function initializeGenericCarousel(containerElement, slideInterval, startOffset = 0) {
    if (!containerElement) return;
    const inner = containerElement.querySelector(".carousel-inner");
    if (!inner) return;
    const items = inner.querySelectorAll(".carousel-item");

    if (containerElement.slideTimer) clearTimeout(containerElement.slideTimer);

    if (items.length <= 1) {
        inner.style.transform = "translateX(0)";
        if (items.length === 1) {
            const media = items[0].querySelector('video, img');
            if (media && media.tagName === 'VIDEO') {
                media.loop = true;
                media.play().catch(e => console.warn("Single video playback failed:", e));
            }
        }
        return;
    }

    let currentIndex = Math.max(0, Math.min(startOffset, items.length - 1));
    debugLog(`🔄 Carousel initialized: startOffset=${startOffset}, items.length=${items.length}, currentIndex=${currentIndex}`);
    inner.style.transition = "none";
    inner.style.transform = `translateX(-${currentIndex * 100}%)`;

    let playerTimeout;

    function playNext() {
        if (playerTimeout) clearTimeout(playerTimeout);
        const prevItem = items[currentIndex % items.length];
        const prevVideo = prevItem.querySelector('video');
        if (prevVideo) prevVideo.removeEventListener('ended', playNext);

        currentIndex++;
        inner.style.transition = "transform 0.5s ease";
        inner.style.transform = `translateX(-${currentIndex * 100}%)`;

        inner.addEventListener('transitionend', () => {
            if (currentIndex >= items.length) {
                inner.style.transition = 'none';
                currentIndex = 0;
                inner.style.transform = `translateX(0%)`;
                setTimeout(playCurrent, 20);
            }
        }, { once: true });

        playCurrent();
    }

    function playCurrent() {
        const currentItem = items[currentIndex % items.length];
        const mediaElement = currentItem.querySelector('video, img');

        if (mediaElement && mediaElement.tagName === 'VIDEO') {
            mediaElement.currentTime = 0;
            mediaElement.play().then(() => {
                mediaElement.addEventListener('ended', playNext, { once: true });
            }).catch(() => {
                playerTimeout = setTimeout(playNext, 2000);
            });
        } else {
            playerTimeout = setTimeout(playNext, slideInterval);
        }
    }
    playCurrent();
}

// Update a specific section with its content
function updateSection(sectionKey, data, containerId, slideInterval) {
    const container = document.getElementById(containerId);
    if (!container) {
        addDebugInfo(`❌ ${sectionKey}: 容器 #${containerId} 不存在`);
        return;
    }
    
    // Log container dimensions
    const rect = container.getBoundingClientRect();
    debugLog(`📐 Container #${containerId} dimensions:`, {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
    });
    if (DEBUG_MODE) addDebugInfo(`   └─ 📐 容器尺寸: ${Math.round(rect.width)}x${Math.round(rect.height)}px`);

    if (container.slideTimer) clearInterval(container.slideTimer);
    container.innerHTML = '';

    // Support both new and old section_key naming conventions
    // New: top_left, top_right, bottom_left, bottom_right
    // Old: carousel_top_left, carousel_top_right, carousel_bottom_left, carousel_bottom_right
    const sectionKeyAliases = {
        'top_left': ['top_left', 'carousel_top_left'],
        'top_right': ['top_right', 'carousel_top_right'],
        'bottom_left': ['bottom_left', 'carousel_bottom_left'],
        'bottom_right': ['bottom_right', 'carousel_bottom_right'],
        'header_video': ['header_video'],
        'header_1_video': ['header_1_video'],
        'footer_content': ['footer_content']
    };
    
    const possibleKeys = sectionKeyAliases[sectionKey] || [sectionKey];
    const sectionAssignments = data.assignments.filter(a => possibleKeys.includes(a.section_key));
    debugLog(`📍 Section ${sectionKey} (aliases: ${possibleKeys.join(', ')}): found ${sectionAssignments.length} assignments`);
    if (DEBUG_MODE) addDebugInfo(`📍 ${sectionKey}: ${sectionAssignments.length} 個指派`);
    
    if (sectionAssignments.length === 0) return;

    const contentItems = [];
    let carouselOffset = 0;
    sectionAssignments.forEach(assignment => {
        debugLog(`  Processing assignment: type=${assignment.content_type}, content_id=${assignment.content_id}`);
        
        if (assignment.content_type === 'single_media') {
            const material = data.materials.find(m => m.id === assignment.content_id);
            if (material) {
                debugLog(`    ✅ Found single media: ${material.filename}`);
                contentItems.push(material);
            } else {
                warnLog(`    ❌ Material not found: ${assignment.content_id}`);
                if (DEBUG_MODE) addDebugInfo(`   └─ ❌ 素材不存在: ${assignment.content_id.substring(0, 8)} (孤兒指派)`);
            }
        } else if (assignment.content_type === 'group_reference') {
            const group = data.groups.find(g => g.id === assignment.content_id);
            debugLog(`    Looking for group: ${assignment.content_id}`, group ? `Found: ${group.name}` : 'NOT FOUND');
            
            if (group && group.materials) {
                if (assignment.offset !== undefined && assignment.offset !== null) {
                    carouselOffset = assignment.offset;
                    debugLog(`    📌 Setting carousel offset to: ${assignment.offset}`);
                }
                debugLog(`    Group has ${group.materials.length} materials:`, group.materials);
                debugLog(`    Available materials in data:`, data.materials.map(m => m.id));
                
                // group.materials is an array of material IDs, need to find actual material objects
                group.materials.forEach(materialId => {
                    const material = data.materials.find(m => m.id === materialId);
                    if (material) {
                        debugLog(`      ✅ Found material: ${material.filename}`);
                        contentItems.push(material);
                    } else {
                        warnLog(`      ❌ Material not found for ID: ${materialId}`);
                    }
                });
            } else if (group && !group.materials) {
                warnLog(`    ⚠️ Group found but has no materials array`);
            }
        }
    });

    debugLog(`📦 Total content items collected: ${contentItems.length}`);
    if (DEBUG_MODE) addDebugInfo(`   └─ 📦 收集到 ${contentItems.length} 個內容項目`);
    if (contentItems.length === 0) {
        debugLog(`⚠️ No content items to display for ${sectionKey}`);
        if (DEBUG_MODE) addDebugInfo(`   └─ ⚠️ 無內容可顯示`);
        return;
    }
    
    // Show content details
    if (DEBUG_MODE) {
        contentItems.forEach((item, idx) => {
            addDebugInfo(`   └─ [${idx}] ${item.type}: ${item.filename?.substring(0, 20)}`);
        });
    }

    // Get container's computed dimensions
    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    const containerWidth = containerRect.width;
    
    debugLog(`📏 Container dimensions: ${containerWidth}x${containerHeight}px`);
    
    // If container has no size yet, retry after a delay
    if (containerHeight === 0 || containerWidth === 0) {
        warnLog(`⚠️ Container #${containerId} has zero dimensions, retrying in 500ms...`);
        setTimeout(() => {
            debugLog(`🔄 Retrying updateSection for ${sectionKey}...`);
            updateSection(sectionKey, data, containerId, slideInterval);
        }, 500);
        return;
    }
    
    debugLog(`✅ Using container dimensions: ${containerWidth}x${containerHeight}px`);
    
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    // Let CSS control the sizing - don't override with fixed px values
    
    const carouselInner = document.createElement('div');
    carouselInner.className = 'carousel-inner';
    
    carouselContainer.appendChild(carouselInner);
    container.appendChild(carouselContainer);
    
    if (DEBUG_MODE) {
        debugLog(`🎨 Carousel container created, checking dimensions...`);
        setTimeout(() => {
            const containerRect = carouselContainer.getBoundingClientRect();
            const innerRect = carouselInner.getBoundingClientRect();
            
            debugLog(`📦 carouselContainer: ${containerRect.width}x${containerRect.height}`);
            debugLog(`📦 carouselInner: ${innerRect.width}x${innerRect.height}`);
            addDebugInfo(`   └─ 📦 輪播容器: ${Math.round(containerRect.width)}x${Math.round(containerRect.height)}px`);
        }, 50);
    }

    contentItems.forEach((item, idx) => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'carousel-item';
        // Let CSS control item sizing
        
        let mediaElement;
        if (item.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = item.url;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            // Let CSS control media sizing
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.url;
            mediaElement.alt = item.filename || 'Image';
            // Let CSS control media sizing
            
            // Debug: check image after load
            if (DEBUG_MODE) {
                mediaElement.addEventListener('load', () => {
                    debugLog(`🖼️ Image loaded [${idx}]:`, {
                        naturalWidth: mediaElement.naturalWidth,
                        naturalHeight: mediaElement.naturalHeight,
                        displayWidth: mediaElement.width,
                        displayHeight: mediaElement.height,
                        url: item.url
                    });
                });
            }
            
            mediaElement.addEventListener('error', (e) => {
                errorLog(`❌ Image failed to load [${idx}]:`, item.url, e);
                if (DEBUG_MODE) addDebugInfo(`   └─ ❌ 圖片載入失敗: ${item.filename}`);
            });
        }
        itemWrapper.appendChild(mediaElement);
        carouselInner.appendChild(itemWrapper);
        debugLog(`✅ Created DOM element [${idx}]: ${item.type} - ${item.url}`);
    });
    
    if (DEBUG_MODE) addDebugInfo(`   └─ ✅ 已創建 ${contentItems.length} 個 DOM 元素`);

    if (contentItems.length > 0 && slideInterval > 0) {
        debugLog(`🎯 Initializing carousel for ${sectionKey} with offset=${carouselOffset}, total items=${contentItems.length}`);
        initializeGenericCarousel(carouselContainer, slideInterval, carouselOffset);
    }
}

// Update all sections based on fetched data
function updateAllSections(data) {
    if (!data) return;
    
    // Clear debug info
    const debugSections = document.getElementById('debug-sections');
    if (debugSections) {
        debugSections.innerHTML = '<strong>區塊處理狀態：</strong><br>';
    }
    
    const { settings } = data;
    const getInterval = (val, def) => (parseInt(val, 10) || def) * 1000;
    const intervals = {
        header: getInterval(settings.header_interval, 5),
        carousel: getInterval(settings.carousel_interval, 6),
        footer: getInterval(settings.footer_interval, 7),
    };

    // 区块与容器的映射关系（支持多种模板）
    const sectionMappings = [
        // 预设布局的区块
        { sectionKey: 'header_video', containerId: 'header-container', interval: intervals.header },
        { sectionKey: 'top_left', containerId: 'slot-top-left', interval: intervals.carousel },
        { sectionKey: 'top_right', containerId: 'slot-top-right', interval: intervals.carousel },
        { sectionKey: 'bottom_left', containerId: 'slot-bottom-left', interval: intervals.carousel },
        { sectionKey: 'bottom_right', containerId: 'slot-bottom-right', interval: intervals.carousel },
        { sectionKey: 'footer_content', containerId: 'footer-container', interval: intervals.footer },
        
        // 双影片布局的额外区块
        { sectionKey: 'header_1_video', containerId: 'header-1-container', interval: intervals.header },
        
        // 保留旧的 section_key 命名（向后兼容）
        { sectionKey: 'carousel_top_left', containerId: 'slot-top-left', interval: intervals.carousel },
        { sectionKey: 'carousel_top_right', containerId: 'slot-top-right', interval: intervals.carousel },
        { sectionKey: 'carousel_bottom_left', containerId: 'slot-bottom-left', interval: intervals.carousel },
        { sectionKey: 'carousel_bottom_right', containerId: 'slot-bottom-right', interval: intervals.carousel },
    ];

    // 只更新页面上实际存在的容器，避免重複處理同一個容器
    const processedContainers = new Set();
    sectionMappings.forEach(mapping => {
        const container = document.getElementById(mapping.containerId);
        if (container && !processedContainers.has(mapping.containerId)) {
            updateSection(mapping.sectionKey, data, mapping.containerId, mapping.interval);
            processedContainers.add(mapping.containerId);
        }
    });
}

// WebSocket initialization
function initializeWebSocket() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    debugLog(`🔌 Connecting to WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        debugLog(`✅ WebSocket connected successfully`);
        debugLog(`📡 Listening for updates to layout: ${currentLayoutName}`);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        debugLog(`📨 WebSocket message received:`, data);
        
        if (data.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'section_updated' || data.type === 'settings_updated') {
            debugLog(`🔔 Update notification: type=${data.type}, layout=${data.layout}, section=${data.section_key}`);
            // Only refresh if the update is for our current layout
            if (data.layout && data.layout === currentLayoutName) {
                debugLog(`✅ Update is for current layout (${currentLayoutName}). Refreshing...`);
                fetchMediaData().then(newData => {
                    if (newData) {
                        currentData = newData; // Update stored data
                        updateAllSections(newData);
                    }
                });
            } else {
                debugLog(`⏭️ Update is for different layout (${data.layout} vs ${currentLayoutName}). Ignoring.`);
            }
        } else if (data.type === 'device_assigned') {
            // Check if this device was reassigned
            if (data.deviceId === currentDeviceId) {
                debugLog(`⚡ This device (${currentDeviceId}) was reassigned to layout: ${data.layoutName}`);
                debugLog(`Current layout: ${currentLayoutName} -> New layout: ${data.layoutName}`);
                
                // If layout changed, fetch new configuration
                if (data.layoutName !== currentLayoutName) {
                    debugLog('🔄 Layout changed! Fetching new configuration...');
                    updateDebugOverlay('Switching layout...');
                    fetchMediaData().then(newData => {
                        if (newData) {
                            currentData = newData; // Update stored data
                            debugLog(`✅ Successfully switched to layout: ${newData.layout}`);
                            updateAllSections(newData);
                            updateDebugOverlay('Active');
                        }
                    });
                } else {
                    debugLog('ℹ️ Layout unchanged, no action needed.');
                }
            }
        }
    };

    socket.onclose = () => {
        warnLog('WebSocket closed. Reconnecting in 5 seconds...');
        setTimeout(initializeWebSocket, 5000);
    };

    socket.onerror = (error) => {
        errorLog('WebSocket error:', error);
        socket.close();
    };
}

// Update debug overlay
function updateDebugOverlay(status) {
    const deviceIdEl = document.getElementById('debug-device-id');
    const layoutEl = document.getElementById('debug-layout');
    const statusEl = document.getElementById('debug-status');
    
    if (deviceIdEl) deviceIdEl.textContent = currentDeviceId || 'Unknown';
    if (layoutEl) layoutEl.textContent = currentLayoutName || 'Loading...';
    if (statusEl) statusEl.textContent = status || 'Active';
}

// Create a debug info overlay (only visible in console or can be toggled)
function showDebugInfo() {
    debugLog('═══════════════════════════════════════');
    debugLog('📺 MQ CMS Player - Debug Info');
    debugLog('═══════════════════════════════════════');
    debugLog(`🆔 Device ID: ${currentDeviceId}`);
    debugLog(`📋 Current Layout: ${currentLayoutName || 'Loading...'}`);
    debugLog(`🌐 WebSocket: ${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    debugLog('═══════════════════════════════════════');
    debugLog('💡 Tip: Press Ctrl+Shift+D to toggle debug mode, Ctrl+D to toggle debug overlay');
    updateDebugOverlay('Active');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Toggle debug mode with Ctrl+Shift+D (or Cmd+Shift+D on Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        DEBUG_MODE = !DEBUG_MODE;
        console.log(`🐞 Debug mode ${DEBUG_MODE ? 'ENABLED' : 'DISABLED'}`);
        console.log('Tip: Refresh the page to see changes');
    }
    
    // Toggle debug overlay with Ctrl+D (or Cmd+D on Mac)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
        e.preventDefault();
        const overlay = document.getElementById('debug-overlay');
        if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
            console.log(`Debug overlay ${overlay.style.display === 'block' ? 'shown' : 'hidden'}`);
        }
    }
    
    // Force reload with Ctrl+R (or Cmd+R on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        console.log('🔄 Force reloading...');
        window.location.reload(true);
    }
    
    // Check version with Ctrl+V (or Cmd+V on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        console.log('🔍 Checking for updates...');
        checkVersion();
    }
});

// Manual version check function
async function checkVersion() {
    try {
        const response = await fetch('/js/animation.js?' + Date.now());
        const text = await response.text();
        const versionMatch = text.match(/const PLAYER_VERSION = '([^']+)'/);
        
        if (versionMatch && versionMatch[1]) {
            const serverVersion = versionMatch[1];
            console.log(`📌 Current version: ${PLAYER_VERSION}`);
            console.log(`📡 Server version: ${serverVersion}`);
            
            if (serverVersion !== PLAYER_VERSION) {
                console.warn(`⚠️ Version mismatch! Reloading in 3 seconds...`);
                setTimeout(() => window.location.reload(true), 3000);
            } else {
                console.log(`✅ Up to date!`);
            }
        }
    } catch (error) {
        errorLog('❌ Version check failed:', error);
    }
}

// Store current data for resize handling
let currentData = null;

// Version check - periodically check for updates and reload if needed
function startVersionCheck() {
    debugLog(`📌 Current player version: ${PLAYER_VERSION}`);
    
    // Check version every 5 minutes
    setInterval(async () => {
        try {
            // Fetch the animation.js file to check version
            const response = await fetch('/js/animation.js?' + Date.now());
            const text = await response.text();
            
            // Extract version from the fetched file
            const versionMatch = text.match(/const PLAYER_VERSION = '([^']+)'/);
            if (versionMatch && versionMatch[1]) {
                const serverVersion = versionMatch[1];
                if (serverVersion !== PLAYER_VERSION) {
                    console.warn(`🔄 New version detected: ${serverVersion} (current: ${PLAYER_VERSION})`);
                    console.log('⚡ Reloading player in 3 seconds...');
                    setTimeout(() => {
                        window.location.reload(true); // Force reload from server
                    }, 3000);
                } else {
                    debugLog(`✅ Version check: up to date (${PLAYER_VERSION})`);
                }
            }
        } catch (error) {
            errorLog('❌ Version check failed:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Handle window resize for responsive layout
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        debugLog('🔄 Window resized, re-rendering content...');
        if (currentData) {
            updateAllSections(currentData);
        }
    }, 300); // Debounce resize events
});

// Initialize player
function initializePlayer() {
    // Check for debug mode from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
        DEBUG_MODE = true;
        console.log('🐞 Debug mode enabled via URL parameter');
    }
    
    debugLog('🚀 Initializing MQ CMS Player...');
    currentDeviceId = getDeviceId();
    if (currentDeviceId) {
        debugLog(`✅ Device ID obtained: ${currentDeviceId}`);
        fetchMediaData().then(data => {
            if (data) {
                currentData = data; // Store for resize handling
                updateAllSections(data);
                showDebugInfo();
            }
        });
        initializeWebSocket();
        startVersionCheck(); // Start periodic version checking
    } else {
        errorLog('❌ Failed to get device ID!');
    }
}

// Main initialization - use both DOMContentLoaded and load events for safety
document.addEventListener("DOMContentLoaded", () => {
    debugLog('📄 DOM Content Loaded');
});

// Wait for window.load to ensure all containers are properly sized
window.addEventListener('load', () => {
    debugLog('🎬 Window fully loaded, starting player...');
    // Add small delay to ensure rendering is complete
    setTimeout(initializePlayer, 100);
});