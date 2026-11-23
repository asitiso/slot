"use strict";

const charms = [
  { id: "love", category: "연애운", clue: "마주 본 그림자", name: "인연부적", motif: "마주 보는 두 마리 까치와 매듭", wish: "마음이 통하는 인연을 만나길 바라요." },
  { id: "wealth", category: "금전운", clue: "둥근 금빛", name: "재물부적", motif: "곡식 이삭과 엽전 세 닢", wish: "차곡차곡 모은 노력에 풍요가 더해지길 바라요." },
  { id: "career", category: "출세운", clue: "해가 뜨는 쪽", name: "입신양명부적", motif: "떠오르는 해와 날개를 편 학", wish: "실력을 펼칠 기회를 만나고 한 걸음 더 나아가길 바라요." },
  { id: "exam", category: "합격운", clue: "꽃 핀 책장", name: "합격부적", motif: "펼친 책과 꽃 핀 매화 가지", wish: "준비한 만큼 마음껏 실력을 펼치길 바라요." },
  { id: "health", category: "건강운", clue: "늘 푸른 나무", name: "건강장수부적", motif: "소나무와 영지버섯", wish: "몸과 마음이 튼튼하고 일상에 활기가 넘치길 바라요." },
  { id: "home", category: "가정 평안", clue: "따뜻한 처마", name: "가택평안부적", motif: "한옥 지붕과 둥근 구름", wish: "집으로 돌아오는 길 끝에 따뜻한 평안이 있길 바라요." },
  { id: "protection", category: "액막이", clue: "어둠 속 두 눈", name: "호랑이 액막이부적", motif: "정면을 바라보는 민화풍 호랑이", wish: "걱정은 가벼워지고 하루를 씩씩하게 보내길 바라요." },
  { id: "wish", category: "소원 성취", clue: "달에게 건넨 말", name: "소원성취부적", motif: "초승달과 세 개의 별", wish: "오래 품은 소원에 오늘 한 발짝 가까워지길 바라요." }
];

const { randomIndex, wireToolbar, wireLever } = window.luckyDrawControls;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
const stage = $("charm-stage");
const machine = $("machine");
const lever = $("lever");
const draw = $("draw");
const drawLabel = draw.querySelector("span");
const status = $("play-status");
const result = $("charm-result");
const resultBack = $("result-back");
const resultArt = $("result-art");
const resultName = $("result-name");
const resultCategory = $("result-category");
const resultMessage = $("result-message");
const download = $("charm-download");
const catalogCards = new Map();
const revealedCharms = new Set();
const reelMarks = ["✧", "☾", "◇", "✦"];
const reelCells = Array.from(document.querySelectorAll(".charm-reel"), (cell) => ({
  back: cell.querySelector(".charm-back"),
  mark: cell.querySelector(".charm-back span"),
  image: cell.querySelector("img")
}));

let spin = null;
let lastDraw = null;
let drawCount = 0;
let pendingFrame = 0;

function asset(charm, extension = "webp") {
  return "assets/charm/" + charm.id + "." + extension;
}

function randomCharm() {
  return charms[randomIndex(charms.length)];
}

function renderCatalog() {
  $("catalog-count").textContent = "0 / " + charms.length + " 공개";
  const entries = charms.map((charm) => {
    const item = document.createElement("li");
    const back = document.createElement("div");
    back.className = "charm-back catalog-back";
    back.setAttribute("aria-hidden", "true");
    const seal = document.createElement("span");
    seal.textContent = "✧";
    back.append(seal);

    const label = document.createElement("span");
    label.className = "catalog-label";
    label.textContent = charm.clue;
    item.append(back, label);
    catalogCards.set(charm.id, { item, back, label });
    return item;
  });
  $("catalog-list").append(...entries);
}

function openSeal(charm) {
  if (revealedCharms.has(charm.id)) return;
  revealedCharms.add(charm.id);
  const { item, back, label } = catalogCards.get(charm.id);
  const image = new Image();
  image.alt = "";
  image.decoding = "async";
  image.src = asset(charm);
  back.replaceWith(image);
  label.textContent = charm.category;
  item.classList.add("is-discovered");
  $("catalog-count").textContent = revealedCharms.size + " / " + charms.length + " 공개";
}

function showOnReel(cell, charm) {
  cell.back.hidden = Boolean(charm);
  cell.image.hidden = !charm;
  if (charm) cell.image.src = asset(charm);
}

function completeSpin() {
  const charm = spin.charm;
  spin = null;
  cancelAnimationFrame(pendingFrame);
  pendingFrame = 0;
  lastDraw = charm;
  drawCount++;
  openSeal(charm);
  reelCells[0].mark.textContent = "✧";
  reelCells[2].mark.textContent = "✧";

  showOnReel(reelCells[0], null);
  showOnReel(reelCells[1], charm);
  showOnReel(reelCells[2], null);
  stage.classList.remove("is-spinning");
  stage.classList.add("is-revealed");
  result.classList.add("is-revealed");
  stage.setAttribute("aria-busy", "false");
  draw.disabled = false;
  lever.disabled = false;
  drawLabel.textContent = "다시 뽑기";
  status.textContent = charm.name + "이 나왔어요.";

  resultArt.alt = "노란 종이에 붉게 그린 " + charm.motif;
  resultArt.hidden = false;
  resultBack.hidden = true;
  resultCategory.textContent = charm.category;
  resultCategory.hidden = false;
  resultName.textContent = charm.name;
  resultMessage.textContent = charm.wish;
  download.href = asset(charm, "png");
  download.download = "행운뽑기-" + charm.name.replace(/ /g, "") + ".png";
  download.hidden = false;

  tone(329.63, 328, .65, .115);
  tone(493.88, 493, .58, .075, "sine", .085);
  tone(659.25, 655, .66, .075, "sine", .18);
  tone(987.77, 984, .38, .028, "triangle", .18);
}

function updateSpin(elapsed) {
  spin.elapsed += elapsed;
  if (spin.elapsed >= spin.duration) {
    completeSpin();
    return;
  }
  if (!motion.matches && spin.elapsed >= spin.nextTick) {
    const progress = spin.elapsed / spin.duration;
    reelCells.forEach((cell, index) => {
      cell.mark.textContent = reelMarks[(spin.tick + index) % reelMarks.length];
    });
    spin.tick++;
    tone(266 - 70 * progress, 125, .075, .045, "triangle");
    spin.nextTick = spin.elapsed + 88 + 159 * progress ** 2;
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
  if (spin) return;
  unlock();
  tone(196, 87, .20, .085, "triangle");
  const chosen = randomCharm();
  spin = { charm: chosen, elapsed: 0, tick: 0, duration: motion.matches ? 270 : 1450, nextTick: 0, lastFrame: performance.now() };

  stage.classList.remove("is-revealed");
  stage.classList.add("is-spinning");
  result.classList.remove("is-revealed");
  stage.setAttribute("aria-busy", "true");
  draw.disabled = true;
  lever.disabled = true;
  drawLabel.textContent = "뽑는 중…";
  status.textContent = "릴이 돌고 있어요…";
  resultArt.hidden = true;
  resultArt.src = asset(chosen);
  resultBack.hidden = false;
  resultCategory.hidden = true;
  resultName.textContent = "부적을 뽑고 있어요.";
  resultMessage.textContent = "";
  download.hidden = true;
  reelCells.forEach((cell) => showOnReel(cell, null));

  animatePull(pulled);
  pendingFrame = requestAnimationFrame(spinFrame);
}

const { unlock, tone } = wireToolbar({ soundButton: $("sound"), fullscreenButton: $("fullscreen"), onDraw: startDraw });
const animatePull = wireLever({
  machine,
  lever,
  onDraw: startDraw,
  onGrab() {
    unlock();
    tone(230, 139, .11, .05, "triangle");
  }
});

download.addEventListener("click", async (event) => {
  if (location.protocol === "file:" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();

  const file = document.createElement("a");
  file.href = download.href;
  file.download = download.download;
  try {
    const response = await fetch(file.href);
    if (!response.ok) throw new Error("Image download failed");
    // A blob URL lets the browser use the displayed name over the server's filename.
    const blobUrl = URL.createObjectURL(await response.blob());
    file.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  } catch {
    // Let the browser try a direct download if fetching the image fails.
  }
  file.click();
});

draw.addEventListener("click", () => startDraw());
renderCatalog();

window.render_game_to_text = () => JSON.stringify({
  mode: spin ? "spinning" : lastDraw ? "revealed" : "ready",
  charmCount: charms.length,
  unlocked: revealedCharms.size,
  draws: drawCount,
  id: lastDraw?.id ?? null,
  name: lastDraw?.name ?? null
});

window.advanceTime = (ms) => {
  if (spin && Number.isFinite(ms) && ms > 0) {
    spin.lastFrame = performance.now();
    updateSpin(ms);
  }
};
