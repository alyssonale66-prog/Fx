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
    localStorage.getItem(
      SESSION_KEY
    ) === "true"
  );

}


function login(username, password) {

  const account =
    getAccount();


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
      .getElementById(
        "createUsername"
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        "createPassword"
      )
      .value;


  const confirmation =
    document
      .getElementById(
        "createPasswordConfirm"
      )
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


  if (
    password.length !== 8
  ) {

    showLoginMessage(
      "A senha precisa ter exatamente 8 caracteres."
    );

    return;

  }


  if (
    password !== confirmation
  ) {

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
    .getElementById(
      "appScreen"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "loginScreen"
    )
    .classList.remove(
      "hidden"
    );


  document
    .getElementById(
      "loginUsername"
    )
    .value = "";


  document
    .getElementById(
      "loginPassword"
    )
    .value = "";


  showLoginMessage("");

}


function showLoginMessage(
  message
) {

  document
    .getElementById(
      "loginMessage"
    )
    .textContent =
    message;

}


function showCreateAccount() {

  document
    .getElementById(
      "loginForm"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "createForm"
    )
    .classList.remove(
      "hidden"
    );


  showLoginMessage("");

}


function showLoginForm() {

  document
    .getElementById(
      "createForm"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "loginForm"
    )
    .classList.remove(
      "hidden"
    );


  showLoginMessage("");

}


function showApp() {

  document
    .getElementById(
      "loginScreen"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "appScreen"
    )
    .classList.remove(
      "hidden"
    );


  initFinance();

}



/* =====================================================
   CATEGORIAS
===================================================== */

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

      plannedSalary: 1350,

      advancePercent: 40,

      advanceDay: 20,

      mainPaymentLabel:
        "5º dia útil",

      reserveGoal: 0

    },


    categories:
      defaultCategories,


    months: {},


    reserveBalance: 0,


    currentMonth:
      monthKey(
        new Date()
      )

  };



/* =====================================================
   CARREGAMENTO
===================================================== */

function load() {

  try {

    const data =
      JSON.parse(
        localStorage.getItem(KEY)
      );


    if (!data) {

      return null;

    }


    /*
      MIGRAÇÃO DO SISTEMA ANTIGO

      O sistema anterior criava
      automaticamente R$315 ou
      outros valores.

      Agora a reserva é manual.

      Se encontrarmos _autoReserve,
      significa que aquele valor veio
      do sistema antigo.
    */

    if (data.months) {

      Object.values(
        data.months
      ).forEach(month => {

        if (
          Object.prototype.hasOwnProperty.call(
            month,
            "_autoReserve"
          )
        ) {

          month.reserveContribution = 0;

          delete month._autoReserve;

        }

      });

    }


    /*
      Garante que categorias antigas
      continuem funcionando.
    */

    if (
      !Array.isArray(
        data.categories
      )
    ) {

      data.categories =
        defaultCategories;

    }


    const reserveExists =
      data.categories.some(
        c =>
          c.id === "reserve"
      );


    if (!reserveExists) {

      data.categories.push({
        id: "reserve",
        name: "Reserva",
        icon: "🏦",
        type: "reserve",
        budget: 0
      });

    }


    if (
      typeof data.reserveBalance !==
      "number"
    ) {

      data.reserveBalance = 0;

    }


    return data;

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
        state.settings
          .plannedSalary,

      expenses: [],

      /*
        Reserva agora começa
        SEMPRE em zero.
      */

      reserveContribution: 0,

      reserveWithdrawal: 0

    };


    save();

  }


  return state.months[key];

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


  return Number(
    String(value)
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;

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
      e =>
        e.categoryId === id
    )

    .reduce(
      (
        sum,
        e
      ) =>
        sum +
        Number(
          e.amount
        ),
      0
    );

}


function totalSpent(
  month
) {

  return month.expenses

    .reduce(
      (
        sum,
        e
      ) =>
        sum +
        Number(
          e.amount
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
          month
            .reserveContribution ||
          0
        );


      balance -=
        Number(
          month
            .reserveWithdrawal ||
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

  /*
    Não existe mais cálculo automático.

    O saldo é simplesmente a soma
    dos aportes reais registrados.
  */

  state.reserveBalance =
    getReserveBalance();


  save();

}



/* =====================================================
   DISPONÍVEL
===================================================== */

function available(
  month
) {

  const reserve =
    Number(
      month
        .reserveContribution ||
      0
    );


  return (
    Number(
      month
        .salaryReceived ||
      0
    ) -
    reserve -
    totalSpent(
      month
    )
  );

}



/* =====================================================
   RENDER
===================================================== */

function render() {

  const month =
    getMonth();


  syncReserve();


  /*
    MÊS
  */

  document
    .getElementById(
      "monthTitle"
    )
    .textContent =
    monthLabel(
      state.currentMonth
    );


  /*
    DISPONÍVEL
  */

  document
    .getElementById(
      "availableValue"
    )
    .textContent =
    money(
      Math.max(
        0,
        available(
          month
        )
      )
    );


  /*
    SALÁRIO
  */

  document
    .getElementById(
      "salaryValue"
    )
    .textContent =
    money(
      month.salaryReceived
    );


  /*
    GASTOS
  */

  document
    .getElementById(
      "spentValue"
    )
    .textContent =
    money(
      totalSpent(
        month
      )
    );


  /*
    RESERVA
  */

  document
    .getElementById(
      "reserveValue"
    )
    .textContent =
    money(
      state.reserveBalance
    );


  document
    .getElementById(
      "reserveBig"
    )
    .textContent =
    money(
      state.reserveBalance
    );


  /*
    PAGAMENTOS
  */

  const adv =
    Number(
      month.salaryReceived ||
      0
    ) *
    Number(
      state.settings
        .advancePercent ||
      0
    ) /
    100;


  document
    .getElementById(
      "advanceValue"
    )
    .textContent =
    money(
      adv
    );


  document
    .getElementById(
      "advanceDate"
    )
    .textContent =
    `Dia ${state.settings.advanceDay}`;


  document
    .getElementById(
      "mainPayValue"
    )
    .textContent =
    money(
      Number(
        month.salaryReceived ||
        0
      ) -
      adv
    );


  document
    .getElementById(
      "mainPayDate"
    )
    .textContent =
    state.settings
      .mainPaymentLabel;



  /*
    META
  */

  const goal =
    Number(
      state.settings
        .reserveGoal ||
      0
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



  /*
    CATEGORIAS
  */

  const wrap =
    document.getElementById(
      "categories"
    );


  wrap.innerHTML = "";


  state.categories.forEach(
    category => {

      const c =
        category;


      /*
        RESERVA
      */

      if (
        c.type === "reserve"
      ) {

        const spent =
          Number(
            month
              .reserveContribution ||
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
            ${c.icon}
          </div>

          <div class="cat-main">

            <div class="cat-name">
              ${escapeHtml(
                c.name
              )}
            </div>

            <div class="cat-sub">
              Aporte real deste mês
            </div>

            <div class="progress">

              <div
                style="width:${spent > 0 ? 100 : 0}%"
              ></div>

            </div>

          </div>

          <div class="cat-value">

            <strong>
              ${money(spent)}
            </strong>

            <small>
              aporte
            </small>

          </div>

        `;


        el.addEventListener(
          "click",
          openReserve
        );


        wrap.appendChild(
          el
        );


        return;

      }



      /*
        GASTO NORMAL
      */

      const spent =
        categorySpent(
          c.id,
          month
        );


      const remaining =
        Number(
          c.budget || 0
        ) -
        spent;


      const pct =
        Math.min(
          100,
          Math.max(
            0,
            (
              spent /
              Math.max(
                1,
                Number(
                  c.budget ||
                  0
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
        "category";


      el.innerHTML = `

        <div class="cat-icon">
          ${c.icon}
        </div>

        <div class="cat-main">

          <div class="cat-name">
            ${escapeHtml(
              c.name
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
            ${money(c.budget)}
          </small>

        </div>

      `;


      el.addEventListener(
        "click",
        () =>
          openExpense(
            c.id
          )
      );


      wrap.appendChild(
        el
      );

    }
  );


  renderHistoryPreview();

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



/* =====================================================
   MODAL
===================================================== */

function openModal(
  title,
  html
) {

  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
    title;


  document
    .getElementById(
      "modalBody"
    )
    .innerHTML =
    html;


  document
    .getElementById(
      "modal"
    )
    .classList.remove(
      "hidden"
    );

}


function closeModal() {

  document
    .getElementById(
      "modal"
    )
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
        c =>
          `
          <option
            value="${c.id}"
            ${
              c.id ===
              categoryId
                ? "selected"
                : ""
            }
          >
            ${c.icon}
            ${escapeHtml(
              c.name
            )}
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
    .getElementById(
      "expenseForm"
    )
    .onsubmit =
    e => {

      e.preventDefault();


      const amount =
        parseMoney(
          document
            .getElementById(
              "expenseAmount"
            )
            .value
        );


      if (
        !(amount > 0)
      ) {

        alert(
          "Digite um valor válido."
        );

        return;

      }


      const m =
        getMonth();


      m.expenses.push({

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

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


      <label>
        Tipo
      </label>

      <select
        id="catType"
      >

        <option
          value="expense"
        >
          Gasto
        </option>

        <option
          value="reserve"
        >
          Reserva
        </option>

      </select>


      <button>
        Criar categoria
      </button>

    </form>

    `
  );


  document
    .getElementById(
      "categoryForm"
    )
    .onsubmit =
    e => {

      e.preventDefault();


      const amount =
        parseMoney(
          document
            .getElementById(
              "catBudget"
            )
            .value
        );


      const name =
        document
          .getElementById(
            "catName"
          )
          .value
          .trim();


      if (
        !name ||
        !(amount >= 0)
      ) {

        return;

      }


      /*
        Se criar uma nova categoria
        do tipo reserva, ela também
        será manual.
      */

      state.categories.push({

        id:
          "cat_" +
          Date.now(),

        name,

        icon:
          document
            .getElementById(
              "catIcon"
            )
            .value ||
          "💰",

        budget:
          amount,

        type:
          document
            .getElementById(
              "catType"
            )
            .value

      });


      save();


      closeModal();


      render();

    };

}



/* =====================================================
   RESERVA MANUAL
===================================================== */

function openReserve() {

  const m =
    getMonth();


  const contribution =
    Number(
      m.reserveContribution ||
      0
    );


  const withdrawal =
    Number(
      m.reserveWithdrawal ||
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



    <!-- APORTE -->

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



    <!-- RETIRADA -->

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



  /*
    APORTE
  */

  document
    .getElementById(
      "reserveForm"
    )
    .onsubmit =
    e => {

      e.preventDefault();


      const amount =
        num(
          "reserveAmount"
        );


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
          .getElementById(
            "reserveNote"
          )
          .value
          .trim();


      m.reserveContribution =
        Number(
          m.reserveContribution ||
          0
        ) +
        amount;


      /*
        Guardamos também um
        lançamento individual.

        Isso permite o extrato
        saber exatamente quando
        você guardou dinheiro.
      */

      if (
        !Array.isArray(
          m.reserveTransactions
        )
      ) {

        m.reserveTransactions =
          [];

      }


      m.reserveTransactions.push({

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

        type:
          "in",

        amount,

        date:
          new Date()
            .toISOString()
            .slice(
              0,
              10
            ),

        note

      });


      save();


      closeModal();


      render();

    };



  /*
    RETIRADA
  */

  document
    .getElementById(
      "withdrawForm"
    )
    .onsubmit =
    e => {

      e.preventDefault();


      const amount =
        num(
          "withdrawAmount"
        );


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
          .getElementById(
            "withdrawNote"
          )
          .value
          .trim();


      m.reserveWithdrawal =
        Number(
          m.reserveWithdrawal ||
          0
        ) +
        amount;


      if (
        !Array.isArray(
          m.reserveTransactions
        )
      ) {

        m.reserveTransactions =
          [];

      }


      m.reserveTransactions.push({

        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(
                Date.now()
              ),

        type:
          "out",

        amount,

        date:
          new Date()
            .toISOString()
            .slice(
              0,
              10
            ),

        note

      });


      save();


      closeModal();


      render();

    };



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

function getHistory(
  month
) {

  const items = [];


  /*
    GASTOS
  */

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



  /*
    RESERVA
  */

  if (
    Array.isArray(
      month.reserveTransactions
    )
  ) {

    month
      .reserveTransactions
      .forEach(
        transaction => {

          items.push({

            type:
              transaction.type ===
              "in"
                ? "reserve-in"
                : "reserve-out",

            date:
              transaction.date,

            amount:
              Number(
                transaction.amount
              ),

            name:
              transaction.type ===
              "in"
                ? "Aporte para reserva"
                : "Retirada da reserva",

            icon:
              transaction.type ===
              "in"
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



  /*
    Ordenação:
    mais recente primeiro.
  */

  items.sort(
    (a, b) =>
      new Date(
        b.date
      ) -
      new Date(
        a.date
      )
  );


  return items;

}



/* =====================================================
   DATA FORMATADA
===================================================== */

function formatDate(
  date
) {

  if (!date) {

    return "";

  }


  const parts =
    String(
      date
    ).split("-");


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
    getHistory(
      month
    );


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
      .slice(
        0,
        4
      )
      .map(
        item =>
          historyItemHtml(
            item
          )
      )
      .join("");

}



/* =====================================================
   HTML DO HISTÓRICO
===================================================== */

function historyItemHtml(
  item
) {

  let valueClass =
    "expense";


  let prefix =
    "- ";


  if (
    item.type ===
    "reserve-in"
  ) {

    valueClass =
      "reserve-in";

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

    <div
      class="history-item"
    >

      <div class="history-icon">

        ${item.icon}

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

        ${prefix}
        ${money(
          item.amount
        )}

      </div>

    </div>

  `;

}



/* =====================================================
   ABRIR HISTÓRICO COMPLETO
===================================================== */

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


  const contribution =
    Number(
      month
        .reserveContribution ||
      0
    );


  const withdrawal =
    Number(
      month
        .reserveWithdrawal ||
      0
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
            historyItemHtml(
              item
            )
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
        value="${
          state.settings
            .plannedSalary
        }"
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
          state.settings
            .advancePercent
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
          state.settings
            .advanceDay
        }"
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


      <label>
        Meta da reserva
      </label>

      <input
        id="sGoal"
        inputmode="decimal"
        value="${
          state.settings
            .reserveGoal
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

            <span
              class="theme-dot"
            ></span>

          </span>

        </label>

      </div>


      <button
        class="save-settings-btn"
      >
        Salvar
      </button>

    </form>


    <div
      class="notice"
      style="margin-top:12px"
    >

      Os dados ficam somente
      neste aparelho.

      Use a opção de exportação
      antes de limpar o navegador.

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
    .getElementById(
      "settingsForm"
    )
    .onsubmit =
    e => {

      e.preventDefault();


      state.settings
        .plannedSalary =
        num(
          "sSalary"
        );


      state.settings
        .advancePercent =
        Number(
          document
            .getElementById(
              "sPercent"
            )
            .value
        ) || 0;


      state.settings
        .advanceDay =
        Number(
          document
            .getElementById(
              "sDay"
            )
            .value
        ) || 20;


      state.settings
        .mainPaymentLabel =
        document
          .getElementById(
            "sMain"
          )
          .value ||
        "5º dia útil";


      state.settings
        .reserveGoal =
        num(
          "sGoal"
        );


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
    .getElementById(
      "exportBtn"
    )
    .onclick =
    exportData;



  document
    .getElementById(
      "resetBtn"
    )
    .onclick =
    () => {

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



/* =====================================================
   PAGAMENTOS
===================================================== */

function openPayments() {

  const m =
    getMonth();


  const advance =
    Number(
      m.salaryReceived ||
      0
    ) *
    state.settings
      .advancePercent /
    100;


  const main =
    Number(
      m.salaryReceived ||
      0
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

      ${money(
        advance
      )}

      — dia
      ${state.settings
        .advanceDay}


      <br><br>


      <strong>
        Pagamento principal
      </strong>

      <br>

      ${money(
        main
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



/* =====================================================
   EVENTOS
===================================================== */

document
  .getElementById(
    "loginBtn"
  )
  .onclick =
  () => {

    const username =
      document
        .getElementById(
          "loginUsername"
        )
        .value
        .trim();


    const password =
      document
        .getElementById(
          "loginPassword"
        )
        .value;


    login(
      username,
      password
    );

  };



document
  .getElementById(
    "createBtn"
  )
  .onclick =
  createAccount;



document
  .getElementById(
    "showCreateBtn"
  )
  .onclick =
  showCreateAccount;



document
  .getElementById(
    "backLoginBtn"
  )
  .onclick =
  showLoginForm;



document
  .getElementById(
    "logoutBtn"
  )
  .onclick =
  logout;



/*
  MÊS ANTERIOR
*/

document
  .getElementById(
    "prevMonth"
  )
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



/*
  PRÓXIMO MÊS
*/

document
  .getElementById(
    "nextMonth"
  )
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



/*
  GASTO
*/

document
  .getElementById(
    "addExpenseBtn"
  )
  .onclick =
  () =>
    openExpense();



/*
  CATEGORIA
*/

document
  .getElementById(
    "addCategoryBtn"
  )
  .onclick =
  openCategory;



/*
  CONFIGURAÇÕES
*/

document
  .getElementById(
    "settingsBtn"
  )
  .onclick =
  openSettings;



/*
  PAGAMENTOS
*/

document
  .getElementById(
    "paymentsSettingsBtn"
  )
  .onclick =
  openPayments;



/*
  RESERVA
*/

document
  .getElementById(
    "reserveBtn"
  )
  .onclick =
  openReserve;



/*
  HISTÓRICO
*/

document
  .getElementById(
    "historyBtn"
  )
  .onclick =
  openHistory;


document
  .getElementById(
    "historyBtn2"
  )
  .onclick =
  openHistory;



/*
  FECHAR MODAL
*/

document
  .getElementById(
    "closeModal"
  )
  .onclick =
  closeModal;



/*
  CLICAR FORA DO MODAL
*/

document
  .getElementById(
    "modal"
  )
  .addEventListener(
    "click",
    e => {

      if (
        e.target.id ===
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



/*
  SE JÁ ESTÁ LOGADO,
  MOSTRA O APP.

  CASO CONTRÁRIO,
  MOSTRA LOGIN.
*/

if (
  isLogged()
) {

  showApp();

} else {

  document
    .getElementById(
      "loginScreen"
    )
    .classList
    .remove(
      "hidden"
    );


  document
    .getElementById(
      "appScreen"
    )
    .classList
    .add(
      "hidden"
    );

}
