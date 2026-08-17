"use strict";

/*
  FX — Seu dinheiro. Suas regras.
  Versão inicial reconstruída do zero.

  Princípios:
  - dinheiro internamente em centavos;
  - dados locais;
  - sem servidor;
  - sem login online;
  - sem saldo negativo;
  - cada gasto possui uma origem;
  - reserva separada;
  - ciclos independentes;
*/

const FX_KEY = "fx_state_v1";
const MASTER_KEY = "Fx020919";
const SCHEMA_VERSION = 1;

const DEFAULT_CATEGORIES = [
  {
    id: "cat-fixed",
    name: "Gasto Fixo",
    icon: "🏠",
    limitEnabled: true,
    limitCents: 60000,
    protected: true,
    reserve: false
  },
  {
    id: "cat-reserve",
    name: "Reserva",
    icon: "🏦",
    limitEnabled: false,
    limitCents: 0,
    protected: true,
    reserve: true
  },
  {
    id: "cat-medicines",
    name: "Medicamentos",
    icon: "💊",
    limitEnabled: true,
    limitCents: 20000,
    protected: true,
    reserve: false
  },
  {
    id: "cat-leisure",
    name: "Lazer",
    icon: "🎮",
    limitEnabled: true,
    limitCents: 20000,
    protected: true,
    reserve: false
  },
  {
    id: "cat-phone",
    name: "Celular",
    icon: "📱",
    limitEnabled: true,
    limitCents: 3500,
    protected: true,
    reserve: false
  },
  {
    id: "cat-other",
    name: "Outros",
    icon: "📦",
    limitEnabled: false,
    limitCents: 0,
    protected: true,
    reserve: false
  }
];

let state = loadState();
let currentView = "main";
let openedSettings = null;

/* =========================================================
   UTILIDADES
========================================================= */

function createId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function centsToMoney(cents) {
  const value = Number.isFinite(Number(cents)) ? Math.round(Number(cents)) : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function parseMoney(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }

  let text = String(value ?? "").trim();

  if (!text) return 0;

  text = text
    .replaceAll("R$", "")
    .replace(/\s/g, "");

  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (text.match(/\./g) || []).length;

    if (dotCount > 1) {
      text = text.replace(/\./g, "");
    } else if (dotCount === 1) {
      const decimals = text.split(".")[1];

      if (decimals && decimals.length === 3) {
        text = text.replace(".", "");
      }
    }
  }

  const number = Number(text);

  if (!Number.isFinite(number)) return 0;

  return Math.round(number * 100);
}

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "--/--/----";

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "--/--";

  return (
    date.toLocaleDateString("pt-BR") +
    " " +
    date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(dateString) {
  const date = new Date(dateString + "T12:00:00");

  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function clampPercent(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  return Math.max(0, Math.min(100, Math.round(n)));
}

/* =========================================================
   CRIPTOGRAFIA LOCAL DA SENHA
========================================================= */

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function saveState() {
  localStorage.setItem(FX_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(FX_KEY);

    if (!raw) return null;

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("Erro ao carregar FX:", error);
    return null;
  }
}

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizeState(data) {
  if (!data || typeof data !== "object") return null;

  const normalized = {
    schemaVersion: SCHEMA_VERSION,

    account: {
      username: normalizeText(data.account?.username),
      passwordHash: normalizeText(data.account?.passwordHash)
    },

    locked: Boolean(data.locked),

    settings: {
      salaryReferenceCents: Math.max(
        0,
        Math.round(Number(data.settings?.salaryReferenceCents) || 0)
      ),

      splitSalary: Boolean(data.settings?.splitSalary),

      cycleStartDay: Math.max(
        1,
        Math.min(
          31,
          Math.round(Number(data.settings?.cycleStartDay) || 5)
        )
      )
    },

    categories: Array.isArray(data.categories)
      ? data.categories.map(normalizeCategory)
      : structuredClone(DEFAULT_CATEGORIES),

    cycles: {},

    reserveBalanceCents: Math.max(
      0,
      Math.round(Number(data.reserveBalanceCents) || 0)
    ),

    currentCycleKey: normalizeText(data.currentCycleKey),

    createdAt: data.createdAt || new Date().toISOString()
  };

  if (!normalized.categories.length) {
    normalized.categories = structuredClone(DEFAULT_CATEGORIES);
  }

  if (data.cycles && typeof data.cycles === "object") {
    for (const [key, cycle] of Object.entries(data.cycles)) {
      normalized.cycles[key] = normalizeCycle(cycle);
    }
  }

  return normalized;
}

function normalizeCategory(category) {
  return {
    id: normalizeText(category?.id) || createId("cat"),
    name: normalizeText(category?.name) || "Categoria",
    icon: normalizeText(category?.icon) || "📁",
    limitEnabled: Boolean(category?.limitEnabled),
    limitCents: Math.max(
      0,
      Math.round(Number(category?.limitCents) || 0)
    ),
    protected: Boolean(category?.protected),
    reserve: Boolean(category?.reserve)
  };
}

function normalizeCycle(cycle) {
  return {
    key: normalizeText(cycle?.key),

    startDate: normalizeText(cycle?.startDate),
    endDate: normalizeText(cycle?.endDate),

    salaryReferenceCents: Math.max(
      0,
      Math.round(Number(cycle?.salaryReferenceCents) || 0)
    ),

    salaryBalanceCents: Math.max(
      0,
      Math.round(Number(cycle?.salaryBalanceCents) || 0)
    ),

    extraBalanceCents: Math.max(
      0,
      Math.round(Number(cycle?.extraBalanceCents) || 0)
    ),

    salaryAppliedParts: {
      first: Boolean(cycle?.salaryAppliedParts?.first),
      second: Boolean(cycle?.salaryAppliedParts?.second)
    },

    salaryAdjusted: Boolean(cycle?.salaryAdjusted),

    expenses: Array.isArray(cycle?.expenses)
      ? cycle.expenses.map(normalizeExpense)
      : [],

    reserveOperations: Array.isArray(cycle?.reserveOperations)
      ? cycle.reserveOperations.map(normalizeReserveOperation)
      : [],

    createdAt: cycle?.createdAt || new Date().toISOString()
  };
}

function normalizeExpense(expense) {
  return {
    id: normalizeText(expense?.id) || createId("expense"),
    categoryId: normalizeText(expense?.categoryId),
    source: ["salary", "extra", "reserve"].includes(expense?.source)
      ? expense.source
      : "salary",
    amountCents: Math.max(
      0,
      Math.round(Number(expense?.amountCents) || 0)
    ),
    description: normalizeText(expense?.description),
    createdAt: expense?.createdAt || new Date().toISOString()
  };
}

function normalizeReserveOperation(operation) {
  return {
    id: normalizeText(operation?.id) || createId("reserve"),
    type: operation?.type === "withdraw" ? "withdraw" : "deposit",
    source: operation?.source === "extra" ? "extra" : "salary",
    amountCents: Math.max(
      0,
      Math.round(Number(operation?.amountCents) || 0)
    ),
    createdAt: operation?.createdAt || new Date().toISOString()
  };
}

/* =========================================================
   CICLOS
========================================================= */

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function createCycleDate(year, monthIndex, day) {
  const finalDay = Math.min(
    Math.max(1, day),
    daysInMonth(year, monthIndex)
  );

  return new Date(year, monthIndex, finalDay, 0, 0, 0, 0);
}

function getCycleStartForDate(date = new Date()) {
  const configuredDay = state.settings.cycleStartDay;

  let start = createCycleDate(
    date.getFullYear(),
    date.getMonth(),
    configuredDay
  );

  if (date < start) {
    start = createCycleDate(
      date.getFullYear(),
      date.getMonth() - 1,
      configuredDay
    );
  }

  return start;
}

function dateToCycleKey(date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date, amount) {
  return createCycleDate(
    date.getFullYear(),
    date.getMonth() + amount,
    state.settings.cycleStartDay
  );
}

function getCurrentCycleKey() {
  return dateToCycleKey(getCycleStartForDate());
}

function getCycleEnd(startDate) {
  const next = addMonths(startDate, 1);
  next.setMilliseconds(-1);
  return next;
}

function getPreviousCycleKey() {
  const currentStart = getCycleStartForDate();
  return dateToCycleKey(addMonths(currentStart, -1));
}

function createEmptyCycle(key, carrySalary, carryExtra) {
  const startDate = new Date(key + "T00:00:00");
  const endDate = getCycleEnd(startDate);

  return {
    key,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),

    salaryReferenceCents: state.settings.salaryReferenceCents,

    salaryBalanceCents: Math.max(0, carrySalary),
    extraBalanceCents: Math.max(0, carryExtra),

    salaryAppliedParts: {
      first: false,
      second: false
    },

    salaryAdjusted: false,

    expenses: [],

    reserveOperations: [],

    createdAt: new Date().toISOString()
  };
}

function ensureCurrentCycle() {
  if (!state) return;

  const currentKey = getCurrentCycleKey();

  if (!state.cycles[currentKey]) {
    const previousKey = getPreviousCycleKey();
    const previous = state.cycles[previousKey];

    const carrySalary = previous
      ? previous.salaryBalanceCents
      : 0;

    const carryExtra = previous
      ? previous.extraBalanceCents
      : 0;

    state.cycles[currentKey] = createEmptyCycle(
      currentKey,
      carrySalary,
      carryExtra
    );

    state.currentCycleKey = currentKey;
    saveState();
  } else {
    state.currentCycleKey = currentKey;
  }

  applyDueSalaryParts(state.cycles[currentKey]);
  saveState();
}

function getCurrentCycle() {
  ensureCurrentCycle();

  return state.cycles[state.currentCycleKey];
}

/* =========================================================
   SALÁRIO DIVIDIDO
========================================================= */

function getFifthBusinessDay(year, monthIndex) {
  let count = 0;

  for (
    let day = 1;
    day <= daysInMonth(year, monthIndex);
    day++
  ) {
    const date = new Date(year, monthIndex, day);

    const weekday = date.getDay();

    if (weekday !== 0 && weekday !== 6) {
      count++;

      if (count === 5) {
        return date.getDate();
      }
    }
  }

  return 5;
}

function applyDueSalaryParts(cycle) {
  if (!cycle) return;

  const now = new Date();
  const cycleStart = new Date(cycle.startDate);

  const year = cycleStart.getFullYear();
  const month = cycleStart.getMonth();

  const fifthBusinessDay = getFifthBusinessDay(year, month);

  const firstSalaryDate = new Date(
    year,
    month,
    fifthBusinessDay,
    0,
    0,
    0
  );

  const secondSalaryDate = new Date(
    year,
    month,
    20,
    0,
    0,
    0
  );

  const reference = cycle.salaryReferenceCents;

  if (!state.settings.splitSalary) {
    if (!cycle.salaryAppliedParts.first) {
      cycle.salaryBalanceCents += reference;
      cycle.salaryAppliedParts.first = true;
      cycle.salaryAppliedParts.second = true;
    }

    return;
  }

  if (
    now >= firstSalaryDate &&
    !cycle.salaryAppliedParts.first
  ) {
    const amount = Math.round(reference * 0.60);

    cycle.salaryBalanceCents += amount;
    cycle.salaryAppliedParts.first = true;
  }

  if (
    now >= secondSalaryDate &&
    !cycle.salaryAppliedParts.second
  ) {
    const amount = reference - Math.round(reference * 0.60);

    cycle.salaryBalanceCents += amount;
    cycle.salaryAppliedParts.second = true;
  }
}

/* =========================================================
   SALDOS
========================================================= */

function getCategorySpent(cycle, categoryId) {
  return cycle.expenses
    .filter(expense => expense.categoryId === categoryId)
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

function getCategoryAvailable(cycle, category) {
  if (!category.limitEnabled) {
    return null;
  }

  const spent = getCategorySpent(cycle, category.id);

  return Math.max(0, category.limitCents - spent);
}

function getAvailableTotal(cycle) {
  const expenses = cycle.expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0
  );

  return Math.max(
    0,
    cycle.salaryBalanceCents +
      cycle.extraBalanceCents -
      expenses
  );
}

function getAvailableBySource(cycle, source) {
  if (source === "salary") {
    return cycle.salaryBalanceCents;
  }

  if (source === "extra") {
    return cycle.extraBalanceCents;
  }

  if (source === "reserve") {
    return state.reserveBalanceCents;
  }

  return 0;
}

function getCategoryById(categoryId) {
  return state.categories.find(
    category => category.id === categoryId
  );
}

/* =========================================================
   RESERVA
========================================================= */

function depositReserve(cycle, source, amountCents) {
  if (amountCents <= 0) {
    throw new Error("O valor precisa ser maior que zero.");
  }

  const available = getAvailableBySource(cycle, source);

  if (amountCents > available) {
    throw new Error(
      "Não existe dinheiro suficiente na origem escolhida."
    );
  }

  if (source === "salary") {
    cycle.salaryBalanceCents -= amountCents;
  } else {
    cycle.extraBalanceCents -= amountCents;
  }

  state.reserveBalanceCents += amountCents;

  cycle.reserveOperations.push({
    id: createId("reserve"),
    type: "deposit",
    source,
    amountCents,
    createdAt: new Date().toISOString()
  });

  saveState();
}

function withdrawReserve(cycle, amountCents) {
  if (amountCents <= 0) {
    throw new Error("O valor precisa ser maior que zero.");
  }

  if (amountCents > state.reserveBalanceCents) {
    throw new Error(
      "Não existe dinheiro suficiente na Reserva."
    );
  }

  state.reserveBalanceCents -= amountCents;

  cycle.reserveOperations.push({
    id: createId("reserve"),
    type: "withdraw",
    source: "reserve",
    amountCents,
    createdAt: new Date().toISOString()
  });

  const other = state.categories.find(
    category => category.name === "Outros"
  );

  cycle.expenses.push({
    id: createId("expense"),
    categoryId: other ? other.id : "cat-other",
    source: "reserve",
    amountCents,
    description: "Retirada da reserva",
    createdAt: new Date().toISOString()
  });

  saveState();
}

/* =========================================================
   GASTOS
========================================================= */

function addExpense(
  cycle,
  categoryId,
  source,
  amountCents,
  description
) {
  if (amountCents <= 0) {
    throw new Error("O valor precisa ser maior que zero.");
  }

  const category = getCategoryById(categoryId);

  if (!category) {
    throw new Error("Categoria não encontrada.");
  }

  if (category.reserve) {
    throw new Error(
      "A Reserva não recebe lançamento de gasto."
    );
  }

  if (source === "reserve") {
    throw new Error(
      "Gastos da Reserva devem ser feitos pela função Retirar."
    );
  }

  const sourceAvailable = getAvailableBySource(
    cycle,
    source
  );

  if (amountCents > sourceAvailable) {
    throw new Error(
      "O valor é maior que o saldo disponível da origem."
    );
  }

  if (category.limitEnabled) {
    const categoryAvailable = getCategoryAvailable(
      cycle,
      category
    );

    if (amountCents > categoryAvailable) {
      throw new Error(
        "O limite disponível da categoria não é suficiente."
      );
    }
  }

  if (source === "salary") {
    cycle.salaryBalanceCents -= amountCents;
  } else {
    cycle.extraBalanceCents -= amountCents;
  }

  cycle.expenses.push({
    id: createId("expense"),
    categoryId,
    source,
    amountCents,
    description: normalizeText(description),
    createdAt: new Date().toISOString()
  });

  saveState();
}

/* =========================================================
   EXTRA
========================================================= */

function addExtra(cycle, amountCents, description) {
  if (amountCents <= 0) {
    throw new Error("O valor precisa ser maior que zero.");
  }

  cycle.extraBalanceCents += amountCents;

  saveState();
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  if (!state) {
    renderSetup();
    return;
  }

  if (!state.account.username || !state.account.passwordHash) {
    renderSetup();
    return;
  }

  if (state.locked) {
    renderLocked();
    return;
  }

  ensureCurrentCycle();

  if (currentView === "main") {
    renderMain();
    return;
  }

  if (currentView === "settings") {
    renderSettings();
    return;
  }

  if (currentView === "previous") {
    renderPreviousCycle();
    return;
  }
}

function renderSetup() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <main class="setup-screen">
      <section class="setup-card">

        <div class="logo">FX</div>
        <div class="logo-subtitle">
          Seu dinheiro. Suas regras.
        </div>

        <h2 class="section-title">Primeiro acesso</h2>

        <form id="setupForm">

          <div class="field">
            <label>Usuário</label>
            <input
              id="setupUsername"
              required
              autocomplete="username"
              maxlength="40"
              placeholder="Seu usuário"
            >
          </div>

          <div class="field">
            <label>Senha</label>
            <input
              id="setupPassword"
              required
              type="password"
              minlength="1"
              maxlength="100"
              autocomplete="new-password"
              placeholder="Crie sua senha"
            >
          </div>

          <div class="field">
            <label>Salário</label>
            <input
              id="setupSalary"
              required
              inputmode="decimal"
              placeholder="R$ 0,00"
            >
          </div>

          <div class="field">
            <label>Dividir salário?</label>
            <select id="setupSplit">
              <option value="false">Não</option>
              <option value="true">Sim — 40% dia 20 / 60% 5º dia útil</option>
            </select>
          </div>

          <div class="field">
            <label>Dia de início do ciclo</label>
            <input
              id="setupCycleDay"
              type="number"
              min="1"
              max="31"
              value="5"
              required
            >
          </div>

          <h2 class="section-title">
            Categorias padrão
          </h2>

          <div id="setupCategories">
            ${DEFAULT_CATEGORIES
              .map((category, index) => `
                <div class="setup-category">
                  <div class="setup-category-head">
                    <input
                      class="setup-icon"
                      data-index="${index}"
                      value="${escapeHtml(category.icon)}"
                      maxlength="4"
                      style="max-width:70px;text-align:center"
                    >

                    <strong>
                      ${escapeHtml(category.name)}
                    </strong>
                  </div>

                  <div class="setup-category-fields">
                    <input
                      class="setup-name"
                      data-index="${index}"
                      value="${escapeHtml(category.name)}"
                      maxlength="40"
                    >

                    ${
                      category.reserve || !category.limitEnabled
                        ? `
                          <input
                            disabled
                            value="Sem limite"
                          >
                        `
                        : `
                          <input
                            class="setup-limit"
                            data-index="${index}"
                            value="${escapeHtml(
                              centsToMoney(category.limitCents)
                            )}"
                            inputmode="decimal"
                          >
                        `
                    }
                  </div>
                </div>
              `)
              .join("")}
          </div>

          <div id="setupError"></div>

          <button
            type="submit"
            class="button-primary"
          >
            Criar FX
          </button>

        </form>

      </section>
    </main>
  `;

  document
    .getElementById("setupForm")
    .addEventListener("submit", handleSetup);
}

async function handleSetup(event) {
  event.preventDefault();

  const error = document.getElementById("setupError");
  error.innerHTML = "";

  const username = normalizeText(
    document.getElementById("setupUsername").value
  );

  const password =
    document.getElementById("setupPassword").value;

  const salary = parseMoney(
    document.getElementById("setupSalary").value
  );

  const split =
    document.getElementById("setupSplit").value === "true";

  const cycleDay = Number(
    document.getElementById("setupCycleDay").value
  );

  if (!username) {
    error.innerHTML =
      `<div class="error">Informe o usuário.</div>`;
    return;
  }

  if (!password) {
    error.innerHTML =
      `<div class="error">Informe a senha.</div>`;
    return;
  }

  if (salary < 0) {
    error.innerHTML =
      `<div class="error">Salário inválido.</div>`;
    return;
  }

  if (
    !Number.isInteger(cycleDay) ||
    cycleDay < 1 ||
    cycleDay > 31
  ) {
    error.innerHTML =
      `<div class="error">O ciclo deve ficar entre 1 e 31.</div>`;
    return;
  }

  const categories = DEFAULT_CATEGORIES.map(
    (category, index) => {
      const name =
        normalizeText(
          document.querySelector(
            `.setup-name[data-index="${index}"]`
          ).value
        ) || category.name;

      const icon =
        normalizeText(
          document.querySelector(
            `.setup-icon[data-index="${index}"]`
          ).value
        ) || category.icon;

      let limitCents = category.limitCents;

      if (category.limitEnabled && !category.reserve) {
        limitCents = parseMoney(
          document.querySelector(
            `.setup-limit[data-index="${index}"]`
          ).value
        );

        if (limitCents < 0) {
          limitCents = 0;
        }
      }

      return {
        ...category,
        name,
        icon,
        limitCents
      };
    }
  );

  const passwordHash = await hashPassword(password);

  state = {
    schemaVersion: SCHEMA_VERSION,

    account: {
      username,
      passwordHash
    },

    locked: false,

    settings: {
      salaryReferenceCents: salary,
      splitSalary: split,
      cycleStartDay: cycleDay
    },

    categories,

    cycles: {},

    reserveBalanceCents: 0,

    currentCycleKey: "",

    createdAt: new Date().toISOString()
  };

  ensureCurrentCycle();

  saveState();

  currentView = "main";

  render();
}

function renderLocked() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <main class="locked-screen">
      <section class="locked-card">

        <div class="lock-icon">🔒</div>

        <div class="logo">FX</div>

        <div class="logo-subtitle">
          Aplicativo bloqueado
        </div>

        <form id="unlockForm">

          <div class="field">
            <label>Senha</label>

            <input
              id="unlockPassword"
              type="password"
              autocomplete="current-password"
              required
            >
          </div>

          <div id="unlockError"></div>

          <button
            type="submit"
            class="button-primary"
          >
            Desbloquear
          </button>

        </form>

      </section>
    </main>
  `;

  document
    .getElementById("unlockForm")
    .addEventListener("submit", handleUnlock);
}

async function handleUnlock(event) {
  event.preventDefault();

  const password =
    document.getElementById("unlockPassword").value;

  const hash = await hashPassword(password);

  if (hash === state.account.passwordHash) {
    state.locked = false;
    saveState();
    render();
    return;
  }

  document.getElementById("unlockError").innerHTML =
    `<div class="error">Senha incorreta.</div>`;
}

/* =========================================================
   TELA PRINCIPAL
========================================================= */

function renderMain() {
  const cycle = getCurrentCycle();

  const available = getAvailableTotal(cycle);

  const categories = state.categories;

  const expenses = [...cycle.expenses]
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .slice(0, 10);

  const app = document.getElementById("app");

  app.innerHTML = `
    <main class="app-shell">

      <header class="main-top">

        <div>
          <div class="fx-title">FX</div>
          <div class="cycle-label">
            ${escapeHtml(
              monthLabel(cycle.startDate)
            )}
          </div>
        </div>

        <button
          id="lockButton"
          class="lock-button"
        >
          🔒 Bloquear
        </button>

      </header>

      <section class="balance-card">

        <div class="balance-label">
          Valor que pode gastar
        </div>

        <div class="balance-value">
          ${centsToMoney(available)}
        </div>

        <div class="money-sources">

          <div class="money-source">
            <div class="money-source-label">
              Salário
            </div>

            <div class="money-source-value">
              ${centsToMoney(cycle.salaryBalanceCents)}
            </div>
          </div>

          <div class="money-source">
            <div class="money-source-label">
              Extra
              <button
                id="addExtraButton"
                class="extra-plus"
                title="Adicionar extra"
              >+</button>
            </div>

            <div class="money-source-value">
              ${centsToMoney(cycle.extraBalanceCents)}
            </div>
          </div>

        </div>

      </section>

      <section class="section">

        <div class="section-header">
          <h2>Categorias</h2>
        </div>

        <div class="category-list">

          ${categories
            .map(category =>
              renderCategoryRow(cycle, category)
            )
            .join("")}

        </div>

      </section>

      <section class="section">

        <div class="section-header">
          <h2>Gastos</h2>
        </div>

        <div class="expense-list">

          ${
            expenses.length
              ? expenses
                  .map(expense =>
                    renderExpenseItem(expense)
                  )
                  .join("")
              : `
                <div class="category-limit-text">
                  Nenhum gasto neste ciclo.
                </div>
              `
          }

        </div>

      </section>

      <section class="section">

        <button
          id="settingsButton"
          class="button-secondary"
        >
          Configurações
        </button>

      </section>

    </main>
  `;

  document
    .getElementById("lockButton")
    .addEventListener("click", () => {
      state.locked = true;
      saveState();
      render();
    });

  document
    .getElementById("addExtraButton")
    .addEventListener("click", openExtraModal);

  document
    .getElementById("settingsButton")
    .addEventListener("click", () => {
      currentView = "settings";
      openedSettings = null;
      render();
    });

  document
    .querySelectorAll(".category-main")
    .forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        openExpenseModal(id);
      });
    });

  document
    .querySelectorAll(".category-icon-button")
    .forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();

        const id = button.dataset.id;

        openCategoryDetail(id);
      });
    });
}

function renderCategoryRow(cycle, category) {
  if (category.reserve) {
    return `
      <div class="category-row">

        <button
          class="category-main"
          data-id="${escapeHtml(category.id)}"
          style="text-align:left;background:transparent;color:inherit;border:0"
        >

          <div class="category-top">

            <div class="category-name">
              <span>${escapeHtml(category.icon)}</span>
              <span>${escapeHtml(category.name)}</span>
            </div>

            <div class="category-balance">
              ${centsToMoney(state.reserveBalanceCents)}
            </div>

          </div>

        </button>

        <button
          class="category-icon-button"
          data-id="${escapeHtml(category.id)}"
          title="Abrir Reserva"
        >
          ⚙
        </button>

      </div>
    `;
  }

  const available = getCategoryAvailable(
    cycle,
    category
  );

  const spent = getCategorySpent(
    cycle,
    category.id
  );

  const blocked =
    category.limitEnabled &&
    available <= 0;

  const progress =
    category.limitEnabled &&
    category.limitCents > 0
      ? Math.min(
          100,
          Math.round(
            (spent / category.limitCents) * 100
          )
        )
      : 0;

  return `
    <div
      class="category-row ${blocked ? "category-blocked" : ""}"
    >

      <button
        class="category-main"
        data-id="${escapeHtml(category.id)}"
        style="text-align:left;background:transparent;color:inherit;border:0"
      >

        <div class="category-top">

          <div class="category-name">
            <span>${escapeHtml(category.icon)}</span>
            <span>${escapeHtml(category.name)}</span>
          </div>

          <div class="category-balance">
            ${
              category.limitEnabled
                ? centsToMoney(available)
                : "Sem limite"
            }
          </div>

        </div>

        ${
          category.limitEnabled
            ? `
              <div class="progress">
                <div
                  class="progress-fill"
                  style="width:${progress}%"
                ></div>
              </div>

              <div class="category-limit-text">
                ${centsToMoney(spent)}
                de
                ${centsToMoney(category.limitCents)}
                ${
                  blocked
                    ? " — limite atingido"
                    : ""
                }
              </div>
            `
            : ""
        }

      </button>

      <button
        class="category-icon-button"
        data-id="${escapeHtml(category.id)}"
        title="Abrir categoria"
      >
        ⚙
      </button>

    </div>
  `;
}

function renderExpenseItem(expense) {
  const category = getCategoryById(
    expense.categoryId
  );

  const categoryName =
    category?.name || "Categoria excluída";

  const sourceName = {
    salary: "Salário",
    extra: "Extra",
    reserve: "Reserva"
  }[expense.source] || expense.source;

  return `
    <div class="expense-item">

      <div class="expense-info">

        <div class="expense-title">
          ${escapeHtml(
            category?.icon || "📁"
          )}
          ${escapeHtml(categoryName)}
        </div>

        <div class="expense-meta">
          ${formatDateTime(expense.createdAt)}
          ·
          ${escapeHtml(sourceName)}
          ${
            expense.description
              ? ` · ${escapeHtml(expense.description)}`
              : ""
          }
        </div>

      </div>

      <div class="expense-value">
        - ${centsToMoney(expense.amountCents)}
      </div>

    </div>
  `;
}

/* =========================================================
   MODAL DE GASTO
========================================================= */

function openExpenseModal(categoryId) {
  const category = getCategoryById(categoryId);

  if (!category) return;

  if (category.reserve) {
    openReserveModal();
    return;
  }

  const cycle = getCurrentCycle();

  const available =
    category.limitEnabled
      ? getCategoryAvailable(cycle, category)
      : null;

  if (available === 0 && category.limitEnabled) {
    showModal(`
      <div class="modal-title">
        ${escapeHtml(category.icon)}
        ${escapeHtml(category.name)}
      </div>

      <div class="error">
        O limite desta categoria já foi atingido neste ciclo.
      </div>

      <button
        class="close-modal"
        onclick="closeModal()"
      >
        Fechar
      </button>
    `);

    return;
  }

  showModal(`
    <div class="modal-title">
      ${escapeHtml(category.icon)}
      ${escapeHtml(category.name)}
    </div>

    <form id="expenseForm">

      <div class="field">
        <label>Valor</label>
        <input
          id="expenseAmount"
          required
          inputmode="decimal"
          placeholder="R$ 0,00"
        >
      </div>

      <div class="field">
        <label>Origem</label>

        <select id="expenseSource">

          <option value="salary">
            Salário — ${centsToMoney(
              cycle.salaryBalanceCents
            )}
          </option>

          <option value="extra">
            Extra — ${centsToMoney(
              cycle.extraBalanceCents
            )}
          </option>

        </select>
      </div>

      <div class="field">
        <label>Descrição opcional</label>

        <input
          id="expenseDescription"
          maxlength="120"
          placeholder="Ex.: Farmácia"
        >
      </div>

      <div id="expenseError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Lançar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("expenseForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const amount = parseMoney(
        document.getElementById("expenseAmount").value
      );

      const source =
        document.getElementById("expenseSource").value;

      const description =
        document.getElementById(
          "expenseDescription"
        ).value;

      try {
        addExpense(
          cycle,
          categoryId,
          source,
          amount,
          description
        );

        closeModal();
        render();
      } catch (error) {
        document.getElementById(
          "expenseError"
        ).innerHTML =
          `<div class="error">${escapeHtml(
            error.message
          )}</div>`;
      }
    });
}

/* =========================================================
   EXTRA
========================================================= */

function openExtraModal() {
  showModal(`
    <div class="modal-title">
      Adicionar Extra
    </div>

    <form id="extraForm">

      <div class="field">
        <label>Valor</label>

        <input
          id="extraAmount"
          required
          inputmode="decimal"
          placeholder="R$ 0,00"
        >
      </div>

      <div class="field">
        <label>Descrição opcional</label>

        <input
          id="extraDescription"
          maxlength="120"
          placeholder="Ex.: Venda"
        >
      </div>

      <div id="extraError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Salvar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("extraForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const amount = parseMoney(
        document.getElementById("extraAmount").value
      );

      try {
        addExtra(
          getCurrentCycle(),
          amount,
          document.getElementById(
            "extraDescription"
          ).value
        );

        closeModal();
        render();
      } catch (error) {
        document.getElementById(
          "extraError"
        ).innerHTML =
          `<div class="error">${escapeHtml(
            error.message
          )}</div>`;
      }
    });
}

/* =========================================================
   RESERVA
========================================================= */

function openReserveModal() {
  showModal(`
    <div class="modal-title">
      🏦 Reserva
    </div>

    <div
      style="
        text-align:center;
        font-size:30px;
        font-weight:800;
        margin-bottom:20px
      "
    >
      ${centsToMoney(state.reserveBalanceCents)}
    </div>

    <div class="modal-actions">

      <button
        id="reserveDepositButton"
        class="button-primary"
      >
        Guardar
      </button>

      <button
        id="reserveWithdrawButton"
        class="button-secondary"
      >
        Retirar
      </button>

      <button
        class="close-modal"
        onclick="closeModal()"
      >
        Fechar
      </button>

    </div>
  `);

  document
    .getElementById("reserveDepositButton")
    .addEventListener(
      "click",
      openReserveDepositModal
    );

  document
    .getElementById("reserveWithdrawButton")
    .addEventListener(
      "click",
      openReserveWithdrawModal
    );
}

function openReserveDepositModal() {
  const cycle = getCurrentCycle();

  showModal(`
    <div class="modal-title">
      Guardar na Reserva
    </div>

    <form id="reserveDepositForm">

      <div class="field">
        <label>Origem</label>

        <select id="reserveSource">

          <option value="salary">
            Salário — ${centsToMoney(
              cycle.salaryBalanceCents
            )}
          </option>

          <option value="extra">
            Extra — ${centsToMoney(
              cycle.extraBalanceCents
            )}
          </option>

        </select>
      </div>

      <div class="field">
        <label>Valor</label>

        <input
          id="reserveAmount"
          required
          inputmode="decimal"
          placeholder="R$ 0,00"
        >
      </div>

      <div id="reserveError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Guardar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="openReserveModal()"
        >
          Voltar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("reserveDepositForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const source =
        document.getElementById(
          "reserveSource"
        ).value;

      const amount = parseMoney(
        document.getElementById(
          "reserveAmount"
        ).value
      );

      try {
        depositReserve(
          cycle,
          source,
          amount
        );

        closeModal();
        render();
      } catch (error) {
        document.getElementById(
          "reserveError"
        ).innerHTML =
          `<div class="error">${escapeHtml(
            error.message
          )}</div>`;
      }
    });
}

function openReserveWithdrawModal() {
  showModal(`
    <div class="modal-title">
      Retirar da Reserva
    </div>

    <div class="setting-subtitle">
      Saldo disponível:
      ${centsToMoney(state.reserveBalanceCents)}
    </div>

    <form id="reserveWithdrawForm">

      <div class="field" style="margin-top:15px">
        <label>Valor</label>

        <input
          id="withdrawAmount"
          required
          inputmode="decimal"
          placeholder="R$ 0,00"
        >
      </div>

      <div id="withdrawError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Retirar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="openReserveModal()"
        >
          Voltar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("reserveWithdrawForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const amount = parseMoney(
        document.getElementById(
          "withdrawAmount"
        ).value
      );

      try {
        withdrawReserve(
          getCurrentCycle(),
          amount
        );

        closeModal();
        render();
      } catch (error) {
        document.getElementById(
          "withdrawError"
        ).innerHTML =
          `<div class="error">${escapeHtml(
            error.message
          )}</div>`;
      }
    });
}

/* =========================================================
   DETALHE DE CATEGORIA
========================================================= */

function openCategoryDetail(categoryId) {
  const category = getCategoryById(categoryId);

  if (!category) return;

  if (category.reserve) {
    openReserveModal();
    return;
  }

  const cycle = getCurrentCycle();

  const expenses = cycle.expenses
    .filter(
      expense =>
        expense.categoryId === categoryId
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  showModal(`
    <div class="detail-header">

      <div class="detail-icon">
        ${escapeHtml(category.icon)}
      </div>

      <div>
        <div class="modal-title" style="margin:0">
          ${escapeHtml(category.name)}
        </div>

        <div class="setting-subtitle">
          ${
            category.limitEnabled
              ? `Disponível: ${centsToMoney(
                  getCategoryAvailable(
                    cycle,
                    category
                  )
                )}`
              : "Sem limite"
          }
        </div>
      </div>

    </div>

    ${
      category.limitEnabled
        ? `
          <div class="category-limit-text">
            Consumido:
            ${centsToMoney(
              getCategorySpent(
                cycle,
                category.id
              )
            )}
            de
            ${centsToMoney(
              category.limitCents
            )}
          </div>
        `
        : ""
    }

    <div class="section">

      <div class="section-header">
        <h2>Lançamentos</h2>
      </div>

      ${
        expenses.length
          ? expenses
              .map(expense => {
                const source = {
                  salary: "Salário",
                  extra: "Extra"
                }[expense.source];

                return `
                  <div class="expense-item">

                    <div class="expense-info">

                      <div class="expense-title">
                        ${formatDate(
                          expense.createdAt
                        )}
                        ·
                        ${escapeHtml(source)}
                      </div>

                      ${
                        expense.description
                          ? `
                            <div class="expense-meta">
                              ${escapeHtml(
                                expense.description
                              )}
                            </div>
                          `
                          : ""
                      }

                    </div>

                    <div class="expense-value">
                      - ${centsToMoney(
                        expense.amountCents
                      )}
                    </div>

                  </div>
                `;
              })
              .join("")
          : `
            <div class="category-limit-text">
              Nenhum lançamento.
            </div>
          `
      }

    </div>

    <button
      class="close-modal"
      onclick="closeModal()"
    >
      Fechar
    </button>
  `);
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

function renderSettings() {
  const app = document.getElementById("app");

  const previousKey = getPreviousCycleKey();
  const previous = state.cycles[previousKey];

  app.innerHTML = `
    <main class="app-shell">

      <header class="main-top">

        <div>
          <div class="fx-title">
            Configurações
          </div>

          <div class="cycle-label">
            ${escapeHtml(
              state.account.username
            )}
          </div>
        </div>

        <button
          id="backMainButton"
          class="lock-button"
        >
          Voltar
        </button>

      </header>

      <section class="settings-list">

        ${renderSetting(
          "categories",
          "Categorias",
          "Editar categorias e limites"
        )}

        ${renderSetting(
          "salary",
          "Salário",
          "Valor e divisão do salário"
        )}

        ${renderSetting(
          "cycle",
          "Ciclo",
          `Dia de início: ${state.settings.cycleStartDay}`
        )}

        ${renderSetting(
          "previous",
          "Mês anterior",
          previous
            ? monthLabel(previous.startDate)
            : "Ainda não existe"
        )}

        ${renderSetting(
          "pizza",
          "Pizza",
          "Gastos do ciclo atual"
        )}

        ${renderSetting(
          "security",
          "Segurança",
          "Senha e dados"
        )}

        ${renderSetting(
          "backup",
          "Backup",
          "Exportar ou importar"
        )}

      </section>

    </main>
  `;

  document
    .getElementById("backMainButton")
    .addEventListener("click", () => {
      currentView = "main";
      render();
    });

  document
    .querySelectorAll(".setting-button")
    .forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.setting;

        if (key === "previous") {
          if (previous) {
            currentView = "previous";
            render();
          }

          return;
        }

        openedSettings =
          openedSettings === key
            ? null
            : key;

        render();
      });
    });
}

function renderSetting(key, title, subtitle) {
  const opened = openedSettings === key;

  let content = "";

  if (opened) {
    if (key === "categories") {
      content = renderCategoriesSettings();
    }

    if (key === "salary") {
      content = renderSalarySettings();
    }

    if (key === "cycle") {
      content = renderCycleSettings();
    }

    if (key === "pizza") {
      content = renderPizzaSettings();
    }

    if (key === "security") {
      content = renderSecuritySettings();
    }

    if (key === "backup") {
      content = renderBackupSettings();
    }
  }

  return `
    <div class="setting-item">

      <button
        class="setting-button"
        data-setting="${escapeHtml(key)}"
      >
        <div>
          <div>${escapeHtml(title)}</div>
          <div class="setting-subtitle">
            ${escapeHtml(subtitle)}
          </div>
        </div>

        <span>
          ${opened ? "−" : "+"}
        </span>
      </button>

      ${
        opened
          ? `
            <div class="setting-content">
              ${content}
            </div>
          `
          : ""
      }

    </div>
  `;
}

/* =========================================================
   CONFIGURAÇÃO DE CATEGORIAS
========================================================= */

function renderCategoriesSettings() {
  return `
    <div>

      ${state.categories
        .map(category => `
          <div
            style="
              padding:12px 0;
              border-bottom:1px solid #222
            "
          >

            <div
              style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px
              "
            >

              <div>
                ${escapeHtml(category.icon)}
                <strong>
                  ${escapeHtml(category.name)}
                </strong>

                <div class="setting-subtitle">
                  ${
                    category.reserve
                      ? "Reserva protegida"
                      : category.limitEnabled
                        ? `Limite:
                           ${centsToMoney(
                             category.limitCents
                           )}`
                        : "Sem limite"
                  }
                </div>
              </div>

              <button
                class="button-secondary edit-category"
                data-id="${escapeHtml(category.id)}"
                style="width:auto"
              >
                Editar
              </button>

            </div>

          </div>
        `)
        .join("")}

      <div style="margin-top:15px">

        <button
          id="createCategoryButton"
          class="button-primary"
        >
          Criar categoria
        </button>

      </div>

    </div>
  `;
}

function bindCategorySettingsEvents() {
  document
    .querySelectorAll(".edit-category")
    .forEach(button => {
      button.addEventListener("click", () => {
        openEditCategoryModal(
          button.dataset.id
        );
      });
    });

  const create =
    document.getElementById(
      "createCategoryButton"
    );

  if (create) {
    create.addEventListener(
      "click",
      openCreateCategoryModal
    );
  }
}

/* =========================================================
   MODAIS DE CATEGORIA
========================================================= */

function openCreateCategoryModal() {
  showModal(`
    <div class="modal-title">
      Criar categoria
    </div>

    <form id="createCategoryForm">

      <div class="field">
        <label>Nome</label>
        <input
          id="newCategoryName"
          maxlength="40"
          required
        >
      </div>

      <div class="field">
        <label>Ícone</label>
        <input
          id="newCategoryIcon"
          maxlength="4"
          value="📁"
        >
      </div>

      <div class="field">
        <label>Limite</label>

        <select id="newCategoryLimit">
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </div>

      <div
        class="field"
        id="newCategoryLimitField"
      >
        <label>Valor do limite</label>
        <input
          id="newCategoryLimitValue"
          inputmode="decimal"
          placeholder="R$ 0,00"
        >
      </div>

      <div id="categoryError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Salvar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  const limitSelect =
    document.getElementById(
      "newCategoryLimit"
    );

  limitSelect.addEventListener(
    "change",
    () => {
      document.getElementById(
        "newCategoryLimitField"
      ).classList.toggle(
        "hidden",
        limitSelect.value !== "true"
      );
    }
  );

  document
    .getElementById("createCategoryForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      const name = normalizeText(
        document.getElementById(
          "newCategoryName"
        ).value
      );

      const icon = normalizeText(
        document.getElementById(
          "newCategoryIcon"
        ).value
      ) || "📁";

      const limitEnabled =
        limitSelect.value === "true";

      const limitCents = limitEnabled
        ? parseMoney(
            document.getElementById(
              "newCategoryLimitValue"
            ).value
          )
        : 0;

      if (!name) {
        document.getElementById(
          "categoryError"
        ).innerHTML =
          `<div class="error">Informe o nome.</div>`;
        return;
      }

      state.categories.push({
        id: createId("cat"),
        name,
        icon,
        limitEnabled,
        limitCents,
        protected: false,
        reserve: false
      });

      saveState();
      closeModal();
      render();
    });
}

function openEditCategoryModal(categoryId) {
  const category = getCategoryById(categoryId);

  if (!category) return;

  showModal(`
    <div class="modal-title">
      Editar categoria
    </div>

    <form id="editCategoryForm">

      <div class="field">
        <label>Nome</label>
        <input
          id="editCategoryName"
          maxlength="40"
          required
          value="${escapeHtml(
            category.name
          )}"
        >
      </div>

      <div class="field">
        <label>Ícone</label>
        <input
          id="editCategoryIcon"
          maxlength="4"
          value="${escapeHtml(
            category.icon
          )}"
        >
      </div>

      ${
        category.reserve
          ? `
            <div class="setting-subtitle">
              A Reserva não possui limite.
            </div>
          `
          : `
            <div class="field">
              <label>Limite</label>

              <select id="editCategoryLimit">

                <option
                  value="true"
                  ${
                    category.limitEnabled
                      ? "selected"
                      : ""
                  }
                >
                  Sim
                </option>

                <option
                  value="false"
                  ${
                    !category.limitEnabled
                      ? "selected"
                      : ""
                  }
                >
                  Não
                </option>

              </select>
            </div>

            <div class="field">
              <label>Valor do limite</label>

              <input
                id="editCategoryLimitValue"
                inputmode="decimal"
                value="${escapeHtml(
                  centsToMoney(
                    category.limitCents
                  )
                )}"
              >
            </div>
          `
      }

      <div id="editCategoryError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Salvar
        </button>

        ${
          !category.protected
            ? `
              <button
                type="button"
                id="deleteCategoryButton"
                class="button-danger"
              >
                Excluir categoria
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("editCategoryForm")
    .addEventListener("submit", event => {
      event.preventDefault();

      category.name =
        normalizeText(
          document.getElementById(
            "editCategoryName"
          ).value
        ) || category.name;

      category.icon =
        normalizeText(
          document.getElementById(
            "editCategoryIcon"
          ).value
        ) || category.icon;

      if (!category.reserve) {
        category.limitEnabled =
          document.getElementById(
            "editCategoryLimit"
          ).value === "true";

        category.limitCents =
          category.limitEnabled
            ? parseMoney(
                document.getElementById(
                  "editCategoryLimitValue"
                ).value
              )
            : 0;
      }

      saveState();
      closeModal();
      render();
    });

  const deleteButton =
    document.getElementById(
      "deleteCategoryButton"
    );

  if (deleteButton) {
    deleteButton.addEventListener(
      "click",
      () => {
        const confirmed =
          confirm(
            "Excluir esta categoria? Os gastos antigos continuarão no histórico."
          );

        if (!confirmed) return;

        state.categories =
          state.categories.filter(
            item => item.id !== categoryId
          );

        saveState();
        closeModal();
        render();
      }
    );
  }
});

/* =========================================================
   CONFIGURAÇÃO SALÁRIO
========================================================= */

function renderSalarySettings() {
  const cycle = getCurrentCycle();

  return `
    <form id="salarySettingsForm">

      <div class="field">
        <label>Salário de referência</label>

        <input
          id="salaryReference"
          inputmode="decimal"
          value="${escapeHtml(
            centsToMoney(
              state.settings.salaryReferenceCents
            )
          )}"
        >
      </div>

      <div class="field">
        <label>Dividir salário</label>

        <select id="splitSalarySetting">

          <option
            value="false"
            ${
              !state.settings.splitSalary
                ? "selected"
                : ""
            }
          >
            Não
          </option>

          <option
            value="true"
            ${
              state.settings.splitSalary
                ? "selected"
                : ""
            }
          >
            Sim
          </option>

        </select>
      </div>

      ${
        state.settings.splitSalary
          ? `
            <div class="setting-subtitle">
              40% no dia 20.
              60% no 5º dia útil.
              Os percentuais são fixos.
            </div>
          `
          : ""
      }

      <div class="field" style="margin-top:18px">

        <label>
          Ajustar salário recebido neste ciclo
        </label>

        <input
          id="salaryAdjustment"
          inputmode="decimal"
          value="${escapeHtml(
            centsToMoney(
              cycle.salaryReferenceCents
            )
          )}"
        >

      </div>

      <div id="salaryError"></div>

      <button
        type="submit"
        class="button-primary"
      >
        Salvar
      </button>

    </form>
  `;
}

/* =========================================================
   CICLO SETTINGS
========================================================= */

function renderCycleSettings() {
  return `
    <form id="cycleSettingsForm">

      <div class="field">
        <label>Dia de início</label>

        <input
          id="cycleDay"
          type="number"
          min="1"
          max="31"
          value="${state.settings.cycleStartDay}"
        >
      </div>

      <div class="setting-subtitle">
        A alteração vale para o próximo ciclo.
      </div>

      <div id="cycleError"></div>

      <button
        type="submit"
        class="button-primary"
      >
        Salvar
      </button>

    </form>
  `;
}

/* =========================================================
   SEGURANÇA
========================================================= */

function renderSecuritySettings() {
  return `
    <div>

      <div class="setting-subtitle" style="margin-bottom:15px">
        Usuário:
        ${escapeHtml(
          state.account.username
        )}
      </div>

      <button
        id="changePasswordButton"
        class="button-secondary"
      >
        Alterar senha
      </button>

      <div style="height:8px"></div>

      <button
        id="deleteAllButton"
        class="button-danger"
      >
        Apagar todos os dados
      </button>

    </div>
  `;
}

/* =========================================================
   BACKUP
========================================================= */

function renderBackupSettings() {
  return `
    <div>

      <button
        id="exportBackupButton"
        class="button-secondary"
      >
        Exportar backup JSON
      </button>

      <div style="height:8px"></div>

      <label
        class="button-secondary"
        style="
          display:block;
          text-align:center;
          cursor:pointer
        "
      >
        Importar backup JSON

        <input
          id="importBackupInput"
          type="file"
          accept=".json,application/json"
          hidden
        >
      </label>

      <div
        class="setting-subtitle"
        style="margin-top:12px"
      >
        O backup é local e contém os dados do FX.
      </div>

    </div>
  `;
}

/* =========================================================
   PIZZA
========================================================= */

function renderPizzaSettings() {
  const cycle = getCurrentCycle();

  const data = state.categories
    .filter(category => !category.reserve)
    .map(category => ({
      category,
      value: getCategorySpent(
        cycle,
        category.id
      )
    }))
    .filter(item => item.value > 0);

  const total = data.reduce(
    (sum, item) => sum + item.value,
    0
  );

  if (!total) {
    return `
      <div class="category-limit-text">
        Ainda não existem gastos neste ciclo.
      </div>
    `;
  }

  let current = 0;

  const segments = data.map(item => {
    const start = current;

    current +=
      (item.value / total) * 360;

    return {
      ...item,
      start,
      end: current
    };
  });

  const background = segments
    .map((segment, index) => {
      const gray =
        15 + ((index * 13) % 65);

      return `hsl(0 0% ${gray}%) ${segment.start}deg ${segment.end}deg`;
    })
    .join(", ");

  return `
    <div class="pizza-wrap">

      <div
        class="pie-chart"
        style="
          background:conic-gradient(
            ${background}
          )
        "
      >
        <div class="pie-center">
          ${centsToMoney(total)}
        </div>
      </div>

      <div class="pie-legend">

        ${data
          .map(item => `
            <div class="pie-row">

              <span>
                ${escapeHtml(
                  item.category.icon
                )}
                ${escapeHtml(
                  item.category.name
                )}
              </span>

              <strong>
                ${centsToMoney(item.value)}
              </strong>

            </div>
          `)
          .join("")}

      </div>

    </div>
  `;
}

/* =========================================================
   CICLO ANTERIOR
========================================================= */

function renderPreviousCycle() {
  const key = getPreviousCycleKey();
  const cycle = state.cycles[key];

  if (!cycle) {
    currentView = "settings";
    render();
    return;
  }

  const expenses = [...cycle.expenses]
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  document.getElementById("app").innerHTML = `
    <main class="app-shell">

      <header class="main-top">

        <div>
          <div class="fx-title">
            Mês anterior
          </div>

          <div class="cycle-label">
            ${escapeHtml(
              monthLabel(cycle.startDate)
            )}
          </div>
        </div>

        <button
          id="previousBackButton"
          class="lock-button"
        >
          Voltar
        </button>

      </header>

      <section class="previous-cycle-card">

        <span class="readonly-badge">
          SOMENTE LEITURA
        </span>

        <div class="section">
          <strong>Salário restante</strong>
          <div class="detail-total">
            ${centsToMoney(
              cycle.salaryBalanceCents
            )}
          </div>
        </div>

        <div class="section">
          <strong>Extra restante</strong>
          <div class="detail-total">
            ${centsToMoney(
              cycle.extraBalanceCents
            )}
          </div>
        </div>

        <div class="section">
          <strong>Gastos</strong>

          ${
            expenses.length
              ? `
                <div class="expense-list">
                  ${expenses
                    .map(
                      expense =>
                        renderExpenseItem(
                          expense
                        )
                    )
                    .join("")}
                </div>
              `
              : `
                <div class="category-limit-text">
                  Nenhum gasto.
                </div>
              `
          }

        </div>

      </section>

    </main>
  `;

  document
    .getElementById(
      "previousBackButton"
    )
    .addEventListener("click", () => {
      currentView = "settings";
      render();
    });
}

/* =========================================================
   MODAL GLOBAL
========================================================= */

function showModal(html) {
  const layer =
    document.getElementById("modalLayer");

  const box =
    document.getElementById("modalBox");

  box.innerHTML = html;

  layer.classList.remove("hidden");
}

function closeModal() {
  document
    .getElementById("modalLayer")
    .classList.add("hidden");

  document.getElementById(
    "modalBox"
  ).innerHTML = "";
}

/* =========================================================
   SALÁRIO — EVENTOS
========================================================= */

function bindSettingsForms() {
  const salaryForm =
    document.getElementById(
      "salarySettingsForm"
    );

  if (salaryForm) {
    salaryForm.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const newReference =
          parseMoney(
            document.getElementById(
              "salaryReference"
            ).value
          );

        const newSplit =
          document.getElementById(
            "splitSalarySetting"
          ).value === "true";

        const adjustment =
          parseMoney(
            document.getElementById(
              "salaryAdjustment"
            ).value
          );

        const cycle = getCurrentCycle();

        if (newReference < 0) {
          document.getElementById(
            "salaryError"
          ).innerHTML =
            `<div class="error">Salário inválido.</div>`;
          return;
        }

        if (adjustment < 0) {
          document.getElementById(
            "salaryError"
          ).innerHTML =
            `<div class="error">Ajuste inválido.</div>`;
          return;
        }

        state.settings.salaryReferenceCents =
          newReference;

        state.settings.splitSalary =
          newSplit;

        const oldBalance =
          cycle.salaryBalanceCents;

        if (state.settings.splitSalary) {
          const firstApplied =
            cycle.salaryAppliedParts.first;

          const secondApplied =
            cycle.salaryAppliedParts.second;

          let newReceived = 0;

          if (firstApplied) {
            newReceived +=
              Math.round(adjustment * 0.60);
          }

          if (secondApplied) {
            newReceived +=
              adjustment -
              Math.round(adjustment * 0.60);
          }

          const spentFromSalary =
            getSalarySpent(cycle);

          const requiredMinimum =
            spentFromSalary;

          const carryDifference =
            Math.max(
              0,
              oldBalance -
                Math.max(
                  0,
                  cycle.salaryReferenceCents
                )
            );

          const newBalance =
            Math.max(
              0,
              newReceived -
                spentFromSalary
            ) + carryDifference;

          if (
            newBalance < 0 ||
            newReceived < requiredMinimum
          ) {
            document.getElementById(
              "salaryError"
            ).innerHTML =
              `<div class="error">
                Esse ajuste deixaria o salário insuficiente para os gastos já registrados.
              </div>`;

            return;
          }

          cycle.salaryReferenceCents =
            adjustment;

          cycle.salaryBalanceCents =
            newBalance;
        } else {
          const spentFromSalary =
            getSalarySpent(cycle);

          if (
            adjustment <
            spentFromSalary
          ) {
            document.getElementById(
              "salaryError"
            ).innerHTML =
              `<div class="error">
                Esse valor não cobre os gastos de salário já registrados.
              </div>`;

            return;
          }

          cycle.salaryReferenceCents =
            adjustment;

          cycle.salaryBalanceCents =
            adjustment -
            spentFromSalary;
        }

        cycle.salaryAdjusted = true;

        saveState();
        render();
      }
    );
  }

  const cycleForm =
    document.getElementById(
      "cycleSettingsForm"
    );

  if (cycleForm) {
    cycleForm.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const day = Number(
          document.getElementById(
            "cycleDay"
          ).value
        );

        if (
          !Number.isInteger(day) ||
          day < 1 ||
          day > 31
        ) {
          document.getElementById(
            "cycleError"
          ).innerHTML =
            `<div class="error">
              O dia deve ficar entre 1 e 31.
            </div>`;

          return;
        }

        state.settings.cycleStartDay =
          day;

        saveState();
        render();
      }
    );
  }

  bindCategorySettingsEvents();

  const changePasswordButton =
    document.getElementById(
      "changePasswordButton"
    );

  if (changePasswordButton) {
    changePasswordButton.addEventListener(
      "click",
      openChangePasswordModal
    );
  }

  const deleteAllButton =
    document.getElementById(
      "deleteAllButton"
    );

  if (deleteAllButton) {
    deleteAllButton.addEventListener(
      "click",
      openDeleteAllModal
    );
  }

  const exportButton =
    document.getElementById(
      "exportBackupButton"
    );

  if (exportButton) {
    exportButton.addEventListener(
      "click",
      exportBackup
    );
  }

  const importInput =
    document.getElementById(
      "importBackupInput"
    );

  if (importInput) {
    importInput.addEventListener(
      "change",
      importBackup
    );
  }
}

function getSalarySpent(cycle) {
  return cycle.expenses
    .filter(
      expense => expense.source === "salary"
    )
    .reduce(
      (sum, expense) =>
        sum + expense.amountCents,
      0
    );
}

/* =========================================================
   ALTERAR SENHA
========================================================= */

function openChangePasswordModal() {
  showModal(`
    <div class="modal-title">
      Alterar senha
    </div>

    <form id="changePasswordForm">

      <div class="field">
        <label>Senha atual</label>
        <input
          id="oldPassword"
          type="password"
          required
        >
      </div>

      <div class="field">
        <label>Nova senha</label>
        <input
          id="newPassword"
          type="password"
          required
        >
      </div>

      <div id="passwordError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-primary"
        >
          Alterar
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("changePasswordForm")
    .addEventListener("submit", async event => {
      event.preventDefault();

      const oldPassword =
        document.getElementById(
          "oldPassword"
        ).value;

      const newPassword =
        document.getElementById(
          "newPassword"
        ).value;

      const oldHash =
        await hashPassword(oldPassword);

      if (
        oldHash !==
        state.account.passwordHash
      ) {
        document.getElementById(
          "passwordError"
        ).innerHTML =
          `<div class="error">
            Senha atual incorreta.
          </div>`;

        return;
      }

      if (!newPassword) {
        document.getElementById(
          "passwordError"
        ).innerHTML =
          `<div class="error">
            A nova senha não pode ficar vazia.
          </div>`;

        return;
      }

      state.account.passwordHash =
        await hashPassword(
          newPassword
        );

      saveState();
      closeModal();
      render();
    });
}

/* =========================================================
   APAGAR TODOS OS DADOS
========================================================= */

function openDeleteAllModal() {
  showModal(`
    <div class="modal-title">
      Apagar todos os dados
    </div>

    <div class="error">
      Esta operação apaga conta, senha,
      categorias, ciclos, gastos,
      reserva e configurações.
    </div>

    <form id="deleteAllForm">

      <div class="field">
        <label>Senha atual</label>

        <input
          id="deletePassword"
          type="password"
          required
        >
      </div>

      <div class="field">
        <label>Digite APAGAR para confirmar</label>

        <input
          id="deleteConfirmText"
          required
          autocomplete="off"
        >
      </div>

      <div id="deleteError"></div>

      <div class="modal-actions">

        <button
          type="submit"
          class="button-danger"
        >
          Apagar tudo
        </button>

        <button
          type="button"
          class="close-modal"
          onclick="closeModal()"
        >
          Cancelar
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("deleteAllForm")
    .addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const password =
          document.getElementById(
            "deletePassword"
          ).value;

        const confirmation =
          document.getElementById(
            "deleteConfirmText"
          ).value;

        if (
          confirmation.trim() !==
          "APAGAR"
        ) {
          document.getElementById(
            "deleteError"
          ).innerHTML =
            `<div class="error">
              Digite APAGAR para confirmar.
            </div>`;

          return;
        }

        const hash =
          await hashPassword(password);

        if (
          hash !==
          state.account.passwordHash
        ) {
          document.getElementById(
            "deleteError"
          ).innerHTML =
            `<div class="error">
              Senha incorreta.
            </div>`;

          return;
        }

        localStorage.removeItem(FX_KEY);

        state = null;
        currentView = "main";

        closeModal();
        render();
      }
    );
}

/* =========================================================
   BACKUP EXPORTAÇÃO
========================================================= */

function exportBackup() {
  const backup = {
    ...state,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `fx-backup-${todayISO()}.json`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   BACKUP IMPORTAÇÃO
========================================================= */

function importBackup(event) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const imported =
        JSON.parse(reader.result);

      const normalized =
        normalizeState(imported);

      if (
        !normalized ||
        !normalized.account ||
        !normalized.cycles
      ) {
        throw new Error(
          "Arquivo de backup inválido."
        );
      }

      const confirmed =
        confirm(
          "Importar este backup substituirá os dados atuais do FX. Continuar?"
        );

      if (!confirmed) return;

      state = normalized;

      ensureCurrentCycle();
      saveState();

      currentView = "main";

      render();

      alert(
        "Backup importado com sucesso."
      );
    } catch (error) {
      alert(
        "Não foi possível importar o backup."
      );

      console.error(error);
    }

    event.target.value = "";
  };

  reader.readAsText(file);
}

/* =========================================================
   EVENTOS DOS SETTINGS
========================================================= */

const originalRenderSettings = renderSettings;

renderSettings = function () {
  originalRenderSettings();

  bindSettingsForms();
};

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function init() {
  if (state) {
    state = normalizeState(state);

    ensureCurrentCycle();

    saveState();
  }

  render();
}

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch(error => {
          console.error(
            "Service Worker:",
            error
          );
        });
    }
  );
}

init();

/* =========================================================
   FUNÇÕES EXPOSTAS AOS BOTÕES INLINE
========================================================= */

window.closeModal = closeModal;
window.openReserveModal = openReserveModal;
window.openReserveDepositModal =
  openReserveDepositModal;
window.openReserveWithdrawModal =
  openReserveWithdrawModal;
