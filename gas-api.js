/* =========================================================
   gas-api.js — google.script.run Polyfill for GitHub Pages
   ========================================================= */
(function () {
  // 1. Detect environment: GitHub Pages, localhost, or native GAS
  const isGithubPages = /\.github\.io$/.test(location.hostname) || 
                        location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1';
  
  const hasNative = !!(window.google && window.google.script && window.google.script.run);
  
  if (!isGithubPages && hasNative) return;

  const WORKER_URL = window.__API_URL__ || 'https://checklist-api-new.ppap-tec-2022.workers.dev/';

  // Memory cache for the token (prevents issues if localStorage is cleared)
  let _memoryToken = localStorage.getItem('authToken') || null;

  // 2. Chainable Proxy to mimic google.script.run
  function makeChain(successFn, failureFn) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return (fn) => makeChain(fn, failureFn);
        if (prop === 'withFailureHandler') return (fn) => makeChain(successFn, fn);
        
        if (typeof prop !== 'string' || prop === 'then' || prop === 'toJSON' || prop === 'constructor') {
          return undefined;
        }

        return (...args) => { 
          fireRequest(prop, args, successFn, failureFn); 
        };
      }
    });
  }

  // 3. Argument Adapters
  const TOKEN_ARG_ACTIONS = new Set([
    'logout', 'getUserFromToken', 'getBootstrapData', 'getDailyBootstrapData', 'getExtendedData',
    'getNotifications', 'markNotificationsRead' 
  ]);

  const ADAPTERS = {
    validateLogin:          (a) => ({ username: a[0], password: a[1] }),
    getPhotoDataUrls:       (a) => ({ fileIds: a[0] }),
    getPdfBase64:           (a) => ({ fileId: a[0] }),
    saveChecklistPdf:       (a) => ({ checkId: a[0], pdfBase64: a[1] }),
    updateUserEquipment:    (a) => ({ username: a[0], equipmentIds: a[1] }),
    getMissingPdfsForMonth: (a) => ({ group: a[0], ym: a[1] }),
    savePushSubscription:   (a) => ({ subscription: a[0].subscription }),
    deletePushSubscription: (a) => ({ endpoint: a[0].endpoint })
  };

  // 4. The actual fetch request to Cloudflare
  function fireRequest(action, args, successFn, failureFn) {
    let token = null;
    let payload = {};

    if (TOKEN_ARG_ACTIONS.has(action)) {
      token = String(args[0] || '') || localStorage.getItem('authToken') || _memoryToken || null;
      if (action === 'getExtendedData') payload = args[1] || {};
    } else if (action === 'validateLogin') {
      payload = ADAPTERS.validateLogin(args);
    } else {
      token = localStorage.getItem('authToken') || _memoryToken || null;
      const fn = ADAPTERS[action];
      payload = fn ? fn(args) : (args[0] && typeof args[0] === 'object' ? args[0] : {});
    }

    if (token) _memoryToken = token;

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        token,
        clientVersion: localStorage.getItem('_gVersion') || null,
        payload
      })
    })
      .then(res => res.json())
      .then(res => {
        if (res && res.version) {
          localStorage.setItem('_gVersion', res.version);
        }

         if (res && res.success === false && res.code === 'AUTH_EXPIRED') {
          console.warn('Session expired. Logging out...');
          
          // Clear all local storage and cache
          localStorage.removeItem('authToken');
          localStorage.removeItem('_gVersion');
          localStorage.removeItem('bootstrapCache_v2'); // Clear cached data
          sessionStorage.clear();
          
          // Clear Service Worker Cache to prevent stale reloads
          if ('caches' in window) {
            caches.keys().then((names) => {
              for (let name of names) caches.delete(name);
            });
          }

          // Call the frontend function to show login form (No page reload!)
          if (typeof window.handleSessionExpired === 'function') {
            window.handleSessionExpired();
          } else {
            // Fallback: Force hide spinner and alert
            if (typeof hideLoading === 'function') hideLoading();
            else $('#loadingOverlay').hide();
            
            alert('Your session has expired. Please log in again.');
            window.location.href = window.location.pathname; 
          }
          return; // Stop processing further
        }

        if (successFn) successFn(res);
      })
      .catch(err => {
        console.error('[gas-api] Network Error:', err);
        if (failureFn) failureFn(err);
      });
  }

  // 5. Override window.google.script.run
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeChain(null, null);

  console.log('[gas-api] Polyfill active → ' + WORKER_URL);
})();
