"use strict";

function createContextualExpressionController({
  classify,
  onExpression,
  onError = () => {},
  debounceMs = 550,
  expressionHoldMs = 6_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let userText = "";
  let assistantText = "";
  let lastClassifiedText = "";
  let generation = 0;
  let timer = null;
  let resetTimer = null;

  async function classifyCurrent(expectedGeneration = generation) {
    clearTimer(timer);
    timer = null;
    if (!assistantText.trim()) return;
    if (assistantText === lastClassifiedText) return;
    const context = { userText, assistantText };
    lastClassifiedText = assistantText;
    try {
      const expression = await classify(context);
      if (generation === expectedGeneration && expression !== "neutral") {
        onExpression(expression);
      }
    } catch (error) {
      if (lastClassifiedText === context.assistantText) {
        lastClassifiedText = "";
      }
      if (generation === expectedGeneration) onError(error);
    }
  }

  function schedule() {
    if (timer != null) return;
    const expectedGeneration = generation;
    timer = setTimer(
      () => void classifyCurrent(expectedGeneration),
      debounceMs,
    );
  }

  function handle(event) {
    if (event?.source !== "chatgpt-chrome") return;
    if (event.type === "assistant_started") {
      generation += 1;
      clearTimer(timer);
      clearTimer(resetTimer);
      timer = null;
      resetTimer = null;
      userText = String(event.userText ?? "").slice(-4_000);
      assistantText = "";
      lastClassifiedText = "";
      onExpression("neutral");
    } else if (event.type === "assistant_text_delta") {
      assistantText = `${assistantText}${event.text ?? ""}`.slice(-4_000);
      schedule();
    } else if (event.type === "assistant_finished") {
      clearTimer(timer);
      timer = null;
      const expectedGeneration = generation;
      void classifyCurrent(expectedGeneration).finally(() => {
        if (generation !== expectedGeneration) return;
        resetTimer = setTimer(() => {
          if (generation !== expectedGeneration) return;
          userText = "";
          assistantText = "";
          onExpression("neutral");
        }, expressionHoldMs);
      });
    }
  }

  return { classifyCurrent, handle };
}

module.exports = { createContextualExpressionController };
