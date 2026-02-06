// ===== Findora index.js =====
// Frontpage logic (CSP-safe, no inline JS)

(() => {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('theme-icon');
  const input = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const recentBox = document.getElementById('recentSearches');
  const searchUI = document.getElementById('search-ui');
  const loader = document.getElementById('loader-container');

  // ---------------- THEME ----------------
  const savedTheme = localStorage.getItem('findora_theme');
  if (savedTheme === 'dark') enableDark();

  themeToggle.addEventListener('click', () => {
    body.classList.contains('dark-mode') ? disableDark() : enableDark();
  });

  function enableDark() {
    body.classList.add('dark-mode');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
    localStorage.setItem('findora_theme', 'dark');
  }

  function disableDark() {
    body.classList.remove('dark-mode');
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
    localStorage.setItem('findora_theme', 'light');
  }

  // ---------------- SEARCH ----------------
  searchBtn.addEventListener('click', performSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') performSearch();
  });

  function performSearch() {
    const q = input.value.trim();
    if (!q) return;

    saveRecent(q);
    searchUI.style.display = 'none';
    loader.style.display = 'block';

    setTimeout(() => {
      window.location.href = `search.html?id=${encodeURIComponent(q)}`;
    }, 3000);
  }

  // ---------------- RECENT SEARCHES ----------------
  function saveRecent(q) {
    let history = JSON.parse(localStorage.getItem('findora_history')) || [];
    history = history.filter(x => x !== q);
    history.unshift(q);
    history = history.slice(0, 5);
    localStorage.setItem('findora_history', JSON.stringify(history));
    renderRecent();
  }

  function renderRecent() {
    const history = JSON.parse(localStorage.getItem('findora_history')) || [];
    recentBox.innerHTML = '';

    history.forEach(item => {
      const span = document.createElement('span');
      span.className = 'recent-tag';
      span.textContent = item;
      span.addEventListener('click', () => {
        input.value = item;
        performSearch();
      });
      recentBox.appendChild(span);
    });
  }

  // ---------------- VOICE SEARCH ----------------
  if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
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

    recognition.onerror = () => {
      voiceBtn.classList.remove('recording');
    };
  } else {
    voiceBtn.style.display = 'none';
  }

  // ---------------- INIT ----------------
  renderRecent();
})();