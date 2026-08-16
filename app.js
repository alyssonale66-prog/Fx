const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";


/* =========================
   CONTA
========================= */

function getAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY));
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

  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta criada ainda.");
    return;
  }

  if (
    username !== account.username ||
    password !== account.password
  ) {
    showLoginMessage("Usuário ou senha incorretos.");
    return;
  }

  localStorage.setItem(SESSION_KEY, "true");

  showApp();
}

function createAccount() {

  const username =
    document
      .getElementById("createUsername")
      .value
      .trim();

  const password =
    document
      .getElementById("createPassword")
      .value;

  const confirmation =
    document
      .getElementById("createPasswordConfirm")
      .value;

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
    showLoginMessage(
      "As senhas não são iguais."
    );

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

  localStorage.setItem(
    SESSION_KEY,
    "true"
  );

  showApp();
}

function logout() {

  localStorage.removeItem(
    SESSION_KEY
  );

  document
    .getElementById("appScreen")
    .classList.add("hidden");

  document
    .getElementById("loginScreen")
    .classList.remove("hidden");

  document
    .getElementById("loginUsername")
    .value = "";

  document
    .getElementById("loginPassword")
    .value = "";

  showLoginMessage("");
}

function showLoginMessage(message) {

  document
    .getElementById("loginMessage")
    .textContent = message;
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


/* =========================
   FINANÇAS
========================= */

const defaultCategories = [
  {
    id: "fixed",
    name: "Fixo",
    icon: "🏠",
    type: "expense",
    budget: 600
  },
  {
    id: "reserve",
    name: "Reserva",
    icon: "🏦",
    type: "reserve",
    budget: 315
  },
  {
    id: "meds",
    name: "Medicamentos",
    icon: "💊",
    type: "expense",
    budget: 200
  },
  {
    id: "leisure",
    name: "Lazer",
    icon: "🎮",
    type: "expense",
    budget: 200
  },
  {
    id: "phone",
    name: "Celular",
    icon: "📱",
    type: "expense",
    budget: 35
  }
];

const state =
  load() || {

    settings: {
      plannedSalary: 1350,
      advancePercent: 40,
      advanceDay: 20,
      mainPaymentLabel: "5º dia útil",
      reserveGoal: 0
    },

    categories: defaultCategories,

    months: {},

    reserveBalance: 0,

    currentMonth: monthKey(new Date())
  };


function load() {

  try {

    return JSON.parse(
      localStorage.getItem(KEY)
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


function monthKey(d) {

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;

}


function getMonth(
  key = state.currentMonth
) {

  if (!state.months[key]) {

    state.months[key] = {

      salaryReceived:
        state.settings.plannedSalary,

      expenses: [],

      reserveContribution: 0,

      reserveWithdrawal: 0

    };

    save();

  }

  return state.months[key];

}


function money(v) {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(Number(v) || 0);

}


function monthLabel(key) {

  const [y, m] =
    key.split("-").map(Number);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  ).format(
    new Date(y, m - 1, 1)
  );

}


function monthShift(key, delta) {

  const [y, m] =
    key.split("-").map(Number);

  return monthKey(
    new Date(
      y,
      m - 1 + delta,
      1
    )
  );

}


function categorySpent(id, month) {

  return month.expenses

    .filter(
      e => e.categoryId === id
    )

    .reduce(
      (s, e) =>
        s + Number(e.amount),
      0
    );

}


function plannedTotal() {

  return state.categories.reduce(
    (s, c) =>
      s + Number(c.budget || 0),
    0
  );

}


function calculatedReserveContribution(
  month
) {

  const base =
    state.categories.find(
      c => c.id === "reserve"
    );

  const baseReserve =
    Number(base?.budget || 0);

  const extra =
    Math.max(
      0,
      Number(
        month.salaryReceived || 0
      ) - plannedTotal()
    );

  return baseReserve + extra;

}


function syncReserve() {

  const keys =
    Object.keys(
      state.months
    ).sort();

  let balance = 0;

  for (const k of keys) {

    const m =
      state.months[k];

    if (!m) continue;

    const desired =
      calculatedReserveContribution(
        m
      );

    if (
      m._autoReserve !== desired
    ) {

      m.reserveContribution =
        desired;

      m._autoReserve =
        desired;

    }

    balance +=
      Number(
        m.reserveContribution || 0
      ) -
      Number(
        m.reserveWithdrawal || 0
      );

  }

  state.reserveBalance =
    Math.max(0, balance);

  save();

}


function totalSpent(month) {

  return month.expenses.reduce(
    (s, e) =>
      s + Number(e.amount),
    0
  );

}


function available(month) {

  const reserve =
    Number(
      month.reserveContribution || 0
    );

  return (
    Number(
      month.salaryReceived || 0
    ) -
    reserve -
    totalSpent(month)
  );

}


function render() {

  const month =
    getMonth();

  syncReserve();

  document.getElementById(
    "monthTitle"
  ).textContent =
    monthLabel(
      state.currentMonth
    );

  document.getElementById(
    "availableValue"
  ).textContent =
    money(
      Math.max(
        0,
        available(month)
      )
    );

  document.getElementById(
    "salaryValue"
  ).textContent =
    money(
      month.salaryReceived
    );

  document.getElementById(
    "spentValue"
  ).textContent =
    money(
      totalSpent(month)
    );

  document.getElementById(
    "reserveValue"
  ).textContent =
    money(
      state.reserveBalance
    );

  document.getElementById(
    "reserveBig"
  ).textContent =
    money(
      state.reserveBalance
    );


  const adv =
    Number(
      month.salaryReceived || 0
    ) *
    Number(
      state.settings.advancePercent || 0
    ) /
    100;

  document.getElementById(
    "advanceValue"
  ).textContent =
    money(adv);

  document.getElementById(
    "advanceDate"
  ).textContent =
    `Dia ${state.settings.advanceDay}`;

  document.getElementById(
    "mainPayValue"
  ).textContent =
    money(
      Number(
        month.salaryReceived || 0
      ) - adv
    );

  document.getElementById(
    "mainPayDate"
  ).textContent =
    state.settings.mainPaymentLabel;


  const goal =
    Number(
      state.settings.reserveGoal || 0
    );

  const goalBox =
    document.getElementById(
      "goalBox"
    );

  goalBox.innerHTML =
    goal > 0

      ? `Meta ${money(goal)}

        <div class="progress">
          <div style="width:${Math.min(
            100,
            state.reserveBalance /
              goal *
              100
          )}%"></div>
        </div>`

      : "Defina uma meta em ⚙️";


  const wrap =
    document.getElementById(
      "categories"
    );

  wrap.innerHTML = "";


  state.categories.forEach(c => {

    const spent =
      c.type === "reserve"

        ? Number(
            month.reserveContribution || 0
          )

        : categorySpent(
            c.id,
            month
          );


    const remaining =
      c.type === "reserve"

        ? Number(
            month.reserveContribution || 0
          )

        : Number(
            c.budget || 0
          ) - spent;


    const pct =
      c.type === "reserve"

        ? 100

        : Math.min(
            100,
            Math.max(
              0,
              (
                spent /
                Math.max(
                  1,
                  Number(
                    c.budget || 0
                  )
                )
              ) *
              100
            )
          );


    const el =
      document.createElement(
        "div"
      );

    el.className =
      "category" +
      (
        c.type === "reserve"
          ? " reserve-cat"
          : ""
      );


    el.innerHTML = `

      <div class="cat-icon">
        ${c.icon}
      </div>

      <div class="cat-main">

        <div class="cat-name">
          ${escapeHtml(c.name)}
        </div>

        <div class="cat-sub">

          ${
            c.type === "reserve"

              ? "Aporte deste mês"

              : `${money(
                  Math.max(
                    0,
                    remaining
                  )
                )} disponíveis`
          }

        </div>

        <div class="progress">
          <div
            style="width:${pct}%"
          ></div>
        </div>

      </div>

      <div class="cat-value">

        <strong>
          ${money(spent)}
        </strong>

        <small>

          ${
            c.type === "reserve"

              ? "aporte"

              : `de ${money(
                  c.budget
                )}`
          }

        </small>

      </div>
    `;


    if (
      c.type !== "reserve"
    ) {

      el.addEventListener(
        "click",
        () =>
          openExpense(c.id)
      );

    } else {

      el.addEventListener(
        "click",
        openReserve
      );

    }


    wrap.appendChild(el);

  });

}


function escapeHtml(s) {

  return String(s).replace(
    /[&<>"']/g,
    x =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[x])
  );

}


function openModal(
  title,
  html
) {

  document.getElementById(
    "modalTitle"
  ).textContent =
    title;

  document.getElementById(
    "modalBody"
  ).innerHTML =
    html;

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


/* =========================
   GASTO
========================= */

function openExpense(
  categoryId =
    state.categories.find(
      c => c.type === "expense"
    )?.id
) {

  const options =
    state.categories

      .filter(
        c => c.type === "expense"
      )

      .map(
        c =>
          `<option value="${c.id}" ${
            c.id === categoryId
              ? "selected"
              : ""
          }>
            ${c.icon}
            ${escapeHtml(c.name)}
          </option>`
      )

      .join("");


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
        Data
      </label>

      <input
        id="expenseDate"
        type="date"
        value="${new Date()
          .toISOString()
          .slice(0, 10)}"
      >

      <label>
        Observação (opcional)
      </label>

      <input
        id="expenseNote"
        placeholder="Ex.: mercado"
      >

      <button>
        Salvar gasto
      </button>

    </form>
    `
  );


  document.getElementById(
    "expenseForm"
  ).onsubmit = e => {

    e.preventDefault();


    const raw =
      document.getElementById(
        "expenseAmount"
      )
      .value
      .replace(/\./g, "")
      .replace(",", ".");


    const amount =
      Number(raw);


    if (!(amount > 0)) {

      return alert(
        "Digite um valor válido."
      );

    }


    const m =
      getMonth();


    m.expenses.push({

      id:
        crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),

      categoryId:
        document.getElementById(
          "expenseCategory"
        ).value,

      amount,

      date:
        document.getElementById(
          "expenseDate"
        ).value,

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


/* =========================
   CATEGORIA
========================= */

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

      <label>
        Tipo
      </label>

      <select id="catType">

        <option value="expense">
          Gasto
        </option>

        <option value="reserve">
          Reserva
        </option>

      </select>

      <button>
        Criar categoria
      </button>

    </form>
    `
  );


  document.getElementById(
    "categoryForm"
  ).onsubmit = e => {

    e.preventDefault();


    const amount =
      Number(
        document.getElementById(
          "catBudget"
        )
        .value
        .replace(/\./g, "")
        .replace(",", ".")
      );


    const name =
      document.getElementById(
        "catName"
      )
      .value
      .trim();


    if (
      !name ||
      !(amount >= 0)
    ) return;


    state.categories.push({

      id:
        "cat_" +
        Date.now(),

      name,

      icon:
        document.getElementById(
          "catIcon"
        ).value ||
        "💰",

      budget:
        amount,

      type:
        document.getElementById(
          "catType"
        ).value

    });


    save();

    closeModal();

    render();

  };

}


/* =========================
   CONFIGURAÇÕES
========================= */

function openSettings() {

  openModal(

    "Configurações",

    `
    <form
      class="form"
      id="settingsForm"
    >

      <label>
        Salário planejado
      </label>

      <input
        id="sSalary"
        inputmode="decimal"
        value="${state.settings.plannedSalary}"
      >

      <label>
        Percentual do adiantamento
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
          state.settings.mainPaymentLabel
        )}"
      >

      <label>
        Meta da reserva
      </label>

      <input
        id="sGoal"
        inputmode="decimal"
        value="${state.settings.reserveGoal}"
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


      <button class="save-settings-btn">
        Salvar
      </button>

    </form>


    <div
      class="notice"
      style="margin-top:12px"
    >
      Os dados ficam somente neste aparelho.
      Use a opção de exportação antes de
      limpar o navegador.
    </div>


    <button
      class="secondary"
      style="width:100%;margin-top:10px;padding:13px;border-radius:12px"
      id="exportBtn"
    >
      Exportar backup JSON
    </button>


    <button
      class="danger"
      style="width:100%;margin-top:10px;padding:13px;border-radius:12px"
      id="resetBtn"
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
      "fxDarkMode"
    ) === "true";


  document.getElementById(
    "settingsForm"
  ).onsubmit = e => {

    e.preventDefault();


    state.settings.plannedSalary =
      num("sSalary");


    state.settings.advancePercent =
      Number(
        document.getElementById(
          "sPercent"
        ).value
      ) || 0;


    state.settings.advanceDay =
      Number(
        document.getElementById(
          "sDay"
        ).value
      ) || 20;


    state.settings.mainPaymentLabel =
      document.getElementById(
        "sMain"
      ).value ||
      "5º dia útil";


    state.settings.reserveGoal =
      num("sGoal");


    const dark =
      darkToggle.checked;


    document.body.classList.toggle(
      "dark",
      dark
    );


    localStorage.setItem(
      "fxDarkMode",
      dark
    );


    save();

    closeModal();

    render();

  };


  document.getElementById(
    "exportBtn"
  ).onclick =
    exportData;


  document.getElementById(
    "resetBtn"
  ).onclick = () => {

    if (
      confirm(
        "Apagar todos os dados do FX?"
      )
    ) {

      localStorage.removeItem(
        KEY
      );

      location.reload();

    }

  };

}


function num(id) {

  return Number(

    document.getElementById(
      id
    )
    .value
    .replace(/\./g, "")
    .replace(",", ".")

  ) || 0;

}


/* =========================
   RESERVA
========================= */

function openReserve() {

  const m =
    getMonth();


  const contribution =
    Number(
      m.reserveContribution || 0
    );


  openModal(

    "Reserva",

    `
    <div class="notice">

      Aporte deste mês:
      <strong>
        ${money(contribution)}
      </strong>

      <br>

      Reserva acumulada:
      <strong>
        ${money(state.reserveBalance)}
      </strong>

    </div>


    <form
      class="form"
      id="withdrawForm"
      style="margin-top:12px"
    >

      <label>
        Retirar da reserva
      </label>

      <input
        id="withdrawAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <button class="danger">
        Registrar retirada
      </button>

    </form>


    <button
      class="secondary"
      id="closeReserveBtn"
      style="width:100%;padding:13px;border-radius:12px;margin-top:10px"
    >
      Fechar
    </button>
    `
  );


  document.getElementById(
    "withdrawForm"
  ).onsubmit = e => {

    e.preventDefault();


    const amount =
      num("withdrawAmount");


    if (
      !(amount > 0) ||
      amount >
        state.reserveBalance
    ) {

      return alert(
        "Valor inválido ou maior que a reserva."
      );

    }


    m.reserveWithdrawal =
      Number(
        m.reserveWithdrawal || 0
      ) + amount;


    save();

    closeModal();

    render();

  };


  document.getElementById(
    "closeReserveBtn"
  ).onclick =
    closeModal;

}


/* =========================
   PAGAMENTOS
========================= */

function openPayments() {

  const m =
    getMonth();


  openModal(

    "Pagamentos",

    `
    <div class="notice">

      <strong>
        Adiantamento
      </strong>

      <br>

      ${money(
        m.salaryReceived *
        state.settings.advancePercent /
        100
      )}

      — dia
      ${state.settings.advanceDay}

      <br><br>

      <strong>
        Pagamento principal
      </strong>

      <br>

      ${money(
        m.salaryReceived *
        (
          1 -
          state.settings.advancePercent /
          100
        )
      )}

      —
      ${escapeHtml(
        state.settings.mainPaymentLabel
      )}

    </div>
    `
  );

}


/* =========================
   BACKUP
========================= */

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


  const a =
    document.createElement(
      "a"
    );


  a.href =
    URL.createObjectURL(
      blob
    );


  a.download =
    `fx-backup-${state.currentMonth}.json`;


  a.click();


  URL.revokeObjectURL(
    a.href
  );

}


/* =========================
   EVENTOS
========================= */

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
  "closeModal"
).onclick =
  closeModal;


document
  .getElementById("modal")
  .addEventListener(
    "click",
    e => {

      if (
        e.target.id === "modal"
      ) {

        closeModal();

      }

    }
  );


/* =========================
   INICIALIZAÇÃO
========================= */

function initFinance() {

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
