import { useRef, useEffect } from "react";
import type { AllMessage } from "../../types";
import { isChatMessage } from "../../types";
import { ChatMessageComponent, LoadingComponent } from "../MessageComponents";
// import { UI_CONSTANTS } from "../../utils/constants"; // Unused for now

/**
 * Check if message contains RULES.md injected content
 * Rules are injected with a separator "----" pattern
 */
function isRulesMessage(message: AllMessage): boolean {
  if (!isChatMessage(message)) return false;
  if (message.role !== "user") return false;

  const content = message.content.trim();

  // Rules messages have these characteristics:
  // 1. Start with markdown heading (#) or contain common rule keywords
  // 2. Contain the separator "----"
  // 3. Contain "User message:" or similar at the end
  const hasSeparator = content.includes("----");
  const hasUserMessageMarker = content.includes("User message:") ||
                                content.includes("用户消息:");
  const startsWithHeading = content.startsWith("#") ||
                            content.includes("安全规则") ||
                            content.includes("安全原则");

  // Also check for very long user messages with separator (likely rules)
  const isLongWithSeparator = content.length > 500 && hasSeparator && hasUserMessageMarker;

  return hasSeparator && hasUserMessageMarker && (startsWithHeading || isLongWithSeparator);
}

interface ChatMessagesProps {
  messages: AllMessage[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesEndRef.current.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Check if user is near bottom of messages (unused but kept for future use)
  // const isNearBottom = () => {
  //   const container = messagesContainerRef.current;
  //   if (!container) return true;

  //   const { scrollTop, scrollHeight, clientHeight } = container;
  //   return (
  //     scrollHeight - scrollTop - clientHeight <
  //     UI_CONSTANTS.NEAR_BOTTOM_THRESHOLD_PX
  //   );
  // };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderMessage = (message: AllMessage, index: number) => {
    // Use timestamp as key for stable rendering, fallback to index if needed
    const key = `${message.timestamp}-${index}`;

    // Safe mode: Only show chat messages (user + assistant)
    // Hide all other message types per requirements
    // Also hide RULES.md injected messages
    if (isChatMessage(message) && !isRulesMessage(message)) {
      return <ChatMessageComponent key={key} message={message} />;
    }
    // Hide: system, tool, tool_result, plan, thinking, todo, and rules messages
    return null;
  };

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 p-3 sm:p-6 mb-3 sm:mb-6 rounded-2xl shadow-sm backdrop-blur-sm flex flex-col"
    >
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Spacer div to push messages to the bottom */}
          <div className="flex-1" aria-hidden="true"></div>
          {messages.map(renderMessage)}
          {isLoading && <LoadingComponent />}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center text-slate-500 dark:text-slate-400">
      <div>
        <div className="text-6xl mb-6 opacity-60">
          <span role="img" aria-label="chat icon">
            💬
          </span>
        </div>
        <p className="text-lg font-medium">开始对话</p>
        <p className="text-sm mt-2 opacity-80">
          Type your message below to begin
        </p>
      </div>
    </div>
  );
}
