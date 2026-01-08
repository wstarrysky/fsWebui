/**
 * Rules API Handlers
 *
 * Provides endpoints for managing RULES.md hot-reload functionality
 */

import type { Context } from "hono";
import { getCurrentRules, reloadRules } from "../rules/loader.ts";
import { logger } from "../utils/logger.ts";

/**
 * Handles GET /api/rules - Return current rules content
 */
export async function handleGetRulesRequest(c: Context) {
  try {
    const rules = getCurrentRules();
    return c.json({
      success: true,
      rules: rules,
      length: rules.length,
    });
  } catch (error) {
    logger.api.error("Failed to get rules: {error}", { error });
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

/**
 * Handles POST /api/rules/reload - Reload rules from file
 */
export async function handleReloadRulesRequest(c: Context) {
  try {
    const rules = await reloadRules();
    logger.api.info("Rules reloaded successfully ({length} chars)", { length: rules.length });
    return c.json({
      success: true,
      message: "Rules reloaded successfully",
      rules: rules,
      length: rules.length,
    });
  } catch (error) {
    logger.api.error("Failed to reload rules: {error}", { error });
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
