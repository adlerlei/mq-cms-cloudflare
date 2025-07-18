#!/bin/bash

# =============================================================================
# 樹莓派 Kiosk 模式啟動腳本 (改進版 - 減少錯誤訊息)
# 用於 MQ CMS 顯示頁面的全螢幕展示
# =============================================================================

echo "🍓 啟動樹莓派 Kiosk 模式..."

# -----------------------------------------------------------------------------
# 系統層面的防休眠設定
# -----------------------------------------------------------------------------

echo "⚙️ 設定系統防休眠..."

# 檢查是否有 DISPLAY 環境變數，如果沒有則設定
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
    echo "📺 設定 DISPLAY=:0"
fi

# 防止螢幕保護程式啟動 (忽略錯誤訊息)
xset s off 2>/dev/null || echo "⚠️ xset s off 失敗 (可能正常)"

# 關閉 DPMS (Display Power Management Signaling) 省電模式
xset -dpms 2>/dev/null || echo "⚠️ xset -dpms 失敗 (可能正常)"

# 防止螢幕變黑
xset s noblank 2>/dev/null || echo "⚠️ xset s noblank 失敗 (可能正常)"

echo "✅ 系統防休眠設定完成"

# -----------------------------------------------------------------------------
# 等待網路連接 (確保能訪問網站)
# -----------------------------------------------------------------------------

echo "🌐 檢查網路連接..."

# 等待網路可用 (最多等待 30 秒)
for i in {1..30}; do
    if ping -c 1 8.8.8.8 &> /dev/null; then
        echo "✅ 網路連接正常"
        break
    else
        echo "⏳ 等待網路連接... ($i/30)"
        sleep 1
    fi
done

# -----------------------------------------------------------------------------
# 創建專用的用戶資料目錄 (減少錯誤訊息)
# -----------------------------------------------------------------------------

USER_DATA_DIR="/tmp/chromium-kiosk-$(date +%s)"
mkdir -p "$USER_DATA_DIR"
echo "📁 創建用戶資料目錄: $USER_DATA_DIR"

# -----------------------------------------------------------------------------
# 啟動 Chromium 瀏覽器 (改進版 - 減少錯誤訊息)
# -----------------------------------------------------------------------------

echo "🚀 啟動 Chromium 瀏覽器..."

# 清理舊的 Chromium 進程 (如果存在)
pkill -f "chromium-browser.*display" 2>/dev/null

# 等待一下讓進程完全結束
sleep 2

chromium-browser \
  --kiosk \
  --user-data-dir="$USER_DATA_DIR" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-features=TranslateUI,VizDisplayCompositor \
  --disable-ipc-flooding-protection \
  --disable-background-networking \
  --disable-background-media-suspend \
  --disable-low-res-tiling \
  --disable-default-apps \
  --disable-extensions \
  --disable-plugins \
  --disable-sync \
  --disable-translate \
  --disable-logging \
  --disable-gpu-sandbox \
  --disable-software-rasterizer \
  --disable-background-timer-throttling \
  --no-first-run \
  --no-default-browser-check \
  --no-sandbox \
  --disable-dev-shm-usage \
  --memory-pressure-off \
  --max_old_space_size=4096 \
  --incognito \
  --autoplay-policy=no-user-gesture-required \
  --start-maximized \
  --disable-databases \
  --disable-local-storage \
  --disable-application-cache \
  --disable-gpu-process-crash-limit \
  https://mq-cms.adler-lei.workers.dev/display \
  2>/dev/null &

# 獲取 Chromium 的進程 ID
CHROMIUM_PID=$!

echo "🎯 Chromium 已啟動 (PID: $CHROMIUM_PID)"
echo "📺 如果螢幕顯示網站，表示啟動成功！"

# -----------------------------------------------------------------------------
# 監控瀏覽器狀態 (可選)
# -----------------------------------------------------------------------------

# 等待 5 秒後檢查瀏覽器是否還在運行
sleep 5

if ps -p $CHROMIUM_PID > /dev/null; then
    echo "✅ Chromium 運行正常"
else
    echo "❌ Chromium 可能啟動失敗"
fi

# 保持腳本運行，監控瀏覽器狀態
while true; do
    if ! ps -p $CHROMIUM_PID > /dev/null; then
        echo "⚠️ Chromium 已停止，嘗試重新啟動..."
        
        # 清理暫存目錄
        rm -rf "$USER_DATA_DIR"
        
        # 重新執行腳本
        exec "$0"
    fi
    sleep 30
done

# -----------------------------------------------------------------------------
# 清理函數 (腳本結束時執行)
# -----------------------------------------------------------------------------

cleanup() {
    echo "🧹 清理暫存檔案..."
    rm -rf "$USER_DATA_DIR"
    exit 0
}

# 設定信號處理
trap cleanup EXIT INT TERM

# =============================================================================
# 改進說明：
# 
# 🔧 減少錯誤訊息的改進：
# - 添加 --user-data-dir 解決安全警告
# - 添加 2>/dev/null 隱藏 xset 錯誤
# - 添加 --disable-logging 減少日誌輸出
# - 添加 --disable-databases 避免資料庫錯誤
# - 使用臨時目錄避免權限問題
# 
# 🛡️ 穩定性改進：
# - 自動監控瀏覽器狀態
# - 瀏覽器崩潰時自動重啟
# - 清理舊進程避免衝突
# - 暫存檔案自動清理
# 
# 🍓 樹莓派優化：
# - 更好的 DISPLAY 環境變數處理
# - GPU 相關錯誤抑制
# - 記憶體使用優化
# =============================================================================