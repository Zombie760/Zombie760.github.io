// BOTWAVEBOMBA — Theme Switcher
// 12 colorways: editorial + sports + aesthetic + functional

const THEMES = [
  // ── Editorial ──
  {
    id: 'default',
    label: 'COLD SIGNAL',
    primary: '#3b82f6',
    accent: '#ef4444',
    gold: '#f59e0b',
  },
  {
    id: 'morning-edition',
    label: 'MORNING EDITION',
    primary: '#1A1A1A',
    accent: '#B22222',
    gold: '#8B7355',
    note: 'Classic broadsheet · Cream paper · Black ink'
  },
  // ── SoCal Sports ──
  {
    id: 'powder-blue',
    label: 'POWDER BLUE',
    primary: '#0080C6',
    accent: '#FFC20E',
    gold: '#FFC20E',
    note: 'SD Chargers · Old School · PMS 285C'
  },
  {
    id: 'chargers-navy',
    label: 'BOLT NAVY',
    primary: '#002244',
    accent: '#FFB612',
    gold: '#FFB612',
    note: 'SD Chargers · Seau/Means Era · PMS 289C'
  },
  {
    id: 'dodgers',
    label: 'DODGER BLUE',
    primary: '#005A9C',
    accent: '#EF3E42',
    gold: '#EF3E42',
    note: 'Los Angeles Dodgers · PMS 294C'
  },
  {
    id: 'lakers',
    label: 'SHOWTIME',
    primary: '#552583',
    accent: '#FDB927',
    gold: '#FDB927',
    note: 'Los Angeles Lakers · PMS 268C'
  },
  {
    id: 'padres',
    label: 'SWINGIN FRIAR',
    primary: '#FFC425',
    accent: '#E87722',
    gold: '#693F23',
    note: 'San Diego Padres · Brown & Gold · PMS 469C / 7-8C'
  },
  // ── Aesthetic ──
  {
    id: 'green-screen',
    label: 'GREEN SCREEN',
    primary: '#00FF41',
    accent: '#FFB000',
    gold: '#00CC33',
    note: 'Terminal phosphor · Amber optional · PDP-11 aesthetic'
  },
  {
    id: 'sage-brush',
    label: 'SAGE BRUSH',
    primary: '#8B8552',
    accent: '#C4A35A',
    gold: '#5C6B3C',
    note: 'Military intel · Olive/tan · DIA briefing room'
  },
  {
    id: 'global-south',
    label: 'GLOBAL SOUTH',
    primary: '#D2691E',
    accent: '#E8A838',
    gold: '#8B4513',
    note: 'Warm earth · Terracotta · Non-aligned bloc aesthetic'
  },
  {
    id: 'riot-club',
    label: 'RIOT CLUB',
    primary: '#FFD600',
    accent: '#FF0054',
    gold: '#FFD600',
    note: 'Punk flyer · Safety yellow/black · Maximum contrast'
  },
  // ── Functional ──
  {
    id: 'night-shift',
    label: 'NIGHT SHIFT',
    primary: '#AAAAAA',
    accent: '#CC4444',
    gold: '#888888',
    note: 'AMOLED black · Zero blue · 3am doomscroll'
  }
];

const STORAGE_KEY = 'bwb-theme';

function applyTheme(id) {
  var attr = id === 'default' ? '' : id;
  document.documentElement.setAttribute('data-theme', attr);
  localStorage.setItem(STORAGE_KEY, id);
  document.querySelectorAll('.bwb-theme-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.themeId === id);
  });
}

function buildThemeSwitcher() {
  var container = document.createElement('div');
  container.className = 'bwb-theme-switcher';
  container.setAttribute('aria-label', 'Theme switcher');

  var label = document.createElement('span');
  label.className = 'bwb-theme-switcher-label';
  label.textContent = 'COLORWAY';
  container.appendChild(label);

  THEMES.forEach(function(theme) {
    var btn = document.createElement('button');
    btn.className = 'bwb-theme-btn';
    btn.dataset.themeId = theme.id;
    btn.title = theme.note || theme.label;
    btn.setAttribute('aria-label', 'Switch to ' + theme.label + ' theme');

    var dot = document.createElement('span');
    dot.className = 'bwb-theme-dot';
    dot.style.background = theme.primary;
    dot.style.boxShadow = '2px 0 0 0 ' + theme.accent;

    var lbl = document.createElement('span');
    lbl.className = 'bwb-theme-btn-label';
    lbl.textContent = theme.label;

    btn.appendChild(dot);
    btn.appendChild(lbl);
    btn.addEventListener('click', function() { applyTheme(theme.id); });
    container.appendChild(btn);
  });

  return container;
}

function initThemes() {
  var saved = localStorage.getItem(STORAGE_KEY) || 'default';
  applyTheme(saved);

  var nav = document.querySelector('.bwb-topnav');
  if (nav) {
    nav.appendChild(buildThemeSwitcher());
  }
}

document.addEventListener('DOMContentLoaded', initThemes);
window.applyTheme = applyTheme;
