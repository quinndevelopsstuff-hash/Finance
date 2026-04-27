/* =====================
   Constants
   ===================== */
const EXPENSE_CATEGORIES = ['Food','Transport','Housing','Health','Entertainment','Shopping','Utilities','Education','Travel','Other'];
const INCOME_CATEGORIES  = ['Income','Savings','Other'];
const ACCOUNT_TYPES      = ['Checking','Savings','Cash','Custom'];
const SWATCHES = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
const CATEGORY_ICONS = {
  Food:'🍔', Transport:'🚗', Housing:'🏠', Health:'💊', Entertainment:'🎬',
  Shopping:'🛍️', Utilities:'⚡', Education:'📚', Travel:'✈️', Other:'📦',
  Income:'💵', Savings:'🏦',
};
const TYPE_ICONS = { income:'⬆️', expense:'⬇️', transfer:'↔️' };

/* =====================
   State
   ===================== */
let state = { accounts: [], transactions: [], goals: [] };

function loadState() {
  try {
    const raw = localStorage.getItem('financeApp');
    if (raw) { state = JSON.parse(raw); return true; }
  } catch(_) {
    localStorage.removeItem('financeApp');
  }
  return false;
}

function saveState() {
  localStorage.setItem('financeApp', JSON.stringify(state));
}

/* =====================
   Utilities
   ===================== */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmt(n) {
  const abs = Math.abs(n);
  const str = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + '$' + str;
}

function fmtDate(iso) {
  const [y,mo,d] = iso.split('-');
  return new Date(+y, +mo-1, +d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function monthKey(iso) { return iso.slice(0,7); }
function currentMonthKey() { return new Date().toISOString().slice(0,7); }

function getMonthLabel(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-US', { month:'short', year:'numeric' });
}

function getMonthKeys(count) {
  const keys = [];
  const now = new Date();
  for (let i = -(count-1); i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    keys.push(d.toISOString().slice(0,7));
  }
  return keys;
}

function accountById(id) { return state.accounts.find(a => a.id === id); }

function computeBalance(account) {
  let bal = account.balance;
  for (const tx of state.transactions) {
    if (tx.type === 'income'   && tx.account === account.id) bal += tx.amount;
    if (tx.type === 'expense'  && tx.account === account.id) bal -= tx.amount;
    if (tx.type === 'transfer' && tx.account === account.id) bal -= tx.amount;
    if (tx.type === 'transfer' && tx.toAccount === account.id) bal += tx.amount;
  }
  return bal;
}

/* =====================
   Toast
   ===================== */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

/* =====================
   Modal Helpers
   ===================== */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  const closeId = e.target.dataset.close;
  if (closeId) closeModal(closeId);
  if (e.target.classList.contains('modal-overlay')) {
    const id = e.target.id;
    if (id) closeModal(id);
  }
});

/* =====================
   Navigation
   ===================== */
let currentView = 'dashboard';

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'transactions') renderTransactions();
  if (name === 'goals') renderGoals();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

/* =====================
   Color Swatch Builder
   ===================== */
function buildSwatch(containerId, hiddenId, defaultColor) {
  const container = document.getElementById(containerId);
  const hidden    = document.getElementById(hiddenId);
  container.innerHTML = '';
  SWATCHES.forEach(color => {
    const dot = document.createElement('div');
    dot.className = 'swatch-dot' + (color === (hidden.value || defaultColor) ? ' selected' : '');
    dot.style.background = color;
    dot.addEventListener('click', () => {
      container.querySelectorAll('.swatch-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      hidden.value = color;
    });
    container.appendChild(dot);
  });
  if (!hidden.value) hidden.value = defaultColor;
}

/* =====================
   Onboarding
   ===================== */
let onboardingAccounts = [];

function showOnboarding() {
  document.getElementById('onboarding').classList.add('active');
  onboardingAccounts = [];
  document.getElementById('obColor').value = SWATCHES[0];
  buildSwatch('obColorSwatch', 'obColor', SWATCHES[0]);
  renderObAccList();
}

function hideOnboarding() {
  document.getElementById('onboarding').classList.remove('active');
}

function renderObAccList() {
  const list     = document.getElementById('obAccList');
  const countEl  = document.getElementById('obAccCount');
  const hintEl   = document.getElementById('obHint');
  const startBtn = document.getElementById('getStartedBtn');

  if (!onboardingAccounts.length) {
    list.innerHTML = '<li class="ob-empty">No accounts added yet</li>';
    countEl.classList.remove('visible');
    hintEl.style.display = '';
    startBtn.disabled = true;
    return;
  }

  countEl.textContent = onboardingAccounts.length;
  countEl.classList.add('visible');
  hintEl.style.display = 'none';
  startBtn.disabled = false;

  list.innerHTML = onboardingAccounts.map(acc => `
    <li class="ob-acc-item">
      <div class="ob-acc-dot" style="background:${acc.color}22;color:${acc.color}">${acc.emoji}</div>
      <div class="ob-acc-info">
        <div class="ob-acc-name">${acc.name}</div>
        <div class="ob-acc-meta">${acc.type === 'Custom' ? (acc.customType || 'Custom') : acc.type}</div>
      </div>
      <div class="ob-acc-bal mono">${fmt(acc.balance)}</div>
      <button class="ob-remove-btn" data-remove-ob="${acc.id}" title="Remove">✕</button>
    </li>`).join('');
}

document.getElementById('obType').addEventListener('change', function() {
  document.getElementById('obCustomTypeRow').style.display = this.value === 'Custom' ? '' : 'none';
});

document.getElementById('obForm').addEventListener('submit', e => {
  e.preventDefault();
  const name       = document.getElementById('obName').value.trim();
  const type       = document.getElementById('obType').value;
  const customType = document.getElementById('obCustomType').value.trim();
  const emoji      = document.getElementById('obEmoji').value.trim() || '🏦';
  const color      = document.getElementById('obColor').value || SWATCHES[0];
  const balance    = parseFloat(document.getElementById('obBalance').value) || 0;

  onboardingAccounts.push({ id: uid(), name, type, customType, emoji, color, balance });

  document.getElementById('obName').value = '';
  document.getElementById('obType').value = 'Checking';
  document.getElementById('obCustomType').value = '';
  document.getElementById('obCustomTypeRow').style.display = 'none';
  document.getElementById('obEmoji').value = '';
  document.getElementById('obBalance').value = '';
  const nextColor = SWATCHES[onboardingAccounts.length % SWATCHES.length];
  document.getElementById('obColor').value = nextColor;
  buildSwatch('obColorSwatch', 'obColor', nextColor);

  renderObAccList();
  document.getElementById('obName').focus();
});

document.getElementById('obAccList').addEventListener('click', e => {
  const id = e.target.closest('[data-remove-ob]')?.dataset.removeOb;
  if (!id) return;
  onboardingAccounts = onboardingAccounts.filter(a => a.id !== id);
  renderObAccList();
});

document.getElementById('getStartedBtn').addEventListener('click', () => {
  if (!onboardingAccounts.length) return;
  state.accounts    = onboardingAccounts;
  state.transactions = [];
  state.goals       = [];
  saveState();
  hideOnboarding();
  renderAll();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  pendingDelete = { kind: '__reset__', id: null };
  document.getElementById('confirmMsg').textContent =
    'This will erase all your data and return to the account setup screen. Are you sure?';
  openModal('confirmModal');
});

/* =====================
   Accounts
   ===================== */
function renderAccounts() {
  const list = document.getElementById('accountList');
  list.innerHTML = '';
  if (!state.accounts.length) {
    list.innerHTML = '<li style="padding:0.5rem;color:var(--text-dim);font-size:0.8rem">No accounts yet</li>';
  }
  let total = 0;
  for (const acc of state.accounts) {
    const bal = computeBalance(acc);
    total += bal;
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `
      <div class="account-dot" style="background:${acc.color}22;color:${acc.color}">${acc.emoji || '🏦'}</div>
      <div class="account-info">
        <div class="account-name">${acc.name}</div>
        <div class="account-type">${acc.type === 'Custom' ? (acc.customType || 'Custom') : acc.type}</div>
      </div>
      <div class="account-bal mono">${fmt(bal)}</div>
      <div class="account-actions">
        <button title="Edit" data-edit-acc="${acc.id}">✏️</button>
        <button title="Delete" data-del-acc="${acc.id}">🗑️</button>
      </div>`;
    list.appendChild(li);
  }
  document.getElementById('netWorth').textContent = fmt(total);
  document.getElementById('statTotalBalance').textContent = fmt(total);
}

// Open add-account modal
document.getElementById('addAccountBtn').addEventListener('click', () => {
  document.getElementById('accountModalTitle').textContent = 'New Account';
  document.getElementById('accountId').value = '';
  document.getElementById('accountName').value = '';
  document.getElementById('accountType').value = 'Checking';
  document.getElementById('accountCustomType').value = '';
  document.getElementById('accountEmoji').value = '';
  document.getElementById('accountBalance').value = '';
  document.getElementById('accountColor').value = SWATCHES[0];
  document.getElementById('customTypeRow').style.display = 'none';
  document.getElementById('accountSubmitBtn').textContent = 'Create Account';
  buildSwatch('colorSwatch', 'accountColor', SWATCHES[0]);
  openModal('accountModal');
});

document.getElementById('accountType').addEventListener('change', function() {
  document.getElementById('customTypeRow').style.display = this.value === 'Custom' ? '' : 'none';
});

// Edit account
document.getElementById('accountList').addEventListener('click', e => {
  const editId = e.target.closest('[data-edit-acc]')?.dataset.editAcc;
  const delId  = e.target.closest('[data-del-acc]')?.dataset.delAcc;
  if (editId) openEditAccount(editId);
  if (delId)  confirmDelete('account', delId);
});

function openEditAccount(id) {
  const acc = accountById(id);
  if (!acc) return;
  document.getElementById('accountModalTitle').textContent = 'Edit Account';
  document.getElementById('accountId').value = acc.id;
  document.getElementById('accountName').value = acc.name;
  document.getElementById('accountType').value = acc.type;
  document.getElementById('accountCustomType').value = acc.customType || '';
  document.getElementById('accountEmoji').value = acc.emoji || '';
  document.getElementById('accountBalance').value = acc.balance;
  document.getElementById('accountColor').value = acc.color;
  document.getElementById('customTypeRow').style.display = acc.type === 'Custom' ? '' : 'none';
  document.getElementById('accountSubmitBtn').textContent = 'Save Changes';
  buildSwatch('colorSwatch', 'accountColor', acc.color);
  openModal('accountModal');
}

document.getElementById('accountForm').addEventListener('submit', e => {
  e.preventDefault();
  const id    = document.getElementById('accountId').value;
  const name  = document.getElementById('accountName').value.trim();
  const type  = document.getElementById('accountType').value;
  const emoji = document.getElementById('accountEmoji').value.trim() || '🏦';
  const color = document.getElementById('accountColor').value;
  const bal   = parseFloat(document.getElementById('accountBalance').value) || 0;
  const customType = document.getElementById('accountCustomType').value.trim();

  if (id) {
    const acc = accountById(id);
    Object.assign(acc, { name, type, emoji, color, balance: bal, customType });
    toast('Account updated');
  } else {
    state.accounts.push({ id: uid(), name, type, emoji, color, balance: bal, customType });
    toast('Account created');
  }
  saveState();
  closeModal('accountModal');
  renderAll();
});

/* =====================
   Confirm Delete
   ===================== */
let pendingDelete = null;

function confirmDelete(kind, id) {
  pendingDelete = { kind, id };
  const msgs = {
    account: 'Delete this account and all its transactions?',
    transaction: 'Delete this transaction?',
    goal: 'Delete this goal?',
  };
  document.getElementById('confirmMsg').textContent = msgs[kind] || 'Are you sure?';
  openModal('confirmModal');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (!pendingDelete) return;
  const { kind, id } = pendingDelete;
  if (kind === '__reset__') {
    localStorage.removeItem('financeApp');
    location.reload();
    return;
  }
  if (kind === 'account') {
    state.transactions = state.transactions.filter(t => t.account !== id && t.toAccount !== id);
    state.accounts = state.accounts.filter(a => a.id !== id);
    toast('Account deleted');
  } else if (kind === 'transaction') {
    state.transactions = state.transactions.filter(t => t.id !== id);
    toast('Transaction deleted');
  } else if (kind === 'goal') {
    state.goals = state.goals.filter(g => g.id !== id);
    toast('Goal deleted');
  }
  pendingDelete = null;
  saveState();
  closeModal('confirmModal');
  renderAll();
});

/* =====================
   Transactions
   ===================== */
let txFilter = 'all';
let txSearch = '';

function populateTxAccountSelects() {
  ['txAccount','txToAccount'].forEach(selId => {
    const sel = document.getElementById(selId);
    sel.innerHTML = '';
    state.accounts.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.emoji} ${a.name}`;
      sel.appendChild(opt);
    });
  });
}

function populateTxCategories(type) {
  const sel = document.getElementById('txCategory');
  sel.innerHTML = '';
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = `${CATEGORY_ICONS[c] || '📦'} ${c}`;
    sel.appendChild(opt);
  });
}

function openAddTxModal() {
  if (!state.accounts.length) { toast('Create an account first', 'error'); return; }
  populateTxAccountSelects();
  populateTxCategories('expense');
  document.getElementById('txDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('txDesc').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txToAccountRow').style.display = 'none';
  document.getElementById('txCategoryRow').style.display = '';
  // reset type tabs
  document.querySelectorAll('.type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'expense'));
  openModal('txModal');
}

document.getElementById('addTxBtn').addEventListener('click', openAddTxModal);
document.getElementById('addTxFromDash').addEventListener('click', openAddTxModal);

// Type tab switching
document.getElementById('txTypeTabs').addEventListener('click', e => {
  const tab = e.target.closest('.type-tab');
  if (!tab) return;
  const type = tab.dataset.type;
  document.querySelectorAll('.type-tab').forEach(t => t.classList.toggle('active', t === tab));
  document.getElementById('txToAccountRow').style.display  = type === 'transfer' ? '' : 'none';
  document.getElementById('txCategoryRow').style.display   = type === 'transfer' ? 'none' : '';
  if (type !== 'transfer') populateTxCategories(type);
});

document.getElementById('txForm').addEventListener('submit', e => {
  e.preventDefault();
  const type   = document.querySelector('.type-tab.active').dataset.type;
  const desc   = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date   = document.getElementById('txDate').value;
  const account= document.getElementById('txAccount').value;
  const cat    = type === 'transfer' ? 'Transfer' : document.getElementById('txCategory').value;
  const toAcc  = document.getElementById('txToAccount').value;

  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (type === 'transfer' && account === toAcc) { toast('Source and destination must differ', 'error'); return; }

  const tx = { id: uid(), type, desc, amount, date, account, category: cat };
  if (type === 'transfer') tx.toAccount = toAcc;

  state.transactions.push(tx);
  saveState();
  closeModal('txModal');
  renderAll();
  toast(`${type.charAt(0).toUpperCase()+type.slice(1)} added`);
});

// Filter tabs
document.getElementById('txFilterTabs').addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  txFilter = tab.dataset.filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t === tab));
  renderTransactions();
});

document.getElementById('txSearch').addEventListener('input', e => {
  txSearch = e.target.value.toLowerCase();
  renderTransactions();
});

function filteredTransactions() {
  return state.transactions
    .filter(t => txFilter === 'all' || t.type === txFilter)
    .filter(t => !txSearch || t.desc.toLowerCase().includes(txSearch) || (t.category||'').toLowerCase().includes(txSearch))
    .sort((a,b) => b.date.localeCompare(a.date));
}

function txItemHTML(tx) {
  const acc   = accountById(tx.account);
  const toAcc = tx.toAccount ? accountById(tx.toAccount) : null;
  const icon  = tx.type === 'transfer' ? '↔️' : (CATEGORY_ICONS[tx.category] || TYPE_ICONS[tx.type]);
  const sign  = tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '');
  const sub   = tx.type === 'transfer'
    ? `${acc?.name || '?'} → ${toAcc?.name || '?'}`
    : `${acc?.name || '?'} · ${tx.category}`;

  return `
    <li class="tx-item">
      <div class="tx-icon ${tx.type}">${icon}</div>
      <div class="tx-meta">
        <div class="tx-desc">${tx.desc}</div>
        <div class="tx-sub">${sub}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
        <div class="tx-date">${fmtDate(tx.date)}</div>
      </div>
      <button class="tx-delete" data-del-tx="${tx.id}" title="Delete">✕</button>
    </li>`;
}

function renderTransactions() {
  const list = document.getElementById('allTxList');
  const txs  = filteredTransactions();
  if (!txs.length) {
    list.innerHTML = '<li class="tx-empty">No transactions found</li>';
    return;
  }
  list.innerHTML = txs.map(txItemHTML).join('');
}

document.getElementById('allTxList').addEventListener('click', e => {
  const id = e.target.closest('[data-del-tx]')?.dataset.delTx;
  if (id) confirmDelete('transaction', id);
});

/* =====================
   Dashboard
   ===================== */
function renderDashboard() {
  const mk   = currentMonthKey();
  const now  = new Date();
  document.getElementById('dashboardMonth').textContent =
    now.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  // Monthly stats
  let income = 0, expenses = 0;
  for (const tx of state.transactions) {
    if (monthKey(tx.date) !== mk) continue;
    if (tx.type === 'income')  income   += tx.amount;
    if (tx.type === 'expense') expenses += tx.amount;
  }
  document.getElementById('statMonthlyIncome').textContent   = fmt(income);
  document.getElementById('statMonthlyExpenses').textContent = fmt(expenses);

  // Recent transactions
  const recent = [...state.transactions]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0,6);
  const recentEl = document.getElementById('recentTxList');
  recentEl.innerHTML = recent.length
    ? recent.map(txItemHTML).join('')
    : '<li class="tx-empty">No transactions yet</li>';

  recentEl.addEventListener('click', e => {
    const id = e.target.closest('[data-del-tx]')?.dataset.delTx;
    if (id) confirmDelete('transaction', id);
  }, { once: true });

  renderCategoryChart();
  renderBarChart();
}

/* =====================
   Charts
   ===================== */
let categoryChartInst = null;
let barChartInst = null;

function renderCategoryChart() {
  const mk = currentMonthKey();
  const totals = {};
  for (const tx of state.transactions) {
    if (tx.type !== 'expense') continue;
    if (monthKey(tx.date) !== mk) continue;
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }

  const labels  = Object.keys(totals);
  const data    = Object.values(totals);
  const colors  = labels.map((_, i) => SWATCHES[i % SWATCHES.length]);
  const total   = data.reduce((a,b) => a+b, 0);

  const legend = document.getElementById('categoryLegend');
  legend.innerHTML = labels.length
    ? labels.map((l,i) => `
        <li class="legend-item">
          <span class="legend-dot" style="background:${colors[i]}"></span>
          <span class="legend-name">${l}</span>
          <span class="legend-val mono">${fmt(data[i])}</span>
        </li>`).join('')
    : '<li style="color:var(--text-dim);font-size:0.8rem">No expenses this month</li>';

  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInst) categoryChartInst.destroy();

  if (!labels.length) {
    // draw placeholder
    categoryChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: { labels:['No data'], datasets:[{ data:[1], backgroundColor:['#2a3147'], borderWidth:0 }] },
      options: { cutout:'70%', plugins:{ legend:{ display:false }, tooltip:{ enabled:false } } }
    });
    return;
  }

  categoryChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#161b27', hoverOffset: 8 }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.raw)} (${total ? Math.round(ctx.raw/total*100) : 0}%)`
          }
        }
      }
    }
  });
}

function renderBarChart() {
  const keys   = getMonthKeys(6);
  const labels = keys.map(k => {
    const [y,m] = k.split('-');
    return new Date(+y, +m-1, 1).toLocaleDateString('en-US', { month:'short' });
  });
  const incomes   = keys.map(k => state.transactions.filter(t => t.type==='income'  && monthKey(t.date)===k).reduce((s,t)=>s+t.amount,0));
  const expenses  = keys.map(k => state.transactions.filter(t => t.type==='expense' && monthKey(t.date)===k).reduce((s,t)=>s+t.amount,0));

  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChartInst) barChartInst.destroy();

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Income',   data: incomes,  backgroundColor:'rgba(34,197,94,0.75)',  borderRadius:5 },
        { label:'Expenses', data: expenses, backgroundColor:'rgba(239,68,68,0.75)',  borderRadius:5 },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color:'#7c8db0', font:{ size:12 } } },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: { ticks:{ color:'#7c8db0' }, grid:{ color:'#2a3147' } },
        y: { ticks:{ color:'#7c8db0', callback: v => '$'+v.toLocaleString() }, grid:{ color:'#2a3147' } }
      }
    }
  });
}

/* =====================
   Goals
   ===================== */
function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  if (!state.goals.length) {
    grid.innerHTML = '<div style="color:var(--text-dim);padding:2rem;grid-column:1/-1">No goals yet — click + Add Goal</div>';
    return;
  }
  grid.innerHTML = state.goals.map(g => {
    const pct  = Math.min(100, g.target > 0 ? Math.round(g.current / g.target * 100) : 0);
    const done = pct >= 100;
    return `
      <div class="goal-card">
        <div class="goal-actions">
          <button title="Edit" data-edit-goal="${g.id}">✏️</button>
          <button title="Delete" data-del-goal="${g.id}">🗑️</button>
        </div>
        <div class="goal-header">
          <div class="goal-emoji">${g.emoji || '🎯'}</div>
          <div>
            <div class="goal-name">${g.name}</div>
          </div>
        </div>
        <div class="goal-amounts">
          <span class="goal-current">${fmt(g.current)}</span>
          <span class="goal-target">of ${fmt(g.target)}</span>
        </div>
        <div class="goal-bar-bg">
          <div class="goal-bar-fill" style="width:${pct}%;background:${g.color}"></div>
        </div>
        <div class="goal-pct">
          <span>${pct}% complete</span>
          ${done ? '<span class="goal-complete">🎉 Goal reached!</span>' : ''}
        </div>
      </div>`;
  }).join('');
}

document.getElementById('goalsGrid').addEventListener('click', e => {
  const editId = e.target.closest('[data-edit-goal]')?.dataset.editGoal;
  const delId  = e.target.closest('[data-del-goal]')?.dataset.delGoal;
  if (editId) openEditGoal(editId);
  if (delId)  confirmDelete('goal', delId);
});

document.getElementById('addGoalBtn').addEventListener('click', () => {
  document.getElementById('goalModalTitle').textContent = 'New Goal';
  document.getElementById('goalId').value = '';
  document.getElementById('goalName').value = '';
  document.getElementById('goalEmoji').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalCurrent').value = '';
  document.getElementById('goalColor').value = SWATCHES[4];
  document.getElementById('goalSubmitBtn').textContent = 'Create Goal';
  buildSwatch('goalColorSwatch', 'goalColor', SWATCHES[4]);
  openModal('goalModal');
});

function openEditGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('goalId').value = g.id;
  document.getElementById('goalName').value = g.name;
  document.getElementById('goalEmoji').value = g.emoji || '';
  document.getElementById('goalTarget').value = g.target;
  document.getElementById('goalCurrent').value = g.current;
  document.getElementById('goalColor').value = g.color;
  document.getElementById('goalSubmitBtn').textContent = 'Save Changes';
  buildSwatch('goalColorSwatch', 'goalColor', g.color);
  openModal('goalModal');
}

document.getElementById('goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const id      = document.getElementById('goalId').value;
  const name    = document.getElementById('goalName').value.trim();
  const emoji   = document.getElementById('goalEmoji').value.trim() || '🎯';
  const target  = parseFloat(document.getElementById('goalTarget').value) || 0;
  const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
  const color   = document.getElementById('goalColor').value;

  if (id) {
    const g = state.goals.find(x => x.id === id);
    Object.assign(g, { name, emoji, target, current, color });
    toast('Goal updated');
  } else {
    state.goals.push({ id: uid(), name, emoji, target, current, color });
    toast('Goal created');
  }
  saveState();
  closeModal('goalModal');
  renderGoals();
});

/* =====================
   Render All
   ===================== */
function renderAll() {
  renderAccounts();
  renderDashboard();
  if (currentView === 'transactions') renderTransactions();
  if (currentView === 'goals') renderGoals();
}

/* =====================
   Boot
   ===================== */
if (loadState()) {
  renderAll();
} else {
  showOnboarding();
}
