/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.5.2 — Correção de separação entre salário e extras
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const LAST_CHECKED_MONTH_KEY = "fx_last_month_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   SENSITIVIDADE TÁTIL
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
   ESTADO INICIAL
===================================================== */

const state = load() || {
  version: "1.5.2",

  settings: {
    plannedSalary: 0,
    salarySplitEnabled: false,
    advancePercent: 40,
    advanceDay: 20,
    mainPaymentLabel: "5º dia útil",
    reserveGoal: 0,
    hideBalance: false
  },

  categories:
    defaultCategories.map(cat => ({
      ...cat
    })),

  months: {},

  reserveBalance: 0,

  currentMonth:
    monthKey(new Date())
};

/* =====================================================
   CONTA & LOGIN
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
    String(
      account.username || ""
    )
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

  const rawUser =
    document.getElementById(
      "createUsername"
    )?.value.trim() || "";

  const username =
    rawUser.toLowerCase();

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
        (
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
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  data.version = "1.5.2";

  /* -----------------------------
     SETTINGS
  ----------------------------- */

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
        ) || 0
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

  /* -----------------------------
     CATEGORIAS
  ----------------------------- */

  if (
    !Array.isArray(
      data.categories
    )
  ) {
    data.categories =
      defaultCategories.map(
        cat => ({ ...cat })
      );
  }

  data.categories =
    data.categories.map(
      category => ({
        id:
          category.id ||
          "cat_" + createId(),

        name:
          String(
            category.name ||
            "Categoria"
          ).trim(),

        icon:
          String(
            category.icon ||
            "💰"
          ).trim(),

        type:
          category.type ===
          "reserve"
            ? "reserve"
            : "expense",

        budget:
          parseToCents(
            category.budget
          )
      })
    );

  defaultCategories.forEach(
    defaultCategory => {

      const exists =
        data.categories.some(
          category =>
            category.id ===
            defaultCategory.id
        );

      if (!exists) {
        data.categories.unshift({
          ...defaultCategory
        });
      }
    }
  );

  const reserveCategory =
    data.categories.find(
      category =>
        category.id === "reserve"
    );

  if (reserveCategory) {
    reserveCategory.name =
      "Reserva";

    reserveCategory.icon =
      "🏦";

    reserveCategory.type =
      "reserve";

    reserveCategory.budget =
      0;
  }

  data.categories.forEach(
    category => {
      if (
        category.id !==
          "reserve" &&
        category.type ===
          "reserve"
      ) {
        category.type =
          "expense";
      }
    }
  );

  /* -----------------------------
     MESES
  ----------------------------- */

  if (
    !data.months ||
    typeof data.months !== "object"
  ) {
    data.months = {};
  }

  Object.values(
    data.months
  ).forEach(month => {

    if (
      !Array.isArray(
        month.expenses
      )
    ) {
      month.expenses = [];
    }

    if (
      !Array.isArray(
        month.extras
      )
    ) {
      month.extras = [];
    }

    if (
      !Array.isArray(
        month.reserveTransactions
      )
    ) {
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

    month.salaryReserveReturn =
      parseToCents(
        month.salaryReserveReturn
      );

    month.expenses =
      month.expenses.map(
        expense => ({
          ...expense,

          amount:
            parseToCents(
              expense.amount
            ),

          source:
            expense.source ===
            "extra"
              ? "extra"
              : "salary",

          note:
            String(
              expense.note || ""
            ).trim()
        })
      );

    month.extras =
      month.extras.map(
        extra => ({
          ...extra,

          amount:
            parseToCents(
              extra.amount
            ),

          name:
            String(
              extra.name || ""
            ).trim()
        })
      );

    month.reserveTransactions =
      month.reserveTransactions.map(
        tx => ({
          ...tx,

          amount:
            parseToCents(
              tx.amount
            ),

          type:
            tx.type === "out"
              ? "out"
              : "in",

          note:
            String(
              tx.note || ""
            ).trim()
        })
      );
  });

  data.reserveBalance =
    parseToCents(
      data.reserveBalance
    );

  if (
    typeof data.currentMonth !==
    "string"
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
      localStorage.getItem(
        KEY
      );

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
  if (
    state.settings.hideBalance
  ) {
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

/*
   IMPORTANTE:

   Todos os valores financeiros internos
   do FX são armazenados em CENTAVOS.

   Exemplos:

   R$ 10,00 -> 1000
   R$ 50,00 -> 5000

   Quando recebemos um NUMBER vindo do estado,
   ele já representa centavos.

   Quando recebemos texto digitado,
   fazemos a conversão para centavos.
*/

function parseToCents(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  /*
     Número vindo do estado:
     já está em centavos.
  */
  if (
    typeof value === "number"
  ) {
    if (
      !Number.isFinite(value)
    ) {
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

  /*
     Formato brasileiro:

     1.234,56
     1234,56
     100,50
  */

  if (
    text.includes(",")
  ) {
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
        integerPart.replace(
          /\D/g,
          ""
        ) || "0",
        10
      );

    const decimal =
      decimalPart
        .replace(/\D/g, "")
        .padEnd(2, "0")
        .slice(0, 2);

    return (
      integer * 100 +
      parseInt(
        decimal || "0",
        10
      )
    );
  }

  /*
     Sem vírgula:

     100 -> R$ 100,00
     100.50 -> R$ 100,50
  */

  const cleaned =
    text.replace(
      /[^0-9.-]/g,
      ""
    );

  if (!cleaned) {
    return 0;
  }

  const parsed =
    Number(cleaned);

  if (
    !Number.isFinite(parsed)
  ) {
    return 0;
  }

  return Math.round(
    parsed * 100
  );
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

function getMonth(
  key = state.currentMonth
) {
  if (!state.months[key]) {

    state.months[key] = {
      salaryReceived:
        state.settings.plannedSalary ||
        0,

      expenses: [],

      extras: [],

      reserveContribution:
        0,

      extraReserveContribution:
        0,

      reserveWithdrawal:
        0,

      reserveTransactions: [],

      salaryReserveReturn:
        0
    };

    save();
  }

  const month =
    state.months[key];

  if (
    !Array.isArray(
      month.expenses
    )
  ) {
    month.expenses = [];
  }

  if (
    !Array.isArray(
      month.extras
    )
  ) {
    month.extras = [];
  }

  if (
    !Array.isArray(
      month.reserveTransactions
    )
  ) {
    month.reserveTransactions = [];
  }

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

  month.salaryReserveReturn =
    parseToCents(
      month.salaryReserveReturn
    );

  return month;
}

/* =====================================================
   CÁLCULOS
===================================================== */

function categorySpent(
  id,
  month
) {
  return month.expenses
    .filter(
      expense =>
        expense.categoryId ===
        id
    )
    .reduce(
      (sum, expense) =>
        sum +
        (
          Number(
            expense.amount
          ) || 0
        ),
      0
    );
}

function totalSpent(month) {
  return month.expenses.reduce(
    (sum, expense) =>
      sum +
      (
        Number(
          expense.amount
        ) || 0
      ),
    0
  );
}

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum +
      (
        Number(
          extra.amount
        ) || 0
      ),
    0
  );
}

function totalSalarySpent(
  month
) {
  return month.expenses
    .filter(
      expense =>
        expense.source !==
        "extra"
    )
    .reduce(
      (sum, expense) =>
        sum +
        (
          Number(
            expense.amount
          ) || 0
        ),
      0
    );
}

function totalExtraSpent(
  month
) {
  return month.expenses
    .filter(
      expense =>
        expense.source ===
        "extra"
    )
    .reduce(
      (sum, expense) =>
        sum +
        (
          Number(
            expense.amount
          ) || 0
        ),
      0
    );
}

/* =====================================================
   SALDO ANTERIOR DE SALÁRIO
===================================================== */

function getPreviousSalaryCarryover(
  currentMonthKey
) {
  let carry = 0;

  Object.keys(
    state.months
  )
    .sort()
    .forEach(key => {

      if (
        key >=
        currentMonthKey
      ) {
        return;
      }

      const month =
        state.months[key];

      const salary =
        Number(
          month.salaryReceived
        ) || 0;

      const returned =
        Number(
          month.salaryReserveReturn
        ) || 0;

      const spent =
        totalSalarySpent(
          month
        );

      const saved =
        Number(
          month.reserveContribution
        ) || 0;

      carry +=
        salary +
        returned -
        spent -
        saved;
    });

  return Math.max(
    0,
    carry
  );
}

/* =====================================================
   SALDO ANTERIOR DE EXTRAS
===================================================== */

function getPreviousExtraCarryover(
  currentMonthKey
) {
  let carry = 0;

  Object.keys(
    state.months
  )
    .sort()
    .forEach(key => {

      if (
        key >=
        currentMonthKey
      ) {
        return;
      }

      const month =
        state.months[key];

      const extras =
        totalExtras(month);

      const spent =
        totalExtraSpent(
          month
        );

      const reserve =
        Number(
          month.extraReserveContribution
        ) || 0;

      carry +=
        extras -
        spent -
        reserve;
    });

  return Math.max(
    0,
    carry
  );
}

/* =====================================================
   SALDO DO SALÁRIO
===================================================== */

function getSalaryAvailable(
  month
) {
  const previous =
    getPreviousSalaryCarryover(
      state.currentMonth
    );

  const salary =
    Number(
      month.salaryReceived
    ) || 0;

  const returned =
    Number(
      month.salaryReserveReturn
    ) || 0;

  const spent =
    totalSalarySpent(
      month
    );

  const saved =
    Number(
      month.reserveContribution
    ) || 0;

  /*
     SOMENTE dinheiro de salário
     entra neste cálculo.

     Extras NÃO entram aqui.
  */

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
   SALDO DOS EXTRAS
===================================================== */

function getExtraAvailable(
  month
) {
  const previous =
    getPreviousExtraCarryover(
      state.currentMonth
    );

  const extras =
    totalExtras(month);

  const spent =
    totalExtraSpent(
      month
    );

  const reserve =
    Number(
      month.extraReserveContribution
    ) || 0;

  /*
     SOMENTE dinheiro recebido
     como extra entra aqui.

     Salário NÃO entra neste cálculo.
  */

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

  Object.values(
    state.months
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

  return Math.max(
    0,
    totalIn -
      totalOut
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
  const month =
    getMonth();

  syncReserve();

  const title =
    document.getElementById(
      "monthTitle"
    );

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

  /*
     CORREÇÃO PRINCIPAL:

     availableValue mostra APENAS
     o saldo disponível do salário.

     extraValue mostra APENAS
     o saldo disponível dos extras.

     Eles não são somados.
  */

  const salaryAvailable =
    getSalaryAvailable(
      month
    );

  const extraAvailable =
    getExtraAvailable(
      month
    );

  const availableElement =
    document.getElementById(
      "availableValue"
    );

  if (availableElement) {
    availableElement.textContent =
      money(
        salaryAvailable
      );
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
  }

  const spentElement =
    document.getElementById(
      "spentValue"
    );

  if (spentElement) {
    spentElement.textContent =
      money(
        totalSpent(month)
      );
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

  /*
     Barra mensal:

     Mostra os gastos do mês em relação
     ao dinheiro que entrou neste mês.

     Salário + extras são usados apenas
     para a porcentagem visual.
  */

  const totalIncomes =
    (
      Number(
        month.salaryReceived
      ) || 0
    ) +
    totalExtras(month);

  const spentTotal =
    totalSpent(month);

  const percent =
    totalIncomes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              spentTotal /
              totalIncomes
            ) * 100
          )
        )
      : 0;

  const monthlyBar =
    document.getElementById(
      "monthlyBar"
    );

  if (monthlyBar) {
    monthlyBar.style.width =
      `${percent}%`;
  }

  const spentLabel =
    document.getElementById(
      "spentPercentLabel"
    );

  if (spentLabel) {
    spentLabel.textContent =
      `${Math.round(
        percent
      )}% gasto`;
  }

  renderCategories();
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

  state.categories.forEach(
    category => {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "category";

      const value =
        category.type ===
        "reserve"
          ? (
              (
                Number(
                  month.reserveContribution
                ) || 0
              ) +
              (
                Number(
                  month.extraReserveContribution
                ) || 0
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

        </div>

        <div class="cat-value">

          <strong>
            ${money(value)}
          </strong>

        </div>
      `;

      wrap.appendChild(
        element
      );
    }
  );
}

/* =====================================================
   MÊS
===================================================== */

function monthShift(
  key,
  delta
) {
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
   UTILITÁRIOS
===================================================== */

function escapeHtml(s) {
  return String(
    s ?? ""
  ).replace(
    /[&<>"']/g,
    x => ({
      "&":
        "&amp;",
      "<":
        "&lt;",
      ">":
        "&gt;",
      '"':
        "&quot;",
      "'":
        "&#039;"
    }[x])
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
    Date.now()
      .toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 10)
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
   UI — LOGIN
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
  document.getElementById(
    "loginForm"
  )?.classList.add(
    "hidden"
  );

  document.getElementById(
    "createForm"
  )?.classList.remove(
    "hidden"
  );

  showLoginMessage("");
}

function showLoginForm() {
  document.getElementById(
    "createForm"
  )?.classList.add(
    "hidden"
  );

  document.getElementById(
    "forgotForm"
  )?.classList.add(
    "hidden"
  );

  document.getElementById(
    "loginForm"
  )?.classList.remove(
    "hidden"
  );

  showLoginMessage("");
}

function showForgotForm() {
  document.getElementById(
    "loginForm"
  )?.classList.add(
    "hidden"
  );

  document.getElementById(
    "forgotForm"
  )?.classList.remove(
    "hidden"
  );

  showLoginMessage("");
}

/* =====================================================
   EVENTOS DE LOGIN
===================================================== */

document.getElementById(
  "loginBtn"
)?.addEventListener(
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

document.getElementById(
  "createBtn"
)?.addEventListener(
  "click",
  createAccount
);

document.getElementById(
  "showCreateBtn"
)?.addEventListener(
  "click",
  showCreateAccount
);

document.getElementById(
  "backLoginBtn"
)?.addEventListener(
  "click",
  showLoginForm
);

document.getElementById(
  "forgotBtn"
)?.addEventListener(
  "click",
  showForgotForm
);

document.getElementById(
  "resetPasswordBtn"
)?.addEventListener(
  "click",
  resetPassword
);

document.getElementById(
  "logoutBtn"
)?.addEventListener(
  "click",
  logout
);

/* =====================================================
   OCULTAR VALORES
===================================================== */

document.getElementById(
  "toggleHideBtn"
)?.addEventListener(
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
   NAVEGAÇÃO ENTRE MESES
===================================================== */

document.getElementById(
  "prevMonth"
)?.addEventListener(
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

document.getElementById(
  "nextMonth"
)?.addEventListener(
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
   FECHAR MODAL
===================================================== */

document.getElementById(
  "closeModal"
)?.addEventListener(
  "click",
  closeModal
);

document.getElementById(
  "modal"
)?.addEventListener(
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
      "fxDarkMode"
    ) === "true"
  );

  normalizeState(
    state
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

if (
  rememberedUser
) {

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
   INÍCIO DO FX
===================================================== */

if (isLogged()) {

  showApp();

} else {

  document.getElementById(
    "loginScreen"
  )?.classList.remove(
    "hidden"
  );

  document.getElementById(
    "appScreen"
  )?.classList.add(
    "hidden"
  );
}
