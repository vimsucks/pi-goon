/** Shared constants and utilities for pi-goon. */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function readShortcut(): Parameters<ExtensionAPI["registerShortcut"]>[0] | null {
  const agentDir = process.env.PI_CODING_AGENT_DIR?.replace(/^~(?=$|[\\/])/, homedir())
    || join(homedir(), ".pi", "agent");
  const path = join(agentDir, "goon.json");
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "alt+g";
    throw new Error(`Cannot read ${path}`, { cause: error });
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  const shortcut = (config as { shortcut?: unknown }).shortcut;
  if (shortcut === undefined) return "alt+g";
  if (shortcut === null) return null;
  if (typeof shortcut === "string") {
    const match = /^((?:(?:ctrl|shift|alt|super)\+)*)(.+)$/.exec(shortcut);
    if (match) {
      const modifiers = match[1].split("+").filter(Boolean);
      const key = match[2];
      const validKey = /^[a-z0-9]$/.test(key)
        || (key.length === 1 && "`-=[]\\;',./!@#$%^&*()_+|~{}:<>?".includes(key))
        || /^(escape|esc|enter|return|tab|space|backspace|delete|insert|clear|home|end|pageUp|pageDown|up|down|left|right|f[1-9]|f1[0-2])$/.test(key);
      if (validKey && new Set(modifiers).size === modifiers.length) {
        return shortcut as Parameters<ExtensionAPI["registerShortcut"]>[0];
      }
    }
  }
  throw new Error(`${path}: shortcut must be a Pi key identifier (e.g. alt+g) or null`);
}

export const CONTINUE_COMMAND_DESCRIPTION =
  "Resume the agentic loop without sending a prompt the LLM can read";

export const INVISIBLE_CONTINUE_CUSTOM_TYPE = "pi-goon:resume";

export function isInvisibleContinueMarker(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { role?: unknown; customType?: unknown };
  return (
    candidate.role === "custom" &&
    candidate.customType === INVISIBLE_CONTINUE_CUSTOM_TYPE
  );
}

const INCOMPLETE_ASSISTANT_STOP_REASONS = new Set(["error", "aborted"]);

export function isIncompleteAssistantMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { role?: unknown; stopReason?: unknown };
  return (
    candidate.role === "assistant" &&
    typeof candidate.stopReason === "string" &&
    INCOMPLETE_ASSISTANT_STOP_REASONS.has(candidate.stopReason)
  );
}

export function hasToolCallBlocks(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const content = (message as { content?: unknown }).content;
  return (
    Array.isArray(content) &&
    content.some(
      (block) =>
        !!block &&
        typeof block === "object" &&
        (block as { type?: unknown }).type === "toolCall",
    )
  );
}

/**
 * Pop trailing incomplete assistant attempts (retry-exhausted errors, aborts)
 * so a continuation does not re-serve the failed run to the LLM.
 *
 * Guards: stops at the first message that is not an incomplete assistant,
 * never pops an assistant carrying toolCall blocks (their tool results must
 * stay paired), and never empties the context entirely.
 */
export function stripTrailingIncompleteAssistants<T>(
  messages: ReadonlyArray<T>,
): T[] {
  const stripped = [...messages];
  while (
    stripped.length > 1 &&
    isIncompleteAssistantMessage(stripped[stripped.length - 1]) &&
    !hasToolCallBlocks(stripped[stripped.length - 1])
  ) {
    stripped.pop();
  }
  return stripped;
}

export function getLastAssistantMessageText(
  entries: ReadonlyArray<{ type: string; message?: { role?: string; content?: unknown } }>,
): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (
      entry.type === "message" &&
      entry.message?.role === "assistant" &&
      entry.message.content
    ) {
      const content = entry.message.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textBlocks = content.filter(
          (block: unknown): block is { type: "text"; text: string } => {
            if (!block || typeof block !== "object") return false;
            const candidate = block as { type?: unknown; text?: unknown };
            return candidate.type === "text" && typeof candidate.text === "string";
          },
        );
        if (textBlocks.length === 0) return undefined;
        return textBlocks.map((block) => block.text).join("\n");
      }
    }
  }
  return undefined;
}
