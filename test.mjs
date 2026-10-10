import assert from "node:assert/strict";
import test from "node:test";
import extension from "./goon.ts";
import { INVISIBLE_CONTINUE_CUSTOM_TYPE } from "./src/index.ts";

test("/goon resumes invisibly and preserves tool-call pairs", async () => {
  const commands = new Map();
  const hooks = new Map();
  const sent = [];
  const notifications = [];
  extension({
    registerCommand: (name, command) => commands.set(name, command),
    on: (name, handler) => hooks.set(name, handler),
    sendMessage: (...args) => sent.push(args),
  });
  assert.deepEqual([...commands.keys()], ["goon"]);
  const ctx = {
    isIdle: () => true,
    sessionManager: { getEntries: () => [] },
    ui: { notify: (...args) => notifications.push(args) },
  };
  const command = commands.get("goon");
  await command.handler("", ctx);
  assert.deepEqual(sent, [[{
    customType: INVISIBLE_CONTINUE_CUSTOM_TYPE,
    content: [],
    display: false,
    details: undefined,
  }, { triggerTurn: true, deliverAs: "followUp" }]]);

  const filter = hooks.get("context");
  const user = { role: "user", content: "original task" };
  const marker = { role: "custom", ...sent[0][0] };
  const aborted = { role: "assistant", stopReason: "aborted", content: [] };
  const error = { role: "assistant", stopReason: "error", content: [] };
  const messages = [user, error, aborted, marker];
  assert.deepEqual(filter({ messages }), { messages: [user] });
  assert.equal(messages.length, 4);
  assert.equal(filter({ messages: [user, error] }), undefined);
  assert.deepEqual(filter({ messages: [error, marker] }), { messages: [error] });

  const toolCall = {
    role: "assistant", stopReason: "aborted",
    content: [{ type: "toolCall", id: "call-1" }],
  };
  const toolResult = { role: "toolResult", toolCallId: "call-1" };
  assert.deepEqual(filter({ messages: [user, toolCall, marker] }), {
    messages: [user, toolCall],
  });
  assert.deepEqual(filter({ messages: [user, toolCall, toolResult, error, marker] }), {
    messages: [user, toolCall, toolResult],
  });
  const complete = { role: "assistant", stopReason: "stop", content: [] };
  assert.deepEqual(filter({ messages: [user, complete, marker] }), {
    messages: [user, complete],
  });
  const unrelated = { role: "custom", customType: "other", content: [] };
  assert.equal(filter({ messages: [user, unrelated] }), undefined);

  await command.handler("status", ctx);
  await command.handler("help", ctx);
  assert.equal(sent.length, 1);
  assert.equal(notifications.length, 2);
  assert.ok(notifications[1][0].includes("/goon"));
  assert.ok(!notifications[1][0].includes("/continue"));
});
