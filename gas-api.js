/* =========================================================
   gas-api.js — google.script.run Polyfill for GitHub Pages
   ========================================================= */
(function () {
  // 1. Detect environment: GitHub Pages, localhost, or native GAS
  const isGithubPages = /\.github\.io$/.test(location.hostname) || 
                        location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1';
  
  const hasNative = !!(window.google && window.google.script && window.google.script.run);
  
  // If we are in native Google Apps Script, do nothing (use native google.script.run)
  if (!isGithubPages && hasNative) return;

  // =========================================================
  // ⚠️ REPLACE THIS URL with your actual Cloudflare Worker URL
  // =========================================================
  const WORKER_URL = window.__API_URL__ || ' https://checklist-api-new.ppap-tec-2022.workers.dev/';

  // 2. Chainable Proxy to mimic google.script.run
  function makeChain(successFn, failureFn) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return (fn) => makeChain(fn, failureFn);
        if (prop === 'withFailureHandler') return (fn) => makeChain(successFn, fn);
        
        // Ignore standard JS object properties
        if (typeof prop !== 'string' || prop === 'then' || prop === 'toJSON' || prop === 'constructor') {
          return undefined;
        }

        // Return the function caller
        return (...args) => { 
          fireRequest(prop, args, successFn, failureFn); 
        };
      }
    });
  }

  // 3. Argument Adapters
  // google.script.run passes arguments positionally (e.g., fn(arg1, arg2)),
  // but our API expects { action, token, payload }. This maps them.
  const TOKEN_ARG_ACTIONS = new Set([
    'logout', 'getUserFromToken', 'getBootstrapData', 'getDailyBootstrapData', 'getExtendedData'
  ]);

  const ADAPTERS = {
    validateLogin:          (a) => ({ username: a[0], password: a[1] }),
    getPhotoDataUrls:       (a) => ({ fileIds: a[0] }),
    getPdfBase64:           (a) => ({ fileId: a[0] }),
    saveChecklistPdf:       (a) => ({ checkId: a[0], pdfBase64: a[1] }),
    updateUserEquipment:    (a) => ({ username: a[0], equipmentIds: a[1] }),
    getMissingPdfsForMonth: (a) => ({ group: a[0], ym: a[1] })
  };

  // 4. The actual fetch request to Cloudflare
  function fireRequest(action, args, successFn, failureFn) {
    let token = null;
    let payload = {};

    // Map the arguments correctly
    if (TOKEN_ARG_ACTIONS.has(action)) {
      token = String(args[0] || '') || localStorage.getItem('authToken') || null;
      if (action === 'getExtendedData') payload = args[1] || {};
    } else if (action === 'validateLogin') {
      payload = ADAPTERS.validateLogin(args);
    } else {
      token = localStorage.getItem('authToken') || null;
      const fn = ADAPTERS[action];
      payload = fn ? fn(args) : (args[0] && typeof args[0] === 'object' ? args[0] : {});
    }

     console.log(`[gas-api] Sending action: ${action} | Token: ${token}`);
     
    // Send to Worker
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
        // Save the latest global cache version
        if (res && res.version) {
          localStorage.setItem('_gVersion', res.version);
        }

        // ★ NEW: Handle session expiration gracefully
        if (res && res.success === false && res.code === 'AUTH_EXPIRED') {
          console.warn('Session expired. Logging out...');
          localStorage.removeItem('authToken');
          localStorage.removeItem('_gVersion');
          alert('Your session has expired. Please log in again.');
          window.location.reload();
          return; // Stop processing further
        }

        // Mimic GAS behavior: success handler gets the response, even if success:false
        if (successFn) successFn(res);
      })
      .catch(err => {
        // Mimic GAS behavior: failure handler only gets network/server errors
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
