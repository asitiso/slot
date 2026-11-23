"use strict";

const { randomIndex, wireToolbar, wireLever } = window.luckyDrawControls;
const deck = window.tarotDeck;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
const stage = $("tarot-stage");
const draw = $("draw");
const drawLabel = draw.querySelector("span");
const lever = $("lever");
const status = $("play-status");
const detail = $("tarot-detail");
const gallery = document.querySelector(".tarot-gallery");
const readingList = $("reading-list");

const positions = [
  { name: "과거", question: "지나온 경험을 돌아봐요.", mark: "✧" },
  { name: "현재", question: "지금의 마음을 살펴봐요.", mark: "☾" },
  { name: "미래", question: "다음 걸음의 힌트를 찾아봐요.", mark: "✦" }
];
const marks = ["✧", "☾", "◇", "✦"];
let pendingFrame = 0;
let spin = null;
let draws = 0;

function asset(card) {
  return "assets/tarot/" + card.id + ".webp";
}

function showDetail(card, index) {
  $("detail-name").textContent = card.name;
  const image = $("detail-art");
  image.src = asset(card);
  image.alt = card.art;
  $("detail-text").textContent = index === undefined
    ? card.theme
    : positions[index].name + " · " + card.reading[index];
  detail.showModal();
}

const slots = Array.from(document.querySelectorAll(".tarot-reel"), (reel, index) => {
  const item = document.createElement("li");
  item.innerHTML = `<button type="button" class="reading-card" disabled>
    <span class="reading-card-art">
      <span class="charm-back" aria-hidden="true"><span></span></span>
      <img width="384" height="600" alt="" hidden>
    </span>
    <span class="reading-card-copy">
      <span class="reading-position"></span>
      <strong class="reading-card-name"></strong>
      <span class="reading-card-meaning"></span>
    </span>
  </button>`;
  const button = item.querySelector("button");
  const slot = {
    position: positions[index],
    index,
    reel,
    reelBack: reel.querySelector(".charm-back"),
    reelMark: reel.querySelector(".charm-back span"),
    reelArt: reel.querySelector("img"),
    button,
    back: button.querySelector(".charm-back"),
    art: button.querySelector("img"),
    name: button.querySelector(".reading-card-name"),
    meaning: button.querySelector(".reading-card-meaning"),
    card: null
  };
  button.querySelector(".reading-position").textContent = slot.position.name;
  slot.back.querySelector("span").textContent = slot.position.mark;
  button.addEventListener("click", () => {
    if (slot.card && !detail.open) showDetail(slot.card, index);
  });
  readingList.append(item);
  return slot;
});

function sealCard(slot, pending) {
  slot.card = null;
  slot.reel.classList.remove("is-revealed");
  slot.reelBack.hidden = false;
  slot.reelMark.textContent = slot.position.mark;
  slot.reelArt.hidden = true;
  slot.back.hidden = false;
  slot.art.hidden = true;
  slot.button.disabled = true;
  slot.name.textContent = pending ? "카드 섞는 중…" : "아직 뒤집지 않았어요";
  slot.meaning.textContent = slot.position.question;
}

function revealCard(slot, card) {
  slot.card = card;
  slot.reel.classList.add("is-revealed");
  slot.reelBack.hidden = true;
  slot.reelArt.hidden = false;
  slot.back.hidden = true;
  slot.art.hidden = false;
  slot.name.textContent = card.name;
  slot.meaning.textContent = card.reading[slot.index];
  slot.button.disabled = false;
  const notes = [440, 554.37, 659.25];
  const note = notes[slot.index];
  tone(note, note * .995, .43, .095, "sine");
  tone(note * 1.5, note * 1.49, .36, .035, "triangle", .03);
}

function finishSpin() {
  spin = null;
  cancelAnimationFrame(pendingFrame);
  pendingFrame = 0;
  draws++;
  stage.classList.remove("is-spinning");
  drawLabel.textContent = "다시 세 장 뽑기";
  status.textContent = "과거·현재·미래의 카드를 뽑았어요.";
  draw.disabled = false;
  lever.disabled = false;
}

function updateSpin(elapsed) {
  const current = spin;
  current.elapsed += elapsed;
  while (current.revealed < slots.length && current.elapsed >= current.timeline[current.revealed]) {
    const index = current.revealed++;
    revealCard(slots[index], current.cards[index]);
  }
  if (current.revealed === slots.length) {
    finishSpin();
    return;
  }
  if (!motion.matches && current.elapsed >= current.nextTick) {
    for (const slot of slots.slice(current.revealed)) {
      slot.reelMark.textContent = marks[(current.tick + slot.index) % marks.length];
    }
    tone(220 + current.revealed * 40, 112, .055, .035, "triangle");
    current.tick++;
    current.nextTick = current.elapsed + 87 + current.elapsed * .055;
  }
}

function spinFrame(now) {
  if (!spin) return;
  const elapsed = now - spin.lastFrame;
  spin.lastFrame = now;
  updateSpin(elapsed);
  if (spin) pendingFrame = requestAnimationFrame(spinFrame);
}

function startDraw(pulled = false) {
  if (spin || detail.open) return;
  unlock();
  tone(255, 96, .19, .075, "triangle");

  const remaining = [...deck];
  const cards = slots.map(() => remaining.splice(randomIndex(remaining.length), 1)[0]);
  slots.forEach((slot, index) => {
    sealCard(slot, true);
    const image = asset(cards[index]);
    slot.reelArt.src = image;
    slot.art.src = image;
  });
  spin = {
    cards,
    elapsed: 0,
    lastFrame: performance.now(),
    revealed: 0,
    tick: 0,
    nextTick: 0,
    timeline: motion.matches ? [270, 270, 270] : [980, 1320, 1660]
  };
  stage.classList.add("is-spinning");
  drawLabel.textContent = "카드 섞는 중…";
  status.textContent = "과거, 현재, 미래의 카드를 섞고 있어요.";
  draw.disabled = true;
  lever.disabled = true;
  animatePull(pulled);
  pendingFrame = requestAnimationFrame(spinFrame);
}

const { unlock, tone } = wireToolbar({
  soundButton: $("sound"),
  fullscreenButton: $("fullscreen"),
  onDraw: startDraw,
  canUseShortcuts: () => !detail.open
});
const animatePull = wireLever({
  machine: $("machine"),
  lever,
  onDraw: startDraw,
  onGrab() {
    unlock();
    tone(225, 152, .09, .048, "triangle");
  }
});
draw.addEventListener("click", () => startDraw());
slots.forEach((slot) => sealCard(slot, false));

gallery.addEventListener("toggle", () => {
  const list = $("gallery-list");
  if (!gallery.open || list.childElementCount) return;
  const cards = deck.map((card) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-card";
    const image = new Image(384, 600);
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = asset(card);
    const label = document.createElement("span");
    label.textContent = card.name;
    button.append(image, label);
    button.addEventListener("click", () => showDetail(card));
    item.append(button);
    return item;
  });
  list.append(...cards);
});

window.render_game_to_text = () => JSON.stringify({
  mode: spin ? "spinning" : draws ? "revealed" : "ready",
  deckSize: deck.length,
  draws,
  cards: slots.filter((slot) => slot.card).map((slot) => ({
    id: slot.card.id, name: slot.card.name, position: slot.position.name
  }))
});

window.advanceTime = (ms) => {
  if (spin && Number.isFinite(ms) && ms > 0) {
    spin.lastFrame = performance.now();
    updateSpin(ms);
  }
};
