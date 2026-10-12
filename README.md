# @vimsucks/pi-goon

Resume the current Pi session with `/goon` without sending a new continuation prompt to the model.

## Installation

Requires Pi 1.0.0 or later.

Install from npm:

```sh
pi install npm:@vimsucks/pi-goon
```

Or install from GitHub:

```sh
pi install git:github.com/vimsucks/pi-goon
```

After installation, run `/reload` in the current session or restart Pi.

## Usage

- `/goon`: start an invisible continuation. If the agent is already running, Pi queues the continuation through its native follow-up queue.
- `/goon status`: show whether the session is idle and the text of the last assistant message.
- `/goon help`: show command help.

After a network request fails or you cancel generation, run `/goon` to resume the task in the same session. If Pi has exited, reopen the original session before running `/goon`.

## Keyboard shortcut

The default shortcut is `Alt+G`. It performs the same action as `/goon` without submitting or clearing text in the editor. Run `/hotkeys` to inspect the active shortcuts.

To change the shortcut, add a `goon` object to `~/.pi/agent/settings.json`. Keep the other settings in that file:

```json
{
  "goon": {
    "shortcut": "ctrl+alt+g"
  }
}
```

`goon.shortcut` accepts Pi key identifiers such as `alt+g`, `ctrl+alt+g`, or `f6`. Set it to `null` to disable the shortcut; `/goon` remains available. If the settings file or the `goon.shortcut` field is absent, the extension uses `alt+g`.

The extension no longer reads `goon.json`. If you have that file, move its `shortcut` value to `goon.shortcut` in `settings.json`.

If `PI_CODING_AGENT_DIR` is set, the extension reads `settings.json` from that directory. Only user-level settings apply; the extension does not read project settings.

After changing the configuration, run `/reload`. If the configuration is invalid, Pi reports a loading error. Correct the configuration and run `/reload` again.

Pi handles the shortcut through its native shortcut mechanism and applies its normal conflict rules. On macOS, configure the terminal to treat Option as Alt/Meta so it can send `Alt+G`. In Otty, open **Settings → Controls → Option as Alt** and select **Left** or **Both**. Otherwise, Option+G may insert `©` instead of triggering the shortcut.

## How it works and limitations

The extension uses `pi.sendMessage()` to add a hidden marker and start a native session turn. A `context` handler removes the marker before Pi sends a request to the model. The model receives no new `go on` prompt, and the marker is not displayed in the UI. The session journal still contains a hidden bookkeeping entry.

When a marker is present, the handler also removes trailing failed or aborted assistant messages from the request. It retains messages with tool calls to preserve tool-call/result pairs. It does not rewrite session history.

The extension does not resume automatically or guarantee continuation from the exact character where generation stopped. It preserves Pi's native queues, retries, and compaction behavior.

## Development check

Use Node.js 24 or later to run the offline check:

```sh
npm test
```

## Attribution and license

This project is based on npm version `0.3.16` of [monotykamary/pi-invisible-continue](https://github.com/monotykamary/pi-invisible-continue), authored by Tom X Nguyen and declared under the MIT license. It retains the invisible continuation and message-filtering logic, renames the command to `/goon`, and uses its own `pi-goon:resume` marker.

See [LICENSE](LICENSE).
