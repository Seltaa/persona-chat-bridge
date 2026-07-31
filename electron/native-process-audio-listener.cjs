"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { AudioActivityGate, DEFAULT_SPEECH_RELEASE_MS } = require("./audio-activity-gate.cjs");
const { discoverVoiceProcesses } = require("./process-discovery.cjs");

const SESSION_IDLE_MS = 8_000;

function helperExecutableName(platform) {
  return platform === "win32" ? "persona-audio-listener.exe" : "persona-audio-listener";
}

function resolveNativeHelperPath({
  platform = process.platform,
  isPackaged = false,
  resourcesPath = process.resourcesPath,
  projectRoot = path.join(__dirname, ".."),
} = {}) {
  const executable = helperExecutableName(platform);
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  return isPackaged
    ? platformPath.join(resourcesPath, "native", platform, executable)
    : platformPath.join(projectRoot, "native", "bin", platform, executable);
}

function createNdjsonParser(onMessage, onInvalid = () => {}) {
  let pending = "";
  return (chunk) => {
    pending += chunk.toString("utf8");
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {
        onInvalid(line);
      }
    }
  };
}

class NativeProcessAudioListener {
  constructor({
    platform = process.platform,
    isPackaged = false,
    resourcesPath = process.resourcesPath,
    helperPath = null,
    processDiscovery = discoverVoiceProcesses,
    spawnProcess = spawn,
    onActivity = () => {},
    onDebug = null,
    onLevel = () => {},
    onSession = () => {},
    onStatus = () => {},
    pollIntervalMs = 1_500,
    sessionIdleMs = SESSION_IDLE_MS,
    speechReleaseMs = DEFAULT_SPEECH_RELEASE_MS,
  } = {}) {
    this.platform = platform;
    this.helperPath =
      helperPath ?? resolveNativeHelperPath({ platform, isPackaged, resourcesPath });
    this.processDiscovery = processDiscovery;
    this.spawnProcess = spawnProcess;
    this.onActivity = onActivity;
    this.onDebug = onDebug;
    this.onSession = onSession;
    this.onStatus = onStatus;
    this.pollIntervalMs = pollIntervalMs;
    this.sessionIdleMs = sessionIdleMs;
    this.capture = null;
    this.captures = new Map();
    this.captureLevels = new Map();
    this.captureKey = null;
    this.pollTimer = null;
    this.sessionTimer = null;
    this.sessionActive = false;
    this.stopped = true;
    this.pollInFlight = false;
    this.lastStatusKey = null;
    this.gate = new AudioActivityGate({
      onActivity,
      onLevel,
      shouldReturnToListening: () => this.sessionActive,
      speechReleaseMs,
    });
  }

  reportStatus(status) {
    const key = JSON.stringify(status);
    if (key === this.lastStatusKey) return;
    this.lastStatusKey = key;
    this.onStatus(status);
  }

  async start() {
    if (!["darwin", "win32"].includes(this.platform) || !this.stopped) return;
    this.stopped = false;
    if (!fs.existsSync(this.helperPath)) {
      this.reportStatus({
        available: false,
        capturing: false,
        monitoring: false,
        source: null,
        error: `Native listener is missing: ${this.helperPath}`,
      });
      return;
    }
    this.reportStatus({
      available: true,
      capturing: false,
      monitoring: true,
      source: null,
    });
    await this.poll();
    this.pollTimer = setInterval(() => void this.poll(), this.pollIntervalMs);
    this.pollTimer.unref?.();
  }

  async poll() {
    if (this.stopped || this.pollInFlight) return;
    this.pollInFlight = true;
    try {
      const processes = await this.processDiscovery({ platform: this.platform });
      if (this.stopped) return;
      const selectedPids =
        this.platform === "win32"
          ? (processes.preferredRootPids ?? processes.rootPids)
          : processes.pids;
      const key = selectedPids.join(",");
      if (!key) {
        this.detach();
        return;
      }
      if ((this.capture || this.captures.size) && this.captureKey === key) return;
      this.detach({ sessionEnded: false });
      this.startCapture(selectedPids, key);
    } catch (error) {
      this.reportStatus({
        available: true,
        capturing: false,
        monitoring: true,
        source: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.pollInFlight = false;
    }
  }

  startCapture(processIds, key) {
    this.captureKey = key;
    if (this.platform === "win32" && processIds.length > 1) {
      for (const processId of processIds) {
        this.startCaptureProcess([processId], String(processId));
      }
      return;
    }
    this.startCaptureProcess(processIds, key);
  }

  startCaptureProcess(processIds, childKey) {
    const args = processIds.flatMap((processId) => ["--pid", String(processId)]);
    const child = this.spawnProcess(this.helperPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    if (this.platform === "win32") {
      this.captures.set(childKey, child);
      this.captureLevels.set(child, 0);
    } else {
      this.capture = child;
    }
    const parse = createNdjsonParser(
      (message) => this.handleHelperMessage(child, message),
      (line) => this.onDebug?.("native listener emitted invalid JSON", line),
    );
    child.stdout.on("data", parse);
    child.stderr.on("data", (chunk) => this.onDebug?.("native listener stderr", chunk.toString()));
    child.once("error", (error) => {
      if (!this.removeCapture(child)) return;
      this.reportStatus({
        available: false,
        capturing: this.hasCaptures(),
        monitoring: true,
        source: null,
        error: error.message,
      });
    });
    child.once("exit", (code, signal) => {
      if (!this.removeCapture(child)) return;
      if (!this.hasCaptures()) {
        this.captureKey = null;
        this.gate.reset();
      }
      this.reportStatus({
        available: true,
        capturing: this.hasCaptures(),
        monitoring: !this.stopped,
        source: null,
        ...(code && !this.stopped
          ? { error: `Native listener exited with code ${code}${signal ? ` (${signal})` : ""}.` }
          : {}),
      });
    });
  }

  hasCaptures() {
    return Boolean(this.capture) || this.captures.size > 0;
  }

  removeCapture(child) {
    if (this.capture === child) {
      this.capture = null;
      return true;
    }
    for (const [key, capture] of this.captures) {
      if (capture !== child) continue;
      this.captures.delete(key);
      this.captureLevels.delete(child);
      return true;
    }
    return false;
  }

  handleHelperMessage(child, message) {
    if (
      (this.capture !== child && ![...this.captures.values()].includes(child)) ||
      message == null ||
      typeof message !== "object"
    ) return;
    if (message.type === "ready") {
      this.reportStatus({
        available: true,
        capturing: true,
        monitoring: true,
        source: message.source || "Supported voice app",
      });
      return;
    }
    if (message.type === "error") {
      this.reportStatus({
        available: false,
        capturing: false,
        monitoring: true,
        source: null,
        error: String(message.message || "Native listener failed."),
      });
      return;
    }
    if (message.type !== "level" || !Number.isFinite(message.level)) return;

    let level = Math.max(0, Math.min(1, Number(message.level)));
    if (this.platform === "win32") {
      this.captureLevels.set(child, level);
      level = Math.max(0, ...this.captureLevels.values());
    }
    if (level > 0.008) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = setTimeout(() => this.endSession(), this.sessionIdleMs);
      this.sessionTimer.unref?.();
      if (!this.sessionActive) {
        this.sessionActive = true;
        this.onSession(true);
        this.onActivity("listening");
      }
    }
    this.gate.handleLevel(level);
  }

  endSession() {
    clearTimeout(this.sessionTimer);
    this.sessionTimer = null;
    if (!this.sessionActive) return;
    this.sessionActive = false;
    this.gate.reset();
    this.onSession(false);
  }

  detach({ sessionEnded = true } = {}) {
    if (this.capture) {
      const child = this.capture;
      this.capture = null;
      child.kill();
    }
    for (const child of this.captures.values()) child.kill();
    this.captures.clear();
    this.captureLevels.clear();
    this.captureKey = null;
    this.gate.reset();
    if (sessionEnded) this.endSession();
    this.reportStatus({
      available: true,
      capturing: false,
      monitoring: !this.stopped,
      source: null,
    });
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.detach();
  }
}

module.exports = {
  NativeProcessAudioListener,
  SESSION_IDLE_MS,
  createNdjsonParser,
  helperExecutableName,
  resolveNativeHelperPath,
};
