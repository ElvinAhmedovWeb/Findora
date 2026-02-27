// ===== Findora index.js — Enhanced Homepage =====
(() => {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('theme-icon');
  const input = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const aiBtn = document.getElementById('aiBtn');
  const luckyBtn = document.getElementById('luckyBtn');
  const imageSearchBtn = document.getElementById('imageSearchBtn');
  const recentBox = document.getElementById('recentSearches');
  const suggestionsBox = document.getElementById('suggestions');
  const aiQuick = document.getElementById('aiQuick');
  const aiQuickBody = document.getElementById('aiQuickBody');
  const loader = document.getElementById('loaderOverlay');
  const trendingGrid = document.getElementById('trendingGrid');

  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `${location.protocol}//${location.hostname}:3000`
    : `${location.protocol}//${location.host}`;

  // ── THEME ──
  const savedTheme = localStorage.getItem('findora_theme');
  if (savedTheme === 'dark') enableDark();

  themeToggle.addEventListener('click', () => {
    body.classList.contains('dark-mode') ? disableDark() : enableDark();
  });

  function enableDark() {
    body.classList.add('dark-mode');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    localStorage.setItem('findora_theme', 'dark');
  }
  function disableDark() {
    body.classList.remove('dark-mode');
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    localStorage.setItem('findora_theme', 'light');
  }

  // ── SEARCH ──
  searchBtn.addEventListener('click', performSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });

  function performSearch() {
    const q = input.value.trim();
    if (!q) return;
    saveRecent(q);
    hideSuggestions();
    loader.classList.add('active');
    setTimeout(() => {
      window.location.href = `search.html?id=${encodeURIComponent(q)}`;
    }, 600);
  }

  // ── I'M FEELING LUCKY ──
  luckyBtn.addEventListener('click', () => {
    const q = input.value.trim();
    if (!q) {
      // Random topic
      const topics = ['Azərbaycan', 'Süni intellekt', 'Mars planeti', 'Kvant fizikası', 'Bakı'];
      input.value = topics[Math.floor(Math.random() * topics.length)];
    }
    performSearch();
  });

  // ── IMAGE SEARCH ──
  imageSearchBtn.addEventListener('click', () => {
    const q = input.value.trim() || 'Azərbaycan';
    saveRecent(q);
    window.location.href = `search.html?id=${encodeURIComponent(q)}&type=image`;
  });

  // ── AI QUICK ANSWER ──
  aiBtn.addEventListener('click', async () => {
    const q = input.value.trim();
    if (!q) return;

    aiQuick.classList.add('active');
    aiQuickBody.innerHTML = '<span class="ai-typing">Düşünürəm</span>';

    try {
      const res = await fetch(`${API_BASE}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      if (data.answer) {
        typeWriter(aiQuickBody, data.answer);
      } else {
        aiQuickBody.textContent = data.error || 'Cavab alınmadı.';
      }
    } catch (err) {
      aiQuickBody.textContent = 'AI xidmətinə bağlanılmadı. Server işləyirmi?';
    }
  });

  function typeWriter(el, text) {
    el.innerHTML = '';
    // Convert markdown-like formatting
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    let i = 0;
    const htmlChars = [];
    let inTag = false;
    for (const ch of formatted) {
      if (ch === '<') inTag = true;
      if (inTag) {
        if (htmlChars.length > 0 && typeof htmlChars[htmlChars.length - 1] === 'object') {
          htmlChars[htmlChars.length - 1].tag += ch;
        } else {
          htmlChars.push({ tag: ch });
        }
        if (ch === '>') inTag = false;
      } else {
        htmlChars.push(ch);
      }
    }

    let currentHTML = '';
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= htmlChars.length) { clearInterval(interval); return; }
      const item = htmlChars[idx];
      currentHTML += typeof item === 'object' ? item.tag : item;
      el.innerHTML = currentHTML + '<span class="ai-typing"></span>';
      idx++;
    }, 15);
  }

  // ── SEARCH SUGGESTIONS ──
  let suggestTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideSuggestions(); return; }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 250);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) fetchSuggestions(input.value.trim());
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('searchWrapper').contains(e.target)) hideSuggestions();
  });

  async function fetchSuggestions(q) {
    try {
      const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        showSuggestions(data);
      } else {
        hideSuggestions();
      }
    } catch {
      hideSuggestions();
    }
  }

  function showSuggestions(items) {
    suggestionsBox.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `<i class="fas fa-search"></i> <span>${escapeHTML(item)}</span>`;
      div.addEventListener('click', () => {
        input.value = item;
        hideSuggestions();
        performSearch();
      });
      suggestionsBox.appendChild(div);
    });
    suggestionsBox.classList.add('active');
  }

  function hideSuggestions() {
    suggestionsBox.classList.remove('active');
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── RECENT SEARCHES ──
  function saveRecent(q) {
    let history = JSON.parse(localStorage.getItem('findora_history')) || [];
    history = history.filter(x => x !== q);
    history.unshift(q);
    history = history.slice(0, 6);
    localStorage.setItem('findora_history', JSON.stringify(history));
    renderRecent();
  }

  function renderRecent() {
    const history = JSON.parse(localStorage.getItem('findora_history')) || [];
    recentBox.innerHTML = '';
    if (history.length === 0) return;
    history.forEach(item => {
      const span = document.createElement('span');
      span.className = 'recent-tag';
      span.innerHTML = `<i class="fas fa-clock"></i> ${escapeHTML(item)}`;
      span.addEventListener('click', () => {
        input.value = item;
        performSearch();
      });
      recentBox.appendChild(span);
    });
  }

  // ── TRENDING ──
  const trendingTopics = [
    'Süni intellekt nədir',
    'Azərbaycan tarixi',
    'ChatGPT',
    'Kosmik kəşflər',
    'Python proqramlaşdırma',
    'Mars missiyası',
    'Kvant kompüterləri',
    'Blockchain texnologiyası'
  ];

  function renderTrending() {
    trendingGrid.innerHTML = '';
    trendingTopics.forEach((topic, i) => {
      const div = document.createElement('div');
      div.className = 'trending-item';
      div.innerHTML = `<span class="trending-num">${i + 1}</span> ${escapeHTML(topic)}`;
      div.addEventListener('click', () => {
        input.value = topic;
        performSearch();
      });
      trendingGrid.appendChild(div);
    });
  }

  // ── VOICE SEARCH ──
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'az-AZ';

    voiceBtn.addEventListener('click', () => {
      recognition.start();
      voiceBtn.classList.add('recording');
    });

    recognition.onresult = e => {
      input.value = e.results[0][0].transcript;
      voiceBtn.classList.remove('recording');
      performSearch();
    };
    recognition.onerror = () => voiceBtn.classList.remove('recording');
    recognition.onend = () => voiceBtn.classList.remove('recording');
  } else {
    voiceBtn.style.display = 'none';
  }

  // ── KEYBOARD SHORTCUTS ──
  document.addEventListener('keydown', (e) => {
    // Press "/" to focus search
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    // Escape to close suggestions
    if (e.key === 'Escape') {
      hideSuggestions();
      input.blur();
    }
  });

  // ── INIT ──
  renderRecent();
  renderTrending();
  input.focus();
})();