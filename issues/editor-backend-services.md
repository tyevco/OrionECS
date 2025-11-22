# Backend Services & Infrastructure

**Milestone:** v1.1.0 - Editor Foundation
**Priority:** Critical
**Labels:** editor, backend, api, infrastructure
**Impact:** Editor Development, Cloud Features

## Description

Build the backend services and infrastructure to support the browser-based game editor. This includes project management, user authentication, file storage, asset hosting, build pipeline, and all necessary APIs for the editor to function as a cloud-based service.

## Goals

- Provide robust project storage and management
- Enable user authentication and authorization
- Host and serve game assets via CDN
- Support cloud-based builds
- Enable real-time collaboration
- Provide scalable, reliable infrastructure

## Dependencies

- Node.js backend runtime
- PostgreSQL database
- S3-compatible object storage
- Redis for caching/sessions
- WebSocket server for real-time features

## Subtasks

### 1. Backend Architecture & Setup
- [ ] Choose backend framework (Express, Fastify, NestJS)
- [ ] Set up TypeScript project structure
- [ ] Configure database connections
- [ ] Set up ORM (Prisma, TypeORM, Drizzle)
- [ ] Configure logging (Winston, Pino)
- [ ] Set up error handling
- [ ] Configure environment variables

### 2. Database Schema Design
- [ ] Users table (id, email, username, auth)
- [ ] Projects table (id, name, owner, settings)
- [ ] Project files table (project_id, path, content)
- [ ] Assets table (id, project_id, url, metadata)
- [ ] Collaborators table (project_id, user_id, role)
- [ ] Builds table (id, project_id, status, artifacts)
- [ ] Templates table (id, name, description, files)
- [ ] Plugins table (id, name, version, author)

### 3. Database Implementation
- [ ] Create migration system
- [ ] Implement schema migrations
- [ ] Set up database indexes
- [ ] Configure connection pooling
- [ ] Implement database backups
- [ ] Add query performance monitoring
- [ ] Set up read replicas (scaling)

### 4. Authentication & Authorization
- [ ] Choose auth provider (Auth0, Clerk, custom)
- [ ] Implement JWT authentication
- [ ] Add OAuth providers (GitHub, Google)
- [ ] Email/password authentication
- [ ] Refresh token rotation
- [ ] Session management
- [ ] Role-based access control (RBAC)
- [ ] API key authentication for builds

### 5. Project Management API
- [ ] POST /api/projects - Create project
- [ ] GET /api/projects - List user's projects
- [ ] GET /api/projects/:id - Get project details
- [ ] PUT /api/projects/:id - Update project
- [ ] DELETE /api/projects/:id - Delete project
- [ ] POST /api/projects/:id/duplicate - Duplicate project
- [ ] GET /api/projects/:id/export - Export project
- [ ] POST /api/projects/import - Import project

### 6. File Management API
- [ ] GET /api/projects/:id/files - List all files
- [ ] GET /api/projects/:id/files/*path - Get file content
- [ ] PUT /api/projects/:id/files/*path - Update file
- [ ] POST /api/projects/:id/files/*path - Create file
- [ ] DELETE /api/projects/:id/files/*path - Delete file
- [ ] POST /api/projects/:id/files/batch - Batch operations
- [ ] GET /api/projects/:id/tree - Get file tree

### 7. Asset Management API
- [ ] POST /api/assets/upload - Upload asset
- [ ] GET /api/assets/:id - Get asset metadata
- [ ] GET /api/assets/:id/download - Download asset
- [ ] DELETE /api/assets/:id - Delete asset
- [ ] POST /api/assets/batch-upload - Batch upload
- [ ] GET /api/projects/:id/assets - List project assets
- [ ] PUT /api/assets/:id/optimize - Optimize asset

### 8. Object Storage Integration
- [ ] Set up S3 or MinIO
- [ ] Configure buckets (assets, builds, exports)
- [ ] Implement upload with presigned URLs
- [ ] Add multipart upload for large files
- [ ] Configure CORS for browser uploads
- [ ] Set up CDN (CloudFront/Cloudflare)
- [ ] Implement asset versioning
- [ ] Add automatic cleanup of old assets

### 9. Build Service API
- [ ] POST /api/builds - Trigger new build
- [ ] GET /api/builds/:id - Get build status
- [ ] GET /api/builds/:id/logs - Stream build logs
- [ ] GET /api/builds/:id/artifacts - Download artifacts
- [ ] DELETE /api/builds/:id - Delete build
- [ ] POST /api/builds/:id/retry - Retry failed build
- [ ] GET /api/projects/:id/builds - List project builds

### 10. Build Pipeline Implementation
- [ ] Docker-based build environment
- [ ] Queue system (Bull, BullMQ)
- [ ] Build worker processes
- [ ] TypeScript compilation
- [ ] esbuild bundling
- [ ] Asset optimization
- [ ] Platform-specific packaging (Web, Electron, etc.)
- [ ] Build artifact storage

### 11. Collaboration Service
- [ ] WebSocket server (Socket.io)
- [ ] Room management (project-based)
- [ ] Presence tracking (active users)
- [ ] Real-time file updates
- [ ] Cursor position sharing
- [ ] Chat/comments system
- [ ] Operational Transform or CRDT
- [ ] Conflict resolution

### 12. Template & Plugin Registry
- [ ] GET /api/templates - List templates
- [ ] GET /api/templates/:id - Get template
- [ ] POST /api/projects/from-template/:id - Create from template
- [ ] GET /api/plugins - List plugins
- [ ] GET /api/plugins/:id - Get plugin
- [ ] POST /api/plugins/:id/install - Install plugin
- [ ] GET /api/plugins/search - Search plugins

### 13. Caching Layer
- [ ] Set up Redis
- [ ] Cache user sessions
- [ ] Cache project metadata
- [ ] Cache file tree structure
- [ ] Cache build artifacts
- [ ] Implement cache invalidation
- [ ] Add cache warming strategies

### 14. Rate Limiting & Security
- [ ] Rate limiting per endpoint
- [ ] Request throttling
- [ ] DDoS protection
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Security headers (CORS, CSP)

### 15. Monitoring & Observability
- [ ] Application logging
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic, Datadog)
- [ ] API analytics
- [ ] Database query monitoring
- [ ] Build pipeline metrics
- [ ] User activity tracking
- [ ] Health check endpoints

### 16. API Documentation
- [ ] OpenAPI/Swagger specification
- [ ] Interactive API docs (Swagger UI)
- [ ] API versioning strategy
- [ ] Request/response examples
- [ ] Error code documentation
- [ ] Rate limit documentation
- [ ] Authentication guide

### 17. Deployment & DevOps
- [ ] Docker containerization
- [ ] Kubernetes manifests
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Database migration automation
- [ ] Blue-green deployment
- [ ] Auto-scaling configuration
- [ ] Backup and recovery procedures

## Success Criteria

- [ ] All APIs respond in < 200ms (95th percentile)
- [ ] 99.9% uptime SLA
- [ ] Handles 1000+ concurrent users
- [ ] Secure authentication and authorization
- [ ] Assets served via CDN with low latency
- [ ] Builds complete in < 5 minutes
- [ ] Real-time collaboration is responsive
- [ ] Comprehensive API documentation

## Implementation Notes

**Tech Stack:**
```json
{
  "runtime": "Node.js 20+",
  "framework": "Fastify",
  "language": "TypeScript",
  "database": "PostgreSQL 15+",
  "orm": "Prisma",
  "cache": "Redis 7+",
  "storage": "MinIO (S3-compatible)",
  "queue": "BullMQ",
  "websocket": "Socket.io",
  "auth": "JWT + Auth0",
  "monitoring": "Sentry + Prometheus",
  "deployment": "Docker + Kubernetes"
}
```

**Database Schema:**
```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  is_public BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project Files
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  path VARCHAR(500) NOT NULL,
  content TEXT,
  size INTEGER,
  hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, path)
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- 'image', 'audio', 'font', etc.
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  size INTEGER,
  mime_type VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Collaborators
CREATE TABLE collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'viewer', -- 'owner', 'editor', 'viewer'
  invited_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Builds
CREATE TABLE builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'building', 'success', 'failed'
  target VARCHAR(50), -- 'web', 'electron', 'cordova'
  logs TEXT,
  artifact_url VARCHAR(500),
  artifact_size INTEGER,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_files_project ON project_files(project_id);
CREATE INDEX idx_assets_project ON assets(project_id);
CREATE INDEX idx_builds_project ON builds(project_id);
CREATE INDEX idx_builds_status ON builds(status);
```

**API Structure:**
```typescript
// Project Management
app.post('/api/projects', authenticateUser, async (req, res) => {
  const { name, description, templateId } = req.body;
  const userId = req.user.id;

  const project = await prisma.project.create({
    data: {
      userId,
      name,
      description,
      settings: {}
    }
  });

  if (templateId) {
    await copyTemplateFiles(templateId, project.id);
  }

  res.json({ project });
});

// File Management
app.put('/api/projects/:id/files/*', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const path = req.params['*'];
  const { content } = req.body;

  await checkProjectAccess(req.user.id, id, 'write');

  const file = await prisma.projectFile.upsert({
    where: { projectId_path: { projectId: id, path } },
    update: { content, updatedAt: new Date() },
    create: { projectId: id, path, content }
  });

  // Notify collaborators
  io.to(id).emit('file-updated', { path, content });

  res.json({ file });
});

// Asset Upload
app.post('/api/assets/upload', authenticateUser, async (req, res) => {
  const { projectId, name, type } = req.body;
  const file = req.file;

  await checkProjectAccess(req.user.id, projectId, 'write');

  // Upload to S3
  const url = await s3.upload({
    Bucket: 'assets',
    Key: `${projectId}/${file.filename}`,
    Body: file.buffer,
    ContentType: file.mimetype
  });

  // Save metadata
  const asset = await prisma.asset.create({
    data: {
      projectId,
      name,
      type,
      url: url.Location,
      size: file.size,
      mimeType: file.mimetype
    }
  });

  res.json({ asset });
});

// Build Trigger
app.post('/api/builds', authenticateUser, async (req, res) => {
  const { projectId, target } = req.body;

  await checkProjectAccess(req.user.id, projectId, 'read');

  const build = await prisma.build.create({
    data: {
      projectId,
      userId: req.user.id,
      target,
      status: 'queued'
    }
  });

  // Add to build queue
  await buildQueue.add('build-project', {
    buildId: build.id,
    projectId,
    target
  });

  res.json({ build });
});
```

**Build Worker:**
```typescript
import { Worker } from 'bullmq';

const buildWorker = new Worker('build-project', async (job) => {
  const { buildId, projectId, target } = job.data;

  try {
    await updateBuildStatus(buildId, 'building');

    // 1. Fetch project files
    const files = await fetchProjectFiles(projectId);

    // 2. Compile TypeScript
    const compiled = await compileTypeScript(files);

    // 3. Bundle with esbuild
    const bundle = await esbuildBundle(compiled, target);

    // 4. Package for platform
    const artifact = await packageForPlatform(bundle, target);

    // 5. Upload to S3
    const url = await uploadArtifact(buildId, artifact);

    await updateBuildStatus(buildId, 'success', { url });
  } catch (error) {
    await updateBuildStatus(buildId, 'failed', { error: error.message });
  }
}, {
  connection: redisConnection
});
```

**WebSocket Server:**
```typescript
io.on('connection', (socket) => {
  socket.on('join-project', async ({ projectId }) => {
    const hasAccess = await checkAccess(socket.user.id, projectId);
    if (!hasAccess) return socket.disconnect();

    socket.join(projectId);

    // Notify others
    socket.to(projectId).emit('user-joined', {
      userId: socket.user.id,
      username: socket.user.username
    });

    // Send current users
    const users = await getActiveUsers(projectId);
    socket.emit('active-users', users);
  });

  socket.on('file-change', ({ projectId, path, changes }) => {
    // Broadcast to other users in project
    socket.to(projectId).emit('file-updated', { path, changes });
  });

  socket.on('disconnect', () => {
    // Notify others user left
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      socket.to(room).emit('user-left', { userId: socket.user.id });
    });
  });
});
```

## Related Issues

- Frontend Editor Application (new issue)
- Real-Time Collaboration Implementation (new issue)
- Build & Export System (new issue)
- Template Gallery & Marketplace (new issue)
- #82 - Collaborative Editing

## References

- [Fastify](https://www.fastify.io/)
- [Prisma ORM](https://www.prisma.io/)
- [BullMQ](https://docs.bullmq.io/)
- [Socket.io](https://socket.io/)
- [AWS S3 API](https://docs.aws.amazon.com/s3/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
