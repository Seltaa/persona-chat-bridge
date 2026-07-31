"use strict";
/* global MutationObserver, chrome, clearTimeout, document, setTimeout */

(function startPersonaChatGptObserver() {
  const adapter = globalThis.PersonaChatGptDomAdapter;
  if (!adapter) return;

  const QUIET_FINISH_MS = 900;
  const DELTA_THROTTLE_MS = 100;
  let activeElement = null;
  let activeMessageId = null;
  let lastText = "";
  let sentText = "";
  let lastMutationAt = 0;
  let lastDeltaAt = 0;
  let deltaTimer = null;
  let finishTimer = null;
  let started = false;

  function send(event) {
    chrome.runtime.sendMessage({ kind: "persona-chat-event", event });
  }

  function deltaFrom(previous, current) {
    return current.startsWith(previous) ? current.slice(previous.length) : current;
  }

  function finish() {
    if (!started) return;
    flushDelta();
    started = false;
    send({
      type: "assistant_finished",
      message_id: activeMessageId,
    });
  }

  function flushDelta() {
    clearTimeout(deltaTimer);
    deltaTimer = null;
    const delta = deltaFrom(sentText, lastText);
    if (!delta) return;
    send({
      type: "assistant_text_delta",
      message_id: activeMessageId,
      text: delta,
    });
    sentText = lastText;
    lastDeltaAt = Date.now();
  }

  function scheduleDelta() {
    const remaining = Math.max(
      0,
      DELTA_THROTTLE_MS - (Date.now() - lastDeltaAt),
    );
    clearTimeout(deltaTimer);
    deltaTimer = setTimeout(flushDelta, remaining);
  }

  function scheduleFinish() {
    clearTimeout(finishTimer);
    finishTimer = setTimeout(() => {
      const quietFor = Date.now() - lastMutationAt;
      if (adapter.isGenerating() || quietFor < QUIET_FINISH_MS) {
        scheduleFinish();
        return;
      }
      finish();
    }, QUIET_FINISH_MS);
  }

  function inspect() {
    const element = adapter.latestAssistantTurn();
    if (!element) return;
    const currentText = adapter.text(element);
    const elementChanged = element !== activeElement;
    const textChanged = currentText !== lastText;

    if (!elementChanged && !textChanged) {
      if (started) scheduleFinish();
      return;
    }

    lastMutationAt = Date.now();
    if (elementChanged) {
      if (started) finish();
      activeElement = element;
      activeMessageId = adapter.messageId(element);
      lastText = "";
      sentText = "";
      started = true;
      send({
        type: "assistant_started",
        message_id: activeMessageId,
        user_text: adapter.latestUserText().slice(-4_000),
      });
    } else if (!started) {
      started = true;
      send({
        type: "assistant_started",
        message_id: activeMessageId,
        user_text: adapter.latestUserText().slice(-4_000),
      });
    }

    lastText = currentText;
    if (textChanged) scheduleDelta();
    scheduleFinish();
  }

  // Establish a baseline without replaying the conversation already on screen.
  activeElement = adapter.latestAssistantTurn();
  activeMessageId = adapter.messageId(activeElement);
  lastText = adapter.text(activeElement);
  sentText = lastText;

  const observer = new MutationObserver(inspect);
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  globalThis.addEventListener("pagehide", () => {
    clearTimeout(finishTimer);
    clearTimeout(deltaTimer);
    finish();
    observer.disconnect();
  });
})();
