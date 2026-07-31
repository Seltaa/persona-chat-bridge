<p align="center">
  <img src="./public/assets/avatar.png" alt="Persona Chat Bridge" width="144" />
</p>

<h1 align="center">Persona Chat Bridge</h1>

<p align="center">
  Give your existing ChatGPT web conversation an expressive VRM desktop avatar.
</p>

Persona Chat Bridge is a modified fork of [Persona by xikhar](https://github.com/xikhar/persona). It keeps Persona's desktop VRM, VRMA, voice-listener, and MCP foundations while adding a local Chrome bridge, text lip sync, and multilingual context-aware expressions.

## What it does

- Imports your own `.vrm` character and `.vrma` motions.
- Watches only the visible ChatGPT conversation in Chrome through an unpacked extension.
- Starts the configured **Speaking** motion while an assistant reply is appearing, then returns to **Idle**.
- Animates the mouth during text replies.
- Infers expressions from conversation context in many languages using a local model.
- Preserves Persona's custom actions and local MCP controls.
- Includes a small built-in OpenAI chat as an optional fallback, not the primary experience.

## Privacy

The Chrome extension does not use private ChatGPT APIs, read cookies, or extract hidden account data. It observes visible user and assistant turns and sends local lifecycle events only to `http://127.0.0.1:47831`.

Conversation text is used locally for expression inference and is not sent to a third-party server. The multilingual classifier downloads from Hugging Face on first use and is then cached in Electron's local application data. Persona Chat Bridge does not record the microphone, save raw audio, or upload audio.

## Run from source

Requirements:

- Node.js 24 or newer
- npm
- Git
- Windows 10 build 20348 or newer for process audio capture

```powershell
git clone https://github.com/Seltaa/persona-chat-bridge.git
cd persona-chat-bridge
npm install
npm run native:build
npm run demo
```

`npm run demo` is the developer launch command. It builds the renderer and keeps diagnostic output in the terminal. Packaged releases launch normally without a terminal window.

## Set up the Chrome bridge

1. Keep Persona Chat Bridge running.
2. Right-click its tray icon and choose **Open Chrome Extension Folder**.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the opened `chrome-extension` folder.
6. Reload the ChatGPT tab.

The extension icon reports whether the local desktop bridge is reachable. All ChatGPT-specific selectors are isolated in `chrome-extension/dom-adapter.js` so UI changes can be repaired without rewriting the transport.

## Add a character and motions

Open **Settings** from the tray menu and import a `.vrm` model. The first imported model becomes the default. Add one or more `.vrma` clips to **Idle** and **Speaking**; Persona chooses randomly between clips whenever that action begins.

Custom actions can also be created with a name, description, and trigger scenario. These remain available through Persona's MCP integration.

Character models and animation files are not included. Only use assets you have permission to use, and never republish purchased or restricted VRM/VRMA files with this project.

## Optional MCP integration

With the app running:

```powershell
codex mcp add persona-chat-bridge --url http://127.0.0.1:47831/mcp
```

MCP can play configured actions, show or hide the avatar, and read local readiness status. It does not expose filesystem, transcript, or raw audio access.

## Build a Windows installer

```powershell
npm run dist:windows
```

The installer is written to `release/`. Windows builds require Visual Studio Build Tools with the **Desktop development with C++** workload. Linux and macOS packaging commands remain available as `npm run dist:linux` and `npm run dist:mac`.

## Development

```powershell
npm run lint
npm test
npm run assets:check
npm run build
```

See [Architecture and development](docs/DEVELOPMENT.md), [integration API](docs/INTEGRATIONS.md), and [release process](docs/RELEASING.md).

## Credits and license

Persona Chat Bridge is based on [Persona](https://github.com/xikhar/persona) by xikhar. The application source is distributed under the [MIT License](LICENSE), and the original notice is retained. See [Third-party notices](THIRD_PARTY_NOTICES.md) for the local expression model and runtime dependencies.

Character assets are not covered by the application license and are not included.
