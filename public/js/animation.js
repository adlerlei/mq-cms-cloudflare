// Global settings defaults
const DEFAULT_INTERVALS = {
  header_interval: 5000,
  carousel_interval: 6000,
  footer_interval: 7000,
};

// Globals for device and layout info
let currentDeviceId = null;
let currentLayoutName = null;

// Get deviceId from URL, show error if not present
function getDeviceId() {
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('deviceId');
    if (!deviceId) {
        console.error("No deviceId provided in URL!");
        document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; padding: 50px;">Error: Missing deviceId parameter in URL.</div>';
    }
    return deviceId;
}

// Fetch layout-specific data for the current device
async function fetchMediaData() {
  if (!currentDeviceId) {
    console.error("Cannot fetch data: deviceId is not set.");
    return null;
  }
  try {
    const apiUrl = `/api/config?deviceId=${currentDeviceId}&t=${Date.now()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Successfully fetched config for device ${currentDeviceId}:`, data);
    console.log(`📊 Data summary:`, {
      materials: data.materials?.length || 0,
      assignments: data.assignments?.length || 0,
      groups: data.groups?.length || 0,
      settings: data.settings
    });
    currentLayoutName = data.layout; // Store the current layout name
    return data;
  } catch (error) {
    console.error('fetchMediaData error:', error);
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
    if (!container) return;

    if (container.slideTimer) clearInterval(container.slideTimer);
    container.innerHTML = '';

    const sectionAssignments = data.assignments.filter(a => a.section_key === sectionKey);
    console.log(`📍 Section ${sectionKey}: found ${sectionAssignments.length} assignments`);
    
    if (sectionAssignments.length === 0) return;

    const contentItems = [];
    let carouselOffset = 0;
    sectionAssignments.forEach(assignment => {
        console.log(`  Processing assignment: type=${assignment.content_type}, content_id=${assignment.content_id}`);
        
        if (assignment.content_type === 'single_media') {
            const material = data.materials.find(m => m.id === assignment.content_id);
            if (material) {
                console.log(`    ✅ Found single media: ${material.filename}`);
                contentItems.push(material);
            } else {
                console.warn(`    ❌ Material not found: ${assignment.content_id}`);
            }
        } else if (assignment.content_type === 'group_reference') {
            const group = data.groups.find(g => g.id === assignment.content_id);
            console.log(`    Looking for group: ${assignment.content_id}`, group ? `Found: ${group.name}` : 'NOT FOUND');
            
            if (group && group.materials) {
                if (assignment.offset > 0) carouselOffset = assignment.offset;
                console.log(`    Group has ${group.materials.length} materials:`, group.materials);
                console.log(`    Available materials in data:`, data.materials.map(m => m.id));
                
                // group.materials is an array of material IDs, need to find actual material objects
                group.materials.forEach(materialId => {
                    const material = data.materials.find(m => m.id === materialId);
                    if (material) {
                        console.log(`      ✅ Found material: ${material.filename}`);
                        contentItems.push(material);
                    } else {
                        console.warn(`      ❌ Material not found for ID: ${materialId}`);
                    }
                });
            } else if (group && !group.materials) {
                console.warn(`    ⚠️ Group found but has no materials array`);
            }
        }
    });

    console.log(`📦 Total content items collected: ${contentItems.length}`);
    if (contentItems.length === 0) {
        console.warn(`⚠️ No content items to display for ${sectionKey}`);
        return;
    }

    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    const carouselInner = document.createElement('div');
    carouselInner.className = 'carousel-inner';
    carouselContainer.appendChild(carouselInner);
    container.appendChild(carouselContainer);

    contentItems.forEach(item => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'carousel-item';
        let mediaElement;
        if (item.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = item.url;
            mediaElement.muted = true;
            mediaElement.playsInline = true;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.url;
            mediaElement.alt = item.filename || 'Image';
        }
        itemWrapper.appendChild(mediaElement);
        carouselInner.appendChild(itemWrapper);
    });

    if (contentItems.length > 0 && slideInterval > 0) {
        initializeGenericCarousel(carouselContainer, slideInterval, carouselOffset);
    }
}

// Update all sections based on fetched data
function updateAllSections(data) {
    if (!data) return;
    const { settings } = data;
    const getInterval = (val, def) => (parseInt(val, 10) || def) * 1000;
    const intervals = {
        header: getInterval(settings.header_interval, 5),
        carousel: getInterval(settings.carousel_interval, 6),
        footer: getInterval(settings.footer_interval, 7),
    };

    updateSection('header_video', data, 'header-container', intervals.header);
    updateSection('carousel_top_left', data, 'slot-top-left', intervals.carousel);
    updateSection('carousel_top_right', data, 'slot-top-right', intervals.carousel);
    updateSection('carousel_bottom_left', data, 'slot-bottom-left', intervals.carousel);
    updateSection('carousel_bottom_right', data, 'slot-bottom-right', intervals.carousel);
    updateSection('footer_content', data, 'footer-container', intervals.footer);
}

// WebSocket initialization
function initializeWebSocket() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log(`✅ WebSocket connected successfully`);
        console.log(`📡 Listening for updates to layout: ${currentLayoutName}`);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`📨 WebSocket message received:`, data);
        
        if (data.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'section_updated' || data.type === 'settings_updated') {
            console.log(`🔔 Update notification: type=${data.type}, layout=${data.layout}, section=${data.section_key}`);
            // Only refresh if the update is for our current layout
            if (data.layout && data.layout === currentLayoutName) {
                console.log(`✅ Update is for current layout (${currentLayoutName}). Refreshing...`);
                fetchMediaData().then(updateAllSections);
            } else {
                console.log(`⏭️ Update is for different layout (${data.layout} vs ${currentLayoutName}). Ignoring.`);
            }
        } else if (data.type === 'device_assigned') {
            // Check if this device was reassigned
            if (data.deviceId === currentDeviceId) {
                console.log(`⚡ This device (${currentDeviceId}) was reassigned to layout: ${data.layoutName}`);
                console.log(`Current layout: ${currentLayoutName} -> New layout: ${data.layoutName}`);
                
                // If layout changed, fetch new configuration
                if (data.layoutName !== currentLayoutName) {
                    console.log('🔄 Layout changed! Fetching new configuration...');
                    updateDebugOverlay('Switching layout...');
                    fetchMediaData().then(newData => {
                        if (newData) {
                            console.log(`✅ Successfully switched to layout: ${newData.layout}`);
                            updateAllSections(newData);
                            updateDebugOverlay('Active');
                        }
                    });
                } else {
                    console.log('ℹ️ Layout unchanged, no action needed.');
                }
            }
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
    console.log('═══════════════════════════════════════');
    console.log('📺 MQ CMS Player - Debug Info');
    console.log('═══════════════════════════════════════');
    console.log(`🆔 Device ID: ${currentDeviceId}`);
    console.log(`📋 Current Layout: ${currentLayoutName || 'Loading...'}`);
    console.log(`🌐 WebSocket: ${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    console.log('═══════════════════════════════════════');
    console.log('💡 Tip: Press Ctrl+D (or Cmd+D on Mac) to toggle debug overlay');
    updateDebugOverlay('Active');
}

// Toggle debug overlay with Ctrl+D (or Cmd+D on Mac)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const overlay = document.getElementById('debug-overlay');
        if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
            console.log(`Debug overlay ${overlay.style.display === 'block' ? 'shown' : 'hidden'}`);
        }
    }
});

// Main initialization on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    console.log('🚀 Page loaded, initializing MQ CMS Player...');
    currentDeviceId = getDeviceId();
    if (currentDeviceId) {
        console.log(`✅ Device ID obtained: ${currentDeviceId}`);
        fetchMediaData().then(data => {
            if (data) {
                updateAllSections(data);
                showDebugInfo();
            }
        });
        initializeWebSocket();
    } else {
        console.error('❌ Failed to get device ID!');
    }
});