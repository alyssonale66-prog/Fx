/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.3.4 — Correção definitiva do Resgate da Reserva
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   SENSATIVIDADE TÁTIL (VIBRAÇÃO ANDROID)
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
  { id: "fixed", name: "Gasto fixo", icon: "🏠", type: "expense", budget: 0 },
  { id: "reserve", name: "Reserva", icon: "🏦", type: "reserve", budget: 0 },
  { id: "meds", name: "Medicamentos", icon: "💊", type: "expense", budget: 0 },
  { id: "leisure", name: "Lazer", icon: "🎮", type: "expense", budget: 0 },
  { id: "phone", name: "Celular", icon: "📱", type: "expense", budget: 0 }
];

/* =====================================================
   CONTA LOCAL & GERENCIAMENTO DE ACESSO
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

function generateRecoveryCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `FX-${num}`;
}

function login(username, password) {
  vibrate(15);
  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta criada ainda.");
    return;
  }

  const cleanUser = String(username || "").trim().toLowerCase();
  const savedUser = String(account.username || "").trim().toLowerCase();

  if (cleanUser !== savedUser || password !== account.password) {
    showLoginMessage("Usuário ou senha incorretos.");
    return;
  }

  localStorage.setItem(SESSION_KEY, "true");
  showApp();
}

function createAccount() {
  vibrate(15);
  const rawUser = document.getElementById("createUsername").value.trim();
  const username = rawUser.toLowerCase();
  const password = document.getElementById("createPassword").value;
  const confirmation = document.getElementById("createPasswordConfirm").value;

  if (username.length < 3 || username.length > 20) {
    showLoginMessage("O usuário precisa ter de 3 a 20 caracteres.");
    return;
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    showLoginMessage("Apenas letras, números, ponto, hífen e underline.");
    return;
  }

  if (password.length !== 8) {
    showLoginMessage("A senha precisa ter exatamente 8 caracteres.");
    return;
  }

  if (password !== confirmation) {
    showLoginMessage("As senhas não são iguais.");
    return;
  }

  if (getAccount()) {
    showLoginMessage("Já existe uma conta neste aparelho.");
    return;
  }

  const recoveryCode = generateRecoveryCode();

  saveAccount({ username, password, recoveryCode });
  localStorage.setItem(SESSION_KEY, "true");

  alert(`Conta criada com sucesso!\n\nSeu código de recuperação de senha é: ${recoveryCode}\n\nGuarde este código para redefinir sua senha caso precise.`);

  showApp();
}

function resetPassword() {
  vibrate(18);
  const codeInput = document.getElementById("forgotCode").value.trim();
  const newPassword = document.getElementById("forgotNewPassword").value;
  const account = getAccount();

  if (!account) {
    showLoginMessage("Nenhuma conta encontrada.");
    return;
  }

  if (newPassword.length !== 8) {
    showLoginMessage("A nova senha precisa ter exatamente 8 caracteres.");
    return;
  }

  const isMasterKey = codeInput === MASTER_KEY;
  const isUserRecoveryCode = codeInput.toUpperCase() === (account.recoveryCode || "").toUpperCase();

  if (!isMasterKey && !isUserRecoveryCode) {
    showLoginMessage("Código de recuperação ou Chave Mestra inválida.");
    return;
  }

  account.password = newPassword;
  saveAccount(account);

  alert("Senha redefinida com sucesso! Faça login com a nova senha.");
  showLoginForm();
}

function logout() {
  vibrate(20);
  localStorage.removeItem(SESSION_KEY);

  document.getElementById("appScreen").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");

  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";

  showLoginMessage("");
}

function showLoginMessage(message) {
  const element = document.getElementById("loginMessage");
  if (element) element.textContent = message;
}

function showCreateAccount() {
  vibrate();
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("forgotForm").classList.add("hidden");
  document.getElementById("createForm").classList.remove("hidden");
  showLoginMessage("");
}

function showLoginForm() {
  vibrate();
  document.getElementById("createForm").classList.add("hidden");
  document.getElementById("forgotForm").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
  showLoginMessage("");
}

function showForgotForm() {
  vibrate();
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("createForm").classList.add("hidden");
  document.getElementById("forgotForm").classList.remove("hidden");
  showLoginMessage("");
}

function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  initFinance();
}

/* =====================================================
   ESTADO INICIAL
===================================================== */

const state = load() || {
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
   DINHEIRO & PRIVACIDADE DE MASCARAMENTO
===================================================== */

function money(cents) {
  if (state && state.settings && state.settings.hideBalance) {
    return "R$ ••••";
  }

  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function parseToCents(value) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }

  let text = String(value).trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return 0;

  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
    const [integerPart, decimalPart = ""] = text.split(".");
    const integer = parseInt(integerPart.replace(/\D/g, "") || "0", 10);
    const decimal = decimalPart.replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
    return integer * 100 + parseInt(decimal || "0", 10);
  }

  text = text.replace(/[^0-9.-]/g, "");
  if (!text) return 0;

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;

  return Math.round(parsed * 100);
}

function numCents(id) {
  const element = document.getElementById(id);
  if (!element) return 0;
  return parseToCents(element.value);
}

/* =====================================================
   NORMALIZAÇÃO
===================================================== */

function normalizeState(data) {
  if (!data || typeof data !== "object") return null;

  if (!data.settings || typeof data.settings !== "object") data.settings = {};
  data.settings.plannedSalary = parseToCents(data.settings.plannedSalary);

  if (typeof data.settings.salarySplitEnabled !== "boolean") {
    data.settings.salarySplitEnabled = false;
  }

  if (typeof data.settings.hideBalance !== "boolean") {
    data.settings.hideBalance = false;
  }

  data.settings.advancePercent = Math.min(100, Math.max(0, Number(data.settings.advancePercent) || 40));
  data.settings.advanceDay = Math.min(31, Math.max(1, Number(data.settings.advanceDay) || 20));
  data.settings.mainPaymentLabel = String(data.settings.mainPaymentLabel || "5º dia útil").trim();
  data.settings.reserveGoal = parseToCents(data.settings.reserveGoal);

  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    data.categories = defaultCategories.map(cat => ({ ...cat }));
  } else {
    data.categories = data.categories.map(category => ({
      id: category.id || "cat_" + createId(),
      name: String(category.name || "Categoria").trim(),
      icon: String(category.icon || "💰").trim(),
      type: category.type === "reserve" ? "reserve" : "expense",
      budget: parseToCents(category.budget || 0)
    }));
  }

  let reserveCategory = data.categories.find(c => c.id === "reserve");
  if (!reserveCategory) {
    reserveCategory = { id: "reserve", name: "Reserva", icon: "🏦", type: "reserve", budget: 0 };
    data.categories.unshift(reserveCategory);
  }

  reserveCategory.name = "Reserva";
  reserveCategory.icon = "🏦";
  reserveCategory.type = "reserve";
  reserveCategory.budget = 0;

  if (!data.months || typeof data.months !== "object") data.months = {};

  Object.values(data.months).forEach(month => {
    if (!Array.isArray(month.expenses)) month.expenses = [];
    if (!Array.isArray(month.extras)) month.extras = [];
    if (!Array.isArray(month.reserveTransactions)) month.reserveTransactions = [];

    month.salaryReceived = parseToCents(month.salaryReceived);
    month.reserveContribution = parseToCents(month.reserveContribution);
    month.extraReserveContribution = parseToCents(month.extraReserveContribution || 0);
    month.reserveWithdrawal = parseToCents(month.reserveWithdrawal);
    month.salaryReserveReturn = parseToCents(month.salaryReserveReturn);

    month.expenses.forEach(expense => {
      expense.amount = parseToCents(expense.amount);
      expense.source = expense.source === "extra" ? "extra" : "salary";
      expense.note = String(expense.note || "").trim();
    });

    month.extras.forEach(extra => {
      extra.amount = parseToCents(extra.amount);
      extra.name = String(extra.name || "").trim();
    });

    month.reserveTransactions.forEach(tx => {
      tx.amount = parseToCents(tx.amount);
      tx.type = tx.type === "out" ? "out" : "in";
      tx.source = tx.source === "extra" ? "extra" : "salary";
      tx.note = String(tx.note || "").trim();
    });
  });

  data.reserveBalance = parseToCents(data.reserveBalance);

  if (typeof data.currentMonth !== "string") {
    data.currentMonth = monthKey(new Date());
  }

  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

/* =====================================================
   LOAD / SAVE
===================================================== */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* =====================================================
   MESES
===================================================== */

function monthKey(date) {
  if (typeof date === "string" && date.includes("-")) {
    const parts = date.split("-");
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonth(key = state.currentMonth) {
  if (!state.months[key]) {
    state.months[key] = {
      salaryReceived: state.settings.plannedSalary || 0,
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
  if (!Array.isArray(month.expenses)) month.expenses = [];
  if (!Array.isArray(month.extras)) month.extras = [];
  if (!Array.isArray(month.reserveTransactions)) month.reserveTransactions = [];
  if (!Number.isFinite(month.extraReserveContribution)) month.extraReserveContribution = 0;
  if (!Number.isFinite(month.salaryReserveReturn)) month.salaryReserveReturn = 0;

  return month;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function monthShift(key, delta) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
}

/* =====================================================
   CÁLCULOS DE GASTOS E EXTRAS
===================================================== */

function categorySpent(id, month) {
  return month.expenses
    .filter(expense => expense.categoryId === id)
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

function totalSpent(month) {
  return month.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

function totalSalarySpent(month) {
  return month.expenses
    .filter(expense => expense.source !== "extra")
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

function totalExtraSpent(month) {
  return month.expenses
    .filter(expense => expense.source === "extra")
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

function totalExtras(month) {
  return month.extras.reduce((sum, extra) => sum + (extra.amount || 0), 0);
}

/* =====================================================
   CÁLCULO DE SOBRAS DE MESES ANTERIORES
===================================================== */

function getPreviousSalaryCarryover(currentMonthKey) {
  let carryover = 0;
  const sortedKeys = Object.keys(state.months).sort();

  for (const key of sortedKeys) {
    if (key >= currentMonthKey) break;
    const m = state.months[key];
    const sal = m.salaryReceived || 0;
    const sp = totalSalarySpent(m);
    const resSaved = m.reserveContribution || 0;
    const resRet = m.salaryReserveReturn || 0;

    carryover += (sal + resRet - sp - resSaved);
  }

  return Math.max(0, carryover);
}

function getPreviousExtraCarryover(currentMonthKey) {
  let carryover = 0;
  const sortedKeys = Object.keys(state.months).sort();

  for (const key of sortedKeys) {
    if (key >= currentMonthKey) break;
    const m = state.months[key];
    const ext = totalExtras(m);
    const sp = totalExtraSpent(m);
    const resSaved = m.extraReserveContribution || 0;

    carryover += (ext - sp - resSaved);
  }

  return Math.max(0, carryover);
}

/* =====================================================
   RESERVA GLOBAL (APORTES MENOS SAQUES)
===================================================== */

function getGlobalReserveBalance() {
  let totalIn = 0;
  let totalOut = 0;

  Object.values(state.months).forEach(month => {
    totalIn += (month.reserveContribution || 0) + (month.extraReserveContribution || 0);
    totalOut += (month.reserveWithdrawal || 0);
  });

  return Math.max(0, totalIn - totalOut);
}

function getReserveBalance() {
  return getGlobalReserveBalance();
}

function syncReserve() {
  state.reserveBalance = getGlobalReserveBalance();
  save();
}

function getSalaryAvailable(month) {
  const carryover = getPreviousSalaryCarryover(state.currentMonth);
  const salary = month.salaryReceived || 0;
  const spent = totalSalarySpent(month);
  const reserveSaved = month.reserveContribution || 0;
  const reserveReturned = month.salaryReserveReturn || 0;

  return Math.max(0, carryover + salary + reserveReturned - spent - reserveSaved);
}

function getExtraAvailable(month) {
  const carryover = getPreviousExtraCarryover(state.currentMonth);
  const extras = totalExtras(month);
  const spent = totalExtraSpent(month);
  const reserveSaved = month.extraReserveContribution || 0;

  return Math.max(0, carryover + extras - spent - reserveSaved);
}

function available(month) {
  return getSalaryAvailable(month);
}

/* =====================================================
   SALÁRIO DIVIDIDO
===================================================== */

function getSalarySplit(month) {
  const salary = month.salaryReceived || 0;

  if (!state.settings.salarySplitEnabled) {
    return { enabled: false, advance: 0, main: salary };
  }

  const advance = Math.round((salary * (state.settings.advancePercent || 40)) / 100);
  const main = salary - advance;

  return { enabled: true, advance, main };
}

function updatePaymentVisibility() {
  const enabled = !!state.settings.salarySplitEnabled;
  const advanceElement = document.getElementById("advanceValue");
  const paymentCard = advanceElement?.closest(".payment") || advanceElement?.closest(".payments-card");

  if (paymentCard) paymentCard.classList.toggle("hidden", !enabled);

  const advanceDate = document.getElementById("advanceDate");
  const mainPayDate = document.getElementById("mainPayDate");

  if (advanceDate) advanceDate.classList.toggle("hidden", !enabled);
  if (mainPayDate) mainPayDate.classList.toggle("hidden", !enabled);
}

/* =====================================================
   RENDER
===================================================== */

function render() {
  const month = getMonth();
  syncReserve();

  const salaryAvail = getSalaryAvailable(month);
  const extraAvail = getExtraAvailable(month);

  const eyeBtn = document.getElementById("toggleHideBtn");
  if (eyeBtn) eyeBtn.textContent = state.settings.hideBalance ? "🙈" : "👁️";

  document.getElementById("monthTitle").textContent = monthLabel(state.currentMonth);
  document.getElementById("availableValue").textContent = money(salaryAvail);
  document.getElementById("salaryValue").textContent = money(salaryAvail);
  document.getElementById("extraValue").textContent = money(extraAvail);
  document.getElementById("spentValue").textContent = money(totalSpent(month));
  document.getElementById("reserveBig").textContent = money(state.reserveBalance);

  const split = getSalarySplit(month);
  document.getElementById("advanceValue").textContent = money(split.advance);
  document.getElementById("advanceDate").textContent = `Dia ${state.settings.advanceDay || 20}`;
  document.getElementById("mainPayValue").textContent = money(split.main);
  document.getElementById("mainPayDate").textContent = state.settings.mainPaymentLabel || "5º dia útil";

  updatePaymentVisibility();

  const goal = state.settings.reserveGoal || 0;
  const goalBox = document.getElementById("goalBox");

  if (goal > 0) {
    const percent = Math.min(100, Math.max(0, (state.reserveBalance / goal) * 100));
    goalBox.innerHTML = `
      Meta ${money(goal)}
      <div class="progress">
        <div style="width:${percent}%"></div>
      </div>
    `;
  } else {
    goalBox.innerHTML = "";
  }

  renderCategories();
  renderExtras();
  renderHistoryPreview();
}

/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {
  const month = getMonth();
  const wrap = document.getElementById("categories");
  if (!wrap) return;

  wrap.innerHTML = "";

  state.categories.forEach(category => {
    if (category.id === "reserve" || category.type === "reserve") {
      const contribution = (month.reserveContribution || 0) + (month.extraReserveContribution || 0);
      const element = document.createElement("div");
      element.className = "category reserve-cat";
      element.innerHTML = `
        <div class="cat-icon">🏦</div>
        <div class="cat-main">
          <div class="cat-name">Reserva</div>
          <div class="cat-sub">Guardado neste mês</div>
          <div class="progress">
            <div style="width:${contribution > 0 ? 100 : 0}%"></div>
          </div>
        </div>
        <div class="cat-value">
          <strong>${money(contribution)}</strong>
          <small>guardado</small>
        </div>
      `;
      element.addEventListener("click", () => {
        vibrate();
        openReserve();
      });
      wrap.appendChild(element);
      return;
    }

    const spent = categorySpent(category.id, month);
    const budget = category.budget || 0;
    const remaining = budget - spent;
    const hasBudget = budget > 0;
    const percent = hasBudget ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0;

    const subText = hasBudget 
      ? `${money(Math.max(0, remaining))} disponíveis` 
      : "Sem limite definido";

    const valueText = hasBudget 
      ? `de ${money(budget)}` 
      : "acumulado";

    const progressHtml = hasBudget 
      ? `<div class="progress"><div style="width:${percent}%"></div></div>` 
      : "";

    const element = document.createElement("div");
    element.className = "category";
    element.innerHTML = `
      <div class="cat-icon">${escapeHtml(category.icon)}</div>
      <div class="cat-main">
        <div class="cat-name">${escapeHtml(category.name)}</div>
        <div class="cat-sub">${subText}</div>
        ${progressHtml}
      </div>
      <div class="cat-value">
        <strong>${money(spent)}</strong>
        <small>${valueText}</small>
      </div>
      <div class="cat-actions">
        <button class="cat-edit" type="button" title="Editar categoria">✎</button>
      </div>
    `;

    element.addEventListener("click", event => {
      if (event.target.closest(".cat-edit")) return;
      vibrate();
      openExpense(category.id);
    });

    element.querySelector(".cat-edit").addEventListener("click", event => {
      event.stopPropagation();
      vibrate();
      openEditCategory(category.id);
    });

    wrap.appendChild(element);
  });
}

/* =====================================================
   NOVA / EDITAR CATEGORIA
===================================================== */

function openCategory() {
  openModal(
    "Nova categoria",
    `
      <form class="form" id="categoryForm">
        <label>Nome</label>
        <input id="catName" required placeholder="Ex.: Alimentação">
        <label>Ícone</label>
        <input id="catIcon" value="💰" maxlength="2">
        <label>Limite mensal (opcional)</label>
        <input id="catBudget" inputmode="decimal" placeholder="R$ 0,00 (deixe em branco se não houver meta)">
        <button type="submit">Criar categoria</button>
      </form>
    `
  );

  document.getElementById("categoryForm").onsubmit = event => {
    event.preventDefault();
    vibrate(15);
    const name = document.getElementById("catName").value.trim();
    const amount = numCents("catBudget");

    if (!name) {
      alert("Digite um nome para a categoria.");
      return;
    }

    state.categories.push({
      id: "cat_" + createId(),
      name,
      icon: document.getElementById("catIcon").value.trim() || "💰",
      budget: amount,
      type: "expense"
    });

    save();
    closeModal();
    render();
  };
}

function openEditCategory(id) {
  if (id === "reserve") {
    openReserve();
    return;
  }

  const category = state.categories.find(c => c.id === id);
  if (!category || category.type === "reserve") {
    openReserve();
    return;
  }

  const currentBudgetVal = category.budget > 0 ? (category.budget / 100).toFixed(2) : "";

  openModal(
    "Editar categoria",
    `
      <form class="form" id="editCategoryForm">
        <label>Nome</label>
        <input id="editCatName" value="${escapeHtml(category.name)}" required>
        <label>Ícone</label>
        <input id="editCatIcon" value="${escapeHtml(category.icon)}" maxlength="2">
        <label>Limite mensal (opcional)</label>
        <input id="editCatBudget" inputmode="decimal" value="${currentBudgetVal}" placeholder="R$ 0,00 (sem limite)">
        <button type="submit">Salvar alterações</button>
      </form>
      <button class="danger" id="deleteCategoryBtn" type="button" style="width:100%;padding:13px;border-radius:12px;margin-top:10px">
        Excluir categoria
      </button>
    `
  );

  document.getElementById("editCategoryForm").onsubmit = event => {
    event.preventDefault();
    vibrate(15);
    const name = document.getElementById("editCatName").value.trim();
    if (!name) {
      alert("Digite um nome.");
      return;
    }

    category.name = name;
    category.icon = document.getElementById("editCatIcon").value.trim() || "💰";
    category.budget = numCents("editCatBudget");

    save();
    closeModal();
    render();
  };

  document.getElementById("deleteCategoryBtn").onclick = () => {
    vibrate(25);
    if (confirm(`Excluir a categoria "${category.name}"? Os gastos antigos serão mantidos no extrato.`)) {
      state.categories = state.categories.filter(c => c.id !== id);
      save();
      closeModal();
      render();
    }
  };
}

/* =====================================================
   GASTOS
===================================================== */

function getSelectedMonthDate() {
  const currentRealMonth = monthKey(new Date());
  if (state.currentMonth === currentRealMonth) return todayKey();
  const [year, month] = state.currentMonth.split("-");
  return `${year}-${month}-01`;
}

function openExpense(categoryId = state.categories.find(c => c.type === "expense")?.id) {
  const options = state.categories
    .filter(c => c.type === "expense")
    .map(c => `<option value="${escapeHtml(c.id)}" ${c.id === categoryId ? "selected" : ""}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`)
    .join("");

  const selectedDate = getSelectedMonthDate();
  const month = getMonth();
  const salaryAvailable = getSalaryAvailable(month);
  const extraAvailable = getExtraAvailable(month);

  openModal(
    "Adicionar gasto",
    `
      <form class="form" id="expenseForm">
        <label>Valor</label>
        <input id="expenseAmount" inputmode="decimal" placeholder="R$ 0,00" required>
        <label>Categoria</label>
        <select id="expenseCategory">${options}</select>
        <label>De onde saiu o dinheiro?</label>
        <select id="expenseSource">
          <option value="salary">Salário — ${money(salaryAvailable)} disponível</option>
          <option value="extra">Extra — ${money(extraAvailable)} disponível</option>
        </select>
        <label>Data</label>
        <input id="expenseDate" type="date" value="${selectedDate}">
        <label>Onde / com o que gastei?</label>
        <input id="expenseNote" placeholder="Ex.: mercado, farmácia, gasolina...">
        <button type="submit">Salvar gasto</button>
      </form>
    `
  );

  document.getElementById("expenseForm").onsubmit = event => {
    event.preventDefault();
    vibrate(18);
    const amount = numCents("expenseAmount");

    if (amount <= 0) {
      alert("Digite um valor válido maior que zero.");
      return;
    }

    const source = document.getElementById("expenseSource").value;
    const month = getMonth();
    const salaryAvail = getSalaryAvailable(month);
    const extraAvail = getExtraAvailable(month);

    if (source === "salary" && amount > salaryAvail) {
      alert(`Saldo de salário insuficiente.\n\nDisponível: ${money(salaryAvail)}\nTentativa: ${money(amount)}`);
      return;
    }

    if (source === "extra" && amount > extraAvail) {
      alert(`Saldo de extras insuficiente.\n\nDisponível: ${money(extraAvail)}\nTentativa: ${money(amount)}`);
      return;
    }

    const date = document.getElementById("expenseDate").value || selectedDate;
    if (!date.startsWith(state.currentMonth)) {
      alert("A data do gasto precisa pertencer ao mês selecionado.");
      return;
    }

    month.expenses.push({
      id: createId(),
      categoryId: document.getElementById("expenseCategory").value,
      amount,
      source,
      date,
      note: document.getElementById("expenseNote").value.trim()
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
  const month = getMonth();
  const container = document.getElementById("extrasList");
  if (!container) return;

  if (month.extras.length === 0) {
    container.innerHTML = `<div class="empty-history">Nenhuma entrada extra neste mês.</div>`;
    return;
  }

  const items = [...month.extras].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = items
    .map(extra => `
      <div class="extra-item">
        <div class="extra-icon">💰</div>
        <div class="extra-main">
          <div class="extra-name">${escapeHtml(extra.name)}</div>
          <div class="extra-date">${formatDate(extra.date)}</div>
        </div>
        <div class="extra-value">+ ${money(extra.amount)}</div>
        <button class="extra-delete" type="button" data-id="${escapeHtml(extra.id)}" title="Excluir">✕</button>
      </div>
    `)
    .join("");

  container.querySelectorAll(".extra-delete").forEach(button => {
    button.addEventListener("click", () => {
      vibrate(20);
      deleteExtra(button.dataset.id);
    });
  });
}

function openExtra() {
  const today = getSelectedMonthDate();

  openModal(
    "Adicionar entrada extra",
    `
      <form class="form" id="extraForm">
        <label>Descrição</label>
        <input id="extraName" placeholder="Ex.: venda de algo pessoal" required>
        <label>Valor</label>
        <input id="extraAmount" inputmode="decimal" placeholder="R$ 0,00" required>
        <label>Data</label>
        <input id="extraDate" type="date" value="${today}" required>
        <button type="submit">Salvar entrada</button>
      </form>
    `
  );

  document.getElementById("extraForm").onsubmit = event => {
    event.preventDefault();
    vibrate(18);
    const name = document.getElementById("extraName").value.trim();
    const amount = numCents("extraAmount");
    const date = document.getElementById("extraDate").value;

    if (!name || amount <= 0) {
      alert("Informe uma descrição e um valor válido maior que zero.");
      return;
    }

    if (!date.startsWith(state.currentMonth)) {
      alert("A data da entrada extra precisa pertencer ao mês selecionado.");
      return;
    }

    const month = getMonth();
    month.extras.push({
      id: createId(),
      name,
      amount,
      date: date || today
    });

    save();
    closeModal();
    render();
  };
}

function deleteExtra(id) {
  const month = getMonth();
  const extra = month.extras.find(item => item.id === id);
  if (!extra) return;

  if (!confirm(`Excluir a entrada "${extra.name}" de ${money(extra.amount)}?`)) return;

  const remainingExtras = month.extras
    .filter(item => item.id !== id)
    .reduce((sum, item) => sum + (item.amount || 0), 0);

  const extraCommitted = totalExtraSpent(month) + (month.extraReserveContribution || 0);

  if (remainingExtras < extraCommitted) {
    alert("Este extra não pode ser excluído pois seu saldo já está comprometido por gastos ou aportes efetuados na reserva.");
    return;
  }

  month.extras = month.extras.filter(item => item.id !== id);
  save();
  render();
}

/* =====================================================
   RESERVA
===================================================== */

function openReserve() {
  const month = getMonth();
  const contribution = (month.reserveContribution || 0) + (month.extraReserveContribution || 0);
  const withdrawal = month.reserveWithdrawal || 0;
  const reserveBalance = getReserveBalance();
  const salaryAvail = getSalaryAvailable(month);
  const extraAvail = getExtraAvailable(month);
  const goal = state.settings.reserveGoal || 0;

  const goalText = goal > 0 ? `<br><br><strong>Meta da reserva</strong><br>${money(goal)}` : "";

  openModal(
    "Reserva",
    `
      <div class="notice">
        <strong>Total Acumulado na Reserva</strong><br>${money(reserveBalance)}${goalText}
        <br><br>
        <strong>Saldos livres para guardar neste mês</strong><br>
        • Salário: ${money(salaryAvail)}<br>
        • Extra: ${money(extraAvail)}
        <br><br>
        <strong>Aportado neste mês</strong><br>${money(contribution)}
        <br><br>
        <strong>Resgatado neste mês</strong><br>${money(withdrawal)}
      </div>

      <form class="form" id="reserveForm" style="margin-top:12px">
        <label>De onde sairá o dinheiro para a reserva?</label>
        <select id="reserveSource">
          <option value="salary">Salário — ${money(salaryAvail)} disponível</option>
          <option value="extra">Extra — ${money(extraAvail)} disponível</option>
        </select>

        <label>Quanto você quer guardar?</label>
        <input id="reserveAmount" inputmode="decimal" placeholder="R$ 0,00">

        <label>Observação</label>
        <input id="reserveNote" placeholder="Ex.: dinheiro guardado do mês">

        <button type="submit">Guardar na reserva</button>
      </form>

      <form class="form" id="withdrawForm" style="margin-top:16px">
        <label>Quanto você quer resgatar da reserva?</label>
        <input id="withdrawAmount" inputmode="decimal" placeholder="R$ 0,00">

        <label>Motivo do resgate</label>
        <input id="withdrawNote" placeholder="Ex.: emergência">

        <button class="danger" type="submit">Resgatar da reserva</button>
      </form>

      <button class="secondary" id="closeReserveBtn" type="button" style="width:100%;padding:13px;border-radius:12px;margin-top:10px">
        Fechar
      </button>
    `
  );

  document.getElementById("reserveForm").onsubmit = event => {
    event.preventDefault();
    vibrate(18);
    const amount = numCents("reserveAmount");
    const source = document.getElementById("reserveSource").value;

    if (amount <= 0) {
      alert("Digite um valor válido maior que zero.");
      return;
    }

    if (source === "salary") {
      const avail = getSalaryAvailable(month);
      if (amount > avail) {
        alert(`Saldo de Salário insuficiente.\n\nDisponível: ${money(avail)}\nTentativa: ${money(amount)}`);
        return;
      }
      month.reserveContribution = (month.reserveContribution || 0) + amount;
    } else {
      const avail = getExtraAvailable(month);
      if (amount > avail) {
        alert(`Saldo de Extras insuficiente.\n\nDisponível: ${money(avail)}\nTentativa: ${money(amount)}`);
        return;
      }
      month.extraReserveContribution = (month.extraReserveContribution || 0) + amount;
    }

    const note = document.getElementById("reserveNote").value.trim();
    const txDate = getSelectedMonthDate();

    month.reserveTransactions.push({
      id: createId(),
      type: "in",
      source,
      amount,
      date: txDate,
      note
    });

    save();
    closeModal();
    render();
  };

  document.getElementById("withdrawForm").onsubmit = event => {
    event.preventDefault();
    vibrate(22);
    const amount = numCents("withdrawAmount");
    const currentReserve = getReserveBalance();

    if (amount <= 0) {
      alert("Digite um valor válido maior que zero.");
      return;
    }

    if (amount > currentReserve) {
      alert(`Saldo insuficiente na reserva.\n\nDisponível: ${money(currentReserve)}\nTentativa: ${money(amount)}`);
      return;
    }

    const note = document.getElementById("withdrawNote").value.trim();
    
    // CORREÇÃO CRÍTICA: Desconta do saldo acumulado da reserva e devolve para o saldo disponível
    month.reserveWithdrawal = (month.reserveWithdrawal || 0) + amount;
    month.salaryReserveReturn = (month.salaryReserveReturn || 0) + amount;

    const txDate = getSelectedMonthDate();

    month.reserveTransactions.push({
      id: createId(),
      type: "out",
      source: "salary",
      amount,
      date: txDate,
      note
    });

    save();
    closeModal();
    render();
  };

  document.getElementById("closeReserveBtn").onclick = () => {
    vibrate();
    closeModal();
  };
}

/* =====================================================
   HISTÓRICO & EXTRATO
===================================================== */

function getHistory(month) {
  const items = [];

  month.expenses.forEach(expense => {
    const category = state.categories.find(c => c.id === expense.categoryId);
    items.push({
      type: "expense",
      date: expense.date,
      amount: expense.amount || 0,
      name: category ? category.name : "Categoria removida",
      icon: category ? category.icon : "💰",
      note: expense.source === "extra" ? `Pago com Extra${expense.note ? " — " + expense.note : ""}` : expense.note || "",
      id: expense.id
    });
  });

  month.extras.forEach(extra => {
    items.push({
      type: "extra-in",
      date: extra.date,
      amount: extra.amount || 0,
      name: extra.name,
      icon: "💰",
      note: "Entrada extra",
      id: extra.id
    });
  });

  if (Array.isArray(month.reserveTransactions)) {
    month.reserveTransactions.forEach(tx => {
      items.push({
        type: tx.type === "in" ? "reserve-in" : "reserve-out",
        date: tx.date,
        amount: tx.amount || 0,
        name: tx.type === "in" ? `Guardado (${tx.source === "extra" ? "Extra" : "Salário"})` : "Resgatado da Reserva",
        icon: tx.type === "in" ? "🏦" : "💸",
        note: tx.note || "",
        id: tx.id
      });
    });
  }

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

function renderHistoryPreview() {
  const container = document.getElementById("historyPreview");
  if (!container) return;

  const month = getMonth();
  const items = getHistory(month);

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-history">Nenhum lançamento neste mês.</div>`;
    return;
  }

  container.innerHTML = items.slice(0, 4).map(item => historyItemHtml(item)).join("");
}

function historyItemHtml(item) {
  let valueClass = "expense";
  let prefix = "- ";

  if (item.type === "extra-in" || item.type === "reserve-in") {
    valueClass = item.type === "extra-in" ? "extra-in" : "reserve-in";
    prefix = "+ ";
  }

  if (item.type === "reserve-out") {
    valueClass = "reserve-out";
    prefix = "- ";
  }

  return `
    <div class="history-item">
      <div class="history-icon">${escapeHtml(item.icon)}</div>
      <div class="history-main">
        <div class="history-name">${escapeHtml(item.name)}</div>
        ${item.note ? `<div class="history-note">${escapeHtml(item.note)}</div>` : ""}
        <div class="history-date">${formatDate(item.date)}</div>
      </div>
      <div class="history-value ${valueClass}">${prefix}${money(item.amount)}</div>
    </div>
  `;
}

function openHistory() {
  const month = getMonth();
  const items = getHistory(month);

  const prevSalCarry = getPreviousSalaryCarryover(state.currentMonth);
  const prevExtCarry = getPreviousExtraCarryover(state.currentMonth);

  const content = items.length === 0
    ? `<div class="empty-history">Nenhum lançamento neste mês.</div>`
    : items.map(item => historyItemHtml(item)).join("");

  openModal(
    "Extrato — " + monthLabel(state.currentMonth),
    `
      <div class="history-total">
        <span>Sobra de Salário Anterior</span>
        <strong>${money(prevSalCarry)}</strong>
      </div>
      <div class="history-total">
        <span>Sobra de Extra Anterior</span>
        <strong>${money(prevExtCarry)}</strong>
      </div>
      <div class="history-total">
        <span>Salário Livre Total</span>
        <strong>${money(getSalaryAvailable(month))}</strong>
      </div>
      <div class="history-total">
        <span>Extras Livres Totais</span>
        <strong>${money(getExtraAvailable(month))}</strong>
      </div>
      <div class="history-total">
        <span>Total de gastos no mês</span>
        <strong>${money(totalSpent(month))}</strong>
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
  const month = getMonth();

  openModal(
    "Configurações",
    `
      <form class="form" id="settingsForm">
        <label>Salário deste mês</label>
        <input id="sSalary" inputmode="decimal" value="${(month.salaryReceived / 100).toFixed(2)}">

        <div class="dark-mode-row">
          <span>💰 Dividir salário em dois pagamentos</span>
          <label class="theme-switch">
            <input type="checkbox" id="salarySplitToggle">
            <span class="theme-slider"><span class="theme-dot"></span></span>
          </label>
        </div>

        <div id="salarySplitOptions" class="hidden">
          <label>Percentual do adiantamento (%)</label>
          <input id="sPercent" type="number" min="0" max="100" value="${state.settings.advancePercent || 40}">
          <label>Dia do adiantamento</label>
          <input id="sDay" type="number" min="1" max="31" value="${state.settings.advanceDay || 20}">
          <label>Texto do pagamento principal</label>
          <input id="sMain" value="${escapeHtml(state.settings.mainPaymentLabel || "5º dia útil")}">
        </div>

        <label>Meta da reserva (opcional)</label>
        <input id="sGoal" inputmode="decimal" value="${state.settings.reserveGoal > 0 ? (state.settings.reserveGoal / 100).toFixed(2) : ""}" placeholder="Deixe vazio se não quiser uma meta">

        <button type="submit">Salvar</button>
      </form>

      <button class="secondary" style="width:100%;margin-top:10px;padding:13px;border-radius:12px" id="exportBtn" type="button">
        Exportar backup JSON
      </button>

      <button class="danger" style="width:100%;margin-top:10px;padding:13px;border-radius:12px" id="resetBtn" type="button">
        Apagar todos os dados
      </button>
    `
  );

  const salarySplitToggle = document.getElementById("salarySplitToggle");
  const salarySplitOptions = document.getElementById("salarySplitOptions");
  salarySplitToggle.checked = !!state.settings.salarySplitEnabled;

  function updateSalarySplitOptions() {
    salarySplitOptions.classList.toggle("hidden", !salarySplitToggle.checked);
  }

  updateSalarySplitOptions();

  salarySplitToggle.onchange = () => {
    vibrate(12);
    updateSalarySplitOptions();
  };

  document.getElementById("settingsForm").onsubmit = event => {
    event.preventDefault();
    vibrate(15);
    const newSalary = numCents("sSalary");
    const committedSalary = totalSalarySpent(month) + (month.reserveContribution || 0) - (month.salaryReserveReturn || 0);

    if (newSalary < committedSalary) {
      alert(`O salário não pode ser reduzido para ${money(newSalary)}.\n\nJá existem ${money(committedSalary)} comprometidos neste mês.`);
      return;
    }

    month.salaryReceived = newSalary;
    state.settings.plannedSalary = newSalary;
    state.settings.salarySplitEnabled = salarySplitToggle.checked;
    state.settings.advancePercent = Math.min(100, Math.max(0, Number(document.getElementById("sPercent").value) || 40));
    state.settings.advanceDay = Math.min(31, Math.max(1, Number(document.getElementById("sDay").value) || 20));
    state.settings.mainPaymentLabel = document.getElementById("sMain").value.trim() || "5º dia útil";
    state.settings.reserveGoal = Math.max(0, numCents("sGoal"));

    save();
    closeModal();
    render();
  };

  document.getElementById("exportBtn").onclick = () => {
    vibrate();
    exportData();
  };

  document.getElementById("resetBtn").onclick = () => {
    vibrate(25);
    if (confirm("Apagar todos os dados do FX?")) {
      localStorage.clear();
      location.reload();
    }
  };
}

/* =====================================================
   PAGAMENTOS & BACKUP
===================================================== */

function openPayments() {
  const month = getMonth();
  if (!state.settings.salarySplitEnabled) {
    openModal("Pagamentos", `<div class="notice">A divisão do salário está <strong>desativada</strong>.<br><br>O salário deste mês é: <strong>${money(month.salaryReceived)}</strong><br><br>Ative em ⚙️ Configurações se desejar dividir.</div>`);
    return;
  }

  const split = getSalarySplit(month);
  openModal("Pagamentos", `<div class="notice"><strong>Adiantamento</strong><br>${money(split.advance)} — dia ${state.settings.advanceDay}<br><br><strong>Pagamento principal</strong><br>${money(split.main)} — ${escapeHtml(state.settings.mainPaymentLabel)}</div>`);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fx-backup-${state.currentMonth}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =====================================================
   UTILITÁRIOS & MODAL
===================================================== */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[x]));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now() + Math.random());
}

function todayKey() {
  return monthDateKey(new Date());
}

function monthDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) return "";
  const parts = String(date).split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function openModal(title, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

/* =====================================================
   EVENTOS & INICIALIZAÇÃO
===================================================== */

document.getElementById("loginForm").onsubmit = event => {
  event.preventDefault();
  login(document.getElementById("loginUsername").value, document.getElementById("loginPassword").value);
};

document.getElementById("createForm").onsubmit = event => {
  event.preventDefault();
  createAccount();
};

document.getElementById("forgotForm").onsubmit = event => {
  event.preventDefault();
  resetPassword();
};

document.getElementById("loginBtn").onclick = () => login(document.getElementById("loginUsername").value, document.getElementById("loginPassword").value);
document.getElementById("createBtn").onclick = createAccount;
document.getElementById("resetPasswordBtn").onclick = resetPassword;

document.getElementById("showCreateBtn").onclick = showCreateAccount;
document.getElementById("showForgotBtn").onclick = showForgotForm;
document.getElementById("backLoginBtn").onclick = showLoginForm;
document.getElementById("backLoginFromForgotBtn").onclick = showLoginForm;

document.getElementById("logoutBtn").onclick = logout;

document.getElementById("toggleHideBtn").onclick = () => {
  vibrate(15);
  state.settings.hideBalance = !state.settings.hideBalance;
  save();
  render();
};

document.getElementById("prevMonth").onclick = () => {
  vibrate();
  state.currentMonth = monthShift(state.currentMonth, -1);
  save();
  render();
};

document.getElementById("nextMonth").onclick = () => {
  vibrate();
  state.currentMonth = monthShift(state.currentMonth, 1);
  save();
  render();
};

document.getElementById("addExpenseBtn").onclick = () => { vibrate(); openExpense(); };
document.getElementById("addCategoryBtn").onclick = () => { vibrate(); openCategory(); };
document.getElementById("addExtraBtn").onclick = () => { vibrate(); openExtra(); };
document.getElementById("settingsBtn").onclick = () => { vibrate(); openSettings(); };
document.getElementById("paymentsSettingsBtn").onclick = () => { vibrate(); openPayments(); };
document.getElementById("reserveBtn").onclick = () => { vibrate(); openReserve(); };
document.getElementById("historyBtn").onclick = () => { vibrate(); openHistory(); };
document.getElementById("historyBtn2").onclick = () => { vibrate(); openHistory(); };
document.getElementById("closeModal").onclick = () => { vibrate(); closeModal(); };

document.getElementById("modal").addEventListener("click", event => {
  if (event.target.id === "modal") { vibrate(); closeModal(); }
});

function initFinance() {
  normalizeState(state);
  getMonth();
  syncReserve();
  render();
}

if (isLogged()) {
  showApp();
} else {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}
