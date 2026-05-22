/* ============================================================
   Life Dashboard — script.js
   Vanilla JS | No frameworks | LocalStorage persistence
   ============================================================
   Sections:
     1. Constants & State
     2. Utility Helpers
     3. Theme (Light / Dark)
     4. Greeting (Clock + Name)
     5. Focus Timer (Pomodoro)
     6. To-Do List
     7. Quick Links
     8. Init
   ============================================================ */

'use strict';

/* ============================================================
   1. CONSTANTS & STATE
   ============================================================ */

/** LocalStorage keys — centralised to avoid typos */
const STORAGE_KEYS = {
  THEME:  'ld_theme',
  NAME:   'ld_name',
  TODOS:  'ld_todos',
  LINKS:  'ld_links',
  TIMER_DURATION: 'ld_timer_duration',
};

/** Application state — single source of truth */
const state = {
  // Timer
  timerDuration:   25,   // minutes (user-configurable)
  timerRemaining:  0,    // seconds remaining
  timerTotal:      0,    // total seconds for current session (for progress bar)
  timerInterval:   null, // setInterval handle
  timerRunning:    false,

  // Todos
  todos:           [],   // [{ id, text, done }]
  todoFilter:      'all',

  // Links
  links:           [],   // [{ id, name, url }]

  // Edit task modal
  editingTaskId:   null,
};

/* ============================================================
   2. UTILITY HELPERS
   ============================================================ */

/**
 * Read a value from LocalStorage, parsing JSON.
 * Returns `defaultValue` if key is absent or JSON is invalid.
 */
function storageGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Persist a value to LocalStorage as JSON. */
function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Generate a simple unique ID (timestamp + random). */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Pad a number to 2 digits (e.g. 5 → "05").
 * @param {number} n
 * @returns {string}
 */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Safely escape HTML to prevent XSS when inserting user text.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   3. THEME — Light / Dark Mode
   ============================================================ */

const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon      = document.getElementById('themeIcon');

/** Apply a theme to the document and persist it. */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  storageSet(STORAGE_KEYS.THEME, theme);
}

/** Toggle between light and dark. */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/** Initialise theme from storage (or system preference). */
function initTheme() {
  const saved = storageGet(STORAGE_KEYS.THEME, null);
  if (saved) {
    applyTheme(saved);
  } else {
    // Respect OS preference if no saved preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

themeToggleBtn.addEventListener('click', toggleTheme);

/* ============================================================
   4. GREETING — Clock, Date & Custom Name
   ============================================================ */

const currentTimeEl  = document.getElementById('currentTime');
const currentDateEl  = document.getElementById('currentDate');
const greetingTextEl = document.getElementById('greetingText');
const editNameBtn    = document.getElementById('editNameBtn');
const nameModal      = document.getElementById('nameModal');
const nameInput      = document.getElementById('nameInput');
const saveNameBtn    = document.getElementById('saveNameBtn');
const cancelNameBtn  = document.getElementById('cancelNameBtn');

/** Day names and month names for date formatting. */
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/**
 * Return a greeting string based on the current hour.
 * 05–11 → Good Morning | 12–17 → Good Afternoon
 * 18–21 → Good Evening | 22–04 → Good Night
 */
function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 18) return 'Good Afternoon';
  if (hour >= 18 && hour < 22) return 'Good Evening';
  return 'Good Night';
}

/** Update the clock, date, and greeting every second. */
function updateClock() {
  const now    = new Date();
  const h      = now.getHours();
  const m      = now.getMinutes();
  const s      = now.getSeconds();
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;

  // Time display (12-hour format)
  currentTimeEl.textContent = `${pad(h12)}:${pad(m)}:${pad(s)} ${ampm}`;

  // Date display
  currentDateEl.textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  // Greeting with optional custom name
  const name     = storageGet(STORAGE_KEYS.NAME, '');
  const greeting = getGreeting(h);
  greetingTextEl.textContent = name ? `${greeting}, ${name}! 👋` : `${greeting}! 👋`;
}

/** Open the name-edit modal. */
function openNameModal() {
  nameInput.value = storageGet(STORAGE_KEYS.NAME, '');
  nameModal.classList.remove('hidden');
  nameInput.focus();
}

/** Close the name-edit modal. */
function closeNameModal() {
  nameModal.classList.add('hidden');
}

/** Save the custom name and close the modal. */
function saveName() {
  const name = nameInput.value.trim();
  storageSet(STORAGE_KEYS.NAME, name);
  closeNameModal();
  updateClock(); // Refresh greeting immediately
}

// Name modal event listeners
editNameBtn.addEventListener('click', openNameModal);
saveNameBtn.addEventListener('click', saveName);
cancelNameBtn.addEventListener('click', closeNameModal);

// Close modal when clicking the backdrop
nameModal.querySelector('.modal__backdrop').addEventListener('click', closeNameModal);

// Allow Enter key to save name
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveName();
  if (e.key === 'Escape') closeNameModal();
});

/** Initialise the clock (runs every second). */
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

/* ============================================================
   5. FOCUS TIMER (Pomodoro)
   ============================================================ */

const timerDisplay     = document.getElementById('timerDisplay');
const timerProgressBar = document.getElementById('timerProgressBar');
const startBtn         = document.getElementById('startBtn');
const stopBtn          = document.getElementById('stopBtn');
const resetBtn         = document.getElementById('resetBtn');
const timerDurationInput = document.getElementById('timerDuration');
const setDurationBtn   = document.getElementById('setDurationBtn');

/** Format seconds as MM:SS string. */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

/** Update the timer display and progress bar. */
function renderTimer() {
  timerDisplay.textContent = formatTime(state.timerRemaining);

  // Progress bar: percentage of time elapsed
  const elapsed  = state.timerTotal - state.timerRemaining;
  const percent  = state.timerTotal > 0 ? (elapsed / state.timerTotal) * 100 : 0;
  timerProgressBar.style.width = `${percent}%`;

  // Update ARIA attribute for accessibility
  timerProgressBar.parentElement.setAttribute('aria-valuenow', Math.round(percent));
}

/** Tick the timer down by one second. */
function timerTick() {
  if (state.timerRemaining <= 0) {
    // Timer finished
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerRunning  = false;
    timerDisplay.textContent = '00:00';
    timerProgressBar.style.width = '100%';
    updateTimerButtons();

    // Notify the user
    notifyTimerDone();
    return;
  }
  state.timerRemaining--;
  renderTimer();
}

/** Play a simple beep using the Web Audio API (no external files needed). */
function notifyTimerDone() {
  // Browser notification (if permission granted)
  if (Notification.permission === 'granted') {
    new Notification('🍅 Focus session complete!', {
      body: 'Time to take a break.',
      icon: 'https://cdn.jsdelivr.net/npm/twemoji@14/assets/72x72/1f345.png',
    });
  }

  // Audio beep via Web Audio API
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Audio not available — silently ignore
  }
}

/** Sync Start / Pause button states. */
function updateTimerButtons() {
  startBtn.disabled = state.timerRunning;
  stopBtn.disabled  = !state.timerRunning;
}

/** Start the timer. */
function startTimer() {
  if (state.timerRunning) return;

  // If remaining is 0 (fresh or after reset), initialise from duration
  if (state.timerRemaining <= 0) {
    state.timerRemaining = state.timerDuration * 60;
    state.timerTotal     = state.timerRemaining;
  }

  state.timerRunning = true;
  state.timerInterval = setInterval(timerTick, 1000);
  updateTimerButtons();
}

/** Pause the timer. */
function pauseTimer() {
  if (!state.timerRunning) return;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning  = false;
  updateTimerButtons();
}

/** Reset the timer to the current duration. */
function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval  = null;
  state.timerRunning   = false;
  state.timerRemaining = state.timerDuration * 60;
  state.timerTotal     = state.timerRemaining;
  renderTimer();
  updateTimerButtons();
}

/** Apply a new custom duration from the input field. */
function applyCustomDuration() {
  // Read the raw string value so browser min/max clamping never interferes
  const raw = timerDurationInput.value.trim();
  const val = parseInt(raw, 10);

  if (isNaN(val) || val < 1 || val > 120) {
    // Show the current valid duration and shake the input as feedback
    timerDurationInput.value = state.timerDuration;
    timerDurationInput.style.borderColor = 'var(--danger)';
    timerDurationInput.title = 'Enter a number between 1 and 120';
    setTimeout(() => {
      timerDurationInput.style.borderColor = '';
      timerDurationInput.title = '';
    }, 1500);
    return;
  }

  state.timerDuration = val;
  storageSet(STORAGE_KEYS.TIMER_DURATION, val);
  resetTimer(); // Reset to new duration
}

// Timer button listeners
startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);
setDurationBtn.addEventListener('click', applyCustomDuration);
timerDurationInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyCustomDuration();
});

/** Initialise timer from saved duration. */
function initTimer() {
  state.timerDuration  = storageGet(STORAGE_KEYS.TIMER_DURATION, 25);
  timerDurationInput.value = state.timerDuration;
  state.timerRemaining = state.timerDuration * 60;
  state.timerTotal     = state.timerRemaining;
  renderTimer();
  updateTimerButtons();

  // Request notification permission proactively
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ============================================================
   6. TO-DO LIST
   ============================================================ */

const todoForm         = document.getElementById('todoForm');
const todoInput        = document.getElementById('todoInput');
const todoList         = document.getElementById('todoList');
const todoBadge        = document.getElementById('todoBadge');
const duplicateWarning = document.getElementById('duplicateWarning');
const clearDoneBtn     = document.getElementById('clearDoneBtn');
const filterBtns       = document.querySelectorAll('.btn--filter');

// Edit task modal elements
const editTaskModal  = document.getElementById('editTaskModal');
const editTaskInput  = document.getElementById('editTaskInput');
const saveEditBtn    = document.getElementById('saveEditBtn');
const cancelEditBtn  = document.getElementById('cancelEditBtn');

/** Persist todos to LocalStorage. */
function saveTodos() {
  storageSet(STORAGE_KEYS.TODOS, state.todos);
}

/**
 * Check if a task text already exists (case-insensitive).
 * @param {string} text
 * @param {string|null} excludeId - ID to exclude (used when editing)
 * @returns {boolean}
 */
function isDuplicateTask(text, excludeId = null) {
  const normalised = text.trim().toLowerCase();
  return state.todos.some(
    (t) => t.text.toLowerCase() === normalised && t.id !== excludeId
  );
}

/** Return the filtered list of todos based on current filter. */
function getFilteredTodos() {
  switch (state.todoFilter) {
    case 'active': return state.todos.filter((t) => !t.done);
    case 'done':   return state.todos.filter((t) =>  t.done);
    default:       return state.todos;
  }
}

/** Render the todo list to the DOM. */
function renderTodos() {
  const filtered = getFilteredTodos();
  const activeCount = state.todos.filter((t) => !t.done).length;

  // Update badge (shows active tasks count)
  todoBadge.textContent = activeCount;

  if (filtered.length === 0) {
    todoList.innerHTML = `<li class="empty-state">
      ${state.todoFilter === 'done' ? 'No completed tasks yet.' :
        state.todoFilter === 'active' ? 'No active tasks. Great job! 🎉' :
        'No tasks yet. Add one above!'}
    </li>`;
    return;
  }

  todoList.innerHTML = filtered.map((todo) => `
    <li class="todo__item ${todo.done ? 'done' : ''}" data-id="${todo.id}">
      <input
        type="checkbox"
        class="todo__checkbox"
        ${todo.done ? 'checked' : ''}
        aria-label="Mark '${escapeHtml(todo.text)}' as ${todo.done ? 'incomplete' : 'complete'}"
      />
      <span class="todo__text">${escapeHtml(todo.text)}</span>
      <div class="todo__actions">
        <button class="todo__btn todo__btn--edit" aria-label="Edit task" title="Edit">✏️</button>
        <button class="todo__btn todo__btn--delete" aria-label="Delete task" title="Delete">🗑️</button>
      </div>
    </li>
  `).join('');
}

/** Add a new task. */
function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Duplicate check
  if (isDuplicateTask(trimmed)) {
    duplicateWarning.classList.remove('hidden');
    setTimeout(() => duplicateWarning.classList.add('hidden'), 2500);
    return;
  }

  duplicateWarning.classList.add('hidden');

  state.todos.unshift({ id: uid(), text: trimmed, done: false });
  saveTodos();
  renderTodos();
}

/** Toggle the done state of a task. */
function toggleTodo(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    saveTodos();
    renderTodos();
  }
}

/** Delete a task by ID. */
function deleteTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  saveTodos();
  renderTodos();
}

/** Open the edit modal for a task. */
function openEditModal(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  state.editingTaskId  = id;
  editTaskInput.value  = todo.text;
  editTaskModal.classList.remove('hidden');
  editTaskInput.focus();
  editTaskInput.select();
}

/** Close the edit modal. */
function closeEditModal() {
  editTaskModal.classList.add('hidden');
  state.editingTaskId = null;
}

/** Save the edited task text. */
function saveEditedTask() {
  const newText = editTaskInput.value.trim();
  if (!newText || !state.editingTaskId) return;

  // Duplicate check (exclude the task being edited)
  if (isDuplicateTask(newText, state.editingTaskId)) {
    editTaskInput.style.borderColor = 'var(--danger)';
    editTaskInput.title = 'Duplicate task!';
    setTimeout(() => {
      editTaskInput.style.borderColor = '';
      editTaskInput.title = '';
    }, 1500);
    return;
  }

  const todo = state.todos.find((t) => t.id === state.editingTaskId);
  if (todo) {
    todo.text = newText;
    saveTodos();
    renderTodos();
  }
  closeEditModal();
}

/** Remove all completed tasks. */
function clearDoneTasks() {
  state.todos = state.todos.filter((t) => !t.done);
  saveTodos();
  renderTodos();
}

// Todo form submit
todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo(todoInput.value);
  todoInput.value = '';
  todoInput.focus();
});

// Delegated click handler for todo list (checkbox, edit, delete)
todoList.addEventListener('click', (e) => {
  const item = e.target.closest('.todo__item');
  if (!item) return;
  const id = item.dataset.id;

  if (e.target.classList.contains('todo__checkbox')) {
    toggleTodo(id);
  } else if (e.target.classList.contains('todo__btn--edit')) {
    openEditModal(id);
  } else if (e.target.classList.contains('todo__btn--delete')) {
    deleteTodo(id);
  }
});

// Filter buttons
filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.todoFilter = btn.dataset.filter;
    renderTodos();
  });
});

// Clear done button
clearDoneBtn.addEventListener('click', clearDoneTasks);

// Edit modal actions
saveEditBtn.addEventListener('click', saveEditedTask);
cancelEditBtn.addEventListener('click', closeEditModal);
editTaskModal.querySelector('.modal__backdrop').addEventListener('click', closeEditModal);
editTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  saveEditedTask();
  if (e.key === 'Escape') closeEditModal();
});

/** Initialise todos from LocalStorage. */
function initTodos() {
  state.todos = storageGet(STORAGE_KEYS.TODOS, []);
  renderTodos();
}

/* ============================================================
   7. QUICK LINKS
   ============================================================ */

const linkForm  = document.getElementById('linkForm');
const linkName  = document.getElementById('linkName');
const linkUrl   = document.getElementById('linkUrl');
const linkError = document.getElementById('linkError');
const linksGrid = document.getElementById('linksGrid');

/** Persist links to LocalStorage. */
function saveLinks() {
  storageSet(STORAGE_KEYS.LINKS, state.links);
}

/**
 * Build a favicon URL using Google's favicon service.
 * Falls back gracefully if the image fails to load.
 * @param {string} url
 * @returns {string}
 */
function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
  } catch {
    return '';
  }
}

/** Render the links grid. */
function renderLinks() {
  if (state.links.length === 0) {
    linksGrid.innerHTML = `<p class="empty-state" style="grid-column:1/-1">No links yet. Add your favourites above!</p>`;
    return;
  }

  linksGrid.innerHTML = state.links.map((link) => {
    const favicon = faviconUrl(link.url);
    return `
      <a
        href="${escapeHtml(link.url)}"
        target="_blank"
        rel="noopener noreferrer"
        class="link__item"
        data-id="${link.id}"
        title="${escapeHtml(link.url)}"
      >
        ${favicon
          ? `<img class="link__favicon" src="${favicon}" alt="" loading="lazy"
               onerror="this.style.display='none'">`
          : '🔗'}
        <span>${escapeHtml(link.name)}</span>
        <button
          class="link__delete"
          data-id="${link.id}"
          aria-label="Delete ${escapeHtml(link.name)}"
          title="Remove link"
        >✕</button>
      </a>
    `;
  }).join('');
}

/**
 * Validate a URL string.
 * Accepts http:// and https:// URLs.
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Add a new quick link. */
function addLink(name, url) {
  const trimName = name.trim();
  let   trimUrl  = url.trim();

  // Auto-prepend https:// if missing
  if (trimUrl && !trimUrl.startsWith('http://') && !trimUrl.startsWith('https://')) {
    trimUrl = 'https://' + trimUrl;
  }

  if (!trimName) {
    showLinkError('Please enter a label for the link.');
    return;
  }
  if (!isValidUrl(trimUrl)) {
    showLinkError('Please enter a valid URL (e.g. https://example.com).');
    return;
  }

  hideLinkError();
  state.links.push({ id: uid(), name: trimName, url: trimUrl });
  saveLinks();
  renderLinks();
}

/** Delete a link by ID. */
function deleteLink(id) {
  state.links = state.links.filter((l) => l.id !== id);
  saveLinks();
  renderLinks();
}

function showLinkError(msg) {
  linkError.textContent = msg;
  linkError.classList.remove('hidden');
}

function hideLinkError() {
  linkError.classList.add('hidden');
}

// Link form submit
linkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addLink(linkName.value, linkUrl.value);
  linkName.value = '';
  linkUrl.value  = '';
  linkName.focus();
});

// Delegated click for delete buttons inside links grid
linksGrid.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.link__delete');
  if (deleteBtn) {
    e.preventDefault(); // Prevent the <a> from navigating
    e.stopPropagation();
    deleteLink(deleteBtn.dataset.id);
  }
});

/** Initialise links from LocalStorage. */
function initLinks() {
  state.links = storageGet(STORAGE_KEYS.LINKS, []);
  renderLinks();
}

/* ============================================================
   8. INIT — Bootstrap everything
   ============================================================ */

function init() {
  initTheme();   // Apply saved or system theme
  initClock();   // Start real-time clock
  initTimer();   // Set up focus timer
  initTodos();   // Load and render todos
  initLinks();   // Load and render quick links
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
