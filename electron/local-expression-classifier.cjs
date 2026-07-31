"use strict";

const MODEL_ID = "onnx-community/tanaos-emotion-detection-v1-ONNX";

function scoresByLabel(result) {
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(
    rows
      .filter(
        (row) =>
          typeof row?.label === "string" && Number.isFinite(row?.score),
      )
      .map((row) => [row.label.toLowerCase(), row.score]),
  );
}

function expressionFromResult(result) {
  const scores = scoresByLabel(result);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0] ?? "neutral";

  if (top === "joy" || top === "excitement") return "happy";
  if (top === "sadness") return "sad";
  if (
    top === "surprise" &&
    (scores.fear ?? 0) >= 0.25 &&
    (scores.surprise ?? 0) >= 0.25
  ) {
    return "embarrassed";
  }
  if (top === "surprise") return "surprised";
  if (top === "anger") return "angry";
  if (top === "fear") return "surprised";
  if (top === "disgust") {
    // The multilingual model often represents sheepish/flustered responses as
    // a blend of disgust, sadness, and surprise. This score-based distinction
    // remains language-independent and avoids matching words in the reply.
    if ((scores.sadness ?? 0) >= 0.12 && (scores.surprise ?? 0) >= 0.12) {
      return "embarrassed";
    }
    return "angry";
  }
  return "neutral";
}

function contextualInput({ userText, assistantText }) {
  const user = String(userText ?? "").trim().slice(-2_000);
  const assistant = String(assistantText ?? "").trim().slice(-2_000);
  return [user ? `User:\n${user}` : "", `Assistant:\n${assistant}`]
    .filter(Boolean)
    .join("\n\n");
}

function createLocalExpressionClassifier({ cacheDir, loadPipeline } = {}) {
  let pipelinePromise = null;

  async function defaultLoadPipeline() {
    const transformers = await import("@huggingface/transformers");
    if (cacheDir) transformers.env.cacheDir = cacheDir;
    transformers.env.allowRemoteModels = true;
    return transformers.pipeline("text-classification", MODEL_ID, {
      dtype: "q8",
    });
  }

  function preload() {
    pipelinePromise ??= (loadPipeline ?? defaultLoadPipeline)();
    return pipelinePromise;
  }

  async function classify(context) {
    if (!String(context?.assistantText ?? "").trim()) return "neutral";
    const classifier = await preload();
    const result = await classifier(contextualInput(context), {
      top_k: null,
    });
    return expressionFromResult(result);
  }

  return { classify, preload };
}

module.exports = {
  MODEL_ID,
  contextualInput,
  createLocalExpressionClassifier,
  expressionFromResult,
  scoresByLabel,
};
