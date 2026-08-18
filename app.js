/* =========================================================
   FX — SEU DINHEIRO. SUAS REGRAS.
   APP.JS — BASE COMPLETA
========================================================= */

"use strict";

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const FX_VERSION = "1.0.0";
const STORAGE_KEY = "fx_state";
const SESSION_KEY = "fx_session";

const DEFAULT_CATEGORIES = [
  {
    id: "cat-fixed",
    name: "Gasto Fixo",
    icon: "🏠",
    type: "expense",
    hasLimit: true,
    limit: 60000,
    protected: true
  },
  {
    id: "cat-reserve",
    name: "Reserva",
    icon: "🏦",
    type: "reserve",
    hasLimit: false,
    limit: 0,
    protected: true
  },
  {
    id: "cat-medicine",
    name: "Medicamentos",
    icon: "💊",
    type: "expense",
    hasLimit: true,
    limit: 20000,
    protected: true
  },
  {
    id: "cat-leisure",
    name: "Lazer",
    icon: "🎮",
    type: "expense",
    hasLimit: true,
    limit: 20000,
    protected: true
  },
  {
    id: "cat-phone",
    name: "Celular",
    icon: "📱",
    type: "expense",
    hasLimit: true,
    limit: 3500,
    protected: true
  },
  {
    id: "cat-other",
    name: "Outros",
    icon: "📦",
    type: "other",
    hasLimit: false,
    limit: 0,
    protected: true
  }
];


/* =========================================================
   UTILITÁRIOS
========================================================= */

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
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function currentCycleKey() {
  const now = new Date();

  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  const cycleDay = Number(
    state?.settings?.cycleDay || 5
  );

  if (now.getDate() < cycleDay) {
    month--;

    if (month === 0) {
      month = 12;
      year--;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}


function formatDate(dateString) {
  if (!dateString) return "";

  const parts = dateString.split("-");

  if (parts.length !== 3) {
    return dateString;
  }

  return `${parts[2]}/${parts[1]}`;
}


function formatDateTime(dateString, timeString) {
  const date = formatDate(dateString);

  if (!timeString) {
    return date;
  }

  return `${date} — ${timeString}`;
}


function currentTime() {
  const date = new Date();

  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}


/* =========================================================
   DINHEIRO
   INTERNAMENTE: CENTAVOS
========================================================= */

function parseMoney(value) {

  if (typeof value === "number") {

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100);
  }

  if (value === null || value === undefined) {
    return 0;
  }

  let text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "");

  if (!text) {
    return 0;
  }

  /*
    Exemplos aceitos:

    1770
    1770,50
    1.770,50
    R$ 1.770,50
    10.50
  */

  if (text.includes(",")) {

    text = text.replace(/\./g, "");
    text = text.replace(",", ".");

  } else {

    /*
      Se não existe vírgula,
      ponto é tratado como decimal.
    */

    const parts = text.split(".");

    if (parts.length > 2) {
      text = text.replace(/\./g, "");
    }
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(number * 100);
}


function moneyToNumber(cents) {
  return cents / 100;
}


function formatMoney(cents) {

  const value = moneyToNumber(
    Number.isFinite(cents) ? cents : 0
  );

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}


function formatInputMoney(cents) {

  const value = moneyToNumber(
    Number.isFinite(cents) ? cents : 0
  );

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


/* =========================================================
   SEGURANÇA HTML
========================================================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   ESTADO
========================================================= */

function createDefaultState() {

  return {
    schemaVersion: 1,

    setupComplete: false,

    user: {
      name: "",
      password: ""
    },

    settings: {
      salaryReference: 0,

      salarySplit: false,

      cycleDay: 5,

      lastSalaryAdjustmentReminder: "",

      masterKeyEnabled: true
    },

    categories: DEFAULT_CATEGORIES.map(category => ({
      ...category
    })),

    cycles: {},

    currentCycle: currentCycleKey(),

    ui: {
      settingsOpen: null
    }
  };
}


let state = createDefaultState();


/* =========================================================
   CICLO
========================================================= */

function createCycle(key) {

  return {

    key,

    salary: 0,

    salaryReceived: false,

    extra: 0,

    categories: {},

    expenses: [],

    reserveTransactions: [],

    reserveBalanceAtStart: 0,

    reminderShown: false,

    createdAt: new Date().toISOString()
  };
}


function ensureCycle(key) {

  if (!state.cycles[key]) {
    state.cycles[key] = createCycle(key);
  }

  const cycle = state.cycles[key];

  if (!Array.isArray(cycle.expenses)) {
    cycle.expenses = [];
  }

  if (!Array.isArray(cycle.reserveTransactions)) {
    cycle.reserveTransactions = [];
  }

  if (!Number.isFinite(cycle.salary)) {
    cycle.salary = 0;
  }

  if (!Number.isFinite(cycle.extra)) {
    cycle.extra = 0;
  }

  if (!cycle.categories) {
    cycle.categories = {};
  }

  initializeCategoryLimits(cycle);

  return cycle;
}


function initializeCategoryLimits(cycle) {

  state.categories.forEach(category => {

    if (
      category.type === "reserve"
    ) {
      return;
    }

    if (
      category.hasLimit === false
    ) {
      return;
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        cycle.categories,
        category.id
      )
    ) {

      cycle.categories[category.id] = {
        limit: Number(category.limit) || 0
      };
    }
  });
}


/* =========================================================
   RESERVA
========================================================= */

function getReserveBalance() {

  let total = 0;

  Object.values(state.cycles).forEach(cycle => {

    if (!Array.isArray(cycle.reserveTransactions)) {
      return;
    }

    cycle.reserveTransactions.forEach(transaction => {

      if (transaction.type === "deposit") {
        total += Number(transaction.amount) || 0;
      }

      if (transaction.type === "withdraw") {
        total -= Number(transaction.amount) || 0;
      }

    });

  });

  return Math.max(0, total);
}


function getCycleReserveDeposits(cycle) {

  return cycle.reserveTransactions
    .filter(transaction =>
      transaction.type === "deposit"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount || 0),
      0
    );
}


function getCycleReserveWithdrawals(cycle) {

  return cycle.reserveTransactions
    .filter(transaction =>
      transaction.type === "withdraw"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount || 0),
      0
    );
}


/* =========================================================
   GASTOS
========================================================= */

function getCycleExpenses(cycle) {

  return cycle.expenses.reduce(
    (total, expense) =>
      total + Number(expense.amount || 0),
    0
  );
}


function getCategoryExpenses(cycle, categoryId) {

  return cycle.expenses
    .filter(expense =>
      expense.categoryId === categoryId
    )
    .reduce(
      (total, expense) =>
        total + Number(expense.amount || 0),
      0
    );
}


function getCategoryAvailable(cycle, category) {

  if (
    category.type === "reserve" ||
    category.hasLimit === false
  ) {
    return null;
  }

  const categoryData =
    cycle.categories[category.id];

  const limit =
    Number(categoryData?.limit ?? category.limit ?? 0);

  const spent =
    getCategoryExpenses(
      cycle,
      category.id
    );

  return Math.max(
    0,
    limit - spent
  );
}


/* =========================================================
   DINHEIRO DISPONÍVEL
========================================================= */

function getSalaryAvailable(cycle) {

  const salary = Number(cycle.salary) || 0;

  const salaryExpenses =
    cycle.expenses
      .filter(expense =>
        expense.source === "salary"
      )
      .reduce(
        (total, expense) =>
          total + Number(expense.amount || 0),
        0
      );

  const salaryDeposits =
    cycle.reserveTransactions
      .filter(transaction =>
        transaction.type === "deposit" &&
        transaction.source === "salary"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0
      );

  return Math.max(
    0,
    salary -
    salaryExpenses -
    salaryDeposits
  );
}


function getExtraAvailable(cycle) {

  const extra = Number(cycle.extra) || 0;

  const extraExpenses =
    cycle.expenses
      .filter(expense =>
        expense.source === "extra"
      )
      .reduce(
        (total, expense) =>
          total + Number(expense.amount || 0),
        0
      );

  const extraDeposits =
    cycle.reserveTransactions
      .filter(transaction =>
        transaction.type === "deposit" &&
        transaction.source === "extra"
      )
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0
      );

  return Math.max(
    0,
    extra -
    extraExpenses -
    extraDeposits
  );
}


function getAvailable(cycle) {

  const salary =
    getSalaryAvailable(cycle);

  const extra =
    getExtraAvailable(cycle);

  return salary + extra;
}


/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizeState(raw) {

  const base = createDefaultState();

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const normalized = {
    ...base,
    ...raw
  };

  normalized.user = {
    ...base.user,
    ...(raw.user || {})
  };

  normalized.settings = {
    ...base.settings,
    ...(raw.settings || {})
  };

  normalized.ui = {
    ...base.ui,
    ...(raw.ui || {})
  };

  if (
    !Array.isArray(raw.categories) ||
    raw.categories.length === 0
  ) {

    normalized.categories =
      base.categories.map(category => ({
        ...category
      }));

  } else {

    normalized.categories =
      raw.categories.map(category => ({
        id: category.id || createId("cat"),
        name: String(category.name || "Sem nome"),
        icon: String(category.icon || "📦"),
        type: category.type || "expense",
        hasLimit:
          category.type === "reserve"
            ? false
            : category.hasLimit !== false,
        limit:
          Number(category.limit) || 0,
        protected:
          category.protected === true
      }));

  }

  if (
    !normalized.categories.some(
      category => category.type === "reserve"
    )
  ) {

    normalized.categories.splice(
      1,
      0,
      {
        ...DEFAULT_CATEGORIES[1]
      }
    );
  }

  if (
    !normalized.categories.some(
      category => category.type === "other"
    )
  ) {

    normalized.categories.push({
      ...DEFAULT_CATEGORIES[5]
    });
  }

  if (!raw.cycles || typeof raw.cycles !== "object") {
    normalized.cycles = {};
  }

  Object.keys(normalized.cycles)
    .forEach(key => {

      const cycle =
        normalized.cycles[key];

      if (!cycle || typeof cycle !== "object") {
        normalized.cycles[key] =
          createCycle(key);
        return;
      }

      cycle.key = key;

      if (!Array.isArray(cycle.expenses)) {
        cycle.expenses = [];
      }

      if (!Array.isArray(cycle.reserveTransactions)) {
        cycle.reserveTransactions = [];
      }

      if (!cycle.categories) {
        cycle.categories = {};
      }

      cycle.salary =
        Number(cycle.salary) || 0;

      cycle.extra =
        Number(cycle.extra) || 0;

      initializeCategoryLimits(cycle);

    });

  normalized.currentCycle =
    raw.currentCycle ||
    currentCycleKey();

  return normalized;
}


/* =========================================================
   LOCAL STORAGE
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
      "FX: erro ao salvar dados",
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
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      state = createDefaultState();
      return;
    }

    state =
      normalizeState(
        JSON.parse(raw)
      );

  } catch (error) {

    console.error(
      "FX: erro ao carregar dados",
      error
    );

    state =
      createDefaultState();

    showToast(
      "Os dados estavam inválidos. Um estado inicial foi carregado."
    );
  }
}


/* =========================================================
   SESSÃO
========================================================= */

function isLoggedIn() {

  return (
    localStorage.getItem(
      SESSION_KEY
    ) === "unlocked"
  );
}


function setLoggedIn(value) {

  if (value) {

    localStorage.setItem(
      SESSION_KEY,
      "unlocked"
    );

  } else {

    localStorage.removeItem(
      SESSION_KEY
    );

  }
}


/* =========================================================
   CATEGORIAS
========================================================= */

function getCategory(categoryId) {

  return state.categories.find(
    category =>
      category.id === categoryId
  );
}


function getReserveCategory() {

  return state.categories.find(
    category =>
      category.type === "reserve"
  );
}


function getOtherCategory() {

  return state.categories.find(
    category =>
      category.type === "other"
  );
}


function createCategory({
  name,
  icon,
  hasLimit,
  limit
}) {

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    showToast(
      "Digite o nome da categoria."
    );

    return false;
  }

  const category = {

    id: createId("cat"),

    name: cleanName,

    icon:
      String(icon || "📦")
        .trim() || "📦",

    type: "expense",

    hasLimit:
      hasLimit === true,

    limit:
      hasLimit
        ? Math.max(0, Number(limit) || 0)
        : 0,

    protected: false

  };

  state.categories.push(
    category
  );

  Object.values(state.cycles)
    .forEach(cycle => {

      initializeCategoryLimits(
        cycle
      );

      if (category.hasLimit) {

        cycle.categories[
          category.id
        ] = {
          limit: category.limit
        };

      }

    });

  saveState();

  renderAll();

  showToast(
    "Categoria criada."
  );

  return true;
}


function updateCategory(
  categoryId,
  changes
) {

  const category =
    getCategory(categoryId);

  if (!category) {
    return false;
  }

  if (
    typeof changes.name === "string"
  ) {

    const name =
      changes.name.trim();

    if (name) {
      category.name = name;
    }
  }

  if (
    typeof changes.icon === "string"
  ) {

    category.icon =
      changes.icon.trim() || "📦";
  }

  if (
    category.type !== "reserve" &&
    typeof changes.hasLimit === "boolean"
  ) {

    category.hasLimit =
      changes.hasLimit;

    category.limit =
      changes.hasLimit
        ? Math.max(
            0,
            Number(changes.limit) || 0
          )
        : 0;

  } else if (
    category.type !== "reserve" &&
    changes.limit !== undefined
  ) {

    category.limit =
      Math.max(
        0,
        Number(changes.limit) || 0
      );
  }

  /*
    Alteração de limite vale para
    os próximos ciclos.

    O ciclo atual mantém o limite
    que já foi iniciado.
  */

  saveState();

  renderAll();

  return true;
}


function deleteCategory(categoryId) {

  const category =
    getCategory(categoryId);

  if (!category) {
    return false;
  }

  if (category.protected) {

    showToast(
      "Essa categoria não pode ser excluída."
    );

    return false;
  }

  const used =
    Object.values(state.cycles)
      .some(cycle =>
        cycle.expenses.some(
          expense =>
            expense.categoryId ===
            categoryId
        )
      );

  if (used) {

    showToast(
      "A categoria possui gastos antigos e não pode ser excluída."
    );

    return false;
  }

  state.categories =
    state.categories.filter(
      item =>
        item.id !== categoryId
    );

  Object.values(state.cycles)
    .forEach(cycle => {

      delete cycle.categories[
        categoryId
      ];

    });

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   LANÇAR GASTO
========================================================= */

function addExpense({
  categoryId,
  amount,
  source,
  description
}) {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const category =
    getCategory(categoryId);

  if (!category) {

    showToast(
      "Categoria inválida."
    );

    return false;
  }

  const value =
    parseMoney(amount);

  if (value <= 0) {

    showToast(
      "Digite um valor maior que zero."
    );

    return false;
  }

  if (
    source !== "salary" &&
    source !== "extra" &&
    source !== "reserve"
  ) {

    showToast(
      "Origem inválida."
    );

    return false;
  }

  /*
    Reserva → Outros
  */

  if (source === "reserve") {

    if (
      category.type !== "other"
    ) {

      showToast(
        "Dinheiro da Reserva só pode sair para Outros."
      );

      return false;
    }

    if (
      value > getReserveBalance()
    ) {

      showToast(
        "A Reserva não possui dinheiro suficiente."
      );

      return false;
    }

  }

  /*
    Salário
  */

  if (
    source === "salary" &&
    value >
      getSalaryAvailable(cycle)
  ) {

    showToast(
      "Saldo do Salário insuficiente."
    );

    return false;
  }

  /*
    Extra
  */

  if (
    source === "extra" &&
    value >
      getExtraAvailable(cycle)
  ) {

    showToast(
      "Saldo do Extra insuficiente."
    );

    return false;
  }

  /*
    Limite da categoria.
    Reserva e Outros não possuem limite.
  */

  if (
    source !== "reserve" &&
    category.type !== "reserve" &&
    category.hasLimit
  ) {

    const available =
      getCategoryAvailable(
        cycle,
        category
      );

    if (
      available !== null &&
      value > available
    ) {

      showToast(
        "O limite dessa categoria foi atingido."
      );

      return false;
    }
  }

  const now =
    new Date();

  cycle.expenses.push({

    id: createId("expense"),

    categoryId,

    amount: value,

    source,

    description:
      String(description || "")
        .trim(),

    date:
      todayISO(),

    time:
      currentTime(),

    createdAt:
      now.toISOString()

  });

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   EXTRA
========================================================= */

function addExtra({
  amount,
  description
}) {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const value =
    parseMoney(amount);

  if (value <= 0) {

    showToast(
      "Digite um valor maior que zero."
    );

    return false;
  }

  cycle.extra += value;

  /*
    O Extra recebido é acumulado.
    A descrição fica registrada
    no histórico interno do ciclo.
  */

  if (!Array.isArray(cycle.extraEntries)) {
    cycle.extraEntries = [];
  }

  cycle.extraEntries.push({

    id: createId("extra"),

    amount: value,

    description:
      String(description || "")
        .trim(),

    date:
      todayISO(),

    time:
      currentTime(),

    createdAt:
      new Date().toISOString()

  });

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   RESERVA — GUARDAR
========================================================= */

function depositReserve({
  amount,
  source
}) {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const value =
    parseMoney(amount);

  if (value <= 0) {

    showToast(
      "Digite um valor maior que zero."
    );

    return false;
  }

  if (
    source !== "salary" &&
    source !== "extra"
  ) {

    showToast(
      "Origem inválida."
    );

    return false;
  }

  const available =
    source === "salary"
      ? getSalaryAvailable(cycle)
      : getExtraAvailable(cycle);

  if (value > available) {

    showToast(
      "Não existe dinheiro suficiente nessa origem."
    );

    return false;
  }

  cycle.reserveTransactions.push({

    id: createId("reserve"),

    type: "deposit",

    amount: value,

    source,

    date:
      todayISO(),

    time:
      currentTime(),

    createdAt:
      new Date().toISOString()

  });

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   RESERVA — RETIRAR
========================================================= */

function withdrawReserve({
  amount
}) {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const value =
    parseMoney(amount);

  if (value <= 0) {

    showToast(
      "Digite um valor maior que zero."
    );

    return false;
  }

  const reserve =
    getReserveBalance();

  if (value > reserve) {

    showToast(
      "A Reserva não possui dinheiro suficiente."
    );

    return false;
  }

  /*
    Retirada da Reserva:

    - diminui Reserva
    - cria automaticamente
      um gasto em Outros
    - NÃO volta para Salário
    - NÃO volta para Extra
  */

  cycle.reserveTransactions.push({

    id: createId("reserve"),

    type: "withdraw",

    amount: value,

    source: "reserve",

    date:
      todayISO(),

    time:
      currentTime(),

    createdAt:
      new Date().toISOString()

  });

  const other =
    getOtherCategory();

  if (other) {

    cycle.expenses.push({

      id: createId("expense"),

      categoryId:
        other.id,

      amount: value,

      source: "reserve",

      description:
        "Retirada da reserva",

      date:
        todayISO(),

      time:
        currentTime(),

      createdAt:
        new Date().toISOString()

    });

  }

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   SALÁRIO
========================================================= */

function setSalaryReference(
  amount
) {

  const value =
    parseMoney(amount);

  if (value < 0) {

    showToast(
      "O salário não pode ser negativo."
    );

    return false;
  }

  state.settings.salaryReference =
    value;

  saveState();

  return true;
}


function setCycleSalary(
  cycleKey,
  amount
) {

  const cycle =
    ensureCycle(cycleKey);

  const value =
    parseMoney(amount);

  if (value < 0) {

    showToast(
      "O salário não pode ser negativo."
    );

    return false;
  }

  cycle.salary = value;

  cycle.salaryReceived =
    true;

  /*
    Quando o salário recebido é ajustado,
    ele vira a referência dos próximos ciclos.
  */

  state.settings.salaryReference =
    value;

  saveState();

  renderAll();

  return true;
}


/* =========================================================
   SALÁRIO DIVIDIDO
========================================================= */

function getSalaryParts(
  salary
) {

  const value =
    Number(salary) || 0;

  const first =
    Math.floor(
      value * 0.40
    );

  const second =
    value - first;

  return {
    first,
    second
  };
}


/* =========================================================
   NOVO CICLO
========================================================= */

function checkCycle() {

  const realCycle =
    currentCycleKey();

  if (
    state.currentCycle !== realCycle
  ) {

    state.currentCycle =
      realCycle;

    const cycle =
      ensureCycle(
        realCycle
      );

    /*
      Salário entra automaticamente.
    */

    if (
      cycle.salary === 0 &&
      state.settings.salaryReference > 0
    ) {

      cycle.salary =
        state.settings.salaryReference;

    }

    saveState();

    showCycleSummaryIfNeeded();

  } else {

    ensureCycle(
      state.currentCycle
    );
  }
}


/* =========================================================
   HISTÓRICO
========================================================= */

function getHistory(
  cycle
) {

  const items = [];

  cycle.expenses.forEach(expense => {

    const category =
      getCategory(
        expense.categoryId
      );

    items.push({

      id: expense.id,

      type: "expense",

      icon:
        category?.icon || "📦",

      title:
        category?.name || "Categoria removida",

      description:
        expense.description || "",

      date:
        expense.date,

      time:
        expense.time,

      amount:
        -Number(expense.amount || 0),

      source:
        expense.source

    });

  });


  if (Array.isArray(cycle.extraEntries)) {

    cycle.extraEntries.forEach(extra => {

      items.push({

        id: extra.id,

        type: "extra",

        icon: "➕",

        title: "Extra",

        description:
          extra.description || "",

        date:
          extra.date,

        time:
          extra.time,

        amount:
          Number(extra.amount || 0),

        source: "extra"

      });

    });

  }


  cycle.reserveTransactions.forEach(
    transaction => {

      if (
        transaction.type === "deposit"
      ) {

        items.push({

          id:
            transaction.id,

          type:
            "reserve-deposit",

          icon:
            "🏦",

          title:
            "Reserva",

          description:
            "Aporte",

          date:
            transaction.date,

          time:
            transaction.time,

          amount:
            Number(
              transaction.amount || 0
            ),

          source:
            transaction.source

        });

      }

      if (
        transaction.type === "withdraw"
      ) {

        items.push({

          id:
            transaction.id,

          type:
            "reserve-withdraw",

          icon:
            "🏦",

          title:
            "Reserva",

          description:
            "Retirada",

          date:
            transaction.date,

          time:
            transaction.time,

          amount:
            -Number(
              transaction.amount || 0
            ),

          source:
            "reserve"

        });

      }

    }
  );


  return items.sort(
    (a, b) => {

      const dateA =
        `${a.date} ${a.time || ""}`;

      const dateB =
        `${b.date} ${b.time || ""}`;

      return dateB.localeCompare(
        dateA
      );

    }
  );
}


/* =========================================================
   RENDER PRINCIPAL
========================================================= */

function renderAll() {

  ensureMainElements();

  renderBalance();

  renderCategories();

  renderExpenses();

  renderSettings();

  renderReserve();

  renderNavigation();

}


/* =========================================================
   GARANTIR ELEMENTOS
========================================================= */

function ensureMainElements() {

  const app =
    document.getElementById("app");

  if (!app) {
    return;
  }

}


/* =========================================================
   RENDER SALDO
========================================================= */

function renderBalance() {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const balance =
    getAvailable(cycle);

  const salary =
    getSalaryAvailable(cycle);

  const extra =
    getExtraAvailable(cycle);

  const balanceEl =
    document.getElementById(
      "balance-value"
    );

  if (balanceEl) {
    balanceEl.textContent =
      formatMoney(balance);
  }

  const salaryEl =
    document.getElementById(
      "salary-balance"
    );

  if (salaryEl) {
    salaryEl.textContent =
      formatMoney(salary);
  }

  const extraEl =
    document.getElementById(
      "extra-balance"
    );

  if (extraEl) {
    extraEl.textContent =
      formatMoney(extra);
  }

  const cycleEl =
    document.getElementById(
      "cycle-period"
    );

  if (cycleEl) {

    cycleEl.textContent =
      formatCycleLabel(
        state.currentCycle
      );

  }
}


/* =========================================================
   LABEL DO CICLO
========================================================= */

function formatCycleLabel(key) {

  if (!key) {
    return "";
  }

  const [
    year,
    month
  ] = key.split("-");

  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );

  return date.toLocaleDateString(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  );
}


/* =========================================================
   RENDER CATEGORIAS
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
    ensureCycle(
      state.currentCycle
    );

  container.innerHTML = "";

  state.categories.forEach(
    category => {

      if (
        category.type === "reserve"
      ) {

        const reserveBalance =
          getReserveBalance();

        const button =
          createElement(
            "button"
          );

        button.className =
          "category-card";

        button.innerHTML = `

          <span class="category-icon">
            ${escapeHtml(category.icon)}
          </span>

          <span class="category-info">

            <span class="category-name">
              ${escapeHtml(category.name)}
            </span>

            <span class="category-balance">
              ${formatMoney(reserveBalance)}
            </span>

          </span>

          <span
            class="category-open"
            title="Abrir Reserva"
          >
            ›
          </span>
        `;

        button.addEventListener(
          "click",
          event => {

            if (
              event.target.closest(
                ".category-open"
              )
            ) {

              openReserveModal();

              return;
            }

            openReserveModal();

          }
        );

        container.appendChild(
          button
        );

        return;
      }


      const available =
        getCategoryAvailable(
          cycle,
          category
        );

      const spent =
        getCategoryExpenses(
          cycle,
          category.id
        );

      const limit =
        category.hasLimit
          ? Number(
              cycle.categories[
                category.id
              ]?.limit ??
              category.limit ??
              0
            )
          : 0;

      const percent =
        limit > 0
          ? Math.min(
              100,
              (spent / limit) * 100
            )
          : 0;

      const button =
        createElement(
          "button"
        );

      button.className =
        "category-card";

      if (
        category.hasLimit &&
        available <= 0
      ) {

        button.classList.add(
          "locked"
        );
      }

      button.innerHTML = `

        <span class="category-icon">
          ${escapeHtml(category.icon)}
        </span>

        <span class="category-info">

          <span class="category-name">
            ${escapeHtml(category.name)}
          </span>

          <span class="category-balance">
            ${
              category.hasLimit
                ? formatMoney(available)
                : "Sem limite"
            }
          </span>

          ${
            category.hasLimit
              ? `
                <span class="category-bar-container">
                  <span
                    class="category-bar ${
                      percent >= 100
                        ? "over"
                        : ""
                    }"
                    style="width:${percent}%"
                  ></span>
                </span>
              `
              : ""
          }

        </span>

        <span
          class="category-open"
          title="Abrir categoria"
        >
          ›
        </span>

      `;

      button.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              ".category-open"
            )
          ) {

            openCategoryView(
              category.id
            );

            return;
          }

          openExpenseModal(
            category.id
          );

        }
      );

      container.appendChild(
        button
      );

    }
  );
}


/* =========================================================
   RENDER GASTOS
========================================================= */

function renderExpenses() {

  const container =
    document.getElementById(
      "expenses-list"
    );

  if (!container) {
    return;
  }

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const expenses =
    [...cycle.expenses]
      .sort(
        (a, b) =>
          `${b.date} ${b.time || ""}`
          .localeCompare(
            `${a.date} ${a.time || ""}`
          )
      );

  container.innerHTML = "";

  if (!expenses.length) {

    container.innerHTML = `
      <div class="empty-state">
        Nenhum gasto neste ciclo.
      </div>
    `;

    return;
  }

  expenses.forEach(
    expense => {

      const category =
        getCategory(
          expense.categoryId
        );

      const row =
        createElement(
          "div"
        );

      row.className =
        "expense-row";

      const sourceLabel =
        expense.source === "salary"
          ? "Salário"
          : expense.source === "extra"
            ? "Extra"
            : "Reserva";

      row.innerHTML = `

        <span class="category-icon">
          ${escapeHtml(
            category?.icon || "📦"
          )}
        </span>

        <span class="expense-main">

          <span class="expense-title">
            ${escapeHtml(
              category?.name ||
              "Categoria removida"
            )}
          </span>

          <span class="expense-meta">
            ${formatDate(expense.date)}
            · ${escapeHtml(sourceLabel)}
            · ${escapeHtml(expense.time || "")}
          </span>

        </span>

        <span class="expense-value">
          −${formatMoney(expense.amount)}
        </span>

      `;

      container.appendChild(
        row
      );

    }
  );
}


/* =========================================================
   RESERVA
========================================================= */

function renderReserve() {

  const elements =
    document.querySelectorAll(
      "[data-reserve-balance]"
    );

  const balance =
    getReserveBalance();

  elements.forEach(
    element => {

      element.textContent =
        formatMoney(balance);

    }
  );
}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function renderNavigation() {

  const main =
    document.getElementById(
      "screen-main"
    );

  const settings =
    document.getElementById(
      "screen-settings"
    );

  const buttons =
    document.querySelectorAll(
      "[data-screen]"
    );

  buttons.forEach(
    button => {

      button.classList.remove(
        "active"
      );

    }
  );

  if (
    settings &&
    !settings.classList.contains(
      "hidden"
    )
  ) {

    const button =
      document.querySelector(
        '[data-screen="settings"]'
      );

    button?.classList.add(
      "active"
    );

  } else {

    const button =
      document.querySelector(
        '[data-screen="main"]'
      );

    button?.classList.add(
      "active"
    );

  }
}


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

function renderSettings() {

  const salaryInput =
    document.getElementById(
      "settings-salary"
    );

  if (salaryInput) {

    salaryInput.value =
      formatInputMoney(
        state.settings.salaryReference
      );

  }

  const cycleInput =
    document.getElementById(
      "settings-cycle-day"
    );

  if (cycleInput) {

    cycleInput.value =
      state.settings.cycleDay;

  }

  const split =
    document.getElementById(
      "settings-salary-split"
    );

  if (split) {

    split.checked =
      state.settings.salarySplit;

  }

  renderSettingsCategories();
}


function renderSettingsCategories() {

  const container =
    document.getElementById(
      "settings-category-list"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  state.categories.forEach(
    category => {

      const row =
        createElement(
          "div"
        );

      row.className =
        "settings-category";

      row.innerHTML = `

        <span class="settings-category-icon">
          ${escapeHtml(category.icon)}
        </span>

        <span class="settings-category-info">

          <span class="settings-category-name">
            ${escapeHtml(category.name)}
          </span>

          <span class="settings-category-limit">
            ${
              category.type === "reserve"
                ? "Sem limite"
                : category.hasLimit
                  ? `Limite: ${formatMoney(category.limit)}`
                  : "Sem limite"
            }
          </span>

        </span>

        <button
          type="button"
          class="settings-category-edit"
          data-edit-category="${escapeHtml(category.id)}"
        >
          ✎
        </button>

      `;

      container.appendChild(
        row
      );

    }
  );
}


/* =========================================================
   ELEMENTO
========================================================= */

function createElement(tag) {

  return document.createElement(
    tag
  );
}


/* =========================================================
   MODAL BASE
========================================================= */

function openModal(content) {

  closeModal();

  const root =
    document.createElement(
      "div"
    );

  root.id =
    "fx-modal-root";

  root.className =
    "modal-root";

  root.innerHTML = `

    <div class="modal">

      ${content}

    </div>

  `;

  root.addEventListener(
    "click",
    event => {

      if (
        event.target === root
      ) {

        closeModal();

      }

    }
  );

  document.body.appendChild(
    root
  );

  return root;
}


function closeModal() {

  document
    .getElementById(
      "fx-modal-root"
    )
    ?.remove();

}


/* =========================================================
   MODAL DE GASTO
========================================================= */

function openExpenseModal(
  categoryId
) {

  const category =
    getCategory(categoryId);

  if (!category) {
    return;
  }

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  if (
    category.hasLimit &&
    getCategoryAvailable(
      cycle,
      category
    ) <= 0
  ) {

    showToast(
      "Essa categoria atingiu o limite."
    );

    return;
  }

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          ${escapeHtml(category.icon)}
          ${escapeHtml(category.name)}
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Valor
      </label>

      <input
        id="expense-value"
        inputmode="decimal"
        autocomplete="off"
        placeholder="R$ 0,00"
      >

      <label>
        Origem
      </label>

      <div class="choice-group">

        <label class="choice">

          <input
            type="radio"
            name="expense-source"
            value="salary"
            checked
          >

          <span>
            Salário
          </span>

        </label>

        <label class="choice">

          <input
            type="radio"
            name="expense-source"
            value="extra"
          >

          <span>
            Extra
          </span>

        </label>

        ${
          category.type === "other"
            ? `
              <label class="choice">

                <input
                  type="radio"
                  name="expense-source"
                  value="reserve"
                >

                <span>
                  Reserva
                </span>

              </label>
            `
            : ""
        }

      </div>

      <label>
        Descrição opcional
      </label>

      <input
        id="expense-description"
        placeholder="Ex.: mercado"
        maxlength="100"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-expense"
        >
          Lançar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        closeModal
      );

    });

  root
    .querySelector(
      "#confirm-expense"
    )
    .addEventListener(
      "click",
      () => {

        const amount =
          root.querySelector(
            "#expense-value"
          ).value;

        const source =
          root.querySelector(
            'input[name="expense-source"]:checked'
          )?.value;

        const description =
          root.querySelector(
            "#expense-description"
          ).value;

        if (
          addExpense({
            categoryId,
            amount,
            source,
            description
          })
        ) {

          closeModal();

          showToast(
            "Gasto lançado."
          );

        }

      }
    );

}


/* =========================================================
   MODAL EXTRA
========================================================= */

function openExtraModal() {

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          ➕ Extra
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Valor
      </label>

      <input
        id="extra-value"
        inputmode="decimal"
        autocomplete="off"
        placeholder="R$ 0,00"
      >

      <label>
        Descrição opcional
      </label>

      <input
        id="extra-description"
        maxlength="100"
        placeholder="Ex.: freelance"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-extra"
        >
          Salvar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-extra"
    )
    .addEventListener(
      "click",
      () => {

        const result =
          addExtra({

            amount:
              root.querySelector(
                "#extra-value"
              ).value,

            description:
              root.querySelector(
                "#extra-description"
              ).value

          });

        if (result) {

          closeModal();

          showToast(
            "Extra adicionado."
          );

        }

      }
    );
}


/* =========================================================
   MODAL RESERVA
========================================================= */

function openReserveModal() {

  const reserve =
    getReserveBalance();

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          🏦 Reserva
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <div class="info-box">

        <strong>
          Saldo da Reserva
        </strong>

        ${formatMoney(reserve)}

      </div>

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="open-deposit"
        >
          Guardar dinheiro
        </button>

        <button
          type="button"
          class="secondary-button"
          id="open-withdraw"
        >
          Retirar dinheiro
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#open-deposit"
    )
    .addEventListener(
      "click",
      openDepositModal
    );

  root
    .querySelector(
      "#open-withdraw"
    )
    .addEventListener(
      "click",
      openWithdrawModal
    );
}


/* =========================================================
   GUARDAR NA RESERVA
========================================================= */

function openDepositModal() {

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Guardar na Reserva
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Origem
      </label>

      <div class="choice-group">

        <label class="choice">

          <input
            type="radio"
            name="deposit-source"
            value="salary"
            checked
          >

          <span>
            Salário
          </span>

        </label>

        <label class="choice">

          <input
            type="radio"
            name="deposit-source"
            value="extra"
          >

          <span>
            Extra
          </span>

        </label>

      </div>

      <label>
        Valor
      </label>

      <input
        id="deposit-value"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-deposit"
        >
          Guardar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-deposit"
    )
    .addEventListener(
      "click",
      () => {

        const amount =
          root.querySelector(
            "#deposit-value"
          ).value;

        const source =
          root.querySelector(
            'input[name="deposit-source"]:checked'
          ).value;

        if (
          depositReserve({
            amount,
            source
          })
        ) {

          closeModal();

          showToast(
            "Dinheiro guardado na Reserva."
          );

        }

      }
    );
}


/* =========================================================
   RETIRAR DA RESERVA
========================================================= */

function openWithdrawModal() {

  const reserve =
    getReserveBalance();

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Retirar da Reserva
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <div class="info-box">

        Saldo disponível:
        <strong>
          ${formatMoney(reserve)}
        </strong>

      </div>

      <label>
        Valor
      </label>

      <input
        id="withdraw-value"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-withdraw"
        >
          Retirar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-withdraw"
    )
    .addEventListener(
      "click",
      () => {

        const amount =
          root.querySelector(
            "#withdraw-value"
          ).value;

        if (
          withdrawReserve({
            amount
          })
        ) {

          closeModal();

          showToast(
            "Retirada realizada."
          );

        }

      }
    );
}


/* =========================================================
   VISUALIZAÇÃO DE CATEGORIA
========================================================= */

function openCategoryView(
  categoryId
) {

  const category =
    getCategory(categoryId);

  if (!category) {
    return;
  }

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const expenses =
    cycle.expenses
      .filter(
        expense =>
          expense.categoryId ===
          categoryId
      )
      .sort(
        (a, b) =>
          `${b.date} ${b.time || ""}`
          .localeCompare(
            `${a.date} ${a.time || ""}`
          )
      );

  const available =
    getCategoryAvailable(
      cycle,
      category
    );

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          ${escapeHtml(category.icon)}
          ${escapeHtml(category.name)}
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <div class="info-box">

        <strong>
          ${
            category.hasLimit
              ? "Disponível"
              : "Sem limite"
          }
        </strong>

        ${
          category.hasLimit
            ? formatMoney(available)
            : "Esta categoria não possui limite."
        }

      </div>

      ${
        expenses.length
          ? `
            <div class="expenses-list">

              ${expenses
                .map(
                  expense => `

                    <div class="expense-row">

                      <span class="expense-main">

                        <span class="expense-title">
                          ${escapeHtml(
                            expense.description ||
                            category.name
                          )}
                        </span>

                        <span class="expense-meta">
                          ${formatDate(
                            expense.date
                          )}
                        </span>

                      </span>

                      <span class="expense-value">
                        −${formatMoney(
                          expense.amount
                        )}
                      </span>

                    </div>

                  `
                )
                .join("")}

            </div>
          `
          : `
            <div class="empty-state">
              Nenhum gasto nesta categoria.
            </div>
          `
      }

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="category-add-expense"
        >
          Lançar gasto
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Fechar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#category-add-expense"
    )
    .addEventListener(
      "click",
      () => {

        closeModal();

        openExpenseModal(
          categoryId
        );

      }
    );
}


/* =========================================================
   CONFIGURAÇÃO DE CATEGORIA
========================================================= */

function openEditCategory(
  categoryId
) {

  const category =
    getCategory(categoryId);

  if (!category) {
    return;
  }

  const isReserve =
    category.type === "reserve";

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Editar categoria
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Nome
      </label>

      <input
        id="edit-category-name"
        value="${escapeHtml(category.name)}"
        maxlength="40"
      >

      <label>
        Ícone
      </label>

      <input
        id="edit-category-icon"
        value="${escapeHtml(category.icon)}"
        maxlength="4"
      >

      ${
        !isReserve
          ? `
            <label>
              Limite
            </label>

            <div class="choice-group">

              <label class="choice">

                <input
                  type="radio"
                  name="edit-category-limit"
                  value="yes"
                  ${
                    category.hasLimit
                      ? "checked"
                      : ""
                  }
                >

                <span>
                  Sim
                </span>

              </label>

              <label class="choice">

                <input
                  type="radio"
                  name="edit-category-limit"
                  value="no"
                  ${
                    !category.hasLimit
                      ? "checked"
                      : ""
                  }
                >

                <span>
                  Não
                </span>

              </label>

            </div>

            <label>
              Valor do limite
            </label>

            <input
              id="edit-category-limit-value"
              inputmode="decimal"
              value="${formatInputMoney(category.limit)}"
            >
          `
          : `
            <div class="info-box">
              A Reserva não possui limite.
            </div>
          `
      }

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="save-category-edit"
        >
          Salvar
        </button>

        ${
          !category.protected
            ? `
              <button
                type="button"
                class="danger-button"
                id="delete-category"
              >
                Excluir categoria
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#save-category-edit"
    )
    .addEventListener(
      "click",
      () => {

        const name =
          root.querySelector(
            "#edit-category-name"
          ).value;

        const icon =
          root.querySelector(
            "#edit-category-icon"
          ).value;

        let hasLimit =
          category.hasLimit;

        let limit =
          category.limit;

        if (!isReserve) {

          const selected =
            root.querySelector(
              'input[name="edit-category-limit"]:checked'
            );

          hasLimit =
            selected?.value === "yes";

          limit =
            parseMoney(
              root.querySelector(
                "#edit-category-limit-value"
              ).value
            );

        }

        updateCategory(
          categoryId,
          {
            name,
            icon,
            hasLimit,
            limit
          }
        );

        closeModal();

        showToast(
          "Categoria atualizada."
        );

      }
    );


  root
    .querySelector(
      "#delete-category"
    )
    ?.addEventListener(
      "click",
      () => {

        const confirmed =
          window.confirm(
            "Excluir esta categoria? Gastos antigos não serão apagados."
          );

        if (!confirmed) {
          return;
        }

        if (
          deleteCategory(
            categoryId
          )
        ) {

          closeModal();

          showToast(
            "Categoria excluída."
          );

        }

      }
    );
}


/* =========================================================
   CRIAR CATEGORIA
========================================================= */

function openCreateCategory() {

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Criar categoria
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Nome
      </label>

      <input
        id="new-category-name"
        maxlength="40"
        placeholder="Ex.: Alimentação"
      >

      <label>
        Ícone
      </label>

      <input
        id="new-category-icon"
        maxlength="4"
        placeholder="🍔"
      >

      <label>
        Limite
      </label>

      <div class="choice-group">

        <label class="choice">

          <input
            type="radio"
            name="new-category-limit"
            value="yes"
            checked
          >

          <span>
            Sim
          </span>

        </label>

        <label class="choice">

          <input
            type="radio"
            name="new-category-limit"
            value="no"
          >

          <span>
            Não
          </span>

        </label>

      </div>

      <label>
        Valor do limite
      </label>

      <input
        id="new-category-limit-value"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-new-category"
        >
          Salvar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-new-category"
    )
    .addEventListener(
      "click",
      () => {

        const name =
          root.querySelector(
            "#new-category-name"
          ).value;

        const icon =
          root.querySelector(
            "#new-category-icon"
          ).value;

        const hasLimit =
          root.querySelector(
            'input[name="new-category-limit"]:checked'
          )?.value === "yes";

        const limit =
          parseMoney(
            root.querySelector(
              "#new-category-limit-value"
            ).value
          );

        if (
          createCategory({
            name,
            icon,
            hasLimit,
            limit
          })
        ) {

          closeModal();

        }

      }
    );
}


/* =========================================================
   HISTÓRICO COMPLETO
========================================================= */

function openHistory() {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const history =
    getHistory(cycle);

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Histórico
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      ${
        history.length
          ? `
            <div class="expenses-list">

              ${history
                .map(
                  item => `

                    <div class="expense-row">

                      <span class="category-icon">
                        ${escapeHtml(item.icon)}
                      </span>

                      <span class="expense-main">

                        <span class="expense-title">
                          ${escapeHtml(item.title)}
                        </span>

                        <span class="expense-meta">
                          ${formatDate(item.date)}
                          ·
                          ${escapeHtml(item.time || "")}
                          ${
                            item.description
                              ? ` · ${escapeHtml(item.description)}`
                              : ""
                          }
                        </span>

                      </span>

                      <span
                        class="expense-value"
                        style="
                          color:${
                            item.amount >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                          };
                        "
                      >
                        ${
                          item.amount >= 0
                            ? "+"
                            : "−"
                        }${formatMoney(
                          Math.abs(item.amount)
                        )}
                      </span>

                    </div>

                  `
                )
                .join("")}

            </div>
          `
          : `
            <div class="empty-state">
              Nenhum lançamento neste ciclo.
            </div>
          `
      }

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );
}


/* =========================================================
   MÊS ANTERIOR
========================================================= */

function getPreviousCycleKey() {

  const [
    year,
    month
  ] =
    state.currentCycle.split("-")
      .map(Number);

  let y = year;
  let m = month - 1;

  if (m === 0) {
    m = 12;
    y--;
  }

  return (
    `${y}-${String(m).padStart(2, "0")}`
  );
}


function openPreviousCycle() {

  const key =
    getPreviousCycleKey();

  const cycle =
    state.cycles[key];

  if (!cycle) {

    showToast(
      "O ciclo anterior ainda não possui dados."
    );

    return;
  }

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Ciclo anterior
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <div class="info-box">

        <strong>
          ${escapeHtml(
            formatCycleLabel(key)
          )}
        </strong>

        Salário:
        ${formatMoney(cycle.salary)}

        <br>

        Extra:
        ${formatMoney(cycle.extra)}

        <br>

        Reserva atual:
        ${formatMoney(getReserveBalance())}

      </div>

      <div class="expenses-list">

        ${
          cycle.expenses.length
            ? cycle.expenses
                .map(expense => {

                  const category =
                    getCategory(
                      expense.categoryId
                    );

                  return `

                    <div class="expense-row">

                      <span class="category-icon">
                        ${escapeHtml(
                          category?.icon || "📦"
                        )}
                      </span>

                      <span class="expense-main">

                        <span class="expense-title">
                          ${escapeHtml(
                            category?.name ||
                            "Categoria removida"
                          )}
                        </span>

                        <span class="expense-meta">
                          ${formatDate(
                            expense.date
                          )}
                        </span>

                      </span>

                      <span class="expense-value">
                        −${formatMoney(
                          expense.amount
                        )}
                      </span>

                    </div>

                  `;

                })
                .join("")
            : `
              <div class="empty-state">
                Nenhum gasto neste ciclo.
              </div>
            `
        }

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );
}


/* =========================================================
   PIZZA
========================================================= */

function openPizza() {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const categories =
    state.categories
      .filter(
        category =>
          category.type !== "reserve"
      )
      .map(
        category => ({
          category,
          value:
            getCategoryExpenses(
              cycle,
              category.id
            )
        })
      )
      .filter(
        item =>
          item.value > 0
      );

  const total =
    categories.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Gastos
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      ${
        total === 0
          ? `
            <div class="empty-state">
              Nenhum gasto para mostrar.
            </div>
          `
          : `
            <div
              style="
                width:220px;
                height:220px;
                margin:10px auto 24px;
                border-radius:50%;
                background:${createPieGradient(categories, total)};
              "
            ></div>

            <div class="expenses-list">

              ${categories
                .map(
                  item => `

                    <div class="expense-row">

                      <span class="category-icon">
                        ${escapeHtml(
                          item.category.icon
                        )}
                      </span>

                      <span class="expense-main">

                        <span class="expense-title">
                          ${escapeHtml(
                            item.category.name
                          )}
                        </span>

                      </span>

                      <span class="expense-value">
                        ${formatMoney(
                          item.value
                        )}
                      </span>

                    </div>

                  `
                )
                .join("")}

            </div>
          `
      }

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );
}


function createPieGradient(
  items,
  total
) {

  const steps = [];

  let current = 0;

  const colors = [
    "#ffffff",
    "#8f96a3",
    "#626977",
    "#444a55",
    "#303640",
    "#1f242d",
    "#737b89",
    "#b7bdc7"
  ];

  items.forEach(
    (item, index) => {

      const percentage =
        (
          item.value /
          total
        ) * 100;

      const start =
        current;

      const end =
        current + percentage;

      steps.push(
        `${colors[index % colors.length]} ${start}% ${end}%`
      );

      current = end;

    }
  );

  return `
    conic-gradient(
      ${steps.join(",")}
    )
  `;
}


/* =========================================================
   BLOQUEIO
========================================================= */

function lockApp() {

  setLoggedIn(false);

  showScreen(
    "login"
  );
}


function unlockApp(
  password
) {

  if (
    password !==
    state.user.password
  ) {

    showToast(
      "Senha incorreta."
    );

    return false;
  }

  setLoggedIn(true);

  showScreen(
    "main"
  );

  renderAll();

  return true;
}


/* =========================================================
   ALTERAR SENHA
========================================================= */

function changePassword(
  currentPassword,
  newPassword
) {

  if (
    currentPassword !==
    state.user.password
  ) {

    showToast(
      "Senha atual incorreta."
    );

    return false;
  }

  if (
    !newPassword ||
    newPassword.length < 4
  ) {

    showToast(
      "A nova senha precisa ter pelo menos 4 caracteres."
    );

    return false;
  }

  state.user.password =
    newPassword;

  saveState();

  showToast(
    "Senha alterada."
  );

  return true;
}


/* =========================================================
   APAGAR TODOS OS DADOS
========================================================= */

function resetAllData(
  password,
  confirmation
) {

  if (
    password !==
    state.user.password
  ) {

    showToast(
      "Senha incorreta."
    );

    return false;
  }

  if (
    confirmation !== "APAGAR"
  ) {

    showToast(
      'Digite APAGAR para confirmar.'
    );

    return false;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );

  localStorage.removeItem(
    SESSION_KEY
  );

  state =
    createDefaultState();

  showScreen(
    "setup"
  );

  showToast(
    "Todos os dados foram apagados."
  );

  return true;
}


/* =========================================================
   BACKUP
========================================================= */

function exportBackup() {

  const backup = {

    fx: "FX",

    version:
      FX_VERSION,

    exportedAt:
      new Date().toISOString(),

    state:
      state

  };

  const json =
    JSON.stringify(
      backup,
      null,
      2
    );

  const blob =
    new Blob(
      [json],
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
}


/* =========================================================
   IMPORTAÇÃO DE BACKUP
========================================================= */

function importBackupFile(
  file
) {

  if (!file) {
    return;
  }

  const reader =
    new FileReader();

  reader.onload =
    event => {

      try {

        const backup =
          JSON.parse(
            event.target.result
          );

        const importedState =
          backup?.state ||
          backup;

        const normalized =
          normalizeState(
            importedState
          );

        const confirmed =
          window.confirm(
            "Importar este backup substituirá os dados atuais. Continuar?"
          );

        if (!confirmed) {
          return;
        }

        state =
          normalized;

        saveState();

        setLoggedIn(
          false
        );

        showScreen(
          "login"
        );

        showToast(
          "Backup importado."
        );

      } catch (error) {

        console.error(
          error
        );

        showToast(
          "Arquivo de backup inválido."
        );

      }

    };

  reader.readAsText(
    file
  );
}


/* =========================================================
   TELA
========================================================= */

function showScreen(
  name
) {

  document
    .querySelectorAll(
      ".screen"
    )
    .forEach(
      screen =>
        screen.classList.add(
          "hidden"
        )
    );

  const screen =
    document.getElementById(
      `screen-${name}`
    );

  if (screen) {

    screen.classList.remove(
      "hidden"
    );

  }
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(
  message
) {

  let toast =
    document.getElementById(
      "fx-toast"
    );

  if (!toast) {

    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "fx-toast";

    toast.className =
      "toast";

    document.body.appendChild(
      toast
    );

  }

  toast.textContent =
    message;

  toast.classList.remove(
    "hidden"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {

        toast.remove();

      },
      2600
    );
}


/* =========================================================
   RESUMO DO NOVO CICLO
========================================================= */

function showCycleSummaryIfNeeded() {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  if (
    cycle.reminderShown
  ) {
    return;
  }

  const available =
    getAvailable(cycle);

  if (
    available <= 0 &&
    state.settings.salaryReference <= 0
  ) {
    return;
  }

  cycle.reminderShown =
    true;

  saveState();

  setTimeout(
    () => {

      openCycleSummary();

    },
    400
  );
}


function openCycleSummary() {

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  const salary =
    getSalaryAvailable(cycle);

  const extra =
    getExtraAvailable(cycle);

  const total =
    salary + extra;

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Novo ciclo
        </h2>

      </div>

      <div class="info-box">

        <strong>
          Dinheiro disponível
        </strong>

        Salário:
        ${formatMoney(salary)}

        <br>

        Extra:
        ${formatMoney(extra)}

        <br><br>

        Total:
        ${formatMoney(total)}

      </div>

      ${
        total > 0
          ? `
            <p class="modal-description">
              Você pode escolher quanto deseja guardar na Reserva.
            </p>

            <label>
              Valor para Reserva
            </label>

            <input
              id="cycle-reserve-value"
              inputmode="decimal"
              placeholder="R$ 0,00"
            >
          `
          : ""
      }

      <div class="modal-actions">

        ${
          total > 0
            ? `
              <button
                type="button"
                class="primary-button"
                id="cycle-save-reserve"
              >
                Guardar na Reserva
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Continuar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#cycle-save-reserve"
    )
    ?.addEventListener(
      "click",
      () => {

        const amount =
          parseMoney(
            root.querySelector(
              "#cycle-reserve-value"
            ).value
          );

        if (amount <= 0) {

          showToast(
            "Digite um valor."
          );

          return;
        }

        /*
          Primeiro usa Salário.
          Se acabar, não completa
          automaticamente com Extra.
        */

        if (
          amount <=
          getSalaryAvailable(cycle)
        ) {

          depositReserve({
            amount,
            source: "salary"
          });

          closeModal();

          return;

        }

        if (
          amount <=
          getExtraAvailable(cycle)
        ) {

          depositReserve({
            amount,
            source: "extra"
          });

          closeModal();

          return;

        }

        showToast(
          "O valor escolhido não existe em uma única origem."
        );

      }
    );
}


/* =========================================================
   EVENTOS
========================================================= */

function setupEvents() {

  document.addEventListener(
    "click",
    event => {

      const screenButton =
        event.target.closest(
          "[data-screen]"
        );

      if (
        screenButton
      ) {

        const screen =
          screenButton.dataset.screen;

        showScreen(
          screen
        );

        renderNavigation();

        return;
      }


      if (
        event.target.closest(
          "[data-lock]"
        )
      ) {

        lockApp();

        return;
      }


      if (
        event.target.closest(
          "[data-extra]"
        )
      ) {

        openExtraModal();

        return;
      }


      if (
        event.target.closest(
          "[data-history]"
        )
      ) {

        openHistory();

        return;
      }


      if (
        event.target.closest(
          "[data-pizza]"
        )
      ) {

        openPizza();

        return;
      }


      if (
        event.target.closest(
          "[data-previous-cycle]"
        )
      ) {

        openPreviousCycle();

        return;
      }


      if (
        event.target.closest(
          "[data-create-category]"
        )
      ) {

        openCreateCategory();

        return;
      }


      const editButton =
        event.target.closest(
          "[data-edit-category]"
        );

      if (
        editButton
      ) {

        openEditCategory(
          editButton.dataset.editCategory
        );

        return;
      }


      if (
        event.target.closest(
          "[data-export-backup]"
        )
      ) {

        exportBackup();

        return;
      }


      if (
        event.target.closest(
          "[data-import-backup]"
        )
      ) {

        document
          .getElementById(
            "backup-import-input"
          )
          ?.click();

        return;
      }

    }
  );


  document
    .getElementById(
      "backup-import-input"
    )
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        importBackupFile(
          file
        );

        event.target.value =
          "";

      }
    );


  document
    .getElementById(
      "extra-button"
    )
    ?.addEventListener(
      "click",
      openExtraModal
    );


  document
    .getElementById(
      "lock-button"
    )
    ?.addEventListener(
      "click",
      lockApp
    );


  document
    .getElementById(
      "history-button"
    )
    ?.addEventListener(
      "click",
      openHistory
    );


  document
    .getElementById(
      "pizza-button"
    )
    ?.addEventListener(
      "click",
      openPizza
    );


  document
    .getElementById(
      "previous-cycle-button"
    )
    ?.addEventListener(
      "click",
      openPreviousCycle
    );


  document
    .getElementById(
      "create-category-button"
    )
    ?.addEventListener(
      "click",
      openCreateCategory
    );


  document
    .getElementById(
      "export-backup-button"
    )
    ?.addEventListener(
      "click",
      exportBackup
    );


  document
    .getElementById(
      "import-backup-button"
    )
    ?.addEventListener(
      "click",
      () =>
        document
          .getElementById(
            "backup-import-input"
          )
          ?.click()
    );


  /*
    Configuração do salário
  */

  document
    .getElementById(
      "save-salary-button"
    )
    ?.addEventListener(
      "click",
      () => {

        const value =
          document
            .getElementById(
              "settings-salary"
            )
            ?.value;

        const split =
          document
            .getElementById(
              "settings-salary-split"
            )
            ?.checked;

        state.settings.salarySplit =
          Boolean(split);

        if (
          setSalaryReference(
            value
          )
        ) {

          showToast(
            "Salário salvo."
          );

          renderAll();

        }

      }
    );


  /*
    Ciclo
  */

  document
    .getElementById(
      "save-cycle-button"
    )
    ?.addEventListener(
      "click",
      () => {

        const input =
          document
            .getElementById(
              "settings-cycle-day"
            );

        const day =
          Number(input?.value);

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

        showToast(
          "Ciclo salvo. A alteração vale para o próximo ciclo."
        );

      }
    );


  /*
    Bloqueio / login
  */

  document
    .getElementById(
      "login-form"
    )
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        const password =
          document
            .getElementById(
              "login-password"
            )
            ?.value;

        unlockApp(
          password
        );

      }
    );


  /*
    Primeiro acesso
  */

  document
    .getElementById(
      "setup-form"
    )
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        completeSetup();

      }
    );


  /*
    Alteração de senha
  */

  document
    .getElementById(
      "change-password-button"
    )
    ?.addEventListener(
      "click",
      openChangePasswordModal
    );


  /*
    Apagar tudo
  */

  document
    .getElementById(
      "delete-all-button"
    )
    ?.addEventListener(
      "click",
      openDeleteAllModal
    );

}


/* =========================================================
   PRIMEIRO ACESSO
========================================================= */

function completeSetup() {

  const name =
    document
      .getElementById(
        "setup-user"
      )
      ?.value
      ?.trim();

  const password =
    document
      .getElementById(
        "setup-password"
      )
      ?.value;

  const salary =
    document
      .getElementById(
        "setup-salary"
      )
      ?.value;

  const split =
    document
      .getElementById(
        "setup-salary-split"
      )
      ?.checked;

  if (!name) {

    showToast(
      "Digite o nome do usuário."
    );

    return;
  }

  if (
    !password ||
    password.length < 4
  ) {

    showToast(
      "A senha precisa ter pelo menos 4 caracteres."
    );

    return;
  }

  const salaryValue =
    parseMoney(salary);

  state.user.name =
    name;

  state.user.password =
    password;

  state.settings.salaryReference =
    salaryValue;

  state.settings.salarySplit =
    Boolean(split);

  state.settings.cycleDay =
    5;

  state.setupComplete =
    true;

  state.currentCycle =
    currentCycleKey();

  const cycle =
    ensureCycle(
      state.currentCycle
    );

  cycle.salary =
    salaryValue;

  cycle.salaryReceived =
    true;

  saveState();

  setLoggedIn(
    true
  );

  showScreen(
    "main"
  );

  renderAll();

  showToast(
    "FX configurado."
  );
}


/* =========================================================
   MODAL ALTERAR SENHA
========================================================= */

function openChangePasswordModal() {

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Alterar senha
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <label>
        Senha atual
      </label>

      <input
        id="current-password"
        type="password"
        autocomplete="current-password"
      >

      <label>
        Nova senha
      </label>

      <input
        id="new-password"
        type="password"
        autocomplete="new-password"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="primary-button"
          id="confirm-password-change"
        >
          Salvar
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-password-change"
    )
    .addEventListener(
      "click",
      () => {

        const result =
          changePassword(

            root.querySelector(
              "#current-password"
            ).value,

            root.querySelector(
              "#new-password"
            ).value

          );

        if (result) {
          closeModal();
        }

      }
    );
}


/* =========================================================
   MODAL APAGAR TUDO
========================================================= */

function openDeleteAllModal() {

  const root =
    openModal(`

      <div class="modal-header">

        <h2>
          Apagar todos os dados
        </h2>

        <button
          type="button"
          class="modal-close"
          data-close-modal
        >
          ×
        </button>

      </div>

      <p class="modal-description">
        Essa ação apagará a conta e todos os dados financeiros do FX.
        Não pode ser desfeita.
      </p>

      <label>
        Senha atual
      </label>

      <input
        id="delete-password"
        type="password"
      >

      <label>
        Digite APAGAR para confirmar
      </label>

      <input
        id="delete-confirmation"
        autocomplete="off"
      >

      <div class="modal-actions">

        <button
          type="button"
          class="danger-button"
          id="confirm-delete-all"
        >
          Apagar todos os dados
        </button>

        <button
          type="button"
          class="secondary-button"
          data-close-modal
        >
          Cancelar
        </button>

      </div>

  `);

  root
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button =>
      button.addEventListener(
        "click",
        closeModal
      )
    );

  root
    .querySelector(
      "#confirm-delete-all"
    )
    .addEventListener(
      "click",
      () => {

        const result =
          resetAllData(

            root.querySelector(
              "#delete-password"
            ).value,

            root.querySelector(
              "#delete-confirmation"
            ).value

          );

        if (result) {
          closeModal();
        }

      }
    );
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function initializeFX() {

  loadState();

  checkCycle();

  setupEvents();

  if (
    !state.setupComplete
  ) {

    showScreen(
      "setup"
    );

    renderAll();

    return;
  }

  if (
    isLoggedIn()
  ) {

    showScreen(
      "main"
    );

  } else {

    showScreen(
      "login"
    );

  }

  renderAll();

}


document.addEventListener(
  "DOMContentLoaded",
  initializeFX
);


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "./service-worker.js"
        )
        .catch(
          error =>
            console.error(
              "FX Service Worker:",
              error
            )
        );

    }
  );

}


/* =========================================================
   DEBUG — SOMENTE DESENVOLVIMENTO
========================================================= */

window.FX = {

  getState:
    () => state,

  saveState,

  parseMoney,

  formatMoney,

  getReserveBalance,

  getAvailable,

  getSalaryAvailable,

  getExtraAvailable,

  addExpense,

  addExtra,

  depositReserve,

  withdrawReserve,

  createCategory,

  updateCategory,

  deleteCategory,

  exportBackup,

  importBackupFile

};
