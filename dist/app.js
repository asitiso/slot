"use strict";

const $ = (id) => document.getElementById(id);
const ui = {
  stage: document.querySelector(".stage"),
  machine: $("machine"),
  reel: $("reel-value"),
  lever: $("lever"),
  confetti: $("confetti"),
  draw: $("draw"),
  status: $("play-status"),
  remaining: $("remaining"),
  remainingLabel: $("remaining-label"),
  rangeMode: $("range-mode"),
  listMode: $("list-mode"),
  from: $("from"),
  to: $("to"),
  numbers: $("numbers"),
  form: $("settings-form"),
  fields: $("settings-fields"),
  feedback: $("settings-feedback"),
  currentPool: $("current-pool"),
  repeat: $("repeat"),
  count: $("history-count"),
  empty: $("empty-history"),
  history: $("history-list"),
  reset: $("reset"),
  sound: $("sound"),
  fullscreen: $("fullscreen"),
  confirm: $("confirm")
};

const STORAGE_KEY = "lucky-bunny-draw.v1";
const MAX_NUMBER = 999;
const motion = matchMedia("(prefers-reduced-motion: reduce)");

function makeRange(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function validNumber(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_NUMBER;
}

function loadGame() {
  const initial = { kind: "range", pool: makeRange(1, 20), history: [], repeat: false, sound: true };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.pool) || !saved.pool.length ||
        saved.pool.length > MAX_NUMBER + 1 || !saved.pool.every(validNumber)) return initial;

    const pool = [...new Set(saved.pool)].sort((a, b) => a - b);
    const seen = new Set(pool);
    const kind = saved.kind === "range" && pool.at(-1) - pool[0] + 1 === pool.length ? "range" : "list";
    const history = Array.isArray(saved.history) ? saved.history.filter((value) => seen.has(value)) : [];
    return { kind, pool, history, repeat: saved.repeat === true, sound: saved.sound !== false };
  } catch {
    return initial;
  }
}

const game = loadGame();
let available = [];
let mode = game.kind;
let spin = null;
let animationFrame = 0;
let drag = null;
let confirmAction = null;
let confettiTimer = 0;

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // The current draw remains usable when browser storage is unavailable.
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

function updateAvailable() {
  const drawn = new Set(game.history);
  available = game.repeat ? game.pool : game.pool.filter((value) => !drawn.has(value));
}

function showNumber(value) {
  ui.reel.textContent = value;
  ui.reel.classList.toggle("wide", String(value).length > 2);
}

function renderDraw() {
  const active = Boolean(spin);
  const last = game.history.at(-1);
  const exhausted = !available.length;
  ui.remaining.textContent = available.length;
  ui.remainingLabel.textContent = game.repeat ? "뽑을 수 있는 번호" : "남은 번호";
  ui.stage.classList.toggle("is-spinning", active);
  ui.stage.classList.toggle("is-result", !active && last !== undefined);
  ui.stage.classList.toggle("is-exhausted", exhausted);
  if (!active) showNumber(last ?? "?");

  let status = "레버를 당겨 번호를 뽑아요!";
  if (active) status = "두구두구… 번호를 뽑고 있어요!";
  else if (exhausted) status = last + "번이 뽑혔어요! 모든 번호를 뽑았어요.";
  else if (last !== undefined) status = last + "번이 뽑혔어요!";
  if (ui.status.textContent !== status) ui.status.textContent = status;

  ui.draw.disabled = active || exhausted;
  ui.lever.disabled = active || exhausted;
  ui.draw.querySelector("span").textContent = active ? "뽑는 중…" : "번호 뽑기";
  ui.rangeMode.disabled = active;
  ui.listMode.disabled = active;
  ui.fields.disabled = active;
  ui.repeat.disabled = active;
  ui.reset.disabled = active;
}

function renderHistory() {
  ui.count.textContent = game.history.length.toLocaleString("ko-KR") + "회";
  const hasHistory = game.history.length > 0;
  ui.empty.hidden = hasHistory;
  ui.history.hidden = !hasHistory;
  ui.reset.hidden = !hasHistory;
  const entries = document.createDocumentFragment();
  game.history.forEach((number, index) => {
    const item = document.createElement("li");
    item.textContent = number;
    item.setAttribute("aria-label", (index + 1) + "번째 뽑기, " + number + "번");
    entries.prepend(item);
  });
  ui.history.replaceChildren(entries);
  ui.history.scrollTop = 0;
}

function renderPool() {
  const summary = game.kind === "range" && game.pool.length > 1
    ? game.pool[0] + "–" + game.pool.at(-1)
    : game.pool.join(", ");
  ui.currentPool.textContent = summary;
  ui.currentPool.title = summary;
}

function showFeedback(text = "", invalid = []) {
  [ui.from, ui.to, ui.numbers].forEach((input) => input.removeAttribute("aria-invalid"));
  invalid.forEach((input) => input.setAttribute("aria-invalid", "true"));
  ui.feedback.hidden = !text;
  ui.feedback.textContent = text;
  ui.feedback.classList.toggle("is-error", invalid.length > 0);
}

function chooseMode(next) {
  mode = next;
  const range = mode === "range";
  ui.rangeMode.setAttribute("aria-pressed", range);
  ui.listMode.setAttribute("aria-pressed", !range);
  $("range-fields").hidden = !range;
  $("list-fields").hidden = range;
  showFeedback();
}

function readPool() {
  if (mode === "range") {
    const first = ui.from.valueAsNumber;
    const last = ui.to.valueAsNumber;
    const invalid = [ui.from, ui.to].filter((input) => !validNumber(input.valueAsNumber));
    if (invalid.length) {
      showFeedback("0부터 999까지의 정수를 입력해 주세요.", invalid);
      invalid[0].focus();
      return null;
    }
    if (first > last) {
      showFeedback("시작 번호는 끝 번호보다 작거나 같아야 해요.", [ui.from, ui.to]);
      ui.to.focus();
      return null;
    }
    return makeRange(first, last);
  }

  const tokens = ui.numbers.value.trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) {
    showFeedback("후보 번호를 한 개 이상 입력해 주세요.", [ui.numbers]);
    ui.numbers.focus();
    return null;
  }
  if (!tokens.every((token) => /^[0-9]+$/.test(token) && validNumber(Number(token)))) {
    showFeedback("0부터 999까지의 정수만 입력해 주세요.", [ui.numbers]);
    ui.numbers.focus();
    return null;
  }
  return [...new Set(tokens.map(Number))].sort((a, b) => a - b);
}

function askConfirmation(title, detail, action, callback) {
  $("confirm-title").textContent = title;
  $("confirm-detail").textContent = detail;
  $("confirm-action").textContent = action;
  confirmAction = callback;
  ui.confirm.returnValue = "";
  ui.confirm.showModal();
}

function clearHistory() {
  game.history = [];
  updateAvailable();
  renderHistory();
  renderDraw();
  clearTimeout(confettiTimer);
  ui.confetti.replaceChildren();
}

function applyPool(pool, nextMode, resetHistory) {
  game.pool = pool;
  game.kind = nextMode;
  if (resetHistory) clearHistory();
  renderPool();
  saveGame();
  showFeedback("후보 번호 " + pool.length + "개를 적용했어요.");
}

ui.confirm.addEventListener("close", () => {
  const callback = confirmAction;
  confirmAction = null;
  if (ui.confirm.returnValue === "confirm") callback?.();
});

ui.rangeMode.addEventListener("click", () => chooseMode("range"));
ui.listMode.addEventListener("click", () => chooseMode("list"));
ui.form.addEventListener("input", () => showFeedback());
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (spin) return;
  const pool = readPool();
  if (!pool) return;

  const changed = pool.length !== game.pool.length || pool.some((value, index) => value !== game.pool[index]);
  const nextMode = mode;
  const apply = () => applyPool(pool, nextMode, changed);
  if (changed && game.history.length) {
    askConfirmation("후보 번호를 바꿀까요?", "새 후보를 적용하면 지금까지의 뽑기 기록이 초기화돼요.", "번호 적용", apply);
  } else {
    apply();
  }
});

ui.reset.addEventListener("click", () => {
  if (spin) return;
  askConfirmation("뽑기 기록을 초기화할까요?", "기록을 지우면 모든 후보 번호를 다시 뽑을 수 있어요.", "초기화", () => {
    clearHistory();
    saveGame();
    ui.draw.focus();
  });
});

ui.repeat.addEventListener("change", () => {
  game.repeat = ui.repeat.checked;
  updateAvailable();
  renderDraw();
  saveGame();
});

let audio;

function unlockAudio() {
  if (!game.sound || !window.AudioContext) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    // Animation carries the same feedback when audio is unavailable.
  }
}

function tone(frequency, endFrequency, length, volume, type = "sine", delay = 0) {
  if (!game.sound || !audio || audio.state !== "running") return;
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
  ui.sound.setAttribute("aria-pressed", game.sound);
  ui.sound.querySelector("use").setAttribute("href", game.sound ? "#icon-sound" : "#icon-muted");
  ui.sound.querySelector("span").textContent = game.sound ? "소리 켜짐" : "소리 꺼짐";
}

ui.sound.addEventListener("click", () => {
  game.sound = !game.sound;
  if (game.sound) {
    unlockAudio();
    tone(620, 780, .14, .065, "triangle");
  }
  renderSound();
  saveGame();
});

function celebrate() {
  if (motion.matches) return;
  clearTimeout(confettiTimer);
  const colors = ["#db78ac", "#e6ae4e", "#9c77d3", "#74bca1", "#ffc6d0"];
  const bits = document.createDocumentFragment();
  for (let index = 0; index < 19; index++) {
    const angle = index * Math.PI * 2 / 19;
    const reach = 26 + (index % 5) * 5;
    const bit = document.createElement("span");
    bit.style.setProperty("--color", colors[index % colors.length]);
    bit.style.setProperty("--dx", Math.cos(angle) * reach + "cqw");
    bit.style.setProperty("--dy", Math.sin(angle) * reach * .76 - 7 + "cqw");
    bit.style.setProperty("--turn", (index % 2 ? 1 : -1) * (140 + index * 17) + "deg");
    bits.append(bit);
  }
  ui.confetti.replaceChildren(bits);
  confettiTimer = setTimeout(() => ui.confetti.replaceChildren(), 820);
}

function finalizeDraw() {
  const selection = spin.selection;
  spin = null;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  game.history.push(selection);
  updateAvailable();
  saveGame();
  renderHistory();
  renderDraw();
  celebrate();
  tone(523.25, 522, .23, .075, "triangle");
  tone(659.25, 658, .23, .075, "triangle", .075);
  tone(783.99, 783, .36, .095, "sine", .15);
}

function updateSpin(elapsed) {
  spin.elapsed += elapsed;
  if (spin.elapsed >= spin.duration) {
    finalizeDraw();
    return;
  }

  if (!motion.matches && spin.elapsed >= spin.nextTick) {
    const progress = spin.elapsed / spin.duration;
    showNumber(available[randomIndex(available.length)]);
    tone(180 + 140 * (1 - progress), 110, .055, .045, "triangle");
    spin.nextTick = spin.elapsed + 53 + 155 * progress ** 3;
  }
}

function spinFrame(now) {
  if (!spin) return;
  const elapsed = now - spin.lastFrame;
  spin.lastFrame = now;
  updateSpin(elapsed);
  if (spin) animationFrame = requestAnimationFrame(spinFrame);
}

function setPull(amount) {
  ui.machine.style.setProperty("--pull", amount);
}

function startDraw(pulled = false) {
  if (spin || !available.length || ui.confirm.open) return;
  unlockAudio();
  const now = performance.now();
  spin = {
    selection: available[randomIndex(available.length)],
    duration: motion.matches ? 270 : 1250,
    elapsed: 0,
    lastFrame: now,
    nextTick: 0
  };
  tone(260, 95, .115, .09, "triangle");
  if (!pulled) setPull(1);
  setTimeout(() => setPull(0), pulled ? 25 : 150);
  renderDraw();
  animationFrame = requestAnimationFrame(spinFrame);
}

ui.draw.addEventListener("click", () => startDraw());
ui.lever.addEventListener("click", (event) => {
  if (event.detail === 0) startDraw();
});

ui.lever.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0 || spin || drag || !available.length) return;
  unlockAudio();
  ui.lever.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, origin: event.clientY, x: event.clientX, amount: 0 };
  ui.machine.classList.add("is-pulling");
  tone(215, 170, .065, .05, "triangle");
});

ui.lever.addEventListener("pointermove", (event) => {
  if (drag?.id !== event.pointerId) return;
  const travel = ui.machine.getBoundingClientRect().height * .30;
  drag.amount = Math.min(1, Math.max(0, (event.clientY - drag.origin) / travel));
  setPull(drag.amount);
});

function releaseLever(event, cancelled) {
  if (drag?.id !== event.pointerId) return;
  const amount = drag.amount;
  const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.origin);
  drag = null;
  ui.machine.classList.remove("is-pulling");
  if (!cancelled && amount >= .65) startDraw(true);
  else if (!cancelled && distance < 8) startDraw();
  else setPull(0);
}

ui.lever.addEventListener("pointerup", (event) => releaseLever(event, false));
ui.lever.addEventListener("pointercancel", (event) => releaseLever(event, true));
ui.lever.addEventListener("lostpointercapture", (event) => releaseLever(event, true));

const canFullscreen = document.fullscreenEnabled && Boolean(document.documentElement.requestFullscreen);
ui.fullscreen.hidden = !canFullscreen;

function toggleFullscreen() {
  if (!canFullscreen) return;
  const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  action.catch(() => {});
}

ui.fullscreen.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement);
  const label = active ? "전체 화면 나가기" : "전체 화면";
  ui.fullscreen.title = label;
  ui.fullscreen.setAttribute("aria-label", label);
  ui.fullscreen.querySelector("use").setAttribute("href", active ? "#icon-collapse" : "#icon-expand");
});

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || ui.confirm.open) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (event.code === "Space" && !event.target.closest?.("button, a")) {
    event.preventDefault();
    startDraw();
  } else if (event.code === "KeyF") {
    toggleFullscreen();
  }
});

window.render_game_to_text = () => JSON.stringify({
  mode: spin ? "spinning" : available.length ? "ready" : "exhausted",
  pool: game.pool,
  remaining: available.length,
  repeat: game.repeat,
  draws: game.history.length,
  recent: game.history.slice(-12).reverse(),
  last: game.history.at(-1) ?? null
});

window.advanceTime = (ms) => {
  if (spin && Number.isFinite(ms) && ms > 0) {
    spin.lastFrame = performance.now();
    updateSpin(ms);
  }
};

ui.from.value = game.pool[0];
ui.to.value = game.pool.at(-1);
if (game.kind === "list") ui.numbers.value = game.pool.join(", ");
ui.repeat.checked = game.repeat;
chooseMode(game.kind);
renderSound();
updateAvailable();
renderPool();
renderDraw();
renderHistory();
