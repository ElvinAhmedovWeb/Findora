// public/ftranslator.js
(() => {
  const API_BASE = window.API_BASE || window.location.origin;
  const src = document.getElementById('srcText');
  const translateBtn = document.getElementById('translateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const speakBtn = document.getElementById('speakBtn');
  const status = document.getElementById('status');
  const resultWrap = document.getElementById('resultWrap');
  const resultText = document.getElementById('resultText');
  const resultMeta = document.getElementById('resultMeta');
  const fromLang = document.getElementById('fromLang');
  const toLang = document.getElementById('toLang');
  const themeToggle = document.getElementById('themeToggle');

  // basic language list (extendable)
  const LANGS = {
    "en":"English","az":"Azerbaijani","ru":"Russian","tr":"Turkish","de":"German","fr":"French","es":"Spanish","pt":"Portuguese","it":"Italian","zh":"Chinese","ja":"Japanese"
  };

  function populateLangs(){
    toLang.innerHTML = '';
    fromLang.innerHTML = '<option value="auto">Detect language</option>';
    for(const [k,v] of Object.entries(LANGS)){
      const o1 = document.createElement('option'); o1.value = k; o1.textContent = `${v} (${k})`; toLang.appendChild(o1);
      const o2 = document.createElement('option'); o2.value = k; o2.textContent = `${v} (${k})`; fromLang.appendChild(o2);
    }
    toLang.value = 'en';
  }
  populateLangs();

  function setStatus(txt, show=true){
    status.style.display = show? 'block':'none';
    status.textContent = txt||'';
  }

  async function translate(){
    const q = src.value.trim();
    if(!q) return;
    const tgt = toLang.value||'en';
    const srcL = fromLang.value==='auto' ? 'auto' : fromLang.value;

    setStatus('Translating...');
    resultWrap.hidden = true;

    try {
      // using public LibreTranslate instance - for prod use your own server/proxy
      const API_URL = 'https://libretranslate.de/translate';
      const payload = { q, source: srcL==='auto'?'auto':srcL, target: tgt, format: "text" };
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      if(!resp.ok) throw new Error('API error '+resp.status);
      const data = await resp.json();

      resultText.textContent = data.translatedText || '(no result)';
      resultMeta.textContent = `Detected: ${data.detectedLanguage || srcL} • Target: ${tgt}`;
      resultWrap.hidden = false;
      setStatus('', false);
    } catch (err){
      console.error(err);
      setStatus('Translation failed. Try again or use a server proxy.', true);
    }
  }

  translateBtn.addEventListener('click', translate);
  src.addEventListener('keydown', e => { if(e.key === 'Enter' && (e.ctrlKey||e.metaKey)) translate(); });

  copyBtn.addEventListener('click', async () => {
    const text = resultText.textContent.trim();
    if(!text) return;
    try { await navigator.clipboard.writeText(text); setStatus('Copied to clipboard', true); setTimeout(()=>setStatus('',false),1500); }
    catch(e){ setStatus('Copy failed', true); }
  });

  speakBtn.addEventListener('click', () => {
    const text = resultText.textContent.trim();
    if(!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = toLang.value || 'en';
    speechSynthesis.speak(utter);
  });

  // theme
  const THEME_KEY = 'ftranslator_theme';
  function applyTheme(t){
    if(t==='dark'){ document.documentElement.setAttribute('data-theme','dark'); document.getElementById('meta-theme-color').setAttribute('content','#071021'); }
    else { document.documentElement.removeAttribute('data-theme'); document.getElementById('meta-theme-color').setAttribute('content','#886FFF'); }
  }
  const saved = localStorage.getItem(THEME_KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');
  applyTheme(saved);
  themeToggle.addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'; const next = cur==='dark'?'light':'dark'; localStorage.setItem(THEME_KEY,next); applyTheme(next); });

  // quick UX
  window.addEventListener('load', ()=> src.focus());
})();
