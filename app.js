/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 2.0.0
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const MASTER_KEY = "Fx020919";

const APP_VERSION = "2.0.0";

/* =====================================================
   VIBRAÇÃO
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

let state = load() || createInitialState();

function createInitialState() {
  return {
    version: APP_VERSION,

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

    currentMonth: monthKey(new Date()),

    reserveBalance: 0
  };
}

/* =====================================================
   CONTA
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

/* =====================================================
   LOGIN
===================================================== */

function login(username, password) {
  vibrate(15);

  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta criada ainda.");
    return;
  }

  const cleanUser = String(username || "")
    .trim()
    .toLowerCase();

  const savedUser = String(account.username || "")
    .trim()
    .toLowerCase();

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
    document.getElementById("createUsername")?.value
      .trim()
      .toLowerCase() || "";

  const password =
    document.getElementById("createPassword")?.value || "";

  const confirmation =
    document.getElementById("createPasswordConfirm")?.value || "";

  if (username.length < 3 || username.length > 20) {
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
    document.getElementById("forgotCode")?.value
      .trim() || "";

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
    showLoginMessage(
      "Senha deve ter 8 caracteres."
    );
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
    return createInitialState();
  }

  data.version = APP_VERSION;

  /* SETTINGS */

  if (
    !data.settings ||
    typeof data.settings !== "object"
  ) {
    data.settings = {};
  }

  data.settings.plannedSalary =
    parseToCents(
      data.settings.plannedSalary
    );

  data.settings.salarySplitEnabled =
    Boolean(
      data.settings.salarySplitEnabled
    );

  data.settings.advancePercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          data.settings.advancePercent
        ) || 40
      )
    );

  data.settings.advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        Number(
          data.settings.advanceDay
        ) || 20
      )
    );

  data.settings.mainPaymentLabel =
    String(
      data.settings.mainPaymentLabel ||
      "5º dia útil"
    ).trim();

  data.settings.reserveGoal =
    parseToCents(
      data.settings.reserveGoal
    );

  data.settings.hideBalance =
    Boolean(
      data.settings.hideBalance
    );

  /* CATEGORIAS */

  if (!Array.isArray(data.categories)) {
    data.categories =
      defaultCategories.map(cat => ({
        ...cat
      }));
  }

  data.categories =
    data.categories.map(category => ({
      id:
        category.id ||
        "cat_" + createId(),

      name:
        String(
          category.name || "Categoria"
        ).trim(),

      icon:
        String(
          category.icon || "💰"
        ).trim(),

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

  data.categories.forEach(category => {
    if (
      category.id !== "reserve" &&
      category.type === "reserve"
    ) {
      category.type = "expense";
    }
  });

  /* MESES */

  if (
    !data.months ||
    typeof data.months !== "object"
  ) {
    data.months = {};
  }

  Object.values(data.months).forEach(month => {
    normalizeMonth(month);
  });

  data.reserveBalance =
    parseToCents(data.reserveBalance);

  if (
    typeof data.currentMonth !== "string"
  ) {
    data.currentMonth =
      monthKey(new Date());
  }

  return data;
}

function normalizeMonth(month) {
  if (!month || typeof month !== "object") {
    return;
  }

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

  month.salaryReserveReturn =
    parseToCents(
      month.salaryReserveReturn
    );

  month.reserveContribution =
    parseToCents(
      month.reserveContribution
    );

  month.extraReserveContribution =
    parseToCents(
      month.extraReserveContribution
    );

  month.reserveWithdrawal =
    parseToCents(
      month.reserveWithdrawal
    );

  month.expenses =
    month.expenses.map(expense => ({
      ...expense,

      id:
        expense.id ||
        createId(),

      amount:
        parseToCents(expense.amount),

      categoryId:
        expense.categoryId || "fixed",

      source:
        expense.source === "extra"
          ? "extra"
          : "salary",

      note:
        String(
          expense.note || ""
        ).trim(),

      date:
        expense.date ||
        new Date().toISOString()
    }));

  month.extras =
    month.extras.map(extra => ({
      ...extra,

      id:
        extra.id ||
        createId(),

      amount:
        parseToCents(extra.amount),

      name:
        String(
          extra.name || "Entrada extra"
        ).trim(),

      date:
        extra.date ||
        new Date().toISOString()
    }));

  month.reserveTransactions =
    month.reserveTransactions.map(tx => ({
      ...tx,

      id:
        tx.id ||
        createId(),

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
        String(
          tx.note || ""
        ).trim(),

      date:
        tx.date ||
        new Date().toISOString()
    }));
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
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value);
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
    text =
      text
        .replace(/\./g, "")
        .replace(",", ".");

    const parts =
      text.split(".");

    const integerPart =
      parts[0] || "0";

    const decimalPart =
      parts[1] || "";

    const integer =
      parseInt(
        integerPart.replace(/\D/g, "") || "0",
        10
      );

    const decimal =
      decimalPart
        .replace(/\D/g, "")
        .padEnd(2, "0")
        .slice(0, 2);

    return (
      integer * 100 +
      parseInt(decimal || "0", 10)
    );
  }

  const cleaned =
    text.replace(/[^0-9.-]/g, "");

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function numCents(id) {
  const element =
    document.getElementById(id);

  if (!element) {
    return 0;
  }

  return parseToCents(
    element.value
  );
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
        getPlannedSalaryForMonth(key),

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

  normalizeMonth(
    state.months[key]
  );

  return state.months[key];
}

/* =====================================================
   SALÁRIO PADRÃO PARA NOVOS MESES
===================================================== */

function getPlannedSalaryForMonth(key) {
  const configured =
    Number(
      state.settings.plannedSalary
    ) || 0;

  if (configured <= 0) {
    return 0;
  }

  /*
     O salário definido em configurações
     passa a ser padrão para meses futuros.

     Não copiamos o salário de um mês
     para outro depois que o mês já existe.
  */

  return configured;
}

/* =====================================================
   CÁLCULOS BÁSICOS
===================================================== */

function categorySpent(id, month) {
  return month.expenses
    .filter(
      expense =>
        expense.categoryId === id
    )
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

function totalSalarySpent(month) {
  return month.expenses
    .filter(
      expense =>
        expense.source !== "extra"
    )
    .reduce(
      (sum, expense) =>
        sum + (Number(expense.amount) || 0),
      0
    );
}

function totalExtraSpent(month) {
  return month.expenses
    .filter(
      expense =>
        expense.source === "extra"
    )
    .reduce(
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

/* =====================================================
   SALDO ANTERIOR DO SALÁRIO
===================================================== */

function getPreviousSalaryCarryover(currentKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) {
        return;
      }

      const month =
        state.months[key];

      carry +=
        (Number(month.salaryReceived) || 0) +
        (Number(month.salaryReserveReturn) || 0) -
        totalSalarySpent(month) -
        (Number(month.reserveContribution) || 0);
    });

  return carry;
}

/* =====================================================
   SALDO ANTERIOR DOS EXTRAS
===================================================== */

function getPreviousExtraCarryover(currentKey) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) {
        return;
      }

      const month =
        state.months[key];

      carry +=
        totalExtras(month) -
        totalExtraSpent(month) -
        (Number(month.extraReserveContribution) || 0);
    });

  return carry;
}

/* =====================================================
   SALDO DO SALÁRIO
===================================================== */

function getSalaryAvailable(month) {
  const previous =
    getPreviousSalaryCarryover(
      state.currentMonth
    );

  const salary =
    Number(month.salaryReceived) || 0;

  const returned =
    Number(month.salaryReserveReturn) || 0;

  const spent =
    totalSalarySpent(month);

  const saved =
    Number(month.reserveContribution) || 0;

  /*
     NÃO usamos Math.max(0).

     Se o usuário gastar mais do que possui,
     o FX mostra o saldo negativo.

     Assim dinheiro nunca desaparece
     magicamente.
  */

  return (
    previous +
    salary +
    returned -
    spent -
    saved
  );
}

/* =====================================================
   SALDO DOS EXTRAS
===================================================== */

function getExtraAvailable(month) {
  const previous =
    getPreviousExtraCarryover(
      state.currentMonth
    );

  const extras =
    totalExtras(month);

  const spent =
    totalExtraSpent(month);

  const reserve =
    Number(
      month.extraReserveContribution
    ) || 0;

  return (
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

  Object.values(state.months)
    .forEach(month => {

      totalIn +=
        Number(
          month.reserveContribution
        ) || 0;

      totalIn +=
        Number(
          month.extraReserveContribution
        ) || 0;

      totalOut +=
        Number(
          month.reserveWithdrawal
        ) || 0;
    });

  return totalIn - totalOut;
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
  const month =
    getMonth();

  syncReserve();

  renderMonthTitle();
  renderMainValues();
  renderMonthlyProgress();
  renderCategories();
  renderExtras();
  renderHistoryPreview();
  renderPayments();
  renderReserveGoal();
}

function renderMonthTitle() {
  const title =
    document.getElementById(
      "monthTitle"
    );

  if (!title) {
    return;
  }

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

function renderMainValues() {
  const month =
    getMonth();

  const salaryAvailable =
    getSalaryAvailable(month);

  const extraAvailable =
    getExtraAvailable(month);

  const available =
    document.getElementById(
      "availableValue"
    );

  if (available) {
    available.textContent =
      money(salaryAvailable);

    available.style.color =
      salaryAvailable < 0
        ? "var(--danger)"
        : "";
  }

  const hint =
    document.getElementById(
      "availableHint"
    );

  if (hint) {
    if (salaryAvailable < 0) {
      hint.textContent =
        `Você ultrapassou o saldo do salário em ${money(
          Math.abs(salaryAvailable)
        )}.`;
    } else {
      hint.textContent =
        "Disponível do salário. Extras ficam separados.";
    }
  }

  const salary =
    document.getElementById(
      "salaryValue"
    );

  if (salary) {
    salary.textContent =
      money(salaryAvailable);
  }

  const extra =
    document.getElementById(
      "extraValue"
    );

  if (extra) {
    extra.textContent =
      money(extraAvailable);

    extra.style.color =
      extraAvailable < 0
        ? "var(--danger)"
        : "";
  }

  const spent =
    document.getElementById(
      "spentValue"
    );

  if (spent) {
    spent.textContent =
      money(totalSpent(month));
  }

  const reserve =
    document.getElementById(
      "reserveBig"
    );

  if (reserve) {
    reserve.textContent =
      money(state.reserveBalance);
  }
}

function renderMonthlyProgress() {
  const month =
    getMonth();

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
    document.getElementById(
      "monthlyBar"
    );

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
    document.getElementById(
      "categories"
    );

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
            (Number(
              month.reserveContribution
            ) || 0) +
            (Number(
              month.extraReserveContribution
            ) || 0)
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
        <strong>
          ${money(value)}
        </strong>
      </div>

      <div class="cat-actions">
        <button
          class="cat-edit"
          type="button"
          data-category="${escapeHtml(category.id)}"
        >
          ⋮
        </button>
      </div>
    `;

    wrap.appendChild(element);
  });

  wrap
    .querySelectorAll("[data-category]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          openCategoryMenu(
            button.dataset.category
          );
        }
      );
    });
}

function openCategoryMenu(id) {
  const category =
    state.categories.find(
      cat => cat.id === id
    );

  if (!category) {
    return;
  }

  if (category.id === "reserve") {
    openReserveModal();
    return;
  }

  openModal(
    category.name,
    `
      <div class="form">

        <button
          type="button"
          id="editCategoryAction"
        >
          ✏️ Editar categoria
        </button>

        <button
          type="button"
          class="danger"
          id="deleteCategoryAction"
        >
          🗑️ Excluir categoria
        </button>

      </div>
    `
  );

  document
    .getElementById("editCategoryAction")
    ?.addEventListener(
      "click",
      () => {
        openCategoryForm(category.id);
      }
    );

  document
    .getElementById("deleteCategoryAction")
    ?.addEventListener(
      "click",
      () => {
        deleteCategory(category.id);
      }
    );
}

function openCategoryForm(id = null) {
  const category =
    id
      ? state.categories.find(
          cat => cat.id === id
        )
      : null;

  openModal(
    id
      ? "Editar categoria"
      : "Nova categoria",

    `
      <div class="form">

        <label>Nome</label>
        <input
          id="categoryNameInput"
          value="${escapeHtml(
            category?.name || ""
          )}"
          placeholder="Ex: Alimentação"
        >

        <label>Ícone</label>
        <input
          id="categoryIconInput"
          value="${escapeHtml(
            category?.icon || "💰"
          )}"
          maxlength="4"
          placeholder="🍔"
        >

        <button
          type="button"
          id="saveCategoryAction"
        >
          Salvar categoria
        </button>

      </div>
    `
  );

  document
    .getElementById("saveCategoryAction")
    ?.addEventListener(
      "click",
      () => {

        const name =
          document
            .getElementById(
              "categoryNameInput"
            )
            ?.value
            .trim();

        const icon =
          document
            .getElementById(
              "categoryIconInput"
            )
            ?.value
            .trim();

        if (!name) {
          alert(
            "Digite o nome da categoria."
          );
          return;
        }

        if (category) {
          category.name = name;
          category.icon = icon || "💰";
        } else {
          state.categories.push({
            id:
              "cat_" + createId(),
            name,
            icon: icon || "💰",
            type: "expense",
            budget: 0
          });
        }

        save();
        closeModal();
        render();
      }
    );
}

function deleteCategory(id) {
  if (id === "reserve") {
    alert(
      "A categoria Reserva não pode ser excluída."
    );
    return;
  }

  const category =
    state.categories.find(
      cat => cat.id === id
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
      cat => cat.id !== id
    );

  save();
  closeModal();
  render();
}

/* =====================================================
   ADICIONAR GASTO
===================================================== */

function openExpenseModal() {
  const month =
    getMonth();

  const options =
    state.categories
      .filter(
        category =>
          category.type !== "reserve"
      )
      .map(
        category =>
          `
            <option value="${escapeHtml(
              category.id
            )}">
              ${escapeHtml(
                category.icon
              )} ${escapeHtml(
                category.name
              )}
            </option>
          `
      )
      .join("");

  openModal(
    "Adicionar gasto",
    `
      <div class="form">

        <label>Valor</label>
        <input
          id="expenseAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
        >

        <label>Categoria</label>
        <select id="expenseCategory">
          ${options}
        </select>

        <label>Origem do dinheiro</label>
        <select id="expenseSource">
          <option value="salary">
            Salário
          </option>
          <option value="extra">
            Extra
          </option>
        </select>

        <label>Observação</label>
        <input
          id="expenseNote"
          placeholder="Opcional"
        >

        <button
          type="button"
          id="saveExpenseAction"
        >
          Adicionar gasto
        </button>

      </div>
    `
  );

  document
    .getElementById("saveExpenseAction")
    ?.addEventListener(
      "click",
      addExpense
    );
}

function addExpense() {
  const amount =
    parseToCents(
      document.getElementById(
        "expenseAmount"
      )?.value
    );

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
    )?.value
      .trim() || "";

  if (amount <= 0) {
    alert(
      "Digite um valor válido."
    );
    return;
  }

  const month =
    getMonth();

  const salaryAvailable =
    getSalaryAvailable(month);

  const extraAvailable =
    getExtraAvailable(month);

  const available =
    source === "extra"
      ? extraAvailable
      : salaryAvailable;

  /*
     AQUI ESTÁ A CORREÇÃO DO
     DINHEIRO FANTASMA.

     Se não existe dinheiro suficiente,
     não permitimos criar um gasto
     que apareça como se tivesse sido pago.
  */

  if (amount > available) {
    alert(
      `Saldo insuficiente.\n\nDisponível: ${money(
        available
      )}\nGasto: ${money(
        amount
      )}`
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
    date:
      new Date().toISOString()
  });

  save();

  closeModal();
  render();
}

/* =====================================================
   EXTRAS
===================================================== */

function openExtraModal() {
  openModal(
    "Adicionar entrada extra",
    `
      <div class="form">

        <label>Nome</label>
        <input
          id="extraName"
          placeholder="Ex: Freelance"
        >

        <label>Valor</label>
        <input
          id="extraAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
        >

        <button
          type="button"
          id="saveExtraAction"
        >
          Adicionar extra
        </button>

      </div>
    `
  );

  document
    .getElementById("saveExtraAction")
    ?.addEventListener(
      "click",
      addExtra
    );
}

function addExtra() {
  const name =
    document.getElementById(
      "extraName"
    )?.value
      .trim() || "Entrada extra";

  const amount =
    parseToCents(
      document.getElementById(
        "extraAmount"
      )?.value
    );

  if (amount <= 0) {
    alert(
      "Digite um valor válido."
    );
    return;
  }

  const month =
    getMonth();

  month.extras.push({
    id: createId(),
    name,
    amount,
    date:
      new Date().toISOString()
  });

  save();

  closeModal();
  render();
}

function renderExtras() {
  const list =
    document.getElementById(
      "extrasList"
    );

  if (!list) {
    return;
  }

  const month =
    getMonth();

  if (!month.extras.length) {
    list.innerHTML = `
      <div class="empty-history">
        Nenhuma entrada extra neste mês.
      </div>
    `;
    return;
  }

  list.innerHTML =
    month.extras
      .slice()
      .reverse()
      .map(
        extra => `
          <div class="extra-item">

            <div class="extra-icon">
              💰
            </div>

            <div class="extra-main">
              <div class="extra-name">
                ${escapeHtml(
                  extra.name
                )}
              </div>

              <div class="extra-date">
                ${formatDate(
                  extra.date
                )}
              </div>
            </div>

            <div class="extra-value">
              +${money(
                extra.amount
              )}
            </div>

            <button
              type="button"
              class="extra-delete"
              data-extra="${escapeHtml(
                extra.id
              )}"
            >
              ✕
            </button>

          </div>
        `
      )
      .join("");

  list
    .querySelectorAll(
      "[data-extra]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          deleteExtra(
            button.dataset.extra
          );
        }
      );
    });
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

  if (
    !confirm(
      `Excluir "${extra.name}"?`
    )
  ) {
    return;
  }

  month.extras =
    month.extras.filter(
      item => item.id !== id
    );

  save();
  render();
}

/* =====================================================
   RESERVA
===================================================== */

function openReserveModal() {
  const month =
    getMonth();

  openModal(
    "Gerenciar reserva",
    `
      <div class="form">

        <div class="notice">
          Reserva atual:
          <strong>
            ${money(
              state.reserveBalance
            )}
          </strong>
        </div>

        <label>Valor</label>
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

        <button
          type="button"
          id="reserveAddAction"
        >
          Guardar na reserva
        </button>

        <button
          type="button"
          class="secondary"
          id="reserveWithdrawAction"
        >
          Retirar da reserva
        </button>

      </div>
    `
  );

  document
    .getElementById(
      "reserveAddAction"
    )
    ?.addEventListener(
      "click",
      addReserve
    );

  document
    .getElementById(
      "reserveWithdrawAction"
    )
    ?.addEventListener(
      "click",
      withdrawReserve
    );
}

function addReserve() {
  const amount =
    parseToCents(
      document.getElementById(
        "reserveAmount"
      )?.value
    );

  const source =
    document.getElementById(
      "reserveSource"
    )?.value === "extra"
      ? "extra"
      : "salary";

  if (amount <= 0) {
    alert(
      "Digite um valor válido."
    );
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
      `Saldo insuficiente.\n\nDisponível: ${money(
        available
      )}`
    );
    return;
  }

  if (source === "extra") {
    month.extraReserveContribution +=
      amount;
  } else {
    month.reserveContribution +=
      amount;
  }

  month.reserveTransactions.push({
    id: createId(),
    amount,
    type: "in",
    source,
    note: "Entrada na reserva",
    date:
      new Date().toISOString()
  });

  save();
  closeModal();
  render();
}

function withdrawReserve() {
  const amount =
    parseToCents(
      document.getElementById(
        "reserveAmount"
      )?.value
    );

  if (amount <= 0) {
    alert(
      "Digite um valor válido."
    );
    return;
  }

  if (amount > state.reserveBalance) {
    alert(
      `A reserva possui apenas ${money(
        state.reserveBalance
      )}.`
    );
    return;
  }

  const month =
    getMonth();

  month.reserveWithdrawal +=
    amount;

  month.reserveTransactions.push({
    id: createId(),
    amount,
    type: "out",
    source: "reserve",
    note: "Retirada da reserva",
    date:
      new Date().toISOString()
  });

  save();
  closeModal();
  render();
}

/* =====================================================
   META DA RESERVA
===================================================== */

function renderReserveGoal() {
  const box =
    document.getElementById(
      "goalBox"
    );

  if (!box) {
    return;
  }

  const goal =
    Number(
      state.settings.reserveGoal
    ) || 0;

  if (goal <= 0) {
    box.textContent =
      "Sem meta definida";
    return;
  }

  const current =
    Math.max(
      0,
      state.reserveBalance
    );

  const percent =
    Math.min(
      100,
      (current / goal) * 100
    );

  box.textContent =
    `${money(current)} / ${money(goal)} • ${Math.round(
      percent
    )}%`;
}

/* =====================================================
   HISTÓRICO
===================================================== */

function buildHistory(month) {
  const entries = [];

  month.expenses.forEach(expense => {
    const category =
      state.categories.find(
        cat =>
          cat.id === expense.categoryId
      );

    entries.push({
      date:
        expense.date,
      name:
        category?.name ||
        "Gasto",
      icon:
        category?.icon ||
        "💸",
      amount:
        -Math.abs(
          expense.amount
        ),
      className:
        "expense",
      note:
        expense.source === "extra"
          ? "Pago com extra"
          : "Pago com salário"
    });
  });

  month.extras.forEach(extra => {
    entries.push({
      date:
        extra.date,
      name:
        extra.name,
      icon:
        "💰",
      amount:
        extra.amount,
      className:
        "extra-in",
      note:
        "Entrada extra"
    });
  });

  month.reserveTransactions.forEach(tx => {
    entries.push({
      date:
        tx.date,
      name:
        tx.type === "in"
          ? "Reserva"
          : "Retirada da reserva",
      icon:
        "🏦",
      amount:
        tx.type === "in"
          ? tx.amount
          : -tx.amount,
      className:
        tx.type === "in"
          ? "reserve-in"
          : "reserve-out",
      note:
        tx.note || ""
    });
  });

  return entries.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );
}

function renderHistoryPreview() {
  const wrap =
    document.getElementById(
      "historyPreview"
    );

  if (!wrap) {
    return;
  }

  const history =
    buildHistory(
      getMonth()
    ).slice(0, 5);

  if (!history.length) {
    wrap.innerHTML = `
      <div class="empty-history">
        Nenhuma movimentação neste mês.
      </div>
    `;
    return;
  }

  wrap.innerHTML =
    history
      .map(
        item => `
          <div class="history-item">

            <div class="history-icon">
              ${escapeHtml(
                item.icon
              )}
            </div>

            <div class="history-main">

              <div class="history-name">
                ${escapeHtml(
                  item.name
                )}
              </div>

              <div class="history-date">
                ${formatDate(
                  item.date
                )}
              </div>

              <div class="history-note">
                ${escapeHtml(
                  item.note
                )}
              </div>

            </div>

            <div
              class="history-value ${item.className}"
            >
              ${
                item.amount >= 0
                  ? "+"
                  : "-"
              }${money(
                Math.abs(
                  item.amount
                )
              )}
            </div>

          </div>
        `
      )
      .join("");
}

function openHistory() {
  const history =
    buildHistory(
      getMonth()
    );

  const total =
    totalSpent(
      getMonth()
    );

  openModal(
    "Extrato",
    `
      <div class="history-total">
        Gastos no mês
        <strong>
          ${money(total)}
        </strong>
      </div>

      <div class="full-history">

        ${
          history.length
            ? history
                .map(
                  item => `
                    <div class="history-item">

                      <div class="history-icon">
                        ${escapeHtml(
                          item.icon
                        )}
                      </div>

                      <div class="history-main">
                        <div class="history-name">
                          ${escapeHtml(
                            item.name
                          )}
                        </div>

                        <div class="history-date">
                          ${formatDate(
                            item.date
                          )}
                        </div>

                        <div class="history-note">
                          ${escapeHtml(
                            item.note
                          )}
                        </div>
                      </div>

                      <div
                        class="history-value ${item.className}"
                      >
                        ${
                          item.amount >= 0
                            ? "+"
                            : "-"
                        }${money(
                          Math.abs(
                            item.amount
                          )
                        )}
                      </div>

                    </div>
                  `
                )
                .join("")
            : `
                <div class="empty-history">
                  Nenhuma movimentação.
                </div>
              `
        }

      </div>
    `
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
      <div class="form">

        <label>Salário mensal</label>
        <input
          id="settingsSalary"
          inputmode="decimal"
          value="${formatInputMoney(
            settings.plannedSalary
          )}"
          placeholder="R$ 0,00"
        >

        <div class="dark-mode-row">
          <span>
            Dividir salário
          </span>

          <label class="theme-switch">
            <input
              type="checkbox"
              id="salarySplitToggle"
              ${
                settings.salarySplitEnabled
                  ? "checked"
                  : ""
              }
            >
            <span class="theme-slider">
              <span class="theme-dot"></span>
            </span>
          </label>
        </div>

        <div
          id="salarySplitOptions"
          ${
            settings.salarySplitEnabled
              ? ""
              : 'style="display:none"'
          }
        >

          <label>
            Percentual do adiantamento
          </label>

          <input
            id="advancePercentInput"
            type="number"
            min="0"
            max="100"
            value="${
              settings.advancePercent
            }"
          >

          <label>
            Dia do adiantamento
          </label>

          <input
            id="advanceDayInput"
            type="number"
            min="1"
            max="31"
            value="${
              settings.advanceDay
            }"
          >

          <label>
            Pagamento principal
          </label>

          <input
            id="mainPaymentLabelInput"
            value="${escapeHtml(
              settings.mainPaymentLabel
            )}"
          >

        </div>

        <label>
          Meta da reserva
        </label>

        <input
          id="reserveGoalInput"
          inputmode="decimal"
          value="${formatInputMoney(
            settings.reserveGoal
          )}"
          placeholder="R$ 0,00"
        >

        <button
          type="button"
          id="saveSettingsAction"
        >
          Salvar configurações
        </button>

        <button
          type="button"
          class="secondary"
          id="backupExportAction"
        >
          💾 Fazer backup
        </button>

        <button
          type="button"
          class="secondary"
          id="backupImportAction"
        >
          📥 Restaurar backup
        </button>

        <input
          type="file"
          id="backupFileInput"
          accept=".json,application/json"
          class="hidden"
        >

      </div>
    `
  );

  const toggle =
    document.getElementById(
      "salarySplitToggle"
    );

  toggle?.addEventListener(
    "change",
    () => {
      const options =
        document.getElementById(
          "salarySplitOptions"
        );

      if (options) {
        options.style.display =
          toggle.checked
            ? "grid"
            : "none";
      }
    }
  );

  document
    .getElementById(
      "saveSettingsAction"
    )
    ?.addEventListener(
      "click",
      saveSettings
    );

  document
    .getElementById(
      "backupExportAction"
    )
    ?.addEventListener(
      "click",
      exportBackup
    );

  document
    .getElementById(
      "backupImportAction"
    )
    ?.addEventListener(
      "click",
      () =>
        document
          .getElementById(
            "backupFileInput"
          )
          ?.click()
    );

  document
    .getElementById(
      "backupFileInput"
    )
    ?.addEventListener(
      "change",
      importBackup
    );
}

function saveSettings() {
  const oldSalary =
    Number(
      state.settings.plannedSalary
    ) || 0;

  const salary =
    parseToCents(
      document.getElementById(
        "settingsSalary"
      )?.value
    );

  const split =
    Boolean(
      document.getElementById(
        "salarySplitToggle"
      )?.checked
    );

  const percent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          document.getElementById(
            "advancePercentInput"
          )?.value
        ) || 0
      )
    );

  const advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        Number(
          document.getElementById(
            "advanceDayInput"
          )?.value
        ) || 20
      )
    );

  const label =
    document.getElementById(
      "mainPaymentLabelInput"
    )?.value
      .trim() ||
    "5º dia útil";

  const goal =
    parseToCents(
      document.getElementById(
        "reserveGoalInput"
      )?.value
    );

  state.settings.plannedSalary =
    salary;

  state.settings.salarySplitEnabled =
    split;

  state.settings.advancePercent =
    percent;

  state.settings.advanceDay =
    advanceDay;

  state.settings.mainPaymentLabel =
    label;

  state.settings.reserveGoal =
    goal;

  /*
     CORREÇÃO IMPORTANTE:

     Ao alterar o salário, o mês atual
     recebe o novo salário.

     Meses futuros que ainda não possuem
     salário também recebem a nova
     configuração quando forem criados.
  */

  const current =
    getMonth();

  if (
    oldSalary !== salary ||
    Number(current.salaryReceived) === 0
  ) {
    current.salaryReceived =
      salary;
  }

  save();

  closeModal();
  render();
}

/* =====================================================
   PAGAMENTOS
===================================================== */

function renderPayments() {
  const card =
    document.querySelector(
      ".payments-card"
    );

  if (!card) {
    return;
  }

  if (
    !state.settings.salarySplitEnabled
  ) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  const salary =
    Number(
      getMonth().salaryReceived
    ) || 0;

  const advance =
    Math.round(
      salary *
      (
        Number(
          state.settings.advancePercent
        ) || 0
      ) /
      100
    );

  const main =
    salary - advance;

  const advanceValue =
    document.getElementById(
      "advanceValue"
    );

  const mainValue =
    document.getElementById(
      "mainPayValue"
    );

  if (advanceValue) {
    advanceValue.textContent =
      money(advance);
  }

  if (mainValue) {
    mainValue.textContent =
      money(main);
  }

  const advanceDate =
    document.getElementById(
      "advanceDate"
    );

  const mainDate =
    document.getElementById(
      "mainPayDate"
    );

  if (advanceDate) {
    advanceDate.textContent =
      `Dia ${state.settings.advanceDay}`;
  }

  if (mainDate) {
    mainDate.textContent =
      state.settings.mainPaymentLabel;
  }
}

/* =====================================================
   BACKUP
===================================================== */

function exportBackup() {
  const backup = {
    app: "FX",
    version: APP_VERSION,
    exportedAt:
      new Date().toISOString(),
    data: state
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

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  link.href = url;
  link.download =
    `FX-backup-${date}.json`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}

function importBackup(event) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const parsed =
        JSON.parse(
          reader.result
        );

      const imported =
        parsed.data || parsed;

      const normalized =
        normalizeState(
          imported
        );

      if (
        !normalized ||
        typeof normalized !== "object" ||
        !normalized.months
      ) {
        throw new Error(
          "Backup inválido."
        );
      }

      if (
        !confirm(
          "Restaurar este backup irá substituir os dados atuais do FX. Continuar?"
        )
      ) {
        return;
      }

      state = normalized;

      save();

      alert(
        "Backup restaurado com sucesso!"
      );

      location.reload();

    } catch (error) {
      console.error(error);

      alert(
        "Não foi possível restaurar o backup."
      );
    }
  };

  reader.readAsText(file);

  event.target.value = "";
}

/* =====================================================
   NAVEGAÇÃO
===================================================== */

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

/* =====================================================
   MODAL
===================================================== */

function closeModal() {
  const modal =
    document.getElementById(
      "modal"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }
}

function openModal(title, html) {
  const titleElement =
    document.getElementById(
      "modalTitle"
    );

  const bodyElement =
    document.getElementById(
      "modalBody"
    );

  const modal =
    document.getElementById(
      "modal"
    );

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

  modal.classList.remove(
    "hidden"
  );
}

/* =====================================================
   UTILITÁRIOS
===================================================== */

function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
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

function formatDate(date) {
  if (!date) {
    return "--";
  }

  try {
    return new Intl.DateTimeFormat(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    ).format(
      new Date(date)
    );
  } catch {
    return "--";
  }
}

function formatInputMoney(cents) {
  return (
    (Number(cents) || 0) / 100
  )
    .toFixed(2)
    .replace(".", ",");
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
  const loginScreen =
    document.getElementById(
      "loginScreen"
    );

  const appScreen =
    document.getElementById(
      "appScreen"
    );

  if (loginScreen) {
    loginScreen.classList.add(
      "hidden"
    );
  }

  if (appScreen) {
    appScreen.classList.remove(
      "hidden"
    );
  }

  initFinance();
}

function showCreateAccount() {
  document
    .getElementById(
      "loginForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "forgotForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "createForm"
    )
    ?.classList.remove(
      "hidden"
    );

  showLoginMessage("");
}

function showLoginForm() {
  document
    .getElementById(
      "createForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "forgotForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "loginForm"
    )
    ?.classList.remove(
      "hidden"
    );

  showLoginMessage("");
}

function showForgotForm() {
  document
    .getElementById(
      "loginForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "createForm"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "forgotForm"
    )
    ?.classList.remove(
      "hidden"
    );

  showLoginMessage("");
}

/* =====================================================
   EVENTOS LOGIN
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
  .getElementById("resetPasswordBtn")
  ?.addEventListener(
    "click",
    resetPassword
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
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    logout
  );

/* =====================================================
   VALORES OCULTOS
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
   BOTÕES PRINCIPAIS
===================================================== */

document
  .getElementById("addExpenseBtn")
  ?.addEventListener(
    "click",
    openExpenseModal
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
    () =>
      openCategoryForm()
  );

document
  .getElementById("reserveBtn")
  ?.addEventListener(
    "click",
    openReserveModal
  );

document
  .getElementById("settingsBtn")
  ?.addEventListener(
    "click",
    openSettings
  );

document
  .getElementById("paymentsSettingsBtn")
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
      if (
        event.target.id ===
        "modal"
      ) {
        closeModal();
      }
    }
  );

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

function initFinance() {
  state =
    normalizeState(
      state
    );

  document.body.classList.toggle(
    "dark",
    localStorage.getItem(
      "fxDarkMode"
    ) === "true"
  );

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
    .getElementById(
      "loginScreen"
    )
    ?.classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "appScreen"
    )
    ?.classList.add(
      "hidden"
    );
       }
