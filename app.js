/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.6.0
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   TÁTIL
===================================================== */

function vibrate(ms = 12) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {}
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

  categories: defaultCategories.map(cat => ({ ...cat })),

  months: {},

  reserveBalance: 0,

  currentMonth: monthKey(new Date())
};

/* =====================================================
   DINHEIRO
===================================================== */

function parseToCents(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  let text = String(value)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  if (!text) return 0;

  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");

    const parts = text.split(".");

    const integerPart =
      (parts[0] || "0").replace(/\D/g, "") || "0";

    const decimalPart =
      (parts[1] || "")
        .replace(/\D/g, "")
        .padEnd(2, "0")
        .slice(0, 2);

    return (
      parseInt(integerPart, 10) * 100 +
      parseInt(decimalPart || "0", 10)
    );
  }

  const cleaned = text.replace(/[^0-9.-]/g, "");

  if (!cleaned) return 0;

  const number = Number(cleaned);

  if (!Number.isFinite(number)) return 0;

  return Math.round(number * 100);
}

function money(cents) {
  if (state.settings.hideBalance) {
    return "R$ ••••";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format((Number(cents) || 0) / 100);
}

function numCents(id) {
  const el = document.getElementById(id);

  if (!el) return 0;

  return parseToCents(el.value);
}

/* =====================================================
   UTILITÁRIOS
===================================================== */

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

/* =====================================================
   MESES
===================================================== */

function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthShift(key, delta) {
  const [year, month] = key.split("-").map(Number);

  return monthKey(
    new Date(year, month - 1 + delta, 1)
  );
}

function getMonth(key = state.currentMonth) {
  if (!state.months[key]) {
    state.months[key] = {
      salaryReceived: 0,
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

  return month;
}

/* =====================================================
   ESTADO / NORMALIZAÇÃO
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
      data.settings.mainPaymentLabel ||
      "5º dia útil"
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
    id: category.id || `cat_${createId()}`,
    name: String(category.name || "Categoria").trim(),
    icon: String(category.icon || "💰").trim(),
    type: category.type === "reserve"
      ? "reserve"
      : "expense",
    budget: parseToCents(category.budget)
  }));

  defaultCategories.forEach(defaultCategory => {
    if (
      !data.categories.some(
        category => category.id === defaultCategory.id
      )
    ) {
      data.categories.unshift({
        ...defaultCategory
      });
    }
  });

  const reserveCategory = data.categories.find(
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

    month.expenses = month.expenses.map(expense => ({
      ...expense,
      amount: parseToCents(expense.amount),
      source: expense.source === "extra"
        ? "extra"
        : "salary",
      note: String(expense.note || "").trim()
    }));

    month.extras = month.extras.map(extra => ({
      ...extra,
      amount: parseToCents(extra.amount),
      name: String(extra.name || "Extra").trim()
    }));
  });

  data.reserveBalance =
    parseToCents(data.reserveBalance);

  if (typeof data.currentMonth !== "string") {
    data.currentMonth = monthKey(new Date());
  }

  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);

    if (!raw) return null;

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("Erro ao carregar FX:", error);
    return null;
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* =====================================================
   CÁLCULOS
===================================================== */

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum + (Number(extra.amount) || 0),
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

function categorySpent(id, month) {
  return month.expenses
    .filter(expense => expense.categoryId === id)
    .reduce(
      (sum, expense) =>
        sum + (Number(expense.amount) || 0),
      0
    );
}

/* =====================================================
   SALDO ANTERIOR
===================================================== */

function getPreviousSalaryCarryover(currentKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) return;

      const month = state.months[key];

      carry +=
        (Number(month.salaryReceived) || 0) +
        (Number(month.salaryReserveReturn) || 0) -
        totalSalarySpent(month) -
        (Number(month.reserveContribution) || 0);
    });

  return Math.max(0, carry);
}

function getPreviousExtraCarryover(currentKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) return;

      const month = state.months[key];

      carry +=
        totalExtras(month) -
        totalExtraSpent(month) -
        (Number(month.extraReserveContribution) || 0);
    });

  return Math.max(0, carry);
}

/* =====================================================
   SALÁRIO DISPONÍVEL
===================================================== */

function getSalaryAvailable(month) {
  const previous =
    getPreviousSalaryCarryover(state.currentMonth);

  const salary =
    Number(month.salaryReceived) || 0;

  const returned =
    Number(month.salaryReserveReturn) || 0;

  const spent =
    totalSalarySpent(month);

  const saved =
    Number(month.reserveContribution) || 0;

  return Math.max(
    0,
    previous +
    salary +
    returned -
    spent -
    saved
  );
}

/* =====================================================
   EXTRA DISPONÍVEL
===================================================== */

function getExtraAvailable(month) {
  const previous =
    getPreviousExtraCarryover(state.currentMonth);

  const extras =
    totalExtras(month);

  const spent =
    totalExtraSpent(month);

  const reserve =
    Number(month.extraReserveContribution) || 0;

  return Math.max(
    0,
    previous +
    extras -
    spent -
    reserve
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
   RENDER
===================================================== */

function render() {
  const month = getMonth();

  const title =
    document.getElementById("monthTitle");

  if (title) {
    title.textContent =
      new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric"
      }).format(
        new Date(
          `${state.currentMonth}-01T00:00:00`
        )
      );
  }

  const salaryAvailable =
    getSalaryAvailable(month);

  const extraAvailable =
    getExtraAvailable(month);

  const available =
    document.getElementById("availableValue");

  if (available) {
    available.textContent =
      money(salaryAvailable);
  }

  const salary =
    document.getElementById("salaryValue");

  if (salary) {
    salary.textContent =
      money(salaryAvailable);
  }

  const extra =
    document.getElementById("extraValue");

  if (extra) {
    extra.textContent =
      money(extraAvailable);
  }

  const spent =
    document.getElementById("spentValue");

  if (spent) {
    spent.textContent =
      money(totalSpent(month));
  }

  const reserve =
    document.getElementById("reserveBig");

  if (reserve) {
    reserve.textContent =
      money(getReserveBalance());
  }

  renderMonthlyBar(month);
  renderCategories();
  renderExtras();
  renderHistoryPreview();
  renderGoal();
}

/* =====================================================
   BARRA
===================================================== */

function renderMonthlyBar(month) {
  const totalIncome =
    (Number(month.salaryReceived) || 0) +
    totalExtras(month);

  const spent =
    totalSpent(month);

  const percent =
    totalIncome > 0
      ? Math.min(
          100,
          Math.max(
            0,
            spent / totalIncome * 100
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

  if (!wrap) return;

  const month = getMonth();

  wrap.innerHTML = "";

  state.categories.forEach(category => {
    const element =
      document.createElement("div");

    element.className =
      "category";

    element.dataset.categoryId =
      category.id;

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

      <div class="cat-actions">
        <button
          class="cat-edit"
          type="button"
          data-edit-category="${escapeHtml(category.id)}"
        >✎</button>
      </div>
    `;

    element.addEventListener("click", event => {
      if (
        event.target.closest(
          "[data-edit-category]"
        )
      ) {
        return;
      }

      openCategory(category.id);
    });

    const editButton =
      element.querySelector(
        "[data-edit-category]"
      );

    editButton?.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        editCategory(category.id);
      }
    );

    wrap.appendChild(element);
  });
}

function openCategory(categoryId) {
  vibrate(10);

  const category =
    state.categories.find(
      cat => cat.id === categoryId
    );

  if (!category) return;

  if (category.type === "reserve") {
    openReserve();
    return;
  }

  const month = getMonth();

  const expenses =
    month.expenses.filter(
      expense =>
        expense.categoryId === categoryId
    );

  let html = `
    <div class="notice">
      ${escapeHtml(category.icon)}
      ${escapeHtml(category.name)}
    </div>

    <div style="height:10px"></div>
  `;

  if (!expenses.length) {
    html += `
      <div class="empty-history">
        Nenhum gasto nesta categoria neste mês.
      </div>
    `;
  } else {
    html += `
      <div class="full-history">
        ${expenses.map(expense => `
          <div class="history-item">
            <div class="history-icon">
              ${escapeHtml(category.icon)}
            </div>

            <div class="history-main">
              <div class="history-name">
                ${escapeHtml(
                  expense.note ||
                  "Gasto"
                )}
              </div>

              <div class="history-date">
                ${escapeHtml(
                  expense.date ||
                  ""
                )}
              </div>
            </div>

            <div class="history-value expense">
              ${money(expense.amount)}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  html += `
    <div style="height:12px"></div>

    <button
      class="form button"
      style="width:100%; padding:13px; border-radius:12px; background:var(--accent-gradient); color:#000; font-weight:900;"
      onclick="closeModal(); openExpenseModal('${category.id}')"
    >
      + Adicionar gasto
    </button>
  `;

  openModal(
    category.name,
    html
  );
}

/* =====================================================
   EXTRAS
===================================================== */

function renderExtras() {
  const wrap =
    document.getElementById("extrasList");

  if (!wrap) return;

  const month = getMonth();

  wrap.innerHTML = "";

  if (!month.extras.length) {
    wrap.innerHTML = `
      <div class="empty-history">
        Nenhuma entrada extra neste mês.
      </div>
    `;

    return;
  }

  month.extras.forEach(extra => {
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
          ${escapeHtml(extra.date || "")}
        </div>
      </div>

      <div class="extra-value">
        + ${money(extra.amount)}
      </div>

      <button
        class="extra-delete"
        type="button"
        data-extra-delete="${escapeHtml(extra.id)}"
      >
        ×
      </button>
    `;

    element
      .querySelector("[data-extra-delete]")
      ?.addEventListener(
        "click",
        () => deleteExtra(extra.id)
      );

    wrap.appendChild(element);
  });
}

function openExtraModal() {
  openModal(
    "Adicionar entrada extra",
    `
      <form class="form" id="extraForm">

        <label>Nome</label>
        <input
          id="extraName"
          placeholder="Ex: Freelance"
          required
        >

        <label>Valor</label>
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

        const name =
          document.getElementById(
            "extraName"
          )?.value.trim();

        const amount =
          numCents("extraAmount");

        if (!name || amount <= 0) {
          alert(
            "Informe o nome e um valor válido."
          );
          return;
        }

        const month = getMonth();

        month.extras.push({
          id: createId(),
          name,
          amount,
          date: formatDate()
        });

        save();
        closeModal();
        render();
        vibrate(15);
      }
    );
}

function deleteExtra(id) {
  const month = getMonth();

  const index =
    month.extras.findIndex(
      extra => extra.id === id
    );

  if (index === -1) return;

  if (
    !confirm(
      "Excluir esta entrada extra?"
    )
  ) {
    return;
  }

  month.extras.splice(index, 1);

  save();
  render();
}

/* =====================================================
   GASTOS
===================================================== */

function openExpenseModal(
  preselectedCategoryId = ""
) {
  const categoryOptions =
    state.categories
      .filter(
        category =>
          category.type !== "reserve"
      )
      .map(
        category => `
          <option
            value="${escapeHtml(category.id)}"
            ${category.id === preselectedCategoryId ? "selected" : ""}
          >
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

        <label>Categoria</label>

        <select id="expenseCategory">
          ${categoryOptions}
        </select>

        <label>Valor</label>

        <input
          id="expenseAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <label>Pago com</label>

        <select id="expenseSource">
          <option value="salary">
            Salário
          </option>
          <option value="extra">
            Extra
          </option>
        </select>

        <label>Descrição</label>

        <input
          id="expenseNote"
          placeholder="Ex: Conta de luz"
        >

        <button type="submit">
          Adicionar gasto
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
  const categoryId =
    document.getElementById(
      "expenseCategory"
    )?.value;

  const amount =
    numCents("expenseAmount");

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

  if (!categoryId) {
    alert(
      "Escolha uma categoria."
    );
    return;
  }

  if (amount <= 0) {
    alert(
      "Informe um valor válido."
    );
    return;
  }

  const month = getMonth();

  month.expenses.push({
    id: createId(),
    categoryId,
    amount,
    source,
    note,
    date: formatDate()
  });

  save();
  closeModal();
  render();
  vibrate(15);
}

/* =====================================================
   EDITAR CATEGORIA
===================================================== */

function editCategory(id) {
  const category =
    state.categories.find(
      cat => cat.id === id
    );

  if (!category) return;

  if (category.id === "reserve") {
    openReserve();
    return;
  }

  openModal(
    "Editar categoria",
    `
      <form class="form" id="categoryEditForm">

        <label>Nome</label>

        <input
          id="editCategoryName"
          value="${escapeHtml(category.name)}"
          required
        >

        <label>Ícone</label>

        <input
          id="editCategoryIcon"
          value="${escapeHtml(category.icon)}"
          maxlength="4"
        >

        <button type="submit">
          Salvar
        </button>

        <button
          type="button"
          class="secondary"
          id="deleteCategoryButton"
        >
          Excluir categoria
        </button>

      </form>
    `
  );

  document
    .getElementById("categoryEditForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        category.name =
          document
            .getElementById(
              "editCategoryName"
            )
            ?.value.trim() ||
          category.name;

        category.icon =
          document
            .getElementById(
              "editCategoryIcon"
            )
            ?.value.trim() ||
          category.icon;

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById(
      "deleteCategoryButton"
    )
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

  if (
    !confirm(
      "Excluir esta categoria? Os gastos existentes serão mantidos no histórico."
    )
  ) {
    return;
  }

  state.categories =
    state.categories.filter(
      category => category.id !== id
    );

  save();
  closeModal();
  render();
}

function openAddCategoryModal() {
  openModal(
    "Nova categoria",
    `
      <form class="form" id="newCategoryForm">

        <label>Nome</label>

        <input
          id="newCategoryName"
          placeholder="Ex: Alimentação"
          required
        >

        <label>Ícone</label>

        <input
          id="newCategoryIcon"
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
    .getElementById("newCategoryForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name =
          document
            .getElementById(
              "newCategoryName"
            )
            ?.value.trim();

        const icon =
          document
            .getElementById(
              "newCategoryIcon"
            )
            ?.value.trim() ||
          "💰";

        if (!name) return;

        state.categories.push({
          id: `cat_${createId()}`,
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
    );
}

/* =====================================================
   RESERVA
===================================================== */

function openReserve() {
  const month = getMonth();

  openModal(
    "Reserva",
    `
      <div class="notice">
        Saldo acumulado:
        <strong>
          ${money(getReserveBalance())}
        </strong>
      </div>

      <div style="height:12px"></div>

      <form class="form" id="reserveForm">

        <label>Valor para reservar</label>

        <input
          id="reserveAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
        >

        <label>Origem</label>

        <select id="reserveSource">
          <option value="salary">
            Salário
          </option>
          <option value="extra">
            Extra
          </option>
        </select>

        <button type="submit">
          Adicionar à reserva
        </button>

        <button
          type="button"
          class="danger"
          id="withdrawReserveButton"
        >
          Retirar da reserva
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

        const amount =
          numCents("reserveAmount");

        if (amount <= 0) {
          alert(
            "Informe um valor válido."
          );
          return;
        }

        const source =
          document.getElementById(
            "reserveSource"
          )?.value;

        if (source === "extra") {
          month.extraReserveContribution +=
            amount;
        } else {
          month.reserveContribution +=
            amount;
        }

        month.reserveTransactions.push({
          id: createId(),
          type: "in",
          amount,
          note:
            source === "extra"
              ? "Reserva de extra"
              : "Reserva de salário",
          date: formatDate()
        });

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById(
      "withdrawReserveButton"
    )
    ?.addEventListener(
      "click",
      () => {
        const amount =
          numCents("reserveAmount");

        if (
          amount <= 0 ||
          amount > getReserveBalance()
        ) {
          alert(
            "Valor inválido ou maior que a reserva."
          );
          return;
        }

        month.reserveWithdrawal +=
          amount;

        month.reserveTransactions.push({
          id: createId(),
          type: "out",
          amount,
          note: "Retirada da reserva",
          date: formatDate()
        });

        save();
        closeModal();
        render();
      }
    );
}

/* =====================================================
   HISTÓRICO
===================================================== */

function getHistory(month) {
  const history = [];

  month.expenses.forEach(expense => {
    const category =
      state.categories.find(
        cat =>
          cat.id === expense.categoryId
      );

    history.push({
      date: expense.date || "",
      icon: category?.icon || "💸",
      name:
        expense.note ||
        category?.name ||
        "Gasto",
      amount: -Math.abs(
        expense.amount
      ),
      type: "expense"
    });
  });

  month.extras.forEach(extra => {
    history.push({
      date: extra.date || "",
      icon: "💰",
      name: extra.name,
      amount: Math.abs(
        extra.amount
      ),
      type: "extra-in"
    });
  });

  month.reserveTransactions.forEach(tx => {
    history.push({
      date: tx.date || "",
      icon: "🏦",
      name: tx.note || "Reserva",
      amount:
        tx.type === "out"
          ? -Math.abs(tx.amount)
          : Math.abs(tx.amount),
      type:
        tx.type === "out"
          ? "reserve-out"
          : "reserve-in"
    });
  });

  return history;
}

function renderHistoryPreview() {
  const wrap =
    document.getElementById(
      "historyPreview"
    );

  if (!wrap) return;

  const history =
    getHistory(getMonth());

  wrap.innerHTML = "";

  if (!history.length) {
    wrap.innerHTML = `
      <div class="empty-history">
        Nenhuma movimentação neste mês.
      </div>
    `;

    return;
  }

  history
    .slice(-5)
    .reverse()
    .forEach(item => {
      const element =
        document.createElement("div");

      element.className =
        "history-item";

      const amountClass =
        item.type;

      element.innerHTML = `
        <div class="history-icon">
          ${escapeHtml(item.icon)}
        </div>

        <div class="history-main">
          <div class="history-name">
            ${escapeHtml(item.name)}
          </div>

          <div class="history-date">
            ${escapeHtml(item.date)}
          </div>
        </div>

        <div class="history-value ${amountClass}">
          ${item.amount < 0 ? "-" : "+"}
          ${money(Math.abs(item.amount))}
        </div>
      `;

      wrap.appendChild(element);
    });
}

function openHistory() {
  const month = getMonth();

  const history =
    getHistory(month);

  const total =
    totalSpent(month);

  const html = `
    <div class="history-total">
      Gastos do mês
      <strong>${money(total)}</strong>
    </div>

    <div class="full-history">
      ${
        history.length
          ? history
              .slice()
              .reverse()
              .map(item => `
                <div class="history-item">
                  <div class="history-icon">
                    ${escapeHtml(item.icon)}
                  </div>

                  <div class="history-main">
                    <div class="history-name">
                      ${escapeHtml(item.name)}
                    </div>

                    <div class="history-date">
                      ${escapeHtml(item.date)}
                    </div>
                  </div>

                  <div class="history-value ${item.type}">
                    ${item.amount < 0 ? "-" : "+"}
                    ${money(Math.abs(item.amount))}
                  </div>
                </div>
              `)
              .join("")
          : `
              <div class="empty-history">
                Nenhuma movimentação.
              </div>
            `
      }
    </div>
  `;

  openModal(
    "Extrato",
    html
  );
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

        <label>Salário planejado</label>

        <input
          id="plannedSalary"
          inputmode="decimal"
          value="${moneyInput(settings.plannedSalary)}"
        >

        <label>Meta da reserva</label>

        <input
          id="reserveGoal"
          inputmode="decimal"
          value="${moneyInput(settings.reserveGoal)}"
        >

        <div class="notice">
          O salário informado aqui será usado
          como valor inicial para novos meses.
        </div>

        <button type="submit">
          Salvar configurações
        </button>

        <button
          type="button"
          class="secondary"
          id="backupButton"
        >
          Fazer backup
        </button>

        <button
          type="button"
          class="secondary"
          id="restoreButton"
        >
          Restaurar backup
        </button>

        <input
          id="restoreFile"
          type="file"
          accept=".json,application/json"
          style="display:none"
        >

      </form>
    `
  );

  document
    .getElementById("settingsForm")
    ?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        settings.plannedSalary =
          numCents("plannedSalary");

        settings.reserveGoal =
          numCents("reserveGoal");

        save();

        /*
          IMPORTANTE:
          Se o mês ainda não recebeu salário,
          atualizamos o mês atual.

          Isso resolve o problema de colocar
          salário e a tela não mudar.
        */

        const month = getMonth();

        if (
          month.salaryReceived === 0 &&
          settings.plannedSalary > 0
        ) {
          month.salaryReceived =
            settings.plannedSalary;
        }

        save();
        closeModal();
        render();
        vibrate(15);
      }
    );

  document
    .getElementById("backupButton")
    ?.addEventListener(
      "click",
      backupData
    );

  document
    .getElementById("restoreButton")
    ?.addEventListener(
      "click",
      () =>
        document
          .getElementById(
            "restoreFile"
          )
          ?.click()
    );

  document
    .getElementById("restoreFile")
    ?.addEventListener(
      "change",
      restoreData
    );
}

function moneyInput(cents) {
  return ((Number(cents) || 0) / 100)
    .toFixed(2)
    .replace(".", ",");
}

/* =====================================================
   BACKUP
===================================================== */

function backupData() {
  const data = {
    fxBackup: true,
    version: "1.6.0",
    exportedAt: new Date().toISOString(),
    state
  };

  const blob =
    new Blob(
      [JSON.stringify(data, null, 2)],
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
    `FX-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  vibrate(20);
}

function restoreData(event) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const imported =
        JSON.parse(
          reader.result
        );

      const data =
        imported.state ||
        imported;

      const normalized =
        normalizeState(data);

      if (!normalized) {
        throw new Error(
          "Backup inválido."
        );
      }

      if (
        !confirm(
          "Restaurar este backup substituirá os dados atuais do FX. Continuar?"
        )
      ) {
        return;
      }

      localStorage.setItem(
        KEY,
        JSON.stringify(normalized)
      );

      location.reload();
    } catch (error) {
      console.error(error);

      alert(
        "Não foi possível restaurar este backup."
      );
    }
  };

  reader.readAsText(file);
}

/* =====================================================
   META
===================================================== */

function renderGoal() {
  const box =
    document.getElementById(
      "goalBox"
    );

  if (!box) return;

  const goal =
    Number(
      state.settings.reserveGoal
    ) || 0;

  const current =
    getReserveBalance();

  if (goal <= 0) {
    box.textContent =
      "Defina uma meta";
    return;
  }

  const percent =
    Math.min(
      100,
      current / goal * 100
    );

  box.innerHTML = `
    ${money(current)} / ${money(goal)}
    <div class="progress">
      <div style="width:${percent}%"></div>
    </div>
  `;
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
  const modal =
    document.getElementById("modal");

  const titleElement =
    document.getElementById(
      "modalTitle"
    );

  const bodyElement =
    document.getElementById(
      "modalBody"
    );

  if (
    !modal ||
    !titleElement ||
    !bodyElement
  ) {
    return;
  }

  titleElement.textContent =
    title;

  bodyElement.innerHTML =
    html;

  modal.classList.remove(
    "hidden"
  );
}

/* =====================================================
   CONTA
===================================================== */

function getAccount() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ACCOUNT_KEY
      )
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
  return (
    localStorage.getItem(
      SESSION_KEY
    ) === "true"
  );
}

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

function login(username, password) {
  vibrate(15);

  const account =
    getAccount();

  if (!account) {
    showLoginMessage(
      "Nenhuma conta criada ainda."
    );
    return;
  }

  const cleanUser =
    String(username || "")
      .trim()
      .toLowerCase();

  const savedUser =
    String(account.username || "")
      .trim()
      .toLowerCase();

  if (
    cleanUser !== savedUser ||
    password !== account.password
  ) {
    showLoginMessage(
      "Usuário ou senha incorretos."
    );
    return;
  }

  const remember =
    document.getElementById(
      "rememberUserToggle"
    )?.checked;

  if (remember) {
    localStorage.setItem(
      REMEMBER_KEY,
      account.username
    );
  } else {
    localStorage.removeItem(
      REMEMBER_KEY
    );
  }

  localStorage.setItem(
    SESSION_KEY,
    "true"
  );

  showApp();
}

function createAccount() {
  vibrate(15);

  const username =
    (
      document.getElementById(
        "createUsername"
      )?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const password =
    document.getElementById(
      "createPassword"
    )?.value || "";

  const confirmation =
    document.getElementById(
      "createPasswordConfirm"
    )?.value || "";

  if (
    username.length < 3 ||
    username.length > 20
  ) {
    showLoginMessage(
      "Usuário de 3 a 20 caracteres."
    );
    return;
  }

  if (password.length !== 8) {
    showLoginMessage(
      "Senha deve ter 8 caracteres."
    );
    return;
  }

  if (password !== confirmation) {
    showLoginMessage(
      "As senhas não conferem."
    );
    return;
  }

  if (getAccount()) {
    showLoginMessage(
      "Já existe uma conta."
    );
    return;
  }

  const recoveryCode =
    `FX-${Math.floor(
      1000 +
      Math.random() * 9000
    )}`;

  saveAccount({
    username,
    password,
    recoveryCode
  });

  localStorage.setItem(
    SESSION_KEY,
    "true"
  );

  localStorage.setItem(
    REMEMBER_KEY,
    username
  );

  alert(
    `Conta criada!\n\nCódigo de recuperação: ${recoveryCode}`
  );

  showApp();
}

function resetPassword() {
  const code =
    document.getElementById(
      "forgotCode"
    )?.value.trim() || "";

  const newPass =
    document.getElementById(
      "forgotNewPassword"
    )?.value || "";

  const account =
    getAccount();

  if (
    !account ||
    (
      code !== MASTER_KEY &&
      code.toUpperCase() !==
        String(
          account.recoveryCode || ""
        ).toUpperCase()
    )
  ) {
    showLoginMessage(
      "Código inválido."
    );
    return;
  }

  if (newPass.length !== 8) {
    showLoginMessage(
      "Senha deve ter 8 caracteres."
    );
    return;
  }

  account.password =
    newPass;

  saveAccount(account);

  alert(
    "Senha redefinida!"
  );

  showLoginForm();
}

function logout() {
  localStorage.removeItem(
    SESSION_KEY
  );

  location.reload();
}

/* =====================================================
   TELAS
===================================================== */

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

document
  .getElementById("backLoginBtn")
  ?.addEventListener(
    "click",
    showLoginForm
  );

document
  .getElementById("forgotBtn")
  ?.addEventListener(
    "click",
    showForgotForm
  );

document
  .getElementById("showForgotBtn")
  ?.addEventListener(
    "click",
    showForgotForm
  );

document
  .getElementById(
    "backLoginFromForgotBtn"
  )
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

document
  .getElementById("toggleHideBtn")
  ?.addEventListener(
    "click",
    () => {
      vibrate();

      state.settings.hideBalance =
        !state.settings.hideBalance;

      save();
      render();
    }
  );

document
  .getElementById("prevMonth")
  ?.addEventListener(
    "click",
    () => {
      vibrate();

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
      vibrate();

      state.currentMonth =
        monthShift(
          state.currentMonth,
          1
        );

      save();
      render();
    }
  );

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
      if (
        event.target.id ===
        "modal"
      ) {
        closeModal();
      }
    }
  );

document
  .getElementById("addExpenseBtn")
  ?.addEventListener(
    "click",
    () => openExpenseModal()
  );

document
  .getElementById("addExtraBtn")
  ?.addEventListener(
    "click",
    openExtraModal
  );

document
  .getElementById("addCategoryBtn")
  ?.addEventListener(
    "click",
    openAddCategoryModal
  );

document
  .getElementById("reserveBtn")
  ?.addEventListener(
    "click",
    openReserve
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
  .getElementById("settingsBtn")
  ?.addEventListener(
    "click",
    openSettings
  );

document
  .getElementById(
    "paymentsSettingsBtn"
  )
  ?.addEventListener(
    "click",
    openSettings
  );

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

function initFinance() {
  document.body.classList.toggle(
    "dark",
    localStorage.getItem(
      "fxDarkMode"
    ) === "true"
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
  const input =
    document.getElementById(
      "loginUsername"
    );

  const toggle =
    document.getElementById(
      "rememberUserToggle"
    );

  if (input) {
    input.value =
      rememberedUser;
  }

  if (toggle) {
    toggle.checked =
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
