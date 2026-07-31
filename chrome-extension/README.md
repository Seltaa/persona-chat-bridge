# Persona Chat Bridge Chrome extension

This unpacked Chrome extension observes visible assistant reply activity on
`https://chatgpt.com` and sends lifecycle events only to the local Persona
desktop bridge at `http://127.0.0.1:47831`.

It does not use private ChatGPT APIs, read cookies, or send conversation text
to a third-party server. Text is sent only over loopback to the local desktop
app, where expression inference runs locally.

## Install for development

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `chrome-extension` folder.
5. Keep Persona running, then reload the ChatGPT tab.

The extension icon reports whether local Persona is reachable.

## Updating for ChatGPT UI changes

All page-specific selectors and extraction logic live in `dom-adapter.js`.
Update that one adapter when ChatGPT's visible DOM changes; the local transport
and Persona event contract remain unchanged.
