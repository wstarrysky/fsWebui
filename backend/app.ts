/**
 * Runtime-agnostic Hono application
 *
 * This module creates the Hono application with all routes and middleware,
 * but doesn't include runtime-specific code like CLI parsing or server startup.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Runtime } from "./runtime/types.ts";
import {
  type ConfigContext,
  createConfigMiddleware,
} from "./middleware/config.ts";
import { handleProjectsRequest } from "./handlers/projects.ts";
import { handleHistoriesRequest } from "./handlers/histories.ts";
import { handleConversationRequest } from "./handlers/conversations.ts";
import { handleChatRequest } from "./handlers/chat.ts";
import { handleAbortRequest } from "./handlers/abort.ts";
import { handleGetRulesRequest, handleReloadRulesRequest } from "./handlers/rules.ts";
import { logger } from "./utils/logger.ts";
import { readBinaryFile } from "./utils/fs-deno.ts";
import { initializeRulesLoader } from "./rules/loader.ts";
import { cwd } from "node:process";

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    js: "application/javascript",
    mjs: "application/javascript",
    css: "text/css",
    html: "text/html",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
  };
  return contentTypes[ext] || "application/octet-stream";
}

export interface AppConfig {
  debugMode: boolean;
  staticPath: string;
  cliPath: string; // Actual CLI script path detected by validateClaudeCli
  defaultProjectPath?: string; // Default project directory
}

export function createApp(
  runtime: Runtime,
  config: AppConfig,
): Hono<ConfigContext> {
  const app = new Hono<ConfigContext>();

  // Store AbortControllers for each request (shared with chat handler)
  const requestAbortControllers = new Map<string, AbortController>();

  // Initialize rules loader with project root
  const projectRoot = cwd();
  initializeRulesLoader(projectRoot);

  // CORS middleware
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Configuration middleware - makes app settings available to all handlers
  app.use(
    "*",
    createConfigMiddleware({
      debugMode: config.debugMode,
      runtime,
      cliPath: config.cliPath,
    }),
  );

  // API routes
  app.get("/api/projects", (c) => handleProjectsRequest(c));

  app.get("/api/projects/:encodedProjectName/histories", (c) =>
    handleHistoriesRequest(c),
  );

  app.get("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleConversationRequest(c),
  );

  app.post("/api/abort/:requestId", (c) =>
    handleAbortRequest(c, requestAbortControllers),
  );

  app.post("/api/chat", (c) => handleChatRequest(c, requestAbortControllers));

  // Rules management API
  app.get("/api/rules", (c) => handleGetRulesRequest(c));
  app.post("/api/rules/reload", (c) => handleReloadRulesRequest(c));

  // Config API - return frontend configuration
  app.get("/api/config", (c) => {
    return c.json({
      defaultProjectPath: config.defaultProjectPath ?? null,
    });
  });

  // Static file serving with SPA fallback
  // Serve static assets (CSS, JS, images, etc.)
  app.get("/assets/*", async (c) => {
    const filePath = c.req.path.replace(/^\//, "");
    const fullPath = `${config.staticPath}/${filePath}`;

    try {
      const file = await readBinaryFile(fullPath);
      // Determine content type
      const ext = filePath.split(".").pop()?.toLowerCase();
      const contentType = getContentType(ext || "");
      return new Response(file as BodyInit, {
        headers: { "Content-Type": contentType },
      });
    } catch (error) {
      logger.app.error("Error serving {path}: {error}", { path: filePath, error });
      return c.text("Not found", 404);
    }
  });

  // SPA fallback - serve index.html for all unmatched routes (except API routes)
  app.get("*", async (c) => {
    const path = c.req.path;

    // Skip API routes
    if (path.startsWith("/api/")) {
      return c.text("Not found", 404);
    }

    try {
      const indexPath = `${config.staticPath}/index.html`;
      const indexFile = await readBinaryFile(indexPath);
      return c.html(new TextDecoder().decode(indexFile));
    } catch (error) {
      logger.app.error("Error serving index.html: {error}", { error });
      return c.text("Internal server error", 500);
    }
  });

  return app;
}
