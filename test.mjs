import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./goon.ts";
import { INVISIBLE_CONTINUE_CUSTOM_TYPE, readShortcut } from "./src/index.ts";

test("/goon resumes invisibly and preserves tool-call pairs", async (t) => {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-goon-test-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  });
  const shortcuts = new Map();
  const commands = new Map();
  const hooks = new Map();
  const sent = [];
  const notifications = [];
  extension({
    registerCommand: (name, command) => commands.set(name, command),
    registerShortcut: (key, shortcut) => shortcuts.set(key, shortcut),
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

  assert.deepEqual([...shortcuts.keys()], ["alt+g"]);
  await shortcuts.get("alt+g").handler(ctx);
  assert.deepEqual(sent[1], sent[0]);

  const configPath = join(agentDir, "goon.json");
  const setConfig = (config) => writeFileSync(configPath, JSON.stringify(config));
  for (const key of ["ctrl+alt+g", "f6", "alt+pageUp", "ctrl++"]) {
    setConfig({ shortcut: key });
    assert.equal(readShortcut(), key);
  }
  setConfig({ shortcut: "ctrl+alt+g" });
  const custom = new Map();
  const api = {
    on: () => {}, registerCommand: () => {},
    registerShortcut: (key, shortcut) => custom.set(key, shortcut),
    sendMessage: (...args) => sent.push(args),
  };
  extension(api);
  assert.deepEqual([...custom.keys()], ["ctrl+alt+g"]);
  await custom.get("ctrl+alt+g").handler(ctx);
  assert.deepEqual(sent[2], sent[0]);
  setConfig({ shortcut: null });
  custom.clear();
  extension(api);
  assert.equal(custom.size, 0);
  setConfig({});
  assert.equal(readShortcut(), "alt+g");
  for (const config of [null, [], { shortcut: false }, { shortcut: "" },
    { shortcut: "not-a-key" }, { shortcut: "ctrl+ctrl+g" }]) {
    setConfig(config);
    assert.throws(() => readShortcut(), /goon\.json/);
  }
  writeFileSync(configPath, "{");
  assert.throws(() => readShortcut(), /Cannot read/);
});
