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
    'getAppBootstrap', 'getNotifications', 'markNotificationsRead'
  ]);

  // These server functions take a second argument containing options
  // (row windows, skipLogos, cache-busting _ts, ...). Forward it as payload so
  // the worker passes it on to Apps Script unchanged.
  const TOKEN_OPTION_ACTIONS = new Set([
    'getBootstrapData', 'getDailyBootstrapData', 'getExtendedData', 'getAppBootstrap'
  ]);

  const ADAPTERS = {
    validateLogin:          (a) => ({ username: a[0], password: a[1] }),
    getPhotoDataUrls:       (a) => ({ fileIds: a[0] }),
    getPdfBase64:           (a) => ({ fileId: a[0] }),
    saveChecklistPdf:       (a) => ({ checkId: a[0], pdfBase64: a[1], pdfType: a[2] }),
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
      if (TOKEN_OPTION_ACTIONS.has(action)) payload = args[1] || {};
    } else if (action === 'validateLogin') {
      payload = ADAPTERS.validateLogin(args);
    } else {
      token = localStorage.getItem('authToken') || _memoryToken || null;
      const fn = ADAPTERS[action];
      payload = fn ? fn(args) : (args[0] && typeof args[0] === 'object' ? args[0] : {});
    }

    if (token) _memoryToken = token;

    /* The Cloudflare worker in front of Apps Script currently only forwards
       known action names, and getAppBootstrap is newer than that allow-list.
       getBootstrapData understands includeDaily, so route the bundle call
       through it: one request, same response shape for the client. If the
       worker is later updated, this mapping remains harmless. */
    let wireAction = action;
    if (action === 'getAppBootstrap') {
      wireAction = 'getBootstrapData';
      payload = Object.assign({}, payload, { includeDaily: true });
    }

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: wireAction,
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
          
          // Clear only the expired session. Keep v3/v4 and the static app-shell
          // cache: the login handler reuses the data only for the same username,
          // then refreshes it in the background. This keeps re-login fast.
          localStorage.removeItem('authToken');
          localStorage.removeItem('_gVersion');
          localStorage.removeItem('bootstrapCache_v2'); // older cache
          // Keep v3/v4 here: the login handler reuses them only when the same
          // username signs in again, then refreshes them in the background.
          _memoryToken = null;
          sessionStorage.clear();
          
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

        /* getBootstrapData + includeDaily returns the daily half as a
           property. Re-shape it exactly like getAppBootstrap so app.js does
           not need a second code path for the proxied deployment. */
        if (action === 'getAppBootstrap' && res && res.daily) {
          const monthly = Object.assign({}, res);
          const daily = monthly.daily;
          delete monthly.daily;
          delete monthly._ms;
          delete monthly._timings;
          res = {
            success: res.success !== false,
            user: res.user,
            monthly: monthly,
            daily: daily,
            _ms: res._ms,
            _timings: res._timings
          };
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
