"use strict";

const { voiceState } = require("./protocol-actions.cjs");

function chromeChatEventToBridgeEvents(event) {
  if (
    event?.source !== "chatgpt-chrome" ||
    ![
      "assistant_started",
      "assistant_text_delta",
      "assistant_finished",
    ].includes(event.type)
  ) {
    return null;
  }

  if (event.type === "assistant_finished") {
    return [
      { type: "text-speaking", active: false },
      { type: "audio-level", level: 0 },
      voiceState("idle", "inactive"),
    ];
  }

  const textLength =
    event.type === "assistant_text_delta" ? event.text?.length ?? 0 : 0;
  return [
    { type: "text-speaking", active: true },
    voiceState("speaking"),
    {
      type: "audio-level",
      level:
        event.type === "assistant_started"
          ? 0.11
          : Math.min(0.24, 0.1 + (textLength % 8) * 0.018),
    },
  ];
}

module.exports = { chromeChatEventToBridgeEvents };
