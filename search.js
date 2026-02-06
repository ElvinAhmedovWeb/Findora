
  // Helpers
  const qs = s => document.querySelector(s);
  const qInput = qs('#qInput');
  const content = qs('#content');
  const loader = qs('#loader-container');
  const searchBtn = qs('#searchBtn');
  const voiceBtn = qs('#voiceBtn');
  const themeToggle = qs('#themeToggle');
  const themeIcon = qs('#themeIcon');
  const tabs = Array.from(document.querySelectorAll('.tab'));

  // Detect query from URL
  const params = new URLSearchParams(location.search);
  let query = params.get('id') || '';
  let type = params.get('type') || 'all';
  qInput.value = query;

  // Determine API base (avoid mixed content)
  const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `${location.protocol}//${location.hostname}:3000`
    : `${location.protocol}//${location.host}`;

  // Theme persistence
  function applyThemeFromStorage(){
    if(localStorage.getItem('theme') === 'dark'){
      document.body.classList.add('dark-mode');
      themeIcon.classList.replace('fa-moon','fa-sun');
    }
  }
  applyThemeFromStorage();

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.classList.toggle('fa-moon');
    themeIcon.classList.toggle('fa-sun');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // Tabs
  function setActiveTab(newType){
    type = newType;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.type === newType));
    fetchResults();
  }
  tabs.forEach(t => t.addEventListener('click', () => setActiveTab(t.dataset.type)));
  // Initialize active
  tabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));

  // Safe element builder for result item
  function createResult(r){
    const item = document.createElement('div'); item.className='item';

    const url = document.createElement('div'); url.className='item-url'; url.textContent = r.url || '';
    const title = document.createElement('a'); title.className='item-title'; title.textContent = r.title || r.url || 'Nəticə';
    title.href = r.url || '#'; title.target = '_blank'; title.rel = 'noopener noreferrer';
    const desc = document.createElement('div'); desc.className='item-desc'; desc.textContent = r.desc || '';

    item.appendChild(url);
    item.appendChild(title);
    item.appendChild(desc);

    return item;
  }

  function createWikiCard(w){
    const box = document.createElement('div'); box.className='wiki';
    const title = document.createElement('a'); title.className='item-title'; title.textContent = w.title; title.href = w.url; title.target = '_blank';
    const desc = document.createElement('div'); desc.className='item-desc'; desc.textContent = w.desc;
    if(w.image){
      const img = document.createElement('img'); img.src = w.image; img.alt = w.title; img.style.maxWidth='160px'; img.style.float='right'; img.style.marginLeft='12px';
      box.appendChild(img);
    }
    box.appendChild(title); box.appendChild(desc);
    return box;
  }

  // Image grid builder
  function createImageGrid(results){
    const grid = document.createElement('div'); grid.className='image-grid';
    results.forEach(r => {
      if(!r.image) return;
      let src = r.image;
      if(src.startsWith('/')) src = 'https://duckduckgo.com'+src; // fix relative
      const a = document.createElement('a'); a.href = r.url || '#'; a.target='_blank'; a.rel='noopener noreferrer';
      const box = document.createElement('div'); box.className='img-box';
      const img = document.createElement('img'); img.src = src; img.alt = r.title || '';
      const p = document.createElement('p'); p.textContent = r.title || '';
      box.appendChild(img); box.appendChild(p); a.appendChild(box); grid.appendChild(a);
    });
    return grid;
  }

  // Show/hide loader
  function showLoader(show){ loader.style.display = show ? 'block' : 'none'; }

  // Fetch results
  let controller = null;
  async function fetchResults(){
    query = qInput.value.trim();
    if(!query){ content.innerHTML = '<div class="notice">Axtarış üçün söz yazın.</div>'; return; }

    // Update URL without reload
    const u = new URL(location.href); u.searchParams.set('id', query); u.searchParams.set('type', type); history.replaceState({}, '', u);

    // Abort previous
    if(controller) controller.abort(); controller = new AbortController();

    content.innerHTML = '';
    showLoader(true);

    try{
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`, { signal: controller.signal });
      if(!res.ok) throw new Error('Server error');
      const data = await res.json();
      showLoader(false);

      if(!data || !Array.isArray(data.results) || data.results.length === 0){
        content.innerHTML = '<img src="404 not found.png" class="notice" >';
        return;
      }

      // If wiki first result exists, show as card
      const wiki = data.results.find(r => r.title && r.title.toLowerCase().includes('wikipedia'));
      if(wiki) content.appendChild(createWikiCard(wiki));

      if(type === 'image'){
        const grid = createImageGrid(data.results);
        content.appendChild(grid);
        return;
      }

      // For all/video, render list but for video we show placeholder (backend may implement later)
      if(type === 'video'){
        // If backend does not provide video-specific results, show list and a hint
        const hint = document.createElement('div'); hint.className='notice'; hint.textContent='Video axtarış üçün backend dəstəyi aktiv deyil — lakin linklər göstərilir.';
        content.appendChild(hint);
      }

      data.results.forEach(r => {
        // skip wiki duplicate
        if(wiki && r.url === wiki.url) return;
        content.appendChild(createResult(r));
      });

    }catch(err){
      if(err.name === 'AbortError') return; // aborted
      showLoader(false);
      content.innerHTML = '<div class="notice">Serverlə bağlantıda problem. Sonra yenidən cəhd et.</div>';
      console.error(err);
    }
  }

  // Debounce input
  let debounceTimer = null;
  qInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { query = qInput.value.trim(); fetchResults(); }, 450);
  });

  // Enter & button
  qInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ fetchResults(); } });
  searchBtn.addEventListener('click', fetchResults);

  // Voice search (ask user to allow mic). Use webkitSpeechRecognition when available
  if('webkitSpeechRecognition' in window){
    const recognition = new webkitSpeechRecognition(); recognition.lang='az-AZ'; recognition.interimResults=false;
    voiceBtn.addEventListener('click', () => {
      voiceBtn.disabled = true; voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
      recognition.start();
    });
    recognition.onresult = (ev) => { qInput.value = ev.results[0][0].transcript; fetchResults(); };
    recognition.onend = () => { voiceBtn.disabled=false; voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>'; };
    recognition.onerror = ()=>{ voiceBtn.disabled=false; voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>'; };
  } else {
    // hide voice button if unsupported
    voiceBtn.style.display='none';
  }

  // Recent searches (localStorage)
  function pushRecent(q){
    if(!q) return;
    const key = 'findora_history_v1';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    if(arr[0] === q) return; // avoid dupes
    arr.unshift(q); if(arr.length>6) arr.pop(); localStorage.setItem(key, JSON.stringify(arr));
  }

  // Auto-run if query present
  if(query) fetchResults();

  // Optional: expose fetchResults for debugging
  window.fetchResults = fetchResults;
