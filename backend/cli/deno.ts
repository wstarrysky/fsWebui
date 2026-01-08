/**
 * Deno-specific entry point
 *
 * This module handles Deno-specific initialization including CLI argument parsing,
 * Claude CLI validation, and server startup using the DenoRuntime.
 */

import { createApp } from "../app.ts";
import { DenoRuntime } from "../runtime/deno.ts";
import { parseCliArgs } from "./args.ts";
import { validateClaudeCli } from "./validation.ts";
import { logger, setupLogger } from "../utils/logger.ts";
import { dirname, fromFileUrl, join } from "@std/path";
import { exit } from "../utils/os.ts";

async function main(runtime: DenoRuntime) {
  // Parse CLI arguments
  const args = parseCliArgs();

  // Initialize logging system
  await setupLogger(args.debug);

  if (args.debug) {
    logger.cli.info("🐛 Debug mode enabled");
  }

  // Validate Claude CLI availability and get the detected CLI path
  const cliPath = await validateClaudeCli(runtime, args.claudePath);

  // Create application
  // Resolve static path: handle both compiled and source modes
  let staticPath: string;

  // In compiled mode, the binary is next to static/ folder
  // In source mode, we need to go from cli/ to ../dist/static
  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const compiledStaticPath = join(scriptDir, "static");

  try {
    await Deno.stat(compiledStaticPath);
    staticPath = compiledStaticPath;
  } catch {
    // Source mode: static files in backend/dist/static (relative to cli/)
    staticPath = join(scriptDir, "../dist/static");
  }

  const app = createApp(runtime, {
    debugMode: args.debug,
    staticPath,
    cliPath: cliPath,
  });

  // Start server (only show this message when everything is ready)
  logger.cli.info(`🚀 Server starting on ${args.host}:${args.port}`);
  runtime.serve(args.port, args.host, app.fetch);
}

// Run the application
if (import.meta.main) {
  const runtime = new DenoRuntime();
  main(runtime).catch((error) => {
    // Logger may not be initialized yet, so use console.error
    console.error("Failed to start server:", error);
    exit(1);
  });
}
