'use strict';

const STORAGE_KEY = 'todo.tasks.v1';
const FILTER_KEY = 'todo.filter';

const $ = (id) => document.getElementById(id);

let tasks = load();
let filter = readPref(FILTER_KEY) || 'active';
let undoState = null;
let toastTimer = null;
let editingId = null;

// ---------- Stockage ----------

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast('Impossible d\'enregistrer sur cet appareil');
  }
}

function readPref(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* préférence non essentielle */ }
}

// ---------- Dates ----------

function todayISO() {
  return localISO(new Date());
}

function formatDue(iso) {
  const today = todayISO();
  if (iso === today) return 'Aujourd\'hui';
  const tomorrow = new Date(today + 'T00:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === localISO(tomorrow)) return 'Demain';
  const date = new Date(iso + 'T00:00:00');
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('fr-FR', opts);
}

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------- Modèle ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addTask(title, due, prio) {
  tasks.push({ id: uid(), title, notes: '', due: due || '', prio: !!prio, done: false, createdAt: Date.now(), doneAt: null });
  save();
  render();
}

function updateTask(id, changes) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, changes);
  save();
  render();
}

function toggleTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  updateTask(id, { done: !t.done, doneAt: t.done ? null : Date.now() });
  if (navigator.vibrate) navigator.vibrate(10);
}

function deleteTasks(ids, message) {
  const snapshot = tasks.slice();
  tasks = tasks.filter((t) => !ids.includes(t.id));
  save();
  render();
  undoState = snapshot;
  showToast(message, true);
}

function sortTasks(list) {
  const today = todayISO();
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt || 0) - (a.doneAt || 0);
    const aLate = a.due && a.due <= today;
    const bLate = b.due && b.due <= today;
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (a.prio !== b.prio) return a.prio ? -1 : 1;
    if (a.due !== b.due) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    }
    return a.createdAt - b.createdAt;
  });
}

function visibleTasks() {
  const today = todayISO();
  switch (filter) {
    case 'done': return tasks.filter((t) => t.done);
    case 'today': return tasks.filter((t) => !t.done && (t.due && t.due <= today || t.prio));
    case 'all': return tasks;
    default: return tasks.filter((t) => !t.done);
  }
}

// ---------- Rendu ----------

const EMPTY_TEXT = {
  active: 'Rien à faire. Profitez-en !',
  today: 'Rien d\'urgent ni de prioritaire pour aujourd\'hui.',
  done: 'Aucune tâche terminée pour l\'instant.',
  all: 'Ajoutez votre première tâche ci-dessous.',
};

function render() {
  const list = $('list');
  const items = sortTasks(visibleTasks());
  const today = todayISO();
  list.replaceChildren(...items.map((t) => renderItem(t, today)));

  $('empty').hidden = items.length > 0;
  $('empty-text').textContent = EMPTY_TEXT[filter];

  const remaining = tasks.filter((t) => !t.done).length;
  const late = tasks.filter((t) => !t.done && t.due && t.due < today).length;
  let summary = remaining === 0 ? 'Tout est fait' : `${remaining} tâche${remaining > 1 ? 's' : ''} à faire`;
  if (late) summary += ` · ${late} en retard`;
  $('summary').textContent = summary;

  document.querySelectorAll('.filters button').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.filter === filter));
  });
}

function renderItem(t, today) {
  const li = document.createElement('li');
  li.className = 'item' + (t.done ? ' done' : '') + (t.prio ? ' prio' : '');
  li.dataset.id = t.id;

  const label = document.createElement('div');
  label.className = 'swipe-label';
  label.textContent = 'Supprimer';

  const inner = document.createElement('div');
  inner.className = 'item-inner';

  const check = document.createElement('button');
  check.className = 'check';
  check.setAttribute('aria-label', t.done ? 'Marquer comme à faire' : 'Marquer comme terminée');
  check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
  check.addEventListener('click', () => toggleTask(t.id));

  const body = document.createElement('div');
  body.className = 'body';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = t.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  if (t.prio && !t.done) meta.append(tag('Prioritaire', 'prio'));
  if (t.due) {
    const cls = t.done ? '' : t.due < today ? 'late' : t.due === today ? 'today' : '';
    meta.append(tag((t.due < today && !t.done ? 'En retard · ' : '') + formatDue(t.due), cls));
  }
  if (t.notes) meta.append(tag(t.notes.split('\n')[0], 'notes-hint'));
  body.append(title, meta);
  body.addEventListener('click', () => openEditor(t.id));

  inner.append(check, body);
  li.append(label, inner);
  enableSwipe(li, inner, t.id);
  return li;
}

function tag(text, cls) {
  const span = document.createElement('span');
  span.className = 'tag' + (cls ? ' ' + cls : '');
  span.textContent = text;
  return span;
}

// ---------- Glisser pour supprimer ----------

function enableSwipe(li, inner, id) {
  let startX = 0, startY = 0, dx = 0, tracking = false, locked = false;

  inner.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    startX = p.clientX; startY = p.clientY; dx = 0;
    tracking = true; locked = false;
  }, { passive: true });

  inner.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const p = e.touches[0];
    const mx = p.clientX - startX, my = p.clientY - startY;
    if (!locked) {
      if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8) { tracking = false; return; }
      if (Math.abs(mx) > 8) { locked = true; li.classList.add('dragging'); }
    }
    if (locked) {
      dx = Math.min(0, mx);
      inner.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: true });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    li.classList.remove('dragging');
    if (dx < -li.offsetWidth * 0.35) {
      li.classList.add('removing');
      inner.style.transform = 'translateX(-100%)';
      setTimeout(() => deleteTasks([id], 'Tâche supprimée'), 180);
    } else {
      inner.style.transform = '';
    }
  };
  inner.addEventListener('touchend', end);
  inner.addEventListener('touchcancel', end);
}

// ---------- Édition ----------

function openEditor(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  $('edit-title').value = t.title;
  $('edit-notes').value = t.notes || '';
  $('edit-due').value = t.due || '';
  $('edit-prio').checked = !!t.prio;
  $('edit-dialog').showModal();
}

$('edit-form').addEventListener('submit', () => {
  const title = $('edit-title').value.trim();
  if (editingId && title) {
    updateTask(editingId, {
      title,
      notes: $('edit-notes').value.trim(),
      due: $('edit-due').value,
      prio: $('edit-prio').checked,
    });
  }
  editingId = null;
});

$('edit-cancel').addEventListener('click', () => $('edit-dialog').close());

$('edit-delete').addEventListener('click', () => {
  const id = editingId;
  $('edit-dialog').close();
  editingId = null;
  if (id) deleteTasks([id], 'Tâche supprimée');
});

// ---------- Ajout ----------

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('new-title');
  const title = input.value.trim();
  if (!title) return;
  addTask(title, $('new-due').value, $('new-prio').checked);
  input.value = '';
  $('new-due').value = '';
  $('new-prio').checked = false;
  if (filter === 'done') setFilter('active');
  input.focus();
});

$('extra-btn').addEventListener('click', () => {
  const extra = $('composer-extra');
  extra.hidden = !extra.hidden;
  $('extra-btn').setAttribute('aria-expanded', String(!extra.hidden));
});

// ---------- Filtres ----------

function setFilter(f) {
  filter = f;
  writePref(FILTER_KEY, f);
  render();
}

document.querySelectorAll('.filters button').forEach((b) => {
  b.addEventListener('click', () => setFilter(b.dataset.filter));
});

// ---------- Menu ----------

function toggleMenu(open) {
  $('menu').hidden = !open;
  $('menu-btn').setAttribute('aria-expanded', String(open));
}

$('menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu($('menu').hidden);
});

document.addEventListener('click', (e) => {
  if (!$('menu').hidden && !$('menu').contains(e.target)) toggleMenu(false);
});

$('menu').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  toggleMenu(false);
  if (action === 'clear-done') {
    const ids = tasks.filter((t) => t.done).map((t) => t.id);
    if (ids.length === 0) return showToast('Aucune tâche terminée');
    deleteTasks(ids, `${ids.length} tâche${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}`);
  } else if (action === 'export') {
    exportBackup();
  } else if (action === 'import') {
    $('import-file').click();
  }
});

function exportBackup() {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `taches-${todayISO()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.tasks;
    if (!Array.isArray(incoming)) throw new Error('format');
    const valid = incoming.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string');
    const known = new Set(tasks.map((t) => t.id));
    const added = valid.filter((t) => !known.has(t.id));
    undoState = tasks.slice();
    tasks = tasks.concat(added);
    save();
    render();
    showToast(`${added.length} tâche${added.length > 1 ? 's' : ''} importée${added.length > 1 ? 's' : ''}`, added.length > 0);
  } catch {
    showToast('Fichier de sauvegarde invalide');
  }
});

// ---------- Toast / annulation ----------

function showToast(text, undoable = false) {
  $('toast-text').textContent = text;
  $('toast-undo').hidden = !undoable;
  if (!undoable) undoState = null;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; undoState = null; }, 4000);
}

$('toast-undo').addEventListener('click', () => {
  if (undoState) {
    tasks = undoState;
    undoState = null;
    save();
    render();
  }
  $('toast').hidden = true;
});

// ---------- Démarrage ----------

// Synchronise si l'app est ouverte dans plusieurs onglets.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { tasks = load(); render(); }
});

// Recalcule « aujourd'hui / en retard » quand on revient sur l'app.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
  });
}

render();
