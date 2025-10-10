# AI Context - MQ CMS Project

> **Last Updated**: 2025-01-10  
> **Current Version**: v5.1.0  
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
  ├── admin.html          # Admin interface
  ├── display.html        # Player page
  ├── preview.html        # Layout preview page
  └── js/
      ├── admin.js        # Admin logic
      └── animation.js    # Player carousel logic
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
  section_key: string;     // e.g., 'carousel_top_left'
  content_type: 'single_media' | 'group_reference';
  content_id: string;      // material.id or group.id
  offset?: number;         // For group carousel start position
}

interface CarouselGroup {
  id: string;
  name: string;
  materials: string[];     // Array of material IDs
}
```

## ✅ Recently Completed (v5.1.0 - 2025-01-10)

### Fixed Issues
1. **Carousel Offset Bug**
   - Problem: Form field name mismatch (`carousel_offset` vs `offset`)
   - Fix: Changed `admin.js` to read `offset` field correctly
   - Location: `public/js/admin.js` line 614

2. **Group Cascade Delete**
   - Problem: Deleting group left orphaned images in media library
   - Fix: Implemented cascade delete in Worker layer
   - Location: `src/index.ts` lines 418-494
   - Now deletes:
     - Group metadata
     - All materials in group
     - R2 files
     - Related assignments

### Verification
- ✅ Offset feature works (tested with offset=0 and offset=1)
- ✅ Group deletion removes all associated materials
- ✅ Raspberry Pi player displays group carousel correctly
- ✅ WebSocket updates work properly

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
- Multi-user support with different permission levels
- Scheduled content publishing
- Device health monitoring dashboard
- Content analytics and playback statistics

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
- `/api/devices` - Global device registry
- `/api/config?deviceId={uuid}` - Player configuration endpoint

## 🎯 Next Session Checklist

When resuming work on this project:
1. Read this file first
2. Check git status: `git status`
3. Check recent commits: `git log --oneline -5`
4. Review current production URL: https://mq-cms.adler-lei.workers.dev
5. Check for any pending issues in console logs

---

**End of AI Context Document**
