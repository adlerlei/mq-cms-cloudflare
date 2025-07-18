#!/bin/bash

# =============================================================================
# 樹莓派測試模式腳本 (非全螢幕 - 可以檢查控制台)
# 用於測試和調試 MQ CMS 顯示頁面
# =============================================================================

echo "🧪 啟動樹莓派測試模式 (非全螢幕)..."

# -----------------------------------------------------------------------------
# 系統層面的防休眠設定
# -----------------------------------------------------------------------------

echo "⚙️ 設定系統防休眠..."

# 檢查是否有 DISPLAY 環境變數，如果沒有則設定
if [ -z \"\$DISPLAY\" ]; then
    export DISPLAY=:0
    echo \"📺 設定 DISPLAY=:0\"
fi

# 防止螢幕保護程式啟動 (忽略錯誤訊息)
xset s off 2>/dev/null || echo \"⚠️ xset s off 失敗 (可能正常)\"

# 關閉 DPMS (Display Power Management Signaling) 省電模式
xset -dpms 2>/dev/null || echo \"⚠️ xset -dpms 失敗 (可能正常)\"

# 防止螢幕變黑
xset s noblank 2>/dev/null || echo \"⚠️ xset s noblank 失敗 (可能正常)\"

echo \"✅ 系統防休眠設定完成\"

# -----------------------------------------------------------------------------
# 等待網路連接
# -----------------------------------------------------------------------------

echo \"🌐 檢查網路連接...\"

for i in {1..30}; do
    if ping -c 1 8.8.8.8 &> /dev/null; then
        echo \"✅ 網路連接正常\"
        break
    else
        echo \"⏳ 等待網路連接... (\$i/30)\"
        sleep 1
    fi
done

# -----------------------------------------------------------------------------
# 創建專用的用戶資料目錄
# -----------------------------------------------------------------------------

USER_DATA_DIR=\"/tmp/chromium-test-\$(date +%s)\"
mkdir -p \"\$USER_DATA_DIR\"
echo \"📁 創建用戶資料目錄: \$USER_DATA_DIR\"

# -----------------------------------------------------------------------------
# 啟動 Chromium 瀏覽器 (測試模式 - 非全螢幕)
# -----------------------------------------------------------------------------

echo \"🚀 啟動 Chromium 瀏覽器 (測試模式)...\"
echo \"📋 測試模式功能：\"
echo \"   - 非全螢幕，可以檢查控制台\"
echo \"   - 按 F12 打開開發者工具\"
echo \"   - 按 Ctrl+Shift+I 也可以打開開發者工具\"
echo \"   - 可以看到 WebSocket 心跳日誌\"

# 清理舊的 Chromium 進程
pkill -f \"chromium-browser.*display\" 2>/dev/null
sleep 2

chromium-browser \\
  --user-data-dir=\"\$USER_DATA_DIR\" \\
  --window-size=1920,1080 \\
  --start-maximized \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-background-timer-throttling \\
  --disable-backgrounding-occluded-windows \\
  --disable-renderer-backgrounding \\
  --disable-features=TranslateUI,VizDisplayCompositor \\
  --disable-ipc-flooding-protection \\
  --disable-background-networking \\
  --disable-background-media-suspend \\
  --disable-low-res-tiling \\
  --disable-default-apps \\
  --disable-extensions \\
  --disable-plugins \\
  --disable-sync \\
  --disable-translate \\
  --disable-logging \\
  --disable-gpu-sandbox \\
  --disable-software-rasterizer \\
  --no-first-run \\
  --no-default-browser-check \\
  --no-sandbox \\
  --disable-dev-shm-usage \\
  --memory-pressure-off \\
  --max_old_space_size=4096 \\
  --autoplay-policy=no-user-gesture-required \\
  --disable-databases \\
  --disable-local-storage \\
  --disable-application-cache \\
  --disable-gpu-process-crash-limit \\
  https://mq-cms.adler-lei.workers.dev/display \\
  2>/dev/null &

CHROMIUM_PID=\$!

echo \"🎯 Chromium 已啟動 (PID: \$CHROMIUM_PID)\"
echo \"\"
echo \"📋 測試指南：\"
echo \"1. 按 F12 打開開發者工具\"
echo \"2. 切換到 Console 標籤\"
echo \"3. 觀察以下日誌：\"
echo \"   - 🍓 樹莓派環境：啟用防休眠機制\"
echo \"   - 🏓 收到伺服器ping，回應pong\"
echo \"   - 💓 樹莓派防休眠：連接正常\"
echo \"4. 在管理頁面測試設定更新\"
echo \"5. 觀察是否收到 ⚙️ 設定更新事件\"
echo \"\"
echo \"✅ 如果看到這些日誌，表示防休眠機制正常工作\"
echo \"❌ 如果沒有看到，可能需要進一步調試\"
echo \"\"
echo \"🔄 測試完成後，可以關閉瀏覽器並使用正式的 kiosk.sh\"

# 等待瀏覽器啟動
sleep 5

if ps -p \$CHROMIUM_PID > /dev/null; then
    echo \"✅ Chromium 運行正常 - 現在可以檢查控制台了！\"
else
    echo \"❌ Chromium 可能啟動失敗\"
fi

# 清理函數
cleanup() {
    echo \"🧹 清理暫存檔案...\"
    rm -rf \"\$USER_DATA_DIR\"
    exit 0
}

trap cleanup EXIT INT TERM

# 保持腳本運行
echo \"⏳ 測試模式運行中... 按 Ctrl+C 結束\"
wait \$CHROMIUM_PID