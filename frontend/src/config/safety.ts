/**
 * Safety Mode Configuration
 */

export const ALLOWED_MESSAGE_TYPES = new Set(["user", "assistant"]);

export const BLOCKED_MESSAGE_TYPES = new Set([
  "system",
  "tool",
  "tool_result",
  "thinking",
  "todo",
  "plan",
]);

export function isMessageTypeAllowed(type: string): boolean {
  return ALLOWED_MESSAGE_TYPES.has(type);
}

export const CODE_BLOCK_CONFIG = {
  FOLD_THRESHOLD: 10,
};
