# 🖥️ MQ CMS - 智能廣告機內容管理系統

> **版本**: v5.1.0 | **狀態**: ✅ 生產就緒 | **最後更新**: 2025-01-10

基於 Cloudflare Workers 的現代化直立式廣告機內容管理系統（CMS），專為多設備媒體展示和即時內容管理而設計。支援多版面配置、設備管理、即時內容推送等企業級功能。

---

## ✨ 核心特色

### 🎯 主要功能
- **📱 多設備管理** - 集中管理無限台廣告機設備，支援自定義設備名稱、地址和備註
- **🎨 多版面支援** - 為不同設備群組創建獨立的內容版面（Layout）
- **🖼️ 媒體管理** - 圖片/影片上傳、預覽、刪除，支援 R2 雲端存儲
- **🎭 區塊指派** - 6 個可配置的內容區塊，靈活分配媒體內容
- **🔄 輪播群組** - 創建圖片輪播組，支援拖拽排序和偏移量控制
- **⚡ 即時更新** - WebSocket 推送，內容變更立即生效
- **🔐 安全認證** - JWT 令牌認證，保護管理介面
- **📊 設備狀態** - 實時監控設備在線狀態和最後上線時間

### 🏗️ 技術架構
- **Cloudflare Workers** - 全球邊緣計算，低延遲高可用
- **Durable Objects** - 分佈式持久化存儲
- **R2 Storage** - 海量媒體文件存儲
- **WebSocket** - 全雙工實時通訊
- **TypeScript** - 類型安全開發

### 🎭 顯示區塊配置
```
┌─────────────────────────────────┐
│   頁首影片區 (header_video)      │
├────────────┬────────────────────┤
│ 左上輪播區  │   右上輪播區        │
│ (top_left) │  (top_right)       │
├────────────┼────────────────────┤
│ 左下輪播區  │   右下輪播區        │
│(bottom_left)│ (bottom_right)     │
├─────────────────────────────────┤
│   頁尾內容區 (footer_content)    │
└─────────────────────────────────┘
```

---

## 🚀 快速開始

### 📋 環境需求
- Node.js 18+ 
- Cloudflare 帳號（免費版即可）
- Wrangler CLI（Cloudflare 開發工具）

### 🔧 安裝步驟

#### 1. 克隆專案
```bash
git clone <repository-url>
cd mq-cms-cloudflare
```

#### 2. 安裝依賴
```bash
npm install
```

#### 3. 配置 Cloudflare

登入 Cloudflare 帳號：
```bash
npx wrangler login
```

創建 R2 儲存桶：
```bash
npx wrangler r2 bucket create mq-cms-media
```

#### 4. 本地開發
```bash
npm run dev
```
開發服務器將在 `http://localhost:8787` 啟動

#### 5. 部署到生產環境
```bash
npm run deploy
```
系統會自動部署到 Cloudflare Workers

---

## 📖 使用指南

### 🔐 登入管理後台

1. 訪問 `/login.html`
2. 使用預設帳號登入：
   - **帳號**: `admin`
   - **密碼**: `admin123`
   
   ⚠️ **生產環境請務必修改預設密碼！**

### 🎛️ 管理介面功能

#### 1️⃣ 版面管理（Layouts）
- **創建版面**: 為不同的業務需求創建獨立版面
  - 例如: `駕訓班`, `餐廳菜單`, `公司宣傳`
- **切換版面**: 在下拉菜單中選擇要管理的版面
- **刪除版面**: 刪除不需要的版面（`default` 版面無法刪除）
- **預覽版面**: 點擊「👁 預覽」按鈕查看效果

#### 2️⃣ 設備管理與指派
- **設備註冊**: 播放器首次連接時自動註冊
- **編輯設備信息**:
  - **設備名稱**: 方便識別（如「一樓大廳廣告機」）
  - **設備地址**: 實際安裝地址，方便工程人員維護
  - **備註**: 其他需要記錄的信息
- **版面指派**: 將設備分配到特定版面
- **設備狀態**: 
  - 🟢 正常運行（5分鐘內有心跳）
  - 🟡 連接異常（5-30分鐘未收到心跳）
  - 🔴 已離線（超過30分鐘未連接）
  - ⚪ 從未連接（新設備）
- **複製設備 ID**: 快速複製 UUID 用於技術支援

#### 3️⃣ 媒體管理
- **上傳媒體**:
  - 支援格式: JPG, PNG, GIF, WebP (圖片) / MP4, MOV, AVI (影片)
  - 選擇目標區塊，上傳後自動指派
- **查看媒體庫**: 查看所有已上傳的媒體文件
- **指派/重新指派**: 將媒體分配到不同的顯示區塊
- **刪除媒體**: 刪除不需要的媒體文件

#### 4️⃣ 輪播群組
- **創建群組**: 為輪播內容創建群組
- **批量上傳**: 一次上傳多張圖片到群組
- **拖拽排序**: 調整圖片播放順序
- **設定偏移量**: 控制從第幾張開始播放
- **指派群組**: 將整個群組指派到區塊

#### 5️⃣ 全局設定
- **輪播間隔**: 調整各區塊的切換時間
  - 頁首區間隔
  - 輪播區間隔
  - 頁尾區間隔

### 📺 顯示頁面
訪問 `/display.html?deviceId=<設備UUID>` 查看內容展示

播放器會根據設備 ID 自動載入對應版面的內容。

---

## 🏗️ 專案結構

```
mq-cms-cloudflare/
├── 📄 README.md                    # 專案說明文檔
├── 📄 package.json                 # 依賴和腳本配置
├── 📄 wrangler.toml                # Cloudflare Workers 配置
├── 📄 tsconfig.json                # TypeScript 配置
│
├── 📂 src/                         # 後端源碼
│   └── 📄 index.ts                 # Worker 主程式
│       ├── MessageBroadcaster      # Durable Object (WebSocket + 數據存儲)
│       ├── API Routes              # RESTful API 端點
│       └── Media Handling          # R2 文件上傳/下載
│
├── 📂 public/                      # 前端靜態資源
│   ├── 📄 admin.html               # 🎛️ 管理後台
│   ├── 📄 display.html             # 📺 內容展示頁面
│   ├── 📄 login.html               # 🔐 登入頁面
│   ├── 📄 preview.html             # 👁️ 版面預覽選擇器
│   │
│   ├── 📂 css/                     # 樣式文件
│   │   ├── admin.css
│   │   ├── display.css
│   │   └── bulma.css               # UI 框架
│   │
│   └── 📂 js/                      # JavaScript 模組
│       ├── admin.js                # 管理後台邏輯
│       └── animation.js            # 播放器邏輯
│
└── 📂 test/                        # 測試文件
    └── index.spec.ts
```

---

## 🔌 API 文檔

### 認證

#### 登入
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

# Response
{
  "access_token": "eyJhb...",
  "message": "登入成功"
}
```

### 版面管理

#### 獲取所有版面
```http
GET /api/layouts

# Response
[
  { "name": "default", "created_at": "2025-01-01T00:00:00.000Z" },
  { "name": "駕訓班", "created_at": "2025-01-02T00:00:00.000Z" }
]
```

#### 創建版面
```http
POST /api/layouts
Content-Type: application/json

{
  "name": "餐廳菜單",
  "created_at": "2025-01-10T00:00:00.000Z"
}
```

#### 刪除版面
```http
DELETE /api/layouts/{layoutName}
```

### 設備管理

#### 獲取所有設備
```http
GET /api/devices

# Response
[
  {
    "id": "abc123-def456-...",
    "name": "一樓大廳廣告機",
    "address": "台北市信義區信義路五段7號",
    "notes": "主要播放駕訓班宣傳影片",
    "layoutName": "駕訓班",
    "last_seen": "2025-01-10T12:00:00.000Z",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

#### 更新設備信息
```http
PUT /api/devices/{deviceId}
Content-Type: application/json

{
  "name": "二樓會議室廣告機",
  "address": "台北市信義區信義路五段7號 2F",
  "notes": "週一更新內容"
}
```

#### 刪除設備
```http
DELETE /api/devices/{deviceId}
```

#### 指派設備到版面
```http
POST /api/assign
Content-Type: application/json

{
  "id": "abc123-def456-...",
  "layoutName": "駕訓班",
  "last_seen": "2025-01-10T12:00:00.000Z"
}
```

### 媒體管理

#### 上傳媒體
```http
POST /api/media
Content-Type: multipart/form-data

file: <文件>
layout: "駕訓班"
section_key: "header_video"

# Response
{
  "success": true,
  "material": {
    "id": "xyz789",
    "filename": "1736496000000-abcdefg.mp4",
    "original_filename": "宣傳影片.mp4",
    "type": "video",
    "url": "/media/1736496000000-abcdefg.mp4",
    "size": 10485760,
    "uploaded_at": "2025-01-10T12:00:00.000Z"
  },
  "message": "上傳成功"
}
```

#### 獲取媒體列表
```http
GET /api/materials?layout=駕訓班
```

#### 刪除媒體
```http
DELETE /api/materials/{materialId}?layout=駕訓班
```

#### 獲取媒體文件
```http
GET /media/{filename}
```

### 配置獲取

#### 獲取設備配置
```http
GET /api/config?deviceId=abc123-def456-...

# Response
{
  "layout": "駕訓班",
  "materials": [...],
  "assignments": [...],
  "groups": [...],
  "settings": {
    "header_interval": 5,
    "carousel_interval": 6,
    "footer_interval": 7
  },
  "available_sections": {...}
}
```

### WebSocket

#### 連接
```javascript
const ws = new WebSocket('wss://your-domain.workers.dev/ws');

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // 類型: ping, section_updated, settings_updated, device_assigned, device_deleted
  console.log(data.type);
};
```

---

## 🛠️ 開發指南

### 本地開發
```bash
# 啟動開發服務器
npm run dev

# 運行測試
npm test

# 生成 TypeScript 類型
npm run cf-typegen
```

### 部署

#### 預覽部署（測試環境）
```bash
npx wrangler deploy --env preview
```

#### 生產部署
```bash
npm run deploy
```

### 環境配置

編輯 `wrangler.toml`:
```toml
name = "mq-cms"
main = "src/index.ts"
compatibility_date = "2024-11-22"

[[ durable_objects.bindings ]]
name = "MESSAGE_BROADCASTER"
class_name = "MessageBroadcaster"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "mq-cms-media"
```

---

## 🌟 使用場景

### 1. 駕訓班宣傳系統
- 版面：駕訓班課程介紹
- 設備：大廳主屏、教室屏
- 內容：課程影片、學員照片、優惠信息

### 2. 餐廳菜單系統
- 版面：早餐菜單、午餐菜單、晚餐菜單
- 設備：收銀台屏、候位區屏
- 內容：菜品圖片、價格、推薦套餐

### 3. 企業形象展示
- 版面：公司簡介、產品展示
- 設備：前台屏、會議室屏、展廳屏
- 內容：企業影片、產品照片、榮譽證書

---

## 🔒 安全性建議

⚠️ **生產環境安全檢查清單**:

- [ ] 修改預設管理員密碼
- [ ] 啟用 HTTPS（Cloudflare 預設支援）
- [ ] 限制管理介面訪問 IP（Cloudflare Firewall Rules）
- [ ] 定期備份 Durable Objects 數據
- [ ] 監控異常登入嘗試
- [ ] 設定 R2 存儲桶訪問權限

---

## 📈 版本歷史

### v5.1.0 (2025-01-10) - 輪播功能完善 🔄
**修復與優化**:
- 🎯 修復輪播群組偏移量（Offset）功能失效問題
- 🗑️ 實現群組級聯刪除功能（刪除群組時自動刪除所有關聯圖片）
- 🧹 自動清理 R2 存儲空間（刪除群組時同步刪除雲端文件）
- 🔗 自動清理孤儿 Assignments（指向已刪除素材的指派記錄）
- 📝 添加詳細的調試日誌，便於問題追踪
- ✅ 驗證樹莓派 Electron Player 群組輪播功能正常

**技術改進**:
- 修復前端表單字段名稱不匹配問題（offset 字段）
- 優化偏移量判斷邏輯，支持 offset = 0 的場景
- 在 Worker 層面攔截群組刪除請求，實現完整的級聯刪除流程

---

### v5.0.0 (2025-01-10) - 設備管理大升級 🎉
**新功能**:
- ✨ 設備管理系統完全重構
- 📝 設備可自定義名稱、地址、備註
- 📊 實時設備狀態監控（正常運行/連接異常/已離線）
- 🎨 全新設備列表 UI（截短 UUID、狀態圖標）
- 📋 設備 ID 一鍵複製功能
- 🔄 播放器自動響應版面變更（無需重啟）
- 👁️ 版面預覽功能
- 🐛 修復多個上傳和刪除相關 Bug

**改進**:
- 優化前端設備列表渲染性能
- 增強 WebSocket 實時同步機制
- 改進錯誤提示信息（全中文化）
- 完善 API 文檔

### v4.7.0 (2025-01-09) - 多版面支援
- 多版面（Layout）管理功能
- 設備自動註冊和分配
- 輪播群組拖拽排序

### v4.0.0 (2025-01-05) - 架構升級
- 遷移到 Cloudflare Workers
- 引入 Durable Objects
- WebSocket 即時通訊

---

## 🤝 貢獻

本專案為私人項目，暫不接受外部貢獻。

---

## 📄 授權

© 2025 版權所有。本專案為私人項目，未經許可不得使用。

---

## 📞 技術支援

### 常見問題

**Q: 設備顯示不正確的內容？**  
A: 檢查設備是否指派到正確的版面，嘗試在管理面板重新指派設備。

**Q: 上傳影片後無法播放？**  
A: 確認影片格式為 MP4/WebM，且文件大小在 100MB 以內。

**Q: WebSocket 連接失敗？**  
A: 檢查網絡防火牆是否阻擋 WebSocket 連接（ws:// 或 wss://）。

**Q: 樹莓派重啟後設備 ID 改變？**  
A: 不會！設備 ID 使用 electron-store 持久化存儲，只有重裝系統才會改變。

**Q: 如何為樹莓派設置開機自動啟動？**  
A: 參考項目中的 `kiosk.sh` 腳本，配置 systemd 服務或 crontab。

---

**🎉 感謝使用 MQ CMS！** 

如有問題或建議，請聯繫系統管理員。
