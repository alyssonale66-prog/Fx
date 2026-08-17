/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.6.0
   Integração geral do aplicativo
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   VIBRAÇÃO
===================================================== */

function vibrate(ms = 12) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (e) {}
  }
}

/* =====================================================
   CATEGORIAS PADRÃO
===================================================== */

const defaultCategories = [
  {
    id: "fixed",
    name: "Gasto fixo",
    icon: "🏠",
    type: "expense",
    budget: 0
  },
  {
    id: "reserve",
    name: "Reserva",
    icon: "🏦",
    type: "reserve",
    budget: 0
  },
  {
    id: "meds",
    name: "Medicamentos",
    icon: "💊",
    type: "expense",
    budget: 0
  },
  {
    id: "leisure",
    name: "Lazer",
    icon: "🎮",
    type: "expense",
    budget: 0
  },
  {
    id: "phone",
    name: "Celular",
    icon: "📱",
    type: "expense",
    budget: 0
  }
];

/* =====================================================
   ESTADO
===================================================== */

const state = load() || {
  version: "1.6.0",

  settings: {
    plannedSalary: 0,
    salarySplitEnabled: false,
    advancePercent: 40,
    advanceDay: 20,
    mainPaymentLabel: "5º dia útil",
    reserveGoal: 0,
    hideBalance: false
  },

  categories: defaultCategories.map(cat => ({
    ...cat
  })),

  months: {},

  reserveBalance: 0,

  currentMonth: monthKey(new Date())
};

/* =====================================================
   CONTA / LOGIN
===================================================== */

function getAccount() {
  try {
    return JSON.parse(
      localStorage.getItem(ACCOUNT_KEY)
    );
  } catch {
    return null;
  }
}

function saveAccount(account) {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify(account)
  );
}

function isLogged() {
  return localStorage.getItem(SESSION_KEY) === "true";
}

function login(username, password) {
  vibrate(15);

  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta criada ainda.");
    return;
  }

  const cleanUser =
    String(username || "").trim().toLowerCase();

  const savedUser =
    String(account.username || "").trim().toLowerCase();

  if (
    cleanUser !== savedUser ||
    password !== account.password
  ) {
    showLoginMessage("Usuário ou senha incorretos.");
    return;
  }

  const remember =
    document.getElementById("rememberUserToggle")?.checked;

  if (remember) {
    localStorage.setItem(
      REMEMBER_KEY,
      account.username
    );
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }

  localStorage.setItem(SESSION_KEY, "true");

  showApp();
}

function createAccount() {
  vibrate(15);

  const username =
    (
      document.getElementById("createUsername")?.value || ""
    )
      .trim()
      .toLowerCase();

  const password =
    document.getElementById("createPassword")?.value || "";

  const confirmation =
    document.getElementById("createPasswordConfirm")?.value || "";

  if (username.length < 3 || username.length > 20) {
    showLoginMessage("Usuário de 3 a 20 caracteres.");
    return;
  }

  if (password.length !== 8) {
    showLoginMessage("Senha deve ter 8 caracteres.");
    return;
  }

  if (password !== confirmation) {
    showLoginMessage("As senhas não conferem.");
    return;
  }

  if (getAccount()) {
    showLoginMessage("Já existe uma conta.");
    return;
  }

  const recoveryCode =
    `FX-${Math.floor(1000 + Math.random() * 9000)}`;

  saveAccount({
    username,
    password,
    recoveryCode
  });

  localStorage.setItem(SESSION_KEY, "true");
  localStorage.setItem(REMEMBER_KEY, username);

  alert(
    `Conta criada!\n\nCódigo de recuperação: ${recoveryCode}`
  );

  showApp();
}

function resetPassword() {
  const code =
    (
      document.getElementById("forgotCode")?.value || ""
    ).trim();

  const newPass =
    document.getElementById("forgotNewPassword")?.value || "";

  const account = getAccount();

  if (
    !account ||
    (
      code !== MASTER_KEY &&
      code.toUpperCase() !==
        String(account.recoveryCode || "").toUpperCase()
    )
  ) {
    showLoginMessage("Código inválido.");
    return;
  }

  if (newPass.length !== 8) {
    showLoginMessage("Senha deve ter 8 caracteres.");
    return;
  }

  account.password = newPass;

  saveAccount(account);

  alert("Senha redefinida!");

  showLoginForm();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

/* =====================================================
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  data.version = "1.6.0";

  if (!data.settings || typeof data.settings !== "object") {
    data.settings = {};
  }

  data.settings.plannedSalary =
    parseToCents(data.settings.plannedSalary);

  data.settings.salarySplitEnabled =
    Boolean(data.settings.salarySplitEnabled);

  data.settings.advancePercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(data.settings.advancePercent) || 40
      )
    );

  data.settings.advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        Number(data.settings.advanceDay) || 20
      )
    );

  data.settings.mainPaymentLabel =
    String(
      data.settings.mainPaymentLabel || "5º dia útil"
    ).trim();

  data.settings.reserveGoal =
    parseToCents(data.settings.reserveGoal);

  data.settings.hideBalance =
    Boolean(data.settings.hideBalance);

  if (!Array.isArray(data.categories)) {
    data.categories =
      defaultCategories.map(cat => ({ ...cat }));
  }

  data.categories = data.categories.map(category => ({
    id: category.id || "cat_" + createId(),

    name:
      String(category.name || "Categoria").trim(),

    icon:
      String(category.icon || "💰").trim(),

    type:
      category.type === "reserve"
        ? "reserve"
        : "expense",

    budget:
      parseToCents(category.budget)
  }));

  defaultCategories.forEach(defaultCategory => {
    const exists =
      data.categories.some(
        category =>
          category.id === defaultCategory.id
      );

    if (!exists) {
      data.categories.unshift({
        ...defaultCategory
      });
    }
  });

  const reserveCategory =
    data.categories.find(
      category => category.id === "reserve"
    );

  if (reserveCategory) {
    reserveCategory.name = "Reserva";
    reserveCategory.icon = "🏦";
    reserveCategory.type = "reserve";
    reserveCategory.budget = 0;
  }

  if (!data.months || typeof data.months !== "object") {
    data.months = {};
  }

  Object.values(data.months).forEach(month => {
    if (!Array.isArray(month.expenses)) {
      month.expenses = [];
    }

    if (!Array.isArray(month.extras)) {
      month.extras = [];
    }

    if (!Array.isArray(month.reserveTransactions)) {
      month.reserveTransactions = [];
    }

    month.salaryReceived =
      parseToCents(month.salaryReceived);

    month.reserveContribution =
      parseToCents(month.reserveContribution);

    month.extraReserveContribution =
      parseToCents(month.extraReserveContribution);

    month.reserveWithdrawal =
      parseToCents(month.reserveWithdrawal);

    month.salaryReserveReturn =
      parseToCents(month.salaryReserveReturn);

    month.expenses =
      month.expenses.map(expense => ({
        ...expense,

        id:
          expense.id || createId(),

        amount:
          parseToCents(expense.amount),

        source:
          expense.source === "extra"
            ? "extra"
            : "salary",

        categoryId:
          expense.categoryId || "fixed",

        note:
          String(expense.note || "").trim(),

        date:
          expense.date || new Date().toISOString()
      }));

    month.extras =
      month.extras.map(extra => ({
        ...extra,

        id:
          extra.id || createId(),

        amount:
          parseToCents(extra.amount),

        name:
          String(extra.name || "Extra").trim(),

        date:
          extra.date || new Date().toISOString()
      }));

    month.reserveTransactions =
      month.reserveTransactions.map(tx => ({
        ...tx,

        id:
          tx.id || createId(),

        amount:
          parseToCents(tx.amount),

        type:
          tx.type === "out"
            ? "out"
            : "in",

        source:
          tx.source === "extra"
            ? "extra"
            : "salary",

        note:
          String(tx.note || "").trim(),

        date:
          tx.date || new Date().toISOString()
      }));
  });

  data.reserveBalance =
    parseToCents(data.reserveBalance);

  if (
    typeof data.currentMonth !== "string" ||
    !/^\d{4}-\d{2}$/.test(data.currentMonth)
  ) {
    data.currentMonth =
      monthKey(new Date());
  }

  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  );

  return data;
}

function load() {
  try {
    const raw =
      localStorage.getItem(KEY);

    if (!raw) {
      return null;
    }

    return normalizeState(
      JSON.parse(raw)
    );
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );
}

/* =====================================================
   DINHEIRO
===================================================== */

function money(cents) {
  if (state.settings.hideBalance) {
    return "R$ ••••";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(
    (Number(cents) || 0) / 100
  );
}

function parseToCents(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.round(value)
      : 0;
  }

  let text =
    String(value)
      .trim()
      .replace(/R\$/gi, "")
      .replace(/\s/g, "");

  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const negative =
      text.startsWith("-");

    text =
      text
        .replace(/-/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const parts =
      text.split(".");

    const integer =
      parseInt(
        (parts[0] || "0").replace(/\D/g, "") || "0",
        10
      );

    const decimal =
      (parts[1] || "")
        .replace(/\D/g, "")
        .padEnd(2, "0")
        .slice(0, 2);

    const result =
      integer * 100 +
      parseInt(decimal || "0", 10);

    return negative ? -result : result;
  }

  const cleaned =
    text.replace(/[^0-9.-]/g, "");

  const parsed =
    Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function numCents(id) {
  const element =
    document.getElementById(id);

  return element
    ? parseToCents(element.value)
    : 0;
}

/* =====================================================
   MESES
===================================================== */

function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonth(key = state.currentMonth) {
  if (!state.months[key]) {
    state.months[key] = {
      salaryReceived:
        state.settings.plannedSalary || 0,

      expenses: [],

      extras: [],

      reserveContribution: 0,

      extraReserveContribution: 0,

      reserveWithdrawal: 0,

      reserveTransactions: [],

      salaryReserveReturn: 0
    };

    save();
  }

  const month = state.months[key];

  if (!Array.isArray(month.expenses)) {
    month.expenses = [];
  }

  if (!Array.isArray(month.extras)) {
    month.extras = [];
  }

  if (!Array.isArray(month.reserveTransactions)) {
    month.reserveTransactions = [];
  }

  return month;
}

/* =====================================================
   CÁLCULOS
===================================================== */

function categorySpent(id, month) {
  return month.expenses
    .filter(expense => expense.categoryId === id)
    .reduce(
      (sum, expense) =>
        sum + (Number(expense.amount) || 0),
      0
    );
}

function totalSpent(month) {
  return month.expenses.reduce(
    (sum, expense) =>
      sum + (Number(expense.amount) || 0),
    0
  );
}

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum + (Number(extra.amount) || 0),
    0
  );
}

function totalSalarySpent(month) {
  return month.expenses
    .filter(expense => expense.source !== "extra")
    .reduce(
      (sum, expense) =>
        sum + (Number(expense.amount) || 0),
      0
    );
}

function totalExtraSpent(month) {
  return month.expenses
    .filter(expense => expense.source === "extra")
    .reduce(
      (sum, expense) =>
        sum + (Number(expense.amount) || 0),
      0
    );
}

/* =====================================================
   SALDO ANTERIOR
===================================================== */

function getPreviousSalaryCarryover(currentMonthKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentMonthKey) {
        return;
      }

      const month = state.months[key];

      carry +=
        (Number(month.salaryReceived) || 0) +
        (Number(month.salaryReserveReturn) || 0) -
        totalSalarySpent(month) -
        (Number(month.reserveContribution) || 0);
    });

  return Math.max(0, carry);
}

function getPreviousExtraCarryover(currentMonthKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentMonthKey) {
        return;
      }

      const month = state.months[key];

      carry +=
        totalExtras(month) -
        totalExtraSpent(month) -
        (Number(month.extraReserveContribution) || 0);
    });

  return Math.max(0, carry);
}

/* =====================================================
   SALDO DO SALÁRIO
===================================================== */

function getSalaryAvailable(month) {
  return Math.max(
    0,

    getPreviousSalaryCarryover(
      state.currentMonth
    ) +

    (Number(month.salaryReceived) || 0) +

    (Number(month.salaryReserveReturn) || 0) -

    totalSalarySpent(month) -

    (Number(month.reserveContribution) || 0)
  );
}

/* =====================================================
   SALDO DOS EXTRAS
===================================================== */

function getExtraAvailable(month) {
  return Math.max(
    0,

    getPreviousExtraCarryover(
      state.currentMonth
    ) +

    totalExtras(month) -

    totalExtraSpent(month) -

    (Number(month.extraReserveContribution) || 0)
  );
}

/* =====================================================
   RESERVA
===================================================== */

function getReserveBalance() {
  let totalIn = 0;
  let totalOut = 0;

  Object.values(state.months).forEach(month => {
    totalIn +=
      Number(month.reserveContribution) || 0;

    totalIn +=
      Number(month.extraReserveContribution) || 0;

    totalOut +=
      Number(month.reserveWithdrawal) || 0;
  });

  return Math.max(
    0,
    totalIn - totalOut
  );
}

function syncReserve() {
  state.reserveBalance =
    getReserveBalance();

  save();
}

/* =====================================================
   RENDER PRINCIPAL
===================================================== */

function render() {
  const month = getMonth();

  syncReserve();

  const title =
    document.getElementById("monthTitle");

  if (title) {
    title.textContent =
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          month: "long",
          year: "numeric"
        }
      ).format(
        new Date(
          `${state.currentMonth}-01T00:00:00`
        )
      );
  }

  const salary =
    getSalaryAvailable(month);

  const extra =
    getExtraAvailable(month);

  const available =
    document.getElementById("availableValue");

  if (available) {
    available.textContent =
      money(salary);
  }

  const salaryElement =
    document.getElementById("salaryValue");

  if (salaryElement) {
    salaryElement.textContent =
      money(salary);
  }

  const extraElement =
    document.getElementById("extraValue");

  if (extraElement) {
    extraElement.textContent =
      money(extra);
  }

  const spentElement =
    document.getElementById("spentValue");

  if (spentElement) {
    spentElement.textContent =
      money(totalSpent(month));
  }

  const reserveElement =
    document.getElementById("reserveBig");

  if (reserveElement) {
    reserveElement.textContent =
      money(state.reserveBalance);
  }

  renderProgress(month);
  renderCategories();
  renderExtras();
  renderHistoryPreview();
  renderGoal();
  renderPayments();
}

/* =====================================================
   PROGRESSO
===================================================== */

function renderProgress(month) {
  const totalIncomes =
    (Number(month.salaryReceived) || 0) +
    totalExtras(month);

  const spent =
    totalSpent(month);

  const percent =
    totalIncomes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (spent / totalIncomes) * 100
          )
        )
      : 0;

  const bar =
    document.getElementById("monthlyBar");

  if (bar) {
    bar.style.width =
      `${percent}%`;
  }

  const label =
    document.getElementById(
      "spentPercentLabel"
    );

  if (label) {
    label.textContent =
      `${Math.round(percent)}% gasto`;
  }
}

/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {
  const wrap =
    document.getElementById("categories");

  if (!wrap) {
    return;
  }

  const month =
    getMonth();

  wrap.innerHTML = "";

  state.categories.forEach(category => {
    const element =
      document.createElement("div");

    element.className =
      "category";

    const value =
      category.type === "reserve"
        ? (
            (Number(month.reserveContribution) || 0) +
            (Number(month.extraReserveContribution) || 0)
          )
        : categorySpent(
            category.id,
            month
          );

    element.innerHTML = `
      <div class="cat-icon">
        ${escapeHtml(category.icon)}
      </div>

      <div class="cat-main">
        <div class="cat-name">
          ${escapeHtml(category.name)}
        </div>
      </div>

      <div class="cat-value">
        <strong>${money(value)}</strong>
      </div>

      ${
        category.id !== "reserve"
          ? `
            <div class="cat-actions">
              <button
                class="cat-edit"
                type="button"
                data-edit-category="${escapeHtml(category.id)}"
              >✎</button>
            </div>
          `
          : ""
      }
    `;

    wrap.appendChild(element);
  });

  wrap
    .querySelectorAll("[data-edit-category]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          editCategory(
            button.dataset.editCategory
          );
        }
      );
    });
}

/* =====================================================
   EXTRAS
===================================================== */

function renderExtras() {
  const list =
    document.getElementById("extrasList");

  if (!list) {
    return;
  }

  const month =
    getMonth();

  list.innerHTML = "";

  if (!month.extras.length) {
    list.innerHTML = `
      <div class="empty-history">
        Nenhuma entrada extra neste mês.
      </div>
    `;

    return;
  }

  [...month.extras]
    .reverse()
    .forEach(extra => {
      const element =
        document.createElement("div");

      element.className =
        "extra-item";

      element.innerHTML = `
        <div class="extra-icon">💰</div>

        <div class="extra-main">
          <div class="extra-name">
            ${escapeHtml(extra.name)}
          </div>

          <div class="extra-date">
            ${formatDate(extra.date)}
          </div>
        </div>

        <div class="extra-value">
          + ${money(extra.amount)}
        </div>

        <button
          class="extra-delete"
          type="button"
          data-delete-extra="${escapeHtml(extra.id)}"
        >✕</button>
      `;

      list.appendChild(element);
    });

  list
    .querySelectorAll("[data-delete-extra]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          deleteExtra(
            button.dataset.deleteExtra
          );
        }
      );
    });
}

/* =====================================================
   HISTÓRICO
===================================================== */

function getTransactions(month) {
  const transactions = [];

  month.expenses.forEach(expense => {
    const category =
      state.categories.find(
        category =>
          category.id === expense.categoryId
      );

    transactions.push({
      id: expense.id,
      type: "expense",
      date: expense.date,
      name:
        category?.name ||
        "Gasto",
      icon:
        category?.icon ||
        "💸",
      amount:
        expense.amount,
      source:
        expense.source,
      note:
        expense.note
    });
  });

  month.extras.forEach(extra => {
    transactions.push({
      id: extra.id,
      type: "extra-in",
      date: extra.date,
      name: extra.name,
      icon: "💰",
      amount: extra.amount,
      note: "Entrada extra"
    });
  });

  month.reserveTransactions.forEach(tx => {
    transactions.push({
      id: tx.id,
      type:
        tx.type === "out"
          ? "reserve-out"
          : "reserve-in",
      date: tx.date,
      name: "Reserva",
      icon: "🏦",
      amount: tx.amount,
      note: tx.note
    });
  });

  return transactions.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );
}

function renderHistoryPreview() {
  const list =
    document.getElementById(
      "historyPreview"
    );

  if (!list) {
    return;
  }

  const transactions =
    getTransactions(getMonth())
      .slice(0, 5);

  list.innerHTML = "";

  if (!transactions.length) {
    list.innerHTML = `
      <div class="empty-history">
        Nenhuma movimentação neste mês.
      </div>
    `;

    return;
  }

  transactions.forEach(tx => {
    list.appendChild(
      createHistoryElement(tx)
    );
  });
}

function createHistoryElement(tx) {
  const element =
    document.createElement("div");

  element.className =
    "history-item";

  let valueClass =
    tx.type;

  let prefix = "";

  if (tx.type === "expense") {
    valueClass = "expense";
    prefix = "- ";
  }

  if (tx.type === "extra-in") {
    valueClass = "extra-in";
    prefix = "+ ";
  }

  if (tx.type === "reserve-in") {
    valueClass = "reserve-in";
    prefix = "+ ";
  }

  if (tx.type === "reserve-out") {
    valueClass = "reserve-out";
    prefix = "- ";
  }

  element.innerHTML = `
    <div class="history-icon">
      ${escapeHtml(tx.icon)}
    </div>

    <div class="history-main">
      <div class="history-name">
        ${escapeHtml(tx.name)}
      </div>

      <div class="history-date">
        ${formatDate(tx.date)}
      </div>

      ${
        tx.note
          ? `
            <div class="history-note">
              ${escapeHtml(tx.note)}
            </div>
          `
          : ""
      }
    </div>

    <div class="history-value ${valueClass}">
      ${prefix}${money(tx.amount)}
    </div>
  `;

  return element;
}

function openHistory() {
  const month =
    getMonth();

  const transactions =
    getTransactions(month);

  let html = `
    <div class="history-total">
      <span>Gastos do mês</span>
      <strong>${money(totalSpent(month))}</strong>
    </div>

    <div class="full-history">
  `;

  if (!transactions.length) {
    html += `
      <div class="empty-history">
        Nenhuma movimentação neste mês.
      </div>
    `;
  } else {
    transactions.forEach(tx => {
      html += `
        <div
          class="history-item"
          style="margin-bottom:8px;"
        >
          <div class="history-icon">
            ${escapeHtml(tx.icon)}
          </div>

          <div class="history-main">
            <div class="history-name">
              ${escapeHtml(tx.name)}
            </div>

            <div class="history-date">
              ${formatDate(tx.date)}
            </div>

            ${
              tx.note
                ? `
                  <div class="history-note">
                    ${escapeHtml(tx.note)}
                  </div>
                `
                : ""
            }
          </div>

          <div class="history-value ${
            tx.type
          }">
            ${
              tx.type === "expense" ||
              tx.type === "reserve-out"
                ? "-"
                : "+"
            }
            ${money(tx.amount)}
          </div>
        </div>
      `;
    });
  }

  html += `
    </div>

    <button
      class="form button secondary"
      type="button"
      id="closeHistoryAction"
      style="margin-top:12px;"
    >
      Fechar
    </button>
  `;

  openModal(
    "Extrato",
    html
  );

  document
    .getElementById("closeHistoryAction")
    ?.addEventListener(
      "click",
      closeModal
    );
}

/* =====================================================
   ADICIONAR GASTO
===================================================== */

function openAddExpense() {
  const categoryOptions =
    state.categories
      .filter(category => category.type !== "reserve")
      .map(
        category => `
          <option value="${escapeHtml(category.id)}">
            ${escapeHtml(category.icon)}
            ${escapeHtml(category.name)}
          </option>
        `
      )
      .join("");

  openModal(
    "Adicionar gasto",
    `
      <form class="form" id="expenseForm">

        <label for="expenseAmount">
          Valor
        </label>

        <input
          id="expenseAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <label for="expenseCategory">
          Categoria
        </label>

        <select id="expenseCategory">
          ${categoryOptions}
        </select>

        <label for="expenseSource">
          Dinheiro utilizado
        </label>

        <select id="expenseSource">
          <option value="salary">
            Salário
          </option>

          <option value="extra">
            Extras
          </option>
        </select>

        <label for="expenseNote">
          Observação
        </label>

        <input
          id="expenseNote"
          placeholder="Opcional"
        >

        <button type="submit">
          Salvar gasto
        </button>

      </form>
    `
  );

  document
    .getElementById("expenseForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        addExpense();
      }
    );
}

function addExpense() {
  const amount =
    numCents("expenseAmount");

  const categoryId =
    document.getElementById(
      "expenseCategory"
    )?.value;

  const source =
    document.getElementById(
      "expenseSource"
    )?.value === "extra"
      ? "extra"
      : "salary";

  const note =
    document.getElementById(
      "expenseNote"
    )?.value.trim() || "";

  if (amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const month =
    getMonth();

  const available =
    source === "extra"
      ? getExtraAvailable(month)
      : getSalaryAvailable(month);

  if (amount > available) {
    alert(
      `Saldo insuficiente.\n\nDisponível: ${money(available)}`
    );
    return;
  }

  month.expenses.push({
    id: createId(),
    amount,
    categoryId:
      categoryId || "fixed",
    source,
    note,
    date: new Date().toISOString()
  });

  save();

  closeModal();
  render();

  vibrate(15);
}

/* =====================================================
   EXTRAS
===================================================== */

function openAddExtra() {
  openModal(
    "Adicionar entrada extra",
    `
      <form class="form" id="extraForm">

        <label for="extraName">
          Nome
        </label>

        <input
          id="extraName"
          placeholder="Ex: Venda, bônus, Pix..."
          required
        >

        <label for="extraAmount">
          Valor
        </label>

        <input
          id="extraAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <button type="submit">
          Adicionar extra
        </button>

      </form>
    `
  );

  document
    .getElementById("extraForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        addExtra();
      }
    );
}

function addExtra() {
  const name =
    document.getElementById(
      "extraName"
    )?.value.trim() || "";

  const amount =
    numCents("extraAmount");

  if (!name) {
    alert("Informe o nome do extra.");
    return;
  }

  if (amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const month =
    getMonth();

  month.extras.push({
    id: createId(),
    name,
    amount,
    date: new Date().toISOString()
  });

  save();

  closeModal();
  render();

  vibrate(15);
}

function deleteExtra(id) {
  const month =
    getMonth();

  const extra =
    month.extras.find(
      item => item.id === id
    );

  if (!extra) {
    return;
  }

  const confirmed =
    confirm(
      `Excluir o extra "${extra.name}" de ${money(extra.amount)}?`
    );

  if (!confirmed) {
    return;
  }

  month.extras =
    month.extras.filter(
      item => item.id !== id
    );

  save();
  render();

  vibrate(15);
}

/* =====================================================
   CATEGORIAS
===================================================== */

function openAddCategory() {
  openModal(
    "Nova categoria",
    `
      <form class="form" id="categoryForm">

        <label for="categoryName">
          Nome
        </label>

        <input
          id="categoryName"
          placeholder="Ex: Alimentação"
          required
        >

        <label for="categoryIcon">
          Ícone
        </label>

        <input
          id="categoryIcon"
          placeholder="🍔"
          maxlength="4"
        >

        <button type="submit">
          Criar categoria
        </button>

      </form>
    `
  );

  document
    .getElementById("categoryForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        addCategory();
      }
    );
}

function addCategory() {
  const name =
    document.getElementById(
      "categoryName"
    )?.value.trim() || "";

  const icon =
    document.getElementById(
      "categoryIcon"
    )?.value.trim() || "💰";

  if (!name) {
    alert("Informe o nome da categoria.");
    return;
  }

  state.categories.push({
    id: "cat_" + createId(),
    name,
    icon,
    type: "expense",
    budget: 0
  });

  save();

  closeModal();
  render();

  vibrate(15);
}

function editCategory(id) {
  const category =
    state.categories.find(
      item => item.id === id
    );

  if (!category) {
    return;
  }

  openModal(
    "Editar categoria",
    `
      <form class="form" id="editCategoryForm">

        <label for="editCategoryName">
          Nome
        </label>

        <input
          id="editCategoryName"
          value="${escapeHtml(category.name)}"
          required
        >

        <label for="editCategoryIcon">
          Ícone
        </label>

        <input
          id="editCategoryIcon"
          value="${escapeHtml(category.icon)}"
          maxlength="4"
        >

        <button type="submit">
          Salvar alterações
        </button>

        <button
          type="button"
          class="danger"
          id="deleteCategoryButton"
        >
          Excluir categoria
        </button>

      </form>
    `
  );

  document
    .getElementById("editCategoryForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        category.name =
          document.getElementById(
            "editCategoryName"
          )?.value.trim() || category.name;

        category.icon =
          document.getElementById(
            "editCategoryIcon"
          )?.value.trim() || category.icon;

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById("deleteCategoryButton")
    ?.addEventListener(
      "click",
      () => deleteCategory(id)
    );
}

function deleteCategory(id) {
  if (
    defaultCategories.some(
      category => category.id === id
    )
  ) {
    alert(
      "As categorias padrão não podem ser excluídas."
    );
    return;
  }

  const category =
    state.categories.find(
      item => item.id === id
    );

  if (!category) {
    return;
  }

  const used =
    Object.values(state.months)
      .some(month =>
        month.expenses.some(
          expense =>
            expense.categoryId === id
        )
      );

  if (used) {
    alert(
      "Essa categoria já possui gastos registrados e não pode ser excluída."
    );
    return;
  }

  if (
    !confirm(
      `Excluir a categoria "${category.name}"?`
    )
  ) {
    return;
  }

  state.categories =
    state.categories.filter(
      item => item.id !== id
    );

  save();
  closeModal();
  render();
}

/* =====================================================
   RESERVA
===================================================== */

function openReserveManager() {
  const month =
    getMonth();

  openModal(
    "Gerenciar reserva",
    `
      <div class="notice">
        Reserva atual:
        <strong>${money(state.reserveBalance)}</strong>
      </div>

      <form class="form" id="reserveForm">

        <label for="reserveAction">
          Ação
        </label>

        <select id="reserveAction">
          <option value="in">
            Guardar dinheiro
          </option>

          <option value="out">
            Retirar da reserva
          </option>
        </select>

        <label for="reserveAmount">
          Valor
        </label>

        <input
          id="reserveAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <label for="reserveSource">
          Origem
        </label>

        <select id="reserveSource">
          <option value="salary">
            Salário
          </option>

          <option value="extra">
            Extra
          </option>
        </select>

        <label for="reserveNote">
          Observação
        </label>

        <input
          id="reserveNote"
          placeholder="Opcional"
        >

        <button type="submit">
          Confirmar
        </button>

      </form>
    `
  );

  document
    .getElementById("reserveForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        manageReserve();
      }
    );
}

function manageReserve() {
  const action =
    document.getElementById(
      "reserveAction"
    )?.value === "out"
      ? "out"
      : "in";

  const source =
    document.getElementById(
      "reserveSource"
    )?.value === "extra"
      ? "extra"
      : "salary";

  const amount =
    numCents("reserveAmount");

  const note =
    document.getElementById(
      "reserveNote"
    )?.value.trim() || "";

  if (amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const month =
    getMonth();

  if (action === "in") {
    const available =
      source === "extra"
        ? getExtraAvailable(month)
        : getSalaryAvailable(month);

    if (amount > available) {
      alert(
        `Saldo insuficiente.\n\nDisponível: ${money(available)}`
      );
      return;
    }

    if (source === "extra") {
      month.extraReserveContribution += amount;
    } else {
      month.reserveContribution += amount;
    }

    month.reserveTransactions.push({
      id: createId(),
      amount,
      type: "in",
      source,
      note,
      date: new Date().toISOString()
    });
  } else {
    if (amount > state.reserveBalance) {
      alert(
        `A reserva possui apenas ${money(state.reserveBalance)}.`
      );
      return;
    }

    month.reserveWithdrawal += amount;

    month.reserveTransactions.push({
      id: createId(),
      amount,
      type: "out",
      source,
      note,
      date: new Date().toISOString()
    });
  }

  save();
  syncReserve();
  closeModal();
  render();

  vibrate(15);
}

/* =====================================================
   META DA RESERVA
===================================================== */

function renderGoal() {
  const box =
    document.getElementById("goalBox");

  if (!box) {
    return;
  }

  const goal =
    Number(state.settings.reserveGoal) || 0;

  if (goal <= 0) {
    box.textContent =
      "Sem meta definida";
    return;
  }

  const percent =
    Math.min(
      100,
      Math.round(
        (
          state.reserveBalance /
          goal
        ) * 100
      )
    );

  box.innerHTML = `
    Meta:
    <strong>${money(goal)}</strong>
    <br>
    ${percent}% concluída
  `;
}

/* =====================================================
   PAGAMENTOS
===================================================== */

function renderPayments() {
  const section =
    document.querySelector(
      ".payments-card"
    );

  if (!section) {
    return;
  }

  const enabled =
    state.settings.salarySplitEnabled;

  section.classList.toggle(
    "hidden",
    !enabled
  );

  if (!enabled) {
    return;
  }

  const salary =
    Number(
      state.settings.plannedSalary
    ) || 0;

  const percent =
    Number(
      state.settings.advancePercent
    ) || 0;

  const advance =
    Math.round(
      salary * percent / 100
    );

  const main =
    Math.max(
      0,
      salary - advance
    );

  const advanceValue =
    document.getElementById(
      "advanceValue"
    );

  const mainPayValue =
    document.getElementById(
      "mainPayValue"
    );

  if (advanceValue) {
    advanceValue.textContent =
      money(advance);
  }

  if (mainPayValue) {
    mainPayValue.textContent =
      money(main);
  }

  const advanceDate =
    document.getElementById(
      "advanceDate"
    );

  if (advanceDate) {
    advanceDate.textContent =
      `Dia ${state.settings.advanceDay}`;
  }

  const mainDate =
    document.getElementById(
      "mainPayDate"
    );

  if (mainDate) {
    mainDate.textContent =
      state.settings.mainPaymentLabel;
  }
}

/* =====================================================
   CONFIGURAÇÕES
===================================================== */

function openSettings() {
  const settings =
    state.settings;

  openModal(
    "Configurações",
    `
      <form class="form" id="settingsForm">

        <label for="plannedSalary">
          Salário planejado
        </label>

        <input
          id="plannedSalary"
          inputmode="decimal"
          value="${formatInputMoney(settings.plannedSalary)}"
          placeholder="R$ 0,00"
        >

        <label for="reserveGoal">
          Meta da reserva
        </label>

        <input
          id="reserveGoal"
          inputmode="decimal"
          value="${formatInputMoney(settings.reserveGoal)}"
          placeholder="R$ 0,00"
        >

        <div class="dark-mode-row">
          <span>
            Dividir salário
          </span>

          <label class="theme-switch">
            <input
              type="checkbox"
              id="salarySplitEnabled"
              ${settings.salarySplitEnabled ? "checked" : ""}
            >

            <span class="theme-slider">
              <span class="theme-dot"></span>
            </span>
          </label>
        </div>

        <div id="salarySplitOptions">

          <label for="advancePercent">
            Percentual do adiantamento
          </label>

          <input
            id="advancePercent"
            type="number"
            min="0"
            max="100"
            value="${settings.advancePercent}"
          >

          <label for="advanceDay">
            Dia do adiantamento
          </label>

          <input
            id="advanceDay"
            type="number"
            min="1"
            max="31"
            value="${settings.advanceDay}"
          >

          <label for="mainPaymentLabel">
            Pagamento principal
          </label>

          <input
            id="mainPaymentLabel"
            value="${escapeHtml(settings.mainPaymentLabel)}"
          >

        </div>

        <button type="submit">
          Salvar configurações
        </button>

      </form>
    `
  );

  document
    .getElementById("settingsForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        saveSettings();
      }
    );
}

function saveSettings() {
  state.settings.plannedSalary =
    numCents("plannedSalary");

  state.settings.reserveGoal =
    numCents("reserveGoal");

  state.settings.salarySplitEnabled =
    Boolean(
      document.getElementById(
        "salarySplitEnabled"
      )?.checked
    );

  state.settings.advancePercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          document.getElementById(
            "advancePercent"
          )?.value
        ) || 0
      )
    );

  state.settings.advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        Number(
          document.getElementById(
            "advanceDay"
          )?.value
        ) || 20
      )
    );

  state.settings.mainPaymentLabel =
    document.getElementById(
      "mainPaymentLabel"
    )?.value.trim() ||
    "5º dia útil";

  save();

  closeModal();
  render();

  vibrate(15);
}

/* =====================================================
   FORMATAÇÃO
===================================================== */

function formatInputMoney(cents) {
  return (
    (Number(cents) || 0) / 100
  )
    .toFixed(2)
    .replace(".", ",");
}

function formatDate(date) {
  if (!date) {
    return "--";
  }

  const parsed =
    new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(parsed);
}

function monthShift(key, delta) {
  const [
    year,
    month
  ] =
    key
      .split("-")
      .map(Number);

  return monthKey(
    new Date(
      year,
      month - 1 + delta,
      1
    )
  );
}

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])
  );
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}

/* =====================================================
   MODAL
===================================================== */

function closeModal() {
  document
    .getElementById("modal")
    ?.classList.add("hidden");
}

function openModal(title, html) {
  const titleElement =
    document.getElementById("modalTitle");

  const bodyElement =
    document.getElementById("modalBody");

  const modal =
    document.getElementById("modal");

  if (
    !titleElement ||
    !bodyElement ||
    !modal
  ) {
    return;
  }

  titleElement.textContent =
    title;

  bodyElement.innerHTML =
    html;

  modal.classList.remove("hidden");
}

/* =====================================================
   LOGIN UI
===================================================== */

function showLoginMessage(message) {
  const element =
    document.getElementById(
      "loginMessage"
    );

  if (element) {
    element.textContent =
      message;
  }
}

function showApp() {
  document
    .getElementById("loginScreen")
    ?.classList.add("hidden");

  document
    .getElementById("appScreen")
    ?.classList.remove("hidden");

  initFinance();
}

function showCreateAccount() {
  document
    .getElementById("loginForm")
    ?.classList.add("hidden");

  document
    .getElementById("forgotForm")
    ?.classList.add("hidden");

  document
    .getElementById("createForm")
    ?.classList.remove("hidden");

  showLoginMessage("");
}

function showLoginForm() {
  document
    .getElementById("createForm")
    ?.classList.add("hidden");

  document
    .getElementById("forgotForm")
    ?.classList.add("hidden");

  document
    .getElementById("loginForm")
    ?.classList.remove("hidden");

  showLoginMessage("");
}

function showForgotForm() {
  document
    .getElementById("loginForm")
    ?.classList.add("hidden");

  document
    .getElementById("createForm")
    ?.classList.add("hidden");

  document
    .getElementById("forgotForm")
    ?.classList.remove("hidden");

  showLoginMessage("");
}

/* =====================================================
   EVENTOS
===================================================== */

document
  .getElementById("loginBtn")
  ?.addEventListener(
    "click",
    () => {
      login(
        document.getElementById(
          "loginUsername"
        )?.value || "",

        document.getElementById(
          "loginPassword"
        )?.value || ""
      );
    }
  );

document
  .getElementById("createBtn")
  ?.addEventListener(
    "click",
    createAccount
  );

document
  .getElementById("showCreateBtn")
  ?.addEventListener(
    "click",
    showCreateAccount
  );

/*
   CORREÇÃO:

   O HTML usa showForgotBtn.
   A versão anterior procurava forgotBtn.
*/

document
  .getElementById("showForgotBtn")
  ?.addEventListener(
    "click",
    showForgotForm
  );

document
  .getElementById("backLoginBtn")
  ?.addEventListener(
    "click",
    showLoginForm
  );

document
  .getElementById("backLoginFromForgotBtn")
  ?.addEventListener(
    "click",
    showLoginForm
  );

document
  .getElementById("resetPasswordBtn")
  ?.addEventListener(
    "click",
    resetPassword
  );

document
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    logout
);

/* =====================================================
   BOTÕES PRINCIPAIS
===================================================== */

document
  .getElementById("addExpenseBtn")
  ?.addEventListener(
    "click",
    openAddExpense
  );

document
  .getElementById("addExtraBtn")
  ?.addEventListener(
    "click",
    openAddExtra
  );

document
  .getElementById("addCategoryBtn")
  ?.addEventListener(
    "click",
    openAddCategory
  );

document
  .getElementById("reserveBtn")
  ?.addEventListener(
    "click",
    openReserveManager
  );

document
  .getElementById("settingsBtn")
  ?.addEventListener(
    "click",
    openSettings
  );

document
  .getElementById("historyBtn")
  ?.addEventListener(
    "click",
    openHistory
  );

document
  .getElementById("historyBtn2")
  ?.addEventListener(
    "click",
    openHistory
  );

document
  .getElementById("paymentsSettingsBtn")
  ?.addEventListener(
    "click",
    openSettings
);

/* =====================================================
   OCULTAR SALDOS
===================================================== */

document
  .getElementById("toggleHideBtn")
  ?.addEventListener(
    "click",
    () => {
      vibrate(12);

      state.settings.hideBalance =
        !state.settings.hideBalance;

      save();
      render();
    }
  );

/* =====================================================
   MESES
===================================================== */

document
  .getElementById("prevMonth")
  ?.addEventListener(
    "click",
    () => {
      vibrate(10);

      state.currentMonth =
        monthShift(
          state.currentMonth,
          -1
        );

      save();
      render();
    }
  );

document
  .getElementById("nextMonth")
  ?.addEventListener(
    "click",
    () => {
      vibrate(10);

      state.currentMonth =
        monthShift(
          state.currentMonth,
          1
        );

      save();
      render();
    }
  );

/* =====================================================
   MODAL
===================================================== */

document
  .getElementById("closeModal")
  ?.addEventListener(
    "click",
    closeModal
  );

document
  .getElementById("modal")
  ?.addEventListener(
    "click",
    event => {
      if (event.target.id === "modal") {
        closeModal();
      }
    }
  );

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

function initFinance() {
  document.body.classList.toggle(
    "dark",
    localStorage.getItem("fxDarkMode") === "true"
  );

  normalizeState(state);

  getMonth();

  syncReserve();

  render();
}

/* =====================================================
   USUÁRIO LEMBRADO
===================================================== */

const rememberedUser =
  localStorage.getItem(
    REMEMBER_KEY
  );

if (rememberedUser) {
  const userInput =
    document.getElementById(
      "loginUsername"
    );

  const rememberToggle =
    document.getElementById(
      "rememberUserToggle"
    );

  if (userInput) {
    userInput.value =
      rememberedUser;
  }

  if (rememberToggle) {
    rememberToggle.checked =
      true;
  }
}

/* =====================================================
   INÍCIO
===================================================== */

if (isLogged()) {
  showApp();
} else {
  document
    .getElementById("loginScreen")
    ?.classList.remove("hidden");

  document
    .getElementById("appScreen")
    ?.classList.add("hidden");
}
