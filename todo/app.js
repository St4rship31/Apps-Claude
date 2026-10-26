'use strict';

const STORAGE_KEY = 'todo.state.v2';
const LEGACY_KEY = 'todo.tasks.v1';
const EMOJIS = ['📋', '🏠', '💼', '🛒', '🎯', '📚', '💡', '❤️', '✈️', '💪', '🎉', '💰'];
const REPEAT_LABEL = {
  daily: 'Tous les jours',
  weekdays: 'En semaine',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
};
const SORT_LABEL = { manual: 'Mon ordre', date: 'Date', starred: 'Suivies' };

const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  subtasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v10a3 3 0 0 0 3 3h11M15 13l4 4-4 4"/></svg>',
  handle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  addCircle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
};

const $ = (id) => document.getElementById(id);

let state = load();
let undoSnapshot = null;
let toastTimer = null;
let editingId = null;
let searchQuery = '';
let listDialogMode = null;
let pickedEmoji = EMOJIS[0];

// ---------- Stockage ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newList(name, emoji) {
  return { id: uid(), name, emoji: emoji || EMOJIS[0], sort: 'manual', createdAt: Date.now() };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.lists) && data.lists.length && Array.isArray(data.tasks)) {
      data.showDone = data.showDone || {};
      data.history = data.history || buildHistory(data.tasks);
      return data;
    }
  } catch { /* données illisibles : on repart de zéro */ }

  const list = newList('Mes tâches', '📋');
  const fresh = { lists: [list], tasks: [], view: list.id, showDone: {} };
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (Array.isArray(legacy)) fresh.tasks = legacy.map((t, i) => fromLegacy(t, list.id, i));
  } catch { /* pas d'anciennes données */ }
  fresh.history = buildHistory(fresh.tasks);
  return fresh;
}

// Nombre de tâches terminées par jour, reconstruit à partir des tâches existantes.
function buildHistory(tasks) {
  const history = {};
  tasks.forEach((t) => {
    if (t.done && t.doneAt) {
      const day = localISO(new Date(t.doneAt));
      history[day] = (history[day] || 0) + 1;
    }
  });
  return history;
}

// Convertit une tâche de la première version de l'app.
function fromLegacy(t, listId, index) {
  return {
    id: String(t.id || uid()),
    listId,
    parentId: null,
    title: String(t.title || ''),
    notes: t.notes || '',
    due: t.due || '',
    time: '',
    starred: !!(t.starred || t.prio),
    repeat: '',
    done: !!t.done,
    doneAt: t.doneAt || null,
    createdAt: t.createdAt || Date.now(),
    order: index,
  };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast('Impossible d\'enregistrer sur cet appareil');
  }
}

function snapshot() {
  undoSnapshot = JSON.parse(JSON.stringify(state));
}

// ---------- Dates ----------

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return localISO(new Date());
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localISO(d);
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function dayLabel(iso) {
  const today = todayISO();
  if (iso === today) return 'Aujourd\'hui';
  if (iso === addDays(today, 1)) return 'Demain';
  if (iso === addDays(today, -1)) return 'Hier';
  const date = new Date(iso + 'T00:00:00');
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('fr-FR', opts);
}

function isLate(t) {
  if (!t.due || t.done) return false;
  const today = todayISO();
  return t.due < today || (t.due === today && !!t.time && t.time < nowTime());
}

function dueKey(t) {
  return t.due ? t.due + 'T' + (t.time || '99:99') : '9999';
}

function nextOccurrence(iso, repeat) {
  const d = new Date(iso + 'T00:00:00');
  switch (repeat) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekdays':
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
      break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      break;
    }
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return localISO(d);
}

// ---------- Saisie en langage naturel ----------
// « Appeler Paul demain 18h » → titre « Appeler Paul », date de demain, 18:00.

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function parseQuick(text) {
  let rest = ' ' + text + ' ';
  let due = '';
  let time = '';
  const today = todayISO();
  const take = (re) => {
    const m = rest.match(re);
    if (m) rest = rest.replace(re, ' ');
    return m;
  };

  if (take(/\s(après[- ]demain|apres[- ]demain)(?=\s)/i)) due = addDays(today, 2);
  else if (take(/\s(aujourd'hui|aujourd’hui|aujourdhui|ce soir)(?=\s)/i)) due = today;
  else if (take(/\sdemain(?=\s)/i)) due = addDays(today, 1);
  else {
    const m = take(new RegExp('\\s(' + WEEKDAYS.join('|') + ')(\\s+prochain)?(?=\\s)', 'i'));
    if (m) {
      const target = WEEKDAYS.indexOf(m[1].toLowerCase());
      let diff = (target - new Date().getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      due = addDays(today, diff);
    }
  }

  const tm = take(/\s(?:à\s*)?([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?(?=\s)/i);
  if (tm) {
    time = tm[1].padStart(2, '0') + ':' + (tm[2] || '00');
    if (!due) due = time > nowTime() ? today : addDays(today, 1);
  }

  const title = rest.replace(/\s+à\s*$/i, ' ').replace(/\s+/g, ' ').trim();
  if (!title || (!due && !time)) return { title: text.trim(), due: '', time: '' };
  return { title, due, time };
}

// ---------- Modèle ----------

const getList = (id) => state.lists.find((l) => l.id === id);
const getTask = (id) => state.tasks.find((t) => t.id === id);
const childrenOf = (id) => state.tasks.filter((t) => t.parentId === id).sort((a, b) => a.order - b.order);
const currentList = () => getList(state.view);

const SMART_VIEWS = ['myday', 'starred'];
const inMyDay = (t) => t.myDay === todayISO();

function ensureView() {
  if (!SMART_VIEWS.includes(state.view) && !getList(state.view)) state.view = state.lists[0].id;
}

function setMyDay(id, on) {
  updateTask(id, { myDay: on ? todayISO() : '' }, false);
}

function addTask({ title, listId, parentId = null, due = '', time = '', starred = false, myDay = '', atTop = true }) {
  const siblings = state.tasks.filter((t) => t.listId === listId && t.parentId === parentId);
  const orders = siblings.map((t) => t.order);
  const order = siblings.length === 0 ? 0 : atTop ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
  const task = {
    id: uid(), listId, parentId, title, notes: '', due, time, starred, myDay, repeat: '',
    done: false, doneAt: null, createdAt: Date.now(), order,
  };
  state.tasks.push(task);
  save();
  return task;
}

function updateTask(id, changes, rerender = true) {
  const t = getTask(id);
  if (!t) return;
  Object.assign(t, changes);
  save();
  if (rerender) render();
}

function setDone(t, done) {
  if (t.done === done) return;
  if (done) {
    t.done = true;
    t.doneAt = Date.now();
    const day = todayISO();
    state.history[day] = (state.history[day] || 0) + 1;
  } else {
    if (t.doneAt) {
      const day = localISO(new Date(t.doneAt));
      if (state.history[day]) state.history[day]--;
    }
    t.done = false;
    t.doneAt = null;
  }
}

function toggleDone(id) {
  const t = getTask(id);
  if (!t) return;
  snapshot();
  if (t.done) {
    setDone(t, false);
    save();
    render();
    return;
  }
  setDone(t, true);
  let message = 'Tâche terminée';
  if (t.repeat && !t.parentId) {
    const base = t.due || todayISO();
    let next = nextOccurrence(base, t.repeat);
    while (next < todayISO()) next = nextOccurrence(next, t.repeat);
    const copy = { ...t, id: uid(), due: next, myDay: '', done: false, doneAt: null, createdAt: Date.now() };
    state.tasks.push(copy);
    childrenOf(t.id).forEach((s) => {
      state.tasks.push({ ...s, id: uid(), parentId: copy.id, done: false, doneAt: null });
    });
    message = 'Terminée · prochaine : ' + dayLabel(next).toLowerCase();
  }
  save();
  render();
  showToast(message, true);
  if (navigator.vibrate) navigator.vibrate(10);
}

function deleteTask(id) {
  const t = getTask(id);
  if (!t) return;
  snapshot();
  const ids = new Set([id, ...childrenOf(id).map((s) => s.id)]);
  state.tasks = state.tasks.filter((x) => !ids.has(x.id));
  save();
  render();
  showToast('Tâche supprimée', true);
}

// ---------- Rendu ----------

function render() {
  ensureView();
  renderTabs();
  $('progress').hidden = true;
  if (searchQuery) renderSearch();
  else if (state.view === 'myday') renderMyDay();
  else if (state.view === 'starred') renderStarred();
  else renderList(currentList());
}

function activeCount(listId) {
  return state.tasks.filter((t) => t.listId === listId && !t.parentId && !t.done).length;
}

function renderTabs() {
  const tabs = $('tabs');
  const starredCount = state.tasks.filter((t) => t.starred && !t.done).length;
  const myDayCount = state.tasks.filter((t) => inMyDay(t) && !t.done).length;
  const items = [
    tabButton('myday', ICON.sun, 'Ma journée', myDayCount),
    tabButton('starred', ICON.star, 'Suivies', starredCount),
  ];
  state.lists.forEach((l) => items.push(tabButton(l.id, l.emoji, l.name, activeCount(l.id))));

  const add = document.createElement('button');
  add.className = 'tab new-list';
  add.innerHTML = ICON.plus + '<span>Nouvelle liste</span>';
  add.addEventListener('click', () => openListDialog('create'));
  items.push(add);

  tabs.replaceChildren(...items);
  const selected = tabs.querySelector('[aria-selected="true"]');
  if (selected) selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function tabButton(id, icon, name, count) {
  const b = document.createElement('button');
  b.className = 'tab';
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(!searchQuery && state.view === id));
  if (icon.startsWith('<')) {
    b.innerHTML = icon;
  } else {
    const em = document.createElement('span');
    em.setAttribute('aria-hidden', 'true');
    em.textContent = icon;
    b.append(em);
  }
  const label = document.createElement('span');
  label.textContent = name;
  b.append(label);
  if (count) {
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = count;
    b.append(c);
  }
  b.addEventListener('click', () => {
    if (searchQuery) closeSearch();
    state.view = id;
    save();
    render();
    window.scrollTo({ top: 0 });
  });
  return b;
}

function setHeader(title, sub, showActions) {
  $('list-title').textContent = title;
  $('list-sub').textContent = sub;
  $('list-actions').hidden = !showActions;
}

function renderList(list) {
  const top = state.tasks.filter((t) => t.listId === list.id && !t.parentId);
  const active = top.filter((t) => !t.done);
  const done = top.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const late = active.filter(isLate).length;

  let sub = active.length === 0 ? '' : `${active.length} tâche${active.length > 1 ? 's' : ''}`;
  if (late) sub += ` · ${late} en retard`;
  setHeader(`${list.emoji} ${list.name}`, sub, true);
  $('sort-label').textContent = SORT_LABEL[list.sort];

  const content = $('content');
  if (list.sort === 'date') {
    content.replaceChildren(...dateGroups(active));
  } else {
    const sorted = active.slice().sort((a, b) => {
      if (list.sort === 'starred' && a.starred !== b.starred) return a.starred ? -1 : 1;
      return a.order - b.order;
    });
    const ul = document.createElement('ul');
    ul.className = 'list';
    ul.append(...sorted.map((t) => renderGroup(t, { draggable: list.sort === 'manual' })));
    content.replaceChildren(ul);
  }

  $('empty').hidden = active.length > 0;
  $('empty-text').textContent = done.length ? 'Tout est fait, bravo !' : 'Aucune tâche pour l\'instant. Ajoutez-en une ci-dessous.';

  $('done-section').hidden = done.length === 0;
  const open = !!state.showDone[list.id];
  $('done-label').textContent = `Terminées (${done.length})`;
  $('done-toggle').setAttribute('aria-expanded', String(open));
  $('done-list').hidden = !open;
  $('done-list').replaceChildren(...(open ? done.map((t) => renderGroup(t, { hideSubs: true })) : []));
}

function dateGroups(active) {
  const today = todayISO();
  const buckets = new Map();
  const sorted = active.slice().sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.order - b.order);
  sorted.forEach((t) => {
    let key, label;
    if (!t.due) { key = 'none'; label = 'Sans date'; }
    else if (t.due < today) { key = 'late'; label = 'En retard'; }
    else { key = t.due; label = dayLabel(t.due); }
    if (!buckets.has(key)) buckets.set(key, { label, tasks: [] });
    buckets.get(key).tasks.push(t);
  });
  const nodes = [];
  buckets.forEach(({ label, tasks }, key) => {
    const h = document.createElement('div');
    h.className = 'group-label' + (key === 'late' ? ' late' : '');
    h.textContent = label;
    const ul = document.createElement('ul');
    ul.className = 'list';
    ul.append(...tasks.map((t) => renderGroup(t, {})));
    nodes.push(h, ul);
  });
  return nodes;
}

function renderMyDay() {
  const today = todayISO();
  const mine = state.tasks.filter((t) => inMyDay(t) && getList(t.listId));
  const active = mine.filter((t) => !t.done).sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.createdAt - b.createdAt);
  const done = mine.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const total = active.length + done.length;
  setHeader('☀️ Ma journée', dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1) + (total ? ` · ${done.length}/${total} terminée${done.length > 1 ? 's' : ''}` : ''), false);
  $('progress').hidden = total === 0;
  $('progress-fill').style.width = total ? (done.length / total * 100) + '%' : '0';

  const nodes = [];
  if (active.length) {
    const ul = document.createElement('ul');
    ul.className = 'list';
    ul.append(...active.map((t) => wrapLi(renderRow(t, { showList: true, inMyDayView: true }))));
    nodes.push(ul);
  }

  // Suggestions : en retard, prévues aujourd'hui, puis suivies.
  const suggestions = state.tasks
    .filter((t) => !t.done && !inMyDay(t) && getList(t.listId) && ((t.due && t.due <= today) || t.starred))
    .sort((a, b) => (b.due && b.due <= today) - (a.due && a.due <= today) || dueKey(a).localeCompare(dueKey(b)))
    .slice(0, 8);
  if (suggestions.length) {
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Suggestions';
    const hint = document.createElement('p');
    hint.className = 'section-hint';
    hint.textContent = 'Tâches en retard, prévues aujourd\'hui ou suivies. Touchez + pour les ajouter.';
    const ul = document.createElement('ul');
    ul.className = 'list';
    ul.append(...suggestions.map((t) => wrapLi(renderRow(t, { showList: true, suggest: true }))));
    nodes.push(label, hint, ul);
  }
  $('content').replaceChildren(...nodes);

  $('empty').hidden = active.length > 0;
  $('empty-text').textContent = done.length
    ? 'Journée bouclée, bravo !'
    : 'Choisissez ce que vous voulez faire aujourd\'hui : ajoutez une tâche ci-dessous' + (suggestions.length ? ' ou piochez dans les suggestions.' : '.');

  $('done-section').hidden = done.length === 0;
  const open = !!state.showDone.myday;
  $('done-label').textContent = `Terminées aujourd'hui (${done.length})`;
  $('done-toggle').setAttribute('aria-expanded', String(open));
  $('done-list').hidden = !open;
  $('done-list').replaceChildren(...(open ? done.map((t) => wrapLi(renderRow(t, { showList: true }))) : []));
}

function renderStarred() {
  const items = state.tasks
    .filter((t) => t.starred && !t.done && getList(t.listId))
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.createdAt - b.createdAt);
  setHeader('Tâches suivies', items.length ? `${items.length} tâche${items.length > 1 ? 's' : ''}, toutes listes confondues` : '', false);
  const ul = document.createElement('ul');
  ul.className = 'list';
  ul.append(...items.map((t) => wrapLi(renderRow(t, { showList: true }))));
  $('content').replaceChildren(ul);
  $('empty').hidden = items.length > 0;
  $('empty-text').textContent = 'Touchez l\'étoile d\'une tâche pour la retrouver ici.';
  $('done-section').hidden = true;
}

function renderSearch() {
  const q = normalize(searchQuery);
  const items = state.tasks
    .filter((t) => getList(t.listId) && (normalize(t.title).includes(q) || normalize(t.notes).includes(q)))
    .sort((a, b) => (a.done - b.done) || dueKey(a).localeCompare(dueKey(b)));
  setHeader(`Recherche « ${searchQuery} »`, `${items.length} résultat${items.length > 1 ? 's' : ''}`, false);
  const ul = document.createElement('ul');
  ul.className = 'list';
  ul.append(...items.map((t) => wrapLi(renderRow(t, { showList: true, highlight: searchQuery }))));
  $('content').replaceChildren(ul);
  $('empty').hidden = items.length > 0;
  $('empty-text').textContent = 'Aucune tâche ne correspond.';
  $('done-section').hidden = true;
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function wrapLi(row) {
  const li = document.createElement('li');
  li.className = 'group';
  li.append(row);
  return li;
}

// Une tâche principale et ses sous-tâches.
function renderGroup(t, { draggable = false, hideSubs = false }) {
  const li = wrapLi(renderRow(t, { draggable, subsHidden: hideSubs }));
  li.dataset.id = t.id;
  const subs = hideSubs ? [] : childrenOf(t.id);
  if (subs.length) {
    const ul = document.createElement('ul');
    ul.className = 'subs';
    ul.append(...subs.map((s) => {
      const sli = document.createElement('li');
      sli.append(renderRow(s, {}));
      return sli;
    }));
    li.append(ul);
  }
  return li;
}

function renderRow(t, { draggable = false, showList = false, highlight = '', subsHidden = false, suggest = false, inMyDayView = false }) {
  const row = document.createElement('div');
  row.className = 'item' + (t.done ? ' done' : '');

  const label = document.createElement('div');
  label.className = 'swipe-label';
  label.textContent = inMyDayView ? 'Retirer de Ma journée' : 'Supprimer';

  const inner = document.createElement('div');
  inner.className = 'item-inner';

  if (draggable) {
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.innerHTML = ICON.handle;
    handle.addEventListener('pointerdown', (e) => startDrag(e, handle, t.id));
    inner.append(handle);
  }

  const check = document.createElement('button');
  check.className = 'check';
  check.setAttribute('aria-label', t.done ? 'Marquer comme non terminée' : 'Marquer comme terminée');
  check.innerHTML = ICON.check;
  check.addEventListener('click', () => toggleDone(t.id));

  const body = document.createElement('div');
  body.className = 'body';
  const title = document.createElement('div');
  title.className = 'title';
  setText(title, t.title, highlight);
  body.append(title);

  if (t.notes) {
    const notes = document.createElement('div');
    notes.className = 'notes';
    setText(notes, t.notes, highlight);
    body.append(notes);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  if (showList) {
    const list = getList(t.listId);
    const parent = t.parentId ? getTask(t.parentId) : null;
    meta.append(tag(`${list.emoji} ${list.name}${parent ? ' › ' + parent.title : ''}`, 'list-tag'));
  }
  if (t.due) {
    const cls = t.done ? '' : isLate(t) ? 'late' : t.due === todayISO() ? 'today' : '';
    meta.append(tag(dayLabel(t.due) + (t.time ? ', ' + t.time : ''), cls, ICON.calendar));
  }
  if (t.repeat) meta.append(tag(REPEAT_LABEL[t.repeat], '', ICON.repeat));
  if (inMyDay(t) && !t.done && !inMyDayView && state.view !== 'myday') meta.append(tag('Ma journée', 'myday', ICON.sun));
  if (!t.parentId && (subsHidden || showList)) {
    const subs = childrenOf(t.id);
    if (subs.length) meta.append(tag(`${subs.filter((s) => s.done).length}/${subs.length}`, '', ICON.subtasks));
  }
  body.append(meta);
  body.addEventListener('click', () => openTask(t.id));

  const star = document.createElement('button');
  star.className = 'icon-btn star-btn';
  star.setAttribute('aria-label', t.starred ? 'Ne plus suivre' : 'Suivre');
  star.setAttribute('aria-pressed', String(!!t.starred));
  star.innerHTML = ICON.star;
  star.addEventListener('click', () => updateTask(t.id, { starred: !t.starred }));

  if (suggest) {
    const add = document.createElement('button');
    add.className = 'icon-btn add-myday';
    add.setAttribute('aria-label', 'Ajouter à Ma journée');
    add.innerHTML = ICON.addCircle;
    add.addEventListener('click', () => { setMyDay(t.id, true); render(); });
    inner.append(check, body, add);
  } else {
    inner.append(check, body, star);
  }
  row.append(label, inner);
  enableSwipe(row, inner, t.id, inMyDayView);
  return row;
}

function setText(el, text, highlight) {
  if (!highlight) { el.textContent = text; return; }
  const idx = normalize(text).indexOf(normalize(highlight));
  if (idx < 0) { el.textContent = text; return; }
  const mark = document.createElement('mark');
  mark.textContent = text.slice(idx, idx + highlight.length);
  el.replaceChildren(text.slice(0, idx), mark, text.slice(idx + highlight.length));
}

function tag(text, cls, icon) {
  const span = document.createElement('span');
  span.className = 'tag' + (cls ? ' ' + cls : '');
  if (icon) span.innerHTML = icon;
  span.append(text);
  return span;
}

// ---------- Glisser pour supprimer ----------

function enableSwipe(row, inner, id, removeFromMyDay = false) {
  let startX = 0, startY = 0, dx = 0, tracking = false, locked = false;

  inner.addEventListener('touchstart', (e) => {
    if (e.target.closest('.handle')) return;
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
      if (Math.abs(mx) > 10) { locked = true; row.classList.add('swiping'); }
    }
    if (locked) {
      dx = Math.min(0, mx);
      inner.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: true });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (dx < -row.offsetWidth * 0.35) {
      row.classList.add('removing');
      inner.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        if (!removeFromMyDay) return deleteTask(id);
        snapshot();
        setMyDay(id, false);
        render();
        showToast('Retirée de Ma journée', true);
      }, 180);
    } else {
      row.classList.remove('swiping');
      inner.style.transform = '';
    }
  };
  inner.addEventListener('touchend', end);
  inner.addEventListener('touchcancel', end);
}

// ---------- Réorganiser par glisser-déposer ----------

function startDrag(e, handle, id) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  const li = handle.closest('.group');
  const ul = li.parentElement;
  const others = [...ul.children].filter((x) => x.classList.contains('group') && x !== li);
  const rect = li.getBoundingClientRect();
  const offsetY = e.clientY - rect.top;

  const ghost = li.cloneNode(true);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { width: rect.width + 'px', left: rect.left + 'px', top: rect.top + 'px' });
  document.body.append(ghost);
  li.classList.add('drag-source');

  const line = document.createElement('li');
  line.className = 'drop-line';
  let target = others.indexOf(li.nextElementSibling);
  if (target < 0) target = others.length;
  handle.setPointerCapture(e.pointerId);
  if (navigator.vibrate) navigator.vibrate(15);

  const move = (ev) => {
    ghost.style.top = (ev.clientY - offsetY) + 'px';
    if (ev.clientY < 140) window.scrollBy(0, -8);
    else if (ev.clientY > window.innerHeight - 140) window.scrollBy(0, 8);
    target = others.findIndex((o) => {
      const r = o.getBoundingClientRect();
      return ev.clientY < r.top + r.height / 2;
    });
    if (target < 0) target = others.length;
    if (target < others.length) ul.insertBefore(line, others[target]);
    else ul.append(line);
  };

  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    ghost.remove();
    line.remove();
    const ids = others.map((o) => o.dataset.id);
    ids.splice(target, 0, id);
    ids.forEach((tid, i) => { const t = getTask(tid); if (t) t.order = i; });
    save();
    render();
  };

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

// ---------- Détail d'une tâche ----------

function openTask(id) {
  const t = getTask(id);
  if (!t) return;
  editingId = id;
  fillTaskDialog(t);
  $('task-dialog').showModal();
  $('task-title').blur();
}

function fillTaskDialog(t) {
  const select = $('task-list');
  select.replaceChildren(...state.lists.map((l) => new Option(`${l.emoji} ${l.name}`, l.id)));
  select.value = t.listId;
  select.disabled = !!t.parentId;
  $('task-title').value = t.title;
  $('task-notes').value = t.notes || '';
  $('task-due').value = t.due || '';
  $('task-time').value = t.time || '';
  $('task-time').disabled = !t.due;
  $('task-repeat').value = t.repeat || '';
  $('task-repeat').closest('.field').hidden = !!t.parentId;
  $('task-star').setAttribute('aria-pressed', String(!!t.starred));
  $('task-myday').setAttribute('aria-pressed', String(inMyDay(t)));
  $('task-myday').textContent = inMyDay(t) ? '☀️ Dans Ma journée · retirer' : '☀️ Ajouter à Ma journée';
  $('task-toggle-done').textContent = t.done ? 'Marquer comme non terminée' : 'Marquer comme terminée';
  document.querySelector('.subtasks').hidden = !!t.parentId;
  renderSubtasks(t);
}

function renderSubtasks(t) {
  $('sub-list').replaceChildren(...childrenOf(t.id).map((s) => {
    const li = document.createElement('li');
    li.className = 'sub-row' + (s.done ? ' done' : '');
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'check';
    check.setAttribute('aria-label', s.done ? 'Marquer comme non terminée' : 'Marquer comme terminée');
    check.innerHTML = ICON.check;
    check.addEventListener('click', () => {
      setDone(s, !s.done);
      save();
      renderSubtasks(t);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = s.title;
    input.maxLength = 300;
    input.setAttribute('aria-label', 'Sous-tâche');
    input.addEventListener('change', () => {
      const v = input.value.trim();
      if (v) updateTask(s.id, { title: v }, false);
      else input.value = s.title;
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn';
    del.setAttribute('aria-label', 'Supprimer la sous-tâche');
    del.innerHTML = ICON.close;
    del.addEventListener('click', () => {
      state.tasks = state.tasks.filter((x) => x.id !== s.id);
      save();
      renderSubtasks(t);
    });
    li.append(check, input, del);
    return li;
  }));
}

const editing = () => getTask(editingId);

$('task-title').addEventListener('input', (e) => {
  const v = e.target.value.trim();
  if (v && editing()) updateTask(editingId, { title: v }, false);
});
$('task-notes').addEventListener('input', (e) => {
  if (editing()) updateTask(editingId, { notes: e.target.value.trim() }, false);
});
$('task-due').addEventListener('change', (e) => {
  if (!editing()) return;
  updateTask(editingId, { due: e.target.value, time: e.target.value ? editing().time : '' }, false);
  fillTaskDialog(editing());
});
$('task-time').addEventListener('change', (e) => {
  if (editing()) updateTask(editingId, { time: e.target.value }, false);
});
$('task-due-clear').addEventListener('click', () => {
  if (!editing()) return;
  updateTask(editingId, { due: '', time: '', repeat: '' }, false);
  fillTaskDialog(editing());
});
document.querySelectorAll('[data-quick]').forEach((b) => {
  b.addEventListener('click', () => {
    if (!editing()) return;
    updateTask(editingId, { due: addDays(todayISO(), Number(b.dataset.quick)) }, false);
    fillTaskDialog(editing());
  });
});
$('task-repeat').addEventListener('change', (e) => {
  if (!editing()) return;
  const changes = { repeat: e.target.value };
  if (e.target.value && !editing().due) changes.due = todayISO();
  updateTask(editingId, changes, false);
  fillTaskDialog(editing());
});
$('task-list').addEventListener('change', (e) => {
  const t = editing();
  if (!t) return;
  const listId = e.target.value;
  const siblings = state.tasks.filter((x) => x.listId === listId && !x.parentId);
  t.order = siblings.length ? Math.min(...siblings.map((x) => x.order)) - 1 : 0;
  t.listId = listId;
  childrenOf(t.id).forEach((s) => { s.listId = listId; });
  save();
  showToast(`Déplacée vers « ${getList(listId).name} »`);
});
$('task-star').addEventListener('click', () => {
  const t = editing();
  if (!t) return;
  updateTask(editingId, { starred: !t.starred }, false);
  $('task-star').setAttribute('aria-pressed', String(!!t.starred));
});
$('task-myday').addEventListener('click', () => {
  const t = editing();
  if (!t) return;
  setMyDay(t.id, !inMyDay(t));
  fillTaskDialog(t);
});
$('task-delete').addEventListener('click', () => {
  const id = editingId;
  $('task-dialog').close();
  deleteTask(id);
});
$('task-toggle-done').addEventListener('click', () => {
  const id = editingId;
  $('task-dialog').close();
  toggleDone(id);
});
$('task-close').addEventListener('click', () => $('task-dialog').close());
$('task-form').addEventListener('submit', (e) => e.preventDefault());

function addPendingSubtask() {
  const t = editing();
  const title = $('sub-new').value.trim();
  if (!t || !title) return;
  addTask({ title, listId: t.listId, parentId: t.id, atTop: false });
  $('sub-new').value = '';
  renderSubtasks(t);
}

$('sub-new').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  addPendingSubtask();
});

$('task-dialog').addEventListener('close', () => {
  addPendingSubtask();
  editingId = null;
  render();
});

// ---------- Listes ----------

function openListDialog(mode) {
  listDialogMode = mode;
  const list = currentList();
  $('list-dialog-title').textContent = mode === 'create' ? 'Nouvelle liste' : 'Modifier la liste';
  $('list-name').value = mode === 'rename' && list ? list.name : '';
  pickedEmoji = mode === 'rename' && list ? list.emoji : EMOJIS[state.lists.length % EMOJIS.length];
  renderEmojiRow();
  $('list-dialog').showModal();
  $('list-name').focus();
}

function renderEmojiRow() {
  $('emoji-row').replaceChildren(...EMOJIS.map((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.setAttribute('aria-label', 'Icône ' + em);
    b.setAttribute('aria-pressed', String(em === pickedEmoji));
    b.addEventListener('click', () => { pickedEmoji = em; renderEmojiRow(); });
    return b;
  }));
}

$('list-form').addEventListener('submit', (e) => {
  const name = $('list-name').value.trim();
  if (!name) { e.preventDefault(); return; }
  if (listDialogMode === 'create') {
    const list = newList(name, pickedEmoji);
    state.lists.push(list);
    state.view = list.id;
  } else {
    Object.assign(currentList(), { name, emoji: pickedEmoji });
  }
  save();
  render();
});
$('list-cancel').addEventListener('click', () => $('list-dialog').close());

function confirmAction(title, text, okLabel) {
  return new Promise((resolve) => {
    const dlg = $('confirm-dialog');
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okLabel;
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

async function deleteCurrentList() {
  const list = currentList();
  if (state.lists.length === 1) return showToast('Impossible de supprimer la dernière liste');
  const count = state.tasks.filter((t) => t.listId === list.id && !t.parentId).length;
  const text = count
    ? `Ses ${count} tâche${count > 1 ? 's' : ''} seront aussi supprimée${count > 1 ? 's' : ''}.`
    : 'Cette liste est vide.';
  if (!await confirmAction(`Supprimer « ${list.name} » ?`, text, 'Supprimer')) return;
  snapshot();
  state.tasks = state.tasks.filter((t) => t.listId !== list.id);
  state.lists = state.lists.filter((l) => l.id !== list.id);
  state.view = state.lists[0].id;
  save();
  render();
  showToast('Liste supprimée', true);
}

function clearDone() {
  const list = currentList();
  const doneIds = new Set(state.tasks.filter((t) => t.listId === list.id && t.done).map((t) => t.id));
  if (doneIds.size === 0) return showToast('Aucune tâche terminée');
  snapshot();
  state.tasks = state.tasks.filter((t) => !doneIds.has(t.id) && !doneIds.has(t.parentId));
  save();
  render();
  showToast('Tâches terminées supprimées', true);
}

// ---------- Menus ----------

const MENUS = { 'app-menu': 'app-menu-btn', 'list-menu': 'list-menu-btn', 'sort-menu': 'sort-btn' };

function closeMenus() {
  Object.entries(MENUS).forEach(([m, b]) => {
    $(m).hidden = true;
    $(b).setAttribute('aria-expanded', 'false');
  });
}

function openMenu(menuId) {
  const wasOpen = !$(menuId).hidden;
  closeMenus();
  if (wasOpen) return;
  const btn = $(MENUS[menuId]);
  const r = btn.getBoundingClientRect();
  const menu = $(menuId);
  menu.style.top = r.bottom + 4 + 'px';
  menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

$('app-menu-btn').addEventListener('click', (e) => { e.stopPropagation(); openMenu('app-menu'); });
$('list-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('list-menu').querySelector('[data-action="delete-list"]').disabled = state.lists.length === 1;
  openMenu('list-menu');
});
$('sort-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const sort = currentList().sort;
  $('sort-menu').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sort === sort)));
  openMenu('sort-menu');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu')) closeMenus();
});
window.addEventListener('scroll', closeMenus, { passive: true });

$('sort-menu').addEventListener('click', (e) => {
  const sort = e.target.dataset.sort;
  if (!sort) return;
  closeMenus();
  currentList().sort = sort;
  save();
  render();
});

$('list-menu').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  closeMenus();
  if (action === 'rename-list') openListDialog('rename');
  else if (action === 'delete-list') deleteCurrentList();
  else if (action === 'clear-done') clearDone();
});

$('app-menu').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  closeMenus();
  if (action === 'stats') openStats();
  else if (action === 'export') exportBackup();
  else if (action === 'import') $('import-file').click();
  else if (action === 'google') {
    const dlg = $('google-dialog');
    dlg.returnValue = '';
    dlg.showModal();
  }
});

$('google-dialog').addEventListener('close', () => {
  if ($('google-dialog').returnValue === 'pick') $('google-file').click();
});

$('done-toggle').addEventListener('click', () => {
  const key = state.view;
  state.showDone[key] = !state.showDone[key];
  save();
  render();
});

// ---------- Recherche ----------

function closeSearch() {
  searchQuery = '';
  $('search-input').value = '';
  $('search').hidden = true;
  $('search-btn').setAttribute('aria-expanded', 'false');
}

$('search-btn').addEventListener('click', () => {
  if ($('search').hidden) {
    $('search').hidden = false;
    $('search-btn').setAttribute('aria-expanded', 'true');
    $('search-input').focus();
  } else {
    closeSearch();
    render();
  }
});
$('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  render();
});

// ---------- Ajout ----------

function updateHint() {
  const parsed = parseQuick($('new-title').value);
  const hint = $('nl-hint');
  hint.hidden = !parsed.due;
  if (parsed.due) hint.textContent = '📅 ' + dayLabel(parsed.due) + (parsed.time ? ' à ' + parsed.time : '') + ' détecté';
}

$('new-title').addEventListener('input', updateHint);

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('new-title');
  const raw = input.value.trim();
  if (!raw) return;
  const parsed = parseQuick(raw);
  const listId = getList(state.view) ? state.view : state.lists[0].id;
  addTask({
    title: parsed.title,
    listId,
    due: $('new-due').value || parsed.due,
    time: $('new-due').value ? '' : parsed.time,
    starred: $('new-star').checked || state.view === 'starred',
    myDay: state.view === 'myday' ? todayISO() : '',
  });
  if (searchQuery) closeSearch();
  input.value = '';
  $('new-due').value = '';
  $('new-star').checked = false;
  updateHint();
  render();
  input.focus();
});

$('extra-btn').addEventListener('click', () => {
  const extra = $('composer-extra');
  extra.hidden = !extra.hidden;
  $('extra-btn').setAttribute('aria-expanded', String(!extra.hidden));
});

// ---------- Statistiques ----------

function streaks() {
  const history = state.history;
  const today = todayISO();
  let current = 0;
  let day = history[today] ? today : addDays(today, -1);
  while (history[day] > 0) { current++; day = addDays(day, -1); }

  let best = 0, run = 0, prev = null;
  Object.keys(history).filter((d) => history[d] > 0).sort().forEach((d) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return { current, best: Math.max(best, current) };
}

function tile(value, label, sub) {
  const el = document.createElement('div');
  el.className = 'tile';
  const v = document.createElement('div');
  v.className = 'tile-value';
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'tile-label';
  l.textContent = label;
  el.append(v, l);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'tile-sub';
    s.textContent = sub;
    el.append(s);
  }
  return el;
}

function openStats() {
  const today = todayISO();
  const days = [...Array(7)].map((_, i) => addDays(today, i - 6));
  const counts = days.map((d) => state.history[d] || 0);
  const week = counts.reduce((a, b) => a + b, 0);
  const prevWeek = [...Array(7)].map((_, i) => state.history[addDays(today, i - 13)] || 0).reduce((a, b) => a + b, 0);
  const { current, best } = streaks();
  const late = state.tasks.filter((t) => isLate(t) && getList(t.listId)).length;

  let weekSub = '';
  if (prevWeek > 0) {
    const diff = week - prevWeek;
    weekSub = diff === 0 ? 'Autant que la semaine d\'avant' : `${diff > 0 ? '+' : ''}${diff} par rapport à la semaine d'avant`;
  }
  $('stat-tiles').replaceChildren(
    tile(String(counts[6]), 'Terminées aujourd\'hui'),
    tile(String(week), '7 derniers jours', weekSub),
    tile(`${current} j`, 'Série en cours', `Record : ${best} jour${best > 1 ? 's' : ''}`),
    tile(String(late), 'En retard'),
  );

  // Barres des 7 derniers jours : une seule série, valeur affichée au toucher.
  const max = Math.max(...counts, 1);
  const labels = days.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''));
  const bars = $('stat-bars');
  let selected = 6;
  const drawBars = () => {
    bars.replaceChildren(...counts.map((c, i) => {
      const col = document.createElement('button');
      col.type = 'button';
      col.className = 'bar-col';
      col.setAttribute('aria-pressed', String(i === selected));
      col.setAttribute('aria-label', `${dayLabel(days[i])} : ${c} tâche${c > 1 ? 's' : ''} terminée${c > 1 ? 's' : ''}`);
      const value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = c;
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.height = `calc((100% - 20px) * ${c / max})`;
      col.append(value, bar);
      col.addEventListener('click', () => { selected = i; drawBars(); });
      return col;
    }));
  };
  drawBars();
  const labelRow = document.createElement('div');
  labelRow.className = 'bar-labels';
  labelRow.append(...labels.map((l, i) => {
    const span = document.createElement('span');
    span.textContent = i === 6 ? 'auj.' : l;
    if (i === 6) span.className = 'is-today';
    return span;
  }));
  bars.nextElementSibling?.classList.contains('bar-labels') && bars.nextElementSibling.remove();
  bars.after(labelRow);
  document.querySelector('.chart-empty')?.remove();
  if (week === 0) {
    const p = document.createElement('p');
    p.className = 'chart-empty';
    p.textContent = 'Aucune tâche terminée ces 7 derniers jours.';
    labelRow.after(p);
  }

  $('stat-table').replaceChildren(...days.map((d, i) => {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = dayLabel(d);
    const b = document.createElement('td');
    b.textContent = counts[i];
    tr.append(a, b);
    return tr;
  }));

  $('stat-lists').replaceChildren(...state.lists.map((l) => {
    const top = state.tasks.filter((t) => t.listId === l.id && !t.parentId);
    const done = top.filter((t) => t.done).length;
    const el = document.createElement('div');
    el.className = 'list-stat';
    const row = document.createElement('div');
    row.className = 'list-stat-row';
    const name = document.createElement('span');
    name.textContent = `${l.emoji} ${l.name}`;
    const nums = document.createElement('span');
    nums.textContent = top.length ? `${done}/${top.length} terminée${done > 1 ? 's' : ''}` : 'Vide';
    row.append(name, nums);
    const meter = document.createElement('div');
    meter.className = 'meter';
    const fill = document.createElement('span');
    fill.style.width = top.length ? (done / top.length * 100) + '%' : '0';
    meter.append(fill);
    el.append(row, meter);
    return el;
  }));

  $('stats-dialog').showModal();
}

$('stats-close').addEventListener('click', () => $('stats-dialog').close());

// ---------- Sauvegarde ----------

function exportBackup() {
  const data = { version: 2, exportedAt: new Date().toISOString(), lists: state.lists, tasks: state.tasks, history: state.history };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
    snapshot();
    let added = 0;
    if (data && Array.isArray(data.lists) && Array.isArray(data.tasks)) {
      const knownLists = new Set(state.lists.map((l) => l.id));
      data.lists.filter((l) => l && l.id && l.name && !knownLists.has(l.id))
        .forEach((l) => state.lists.push({ sort: 'manual', emoji: EMOJIS[0], ...l }));
      const lists = new Set(state.lists.map((l) => l.id));
      const known = new Set(state.tasks.map((t) => t.id));
      data.tasks.filter((t) => t && t.id && typeof t.title === 'string' && lists.has(t.listId) && !known.has(t.id))
        .forEach((t) => { state.tasks.push(t); added++; });
      if (data.history && typeof data.history === 'object') {
        Object.entries(data.history).forEach(([d, n]) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(n)) state.history[d] = Math.max(state.history[d] || 0, n);
        });
      }
    } else {
      const legacy = Array.isArray(data) ? data : data && data.tasks;
      if (!Array.isArray(legacy)) throw new Error('format');
      const known = new Set(state.tasks.map((t) => t.id));
      const listId = getList(state.view) ? state.view : state.lists[0].id;
      legacy.filter((t) => t && typeof t.title === 'string' && !known.has(String(t.id)))
        .forEach((t, i) => { state.tasks.push(fromLegacy(t, listId, i)); added++; });
    }
    save();
    render();
    showToast(`${added} tâche${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''}`, added > 0);
  } catch {
    undoSnapshot = null;
    showToast('Fichier de sauvegarde invalide');
  }
});

// ---------- Import Google Tasks (Google Takeout) ----------

// Lit les fichiers .json d'une archive .zip (format Takeout) sans bibliothèque externe.
async function readZipJsonFiles(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.toLowerCase().endsWith('.json')) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = new Uint8Array(buffer, start, size);
    if (method === 0) {
      files.push(decoder.decode(data));
    } else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      files.push(await new Response(stream).text());
    }
  }
  return files;
}

function isGoogleTasksExport(data) {
  return data && Array.isArray(data.items) && data.items.some((l) => l && Array.isArray(l.items) || (l && l.kind === 'tasks#taskList'));
}

// Convertit l'export Google Tasks : listes, tâches, sous-tâches, notes, dates et tâches terminées.
function importGoogleTasks(data) {
  let added = 0;
  let listsAdded = 0;
  const known = new Set(state.tasks.map((t) => t.id));
  data.items.forEach((gl, li) => {
    if (!gl) return;
    const name = String(gl.title || 'Google Tasks').trim() || 'Google Tasks';
    const listId = 'g-' + (gl.id || uid());
    let list = getList(listId) || state.lists.find((l) => normalize(l.name) === normalize(name));
    if (!list) {
      list = { id: listId, name, emoji: EMOJIS[(state.lists.length + li) % EMOJIS.length], sort: 'manual', createdAt: Date.now() };
      state.lists.push(list);
      listsAdded++;
    }
    const items = (gl.items || [])
      .filter((t) => t && !t.deleted && String(t.title || '').trim())
      .sort((a, b) => String(a.position || '').localeCompare(String(b.position || '')));
    const ids = new Set(items.map((t) => t.id));
    items.forEach((t, i) => {
      const id = 'g-' + t.id;
      if (known.has(id)) return;
      const done = t.status === 'completed';
      const doneAt = done ? (Date.parse(t.completed || t.updated) || Date.now()) : null;
      state.tasks.push({
        id,
        listId: list.id,
        parentId: t.parent && ids.has(t.parent) ? 'g-' + t.parent : null,
        title: String(t.title).trim(),
        notes: String(t.notes || '').trim(),
        due: typeof t.due === 'string' ? t.due.slice(0, 10) : '',
        time: '',
        starred: !!t.starred,
        myDay: '',
        repeat: '',
        done,
        doneAt,
        createdAt: Date.parse(t.created || t.updated) || Date.now(),
        order: i,
      });
      if (done) {
        const day = localISO(new Date(doneAt));
        state.history[day] = (state.history[day] || 0) + 1;
      }
      known.add(id);
      added++;
    });
  });
  return { added, listsAdded };
}

$('google-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const isZip = new DataView(buffer).getUint32(0, true) === 0x04034b50;
    const texts = isZip ? await readZipJsonFiles(buffer) : [new TextDecoder().decode(buffer)];
    const data = texts.map((t) => { try { return JSON.parse(t); } catch { return null; } }).find(isGoogleTasksExport);
    if (!data) throw new Error('format');
    snapshot();
    const { added, listsAdded } = importGoogleTasks(data);
    const firstImported = state.lists.find((l) => l.id.startsWith('g-'));
    if (listsAdded && firstImported) state.view = firstImported.id;
    save();
    render();
    if (added === 0) {
      undoSnapshot = null;
      showToast('Ces tâches sont déjà dans l\'app');
    } else {
      showToast(`${added} tâche${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''}` +
        (listsAdded ? ` dans ${listsAdded} liste${listsAdded > 1 ? 's' : ''}` : ''), true);
    }
  } catch {
    undoSnapshot = null;
    showToast('Ce fichier ne contient pas d\'export Google Tasks');
  }
});

// ---------- Toast / annulation ----------

function showToast(text, undoable = false) {
  $('toast-text').textContent = text;
  $('toast-undo').hidden = !undoable;
  if (!undoable) undoSnapshot = null;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; undoSnapshot = null; }, 5000);
}

$('toast-undo').addEventListener('click', () => {
  if (undoSnapshot) {
    state = undoSnapshot;
    undoSnapshot = null;
    save();
    render();
  }
  $('toast').hidden = true;
});

// ---------- Démarrage ----------

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { state = load(); render(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
  });
}

save();
render();
