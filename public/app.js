// public/app.js
(() => {
  // CONFIG: API_BASE auto-detects same origin. If your API is remote, set API_BASE to that URL (e.g. 'https://your-app.onrender.com')
  const API_BASE = window.API_BASE || window.location.origin;

  const q = document.getElementById('q');
  const searchBtn = document.getElementById('searchBtn');
  const luckyBtn = document.getElementById('luckyBtn');
  const demoToggle = document.getElementById('demoToggle');
  const resultsEl = document.getElementById('results');
  const statusEl = document.getElementById('status');
  const apiHint = document.getElementById('apiHint');
  const homeLogo = document.getElementById('homeLogo');

  apiHint.textContent = API_BASE + '/api/*';

  // Demo DB (local fallback)
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
      <div class="result-item">
        <a href="${r.link}" target="_blank" rel="noopener" style="text-decoration:none;color:var(--accent);font-weight:700;">${escapeHtml(r.title)}</a>
        <div class="meta">${escapeHtml(r.link)}</div>
        <div style="margin-top:8px;color:#222;">${escapeHtml(r.desc)}</div>
      </div>
    `).join('');
  }

  async function doSearch(){
    const term = q.value.trim();
    if(!term) { q.focus(); return; }

    resultsEl.hidden = true;
    statusEl.hidden = false;
    statusEl.textContent = `Searching "${term}"...`;

    if(demoToggle.checked){
      // local demo filtering
      const hits = demoDB.filter(r => (r.title + ' ' + r.desc).toLowerCase().includes(term.toLowerCase()));
      statusEl.hidden = true;
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
      statusEl.hidden = true;
      if(Array.isArray(data.results)) renderResults(data.results);
      else renderResults([]);
    } catch (err) {
      statusEl.textContent = `Network error: ${err.message || err}`;
      console.error('Search fetch error', err);
    }
  }

  async function doLucky(){
    const term = q.value.trim();
    if(!term) { q.focus(); return; }

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

  // events
  searchBtn.addEventListener('click', doSearch);
  luckyBtn.addEventListener('click', doLucky);
  q.addEventListener('keydown', e => { if(e.key === 'Enter') doSearch(); });
  homeLogo.addEventListener('click', e => { e.preventDefault(); q.value=''; resultsEl.hidden=true; statusEl.hidden=true; });

  // quick UX: focus input on load
  window.addEventListener('load', () => q.focus());
})();
