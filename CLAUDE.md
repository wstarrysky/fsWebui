# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**Run from project root for all commands.**

### Essential Commands

```bash
# Quality & Testing
make check              # All quality checks (pre-commit)
make format             # Format frontend + backend
make lint               # Lint both
make typecheck          # Type check both
make test               # Test both

# Development
make dev-backend        # Start backend (Deno or Node.js)
make dev-frontend       # Start frontend (Vite)

# Build
make build-backend      # Build backend binary
make build-frontend     # Build frontend dist

# Specific Operations
make format-files FILES="file1 file2"  # Format specific files
make test-frontend      # Frontend tests only
make test-backend       # Backend tests only
```

### Running Single Tests

```bash
# Frontend (Vitest)
cd frontend
npm test -- src/hooks/streaming/useStreamParser.test.ts

# Backend (Vitest)
cd backend
npm test -- handlers/chat.test.ts
```

### Debug Mode

```bash
# Backend with debug logging
cd backend
deno task dev --debug     # Deno
npm run dev -- --debug    # Node.js

# Check debug logs
# Look for [DEBUG] prefixed messages in console
```

## Architecture

### Technology Stack

- **Backend**: TypeScript + Hono framework with Deno/Node.js runtime abstraction
- **Frontend**: React 19 + Vite + TailwindCSS + React Router
- **Shared**: TypeScript types in `shared/`
- **Testing**: Vitest for both frontend and backend
- **Build**: Single binary via `deno compile` (Deno) or esbuild bundle (Node.js)

### Project Structure

```
├── backend/              # Server with runtime abstraction
│   ├── cli/             # Entry points (deno.ts, node.ts, args.ts, validation.ts)
│   ├── runtime/         # Runtime abstraction (types.ts, deno.ts, node.ts)
│   ├── handlers/        # API handlers (chat.ts, projects.ts, histories.ts, abort.ts, rules.ts)
│   ├── history/         # History processing utilities
│   ├── middleware/      # Config context middleware
│   ├── rules/           # Rules loader system
│   ├── utils/           # Logging, filesystem, OS utilities
│   └── scripts/         # Build and packaging scripts
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # UI components (ChatPage, Messages, dialogs, etc.)
│   │   ├── hooks/       # Custom hooks (streaming, chat, permissions, etc.)
│   │   ├── config/      # Safety configuration
│   │   ├── types/       # TypeScript definitions
│   │   ├── contexts/    # React contexts
│   │   └── utils/       # Utilities and constants
├── shared/              # Shared TypeScript types
└── CLAUDE.md           # This file
```

## Critical Architecture Patterns

### 1. Runtime Abstraction

**Purpose**: Support both Deno and Node.js with shared business logic.

**Implementation** (`backend/runtime/`):
- `types.ts`: Minimal Runtime interface (runCommand, findExecutable, serve, createStaticFileMiddleware)
- `deno.ts`: Deno-specific implementation using Deno APIs
- `node.ts`: Node.js implementation using child_process and @hono/node-server

**Usage**: All platform-specific code goes through Runtime interface, keeping handlers platform-agnostic.

### 2. Universal Claude CLI Path Detection

**Problem**: Claude CLI path varies across package managers (npm, pnpm, asdf, yarn, volta).

**Solution** (`backend/cli/validation.ts`):
1. **PATH Wrapping**: Creates temp node wrapper to trace actual script execution
2. **Windows Fallback**: Parses `.cmd` files for npm cmd-shim pattern
3. **Version Validation**: Confirms CLI works via `claude --version`

**Why Complex**: Package manager wrappers hide real executable paths. Tracing captures actual execution.

### 3. Streaming Architecture

**Flow**:
```
Claude SDK (AsyncGenerator)
  ↓
StreamResponse objects (claude_json, done, aborted, error)
  ↓
ReadableStream (NDJSON format)
  ↓
Response with streaming headers
  ↓
Frontend fetch → response.body.getReader()
  ↓
useStreamParser hook processes messages
  ↓
UI updates in real-time
```

**Key Files**:
- Backend: `backend/handlers/chat.ts` (handleChatRequest)
- Frontend: `frontend/src/hooks/streaming/useStreamParser.ts`

### 4. Session Continuity

**Flow**:
1. First message → Claude SDK creates session
2. Backend extracts `session_id` from SDK system message
3. Frontend stores sessionId with conversation
4. Follow-up messages include sessionId in request
5. Backend passes to SDK via `options.resume`

**Storage**: Conversations persist in `.claude/` directory per project.

### 5. Safety & Tool Whitelisting

**Critical for security** - Controls what tools Claude can use.

**Frontend Safety** (`frontend/src/config/safety.ts`):
```typescript
ALLOWED_MESSAGE_TYPES = ["user", "assistant"]
BLOCKED_MESSAGE_TYPES = ["system", "tool", "tool_result", "thinking", "todo", "plan"]
```

**Backend Tool Control** (`backend/handlers/chat.ts`):
```typescript
READ_ONLY_TOOLS = ["Read", "Grep", "Glob", "LSP", "Task"]
// Write tools blocked by default, only allowed via user permission
```

**Strategy**:
- Always include read-only tools in whitelist
- Merge with user-approved tools from frontend permission dialog
- Block write operations unless explicitly approved

### 6. Abort/Cancellation Mechanism

**Implementation** (`backend/app.ts`, `backend/handlers/abort.ts`):
- Map of `AbortController` per request ID
- `POST /api/abort/:requestId` endpoint
- Passed to Claude SDK via `abortController` option
- Automatic cleanup on completion or error

### 7. Rules System

**Purpose**: Inject user-defined rules into new conversations.

**Implementation** (`backend/rules/loader.ts`):
- Loads rules from `RULES.md` in project root
- Cached in memory for performance
- Injected only on new sessions (not resumed)
- Reloadable via `POST /api/rules/reload`

**File**: Create `RULES.md` in project directory for custom instructions.

## API Endpoints

```
GET  /api/projects                                    # List projects
POST /api/chat                                        # Send message (streaming)
POST /api/abort/:requestId                            # Cancel request
GET  /api/projects/:encodedProjectName/histories     # List conversations
GET  /api/projects/:encodedProjectName/histories/:id # Get conversation
GET  /api/rules                                       # Get current rules
POST /api/rules/reload                                # Reload rules from disk
```

## Development Workflow

### Initial Setup

```bash
# Install Lefthook (pre-commit hooks)
brew install lefthook       # macOS
lefthook install            # Install hooks

# Verify hooks work
lefthook run pre-commit
```

### Daily Development

1. Make changes
2. Run `make check` before committing (or let Lefthook do it)
3. Commit triggers automatic quality validation
4. Push creates PR with CI checks

### Pull Request Process

```bash
# Create feature branch
git checkout -b feature/name

# Commit (Lefthook runs make check automatically)
git commit -m "feat: description"

# Create PR with labels
gh pr create --title "..." --body "..." --label "feature" --label "backend"
```

**Labels**: `bug`, `feature`, `breaking`, `documentation`, `performance`, `refactor`, `test`, `chore`, `backend`, `frontend`

### Release Process (Automated via tagpr)

1. PRs merged → tagpr creates release PR
2. Add version labels if needed (`minor-release`, `major-release`)
3. Merge release PR → automatic tag + GitHub Actions builds binaries

## Claude Code SDK Integration

### Types Reference

**Location**: `frontend/node_modules/@anthropic-ai/claude-code/sdk.d.ts`

**Important Patterns**:
```typescript
// System message (fields directly on object)
const systemMsg = sdkMessage as Extract<SDKMessage, { type: "system" }>;
console.log(systemMsg.cwd, systemMsg.session_id);

// Assistant message (content nested under message.content)
const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;
for (const item of assistantMsg.message.content) {
  if (item.type === "text") {
    const text = (item as { text: string }).text;
  }
}
```

### Dependency Update Procedure

**Policy**: Fixed versions (no caret `^`) for consistency.

```bash
# 1. Check current versions
grep "@anthropic-ai/claude-code" frontend/package.json backend/deno.json

# 2. Update frontend
cd frontend
# Edit package.json version
npm install

# 3. Update backend (Deno)
cd backend
# Edit deno.json imports
rm deno.lock
deno cache cli/deno.ts

# 4. Update backend (Node.js)
# Edit package.json version
npm install

# 5. Verify
make check
```

## Port Configuration

**Default**:
- Frontend: 3000
- Backend: 8080

**Custom via .env** (project root):
```bash
PORT=9000
```

**Runtime**:
```bash
# Deno
dotenvx run --env-file=../.env -- deno task dev

# Node.js
dotenvx run --env-file=../.env -- npm run dev

# Or direct
PORT=9000 npm run dev
```

## Common Issues & Solutions

### Claude CLI Not Found

**Symptom**: "Claude Code process exited with code 1"

**Solution**:
```bash
# Use explicit path
claude-code-webui --claude-path "$(which claude)"

# For Volta
claude-code-webui --claude-path "$(volta which claude)"

# For asdf
claude-code-webui --claude-path "$(asdf which claude)"
```

### Permission Dialog Not Appearing

**Check**: `frontend/src/config/safety.ts` - Ensure message types are correctly filtered.

**Debug**: Enable debug mode and check console for blocked messages.

### Streaming Stopped Mid-Response

**Common Causes**:
1. Backend abort triggered
2. Network interruption
3. Claude SDK error

**Debug**: Check backend logs with `--debug` flag.

## MCP Integration

**Config** (`.mcp.json`):
```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Usage**: Mention "playwright mcp" in chat for browser automation.

## Testing

### Frontend Tests
- **Runner**: Vitest with jsdom
- **Libraries**: @testing-library/react
- **Command**: `npm test` (watch) or `npm run test:run` (once)

### Backend Tests
- **Runner**: Vitest
- **Coverage**: CLI validation, chat handlers, history utilities
- **Command**: `npm test`

### CI/CD
- **Trigger**: Push to main + PRs
- **Checks**: Format, lint, typecheck, test, build
- **Matrix**: Node.js 20, 22, 24

## Build System

### Frontend Build
```bash
cd frontend
npm run build    # → frontend/dist/
```

### Backend Build

**Deno** (single binary):
```bash
cd backend
deno task build  # → claude-code-webui binary
```

**Node.js** (bundle):
```bash
cd backend
npm run build    # → dist/cli/node.js + dist/static/
```

### Full Build
```bash
make build       # Frontend → Backend (includes frontend dist)
```

## Key Design Decisions

1. **Runtime Abstraction**: Minimal interface supporting Deno + Node.js
2. **Universal CLI Detection**: Tracing method for all package managers
3. **NDJSON Streaming**: Raw Claude SDK responses for frontend flexibility
4. **Safety Layers**: Frontend + backend tool filtering
5. **Session via SDK**: Natural continuity using SDK session management
6. **Modular Hooks**: Specialized React hooks for maintainability
7. **TypeScript Throughout**: End-to-end type safety

## Important Notes

- **Always run commands from project root** - Avoid `cd` in scripts
- **Use full paths** when necessary to avoid directory confusion
- **Test before committing** - Lefthook enforces `make check`
- **Debug mode** - Use `--debug` flag for detailed logging
- **Fixed versions** - No caret `^` for Claude Code dependencies
