/**
 * RULES.md Hot Reload Module
 *
 * This module handles loading and caching of rules from RULES.md file
 * Rules are injected into Claude's system prompt to guide behavior
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

/** Default rules when RULES.md is not found */
const DEFAULT_RULES = `# Claude 代码分析助手规则

你是一个专业的代码分析助手，帮助测试人员理解代码逻辑。

## 可用能力（只读）
- 读取代码文件
- 搜索代码内容
- 查找文件路径
- 代码定义跳转

## 回答规范
1. **优先用文字描述**代码的功能和逻辑
2. 可以使用**流程图、架构图**展示系统设计
3. 避免**直接输出大段源码**
4. 如需展示代码，只展示**关键片段**或**折叠显示**

## 回答风格
- 简洁直接
- 重点突出
- 从测试视角解释代码逻辑
`;

/** Cached rules content */
let cachedRules: string | null = null;
/** Path to RULES.md file */
let rulesPath: string | null = null;

/**
 * Initialize the rules loader with the project root path
 * @param projectRoot - Path to project root directory
 */
export function initializeRulesLoader(projectRoot: string): void {
  rulesPath = join(projectRoot, "RULES.md");
  logger.api.info("Rules loader initialized with path: {path}", { path: rulesPath });
  // Pre-load rules
  loadRules();
}

/**
 * Load rules from RULES.md file
 * @returns Rules content (cached or freshly loaded)
 */
export async function loadRules(): Promise<string> {
  if (!rulesPath) {
    logger.api.warn("Rules path not initialized, using default rules");
    return DEFAULT_RULES;
  }

  // Check if file exists
  if (!existsSync(rulesPath)) {
    logger.api.warn("RULES.md not found at {path}, using default rules", { path: rulesPath });
    cachedRules = DEFAULT_RULES;
    return DEFAULT_RULES;
  }

  try {
    const content = await readFile(rulesPath, "utf-8");
    cachedRules = content;
    logger.api.info("Rules loaded from RULES.md ({length} chars)", { length: content.length });
    return content;
  } catch (error) {
    logger.api.error("Failed to load RULES.md: {error}", { error });
    cachedRules = DEFAULT_RULES;
    return DEFAULT_RULES;
  }
}

/**
 * Get cached rules without reloading
 * @returns Cached rules content or default rules
 */
export function getCachedRules(): string {
  return cachedRules ?? DEFAULT_RULES;
}

/**
 * Reload rules from file (for hot-reload API endpoint)
 * @returns Freshly loaded rules content
 */
export async function reloadRules(): Promise<string> {
  logger.api.info("Reloading rules from RULES.md");
  return await loadRules();
}

/**
 * Get current rules content (cached)
 * @returns Current rules content
 */
export function getCurrentRules(): string {
  return getCachedRules();
}
