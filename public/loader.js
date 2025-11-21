// public/loader.js
(function(){
  'use strict';

  // Safe: run on window load (all resources loaded)
  window.addEventListener('load', () => {
    const loader = document.getElementById('loading-screen');

    if (!loader) {
      // nothing to hide
      console.warn('loader.js: #loading-screen not found');
      return;
    }

    // ensure body has loading-active class at start (optional)
    try { document.documentElement.classList.remove('no-js'); } catch(e){}

    // small delay so user sees branding, but not too long
    const FADE_DELAY = 900; // ms (how long to wait before starting fade)
    const REMOVE_AFTER = 900; // CSS transition should be similar duration

    // Function to start hiding the loader
    const hideLoader = () => {
      // add class that triggers CSS transition to opacity:0
      loader.classList.add('hidden');

      // remove loader from DOM after transition completes OR after timeout
      const onTransitionEnd = (ev) => {
        // only respond to opacity transition
        if (ev && ev.propertyName && ev.propertyName !== 'opacity') return;
        cleanup();
      };

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        loader.removeEventListener('transitionend', onTransitionEnd);
        // remove element completely so it cannot block clicks
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        // remove loading body class if set
        document.body.classList.remove('loading-active');
      };

      loader.addEventListener('transitionend', onTransitionEnd);

      // safety fallback: if transitionend didn't fire, remove after timeout
      setTimeout(cleanup, REMOVE_AFTER + 300);
    };

    // Start hide after FADE_DELAY
    setTimeout(hideLoader, FADE_DELAY);

    // Extra fallback: if load event doesn't fire for some reason, remove loader after 6s
    setTimeout(() => {
      if (document.getElementById('loading-screen')) {
        console.warn('loader.js: fallback removal executed');
        document.getElementById('loading-screen').classList.add('hidden');
        setTimeout(() => {
          const el = document.getElementById('loading-screen');
          if (el && el.parentNode) el.parentNode.removeChild(el);
          document.body.classList.remove('loading-active');
        }, 9000);
      }
    }, 9000);
  });
})();
