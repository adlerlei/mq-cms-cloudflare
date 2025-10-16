# MQ CMS - 廣告機內容管理系統

> **版本**: v5.3.6 | **最後更新**: 2025-10-17

基於 Cloudflare Workers 的廣告機內容管理系統，支援多設備、多版面管理。

---

## 快速開始

### 本地開發
```bash
npm run dev
```

### 部署到生產環境
```bash
npm run deploy
```
生產地址：https://mq-cms.adler-lei.workers.dev/admin

---

## 登入資訊

**管理後台**：`/admin.html`
- 帳號：`admin`
- 密碼：`admin123`

⚠️ 記得修改預設密碼！

---

## 核心功能

### 1. 版面管理
- 創建多個版面（Layout），適用不同需求
- 支援兩種布局模板：
  - **預設布局**：6個區塊（頁首影片 + 4個輪播區 + 頁尾）
  - **雙影片布局**：5個區塊（2個頁首影片 + 2個輪播區 + 頁尾）

### 2. 設備管理
- 設備自動註冊（首次連接時）
- 編輯設備信息（名稱、地址、備註）
- 將設備指派到不同版面
- 實時監控設備狀態

### 3. 媒體管理
- 上傳圖片/影片（JPG, PNG, GIF, MP4 等）
- 將媒體指派到各個區塊
- 支援 Cloudflare R2 存儲

### 4. 輪播群組
- 創建圖片輪播組
- 拖拽排序調整播放順序
- 設定偏移量（從第幾張開始）
- 批量上傳圖片到群組

### 5. 即時更新
- WebSocket 推送，內容變更立即生效
- 播放器自動檢查版本並更新（每5分鐘）

---

## 項目結構

```
mq-cms-cloudflare/
├── src/
│   └── index.ts              # Worker 主程式 + API
├── public/
│   ├── admin.html            # 管理後台
│   ├── default.html          # 預設布局模板
│   ├── dual_video.html       # 雙影片布局模板
│   └── js/
│       ├── admin.js          # 管理後台邏輯
│       └── animation.js      # 播放器邏輯
├── wrangler.toml             # Cloudflare 配置
└── package.json              # 依賴配置
```

---

## 配置說明

### Cloudflare 設定

**Durable Object**：`MESSAGE_BROADCASTER`
- 存儲版面、設備、媒體數據
- WebSocket 連接管理

**R2 Bucket**：`mq-cms-media`
- 存儲媒體文件（圖片/影片）

---

## 常用操作

### 創建新版面
1. 在管理後台點擊「版面管理」
2. 輸入版面名稱，選擇模板
3. 點擊「建立版面」

### 上傳媒體並指派
1. 選擇「操作類型」→「上傳單一圖片/影片」
2. 選擇「指派到區塊」
3. 選擇文件，點擊上傳

### 創建輪播組
1. 在「管理輪播圖片組」區塊
2. 輸入群組名稱，點擊「建立群組」
3. 點擊「編輯」上傳圖片
4. 拖拽排序後點擊「儲存變更」
5. 在「新增媒體 / 指派內容」選擇「指派輪播群組」

---

## 預覽與調試

### 版面預覽選擇器
**快速入口**：`/preview.html`
- 列出所有可用版面
- 一鍵開啟預覽

### 直接預覽版面

**預設版面**：
```
本地：http://localhost:8787/default.html?deviceId=preview-default
生產：https://mq-cms.adler-lei.workers.dev/default.html?deviceId=preview-default
```

**雙影片版面**：
```
本地：http://localhost:8787/dual_video.html?deviceId=preview-dual_video
生產：https://mq-cms.adler-lei.workers.dev/dual_video.html?deviceId=preview-dual_video
```

**自訂版面**（將 `your-layout` 替換為版面名稱）：
```
/default.html?deviceId=preview-your-layout
```

### 調試模式

**方式1：使用 Debug 按钮（推薦）**：
1. 登入管理後台
2. 點擊右上角 **Debug** 按钮
3. 選擇要預覽的版面
4. 自動開啟調試模式

**方式2：URL 參數**：
```
/default.html?deviceId=preview-default&debug=true
```

**調試功能**：
- 📊 顯示所有內部處理邏輯
- 🔍 查看輪播初始化和偏移量
- 📡 監控 WebSocket 連接狀態
- 🎯 追蹤內容加載和區塊更新
- 💾 輪播位置持久化追蹤

---

## 版本歷史重點

### v5.3.6 (2025-10-17)
- 新增管理後台 Debug 按钮，快速開啟調試預覽
- preview.html 所有預覽鏈接自動啟用調試模式
- 移除鍵盤快捷鍵（跨瀏覽器兼容性問題）
- 優化調試入口體驗

### v5.3.5 (2025-10-16)
- 修復輪播偏移量在更新後失效問題（位置持久化）
- 優化通知系統（固定定位，智能消失時間）
- 顯示原始文件名
- 簡化表格標題
- 刪除測試文件和開發工具緩存

### v5.3.4 (2025-10-16)
- 移除網格視圖，只保留表格模式

### v5.3.3 (2025-10-16)
- 添加調試模式開關，優化生產環境性能

### v5.3.2 (2025-10-16)
- 修復群組圖片輪播顯示問題

### v5.3.1 (2025-10-14)
- 自動版本檢查與更新
- 容器尺寸檢查與重試

### v5.2.0 (2025-01-14)
- 布局模板系統

---

## 技術棧

- **後端**：Cloudflare Workers + Durable Objects
- **存儲**：Cloudflare R2
- **前端**：Vanilla JS + Bulma CSS
- **播放器**：Electron (樹莓派)

---

## 注意事項

1. **預設版面**（`default`）無法刪除
2. **媒體文件名**：系統自動加時間戳避免重名
3. **版本更新**：播放器每5分鐘自動檢查並更新
4. **群組刪除**：會級聯刪除群組內所有圖片

---

## 相關文檔

- **AI_CONTEXT.md**：詳細的技術文檔和開發記錄
- **ELECTRON_PLAYER.md**：樹莓派播放器說明

---

**© 2025 MQ CMS - 私人項目**
