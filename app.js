/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.1.0
   Núcleo financeiro estável
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const DARK_KEY = "fxDarkMode";

/* =====================================================
   CATEGORIAS PADRÃO
===================================================== */

const defaultCategories = [
  {
    id: "fixed",
    name: "Gasto fixo",
    icon: "🏠",
    type: "expense",
    budget: 60000
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
    budget: 20000
  },
  {
    id: "leisure",
    name: "Lazer",
    icon: "🎮",
    type: "expense",
    budget: 20000
  },
  {
    id: "phone",
    name: "Celular",
    icon: "📱",
    type: "expense",
    budget: 3500
  }
];

/* =====================================================
   CONTA LOCAL
===================================================== */

function getAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY));
  } catch {
    return null;
  }
}

function saveAccount(account) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

function isLogged() {
  return localStorage.getItem(SESSION_KEY) === "true";
}

function login(username, password) {
  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta criada ainda.");
    return;
  }

  if (username !== account.username || password !== account.password) {
    showLoginMessage("Usuário ou senha incorretos.");
    return;
  }

  localStorage.setItem(SESSION_KEY, "true");
  showApp();
}

function createAccount() {
  const username =
    document.getElementById("createUsername").value.trim();

  const password =
    document.getElementById("createPassword").value;

  const confirmation =
    document.getElementById("createPasswordConfirm").value;

  if (username.length < 2 || username.length > 6) {
    showLoginMessage(
      "O usuário precisa ter de 2 a 6 caracteres."
    );
    return;
  }

  if (password.length !== 8) {
    showLoginMessage(
      "A senha precisa ter exatamente 8 caracteres."
    );
    return;
  }

  if (password !== confirmation) {
    showLoginMessage("As senhas não são iguais.");
    return;
  }

  if (getAccount()) {
    showLoginMessage(
      "Já existe uma conta neste aparelho."
    );
    return;
  }

  saveAccount({
    username,
    password
  });

  localStorage.setItem(SESSION_KEY, "true");
  showApp();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);

  document
    .getElementById("appScreen")
    .classList.add("hidden");

  document
    .getElementById("loginScreen")
    .classList.remove("hidden");

  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";

  showLoginMessage("");
}

function showLoginMessage(message) {
  const element =
    document.getElementById("loginMessage");

  if (element) {
    element.textContent = message;
  }
}

function showCreateAccount() {
  document
    .getElementById("loginForm")
    .classList.add("hidden");

  document
    .getElementById("createForm")
    .classList.remove("hidden");

  showLoginMessage("");
}

function showLoginForm() {
  document
    .getElementById("createForm")
    .classList.add("hidden");

  document
    .getElementById("loginForm")
    .classList.remove("hidden");

  showLoginMessage("");
}

function showApp() {
  document
    .getElementById("loginScreen")
    .classList.add("hidden");

  document
    .getElementById("appScreen")
    .classList.remove("hidden");

  initFinance();
}

/* =====================================================
   ESTADO
===================================================== */

const state = load() || {
  settings: {
    plannedSalary: 0,

    salarySplitEnabled: false,

    advancePercent: 40,

    advanceDay: 20
  },

  categories:
    defaultCategories.map(cat => ({ ...cat })),

  months: {},

  reserveBalance: 0,

  currentMonth: monthKey(new Date())
};

/* =====================================================
   DINHEIRO
   Tudo internamente em centavos.
===================================================== */

function money(cents) {
  const value = (Number(cents) || 0) / 100;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function parseToCents(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.round(value)
      : 0;
  }

  let text = String(value)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  if (!text) return 0;

  if (text.includes(",")) {
    text = text
      .replace(/\./g, "")
      .replace(",", ".");
  } else {
    text = text.replace(/[^0-9.-]/g, "");
  }

  const parsed = parseFloat(text);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function numCents(id) {
  const element =
    document.getElementById(id);

  if (!element) return 0;

  return parseToCents(element.value);
}

/* =====================================================
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

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
    typeof data.settings.salarySplitEnabled === "boolean"
      ? data.settings.salarySplitEnabled
      : false;

  data.settings.advancePercent = Math.min(
    100,
    Math.max(
      0,
      Number(data.settings.advancePercent) || 40
    )
  );

  data.settings.advanceDay = Math.min(
    31,
    Math.max(
      1,
      Number(data.settings.advanceDay) || 20
    )
  );

  /*
    Compatibilidade com versões antigas.
    mainPaymentLabel não é mais necessário,
    pois o pagamento principal é sempre
    o 5º dia útil.
  */

  if (
    !Array.isArray(data.categories) ||
    data.categories.length === 0
  ) {
    data.categories =
      defaultCategories.map(cat => ({ ...cat }));
  }

  data.categories = data.categories.map(category => ({
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

  /*
    Garante que as categorias essenciais
    existam.
  */

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

  /*
    Reserva é SEMPRE fixa.
  */

  let reserveCategory =
    data.categories.find(
      category =>
        category.id === "reserve"
    );

  if (!reserveCategory) {
    reserveCategory = {
      ...defaultCategories.find(
        category =>
          category.id === "reserve"
      )
    };

    data.categories.unshift(
      reserveCategory
    );
  }

  reserveCategory.name = "Reserva";
  reserveCategory.icon = "🏦";
  reserveCategory.type = "reserve";
  reserveCategory.budget = 0;

  /*
    Nenhuma outra categoria pode ser
    do tipo reserva.
  */

  data.categories.forEach(category => {
    if (
      category.id !== "reserve" &&
      category.type === "reserve"
    ) {
      category.type = "expense";
    }
  });

  if (
    !data.months ||
    typeof data.months !== "object"
  ) {
    data.months = {};
  }

  Object.values(data.months).forEach(month => {
    if (!Array.isArray(month.expenses)) {
      month.expenses = [];
    }

    if (!Array.isArray(month.extras)) {
      month.extras = [];
    }

    if (
      !Array.isArray(
        month.reserveTransactions
      )
    ) {
      month.reserveTransactions = [];
    }

    /*
      Compatibilidade com versões anteriores.
    */

    month.salaryReceived =
      parseToCents(
        month.salaryReceived
      );

    month.reserveContribution =
      parseToCents(
        month.reserveContribution
      );

    month.reserveWithdrawal =
      parseToCents(
        month.reserveWithdrawal
      );

    month.expenses.forEach(expense => {
      expense.amount =
        parseToCents(expense.amount);

      expense.note =
        String(
          expense.note || ""
        ).trim();
    });

    month.extras.forEach(extra => {
      extra.amount =
        parseToCents(extra.amount);

      extra.name =
        String(
          extra.name || ""
        ).trim();
    });

    /*
      Normaliza transações da reserva.
    */

    month.reserveTransactions.forEach(tx => {
      tx.amount =
        parseToCents(tx.amount);

      tx.note =
        String(
          tx.note || ""
        ).trim();

      tx.type =
        tx.type === "out"
          ? "out"
          : "in";

      if (!tx.date) {
        tx.date = todayKey();
      }
    });

    /*
      Migração de reservas antigas:
      caso existam valores antigos mas não
      existam transações correspondentes,
      transforma-os em transações.
    */

    if (
      month.reserveContribution > 0 &&
      !month.reserveTransactions.some(
        tx =>
          tx.type === "in" &&
          tx.amount === month.reserveContribution
      )
    ) {
      month.reserveTransactions.push({
        id: createId(),
        type: "in",
        amount: month.reserveContribution,
        date:
          month.keyDate ||
          todayKey(),
        note:
          "Reserva migrada da versão anterior"
      });
    }

    if (
      month.reserveWithdrawal > 0 &&
      !month.reserveTransactions.some(
        tx =>
          tx.type === "out" &&
          tx.amount === month.reserveWithdrawal
      )
    ) {
      month.reserveTransactions.push({
        id: createId(),
        type: "out",
        amount: month.reserveWithdrawal,
        date:
          month.keyDate ||
          todayKey(),
        note:
          "Resgate migrado da versão anterior"
      });
    }
  });

  /*
    O saldo da reserva agora é calculado
    exclusivamente pelas transações.
  */

  data.reserveBalance =
    calculateReserveBalance(data);

  if (
    typeof data.currentMonth !== "string"
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

/* =====================================================
   CARREGAMENTO
===================================================== */

function load() {
  try {
    const raw =
      localStorage.getItem(KEY);

    if (!raw) return null;

    const data =
      JSON.parse(raw);

    return normalizeState(data);
  } catch {
    return null;
  }
}

/* =====================================================
   PERSISTÊNCIA
===================================================== */

function save() {
  state.reserveBalance =
    calculateReserveBalance(state);

  localStorage.setItem(
    KEY,
    JSON.stringify(state)
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
        state.settings.plannedSalary || 0,

      expenses: [],

      extras: [],

      reserveContribution: 0,

      reserveWithdrawal: 0,

      reserveTransactions: [],

      keyDate: key
    };

    save();
  }

  const month =
    state.months[key];

  if (!Array.isArray(month.expenses)) {
    month.expenses = [];
  }

  if (!Array.isArray(month.extras)) {
    month.extras = [];
  }

  if (
    !Array.isArray(
      month.reserveTransactions
    )
  ) {
    month.reserveTransactions = [];
  }

  return month;
}

function monthLabel(key) {
  const [year, month] =
    key.split("-").map(Number);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  ).format(
    new Date(year, month - 1, 1)
  );
}

function monthShift(key, delta) {
  const [year, month] =
    key.split("-").map(Number);

  return monthKey(
    new Date(
      year,
      month - 1 + delta,
      1
    )
  );
}

/* =====================================================
   RESERVA
===================================================== */

function calculateReserveBalance(source) {
  let balance = 0;

  Object.values(
    source.months || {}
  ).forEach(month => {
    (
      month.reserveTransactions || []
    ).forEach(tx => {
      const amount =
        parseToCents(tx.amount);

      if (tx.type === "in") {
        balance += amount;
      } else if (tx.type === "out") {
        balance -= amount;
      }
    });
  });

  return balance;
}

function getReserveBalance() {
  return calculateReserveBalance(state);
}

function syncReserve() {
  state.reserveBalance =
    getReserveBalance();
}

function reserveMonthTotals(month) {
  let incoming = 0;
  let outgoing = 0;

  (
    month.reserveTransactions || []
  ).forEach(tx => {
    if (tx.type === "in") {
      incoming +=
        parseToCents(tx.amount);
    } else {
      outgoing +=
        parseToCents(tx.amount);
    }
  });

  return {
    incoming,
    outgoing
  };
}

/* =====================================================
   CÁLCULOS
===================================================== */

function categorySpent(id, month) {
  return month.expenses
    .filter(
      expense =>
        expense.categoryId === id
    )
    .reduce(
      (sum, expense) =>
        sum +
        (expense.amount || 0),
      0
    );
}

function totalSpent(month) {
  return month.expenses.reduce(
    (sum, expense) =>
      sum +
      (expense.amount || 0),
    0
  );
}

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum +
      (extra.amount || 0),
    0
  );
}

function available(month) {
  const salary =
    month.salaryReceived || 0;

  const extras =
    totalExtras(month);

  const reserveTotals =
    reserveMonthTotals(month);

  const expenses =
    totalSpent(month);

  /*
    Dinheiro disponível:
    salário
    + extras
    + resgates
    - valores guardados
    - gastos
  */

  return (
    salary +
    extras +
    reserveTotals.outgoing -
    reserveTotals.incoming -
    expenses
  );
}

/* =====================================================
   DIVISÃO DO SALÁRIO
===================================================== */

function getSalarySplit(month) {
  const salary =
    month.salaryReceived || 0;

  if (
    !state.settings.salarySplitEnabled
  ) {
    return {
      enabled: false,
      advance: 0,
      main: salary
    };
  }

  const percent =
    state.settings.advancePercent || 40;

  const advance =
    Math.round(
      (salary * percent) / 100
    );

  const main =
    salary - advance;

  return {
    enabled: true,
    advance,
    main
  };
}

/* =====================================================
   VISIBILIDADE DOS PAGAMENTOS
===================================================== */

function updatePaymentVisibility() {
  const enabled =
    !!state.settings.salarySplitEnabled;

  const advanceElement =
    document.getElementById(
      "advanceValue"
    );

  const paymentCard =
    advanceElement?.closest(".payment") ||
    advanceElement?.closest(
      ".payments-card"
    );

  if (paymentCard) {
    paymentCard.classList.toggle(
      "hidden",
      !enabled
    );
  }

  const advanceDate =
    document.getElementById(
      "advanceDate"
    );

  const mainPayDate =
    document.getElementById(
      "mainPayDate"
    );

  if (advanceDate) {
    advanceDate.classList.toggle(
      "hidden",
      !enabled
    );
  }

  if (mainPayDate) {
    mainPayDate.classList.toggle(
      "hidden",
      !enabled
    );
  }
}

/* =====================================================
   RENDER
===================================================== */

function render() {
  const month = getMonth();

  syncReserve();

  const monthTitle =
    document.getElementById(
      "monthTitle"
    );

  if (monthTitle) {
    monthTitle.textContent =
      monthLabel(
        state.currentMonth
      );
  }

  const availableValue =
    document.getElementById(
      "availableValue"
    );

  if (availableValue) {
    availableValue.textContent =
      money(
        Math.max(
          0,
          available(month)
        )
      );
  }

  const salaryValue =
    document.getElementById(
      "salaryValue"
    );

  if (salaryValue) {
    salaryValue.textContent =
      money(
        month.salaryReceived
      );
  }

  const extraValue =
    document.getElementById(
      "extraValue"
    );

  if (extraValue) {
    extraValue.textContent =
      money(
        totalExtras(month)
      );
  }

  const spentValue =
    document.getElementById(
      "spentValue"
    );

  if (spentValue) {
    spentValue.textContent =
      money(
        totalSpent(month)
      );
  }

  const reserveBig =
    document.getElementById(
      "reserveBig"
    );

  if (reserveBig) {
    reserveBig.textContent =
      money(
        state.reserveBalance
      );
  }

  const split =
    getSalarySplit(month);

  const advanceValue =
    document.getElementById(
      "advanceValue"
    );

  if (advanceValue) {
    advanceValue.textContent =
      money(split.advance);
  }

  const advanceDate =
    document.getElementById(
      "advanceDate"
    );

  if (advanceDate) {
    advanceDate.textContent =
      `Dia ${state.settings.advanceDay}`;
  }

  const mainPayValue =
    document.getElementById(
      "mainPayValue"
    );

  if (mainPayValue) {
    mainPayValue.textContent =
      money(split.main);
  }

  const mainPayDate =
    document.getElementById(
      "mainPayDate"
    );

  if (mainPayDate) {
    mainPayDate.textContent =
      "5º dia útil";
  }

  updatePaymentVisibility();

  renderReserveGoal();
  renderCategories();
  renderExtras();
  renderHistoryPreview();
}

/* =====================================================
   META DA RESERVA
===================================================== */

function renderReserveGoal() {
  const goalBox =
    document.getElementById(
      "goalBox"
    );

  if (!goalBox) return;

  const goal =
    state.settings.reserveGoal || 0;

  if (goal <= 0) {
    goalBox.innerHTML = "";
    return;
  }

  const percent =
    Math.min(
      100,
      Math.max(
        0,
        (state.reserveBalance /
          goal) *
          100
      )
    );

  goalBox.innerHTML = `
    Meta ${money(goal)}
    <div class="progress">
      <div style="width:${percent}%"></div>
    </div>
  `;
}

/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {
  const month = getMonth();

  const wrap =
    document.getElementById(
      "categories"
    );

  if (!wrap) return;

  wrap.innerHTML = "";

  state.categories.forEach(
    category => {

      /*
        Reserva é especial.
      */

      if (
        category.id === "reserve" ||
        category.type === "reserve"
      ) {
        const totals =
          reserveMonthTotals(
            month
          );

        const el =
          document.createElement(
            "div"
          );

        el.className =
          "category reserve-cat";

        el.innerHTML = `
          <div class="cat-icon">🏦</div>

          <div class="cat-main">
            <div class="cat-name">
              Reserva
            </div>

            <div class="cat-sub">
              Guardado neste mês
            </div>

            <div class="progress">
              <div style="width:${
                totals.incoming > 0
                  ? 100
                  : 0
              }%"></div>
            </div>
          </div>

          <div class="cat-value">
            <strong>
              ${money(totals.incoming)}
            </strong>

            <small>
              guardado
            </small>
          </div>
        `;

        el.addEventListener(
          "click",
          () => openReserve()
        );

        wrap.appendChild(el);

        return;
      }

      const spent =
        categorySpent(
          category.id,
          month
        );

      const budget =
        category.budget || 0;

      const remaining =
        budget - spent;

      const pct =
        budget > 0
          ? Math.min(
              100,
              Math.max(
                0,
                (spent / budget) *
                  100
              )
            )
          : 0;

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "category";

      el.innerHTML = `
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
            ${money(
              Math.max(
                0,
                remaining
              )
            )}
            disponíveis
          </div>

          <div class="progress">
            <div style="width:${pct}%"></div>
          </div>
        </div>

        <div class="cat-value">
          <strong>
            ${money(spent)}
          </strong>

          <small>
            de ${money(budget)}
          </small>
        </div>

        <div class="cat-actions">
          <button
            class="cat-edit"
            type="button"
            title="Editar categoria"
          >
            ✎
          </button>
        </div>
      `;

      el.addEventListener(
        "click",
        event => {
          if (
            event.target.closest(
              ".cat-edit"
            )
          ) {
            return;
          }

          openExpense(
            category.id
          );
        }
      );

      el
        .querySelector(
          ".cat-edit"
        )
        .addEventListener(
          "click",
          event => {
            event.stopPropagation();

            openEditCategory(
              category.id
            );
          }
        );

      wrap.appendChild(el);
    }
  );
}

/* =====================================================
   NOVA CATEGORIA
===================================================== */

function openCategory() {
  openModal(
    "Nova categoria",
    `
    <form
      class="form"
      id="categoryForm"
    >

      <label>Nome</label>

      <input
        id="catName"
        required
        placeholder="Ex.: Alimentação"
      >

      <label>Ícone</label>

      <input
        id="catIcon"
        value="💰"
        maxlength="4"
      >

      <label>Valor mensal</label>

      <input
        id="catBudget"
        inputmode="decimal"
        placeholder="R$ 0,00"
        required
      >

      <button type="submit">
        Criar categoria
      </button>

    </form>
    `
  );

  document
    .getElementById(
      "categoryForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name =
          document
            .getElementById(
              "catName"
            )
            .value
            .trim();

        const amount =
          numCents(
            "catBudget"
          );

        if (
          !name ||
          amount < 0
        ) {
          alert(
            "Digite um nome e um valor válido."
          );

          return;
        }

        state.categories.push({
          id:
            "cat_" +
            createId(),

          name,

          icon:
            document
              .getElementById(
                "catIcon"
              )
              .value
              .trim() ||
            "💰",

          budget: amount,

          type: "expense"
        });

        save();
        closeModal();
        render();
      }
    );
}

/* =====================================================
   EDITAR CATEGORIA
===================================================== */

function openEditCategory(id) {

  /*
    Reserva nunca entra aqui
    como categoria editável.
  */

  if (id === "reserve") {
    openReserve();
    return;
  }

  const category =
    state.categories.find(
      c => c.id === id
    );

  if (
    !category ||
    category.type === "reserve"
  ) {
    openReserve();
    return;
  }

  openModal(
    "Editar categoria",
    `
    <form
      class="form"
      id="editCategoryForm"
    >

      <label>Nome</label>

      <input
        id="editCatName"
        value="${escapeHtml(
          category.name
        )}"
        required
      >

      <label>Ícone</label>

      <input
        id="editCatIcon"
        value="${escapeHtml(
          category.icon
        )}"
        maxlength="4"
      >

      <label>Valor mensal</label>

      <input
        id="editCatBudget"
        inputmode="decimal"
        value="${(
          category.budget /
          100
        ).toFixed(2)}"
        required
      >

      <button type="submit">
        Salvar alterações
      </button>

    </form>

    <button
      class="danger"
      id="deleteCategoryBtn"
      type="button"
      style="
        width:100%;
        padding:13px;
        border-radius:12px;
        margin-top:10px
      "
    >
      Excluir categoria
    </button>
    `
  );

  document
    .getElementById(
      "editCategoryForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name =
          document
            .getElementById(
              "editCatName"
            )
            .value
            .trim();

        if (!name) {
          alert(
            "Digite um nome."
          );

          return;
        }

        category.name =
          name;

        category.icon =
          document
            .getElementById(
              "editCatIcon"
            )
            .value
            .trim() ||
          "💰";

        category.budget =
          Math.max(
            0,
            numCents(
              "editCatBudget"
            )
          );

        save();
        closeModal();
        render();
      }
    );

  const deleteBtn =
    document.getElementById(
      "deleteCategoryBtn"
    );

  if (deleteBtn) {
    deleteBtn.onclick = () => {

      if (id === "reserve") {
        alert(
          "A categoria Reserva é fixa e não pode ser excluída."
        );

        return;
      }

      if (
        !confirm(
          `Excluir a categoria "${category.name}"? Os gastos antigos serão mantidos no extrato.`
        )
      ) {
        return;
      }

      state.categories =
        state.categories.filter(
          c => c.id !== id
        );

      save();
      closeModal();
      render();
    };
  }
}

/* =====================================================
   GASTOS
===================================================== */

function openExpense(
  categoryId =
    state.categories.find(
      c => c.type === "expense"
    )?.id
) {

  const options =
    state.categories
      .filter(
        c =>
          c.type ===
          "expense"
      )
      .map(
        c => `
          <option
            value="${escapeHtml(
              c.id
            )}"
            ${
              c.id === categoryId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              c.icon
            )}
            ${escapeHtml(
              c.name
            )}
          </option>
        `
      )
      .join("");

  const today =
    todayKey();

  openModal(
    "Adicionar gasto",
    `
    <form
      class="form"
      id="expenseForm"
    >

      <label>Valor</label>

      <input
        id="expenseAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
        required
      >

      <label>Categoria</label>

      <select
        id="expenseCategory"
      >
        ${options}
      </select>

      <label>Data</label>

      <input
        id="expenseDate"
        type="date"
        value="${today}"
      >

      <label>
        Onde / com o que gastei?
      </label>

      <input
        id="expenseNote"
        placeholder="Ex.: mercado, farmácia, gasolina..."
      >

      <button type="submit">
        Salvar gasto
      </button>

    </form>
    `
  );

  document
    .getElementById(
      "expenseForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const amount =
          numCents(
            "expenseAmount"
          );

        if (
          amount <= 0
        ) {
          alert(
            "Digite um valor válido maior que zero."
          );

          return;
        }

        const month =
          getMonth();

        month.expenses.push({
          id: createId(),

          categoryId:
            document
              .getElementById(
                "expenseCategory"
              )
              .value,

          amount,

          date:
            document
              .getElementById(
                "expenseDate"
              )
              .value ||
            today,

          note:
            document
              .getElementById(
                "expenseNote"
              )
              .value
              .trim()
        });

        save();
        closeModal();
        render();
      }
    );
}

/* =====================================================
   EXTRAS
===================================================== */

function renderExtras() {
  const month =
    getMonth();

  const container =
    document.getElementById(
      "extrasList"
    );

  if (!container) return;

  if (
    month.extras.length === 0
  ) {
    container.innerHTML =
      `
      <div class="empty-history">
        Nenhuma entrada extra neste mês.
      </div>
      `;

    return;
  }

  const items =
    [...month.extras]
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );

  container.innerHTML =
    items
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
              + ${money(
                extra.amount
              )}
            </div>

            <button
              class="extra-delete"
              type="button"
              data-id="${escapeHtml(
                extra.id
              )}"
              title="Excluir"
            >
              ✕
            </button>

          </div>
        `
      )
      .join("");

  container
    .querySelectorAll(
      ".extra-delete"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () =>
          deleteExtra(
            button.dataset.id
          )
      );
    });
}

function openExtra() {
  const today =
    todayKey();

  openModal(
    "Adicionar entrada extra",
    `
    <form
      class="form"
      id="extraForm"
    >

      <label>Descrição</label>

      <input
        id="extraName"
        placeholder="Ex.: venda de algo pessoal"
        required
      >

      <label>Valor</label>

      <input
        id="extraAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
        required
      >

      <label>Data</label>

      <input
        id="extraDate"
        type="date"
        value="${today}"
        required
      >

      <button type="submit">
        Salvar entrada
      </button>

    </form>
    `
  );

  document
    .getElementById(
      "extraForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name =
          document
            .getElementById(
              "extraName"
            )
            .value
            .trim();

        const amount =
          numCents(
            "extraAmount"
          );

        const date =
          document
            .getElementById(
              "extraDate"
            )
            .value;

        if (
          !name ||
          amount <= 0
        ) {
          alert(
            "Informe uma descrição e um valor válido maior que zero."
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
            date || today
        });

        save();
        closeModal();
        render();
      }
    );
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
      `Excluir a entrada "${extra.name}" de ${money(
        extra.amount
      )}?`
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

function openReserve() {
  const month =
    getMonth();

  const totals =
    reserveMonthTotals(
      month
    );

  const balance =
    getReserveBalance();

  const goal =
    state.settings.reserveGoal ||
    0;

  const goalText =
    goal > 0
      ? `
        <br><br>
        <strong>
          Meta da reserva
        </strong>
        <br>
        ${money(goal)}
      `
      : "";

  openModal(
    "Reserva",
    `
    <div class="notice">

      <strong>
        Valor guardado
      </strong>

      <br>

      ${money(balance)}

      ${goalText}

      <br><br>

      <strong>
        Guardado neste mês
      </strong>

      <br>

      ${money(
        totals.incoming
      )}

      <br><br>

      <strong>
        Resgatado neste mês
      </strong>

      <br>

      ${money(
        totals.outgoing
      )}

    </div>

    <form
      class="form"
      id="reserveForm"
      style="margin-top:12px"
    >

      <label>
        Quanto você quer guardar na reserva?
      </label>

      <input
        id="reserveAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <label>
        Observação
      </label>

      <input
        id="reserveNote"
        placeholder="Ex.: dinheiro que consegui guardar"
      >

      <button type="submit">
        Guardar na reserva
      </button>

    </form>

    <form
      class="form"
      id="withdrawForm"
      style="margin-top:16px"
    >

      <label>
        Quanto você quer resgatar da reserva?
      </label>

      <input
        id="withdrawAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <label>
        Motivo do resgate
      </label>

      <input
        id="withdrawNote"
        placeholder="Ex.: emergência"
      >

      <button
        class="danger"
        type="submit"
      >
        Resgatar da reserva
      </button>

    </form>

    <button
      class="secondary"
      id="closeReserveBtn"
      type="button"
      style="
        width:100%;
        padding:13px;
        border-radius:12px;
        margin-top:10px
      "
    >
      Fechar
    </button>
    `
  );

  document
    .getElementById(
      "reserveForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const amount =
          numCents(
            "reserveAmount"
          );

        if (
          amount <= 0
        ) {
          alert(
            "Digite um valor válido maior que zero."
          );

          return;
        }

        const note =
          document
            .getElementById(
              "reserveNote"
            )
            .value
            .trim();

        month.reserveTransactions.push({
          id: createId(),

          type: "in",

          amount,

          date: todayKey(),

          note
        });

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById(
      "withdrawForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const amount =
          numCents(
            "withdrawAmount"
          );

        const currentBalance =
          getReserveBalance();

        if (
          amount <= 0 ||
          amount > currentBalance
        ) {
          alert(
            "Valor inválido ou maior do que o saldo atual da reserva."
          );

          return;
        }

        const note =
          document
            .getElementById(
              "withdrawNote"
            )
            .value
            .trim();

        month.reserveTransactions.push({
          id: createId(),

          type: "out",

          amount,

          date: todayKey(),

          note
        });

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById(
      "closeReserveBtn"
    )
    .onclick =
    closeModal;
}

/* =====================================================
   HISTÓRICO
===================================================== */

function getHistory(month) {
  const items = [];

  month.expenses.forEach(
    expense => {
      const category =
        state.categories.find(
          c =>
            c.id ===
            expense.categoryId
        );

      items.push({
        type: "expense",

        date:
          expense.date,

        amount:
          expense.amount || 0,

        name:
          category
            ? category.name
            : "Categoria removida",

        icon:
          category
            ? category.icon
            : "💰",

        note:
          expense.note || "",

        id:
          expense.id
      });
    }
  );

  month.extras.forEach(
    extra => {
      items.push({
        type: "extra-in",

        date:
          extra.date,

        amount:
          extra.amount || 0,

        name:
          extra.name,

        icon:
          "💰",

        note:
          "Entrada extra",

        id:
          extra.id
      });
    }
  );

  (
    month.reserveTransactions ||
    []
  ).forEach(
    tx => {
      items.push({
        type:
          tx.type === "in"
            ? "reserve-in"
            : "reserve-out",

        date:
          tx.date,

        amount:
          tx.amount || 0,

        name:
          tx.type === "in"
            ? "Dinheiro guardado"
            : "Dinheiro resgatado",

        icon:
          tx.type === "in"
            ? "🏦"
            : "💸",

        note:
          tx.note || "",

        id:
          tx.id
      });
    }
  );

  items.sort(
    (a, b) =>
      new Date(b.date) -
      new Date(a.date)
  );

  return items;
}

function renderHistoryPreview() {
  const container =
    document.getElementById(
      "historyPreview"
    );

  if (!container) return;

  const month =
    getMonth();

  const items =
    getHistory(month);

  if (
    items.length === 0
  ) {
    container.innerHTML =
      `
      <div class="empty-history">
        Nenhum lançamento neste mês.
      </div>
      `;

    return;
  }

  container.innerHTML =
    items
      .slice(0, 4)
      .map(
        item =>
          historyItemHtml(
            item
          )
      )
      .join("");
}

function historyItemHtml(item) {
  let valueClass =
    "expense";

  let prefix =
    "- ";

  if (
    item.type ===
      "extra-in" ||
    item.type ===
      "reserve-in"
  ) {
    valueClass =
      item.type ===
      "extra-in"
        ? "extra-in"
        : "reserve-in";

    prefix = "+ ";
  }

  if (
    item.type ===
    "reserve-out"
  ) {
    valueClass =
      "reserve-out";

    prefix =
      "- ";
  }

  return `
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

        ${
          item.note
            ? `
              <div class="history-note">
                ${escapeHtml(
                  item.note
                )}
              </div>
            `
            : ""
        }

        <div class="history-date">
          ${formatDate(
            item.date
          )}
        </div>

      </div>

      <div
        class="history-value ${valueClass}"
      >
        ${prefix}${money(
          item.amount
        )}
      </div>

    </div>
  `;
}

function openHistory() {
  const month =
    getMonth();

  const items =
    getHistory(month);

  const expensesTotal =
    totalSpent(month);

  const extrasTotal =
    totalExtras(month);

  const reserveTotals =
    reserveMonthTotals(
      month
    );

  const content =
    items.length === 0
      ? `
        <div class="empty-history">
          Nenhum lançamento neste mês.
        </div>
      `
      : items
          .map(
            item =>
              historyItemHtml(
                item
              )
          )
          .join("");

  openModal(
    "Extrato — " +
      monthLabel(
        state.currentMonth
      ),

    `
    <div class="history-total">
      <span>
        Salário
      </span>

      <strong>
        ${money(
          month.salaryReceived
        )}
      </strong>
    </div>

    <div class="history-total">
      <span>
        Entradas extras
      </span>

      <strong>
        ${money(
          extrasTotal
        )}
      </strong>
    </div>

    <div class="history-total">
      <span>
        Gastos deste mês
      </span>

      <strong>
        ${money(
          expensesTotal
        )}
      </strong>
    </div>

    <div class="history-total">
      <span>
        Dinheiro guardado na reserva
      </span>

      <strong>
        ${money(
          reserveTotals.incoming
        )}
      </strong>
    </div>

    <div class="history-total">
      <span>
        Dinheiro resgatado da reserva
      </span>

      <strong>
        ${money(
          reserveTotals.outgoing
        )}
      </strong>
    </div>

    <div class="full-history">
      ${content}
    </div>
    `
  );
}

/* =====================================================
   CONFIGURAÇÕES
===================================================== */

function openSettings() {
  const month =
    getMonth();

  openModal(
    "Configurações",
    `
    <form
      class="form"
      id="settingsForm"
    >

      <label>
        Salário deste mês
      </label>

      <input
        id="sSalary"
        inputmode="decimal"
        value="${(
          month.salaryReceived /
          100
        ).toFixed(2)}"
      >

      <div class="dark-mode-row">

        <span>
          💰 Dividir salário em dois pagamentos
        </span>

        <label class="theme-switch">

          <input
            type="checkbox"
            id="salarySplitToggle"
          >

          <span class="theme-slider">
            <span class="theme-dot"></span>
          </span>

        </label>

      </div>

      <div id="salarySplitOptions">

        <label>
          Percentual do adiantamento (%)
        </label>

        <input
          id="sPercent"
          type="number"
          min="0"
          max="100"
          value="${state.settings.advancePercent}"
        >

        <label>
          Dia do adiantamento
        </label>

        <input
          id="sDay"
          type="number"
          min="1"
          max="31"
          value="${state.settings.advanceDay}"
        >

        <div class="notice">
          O restante do salário será considerado
          como pagamento principal no
          <strong>5º dia útil</strong>.
        </div>

      </div>

      <label>
        Meta da reserva (opcional)
      </label>

      <input
        id="sGoal"
        inputmode="decimal"
        value="${
          state.settings.reserveGoal > 0
            ? (
                state.settings.reserveGoal /
                100
              ).toFixed(2)
            : ""
        }"
        placeholder="Deixe vazio se não quiser uma meta"
      >

      <div class="dark-mode-row">

        <span>
          🌙 Modo escuro
        </span>

        <label class="theme-switch">

          <input
            type="checkbox"
            id="darkModeToggle"
          >

          <span class="theme-slider">
            <span class="theme-dot"></span>
          </span>

        </label>

      </div>

      <button type="submit">
        Salvar
      </button>

    </form>

    <div
      class="notice"
      style="margin-top:12px"
    >
      Os dados ficam somente neste aparelho.
      Faça backups regularmente para evitar
      perda de dados.
    </div>

    <button
      class="secondary"
      style="
        width:100%;
        margin-top:10px;
        padding:13px;
        border-radius:12px
      "
      id="exportBtn"
      type="button"
    >
      Exportar backup JSON
    </button>

    <label
      class="secondary"
      style="
        display:block;
        width:100%;
        margin-top:10px;
        padding:13px;
        border-radius:12px;
        text-align:center;
        cursor:pointer;
        box-sizing:border-box
      "
    >
      Importar backup JSON

      <input
        id="importFile"
        type="file"
        accept=".json,application/json"
        style="display:none"
      >
    </label>

    <button
      class="danger"
      style="
        width:100%;
        margin-top:10px;
        padding:13px;
        border-radius:12px
      "
      id="resetBtn"
      type="button"
    >
      Apagar todos os dados
    </button>
    `
  );

  const darkToggle =
    document.getElementById(
      "darkModeToggle"
    );

  darkToggle.checked =
    localStorage.getItem(
      DARK_KEY
    ) === "true";

  const salarySplitToggle =
    document.getElementById(
      "salarySplitToggle"
    );

  const salarySplitOptions =
    document.getElementById(
      "salarySplitOptions"
    );

  salarySplitToggle.checked =
    !!state.settings
      .salarySplitEnabled;

  function updateSalarySplitOptions() {
    salarySplitOptions.classList.toggle(
      "hidden",
      !salarySplitToggle.checked
    );
  }

  updateSalarySplitOptions();

  salarySplitToggle.onchange =
    updateSalarySplitOptions;

  document
    .getElementById(
      "settingsForm"
    )
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const newSalary =
          numCents(
            "sSalary"
          );

        month.salaryReceived =
          Math.max(
            0,
            newSalary
          );

        state.settings.plannedSalary =
          month.salaryReceived;

        state.settings
          .salarySplitEnabled =
          salarySplitToggle.checked;

        state.settings
          .advancePercent =
          Math.min(
            100,
            Math.max(
              0,
              Number(
                document.getElementById(
                  "sPercent"
                ).value
              ) || 40
            )
          );

        state.settings
          .advanceDay =
          Math.min(
            31,
            Math.max(
              1,
              Number(
                document.getElementById(
                  "sDay"
                ).value
              ) || 20
            )
          );

        state.settings
          .reserveGoal =
          Math.max(
            0,
            numCents(
              "sGoal"
            )
          );

        const dark =
          darkToggle.checked;

        document.body.classList.toggle(
          "dark",
          dark
        );

        localStorage.setItem(
          DARK_KEY,
          dark
        );

        save();
        closeModal();
        render();
      }
    );

  document
    .getElementById(
      "exportBtn"
    )
    .onclick =
    exportData;

  document
    .getElementById(
      "importFile"
    )
    .addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        if (!file) return;

        importData(file);

        event.target.value =
          "";
      }
    );

  document
    .getElementById(
      "resetBtn"
    )
    .onclick = () => {

      if (
        !confirm(
          "Apagar todos os dados do FX? Esta ação não pode ser desfeita."
        )
      ) {
        return;
      }

      localStorage.removeItem(
        KEY
      );

      localStorage.removeItem(
        ACCOUNT_KEY
      );

      localStorage.removeItem(
        SESSION_KEY
      );

      location.reload();
    };
}

/* =====================================================
   PAGAMENTOS
===================================================== */

function openPayments() {
  const month =
    getMonth();

  if (
    !state.settings
      .salarySplitEnabled
  ) {
    openModal(
      "Pagamentos",
      `
      <div class="notice">

        A divisão do salário está
        <strong>desativada</strong>.

        <br><br>

        O salário deste mês é:

        <br>

        <strong>
          ${money(
            month.salaryReceived
          )}
        </strong>

        <br><br>

        Se quiser dividir o salário entre
        adiantamento e pagamento principal,
        ative essa opção em
        ⚙️ Configurações.

      </div>
      `
    );

    return;
  }

  const split =
    getSalarySplit(
      month
    );

  openModal(
    "Pagamentos",
    `
    <div class="notice">

      <strong>
        Adiantamento
      </strong>

      <br>

      ${money(
        split.advance
      )}
      —
      dia
      ${state.settings.advanceDay}

      <br><br>

      <strong>
        Pagamento principal
      </strong>

      <br>

      ${money(
        split.main
      )}
      —
      5º dia útil

    </div>
    `
  );
}

/* =====================================================
   BACKUP — EXPORTAR
===================================================== */

function exportData() {
  save();

  const backup = {
    app: "FX",
    version: "1.1.0",
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

  const a =
    document.createElement(
      "a"
    );

  a.href = url;

  a.download =
    `fx-backup-${state.currentMonth}.json`;

  document.body.appendChild(
    a
  );

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}

/* =====================================================
   BACKUP — IMPORTAR
===================================================== */

function importData(file) {
  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const parsed =
        JSON.parse(
          reader.result
        );

      const imported =
        parsed &&
        parsed.data &&
        typeof parsed.data ===
          "object"
          ? parsed.data
          : parsed;

      const normalized =
        normalizeState(
          imported
        );

      if (!normalized) {
        throw new Error(
          "Backup inválido."
        );
      }

      /*
        Mantém a conta/login atual.
        O backup restaura somente
        os dados financeiros.
      */

      localStorage.setItem(
        KEY,
        JSON.stringify(
          normalized
        )
      );

      alert(
        "Backup importado com sucesso."
      );

      location.reload();

    } catch (error) {
      console.error(
        error
      );

      alert(
        "Não foi possível importar este backup. Verifique se o arquivo é um backup válido do FX."
      );
    }
  };

  reader.onerror = () => {
    alert(
      "Não foi possível ler o arquivo."
    );
  };

  reader.readAsText(
    file
  );
}

/* =====================================================
   UTILITÁRIOS
===================================================== */

function escapeHtml(value) {
  return String(
    value
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
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    String(Date.now()) +
    Math.random()
  );
}

function todayKey() {
  return monthDateKey(
    new Date()
  );
}

function monthDateKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) return "";

  const parts =
    String(date).split("-");

  if (
    parts.length !== 3
  ) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/* =====================================================
   MODAL
===================================================== */

function openModal(
  title,
  html
) {
  document.getElementById(
    "modalTitle"
  ).textContent = title;

  document.getElementById(
    "modalBody"
  ).innerHTML = html;

  document.getElementById(
    "modal"
  ).classList.remove(
    "hidden"
  );
}

function closeModal() {
  document.getElementById(
    "modal"
  ).classList.add(
    "hidden"
  );
}

/* =====================================================
   EVENTOS
===================================================== */

document.getElementById(
  "loginBtn"
).onclick = () => {

  const username =
    document.getElementById(
      "loginUsername"
    ).value.trim();

  const password =
    document.getElementById(
      "loginPassword"
    ).value;

  login(
    username,
    password
  );
};

document.getElementById(
  "createBtn"
).onclick =
  createAccount;

document.getElementById(
  "showCreateBtn"
).onclick =
  showCreateAccount;

document.getElementById(
  "backLoginBtn"
).onclick =
  showLoginForm;

document.getElementById(
  "logoutBtn"
).onclick =
  logout;

document.getElementById(
  "prevMonth"
).onclick = () => {

  state.currentMonth =
    monthShift(
      state.currentMonth,
      -1
    );

  save();
  render();
};

document.getElementById(
  "nextMonth"
).onclick = () => {

  state.currentMonth =
    monthShift(
      state.currentMonth,
      1
    );

  save();
  render();
};

document.getElementById(
  "addExpenseBtn"
).onclick =
  () => openExpense();

document.getElementById(
  "addCategoryBtn"
).onclick =
  openCategory;

document.getElementById(
  "addExtraBtn"
).onclick =
  openExtra;

document.getElementById(
  "settingsBtn"
).onclick =
  openSettings;

document.getElementById(
  "paymentsSettingsBtn"
).onclick =
  openPayments;

document.getElementById(
  "reserveBtn"
).onclick =
  openReserve;

document.getElementById(
  "historyBtn"
).onclick =
  openHistory;

document.getElementById(
  "historyBtn2"
).onclick =
  openHistory;

document.getElementById(
  "closeModal"
).onclick =
  closeModal;

document.getElementById(
  "modal"
).addEventListener(
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
  document.body.classList.toggle(
    "dark",
    localStorage.getItem(
      DARK_KEY
    ) === "true"
  );

  normalizeState(
    state
  );

  getMonth();

  syncReserve();

  render();
}

if (isLogged()) {
  showApp();
} else {
  document
    .getElementById(
      "loginScreen"
    )
    .classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "appScreen"
    )
    .classList.add(
      "hidden"
    );
}
