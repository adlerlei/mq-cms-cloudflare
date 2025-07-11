# MQ CMS - Cloudflare Workers 內容管理系統

一個基於 Cloudflare Workers 的現代化內容管理系統，專為媒體展示和輪播管理而設計。

## 功能特色

### 🎯 核心功能
- **媒體管理**: 支援圖片和影片上傳、預覽、刪除
- **區塊指派**: 將媒體內容指派到不同的顯示區塊
- **輪播群組**: 創建和管理圖片輪播群組
- **即時更新**: 透過 WebSocket 實現即時內容更新
- **響應式設計**: 適配各種螢幕尺寸的顯示效果

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
- 單一媒體指派: 將單個檔案指派到特定區塊
- 群組指派: 將輪播群組指派到區塊

#### 輪播設定
- 可調整各區塊的輪播間隔時間
- 支援拖拽排序群組內的圖片順序

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

### 專案結構
```
├── src/
│   └── index.ts          # Worker 主程式
├── public/
│   ├── admin.html        # 管理後台
│   ├── display.html      # 顯示頁面
│   ├── login.html        # 登入頁面
│   ├── css/              # 樣式檔案
│   └── js/               # JavaScript 檔案
├── test/
│   └── index.spec.ts     # 測試檔案
├── wrangler.toml         # Cloudflare 設定
└── package.json
```

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

## 技術支援

如有問題，請在 GitHub Issues 中提出。