import { useState } from "react";
import { CODE_BLOCK_CONFIG } from "../config/safety";

interface CodeBlockRendererProps {
  content: string;
}

interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

function parseCodeBlocks(content: string): {
  textParts: string[];
  codeBlocks: CodeBlock[];
} {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const textParts: string[] = [];
  const codeBlocks: CodeBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      textParts.push(content.slice(lastIndex, match.index));
    }

    codeBlocks.push({
      language: match[1] || "text",
      code: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    textParts.push(content.slice(lastIndex));
  }

  return { textParts, codeBlocks };
}

interface CodeBlockProps {
  block: CodeBlock;
}

function CodeBlock({ block }: CodeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lineCount = block.code.split('\n').length;
  const shouldFold = lineCount > CODE_BLOCK_CONFIG.FOLD_THRESHOLD;

  if (!shouldFold) {
    return (
      <div className="my-2 rounded-lg bg-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="px-3 py-1 bg-slate-700 dark:bg-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <span>{block.language || "code"}</span>
          <span className="opacity-60">{lineCount} lines</span>
        </div>
        <pre className="p-3 overflow-x-auto text-sm text-slate-200">
          <code>{block.code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg bg-slate-800 dark:bg-slate-900 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-slate-700 dark:bg-slate-800 text-xs text-slate-300 flex items-center justify-between hover:bg-slate-600 dark:hover:bg-slate-750 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <span className="transform transition-transform">
            ▶
          </span>
          <span>{block.language || "code"}</span>
        </span>
        <span className="opacity-80">
          {isExpanded ? "Collapse" : "Expand"} ({lineCount} lines)
        </span>
      </button>
      {isExpanded && (
        <pre className="p-3 overflow-x-auto text-sm text-slate-200 border-t border-slate-700">
          <code>{block.code}</code>
        </pre>
      )}
    </div>
  );
}

export function CodeBlockRenderer({ content }: CodeBlockRendererProps) {
  const { textParts, codeBlocks } = parseCodeBlocks(content);

  if (codeBlocks.length === 0) {
    return <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{content}</pre>;
  }

  return (
    <div className="text-sm font-mono leading-relaxed">
      {textParts.map((text, index) => (
        <span key={index} className="whitespace-pre-wrap">
          {text}
        </span>
      ))}
      {codeBlocks.map((block, index) => (
        <CodeBlock key={index} block={block} />
      ))}
    </div>
  );
}
