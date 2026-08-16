const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";


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

  return (
    localStorage.getItem(SESSION_KEY) === "true"
  );

}


function login(username, password) {

  const account = getAccount();

  if (!account) {

    showLoginMessage(
      "Nenhuma conta criada ainda."
    );

    return;

  }

  if (
    username !== account.username ||
    password !== account.password
  ) {

    showLoginMessage(
      "Usuário ou senha incorretos."
    );

    return;

  }

  localStorage.setItem(
    SESSION_KEY,
    "true"
  );

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

  if (
    username.length < 2 ||
    username.length > 6
  ) {

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



/* =====================================================
   CATEGORIAS PADRÃO
===================================================== */

const defaultCategories = [

  {
    id: "fixed",
    name: "Gasto fixo",
    icon: "🏠",
    type: "expense",
    budget: 600
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



/* =====================================================
   ESTADO
===================================================== */

const state =
  load() || {

    settings: {

      plannedSalary: 0,

      advancePercent: 40,

      advanceDay: 20,

      mainPaymentLabel:
        "5º dia útil",

      reserveGoal: 0

    },

    categories:
      defaultCategories.map(
        category => ({
          ...category
        })
      ),

    months: {},

    reserveBalance: 0,

    currentMonth:
      monthKey(
        new Date()
      )

  };



/* =====================================================
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {

  if (!data || typeof data !== "object") {

    return null;

  }


  /* =====================================================
     CONFIGURAÇÕES
  ===================================================== */

  if (
    !data.settings ||
    typeof data.settings !== "object"
  ) {

    data.settings = {};

  }


  if (
    typeof data.settings.plannedSalary !== "number"
  ) {

    data.settings.plannedSalary = 0;

  }


  if (
    typeof data.settings.advancePercent !== "number"
  ) {

    data.settings.advancePercent = 40;

  }


  if (
    typeof data.settings.advanceDay !== "number"
  ) {

    data.settings.advanceDay = 20;

  }


  if (
    typeof data.settings.mainPaymentLabel !== "string"
  ) {

    data.settings.mainPaymentLabel =
      "5º dia útil";

  }


  if (
    typeof data.settings.reserveGoal !== "number"
  ) {

    data.settings.reserveGoal = 0;

  }


  /* =====================================================
     CATEGORIAS
     
     NÃO APAGA CATEGORIAS EXISTENTES.
     APENAS RECUPERA AS PADRÃO QUE ESTIVEREM FALTANDO.
  ===================================================== */

  if (!Array.isArray(data.categories)) {

    data.categories = [];

  }


  data.categories =
    data.categories
      .filter(
        category =>
          category &&
          typeof category === "object"
      )
      .map(
        category => ({

          id:
            category.id ||
            "cat_" + createId(),

          name:
            String(
              category.name ||
              "Categoria"
            ),

          icon:
            String(
              category.icon ||
              "💰"
            ),

          type:
            category.type === "reserve"
              ? "reserve"
              : "expense",

          budget:
            Number(
              category.budget
            ) || 0

        })
      );


  /* =====================================================
     RECUPERA AS 5 CATEGORIAS PADRÃO
  ===================================================== */

  defaultCategories.forEach(
    defaultCategory => {

      const exists =
        data.categories.some(
          category =>
            category.id ===
            defaultCategory.id
        );

      if (!exists) {

        data.categories.push({
          ...defaultCategory
        });

      }

    }
  );


  /* =====================================================
     GARANTE RESERVA
  ===================================================== */

  if (
    !data.categories.some(
      category =>
        category.id === "reserve"
    )
  ) {

    data.categories.push({

      id: "reserve",

      name: "Reserva",

      icon: "🏦",

      type: "reserve",

      budget: 0

    });

  }


  /* =====================================================
     MESES
  ===================================================== */

  if (
    !data.months ||
    typeof data.months !== "object"
  ) {

    data.months = {};

  }


  Object.values(
    data.months
  ).forEach(
    month => {

      if (
        !month ||
        typeof month !== "object"
      ) {

        return;

      }


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
        Number(
          month.salaryReceived
        ) || 0;


      month.reserveContribution =
        Number(
          month.reserveContribution
        ) || 0;


      month.reserveWithdrawal =
        Number(
          month.reserveWithdrawal
        ) || 0;


      /* Compatibilidade com versões antigas */

      if (
        Object.prototype.hasOwnProperty.call(
          month,
          "_autoReserve"
        )
      ) {

        month.reserveContribution = 0;

        delete month._autoReserve;

      }

    }
  );


  /* =====================================================
     RESERVA
  ===================================================== */

  if (
    typeof data.reserveBalance !== "number"
  ) {

    data.reserveBalance = 0;

  }


  /* =====================================================
     MÊS ATUAL
  ===================================================== */

  if (
    typeof data.currentMonth !== "string"
  ) {

    data.currentMonth =
      monthKey(
        new Date()
      );

  }


  return data;

}



/* =====================================================
   CARREGAMENTO
===================================================== */

function load() {

  try {

    const raw =
      localStorage.getItem(KEY);

    if (!raw) {

      return null;

    }

    const data =
      JSON.parse(raw);

    return normalizeState(data);

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

function monthKey(d) {

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;

}


function getMonth(
  key = state.currentMonth
) {

  if (
    !state.months[key]
  ) {

    state.months[key] = {

      salaryReceived:
        Number(
          state.settings.plannedSalary
        ) || 0,

      expenses: [],

      extras: [],

      reserveContribution: 0,

      reserveWithdrawal: 0,

      reserveTransactions: []

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


  return month;

}


function monthLabel(key) {

  const [
    y,
    m
  ] =
    key
      .split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  ).format(
    new Date(
      y,
      m - 1,
      1
    )
  );

}


function monthShift(
  key,
  delta
) {

  const [
    y,
    m
  ] =
    key
      .split("-")
      .map(Number);

  return monthKey(
    new Date(
      y,
      m - 1 + delta,
      1
    )
  );

}



/* =====================================================
   DINHEIRO
===================================================== */

function money(v) {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(
    Number(v) || 0
  );

}


function parseMoney(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return 0;

  }


  let text =
    String(value)
      .trim();


  if (!text) {

    return 0;

  }


  text =
    text
      .replace(/R\$/gi, "")
      .replace(/\s/g, "");


  if (
    text.includes(",")
  ) {

    text =
      text
        .replace(/\./g, "")
        .replace(",", ".");

  } else {

    text =
      text.replace(
        /[^0-9.-]/g,
        ""
      );

  }


  return Number(text) || 0;

}


function num(id) {

  const element =
    document.getElementById(id);

  if (!element) {

    return 0;

  }

  return parseMoney(
    element.value
  );

}



/* =====================================================
   GASTOS
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
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount
        ),
      0
    );

}


function totalSpent(month) {

  return month.expenses
    .reduce(
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount
        ),
      0
    );

}



/* =====================================================
   EXTRAS
===================================================== */

function totalExtras(month) {

  return month.extras
    .reduce(
      (
        sum,
        extra
      ) =>
        sum +
        Number(
          extra.amount
        ),
      0
    );

}



/* =====================================================
   RESERVA
===================================================== */

function getReserveBalance() {

  let balance = 0;

  Object.values(
    state.months
  ).forEach(
    month => {

      balance +=
        Number(
          month.reserveContribution ||
          0
        );

      balance -=
        Number(
          month.reserveWithdrawal ||
          0
        );

    }
  );

  return Math.max(
    0,
    balance
  );

}


function syncReserve() {

  state.reserveBalance =
    getReserveBalance();

  save();

}



/* =====================================================
   DISPONÍVEL
===================================================== */

function available(month) {

  const salary =
    Number(
      month.salaryReceived
    ) || 0;

  const extras =
    totalExtras(month);

  const reserveIn =
    Number(
      month.reserveContribution
    ) || 0;

  const reserveOut =
    Number(
      month.reserveWithdrawal
    ) || 0;

  const expenses =
    totalSpent(month);


  return (
    salary +
    extras +
    reserveOut -
    reserveIn -
    expenses
  );

}



/* =====================================================
   RENDER
===================================================== */

function render() {

  const month =
    getMonth();


  syncReserve();


  document
    .getElementById("monthTitle")
    .textContent =
    monthLabel(
      state.currentMonth
    );


  document
    .getElementById("availableValue")
    .textContent =
    money(
      Math.max(
        0,
        available(month)
      )
    );


  document
    .getElementById("salaryValue")
    .textContent =
    money(
      month.salaryReceived
    );


  document
    .getElementById("extraValue")
    .textContent =
    money(
      totalExtras(month)
    );


  document
    .getElementById("spentValue")
    .textContent =
    money(
      totalSpent(month)
    );


  document
    .getElementById("reserveValue")
    .textContent =
    money(
      state.reserveBalance
    );


  document
    .getElementById("reserveBig")
    .textContent =
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


  document
    .getElementById("advanceValue")
    .textContent =
    money(adv);


  document
    .getElementById("advanceDate")
    .textContent =
    `Dia ${state.settings.advanceDay}`;


  document
    .getElementById("mainPayValue")
    .textContent =
    money(
      Number(
        month.salaryReceived || 0
      ) -
      adv
    );


  document
    .getElementById("mainPayDate")
    .textContent =
    state.settings.mainPaymentLabel;


  const goal =
    Number(
      state.settings.reserveGoal || 0
    );


  const goalBox =
    document.getElementById(
      "goalBox"
    );


  if (goal > 0) {

    const percent =
      Math.min(
        100,
        (
          state.reserveBalance /
          goal
        ) *
        100
      );


    goalBox.innerHTML = `

      Meta
      ${money(goal)}

      <div class="progress">

        <div
          style="width:${percent}%"
        ></div>

      </div>

    `;

  } else {

    goalBox.innerHTML =
      "Defina uma meta em ⚙️";

  }


  renderCategories();

  renderExtras();

  renderHistoryPreview();

}



/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {

  const month =
    getMonth();

  const wrap =
    document.getElementById(
      "categories"
    );

  if (!wrap) {

    return;

  }

  wrap.innerHTML = "";


  state.categories.forEach(
    category => {

      const c =
        category;


      if (
        c.type === "reserve"
      ) {

        const contribution =
          Number(
            month.reserveContribution ||
            0
          );


        const el =
          document.createElement(
            "div"
          );


        el.className =
          "category reserve-cat";


        el.innerHTML = `

          <div class="cat-icon">
            ${escapeHtml(c.icon)}
          </div>

          <div class="cat-main">

            <div class="cat-name">
              ${escapeHtml(c.name)}
            </div>

            <div class="cat-sub">
              Aporte real deste mês
            </div>

            <div class="progress">

              <div
                style="width:${contribution > 0 ? 100 : 0}%"
              ></div>

            </div>

          </div>

          <div class="cat-value">

            <strong>
              ${money(contribution)}
            </strong>

            <small>
              aporte
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

            openReserve();

          }
        );


        el
          .querySelector(".cat-edit")
          .addEventListener(
            "click",
            event => {

              event.stopPropagation();

              openEditCategory(c.id);

            }
          );


        wrap.appendChild(el);

        return;

      }


      const spent =
        categorySpent(
          c.id,
          month
        );


      const budget =
        Number(c.budget) || 0;


      const remaining =
        budget -
        spent;


      const pct =
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


      const el =
        document.createElement(
          "div"
        );


      el.className =
        "category";


      el.innerHTML = `

        <div class="cat-icon">
          ${escapeHtml(c.icon)}
        </div>

        <div class="cat-main">

          <div class="cat-name">
            ${escapeHtml(c.name)}
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
            de
            ${money(budget)}
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

          openExpense(c.id);

        }
      );


      el
        .querySelector(".cat-edit")
        .addEventListener(
          "click",
          event => {

            event.stopPropagation();

            openEditCategory(c.id);

          }
        );


      wrap.appendChild(el);

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

  if (!container) {

    return;

  }


  if (
    month.extras.length === 0
  ) {

    container.innerHTML = `

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
              data-id="${extra.id}"
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
          () => {

            deleteExtra(
              button.dataset.id
            );

          }
        );

      }
    );

}


function openExtra() {

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);


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


        <button>
          Salvar entrada
        </button>

      </form>

    `
  );


  document
    .getElementById("extraForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const name =
        document
          .getElementById("extraName")
          .value
          .trim();


      const amount =
        num("extraAmount");


      const date =
        document
          .getElementById("extraDate")
          .value;


      if (
        !name ||
        !(amount > 0)
      ) {

        alert(
          "Informe uma descrição e um valor válido."
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
          date ||
          today

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
      `Excluir a entrada "${extra.name}" de ${money(extra.amount)}?`
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
   SEGURANÇA HTML
===================================================== */

function escapeHtml(s) {

  return String(s)
    .replace(
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


function createId() {

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {

    return crypto.randomUUID();

  }

  return String(
    Date.now() +
    Math.random()
  );

}



/* =====================================================
   MODAL
===================================================== */

function openModal(
  title,
  html
) {

  document
    .getElementById("modalTitle")
    .textContent =
    title;


  document
    .getElementById("modalBody")
    .innerHTML =
    html;


  document
    .getElementById("modal")
    .classList.remove(
      "hidden"
    );

}


function closeModal() {

  document
    .getElementById("modal")
    .classList.add(
      "hidden"
    );

}



/* =====================================================
   ADICIONAR GASTO
===================================================== */

function openExpense(
  categoryId =
    state.categories.find(
      c =>
        c.type === "expense"
    )?.id
) {

  const options =
    state.categories

      .filter(
        c =>
          c.type === "expense"
      )

      .map(
        c =>
          `
          <option
            value="${escapeHtml(c.id)}"
            ${
              c.id === categoryId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(c.icon)}
            ${escapeHtml(c.name)}
          </option>
          `
      )

      .join("");


  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
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
        Data
      </label>

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


      <button>
        Salvar gasto
      </button>

    </form>

    `
  );


  document
    .getElementById("expenseForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const amount =
        num("expenseAmount");


      if (
        !(amount > 0)
      ) {

        alert(
          "Digite um valor válido."
        );

        return;

      }


      const month =
        getMonth();


      month.expenses.push({

        id:
          createId(),

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
            .value,

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

    };

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


      <button>
        Criar categoria
      </button>

    </form>

    `
  );


  document
    .getElementById("categoryForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const amount =
        num("catBudget");


      const name =
        document
          .getElementById("catName")
          .value
          .trim();


      if (
        !name ||
        !(amount >= 0)
      ) {

        alert(
          "Digite um nome e um valor válido."
        );

        return;

      }


      /* =================================================
         CRIA A NOVA CATEGORIA
      ================================================= */

      const newCategory = {

        id:
          "cat_" +
          createId(),

        name,

        icon:
          document
            .getElementById("catIcon")
            .value
            .trim() ||
          "💰",

        budget:
          amount,

        type:
          "expense"

      };


      state.categories.push(
        newCategory
      );


      save();

      closeModal();

      render();

    };

}



/* =====================================================
   EDITAR CATEGORIA
===================================================== */

function openEditCategory(id) {

  const category =
    state.categories.find(
      c =>
        c.id === id
    );


  if (!category) {

    return;

  }


  const isReserve =
    category.type === "reserve";


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
        value="${escapeHtml(category.name)}"
        required
      >


      <label>
        Ícone
      </label>

      <input
        id="editCatIcon"
        value="${escapeHtml(category.icon)}"
        maxlength="2"
      >


      ${
        isReserve
          ? ""
          : `

            <label>
              Valor mensal
            </label>

            <input
              id="editCatBudget"
              inputmode="decimal"
              value="${category.budget}"
              required
            >

          `
      }


      <button>
        Salvar alterações
      </button>

    </form>


    ${
      isReserve
        ? ""
        : `

          <button
            class="danger"
            id="deleteCategoryBtn"
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
    }

    `
  );


  document
    .getElementById("editCategoryForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const newName =
        document
          .getElementById(
            "editCatName"
          )
          .value
          .trim();


      if (!newName) {

        alert(
          "Digite um nome."
        );

        return;

      }


      category.name =
        newName;


      category.icon =
        document
          .getElementById(
            "editCatIcon"
          )
          .value
          .trim() ||
        "💰";


      if (!isReserve) {

        category.budget =
          num(
            "editCatBudget"
          );

      }


      save();

      closeModal();

      render();

    };


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
   RESERVA
===================================================== */

function openReserve() {

  const month =
    getMonth();


  const contribution =
    Number(
      month.reserveContribution ||
      0
    );


  const withdrawal =
    Number(
      month.reserveWithdrawal ||
      0
    );


  openModal(

    "Reserva",

    `

    <div class="notice">

      <strong>
        Reserva acumulada
      </strong>

      <br>

      ${money(
        state.reserveBalance
      )}

      <br><br>

      <strong>
        Aporte deste mês
      </strong>

      <br>

      ${money(
        contribution
      )}

      <br><br>

      <strong>
        Retirado neste mês
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
        Quanto você realmente guardou?
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
        placeholder="Ex.: consegui guardar este mês"
      >

      <button>
        Registrar aporte
      </button>

    </form>


    <form
      class="form"
      id="withdrawForm"
      style="margin-top:16px"
    >

      <label>
        Retirar da reserva
      </label>

      <input
        id="withdrawAmount"
        inputmode="decimal"
        placeholder="R$ 0,00"
      >

      <label>
        Motivo da retirada
      </label>

      <input
        id="withdrawNote"
        placeholder="Ex.: emergência"
      >

      <button class="danger">
        Registrar retirada
      </button>

    </form>


    <button
      class="secondary"
      id="closeReserveBtn"
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
    .getElementById("reserveForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const amount =
        num("reserveAmount");


      if (
        !(amount > 0)
      ) {

        alert(
          "Digite um valor válido."
        );

        return;

      }


      const note =
        document
          .getElementById("reserveNote")
          .value
          .trim();


      month.reserveContribution =
        Number(
          month.reserveContribution || 0
        ) +
        amount;


      month.reserveTransactions.push({

        id:
          createId(),

        type:
          "in",

        amount,

        date:
          todayKey(),

        note

      });


      save();

      closeModal();

      render();

    };


  document
    .getElementById("withdrawForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const amount =
        num("withdrawAmount");


      if (
        !(amount > 0) ||
        amount >
          state.reserveBalance
      ) {

        alert(
          "Valor inválido ou maior que a reserva."
        );

        return;

      }


      const note =
        document
          .getElementById("withdrawNote")
          .value
          .trim();


      month.reserveWithdrawal =
        Number(
          month.reserveWithdrawal || 0
        ) +
        amount;


      month.reserveTransactions.push({

        id:
          createId(),

        type:
          "out",

        amount,

        date:
          todayKey(),

        note

      });


      save();

      closeModal();

      render();

    };


  document
    .getElementById("closeReserveBtn")
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

        type:
          "expense",

        date:
          expense.date,

        amount:
          Number(
            expense.amount
          ),

        name:
          category
            ? category.name
            : "Categoria removida",

        icon:
          category
            ? category.icon
            : "💰",

        note:
          expense.note ||
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
          Number(
            extra.amount
          ),

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

    month.reserveTransactions
      .forEach(
        transaction => {

          items.push({

            type:
              transaction.type === "in"
                ? "reserve-in"
                : "reserve-out",

            date:
              transaction.date,

            amount:
              Number(
                transaction.amount
              ),

            name:
              transaction.type === "in"
                ? "Aporte para reserva"
                : "Retirada da reserva",

            icon:
              transaction.type === "in"
                ? "🏦"
                : "💸",

            note:
              transaction.note ||
              "",

            id:
              transaction.id

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



/* =====================================================
   DATA
===================================================== */

function todayKey() {

  const now =
    new Date();

  return monthDateKey(
    now
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

  if (!date) {

    return "";

  }


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
   HISTÓRICO RESUMIDO
===================================================== */

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
    getHistory(month);


  if (
    items.length === 0
  ) {

    container.innerHTML = `

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
          historyItemHtml(item)
      )
      .join("");

}



/* =====================================================
   HTML HISTÓRICO
===================================================== */

function historyItemHtml(item) {

  let valueClass =
    "expense";

  let prefix =
    "- ";


  if (
    item.type === "extra-in" ||
    item.type === "reserve-in"
  ) {

    valueClass =
      item.type === "extra-in"
        ? "extra-in"
        : "reserve-in";

    prefix =
      "+ ";

  }


  if (
    item.type === "reserve-out"
  ) {

    valueClass =
      "reserve-out";

    prefix =
      "- ";

  }


  return `

    <div class="history-item">

      <div class="history-icon">
        ${escapeHtml(item.icon)}
      </div>


      <div class="history-main">

        <div class="history-name">
          ${escapeHtml(item.name)}
        </div>


        ${
          item.note
            ? `
              <div class="history-note">
                ${escapeHtml(item.note)}
              </div>
            `
            : ""
        }


        <div class="history-date">
          ${formatDate(item.date)}
        </div>

      </div>


      <div
        class="history-value ${valueClass}"
      >

        ${prefix}
        ${money(item.amount)}

      </div>

    </div>

  `;

}



/* =====================================================
   HISTÓRICO COMPLETO
===================================================== */

function openHistory() {

  const month =
    getMonth();


  const items =
    getHistory(month);


  const expensesTotal =
    totalSpent(month);


  const extrasTotal =
    totalExtras(month);


  const contribution =
    Number(
      month.reserveContribution || 0
    );


  const withdrawal =
    Number(
      month.reserveWithdrawal || 0
    );


  let content =
    "";


  if (
    items.length === 0
  ) {

    content = `

      <div class="empty-history">
        Nenhum lançamento neste mês.
      </div>

    `;

  } else {

    content =
      items
        .map(
          item =>
            historyItemHtml(item)
        )
        .join("");

  }


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
        Aporte na reserva
      </span>

      <strong>
        ${money(
          contribution
        )}
      </strong>

    </div>


    <div class="history-total">

      <span>
        Retirado da reserva
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
        value="${month.salaryReceived}"
      >


      <label>
        Percentual do adiantamento
      </label>

      <input
        id="sPercent"
        type="number"
        min="0"
        max="100"
        value="${
          state.settings.advancePercent
        }"
      >


      <label>
        Dia do adiantamento
      </label>

      <input
        id="sDay"
        type="number"
        min="1"
        max="31"
        value="${
          state.settings.advanceDay
        }"
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
        value="${
          state.settings.reserveGoal
        }"
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


      <button>
        Salvar
      </button>

    </form>


    <div
      class="notice"
      style="margin-top:12px"
    >

      Os dados ficam somente neste aparelho.

      Use a opção de exportação antes de
      limpar os dados do navegador.

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


  document
    .getElementById("settingsForm")
    .onsubmit =
    event => {

      event.preventDefault();


      const newSalary =
        num("sSalary");


      month.salaryReceived =
        newSalary;


      state.settings.plannedSalary =
        newSalary;


      state.settings.advancePercent =
        Math.min(
          100,
          Math.max(
            0,
            Number(
              document
                .getElementById("sPercent")
                .value
            ) || 0
          )
        );


      state.settings.advanceDay =
        Math.min(
          31,
          Math.max(
            1,
            Number(
              document
                .getElementById("sDay")
                .value
            ) || 20
          )
        );


      state.settings.mainPaymentLabel =
        document
          .getElementById("sMain")
          .value
          .trim() ||
        "5º dia útil";


      state.settings.reserveGoal =
        num("sGoal");


      const dark =
        darkToggle.checked;


      document.body
        .classList
        .toggle(
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


  document
    .getElementById("exportBtn")
    .onclick =
    exportData;


  document
    .getElementById("resetBtn")
    .onclick =
    () => {

      if (
        confirm(
          "Apagar todos os dados do FX?"
        )
      ) {

        localStorage.removeItem(KEY);

        localStorage.removeItem(
          ACCOUNT_KEY
        );

        localStorage.removeItem(
          SESSION_KEY
        );

        location.reload();

      }

    };

}



/* =====================================================
   PAGAMENTOS
===================================================== */

function openPayments() {

  const month =
    getMonth();


  const advance =
    Number(
      month.salaryReceived || 0
    ) *
    Number(
      state.settings.advancePercent || 0
    ) /
    100;


  const main =
    Number(
      month.salaryReceived || 0
    ) -
    advance;


  openModal(

    "Pagamentos",

    `

    <div class="notice">

      <strong>
        Adiantamento
      </strong>

      <br>

      ${money(advance)}

      — dia
      ${state.settings.advanceDay}

      <br><br>

      <strong>
        Pagamento principal
      </strong>

      <br>

      ${money(main)}

      —
      ${escapeHtml(
        state.settings.mainPaymentLabel
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
    URL.createObjectURL(blob);


  const a =
    document.createElement("a");


  a.href = url;

  a.download =
    `fx-backup-${state.currentMonth}.json`;


  document.body.appendChild(a);

  a.click();

  a.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );

}



/* =====================================================
   EVENTOS
===================================================== */

document
  .getElementById("loginBtn")
  .onclick =
  () => {

    const username =
      document
        .getElementById("loginUsername")
        .value
        .trim();


    const password =
      document
        .getElementById("loginPassword")
        .value;


    login(
      username,
      password
    );

  };


document
  .getElementById("createBtn")
  .onclick =
  createAccount;


document
  .getElementById("showCreateBtn")
  .onclick =
  showCreateAccount;


document
  .getElementById("backLoginBtn")
  .onclick =
  showLoginForm;


document
  .getElementById("logoutBtn")
  .onclick =
  logout;


document
  .getElementById("prevMonth")
  .onclick =
  () => {

    state.currentMonth =
      monthShift(
        state.currentMonth,
        -1
      );

    save();

    render();

  };


document
  .getElementById("nextMonth")
  .onclick =
  () => {

    state.currentMonth =
      monthShift(
        state.currentMonth,
        1
      );

    save();

    render();

  };


document
  .getElementById("addExpenseBtn")
  .onclick =
  () =>
    openExpense();


document
  .getElementById("addCategoryBtn")
  .onclick =
  openCategory;


document
  .getElementById("addExtraBtn")
  .onclick =
  openExtra;


document
  .getElementById("settingsBtn")
  .onclick =
  openSettings;


document
  .getElementById("paymentsSettingsBtn")
  .onclick =
  openPayments;


document
  .getElementById("reserveBtn")
  .onclick =
  openReserve;


document
  .getElementById("historyBtn")
  .onclick =
  openHistory;


document
  .getElementById("historyBtn2")
  .onclick =
  openHistory;


document
  .getElementById("closeModal")
  .onclick =
  closeModal;


document
  .getElementById("modal")
  .addEventListener(
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

  document.body
    .classList
    .toggle(
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
    .getElementById("loginScreen")
    .classList
    .remove("hidden");

  document
    .getElementById("appScreen")
    .classList
    .add("hidden");

     }
