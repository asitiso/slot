"use strict";

window.luckyDrawControls = (() => {
  const soundKey = "lucky-draw.sound";

  function loadSound() {
    try {
      const value = localStorage.getItem(soundKey);
      if (value !== null) return value === "on";
      const oldGame = JSON.parse(localStorage.getItem("lucky-bunny-draw.v1"));
      const enabled = oldGame?.sound !== false;
      saveSound(enabled);
      return enabled;
    } catch {
      return true;
    }
  }

  function saveSound(enabled) {
    try {
      localStorage.setItem(soundKey, enabled ? "on" : "off");
    } catch {
      // Storage may be unavailable in private or restricted browser modes.
    }
  }

  function randomIndex(size) {
    const entropy = new Uint32Array(1);
    const bound = 0x100000000 - (0x100000000 % size);
    do {
      crypto.getRandomValues(entropy);
    } while (entropy[0] >= bound);
    return entropy[0] % size;
  }

  function wireToolbar({ soundButton, fullscreenButton, onDraw, canUseShortcuts = () => true }) {
    let enabled = loadSound();
    let audio;

    function unlock() {
      if (!enabled || !window.AudioContext) return;
      try {
        audio ||= new AudioContext();
        if (audio.state === "suspended") audio.resume().catch(() => {});
      } catch {
        // The animation still marks each stage of the draw.
      }
    }

    function tone(frequency, endFrequency, length, volume, type = "sine", delay = 0) {
      if (!enabled || !audio || audio.state !== "running") return;
      const start = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + length + .015);
    }

    function renderSound() {
      soundButton.setAttribute("aria-pressed", enabled);
      soundButton.querySelector("use").setAttribute("href", enabled ? "#icon-sound" : "#icon-muted");
      soundButton.querySelector("span").textContent = enabled ? "소리 켜짐" : "소리 꺼짐";
    }

    soundButton.addEventListener("click", () => {
      enabled = !enabled;
      if (enabled) {
        unlock();
        tone(620, 780, .14, .065, "triangle");
      }
      renderSound();
      saveSound(enabled);
    });
    window.addEventListener("pageshow", () => {
      // A page restored by the back button may have stale toolbar state.
      try {
        const saved = localStorage.getItem(soundKey);
        if (saved !== null) enabled = saved === "on";
        renderSound();
      } catch {
        // Keep the current choice when storage is disabled.
      }
    });
    renderSound();

    const canFullscreen = document.fullscreenEnabled && Boolean(document.documentElement.requestFullscreen);
    fullscreenButton.hidden = !canFullscreen;
    function toggleFullscreen() {
      if (!canFullscreen) return;
      const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      action.catch(() => {});
    }

    fullscreenButton.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      const active = Boolean(document.fullscreenElement);
      const label = active ? "전체 화면 나가기" : "전체 화면";
      fullscreenButton.title = label;
      fullscreenButton.setAttribute("aria-label", label);
      fullscreenButton.querySelector("use").setAttribute("href", active ? "#icon-collapse" : "#icon-expand");
    });

    document.addEventListener("keydown", (event) => {
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || !canUseShortcuts()) return;
      if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (event.code === "Space" && !event.target.closest?.("button, a")) {
        event.preventDefault();
        onDraw();
      } else if (event.code === "KeyF") {
        toggleFullscreen();
      }
    });

    return { unlock, tone };
  }

  function wireLever({ machine, lever, onDraw, onGrab, travel = .3 }) {
    let drag = null;

    function setPull(amount) {
      machine.style.setProperty("--pull", amount);
    }

    lever.addEventListener("click", (event) => {
      if (event.detail === 0) onDraw();
    });

    lever.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || lever.disabled || drag) return;
      onGrab();
      lever.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, origin: event.clientY, x: event.clientX, amount: 0 };
      machine.classList.add("is-pulling");
    });

    lever.addEventListener("pointermove", (event) => {
      if (drag?.id !== event.pointerId) return;
      const distance = machine.getBoundingClientRect().height * travel;
      drag.amount = Math.min(1, Math.max(0, (event.clientY - drag.origin) / distance));
      setPull(drag.amount);
    });

    function release(event, cancelled) {
      if (drag?.id !== event.pointerId) return;
      const amount = drag.amount;
      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.origin);
      drag = null;
      machine.classList.remove("is-pulling");
      if (!cancelled && !lever.disabled && amount >= .65) onDraw(true);
      else if (!cancelled && !lever.disabled && distance < 8) onDraw();
      else setPull(0);
    }

    lever.addEventListener("pointerup", (event) => release(event, false));
    lever.addEventListener("pointercancel", (event) => release(event, true));
    lever.addEventListener("lostpointercapture", (event) => release(event, true));

    return function animatePull(pulled) {
      if (!pulled) setPull(1);
      setTimeout(() => setPull(0), pulled ? 25 : 150);
    };
  }

  return { randomIndex, wireLever, wireToolbar };
})();
