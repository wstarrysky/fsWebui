import { Context } from "hono";
import { query, type PermissionMode } from "@anthropic-ai/claude-code";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { getCachedRules } from "../rules/loader.ts";

/**
 * Read-only tools whitelist for safe mode
 * These tools can only read content, not modify anything
 */
const READ_ONLY_TOOLS = [
  "Read",      // Read file contents
  "Grep",      // Search code content
  "Glob",      // Find file paths
  "LSP",       // Code definition, reference queries
  "Task",      // Sub-agent for read-only exploration
] as const;

/**
 * Get allowed tools for safe read-only mode
 * Merges the read-only whitelist with user-approved tools from frontend
 * @param frontendAllowedTools - Tools explicitly approved by user in frontend
 * @returns Merged list of allowed tools
 */
export function getAllowedTools(frontendAllowedTools?: string[]): string[] {
  // Always include read-only tools
  const tools: string[] = [...READ_ONLY_TOOLS];
  
  // Add user-approved tools from frontend (MCP tools, etc.)
  // but still block write operations
  const BLOCKED_WRITE_TOOLS = [
    "Write", "Edit", "Delete", "Move", "Bash",
  ];
  
  if (frontendAllowedTools) {
    for (const tool of frontendAllowedTools) {
      // Skip blocked write tools
      if (BLOCKED_WRITE_TOOLS.some(blocked => tool === blocked || tool.startsWith(blocked + "("))) {
        continue;
      }
      // Add the tool if not already present
      if (!tools.includes(tool)) {
        tools.push(tool);
      }
    }
  }
  
  return tools;
}

/**
 * Prepends rules to the user message for context
 * Rules are only injected on new sessions (no sessionId)
 * @param message - Original user message
 * @param sessionId - Optional session ID
 * @returns Message with rules prepended (for new sessions)
 */
function prepareMessageWithRules(message: string, sessionId?: string): string {
  // Only inject rules for new sessions
  if (sessionId) {
    return message;
  }

  const rules = getCachedRules();
  return `${rules}

---
User message: ${message}`;
}

/**
 * Executes a Claude command and yields streaming responses
 * @param message - User message or command
 * @param requestId - Unique request identifier for abort functionality
 * @param requestAbortControllers - Shared map of abort controllers
 * @param cliPath - Path to actual CLI script (detected by validateClaudeCli)
 * @param sessionId - Optional session ID for conversation continuity
 * @param allowedTools - Optional array of allowed tool names (overridden by safe mode)
 * @param workingDirectory - Optional working directory for Claude execution
 * @param permissionMode - Optional permission mode for Claude execution
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeClaudeCommand(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  cliPath: string,
  sessionId?: string,
  allowedTools?: string[],
  workingDirectory?: string,
  permissionMode?: PermissionMode,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Process commands that start with '/'
    let processedMessage = message;
    if (message.startsWith("/")) {
      // Remove the '/' and send just the command
      processedMessage = message.substring(1);
    }

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    // In safe mode, merge read-only whitelist with user-approved tools
    const safeAllowedTools = getAllowedTools(allowedTools);
    
    logger.chat.debug("Using allowed tools: {tools}", { tools: safeAllowedTools });

    // Prepare message with rules for new sessions
    const messageWithRules = prepareMessageWithRules(processedMessage, sessionId);

    if (!sessionId) {
      logger.chat.debug("Injecting rules into new session message");
    }

    for await (const sdkMessage of query({
      prompt: messageWithRules,
      options: {
        abortController,
        executable: "node" as const,
        executableArgs: [],
        pathToClaudeCodeExecutable: cliPath,
        ...(sessionId ? { resume: sessionId } : {}),
        allowedTools: safeAllowedTools, // Safe merged whitelist
        ...(workingDirectory ? { cwd: workingDirectory } : {}),
        ...(permissionMode ? { permissionMode } : {}),
      },
    })) {
      // Debug logging of raw SDK messages with detailed content
      logger.chat.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });

      yield {
        type: "claude_json",
        data: sdkMessage,
      };
    }

    yield { type: "done" };
  } catch (error) {
    // Check if error is due to abort
    const isError = error instanceof Error;
    const errorMessage = isError ? error.message : "";
    const errorName = isError ? error.name : "";

    // Detect abort by error message or name
    const isAbort = errorName === "AbortError" || errorMessage.includes("aborted by user");

    if (isAbort) {
      // Send aborted message - this is expected when user clicks stop
      logger.chat.debug("Request aborted by user - sending abort notification");
      yield { type: "aborted" };
    } else {
      logger.chat.error("Claude Code execution failed: {error}", { error });
      yield {
        type: "error",
        error: errorMessage || String(error),
      };
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { cliPath } = c.var.config;

  logger.chat.debug(
    "Received chat request {*}",
    chatRequest as unknown as Record<string, unknown>,
  );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of executeClaudeCommand(
          chatRequest.message,
          chatRequest.requestId,
          requestAbortControllers,
          cliPath, // Use detected CLI path from validateClaudeCli
          chatRequest.sessionId,
          chatRequest.allowedTools, // Merged with safe mode whitelist
          chatRequest.workingDirectory,
          chatRequest.permissionMode,
        )) {
          const data = JSON.stringify(chunk) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
