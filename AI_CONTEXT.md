# AI Context - MQ CMS Project

> **Last Updated**: 2025-01-14  
> **Current Version**: v5.2.0  
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

## ✅ Recently Completed (v5.2.0 - 2025-01-14)

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
