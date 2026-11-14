/* =========================================================
   gas-api.js — google.script.run Polyfill for GitHub Pages
   ========================================================= */
(function () {
  const isGithubPages = /\.github\.io$/.test(location.hostname) || 
                        location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1';
  
  const hasNative = !!(window.google && window.google.script && window.google.script.run);
  if (!isGithubPages && hasNative) return;

  const WORKER_URL = window.__API_URL__ || 'https://checklist-api-new.ppap-tec-2022.workers.dev/';

  // ★ NEW: Memory cache for the token. Prevents issues if localStorage is cleared.
  let _memoryToken = localStorage.getItem('authToken') || null;

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
  };

  function fireRequest(action, args, successFn, failureFn) {
    let token = null;
    let payload = {};

    if (TOKEN_ARG_ACTIONS.has(action)) {
      // Check args, then localStorage, then memory
      token = String(args[0] || '') || localStorage.getItem('authToken') || _memoryToken || null;
      if (action === 'getExtendedData') payload = args[1] || {};
    } else if (action === 'validateLogin') {
      payload = ADAPTERS.validateLogin(args);
    } else {
      // Check localStorage, then memory
      token = localStorage.getItem('authToken') || _memoryToken || null;
      const fn = ADAPTERS[action];
      payload = fn ? fn(args) : (args[0] && typeof args[0] === 'object' ? args[0] : {});
    }

    // ★ NEW: Save the valid token in memory
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
          localStorage.removeItem('authToken');
          localStorage.removeItem('_gVersion');
          _memoryToken = null; // ★ Clear memory cache
          alert('Your session has expired. Please log in again.');
          window.location.reload();
          return;
        }

        if (successFn) successFn(res);
      })
      .catch(err => {
        console.error('[gas-api] Network Error:', err);
        if (failureFn) failureFn(err);
      });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeChain(null, null);

  console.log('[gas-api] Polyfill active → ' + WORKER_URL);
})();
