#!/bin/bash

# =============================================================================
# 樹莓派 Kiosk 模式啟動腳本 (防休眠版本)
# 用於 MQ CMS 顯示頁面的全螢幕展示
# =============================================================================

echo "🍓 啟動樹莓派 Kiosk 模式..."

# -----------------------------------------------------------------------------
# 系統層面的防休眠設定
# -----------------------------------------------------------------------------

echo "⚙️ 設定系統防休眠..."

# 防止螢幕保護程式啟動
xset s off

# 關閉 DPMS (Display Power Management Signaling) 省電模式
xset -dpms

# 防止螢幕變黑
xset s noblank

# 設定螢幕永不關閉 (可選，如果上面的設定不夠)
# xset s 0 0

echo "✅ 系統防休眠設定完成"

# -----------------------------------------------------------------------------
# 等待網路連接 (確保能訪問網站)
# -----------------------------------------------------------------------------

echo "🌐 檢查網路連接..."

# 等待網路可用 (最多等待 30 秒)
for i in {1..30}; do
    if ping -c 1 google.com &> /dev/null; then
        echo "✅ 網路連接正常"
        break
    else
        echo "⏳ 等待網路連接... ($i/30)"
        sleep 1
    fi
done

# -----------------------------------------------------------------------------
# 啟動 Chromium 瀏覽器 (防休眠版本)
# -----------------------------------------------------------------------------

echo "🚀 啟動 Chromium 瀏覽器..."

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --disable-background-networking \
  --disable-background-media-suspend \
  --disable-low-res-tiling \
  --disable-default-apps \
  --disable-extensions \
  --disable-plugins \
  --disable-sync \
  --disable-translate \
  --no-first-run \
  --no-default-browser-check \
  --no-sandbox \
  --disable-dev-shm-usage \
  --memory-pressure-off \
  --max_old_space_size=4096 \
  --incognito \
  --autoplay-policy=no-user-gesture-required \
  --disable-web-security \
  --disable-features=VizDisplayCompositor \
  --start-maximized \
  https://mq-cms.adler-lei.workers.dev/display

# -----------------------------------------------------------------------------
# 腳本結束
# -----------------------------------------------------------------------------

echo "🏁 Kiosk 模式腳本執行完成"

# =============================================================================
# 參數說明：
# 
# 基本 Kiosk 參數：
# --kiosk                              全螢幕模式
# --noerrdialogs                       不顯示錯誤對話框
# --disable-infobars                   不顯示資訊欄
# --disable-session-crashed-bubble     不顯示崩潰提示
# --incognito                          無痕模式
# 
# 防休眠核心參數：
# --disable-background-timer-throttling    防止背景計時器被限制 (最重要!)
# --disable-backgrounding-occluded-windows 防止窗口被認為是背景
# --disable-renderer-backgrounding         防止渲染器進入背景模式
# --disable-background-media-suspend       防止媒體播放被暫停
# --memory-pressure-off                    關閉記憶體壓力管理
# 
# 性能優化參數：
# --no-sandbox                         關閉沙盒模式 (提升性能)
# --disable-dev-shm-usage             減少共享記憶體使用
# --max_old_space_size=4096           設定 JavaScript 記憶體限制
# --disable-web-security              關閉網頁安全限制
# 
# 媒體播放參數：
# --autoplay-policy=no-user-gesture-required  允許自動播放媒體
# 
# 其他優化參數：
# --disable-features=TranslateUI       關閉翻譯功能
# --disable-ipc-flooding-protection    關閉 IPC 洪水保護
# --disable-background-networking      關閉背景網路活動
# --disable-low-res-tiling            關閉低解析度瓦片
# --disable-default-apps              關閉預設應用
# --disable-extensions                關閉擴充功能
# --disable-plugins                   關閉插件
# --disable-sync                      關閉同步
# --disable-translate                 關閉翻譯
# --no-first-run                      跳過首次運行設定
# --no-default-browser-check          不檢查預設瀏覽器
# =============================================================================