"use strict";
/* global chrome, fetch */

const PERSONA_EVENTS_URL = "http://127.0.0.1:47831/events";

async function postPersonaEvent(event) {
  const response = await fetch(PERSONA_EVENTS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Persona returned ${response.status}`);
}

function setBadge(connected) {
  chrome.action.setBadgeText({ text: connected ? "" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#d84b4b" });
  chrome.storage.local.set({
    lastStatus: connected ? "connected" : "unavailable",
    lastStatusAt: Date.now(),
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    message?.kind !== "persona-chat-event" ||
    sender.url == null ||
    !sender.url.startsWith("https://chatgpt.com/")
  ) {
    return;
  }
  void postPersonaEvent(message.event)
    .then(() => setBadge(true))
    .catch(() => setBadge(false));
});
