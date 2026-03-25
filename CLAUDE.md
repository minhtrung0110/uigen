# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UIGen** is an AI-powered React component generator with live preview. Users describe components in a chat interface, Claude generates code, and the output is rendered in real-time. It supports both authenticated users (with Prisma+SQLite persistence) and anonymous sessions (in-memory only).

## Development Commands

```bash
# Initial setup (dependencies + Prisma migrations)
npm run setup

# Development server with Turbopack
npm run dev

# Run development server in background (logs to logs.txt)
npm run dev:daemon

# Build for production
npm run build

# Start production server
npm start

# Run tests with vitest
npm test

# Run a single test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm test -- --watch

# Lint code
npm lint

# Reset database (careful! destructive)
npm run db:reset
```

## Architecture

### Core Flow
1. **Chat Interface** → User describes component → Messages sent to `/api/chat`
2. **Chat API Route** (`src/app/api/chat/route.ts`) → Streams Claude response using Vercel AI SDK
3. **Claude Tools** → Uses `str_replace_editor` and `file_manager` tools to modify files in VirtualFileSystem
4. **Virtual File System** → In-memory representation (no files written to disk) with serialization for persistence
5. **Preview** → JSX is executed in iframe with Babel, rendered in real-time
6. **Persistence** → For authenticated users, chat history + file data saved to Prisma

### Key Components & Their Responsibilities

**Virtual File System** (`src/lib/file-system.ts`)
- In-memory tree structure for managing files/directories
- Serialization/deserialization for database storage
- No actual disk writes; all operations are in-memory
- Used by both client (FileSystemContext) and server (chat API)

**Chat Context** (`src/lib/contexts/chat-context.tsx`)
- Manages message history and streaming state
- Integrates with chat API endpoint
- Tracks pending AI responses

**File System Context** (`src/lib/contexts/file-system-context.tsx`)
- Client-side state for virtual file system
- File selection, creation, updates, deletion
- Tool call handling (applies Claude's tool responses to the file system)
- Refresh triggers for UI updates

**Chat API** (`src/app/api/chat/route.ts`)
- Entry point for AI interactions using Vercel's `streamText()`
- Uses prompt from `src/lib/prompts/generation.tsx`
- Tools: `str_replace_editor` (edit files), `file_manager` (create/delete/list)
- Ephemeral Anthropic cache for system prompt optimization
- Saves project data after completion if user is authenticated

**Preview Frame** (`src/components/preview/PreviewFrame.tsx`)
- Renders generated JSX in an iframe
- Uses Babel (imported from CDN) to transform JSX at runtime
- Handles errors gracefully with fallback UI

**Authentication** (`src/lib/auth.ts`)
- JWT-based session management using jose
- `getSession()` validates request headers
- `createSession()` creates tokens for new users
- Password hashing with bcrypt

**Tools** (`src/lib/tools/`)
- `str-replace.ts`: Allows Claude to edit file content
- `file-manager.ts`: Create, delete, list files and directories

### Data Models

**Prisma Schema** (`prisma/schema.prisma`)
```
User → Projects (one-to-many, cascading delete)
Project { id, name, userId?, messages (JSON), data (JSON) }
```
- Messages: Array of chat messages (user + assistant)
- Data: Serialized VirtualFileSystem state

### File Organization
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components (UI, chat, editor, preview, auth)
- `src/lib/` — Utilities, contexts, file system, auth, Prisma client, prompts
- `src/lib/tools/` — Claude tool implementations
- `src/lib/transform/` — JSX transformation for preview (Babel integration)
- `src/lib/prompts/` — System prompts for Claude
- `src/actions/` — Server actions for auth and project management
- `src/hooks/` — Custom React hooks (useAuth)

## Development Patterns

### Adding a New Tool for Claude
1. Create file in `src/lib/tools/new-tool.ts`
2. Export a `buildNewTool()` function that returns a tool object compatible with Vercel AI SDK
3. Register in `src/app/api/chat/route.ts` in the `tools` object
4. Tool should work with VirtualFileSystem instance

### Modifying File System Logic
- Virtual file system is independent of Next.js — changes affect both server and client
- Remember serialization/deserialization when persisting data
- FileSystemContext applies tool changes via `handleToolCall()`

### Adding Authentication-Required Features
- Use `getSession()` in server actions to authenticate
- Check `session.userId` to associate data with users
- Anonymous users don't have `userId` (undefined or no session)

### Testing
- Vitest with jsdom environment
- Component tests use React Testing Library
- Test files colocated: `__tests__/ComponentName.test.tsx`
- No mocking of VirtualFileSystem — test with real instance for integration tests

## Environment & Configuration

- **Node.js**: 18+
- **ANTHROPIC_API_KEY**: Optional; if missing, uses mock LLM responses
- **Database**: SQLite in `prisma/dev.db`
- **Turbopack**: Used in dev for faster builds (`--turbopack` flag)
- **Cache Control**: Anthropic ephemeral cache on system prompt for cost/latency optimization

## Common Issues

**Tests fail with "jsdom" errors**: Ensure jsdom is installed (in devDependencies). Check vitest.config.mts.

**Prisma migrations fail**: Run `npx prisma migrate reset --force` to recreate database from schema.

**Preview shows blank**: Check browser console for errors. Babel transform might have failed. JSX must be valid React.

**Chat API returns empty responses**: Check if ANTHROPIC_API_KEY is set. Without it, mock LLM returns static responses (by design for development).

**Files not persisting**: Only saved for authenticated users with valid projectId. Anonymous sessions are in-memory only.
