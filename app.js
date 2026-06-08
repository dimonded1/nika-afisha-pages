const STORAGE_KEYS = {
  stats: "nika-afisha-tamagotchi-stats-v1",
  assignments: "nika-afisha-tamagotchi-assignments-v1",
  visitor: "nika-afisha-tamagotchi-visitor-v1",
  current: "nika-afisha-tamagotchi-current-v1",
};

const MAX_DAILY_COPIES = 3;
const RECENT_BLOCK = 4;
const REMOTE_TIMEOUT_MS = 5000;

const questions = [
  {
    id: "species",
    title: "Кто сегодня ближе?",
    choices: [
      { value: "any", label: "Удивите меня", hint: "Пусть совпадение будет честным сюрпризом" },
      { value: "dog", label: "Собака", hint: "Если сегодня хочется живого контакта" },
      { value: "cat", label: "Кошка", hint: "Если ближе тихая магия и свой ритм" },
    ],
  },
  {
    id: "rhythm",
    title: "Как ты возвращаешь себе силы?",
    choices: [
      { value: "quiet", label: "Тишина и плед", hint: "Лучше всего работает спокойный вечер" },
      { value: "motion", label: "Движение", hint: "Прогулка, дорога, смена картинки" },
      { value: "ritual", label: "Свой ритуал", hint: "Кофе, порядок, маленькие привычки" },
      { value: "people", label: "Свои люди", hint: "Разговор, объятие, быть рядом" },
    ],
  },
  {
    id: "unknownPlace",
    title: "В новом месте ты скорее...",
    choices: [
      { value: "observer", label: "Сначала смотрю", hint: "Понимаю атмосферу и только потом раскрываюсь" },
      { value: "initiator", label: "Завожу движ", hint: "Быстро нахожу, куда идти и что делать" },
      { value: "anchor", label: "Становлюсь опорой", hint: "Помогаю другим освоиться" },
      { value: "wanderer", label: "Иду наугад", hint: "Люблю, когда день может удивить" },
    ],
  },
  {
    id: "weekend",
    title: "Идеальные выходные звучат как...",
    choices: [
      { value: "picnic", label: "Пикник и смех", hint: "Люди, воздух, много маленьких событий" },
      { value: "slowHome", label: "Дом без спешки", hint: "Сериалы, еда, порядок, мягкий свет" },
      { value: "newSkill", label: "Научиться новому", hint: "Мастер-класс, книга, странный эксперимент" },
      { value: "helping", label: "Сделать добро", hint: "День становится лучше, если кому-то легче" },
    ],
  },
  {
    id: "dream",
    title: "Какая мечта сейчас ближе?",
    choices: [
      { value: "safeHome", label: "Свой безопасный дом", hint: "Место, где можно выдохнуть" },
      { value: "secondChance", label: "Второй шанс", hint: "Чтобы сложное прошлое не решало будущее" },
      { value: "bigRoad", label: "Большая дорога", hint: "Больше свободы, движения и смелости" },
      { value: "softOldAge", label: "Тихое счастье", hint: "Чтобы важное было не громким, а настоящим" },
    ],
  },
  {
    id: "superpower",
    title: "Какую суперсилу ты бы выбрал?",
    choices: [
      { value: "patience", label: "Терпение", hint: "Не торопить и дождаться доверия" },
      { value: "healing", label: "Лечить", hint: "Собирать по кусочкам тех, кому больно" },
      { value: "joy", label: "Зажигать", hint: "Включать игру даже в обычный день" },
      { value: "loyalty", label: "Быть рядом", hint: "Не исчезать, когда стало сложно" },
    ],
  },
  {
    id: "home",
    title: "Что для тебя делает дом домом?",
    choices: [
      { value: "warmth", label: "Тепло", hint: "Мягкость, забота, знакомые звуки" },
      { value: "freedom", label: "Свобода", hint: "Можно быть собой и не прятаться" },
      { value: "trust", label: "Доверие", hint: "Тебя понимают без лишних слов" },
      { value: "routine", label: "Стабильность", hint: "Каждый день есть на что опереться" },
    ],
  },
];

const state = {
  visitor: {},
  answers: {},
  questionIndex: 0,
  selected: null,
  completedStations: new Set(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cleanText(value, maxLength = 1000) {
  const text = String(value || "")
    .replace(/[—–]/g, "-")
    .replace(/⚙/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + ".";
}

function speciesLabel(species) {
  return species === "dog" ? "Собака" : "Кошка";
}

function tagLabel(tag) {
  const labels = {
    dog: "собака",
    cat: "кошка",
    health: "реабилитация",
    trust: "доверие",
    senior: "возрастной",
    active: "активный",
    rescue: "после улицы",
    care: "нужна забота",
    "мальчик": "мальчик",
    "девочка": "девочка",
  };
  return labels[tag] || tag;
}

function getStats() {
  const stats = readJson(STORAGE_KEYS.stats, null);
  if (!stats || stats.date !== todayKey()) {
    return { date: todayKey(), counts: {}, recent: [] };
  }
  return stats;
}

function saveStats(stats) {
  writeJson(STORAGE_KEYS.stats, stats);
}

function getAssignments() {
  return readJson(STORAGE_KEYS.assignments, []);
}

function saveAssignment(record) {
  const assignments = getAssignments();
  assignments.push(record);
  writeJson(STORAGE_KEYS.assignments, assignments);
}

function getRemoteConfig() {
  const config = window.NIKA_CONFIG || {};
  const endpoint = String(config.submissionsEndpoint || "").replace(/\/+$/, "");
  return {
    endpoint,
    writeKey: String(config.writeKey || ""),
  };
}

function hasRemoteStorage() {
  return Boolean(getRemoteConfig().endpoint);
}

function withTimeout(promise, timeout = REMOTE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    run: promise(controller.signal).finally(() => window.clearTimeout(timer)),
  };
}

async function remoteFetch(path, options = {}) {
  const config = getRemoteConfig();
  if (!config.endpoint) throw new Error("Remote storage is not configured.");

  const headers = new Headers(options.headers || {});
  if (config.writeKey) headers.set("x-write-key", config.writeKey);

  const request = (signal) => fetch(`${config.endpoint}${path}`, {
    ...options,
    headers,
    signal,
  });
  const { run } = withTimeout(request);
  const response = await run;
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Remote request failed: ${response.status}`);
  }
  return response;
}

async function loadRemoteStats() {
  if (!hasRemoteStorage()) return null;
  try {
    const response = await remoteFetch("/stats");
    const stats = await response.json();
    if (!stats || stats.date !== todayKey()) return null;
    return {
      date: stats.date,
      counts: stats.counts || {},
      recent: Array.isArray(stats.recent) ? stats.recent.slice(0, RECENT_BLOCK) : [],
    };
  } catch (error) {
    console.warn("Не удалось получить статистику из GitHub-базы, используем локальную.", error);
    return null;
  }
}

async function syncAssignment(record) {
  if (!hasRemoteStorage()) return false;
  try {
    await remoteFetch("/submission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    });
    return true;
  } catch (error) {
    console.warn("Не удалось отправить выдачу в GitHub-базу, запись сохранена локально.", error);
    return false;
  }
}

function showScreen(name) {
  $$(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === name);
  });
}

function startQuiz() {
  state.questionIndex = 0;
  state.answers = {};
  renderQuestion();
  showScreen("quiz");
}

function renderQuestion() {
  const question = questions[state.questionIndex];
  $("#quiz-title").textContent = question.title;

  const backButton = $("[data-action='prev-question']");
  if (backButton) {
    backButton.disabled = state.questionIndex === 0;
  }

  const dots = $(".progress-dots");
  dots.innerHTML = "";
  questions.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = index === state.questionIndex ? "is-active" : index < state.questionIndex ? "is-done" : "";
    dots.appendChild(dot);
  });

  const grid = $("#choice-grid");
  grid.innerHTML = "";
  question.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.innerHTML = `<strong>${choice.label}</strong><span>${choice.hint}</span>`;
    button.addEventListener("click", () => {
      state.answers[question.id] = choice.value;
      if (state.questionIndex < questions.length - 1) {
        state.questionIndex += 1;
        renderQuestion();
      } else {
        runMatching();
      }
    });
    grid.appendChild(button);
  });
}

function goToPreviousQuestion() {
  if (state.questionIndex === 0) return;
  const currentQuestion = questions[state.questionIndex];
  state.questionIndex -= 1;
  const previousQuestion = questions[state.questionIndex];
  delete state.answers[currentQuestion.id];
  delete state.answers[previousQuestion.id];
  renderQuestion();
}

function animalScore(animal, stats) {
  const answers = state.answers;
  let score = 20 + Math.random() * 8;
  const storyTypes = animal.storyTypes || [];
  const tags = animal.tags || [];
  const count = stats.counts[animal.id] || 0;
  const recentIndex = stats.recent.indexOf(animal.id);

  if (answers.species !== "any" && animal.species === answers.species) score += 28;
  if (answers.species !== "any" && animal.species !== answers.species) score -= 120;

  const has = (type) => storyTypes.includes(type) || tags.includes(type);
  const hasAny = (types) => types.some((type) => has(type));

  if (answers.rhythm === "quiet") score += hasAny(["trust", "senior"]) ? 20 : 4;
  if (answers.rhythm === "motion") score += has("active") ? 24 : animal.species === "dog" ? 10 : 2;
  if (answers.rhythm === "ritual") score += hasAny(["health", "senior", "trust"]) ? 18 : 6;
  if (answers.rhythm === "people") score += hasAny(["rescue", "trust"]) ? 18 : 8;

  if (answers.unknownPlace === "observer") score += has("trust") ? 24 : 5;
  if (answers.unknownPlace === "initiator") score += has("active") ? 24 : 6;
  if (answers.unknownPlace === "anchor") score += hasAny(["health", "senior", "trust"]) ? 24 : 6;
  if (answers.unknownPlace === "wanderer") score += hasAny(["rescue", "active"]) ? 18 : 8;

  if (answers.weekend === "picnic") score += has("active") || animal.species === "dog" ? 20 : 4;
  if (answers.weekend === "slowHome") score += hasAny(["senior", "trust"]) || animal.species === "cat" ? 18 : 4;
  if (answers.weekend === "newSkill") score += hasAny(["trust", "active"]) ? 20 : 6;
  if (answers.weekend === "helping") score += hasAny(["health", "rescue", "senior"]) ? 22 : 8;

  if (answers.dream === "safeHome") score += hasAny(["trust", "rescue"]) ? 22 : 8;
  if (answers.dream === "secondChance") score += hasAny(["rescue", "health"]) ? 24 : 6;
  if (answers.dream === "bigRoad") score += has("active") ? 22 : 5;
  if (answers.dream === "softOldAge") score += has("senior") ? 28 : has("trust") ? 12 : 2;

  if (answers.superpower === "patience") score += has("trust") ? 28 : 6;
  if (answers.superpower === "healing") score += has("health") ? 30 : 5;
  if (answers.superpower === "joy") score += has("active") ? 24 : 8;
  if (answers.superpower === "loyalty") score += hasAny(["senior", "rescue", "trust"]) ? 22 : 8;

  if (answers.home === "warmth") score += hasAny(["senior", "rescue"]) ? 18 : 8;
  if (answers.home === "freedom") score += hasAny(["active", "rescue"]) ? 18 : 7;
  if (answers.home === "trust") score += has("trust") ? 26 : 6;
  if (answers.home === "routine") score += hasAny(["health", "senior"]) ? 24 : 6;

  score -= count * 26;
  if (recentIndex >= 0) score -= (RECENT_BLOCK - recentIndex) * 45;
  if (count >= MAX_DAILY_COPIES) score -= 160;

  return score;
}

function selectAnimal(stats = getStats()) {
  const animals = Array.isArray(window.NIKA_ANIMALS) ? window.NIKA_ANIMALS : [];
  const speciesFiltered = state.answers.species === "any"
    ? animals
    : animals.filter((animal) => animal.species === state.answers.species);
  const basePool = speciesFiltered.length ? speciesFiltered : animals;
  const underLimit = basePool.filter((animal) => (stats.counts[animal.id] || 0) < MAX_DAILY_COPIES);
  const pool = underLimit.length >= 3 ? underLimit : basePool;

  const ranked = pool
    .map((animal) => ({ animal, score: animalScore(animal, stats) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, Math.min(7, ranked.length));
  return top[Math.floor(Math.random() * top.length)]?.animal || animals[0];
}

function updateIssueStats(stats, animalId) {
  const nextStats = {
    date: todayKey(),
    counts: { ...(stats?.counts || {}) },
    recent: Array.isArray(stats?.recent) ? [...stats.recent] : [],
  };
  nextStats.counts[animalId] = (nextStats.counts[animalId] || 0) + 1;
  nextStats.recent = [animalId, ...nextStats.recent.filter((id) => id !== animalId)].slice(0, RECENT_BLOCK);
  return nextStats;
}

function runMatching() {
  showScreen("matching");
  window.setTimeout(async () => {
    const baseStats = await loadRemoteStats() || getStats();
    const selected = selectAnimal(baseStats);
    state.selected = selected;
    state.completedStations = new Set();

    const stats = updateIssueStats(baseStats, selected.id);
    saveStats(stats);

    const assignment = {
      time: new Date().toISOString(),
      visitorName: state.visitor.name || "",
      contact: state.visitor.contact || "",
      email: state.visitor.email || "",
      consent: "yes",
      animalId: selected.id,
      animalName: selected.name,
      cardId: selected.cardId,
      species: selected.species,
      sourceUrl: selected.sourceUrl || "",
      answers: { ...state.answers },
      dailyCountAfterIssue: stats.counts[selected.id],
      storageMode: hasRemoteStorage() ? "remote" : "local",
    };
    saveAssignment(assignment);
    syncAssignment(assignment);
    writeJson(STORAGE_KEYS.current, assignment);

    renderPetCard(selected);
    showScreen("result");
  }, 1250);
}

function renderPetCard(animal) {
  const template = $("#pet-card-template").content.cloneNode(true);
  const card = $("#pet-card");
  card.innerHTML = "";

  const img = $(".pet-photo", template);
  img.src = animal.photo || "./assets/reference-card.png";
  img.alt = cleanText(`Фото: ${animal.name}`);

  const petName = $(".pet-name", template);
  petName.textContent = cleanText(animal.name, 64);
  petName.classList.toggle("is-long", animal.name.length > 11 || animal.name.includes(" "));
  $(".card-code", template).textContent = animal.cardId;

  const meta = [speciesLabel(animal.species), animal.gender, animal.age].filter(Boolean).join(" • ");
  $(".pet-meta", template).textContent = cleanText(meta);

  const tagRow = $(".tag-row", template);
  const visibleTags = (animal.tags || []).slice(0, 4);
  visibleTags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tagLabel(tag);
    tagRow.appendChild(span);
  });

  $(".pet-story", template).textContent = cleanText(animal.story, 680);
  $(".care-callout", template).textContent = cleanText(animal.guardianPhrase || animal.careNeed, 260);

  const source = $(".source-link", template);
  if (animal.sourceUrl) {
    source.href = animal.sourceUrl;
  } else {
    source.hidden = true;
  }

  card.appendChild(template);
}

function toCsvValue(value) {
  const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportRemoteCsv() {
  const adminKey = window.prompt("Код выгрузки CSV");
  if (!adminKey) return false;

  const response = await remoteFetch(`/export?key=${encodeURIComponent(adminKey)}`);
  const blob = await response.blob();
  downloadBlob(blob, `nika-afisha-assignments-all-${todayKey()}.csv`);
  return true;
}

function exportLocalCsv() {
  const rows = getAssignments();
  if (!rows.length) {
    alert("Пока нет выдач для экспорта.");
    return false;
  }
  const columns = [
    "time",
    "visitorName",
    "contact",
    "email",
    "consent",
    "animalId",
    "animalName",
    "cardId",
    "species",
    "sourceUrl",
    "answers",
    "dailyCountAfterIssue",
    "storageMode",
  ];
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => toCsvValue(row[column])).join(",")),
  ].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `nika-afisha-assignments-local-${todayKey()}.csv`);
  return true;
}

async function exportCsv() {
  if (hasRemoteStorage()) {
    try {
      await exportRemoteCsv();
      return;
    } catch (error) {
      console.warn("Не удалось скачать CSV из GitHub-базы.", error);
      alert("Не удалось скачать общий CSV. Скачаю локальную резервную выгрузку с этого устройства.");
    }
  }

  exportLocalCsv();
}

function resetDemo() {
  if (!confirm("Сбросить локальные выдачи и счётчики на этом устройстве?")) return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  state.visitor = {};
  state.answers = {};
  state.selected = null;
  state.completedStations = new Set();
  showScreen("intro");
}

function restartFlow() {
  state.visitor = {};
  state.answers = {};
  state.questionIndex = 0;
  state.selected = null;
  state.completedStations = new Set();
  localStorage.removeItem(STORAGE_KEYS.visitor);
  localStorage.removeItem(STORAGE_KEYS.current);
  showScreen("intro");
}

function init() {
  $("[data-action='start']").addEventListener("click", () => showScreen("form"));
  $("[data-action='export-csv']").addEventListener("click", exportCsv);
  $("[data-action='reset-demo']").addEventListener("click", resetDemo);

  $("#visitor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const error = $(".form-error", form);
    error.textContent = "";

    if (!data.name || cleanText(data.name).length < 2) {
      error.textContent = "Нужно имя, хотя бы 2 символа.";
      return;
    }
    if (!data.consent) {
      error.textContent = "Для участия нужно согласие.";
      return;
    }

    state.visitor = {
      name: cleanText(data.name, 80),
      contact: cleanText(data.contact, 120),
      email: cleanText(data.email, 120),
    };
    writeJson(STORAGE_KEYS.visitor, state.visitor);
    startQuiz();
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "prev-question") {
      goToPreviousQuestion();
    }
    if (action === "go-pickup") {
      showScreen("volunteer");
    }
    if (action === "restart-flow") {
      restartFlow();
    }
  });

  if (!Array.isArray(window.NIKA_ANIMALS) || !window.NIKA_ANIMALS.length) {
    $(".hero__text").textContent = "База животных не загрузилась. Проверь файл data/animals.js.";
  }
}

init();
