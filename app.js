/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.5.2 — Auditoria + Correções
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   SENSIBILIDADE TÁTIL
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
    defaultCategories.map(
      cat => ({ ...cat })
    ),

  months: {},

  reserveBalance: 0,

  currentMonth:
    monthKey(new Date())
};

/* =====================================================
   CONTA LOCAL
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

/* =====================================================
   LOGIN
===================================================== */

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

/* =====================================================
   CRIAR CONTA
===================================================== */

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
      "O usuário precisa ter de 3 a 20 caracteres."
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
    showLoginMessage(
      "As senhas não conferem."
    );

    return;
  }

  if (getAccount()) {
    showLoginMessage(
      "Já existe uma conta neste aparelho."
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
    `Conta criada!\n\nCódigo de recuperação: ${recoveryCode}\n\nGuarde esse código em local seguro.`
  );

  showApp();
}

/* =====================================================
   RECUPERAÇÃO DE SENHA
===================================================== */

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
      "A senha precisa ter exatamente 8 caracteres."
    );

    return;
  }

  account.password =
    newPass;

  saveAccount(account);

  alert(
    "Senha redefinida com sucesso!"
  );

  showLoginForm();
}

/* =====================================================
   LOGOUT
===================================================== */

function logout() {
  vibrate(10);

  localStorage.removeItem(
    SESSION_KEY
  );

  location.reload();
}

/* =====================================================
   DINHEIRO
===================================================== */

/*
  REGRA DO FX:

  - Valores armazenados no estado são CENTAVOS.
  - Strings digitadas pelo usuário são REAIS.
  - Números vindos do estado são tratados como CENTAVOS.

  Exemplo:
    "100,00" -> 10000
    "100.00" -> 10000
    10000    -> 10000
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
    Números que já estão no estado representam
    centavos. Não multiplicar novamente.
  */
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

  /*
    Formato brasileiro:
    1.234,56
    1234,56
  */
  if (text.includes(",")) {
    text =
      text.replace(/\./g, "")
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
    Formato com ponto decimal:
    100.50
  */
  if (
    /^-?\d+\.\d+$/.test(text)
  ) {
    const number =
      Number(text);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.round(
      number * 100
    );
  }

  /*
    Inteiro digitado:
    100 -> R$ 100,00
  */
  const integer =
    Number(
      text.replace(
        /[^0-9-]/g,
        ""
      )
    );

  if (!Number.isFinite(integer)) {
    return 0;
  }

  return Math.round(
    integer * 100
  );
}

function money(cents) {
  if (
    state.settings &&
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
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  if (
    !data.settings ||
    typeof data.settings !== "object"
  ) {
    data.settings = {};
  }

  const settings =
    data.settings;

  settings.plannedSalary =
    parseToCents(
      settings.plannedSalary
    );

  settings.salarySplitEnabled =
    typeof settings.salarySplitEnabled ===
      "boolean"
      ? settings.salarySplitEnabled
      : false;

  settings.advancePercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          settings.advancePercent
        ) || 0
      )
    );

  settings.advanceDay =
    Math.min(
      31,
      Math.max(
        1,
        Number(
          settings.advanceDay
        ) || 20
      )
    );

  settings.mainPaymentLabel =
    String(
      settings.mainPaymentLabel ||
      "5º dia útil"
    ).trim();

  settings.reserveGoal =
    parseToCents(
      settings.reserveGoal
    );

  settings.hideBalance =
    typeof settings.hideBalance ===
      "boolean"
      ? settings.hideBalance
      : false;

  /* ===================================================
     CATEGORIAS
  =================================================== */

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

  /*
    Garante que as categorias padrão
    continuem existindo.
  */

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

  let reserveCategory =
    data.categories.find(
      category =>
        category.id ===
        "reserve"
    );

  if (!reserveCategory) {
    reserveCategory = {
      ...defaultCategories.find(
        category =>
          category.id ===
          "reserve"
      )
    };

    data.categories.unshift(
      reserveCategory
    );
  }

  reserveCategory.name =
    "Reserva";

  reserveCategory.icon =
    "🏦";

  reserveCategory.type =
    "reserve";

  reserveCategory.budget =
    0;

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

  /* ===================================================
     MESES
  =================================================== */

  if (
    !data.months ||
    typeof data.months !==
      "object"
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

    /*
      Campo criado para separar
      o dinheiro extra guardado.
    */
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

    month.expenses.forEach(
      expense => {

        expense.amount =
          parseToCents(
            expense.amount
          );

        expense.source =
          expense.source ===
          "extra"
            ? "extra"
            : "salary";

        expense.categoryId =
          String(
            expense.categoryId ||
            ""
          );

        expense.date =
          String(
            expense.date ||
            monthDateKey(
              new Date()
            )
          );

        expense.note =
          String(
            expense.note ||
            ""
          ).trim();

        if (!expense.id) {
          expense.id =
            createId();
        }
      }
    );

    month.extras.forEach(
      extra => {

        extra.amount =
          parseToCents(
            extra.amount
          );

        extra.name =
          String(
            extra.name ||
            ""
          ).trim();

        extra.date =
          String(
            extra.date ||
            monthDateKey(
              new Date()
            )
          );

        if (!extra.id) {
          extra.id =
            createId();
        }
      }
    );

    month.reserveTransactions.forEach(
      tx => {

        tx.amount =
          parseToCents(
            tx.amount
          );

        tx.type =
          tx.type === "out"
            ? "out"
            : "in";

        tx.date =
          String(
            tx.date ||
            monthDateKey(
              new Date()
            )
          );

        tx.note =
          String(
            tx.note ||
            ""
          ).trim();

        if (!tx.id) {
          tx.id =
            createId();
        }
      }
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
      monthKey(
        new Date()
      );
  }

  data.version =
    "1.5.2";

  return data;
}

/* =====================================================
   LOAD / SAVE
===================================================== */

function load() {
  try {
    const raw =
      localStorage.getItem(
        KEY
      );

    if (!raw) {
      return null;
    }

    const data =
      JSON.parse(raw);

    const normalized =
      normalizeState(data);

    if (normalized) {
      localStorage.setItem(
        KEY,
        JSON.stringify(
          normalized
        )
      );
    }

    return normalized;
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
   MESES
===================================================== */

function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthDateKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function todayKey() {
  return monthDateKey(
    new Date()
  );
}

function monthLabel(key) {
  const [
    year,
    month
  ] =
    key.split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  ).format(
    new Date(
      year,
      month - 1,
      1
    )
  );
}

function monthShift(
  key,
  delta
) {
  const [
    year,
    month
  ] =
    key.split("-")
      .map(Number);

  return monthKey(
    new Date(
      year,
      month - 1 + delta,
      1
    )
  );
}

function getMonth(
  key = state.currentMonth
) {
  if (!state.months[key]) {

    state.months[key] = {
      salaryReceived:
        state.settings
          .plannedSalary || 0,

      expenses: [],

      extras: [],

      reserveContribution:
        0,

      extraReserveContribution:
        0,

      reserveWithdrawal:
        0,

      reserveTransactions:
        [],

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
    month.reserveTransactions =
      [];
  }

  if (
    !Number.isFinite(
      month.salaryReserveReturn
    )
  ) {
    month.salaryReserveReturn =
      0;
  }

  if (
    !Number.isFinite(
      month.extraReserveContribution
    )
  ) {
    month.extraReserveContribution =
      0;
  }

  return month;
}

/* =====================================================
   CÁLCULOS DE GASTOS
===================================================== */

function categorySpent(
  id,
  month
) {
  return month.expenses
    .filter(
      expense =>
        expense.categoryId === id
    )
    .reduce(
      (sum, expense) =>
        sum +
        (
          expense.amount ||
          0
        ),
      0
    );
}

function totalSpent(month) {
  return month.expenses.reduce(
    (sum, expense) =>
      sum +
      (
        expense.amount ||
        0
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
          expense.amount ||
          0
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
          expense.amount ||
          0
        ),
      0
    );
}

function totalExtras(month) {
  return month.extras.reduce(
    (sum, extra) =>
      sum +
      (
        extra.amount ||
        0
      ),
    0
  );
}

/* =====================================================
   SALDO TRANSPORTADO
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

      const available =
        (
          month.salaryReceived ||
          0
        ) +
        (
          month.salaryReserveReturn ||
          0
        ) -
        totalSalarySpent(
          month
        ) -
        (
          month.reserveContribution ||
          0
        );

      carry +=
        Math.max(
          0,
          available
        );
    });

  return Math.max(
    0,
    carry
  );
}

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

      const available =
        totalExtras(
          month
        ) -
        totalExtraSpent(
          month
        ) -
        (
          month.extraReserveContribution ||
          0
        );

      carry +=
        Math.max(
          0,
          available
        );
    });

  return Math.max(
    0,
    carry
  );
}

/* =====================================================
   SALDOS
===================================================== */

function getSalaryAvailable(
  month
) {
  const previous =
    getPreviousSalaryCarryover(
      state.currentMonth
    );

  const salary =
    month.salaryReceived ||
    0;

  const returned =
    month.salaryReserveReturn ||
    0;

  const spent =
    totalSalarySpent(
      month
    );

  const reserved =
    month.reserveContribution ||
    0;

  return Math.max(
    0,
    previous +
      salary +
      returned -
      spent -
      reserved
  );
}

function getExtraAvailable(
  month
) {
  const previous =
    getPreviousExtraCarryover(
      state.currentMonth
    );

  const extras =
    totalExtras(
      month
    );

  const spent =
    totalExtraSpent(
      month
    );

  const reserved =
    month.extraReserveContribution ||
    0;

  return Math.max(
    0,
    previous +
      extras -
      spent -
      reserved
  );
}

function available(month) {
  return (
    getSalaryAvailable(
      month
    ) +
    getExtraAvailable(
      month
    )
  );
}

/* =====================================================
   RESERVA
===================================================== */

function getReserveBalanceUntil(
  limit
) {
  let balance = 0;

  Object.keys(
    state.months
  )
    .sort()
    .forEach(key => {

      if (key > limit) {
        return;
      }

      const month =
        state.months[key];

      balance +=
        month.reserveContribution ||
        0;

      balance +=
        month.extraReserveContribution ||
        0;

      balance -=
        month.reserveWithdrawal ||
        0;
    });

  return Math.max(
    0,
    balance
  );
}

function getReserveBalance() {
  return getReserveBalanceUntil(
    state.currentMonth
  );
}

function syncReserve() {
  state.reserveBalance =
    getReserveBalance();
}

/* =====================================================
   SALÁRIO DIVIDIDO
===================================================== */

function getSalarySplit(
  month
) {
  const salary =
    month.salaryReceived ||
    0;

  if (
    !state.settings
      .salarySplitEnabled
  ) {
    return {
      enabled: false,
      advance: 0,
      main: salary
    };
  }

  const advance =
    Math.round(
      (
        salary *
        (
          state.settings
            .advancePercent ||
          0
        )
      ) /
      100
    );

  return {
    enabled: true,

    advance,

    main:
      salary -
      advance
  };
}

function updatePaymentVisibility() {
  const enabled =
    !!state.settings
      .salarySplitEnabled;

  const advance =
    document.getElementById(
      "advanceValue"
    );

  const paymentCard =
    advance?.closest(
      ".payment"
    ) ||
    advance?.closest(
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
   RENDER PRINCIPAL
===================================================== */

function render() {
  const month =
    getMonth();

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
        available(month)
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
    getSalarySplit(
      month
    );

  const advanceValue =
    document.getElementById(
      "advanceValue"
    );

  if (advanceValue) {
    advanceValue.textContent =
      money(
        split.advance
      );
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
      money(
        split.main
      );
  }

  const mainPayDate =
    document.getElementById(
      "mainPayDate"
    );

  if (mainPayDate) {
    mainPayDate.textContent =
      state.settings
        .mainPaymentLabel;
  }

  updatePaymentVisibility();

  /* ===================================================
     META DA RESERVA
  =================================================== */

  const goal =
    state.settings.reserveGoal ||
    0;

  const goalBox =
    document.getElementById(
      "goalBox"
    );

  if (goalBox) {

    if (goal > 0) {

      const percent =
        Math.min(
          100,
          Math.max(
            0,
            (
              state.reserveBalance /
              goal
            ) *
            100
          )
        );

      goalBox.innerHTML = `
        <div>
          Meta ${money(goal)}
        </div>

        <div class="progress">
          <div style="width:${percent}%"></div>
        </div>
      `;

    } else {
      goalBox.innerHTML = "";
    }
  }

  /* ===================================================
     BARRA MENSAL
  =================================================== */

  const totalIncomes =
    (
      month.salaryReceived ||
      0
    ) +
    totalExtras(month);

  const spent =
    totalSpent(month);

  const percent =
    totalIncomes > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              spent /
              totalIncomes
            ) *
            100
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

  const spentPercentLabel =
    document.getElementById(
      "spentPercentLabel"
    );

  if (spentPercentLabel) {
    spentPercentLabel.textContent =
      `${Math.round(percent)}% gasto`;
  }

  renderCategories();
  renderExtras();
  renderHistoryPreview();
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

      if (
        category.id ===
          "reserve" ||
        category.type ===
          "reserve"
      ) {

        const contribution =
          (
            month.reserveContribution ||
            0
          ) +
          (
            month.extraReserveContribution ||
            0
          );

        const element =
          document.createElement(
            "div"
          );

        element.className =
          "category reserve-cat";

        element.innerHTML = `
          <div class="cat-icon">
            🏦
          </div>

          <div class="cat-main">

            <div class="cat-name">
              Reserva
            </div>

            <div class="cat-sub">
              Guardado neste mês
            </div>

            <div class="progress">
              <div style="width:${
                contribution > 0
                  ? 100
                  : 0
              }%"></div>
            </div>

          </div>

          <div class="cat-value">

            <strong>
              ${money(
                contribution
              )}
            </strong>

            <small>
              guardado
            </small>

          </div>
        `;

        element.addEventListener(
          "click",
          () =>
            openReserve()
        );

        wrap.appendChild(
          element
        );

        return;
      }

      const spent =
        categorySpent(
          category.id,
          month
        );

      const budget =
        category.budget ||
        0;

      const remaining =
        budget -
        spent;

      const percent =
        budget > 0
          ? Math.min(
              100,
              Math.max(
                0,
                (
                  spent /
                  budget
                ) *
                100
              )
            )
          : 0;

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "category";

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
            ${
              budget > 0
                ? `${money(
                    Math.max(
                      0,
                      remaining
                    )
                  )} disponíveis`
                : "Sem limite definido"
            }
          </div>

          <div class="progress">
            <div style="width:${percent}%"></div>
          </div>

        </div>

        <div class="cat-value">

          <strong>
            ${money(spent)}
          </strong>

          ${
            budget > 0
              ? `<small>
                  de ${money(budget)}
                </small>`
              : ""
          }

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

      element.addEventListener(
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

      const edit =
        element.querySelector(
          ".cat-edit"
        );

      if (edit) {
        edit.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            openEditCategory(
              category.id
            );
          }
        );
      }

      wrap.appendChild(
        element
      );
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

        <label>
          Nome
        </label>

        <input
          id="catName"
          required
          maxlength="40"
          placeholder="Ex.: Alimentação"
        >

        <label>
          Ícone
        </label>

        <input
          id="catIcon"
          value="💰"
          maxlength="2"
        >

        <label>
          Valor mensal
        </label>

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

  const form =
    document.getElementById(
      "categoryForm"
    );

  if (!form) {
    return;
  }

  form.onsubmit =
    event => {

      event.preventDefault();

      const name =
        document.getElementById(
          "catName"
        ).value.trim();

      const amount =
        numCents(
          "catBudget"
        );

      if (!name) {
        alert(
          "Digite um nome."
        );

        return;
      }

      if (amount < 0) {
        alert(
          "Digite um valor válido."
        );

        return;
      }

      state.categories.push({
        id:
          "cat_" +
          createId(),

        name,

        icon:
          document.getElementById(
            "catIcon"
          ).value.trim() ||
          "💰",

        budget:
          amount,

        type:
          "expense"
      });

      save();

      closeModal();

      render();
    };
}

/* =====================================================
   EDITAR CATEGORIA
===================================================== */

function openEditCategory(
  id
) {
  if (
    id === "reserve"
  ) {
    openReserve();
    return;
  }

  const category =
    state.categories.find(
      c =>
        c.id === id
    );

  if (
    !category ||
    category.type ===
      "reserve"
  ) {
    return;
  }

  openModal(
    "Editar categoria",
    `
      <form
        class="form"
        id="editCategoryForm"
      >

        <label>
          Nome
        </label>

        <input
          id="editCatName"
          value="${escapeHtml(
            category.name
          )}"
          required
        >

        <label>
          Ícone
        </label>

        <input
          id="editCatIcon"
          value="${escapeHtml(
            category.icon
          )}"
          maxlength="2"
        >

        <label>
          Valor mensal
        </label>

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

  const form =
    document.getElementById(
      "editCategoryForm"
    );

  if (form) {
    form.onsubmit =
      event => {

        event.preventDefault();

        const name =
          document.getElementById(
            "editCatName"
          ).value.trim();

        if (!name) {
          alert(
            "Digite um nome."
          );

          return;
        }

        category.name =
          name;

        category.icon =
          document.getElementById(
            "editCatIcon"
          ).value.trim() ||
          "💰";

        category.budget =
          numCents(
            "editCatBudget"
          );

        save();

        closeModal();

        render();
      };
  }

  const deleteBtn =
    document.getElementById(
      "deleteCategoryBtn"
    );

  if (deleteBtn) {
    deleteBtn.onclick =
      () => {

        if (
          !confirm(
            `Excluir a categoria "${category.name}"? Os gastos antigos serão mantidos no extrato.`
          )
        ) {
          return;
        }

        state.categories =
          state.categories.filter(
            c =>
              c.id !== id
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

function getSelectedMonthDate() {
  const realMonth =
    monthKey(
      new Date()
    );

  if (
    state.currentMonth ===
    realMonth
  ) {
    return todayKey();
  }

  const [
    year,
    month
  ] =
    state.currentMonth
      .split("-");

  return `${year}-${month}-01`;
}

function openExpense(
  categoryId =
    state.categories.find(
      c =>
        c.type ===
        "expense"
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
              c.id ===
              categoryId
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

  const selectedDate =
    getSelectedMonthDate();

  const month =
    getMonth();

  const salaryAvailable =
    getSalaryAvailable(
      month
    );

  const extraAvailable =
    getExtraAvailable(
      month
    );

  openModal(
    "Adicionar gasto",
    `
      <form
        class="form"
        id="expenseForm"
      >

        <label>
          Valor
        </label>

        <input
          id="expenseAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <label>
          Categoria
        </label>

        <select
          id="expenseCategory"
        >
          ${options}
        </select>

        <label>
          De onde saiu o dinheiro?
        </label>

        <select
          id="expenseSource"
        >

          <option value="salary">
            Salário — ${money(
              salaryAvailable
            )}
            disponível
          </option>

          <option value="extra">
            Extra — ${money(
              extraAvailable
            )}
            disponível
          </option>

        </select>

        <label>
          Data
        </label>

        <input
          id="expenseDate"
          type="date"
          value="${selectedDate}"
        >

        <label>
          Onde / com o que gastei?
        </label>

        <input
          id="expenseNote"
          maxlength="120"
          placeholder="Ex.: mercado, farmácia, gasolina..."
        >

        <button type="submit">
          Salvar gasto
        </button>

      </form>
    `
  );

  const form =
    document.getElementById(
      "expenseForm"
    );

  if (!form) {
    return;
  }

  form.onsubmit =
    event => {

      event.preventDefault();

      const amount =
        numCents(
          "expenseAmount"
        );

      if (amount <= 0) {
        alert(
          "Digite um valor válido maior que zero."
        );

        return;
      }

      const source =
        document.getElementById(
          "expenseSource"
        ).value;

      const currentMonth =
        getMonth();

      const salary =
        getSalaryAvailable(
          currentMonth
        );

      const extra =
        getExtraAvailable(
          currentMonth
        );

      if (
        source === "salary" &&
        amount > salary
      ) {
        alert(
          `Saldo de salário insuficiente.\n\nDisponível: ${money(
            salary
          )}\nTentativa: ${money(
            amount
          )}`
        );

        return;
      }

      if (
        source === "extra" &&
        amount > extra
      ) {
        alert(
          `Saldo de extras insuficiente.\n\nDisponível: ${money(
            extra
          )}\nTentativa: ${money(
            amount
          )}`
        );

        return;
      }

      const date =
        document.getElementById(
          "expenseDate"
        ).value ||
        selectedDate;

      if (
        !date.startsWith(
          state.currentMonth
        )
      ) {
        alert(
          "A data do gasto precisa pertencer ao mês selecionado."
        );

        return;
      }

      currentMonth.expenses.push({
        id:
          createId(),

        categoryId:
          document.getElementById(
            "expenseCategory"
          ).value,

        amount,

        source,

        date,

        note:
          document.getElementById(
            "expenseNote"
          ).value.trim()
      });

      save();

      closeModal();

      render();
    };
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

  if (!container) {
    return;
  }

  if (
    month.extras.length ===
    0
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
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            deleteExtra(
              button.dataset.id
            )
        );

      }
    );
}

function openExtra() {
  const today =
    getSelectedMonthDate();

  openModal(
    "Adicionar entrada extra",
    `
      <form
        class="form"
        id="extraForm"
      >

        <label>
          Descrição
        </label>

        <input
          id="extraName"
          maxlength="80"
          placeholder="Ex.: venda de algo pessoal"
          required
        >

        <label>
          Valor
        </label>

        <input
          id="extraAmount"
          inputmode="decimal"
          placeholder="R$ 0,00"
          required
        >

        <label>
          Data
        </label>

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

  const form =
    document.getElementById(
      "extraForm"
    );

  if (!form) {
    return;
  }

  form.onsubmit =
    event => {

      event.preventDefault();

      const name =
        document.getElementById(
          "extraName"
        ).value.trim();

      const amount =
        numCents(
          "extraAmount"
        );

      const date =
        document.getElementById(
          "extraDate"
        ).value;

      if (
        !name ||
        amount <= 0
      ) {
        alert(
          "Informe uma descrição e um valor válido maior que zero."
        );

        return;
      }

      if (
        !date.startsWith(
          state.currentMonth
        )
      ) {
        alert(
          "A data da entrada extra precisa pertencer ao mês selecionado."
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

        date
      });

      save();

      closeModal();

      render();
    };
}

function deleteExtra(id) {
  const month =
    getMonth();

  const extra =
    month.extras.find(
      item =>
        item.id === id
    );

  if (!extra) {
    return;
  }

  if (
    !confirm(
      `Excluir a entrada "${extra.name}" de ${money(
        extra.amount
      )}?`
    )
  ) {
    return;
  }

  /*
    Quanto de extras está comprometido
    atualmente com gastos?
  */
  const extraSpent =
    totalExtraSpent(
      month
    );

  /*
    Quanto dos extras está comprometido
    com a reserva?
  */
  const extraReserve =
    month.extraReserveContribution ||
    0;

  const remainingExtras =
    month.extras
      .filter(
        item =>
          item.id !== id
      )
      .reduce(
        (sum, item) =>
          sum +
          (
            item.amount ||
            0
          ),
        0
      );

  if (
    remainingExtras <
    (
      extraSpent +
      extraReserve
    )
  ) {
    alert(
      "Este extra não pode ser excluído pois seu saldo já está comprometido por gastos ou pela reserva."
    );

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

  const contribution =
    month.reserveContribution ||
    0;

  const extraContribution =
    month.extraReserveContribution ||
    0;

  const withdrawal =
    month.reserveWithdrawal ||
    0;

  const reserveBalance =
    getReserveBalance();

  const availableMoney =
    available(month);

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
          Valor total guardado
        </strong>

        <br>

        ${money(
          reserveBalance
        )}

        ${goalText}

        <br><br>

        <strong>
          Disponível para guardar
        </strong>

        <br>

        ${money(
          availableMoney
        )}

        <br><br>

        <strong>
          Guardado do salário neste mês
        </strong>

        <br>

        ${money(
          contribution
        )}

        <br><br>

        <strong>
          Guardado dos extras neste mês
        </strong>

        <br>

        ${money(
          extraContribution
        )}

        <br><br>

        <strong>
          Resgatado neste mês
        </strong>

        <br>

        ${money(
          withdrawal
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
          De onde saiu o dinheiro?
        </label>

        <select
          id="reserveSource"
        >

          <option value="salary">
            Salário
          </option>

          <option value="extra">
            Extra
          </option>

        </select>

        <label>
          Observação
        </label>

        <input
          id="reserveNote"
          maxlength="120"
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
          maxlength="120"
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

  const reserveForm =
    document.getElementById(
      "reserveForm"
    );

  if (reserveForm) {

    reserveForm.onsubmit =
      event => {

        event.preventDefault();

        const amount =
          numCents(
            "reserveAmount"
          );

        if (amount <= 0) {
          alert(
            "Digite um valor válido maior que zero."
          );

          return;
        }

        const source =
          document.getElementById(
            "reserveSource"
          ).value;

        const currentAvailable =
          source === "extra"
            ? getExtraAvailable(
                month
              )
            : getSalaryAvailable(
                month
              );

        if (
          amount >
          currentAvailable
        ) {

          alert(
            `Saldo insuficiente.\n\nDisponível: ${money(
              currentAvailable
            )}\nTentativa: ${money(
              amount
            )}`
          );

          return;
        }

        const note =
          document.getElementById(
            "reserveNote"
          ).value.trim();

        if (
          source ===
          "extra"
        ) {

          month.extraReserveContribution =
            (
              month.extraReserveContribution ||
              0
            ) +
            amount;

        } else {

          month.reserveContribution =
            (
              month.reserveContribution ||
              0
            ) +
            amount;
        }

        month.reserveTransactions.push({
          id:
            createId(),

          type:
            "in",

          source,

          amount,

          date:
            getSelectedMonthDate(),

          note
        });

        save();

        closeModal();

        render();
      };
  }

  const withdrawForm =
    document.getElementById(
      "withdrawForm"
    );

  if (withdrawForm) {

    withdrawForm.onsubmit =
      event => {

        event.preventDefault();

        const amount =
          numCents(
            "withdrawAmount"
          );

        const currentReserve =
          getReserveBalance();

        if (amount <= 0) {
          alert(
            "Digite um valor válido maior que zero."
          );

          return;
        }

        if (
          amount >
          currentReserve
        ) {
          alert(
            `Saldo insuficiente na reserva.\n\nDisponível: ${money(
              currentReserve
            )}\nTentativa: ${money(
              amount
            )}`
          );

          return;
        }

        const note =
          document.getElementById(
            "withdrawNote"
          ).value.trim();

        /*
          O resgate volta para o saldo geral.
          Mantemos salaryReserveReturn para
          preservar compatibilidade com os
          dados antigos do FX.
        */
        month.reserveWithdrawal =
          (
            month.reserveWithdrawal ||
            0
          ) +
          amount;

        month.salaryReserveReturn =
          (
            month.salaryReserveReturn ||
            0
          ) +
          amount;

        month.reserveTransactions.push({
          id:
            createId(),

          type:
            "out",

          amount,

          date:
            getSelectedMonthDate(),

          note
        });

        save();

        closeModal();

        render();
      };
  }

  const closeBtn =
    document.getElementById(
      "closeReserveBtn"
    );

  if (closeBtn) {
    closeBtn.onclick =
      closeModal;
  }
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
        type:
          "expense",

        date:
          expense.date,

        amount:
          expense.amount ||
          0,

        name:
          category
            ? category.name
            : "Categoria removida",

        icon:
          category
            ? category.icon
            : "💰",

        note:
          expense.source ===
          "extra"
            ? `Pago com Extra${
                expense.note
                  ? " — " +
                    expense.note
                  : ""
              }`
            : expense.note ||
              "",

        id:
          expense.id
      });
    }
  );

  month.extras.forEach(
    extra => {

      items.push({
        type:
          "extra-in",

        date:
          extra.date,

        amount:
          extra.amount ||
          0,

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

  if (
    Array.isArray(
      month.reserveTransactions
    )
  ) {

    month.reserveTransactions.forEach(
      tx => {

        items.push({
          type:
            tx.type ===
            "in"
              ? "reserve-in"
              : "reserve-out",

          date:
            tx.date,

          amount:
            tx.amount ||
            0,

          name:
            tx.type ===
            "in"
              ? "Dinheiro guardado"
              : "Dinheiro resgatado",

          icon:
            tx.type ===
            "in"
              ? "🏦"
              : "💸",

          note:
            tx.note ||
            "",

          id:
            tx.id
        });

      }
    );
  }

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

  if (!container) {
    return;
  }

  const month =
    getMonth();

  const items =
    getHistory(
      month
    );

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

function historyItemHtml(
  item
) {

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

    prefix =
      "+ ";
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
    getHistory(
      month
    );

  const expensesTotal =
    totalSpent(
      month
    );

  const extrasTotal =
    totalExtras(
      month
    );

  const contribution =
    (
      month.reserveContribution ||
      0
    ) +
    (
      month.extraReserveContribution ||
      0
    );

  const withdrawal =
    month.reserveWithdrawal ||
    0;

  const salarySpent =
    totalSalarySpent(
      month
    );

  const extraSpent =
    totalExtraSpent(
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
          Extras recebidos
        </span>

        <strong>
          ${money(
            extrasTotal
          )}
        </strong>
      </div>

      <div class="history-total">
        <span>
          Gastos com salário
        </span>

        <strong>
          ${money(
            salarySpent
          )}
        </strong>
      </div>

      <div class="history-total">
        <span>
          Gastos com extras
        </span>

        <strong>
          ${money(
            extraSpent
          )}
        </strong>
      </div>

      <div class="history-total">
        <span>
          Total de gastos
        </span>

        <strong>
          ${money(
            expensesTotal
          )}
        </strong>
      </div>

      <div class="history-total">
        <span>
          Guardado na reserva
        </span>

        <strong>
          ${money(
            contribution
          )}
        </strong>
      </div>

      <div class="history-total">
        <span>
          Resgatado da reserva
        </span>

        <strong>
          ${money(
            withdrawal
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

        <div
          id="salarySplitOptions"
        >

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

          <label>
            Texto do pagamento principal
          </label>

          <input
            id="sMain"
            value="${escapeHtml(
              state.settings
                .mainPaymentLabel
            )}"
          >

        </div>

        <label>
          Meta da reserva (opcional)
        </label>

        <input
          id="sGoal"
          inputmode="decimal"
          value="${
            state.settings.reserveGoal >
            0
              ? (
                  state.settings
                    .reserveGoal /
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
        Use a opção de exportação antes de limpar
        os dados do navegador.
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

  if (darkToggle) {
    darkToggle.checked =
      localStorage.getItem(
        "fxDarkMode"
      ) === "true";
  }

  const salarySplitToggle =
    document.getElementById(
      "salarySplitToggle"
    );

  const salarySplitOptions =
    document.getElementById(
      "salarySplitOptions"
    );

  if (
    salarySplitToggle
  ) {
    salarySplitToggle.checked =
      !!state.settings
        .salarySplitEnabled;
  }

  function updateSalarySplitOptions() {

    if (
      salarySplitOptions &&
      salarySplitToggle
    ) {
      salarySplitOptions.classList.toggle(
        "hidden",
        !salarySplitToggle.checked
      );
    }
  }

  updateSalarySplitOptions();

  if (salarySplitToggle) {
    salarySplitToggle.onchange =
      updateSalarySplitOptions;
  }

  const settingsForm =
    document.getElementById(
      "settingsForm"
    );

  if (settingsForm) {

    settingsForm.onsubmit =
      event => {

        event.preventDefault();

        const newSalary =
          numCents(
            "sSalary"
          );

        const committedSalary =
          totalSalarySpent(
            month
          ) +
          (
            month.reserveContribution ||
            0
          ) -
          (
            month.salaryReserveReturn ||
            0
          );

        if (
          newSalary <
          committedSalary
        ) {

          alert(
            `O salário não pode ser reduzido para ${money(
              newSalary
            )}.\n\nJá existem ${money(
              committedSalary
            )} comprometidos neste mês.`
          );

          return;
        }

        month.salaryReceived =
          newSalary;

        state.settings.plannedSalary =
          newSalary;

        state.settings.salarySplitEnabled =
          !!salarySplitToggle?.checked;

        state.settings.advancePercent =
          Math.min(
            100,
            Math.max(
              0,
              Number(
                document.getElementById(
                  "sPercent"
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
                  "sDay"
                )?.value
              ) || 20
            )
          );

        state.settings.mainPaymentLabel =
          document.getElementById(
            "sMain"
          )?.value.trim() ||
          "5º dia útil";

        state.settings.reserveGoal =
          Math.max(
            0,
            numCents(
              "sGoal"
            )
          );

        const dark =
          !!darkToggle?.checked;

        document.body.classList.toggle(
          "dark",
          dark
        );

        localStorage.setItem(
          "fxDarkMode",
          String(dark)
        );

        save();

        closeModal();

        render();
      };
  }

  const exportBtn =
    document.getElementById(
      "exportBtn"
    );

  if (exportBtn) {
    exportBtn.onclick =
      exportData;
  }

  const resetBtn =
    document.getElementById(
      "resetBtn"
    );

  if (resetBtn) {

    resetBtn.onclick =
      () => {

        if (
          !confirm(
            "Apagar todos os dados do FX?"
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

        localStorage.removeItem(
          REMEMBER_KEY
        );

        localStorage.removeItem(
          "fxDarkMode"
        );

        location.reload();
      };
  }
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
          ative essa opção em ⚙️ Configurações.

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

        — dia
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
        ${escapeHtml(
          state.settings
            .mainPaymentLabel
        )}

      </div>
    `
  );
}

/* =====================================================
   BACKUP
===================================================== */

function exportData() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          state,
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

  a.href =
    url;

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
   UTILITÁRIOS
===================================================== */

function escapeHtml(s) {
  return String(
    s
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
    String(
      Date.now()
    ) +
    String(
      Math.random()
    ).slice(2)
  );
}

function formatDate(
  date
) {
  if (!date) {
    return "";
  }

  const parts =
    String(date)
      .split("-");

  if (
    parts.length !==
    3
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

  if (titleElement) {
    titleElement.textContent =
      title;
  }

  if (bodyElement) {
    bodyElement.innerHTML =
      html;
  }

  if (modal) {
    modal.classList.remove(
      "hidden"
    );
  }
}

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

/* =====================================================
   UI LOGIN
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
    "createForm"
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
   EVENTOS
===================================================== */

function bindClick(
  id,
  callback
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.onclick =
      callback;
  }
}

bindClick(
  "loginBtn",
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

bindClick(
  "createBtn",
  createAccount
);

bindClick(
  "showCreateBtn",
  showCreateAccount
);

bindClick(
  "backLoginBtn",
  showLoginForm
);

bindClick(
  "forgotBtn",
  showForgotForm
);

bindClick(
  "backForgotBtn",
  showLoginForm
);

bindClick(
  "resetPasswordBtn",
  resetPassword
);

bindClick(
  "logoutBtn",
  logout
);

bindClick(
  "prevMonth",
  () => {

    state.currentMonth =
      monthShift(
        state.currentMonth,
        -1
      );

    save();

    render();
  }
);

bindClick(
  "nextMonth",
  () => {

    state.currentMonth =
      monthShift(
        state.currentMonth,
        1
      );

    save();

    render();
  }
);

bindClick(
  "addExpenseBtn",
  () =>
    openExpense()
);

bindClick(
  "addCategoryBtn",
  openCategory
);

bindClick(
  "addExtraBtn",
  openExtra
);

bindClick(
  "settingsBtn",
  openSettings
);

bindClick(
  "paymentsSettingsBtn",
  openPayments
);

bindClick(
  "reserveBtn",
  openReserve
);

bindClick(
  "historyBtn",
  openHistory
);

bindClick(
  "historyBtn2",
  openHistory
);

bindClick(
  "toggleHideBtn",
  () => {

    state.settings.hideBalance =
      !state.settings
        .hideBalance;

    save();

    render();
  }
);

bindClick(
  "closeModal",
  closeModal
);

/* =====================================================
   FECHAR MODAL AO CLICAR FORA
===================================================== */

const modal =
  document.getElementById(
    "modal"
  );

if (modal) {

  modal.addEventListener(
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
}

/* =====================================================
   ENTER NO LOGIN
===================================================== */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Enter"
    ) {
      return;
    }

    const loginForm =
      document.getElementById(
        "loginForm"
      );

    if (
      loginForm &&
      !loginForm.classList.contains(
        "hidden"
      )
    ) {

      const loginBtn =
        document.getElementById(
          "loginBtn"
        );

      if (loginBtn) {
        loginBtn.click();
      }
    }
  }
);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

function initFinance() {

  /*
    Normaliza novamente o estado
    atual sem alterar a regra
    dos valores em centavos.
  */

  const normalized =
    normalizeState(
      state
    );

  if (normalized) {
    Object.assign(
      state,
      normalized
    );
  }

  getMonth();

  syncReserve();

  save();

  document.body.classList.toggle(
    "dark",
    localStorage.getItem(
      "fxDarkMode"
    ) === "true"
  );

  render();
}

/* =====================================================
   INÍCIO
===================================================== */

const rememberedUser =
  localStorage.getItem(
    REMEMBER_KEY
  );

if (rememberedUser) {

  const usernameInput =
    document.getElementById(
      "loginUsername"
    );

  const rememberToggle =
    document.getElementById(
      "rememberUserToggle"
    );

  if (usernameInput) {
    usernameInput.value =
      rememberedUser;
  }

  if (rememberToggle) {
    rememberToggle.checked =
      true;
  }
}

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
