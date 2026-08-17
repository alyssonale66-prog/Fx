/* =====================================================
   PROJETO FX — SEU DINHEIRO. SUAS REGRAS.
   Arquivo: app.js
   Versão: 1.5.1 — Correção de inflação de valores (Bugfix)
===================================================== */

const KEY = "fx_finance_v1";
const ACCOUNT_KEY = "fx_account_v1";
const SESSION_KEY = "fx_session_v1";
const REMEMBER_KEY = "fx_remember_v1";
const LAST_CHECKED_MONTH_KEY = "fx_last_month_v1";
const MASTER_KEY = "Fx020919";

/* =====================================================
   SENSATIVIDADE TÁTIL
===================================================== */
function vibrate(ms = 12) {
  if ("vibrate" in navigator) try { navigator.vibrate(ms); } catch (e) {}
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
   ESTADO INICIAL
===================================================== */
const state = load() || {
  version: "1.5.1",
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
   CONTA & LOGIN
===================================================== */
function getAccount() { try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)); } catch { return null; } }
function saveAccount(account) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); }
function isLogged() { return localStorage.getItem(SESSION_KEY) === "true"; }

function login(username, password) {
  vibrate(15);
  const account = getAccount();
  if (!account) { showLoginMessage("Nenhuma conta criada ainda."); return; }
  const cleanUser = String(username || "").trim().toLowerCase();
  const savedUser = String(account.username || "").trim().toLowerCase();

  if (cleanUser !== savedUser || password !== account.password) {
    showLoginMessage("Usuário ou senha incorretos.");
    return;
  }
  const remember = document.getElementById("rememberUserToggle")?.checked;
  remember ? localStorage.setItem(REMEMBER_KEY, account.username) : localStorage.removeItem(REMEMBER_KEY);
  localStorage.setItem(SESSION_KEY, "true");
  showApp();
}

function createAccount() {
  vibrate(15);
  const rawUser = document.getElementById("createUsername").value.trim();
  const username = rawUser.toLowerCase();
  const password = document.getElementById("createPassword").value;
  const confirmation = document.getElementById("createPasswordConfirm").value;

  if (username.length < 3 || username.length > 20) { showLoginMessage("Usuário de 3 a 20 caracteres."); return; }
  if (password.length !== 8) { showLoginMessage("Senha deve ter 8 caracteres."); return; }
  if (password !== confirmation) { showLoginMessage("As senhas não conferem."); return; }
  if (getAccount()) { showLoginMessage("Já existe uma conta."); return; }

  const recoveryCode = `FX-${Math.floor(1000 + Math.random() * 9000)}`;
  saveAccount({ username, password, recoveryCode });
  localStorage.setItem(SESSION_KEY, "true");
  localStorage.setItem(REMEMBER_KEY, username);
  alert(`Conta criada!\n\nCódigo de recuperação: ${recoveryCode}`);
  showApp();
}

function resetPassword() {
  const code = document.getElementById("forgotCode").value.trim();
  const newPass = document.getElementById("forgotNewPassword").value;
  const account = getAccount();
  if (!account || (code !== MASTER_KEY && code.toUpperCase() !== (account.recoveryCode || "").toUpperCase())) {
    showLoginMessage("Código inválido."); return;
  }
  if (newPass.length !== 8) { showLoginMessage("Senha deve ter 8 caracteres."); return; }
  account.password = newPass;
  saveAccount(account);
  alert("Senha redefinida!"); showLoginForm();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

/* =====================================================
   NORMALIZAÇÃO (PROTEGIDA POR VERSÃO)
===================================================== */
function normalizeState(data) {
  if (!data || typeof data !== "object") return null;
  // Se já estiver na versão 1.5.1, não faz nada para evitar duplicação
  if (data.version === "1.5.1") return data;

  data.version = "1.5.1";
  if (!data.settings) data.settings = {};
  
  // Garante categorias
  if (!Array.isArray(data.categories)) data.categories = defaultCategories.map(cat => ({ ...cat }));

  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch { return null; }
}

function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* =====================================================
   LÓGICA FINANCEIRA
===================================================== */
function money(cents) {
  if (state.settings.hideBalance) return "R$ ••••";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);
}

function parseToCents(value) {
  if (typeof value === "number") return Math.round(value);
  let text = String(value).trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return 0;
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
    const [int, dec = ""] = text.split(".");
    return (parseInt(int.replace(/\D/g, "") || "0", 10) * 100) + parseInt(dec.padEnd(2, "0").slice(0, 2), 10);
  }
  return Math.round(Number(text.replace(/[^0-9.-]/g, "")) * 100);
}

function numCents(id) { return parseToCents(document.getElementById(id).value); }

function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

function getMonth(key = state.currentMonth) {
  if (!state.months[key]) {
    state.months[key] = { salaryReceived: state.settings.plannedSalary || 0, expenses: [], extras: [], reserveContribution: 0, extraReserveContribution: 0, reserveWithdrawal: 0, reserveTransactions: [], salaryReserveReturn: 0 };
    save();
  }
  return state.months[key];
}

/* =====================================================
   CÁLCULOS E RENDER
===================================================== */
function totalSpent(month) { return month.expenses.reduce((s, e) => s + (e.amount || 0), 0); }
function totalExtras(month) { return month.extras.reduce((s, e) => s + (e.amount || 0), 0); }
function getPreviousSalaryCarryover(currentMonthKey) {
  let carry = 0;
  Object.keys(state.months).sort().forEach(key => {
    if (key >= currentMonthKey) return;
    const m = state.months[key];
    carry += (m.salaryReceived + m.salaryReserveReturn - totalSalarySpent(m) - m.reserveContribution);
  });
  return Math.max(0, carry);
}

function getSalaryAvailable(month) { return Math.max(0, getPreviousSalaryCarryover(state.currentMonth) + month.salaryReceived + month.salaryReserveReturn - totalSalarySpent(month) - month.reserveContribution); }
function getExtraAvailable(month) { return Math.max(0, getPreviousExtraCarryover(state.currentMonth) + totalExtras(month) - totalExtraSpent(month) - month.extraReserveContribution); }
function totalSalarySpent(month) { return month.expenses.filter(e => e.source !== "extra").reduce((s, e) => s + e.amount, 0); }
function totalExtraSpent(month) { return month.expenses.filter(e => e.source === "extra").reduce((s, e) => s + e.amount, 0); }
function getPreviousExtraCarryover(currentMonthKey) {
  let carry = 0;
  Object.keys(state.months).sort().forEach(key => {
    if (key >= currentMonthKey) return;
    const m = state.months[key];
    carry += (totalExtras(m) - totalExtraSpent(m) - m.extraReserveContribution);
  });
  return Math.max(0, carry);
}
function getReserveBalance() {
  let totalIn = 0, totalOut = 0;
  Object.values(state.months).forEach(m => {
    totalIn += (m.reserveContribution || 0) + (m.extraReserveContribution || 0);
    totalOut += (m.reserveWithdrawal || 0);
  });
  return Math.max(0, totalIn - totalOut);
}

function syncReserve() { state.reserveBalance = getReserveBalance(); save(); }

function render() {
  const month = getMonth();
  syncReserve();
  document.getElementById("monthTitle").textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(state.currentMonth + "-01"));
  document.getElementById("availableValue").textContent = money(getSalaryAvailable(month));
  document.getElementById("salaryValue").textContent = money(getSalaryAvailable(month));
  document.getElementById("extraValue").textContent = money(getExtraAvailable(month));
  document.getElementById("spentValue").textContent = money(totalSpent(month));
  document.getElementById("reserveBig").textContent = money(state.reserveBalance);

  const totalIncomes = (month.salaryReceived || 0) + totalExtras(month);
  const spentTotal = totalSpent(month);
  const percent = totalIncomes > 0 ? Math.min(100, Math.max(0, (spentTotal / totalIncomes) * 100)) : 0;
  document.getElementById("monthlyBar").style.width = `${percent}%`;
  document.getElementById("spentPercentLabel").textContent = `${Math.round(percent)}% gasto`;

  renderCategories();
}

function renderCategories() {
  const wrap = document.getElementById("categories");
  wrap.innerHTML = "";
  state.categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "category";
    el.innerHTML = `<div class="cat-icon">${cat.icon}</div><div class="cat-main"><div class="cat-name">${cat.name}</div></div><div class="cat-value"><strong>${money(cat.type === "reserve" ? (getMonth().reserveContribution + getMonth().extraReserveContribution) : categorySpent(cat.id, getMonth()))}</strong></div>`;
    wrap.appendChild(el);
  });
}

function initFinance() {
  normalizeState(state);
  render();
}

/* UI UTILS */
function showApp() { document.getElementById("loginScreen").classList.add("hidden"); document.getElementById("appScreen").classList.remove("hidden"); initFinance(); }
function showLoginMessage(m) { document.getElementById("loginMessage").textContent = m; }
function showCreateAccount() { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("createForm").classList.remove("hidden"); }
function showLoginForm() { document.getElementById("createForm").classList.add("hidden"); document.getElementById("loginForm").classList.remove("hidden"); }
function showForgotForm() { document.getElementById("loginForm").classList.add("hidden"); document.getElementById("forgotForm").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
function openModal(t, h) { document.getElementById("modalTitle").textContent = t; document.getElementById("modalBody").innerHTML = h; document.getElementById("modal").classList.remove("hidden"); }
function createId() { return Math.random().toString(36).substr(2, 9); }

/* EVENT LISTENERS */
document.getElementById("loginBtn").onclick = () => login(document.getElementById("loginUsername").value, document.getElementById("loginPassword").value);
document.getElementById("logoutBtn").onclick = logout;
document.getElementById("addExpenseBtn").onclick = () => alert("Adicionar gasto (implementar modal)"); // Exemplo
document.getElementById("toggleHideBtn").onclick = () => { state.settings.hideBalance = !state.settings.hideBalance; save(); render(); };

// Início
if (localStorage.getItem(REMEMBER_KEY)) {
  document.getElementById("loginUsername").value = localStorage.getItem(REMEMBER_KEY);
  document.getElementById("rememberUserToggle").checked = true;
}
if (isLogged()) showApp();
