/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 3.2.0
===================================================== */

const KEY = "fx_finance_v3";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const MASTER_KEY = "Fx020919";
const APP_VERSION = "3.2.0";

/*
  DIVISÃO FIXA DO SALÁRIO

  40% = adiantamento
  60% = pagamento principal

  Esses valores NÃO são editáveis pelo usuário.
*/
const ADVANCE_PERCENT = 40;
const MAIN_PAYMENT_PERCENT = 60;

/* =====================================================
   UTILITÁRIOS
===================================================== */

function vibrate(ms = 12) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {}
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
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
    Math.random().toString(36).substring(2, 10)
  );
}

function formatDate(date) {
  if (!date) return "--";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(date));
  } catch {
    return "--";
  }
}

function formatInputMoney(cents) {
  return ((Number(cents) || 0) / 100)
    .toFixed(2)
    .replace(".", ",");
}

/*
  Todos os valores financeiros internos são CENTAVOS.

  Exemplos:
  R$ 10,00 = 1000
  R$ 50,00 = 5000
*/
function money(cents) {
  if (state.settings.hideBalance) {
    return "R$ ••••";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format((Number(cents) || 0) / 100);
}

function parseToCents(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;

    /*
      Números vindos do estado já estão em centavos.
    */
    return Math.round(value);
  }

  let text = String(value)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  if (!text) return 0;

  /*
    Formato brasileiro:
    1.234,56
  */
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");

    const parts = text.split(".");

    const integerPart =
      parseInt(
        (parts[0] || "0").replace(/\D/g, ""),
        10
      ) || 0;

    const decimalPart = (parts[1] || "")
      .replace(/\D/g, "")
      .padEnd(2, "0")
      .slice(0, 2);

    return (
      integerPart * 100 +
      (parseInt(decimalPart, 10) || 0)
    );
  }

  /*
    Formato sem vírgula:
    1234 = R$ 1.234,00
    1234.50 = R$ 1.234,50
  */
  const cleaned = text.replace(/[^0-9.-]/g, "");

  if (!cleaned) return 0;

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
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

      /*
        Apenas SIM ou NÃO.
        A divisão sempre será 40/60.
      */
      salarySplitEnabled: false,

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
   CARREGAMENTO / PERSISTÊNCIA
===================================================== */

function load() {
  try {
    const raw = localStorage.getItem(KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    return normalizeState(parsed);
  } catch (error) {
    console.error(
      "FX: erro ao carregar dados:",
      error
    );

    return null;
  }
}

function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error(
      "FX: erro ao salvar dados:",
      error
    );

    alert(
      "Não foi possível salvar os dados do FX neste dispositivo."
    );
  }
}

/* =====================================================
   NORMALIZAÇÃO DO ESTADO
===================================================== */

function normalizeState(data) {
  if (!data || typeof data !== "object") {
    return createInitialState();
  }

  if (
    !data.settings ||
    typeof data.settings !== "object"
  ) {
    data.settings = {};
  }

  data.version = APP_VERSION;

  data.settings.plannedSalary =
    parseToCents(
      data.settings.plannedSalary
    );

  data.settings.reserveGoal =
    parseToCents(
      data.settings.reserveGoal
    );

  /*
    A divisão do salário agora é fixa.
    Não existe mais percentual configurável.
  */

  data.settings.salarySplitEnabled =
    Boolean(
      data.settings.salarySplitEnabled
    );

  data.settings.advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        safeNumber(
          data.settings.advanceDay,
          20
        )
      )
    );

  data.settings.hideBalance =
    Boolean(
      data.settings.hideBalance
    );

  data.settings.mainPaymentLabel =
    String(
      data.settings.mainPaymentLabel ||
      "5º dia útil"
    );

  /* Categorias */

  if (!Array.isArray(data.categories)) {
    data.categories =
      defaultCategories.map(cat => ({
        ...cat
      }));
  }

  data.categories =
    data.categories
      .filter(
        cat =>
          cat &&
          typeof cat === "object"
      )
      .map(cat => ({
        id:
          String(
            cat.id ||
            createId()
          ),

        name:
          String(
            cat.name ||
            "Categoria"
          ),

        icon:
          String(
            cat.icon ||
            "💰"
          ),

        type:
          cat.type === "reserve"
            ? "reserve"
            : "expense",

        budget:
          parseToCents(
            cat.budget
          )
      }));

  /*
    Reserva é obrigatória.
  */

  if (
    !data.categories.some(
      category =>
        category.id === "reserve"
    )
  ) {
    data.categories.unshift({
      id: "reserve",
      name: "Reserva",
      icon: "🏦",
      type: "reserve",
      budget: 0
    });
  }

  /* Meses */

  if (
    !data.months ||
    typeof data.months !== "object"
  ) {
    data.months = {};
  }

  Object.values(
    data.months
  ).forEach(
    normalizeMonth
  );

  if (
    typeof data.currentMonth !== "string" ||
    !/^\d{4}-\d{2}$/.test(
      data.currentMonth
    )
  ) {
    data.currentMonth =
      monthKey(new Date());
  }

  data.reserveBalance =
    calculateReserveBalance(data);

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
    parseToCents(
      month.salaryReceived
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

  /*
    Normaliza gastos antigos.
  */

  month.expenses =
    month.expenses
      .filter(
        expense =>
          expense &&
          typeof expense === "object"
      )
      .map(expense => ({
        id:
          String(
            expense.id ||
            createId()
          ),

        amount:
          Math.max(
            0,
            parseToCents(
              expense.amount
            )
          ),

        categoryId:
          String(
            expense.categoryId ||
            "fixed"
          ),

        source:
          expense.source === "extra"
            ? "extra"
            : "salary",

        note:
          String(
            expense.note ||
            ""
          ),

        date:
          expense.date ||
          new Date().toISOString()
      }));

  /*
    Normaliza entradas extras.
  */

  month.extras =
    month.extras
      .filter(
        extra =>
          extra &&
          typeof extra === "object"
      )
      .map(extra => ({
        id:
          String(
            extra.id ||
            createId()
          ),

        name:
          String(
            extra.name ||
            "Entrada extra"
          ),

        amount:
          Math.max(
            0,
            parseToCents(
              extra.amount
            )
          ),

        date:
          extra.date ||
          new Date().toISOString()
      }));

  /*
    Normaliza transações da reserva.
  */

  month.reserveTransactions =
    month.reserveTransactions
      .filter(
        transaction =>
          transaction &&
          typeof transaction === "object"
      )
      .map(transaction => ({
        id:
          String(
            transaction.id ||
            createId()
          ),

        amount:
          Math.max(
            0,
            parseToCents(
              transaction.amount
            )
          ),

        type:
          transaction.type === "out"
            ? "out"
            : "in",

        source:
          transaction.source ||
          "reserve",

        note:
          String(
            transaction.note ||
            ""
          ),

        date:
          transaction.date ||
          new Date().toISOString()
      }));
}

/* =====================================================
   DATAS / MESES
===================================================== */

function monthKey(date) {
  return (
    `${date.getFullYear()}-` +
    `${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`
  );
}

function getMonth(
  key = state.currentMonth
) {
  if (!state.months[key]) {
    state.months[key] = {
      salaryReceived:
        Number(
          state.settings.plannedSalary
        ) || 0,

      expenses: [],

      extras: [],

      reserveContribution: 0,

      extraReserveContribution: 0,

      reserveWithdrawal: 0,

      reserveTransactions: []
    };

    save();
  }

  normalizeMonth(
    state.months[key]
  );

  return state.months[key];
}

function monthShift(
  key,
  delta
) {
  const [
    year,
    month
  ] = key
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
   CÁLCULOS FINANCEIROS
===================================================== */

function salarySpent(month) {
  return month.expenses
    .filter(
      expense =>
        expense.source !== "extra"
    )
    .reduce(
      (sum, expense) =>
        sum + expense.amount,
      0
    );
}

function extraSpent(month) {
  return month.expenses
    .filter(
      expense =>
        expense.source === "extra"
    )
    .reduce(
      (sum, expense) =>
        sum + expense.amount,
      0
    );
}

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum + extra.amount,
    0
  );
}

function getPreviousSalaryCarryover(
  currentKey
) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) {
        return;
      }

      const month =
        state.months[key];

      const remaining =
        (month.salaryReceived || 0) -
        salarySpent(month) -
        (month.reserveContribution || 0);

      carry += remaining;
    });

  return carry;
}

function getPreviousExtraCarryover(
  currentKey
) {
  let carry = 0;

  Object.keys(state.months)
    .sort()
    .forEach(key => {
      if (key >= currentKey) {
        return;
      }

      const month =
        state.months[key];

      const remaining =
        totalExtras(month) -
        extraSpent(month) -
        (month.extraReserveContribution || 0);

      carry += remaining;
    });

  return carry;
}

function getSalaryAvailable(
  month,
  key = state.currentMonth
) {
  const previous =
    getPreviousSalaryCarryover(
      key
    );

  const salary =
    month.salaryReceived || 0;

  const spent =
    salarySpent(month);

  const saved =
    month.reserveContribution || 0;

  return (
    previous +
    salary -
    spent -
    saved
  );
}

function getExtraAvailable(
  month,
  key = state.currentMonth
) {
  const previous =
    getPreviousExtraCarryover(
      key
    );

  const extras =
    totalExtras(month);

  const spent =
    extraSpent(month);

  const saved =
    month.extraReserveContribution || 0;

  return (
    previous +
    extras -
    spent -
    saved
  );
}

function calculateReserveBalance(
  sourceState = state
) {
  let totalIn = 0;
  let totalOut = 0;

  Object.values(
    sourceState.months || {}
  ).forEach(month => {
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

  return (
    totalIn -
    totalOut
  );
}

function syncReserve() {
  state.reserveBalance =
    calculateReserveBalance();

  save();
}

function totalSpent(month) {
  return month.expenses.reduce(
    (sum, expense) =>
      sum + expense.amount,
    0
  );
}

function categorySpent(
  categoryId,
  month
) {
  return month.expenses
    .filter(
      expense =>
        expense.categoryId ===
        categoryId
    )
    .reduce(
      (sum, expense) =>
        sum + expense.amount,
      0
    );
}

/* =====================================================
   RENDER PRINCIPAL
===================================================== */

function render() {
  const month = getMonth();

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
  const element =
    document.getElementById(
      "monthTitle"
    );

  if (!element) return;

  const date =
    new Date(
      `${state.currentMonth}-01T00:00:00`
    );

  element.textContent =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        month: "long",
        year: "numeric"
      }
    ).format(date);
}

function renderMainValues() {
  const month = getMonth();

  const salaryAvailable =
    getSalaryAvailable(
      month
    );

  const extraAvailable =
    getExtraAvailable(
      month
    );

  const spent =
    totalSpent(month);

  const availableElement =
    document.getElementById(
      "availableValue"
    );

  if (availableElement) {
    availableElement.textContent =
      money(
        salaryAvailable
      );

    availableElement.style.color =
      salaryAvailable < 0
        ? "var(--danger)"
        : "";
  }

  const hint =
    document.getElementById(
      "availableHint"
    );

  if (hint) {
    if (
      salaryAvailable < 0
    ) {
      hint.textContent =
        `Você ultrapassou o saldo do salário em ${money(
          Math.abs(
            salaryAvailable
          )
        )}.`;
    } else {
      hint.textContent =
        "Disponível do salário. Extras ficam separados.";
    }
  }

  const salaryElement =
    document.getElementById(
      "salaryValue"
    );

  if (salaryElement) {
    salaryElement.textContent =
      money(
        salaryAvailable
      );
  }

  const extraElement =
    document.getElementById(
      "extraValue"
    );

  if (extraElement) {
    extraElement.textContent =
      money(
        extraAvailable
      );

    extraElement.style.color =
      extraAvailable < 0
        ? "var(--danger)"
        : "";
  }

  const spentElement =
    document.getElementById(
      "spentValue"
    );

  if (spentElement) {
    spentElement.textContent =
      money(spent);
  }

  const reserveElement =
    document.getElementById(
      "reserveBig"
    );

  if (reserveElement) {
    reserveElement.textContent =
      money(
        state.reserveBalance
      );
  }
}

/* =====================================================
   PROGRESSO DO MÊS
===================================================== */

function renderMonthlyProgress() {
  const month = getMonth();

  const salary =
    month.salaryReceived || 0;

  const extras =
    totalExtras(month);

  const totalIncome =
    salary + extras;

  const spent =
    totalSpent(month);

  const percent =
    totalIncome > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              spent /
              totalIncome
            ) * 100
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
      `${Math.round(
        percent
      )}% gasto`;
  }
}

/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {
  const wrapper =
    document.getElementById(
      "categories"
    );

  if (!wrapper) return;

  const month = getMonth();

  wrapper.innerHTML = "";

  state.categories.forEach(
    category => {
      const element =
        document.createElement(
          "div"
        );

      element.className =
        "category";

      const value =
        category.id === "reserve"
          ? (
              (
                month.reserveContribution ||
                0
              ) +
              (
                month.extraReserveContribution ||
                0
              )
            )
          : categorySpent(
              category.id,
              month
            );

      element.innerHTML = `
        <div class="cat-icon">
          ${escapeHtml(
            category.icon
          )}
        </div>

        <div class="cat-main">
          <div class="cat-name">
            ${escapeHtml(
              category.name
            )}
          </div>

          <div class="cat-sub">
            Orçamento:
            ${money(
              category.budget
            )}
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
            data-category="${escapeHtml(
              category.id
            )}"
          >
            ⋮
          </button>
        </div>
      `;

      wrapper.appendChild(
        element
      );
    }
  );

  wrapper
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () =>
          openCategoryMenu(
            button.dataset.category
          )
      );
    });
}

function openCategoryMenu(id) {
  const category =
    state.categories.find(
      cat =>
        cat.id === id
    );

  if (!category) return;

  if (
    category.id ===
    "reserve"
  ) {
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
    .getElementById(
      "editCategoryAction"
    )
    ?.addEventListener(
      "click",
      () =>
        openCategoryForm(
          category.id
        )
    );

  document
    .getElementById(
      "deleteCategoryAction"
    )
    ?.addEventListener(
      "click",
      () =>
        deleteCategory(
          category.id
        )
    );
}

function openCategoryForm(
  id = null
) {
  const category =
    id
      ? state.categories.find(
          cat =>
            cat.id === id
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
            category?.name ||
            ""
          )}"
          placeholder="Ex: Alimentação"
        >

        <label>Ícone (Emoji)</label>

        <input
          id="categoryIconInput"
          value="${escapeHtml(
            category?.icon ||
            "💰"
          )}"
          maxlength="4"
          placeholder="🍔"
        >

        <label>
          Orçamento planejado (Opcional)
        </label>

        <input
          id="categoryBudgetInput"
          inputmode="decimal"
          value="${formatInputMoney(
            category?.budget ||
            0
          )}"
          placeholder="R$ 0,00"
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
    .getElementById(
      "saveCategoryAction"
    )
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

        const budget =
          parseToCents(
            document
              .getElementById(
                "categoryBudgetInput"
              )
              ?.value
          );

        if (!name) {
          alert(
            "Digite o nome da categoria."
          );

          return;
        }

        if (category) {
          category.name =
            name;

          category.icon =
            icon || "💰";

          category.budget =
            budget;
        } else {
          state.categories.push({
            id:
              "cat_" +
              createId(),

            name,

            icon:
              icon || "💰",

            type:
              "expense",

            budget
          });
        }

        save();

        closeModal();

        render();
      }
    );
}

function deleteCategory(id) {
  if (
    id === "reserve"
  ) {
    alert(
      "A categoria Reserva não pode ser excluída."
    );

    return;
  }

  const category =
    state.categories.find(
      cat =>
        cat.id === id
    );

  if (!category) return;

  const used =
    Object.values(
      state.months
    ).some(
      month =>
        month.expenses.some(
          expense =>
            expense.categoryId ===
            id
        )
    );

  if (used) {
    alert(
      "Essa categoria possui gastos registrados e não pode ser excluída."
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
      cat =>
        cat.id !== id
    );

  save();

  closeModal();

  render();
}

/* =====================================================
   GASTOS
===================================================== */

function openExpenseModal() {
  const options =
    state.categories
      .filter(
        category =>
          category.type !==
          "reserve"
      )
      .map(
        category =>
          `
          <option value="${escapeHtml(
            category.id
          )}">
            ${escapeHtml(
              category.icon
            )}
            ${escapeHtml(
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
          autofocus
        >

        <label>Categoria</label>

        <select id="expenseCategory">
          ${options}
        </select>

        <label>
          Origem do dinheiro
        </label>

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
    .getElementById(
      "saveExpenseAction"
    )
    ?.addEventListener(
      "click",
      addExpense
    );
}

function addExpense() {
  const amount =
    parseToCents(
      document
        .getElementById(
          "expenseAmount"
        )
        ?.value
    );

  const categoryId =
    document
      .getElementById(
        "expenseCategory"
      )
      ?.value ||
    "fixed";

  const source =
    document
      .getElementById(
        "expenseSource"
      )
      ?.value === "extra"
      ? "extra"
      : "salary";

  const note =
    document
      .getElementById(
        "expenseNote"
      )
      ?.value
      .trim() || "";

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
      ? getExtraAvailable(
          month
        )
      : getSalaryAvailable(
          month
        );

  /*
    O FX não permite gastar
    dinheiro que não existe
    naquela origem.
  */

  if (
    amount >
    available
  ) {
    alert(
      `Saldo insuficiente na origem escolhida!\n\n` +
      `Disponível: ${money(
        available
      )}\n` +
      `Gasto: ${money(
        amount
      )}`
    );

    return;
  }

  month.expenses.push({
    id:
      createId(),

    amount,

    categoryId,

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
   ENTRADAS EXTRAS
===================================================== */

function openExtraModal() {
  openModal(
    "Adicionar entrada extra",
    `
      <div class="form">

        <label>
          Nome da entrada
        </label>

        <input
          id="extraName"
          placeholder="Ex: Freelance, Venda"
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
    .getElementById(
      "saveExtraAction"
    )
    ?.addEventListener(
      "click",
      addExtra
    );
}

function addExtra() {
  const name =
    document
      .getElementById(
        "extraName"
      )
      ?.value
      .trim() ||
    "Entrada extra";

  const amount =
    parseToCents(
      document
        .getElementById(
          "extraAmount"
        )
        ?.value
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
    id:
      createId(),

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

  if (!list) return;

  const month =
    getMonth();

  if (!month.extras.length) {
    list.innerHTML =
      `
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
        extra =>
          `
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
        () =>
          deleteExtra(
            button.dataset.extra
          )
      );
    });
}

function deleteExtra(id) {
  const month =
    getMonth();

  const extra =
    month.extras.find(
      item =>
        item.id === id
    );

  if (!extra) return;

  if (
    !confirm(
      `Excluir "${extra.name}"?`
    )
  ) {
    return;
  }

  month.extras =
    month.extras.filter(
      item =>
        item.id !== id
    );

  save();

  render();
}

/* =====================================================
   RESERVA
===================================================== */

function openReserveModal() {
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

        <label>
          Origem do dinheiro
        </label>

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
      document
        .getElementById(
          "reserveAmount"
        )
        ?.value
    );

  const source =
    document
      .getElementById(
        "reserveSource"
      )
      ?.value === "extra"
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
      ? getExtraAvailable(
          month
        )
      : getSalaryAvailable(
          month
        );

  if (
    amount >
    available
  ) {
    alert(
      `Saldo insuficiente na origem!\n\n` +
      `Disponível: ${money(
        available
      )}`
    );

    return;
  }

  if (
    source === "extra"
  ) {
    month.extraReserveContribution +=
      amount;
  } else {
    month.reserveContribution +=
      amount;
  }

  month.reserveTransactions.push({
    id:
      createId(),

    amount,

    type:
      "in",

    source,

    note:
      "Entrada na reserva",

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
      document
        .getElementById(
          "reserveAmount"
        )
        ?.value
    );

  if (amount <= 0) {
    alert(
      "Digite um valor válido."
    );

    return;
  }

  if (
    amount >
    state.reserveBalance
  ) {
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
    id:
      createId(),

    amount,

    type:
      "out",

    source:
      "reserve",

    note:
      "Retirada da reserva",

    date:
      new Date().toISOString()
  });

  save();

  closeModal();

  render();
}

function renderReserveGoal() {
  const box =
    document.getElementById(
      "goalBox"
    );

  if (!box) return;

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
      (
        current /
        goal
      ) * 100
    );

  box.textContent =
    `${money(
      current
    )} / ${money(
      goal
    )} • ${Math.round(
      percent
    )}%`;
}

/* =====================================================
   HISTÓRICO
===================================================== */

function buildHistory(
  month
) {
  const entries = [];

  month.expenses.forEach(
    expense => {
      const category =
        state.categories.find(
          cat =>
            cat.id ===
            expense.categoryId
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
          -expense.amount,

        className:
          "expense",

        note:
          expense.source ===
          "extra"
            ? "Pago com extra"
            : "Pago com salário"
      });
    }
  );

  month.extras.forEach(
    extra => {
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
    }
  );

  month.reserveTransactions.forEach(
    transaction => {
      entries.push({
        date:
          transaction.date,

        name:
          transaction.type ===
          "in"
            ? "Reserva"
            : "Retirada da reserva",

        icon:
          "🏦",

        amount:
          transaction.type ===
          "in"
            ? transaction.amount
            : -transaction.amount,

        className:
          transaction.type ===
          "in"
            ? "reserve-in"
            : "reserve-out",

        note:
          transaction.note ||
          ""
      });
    }
  );

  return entries.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );
}

function renderHistoryPreview() {
  const wrapper =
    document.getElementById(
      "historyPreview"
    );

  if (!wrapper) return;

  const history =
    buildHistory(
      getMonth()
    ).slice(0, 5);

  if (!history.length) {
    wrapper.innerHTML =
      `
      <div class="empty-history">
        Nenhuma movimentação neste mês.
      </div>
      `;

    return;
  }

  wrapper.innerHTML =
    history
      .map(
        item =>
          `
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
  const month =
    getMonth();

  const history =
    buildHistory(
      month
    );

  const total =
    totalSpent(month);

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
                  item =>
                    `
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

        <label>
          Salário mensal padrão
        </label>

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

        <!--
          DIVISÃO FIXA:
          40% adiantamento
          60% pagamento principal
        -->

        <div
          id="salarySplitOptions"
          ${
            settings.salarySplitEnabled
              ? ""
              : 'style="display:none"'
          }
        >

          <div class="notice">
            Salário dividido automaticamente:
            <br><br>

            <strong>
              40% Adiantamento
            </strong>

            <br>

            <strong>
              60% Pagamento principal
            </strong>
          </div>

          <label>
            Dia do adiantamento
          </label>

          <input
            id="advanceDayInput"
            type="number"
            min="1"
            max="31"
            value="${settings.advanceDay}"
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
  const salary =
    parseToCents(
      document
        .getElementById(
          "settingsSalary"
        )
        ?.value
    );

  const split =
    Boolean(
      document
        .getElementById(
          "salarySplitToggle"
        )
        ?.checked
    );

  const advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        safeNumber(
          document
            .getElementById(
              "advanceDayInput"
            )
            ?.value,
          20
        )
      )
    );

  const label =
    document
      .getElementById(
        "mainPaymentLabelInput"
      )
      ?.value
      .trim() ||
    "5º dia útil";

  const goal =
    parseToCents(
      document
        .getElementById(
          "reserveGoalInput"
        )
        ?.value
    );

  state.settings.plannedSalary =
    salary;

  state.settings.salarySplitEnabled =
    split;

  /*
    40%/60% são fixos.
    Nunca recebem valor vindo do formulário.
  */

  state.settings.advanceDay =
    advanceDay;

  state.settings.mainPaymentLabel =
    label;

  state.settings.reserveGoal =
    goal;

  /*
    Só aplica o salário padrão
    ao mês atual se ainda
    não houver salário registrado.
  */

  const currentMonth =
    getMonth();

  if (
    currentMonth.salaryReceived ===
    0
  ) {
    currentMonth.salaryReceived =
      salary;
  }

  save();

  closeModal();

  render();
}

function renderPayments() {
  const card =
    document.querySelector(
      ".payments-card"
    );

  if (!card) return;

  if (
    !state.settings
      .salarySplitEnabled
  ) {
    card.classList.add(
      "hidden"
    );

    return;
  }

  card.classList.remove(
    "hidden"
  );

  const salary =
    Number(
      getMonth()
        .salaryReceived
    ) || 0;

  /*
    DIVISÃO FIXA DO SALÁRIO

    40% = adiantamento
    60% = pagamento principal

    O pagamento principal é calculado
    como o restante do salário para
    garantir que os dois valores nunca
    criem nem percam dinheiro.
  */

  const advance =
    Math.round(
      salary *
      ADVANCE_PERCENT /
      100
    );

  const main =
    salary -
    advance;

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
      money(
        advance
      );
  }

  if (mainValue) {
    mainValue.textContent =
      money(
        main
      );
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
      state.settings
        .mainPaymentLabel;
  }
}

/* =====================================================
   BACKUP
===================================================== */

function exportBackup() {
  const backup = {
    app: "FX",

    version:
      APP_VERSION,

    exportedAt:
      new Date().toISOString(),

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

  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  link.href =
    url;

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

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const parsed =
        JSON.parse(
          reader.result
        );

      const importedData =
        parsed.data ||
        parsed;

      const normalized =
        normalizeState(
          importedData
        );

      if (
        !normalized ||
        !normalized.months ||
        !normalized.categories
      ) {
        throw new Error(
          "Backup inválido."
        );
      }

      if (
        !confirm(
          "Restaurar este backup irá substituir os dados atuais. Continuar?"
        )
      ) {
        return;
      }

      state =
        normalized;

      save();

      alert(
        "Backup restaurado com sucesso!"
      );

      location.reload();

    } catch (error) {
      console.error(
        "FX: erro ao importar backup:",
        error
      );

      alert(
        "Não foi possível restaurar o backup."
      );
    }
  };

  reader.readAsText(
    file
  );

  event.target.value =
    "";
}

/* =====================================================
   CONTA / LOGIN
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

function saveAccount(
  account
) {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify(
      account
    )
  );
}

function isLogged() {
  return (
    localStorage.getItem(
      SESSION_KEY
    ) === "true"
  );
}

function login(
  username,
  password
) {
  vibrate(15);

  const account =
    getAccount();

  if (!account) {
    showLoginMessage(
      "Nenhuma conta criada ainda."
    );

    return;
  }

  if (
    username
      .trim()
      .toLowerCase() !==
      account.username ||
    password !==
      account.password
  ) {
    showLoginMessage(
      "Usuário ou senha incorretos."
    );

    return;
  }

  const remember =
    document.getElementById(
      "rememberUserToggle"
    );

  if (
    remember?.checked
  ) {
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
    document
      .getElementById(
        "createUsername"
      )
      ?.value
      .trim()
      .toLowerCase() ||
    "";

  const password =
    document
      .getElementById(
        "createPassword"
      )
      ?.value ||
    "";

  const confirmation =
    document
      .getElementById(
        "createPasswordConfirm"
      )
      ?.value ||
    "";

  if (
    username.length < 3 ||
    username.length > 20
  ) {
    showLoginMessage(
      "Usuário de 3 a 20 caracteres."
    );

    return;
  }

  if (
    password.length !== 8
  ) {
    showLoginMessage(
      "Senha deve ter 8 caracteres."
    );

    return;
  }

  if (
    password !==
    confirmation
  ) {
    showLoginMessage(
      "As senhas não conferem."
    );

    return;
  }

  if (
    getAccount()
  ) {
    showLoginMessage(
      "Já existe uma conta."
    );

    return;
  }

  const recoveryCode =
    `FX-${Math.floor(
      1000 +
      Math.random() *
      9000
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
    document
      .getElementById(
        "forgotCode"
      )
      ?.value
      .trim() ||
    "";

  const newPassword =
    document
      .getElementById(
        "forgotNewPassword"
      )
      ?.value ||
    "";

  const account =
    getAccount();

  if (
    !account ||
    (
      code !== MASTER_KEY &&
      code.toUpperCase() !==
        String(
          account.recoveryCode ||
          ""
        ).toUpperCase()
    )
  ) {
    showLoginMessage(
      "Código inválido."
    );

    return;
  }

  if (
    newPassword.length !== 8
  ) {
    showLoginMessage(
      "Senha deve ter 8 caracteres."
    );

    return;
  }

  account.password =
    newPassword;

  saveAccount(
    account
  );

  alert(
    "Senha redefinida com sucesso!"
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
   MODAIS
===================================================== */

function closeModal() {
  document
    .getElementById(
      "modal"
    )
    ?.classList.add(
      "hidden"
    );
}

function openModal(
  title,
  html
) {
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
   TELAS DE LOGIN
===================================================== */

function showLoginMessage(
  message
) {
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
    .getElementById(
      "loginScreen"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "appScreen"
    )
    ?.classList.remove(
      "hidden"
    );

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
   INICIALIZAÇÃO
===================================================== */

function initFinance() {
  state =
    normalizeState(
      state
    );

  getMonth();

  state.reserveBalance =
    calculateReserveBalance();

  save();

  render();
}

/* =====================================================
   EVENTOS
===================================================== */

document
  .getElementById(
    "loginBtn"
  )
  ?.addEventListener(
    "click",
    () => {
      login(
        document
          .getElementById(
            "loginUsername"
          )
          ?.value ||
          "",

        document
          .getElementById(
            "loginPassword"
          )
          ?.value ||
          ""
      );
    }
  );

document
  .getElementById(
    "createBtn"
  )
  ?.addEventListener(
    "click",
    createAccount
  );

document
  .getElementById(
    "showCreateBtn"
  )
  ?.addEventListener(
    "click",
    showCreateAccount
  );

document
  .getElementById(
    "backLoginBtn"
  )
  ?.addEventListener(
    "click",
    showLoginForm
  );

document
  .getElementById(
    "forgotBtn"
  )
  ?.addEventListener(
    "click",
    showForgotForm
  );

document
  .getElementById(
    "showForgotBtn"
  )
  ?.addEventListener(
    "click",
    showForgotForm
  );

document
  .getElementById(
    "resetPasswordBtn"
  )
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
  .getElementById(
    "logoutBtn"
  )
  ?.addEventListener(
    "click",
    logout
  );

/* Ocultar / mostrar valores */

document
  .getElementById(
    "toggleHideBtn"
  )
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

/* Mês anterior */

document
  .getElementById(
    "prevMonth"
  )
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

/* Próximo mês */

document
  .getElementById(
    "nextMonth"
  )
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

/* Gasto */

document
  .getElementById(
    "addExpenseBtn"
  )
  ?.addEventListener(
    "click",
    openExpenseModal
  );

/* Extra */

document
  .getElementById(
    "addExtraBtn"
  )
  ?.addEventListener(
    "click",
    openExtraModal
  );

/* Categoria */

document
  .getElementById(
    "addCategoryBtn"
  )
  ?.addEventListener(
    "click",
    () =>
      openCategoryForm()
  );

/* Reserva */

document
  .getElementById(
    "reserveBtn"
  )
  ?.addEventListener(
    "click",
    openReserveModal
  );

/* Configurações */

document
  .getElementById(
    "settingsBtn"
  )
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

/* Histórico */

document
  .getElementById(
    "historyBtn"
  )
  ?.addEventListener(
    "click",
    openHistory
  );

document
  .getElementById(
    "historyBtn2"
  )
  ?.addEventListener(
    "click",
    openHistory
  );

/* Fechar modal */

document
  .getElementById(
    "closeModal"
  )
  ?.addEventListener(
    "click",
    closeModal
  );

document
  .getElementById(
    "modal"
  )
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
   LOGIN AUTOMÁTICO / USUÁRIO LEMBRADO
===================================================== */

const remembered =
  localStorage.getItem(
    REMEMBER_KEY
  );

if (remembered) {
  const username =
    document.getElementById(
      "loginUsername"
    );

  const toggle =
    document.getElementById(
      "rememberUserToggle"
    );

  if (username) {
    username.value =
      remembered;
  }

  if (toggle) {
    toggle.checked =
      true;
  }
}

/* =====================================================
   START
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
