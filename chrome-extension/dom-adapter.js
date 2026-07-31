"use strict";
/* global HTMLElement, document */

// This is the only file that knows ChatGPT's DOM shape. Keep page-specific
// selectors here so a ChatGPT UI change requires one small update.
(function exposePersonaChatGptDomAdapter(global) {
  const SELECTORS = {
    assistantTurns: [
      '[data-message-author-role="assistant"]',
      'article[data-turn="assistant"]',
    ],
    userTurns: [
      '[data-message-author-role="user"]',
      'article[data-turn="user"]',
    ],
    generating: [
      '[data-testid="stop-button"]',
      'button[aria-label*="Stop generating" i]',
      'button[aria-label*="응답 생성 중지" i]',
    ],
  };

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = global.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function allMatching(selectors) {
    const seen = new Set();
    const matches = [];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!seen.has(element) && visible(element)) {
          seen.add(element);
          matches.push(element);
        }
      }
    }
    return matches;
  }

  function latestAssistantTurn() {
    return allMatching(SELECTORS.assistantTurns).at(-1) ?? null;
  }

  function latestUserText() {
    return text(allMatching(SELECTORS.userTurns).at(-1) ?? null);
  }

  function messageId(element) {
    if (!element) return null;
    const turn = element.closest(
      '[data-testid^="conversation-turn-"], article, [data-message-id]',
    );
    return (
      turn?.getAttribute("data-message-id") ||
      turn?.getAttribute("data-testid") ||
      element.getAttribute("data-message-id") ||
      null
    );
  }

  function text(element) {
    return element?.innerText?.trim() ?? "";
  }

  function isGenerating() {
    return allMatching(SELECTORS.generating).length > 0;
  }

  global.PersonaChatGptDomAdapter = Object.freeze({
    selectors: SELECTORS,
    latestAssistantTurn,
    latestUserText,
    messageId,
    text,
    isGenerating,
  });
})(globalThis);
