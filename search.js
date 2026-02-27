// ===== Findora search.js — Enhanced Results Page =====
(() => {
  const qs = s => document.querySelector(s);
  const qInput = qs('#qInput');
  const content = qs('#content');
  const aiPanel = qs('#aiPanel');
  const searchStats = qs('#searchStats');
  const searchBtn = qs('#searchBtn');
  const voiceBtn = qs('#voiceBtn');
  const themeToggle = qs('#themeToggle');
  const themeIcon = qs('#themeIcon');
  const loaderBar = qs('#loaderBar');
  const suggestionsBox = qs('#suggestions');
  const lightbox = qs('#lightbox');
  const lightboxImg = qs('#lightboxImg');
  const lightboxInfo = qs('#lightboxInfo');
  const lightboxClose = qs('#lightboxClose');
  const tabs = Array.from(document.querySelectorAll('.tab'));

  // URL params
  const params = new URLSearchParams(location.search);
  let query = params.get('id') || '';
  let type = params.get('type') || 'all';
  qInput.value = query;

  // API base
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `${location.protocol}//${location.hostname}:3000`
    : `${location.protocol}//${location.host}`;

  // ── THEME ──
  function applyTheme() {
    const theme = localStorage.getItem('findora_theme');
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }
  applyTheme();

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.classList.toggle('fa-moon');
    themeIcon.classList.toggle('fa-sun');
    localStorage.setItem('findora_theme', isDark ? 'dark' : 'light');
  });

  // ── TABS ──
  function setActiveTab(newType) {
    type = newType;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.type === newType));
    const u = new URL(location.href);
    u.searchParams.set('type', type);
    history.replaceState({}, '', u);
    fetchResults();
  }
  tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.type)));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));

  // ── SUGGESTIONS ──
  let suggestTimer = null;
  qInput.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const q = qInput.value.trim();
    if (q.length < 2) { hideSuggestions(); return; }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 250);
  });

  document.addEventListener('click', (e) => {
    if (!qs('#searchWrapper').contains(e.target)) hideSuggestions();
  });

  async function fetchSuggestions(q) {
    try {
      const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) showSuggestions(data);
      else hideSuggestions();
    } catch { hideSuggestions(); }
  }

  function showSuggestions(items) {
    suggestionsBox.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggest-item';
      div.innerHTML = `<i class="fas fa-search"></i> <span>${escapeHTML(item)}</span>`;
      div.addEventListener('click', () => {
        qInput.value = item;
        hideSuggestions();
        fetchResults();
      });
      suggestionsBox.appendChild(div);
    });
    suggestionsBox.classList.add('active');
  }

  function hideSuggestions() {
    suggestionsBox.classList.remove('active');
  }

  // ── LOADER ──
  function showLoader(show) {
    if (show) {
      loaderBar.classList.add('active');
      loaderBar.style.width = '0%';
    } else {
      loaderBar.style.width = '100%';
      setTimeout(() => {
        loaderBar.classList.remove('active');
        loaderBar.style.width = '0%';
      }, 400);
    }
  }

  // ── LIGHTBOX ──
  lightboxClose.addEventListener('click', () => lightbox.classList.remove('active'));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.remove('active');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') lightbox.classList.remove('active');
  });

  function openLightbox(src, title) {
    lightboxImg.src = src;
    lightboxInfo.textContent = title;
    lightbox.classList.add('active');
  }

  // ── RESULT BUILDERS ──
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }

  function createResult(r, index) {
    const item = document.createElement('div');
    item.className = 'item';
    item.style.animationDelay = `${index * 0.05}s`;

    // URL row with favicon
    const urlRow = document.createElement('div');
    urlRow.className = 'item-url-row';

    const domain = getDomain(r.url);
    if (domain) {
      const favicon = document.createElement('img');
      favicon.className = 'item-favicon';
      favicon.src = r.favicon || `${API_BASE}/api/favicon?domain=${encodeURIComponent(domain)}`;
      favicon.alt = '';
      favicon.onerror = function () { this.style.display = 'none'; };
      urlRow.appendChild(favicon);

      const domainEl = document.createElement('span');
      domainEl.className = 'item-domain';
      domainEl.textContent = domain;
      urlRow.appendChild(domainEl);
    }

    const urlEl = document.createElement('span');
    urlEl.className = 'item-url';
    urlEl.textContent = r.url ? ` › ${r.url.split('/').slice(3).join('/')}` : '';
    urlRow.appendChild(urlEl);

    const title = document.createElement('a');
    title.className = 'item-title';
    title.textContent = r.title || 'Nəticə';
    title.href = r.url || '#';
    title.target = '_blank';
    title.rel = 'noopener noreferrer';

    const desc = document.createElement('div');
    desc.className = 'item-desc';
    // Highlight query words in description
    const descText = r.desc || '';
    desc.innerHTML = highlightQuery(descText, query);

    item.appendChild(urlRow);
    item.appendChild(title);
    item.appendChild(desc);

    return item;
  }

  function highlightQuery(text, q) {
    if (!q) return escapeHTML(text);
    const escaped = escapeHTML(text);
    const words = q.split(/\s+/).filter(w => w.length > 2);
    let result = escaped;
    words.forEach(word => {
      const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '<span class="highlight">$1</span>');
    });
    return result;
  }

  function createWikiCard(w) {
    const card = document.createElement('div');
    card.className = 'wiki-card';

    if (w.image) {
      const img = document.createElement('img');
      img.className = 'wiki-card-img';
      img.src = w.image;
      img.alt = w.title;
      img.onerror = function () { this.style.display = 'none'; };
      card.appendChild(img);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'wiki-card-content';

    const badge = document.createElement('div');
    badge.className = 'wiki-card-badge';
    badge.innerHTML = '<i class="fas fa-book"></i> Wikipedia';

    const title = document.createElement('div');
    title.className = 'wiki-card-title';
    const titleLink = document.createElement('a');
    titleLink.href = w.url;
    titleLink.target = '_blank';
    titleLink.textContent = w.title.replace(' (Wikipedia AZ)', '').replace(' (Wikipedia EN)', '');
    title.appendChild(titleLink);

    const desc = document.createElement('div');
    desc.className = 'wiki-card-desc';
    desc.textContent = w.desc.length > 400 ? w.desc.substring(0, 400) + '...' : w.desc;

    contentDiv.appendChild(badge);
    contentDiv.appendChild(title);
    contentDiv.appendChild(desc);
    card.appendChild(contentDiv);

    return card;
  }

  function createImageGrid(results) {
    const grid = document.createElement('div');
    grid.className = 'image-grid';

    results.forEach(r => {
      if (!r.image) return;
      let src = r.image;
      if (src.startsWith('/') && !src.startsWith('/api')) {
        src = 'https://duckduckgo.com' + src;
      }

      const card = document.createElement('div');
      card.className = 'img-card';
      card.addEventListener('click', () => openLightbox(src, r.title || ''));

      const img = document.createElement('img');
      img.src = src;
      img.alt = r.title || '';
      img.loading = 'lazy';
      img.onerror = function () { card.style.display = 'none'; };

      const titleEl = document.createElement('div');
      titleEl.className = 'img-card-title';
      titleEl.textContent = r.title || '';

      const sourceEl = document.createElement('div');
      sourceEl.className = 'img-card-source';
      sourceEl.textContent = r.source || getDomain(r.url || '');

      card.appendChild(img);
      card.appendChild(titleEl);
      card.appendChild(sourceEl);
      grid.appendChild(card);
    });

    return grid;
  }

  // ── AI ANSWER ──
  async function fetchAIAnswer(q, context) {
    aiPanel.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'ai-panel';

    const header = document.createElement('div');
    header.className = 'ai-panel-header';
    header.innerHTML = `<span class="ai-badge"><i class="fas fa-robot"></i> Findora AI</span>`;

    const body = document.createElement('div');
    body.className = 'ai-panel-body';
    body.innerHTML = '<span class="ai-typing">Cavab hazırlanır</span>';

    panel.appendChild(header);
    panel.appendChild(body);
    aiPanel.appendChild(panel);

    try {
      const res = await fetch(`${API_BASE}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: context || '' })
      });
      const data = await res.json();

      if (data.answer) {
        // Format the answer
        const formatted = data.answer
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n- /g, '<br>• ')
          .replace(/\n\d+\.\s/g, (m) => '<br>' + m.trim() + ' ')
          .replace(/\n/g, '<br>');

        body.innerHTML = formatted;

        // Add "Ask more" button
        const moreBtn = document.createElement('button');
        moreBtn.className = 'ai-toggle-btn';
        moreBtn.innerHTML = '<i class="fas fa-comments"></i> Daha ətraflı soruş';
        moreBtn.addEventListener('click', () => {
          fetchAIAnswer(`${q} - daha ətraflı məlumat ver`, context);
        });
        panel.appendChild(moreBtn);
      } else {
        body.textContent = data.error || 'AI cavab verə bilmədi.';
      }
    } catch (err) {
      body.textContent = 'AI xidmətinə bağlanılmadı. Server işləyirmi?';
      console.error('AI error:', err);
    }
  }

  // ── FETCH RESULTS ──
  let controller = null;
  async function fetchResults() {
    query = qInput.value.trim();
    if (!query) {
      content.innerHTML = '<div class="notice"><i class="fas fa-search"></i>Axtarış üçün söz yazın.</div>';
      return;
    }

    // Update URL
    const u = new URL(location.href);
    u.searchParams.set('id', query);
    u.searchParams.set('type', type);
    history.replaceState({}, '', u);
    document.title = `${query} — Findora`;

    // Abort previous
    if (controller) controller.abort();
    controller = new AbortController();

    content.innerHTML = '';
    searchStats.innerHTML = '';
    showLoader(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      showLoader(false);

      if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        content.innerHTML = `
          <div class="notice">
            <i class="fas fa-exclamation-circle"></i>
            <p>"<strong>${escapeHTML(query)}</strong>" üçün nəticə tapılmadı.</p>
            <p style="margin-top:8px;font-size:13px;">Fərqli sözlərlə yenidən cəhd edin.</p>
          </div>`;
        // Still try AI for no-result queries
        fetchAIAnswer(query, '');
        return;
      }

      // Search stats
      searchStats.innerHTML = `
        <div class="search-stats">
          Təxminən <strong>${data.resultCount || data.results.length}</strong> nəticə tapıldı
          (${data.time || '0.00'} saniyə)
        </div>`;

      // AI answer (for 'all' tab)
      if (type === 'all') {
        const context = data.results.slice(0, 3).map(r => `${r.title}: ${r.desc}`).join('\n');
        fetchAIAnswer(query, context);
      } else {
        aiPanel.innerHTML = '';
      }

      // Wiki card
      if (type === 'all') {
        const wiki = data.results.find(r =>
          r.title && (r.title.toLowerCase().includes('wikipedia'))
        );
        if (wiki) {
          content.appendChild(createWikiCard(wiki));
        }
      }

      // Image grid
      if (type === 'image') {
        const grid = createImageGrid(data.results);
        content.appendChild(grid);
        return;
      }

      // Video hint
      if (type === 'video') {
        const hint = document.createElement('div');
        hint.className = 'notice';
        hint.innerHTML = '<i class="fas fa-video"></i><p>Video axtarış aktiv olacaq. Hələlik ümumi nəticələr göstərilir.</p>';
        content.appendChild(hint);
      }

      // News hint
      if (type === 'news') {
        const hint = document.createElement('div');
        hint.className = 'notice';
        hint.innerHTML = '<i class="fas fa-newspaper"></i><p>Xəbərlər bölməsi tezliklə aktiv olacaq. Ümumi nəticələr göstərilir.</p>';
        content.appendChild(hint);
      }

      // Render results
      data.results.forEach((r, i) => {
        // skip wiki if already shown
        if (type === 'all' && r.title && r.title.toLowerCase().includes('wikipedia')) return;
        content.appendChild(createResult(r, i));
      });

      // Save to recent
      pushRecent(query);

    } catch (err) {
      if (err.name === 'AbortError') return;
      showLoader(false);
      content.innerHTML = `
        <div class="notice">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Serverlə bağlantıda problem. Sonra yenidən cəhd edin.</p>
        </div>`;
      console.error(err);
    }
  }

  // ── EVENTS ──
  let debounceTimer = null;
  qInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      hideSuggestions();
      fetchResults();
    }
  });
  searchBtn.addEventListener('click', () => {
    hideSuggestions();
    fetchResults();
  });

  // ── VOICE SEARCH ──
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'az-AZ';
    recognition.interimResults = false;

    voiceBtn.addEventListener('click', () => {
      voiceBtn.disabled = true;
      voiceBtn.innerHTML = '<i class="fas fa-stop" style="color:#ef4444"></i>';
      recognition.start();
    });
    recognition.onresult = (ev) => {
      qInput.value = ev.results[0][0].transcript;
      fetchResults();
    };
    recognition.onend = () => {
      voiceBtn.disabled = false;
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    };
    recognition.onerror = () => {
      voiceBtn.disabled = false;
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    };
  } else {
    voiceBtn.style.display = 'none';
  }

  // ── RECENT SEARCHES ──
  function pushRecent(q) {
    if (!q) return;
    const key = 'findora_history';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    if (arr[0] === q) return;
    const filtered = arr.filter(x => x !== q);
    filtered.unshift(q);
    if (filtered.length > 6) filtered.pop();
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  // ── INIT ──
  if (query) fetchResults();
})();
