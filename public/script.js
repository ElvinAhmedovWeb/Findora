// public/app.js
(() => {
  const API_BASE = window.API_BASE || window.location.origin;

  const q = document.getElementById('q');
  const searchBtn = document.getElementById('searchBtn');
  const luckyBtn = document.getElementById('luckyBtn');
  const demoToggle = document.getElementById('demoToggle');
  const resultsEl = document.getElementById('results');
  const statusEl = document.getElementById('status');
  const apiHint = document.getElementById('apiHint');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const yearEl = document.getElementById('year');

  yearEl.textContent = new Date().getFullYear();
  apiHint.textContent = API_BASE + '/api/*';

  // Demo DB fallback
  const demoDB = [
    {title:"Findora Weather", link:"https://weather.com", desc:"Today's forecast and humidity info."},
    {title:"Findora News — Top stories", link:"https://example.com/news", desc:"Local & global news, sports, culture."},
    {title:"Recipes: Best Dolma", link:"https://example.com/recipes/dolma", desc:"Classic dolma recipe — step-by-step."},
    {title:"Liverpool Fan Club", link:"https://example.com/liverpool", desc:"Match schedules and fan meetups."},
    {title:"JS Starter Guide", link:"https://developer.mozilla.org", desc:"Official resources for learning JavaScript."}
  ];

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  function renderResults(items){
    resultsEl.hidden = false;
    if(!items || items.length === 0){
      resultsEl.innerHTML = `<div class="result-item"><strong>No results found.</strong></div>`;
      return;
    }
    resultsEl.innerHTML = items.map(r => `
      <div class="result-item" role="article">
        <a href="${r.link}" target="_blank" rel="noopener" style="text-decoration:none;color:var(--accent);font-weight:700;">${escapeHtml(r.title)}</a>
        <div class="result-url">${escapeHtml(r.link)}</div>
        <div style="margin-top:8px;color:var(--text);">${escapeHtml(r.desc)}</div>
      </div>
    `).join('');
  }

  async function doSearch(){
    const term = q.value.trim();
    if(!term){ q.focus(); return; }
    resultsEl.hidden = true;
    statusEl.style.display = 'block';
    statusEl.textContent = `Searching “${term}”...`;

    if(demoToggle.checked){
      const hits = demoDB.filter(r => (r.title + ' ' + r.desc).toLowerCase().includes(term.toLowerCase()));
      statusEl.style.display = 'none';
      renderResults(hits);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
      if(!resp.ok){
        const txt = await resp.text().catch(()=>resp.statusText);
        statusEl.textContent = `Server error ${resp.status}: ${txt}`;
        return;
      }
      const data = await resp.json();
      statusEl.style.display = 'none';
      if(Array.isArray(data.results)) renderResults(data.results);
      else renderResults([]);
    } catch (err) {
      statusEl.textContent = `Network error: ${err.message || err}`;
      console.error('Search error', err);
    }
  }

  async function doLucky(){
    const term = q.value.trim();
    if(!term){ q.focus(); return; }
    if(demoToggle.checked){
      const first = demoDB.find(r => (r.title + ' ' + r.desc).toLowerCase().includes(term.toLowerCase()));
      if(first) window.open(first.link, '_blank');
      else alert('Demo: no matching result.');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/lucky?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
      if(!resp.ok){
        const txt = await resp.text().catch(()=>resp.statusText);
        alert(`Server error ${resp.status}: ${txt}`);
        return;
      }
      const data = await resp.json();
      if(data.result && data.result.link) window.open(data.result.link, '_blank');
      else alert('No lucky result found.');
    } catch (err) {
      alert('Network error — check console.');
      console.error('Lucky fetch error', err);
    }
  }

  // theme handling
  const THEME_KEY = 'findora_theme';

  function applyTheme(t){
    const root = document.documentElement;
    if(t === 'dark'){
      root.setAttribute('data-theme','dark');
      document.getElementById('meta-theme-color').setAttribute('content','#0b0b10');
      // moon icon
      themeIcon.innerHTML = '<path d=\"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z\"/>';
    } else {
      root.removeAttribute('data-theme');
      document.getElementById('meta-theme-color').setAttribute('content','#7969EE');
      // sun icon
      themeIcon.innerHTML = '<circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41\"/>';
    }
  }

  function detectTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === 'dark' || saved === 'light') return saved;
    // respect device preference
    const pref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return pref ? 'dark' : 'light';
  }

  // init theme
  applyTheme(detectTheme());

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // events
  searchBtn.addEventListener('click', doSearch);
  luckyBtn.addEventListener('click', doLucky);
  q.addEventListener('keydown', e => { if(e.key === 'Enter') doSearch(); });

  // mobile: focus input when opened
  window.addEventListener('load', () => q.focus());
})();
