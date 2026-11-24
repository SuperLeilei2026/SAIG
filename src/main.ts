import "./style.css";
import knowledge from "./data/knowledge.json";
import type { Knowledge, Outfit, Reply, Section } from "./types";
import { answer, replyPlainText } from "./engine";
import { clearLlmConfig, llmConfigured, readLlmConfig, tryRephrase, writeLlmConfig } from "./llm";

const kb = knowledge as Knowledge;
const base = import.meta.env.BASE_URL;
const OUTFITS: Record<Outfit, { src: string; label: string }> = {
  default: { src: `${base}avatar-front.png`, label: "离线知识库" },
  wuhan: { src: `${base}outfit-wuhan.jpg`, label: "正在介绍武汉" },
  community: { src: `${base}outfit-community.jpg`, label: "正在介绍社区" },
  travel: { src: `${base}outfit-travel.jpg`, label: "正在排行程" },
  saig: { src: `${base}outfit-saig.jpg`, label: "正在介绍 SPU 与比赛" }
};

const log = document.querySelector<HTMLElement>("#log")!;
const form = document.querySelector<HTMLFormElement>("#composer")!;
const input = document.querySelector<HTMLTextAreaElement>("#question")!;
const travelDialog = document.querySelector<HTMLDialogElement>("#travel-dialog")!;
const sourcesDialog = document.querySelector<HTMLDialogElement>("#sources-dialog")!;
const travelForm = document.querySelector<HTMLFormElement>("#travel-form")!;
const sourceList = document.querySelector<HTMLElement>("#source-list")!;
const heroFace = document.querySelector<HTMLImageElement>("#hero-face")!;
const deskFace = document.querySelector<HTMLImageElement>("#desk-face")!;
const deskRole = document.querySelector<HTMLElement>("#desk-role")!;
const llmPanel = document.querySelector<HTMLElement>("#llm-panel");

let busy = false;
let currentOutfit: Outfit = "default";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setOutfit(role: Outfit | undefined) {
  if (!role || role === currentOutfit) {
    if (role) paintOutfit();
    return;
  }
  currentOutfit = role;
  paintOutfit();
}

function paintOutfit() {
  const item = OUTFITS[currentOutfit];
  heroFace.src = item.src;
  deskFace.src = item.src;
  deskRole.textContent = item.label;
  document.querySelectorAll<HTMLButtonElement>("[data-outfit]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.outfit === currentOutfit);
  });
}

function renderSection(section: Section, host: HTMLElement) {
  if (section.heading) host.append(el("h3", undefined, section.heading));
  for (const paragraph of section.paragraphs ?? []) host.append(el("p", undefined, paragraph));
  if (section.bullets?.length) {
    const list = el("ul");
    for (const item of section.bullets) list.append(el("li", undefined, item));
    host.append(list);
  }
  if (section.stops?.length) host.append(renderStops(section.stops));
  for (const day of section.days ?? []) {
    const block = el("div", "day");
    block.append(el("h4", undefined, day.label));
    block.append(renderStops(day.stops));
    host.append(block);
  }
}

function renderStops(stops: { when: string; place: string; text: string }[]) {
  const list = el("ol", "stops");
  for (const stop of stops) {
    const item = el("li", "stop");
    item.append(el("span", "when", stop.when));
    const body = el("div");
    body.append(el("strong", "place", stop.place));
    body.append(el("p", undefined, stop.text));
    item.append(body);
    list.append(item);
  }
  return list;
}

function isPlan(section: Section) {
  return Boolean(section.days?.length || section.stops?.length);
}

function renderReply(reply: Reply, note?: string) {
  const outfit = OUTFITS[reply.role ?? currentOutfit];
  const article = el("article", "msg msg-bot");
  const avatar = document.createElement("img");
  avatar.className = "msg-avatar";
  avatar.src = outfit.src;
  avatar.alt = "";
  const bubble = el("div", "bubble");
  bubble.append(el("p", "lead", reply.lead));

  const extra = el("div", "extra");
  let hasExtra = false;
  if (reply.brief) {
    if (reply.brief.paragraphs?.length) {
      for (const paragraph of reply.brief.paragraphs) bubble.append(el("p", undefined, paragraph));
    }
    if (reply.brief.bullets?.length) {
      const list = el("ul", "brief");
      for (const item of reply.brief.bullets) list.append(el("li", undefined, item));
      bubble.append(list);
    }
    for (const section of reply.sections) {
      renderSection(section, extra);
      hasExtra = true;
    }
  } else {
    const planSections = reply.sections.filter(isPlan);
    const otherSections = reply.sections.filter((section) => !isPlan(section));
    if (planSections.length) {
      for (const section of planSections) renderSection(section, bubble);
      for (const section of otherSections) {
        renderSection(section, extra);
        hasExtra = true;
      }
    } else {
      const length = otherSections.reduce((sum, section) => {
        const parts = [...(section.paragraphs ?? []), ...(section.bullets ?? [])];
        return sum + parts.join("").length;
      }, 0);
      const long = otherSections.length > 1 || length > 320;
      if (!long) {
        for (const section of otherSections) renderSection(section, bubble);
      } else {
        const [first, ...rest] = otherSections;
        if (first) renderSection(first, bubble);
        for (const section of rest) {
          renderSection(section, extra);
          hasExtra = true;
        }
      }
    }
  }
  if (hasExtra && extra.childNodes.length) {
    extra.hidden = true;
    const more = el("button", "more-btn", "展开全部") as HTMLButtonElement;
    more.type = "button";
    more.addEventListener("click", () => {
      const open = extra.hidden;
      extra.hidden = !open;
      more.textContent = open ? "收起详情" : "展开全部";
    });
    bubble.append(more, extra);
  }

  if (reply.caveat) bubble.append(el("p", "caveat", reply.caveat));
  if (note) bubble.append(el("p", "caveat", note));
  if (reply.sources.length) {
    const sources = el("ul", "sources");
    for (const source of reply.sources) sources.append(el("li", undefined, source));
    bubble.append(sources);
  }
  if (reply.followups.length) {
    const row = el("div", "followups");
    for (const follow of reply.followups) {
      const button = el("button", undefined, follow.label) as HTMLButtonElement;
      button.type = "button";
      button.addEventListener("click", () => ask(follow.query));
      row.append(button);
    }
    bubble.append(row);
  }
  article.append(avatar, bubble);
  log.append(article);
  article.scrollIntoView({ block: "end" });
}

function renderUser(text: string) {
  const article = el("article", "msg msg-user");
  const bubble = el("div", "bubble");
  bubble.append(el("p", undefined, text));
  article.append(bubble);
  log.append(article);
}

function renderPending() {
  const node = el("div", "pending", "在翻材料…");
  node.id = "pending";
  log.append(node);
  return node;
}

async function ask(text: string) {
  const question = text.trim();
  if (!question || busy) return;
  busy = true;
  renderUser(question);
  input.value = "";
  resizeInput();
  const pending = renderPending();
  const reply = answer(kb, question);
  if (reply.role) setOutfit(reply.role);
  const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
  await new Promise((resolve) => setTimeout(resolve, wait));
  let note = "";
  if (llmConfigured()) {
    const polished = await tryRephrase(question, reply, replyPlainText(reply));
    note = polished
      ? "本机接口返回了一段润色。评分仍以上面这份材料原文为准，润色不另增事实。"
      : "模型接口没有连上。上面仍是本地材料的回答。";
    if (polished) {
      reply.sections = [...reply.sections, { heading: "语气参考，不作为事实补充", paragraphs: [polished] }];
    }
  }
  pending.remove();
  renderReply(reply, note || undefined);
  busy = false;
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function openTravel() {
  setOutfit("travel");
  if (typeof travelDialog.showModal === "function") travelDialog.showModal();
  else travelDialog.setAttribute("open", "");
}

function openSources() {
  if (typeof sourcesDialog.showModal === "function") sourcesDialog.showModal();
  else sourcesDialog.setAttribute("open", "");
}

for (const source of kb.meta.sources) {
  const item = el("li");
  item.append(el("strong", undefined, source.label));
  item.append(document.createTextNode(source.note));
  sourceList.append(item);
}

document.querySelectorAll<HTMLButtonElement>("[data-query]").forEach((button) => {
  button.addEventListener("click", () => ask(button.dataset.query || ""));
});
document.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.open === "travel") openTravel();
    if (button.dataset.open === "sources") openSources();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

travelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(travelForm);
  const days = String(data.get("days") || "1");
  const pref = String(data.get("pref") || "综合");
  travelDialog.close();
  ask(`请按${days}天、偏好${pref}规划武汉行程`);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(input.value);
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

if (llmPanel && /(?:\\?|&)llm=1(?:&|$)/.test(location.search)) {
  llmPanel.hidden = false;
}

const llmUrl = document.querySelector<HTMLInputElement>("#llm-url")!;
const llmModel = document.querySelector<HTMLInputElement>("#llm-model")!;
const llmKey = document.querySelector<HTMLInputElement>("#llm-key")!;
const llmState = document.querySelector<HTMLElement>("#llm-state")!;

function paintLlm() {
  const config = readLlmConfig();
  llmUrl.value = config.url;
  llmModel.value = config.model;
  llmKey.value = config.key;
  llmState.textContent = config.url && config.key ? "本机已保存密钥" : "未配置，完全离线";
}
document.querySelector("#llm-save")?.addEventListener("click", () => {
  writeLlmConfig({ url: llmUrl.value, key: llmKey.value, model: llmModel.value });
  paintLlm();
});
document.querySelector("#llm-clear")?.addEventListener("click", () => {
  clearLlmConfig();
  paintLlm();
});
paintLlm();
paintOutfit();
renderReply(kb.replies.greeting);
