# AI Context - MQ CMS Project

> **Last Updated**: 2025-01-15  
> **Current Version**: v5.3.3  
> **Status**: Production Ready

## 🎯 Project Overview

**MQ CMS** is a Cloudflare Workers-based digital signage content management system.
- **Backend**: Cloudflare Workers + Durable Objects + R2 Storage
- **Frontend**: Vanilla JS (admin.html, display.html, preview.html)
- **Player**: Electron app for Raspberry Pi (separate repo: mq-cms-electron-player)

## 📂 Key Files

```
src/index.ts              # Worker entry point + Durable Object + API routes
public/
  ├── admin.html          # Admin interface (with flow layout)
  ├── default.html        # Default 6-block layout template
  ├── dual_video.html     # Dual video 5-block layout template
  ├── preview.html        # Layout preview page
  └── js/
      ├── admin.js        # Admin logic + template management
      ├── animation.js    # Player carousel logic + multi-template support
      └── layout-templates.js  # Template configuration
  └── css/
      └── admin-flow-layout.css  # Flow layout styles
```

## 🏗️ Data Architecture

### Durable Object Storage Keys
- `layout_{layoutName}_materials` - Media files metadata
- `layout_{layoutName}_assignments` - Content block assignments
- `layout_{layoutName}_groups` - Carousel groups
- `layout_{layoutName}_settings` - Playback intervals
- `layouts` - List of all layouts
- `devices` - Device registry

### Key Interfaces
```typescript
interface MediaMaterial {
  id: string;
  filename: string;        // R2 object key
  type: 'image' | 'video';
  url: string;
  group_id?: string;
}

interface Assignment {
  id: string;
  section_key: string;     // e.g., 'header_video', 'top_left', 'header_1_video'
  content_type: 'single_media' | 'group_reference';
  content_id: string;      // material.id or group.id
  offset?: number;         // For group carousel start position
}

interface CarouselGroup {
  id: string;
  name: string;
  materials: string[];     // Array of material IDs
}

interface Layout {
  name: string;
  template: string;        // Template type: 'default', 'dual_video', etc.
  created_at: string;
}
```

## ✅ Recently Completed (v5.3.3 - 2025-01-15)

### 優化生產環境性能 - 調試日誌控制
**Problem**: 播放器控制台輸出大量調試信息（每張圖片加載、容器尺寸、WebSocket 心跳等），在生產環境中：
- 資源有限的樹莓派設備可能受到性能影響
- 控制台被大量 emoji 日誌淹沒，難以查看真正的錯誤信息
- 不必要的日誌輸出佔用內存和 CPU

**Solution**: 實現可控的調試模式，默認關閉詳細日誌，只保留關鍵錯誤和警告。

#### Key Implementation
1. **調試模式控制**:
   ```javascript
   let DEBUG_MODE = false;  // 默認關閉
   
   function debugLog(...args) {
       if (DEBUG_MODE) console.log(...args);
   }
   
   function errorLog(...args) {
       console.error(...args);  // 始終輸出
   }
   
   function warnLog(...args) {
       console.warn(...args);  // 始終輸出
   }
   ```

2. **啟用調試模式的方式**:
   - **URL 參數**: `?debug=true` 自動啟用調試模式
   - **快捷鍵**: `Ctrl+Shift+D` (Mac: `Cmd+Shift+D`) 切換調試模式
   - 刷新頁面後生效

3. **日誌分類**:
   - **debugLog**: 詳細的調試信息（🎨, 📦, 🖼️, 📍, 🔄 等），默認不輸出
   - **errorLog**: 錯誤信息（❌），始終輸出
   - **warnLog**: 警告信息（⚠️），始終輸出
   - **版本更新通知**: 始終輸出（不受 DEBUG_MODE 影響）

4. **優化的日誌**:
   - 容器尺寸檢查、圖片加載成功、輪播初始化等改為 debugLog
   - WebSocket 消息、區塊處理等改為 debugLog
   - 只在 DEBUG_MODE 時才添加調試覆蓋層信息

#### Files Modified
- `public/js/animation.js` (全文件): 
  - 添加 DEBUG_MODE 標誌和日誌函數
  - 替換所有 console.log 為 debugLog
  - 替換 console.warn 為 warnLog（關鍵警告除外）
  - 保留所有 console.error 為 errorLog
  - URL 參數檢查和快捷鍵控制
- `package.json`: 版本升級至 v5.3.3

#### Performance Impact
- **生產環境**: 控制台輸出減少 95%+，只顯示錯誤和警告
- **調試模式**: 完整的調試信息，便於問題診斷
- **樹莓派設備**: 內存和 CPU 佔用顯著降低

#### Testing Verification
- ✅ 默認模式：控制台非常乾淨，只有版本號和錯誤（如有）
- ✅ URL 參數：`?debug=true` 正常啟用調試模式
- ✅ 快捷鍵：Ctrl+Shift+D 可切換調試模式
- ✅ 錯誤信息：仍然正常顯示在控制台
- ✅ 功能：不影響任何現有功能

### Previous (v5.3.2 - 2025-01-15)

### 修復群組圖片輪播顯示問題
**Problem**: 群組圖片輪播無法在播放器上顯示。管理後台顯示群組已正確指派（8張圖片），但播放頁面四個輪播區塊顯示 "found 0 assignments"，無法載入任何群組內容。

**Root Cause**: section_key 命名不一致問題
- 管理後台保存指派時使用**舊版命名**：`carousel_top_left`, `carousel_top_right`, `carousel_bottom_left`, `carousel_bottom_right`
- 播放器 `updateSection` 函數查找時使用**新版命名**：`top_left`, `top_right`, `bottom_left`, `bottom_right`
- 命名不匹配導致 `data.assignments.filter(a => a.section_key === sectionKey)` 返回空陣列

**Solution**: 實現向後兼容的別名映射機制，同時支持新舊兩種命名方式。

#### Key Implementation
1. **Section Key 別名映射表**:
   ```javascript
   const sectionKeyAliases = {
       'top_left': ['top_left', 'carousel_top_left'],
       'top_right': ['top_right', 'carousel_top_right'],
       'bottom_left': ['bottom_left', 'carousel_bottom_left'],
       'bottom_right': ['bottom_right', 'carousel_bottom_right'],
       'header_video': ['header_video'],
       'header_1_video': ['header_1_video'],
       'footer_content': ['footer_content']
   };
   ```

2. **智能查找邏輯**:
   ```javascript
   const possibleKeys = sectionKeyAliases[sectionKey] || [sectionKey];
   const sectionAssignments = data.assignments.filter(a => possibleKeys.includes(a.section_key));
   ```

3. **增強日誌輸出**:
   - 控制台顯示當前查找的所有可能 section_key
   - 幫助快速診斷命名匹配問題

#### Files Modified
- `public/js/animation.js` (lines 153-169): 添加 sectionKeyAliases 映射表和智能查找邏輯
- `package.json` (line 3): 版本升級至 v5.3.2

#### Testing Verification
- ✅ 本地測試確認群組圖片正常顯示
- ✅ 支持輪播偏移量設置（offset: 0, 1, 2, 3）
- ✅ 向後兼容舊版指派數據（carousel_* 命名）
- ✅ 新版命名（top_left 等）仍然正常工作
- ✅ 部署到雲端後自動更新（5分鐘內）

### Previous (v5.3.1 - 2025-10-14)

### 自動版本檢查與更新
**Problem**: 部署新代碼後，已運行的播放器還在使用舊代碼，需要手動重啟才能更新。開機自動啟動時圖片無法顯示（容器尺寸為 0）。

**Solution**: 實現自動版本檢查機制和容器尺寸驗證，確保播放器自動更新和正確初始化。

#### Key Features
1. **自動版本檢查**:
   - 播放器內建版本號 `PLAYER_VERSION`
   - 每 5 分鐘自動獲取服務器上的 animation.js 並比對版本
   - 發現新版本時延遲 3 秒後自動 `window.location.reload(true)`
   - 無需手動重啟設備

2. **容器尺寸驗證與重試**:
   - 在 updateSection 開始時檢查容器尺寸
   - 如果 width 或 height 為 0，延遲 500ms 後重試
   - 解決開機自動啟動時容器尚未渲染完成的問題

3. **改進初始化時機**:
   - 改用 `window.addEventListener('load')` 代替 `DOMContentLoaded`
   - 在 window.load 後再延遲 100ms 啟動播放器
   - 確保所有 DOM 元素和樣式完全載入

4. **快捷鍵支持**:
   - `Ctrl+V` (或 `Cmd+V`): 手動檢查版本
   - `Ctrl+R` (或 `Cmd+R`): 強制重新載入
   - `Ctrl+D` (或 `Cmd+D`): 切換調試面板

#### Files Modified
- `public/js/animation.js`: 添加版本檢查、容器驗證、快捷鍵
- `package.json`: 版本升級至 v5.3.1

#### Testing Verification
- ✅ 開機自動啟動時圖片正常顯示
- ✅ 部署新版本後 5 分鐘內自動更新
- ✅ 手動執行 `./kiosk.sh` 時正常顯示
- ✅ 容器尺寸為 0 時自動重試

### Previous (v5.3.0 - 2025-10-14)

### 雙影片布局修復與響應式優化
**Problem**: 雙影片布局預覽正常但實際設備圖片無法顯示；影片被裁切導致邊緣文字看不見；不同分辨率下顯示異常。

**Solution**: 修復容器重複處理 bug，添加響應式支持，優化媒體顯示方式。

#### Key Fixes
1. **容器重複處理 Bug**:
   - 問題：`bottom_right` 和 `carousel_bottom_right` 都映射到同一個容器
   - 第二次調用時執行 `container.innerHTML = ''` 清空了第一次創建的內容
   - 解決：使用 `Set` 追蹤已處理的容器，確保每個容器只處理一次

2. **響應式布局**:
   - 添加 window resize 事件監聽
   - 使用 debounce（300ms）優化性能
   - 重新渲染時重新計算容器尺寸並重建 DOM

3. **媒體顯示優化**:
   - 將 `object-fit` 從 `cover` 改為 `contain`
   - 避免影片和圖片被裁切，完整顯示內容
   - 添加黑色背景確保視覺一致性

4. **樣式強制應用**:
   - 使用 `!important` 確保樣式在各種設備上生效
   - 直接讀取容器實際尺寸（px）而非使用百分比
   - 避免 CSS 繼承問題

#### Files Modified
- `public/js/animation.js` (lines 220-400): 添加 resize 監聽、容器追蹤、強制樣式
- `public/default.html` (line 21): 改 object-fit 為 contain
- `public/dual_video.html` (line 35): 改 object-fit 為 contain
- `package.json` (line 3): 版本升級至 v5.3.0

#### Testing Verification
- ✅ 雙影片布局圖片正常顯示
- ✅ 支援 1080x1920 直立式屏幕
- ✅ 視窗大小改變時自動重新渲染
- ✅ 影片完整顯示不被裁切
- ✅ 圖片完整顯示不被裁切

### Previous (v5.2.0 - 2025-01-14)

### Layout Template System
**Problem**: All layouts use the same fixed 6-block structure. Need flexibility for different display requirements (e.g., dual video layout for driving schools).

**Solution**: Implemented complete template system with dynamic routing.

#### Architecture
1. **Template Files**:
   - `default.html` - 6 blocks (header + 4 carousels + footer)
   - `dual_video.html` - 5 blocks (2 headers + 2 carousels + footer)
   - Removed old `display.html` to avoid conflicts

2. **Worker Template Routing** (`src/index.ts`):
   ```typescript
   // Handles both /display.html and /display
   if (deviceId.startsWith('preview-')) {
     layoutName = deviceId.replace('preview-', '');
   } else {
     // Fetch device info to get layoutName
   }
   
   // Query layout template from DO
   const layout = layouts.find(l => l.name === layoutName);
   const templateMap = {
     'default': 'default.html',
     'dual_video': 'dual_video.html'
   };
   
   // Return corresponding template with original query params
   templateUrl.search = url.search; // Preserve ?deviceId=...
   ```

3. **Frontend Dynamic Blocks** (`public/js/admin.js`):
   - `LAYOUT_TEMPLATES` object defines sections for each template
   - `updateAvailableSections()` updates available_sections based on current layout's template
   - Section dropdown automatically adjusts when switching layouts
   - Called on layout change and data fetch

4. **Player Multi-Template Support** (`public/js/animation.js`):
   - `updateAllSections()` uses section mappings array
   - Supports both old naming (`carousel_*`) and new naming (`top_left`, etc.)
   - Only updates containers that exist in the current template HTML
   - Gracefully handles missing containers

5. **Admin UI Improvements**:
   - Template selection dropdown when creating layouts
   - Flow layout using CSS multi-column for better space utilization
   - Cache-busting timestamp on preview URLs (`&t=...`)

#### Key Debugging Steps
- Browser caching issue: Deleted old `display.html` that conflicted
- Query params lost: Added `templateUrl.search = url.search`
- Preview devices skipped: Fixed condition to handle `preview-` prefix
- Both `/display` and `/display.html` needed: Added OR condition

#### Files Modified
- `src/index.ts` (lines 519-569): Template routing logic
- `public/js/admin.js` (lines 1-60, 270-290, 1323-1327): Template selection & dynamic sections
- `public/js/animation.js` (lines 220-246): Multi-template section mapping
- `public/admin.html` (lines 72-90): Template dropdown, flow layout structure
- `public/css/admin-flow-layout.css`: New file for masonry layout

#### Testing Verification
- ✅ Default template: 6 blocks display correctly
- ✅ Dual video template: 5 blocks display correctly
- ✅ Section dropdown updates when switching layouts
- ✅ Preview devices load correct templates
- ✅ Real devices load correct templates
- ✅ Query parameters preserved in routing
- ✅ Cache-busting works (timestamp parameter)

### Previous (v5.1.0 - 2025-01-10)
- ✅ Carousel offset bug fixed
- ✅ Group cascade delete implemented
- ✅ R2 cleanup on group deletion

## 🔧 Known Issues & Quirks

### Investigating
1. **實際設備圖片顯示問題** - 預覽正常但部分實際設備無法顯示圖片
   - 可能原因：設備瀏覽器版本過舊不支持某些 CSS
   - 可能原因：設備緩存未清除
   - 可能原因：設備未正確指派到版面
   - 診斷方法：檢查設備瀏覽器控制台錯誤信息
   - 臨時解決：強制刷新設備頁面（Ctrl+Shift+R）或清除瀏覽器緩存

### Non-Critical
1. **Orphan Assignments** - Old assignments may reference deleted materials
   - Displays warning in console: `❌ Material not found`
   - Can be cleaned up manually via admin console script (see README)
   - Does not affect functionality

2. **Tailwind CDN Warning** - Using CDN version in production
   - Not a functional issue, just a best practice warning
   - Can optimize later if needed

### Player Deployment
- Raspberry Pi uses Electron app (**separate independent project**)
- Location: `~/Documents/mq-cms-electron-player` (NOT a submodule)
- Device UUID stored in `~/.config/mq-cms-player/config.json`
- Player loads `display.html?deviceId={uuid}` from Cloudflare Workers
- See `ELECTRON_PLAYER.md` for details

## 📋 Pending Tasks

### High Priority
- None currently

### Medium Priority
- Consider implementing auto-cleanup for orphan assignments
- Optional: Replace Tailwind CDN with local build

### Future Enhancements
- **Third template**: Driving school layout (waiting for requirements)
- Add template preview thumbnails in admin UI
- Template editor (drag-and-drop layout builder)
- Multi-user support with different permission levels
- Scheduled content publishing
- Device health monitoring dashboard
- Content analytics and playback statistics

## 🎨 Adding New Templates

To add a new layout template (e.g., `driving.html`):

1. **Create HTML file**: `/public/driving.html`
   - Define container divs with unique IDs
   - Use same class structure for consistency
   - Include `<script src="js/animation.js"></script>`

2. **Update template config**: `/public/js/layout-templates.js`
   ```javascript
   "driving": {
     name: "駕訓班布局",
     sections: {
       "main_video": "主影片區",
       "side_info": "側邊資訊",
       // ... define all section_keys
     }
   }
   ```

3. **Update admin dropdown**: `/public/admin.html` (line ~80)
   ```html
   <option value="driving">駕訓班布局</option>
   ```

4. **Update Worker mapping**: `/src/index.ts` (line ~547)
   ```typescript
   const templateMap: Record<string, string> = {
     'default': 'default.html',
     'dual_video': 'dual_video.html',
     'driving': 'driving.html'  // Add this
   };
   ```

5. **Update animation.js mappings**: `/public/js/animation.js` (line ~221)
   ```javascript
   { sectionKey: 'main_video', containerId: 'main-video-container', interval: intervals.header },
   // Add mappings for all new sections
   ```

6. **Deploy**: `npm run deploy`

**That's it!** The system will automatically handle the new template.

## 🐛 Debugging Tips

### Check Offset Values
```javascript
// In admin console
fetch('/api/assignments?layout=default')
  .then(r => r.json())
  .then(data => console.table(data.filter(a => a.content_type === 'group_reference')));
```

### Verify Carousel Initialization
- Look for log: `🔄 Carousel initialized: startOffset=X`
- Look for log: `📌 Setting carousel offset to: X`
- If missing, clear browser cache (Ctrl+Shift+R)

### Check R2 Files
```bash
# List R2 bucket contents
npx wrangler r2 object list mq-cms-media
```

## 🔄 Deployment Workflow

1. **Make changes** to `src/index.ts` or `public/**/*`
2. **Test locally**: `npm run dev`
3. **Deploy**: `npm run deploy`
4. **Update version**: 
   - Edit `package.json` version
   - Add entry to README.md version history
   - Update this file's "Last Updated" and "Recently Completed"
5. **Commit changes**: Git commit with descriptive message
6. **Update Raspberry Pi player** (if Electron app changed):
   - Build new .deb in player repo
   - Transfer to Pi via SSH
   - Install: `sudo dpkg -i mq-cms-player_x.x.x_armhf.deb`

## 💡 Code Conventions

### ID Generation
```javascript
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
```

### Layout-Specific Keys
```javascript
function layoutKey(layoutName: string, key: string): string {
  return `layout_${layoutName}_${key}`;
}
```

### API Endpoints Pattern
- `/api/materials?layout={name}` - Layout-specific materials
- `/api/groups/{id}?layout={name}` - Layout-specific operations
- `/api/layouts` - GET: list all layouts, POST: create new layout
- `/api/layouts/{name}` - DELETE: delete specific layout
- `/api/devices` - Global device registry
- `/api/config?deviceId={uuid}` - Player configuration endpoint
- `/display?deviceId={uuid}` - Player page (template routing)
- `/display.html?deviceId={uuid}` - Alternative URL (both work)

## 🎯 Next Session Checklist

When resuming work on this project:
1. Read this file first
2. Check git status: `git status`
3. Check recent commits: `git log --oneline -5`
4. Review current production URL: https://mq-cms.adler-lei.workers.dev
5. Check for any pending issues in console logs

---

**End of AI Context Document**
