/* ══════════════════════════════════════════════════
   Muskaan — Punjabi Vocabulary Learning App
   Main Controller: Vocabulary Grid, Practice, Chat, Settings
   ══════════════════════════════════════════════════ */

(function() {
'use strict';

// ── State ──
const STATE_KEY = 'muskaan_state';
const SETTINGS_KEY = 'muskaan_settings';

const defaultSettings = {
  darkMode: false,
  difficulty: 'beginner',
  fontSize: 16
};

const defaultState = {
  learned: [],
  practiceStats: { correct: 0, wrong: 0, streak: 0, bestStreak: 0 },
  currentView: 'vocabulary'
};

let settings = loadJSON(SETTINGS_KEY, defaultSettings);
let state = loadJSON(STATE_KEY, defaultState);

function loadJSON(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; }
  catch { return { ...fallback }; }
}
function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

// ── Inject Styles ──
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* App Shell */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: ${settings.fontSize}px; }
    body {
      font-family: var(--ff-sans, 'Lato', system-ui, sans-serif);
      background: var(--cream, #FFFBF4);
      color: var(--text, #2C1A0E);
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    body.dark {
      --cream: #1a1210;
      --ivory: #2a2018;
      --ivory-dark: #352a1e;
      --white: #241c14;
      --text: #f0e6d8;
      --text-mid: #c8b8a0;
      --text-light: #a89878;
      --red-dark: #e85040;
      --red: #c04030;
    }

    .app-header {
      background: var(--red-dark, #5C0F0F);
      color: var(--ivory, #FDF6EC);
      padding: .8rem 1.2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 3px solid var(--gold, #C9921A);
    }
    .app-logo {
      font-family: var(--ff-display, 'Playfair Display', serif);
      font-size: 1.3rem;
      font-weight: 400;
    }
    .app-logo span { color: var(--gold-light, #F0C040); }
    .settings-btn {
      background: none; border: none; color: var(--gold-light, #F0C040);
      font-size: 1.4rem; cursor: pointer; padding: .3rem;
      transition: transform .2s;
    }
    .settings-btn:hover { transform: rotate(30deg); }

    .app-main {
      flex: 1;
      padding: 1rem;
      padding-bottom: 5rem;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
    }

    .app-nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: var(--red-dark, #5C0F0F);
      display: flex;
      justify-content: space-around;
      padding: .5rem 0 calc(.5rem + env(safe-area-inset-bottom, 0));
      border-top: 2px solid var(--gold, #C9921A);
      z-index: 50;
    }
    .nav-tab {
      display: flex; flex-direction: column; align-items: center;
      gap: .15rem; background: none; border: none;
      color: rgba(253,246,236,.5); font-size: .65rem;
      letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; padding: .3rem .8rem;
      transition: color .2s;
      font-family: var(--ff-sans, 'Lato', sans-serif);
    }
    .nav-tab .nav-icon { font-size: 1.3rem; }
    .nav-tab.active { color: var(--gold-light, #F0C040); }
    .nav-tab:hover { color: var(--gold-light, #F0C040); }

    .view { display: none; animation: fadeUp .3s ease; }
    .view.active { display: block; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Search & Filters ── */
    .search-bar {
      display: flex; gap: .5rem; margin-bottom: 1rem;
    }
    .search-bar input {
      flex: 1; padding: .65rem 1rem;
      border: 1.5px solid #E0CCAA;
      border-radius: 8px; font-size: .9rem;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      outline: none;
      font-family: inherit;
    }
    .search-bar input:focus {
      border-color: var(--gold, #C9921A);
      box-shadow: 0 0 0 3px rgba(201,146,26,.15);
    }
    .filter-pills {
      display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: 1.2rem;
    }
    .pill {
      padding: .35rem .8rem; border-radius: 20px;
      font-size: .72rem; letter-spacing: .08em; text-transform: uppercase;
      border: 1.5px solid var(--gold, #C9921A);
      background: transparent; color: var(--text-mid, #5A3820);
      cursor: pointer; transition: all .2s;
      font-family: inherit;
    }
    .pill.active {
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
      font-weight: 600;
    }
    .pill:hover { background: rgba(201,146,26,.15); }
    .pill.active:hover { background: var(--gold, #C9921A); }

    /* ── Vocab Grid ── */
    .vocab-stats {
      display: flex; gap: 1rem; margin-bottom: 1rem;
      font-size: .8rem; color: var(--text-mid, #5A3820);
    }
    .vocab-stats strong { color: var(--gold, #C9921A); }
    .vocab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }
    .vocab-card {
      background: var(--white, #fff);
      border-radius: 12px;
      padding: 1.2rem;
      box-shadow: 0 4px 20px rgba(44,26,14,.08);
      border-left: 4px solid var(--gold, #C9921A);
      cursor: pointer;
      transition: transform .2s, box-shadow .2s;
      position: relative;
    }
    .vocab-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(44,26,14,.14);
    }
    .vocab-card.learned { border-left-color: #27AE60; }
    .vocab-card .gurmukhi {
      font-size: 1.8rem; line-height: 1.3;
      color: var(--red-dark, #5C0F0F);
      font-family: inherit;
      margin-bottom: .2rem;
    }
    .vocab-card .latin {
      font-size: .9rem;
      font-style: italic;
      color: var(--text-mid, #5A3820);
      margin-bottom: .3rem;
    }
    .vocab-card .pos-badge {
      display: inline-block;
      font-size: .65rem; letter-spacing: .1em; text-transform: uppercase;
      background: rgba(201,146,26,.15);
      color: var(--gold, #C9921A);
      padding: .15rem .5rem;
      border-radius: 4px;
      margin-right: .4rem;
    }
    .vocab-card .cat-tag {
      display: inline-block;
      font-size: .65rem; letter-spacing: .1em; text-transform: uppercase;
      background: rgba(139,26,26,.08);
      color: var(--red, #8B1A1A);
      padding: .15rem .5rem;
      border-radius: 4px;
    }
    .vocab-card .meaning {
      font-size: .95rem;
      color: var(--text, #2C1A0E);
      margin: .5rem 0;
      font-weight: 600;
    }
    .vocab-card .example {
      display: none;
      margin-top: .6rem;
      padding-top: .6rem;
      border-top: 1px solid rgba(201,146,26,.2);
      font-size: .85rem;
      color: var(--text-mid, #5A3820);
      line-height: 1.6;
    }
    .vocab-card.expanded .example { display: block; }
    .vocab-card .learn-btn {
      position: absolute; top: .8rem; right: .8rem;
      background: none; border: none; font-size: 1.2rem;
      cursor: pointer; opacity: .5; transition: opacity .2s;
    }
    .vocab-card .learn-btn:hover { opacity: 1; }
    .vocab-card.learned .learn-btn { opacity: 1; }
    .empty-msg {
      text-align: center; padding: 3rem 1rem;
      color: var(--text-light, #8B6345);
      font-family: var(--ff-serif, 'Cormorant Garamond', serif);
      font-size: 1.1rem; font-style: italic;
    }

    /* ── Practice ── */
    .practice-modes {
      display: flex; gap: .5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .mode-btn {
      flex: 1; min-width: 120px;
      padding: .8rem 1rem;
      border: 2px solid var(--gold, #C9921A);
      border-radius: 10px;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; transition: all .2s;
      text-align: center;
      font-family: inherit;
    }
    .mode-btn.active {
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
      font-weight: 600;
    }
    .mode-btn:hover { background: rgba(201,146,26,.12); }
    .mode-btn.active:hover { background: var(--gold, #C9921A); }

    .practice-stats-bar {
      display: flex; justify-content: space-between;
      align-items: center; margin-bottom: 1rem;
      font-size: .8rem; color: var(--text-mid, #5A3820);
    }
    .streak-display { color: var(--gold, #C9921A); font-weight: 600; }
    .progress-bar {
      width: 100%; height: 6px;
      background: rgba(201,146,26,.15);
      border-radius: 3px; overflow: hidden;
      margin-bottom: 1.5rem;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--gold, #C9921A), var(--gold-light, #F0C040));
      border-radius: 3px;
      transition: width .4s ease;
    }

    .flashcard {
      max-width: 480px; margin: 0 auto;
      background: var(--white, #fff);
      border-radius: 16px;
      min-height: 280px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 2rem;
      box-shadow: 0 8px 40px rgba(44,26,14,.1);
      cursor: pointer;
      transition: transform .3s;
      text-align: center;
      perspective: 1000px;
    }
    .flashcard:hover { transform: translateY(-4px); }
    .flashcard .front-text {
      font-size: 3rem; line-height: 1.3;
      color: var(--red-dark, #5C0F0F);
      margin-bottom: .5rem;
    }
    .flashcard .front-sub {
      font-size: 1rem; color: var(--text-light, #8B6345);
      font-style: italic;
    }
    .flashcard .back { display: none; text-align: center; }
    .flashcard.flipped .front-text,
    .flashcard.flipped .front-sub { display: none; }
    .flashcard.flipped .back { display: block; }
    .flashcard .back-meaning {
      font-size: 1.6rem; font-weight: 600;
      color: var(--text, #2C1A0E); margin-bottom: .8rem;
    }
    .flashcard .back-example {
      font-size: .95rem; color: var(--text-mid, #5A3820);
      line-height: 1.6;
    }
    .flashcard-nav {
      display: flex; gap: 1rem; justify-content: center;
      margin-top: 1.5rem;
    }
    .fc-btn {
      padding: .6rem 1.5rem;
      border: 2px solid var(--gold, #C9921A);
      border-radius: 8px;
      background: transparent;
      color: var(--text, #2C1A0E);
      font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; transition: all .2s;
      font-family: inherit;
    }
    .fc-btn:hover { background: rgba(201,146,26,.12); }
    .fc-btn.primary {
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
    }

    /* Multiple Choice */
    .mc-question {
      text-align: center; margin-bottom: 1.5rem;
    }
    .mc-question .mc-word {
      font-size: 2.8rem;
      color: var(--red-dark, #5C0F0F);
      margin-bottom: .3rem;
    }
    .mc-question .mc-hint {
      font-size: .9rem; color: var(--text-light, #8B6345);
      font-style: italic;
    }
    .mc-options {
      display: grid; grid-template-columns: 1fr 1fr; gap: .8rem;
      max-width: 500px; margin: 0 auto;
    }
    .mc-opt {
      padding: 1rem;
      border: 2px solid #E0CCAA;
      border-radius: 10px;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      font-size: .95rem;
      cursor: pointer; transition: all .2s;
      text-align: center;
      font-family: inherit;
    }
    .mc-opt:hover { border-color: var(--gold, #C9921A); background: rgba(201,146,26,.06); }
    .mc-opt.correct { border-color: #27AE60; background: rgba(39,174,96,.1); color: #27AE60; }
    .mc-opt.wrong { border-color: #E74C3C; background: rgba(231,76,60,.1); color: #E74C3C; }

    /* Typing */
    .type-prompt {
      text-align: center; margin-bottom: 1.5rem;
    }
    .type-prompt .type-meaning {
      font-size: 1.4rem; font-weight: 600;
      color: var(--text, #2C1A0E); margin-bottom: .3rem;
    }
    .type-prompt .type-cat {
      font-size: .75rem; text-transform: uppercase; letter-spacing: .1em;
      color: var(--text-light, #8B6345);
    }
    .type-input-wrap {
      max-width: 400px; margin: 0 auto; text-align: center;
    }
    .type-input-wrap input {
      width: 100%; padding: .8rem 1rem;
      border: 2px solid #E0CCAA; border-radius: 10px;
      font-size: 1.1rem; text-align: center;
      outline: none; transition: border-color .2s;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      font-family: inherit;
    }
    .type-input-wrap input:focus { border-color: var(--gold, #C9921A); }
    .type-input-wrap input.correct { border-color: #27AE60; background: rgba(39,174,96,.06); }
    .type-input-wrap input.wrong { border-color: #E74C3C; background: rgba(231,76,60,.06); }
    .type-feedback {
      margin-top: .8rem; font-size: .9rem;
      color: var(--text-mid, #5A3820);
    }

    /* ── Chat ── */
    .chat-scenarios {
      display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem;
    }
    .scenario-btn {
      padding: .5rem 1rem;
      border: 1.5px solid var(--gold, #C9921A);
      border-radius: 20px;
      background: transparent;
      color: var(--text-mid, #5A3820);
      font-size: .78rem; cursor: pointer; transition: all .2s;
      font-family: inherit;
    }
    .scenario-btn.active {
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
    }
    .scenario-btn:hover { background: rgba(201,146,26,.12); }

    .chat-window {
      background: var(--white, #fff);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(44,26,14,.08);
      min-height: 350px;
      max-height: 500px;
      overflow-y: auto;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: .8rem;
    }
    .chat-msg {
      max-width: 80%; padding: .8rem 1rem;
      border-radius: 12px; font-size: .9rem; line-height: 1.5;
    }
    .chat-msg.bot {
      align-self: flex-start;
      background: rgba(201,146,26,.1);
      border-bottom-left-radius: 4px;
      color: var(--text, #2C1A0E);
    }
    .chat-msg.user {
      align-self: flex-end;
      background: var(--red-dark, #5C0F0F);
      color: var(--ivory, #FDF6EC);
      border-bottom-right-radius: 4px;
    }
    .chat-msg .translation {
      display: none;
      margin-top: .4rem; padding-top: .4rem;
      border-top: 1px solid rgba(201,146,26,.2);
      font-size: .8rem; font-style: italic;
      color: var(--text-light, #8B6345);
    }
    .chat-msg .translation.visible { display: block; }
    .chat-msg .show-trans {
      background: none; border: none;
      color: var(--gold, #C9921A);
      font-size: .72rem; cursor: pointer;
      margin-top: .3rem; text-decoration: underline;
      font-family: inherit;
    }
    .chat-input-row {
      display: flex; gap: .5rem;
    }
    .chat-input-row input {
      flex: 1; padding: .65rem 1rem;
      border: 1.5px solid #E0CCAA; border-radius: 8px;
      font-size: .9rem; outline: none;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      font-family: inherit;
    }
    .chat-input-row input:focus { border-color: var(--gold, #C9921A); }
    .chat-input-row button {
      padding: .65rem 1.2rem;
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
      border: none; border-radius: 8px;
      font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; transition: background .2s;
      font-family: inherit;
    }
    .chat-input-row button:hover { background: var(--gold-light, #F0C040); }

    /* ── Settings Modal ── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.5);
      display: none; align-items: center; justify-content: center;
      z-index: 100;
      animation: fadeIn .2s ease;
    }
    .modal-overlay.open { display: flex; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--white, #fff);
      border-radius: 16px;
      padding: 2rem;
      max-width: 420px; width: 90%;
      box-shadow: 0 20px 60px rgba(44,26,14,.25);
      max-height: 90vh; overflow-y: auto;
    }
    .modal h2 {
      font-family: var(--ff-display, 'Playfair Display', serif);
      font-size: 1.5rem; color: var(--red-dark, #5C0F0F);
      margin-bottom: 1.5rem;
    }
    .setting-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: .8rem 0;
      border-bottom: 1px solid rgba(201,146,26,.15);
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-label {
      font-size: .85rem; color: var(--text, #2C1A0E);
    }
    .setting-label small {
      display: block; font-size: .72rem;
      color: var(--text-light, #8B6345); margin-top: .15rem;
    }
    .toggle {
      width: 44px; height: 24px;
      background: #ccc; border-radius: 12px;
      position: relative; cursor: pointer;
      border: none; transition: background .2s;
    }
    .toggle.on { background: var(--gold, #C9921A); }
    .toggle::after {
      content: '';
      position: absolute; top: 2px; left: 2px;
      width: 20px; height: 20px;
      background: #fff; border-radius: 50%;
      transition: transform .2s;
    }
    .toggle.on::after { transform: translateX(20px); }
    select.setting-select {
      padding: .4rem .8rem;
      border: 1.5px solid #E0CCAA;
      border-radius: 6px;
      font-size: .85rem;
      background: var(--white, #fff);
      color: var(--text, #2C1A0E);
      font-family: inherit;
    }
    .font-slider {
      width: 120px; accent-color: var(--gold, #C9921A);
    }
    .reset-btn {
      width: 100%; margin-top: 1rem;
      padding: .7rem;
      border: 2px solid #E74C3C;
      border-radius: 8px;
      background: transparent;
      color: #E74C3C;
      font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; transition: all .2s;
      font-family: inherit;
    }
    .reset-btn:hover { background: #E74C3C; color: #fff; }
    .modal-close {
      width: 100%; margin-top: .8rem;
      padding: .7rem;
      border: none; border-radius: 8px;
      background: var(--gold, #C9921A);
      color: var(--red-dark, #5C0F0F);
      font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer;
      font-family: inherit;
    }

    .section-title {
      font-family: var(--ff-display, 'Playfair Display', serif);
      font-size: 1.6rem; font-weight: 400;
      color: var(--red-dark, #5C0F0F);
      margin-bottom: 1rem;
    }

    @media (max-width: 600px) {
      .vocab-grid { grid-template-columns: 1fr; }
      .mc-options { grid-template-columns: 1fr; }
      .flashcard .front-text { font-size: 2.2rem; }
    }
  `;
  document.head.appendChild(style);
  return style;
}

// ── Build App Shell ──
function buildShell() {
  document.body.innerHTML = '';
  if (settings.darkMode) document.body.classList.add('dark');

  // Header
  const header = el('div', { className: 'app-header' });
  header.innerHTML = `
    <div class="app-logo"><span>Muskaan</span> Punjabi</div>
    <button class="settings-btn" id="settingsBtn" aria-label="Settings">&#9881;</button>
  `;
  document.body.appendChild(header);

  // Main
  const main = el('div', { className: 'app-main', id: 'appMain' });
  document.body.appendChild(main);

  // Nav
  const nav = el('nav', { className: 'app-nav', id: 'appNav' });
  const tabs = [
    { id: 'vocabulary', icon: '\u{1F4DA}', label: 'Words' },
    { id: 'practice',   icon: '\u{1F3AF}', label: 'Practice' },
    { id: 'chat',       icon: '\u{1F4AC}', label: 'Chat' }
  ];
  tabs.forEach(t => {
    const btn = el('button', {
      className: 'nav-tab' + (state.currentView === t.id ? ' active' : ''),
      'data-view': t.id
    });
    btn.innerHTML = `<span class="nav-icon">${t.icon}</span>${t.label}`;
    btn.addEventListener('click', () => switchView(t.id));
    nav.appendChild(btn);
  });
  document.body.appendChild(nav);

  // Settings modal
  const overlay = el('div', { className: 'modal-overlay', id: 'settingsModal' });
  overlay.innerHTML = buildSettingsHTML();
  document.body.appendChild(overlay);

  // Wire settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
  });

  // Build all views
  buildVocabularyView();
  buildPracticeView();
  buildChatView();

  // Show current view
  switchView(state.currentView);
  wireSettings();
}

function el(tag, attrs) {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else e.setAttribute(k, v);
  });
  return e;
}

// ── View Switching ──
function switchView(id) {
  state.currentView = id;
  saveState();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === id);
  });
}

// ══════════════════════════════════════════════════
// VOCABULARY VIEW
// ══════════════════════════════════════════════════
function buildVocabularyView() {
  const view = el('div', { className: 'view', id: 'view-vocabulary' });
  view.innerHTML = `
    <h2 class="section-title">Vocabulary</h2>
    <div class="search-bar">
      <input type="text" id="vocabSearch" placeholder="Search words..." />
    </div>
    <div class="filter-pills" id="vocabFilters"></div>
    <div class="vocab-stats" id="vocabStats"></div>
    <div class="vocab-grid" id="vocabGrid"></div>
  `;
  document.getElementById('appMain').appendChild(view);

  const categories = ['all', 'home', 'farm', 'nature', 'body', 'food', 'kinship', 'emotion', 'time'];
  const filtersEl = view.querySelector('#vocabFilters');
  let activeFilter = 'all';

  categories.forEach(c => {
    const pill = el('button', { className: 'pill' + (c === 'all' ? ' active' : '') });
    pill.textContent = c;
    pill.addEventListener('click', () => {
      activeFilter = c;
      filtersEl.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.textContent === c));
      renderVocabGrid();
    });
    filtersEl.appendChild(pill);
  });

  const searchInput = view.querySelector('#vocabSearch');
  searchInput.addEventListener('input', () => renderVocabGrid());

  function renderVocabGrid() {
    const query = searchInput.value.toLowerCase().trim();
    const grid = view.querySelector('#vocabGrid');
    const statsEl = view.querySelector('#vocabStats');
    grid.innerHTML = '';

    let filtered = VOCABULARY;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(w => w.category === activeFilter);
    }
    if (query) {
      filtered = filtered.filter(w =>
        w.gurmukhi.includes(query) ||
        w.latin.toLowerCase().includes(query) ||
        w.meaning.toLowerCase().includes(query)
      );
    }

    statsEl.innerHTML = `
      Showing <strong>${filtered.length}</strong> words &middot;
      <strong>${state.learned.length}</strong> learned
    `;

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-msg">No words found. Try a different search.</div>';
      return;
    }

    filtered.forEach(w => {
      const card = el('div', {
        className: 'vocab-card' + (state.learned.includes(w.id) ? ' learned' : '')
      });
      card.innerHTML = `
        <button class="learn-btn" data-id="${w.id}" title="Toggle learned">
          ${state.learned.includes(w.id) ? '\u2705' : '\u2B50'}
        </button>
        <div class="gurmukhi">${w.gurmukhi}</div>
        <div class="latin">${w.latin}</div>
        <span class="pos-badge">${w.pos}</span>
        <span class="cat-tag">${w.category}</span>
        <div class="meaning">${w.meaning}</div>
        <div class="example">
          <div>${w.example.gurmukhi}</div>
          <div style="font-style:italic;margin-top:.2rem">${w.example.latin}</div>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.learn-btn')) return;
        card.classList.toggle('expanded');
      });
      card.querySelector('.learn-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const id = w.id;
        if (state.learned.includes(id)) {
          state.learned = state.learned.filter(x => x !== id);
          card.classList.remove('learned');
          card.querySelector('.learn-btn').textContent = '\u2B50';
        } else {
          state.learned.push(id);
          card.classList.add('learned');
          card.querySelector('.learn-btn').textContent = '\u2705';
        }
        saveState();
        statsEl.innerHTML = `
          Showing <strong>${filtered.length}</strong> words &middot;
          <strong>${state.learned.length}</strong> learned
        `;
      });
      grid.appendChild(card);
    });
  }

  renderVocabGrid();
}

// ══════════════════════════════════════════════════
// PRACTICE VIEW
// ══════════════════════════════════════════════════
let practiceMode = 'flashcard';
let practiceCategory = 'all';
let practiceIndex = 0;
let practiceSet = [];
let practiceRound = 0;
const ROUND_SIZE = 10;

function buildPracticeView() {
  const view = el('div', { className: 'view', id: 'view-practice' });
  view.innerHTML = `
    <h2 class="section-title">Practice</h2>
    <div class="practice-modes" id="practiceModes">
      <button class="mode-btn active" data-mode="flashcard">Flash Cards</button>
      <button class="mode-btn" data-mode="mcq">Multiple Choice</button>
      <button class="mode-btn" data-mode="typing">Typing</button>
    </div>
    <div class="filter-pills" id="practiceFilters"></div>
    <div class="practice-stats-bar" id="practiceStatsBar"></div>
    <div class="progress-bar"><div class="progress-fill" id="practiceFill"></div></div>
    <div id="practiceArea"></div>
  `;
  document.getElementById('appMain').appendChild(view);

  // Mode buttons
  view.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      practiceMode = btn.dataset.mode;
      view.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      startPractice();
    });
  });

  // Category filters
  const cats = ['all', 'home', 'farm', 'nature', 'body', 'food', 'kinship', 'emotion', 'time'];
  const filtersEl = view.querySelector('#practiceFilters');
  cats.forEach(c => {
    const pill = el('button', { className: 'pill' + (c === 'all' ? ' active' : '') });
    pill.textContent = c;
    pill.addEventListener('click', () => {
      practiceCategory = c;
      filtersEl.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.textContent === c));
      startPractice();
    });
    filtersEl.appendChild(pill);
  });

  startPractice();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startPractice() {
  let pool = VOCABULARY;
  if (practiceCategory !== 'all') pool = pool.filter(w => w.category === practiceCategory);
  practiceSet = shuffle(pool).slice(0, ROUND_SIZE);
  practiceIndex = 0;
  practiceRound++;
  renderPractice();
}

function renderPracticeStats() {
  const bar = document.getElementById('practiceStatsBar');
  const fill = document.getElementById('practiceFill');
  if (!bar) return;
  const s = state.practiceStats;
  bar.innerHTML = `
    <span>Correct: ${s.correct} | Wrong: ${s.wrong}</span>
    <span class="streak-display">Streak: ${s.streak} (Best: ${s.bestStreak})</span>
  `;
  const pct = practiceSet.length > 0 ? (practiceIndex / practiceSet.length * 100) : 0;
  fill.style.width = pct + '%';
}

function renderPractice() {
  const area = document.getElementById('practiceArea');
  renderPracticeStats();
  if (practiceIndex >= practiceSet.length) {
    area.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:.8rem">\u{1F389}</div>
        <h3 style="font-family:var(--ff-display);color:var(--red-dark);margin-bottom:.5rem">Round Complete!</h3>
        <p style="color:var(--text-mid);margin-bottom:1rem">
          Correct: ${state.practiceStats.correct} | Best Streak: ${state.practiceStats.bestStreak}
        </p>
        <button class="fc-btn primary" id="nextRound">Next Round</button>
      </div>
    `;
    area.querySelector('#nextRound').addEventListener('click', startPractice);
    return;
  }

  const word = practiceSet[practiceIndex];

  if (practiceMode === 'flashcard') renderFlashcard(area, word);
  else if (practiceMode === 'mcq') renderMCQ(area, word);
  else renderTyping(area, word);
}

function recordAnswer(correct) {
  if (correct) {
    state.practiceStats.correct++;
    state.practiceStats.streak++;
    if (state.practiceStats.streak > state.practiceStats.bestStreak)
      state.practiceStats.bestStreak = state.practiceStats.streak;
  } else {
    state.practiceStats.wrong++;
    state.practiceStats.streak = 0;
  }
  saveState();
}

function renderFlashcard(area, word) {
  area.innerHTML = `
    <div class="flashcard" id="flashcard">
      <div class="front-text">${word.gurmukhi}</div>
      <div class="front-sub">${word.latin} &middot; ${word.pos}</div>
      <div class="back">
        <div class="back-meaning">${word.meaning}</div>
        <div class="back-example">
          ${word.example.gurmukhi}<br>
          <em>${word.example.latin}</em>
        </div>
      </div>
    </div>
    <div class="flashcard-nav">
      <button class="fc-btn" id="fcKnew">I knew it</button>
      <button class="fc-btn" id="fcDidnt">Didn't know</button>
      <button class="fc-btn primary" id="fcNext">Next</button>
    </div>
  `;
  const card = area.querySelector('#flashcard');
  card.addEventListener('click', () => card.classList.toggle('flipped'));
  area.querySelector('#fcKnew').addEventListener('click', () => { recordAnswer(true); practiceIndex++; renderPractice(); });
  area.querySelector('#fcDidnt').addEventListener('click', () => { recordAnswer(false); practiceIndex++; renderPractice(); });
  area.querySelector('#fcNext').addEventListener('click', () => { practiceIndex++; renderPractice(); });
}

function renderMCQ(area, word) {
  const numChoices = settings.difficulty === 'beginner' ? 3 : settings.difficulty === 'intermediate' ? 4 : 5;
  const others = shuffle(VOCABULARY.filter(w => w.id !== word.id)).slice(0, numChoices - 1);
  const options = shuffle([word, ...others]);

  area.innerHTML = `
    <div class="mc-question">
      <div class="mc-word">${word.gurmukhi}</div>
      <div class="mc-hint">${word.latin} &middot; ${word.pos}</div>
    </div>
    <div class="mc-options" id="mcOptions">
      ${options.map(o => `<button class="mc-opt" data-id="${o.id}">${o.meaning}</button>`).join('')}
    </div>
  `;
  let answered = false;
  area.querySelectorAll('.mc-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const correct = parseInt(btn.dataset.id) === word.id;
      btn.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) {
        area.querySelector(`.mc-opt[data-id="${word.id}"]`).classList.add('correct');
      }
      recordAnswer(correct);
      setTimeout(() => { practiceIndex++; renderPractice(); }, 1000);
    });
  });
}

function renderTyping(area, word) {
  area.innerHTML = `
    <div class="type-prompt">
      <div class="type-meaning">${word.meaning}</div>
      <div class="type-cat">${word.category} &middot; ${word.pos}</div>
    </div>
    <div class="type-input-wrap">
      <input type="text" id="typeInput" placeholder="Type the romanized word..." autocomplete="off" />
      <div class="type-feedback" id="typeFeedback"></div>
    </div>
    <div class="flashcard-nav" style="margin-top:1rem">
      <button class="fc-btn" id="typeSkip">Skip</button>
      <button class="fc-btn primary" id="typeCheck">Check</button>
    </div>
  `;
  const input = area.querySelector('#typeInput');
  const feedback = area.querySelector('#typeFeedback');
  input.focus();

  function check() {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const correct = val === word.latin.toLowerCase();
    input.classList.add(correct ? 'correct' : 'wrong');
    if (correct) {
      feedback.innerHTML = `Correct! <strong>${word.gurmukhi}</strong>`;
    } else {
      feedback.innerHTML = `Answer: <strong>${word.latin}</strong> (${word.gurmukhi})`;
    }
    recordAnswer(correct);
    setTimeout(() => { practiceIndex++; renderPractice(); }, 1200);
  }

  area.querySelector('#typeCheck').addEventListener('click', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  area.querySelector('#typeSkip').addEventListener('click', () => {
    recordAnswer(false);
    practiceIndex++;
    renderPractice();
  });
}

// ══════════════════════════════════════════════════
// CHAT VIEW
// ══════════════════════════════════════════════════
const SCENARIOS = [
  {
    id: 'greeting', name: 'Greetings',
    intro: { gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', english: 'Hello! How are you?' },
    prompts: [
      { bot: { gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', latin: 'Sat sri akaal! Tuseen kiven ho?', english: 'Hello! How are you?' },
        hints: ['ਮੈਂ ਠੀਕ ਹਾਂ', 'main theek haan', 'I am fine'] },
      { bot: { gurmukhi: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', latin: 'Tuhaada naan ki hai?', english: 'What is your name?' },
        hints: ['ਮੇਰਾ ਨਾਂ ___ ਹੈ', 'mera naan ___ hai', 'My name is ___'] },
      { bot: { gurmukhi: 'ਤੁਸੀਂ ਕਿੱਥੋਂ ਹੋ?', latin: 'Tuseen kitthon ho?', english: 'Where are you from?' },
        hints: ['ਮੈਂ ___ ਤੋਂ ਹਾਂ', 'main ___ ton haan', 'I am from ___'] },
      { bot: { gurmukhi: 'ਬਹੁਤ ਵਧੀਆ! ਮਿਲ ਕੇ ਖ਼ੁਸ਼ੀ ਹੋਈ।', latin: 'Bahut vadhia! Mil ke khushi hoee.', english: 'Very nice! Pleased to meet you.' },
        hints: ['ਮੈਨੂੰ ਵੀ', 'mainoon vi', 'Me too'] }
    ]
  },
  {
    id: 'market', name: 'At the Market',
    intro: { gurmukhi: 'ਬਾਜ਼ਾਰ ਵਿੱਚ ਖ਼ਰੀਦਦਾਰੀ', english: 'Shopping at the market' },
    prompts: [
      { bot: { gurmukhi: 'ਜੀ ਆਇਆਂ ਨੂੰ! ਕੀ ਚਾਹੀਦਾ ਹੈ?', latin: 'Ji aaiaan noon! Ki chaahida hai?', english: 'Welcome! What do you need?' },
        hints: ['ਮੈਨੂੰ ਸਬਜ਼ੀ ਚਾਹੀਦੀ ਹੈ', 'mainoon sabzi chaahidi hai', 'I need vegetables'] },
      { bot: { gurmukhi: 'ਆਲੂ ਅਤੇ ਟਮਾਟਰ ਤਾਜ਼ੇ ਹਨ। ਕਿੰਨੇ ਕਿਲੋ?', latin: 'Aaloo ate tamaatar taaze han. Kinne kilo?', english: 'Potatoes and tomatoes are fresh. How many kilos?' },
        hints: ['ਦੋ ਕਿਲੋ ਦਿਓ', 'do kilo dio', 'Give me two kilos'] },
      { bot: { gurmukhi: 'ਕਿੰਨੇ ਪੈਸੇ ਹੋਏ?', latin: 'Kinne paise hoe?', english: 'How much does it cost?' },
        hints: ['ਸੌ ਰੁਪਏ', 'sau rupae', 'Hundred rupees'] },
      { bot: { gurmukhi: 'ਧੰਨਵਾਦ! ਫਿਰ ਆਇਓ।', latin: 'Dhanvaad! Phir aaio.', english: 'Thank you! Come again.' },
        hints: ['ਧੰਨਵਾਦ ਜੀ', 'dhanvaad ji', 'Thank you'] }
    ]
  },
  {
    id: 'family', name: 'Family Intro',
    intro: { gurmukhi: 'ਪਰਿਵਾਰ ਦੀ ਜਾਣ-ਪਛਾਣ', english: 'Introducing family' },
    prompts: [
      { bot: { gurmukhi: 'ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਵਿੱਚ ਕੌਣ ਕੌਣ ਹੈ?', latin: 'Tuhaade parivaar vich kaun kaun hai?', english: 'Who is in your family?' },
        hints: ['ਮੇਰੇ ਮਾਂ ਪਿਤਾ ਅਤੇ ਭੈਣ ਹੈ', 'mere maan pita ate bhain hai', 'My parents and sister'] },
      { bot: { gurmukhi: 'ਤੁਹਾਡੇ ਪਿਤਾ ਜੀ ਕੀ ਕੰਮ ਕਰਦੇ ਹਨ?', latin: 'Tuhaade pita ji ki kamm karde han?', english: 'What does your father do?' },
        hints: ['ਉਹ ਕਿਸਾਨ ਹਨ', 'oh kisaan han', 'He is a farmer'] },
      { bot: { gurmukhi: 'ਤੁਹਾਡੀ ਭੈਣ ਕਿੰਨੀ ਉਮਰ ਦੀ ਹੈ?', latin: 'Tuhaadi bhain kinni umar di hai?', english: 'How old is your sister?' },
        hints: ['ਉਹ ਵੀਹ ਸਾਲ ਦੀ ਹੈ', 'oh veeh saal di hai', 'She is twenty years old'] },
      { bot: { gurmukhi: 'ਬਹੁਤ ਸੋਹਣਾ ਪਰਿਵਾਰ ਹੈ!', latin: 'Bahut sohna parivaar hai!', english: 'What a lovely family!' },
        hints: ['ਧੰਨਵਾਦ ਜੀ', 'dhanvaad ji', 'Thank you'] }
    ]
  },
  {
    id: 'food', name: 'Food & Cooking',
    intro: { gurmukhi: 'ਖਾਣਾ ਬਣਾਉਣਾ', english: 'Cooking food' },
    prompts: [
      { bot: { gurmukhi: 'ਅੱਜ ਕੀ ਖਾਣਾ ਬਣਾਈਏ?', latin: 'Ajj ki khaana banaaeae?', english: 'What should we cook today?' },
        hints: ['ਸਾਗ ਅਤੇ ਮੱਕੀ ਦੀ ਰੋਟੀ', 'saag ate makki di roti', 'Mustard greens and corn bread'] },
      { bot: { gurmukhi: 'ਸਾਗ ਲਈ ਕੀ ਚਾਹੀਦਾ ਹੈ?', latin: 'Saag laee ki chaahida hai?', english: 'What do we need for saag?' },
        hints: ['ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ ਅਤੇ ਮੱਖਣ', 'sarhon da saag ate makkhan', 'Mustard greens and butter'] },
      { bot: { gurmukhi: 'ਬਹੁਤ ਸੁਆਦ ਬਣਿਆ ਹੈ!', latin: 'Bahut suaad banya hai!', english: 'It turned out very tasty!' },
        hints: ['ਹਾਂ ਜੀ ਬਹੁਤ ਸੁਆਦ ਹੈ', 'haan ji bahut suaad hai', 'Yes, it is very tasty'] },
      { bot: { gurmukhi: 'ਹੋਰ ਰੋਟੀ ਲਓ?', latin: 'Hor roti lao?', english: 'Have some more bread?' },
        hints: ['ਹਾਂ ਜੀ ਇੱਕ ਹੋਰ', 'haan ji ikk hor', 'Yes, one more please'] }
    ]
  },
  {
    id: 'weather', name: 'Weather',
    intro: { gurmukhi: 'ਮੌਸਮ ਬਾਰੇ ਗੱਲ', english: 'Talking about weather' },
    prompts: [
      { bot: { gurmukhi: 'ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ?', latin: 'Ajj mausam kiho jiha hai?', english: 'How is the weather today?' },
        hints: ['ਅੱਜ ਬਹੁਤ ਗਰਮੀ ਹੈ', 'ajj bahut garmi hai', 'It is very hot today'] },
      { bot: { gurmukhi: 'ਕੀ ਮੀਂਹ ਪਵੇਗਾ?', latin: 'Ki meenh pavega?', english: 'Will it rain?' },
        hints: ['ਹਾਂ ਬੱਦਲ ਆ ਰਹੇ ਹਨ', 'haan baddal aa rahe han', 'Yes, clouds are coming'] },
      { bot: { gurmukhi: 'ਸਰਦੀ ਲੱਗ ਰਹੀ ਹੈ।', latin: 'Sardi lagg rahi hai.', english: 'It is getting cold.' },
        hints: ['ਸਵੈਟਰ ਪਾ ਲਓ', 'sweater paa lao', 'Put on a sweater'] },
      { bot: { gurmukhi: 'ਬਾਹਰ ਧੁੱਪ ਨਿਕਲ ਆਈ ਹੈ!', latin: 'Baahar dhupp nikal aai hai!', english: 'The sun has come out!' },
        hints: ['ਚਲੋ ਸੈਰ ਕਰੀਏ', 'chalo sair kariae', 'Let us go for a walk'] }
    ]
  }
];

let chatScenario = null;
let chatStep = 0;

function buildChatView() {
  const view = el('div', { className: 'view', id: 'view-chat' });
  view.innerHTML = `
    <h2 class="section-title">Chat Practice</h2>
    <div class="chat-scenarios" id="chatScenarios"></div>
    <div class="chat-window" id="chatWindow">
      <div class="chat-msg bot">Pick a scenario above to start a conversation!</div>
    </div>
    <div class="chat-input-row">
      <input type="text" id="chatInput" placeholder="Type your reply..." disabled />
      <button id="chatSend" disabled>Send</button>
    </div>
  `;
  document.getElementById('appMain').appendChild(view);

  const scenariosEl = view.querySelector('#chatScenarios');
  SCENARIOS.forEach(s => {
    const btn = el('button', { className: 'scenario-btn' });
    btn.textContent = s.name;
    btn.addEventListener('click', () => {
      scenariosEl.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      startScenario(s);
    });
    scenariosEl.appendChild(btn);
  });

  const input = view.querySelector('#chatInput');
  const sendBtn = view.querySelector('#chatSend');
  sendBtn.addEventListener('click', () => sendChat());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function startScenario(scenario) {
  chatScenario = scenario;
  chatStep = 0;
  const win = document.getElementById('chatWindow');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  win.innerHTML = '';
  input.disabled = false;
  sendBtn.disabled = false;

  addBotMessage(scenario.prompts[0].bot, scenario.prompts[0].hints);
}

function addBotMessage(msg, hints) {
  const win = document.getElementById('chatWindow');
  const div = el('div', { className: 'chat-msg bot' });
  div.innerHTML = `
    <div>${msg.gurmukhi}</div>
    <div style="font-style:italic;font-size:.82rem;margin-top:.2rem;color:var(--text-light)">${msg.latin}</div>
    <button class="show-trans">Show translation</button>
    <div class="translation">${msg.english}</div>
    ${hints ? `<div class="translation" style="display:none;margin-top:.2rem"><strong>Hint:</strong> ${hints[0]} (${hints[1]}) — ${hints[2]}</div>` : ''}
  `;
  const transBtn = div.querySelector('.show-trans');
  transBtn.addEventListener('click', () => {
    div.querySelectorAll('.translation').forEach(t => t.classList.toggle('visible'));
    transBtn.textContent = transBtn.textContent === 'Show translation' ? 'Hide' : 'Show translation';
  });
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !chatScenario) return;

  const win = document.getElementById('chatWindow');
  const userDiv = el('div', { className: 'chat-msg user' });
  userDiv.textContent = text;
  win.appendChild(userDiv);
  input.value = '';

  chatStep++;
  if (chatStep < chatScenario.prompts.length) {
    setTimeout(() => {
      addBotMessage(chatScenario.prompts[chatStep].bot, chatScenario.prompts[chatStep].hints);
    }, 500);
  } else {
    setTimeout(() => {
      const endDiv = el('div', { className: 'chat-msg bot' });
      endDiv.innerHTML = `
        <div>Conversation complete! Pick another scenario or try again.</div>
      `;
      win.appendChild(endDiv);
      win.scrollTop = win.scrollHeight;
      document.getElementById('chatInput').disabled = true;
      document.getElementById('chatSend').disabled = true;
    }, 500);
  }
  win.scrollTop = win.scrollHeight;
}

// ══════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════
function buildSettingsHTML() {
  return `
    <div class="modal">
      <h2>Settings</h2>
      <div class="setting-row">
        <div class="setting-label">Dark Mode<small>Switch between light and dark theme</small></div>
        <button class="toggle ${settings.darkMode ? 'on' : ''}" id="toggleDark"></button>
      </div>
      <div class="setting-row">
        <div class="setting-label">Difficulty<small>Controls quiz options and hints</small></div>
        <select class="setting-select" id="selectDifficulty">
          <option value="beginner" ${settings.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
          <option value="intermediate" ${settings.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
          <option value="advanced" ${settings.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
        </select>
      </div>
      <div class="setting-row">
        <div class="setting-label">Font Size<small>${settings.fontSize}px</small></div>
        <input type="range" class="font-slider" id="fontSlider" min="12" max="22" value="${settings.fontSize}" />
      </div>
      <button class="reset-btn" id="resetProgress">Reset All Progress</button>
      <button class="modal-close" id="closeSettings">Close</button>
    </div>
  `;
}

function wireSettings() {
  const modal = document.getElementById('settingsModal');

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.getElementById('closeSettings').addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // Dark mode toggle
  document.getElementById('toggleDark').addEventListener('click', function() {
    settings.darkMode = !settings.darkMode;
    this.classList.toggle('on', settings.darkMode);
    document.body.classList.toggle('dark', settings.darkMode);
    saveSettings();
  });

  // Difficulty
  document.getElementById('selectDifficulty').addEventListener('change', function() {
    settings.difficulty = this.value;
    saveSettings();
  });

  // Font size
  document.getElementById('fontSlider').addEventListener('input', function() {
    settings.fontSize = parseInt(this.value);
    document.documentElement.style.fontSize = settings.fontSize + 'px';
    this.closest('.setting-row').querySelector('small').textContent = settings.fontSize + 'px';
    saveSettings();
  });

  // Reset
  document.getElementById('resetProgress').addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      state = { ...defaultState };
      saveState();
      modal.classList.remove('open');
      buildShell();
    }
  });
}

// ── Update index.html reference ──
// The app expects vocabulary.js to be loaded before script.js

// ── Init ──
const styleEl = injectStyles();
buildShell();

})();
