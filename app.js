/* =========================================================
   FX — SEU DINHEIRO. SUAS REGRAS.
   APP.JS
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const APP_NAME = "FX";
const MASTER_KEY = "Fx020919";
const STORAGE_KEY = "fx_state_v1";

const DEFAULT_CATEGORIES = [
  {
    id: "cat-fixed",
    name: "Gasto Fixo",
    icon: "🏠",
    type: "expense",
    hasLimit: true,
    limit: 600
  },
  {
    id: "cat-reserve",
    name: "Reserva",
    icon: "🏦",
    type: "reserve",
    hasLimit: false,
    limit: 0
  },
  {
    id: "cat-medicines",
    name: "Medicamentos",
    icon: "💊",
    type: "expense",
    hasLimit: true,
    limit: 200
  },
  {
    id: "cat-leisure",
    name: "Lazer",
    icon: "🎮",
    type: "expense",
    hasLimit: true,
    limit: 200
  },
  {
    id: "cat-phone",
    name: "Celular",
    icon: "📱",
    type: "expense",
    hasLimit: true,
    limit: 35
  },
  {
    id: "cat-other",
    name: "Outros",
    icon: "📦",
    type: "other",
    hasLimit: false,
    limit: 0
  }
];


/* =========================================================
   ESTADO
   ========================================================= */

let state = createInitialState();

let currentScreen = "setup";
let currentPanel = null;
let currentModal = null;

let selectedCategoryId = null;
let selectedSettingsCategoryId = null;

let toastTimer = null;


/* =========================================================
   ESTADO INICIAL
   ========================================================= */

function createInitialState() {
  return {
    schemaVersion: 1,

    account: {
      configured: false,
      username: "",
      password: ""
    },

    session: {
      locked: false
    },

    settings: {
      salaryReference: 0,
      salarySplit: false,
      cycleDay: 5
    },

    currentCycleKey: getCycleKey(new Date()),

    cycles: {},

    categories: clone(DEFAULT_CATEGORIES)
  };
}


/* =========================================================
   UTILIDADES
   ========================================================= */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix = "id") {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


/* =========================================================
   DINHEIRO
   Internamente usamos CENTAVOS.
   ========================================================= */

function parseMoney(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;

    return Math.round(value * 100);
  }

  if (value === null || value === undefined) {
    return 0;
  }

  let text = String(value).trim();

  if (!text) return 0;

  text = text
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  /*
    Aceita:

    1770
    1770,50
    1.770,50
    1770.50
    1,770.50
  */

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {

    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "");
      text = text.replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }

  } else if (hasComma) {

    text = text.replace(",", ".");

  } else if (
    hasDot &&
    /^\d{1,3}(\.\d{3})+$/.test(text)
  ) {

    text = text.replace(/\./g, "");
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(number * 100);
}

function formatMoney(cents) {
  const value = Number(cents) || 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function formatInputMoney(cents) {
  const value = Number(cents) || 0;

  return (value / 100)
    .toFixed(2)
    .replace(".", ",");
}


/* =========================================================
   DATAS
   ========================================================= */

function getCycleKey(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const day = date.getDate();
  const cycleDay = Number(state?.settings?.cycleDay || 5);

  let cycleYear = year;
  let cycleMonth = month;

  if (day < cycleDay) {
    cycleMonth--;

    if (cycleMonth === 0) {
      cycleMonth = 12;
      cycleYear--;
    }
  }

  return (
    String(cycleYear) +
    "-" +
    String(cycleMonth).padStart(2, "0")
  );
}

function getPreviousCycleKey(cycleKey) {
  const [year, month] = cycleKey.split("-").map(Number);

  let y = year;
  let m = month - 1;

  if (m === 0) {
    m = 12;
    y--;
  }

  return (
    String(y) +
    "-" +
    String(m).padStart(2, "0")
  );
}

function formatCycleName(cycleKey) {
  if (!cycleKey) return "";

  const [year, month] = cycleKey.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function formatTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}


/* =========================================================
   CICLO
   ========================================================= */

function createCycle(key, options = {}) {
  const salary = Number.isInteger(options.salary)
    ? options.salary
    : Number(state.settings.salaryReference || 0);

  return {
    key,

    salary: {
      reference: salary,
      received: salary,
      adjusted: false
    },

    salarySplit: {
      enabled: Boolean(state.settings.salarySplit),
      firstPart: 0,
      secondPart: 0
    },

    extra: 0,

    categories: {},

    transactions: [],

    reserve: {
      balance: 0,
      movements: []
    },

    createdAt: nowISO()
  };
}

function ensureCycle(key) {
  if (!state.cycles[key]) {
    state.cycles[key] = createCycle(key);
  }

  return state.cycles[key];
}


/* =========================================================
   NORMALIZAÇÃO
   ========================================================= */

function normalizeState(raw) {

  const fresh = createInitialState();

  if (!raw || typeof raw !== "object") {
    return fresh;
  }

  const result = {
    ...fresh,
    ...raw
  };

  result.account = {
    ...fresh.account,
    ...(raw.account || {})
  };

  result.session = {
    ...fresh.session,
    ...(raw.session || {})
  };

  result.settings = {
    ...fresh.settings,
    ...(raw.settings || {})
  };

  result.cycles =
    raw.cycles &&
    typeof raw.cycles === "object"
      ? raw.cycles
      : {};

  result.categories =
    Array.isArray(raw.categories) &&
    raw.categories.length
      ? raw.categories
      : clone(DEFAULT_CATEGORIES);

  result.categories = result.categories.map(category => ({
    id: category.id || createId("cat"),
    name: String(category.name || "Categoria"),
    icon: category.icon || "📦",
    type: category.type || "expense",
    hasLimit:
      category.type === "reserve"
        ? false
        : Boolean(category.hasLimit),
    limit:
      category.type === "reserve"
        ? 0
        : Math.max(
            0,
            Number(category.limit) || 0
          )
  }));

  Object.keys(result.cycles).forEach(key => {
    const cycle = result.cycles[key];

    cycle.salary = {
      reference: Number(cycle.salary?.reference) || 0,
      received: Number(cycle.salary?.received) || 0,
      adjusted: Boolean(cycle.salary?.adjusted)
    };

    cycle.salarySplit = {
      enabled: Boolean(cycle.salarySplit?.enabled),
      firstPart: Number(cycle.salarySplit?.firstPart) || 0,
      secondPart: Number(cycle.salarySplit?.secondPart) || 0
    };

    cycle.extra = Number(cycle.extra) || 0;

    cycle.transactions =
      Array.isArray(cycle.transactions)
        ? cycle.transactions
        : [];

    cycle.reserve = {
      balance:
        Number(cycle.reserve?.balance) || 0,

      movements:
        Array.isArray(cycle.reserve?.movements)
          ? cycle.reserve.movements
          : []
    };

    cycle.categories =
      cycle.categories &&
      typeof cycle.categories === "object"
        ? cycle.categories
        : {};
  });

  return result;
}


/* =========================================================
   STORAGE
   ========================================================= */

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

    return true;

  } catch (error) {

    console.error(
      "FX: erro ao salvar estado",
      error
    );

    showToast(
      "Não foi possível salvar os dados."
    );

    return false;
  }
}

function loadState() {

  try {

    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      state = createInitialState();
      return;
    }

    state = normalizeState(
      JSON.parse(raw)
    );

  } catch (error) {

    console.error(
      "FX: erro ao carregar estado",
      error
    );

    state = createInitialState();

    showToast(
      "Os dados locais não puderam ser carregados."
    );
  }
}


/* =========================================================
   CATEGORIAS
   ========================================================= */

function getCategory(id) {
  return state.categories.find(
    category => category.id === id
  );
}

function isProtectedCategory(category) {
  return (
    category &&
    (
      category.type === "reserve" ||
      category.id === "cat-fixed" ||
      category.id === "cat-medicines" ||
      category.id === "cat-leisure" ||
      category.id === "cat-phone" ||
      category.id === "cat-other"
    )
  );
}

function ensureCategoryCycleData(cycle, category) {

  if (!cycle.categories[category.id]) {

    cycle.categories[category.id] = {
      spent: 0
    };
  }

  return cycle.categories[category.id];
}

function getCategorySpent(cycle, categoryId) {

  return cycle.transactions
    .filter(
      transaction =>
        transaction.type === "expense" &&
        transaction.categoryId === categoryId
    )
    .reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    );
}

function getCategoryRemaining(cycle, category) {

  if (!category.hasLimit) {
    return null;
  }

  const spent =
    getCategorySpent(
      cycle,
      category.id
    );

  return Math.max(
    0,
    Number(category.limit || 0) - spent
  );
}


/* =========================================================
   ORIGENS
   ========================================================= */

function getSalaryAvailable(cycle) {

  const spent =
    cycle.transactions
      .filter(
        transaction =>
          transaction.type === "expense" &&
          transaction.source === "salary"
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

  const saved =
    cycle.reserve.movements
      .filter(
        movement =>
          movement.type === "deposit" &&
          movement.source === "salary"
      )
      .reduce(
        (sum, movement) =>
          sum + Number(movement.amount || 0),
        0
      );

  return Math.max(
    0,
    Number(cycle.salary.received || 0)
      - spent
      - saved
  );
}

function getExtraAvailable(cycle) {

  const spent =
    cycle.transactions
      .filter(
        transaction =>
          transaction.type === "expense" &&
          transaction.source === "extra"
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

  const saved =
    cycle.reserve.movements
      .filter(
        movement =>
          movement.type === "deposit" &&
          movement.source === "extra"
      )
      .reduce(
        (sum, movement) =>
          sum + Number(movement.amount || 0),
        0
      );

  return Math.max(
    0,
    Number(cycle.extra || 0)
      - spent
      - saved
  );
}

function getReserveBalance(cycle) {

  return Math.max(
    0,
    cycle.reserve.movements.reduce(
      (sum, movement) => {

        if (movement.type === "deposit") {
          return (
            sum +
            Number(movement.amount || 0)
          );
        }

        if (movement.type === "withdrawal") {
          return (
            sum -
            Number(movement.amount || 0)
          );
        }

        return sum;
      },
      0
    )
  );
}

function getAvailable(cycle) {

  return (
    getSalaryAvailable(cycle) +
    getExtraAvailable(cycle)
  );
}


/* =========================================================
   SALÁRIO
   ========================================================= */

function setSalary(cycle, amount) {

  const value = Math.max(
    0,
    Number(amount) || 0
  );

  cycle.salary.received = value;
  cycle.salary.reference = value;
  cycle.salary.adjusted = true;

  state.settings.salaryReference = value;

  saveState();
}

function calculateSalarySplit(amount) {

  const total = Number(amount) || 0;

  const first =
    Math.round(total * 0.40);

  const second =
    total - first;

  return {
    firstPart: first,
    secondPart: second
  };
}

function updateSalarySplit(cycle) {

  if (!cycle.salarySplit.enabled) {

    cycle.salarySplit.firstPart = 0;
    cycle.salarySplit.secondPart =
      cycle.salary.received;

    return;
  }

  const split =
    calculateSalarySplit(
      cycle.salary.received
    );

  cycle.salarySplit.firstPart =
    split.firstPart;

  cycle.salarySplit.secondPart =
    split.secondPart;
}


/* =========================================================
   GASTOS
   ========================================================= */

function addExpense({
  categoryId,
  amount,
  source,
  description = ""
}) {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const category =
    getCategory(categoryId);

  const value =
    Number(amount) || 0;

  if (!category) {
    return {
      success: false,
      message: "Categoria inválida."
    };
  }

  if (value <= 0) {
    return {
      success: false,
      message: "Informe um valor maior que zero."
    };
  }

  if (
    source !== "salary" &&
    source !== "extra" &&
    source !== "reserve"
  ) {
    return {
      success: false,
      message: "Origem inválida."
    };
  }

  if (
    category.type === "reserve" &&
    source !== "reserve"
  ) {
    return {
      success: false,
      message: "A Reserva possui movimentação própria."
    };
  }

  if (source === "salary") {

    if (value > getSalaryAvailable(cycle)) {

      return {
        success: false,
        message: "Saldo de Salário insuficiente."
      };
    }
  }

  if (source === "extra") {

    if (value > getExtraAvailable(cycle)) {

      return {
        success: false,
        message: "Saldo de Extra insuficiente."
      };
    }
  }

  if (source === "reserve") {

    if (value > getReserveBalance(cycle)) {

      return {
        success: false,
        message: "Saldo da Reserva insuficiente."
      };
    }
  }

  if (category.hasLimit) {

    const remaining =
      getCategoryRemaining(
        cycle,
        category
      );

    if (value > remaining) {

      return {
        success: false,
        message:
          "Esse gasto ultrapassa o limite da categoria."
      };
    }
  }

  cycle.transactions.push({
    id: createId("expense"),

    type: "expense",

    categoryId: category.id,

    amount: value,

    source,

    description:
      String(description || "").trim(),

    date: nowISO()
  });

  saveState();

  renderMain();

  return {
    success: true
  };
}


/* =========================================================
   EXTRA
   ========================================================= */

function addExtra(amount, description = "") {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const value =
    Number(amount) || 0;

  if (value <= 0) {

    return {
      success: false,
      message: "Informe um valor maior que zero."
    };
  }

  cycle.extra += value;

  cycle.transactions.push({
    id: createId("extra"),

    type: "extra",

    amount: value,

    description:
      String(description || "").trim(),

    date: nowISO()
  });

  saveState();

  renderMain();

  return {
    success: true
  };
}


/* =========================================================
   RESERVA
   ========================================================= */

function depositReserve(source, amount) {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const value =
    Number(amount) || 0;

  if (
    source !== "salary" &&
    source !== "extra"
  ) {
    return {
      success: false,
      message: "Origem inválida."
    };
  }

  if (value <= 0) {

    return {
      success: false,
      message: "Informe um valor maior que zero."
    };
  }

  const available =
    source === "salary"
      ? getSalaryAvailable(cycle)
      : getExtraAvailable(cycle);

  if (value > available) {

    return {
      success: false,
      message:
        "Você não possui esse valor disponível."
    };
  }

  cycle.reserve.movements.push({

    id: createId("reserve"),

    type: "deposit",

    source,

    amount: value,

    date: nowISO()
  });

  saveState();

  renderMain();

  return {
    success: true
  };
}

function withdrawReserve(amount) {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const value =
    Number(amount) || 0;

  if (value <= 0) {

    return {
      success: false,
      message: "Informe um valor maior que zero."
    };
  }

  const balance =
    getReserveBalance(cycle);

  if (value > balance) {

    return {
      success: false,
      message:
        "O valor ultrapassa o saldo da Reserva."
    };
  }

  cycle.reserve.movements.push({

    id: createId("reserve"),

    type: "withdrawal",

    amount: value,

    date: nowISO()
  });

  /*
    Retirada da Reserva NÃO volta para Salário
    nem para Extra.

    Ela cria automaticamente um gasto em Outros.
  */

  cycle.transactions.push({

    id: createId("expense"),

    type: "expense",

    categoryId: "cat-other",

    amount: value,

    source: "reserve",

    description: "Retirada da reserva",

    date: nowISO()
  });

  saveState();

  renderMain();

  return {
    success: true
  };
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

  renderScreen();

  if (currentScreen === "main") {
    renderMain();
  }

  if (currentPanel === "settings") {
    renderSettings();
  }
}

function renderScreen() {

  const setup =
    document.getElementById(
      "screen-setup"
    );

  const lock =
    document.getElementById(
      "screen-lock"
    );

  const main =
    document.getElementById(
      "screen-main"
    );

  if (!setup || !lock || !main) {
    return;
  }

  setup.classList.add("hidden");
  lock.classList.add("hidden");
  main.classList.add("hidden");

  if (!state.account.configured) {

    setup.classList.remove("hidden");

    currentScreen = "setup";

    return;
  }

  if (state.session.locked) {

    lock.classList.remove("hidden");

    currentScreen = "lock";

    return;
  }

  main.classList.remove("hidden");

  currentScreen = "main";
}


/* =========================================================
   MAIN
   ========================================================= */

function renderMain() {

  const cycle =
    ensureCycle(state.currentCycleKey);

  updateSalarySplit(cycle);

  const balance =
    getAvailable(cycle);

  const salary =
    getSalaryAvailable(cycle);

  const extra =
    getExtraAvailable(cycle);

  const reserve =
    getReserveBalance(cycle);

  const balanceElement =
    document.getElementById(
      "main-balance"
    );

  const salaryElement =
    document.getElementById(
      "main-salary"
    );

  const extraElement =
    document.getElementById(
      "main-extra"
    );

  const reserveElement =
    document.getElementById(
      "main-reserve"
    );

  const cycleElement =
    document.getElementById(
      "main-cycle"
    );

  if (balanceElement) {
    balanceElement.textContent =
      formatMoney(balance);
  }

  if (salaryElement) {
    salaryElement.textContent =
      formatMoney(salary);
  }

  if (extraElement) {
    extraElement.textContent =
      formatMoney(extra);
  }

  if (reserveElement) {
    reserveElement.textContent =
      formatMoney(reserve);
  }

  if (cycleElement) {
    cycleElement.textContent =
      formatCycleName(
        state.currentCycleKey
      );
  }

  renderCategories();
  renderTransactions();

  saveState();
}


/* =========================================================
   CATEGORIAS NA HOME
   ========================================================= */

function renderCategories() {

  const container =
    document.getElementById(
      "categories-list"
    );

  if (!container) {
    return;
  }

  const cycle =
    ensureCycle(state.currentCycleKey);

  container.innerHTML =
    state.categories
      .map(category => {

        const remaining =
          getCategoryRemaining(
            cycle,
            category
          );

        const spent =
          getCategorySpent(
            cycle,
            category.id
          );

        let balanceText = "";

        if (category.type === "reserve") {

          balanceText =
            formatMoney(
              getReserveBalance(cycle)
            );

        } else if (category.hasLimit) {

          balanceText =
            formatMoney(remaining);

        } else {

          balanceText =
            "Sem limite";
        }

        let progress = 0;

        if (
          category.hasLimit &&
          category.limit > 0
        ) {

          progress =
            clamp(
              (spent / category.limit) * 100,
              0,
              100
            );
        }

        const limitReached =
          category.hasLimit &&
          remaining <= 0;

        return `
          <article
            class="category-card ${
              limitReached
                ? "limit-reached"
                : ""
            }"
            data-category-id="${escapeHtml(category.id)}"
          >

            <div class="category-icon">
              ${escapeHtml(category.icon)}
            </div>

            <button
              class="category-main"
              data-action="quick-expense"
              data-category-id="${escapeHtml(category.id)}"
            >
              <span class="category-name">
                ${escapeHtml(category.name)}
              </span>

              <span class="category-balance">
                ${escapeHtml(balanceText)}
              </span>
            </button>

            <button
              class="category-open-button"
              data-action="open-category"
              data-category-id="${escapeHtml(category.id)}"
              aria-label="Abrir categoria"
            >
              ›
            </button>

            ${
              category.hasLimit
                ? `
                  <div class="category-progress">
                    <div
                      class="category-progress-fill"
                      style="width:${progress}%"
                    ></div>
                  </div>
                `
                : ""
            }

          </article>
        `;
      })
      .join("");
}


/* =========================================================
   TRANSAÇÕES
   ========================================================= */

function renderTransactions() {

  const container =
    document.getElementById(
      "transactions-list"
    );

  if (!container) {
    return;
  }

  const cycle =
    ensureCycle(state.currentCycleKey);

  const transactions = [
    ...cycle.transactions
  ];

  cycle.reserve.movements.forEach(
    movement => {

      transactions.push({

        id: movement.id,

        type:
          movement.type === "deposit"
            ? "reserve-deposit"
            : "reserve-withdrawal",

        amount: movement.amount,

        source:
          movement.source || "reserve",

        date: movement.date,

        description:
          movement.type === "deposit"
            ? "Reserva"
            : "Retirada da reserva"
      });
    }
  );

  transactions.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );

  if (!transactions.length) {

    container.innerHTML = `
      <div class="transactions-empty">
        Nenhum lançamento neste ciclo.
      </div>
    `;

    return;
  }

  container.innerHTML =
    transactions
      .map(transaction => {

        let title = "";
        let icon = "💸";
        let valueClass = "negative";
        let valuePrefix = "-";

        if (
          transaction.type === "expense"
        ) {

          const category =
            getCategory(
              transaction.categoryId
            );

          title =
            category
              ? category.name
              : "Gasto";

          icon =
            category
              ? category.icon
              : "💸";

          if (
            transaction.source === "reserve"
          ) {
            title = "Retirada da reserva";
          }

        } else if (
          transaction.type === "extra"
        ) {

          title = "Extra";
          icon = "➕";

          valueClass = "positive";
          valuePrefix = "+";

        } else if (
          transaction.type ===
          "reserve-deposit"
        ) {

          title = "Reserva";
          icon = "🏦";

          valueClass = "reserve";
          valuePrefix = "-";

        } else if (
          transaction.type ===
          "reserve-withdrawal"
        ) {

          title = "Retirada da reserva";
          icon = "↩️";

          valueClass = "positive";
          valuePrefix = "+";
        }

        const description =
          transaction.description
            ? transaction.description
            : "";

        return `
          <div class="transaction-item">

            <div class="transaction-icon">
              ${escapeHtml(icon)}
            </div>

            <div class="transaction-info">

              <span class="transaction-title">
                ${escapeHtml(title)}
              </span>

              ${
                description
                  ? `
                    <span class="transaction-description">
                      ${escapeHtml(description)}
                    </span>
                  `
                  : ""
              }

              <span class="transaction-date">
                ${escapeHtml(formatDate(transaction.date))}
                ·
                ${escapeHtml(formatTime(transaction.date))}
              </span>

            </div>

            <div
              class="transaction-value ${valueClass}"
            >
              ${valuePrefix}
              ${escapeHtml(formatMoney(transaction.amount))}
            </div>

          </div>
        `;
      })
      .join("");
}


/* =========================================================
   MODAIS
   ========================================================= */

function closeModal() {

  const modal =
    document.getElementById(
      "modal-root"
    );

  if (modal) {
    modal.innerHTML = "";
  }

  currentModal = null;
}

function openModal(content) {

  const modal =
    document.getElementById(
      "modal-root"
    );

  if (!modal) {
    return;
  }

  modal.innerHTML = `
    <div class="modal">

      <div
        class="modal-backdrop"
        data-action="close-modal"
      ></div>

      ${content}

    </div>
  `;

  currentModal = true;
}

function openExpenseModal(categoryId) {

  const category =
    getCategory(categoryId);

  if (!category) return;

  const cycle =
    ensureCycle(state.currentCycleKey);

  if (
    category.hasLimit &&
    getCategoryRemaining(cycle, category) <= 0
  ) {

    showToast(
      "O limite desta categoria foi atingido."
    );

    return;
  }

  if (category.type === "reserve") {

    openReserveModal();

    return;
  }

  openModal(`

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          ${escapeHtml(category.name)}
        </h2>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      <form id="expense-form">

        <input
          type="hidden"
          name="categoryId"
          value="${escapeHtml(category.id)}"
        />

        <div>
          <label>
            Valor
          </label>

          <input
            name="amount"
            inputmode="decimal"
            autocomplete="off"
            placeholder="R$ 0,00"
            required
          />
        </div>

        <div>
          <label>
            Origem
          </label>

          <select
            name="source"
            required
          >
            <option value="salary">
              Salário — ${escapeHtml(
                formatMoney(
                  getSalaryAvailable(cycle)
                )
              )}
            </option>

            <option value="extra">
              Extra — ${escapeHtml(
                formatMoney(
                  getExtraAvailable(cycle)
                )
              )}
            </option>

            ${
              getReserveBalance(cycle) > 0
                ? `
                  <option value="reserve">
                    Reserva — ${escapeHtml(
                      formatMoney(
                        getReserveBalance(cycle)
                      )
                    )}
                  </option>
                `
                : ""
            }

          </select>
        </div>

        <div>
          <label>
            Descrição opcional
          </label>

          <input
            name="description"
            maxlength="120"
            placeholder="Ex.: Farmácia"
          />
        </div>

        <button
          type="submit"
          class="primary-button"
        >
          Lançar
        </button>

      </form>

    </div>

  `);
}

function openExtraModal() {

  openModal(`

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          Adicionar Extra
        </h2>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      <form id="extra-form">

        <div>

          <label>
            Valor
          </label>

          <input
            name="amount"
            inputmode="decimal"
            autocomplete="off"
            placeholder="R$ 0,00"
            required
          />

        </div>

        <div>

          <label>
            Descrição opcional
          </label>

          <input
            name="description"
            maxlength="120"
            placeholder="Ex.: Freelance"
          />

        </div>

        <button
          type="submit"
          class="primary-button"
        >
          Salvar
        </button>

      </form>

    </div>

  `);
}

function openReserveModal() {

  const cycle =
    ensureCycle(state.currentCycleKey);

  openModal(`

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          Reserva
        </h2>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      <div class="reserve-balance-modal">

        <span>
          Saldo acumulado
        </span>

        <strong>
          ${escapeHtml(
            formatMoney(
              getReserveBalance(cycle)
            )
          )}
        </strong>

      </div>

      <div class="reserve-actions">

        <button
          class="secondary-button"
          data-action="reserve-deposit"
        >
          Guardar
        </button>

        <button
          class="secondary-button"
          data-action="reserve-withdraw"
        >
          Retirar
        </button>

      </div>

      <div
        id="reserve-form-container"
        class="reserve-form-container"
      ></div>

    </div>

  `);
}

function renderReserveDepositForm() {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const container =
    document.getElementById(
      "reserve-form-container"
    );

  if (!container) return;

  container.innerHTML = `

    <form id="reserve-deposit-form">

      <div>

        <label>
          Origem
        </label>

        <select
          name="source"
          required
        >

          <option value="salary">
            Salário — ${escapeHtml(
              formatMoney(
                getSalaryAvailable(cycle)
              )
            )}
          </option>

          <option value="extra">
            Extra — ${escapeHtml(
              formatMoney(
                getExtraAvailable(cycle)
              )
            )}
          </option>

        </select>

      </div>

      <div>

        <label>
          Valor
        </label>

        <input
          name="amount"
          inputmode="decimal"
          autocomplete="off"
          placeholder="R$ 0,00"
          required
        />

      </div>

      <button
        type="submit"
        class="primary-button"
      >
        Guardar
      </button>

    </form>
  `;
}

function renderReserveWithdrawForm() {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const container =
    document.getElementById(
      "reserve-form-container"
    );

  if (!container) return;

  container.innerHTML = `

    <form id="reserve-withdraw-form">

      <div>

        <label>
          Valor
        </label>

        <input
          name="amount"
          inputmode="decimal"
          autocomplete="off"
          placeholder="R$ 0,00"
          required
        />

      </div>

      <button
        type="submit"
        class="primary-button"
      >
        Retirar
      </button>

    </form>
  `;
}


/* =========================================================
   CATEGORIA COMPLETA
   ========================================================= */

function openCategoryPanel(categoryId) {

  const category =
    getCategory(categoryId);

  if (!category) return;

  const cycle =
    ensureCycle(state.currentCycleKey);

  selectedCategoryId =
    category.id;

  const container =
    document.getElementById(
      "category-panel"
    );

  if (!container) return;

  const remaining =
    getCategoryRemaining(
      cycle,
      category
    );

  const transactions =
    cycle.transactions
      .filter(
        transaction =>
          transaction.type === "expense" &&
          transaction.categoryId === category.id
      )
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );

  container.classList.remove("hidden");

  container.innerHTML = `

    <div class="panel-header">

      <button
        class="back-button"
        data-action="close-category-panel"
      >
        ←
      </button>

      <h2>
        ${escapeHtml(category.name)}
      </h2>

      <div></div>

    </div>

    <div class="panel-content">

      <div class="category-detail-header">

        <div class="category-detail-icon">
          ${escapeHtml(category.icon)}
        </div>

        <div>

          <div class="category-detail-name">
            ${escapeHtml(category.name)}
          </div>

          <div class="category-detail-balance">

            ${
              category.hasLimit
                ? `Disponível: ${escapeHtml(
                    formatMoney(remaining)
                  )}`
                : "Sem limite"
            }

          </div>

        </div>

      </div>

      <br>

      <div class="content-section">

        <div class="section-header">

          <h2>
            Gastos
          </h2>

        </div>

        <div class="transactions-list">

          ${
            transactions.length
              ? transactions
                  .map(transaction => {

                    return `
                      <div
                        class="transaction-item"
                      >

                        <div
                          class="transaction-icon"
                        >
                          💸
                        </div>

                        <div
                          class="transaction-info"
                        >

                          <span
                            class="transaction-title"
                          >
                            ${
                              transaction.description
                                ? escapeHtml(
                                    transaction.description
                                  )
                                : escapeHtml(
                                    category.name
                                  )
                            }
                          </span>

                          <span
                            class="transaction-date"
                          >
                            ${escapeHtml(
                              formatDate(
                                transaction.date
                              )
                            )}
                          </span>

                        </div>

                        <div
                          class="transaction-value negative"
                        >
                          -${escapeHtml(
                            formatMoney(
                              transaction.amount
                            )
                          )}
                        </div>

                      </div>
                    `;

                  })
                  .join("")
              : `
                <div class="transactions-empty">
                  Nenhum gasto nesta categoria.
                </div>
              `
          }

        </div>

      </div>

    </div>
  `;

  currentPanel = "category";
}


/* =========================================================
   SETTINGS
   ========================================================= */

function openSettings() {

  const panel =
    document.getElementById(
      "settings-panel"
    );

  if (!panel) return;

  panel.classList.remove("hidden");

  currentPanel = "settings";

  renderSettings();
}

function closeSettings() {

  const panel =
    document.getElementById(
      "settings-panel"
    );

  if (panel) {
    panel.classList.add("hidden");
  }

  currentPanel = null;
}

function renderSettings() {

  const content =
    document.getElementById(
      "settings-content"
    );

  if (!content) return;

  const cycle =
    ensureCycle(state.currentCycleKey);

  const previous =
    state.cycles[
      getPreviousCycleKey(
        state.currentCycleKey
      )
    ];

  content.innerHTML = `

    <div class="settings-section">

      <button
        class="settings-item"
        data-action="toggle-settings-categories"
      >

        <span>
          Categorias
        </span>

        <span>
          ${state.categories.length}
        </span>

      </button>

      <div
        id="settings-categories"
        class="settings-content hidden"
      >

        <div class="settings-category-list">

          ${
            state.categories
              .map(category => `

                <div
                  class="settings-category-item"
                >

                  <div
                    class="settings-category-info"
                  >

                    <div
                      class="settings-category-icon"
                    >
                      ${escapeHtml(
                        category.icon
                      )}
                    </div>

                    <div>

                      <div
                        class="settings-category-name"
                      >
                        ${escapeHtml(
                          category.name
                        )}
                      </div>

                      <div
                        class="settings-category-limit"
                      >

                        ${
                          category.type ===
                          "reserve"
                            ? "Protegida"
                            : category.hasLimit
                              ? `Limite: ${escapeHtml(
                                  formatMoney(
                                    category.limit
                                  )
                                )}`
                              : "Sem limite"
                        }

                      </div>

                    </div>

                  </div>

                  <div
                    class="settings-category-actions"
                  >

                    <button
                      class="small-button"
                      data-action="edit-category"
                      data-category-id="${escapeHtml(
                        category.id
                      )}"
                    >
                      ✎
                    </button>

                    ${
                      isProtectedCategory(category)
                        ? ""
                        : `
                          <button
                            class="small-button"
                            data-action="delete-category"
                            data-category-id="${escapeHtml(
                              category.id
                            )}"
                          >
                            ×
                          </button>
                        `
                    }

                  </div>

                </div>

              `)
              .join("")
          }

        </div>

        <button
          class="secondary-button"
          data-action="new-category"
        >
          Criar categoria
        </button>

        <div
          id="category-edit-form"
          class="inline-form-container hidden"
        ></div>

      </div>

    </div>


    <div class="settings-section">

      <button
        class="settings-item"
        data-action="toggle-settings-salary"
      >

        <span>
          Salário
        </span>

        <span>
          ${escapeHtml(
            formatMoney(
              state.settings.salaryReference
            )
          )}
        </span>

      </button>

      <div
        id="settings-salary"
        class="settings-content hidden"
      >

        <div class="inline-form-container">

          <form id="salary-settings-form">

            <div>

              <label>
                Valor
              </label>

              <input
                name="salary"
                inputmode="decimal"
                value="${escapeHtml(
                  formatInputMoney(
                    state.settings.salaryReference
                  )
                )}"
                required
              />

            </div>

            <div>

              <label>
                Dividir
              </label>

              <select
                name="split"
              >

                <option
                  value="no"
                  ${
                    !state.settings.salarySplit
                      ? "selected"
                      : ""
                  }
                >
                  Não
                </option>

                <option
                  value="yes"
                  ${
                    state.settings.salarySplit
                      ? "selected"
                      : ""
                  }
                >
                  Sim
                </option>

              </select>

            </div>

            <div class="info-box">

              <strong>
                Salário dividido
              </strong>

              <p>
                40% no dia 20 e 60% no 5º dia útil.
              </p>

            </div>

            <button
              type="submit"
              class="primary-button"
            >
              Salvar
            </button>

          </form>

        </div>

      </div>

    </div>


    <div class="settings-section">

      <button
        class="settings-item"
        data-action="toggle-settings-cycle"
      >

        <span>
          Ciclo
        </span>

        <span>
          Dia ${escapeHtml(
            state.settings.cycleDay
          )}
        </span>

      </button>

      <div
        id="settings-cycle"
        class="settings-content hidden"
      >

        <div class="inline-form-container">

          <form id="cycle-settings-form">

            <div>

              <label>
                Dia de início
              </label>

              <input
                type="number"
                name="cycleDay"
                min="1"
                max="31"
                value="${escapeHtml(
                  state.settings.cycleDay
                )}"
                required
              />

            </div>

            <button
              type="submit"
              class="primary-button"
            >
              Salvar
            </button>

          </form>

        </div>

      </div>

    </div>


    <div class="settings-section">

      <button
        class="settings-item"
        data-action="open-previous-cycle"
        ${
          previous
            ? ""
            : "disabled"
        }
      >

        <span>
          Mês anterior
        </span>

        <span>
          ${
            previous
              ? escapeHtml(
                  formatCycleName(
                    getPreviousCycleKey(
                      state.currentCycleKey
                    )
                  )
                )
              : "Nenhum"
          }
        </span>

      </button>

    </div>


    <div class="settings-section">

      <button
        class="settings-item"
        data-action="open-pizza"
      >

        <span>
          Pizza
        </span>

        <span>
          ›
        </span>

      </button>

    </div>


    <div class="settings-section">

      <button
        class="settings-item"
        data-action="toggle-settings-security"
      >

        <span>
          Segurança
        </span>

        <span>
          ›
        </span>

      </button>

      <div
        id="settings-security"
        class="settings-content hidden"
      >

        <div
          class="inline-form-container"
        >

          <form id="password-form">

            <div>

              <label>
                Senha atual
              </label>

              <input
                type="password"
                name="currentPassword"
                required
              />

            </div>

            <div>

              <label>
                Nova senha
              </label>

              <input
                type="password"
                name="newPassword"
                required
              />

            </div>

            <button
              type="submit"
              class="primary-button"
            >
              Alterar senha
            </button>

          </form>

          <br>

          <button
            class="danger-button"
            data-action="delete-all-data"
          >
            Apagar todos os dados
          </button>

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   EDITAR / CRIAR CATEGORIA
   ========================================================= */

function renderCategoryForm(category = null) {

  const container =
    document.getElementById(
      "category-edit-form"
    );

  if (!container) return;

  container.classList.remove("hidden");

  const editing =
    Boolean(category);

  container.innerHTML = `

    <form id="category-form">

      <div>

        <label>
          Nome
        </label>

        <input
          name="name"
          maxlength="40"
          value="${
            category
              ? escapeHtml(category.name)
              : ""
          }"
          required
        />

      </div>

      <div>

        <label>
          Ícone
        </label>

        <input
          name="icon"
          maxlength="4"
          value="${
            category
              ? escapeHtml(category.icon)
              : "📦"
          }"
          required
        />

      </div>

      <div>

        <label>
          Limite
        </label>

        <select
          name="hasLimit"
        >

          <option
            value="no"
            ${
              category &&
              category.hasLimit
                ? ""
                : "selected"
            }
          >
            Não
          </option>

          <option
            value="yes"
            ${
              category &&
              category.hasLimit
                ? "selected"
                : ""
            }
          >
            Sim
          </option>

        </select>

      </div>

      <div>

        <label>
          Valor do limite
        </label>

        <input
          name="limit"
          inputmode="decimal"
          value="${
            category
              ? escapeHtml(
                  formatInputMoney(
                    category.limit
                  )
                )
              : ""
          }"
          placeholder="R$ 0,00"
        />

      </div>

      <button
        type="submit"
        class="primary-button"
      >
        ${editing ? "Salvar alterações" : "Criar categoria"}
      </button>

      <button
        type="button"
        class="secondary-button"
        data-action="cancel-category-form"
      >
        Cancelar
      </button>

    </form>
  `;
}


/* =========================================================
   EXCLUSÃO DE CATEGORIA
   ========================================================= */

function deleteCategory(categoryId) {

  const category =
    getCategory(categoryId);

  if (!category) return;

  if (isProtectedCategory(category)) {

    showToast(
      "Essa categoria não pode ser excluída."
    );

    return;
  }

  const confirmed =
    window.confirm(
      `Excluir a categoria "${category.name}"?\n\nOs gastos antigos continuarão no histórico.`
    );

  if (!confirmed) return;

  state.categories =
    state.categories.filter(
      item => item.id !== categoryId
    );

  saveState();

  renderSettings();
  renderMain();

  showToast(
    "Categoria excluída."
  );
}


/* =========================================================
   PIZZA
   ========================================================= */

function openPizza() {

  const cycle =
    ensureCycle(state.currentCycleKey);

  const values =
    state.categories
      .filter(
        category =>
          category.type !== "reserve"
      )
      .map(category => ({
        category,
        value:
          getCategorySpent(
            cycle,
            category.id
          )
      }))
      .filter(item => item.value > 0);

  const total =
    values.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

  let gradient = "transparent";

  if (total > 0) {

    let start = 0;

    const segments =
      values.map(item => {

        const percent =
          (item.value / total) * 100;

        const end =
          start + percent;

        const segment =
          `#${Math.floor(
            Math.random() * 0xffffff
          )
            .toString(16)
            .padStart(6, "0")} ${start}% ${end}%`;

        start = end;

        return segment;
      });

    gradient =
      `conic-gradient(${segments.join(",")})`;
  }

  openModal(`

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          Gastos
        </h2>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      ${
        total > 0
          ? `
            <div
              class="pizza-chart"
              style="background:${gradient}"
            ></div>
          `
          : `
            <div class="transactions-empty">
              Nenhum gasto neste ciclo.
            </div>
          `
      }

      <div class="pizza-legend">

        ${
          values
            .map(item => `

              <div
                class="pizza-legend-item"
              >

                <div
                  class="pizza-legend-left"
                >

                  <div
                    class="pizza-legend-icon"
                  >
                    ${escapeHtml(
                      item.category.icon
                    )}
                  </div>

                  <span>
                    ${escapeHtml(
                      item.category.name
                    )}
                  </span>

                </div>

                <strong>
                  ${escapeHtml(
                    formatMoney(item.value)
                  )}
                </strong>

              </div>

            `)
            .join("")
        }

      </div>

    </div>

  `);
}


/* =========================================================
   CICLO ANTERIOR
   ========================================================= */

function openPreviousCycle() {

  const key =
    getPreviousCycleKey(
      state.currentCycleKey
    );

  const cycle =
    state.cycles[key];

  if (!cycle) {

    showToast(
      "O ciclo anterior ainda não possui dados."
    );

    return;
  }

  openModal(`

    <div class="modal-box">

      <div class="modal-header">

        <h2>
          ${escapeHtml(
            formatCycleName(key)
          )}
        </h2>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      <span class="readonly-badge">
        Somente leitura
      </span>

      <div class="cycle-summary">

        <div>

          <span>
            Salário
          </span>

          <strong>
            ${escapeHtml(
              formatMoney(
                cycle.salary.received
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            Extra
          </span>

          <strong>
            ${escapeHtml(
              formatMoney(
                cycle.extra
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            Disponível
          </span>

          <strong>
            ${escapeHtml(
              formatMoney(
                getAvailable(cycle)
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            Reserva
          </span>

          <strong>
            ${escapeHtml(
              formatMoney(
                getReserveBalance(cycle)
              )
            )}
          </strong>

        </div>

      </div>

      <div class="content-section">

        <div class="section-header">

          <h2>
            Gastos
          </h2>

        </div>

        <div class="transactions-list">

          ${
            cycle.transactions
              .filter(
                transaction =>
                  transaction.type === "expense"
              )
              .sort(
                (a, b) =>
                  new Date(b.date) -
                  new Date(a.date)
              )
              .map(transaction => {

                const category =
                  getCategory(
                    transaction.categoryId
                  );

                return `

                  <div
                    class="transaction-item"
                  >

                    <div
                      class="transaction-icon"
                    >
                      ${
                        category
                          ? escapeHtml(
                              category.icon
                            )
                          : "💸"
                      }
                    </div>

                    <div
                      class="transaction-info"
                    >

                      <span
                        class="transaction-title"
                      >
                        ${
                          category
                            ? escapeHtml(
                                category.name
                              )
                            : "Gasto"
                        }
                      </span>

                      <span
                        class="transaction-date"
                      >
                        ${escapeHtml(
                          formatDate(
                            transaction.date
                          )
                        )}
                      </span>

                    </div>

                    <div
                      class="transaction-value negative"
                    >
                      -${escapeHtml(
                        formatMoney(
                          transaction.amount
                        )
                      )}
                    </div>

                  </div>
                `;
              })
              .join("")
          }

        </div>

      </div>

    </div>

  `);
}


/* =========================================================
   LOGIN / CONFIGURAÇÃO INICIAL
   ========================================================= */

function initializeSetup() {

  const form =
    document.getElementById(
      "setup-form"
    );

  if (!form) return;

  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      const data =
        new FormData(form);

      const username =
        String(
          data.get("username") || ""
        ).trim();

      const password =
        String(
          data.get("password") || ""
        );

      const salary =
        parseMoney(
          data.get("salary")
        );

      const split =
        data.get("split") === "yes";

      if (!username) {

        showToast(
          "Informe o usuário."
        );

        return;
      }

      if (!password) {

        showToast(
          "Informe uma senha."
        );

        return;
      }

      if (salary < 0) {

        showToast(
          "Salário inválido."
        );

        return;
      }

      state.account = {

        configured: true,

        username,

        password
      };

      state.settings.salaryReference =
        salary;

      state.settings.salarySplit =
        split;

      state.currentCycleKey =
        getCycleKey(
          new Date()
        );

      const cycle =
        ensureCycle(
          state.currentCycleKey
        );

      cycle.salary.reference =
        salary;

      cycle.salary.received =
        salary;

      cycle.salarySplit.enabled =
        split;

      updateSalarySplit(cycle);

      saveState();

      state.session.locked =
        false;

      render();

      showToast(
        "Configuração concluída."
      );
    }
  );
}


/* =========================================================
   DESBLOQUEAR
   ========================================================= */

function initializeUnlock() {

  const form =
    document.getElementById(
      "unlock-form"
    );

  if (!form) return;

  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      const data =
        new FormData(form);

      const password =
        String(
          data.get("password") || ""
        );

      if (
        password !==
        state.account.password
      ) {

        showToast(
          "Senha incorreta."
        );

        return;
      }

      state.session.locked =
        false;

      saveState();

      render();

      form.reset();
    }
  );
}


/* =========================================================
   EVENTOS
   ========================================================= */

function initializeEvents() {

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) return;

      const action =
        target.dataset.action;

      const categoryId =
        target.dataset.categoryId;

      switch (action) {

        case "lock":
          lockApp();
          break;

        case "open-settings":
          openSettings();
          break;

        case "close-settings":
          closeSettings();
          break;

        case "close-modal":
          closeModal();
          break;

        case "quick-expense":
          openExpenseModal(categoryId);
          break;

        case "open-category":
          openCategoryPanel(categoryId);
          break;

        case "close-category-panel": {

          const panel =
            document.getElementById(
              "category-panel"
            );

          if (panel) {
            panel.classList.add("hidden");
          }

          currentPanel = null;

          break;
        }

        case "add-extra":
          openExtraModal();
          break;

        case "open-reserve":
          openReserveModal();
          break;

        case "reserve-deposit":
          renderReserveDepositForm();
          break;

        case "reserve-withdraw":
          renderReserveWithdrawForm();
          break;

        case "toggle-settings-categories":
          toggleSettingsSection(
            "settings-categories"
          );
          break;

        case "toggle-settings-salary":
          toggleSettingsSection(
            "settings-salary"
          );
          break;

        case "toggle-settings-cycle":
          toggleSettingsSection(
            "settings-cycle"
          );
          break;

        case "toggle-settings-security":
          toggleSettingsSection(
            "settings-security"
          );
          break;

        case "new-category":
          renderCategoryForm();
          break;

        case "edit-category": {

          const category =
            getCategory(categoryId);

          if (category) {
            renderCategoryForm(category);
          }

          break;
        }

        case "delete-category":
          deleteCategory(categoryId);
          break;

        case "cancel-category-form": {

          const container =
            document.getElementById(
              "category-edit-form"
            );

          if (container) {

            container.classList.add(
              "hidden"
            );

            container.innerHTML = "";
          }

          break;
        }

        case "open-previous-cycle":
          openPreviousCycle();
          break;

        case "open-pizza":
          openPizza();
          break;

        case "delete-all-data":
          confirmDeleteAll();
          break;

        case "export-backup":
          exportBackup();
          break;
      }
    }
  );


  document.addEventListener(
    "submit",
    event => {

      if (
        event.target.id ===
        "expense-form"
      ) {

        event.preventDefault();

        handleExpenseSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "extra-form"
      ) {

        event.preventDefault();

        handleExtraSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "reserve-deposit-form"
      ) {

        event.preventDefault();

        handleReserveDepositSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "reserve-withdraw-form"
      ) {

        event.preventDefault();

        handleReserveWithdrawSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "category-form"
      ) {

        event.preventDefault();

        handleCategorySubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "salary-settings-form"
      ) {

        event.preventDefault();

        handleSalarySettingsSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "cycle-settings-form"
      ) {

        event.preventDefault();

        handleCycleSettingsSubmit(
          event.target
        );

        return;
      }

      if (
        event.target.id ===
        "password-form"
      ) {

        event.preventDefault();

        handlePasswordSubmit(
          event.target
        );

        return;
      }

    }
  );
}


/* =========================================================
   EVENT HANDLERS
   ========================================================= */

function handleExpenseSubmit(form) {

  const data =
    new FormData(form);

  const result =
    addExpense({

      categoryId:
        String(
          data.get("categoryId")
        ),

      amount:
        parseMoney(
          data.get("amount")
        ),

      source:
        String(
          data.get("source")
        ),

      description:
        String(
          data.get("description") || ""
        )
    });

  if (!result.success) {

    showToast(
      result.message
    );

    return;
  }

  closeModal();

  showToast(
    "Gasto lançado."
  );
}

function handleExtraSubmit(form) {

  const data =
    new FormData(form);

  const result =
    addExtra(
      parseMoney(
        data.get("amount")
      ),
      String(
        data.get("description") || ""
      )
    );

  if (!result.success) {

    showToast(
      result.message
    );

    return;
  }

  closeModal();

  showToast(
    "Extra adicionado."
  );
}

function handleReserveDepositSubmit(form) {

  const data =
    new FormData(form);

  const result =
    depositReserve(
      String(
        data.get("source")
      ),
      parseMoney(
        data.get("amount")
      )
    );

  if (!result.success) {

    showToast(
      result.message
    );

    return;
  }

  closeModal();

  showToast(
    "Dinheiro enviado para a Reserva."
  );
}

function handleReserveWithdrawSubmit(form) {

  const data =
    new FormData(form);

  const result =
    withdrawReserve(
      parseMoney(
        data.get("amount")
      )
    );

  if (!result.success) {

    showToast(
      result.message
    );

    return;
  }

  closeModal();

  showToast(
    "Retirada realizada."
  );
}

function handleCategorySubmit(form) {

  const data =
    new FormData(form);

  const name =
    String(
      data.get("name") || ""
    ).trim();

  const icon =
    String(
      data.get("icon") || "📦"
    ).trim();

  const hasLimit =
    data.get("hasLimit") === "yes";

  const limit =
    hasLimit
      ? parseMoney(
          data.get("limit")
        )
      : 0;

  if (!name) {

    showToast(
      "Informe o nome da categoria."
    );

    return;
  }

  const existingId =
    selectedSettingsCategoryId;

  if (existingId) {

    const category =
      getCategory(existingId);

    if (!category) return;

    category.name = name;
    category.icon = icon;

    if (category.type !== "reserve") {

      category.hasLimit =
        hasLimit;

      category.limit =
        limit;
    }

    selectedSettingsCategoryId =
      null;

    showToast(
      "Categoria atualizada."
    );

  } else {

    state.categories.push({

      id: createId("cat"),

      name,

      icon,

      type: "expense",

      hasLimit,

      limit
    });

    showToast(
      "Categoria criada."
    );
  }

  saveState();

  renderSettings();
  renderMain();
}

function handleSalarySettingsSubmit(form) {

  const data =
    new FormData(form);

  const salary =
    parseMoney(
      data.get("salary")
    );

  const split =
    data.get("split") === "yes";

  if (salary < 0) {

    showToast(
      "Salário inválido."
    );

    return;
  }

  state.settings.salaryReference =
    salary;

  state.settings.salarySplit =
    split;

  const cycle =
    ensureCycle(
      state.currentCycleKey
    );

  /*
    Alterar a referência não altera
    automaticamente o dinheiro já recebido
    no ciclo atual.
  */

  saveState();

  renderSettings();
  renderMain();

  showToast(
    "Configuração de salário salva."
  );
}

function handleCycleSettingsSubmit(form) {

  const data =
    new FormData(form);

  const day =
    Number(
      data.get("cycleDay")
    );

  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {

    showToast(
      "O dia deve estar entre 1 e 31."
    );

    return;
  }

  state.settings.cycleDay =
    day;

  saveState();

  renderSettings();

  showToast(
    "Ciclo atualizado para os próximos ciclos."
  );
}

function handlePasswordSubmit(form) {

  const data =
    new FormData(form);

  const currentPassword =
    String(
      data.get("currentPassword") || ""
    );

  const newPassword =
    String(
      data.get("newPassword") || ""
    );

  if (
    currentPassword !==
    state.account.password
  ) {

    showToast(
      "Senha atual incorreta."
    );

    return;
  }

  if (!newPassword) {

    showToast(
      "Informe a nova senha."
    );

    return;
  }

  state.account.password =
    newPassword;

  saveState();

  form.reset();

  showToast(
    "Senha alterada."
  );
}


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

function toggleSettingsSection(id) {

  const element =
    document.getElementById(id);

  if (!element) return;

  element.classList.toggle(
    "hidden"
  );
}


/* =========================================================
   BLOQUEIO
   ========================================================= */

function lockApp() {

  state.session.locked =
    true;

  saveState();

  closeModal();
  closeSettings();

  render();

  showToast(
    "FX bloqueado."
  );
}


/* =========================================================
   APAGAR TUDO
   ========================================================= */

function confirmDeleteAll() {

  const first =
    window.confirm(
      "Apagar TODOS os dados do FX?"
    );

  if (!first) return;

  const password =
    window.prompt(
      "Digite sua senha atual:"
    );

  if (
    password !==
    state.account.password
  ) {

    showToast(
      "Senha incorreta."
    );

    return;
  }

  const second =
    window.confirm(
      "Confirme novamente: todos os dados serão apagados."
    );

  if (!second) return;

  const third =
    window.prompt(
      "Digite a senha novamente para confirmar:"
    );

  if (
    third !==
    state.account.password
  ) {

    showToast(
      "Senha incorreta."
    );

    return;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );

  state =
    createInitialState();

  closeModal();
  closeSettings();

  render();

  showToast(
    "Todos os dados foram apagados."
  );
}


/* =========================================================
   BACKUP
   ========================================================= */

function exportBackup() {

  try {

    const backup = {
      app: APP_NAME,
      schemaVersion:
        state.schemaVersion,
      exportedAt:
        nowISO(),
      data:
        state
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            backup,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `fx-backup-${todayISO()}.json`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );

    showToast(
      "Backup exportado."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Não foi possível exportar o backup."
    );
  }
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

  let toast =
    document.getElementById(
      "toast"
    );

  if (!toast) {

    toast =
      document.createElement(
        "div"
      );

    toast.id = "toast";

    toast.className =
      "toast";

    document.body.appendChild(
      toast
    );
  }

  toast.textContent =
    String(message);

  toast.classList.remove(
    "hidden"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      2500
    );
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

function initialize() {

  loadState();

  state.currentCycleKey =
    getCycleKey(
      new Date()
    );

  if (
    state.account.configured
  ) {

    ensureCycle(
      state.currentCycleKey
    );

    const cycle =
      state.cycles[
        state.currentCycleKey
      ];

    updateSalarySplit(
      cycle
    );

    saveState();
  }

  initializeSetup();
  initializeUnlock();
  initializeEvents();

  render();
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

} else {

  initialize();
    }
