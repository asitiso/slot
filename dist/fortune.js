"use strict";

const { randomIndex, wireToolbar, wireLever } = window.luckyDrawControls;
const topics = window.fortuneTopics;
const fortunes = topics.flatMap((topic) => topic.entries.map(([headline, copy, tip]) => ({
  topic, headline, copy, tip
})));
const colors = [
  ["하늘색", "#8cc9ec"], ["연노랑", "#f5d479"], ["살구색", "#f0ad82"],
  ["민트색", "#81c6af"], ["연보라", "#b49fde"], ["코랄색", "#e88a78"],
  ["크림색", "#fff1cb"], ["연두색", "#b4c778"], ["장밋빛", "#d88fa3"],
  ["청록색", "#4f9b94"], ["남색", "#4b638c"], ["벽돌색", "#b45d4b"]
];
const localDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long"
});
const isoDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
});
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
const stage = $("fortune-stage");
const draw = $("draw");
const drawLabel = draw.querySelector("span");
const lever = $("lever");
const result = $("fortune-result");
const badge = $("fortune-topic");
const headline = $("fortune-headline");
const copy = $("fortune-copy");
const emblem = $("fortune-motif");
const extras = $("fortune-extras");
const reels = Array.from(document.querySelectorAll(".fortune-reel"), (cell) => ({
  mark: cell.querySelector("span"),
  image: cell.querySelector("img")
}));

let remaining = [...fortunes];
let latest = null;
let spin = null;
let frameId = 0;
let draws = 0;

function artwork(topic) {
  return "assets/fortune/" + topic.id + ".webp";
}

function renderDate() {
  const now = new Date();
  $("fortune-date").dateTime = isoDate.format(now);
  $("fortune-date").textContent = localDate.format(now);
}

function renderTopics() {
  const rows = topics.map((topic) => {
    const item = document.createElement("li");
    const image = new Image(48, 48);
    image.src = artwork(topic);
    image.alt = "";
    image.decoding = "async";
    const label = document.createElement("span");
    label.textContent = topic.label;
    item.append(image, label);
    return item;
  });
  $("fortune-topics").append(...rows);
}

function chooseFortune() {
  if (!remaining.length) remaining = [...fortunes];
  const choices = remaining.filter((entry) => entry !== latest?.entry);
  const entry = choices[randomIndex(choices.length)];
  remaining.splice(remaining.indexOf(entry), 1);
  const [color, colorValue] = colors[randomIndex(colors.length)];
  return { entry, color, colorValue, number: randomIndex(99) + 1 };
}

function showReel(reel, topic) {
  reel.image.hidden = !topic;
  reel.mark.hidden = Boolean(topic);
  if (topic) reel.image.src = artwork(topic);
}

function finishSpin() {
  latest = spin.pick;
  spin = null;
  cancelAnimationFrame(frameId);
  frameId = 0;
  draws++;

  const { entry, color, colorValue, number } = latest;
  showReel(reels[0], null);
  showReel(reels[1], entry.topic);
  showReel(reels[2], null);
  stage.classList.remove("is-spinning");
  stage.classList.add("is-revealed");
  renderDate();
  result.dataset.topic = entry.topic.id;
  emblem.src = artwork(entry.topic);
  badge.textContent = entry.topic.label;
  badge.hidden = false;
  headline.textContent = entry.headline;
  copy.textContent = entry.copy;
  $("fortune-tip").textContent = entry.tip;
  $("luck-swatch").style.backgroundColor = colorValue;
  $("luck-color").textContent = color;
  $("luck-number").textContent = number;
  extras.hidden = false;

  $("play-status").textContent = entry.topic.label + "이 나왔어요.";
  drawLabel.textContent = "다시 뽑기";
  draw.disabled = false;
  lever.disabled = false;
  tone(392, 388, .28, .09, "triangle");
  tone(523.25, 520, .32, .075, "sine", .065);
  tone(659.25, 656, .35, .075, "sine", .14);
}

function updateSpin(elapsed) {
  spin.elapsed += elapsed;
  if (spin.elapsed >= spin.duration) {
    finishSpin();
    return;
  }
  if (!motion.matches && spin.elapsed >= spin.nextTick) {
    reels.forEach((reel, index) => showReel(reel, topics[(spin.tick + index * 2) % topics.length]));
    const progress = spin.elapsed / spin.duration;
    tone(235 - 58 * progress, 102, .065, .038, "triangle");
    spin.tick++;
    spin.nextTick = spin.elapsed + 66 + 134 * progress ** 2;
  }
}

function spinFrame(now) {
  if (!spin) return;
  const elapsed = now - spin.lastFrame;
  spin.lastFrame = now;
  updateSpin(elapsed);
  if (spin) frameId = requestAnimationFrame(spinFrame);
}

function startDraw(pulled = false) {
  if (spin) return;
  unlock();
  tone(230, 105, .15, .07, "triangle");

  const pick = chooseFortune();
  spin = { pick, elapsed: 0, lastFrame: performance.now(), nextTick: 0, tick: randomIndex(topics.length), duration: motion.matches ? 270 : 1270 };
  renderDate();
  reels.forEach((reel) => showReel(reel, null));
  stage.classList.remove("is-revealed");
  stage.classList.add("is-spinning");
  result.removeAttribute("data-topic");
  badge.hidden = true;
  extras.hidden = true;
  emblem.src = artwork(topics[0]);
  headline.textContent = "운세를 뽑고 있어요…";
  copy.textContent = "";
  $("play-status").textContent = "오늘의 운세를 고르고 있어요.";
  drawLabel.textContent = "뽑는 중…";
  draw.disabled = true;
  lever.disabled = true;
  animatePull(pulled);
  frameId = requestAnimationFrame(spinFrame);
}

const { unlock, tone } = wireToolbar({ soundButton: $("sound"), fullscreenButton: $("fullscreen"), onDraw: startDraw });
const animatePull = wireLever({
  machine: $("machine"), lever, onDraw: startDraw,
  onGrab() {
    unlock();
    tone(260, 160, .085, .047, "triangle");
  }
});
draw.addEventListener("click", () => startDraw());
window.addEventListener("pageshow", renderDate);
renderDate();
renderTopics();
draw.disabled = false;
lever.disabled = false;

window.render_game_to_text = () => JSON.stringify({
  mode: spin ? "spinning" : latest ? "revealed" : "ready",
  draws,
  poolSize: fortunes.length,
  topicCount: topics.length,
  date: $("fortune-date").dateTime,
  headline: latest?.entry.headline ?? null,
  topic: latest?.entry.topic.label ?? null,
  luckyColor: latest?.color ?? null,
  luckyNumber: latest?.number ?? null
});

window.advanceTime = (ms) => {
  if (spin && Number.isFinite(ms) && ms > 0) {
    spin.lastFrame = performance.now();
    updateSpin(ms);
  }
};
