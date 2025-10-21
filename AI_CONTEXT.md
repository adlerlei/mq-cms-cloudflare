# AI Context - MQ CMS Project

> **Last Updated**: 2025-10-21  
> **Current Version**: v5.4.2  
> **Status**: Production Ready  
> **Language**: Traditional Chinese (繁體中文)

---

## 🎯 Project Overview

**MQ CMS** is a Cloudflare Workers-based digital signage content management system designed for managing multiple display devices and content layouts.

### Tech Stack
- **Backend**: Cloudflare Workers + Durable Objects + R2 Storage
- **Frontend**: Vanilla JavaScript + Bulma CSS
- **Player**: Web-based (HTML templates) + Electron app for Raspberry Pi
- **Real-time**: WebSocket for live content updates

### Key Features
1. **Multi-layout Management**: Create multiple layouts with different templates
2. **Device Management**: Auto-registration, assignment to layouts
3. **Media Management**: Image/video upload to R2, assignment to sections
4. **Carousel Groups**: Create image carousels with drag-sort and offset control
5. **Real-time Updates**: WebSocket push for instant content refresh
6. **Debug Mode**: URL-based debug mode with comprehensive logging

---

## 📂 Project Structure

```
mq-cms-cloudflare/
├── src/
│   └── index.ts              # Worker entry + Durable Object + API routes
├── public/
│   ├── admin.html            # Admin interface
│   ├── login.html            # Login page
│   ├── preview.html          # Layout preview selector (auto-debug enabled)
│   ├── default.html          # Default 6-block layout template
│   ├── dual_video.html       # Dual video 5-block layout template
│   ├── driving_school.html   # Driving school 4-zone layout template
│   ├── js/
│   │   ├── admin.js          # Admin logic
│   │   └── animation.js      # Player carousel logic
│   └── css/
│       ├── bulma.css         # UI framework
│       ├── admin.css         # Admin styles
│       └── admin-flow-layout.css  # Flow layout
├── wrangler.toml             # Cloudflare config
└── package.json              # Dependencies (v5.4.2)
```

---

## 🗄️ Data Architecture

### Durable Object Storage Keys
```
layout_{layoutName}_materials   - Media files metadata
layout_{layoutName}_assignments - Content section assignments
layout_{layoutName}_groups      - Carousel groups
layout_{layoutName}_settings    - Playback intervals
layouts                         - List of all layouts
devices                         - Device registry
```

### Key Interfaces

```typescript
interface MediaMaterial {
  id: string;
  filename: string;           // R2 object key (timestamped)
  original_filename?: string; // Original uploaded filename
  type: 'image' | 'video';
  url: string;
  size?: number;
}

interface Assignment {
  id: string;
  section_key: string;        // e.g., 'top_left', 'header_video'
  content_type: 'single_media' | 'group_reference';
  content_id: string;         // material.id or group.id
  offset?: number;            // Carousel start position (0-based index)
}

interface CarouselGroup {
  id: string;
  name: string;
  materials: string[];        // Array of material IDs (ordered)
}

interface Layout {
  name: string;
  template: string;           // 'default' or 'dual_video'
  created_at: string;
}
```

### Section Keys by Template

**Default Template** (6 sections):
- `header_video` - Top video area
- `top_left`, `top_right` - Top carousel sections
- `bottom_left`, `bottom_right` - Bottom carousel sections
- `footer_content` - Footer area

**Dual Video Template** (5 sections):
- `header_video` - First top video
- `header_1_video` - Second top video
- `bottom_left`, `bottom_right` - Bottom carousel sections
- `footer_content` - Footer area

**Driving School Template** (4 sections, 2x2 grid):
- `zone_1` - Top-left (50% width × 50% height)
- `zone_2` - Top-right (50% width × 50% height)
- `zone_3` - Bottom-left (50% width × 50% height)
- `zone_4` - Bottom-right (50% width × 50% height)

**Legacy Aliases** (supported for backward compatibility):
- `carousel_top_left` → `top_left`
- `carousel_top_right` → `top_right`
- `carousel_bottom_left` → `bottom_left`
- `carousel_bottom_right` → `bottom_right`

---

## 🔧 Recent Major Changes

### v5.4.2 (2025-10-21) - Carousel Animation Fix

**Critical Bug Fix**: Fixed carousel infinite loop animation issue.

**Problem Solved**:
- ❌ Previous: Carousel showed blank screen or jumped without animation when looping back to first slide
- ✅ Now: Smooth sliding animation for all transitions using standard infinite carousel technique

**Implementation**:
1. **Clone First Item**: Append a clone of the first item to the end of the carousel
2. **Seamless Loop**: When reaching the clone, slide to it with animation, then instantly reset to real first item
3. **User Experience**: Users see continuous smooth sliding without any jumps or blank screens

**Technical Details**:
```
Original: [A] [B] [C]
Modified: [A] [B] [C] [A-clone]

Flow: A → B → C → A-clone (animated) → instant reset to A (invisible) → loop
User sees: A → B → C → A → B → C (perfect loop!)
```

**Modified File**: `public/js/animation.js`
- Added first item cloning logic in `initializeGenericCarousel()`
- Updated `playNext()` to handle clone detection and seamless reset
- Fixed `playCurrent()` to use correct index calculation

**Benefits**:
- ✅ All transitions have smooth sliding animation
- ✅ No blank screens between last and first slide
- ✅ No jarring jumps or instant transitions
- ✅ Works with any number of slides (2, 3, 5, 10+)
- ✅ Industry-standard infinite carousel implementation

---

### v5.4.0 (2025-10-21) - New Template: Driving School Layout

**Feature**: Added new template "driving_school" for vertical digital signage (1080x1920).

**Use Case**: Traffic safety promotion content for driving schools.

**Layout Structure**:
- 4 equal zones in 2x2 grid layout (50% width, 50% height each)
- Pure image carousel (no video support needed)
- Optimized for portrait orientation (1080x1920)

**Changes**:

1. **New Template File**: `public/driving_school.html`
   - 4 zones: `zone_1` (左上), `zone_2` (右上), `zone_3` (左下), `zone_4` (右下)
   - Grid layout: 2x2 (each zone 50% width × 50% height)
   - Tailwind CSS flexbox layout
   - Debug overlay support

2. **Template Configuration**: `public/js/admin.js`
   - Added "driving_school" to `LAYOUT_TEMPLATES`
   - Section keys: `zone_1`, `zone_2`, `zone_3`, `zone_4`
   - Chinese labels: "左上區塊", "右上區塊", "左下區塊", "右下區塊"
   - Dynamic template name in success notification

3. **Admin Interface**: `public/admin.html`
   - Added dropdown option: "駕訓班-交通安全宣導"
   - Template selector updated

4. **Preview System**: `public/preview.html`
   - Added routing for `driving_school.html`
   - Automatic template file detection

5. **Animation Engine**: `public/js/animation.js`
   - Added section mappings for `zone_1` through `zone_4`
   - Maps to container IDs: `slot-zone-1` through `slot-zone-4`
   - Uses carousel intervals for all zones

**Benefits**:
- ✅ Easy to extend: Clean template architecture
- ✅ Reusable: Same carousel logic as other templates
- ✅ Maintainable: Consistent naming conventions
- ✅ Flexible: Can be used for similar vertical layouts

---

### v5.3.6 (2025-10-17) - Debug Experience Optimization

**Problem**: Keyboard shortcuts for debug mode were unreliable across different browsers and not user-friendly.

**Solution**: Replace keyboard shortcuts with UI-based debug access.

**Changes**:

1. **Admin Debug Button**
   - Location: Top-right navbar, left of logout button
   - Icon: 🐛 Bug icon
   - Function: Opens preview.html in new tab
   - Style: Blue button (`is-info is-light`)
   - File: `public/admin.html`

2. **Auto-debug in preview.html**
   - All preview links automatically append `&debug=true`
   - Template-aware: selects `default.html` or `dual_video.html` based on layout.template
   - Button text: "預覽 {layout.name} 版面 (調試模式)"
   - Icon: Bug instead of play icon
   - File: `public/preview.html`

3. **Removed Keyboard Shortcuts**
   - Deleted: `Ctrl+Shift+D`, `Ctrl+D`, `Ctrl+R`, `Ctrl+V`
   - Reason: Cross-browser compatibility issues, not intuitive
   - Kept: URL parameter control (`?debug=true`)
   - File: `public/js/animation.js` (~40 lines removed)

4. **Updated Debug Tip**
   - From: "Press Ctrl+Shift+D to toggle debug mode"
   - To: "Debug mode enabled via URL parameter"

**Benefits**:
- ✅ Better UX: Click button instead of remembering shortcuts
- ✅ Cross-browser: Works everywhere consistently
- ✅ Discoverable: Visible in UI
- ✅ Cleaner code: 40 lines removed

---

### v5.3.5 (2025-10-16) - Carousel Offset Persistence Fix

**Critical Bug**: Carousel offset reset to 0 after WebSocket updates or tab switches.

**Root Cause**:
1. On each `updateAllSections()` call, `container.innerHTML = ''` clears the container
2. New `carouselContainer` DOM element created
3. Carousel position `_currentCarouselIndex` saved on new element
4. Next update destroys old element → saved position lost
5. Carousel always restarted from `startOffset`

**User Impact**:
- User sets offset=2 for top_left (start from 3rd image)
- Carousel plays: image 3→4→5→6...
- WebSocket reconnects or content updated
- **Bug**: Carousel jumps back to image 3 (offset=2)
- **Expected**: Continue from current image (e.g., image 6)

**Solution**: Save carousel position on outer container (not inner dynamically-created element)

```javascript
// Before (BROKEN)
const carouselContainer = document.createElement('div');
initializeGenericCarousel(carouselContainer, ...);
// Position saved on carouselContainer, which gets destroyed on next update

// After (FIXED)
function initializeGenericCarousel(containerElement, slideInterval, startOffset = 0, outerContainer = null) {
    const stateContainer = outerContainer || containerElement;  // Use outer container
    
    // Check for saved position
    if (stateContainer._currentCarouselIndex !== undefined && 
        stateContainer._currentCarouselIndex < items.length) {
        currentIndex = stateContainer._currentCarouselIndex;  // Restore position
        debugLog(`🔄 Carousel re-initialized: preserving position=${currentIndex}`);
    } else {
        currentIndex = Math.max(0, Math.min(startOffset, items.length - 1));
        debugLog(`🔄 Carousel initialized: startOffset=${startOffset}`);
    }
    
    // Save position on outer container (persists across updates)
    stateContainer._currentCarouselIndex = currentIndex;
}

// Pass outer container when calling
initializeGenericCarousel(carouselContainer, slideInterval, carouselOffset, container);
```

**Additional Fixes**:
1. **Smart Resize**: Only re-render if window size changes >10px
2. **Visibility Tracking**: Added `visibilitychange` event listener for tab switches
3. **Enhanced Debug Logs**: Clear position preservation tracking

**Testing Verified**:
- ✅ Initial load: Correct offset applied
- ✅ WebSocket reconnect: Position preserved
- ✅ Tab switch: Position preserved
- ✅ Content update: Position preserved
- ✅ Window resize (small): No unnecessary re-render
- ✅ Window resize (large): Re-render with position preserved

**Files Modified**:
- `public/js/animation.js`: Added `outerContainer` parameter, smart resize logic

---

### v5.3.4 (2025-10-16) - Remove Grid View

**Problem**: Media library had two view modes (table/grid). Grid view was not useful.

**Solution**: Removed grid view completely, simplified code by 150+ lines.

**Benefits**:
- Cleaner UI (no unnecessary toggle)
- Simpler code (only one view to maintain)
- Better UX (table view is more informative)

---

### v5.3.3 (2025-10-16) - Debug Mode System

**Added**: URL parameter-based debug mode (`?debug=true`)

**Features**:
- Conditional logging (only when debug enabled)
- Three log functions: `debugLog()`, `errorLog()`, `warnLog()`
- Production performance: No debug overhead when disabled

---

### v5.3.2 (2025-10-16) - Group Carousel Display Fix

**Problem**: Group carousel not displaying images despite assignments existing.

**Root Cause**: Section key mismatch (admin saved `carousel_top_left`, player looked for `top_left`)

**Solution**: Added section key alias mapping to support both old and new naming.

---

## 🚀 Deployment

**Production URL**: https://mq-cms.adler-lei.workers.dev

**Admin Access**:
- URL: `/admin.html`
- Username: `admin`
- Password: `admin123`

**Debug Preview**:
- Click **Debug** button in admin (top-right)
- Or visit: `/preview.html` (all links have `&debug=true`)

**Direct URLs**:
```
Admin:    /admin.html
Preview:  /preview.html
Default:  /default.html?deviceId=preview-default&debug=true
Dual:     /dual_video.html?deviceId=preview-dual_video&debug=true
```

---

## 🐛 Debug Mode Details

**Activation**: URL parameter `?debug=true`

**Access Methods**:
1. Admin → Debug button → Preview selector → Auto-enabled
2. Direct URL: `...?deviceId=xxx&debug=true`

**Debug Logs Include**:
- 📊 All internal processing logic
- 🔍 Carousel initialization with offset tracking
- 📡 WebSocket connection status
- 🎯 Content loading and section updates
- 💾 Position persistence tracking
- 🔄 Re-initialization events

**Console Output Example**:
```
🐞 Debug mode enabled via URL parameter
🚀 Initializing MQ CMS Player...
✅ Device ID obtained: preview-default
📌 Current player version: 5.3.6
📐 Container #slot-top-left dimensions: {width: 540, height: 554}
📍 Section top_left: found 1 assignments
📌 Found carousel offset: 2 (from assignment xxx)
🎯 Initializing carousel for top_left with offset=2, total items=8
🔄 Carousel initialized: startOffset=2, items.length=8, currentIndex=2
✅ WebSocket connected successfully

[After update]
📨 WebSocket message received: {type: 'section_updated', ...}
🔄 Carousel re-initialized: preserving position=5, items.length=8  ✅
```

---

## 📝 Code Patterns & Best Practices

### Carousel Offset Handling
```javascript
// 1. Find offset from first assignment that has one
let carouselOffset = 0;
for (const assignment of sectionAssignments) {
    if (assignment.offset !== undefined && assignment.offset !== null) {
        carouselOffset = assignment.offset;
        debugLog(`📌 Found carousel offset: ${assignment.offset}`);
        break;
    }
}

// 2. Initialize carousel with position persistence
initializeGenericCarousel(carouselContainer, slideInterval, carouselOffset, outerContainer);
```

### Section Key Aliasing
```javascript
const sectionKeyAliases = {
    'top_left': ['top_left', 'carousel_top_left'],
    'top_right': ['top_right', 'carousel_top_right'],
    // ... etc
};
const possibleKeys = sectionKeyAliases[sectionKey] || [sectionKey];
const assignments = data.assignments.filter(a => possibleKeys.includes(a.section_key));
```

### Debug Logging
```javascript
let DEBUG_MODE = false;

function debugLog(...args) {
    if (DEBUG_MODE) console.log(...args);
}

function errorLog(...args) {
    console.error(...args);  // Always log errors
}

// Enable via URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('debug') === 'true') {
    DEBUG_MODE = true;
}
```

---

## 🔒 Security Notes

- Login uses JWT tokens (stored in localStorage)
- Default credentials: `admin` / `admin123` (should be changed)
- API routes protected with `fetchWithAuth()` wrapper
- Durable Object storage isolated per layout

---

## 📊 Version History Summary

| Version | Date | Key Changes |
|---------|------|-------------|
| v5.4.2 | 2025-10-21 | Carousel infinite loop animation fix (clone technique) |
| v5.4.0 | 2025-10-21 | New template: Driving school (4-zone portrait) |
| v5.3.6 | 2025-10-17 | Debug button, remove keyboard shortcuts |
| v5.3.5 | 2025-10-16 | Carousel offset persistence fix |
| v5.3.4 | 2025-10-16 | Remove grid view |
| v5.3.3 | 2025-10-16 | Debug mode system |
| v5.3.2 | 2025-10-16 | Group carousel fix |
| v5.3.1 | 2025-10-14 | Auto version check |
| v5.2.0 | 2025-01-14 | Layout template system |

---

## 🛠️ Development Notes

### File Cleanup History
- Removed: `test/` directory (testing not needed for private project)
- Removed: `vitest.config.mts`, test dependencies from package.json
- Removed: `.DS_Store` files (macOS cache)
- Removed: `.claude/`, `.qodo/` directories (dev tool cache)
- Kept: `preview.html` (useful preview selector)
- Can remove: `cleanup-orphans.html` (backend has auto-cleanup)

### Code Reduction
- v5.3.6: -40 lines (keyboard shortcuts)
- v5.3.5: +80 lines (position persistence)
- v5.3.4: -150 lines (grid view removal)
- Total net reduction: ~110 lines cleaner codebase

---

## 💬 Communication Language

**IMPORTANT**: All communication with the user must be in **Traditional Chinese (繁體中文)**.

This AI_CONTEXT.md file is written in English for AI parsing efficiency, but all user-facing responses, UI text, documentation meant for humans (README.md), and conversations must use Traditional Chinese.

Example:
- ✅ User: "請幫我修復這個問題"
- ✅ Assistant: "好的！我來幫你檢查問題..."
- ❌ Assistant: "OK! Let me check the problem..."

---

**End of AI Context**
