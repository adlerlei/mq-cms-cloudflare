# MQ CMS - Cloudflare Workers 內容管理系統

> **版本**: v4.7.0 | **狀態**: ✅ 生產就緒 | **最後更新**: 2025-7-13

一個基於 Cloudflare Workers 的現代化內容管理系統，專為媒體展示和輪播管理而設計。提供完整的媒體管理、輪播群組管理、即時內容更新等功能。

## 功能特色

### 🎯 核心功能
- **媒體管理**: 支援圖片和影片上傳、預覽、刪除，自動生成縮圖
- **區塊指派**: 將媒體內容指派到不同的顯示區塊，支援偏移量設定
- **輪播群組**: 創建和管理圖片輪播群組，支援拖拽排序和批量上傳
- **即時更新**: 透過 WebSocket 實現即時內容更新和同步
- **響應式設計**: 適配各種螢幕尺寸的顯示效果
- **全局設定**: 可調整各區塊的輪播間隔時間
- **安全認證**: JWT 基礎認證系統

### 🏗️ 技術架構
- **Cloudflare Workers**: 無伺服器運算平台
- **Durable Objects**: 持久化狀態管理
- **R2 Storage**: 媒體檔案儲存
- **WebSocket**: 即時通訊
- **TypeScript**: 型別安全的開發體驗

### 🎨 顯示區塊
- 頁首影片區
- 四個中間輪播區塊（左上、右上、左下、右下）
- 頁尾內容區

## 快速開始

### 環境需求
- Node.js 18+
- Cloudflare 帳號
- Wrangler CLI

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd mq-cms-cloudflare
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **設定 Cloudflare**
   ```bash
   # 登入 Cloudflare
   npx wrangler login
   
   # 創建 R2 儲存桶
   npx wrangler r2 bucket create mq-cms-media
   ```

4. **本地開發**
   ```bash
   npm run dev
   ```

5. **部署到生產環境**
   ```bash
   npm run deploy
   ```

## 使用說明

### 管理後台
1. 訪問 `/login.html` 進行登入
   - 預設帳號: `admin`
   - 預設密碼: `admin123`

2. 登入後進入 `/admin.html` 管理介面

### 主要功能

#### 媒體上傳
- 支援圖片格式: JPG, PNG, GIF, WebP
- 支援影片格式: MP4, WebM, MOV, AVI
- 自動生成縮圖預覽

#### 內容指派
- **單一媒體指派**: 將單個檔案指派到特定區塊
- **群組指派**: 將輪播群組指派到區塊
- **偏移量設定**: 可設定輪播從第幾張圖片開始播放（例如：偏移量2表示從第3張開始）

#### 輪播群組管理
- **群組創建**: 建立新的圖片輪播群組
- **批量上傳**: 一次選擇多張圖片上傳到群組
- **拖拽排序**: 支援拖拽調整群組內圖片的播放順序
- **即時預覽**: 上傳後立即顯示在群組中
- **群組刪除**: 刪除群組時同時刪除所有內部圖片

#### 輪播設定
- **間隔時間**: 可調整各區塊的輪播間隔時間
- **偏移量控制**: 精確控制輪播起始位置
- **即時生效**: 設定變更立即反映到顯示頁面

### 顯示頁面
訪問 `/display.html` 查看內容展示效果

## API 文檔

### 認證
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 媒體管理
```http
# 上傳媒體
POST /api/media
Content-Type: multipart/form-data

# 獲取媒體列表
GET /api/media

# 刪除媒體
DELETE /api/media/{filename}
```

### 完整數據
```http
# 獲取所有數據（媒體、指派、群組、設定）
GET /api/media_with_settings
```

## 開發指南

## 📁 專案結構

```
mq-cms-cloudflare/
├── 📄 README.md                    # 專案說明文檔
├── 📄 CHANGELOG.md                 # 工作日誌和版本記錄
├── 📄 package.json                 # Node.js 依賴和腳本配置
├── 📄 wrangler.toml                # Cloudflare Workers 配置
├── 📄 tsconfig.json                # TypeScript 配置
├── 📄 vitest.config.mts            # 測試配置
│
├── 📂 src/                         # 後端源碼
│   └── 📄 index.ts                 # Worker 主程式 (Durable Objects + API)
│
├── 📂 public/                      # 前端靜態資源
│   ├── 📄 admin.html               # 🎛️ 管理後台頁面
│   ├── 📄 display.html             # 📺 內容展示頁面
│   ├── 📄 login.html               # 🔐 用戶登入頁面
│   ├── 📄 websocket-test.html      # 🔧 WebSocket 測試頁面
│   │
│   ├── 📂 css/                     # 樣式檔案
│   │   ├── 📄 admin.css            # 管理後台樣式
│   │   ├── 📄 display.css          # 顯示頁面樣式
│   │   ├── 📄 style.css            # 通用樣式
│   │   └── 📄 bulma.css            # Bulma CSS 框架
│   │
│   └── 📂 js/                      # JavaScript 檔案
│       ├── 📄 admin.js             # 管理後台邏輯
│       ├── 📄 animation.js         # 輪播動畫和顯示邏輯
│       ├── 📄 api.js               # API 通訊模組
│       ├── 📄 eventHandlers.js     # 事件處理器
│       ├── 📄 store.js             # 狀態管理
│       └── 📄 ui.js                # UI 組件和互動
│
└── 📂 test/                        # 測試檔案
    ├── 📄 index.spec.ts            # 主要測試檔案
    ├── 📄 env.d.ts                 # 測試環境類型定義
    └── 📄 tsconfig.json            # 測試專用 TypeScript 配置
```

### 🏗️ 架構說明

#### 後端 (Cloudflare Workers)
- **`src/index.ts`**: 
  - 主要 Worker 入口點
  - 處理 HTTP 請求路由
  - R2 儲存桶檔案管理
  - Durable Objects 狀態管理
  - WebSocket 連接處理

#### 前端頁面
- **`admin.html`**: 管理後台，提供完整的內容管理功能
- **`display.html`**: 內容展示頁面，顯示所有指派的媒體內容
- **`login.html`**: 簡潔的登入介面

#### JavaScript 模組
- **`admin.js`**: 管理後台的所有邏輯，包括媒體上傳、群組管理、拖拽排序等
- **`animation.js`**: 處理顯示頁面的輪播動畫、偏移量邏輯、WebSocket 更新
- **其他模組**: API 通訊、事件處理、狀態管理等輔助功能

### 執行測試
```bash
npm test
```

### 本地開發
```bash
npm run dev
```
開發伺服器會在 `http://localhost:8787` 啟動

## 部署說明

### 生產環境部署
1. 確保已設定 Cloudflare 帳號和 R2 儲存桶
2. 執行部署指令:
   ```bash
   npm run deploy
   ```

### 環境變數
在 `wrangler.toml` 中設定:
- `MESSAGE_BROADCASTER`: Durable Object 綁定
- `MEDIA_BUCKET`: R2 儲存桶綁定

## 安全性考量

⚠️ **重要提醒**: 
- 預設的認證系統僅供開發測試使用
- 生產環境請實作更安全的認證機制
- 建議使用真��的 JWT 或其他安全認證方案
- 考慮加入 CSRF 保護和其他安全措施

## 授權條款

MIT License

## 貢獻指南

歡迎提交 Issue 和 Pull Request 來改善這個專案！

## 📊 當前進度和狀態

### ✅ 已完成功能
- [x] **基礎架構** - Cloudflare Workers + Durable Objects + R2 Storage
- [x] **用戶認證** - JWT 基礎認證系統
- [x] **媒體管理** - 完整的檔案上傳、預覽、刪除功能
- [x] **輪播群組** - 群組創建、圖片管理、拖拽排序
- [x] **內容指派** - 單一媒體和群組指派到各區塊
- [x] **偏移量功能** - 輪播起始位置控制
- [x] **即時更新** - WebSocket 即時同步
- [x] **全局設定** - 輪播間隔時間調整
- [x] **響應式UI** - 適配各種螢幕尺寸
- [x] **批量上傳** - 多張圖片同時上傳到群組
- [x] **完整刪除** - 群組刪除時同時清理所有相關檔案

### 🎯 核心特色
- **🚀 生產就緒**: 所有核心功能已完成並測試
- **⚡ 高性能**: 基於 Cloudflare 全球網路，低延遲高可用
- **🔄 即時同步**: 管理後台變更立即反映到顯示頁面
- **🎨 用戶友好**: 直觀的拖拽操作和即時反饋
- **🛡️ 安全可靠**: 檔案類型驗證和權限控制
- **📱 響應式**: 完美適配桌面和移動設備

### 🔮 未來規劃
- [ ] **進階認證** - OAuth 2.0 / SAML 集成
- [ ] **多用戶支援** - 角色權限管理
- [ ] **內容排程** - 定時發布和自動切換
- [ ] **統計分析** - 內容播放統計和分析
- [ ] **API 擴展** - 第三方系統集成
- [ ] **主題系統** - 可自定義的顯示主題

### 📈 版本里程碑
- **v4.7.0** (當前) - 完整功能版本，包含所有核心功能和高級特性
- **v1.1.0** (規劃中) - 進階認證和多用戶支援
- **v1.2.0** (規劃中) - 內容排程和統計功能
- **v2.0.0** (長期) - 大型功能重構和擴展

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request 來改善這個專案！

### 開發流程
1. Fork 本專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📞 技術支援

如有問題，請在 GitHub Issues 中提出。

### 常見問題
- **部署問題**: 檢查 Cloudflare 帳號設定和 R2 儲存桶配置
- **認證問題**: 確認預設帳密 admin/admin123
- **檔案上傳**: 檢查檔案格式和大小限制
- **WebSocket**: 確認網路環境支援 WebSocket 連接

---

**最後更新**: 2025-7-13 | **版本**: v4.7.0 | **狀態**: 生產就緒 ✅