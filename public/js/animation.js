const SERVER_BASE_URL = window.location.origin; // 自动使用当前页面的协议和主机

// 全局設定的預設值，如果從後端獲取失敗則使用這些
const DEFAULT_INTERVALS = {
  header_interval: 5000,   // 頁首預設 5 秒
  carousel_interval: 6000, // 中間輪播預設 6 秒
  footer_interval: 7000    // 頁尾預設 7 秒
};

// 輔助函數：初始化通用輪播動畫
function initializeGenericCarousel(containerElement, slideInterval, startOffset = 0) {
  if (!containerElement) {
    console.warn("initializeGenericCarousel: 傳入的容器元素為 null");
    return;
  }
  const inner = containerElement.querySelector(".carousel-inner");
  if (!inner) {
    // console.warn(`initializeGenericCarousel: 在容器 ${containerElement.id || '未命名容器'} 中找不到 .carousel-inner`);
    return;
  }
  const items = inner.querySelectorAll(".carousel-item");

  if (containerElement.slideTimer) {
    clearInterval(containerElement.slideTimer);
    containerElement.slideTimer = null;
  }

  if (items.length <= 1) {
    inner.style.transition = "none";
    inner.style.transform = "translateX(0)";
    inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove());
    // 如果只有一個影片，確保它播放
    if (items.length === 1) {
        const singleVideo = items[0].querySelector('video');
        if (singleVideo) {
            singleVideo.play().catch(e => {
                if (e.name !== 'AbortError') { // AbortError 通常是瀏覽器因用戶未互動而阻止自動播放
                    console.warn(`單一影片 ${singleVideo.src} 自動播放失敗:`, e.name, e.message);
                }
            });
        }
    }
    return;
  }

  inner.style.transition = "none";
  
  // 計算起始索引，確保不超出範圍
  let currentIndex = Math.min(startOffset, items.length - 1);
  if (currentIndex < 0) currentIndex = 0;
  
  // 設定初始位置
  inner.style.transform = `translateX(-${currentIndex * 100}%)`;
  
  console.log(`輪播初始化：總共 ${items.length} 個項目，從第 ${currentIndex + 1} 個開始 (偏移量: ${startOffset})`);
  
  inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove());

  const firstClone = items[0].cloneNode(true);
  firstClone.classList.add('cloned-item');
  inner.appendChild(firstClone);
  
  // 確保複製後的項目也能正確顯示，特別是影片
  const clonedVideo = firstClone.querySelector('video');
  if (clonedVideo) {
    clonedVideo.muted = true; // 複製的影片也應靜音
    clonedVideo.playsInline = true;
    // clonedVideo.play().catch(e => console.warn("Cloned video play failed:", e)); // 通常不需要複製的影片自動播放
  }


  let isResetting = false;

  const slide = () => {
    if (isResetting) return;
    currentIndex++;
    inner.style.transition = "transform 0.5s ease";
    inner.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (currentIndex === items.length) {
      isResetting = true;
      setTimeout(() => {
        inner.style.transition = "none";
        inner.style.transform = "translateX(0)";
        currentIndex = 0;
        isResetting = false;
      }, 500);
    }
  };
  containerElement.slideTimer = setInterval(slide, slideInterval);
}

// 更新所有區塊
function updateAllSections(data, verbose = false) {
  const { assignments, materials, groups, settings, available_sections } = data;

  const countItemsInSection = (sectionKey) => {
    let count = 0;
    const sectionAssignments = assignments.filter(a => a.section_key === sectionKey);
    sectionAssignments.forEach(assignment => {
      if (assignment.content_type === 'single_media') {
        if (materials.some(m => m.id === assignment.content_id)) count++;
      } else if (assignment.content_type === 'group_reference') {
        const group = groups.find(g => g.id === assignment.content_id);
        if (group && group.materials && group.materials.length > 0) count += group.materials.length;
      }
    });
    return count;
  };

  const getInterval = (value, defaultValue) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed * 1000;
  };

  const currentIntervals = {
    header_interval: getInterval(settings.header_interval, DEFAULT_INTERVALS.header_interval),
    carousel_interval: getInterval(settings.carousel_interval, DEFAULT_INTERVALS.carousel_interval),
    footer_interval: getInterval(settings.footer_interval, DEFAULT_INTERVALS.footer_interval)
  };
  
  if (verbose) {
    console.log("當前使用的輪播間隔 (毫秒):", currentIntervals);
  }

  // 1. 先更新所有區塊的內容
  updateSection('header_video', data, 'header-container', currentIntervals.header_interval, verbose);
  updateSection('carousel_top_left', data, 'slot-top-left', currentIntervals.carousel_interval, verbose);
  updateSection('carousel_top_right', data, 'slot-top-right', currentIntervals.carousel_interval, verbose);
  updateSection('carousel_bottom_left', data, 'slot-bottom-left', currentIntervals.carousel_interval, verbose);
  updateSection('carousel_bottom_right', data, 'slot-bottom-right', currentIntervals.carousel_interval, verbose);
  updateSection('footer_content', data, 'footer-container', currentIntervals.footer_interval, verbose);

  // 2. 內容都放好後，執行最終版的版面判斷邏輯
  // =================================================================
  const topLeftItemCount = countItemsInSection('carousel_top_left');
  const topRightItemCount = countItemsInSection('carousel_top_right');
  
  const topLeftSlot = document.getElementById('slot-top-left');
  const topRightSlot = document.getElementById('slot-top-right');

  if (topLeftSlot && topRightSlot) {
      if (topLeftItemCount > 0 && topRightItemCount === 0) {
          console.log("版面規則觸發：[最終相容模式] 切換為全寬版面。");
          topRightSlot.style.display = 'none';
          topLeftSlot.style.flex = 'none';
          topLeftSlot.style.width = '100%';
      } else {
          console.log("版面規則：[最終相容模式] 套用預設的左右兩格版面。");
          topRightSlot.style.display = 'block'; // 【修改點】明確設為 block (div 的預設)
          topLeftSlot.style.flex = '1 1 0%';    // 【修改點】明確還原 flex-1 的完整寫法
          topLeftSlot.style.width = '';         // 讓 flex 重新接管寬度
      }
  }
  // =================================================================
}

// 獲取媒體數據和設定
async function fetchMediaData() {
  try {
    // 獲取完整的媒體資料包含指派、素材、群組和設定
    const response = await fetch(`${SERVER_BASE_URL}/api/media_with_settings`);
    if (!response.ok) {
      throw new Error(`獲取媒體資料失敗: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('成功獲取完整媒體資料:', data);
    
    return data;
  } catch (error) {
    console.error('fetchMediaData 錯誤:', error);
    return {
      assignments: [],
      materials: [],
      groups: [],
      settings: DEFAULT_INTERVALS,
      available_sections: {}
    };
  }
}

function getFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi'];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'unknown';
}

// 核心渲染函式：更新指定區塊
function updateSection(sectionKey, data, containerId, slideInterval, verbose = false) {
  try {
    const { assignments, materials, groups } = data;
    
    // 根據 containerId 找到最外層的容器元素 (e.g., div#slot-top-left)
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.warn(`找不到容器元素: ${containerId}`);
      return;
    }
    
    // 清空容器並停止舊的計時器
    // 我們直接在最外層容器上附加計時器，方便管理
    if (container.slideTimer) {
      clearInterval(container.slideTimer);
      container.slideTimer = null;
    }
    container.innerHTML = '';
    
    // 篩選出對應這個區塊的指派
    const sectionAssignments = assignments.filter(assignment => assignment.section_key === sectionKey);
    
    if (sectionAssignments.length === 0) {
      if (verbose) console.log(`區塊 ${sectionKey} 沒有有效的內容。`);
      return;
    }
    
    // 準備內容陣列
    const contentItems = [];
    let carouselOffset = 0;
    
    sectionAssignments.forEach(assignment => {
      if (assignment.content_type === 'single_media') {
        const material = materials.find(m => m.id === assignment.content_id);
        if (material) contentItems.push(material);
      } else if (assignment.content_type === 'group_reference') {
        const group = groups.find(g => g.id === assignment.content_id);
        if (group && group.materials) {
          if (assignment.offset !== undefined && assignment.offset > 0) {
            carouselOffset = assignment.offset;
          }
          contentItems.push(...group.materials);
        }
      }
    });
    
    if (contentItems.length === 0) {
      if (verbose) console.log(`區塊 ${sectionKey} 沒有有效的內容。`);
      return;
    }
    
    // **【核心修改】**
    // 無論是哪個區塊，都在其內部創建統一的輪播結構
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    
    const carouselInner = document.createElement('div');
    carouselInner.className = 'carousel-inner';
    
    carouselContainer.appendChild(carouselInner);
    container.appendChild(carouselContainer);
    
    // 生成媒體元素並放入 carousel-inner
    contentItems.forEach(item => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'carousel-item';
      
      let mediaElement;
      if (item.type === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = item.url;
        mediaElement.autoplay = true;
        mediaElement.loop = true;
        mediaElement.muted = true;
        mediaElement.playsInline = true;
      } else { // 預設為 image
        mediaElement = document.createElement('img');
        mediaElement.src = item.url;
        mediaElement.alt = item.filename || '圖片';
      }
      
      itemWrapper.appendChild(mediaElement);
      carouselInner.appendChild(itemWrapper);
    });
    
    // 初始化輪播
    // 現在我們直接將新創建的 carouselContainer 傳遞給初始化函式
    if (contentItems.length > 0 && slideInterval > 0) {
      initializeGenericCarousel(carouselContainer, slideInterval, carouselOffset);
      if (verbose) {
        console.log(`區塊 ${sectionKey} 已啟用輪播，間隔 ${slideInterval / 1000} 秒，項目數: ${contentItems.length}，偏移量: ${carouselOffset}`);
      }
    }
    
  } catch (error) {
    console.error(`更新區塊 ${sectionKey} 時發生錯誤:`, error);
  }
}

// WebSocket 相關變數
let currentSocket = null;
let lastHeartbeatTime = 0;
let heartbeatCheckTimer = null;
const HEARTBEAT_TIMEOUT = 65000; // 65秒，略長於兩個ping週期(30秒*2)
const RECONNECT_DELAY = 5000; // 5秒重連延遲

// 樹莓派特殊處理標記
const isRaspberryPi = /arm|aarch64/i.test(navigator.platform) || 
                     /raspberry/i.test(navigator.userAgent) ||
                     /linux.*arm/i.test(navigator.userAgent);

// 設定更新計數器（用於樹莓派調試）
let settingsUpdateCount = 0;

// WebSocket 初始化
function initializeWebSocket() {
  try {
    // 清理舊的連接和計時器
    if (currentSocket) {
      currentSocket.close();
      currentSocket = null;
    }
    if (heartbeatCheckTimer) {
      clearTimeout(heartbeatCheckTimer);
      heartbeatCheckTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('🔌 正在連接 WebSocket:', wsUrl);
    
    currentSocket = new WebSocket(wsUrl);
    
    currentSocket.onopen = () => {
      console.log('✅ WebSocket 連接成功');
      lastHeartbeatTime = Date.now();
      startHeartbeatCheck();
    };
    
    // 在檔案適當位置定義 debounce（若無，可添加）
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 修改 onmessage
    currentSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 收到 WebSocket 訊息:', data);
            
            lastHeartbeatTime = Date.now();
            
            if (data.type === 'ping') {
                console.log('🏓 收到伺服器ping，回應pong');
                if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
                    currentSocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                }
            } else if (data.type === 'section_updated' || data.type === 'playlist_updated' || data.type === 'media_updated' || data.type === 'settings_updated') {
                // 【最終修正】這裡就是唯一的判斷式，處理所有更新類型
                debouncedUpdate(data.type);
            } else if (data.content) {
                console.log('📢 收到廣播訊息:', data.content);
            }
        } catch (error) {
            console.error('❌ WebSocket 訊息解析失敗:', error);
        }
    };
    
    // 定義 debouncedUpdate，根據類型處理
    let lastUpdateType = '';
    let recentSectionUpdates = new Set();
    
    const debouncedUpdate = debounce((updateType) => {
        // 如果最近有精細化區塊更新，跳過某些全域更新以避免重複
        if ((updateType === 'playlist_updated' || updateType === 'media_updated') && recentSectionUpdates.size > 0) {
            console.log(`⏭️ 跳過全域更新 ${updateType}，因為剛完成精細化區塊更新`);
            recentSectionUpdates.clear();
            return;
        }
        
        console.log(`🔄 合併更新: ${updateType}`);
        if (updateType === 'settings_updated') {
            settingsUpdateCount++;
            console.log(`⚙️ 設定更新 #${settingsUpdateCount}`);
            if (isRaspberryPi) {
                const timestamp = Date.now();
                const apiUrl = `/api/media_with_settings?t=${timestamp}&rpi=1`;
                fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        console.log('🔄 樹莓派專用：強制重新載入數據完成', data);
                        updateAllSections(data, true); // 傳遞 verbose 參數
                    })
                    .catch(error => {
                        console.error('🍓 樹莓派設定更新失敗:', error);
                        fetchMediaData().then(data => updateAllSections(data, true));
                    });
            } else {
                fetchMediaData().then(data => {
                    console.log('🔄 因設定更新而重新載入的數據:', data);
                    updateAllSections(data, true); // 傳遞 verbose 參數
                });
            }
        } else {
            fetchMediaData().then(data => updateAllSections(data, true)); // 傳遞 verbose 參數
        }
        lastUpdateType = updateType;
    }, 1500);
    
    // 處理精細化區塊更新的函數
    function handleSectionUpdate(data) {
        const { section_key, action, content_type, content_id } = data;
        console.log(`🎯 收到區塊更新通知: ${section_key} - ${action}`);
        
        // 記錄最近的精細化更新，用於防止重複的全域更新
        recentSectionUpdates.add(section_key);
        
        // 使用防抖動機制來避免短時間內多次更新
        if (!window.sectionUpdateTimeouts) {
            window.sectionUpdateTimeouts = {};
        }
        
        // 清除之前的計時器
        if (window.sectionUpdateTimeouts[section_key]) {
            clearTimeout(window.sectionUpdateTimeouts[section_key]);
        }
        
        // 設置新的計時器，300ms 後執行更新
        window.sectionUpdateTimeouts[section_key] = setTimeout(() => {
            updateSpecificSection(section_key);
            delete window.sectionUpdateTimeouts[section_key];
        }, 300);
    }
    
    // 更新特定區塊的函數
    async function updateSpecificSection(sectionKey) {
        try {
            console.log(`🔄 開始更新區塊: ${sectionKey}`);
            
            // 獲取最新數據
            const data = await fetchMediaData();
            if (!data) {
                console.warn('無法獲取媒體數據，跳過區塊更新');
                return;
            }
            
            // 【核心修正】將這裡的 containerId 更新為新的 ID
            const sectionConfig = {
                'header_video': {
                    containerId: 'header-container', 
                    interval: (data.settings.header_interval || 5) * 1000
                },
                'carousel_top_left': {
                    containerId: 'slot-top-left', 
                    interval: (data.settings.carousel_interval || 6) * 1000
                },
                'carousel_top_right': {
                    containerId: 'slot-top-right',
                    interval: (data.settings.carousel_interval || 6) * 1000
                },
                'carousel_bottom_left': {
                    containerId: 'slot-bottom-left',
                    interval: (data.settings.carousel_interval || 6) * 1000
                },
                'carousel_bottom_right': {
                    containerId: 'slot-bottom-right',
                    interval: (data.settings.carousel_interval || 6) * 1000
                },
                'footer_content': {
                    containerId: 'footer-container',
                    interval: (data.settings.footer_interval || 7) * 1000
                }
            };
            
            const config = sectionConfig[sectionKey];
            if (!config) {
                console.warn(`未知的區塊鍵: ${sectionKey}`);
                return;
            }
            
            // 更新指定區塊（精細化更新，不顯示詳細日誌）
            updateSection(sectionKey, data, config.containerId, config.interval, false);
            console.log(`✅ 成功更新區塊: ${sectionKey}`);
            
        } catch (error) {
            console.error(`❌ 更新區塊 ${sectionKey} 時發生錯誤:`, error);
        }
    }
    
    currentSocket.onclose = (event) => {
      console.log('❌ WebSocket 連接關閉，代碼:', event.code, '原因:', event.reason);
      currentSocket = null;
      
      // 停止心跳檢查
      if (heartbeatCheckTimer) {
        clearTimeout(heartbeatCheckTimer);
        heartbeatCheckTimer = null;
      }
      
      // 延遲重新連接
      console.log(`⏰ ${RECONNECT_DELAY/1000}秒後重新連接...`);
      setTimeout(initializeWebSocket, RECONNECT_DELAY);
    };
    
    currentSocket.onerror = (error) => {
      console.error('❌ WebSocket 錯誤:', error);
    };
    
  } catch (error) {
    console.error('WebSocket 初始化失敗:', error);
    // 如果初始化失敗，也要重試
    setTimeout(initializeWebSocket, RECONNECT_DELAY);
  }
}

// 開始心跳檢查
function startHeartbeatCheck() {
  // 清理舊的計時器
  if (heartbeatCheckTimer) {
    clearTimeout(heartbeatCheckTimer);
  }
  
  heartbeatCheckTimer = setTimeout(() => {
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;
    
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.warn(`⚠️ 心跳超時 (${timeSinceLastHeartbeat}ms > ${HEARTBEAT_TIMEOUT}ms)，主動重連`);
      
      // 主動關閉連接並重新連接
      if (currentSocket) {
        currentSocket.close(1000, 'Heartbeat timeout');
      } else {
        // 如果socket已經不存在，直接重連
        initializeWebSocket();
      }
    } else {
      // 繼續下一次檢查
      startHeartbeatCheck();
    }
  }, HEARTBEAT_TIMEOUT);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log('🎬 頁面載入完成，開始初始化...');
  
  fetchMediaData().then(data => updateAllSections(data, true));
  initializeWebSocket();
  
  // 樹莓派特殊處理：防止瀏覽器進入休眠狀態
  if (isRaspberryPi) {
    console.log('🍓 樹莓派環境：啟用防休眠機制');
    
    // 監聽頁面可見性變化
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ 頁面變為可見，檢查 WebSocket 連接...');
        if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
          console.log('🔄 重新連接 WebSocket...');
          initializeWebSocket();
        }
      } else {
        console.log('😴 頁面變為隱藏');
      }
    });
    
    // 防止樹莓派瀏覽器休眠的機制
    setInterval(() => {
      // 每5分鐘檢查一次連接狀態
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        console.log('🔄 樹莓派防休眠：重新連接 WebSocket...');
        initializeWebSocket();
      } else {
        console.log('💓 樹莓派防休眠：連接正常');
      }
      
      // 輕微的 DOM 操作保持頁面活躍
      document.body.style.opacity = '0.9999';
      setTimeout(() => {
        document.body.style.opacity = '1';
      }, 100);
    }, 300000); // 5分鐘
    
    // 監聽焦點事件
    window.addEventListener('focus', () => {
      console.log('🎯 樹莓派頁面重新獲得焦點');
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        initializeWebSocket();
      }
    });
    
    // 監聽滑鼠移動（如果有滑鼠的話）
    let lastActivity = Date.now();
    document.addEventListener('mousemove', () => {
      lastActivity = Date.now();
    });
    
    // 檢查長時間無活動的情況
    setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      if (timeSinceActivity > 1800000) { // 30分鐘無活動
        console.log('⚠️ 樹莓派長時間無活動，刷新連接...');
        if (currentSocket) {
          currentSocket.close();
          setTimeout(initializeWebSocket, 1000);
        }
        lastActivity = Date.now();
      }
    }, 600000); // 每10分鐘檢查一次
  }
});