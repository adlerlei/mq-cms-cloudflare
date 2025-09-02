# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

MQ CMS is a Cloudflare Workers-based content management system for media display and carousel management. It's a production-ready system (v4.7.0) that uses modern serverless architecture with real-time updates.

## Core Architecture

### Backend (Cloudflare Workers)
- **Single Worker Entry**: `src/index.ts` - Main worker handling HTTP requests, WebSocket connections, and routing
- **Durable Objects**: `MessageBroadcaster` class for persistent state management and real-time notifications
- **Storage**: R2 bucket for media files, Durable Objects storage for metadata
- **Real-time**: WebSocket connections for instant content synchronization

### Frontend Structure
- **Admin Interface**: `public/admin.html` - Complete content management dashboard
- **Display Page**: `public/display.html` - Media exhibition interface with 6 display sections
- **Login**: `public/login.html` - JWT-based authentication
- **JavaScript Modules**: Modular JS files in `public/js/` for different concerns

### Key Data Models
```typescript path=null start=null
interface MediaMaterial {
  id: string;
  filename: string;
  type: 'image' | 'video';
  url: string;
  group_id?: string; // For carousel group membership
}

interface Assignment {
  section_key: string;
  content_type: 'single_media' | 'group_reference';
  content_id: string;
  offset?: number; // For carousel starting position
}

interface CarouselGroup {
  id: string;
  name: string;
  materials: MediaMaterial[];
}
```

## Development Commands

### Essential Commands
```bash
# Local development server
npm run dev
# or
wrangler dev

# Deploy to production
npm run deploy
# or 
wrangler deploy

# Run tests
npm test
# or
vitest

# Generate Cloudflare types
npm run cf-typegen
# or
wrangler types
```

### Cloudflare Setup Commands
```bash
# Login to Cloudflare (required for deployment)
npx wrangler login

# Create R2 storage bucket (one-time setup)
npx wrangler r2 bucket create mq-cms-media

# View deployment logs
wrangler tail

# Access Durable Objects storage (for debugging)
wrangler d1 execute --local --command "SELECT * FROM materials"
```

## Testing

### Test Structure
- **Main test file**: `test/index.spec.ts`
- **Test environment**: Vitest with Cloudflare Workers testing utilities
- **Coverage**: Basic API endpoints and routing
- **Note**: WebSocket tests are commented out due to Durable Object storage isolation

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
vitest --watch

# Run specific test file
vitest test/index.spec.ts
```

## Key Development Areas

### Durable Objects Management
The `MessageBroadcaster` class handles:
- WebSocket connection management with heartbeat
- Persistent storage for media metadata, assignments, and carousel groups
- Real-time section-specific update notifications
- State synchronization across all connected clients

### Media Upload Flow
1. Files uploaded via `public/admin.html` form
2. Processed in main worker (`src/index.ts`)
3. Stored in R2 bucket with metadata in Durable Objects
4. Real-time notifications sent to display clients

### Section Update System
The system uses targeted notifications instead of global broadcasts:
- Each display section (header, 4 carousel areas, footer) receives specific updates
- Updates include: upload, delete, assign, unassign, group_update actions
- WebSocket clients filter updates by section relevance

### Carousel Group Management
- Groups contain multiple images with drag-and-drop ordering
- Support for batch upload and offset positioning
- Cascade deletion removes group materials when group is deleted

## Common Development Patterns

### Adding New API Endpoints
API routes are handled in the main worker fetch handler:
```typescript path=null start=null
// In MessageBroadcaster.fetch() method
if (url.pathname === '/api/new-endpoint') {
  if (request.method === 'GET') {
    // Handle GET request
  } else if (request.method === 'POST') {
    // Handle POST request
  }
}
```

### WebSocket Communication
Real-time updates use section-specific messaging:
```typescript path=null start=null
interface SectionUpdateNotification {
  type: 'section_updated';
  section_key: string; // 'header', 'carousel_1', etc.
  action: 'upload' | 'delete' | 'assign' | 'unassign' | 'group_update';
  content_type?: 'single_media' | 'group_reference';
  content_id?: string;
}
```

### Frontend Module Pattern
JavaScript is organized into focused modules:
- `admin.js` - Admin interface logic and drag-and-drop
- `animation.js` - Display page carousel animations and WebSocket handling
- `api.js` - Centralized API communication
- `store.js` - Client-side state management
- `ui.js` - UI components and interactions
- `eventHandlers.js` - Event delegation and handlers

## Configuration Files

### wrangler.toml
- **Durable Objects**: `MESSAGE_BROADCASTER` binding to `MessageBroadcaster` class
- **R2 Bucket**: `MEDIA_BUCKET` binding to `mq-cms-media` bucket
- **Assets**: Static files served from `./public` directory
- **Migrations**: Using tag `v2` for Durable Objects schema

### Authentication
- **Default credentials**: admin/admin123 (development only)
- **JWT-based**: Simple token system for session management
- **Security note**: Production deployments need stronger authentication

## Display Layout
The system manages 6 content sections:
- Header video area
- 4 carousel blocks (top-left, top-right, bottom-left, bottom-right)
- Footer content area

Each section can display either single media or carousel groups with configurable intervals and offsets.
