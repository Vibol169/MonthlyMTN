// Safe Local Storage with Project 2 Prefix
function createSafeStorage(prefix) {
  return {
    get(k, d) { try { const v = localStorage.getItem(prefix + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(prefix + k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(prefix + k); } catch (e) {} }
  };
}

// Safe Session Storage with Project 2 Prefix
function createSafeSessionStorage(prefix) {
  return {
    get(k, d) { try { const v = sessionStorage.getItem(prefix + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(prefix + k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(prefix + k); } catch (e) {} }
  };
}

const LS = createSafeStorage('proj2_');
const SS = createSafeSessionStorage('proj2_');

const APP = {
  user: null, scope: {}, users: [], equipment: [], equipmentMap: {},
  trailers: [], 
  templates: {}, submissions: [], // Monthly
  dailyTemplates: {}, dailySubmissions: [], // Daily
  dailySettings: {},                      // Daily (driver agreement text + weekly interval)
  logoDataUrl: '', signaturesByUser: {},
  drivers: [], technicians: [], assignments: [],
  filterOptions: { groups: [], equipmentIds: [], drivers: [] }, loaded: false
};

let lastSyncTime = parseInt(LS.get('lastSyncTime', '0')) || 0;

function getSyncTimeText() {
  if (!lastSyncTime) return '--:--:--';
  const d = new Date(lastSyncTime);
  // Formats as 24-hour time: 16:52:09
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function updateLastSyncDisplay() {
  $('.last-sync-text').text(getSyncTimeText());
}

function isViewer() {
  return String(currentUser?.role || '').toLowerCase().includes('viewer');
}

/* Users-sheet roles are typed by hand: "Repair Manager" === "repair-manager" */
function normRole(role){
  return String(role == null ? '' : role).trim().toLowerCase().replace(/[\s_]+/g, '-');
}
const ROLE_LABELS = {
  'admin'         : 'Admin',
  'admin-viewer'  : 'Admin (viewer)',
  'manager'       : 'Manager',
  'manager-viewer': 'Manager (viewer)',
  'technician'    : 'Technician',
  'driver'        : 'Driver',
  'repair'        : 'Repair Service',
  'repair-manager': 'Repair Manager'
};
function roleLabel(role){
  const k = normRole(role);
  return ROLE_LABELS[k] || (k ? k : '—');
}
/* The Daily Check app belongs to drivers / admins / managers. Technicians and
   the repair roles work on the monthly checklist only, so the Daily tab is
   hidden for them and switchApp() refuses the app. */
function dailyAppAllowed(){
  const r = normRole(currentUser && currentUser.role);
  return r !== 'technician' && r !== 'repair' && r !== 'repair-manager';
}

window.activeReportForm = 'standard'; // 'standard' or 'table'

window.setReportForm = function(form) {
  window.activeReportForm = form;
  
  if (form === 'standard') {
    $('#btnFormStandard').addClass('btn-primary').removeClass('btn-outline-secondary');
    $('#btnFormTable').removeClass('btn-primary').addClass('btn-outline-secondary');
  } else {
    $('#btnFormTable').addClass('btn-primary').removeClass('btn-outline-secondary');
    $('#btnFormStandard').removeClass('btn-primary').addClass('btn-outline-secondary');
  }
};

function buildAfterInspectionTable() {
  return `
    <div style="margin-top: 20px; margin-bottom: 20px; width: 100%; box-sizing: border-box;">
      <table style="table-layout: fixed; width: 100%; min-width: 100%; max-width: 100%; border-collapse: collapse; word-wrap: break-word;">
        
        <!-- 👇 ADDED COLGROUP FOR FIXED WIDTHS 👇 -->
        <colgroup>
          <col style="width: 5%;">
          <col style="width: 43%;">
          <col style="width: 18%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
          <col style="width: 14%;">
        </colgroup>

        <thead>
          <tr>
            <th colspan="6" style="text-align: center; font-weight: bold; font-size: 14px; border: 1px solid #000; padding: 6px; text-decoration: underline; background-color: #f8f9fa;">
              AFTER INSPECTION
            </th>
          </tr>
          <tr>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">No.</th>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">Items</th>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">Part number/Code</th>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">Quantity</th>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">Task</th>
            <th style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-size: 12px; text-align: center;">Other</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; height: 50px; border: 1px solid #000; font-size: 14px;">1</td>
            <td style="text-align: left; padding-left: 10px; border: 1px solid #000; font-size: 14px;">បាញ់ខ្លាញ់គោ</td>
            <td style="border: 1px solid #000;"></td>
            <td style="border: 1px solid #000;"></td>
            <td style="text-align: center; border: 1px solid #000; font-size: 14px;">✓</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

window.currentReportZoom = 'fit'; // 'fit' or 'actual'

window.toggleReportZoom = function() {
  window.currentReportZoom = window.currentReportZoom === 'fit' ? 'actual' : 'fit';
  applyReportZoom();
};

window.applyReportZoom = function() {
  const wrapper = document.getElementById('reportPreviewWrapper');
  const simulator = document.getElementById('mrptPageSimulator');
  if (!wrapper || !simulator) return;
  
  if (window.currentReportZoom === 'fit') {
    wrapper.style.overflow = 'hidden';
    wrapper.style.justifyContent = 'center';
    
    // Get the exact width of the mobile screen
    const availableWidth = wrapper.clientWidth - 16; 
    const actualWidth = 793; // 210mm in pixels
    
    let scale = availableWidth / actualWidth;
    if (scale > 1) scale = 1; // Don't zoom in larger than 100% on desktop
    
    // Apply the visual scale
    simulator.style.transform = `scale(${scale})`;
    simulator.style.transformOrigin = 'top center';
    
    // Adjust the wrapper's height so there is no huge empty space below
    setTimeout(() => {
      const realHeight = simulator.offsetHeight;
      wrapper.style.height = (realHeight * scale + 16) + 'px'; 
    }, 50);
    
    $('#btnZoomToggle').html('<i class="bi bi-arrows-fullscreen"></i>');
  } else {
    // Actual size (100%)
    wrapper.style.overflow = 'auto';
    wrapper.style.justifyContent = 'flex-start';
    wrapper.style.height = 'auto';
    simulator.style.transform = 'none';
    
    $('#btnZoomToggle').html('<i class="bi bi-arrows-angle-contract"></i>');
  }
};

let listDisplayLimit = 20;
let notifDisplayLimit = 10;
window.isGeneratingPdfMode = false;

/* =========================================================
   WEB WORKER TIMER (Prevents Mobile Background Throttling)
   ========================================================= */
(function initWorker() {
  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(() => { self.postMessage('tick'); }, 60000); // 60 seconds
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    window.syncWorker = new Worker(URL.createObjectURL(blob));
    
    window.syncWorker.onmessage = function(e) {
      if (e.data === 'tick') {
        if (authToken && typeof syncAllData === 'function') {
          console.log('[WebWorker] Triggering 60s auto-sync...');
          syncAllData(true); // true = silent mode
        }
      }
    };
    window.syncWorker.postMessage('start');
  } catch(e) {
    console.warn('Web Worker not supported, falling back to setInterval', e);
    setInterval(() => { if (authToken && typeof syncAllData === 'function') syncAllData(true); }, 60000);
  }
})();

/* Mobile browsers freeze timers in the background, so the 60s worker tick can
   be missed. Refresh as soon as the app becomes visible / online again. */
document.addEventListener('visibilitychange', function(){
  if (document.hidden) return;
  if (!authToken) return;
  if (typeof syncAllData === 'function') syncAllData(true);
});
window.addEventListener('online', function(){
  if (authToken && typeof syncAllData === 'function') syncAllData(true);
});
let currentUser = null;
let authToken = LS.get('authToken', null);
let currentApp = 'monthly'; // 'monthly' or 'daily'
let pendingChecklist = null;
let editingCheckId = null;
let currentDetailModal = null;
let accountModalInstance = null;

let detailItemFilter = 'all';
let detailIssueCode  = 'all';

let listFilters = {
  status: 'all', confirmStatus: 'all', group: 'all', equipmentId: 'all', driver: 'all',
  dateFrom: '', dateTo: '', search: '', nokItemIds: [], nokItemLabel: '', issueCode: 'all'
};

let darkMode      = LS.get('darkMode', 'false') === 'true';
let zoomLevel     = parseInt(LS.get('zoomLevel', '100')) || 100;
let fontSizeLevel = parseInt(LS.get('fontSizeLevel', '2')) || 2;
const fontSizeMap   = ['xsmall','small','medium','large'];
const fontSizeKhmer = ['តូចបំផុត','តូច','មធ្យម','ធំ'];

let homeViewMode        = 'cards';
let homeHistoryMonth    = isoToday().slice(0, 7);
let homeHistoryFilter   = 'all';
let homeStatFilter      = 'all';
let homeExpandedSections = {};
let dashboardSubTab = 'overview';
let mtnFilter       = 'all';
// MTN Management Status tab (new repair-request flow)
let mtnStatusFilter  = 'all';   // case: 'all' | '' (not requested) | 'Requested' | 'Pending' | 'Done'
let mtnStatusItem    = '';      // item: '' (any) | 'Requested' | 'Waiting Repairing' | 'Waiting Spare Part' | 'Repaired'
let mtnStatusGroup   = 'all';
let mtnStatusCompany = 'all';
let mtnStatusMonth   = '';      // 'YYYY-MM' or '' = all months
let mtnStatusSearch  = '';
let mtnStatusSort    = 'newest';
let mtnStatusLimit   = 25;
let homeReportMonth = isoToday().slice(0, 7);
let homeReportDate  = isoToday();


window.techReportForm = 'standard'; // 'standard' or 'after'

window.setTechReportForm = function(form) {
  window.techReportForm = form;
  renderHome(); // Re-render the tab to show the new preview
};
/* =========================================================
   HELPERS & UTILITIES
   ========================================================= */
const esc = (s) => (s==null?'':String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function driveThumbUrl(fileId, size){
  if (!fileId) return '';
  // ★ Using lh3.googleusercontent.com is much faster than drive.google.com/thumbnail
  return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w' + (size || 400);
}

function driveFullUrl(fileId, width){
  if (!fileId) return '';
  return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w' + (width || 1600);
}
function photoSrc(p, size){
  if (!p) return '';
  if (p.thumb)   return p.thumb;
  if (p.dataUrl) return p.dataUrl;
  if (p.fileId)  return driveThumbUrl(p.fileId, size || 200);
  return '';
}

let _signatureCache = {};
function signatureUrl(username){
  if (!username) return '';
  if (_signatureCache[username]) return _signatureCache[username];
  const id = (APP.signaturesByUser || {})[username];
  if (!id) return '';
  if (String(id).indexOf('data:') === 0) return id;
  return driveThumbUrl(id, 200);
}

function loadSignaturesForReport(sub, callback){
  if (!sub) { callback(); return; }
  const usernames = [sub.username, sub.driverUsername, sub.confirmedBy, sub.directorBy].filter(Boolean);
  const missingIds = [];
  const idToUser    = {};
  
  usernames.forEach(u => {
    if (_signatureCache[u]) return;
    const id = (APP.signaturesByUser || {})[u];
    if (!id) return;
    if (String(id).indexOf('data:') === 0) { _signatureCache[u] = id; return; }
    if (!idToUser[id]) { idToUser[id] = []; missingIds.push(id); }
    idToUser[id].push(u);
  });

  if (missingIds.length === 0) { callback(); return; }

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success && res.photos) {
        Object.keys(res.photos).forEach(id => {
          (idToUser[id] || []).forEach(u => { _signatureCache[u] = res.photos[id]; });
        });
      }
      callback();
    })
    .withFailureHandler(() => callback())
    .getPhotoDataUrls(missingIds);
}

const showLoading = (m) => { $('#loadingMessage').text(m||'កំពុងដំណើរការ...'); $('#loadingOverlay').fadeIn(150); };
const hideLoading = () => $('#loadingOverlay').fadeOut(150);
function showAlert(msg, type='info') {
  const id = 'a'+Date.now();
  $('body').append('<div id="'+id+'" class="alert alert-'+type+' alert-dismissible fade show fixed-top m-3" style="z-index:12000;">'+esc(msg)+'<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>');
  setTimeout(()=>$('#'+id).alert('close'), 3500);
}

function handleError(err) {
  console.error("API Error Details:", err);
  hideLoading();
  
  const errMsg = String(err.message || err);
  
  // Only log out if the backend specifically rejects the token
  if (errMsg.includes('Authentication required') || errMsg.includes('Invalid token') || errMsg.includes('No token')) {
    if (authToken) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      authToken = null;
      showLogin();
      showAlert('Session expired. Please log in again.', 'danger');
    } else {
      showLogin();
    }
  } else {
    // For ANY other error, just show a warning toast and DO NOT log out.
    showAlert('កំហុស (Error): ' + errMsg, 'warning');
  }
}

const STATUS_OPTIONS = [
  { code: 'N',  label: 'N - Normal' },
  { code: 'UF', label: 'UF - Urgent Fixing' },
  { code: 'NF', label: 'NF - Need Fixing' },
  { code: 'NA', label: 'NA - Need Adjust' },
  { code: 'Ad', label: 'Ad - Added' },
  { code: 'T',  label: 'T - Tightened' }
];

function normalizeStatus(s) {
  if (!s) return '';
  const t = String(s).trim();
  const up = t.toUpperCase();
  if (up === 'OK')   return 'N';
  if (up === 'NOK')  return 'NF';
  if (up === 'N/A')  return '';
  if (up === 'NA')   return 'NA';
  if (STATUS_OPTIONS.some(o => o.code === t)) return t;
  return t;
}

/* ---------- Date/Time Utils ---------- */
function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function isoToday(){ return isoDate(new Date()); }
function dmyToday(){
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}
function nowTimeStr(){
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function isToday(dateStr){ return dateStr === dmyToday(); }
function isThisMonth(dateStr){
  if (!dateStr) return false;
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return false;
  const now = new Date();
  return (+m[3]) === now.getFullYear() && (+m[2]-1) === now.getMonth();
}
function parseDmyToMs(str){
  if (!str) return 0;
  const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  return new Date(+m[3], +m[2]-1, +m[1]).getTime();
}
function timeToMs(str){
  if (!str) return 0;
  const m = String(str).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return (+m[1]) * 3600000 + (+m[2]) * 60000;
}
function subMs(s){ return parseDmyToMs(s.date) + timeToMs(s.time); }
function parseDmyToDate(str){
  if (!str) return new Date();
  const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date();
  return new Date(+m[3], +m[2]-1, +m[1]);
}

function sectionOf(itemId) {
  if (!itemId) return null;
  const str = String(itemId).trim();
  
  // Catch our custom extra sections first
  if (str.startsWith('EXT-TRK')) return 'EXT-TRK';
  if (str.startsWith('EXT-TRL')) return 'EXT-TRL';
  
  const match = str.match(/^([A-Za-z0-9\u1780-\u17FF]+)[-\.]/);
  if (match) return match[1];
  
  return str;
}

function formatIsoToDmy(iso){ if (!iso) return ''; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return iso; return m[3] + '/' + m[2] + '/' + m[1]; }
function monthLabel(ym){
  if (!ym) return '';
  const parts = ym.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[m-1] + ' ' + y;
}
function shiftMonth(ym, delta){
  const parts = ym.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function isInMonth(dateStr, ym){
  if (!dateStr || !ym) return false;
  const mm = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!mm) return false;
  const iso = mm[3] + '-' + String(mm[2]).padStart(2,'0');
  return iso === ym;
}
function eqShort(id){ if (!id) return ''; const e = (APP.equipmentMap || {})[id]; return e ? (e.shortName || id) : id; }
function eqShortList(ids){ return (ids || []).map(eqShort).filter(Boolean).join(', '); }

/* =========================================================
   SETTINGS & DATE PICKERS
   ========================================================= */
function applyDarkMode(){
  if (darkMode) { $('body').addClass('dark-mode'); $('#darkModeToggle').removeClass('bi-moon-stars').addClass('bi-brightness-high'); }
  else { $('body').removeClass('dark-mode'); $('#darkModeToggle').removeClass('bi-brightness-high').addClass('bi-moon-stars'); }
}

function applyZoom(){ 
  $('#zoomLevel').text(zoomLevel+'%'); 
  if (zoomLevel === 100) {
    // ★ Remove transform at 100% so position: sticky works
    $('#app').css({ transform: 'none' }); 
  } else {
    $('#app').css({ transform:'scale('+(zoomLevel/100)+')', 'transform-origin':'top center' }); 
  }
}

function applyFont(){ $('body').removeClass('font-xsmall font-small font-medium font-large').addClass('font-'+fontSizeMap[fontSizeLevel]); $('#fontSize').text(fontSizeKhmer[fontSizeLevel]); }

function initDatePickers(scope){
  if (typeof flatpickr === 'undefined') return;
  const root = typeof scope === 'string' ? document.querySelector(scope) : (scope || document);
  if (!root) return;
  const locale = {
    firstDayOfWeek: 1,
    weekdays: { shorthand: ['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'], longhand: ['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'] },
    months: { shorthand: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'], longhand: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'] }
  };
  root.querySelectorAll('input[type="date"]:not([data-fp-init])').forEach(el => {
    el.setAttribute('data-fp-init', '1');
    flatpickr(el, { altInput: true, altFormat: 'd/m/Y', dateFormat: 'Y-m-d', allowInput: false, disableMobile: true, locale });
  });
}
function setDateInput(id, isoVal){
  const el = document.getElementById(id);
  if (!el) return;
  if (el._flatpickr) { if (isoVal) el._flatpickr.setDate(isoVal, false); else el._flatpickr.clear(); }
  else { el.value = isoVal || ''; }
}

/* =========================================================
   SHELL & BOOT
   ========================================================= */
window.toggleSideNav = function() {
  const $nav = $('#sideNav');
  const $backdrop = $('#sideNavBackdrop');
  
  if ($nav.hasClass('open')) {
    $nav.removeClass('open');
    $backdrop.removeClass('show');
    $('body').removeClass('sidebar-open');
  } else {
    $nav.addClass('open');
    $backdrop.addClass('show');
    // Only push content on desktop
    if (window.innerWidth >= 992) {
      $('body').addClass('sidebar-open');
    }
  }
};

window.switchApp = function(app) {
  const _role = normRole(currentUser && currentUser.role);
  if (!dailyAppAllowed() && app === 'daily') {
    showAlert('Daily checklist is not available for ' + roleLabel(_role), 'warning');
    return;
  }
  if (currentApp === app) {
    if (window.innerWidth < 992) toggleSideNav();
    return;
  }
  
  currentApp = app;
  LS.set('appChoice', app);
  $('#tabMonthly').toggleClass('active', app === 'monthly');
  $('#tabDaily').toggleClass('active', app === 'daily');
  
  // Update the top title
  $('#currentAppTitle').text(app === 'monthly' ? 'Monthly Check' : 'Daily Check');
  
  // Close sidebar on mobile after selection
  if (window.innerWidth < 992) toggleSideNav();

  renderBottomNav();
  showPage('home');
};

window.openAccountModal = function() {
  $('#accFullName').text(currentUser.fullName);
  $('#accUsername').text('@' + currentUser.username);
  $('#accRole').text(roleLabel(currentUser.role));
  $('#accGroup').text(currentUser.group ? 'ក្រុម: ' + currentUser.group : '');
  if(!accountModalInstance) accountModalInstance = new bootstrap.Modal(document.getElementById('accountModal'));
  accountModalInstance.show();
};

window.doLogout = async function(){
  if (accountModalInstance) accountModalInstance.hide();
  $('.modal-backdrop').remove();
  $('body').removeClass('modal-open');
  $('#sideNav').removeClass('open');
  $('#sideNavBackdrop').removeClass('show');
  $('body').removeClass('sidebar-open');

  showLoading('កំពុងចាកចេញ...');
  
  // 1. Unsubscribe and delete the endpoint from the backend
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe(); // Unsubscribe on device
        // Delete from sheet
        google.script.run.deletePushSubscription({ endpoint: endpoint }); 
      }
    }
  } catch (e) {
    console.error('Push unsub error:', e);
  }

  // 2. Clear Auth and Redirect
  const oldToken = authToken;
  authToken = null; 

  const done = () => { 
    LS.del('authToken'); 
    LS.del(BOOTSTRAP_CACHE_KEY); 
    currentUser = null; 
    APP.loaded = false; 
    hideLoading(); 
    showLogin(); 
  };
  
  google.script.run.withSuccessHandler(done).withFailureHandler(done).logout(oldToken);
};

function showLogin(){ 
  $('#app').hide(); $('#bottomNav').hide(); $('#topHeader').hide(); 
  $('#sideNav').removeClass('open'); $('#sideNavBackdrop').removeClass('show'); $('body').removeClass('sidebar-open');
  $('#loginContainer').css('display', 'flex'); $('#settingsPanel').removeClass('visible'); 
}

window.handleSessionExpired = function() {
  // 1. Clear global state
  authToken = null;
  currentUser = null;
  APP.loaded = false;
  try { LS.del(BOOTSTRAP_CACHE_KEY); } catch (e) {}
  if (APP.submissions) APP.submissions = [];
  if (APP.dailySubmissions) APP.dailySubmissions = [];
  if (window.pendingChecklist) window.pendingChecklist = null;

  // 2. Close any open modals and sidebars
  $('.modal').modal('hide');
  $('.modal-backdrop').remove();
  $('body').removeClass('modal-open').css('overflow', '');
  $('#sideNav').removeClass('open');
  $('#sideNavBackdrop').removeClass('show');
  $('body').removeClass('sidebar-open');

  // 3. Hide App & Show Login
  $('#app').hide(); 
  $('#bottomNav').hide(); 
  $('#topHeader').hide();
  $('#loginContainer').css('display', 'flex');
  $('#settingsPanel').removeClass('visible');

  // 👇 4. CRITICAL: Stop the loading spinner!
  if (typeof hideLoading === 'function') {
    hideLoading();
  } else {
    $('#loadingOverlay').hide(); // Fallback just in case
  }

  // 5. Show a warning to the user
  showAlert('Your session has expired. Please log in again.', 'warning');
};

function showApp(){
  // Any code path that reveals the app must also drop the loading overlay —
  // otherwise the cached fast-load leaves the spinner on screen forever.
  hideLoading();
  clearBootWatchdog();

  // Drivers land on the Daily Check tab by default; an explicit switch is remembered
  const savedApp = String(LS.get('appChoice', '') || '');
  if (savedApp === 'monthly' || savedApp === 'daily') {
    currentApp = savedApp;
  } else {
    currentApp = (normRole(currentUser && currentUser.role) === 'driver') ? 'daily' : 'monthly';
  }
  // Roles without the Daily app can never land on it (even from a saved choice)
  if (!dailyAppAllowed()) currentApp = 'monthly';
  $('#tabDaily').toggle(dailyAppAllowed());
  $('#tabMonthly').toggleClass('active', currentApp === 'monthly');
  $('#tabDaily').toggleClass('active', currentApp === 'daily');

  $('#loginContainer').hide(); $('#app').show(); $('#bottomNav').show(); $('#topHeader').show();
  // Update title just in case
  $('#currentAppTitle').text(currentApp === 'monthly' ? 'Monthly Check' : 'Daily Check');
  renderBottomNav(); 
  showPage('home');
  autoRegisterPush();
}

function renderBottomNav(){
  const role = String((currentUser && currentUser.role) || '').trim().toLowerCase();
  let nav = '<a href="#" data-page="home"><i class="bi bi-house-door"></i>Home</a>';
  
  if (role === 'repair' || role === 'repair-manager') {
    // Repair Service / Repair Manager: List + Dashboard (the MTN status workspace)
    nav = '<a href="#" data-page="list"><i class="bi bi-list-ul"></i>List</a>' +
          '<a href="#" data-page="dashboard"><i class="bi bi-bar-chart"></i>Dashboard</a>';
  } else if (role === 'driver' && currentApp === 'monthly') { 
    nav += '<a href="#" data-page="list"><i class="bi bi-clock-history"></i>History</a>'; 
  } else {
    nav += '<a href="#" data-page="list"><i class="bi bi-list-ul"></i>List</a>';
    // Allow viewers to see the dashboard
    if (role === 'admin' || role === 'manager' || role === 'admin-viewer' || role === 'manager-viewer') {
      nav += '<a href="#" data-page="dashboard"><i class="bi bi-bar-chart"></i>Dashboard</a>';
    }
  }
  
  $('#bottomNav').html(nav);
  $('#bottomNav a').click(function(e){ 
    e.preventDefault(); 
    $('#bottomNav a').removeClass('active'); 
    $(this).addClass('active'); 
    showPage($(this).data('page')); 
  });
}

function showPage(page){
  if (page === 'dashboard' && (currentUser.role === 'technician' || currentUser.role === 'driver')) page = 'home';
  $('#bottomNav a').removeClass('active');
  $('#bottomNav a[data-page="'+page+'"]').addClass('active');
  pendingChecklist = null; editingCheckId = null;
  // Leaving the page always drops a half-filled daily form (submitting / cancelling clears it first)
  if (typeof pendingDailyChecklist !== 'undefined') pendingDailyChecklist = null;
  if (typeof dailyFinishState !== 'undefined') dailyFinishState = { checkId: '', items: [], answers: {}, extras: {} };
  
  if (page === 'home')           renderHome();
  else if (page === 'list')      renderList();
  else if (page === 'dashboard') {
    if (currentApp === 'daily') renderDailyDashboard();
    else renderDashboard();
  }
  updateLastSyncDisplay();
}

const BOOTSTRAP_CACHE_KEY = 'bootstrapCache_v2';
const BOOTSTRAP_CACHE_TTL = 5 * 60 * 1000;

/* Safety net: the boot spinner must never hang forever. If the initial load
   does not finish (slow network, dead request, worker timeout), drop the
   spinner and show the login screen so the user can retry instead of staring
   at a dead loading overlay. */
let _bootWatchdog = null;
function clearBootWatchdog(){
  if (_bootWatchdog) { clearTimeout(_bootWatchdog); _bootWatchdog = null; }
}
function armBootWatchdog(ms){
  clearBootWatchdog();
  _bootWatchdog = setTimeout(function(){
    _bootWatchdog = null;
    if (APP.loaded) return;
    if (!$('#loadingOverlay').is(':visible')) return;
    console.warn('[Boot] loading did not finish in time — recovering');
    hideLoading();
    showAlert('ការផ្ទុកទិន្នន័យយឺតពេក សូមព្យាយាមម្តងទៀត', 'warning');
    showLogin();
  }, ms || 45000);
}

function bootLoad(){
  if (!authToken) { showLogin(); return; } // ★ ADD THIS LINE
  
  let cached = null;
  try {
    const raw = LS.get(BOOTSTRAP_CACHE_KEY, '');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.token === authToken && isMonthlyPayload(obj.monthly) && isDailyPayload(obj.daily) && obj.savedAt && (Date.now() - obj.savedAt < BOOTSTRAP_CACHE_TTL)) {
        cached = obj;
      } else if (obj && obj.token && obj.token !== authToken) {
        // Cache belongs to a different sign-in (or a previous user) — never reuse it
        LS.del(BOOTSTRAP_CACHE_KEY);
      }
    }
  } catch (e) { cached = null; }

  if (cached) {
    try {
      delete cached.savedAt;
      applyBootstrap(cached.monthly, cached.daily);
      hideLoading();          // cached data is on screen — never keep the spinner
      showApp();              // (showApp clears the overlay + the watchdog too)
      fetchBothDatasets(true).then(() => { fetchExtendedData(true); });
      return;
    } catch (e) {
      // A cache that cannot be applied must not block the load
      console.warn('[Boot] cached bootstrap could not be applied — refetching', e);
      try { LS.del(BOOTSTRAP_CACHE_KEY); } catch (_) {}
    }
  }

  showLoading('កំពុងផ្ទុកទិន្នន័យ...');
  armBootWatchdog();        // never leave the user on a dead spinner
  fetchBothDatasets(false)
    .then(() => { hideLoading(); fetchExtendedData(true); })
    .catch(() => { hideLoading(); });
}

window.fetchNotifications = function() {
  if (!authToken || !currentUser) return;
  console.log('🔔 [fetchNotifications] Fetching from server...');
  
  google.script.run
    .withSuccessHandler(notifs => {
      console.log('🔔 [fetchNotifications] Received data:', notifs);
      APP.notifications = notifs || [];
      updateNotifBadge();
    })
    .withFailureHandler(err => {
      console.error('🔔 [fetchNotifications] Error:', err);
    })
    // the server filters by USERNAME (a token would return an empty list)
    .getNotifications(currentUser.username || '');
};

function updateNotifBadge() {
  const unread = (APP.notifications || []).filter(n => String(n.read).toUpperCase() === 'FALSE').length;
  console.log('🔔 [updateNotifBadge] Unread count:', unread);
  
  const $badge = $('#notifBadge');
  if (unread > 0) { $badge.text(unread).show(); } else { $badge.hide(); }
}

/* How many of the newest daily submission rows the client asks for. Keeps the
   minute-by-minute sync fast even when the Daily sheet has years of history. */
const DAILY_BOOTSTRAP_MAX_ROWS = 3000;

function fetchBothDatasets(silent){
  if (!authToken) return Promise.resolve();
  
  if (!silent) localStorage.removeItem('_gVersion'); 

  const tokenAtStart = authToken;
  // "_ts" is a cache-buster: it changes the serialized request body, so a
  // caching proxy in front of the API (e.g. a Cloudflare Worker) can never
  // answer with a stale bootstrap.
  // try/catch inside: if google.script.run is unavailable the promise must still
  // settle, otherwise the loading overlay would stay on screen forever.
  const getMonthly = () => new Promise(r => {
    try {
      google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false }))
        .getBootstrapData(tokenAtStart, { _ts: Date.now() });
    } catch (e) { console.error('[Boot] getBootstrapData call failed', e); r({ success: false }); }
  });
  const getDaily = () => new Promise(r => {
    try {
      google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false }))
        .getDailyBootstrapData(tokenAtStart, { _ts: Date.now(), maxRows: DAILY_BOOTSTRAP_MAX_ROWS });
    } catch (e) { console.error('[Boot] getDailyBootstrapData call failed', e); r({ success: false }); }
  });

  return new Promise((resolve) => {
    // Serial on purpose: two google.script.run calls in flight at the same time
    // can deliver their responses to the wrong handler, and the daily payload
    // used to overwrite / wipe the monthly (or daily) cache.
    let settled = false;
    // Every exit path ends here, so the overlay can never be left behind.
    const done = () => {
      if (settled) return;
      settled = true;
      if (!silent) hideLoading();
      resolve();
    };

    const finish = (resM, resD) => {
      if (!authToken || tokenAtStart !== authToken) { done(); return; }
      if (!silent) hideLoading();

      const mUnchanged = !!(resM && resM.unchanged) && !isMonthlyPayload(resM);
      const dUnchanged = !!(resD && resD.unchanged) && !isDailyPayload(resD);

      if (mUnchanged && (dUnchanged || !resD)) {
        if (resM.notifications) { APP.notifications = resM.notifications; updateNotifBadge(); }
        done(); return;
      }

      if (!isMonthlyPayload(resM)) {
        // A "no change" stub is not an error — keep everything we already have
        if (mUnchanged) {
          if (isDailyPayload(resD)) { applyDailyBootstrap(resD); refreshDailyView(); }
          done(); return;
        }
        if (!silent) {
          showAlert('Load failed. Please check your internet or login again.', 'danger'); 
          authToken = null; LS.del('authToken'); LS.del(BOOTSTRAP_CACHE_KEY); showLogin(); 
        }
        done(); return;
      }

      applyBootstrap(resM, resD); // keeps the old daily data when resD is invalid

      lastSyncTime = Date.now();
      LS.set('lastSyncTime', lastSyncTime);

      if (!silent) {
        if (isDailyPayload(resD)) {
          try { LS.set(BOOTSTRAP_CACHE_KEY, JSON.stringify({ token: authToken, monthly: resM, daily: resD, savedAt: Date.now() })); } catch(e) {}
        }
        showApp();
      } else {
        refreshDailyView();   // daily-aware: keeps filters/search intact
      }
      done();
    };

    getMonthly().then(resM => {
      if (!authToken || tokenAtStart !== authToken) { done(); return; }

      // Version cache short-circuit → ask once more for the real payload
      if (resM && resM.unchanged && !isMonthlyPayload(resM)) {
        localStorage.removeItem('_gVersion');
        return getMonthly().then(retry => getDaily().then(resD => finish(retry, resD)));
      }
      getDaily().then(resD => {
        // Daily side did not arrive / was a "no change" stub → retry it once
        if (!isDailyPayload(resD)) {
          localStorage.removeItem('_gVersion');
          return getDaily().then(retryD => finish(resM, isDailyPayload(retryD) ? retryD : null));
        }
        finish(resM, resD);
      });
    }).catch(() => { if (!silent) hideLoading(); done(); });
  });
}


function fetchExtendedData(silent) {
  if (!authToken) return;
  if (silent && !safeToRefresh()) {
    console.log('Postponing background load to not disturb user');
    return;
  }
  
  const opts = { daysBack: 365, maxSubs: 3000, _ts: Date.now() };
  
  google.script.run
    .withSuccessHandler(res => {
      if (!res || !res.success) return;
      
      // ★ FIX: If unchanged, just exit silently
      if (res.unchanged) {
        console.log('[Sync] Extended data unchanged.');
        return;
      }

      if (res.submissions) {
        const existingIds = new Set(APP.submissions.map(s => s.checkId));
        let added = 0;
        
        res.submissions.forEach(s => {
          if (!existingIds.has(s.checkId)) {
            APP.submissions.push(s);
            added++;
          }
        });
        
        if (added > 0) {
          APP.submissions.sort((a, b) => subMs(b) - subMs(a));
          if (silent && safeToRefresh()) {
            refreshCurrentPage();
          }
        }
        console.log('Background load complete. Added ' + added + ' old records.');
      }
    })
    .withFailureHandler(e => console.error("Extended load failed", e))
    .getExtendedData(authToken, opts);
}

/* =========================================================
   60-SECOND BACKGROUND SYNC (Web Worker Timer)

   The worker timer calls syncAllData(true) every minute.

   • Daily app   → ONE light getDailyBootstrapData call per tick, so the
                   daily cards/list really do update every minute. The heavy
                   monthly bootstrap (equipment/trailers/users) runs on every
                   5th tick only.
   • Monthly app → full serial bootstrap (monthly, then daily).
   • Never two syncs at once, every payload is validated, and the page is
     only repainted when the data actually changed.
   • Every request carries a "_ts" nonce, so a caching proxy in front of the
     API (Cloudflare Worker) can never serve a stale bootstrap.
   ========================================================= */
let _syncInFlight = false;
let _syncStartedAt = 0;
let _syncTick = 0;

/* Cheap change-detector for the daily half (newest rows + template shape) */
function dailyFingerprint(){
  const subs = APP.dailySubmissions || [];
  const tpl  = APP.dailyTemplates || {};
  let h = subs.length + ':' + Object.keys(tpl).length + ':' +
          Object.keys(tpl).reduce((n, k) => n + ((tpl[k] || []).length), 0);
  const tail = subs.slice(-40);
  for (let i = 0; i < tail.length; i++) {
    const s = tail[i] || {};
    h += '|' + s.checkId + ',' + s.overall + ',' + s.opStatus + ',' + s.confirmStatus + ',' +
         s.agreementAt + ',' + s.endOdo + ',' + s.endHour + ',' + s.finishedAt + ',' + s.handoverAt;
  }
  return h;
}

/* Repaint only the tab that is on screen, and only its data-driven part
   (the daily list keeps its search box and filters untouched). */
function refreshDailyView(){
  if (!safeToRefresh()) return;
  const page = $('#bottomNav a.active').data('page') || 'home';
  if (page === 'home') {
    if (currentApp === 'daily') renderDailyHome(); else renderHome();
  } else if (page === 'list') {
    if (currentApp === 'daily') updateDailyListResults(); else updateListResults();
  } else if (page === 'dashboard') {
    if (currentApp === 'daily') renderDailyDashboard(); else renderDashboard();
  }
  updateLastSyncDisplay();
}

/* Daily half only — one light request, retried once when the call fails. */
function syncDailyOnly(cb){
  if (!authToken) { if (cb) cb(false); return; }
  const attempt = (tries) => {
    google.script.run
      .withSuccessHandler(res => {
        let ok = false;
        try { ok = applyDailyBootstrap(res); }
        catch (e) { console.error('[Sync] could not apply the daily payload', e); }
        if (ok) {
          lastSyncTime = Date.now();
          LS.set('lastSyncTime', lastSyncTime);
          if (cb) cb(true);
          return;
        }
        if (tries > 0) { attempt(tries - 1); return; }
        console.warn('[Sync] Daily payload rejected:', res);
        if (cb) cb(false);
      })
      .withFailureHandler(err => {
        if (tries > 0) { attempt(tries - 1); return; }
        console.error('[Sync] Daily fetch failed:', err);
        if (cb) cb(false);
      })
      .getDailyBootstrapData(authToken, { _ts: Date.now(), maxRows: DAILY_BOOTSTRAP_MAX_ROWS });
  };
  attempt(1);
}

/* Monthly half only — keeps equipment / trailers / users fresh for daily
   users; the daily arrays are left exactly as they are. */
function syncMonthlyOnly(cb){
  if (!authToken) { if (cb) cb(); return; }
  google.script.run
    .withSuccessHandler(resM => {
      try {
        if (isMonthlyPayload(resM)) {
          applyBootstrap(resM, null);      // daily half untouched
          lastSyncTime = Date.now();
          LS.set('lastSyncTime', lastSyncTime);
        }
      } catch (e) {
        console.error('[Sync] could not apply the monthly payload', e);
      } finally {
        if (cb) cb();
      }
    })
    .withFailureHandler(() => { if (cb) cb(); })
    .getBootstrapData(authToken, { _ts: Date.now() });
}

window.syncAllData = function(silent) {
  if (!authToken) return;

  // Never start a background sync while the first load is still running:
  // two google.script.run calls at the same time can cross their responses and
  // would break the bootstrap that is currently filling the screen.
  if (!APP.loaded) {
    console.log('[Sync] skipped — initial load still in progress');
    return;
  }

  // If it's a silent sync, make sure we don't interrupt the user
  if (silent && !safeToRefresh()) {
    console.log('Sync postponed: User is busy (modal open or filling form)');
    return;
  }
  if (_syncInFlight) {
    // A request that never answered must not block every later tick
    if (Date.now() - _syncStartedAt < 90000) {
      console.log('[Sync] previous sync still running — tick skipped');
      return;
    }
    console.warn('[Sync] previous sync looks stuck — resetting');
  }
  _syncInFlight = true;
  _syncStartedAt = Date.now();
  const finish = () => { _syncInFlight = false; updateLastSyncDisplay(); };

  /* ---- Daily app: light daily refresh every minute ---- */
  if (silent && currentApp === 'daily') {
    _syncTick++;
    const withMonthly = (_syncTick % 5 === 1);   // tick 1, 6, 11 …
    const before = dailyFingerprint();

    syncDailyOnly(() => {
      const changed = dailyFingerprint() !== before;
      const after = () => {
        try {
          if (changed || withMonthly) refreshDailyView();
          console.log('[Sync] daily tick #' + _syncTick + (changed ? ' — updated' : ' — no change'));
        } finally { finish(); }
      };
      if (withMonthly) syncMonthlyOnly(after);
      else after();
    });
    return;
  }

  /* ---- Monthly app / manual refresh: full serial bootstrap ---- */
  fetchBothDatasets(!!silent).then(() => { finish(); }).catch(() => { finish(); });
};

// Keep reloadAll as an alias so existing UI buttons don't break, but route them to sync
window.reloadAll = function() {
  _syncTick = 0;                 // force the monthly half on the next tick
  return syncAllData(true);
};

/* ---------- Payload guards ----------
   Two google.script.run calls fired together can, on some browsers, deliver
   their responses to each other's success handler. Applying the daily payload
   as if it were the monthly one (or the other way round) wiped
   APP.dailySubmissions / APP.dailyTemplates (card flipped to "Start new
   checklist", template "missing") and crashed on APP.user.username.
   Every payload is now validated first and only then applied — an unexpected
   payload changes nothing at all. */
function isMonthlyPayload(res){
  return !!(res && res.success === true && res.user && typeof res.user === 'object');
}
function isDailyPayload(res){
  return !!(res && res.success === true && Array.isArray(res.dailySubmissions) &&
            res.dailyTemplates && typeof res.dailyTemplates === 'object');
}
/* Apply only the daily half of the bootstrap (also used to self-heal a
   missing template without touching the monthly data). */
function applyDailyBootstrap(resD){
  if (!isDailyPayload(resD)) return false;
  APP.dailySubmissions = resD.dailySubmissions;
  APP.dailyTemplates   = resD.dailyTemplates;
  if (resD.dailySettings) APP.dailySettings = resD.dailySettings;
  return true;
}

function applyBootstrap(resM, resD){
  if (!isMonthlyPayload(resM)) return false;   // never half-apply a bad payload

  APP.user = resM.user; APP.scope = resM.scope || {}; 
  APP.user.role = String(APP.user.role || '').trim().toLowerCase();
  APP.users = resM.users || []; 
  APP.equipment = resM.equipment || []; APP.trailers = resM.trailers || [];
  APP.templates = resM.templates || {}; APP.submissions = resM.submissions || [];
  APP.logoDataUrl = resM.logoDataUrl || '';
  APP.logoFCCDataUrl = resM.logoFCCDataUrl || '';  
  APP.signaturesByUser = resM.signaturesByUser || {};
  APP.drivers = resM.drivers || []; APP.technicians = resM.technicians || [];
  APP.assignments = resM.assignments || [];
  APP.filterOptions = resM.filterOptions || { groups: [], equipmentIds: [], drivers: [] };

  if (resM.notifications) {
    APP.notifications = resM.notifications;
    updateNotifBadge();
  }

  // Daily data — kept intact when the daily payload did not arrive
  applyDailyBootstrap(resD);

  APP.equipmentMap = {};
  APP.equipment.forEach(e => { APP.equipmentMap[e.equipmentId] = e; });
  APP.loaded = true;
  
  currentUser = { 
    username: APP.user.username, role: normRole(APP.user.role), 
    group: APP.user.group, equipment: APP.user.equipment || [], 
    fullName: APP.user.fullName 
  };
  return true;
}

function refreshCurrentPage(){
  if (!authToken) return;
  const page = $('#bottomNav a.active').data('page') || 'home';
  // Always dispatch to the renderer of the app that is open (daily vs monthly)
  if (page === 'home') {
    if (currentApp === 'daily') renderDailyHome(); else renderHome();
  } else if (page === 'list') {
    if (currentApp === 'daily') updateDailyListResults(); else updateListResults();
  } else if (page === 'dashboard') {
    if (currentApp === 'daily') renderDailyDashboard(); else renderDashboard();
  }
  updateLastSyncDisplay();
}

/* Repaint the tab that is on screen from the data already in APP.
   Never wait for the network — that is what made the daily cards look stale.
   Skipped while a checklist / finished form is being filled in. */
function repaintCurrentPage(){
  if (!safeToRefresh()) return;
  showPage($('#bottomNav a.active').data('page') || 'home');
}

/* Pull monthly + daily bootstrap after a daily action, then repaint.
   Serial calls (never in parallel) + validated payloads, so a slow or failed
   request can never wipe the checklist that is already on screen. */
let _dailySyncSeq = 0;
function dailySyncNow(){
  if (!authToken) return Promise.resolve();
  const seq = ++_dailySyncSeq;
  const tokenAtStart = authToken;

  const getMonthly = () => new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r(null)).getBootstrapData(tokenAtStart, { _ts: Date.now() }));
  const getDaily   = () => new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r(null)).getDailyBootstrapData(tokenAtStart, { _ts: Date.now(), maxRows: DAILY_BOOTSTRAP_MAX_ROWS }));

  return new Promise(resolve => {
    const stale = () => !authToken || seq !== _dailySyncSeq;
    const done = () => resolve();

    getMonthly().then(resM => {
      if (stale()) { done(); return; }
      const again = (resM && resM.unchanged && !isMonthlyPayload(resM)) ? getMonthly() : Promise.resolve(resM);
      return again.then(resM2 => {
        if (stale()) { done(); return; }
        return getDaily().then(resD => {
          if (stale()) { done(); return; }
          const retry = (resD && resD.unchanged && !isDailyPayload(resD)) ? getDaily() : Promise.resolve(resD);
          return retry.then(resD2 => {
            if (stale()) { done(); return; }
            finish(resM2, resD2);
          });
        });
      });
    }).catch(() => done());

    function finish(resM, resD) {
      // Apply whatever arrived in a valid shape — an invalid/absent half keeps
      // the data we already have instead of clearing it.
      const okM = applyBootstrap(resM, resD);
      if (!okM) applyDailyBootstrap(resD);

      lastSyncTime = Date.now();
      LS.set('lastSyncTime', lastSyncTime);
      if (okM && isDailyPayload(resD) && resM && !resM.unchanged) {
        try { LS.set(BOOTSTRAP_CACHE_KEY, JSON.stringify({ token: tokenAtStart, monthly: resM, daily: resD, savedAt: Date.now() })); } catch(e) {}
      }
      repaintCurrentPage();
      updateLastSyncDisplay();
      done();
    }
  });
}

/* Reload only the daily half of the bootstrap (used when a template or a
   submission is missing from memory after a failed sync). */
function reloadDailyData(cb){
  if (!authToken) { if (cb) cb(false); return; }
  google.script.run
    .withSuccessHandler(res => { const ok = applyDailyBootstrap(res); if (cb) cb(ok); })
    .withFailureHandler(() => { if (cb) cb(false); })
    .getDailyBootstrapData(authToken, { _ts: Date.now(), maxRows: DAILY_BOOTSTRAP_MAX_ROWS });
}

function safeToRefresh(){
  if (pendingChecklist) return false;
  if (typeof pendingDailyChecklist !== 'undefined' && pendingDailyChecklist) return false;
  if (typeof dailyFinishState !== 'undefined' && dailyFinishState && dailyFinishState.checkId) return false;
  if ($('#detailModal').hasClass('show'))  return false;
  if ($('#remarkModal').hasClass('show'))  return false;
  if ($('#accountModal').hasClass('show')) return false;
  return true;
}

/* ---------- Remark Modal ---------- */
let _remarkModalInstance = null;
let _remarkModalCallback = null;

function askRemark(opts, callback){
  opts = opts || {};
  _remarkModalCallback = callback;
  const $m = $('#remarkModal');
  if (!$m.length) {
    const r = prompt(opts.label || 'Remark:', opts.value || '');
    if (r === null) callback(null); else callback(r.trim());
    return;
  }
  $('#remarkModalTitle').html('<i class="bi bi-chat-left-text me-2 text-primary"></i>' + esc(opts.title || 'Remark'));
  $('#remarkModalLabel').text(opts.label || 'Remark (optional):');
  $('#remarkModalInput').val(opts.value || '').attr('placeholder', opts.placeholder || 'បញ្ជាក់...');
  if (!_remarkModalInstance) _remarkModalInstance = new bootstrap.Modal(document.getElementById('remarkModal'));
  _remarkModalInstance.show();
  setTimeout(() => { const el = document.getElementById('remarkModalInput'); if (el) el.focus(); }, 250);
}

/* =========================================================
   DOCUMENT READY
   ========================================================= */
$(document).ready(function(){
  applyDarkMode(); applyZoom(); applyFont();
  try { 
    currentDetailModal = new bootstrap.Modal(document.getElementById('detailModal')); 
    accountModalInstance = new bootstrap.Modal(document.getElementById('accountModal'));
  } catch (e) {}

  $('#remarkModalOk').on('click', function(){
    const val = ($('#remarkModalInput').val() || '').trim();
    if (_remarkModalInstance) _remarkModalInstance.hide();
    if (typeof _remarkModalCallback === 'function') _remarkModalCallback(val);
    _remarkModalCallback = null;
  });
  $('#remarkModal').on('hidden.bs.modal', function(){
    if (typeof _remarkModalCallback === 'function') { _remarkModalCallback(null); _remarkModalCallback = null; }
  });
  // Closing a modal unblocks the silent sync — catch up right away if the last
  // successful sync is already older than one minute.
  $('#detailModal, #remarkModal, #accountModal').on('hidden.bs.modal', function(){
    if (authToken && Date.now() - (lastSyncTime || 0) > 60000 && typeof syncAllData === 'function') {
      syncAllData(true);
    }
  });
  $('#remarkModalInput').on('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#remarkModalOk').click(); }
  });

  $('#darkModeToggle').click(()=>{ darkMode=!darkMode; LS.set('darkMode', darkMode); applyDarkMode(); });
  $('#zoomIn').click(()=>{ zoomLevel=Math.min(150,zoomLevel+10); LS.set('zoomLevel',zoomLevel); applyZoom(); });
  $('#zoomOut').click(()=>{ zoomLevel=Math.max(60,zoomLevel-10); LS.set('zoomLevel',zoomLevel); applyZoom(); });
  $('#fontIncrease').click(()=>{ fontSizeLevel=Math.min(3,fontSizeLevel+1); LS.set('fontSizeLevel',fontSizeLevel); applyFont(); });
  $('#fontDecrease').click(()=>{ fontSizeLevel=Math.max(0,fontSizeLevel-1); LS.set('fontSizeLevel',fontSizeLevel); applyFont(); });

      if (authToken) {
    showLoading('កំពុងផ្ទៀងផ្ទាត់...'); 
    armBootWatchdog();          // token check must never hang forever either
    google.script.run.withSuccessHandler(user => {
      if (user) {
        currentUser = user;
        currentUser.role = normRole(currentUser.role);
        currentUser.equipment = currentUser.equipment || [];
        
        // ★ ADD THIS LINE: Hide login form immediately
        $('#loginContainer').hide(); 
        
        bootLoad(); 
      } else { 
        hideLoading(); 
        authToken = null; LS.del('authToken'); showLogin(); 
      }
    }).withFailureHandler(() => { 
      hideLoading(); 
      authToken = null; LS.del('authToken'); showLogin(); 
    }).getUserFromToken(authToken);
  } else showLogin();

     $('#loginForm').submit(function(e){
    e.preventDefault();
    const u = $('#username').val().trim(), p = $('#password').val();
    $('#loginError').text('');
    showLoading('កំពុងចូល...');
    
        google.script.run.withSuccessHandler(res => {
      if (res.success) {
        authToken = res.token; 
        LS.set('authToken', authToken);
        try { LS.del(BOOTSTRAP_CACHE_KEY); } catch (e) {}
        currentUser = { username: res.username };
        
        $('#loginContainer').hide(); 
        
        // ★ NEW: Wait 1.5 seconds for Google Sheets to finish saving the token
        showLoading('កំពុងចូល...');
        armBootWatchdog();       // a stuck login load must not trap the user either
        setTimeout(() => {
          try { bootLoad(); }
          catch (e) {
            console.error('[Boot] load after login failed', e);
            hideLoading();
            showAlert('ការផ្ទុកទិន្នន័យបរាជ័យ សូមព្យាយាមម្តងទៀត', 'danger');
          }
        }, 1500);
        
      } else {
        hideLoading();
        $('#loginError').text(res.message || 'Login failed');
      }
    }).withFailureHandler(e => { 
      hideLoading(); 
      $('#loginError').text(e.message || e); 
    }).validateLogin(u, p);
  });
  updateLastSyncDisplay();
});


/*ScriptHome*/

/* =========================================================
   MAIN HOME ROUTER
   ========================================================= */
function renderHome(){
  if (!APP.loaded) { bootLoad(); return; }

  // Repair Service / Repair Manager land directly on the MTN status workspace
  if (normRole(currentUser.role) === 'repair' || normRole(currentUser.role) === 'repair-manager') {
    dashboardSubTab = 'status';
    showPage('dashboard');
    return;
  }
  
  if (currentApp === 'daily') {
    renderDailyHome();
    return;
  }

  if (currentUser.role === 'technician')   renderTechnicianHome();
  else if (currentUser.role === 'driver')  renderMonthlyDriverHome();
  else if (currentUser.role === 'admin' || currentUser.role === 'admin-viewer')   renderManagerHome();
  else if (currentUser.role === 'manager' || currentUser.role === 'manager-viewer') renderDirectorHome();
}

/* =========================================================
   SHARED HOME HELPERS
   ========================================================= */
window.setHomeStatFilter = function(filter){ homeStatFilter = (homeStatFilter === filter) ? 'all' : filter; homeExpandedSections = {}; renderHome(); };
window.clearHomeStatFilter = function(){ homeStatFilter = 'all'; homeExpandedSections = {}; renderHome(); };
window.toggleHomeSection = function(key, expand){ homeExpandedSections[key] = !!expand; renderHome(); };

function renderSectionWithLimit(arr, sectionKey, renderer, forceAll){
  const MAX = 5;
  const isExpanded = !!homeExpandedSections[sectionKey];
  const visible = (isExpanded || forceAll) ? arr : arr.slice(0, MAX);
  let html = visible.map(renderer).join('');
  if (!forceAll && arr.length > MAX) {
    if (isExpanded) html += '<div class="text-center mb-3"><button class="btn btn-sm btn-outline-secondary" onclick="toggleHomeSection(\'' + sectionKey + '\', false)"><i class="bi bi-chevron-up me-1"></i>Show less</button></div>';
    else html += '<div class="text-center mb-3"><button class="btn btn-sm btn-outline-primary" onclick="toggleHomeSection(\'' + sectionKey + '\', true)">View more (' + (arr.length - MAX) + ') <i class="bi bi-chevron-down ms-1"></i></button></div>';
  }
  return html;
}

function renderHomeFilterChip(){
  if (homeStatFilter === 'all') return '';
  const labels = { done: 'Completed', pending: 'Pending', assigned: 'Assigned', toConfirm: 'To confirm', issues: 'Issues' };
  const lbl = labels[homeStatFilter] || homeStatFilter;
  return '<div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-primary d-flex align-items-center gap-1" style="font-size:.8rem;padding:6px 10px;"><i class="bi bi-funnel-fill"></i> Filter: ' + esc(lbl) + '<span onclick="clearHomeStatFilter()" style="cursor:pointer;margin-left:6px;font-weight:700;">✕</span></span></div>';
}

function findDefaultDriver(equipmentId){
  if (!equipmentId) return '';
  const d = (APP.drivers || []).find(x => (x.equipment || []).indexOf(equipmentId) !== -1);
  if (d) return d.username;
  const past = (APP.assignments || []).filter(a => a.equipmentId === equipmentId && a.driverUsername).sort((a, b) => (parseDmyToMs(b.date) || 0) - (parseDmyToMs(a.date) || 0));
  if (past.length > 0) return past[0].driverUsername;
  return '';
}

function countIssueCodes(sub){
  const counts = { all: 0, UF: 0, NF: 0, NA: 0, Ad: 0, T: 0 };
  const fixed  = { all: 0, UF: 0, NF: 0, NA: 0, Ad: 0, T: 0 };
  (sub.checks || []).forEach(c => {
    const n = normalizeStatus(c.status);
    if (!n || n === 'N') return;
    counts.all++;
    if (counts[n] !== undefined) counts[n]++;
    // Repaired or "Not Request" both mean this issue item needs no more work
    if (mtnItemDone(sub, c.itemId)) {
      fixed.all++;
      if (fixed[n] !== undefined) fixed[n]++;
    }
  });
  return { counts, fixed };
}

function formatAgo(dateStr){
  if (!dateStr) return '';
  const ms = parseDmyToMs(dateStr);
  if (!ms) return '';
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = Math.floor((today.getTime() - ms) / 86400000);
  if (diff <= 0)   return 'today';
  if (diff === 1)  return '1 day ago';
  if (diff < 30)   return diff + ' days ago';
  const months = Math.floor(diff / 30);
  if (months === 1) return '1 month ago';
  if (months < 12)  return months + ' months ago';
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : years + ' years ago';
}

function getLastCheck(equipmentId){
  const subs = (APP.submissions || []).filter(s => s.equipmentId === equipmentId);
  if (subs.length === 0) return null;
  subs.sort((a,b) => subMs(b) - subMs(a));
  const latest = subs[0];
  return { date: latest.date, time: latest.time, by: latest.driverName || latest.username || '', ago: formatAgo(latest.date), checkId: latest.checkId, overall: latest.overall };
}

function renderLastCheckLine(equipmentId){
  const lc = getLastCheck(equipmentId);
  if (!lc) return '<div class="small text-secondary mb-2"><i class="bi bi-clock-history me-1"></i>Never checked before</div>';
  const statCls = lc.overall === 'Issues' ? 'text-danger' : 'text-success';
  return '<div class="small text-muted mb-2"><i class="bi bi-clock-history me-1"></i>ថ្ងៃត្រួតពិនិត្យចុងក្រោយ: <strong>' + esc(lc.date) + '</strong> <span class="text-secondary">(' + esc(lc.ago) + ')</span> · <span class="' + statCls + '">' + esc(lc.overall) + '</span></div>';
}

/* =========================================================
   MONTHLY HOME VIEWS
   ========================================================= */
function renderHomeViewToggle(){
  const role = currentUser.role;
  const showReport = (role === 'technician' || role === 'admin' || role === 'admin-viewer'|| role === 'manager' || role === 'manager-viewer');
  
  return '<div class="tab-bar mb-3" style="border-radius:10px;overflow:visible;">' +
    '<div class="tab ' + (homeViewMode === 'cards' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setHomeView(\'cards\')"><i class="bi bi-grid me-1"></i>Cards</div>' +
    '<div class="tab ' + (homeViewMode === 'history' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setHomeView(\'history\')"><i class="bi bi-table me-1"></i>History</div>' +
    (showReport ? '<div class="tab ' + (homeViewMode === 'report' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setHomeView(\'report\')"><i class="bi bi-file-earmark-text me-1"></i>Report</div>' : '') +
    '</div>';
}

function renderHomeHistoryTable(){
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const myGroup = isManagerViewing ? (window.managerReportGroup || 'រថយន្ត') : currentUser.group;
  
  const ym      = homeHistoryMonth;
  const currentYM = isoToday().slice(0, 7);
  const isCurrent = ym === currentYM;
  
  // Build Month Options
  const monthOptions = [];
  let tempYM = currentYM;
  while (tempYM >= '2026-01') { monthOptions.push(tempYM); tempYM = shiftMonth(tempYM, -1); }
  const monthSelectOptions = monthOptions.map(m => '<option value="' + escAttr(m) + '"' + (m === ym ? ' selected' : '') + '>' + esc(monthLabel(m)) + (m === currentYM ? ' (current)' : '') + '</option>').join('');

  // Prepare Groups for Dropdown (if Manager)
  const GROUP_ORDER = ['រថយន្ត', 'RTG', 'គ្រឿងចក្រ', 'TCC&FCC'];
  const eqGroups = [...new Set((APP.equipment || []).map(e => e.group).filter(Boolean))];
  const availableGroups = GROUP_ORDER.filter(g => eqGroups.indexOf(g) !== -1);

  let html = '<div class="card mb-3">';
  html += '<div class="group-header d-flex justify-content-between align-items-center flex-wrap gap-2"><span><i class="bi bi-table me-2"></i>Checklist History</span></div>';
  
  // Month Selector & Group Selector Row
  html += '<div class="p-3 border-bottom" style="border-color:var(--border-color) !important;"><div class="row g-2 align-items-end">';
  
  // Month Controls
  html += '<div class="col-12 col-md-6"><div class="row g-2 align-items-center">';
  html += '<div class="col-auto"><button class="btn btn-sm btn-outline-secondary" onclick="homePrevMonth()"><i class="bi bi-chevron-left"></i></button></div>';
  html += '<div class="col"><select class="form-select form-select-sm text-center fw-bold" onchange="onHistoryMonthChange(this.value)">' + monthSelectOptions + '</select></div>';
  html += '<div class="col-auto"><button class="btn btn-sm btn-outline-secondary" onclick="homeNextMonth()"' + (isCurrent ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button></div>';
  html += '</div></div>';
  
  // Group Dropdown (Only for Manager)
  if (isManagerViewing) {
    html += '<div class="col-12 col-md-6">';
    html += '<label class="small fw-bold text-muted mb-1"><i class="bi bi-diagram-3 me-1"></i>Select Group</label>';
    html += '<select class="form-select form-select-sm fw-bold text-primary" onchange="onManagerReportGroupChange(this.value)">';
    html += availableGroups.map(g => '<option value="' + escAttr(g) + '"' + (g === myGroup ? ' selected' : '') + '>' + esc(g) + '</option>').join('');
    html += '</select></div>';
  }
  
  html += '</div></div><div class="card-body p-0">';

  // ==========================================
  // 👇 TCC&FCC LOGIC 👇
  // ==========================================
  if (myGroup === 'TCC&FCC') {
    const monthSubs = (APP.submissions || []).filter(s => s.group === myGroup && isInMonth(s.date, ym));
    
    // Desktop Table
    html += '<div class="history-table-desktop table-responsive"><table class="table table-hover align-middle mb-0" style="font-size:.82rem;">';
    html += '<thead style="background:var(--header-bg);"><tr><th style="width:34px;" class="text-center">#</th><th>Equipment</th><th style="width:86px;" class="text-center">Status</th><th style="width:110px;">Date & Time</th><th style="width:120px;">By</th><th style="width:44px;" class="text-center"></th></tr></thead><tbody>';
    
    if (monthSubs.length === 0) {
      html += '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-inbox" style="font-size:1.5rem;opacity:.5;"></i><div class="mt-1">No checklists this month</div></td></tr>';
    } else {
      monthSubs.forEach((s, i) => {
        const isIssue = s.overall === 'Issues';
        const statCls = isIssue ? 'bg-danger' : 'bg-success';
        const statIcon = isIssue ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
        
        html += '<tr class="history-row-clickable" onclick="viewCheck(\'' + escAttr(s.checkId) + '\')" style="cursor:pointer;">';
        html += '<td class="text-center text-muted fw-bold">' + (i + 1) + '</td>';
        html += '<td><div class="fw-bold">' + esc(eqShort(s.equipmentId)) + '</div><div class="small text-muted">' + esc(s.equipmentId) + '</div></td>';
        html += '<td class="text-center"><span class="badge ' + statCls + '"><i class="bi ' + statIcon + ' me-1"></i>' + esc(s.overall) + '</span></td>';
        html += '<td><div class="fw-semibold">' + esc(s.date) + '</div><div class="small text-muted">' + esc(s.time) + '</div></td>';
        html += '<td class="small">' + esc(s.driverName || s.username) + '</td>';
        html += '<td class="text-center"><i class="bi bi-chevron-right text-muted"></i></td>';
        html += '</tr>';
      });
    }
    html += '</tbody></table></div>';

    // Mobile Cards
    html += '<div class="history-cards-mobile">';
    if (monthSubs.length === 0) {
      html += '<div class="text-center text-muted py-4"><i class="bi bi-inbox" style="font-size:1.8rem;opacity:.5;"></i><div class="mt-2 small">No checklists this month</div></div>';
    } else {
      monthSubs.forEach((s, i) => {
        const isIssue = s.overall === 'Issues';
        const statCls = isIssue ? 'bg-danger' : 'bg-success';
        const statIcon = isIssue ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
        
        html += '<div class="history-mobile-card" onclick="viewCheck(\'' + escAttr(s.checkId) + '\')">';
        html += '<div class="d-flex justify-content-between align-items-start mb-2">';
        html += '<div class="flex-grow-1 me-2"><div class="fw-bold"><span class="text-muted me-1">' + (i + 1) + '.</span>' + esc(eqShort(s.equipmentId)) + '</div></div>';
        html += '<div class="text-end"><span class="badge ' + statCls + '"><i class="bi ' + statIcon + ' me-1"></i>' + esc(s.overall) + '</span></div>';
        html += '</div>';
        html += '<div class="d-flex justify-content-between align-items-center small">';
        html += '<div><i class="bi bi-calendar me-1 text-muted"></i><span class="fw-semibold">' + esc(s.date) + '</span> <span class="text-muted">' + esc(s.time) + '</span></div>';
        html += '<i class="bi bi-chevron-right text-muted"></i></div>';
        html += '<div class="small mt-1"><i class="bi bi-person me-1 text-muted"></i>' + esc(s.driverName || s.username) + '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

  } 
  // ==========================================
  // 👇 EXISTING LOGIC FOR OTHER GROUPS 👇
  // ==========================================
  else {
    const eqList  = (APP.equipment || []).filter(e => e.group === myGroup);
    const monthSubs = (APP.submissions || []).filter(s => s.group === myGroup && isInMonth(s.date, ym));
    
    const byEq = {};
    monthSubs.forEach(s => { if (!byEq[s.equipmentId]) byEq[s.equipmentId] = []; byEq[s.equipmentId].push(s); });
    
    const rows = eqList.map(eq => {
      const subs = (byEq[eq.equipmentId] || []).sort((a,b) => subMs(b) - subMs(a));
      return { eq, done: subs.length > 0, latest: subs[0] || null, count: subs.length };
    });

    const doneCount = rows.filter(r => r.done).length;
    const pendingCount = rows.length - doneCount;
    
    // 👇 Checked / Pending filter 👇
    const historyFilterChip = (key, icon, label, count, cls) =>
      '<div class="tab' + (homeHistoryFilter === key ? ' active' : '') + '" style="flex:1 1 0;text-align:center;" onclick="setHomeHistoryFilter(\'' + key + '\')">' +
        '<i class="bi ' + icon + ' me-1"></i>' + label +
        '<span class="tab-count' + (cls ? ' ' + cls : '') + '">' + count + '</span>' +
      '</div>';
    html += '<div class="px-3 pt-2 pb-2"><div class="tab-bar mb-0" style="border-radius:10px;">' +
      historyFilterChip('all', 'bi-collection', 'All', rows.length, '') +
      historyFilterChip('done', 'bi-check2-circle', 'Checked', doneCount, 'is-ok') +
      historyFilterChip('pending', 'bi-hourglass-split', 'Pending', pendingCount, 'is-warn') +
    '</div></div>';

    let visibleRows = rows;
    if (homeHistoryFilter === 'done')    visibleRows = rows.filter(r => r.done);
    if (homeHistoryFilter === 'pending') visibleRows = rows.filter(r => !r.done);
    
    if (homeHistoryFilter === 'all') {
      visibleRows.sort((a,b) => { if (a.done !== b.done) return a.done ? 1 : -1; return String(a.eq.equipmentId).localeCompare(String(b.eq.equipmentId)); });
    } else {
      visibleRows.sort((a,b) => String(a.eq.equipmentId).localeCompare(String(b.eq.equipmentId)));
    }

    // Desktop Table
    html += '<div class="history-table-desktop table-responsive"><table class="table table-hover align-middle mb-0" style="font-size:.82rem;"><thead style="background:var(--header-bg);"><tr><th style="width:34px;" class="text-center">#</th><th>Equipment</th><th style="width:86px;" class="text-center">Status</th><th style="width:110px;">Last Check</th><th style="width:120px;">By</th><th style="width:44px;" class="text-center"></th></tr></thead><tbody>';
    
    if (visibleRows.length === 0) {
      html += '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-inbox" style="font-size:1.5rem;opacity:.5;"></i><div class="mt-1">No equipment' + (homeHistoryFilter !== 'all' ? ' in this filter' : '') + '</div></td></tr>';
    } else {
      visibleRows.forEach((r, i) => {
        const eq = r.eq;
        const rowIdx = i + 1;
        if (r.done) {
          const latest = r.latest;
          const isIssue = latest.overall === 'Issues';
          const statCls = isIssue ? 'bg-danger' : 'bg-success';
          const statIcon = isIssue ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
          html += '<tr class="history-row-clickable" onclick="viewCheck(\'' + escAttr(latest.checkId) + '\')" style="cursor:pointer;" title="Click to view checklist"><td class="text-center text-muted fw-bold">' + rowIdx + '</td><td><div class="fw-bold">' + esc(eq.shortName) + '</div>' + (eq.model ? '<div class="small text-muted">' + esc(eq.model) + '</div>' : '') + '</td><td class="text-center"><span class="badge ' + statCls + '"><i class="bi ' + statIcon + ' me-1"></i>' + esc(latest.overall) + '</span>' + (r.count > 1 ? '<div class="small text-muted mt-1">' + r.count + '×</div>' : '') + '</td><td><div class="fw-semibold">' + esc(latest.date) + '</div><div class="small text-muted">' + esc(latest.time) + '</div></td><td class="small">' + esc(latest.driverName || latest.username) + '</td><td class="text-center"><i class="bi bi-chevron-right text-muted"></i></td></tr>';
        } else {
          html += '<tr class="history-row-pending"><td class="text-center text-muted fw-bold">' + rowIdx + '</td><td><div class="fw-bold">' + esc(eq.shortName) + '</div>' + (eq.model ? '<div class="small text-muted">' + esc(eq.model) + '</div>' : '') + '</td><td class="text-center"><span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Pending</span></td><td class="text-muted">—</td><td class="text-muted">—</td><td></td></tr>';
        }
      });
    }
    html += '</tbody></table></div>';

    // Mobile Cards
    html += '<div class="history-cards-mobile">';
    if (visibleRows.length === 0) {
      html += '<div class="text-center text-muted py-4"><i class="bi bi-inbox" style="font-size:1.8rem;opacity:.5;"></i><div class="mt-2 small">No equipment' + (homeHistoryFilter !== 'all' ? ' in this filter' : '') + '</div></div>';
    } else {
      visibleRows.forEach((r, i) => {
        const eq = r.eq;
        const rowIdx = i + 1;
        if (r.done) {
          const latest = r.latest;
          const isIssue = latest.overall === 'Issues';
          const statCls = isIssue ? 'bg-danger' : 'bg-success';
          const statIcon = isIssue ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
          html += '<div class="history-mobile-card" onclick="viewCheck(\'' + escAttr(latest.checkId) + '\')"><div class="d-flex justify-content-between align-items-start mb-2"><div class="flex-grow-1 me-2"><div class="fw-bold"><span class="text-muted me-1">' + rowIdx + '.</span>' + esc(eq.shortName) + '</div>' + (eq.model ? '<div class="small text-muted">' + esc(eq.model) + '</div>' : '') + '</div><div class="text-end"><span class="badge ' + statCls + '"><i class="bi ' + statIcon + ' me-1"></i>' + esc(latest.overall) + '</span>' + (r.count > 1 ? '<div class="small text-muted mt-1">' + r.count + '×</div>' : '') + '</div></div><div class="d-flex justify-content-between align-items-center small"><div><i class="bi bi-calendar me-1 text-muted"></i><span class="fw-semibold">' + esc(latest.date) + '</span> <span class="text-muted">' + esc(latest.time) + '</span></div><i class="bi bi-chevron-right text-muted"></i></div><div class="small mt-1"><i class="bi bi-person me-1 text-muted"></i>' + esc(latest.driverName || latest.username) + '</div></div>';
        } else {
          html += '<div class="history-mobile-card history-mobile-pending"><div class="d-flex justify-content-between align-items-start"><div class="flex-grow-1"><div class="fw-bold"><span class="text-muted me-1">' + rowIdx + '.</span>' + esc(eq.shortName) + '</div>' + (eq.model ? '<div class="small text-muted">' + esc(eq.model) + '</div>' : '') + '</div><span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Pending</span></div></div>';
        }
      });
    }
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

window.setHomeHistoryFilter = function(filter){
  homeHistoryFilter = ['all', 'done', 'pending'].indexOf(filter) === -1 ? 'all' : filter;
  renderHome();
};
window.clearHomeHistoryFilter = function(){ homeHistoryFilter = 'all'; renderHome(); };
window.onHistoryMonthChange = function(value){ const cur = isoToday().slice(0, 7); if (value > cur) return; homeHistoryMonth = value; renderHome(); };
window.setHomeView = function(mode){ homeViewMode = mode; renderHome(); };
window.homePrevMonth = function(){ homeHistoryMonth = shiftMonth(homeHistoryMonth, -1); renderHome(); };
window.homeNextMonth = function(){ const next = shiftMonth(homeHistoryMonth, 1); const cur = isoToday().slice(0, 7); if (next > cur) return; homeHistoryMonth = next; renderHome(); };

function renderTechnicianHome(){
  if (homeViewMode === 'history') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">សូមស្វាគមន៍</h5><small class="text-muted">' + esc(currentUser.fullName) + ' · ' + esc(currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderHomeHistoryTable());
    return;
  }
  if (homeViewMode === 'report') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Monthly Report</h5><small class="text-muted">' + esc(currentUser.fullName) + ' · ' + esc(currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderTechnicianReportTab());
    return;
  }

  const myEqList  = APP.equipment || [];
  const mySubs    = APP.submissions || [];
  const monthSubs = mySubs.filter(s => isThisMonth(s.date));
  const groupAssigns = (APP.assignments || []).filter(a => a.group === currentUser.group && a.status !== 'Cancelled' && a.status !== 'Completed').sort((a,b) => { const pr = { Pending: 2, Confirmed: 1 }; return (pr[b.status] || 0) - (pr[a.status] || 0); });
  const eqRows = myEqList.map(eq => { 
    const eqSubs = monthSubs.filter(s => s.equipmentId === eq.equipmentId).sort((a,b) => subMs(b) - subMs(a)); 
    const lc = getLastCheck(eq.equipmentId);
    return { eq, latest: eqSubs[0] || null, mine: eqSubs.find(s => s.username === currentUser.username) || null, done: eqSubs.length > 0, lastCheckMs: lc ? parseDmyToMs(lc.date) : 0 }; 
  });

  const assignedEqIds = new Set(groupAssigns.map(a => a.equipmentId));
  
  const pendingList = eqRows.filter(x => !x.done && !assignedEqIds.has(x.eq.equipmentId)).sort((a,b) => {
    if (a.lastCheckMs === 0 && b.lastCheckMs !== 0) return -1;
    if (b.lastCheckMs === 0 && a.lastCheckMs !== 0) return 1;
    return a.lastCheckMs - b.lastCheckMs;
  });
  const completedList = eqRows.filter(x => x.done).sort((a, b) => subMs(b.latest) - subMs(a.latest));

  const assignRenderer = (a) => {
    const eq  = APP.equipmentMap[a.equipmentId] || {};
    const drv = a.driverName || a.driverUsername || '—';
    
    // ★ Get Driver Phone Number from APP.users
    const drvObj = (APP.users || []).find(u => u.username === a.driverUsername);
    const drvPhone = drvObj ? (drvObj.phone || '') : '';
    
    const trl = (APP.trailers || []).find(t => t.trailerId === a.trailerId);
    const trlShort = trl ? (trl.shortName || trl.trailerId) : (a.trailerId || '');
    
    let driverBadge = '';
    if (a.status === 'Confirmed') {
      driverBadge = '<span class="badge bg-success align-self-center"><i class="bi bi-check2 me-1"></i>' + esc(drv) + ' confirmed</span>';
    } else if (a.status === 'Pending') {
      // ★ Changed text to "រង់ចាំអ្នកបើកបរបញ្ជាក់"
      driverBadge = '<span class="badge bg-warning text-dark align-self-center"><i class="bi bi-hourglass-split me-1"></i>រង់ចាំអ្នកបើកបរបញ្ជាក់</span>';
    } else {
      driverBadge = '<span class="badge bg-secondary align-self-center">' + esc(drv) + '</span>';
    }

    return '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-inbox-fill text-primary me-2"></i><strong>' + esc(eq.shortName || a.equipmentId) + '</strong> ' + (trlShort ? '<span class="badge bg-secondary ms-1" style="font-size:.75rem;">' + esc(trlShort) + '</span>' : '') + '</span><span class="status-badge status-pending">Assigned</span></div><div class="card-body py-2"><div class="small mb-2"><i class="bi bi-calendar me-1"></i>Date: ' + esc(a.date) + '</div>' + renderLastCheckLine(a.equipmentId) + 
    
    // ★ Added Driver Name and Phone Number here, and removed the equipment ID/group line
    '<div class="small mb-1"><i class="bi bi-person me-1"></i>អ្នកបើកបរ: <strong>' + esc(drv) + '</strong>' + (drvPhone ? ' · <i class="bi bi-telephone me-1"></i>' + esc(drvPhone) : '') + '</div>' +
    
    '<div class="small mb-2"><i class="bi bi-person-badge me-1"></i>ចាត់បញ្ជូនដោយ: ' + esc(a.assignerName || a.assignerUsername || 'Admin') + '</div><div class="d-flex flex-wrap gap-2 align-items-center mb-2">' + driverBadge + '</div><div class="text-end"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();startChecklist(\'' + escAttr(a.equipmentId) + '\',\'' + escAttr(a.group) + '\',\'' + escAttr(eq.shortName || a.equipmentId) + '\',\'' + escAttr(a.driverUsername) + '\',\'' + escAttr(a.assignmentId) + '\')"><i class="bi bi-play-fill"></i> Start Checklist</button></div></div></div>';
  };

  const pendingRenderer = ({ eq }) => '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName) + '</strong></span><span class="status-badge status-pending">Pending</span></div><div class="card-body py-2">' + renderLastCheckLine(eq.equipmentId) + '<div class="small text-muted mb-1">' + esc(eq.equipmentId) + ' · ' + esc(eq.model || '') + '</div><div class="small text-secondary"><i class="bi bi-hourglass me-1"></i>Waiting for Admin to assign</div></div></div>';

  const completedRenderer = ({ eq, latest, mine }) => {
    const byMe = mine && latest && mine.checkId === latest.checkId;
    const who  = byMe ? 'You' : (latest.driverName || latest.username);
    const stat = latest.overall === 'Issues' ? 'nok' : 'ok';
    return '<div class="card mb-2 clickable-card" onclick="viewCheck(\'' + escAttr(latest.checkId) + '\')"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName) + '</strong></span><span class="status-badge status-' + stat + '">' + esc(latest.overall) + '</span></div><div class="card-body py-2">' + renderLastCheckLine(eq.equipmentId) + '<div class="small text-success"><i class="bi bi-check-circle me-1"></i>Checked ' + esc(latest.date) + ' ' + esc(latest.time) + ' by <strong>' + esc(who) + '</strong></div><div class="text-end mt-2"><button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewCheck(\'' + escAttr(latest.checkId) + '\')"><i class="bi bi-eye"></i> View</button></div></div></div>';
  };

  const showAll      = homeStatFilter === 'all';
  const showPending  = showAll || homeStatFilter === 'pending';
  const showDone     = showAll || homeStatFilter === 'done';
  const showAssigned = showAll || homeStatFilter === 'assigned';
  const cardCls = (f) => 'stat-card clickable-card' + (homeStatFilter === f ? ' active' : '');

  $('#app').html(
    '<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">សូមស្វាគមន៍</h5><small class="text-muted">' + esc(currentUser.fullName) + ' · ' + esc(currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' +
    renderHomeViewToggle() +
    '<div class="row g-2 mb-3"><div class="col-4"><div class="' + cardCls('assigned') + '" onclick="setHomeStatFilter(\'assigned\')"><div class="num text-primary">' + groupAssigns.length + '</div><div class="lbl">Assigned</div></div></div><div class="col-4"><div class="' + cardCls('pending') + '" onclick="setHomeStatFilter(\'pending\')"><div class="num text-warning">' + pendingList.length + '</div><div class="lbl">Pending</div></div></div><div class="col-4"><div class="' + cardCls('done') + '" onclick="setHomeStatFilter(\'done\')"><div class="num text-success">' + completedList.length + '</div><div class="lbl">Completed</div></div></div></div>' +
    renderHomeFilterChip() +
    (showAssigned ? (groupAssigns.length > 0 ? '<h6 class="mb-2"><i class="bi bi-inbox-fill text-primary me-2"></i>Assigned to My Group (' + groupAssigns.length + ')</h6>' + renderSectionWithLimit(groupAssigns, 'assigns', assignRenderer, !showAll) : (showAll ? '<div class="alert alert-secondary py-2 small mb-3"><i class="bi bi-info-circle me-1"></i>No active assignments from Admin</div>' : '<p class="text-muted small text-center py-3">No assignments</p>')) : '') +
    (showPending ? '<h6 class="mb-2 mt-3"><i class="bi bi-exclamation-circle text-warning me-2"></i>Pending This Month (' + pendingList.length + ')</h6>' + (pendingList.length ? renderSectionWithLimit(pendingList, 'pending', pendingRenderer, !showAll) : '<p class="text-muted small text-center py-3">✓ All checked this month</p>') : '') +
    (showDone ? '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>Completed This Month (' + completedList.length + ')</h6>' + (completedList.length ? renderSectionWithLimit(completedList, 'completed', completedRenderer, !showAll) : '<p class="text-muted small text-center py-3">—</p>') : '')
  );
}

/* =========================================================
   TCC&FCC COMPANY FILTER (ALL / PPAP / PMNT / Port Stevedoring)
   ========================================================= */
const TCC_COMPANY_OPTIONS = [
  { code: 'ALL',  label: 'ទាំងអស់ (All)' },
  { code: 'PPAP', label: 'PPAP' },
  { code: 'PMNT', label: 'PMNT' },
  { code: 'PORT STEVEDORING COMPANY LIMITED', label: 'Port Stevedoring' }
];

// 👇 Canonical company code for any company value 👇
// '' (old equipment rows without a company) is treated as PPAP
function tccNormCompany(v){
  const s = String(v == null ? '' : v).trim().toUpperCase()
    .replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return 'PPAP';
  if (s.indexOf('PORT STEVEDORING') === 0) return 'PORT STEVEDORING COMPANY LIMITED';
  if (s === 'PHNOM PENH AUTONOMOUS PORT') return 'PPAP';
  return s;
}

function tccCompanyLabel(v){
  const code = tccNormCompany(v);
  const found = TCC_COMPANY_OPTIONS.find(o => o.code === code);
  return found ? found.label : code;
}

function tccCompanyStorageKey(){
  return 'tccCompany_' + ((currentUser && currentUser.username) || 'anon');
}

// Selected company for the current session (null = not chosen yet)
window.tccCompanyFilter = String(window.tccCompanyFilter || '').trim() || null;

// 👇 Used by the Report tab UI and by buildTCCMonthlyReportBody() 👇
function tccSelectedCompany(){
  const raw = String(window.tccCompanyFilter || LS.get(tccCompanyStorageKey(), '') || '').trim();
  if (!raw) return 'ALL'; // 👈 default: every company in TCC&FCC
  const code = tccNormCompany(raw);
  return TCC_COMPANY_OPTIONS.some(o => o.code === code) ? code : 'ALL';
}

// Companies that actually have equipment in the TCC&FCC group (+ the selected one)
function tccAvailableCompanies(){
  const selected = tccSelectedCompany();
  const present  = new Set(
    (APP.equipment || [])
      .filter(e => String(e.group || '').trim() === 'TCC&FCC')
      .map(e => tccNormCompany(e.companyName))
  );
  present.add(selected);
  return TCC_COMPANY_OPTIONS.filter(o => o.code === 'ALL' || present.has(o.code));
}

function tccCompanySelectOptions(){
  const selected = tccSelectedCompany();
  return tccAvailableCompanies().map(o =>
    '<option value="' + escAttr(o.code) + '"' + (o.code === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>'
  ).join('');
}

window.setTccCompany = function(company) {
  const raw  = String(company || '').trim();
  const code = raw ? tccNormCompany(raw) : 'ALL';
  window.tccCompanyFilter = TCC_COMPANY_OPTIONS.some(o => o.code === code) ? code : 'ALL';
  LS.set(tccCompanyStorageKey(), window.tccCompanyFilter);
  renderHome();
};

function renderTechnicianReportTab(){
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const myGroup = isManagerViewing ? (window.managerReportGroup || 'រថយន្ត') : currentUser.group;
  
  const ym      = homeReportMonth;
  const rawEqList = APP.equipment || [];
  const seenIds   = new Set();
  const eqList    = [];
  
  // Filter equipment by selected group
  rawEqList.forEach(e => { 
    if (!e || !e.equipmentId) return; 
    if (seenIds.has(e.equipmentId)) return; 
    if (e.group !== myGroup) return; // Filter based on myGroup
    seenIds.add(e.equipmentId); 
    eqList.push(e); 
  });

  const monthSubs = (APP.submissions || []).filter(s => {
    if (!isInMonth(s.date, ym)) return false;
    if (s.group !== myGroup) return false; // Filter based on myGroup
    return true;
  });

  const checkedCount = eqList.filter(e => monthSubs.some(s => s.equipmentId === e.equipmentId)).length;
  const pendingCount = eqList.length - checkedCount;
  const pct = eqList.length ? Math.round(checkedCount / eqList.length * 100) : 0;

  const currentYM = isoToday().slice(0, 7);
  const monthOptions = [];
  let tempYM = currentYM;
  while (tempYM >= '2026-01') { monthOptions.push(tempYM); tempYM = shiftMonth(tempYM, -1); }
  const monthSelectOptions = monthOptions.map(m => '<option value="' + escAttr(m) + '"' + (m === ym ? ' selected' : '') + '>' + esc(monthLabel(m)) + (m === currentYM ? ' (current)' : '') + '</option>').join('');

  if (document.fonts && document.fonts.load) {
    try { document.fonts.load('400 12px Hanuman'); document.fonts.load('700 12px Hanuman'); document.fonts.load('900 12px Hanuman'); document.fonts.load('700 12px "Roboto Condensed"'); } catch (e) {}
  }
  (function injectStyles(){
    const id = 'monthlyReportPreviewStyles';
    const old = document.getElementById(id);
    if (old) old.remove();
    const s = document.createElement('style');
    s.id = id;
    s.textContent = (typeof monthlyReportStyles !== 'undefined' ? monthlyReportStyles() : '').replace(/<\/?style[^>]*>/gi, '');
    document.head.appendChild(s);
  })();

  window.currentReportZoom = 'fit';

  // Prepare Groups for Dropdown (if Manager)
  const GROUP_ORDER = ['រថយន្ត', 'RTG', 'គ្រឿងចក្រ', 'TCC&FCC'];
  const eqGroups = [...new Set((APP.equipment || []).map(e => e.group).filter(Boolean))];
  const availableGroups = GROUP_ORDER.filter(g => eqGroups.indexOf(g) !== -1);

  // Determine Report Body
  let reportHtml = '';
  if (typeof buildMonthlyReportBody !== 'undefined') {
    if (myGroup === 'TCC&FCC') {
      reportHtml = buildTCCMonthlyReportBody(ym);
    } else {
      reportHtml = buildMonthlyReportBody(ym);
    }
  }

  return '<div class="card mb-3">' +
    '<div class="group-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
      '<span><i class="bi bi-file-earmark-text me-2"></i>Monthly Inspection Report</span>' +
      '<div class="d-flex align-items-center gap-2">' +
        '<span class="metric-pill is-ok" title="' + pct + '% of equipment checked this month"><i class="bi bi-check2-circle"></i>' + checkedCount + ' checked</span>' +
        '<span class="metric-pill is-warn" title="Not checked yet this month"><i class="bi bi-hourglass-split"></i>' + pendingCount + ' pending</span>' +
      '</div>' +
    '</div>' +
    '<div class="card-body">' +

    // 👇 CONTROLS TOOLBAR 👇
    '<div class="rpt-toolbar">' +
    
    // Month Selector Row
    '<div class="row g-2 align-items-end">' +
      '<div class="col-12 col-lg-4">' +
        '<label class="rpt-lbl"><i class="bi bi-calendar3 me-1"></i>Month</label>' +
        '<div class="row g-1 align-items-center"><div class="col-auto"><button class="btn btn-sm btn-outline-secondary" onclick="reportPrevMonth()" title="Previous month"><i class="bi bi-chevron-left"></i></button></div><div class="col" style="min-width:0;"><select class="form-select form-select-sm text-center fw-bold" onchange="onReportMonthChange(this.value)">' + monthSelectOptions + '</select></div><div class="col-auto"><button class="btn btn-sm btn-outline-secondary" onclick="reportNextMonth()"' + (ym === currentYM ? ' disabled' : '') + ' title="Next month"><i class="bi bi-chevron-right"></i></button></div></div>' +
      '</div>' +
    
    // 👇 DATE + GROUP COLUMNS (same row as month) 👇
      '<div class="col-12 col-sm-6 col-lg-4">' +
        '<label class="rpt-lbl"><i class="bi bi-calendar-event me-1"></i>Report Date (Date on)</label>' +
        '<input type="date" class="form-control form-control-sm" id="rptDateInput" value="' + escAttr(homeReportDate) + '" onchange="onReportDateChange(this.value)">' +
      '</div>' +
      (isManagerViewing ? 
        '<div class="col-12 col-sm-6 col-lg-4">' +
          '<label class="rpt-lbl"><i class="bi bi-diagram-3 me-1"></i>Select Group</label>' +
          '<select class="form-select form-select-sm fw-bold text-primary" onchange="onManagerReportGroupChange(this.value)">' +
            availableGroups.map(g => '<option value="' + escAttr(g) + '"' + (g === myGroup ? ' selected' : '') + '>' + esc(g) + '</option>').join('') +
          '</select>' +
        '</div>' 
      : '') +
    '</div>' +

    // 👇 COMPANY SELECTOR (TCC&FCC only) – shown for Technician, Admin & Manager 👇
    (String(myGroup).trim() === 'TCC&FCC' ?
      '<div class="row g-2 align-items-end mt-2"><div class="col-12">' +
        '<label class="rpt-lbl"><i class="bi bi-building me-1"></i>Select Company</label>' +
        '<select class="form-select form-select-sm fw-bold text-primary" onchange="setTccCompany(this.value)">' +
          tccCompanySelectOptions() +
        '</select>' +
      '</div></div>'
    : '') +  

    // Standard / After Inspection Toggle (Only for Trucks)
    (String(myGroup).trim() === 'រថយន្ត' ? 
      '<div class="tab-bar mt-2 mb-0" style="border-radius:8px;">' +
        '<div class="tab' + (window.techReportForm === 'standard' ? ' active' : '') + '" style="flex:1 1 0;text-align:center;" onclick="setTechReportForm(\'standard\')"><i class="bi bi-list-ul me-1"></i>Standard</div>' +
        '<div class="tab' + (window.techReportForm === 'after' ? ' active' : '') + '" style="flex:1 1 0;text-align:center;" onclick="setTechReportForm(\'after\')"><i class="bi bi-table me-1"></i>After Inspection</div>' +
      '</div>' 
    : '') +

    // Action Buttons
    '<div class="d-flex flex-wrap gap-2 mt-2">' +
      '<button class="btn btn-sm btn-primary flex-grow-1" onclick="generateMonthlyReportPDF()"><i class="bi bi-file-earmark-pdf me-1"></i>Download PDF</button>' +
      '<button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="printMonthlyReport()"><i class="bi bi-printer me-1"></i>Print</button>' +
      '<button class="btn btn-sm btn-outline-secondary" id="btnZoomToggle" onclick="toggleReportZoom()" title="Toggle Zoom"><i class="bi bi-arrows-fullscreen"></i></button>' +
    '</div>' +

    // Generate Missing PDFs
        // 👇 HIDE FOR MANAGER/DIRECTOR 👇
    (currentUser.role === 'manager' || currentUser.role === 'manager-viewer' ? '' : 
      '<div class="d-flex mt-2"><button class="btn btn-sm btn-outline-success flex-grow-1" onclick="generateMissingPdfs(\'' + ym + '\')"><i class="bi bi-cloud-arrow-up me-1"></i>Generate Missing PDFs to Drive</button></div>'
    ) + '</div>' + '</div></div>' +  
    
    // Preview Wrapper
    '<div id="reportPreviewWrapper" style="background:#e9ecef; padding: 8px; border-radius:8px; width: 100%; display: flex; align-items: flex-start; overflow: hidden; transition: height 0.2s; position: relative;">' +
      '<div id="mrptPageSimulator" style="width:210mm; min-width:210mm; max-width:210mm; padding:10mm; background:#ffffff; box-shadow:0 4px 16px rgba(0,0,0,.18); box-sizing:border-box; margin: 0 auto; transform-origin: top center;">' + 
        reportHtml + 
      '</div>' +
    '</div>' +
    
    '<script>setTimeout(applyReportZoom, 150);</script>';
}

// 👇 Add this function to handle the dropdown change 👇
window.onManagerReportGroupChange = function(group) {
  window.managerReportGroup = group;
  renderHome(); 
};

window.setReportMonth = function(ym){ homeReportMonth = ym; renderHome(); };
window.onReportMonthChange = function(value){ const cur = isoToday().slice(0, 7); if (value > cur) return; homeReportMonth = value; renderHome(); };
window.onReportDateChange = function(value){ if (!value) return; homeReportDate = value; renderHome(); };
window.reportPrevMonth = function(){ homeReportMonth = shiftMonth(homeReportMonth, -1); renderHome(); };
window.reportNextMonth = function(){ const next = shiftMonth(homeReportMonth, 1); const cur = isoToday().slice(0, 7); if (next > cur) return; homeReportMonth = next; renderHome(); };


// Global queue to hold checklists waiting to generate
window._pdfQueue = [];

window.generatePdfsForSingleChecklist = async function(s, silent = false) {
  if (!s) return;
  
  if (window._isGeneratingPdfs) {
     console.log(`[Auto-PDF] Currently busy. Adding ${s.checkId} to the queue...`);
     if (!window._pdfQueue.find(item => item.s.checkId === s.checkId)) {
        window._pdfQueue.push({ s: s, silent: silent });
     }
     return;
  }
  
  window._isGeneratingPdfs = true;

  if (!silent) showLoading(`Generating PDFs for ${s.checkId}...`);

  const originalForm = window.techReportForm;
  let successCount = 0;

  try {
     const pdfVal = String(s.pdfFileId || '').trim();
     let ids = pdfVal ? pdfVal.split(',').map(x => x.trim()) : ['', ''];
     if (ids.length < 2) ids.push('');
    
     const isTruck = String(s.group || '').trim() === 'រថយន្ត';

     if (!ids[0]) {
        if (!silent) $('#loadingMessage').text(`Generating Standard PDF...`);
        window.techReportForm = 'standard';
        window.activeReportForm = 'standard';
        try {
           const base64 = await generateChecklistPdfBase64(s);
           const up = await new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false })).saveChecklistPdf(s.checkId, base64, 'standard'));
           if (up && up.success) {
               ids[0] = up.fileId;
               successCount++;
           }
        } catch(e) { console.error('Std PDF error', e); }
     }

     if (!ids[1] && isTruck) {
        if (!silent) $('#loadingMessage').text(`Generating After Inspection PDF...`);
        window.techReportForm = 'after';
        window.activeReportForm = 'table';
        try {
           const base64 = await generateChecklistPdfBase64(s);
           const up = await new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false })).saveChecklistPdf(s.checkId, base64, 'after'));
           if (up && up.success) {
               ids[1] = up.fileId;
               successCount++;
           }
        } catch(e) { console.error('After PDF error', e); }
     }

     if (successCount > 0) {
         s.pdfFileId = ids.join(',');
         const localSub = APP.submissions.find(x => x.checkId === s.checkId);
         if (localSub) localSub.pdfFileId = s.pdfFileId;
     }

  } finally {
     window.techReportForm = originalForm;
     window.activeReportForm = originalForm === 'after' ? 'table' : 'standard';
     window._isGeneratingPdfs = false;
     
     if (!silent) {
        hideLoading();
        if (successCount > 0) showAlert(`Generated ${successCount} PDFs successfully.`, 'success');
        refreshCurrentPage();
     } else {
        console.log(`[Auto-PDF] Finished generating for ${s.checkId}. Count: ${successCount}`);
        if (successCount > 0 && safeToRefresh()) refreshCurrentPage();
     }

     if (window._pdfQueue && window._pdfQueue.length > 0) {
         const nextItem = window._pdfQueue.shift();
         console.log(`[Auto-PDF] Processing next in queue: ${nextItem.s.checkId}`);
         setTimeout(() => {
            generatePdfsForSingleChecklist(nextItem.s, nextItem.silent);
         }, 1000); 
     }
  }
};

window.generateMissingPdfs = async function(ym, silent = false) {
  if (window._isGeneratingPdfs) return;
  window._isGeneratingPdfs = true;

  if (!silent) showLoading('Checking for missing PDFs...');
  
  try {
    const res = await new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(e => r({ success: false, message: e.message })).getMissingPdfsForMonth(currentUser.group, ym));
    
    if (!res || !res.success) { 
      if (!silent) { hideLoading(); showAlert('Failed to check: ' + (res.message || ''), 'danger'); } 
      window._isGeneratingPdfs = false;
      return; 
    }
    
    const missingItems = res.missing || [];
    if (missingItems.length === 0) { 
      if (!silent) { hideLoading(); showAlert('All checklists already have their PDFs saved to Drive!', 'success'); } 
      window._isGeneratingPdfs = false;
      return; 
    }
    
    let successCount = 0; 
    let failCount = 0;
    const originalForm = window.techReportForm; 

    if (silent) console.log(`[Auto-PDF] Found ${missingItems.length} missing PDFs. Generating in background...`);

    for (let i = 0; i < missingItems.length; i++) {
      const item = missingItems[i];
      const s = APP.submissions.find(x => x.checkId === item.checkId);
      
      if (!s) {
        console.warn(`[Auto-PDF] Could not find submission data for ${item.checkId} in local memory. Skipping.`);
        continue;
      }

      let currentPdfVal = String(s.pdfFileId || '').trim();
      let localIds = currentPdfVal ? currentPdfVal.split(',').map(x => x.trim()) : ['', ''];
      if (localIds.length < 2) localIds.push('');

      if (item.missingStd) {
        if (!silent) $('#loadingMessage').text(`Generating Standard PDF ${i + 1} of ${missingItems.length}...`);
        window.techReportForm = 'standard';
        window.activeReportForm = 'standard'; 
        try {
          const base64 = await generateChecklistPdfBase64(s);
          const up = await new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false })).saveChecklistPdf(item.checkId, base64, 'standard'));
          
          if (up && up.success) {
            successCount++;
            localIds[0] = up.fileId;
          } else {
            failCount++;
          }
        } catch (err) { 
          console.error('Failed std PDF', err); 
          failCount++; 
        }
      }

      if (item.missingAfter) {
        if (!silent) $('#loadingMessage').text(`Generating After Insp. PDF ${i + 1} of ${missingItems.length}...`);
        window.techReportForm = 'after';
        window.activeReportForm = 'table'; 
        try {
          const base64 = await generateChecklistPdfBase64(s);
          const up = await new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(() => r({ success: false })).saveChecklistPdf(item.checkId, base64, 'after'));
          
          if (up && up.success) {
            successCount++;
            localIds[1] = up.fileId;
          } else {
            failCount++;
          }
        } catch (err) { 
          console.error('Failed after PDF', err); 
          failCount++; 
        }
      }

      s.pdfFileId = localIds.join(',');
      const localSub = APP.submissions.find(x => x.checkId === s.checkId);
      if (localSub) localSub.pdfFileId = s.pdfFileId;
    }

    window.techReportForm = originalForm;
    window.activeReportForm = originalForm === 'after' ? 'table' : 'standard';

    if (!silent) {
      hideLoading();
      showAlert(`Saved ${successCount} PDFs to Drive. (${failCount} failed)`, successCount > 0 ? 'success' : 'warning');
      refreshCurrentPage();
    } else {
      console.log(`[Auto-PDF] Background generation complete. Saved: ${successCount}, Failed: ${failCount}`);
      if (successCount > 0 && safeToRefresh()) refreshCurrentPage(); 
    }
    
  } catch (err) { 
    console.error('[Auto-PDF] Fatal Error:', err);
    if (!silent) { hideLoading(); showAlert('Error: ' + (err.message || err), 'danger'); } 
  } finally {
    window._isGeneratingPdfs = false;
  }
};

function renderMonthlyDriverHome(){
  const myAssignments = APP.assignments.filter(a => a.driverUsername === currentUser.username);
  const todayStr = dmyToday();
  const todayAssign = myAssignments.filter(a => a.date === todayStr);
  const pending   = todayAssign.filter(a => a.status === 'Pending');
  const confirmed = todayAssign.filter(a => a.status === 'Confirmed');
  const done      = todayAssign.filter(a => a.status === 'Completed');

  const card = (a) => {
    const eq = APP.equipmentMap[a.equipmentId] || {};
    const badge = a.status === 'Confirmed' ? 'ok' : a.status === 'Rejected' ? 'nok' : a.status === 'Cancelled' ? 'na' : a.status === 'Completed' ? 'na' : 'pending';
    const fromName = a.assignerName || a.assignerUsername || 'Admin';
    let actions = '';
    if (a.status === 'Pending') actions = '<div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-success flex-fill" onclick="event.stopPropagation();respondToAssignment(\''+escAttr(a.assignmentId)+'\',\'Confirmed\')"><i class="bi bi-check-circle me-1"></i>Confirm</button><button class="btn btn-sm btn-danger flex-fill" onclick="event.stopPropagation();respondToAssignment(\''+escAttr(a.assignmentId)+'\',\'Rejected\')"><i class="bi bi-x-circle me-1"></i>Reject</button></div>';
    return '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>'+esc(eq.shortName || a.equipmentId)+'</strong></span><span class="status-badge status-'+badge+'">'+esc(a.status)+'</span></div><div class="card-body py-2">' + renderLastCheckLine(a.equipmentId) + '<div class="row small g-1"><div class="col-6"><i class="bi bi-hash me-1"></i>'+esc(a.assignmentId)+'</div><div class="col-6"><i class="bi bi-calendar me-1"></i>'+esc(a.date)+'</div><div class="col-6"><i class="bi bi-shield-check me-1"></i>From: '+esc(fromName)+'</div><div class="col-6"><i class="bi bi-link-45deg me-1"></i>'+esc(a.trailerId || '—')+'</div><div class="col-6"><i class="bi bi-tag me-1"></i>'+esc(a.group || '—')+'</div></div>' + (a.remark ? '<div class="small ' + (a.status === 'Cancelled' ? 'text-secondary' : 'text-muted') + ' mt-1"><i class="bi bi-chat-left-text me-1"></i>'+esc(a.remark)+'</div>' : '') + actions + '</div></div>';
  };

  $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Driver Home</h5><small class="text-muted">'+esc(currentUser.fullName)+' · '+esc(currentUser.group)+'</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' +
    '<div class="row g-2 mb-3"><div class="col-4"><div class="stat-card"><div class="num text-warning">'+pending.length+'</div><div class="lbl">រង់ចាំបញ្ជាក់</div></div></div><div class="col-4"><div class="stat-card"><div class="num text-success">'+confirmed.length+'</div><div class="lbl">បានបញ្ជាក់</div></div></div><div class="col-4"><div class="stat-card"><div class="num text-secondary">'+done.length+'</div><div class="lbl">បានបញ្ចប់</div></div></div></div>' +
    '<h6 class="mb-2"><i class="bi bi-hourglass-split text-warning me-2"></i>រង់ចាំការបញ្ជាក់ ('+pending.length+')</h6>' + (pending.map(card).join('') || '<p class="text-muted small text-center py-3">គ្មានអ្វីត្រូវបញ្ជាក់ទេ</p>') +
    '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>បានបញ្ជាក់ថ្ងៃនេះ ('+confirmed.length+')</h6>' + (confirmed.map(card).join('') || '<p class="text-muted small text-center py-3">គ្មានទេ</p>'));
}

window.respondToAssignment = function(assignmentId, status){
  const remark = status === 'Rejected' ? (prompt('មូលហេតុបដិសេធ / Reason (optional):') || '') : '';
  showLoading('កំពុងរក្សាទុក...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      const a = APP.assignments.find(x => x.assignmentId === assignmentId);
      if (a) {
        a.status = status; a.remark = remark; a.confirmedAt = dmyToday() + ' ' + nowTimeStr();
        if (status === 'Confirmed' && a.batchId) {
          APP.assignments.forEach(x => { if (x.batchId === a.batchId && x.assignmentId !== a.assignmentId && x.status === 'Pending') { x.status = 'Cancelled'; x.remark = 'Taken by ' + (currentUser.fullName || currentUser.username); x.confirmedAt = dmyToday() + ' ' + nowTimeStr(); } });
        }
      }
      showAlert(status === 'Confirmed' ? 'បានបញ្ជាក់' : 'បានបដិសេធ', status === 'Confirmed' ? 'success' : 'warning');
      refreshCurrentPage();
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).respondAssignment({ assignmentId: assignmentId, driverUsername: currentUser.username, status: status, remark: remark });
};

function renderManagerHome(){
  if (homeViewMode === 'history') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Admin Home</h5><small class="text-muted">' + esc(currentUser.group) + ' · ' + dmyToday() + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderHomeHistoryTable());
    return;
  }

  if (homeViewMode === 'report') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Monthly Report</h5><small class="text-muted">' + esc(currentUser.fullName) + ' · ' + esc(currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderTechnicianReportTab());
    return;
  }

  const myGroup   = currentUser.group;
  const monthSubs = APP.submissions.filter(s => isThisMonth(s.date) && s.group === myGroup);
  const myEqList  = APP.equipment || [];
  const eqRows = myEqList.map(eq => { 
    const eqSubs = monthSubs.filter(s => s.equipmentId === eq.equipmentId).sort((a,b) => subMs(b) - subMs(a)); 
    const lc = getLastCheck(eq.equipmentId);
    return { eq, latest: eqSubs[0] || null, done: eqSubs.length > 0, lastCheckMs: lc ? parseDmyToMs(lc.date) : 0 }; 
  });
  
  const pendingList = eqRows.filter(x => !x.done).sort((a,b) => {
    if (a.lastCheckMs === 0 && b.lastCheckMs !== 0) return -1; // Never checked goes to top
    if (b.lastCheckMs === 0 && a.lastCheckMs !== 0) return 1;
    return a.lastCheckMs - b.lastCheckMs; // Oldest check first
  });
  
  const completedList = eqRows.filter(x => x.done).sort((a, b) => subMs(b.latest) - subMs(a.latest));
  const pendingAssigns = (APP.assignments || []).filter(a => a.group === myGroup && (a.status === 'Pending' || a.status === 'Confirmed'));
    const pendingConfirm = APP.submissions.filter(s => {
    if (s.group !== myGroup) return false;
    if ((s.confirmStatus || 'Pending') !== 'Pending') return false;
    
    // ★ Only include in "To confirm" if the Driver has cleared it (or no driver assigned)
    const driverCleared = !s.driverUsername || s.driverConfirmStatus === 'Confirmed';
    return driverCleared;
  }).sort((a,b) => subMs(b) - subMs(a));

  const pendingRenderer = ({ eq }) => {
    const activeAssign = (APP.assignments || []).find(a => a.equipmentId === eq.equipmentId && (a.status === 'Pending' || a.status === 'Confirmed'));
    let actionHtml = '';
    if (activeAssign) {
      const timeMatch = (activeAssign.createdAt || '').match(/(\d{1,2}:\d{2})/);
      const assignTime = timeMatch ? timeMatch[0] : '';
      actionHtml = '<div class="alert alert-secondary py-2 px-3 mb-0 mt-3 small" style="border-left:4px solid #ffc107; background:rgba(255,193,7,.08);"><div class="mb-1"><i class="bi bi-person-check-fill text-warning me-1"></i> Assigned to <strong>' + esc(activeAssign.driverName || activeAssign.driverUsername) + '</strong></div><div class="text-muted"><i class="bi bi-clock-history me-1"></i> Date: ' + esc(activeAssign.date) + (assignTime ? ' · Time: ' + esc(assignTime) : '') + '</div></div>';
    } else if (!isViewer()) { 
      actionHtml = '<button class="btn btn-sm btn-primary mt-2" onclick="openAssignDialog(\'' + escAttr(eq.equipmentId) + '\')"><i class="bi bi-person-plus me-1"></i>Assign to Driver</button>'; 
    } else {
      actionHtml = '<div class="small text-muted mt-2"><i class="bi bi-info-circle me-1"></i>Not assigned</div>';
    }
    return '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName) + '</strong></span><span class="status-badge status-pending">Pending</span></div><div class="card-body py-2">' + renderLastCheckLine(eq.equipmentId) + '<div class="small text-muted mb-2">' + esc(eq.equipmentId) + ' · ' + esc(eq.model || '') + '</div>' + actionHtml + '</div></div>';
  };

  const completedRenderer = ({ eq, latest }) => '<div class="card mb-2 clickable-card" onclick="viewCheck(\'' + escAttr(latest.checkId) + '\')"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName) + '</strong></span><span class="status-badge status-' + (latest.overall === 'Issues' ? 'nok' : 'ok') + '">' + esc(latest.overall) + '</span></div><div class="card-body py-2">' + renderLastCheckLine(eq.equipmentId) + '<div class="small text-success"><i class="bi bi-check-circle me-1"></i>' + esc(latest.driverName) + ' · ' + esc(latest.date) + ' ' + esc(latest.time) + '</div></div></div>';

  const assignRenderer = (a) => { 
    const eq = APP.equipmentMap[a.equipmentId] || {}; 
    
    // ★ Get Trailer Short Name
    const trlObj = (APP.trailers || []).find(t => t.trailerId === a.trailerId);
    const trailerShortName = trlObj ? (trlObj.shortName || trlObj.trailerId) : (a.trailerId || '');
    
    // ★ Get Driver Phone Number
    const drvObj = (APP.users || []).find(u => u.username === a.driverUsername);
    const drvPhone = drvObj ? (drvObj.phone || '') : '';
    const driverName = a.driverName || a.driverUsername || '—';

    return `
      <div class="pending-row">
        <span style="width:8px;height:8px;border-radius:50%;background:#ffc107;"></span>
        <div class="meta">
          <strong>${esc(eq.shortName || a.equipmentId)}</strong> 
          ${trailerShortName ? `<span class="badge bg-secondary ms-1" style="font-size:.65rem;">${esc(trailerShortName)}</span>` : ''}
          <small>អ្នកបើកបរ: ${esc(driverName)} ${drvPhone ? `· <i class="bi bi-telephone"></i> ${esc(drvPhone)}` : ''}</small>
        </div>
        <span class="badge bg-warning text-dark">${esc(a.status)}</span>
      </div>
    `; 
  };

  const confirmRenderer = (s) => '<div class="pending-row clickable-card" onclick="viewCheck(\'' + escAttr(s.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:' + (s.overall === 'Issues' ? '#dc3545' : '#28a745') + ';"></span><div class="meta"><strong>' + esc(eqShort(s.equipmentId)) + '</strong> · ' + esc(s.driverName) + '<small>' + esc(s.date) + ' ' + esc(s.time) + '</small></div><button class="btn btn-sm btn-success" onclick="event.stopPropagation();viewCheck(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-check2"></i></button></div>';

  const showAll = homeStatFilter === 'all'; const showPending = showAll || homeStatFilter === 'pending'; const showDone = showAll || homeStatFilter === 'done'; const showAssigned = showAll || homeStatFilter === 'assigned'; const showConfirm = showAll || homeStatFilter === 'toConfirm';
  const pct = myEqList.length > 0 ? Math.round(completedList.length / myEqList.length * 100) : 0;
  const cardCls = (f) => 'stat-card clickable-card' + (homeStatFilter === f ? ' active' : '');

  $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Admin Home</h5><small class="text-muted">' + esc(currentUser.group) + ' · ' + dmyToday() + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' +
    renderHomeViewToggle() +
    '<div class="row g-2 mb-3"><div class="col-3"><div class="' + cardCls('done') + '" onclick="setHomeStatFilter(\'done\')"><div class="num text-success">' + completedList.length + '</div><div class="lbl">Done</div></div></div><div class="col-3"><div class="' + cardCls('pending') + '" onclick="setHomeStatFilter(\'pending\')"><div class="num text-warning">' + pendingList.length + '</div><div class="lbl">Pending</div></div></div><div class="col-3"><div class="' + cardCls('assigned') + '" onclick="setHomeStatFilter(\'assigned\')"><div class="num text-primary">' + pendingAssigns.length + '</div><div class="lbl">Assigned</div></div></div><div class="col-3"><div class="' + cardCls('toConfirm') + '" onclick="setHomeStatFilter(\'toConfirm\')"><div class="num text-info">' + pendingConfirm.length + '</div><div class="lbl">To confirm</div></div></div></div>' +
    renderHomeFilterChip() +
    (showAll ? '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-calendar-check me-2"></i>Monthly Progress — ' + esc(myGroup) + '</span><span class="badge bg-' + (pct === 100 ? 'success' : 'primary') + '">' + completedList.length + '/' + myEqList.length + ' (' + pct + '%)</span></div><div class="card-body py-2"><div class="dash-bar"><div class="track"><div class="fill" style="width:' + pct + '%;background:' + (pct === 100 ? '#28a745' : '#0d6efd') + '"></div></div><span class="val">' + pct + '%</span></div></div></div>' + (!isViewer() ? '<div class="mb-3"><button class="btn btn-primary w-100" onclick="openAssignDialog()"><i class="bi bi-plus-circle me-1"></i>New Assignment</button></div>' : '') : '') +
    (showAssigned && pendingAssigns.length > 0 ? '<h6 class="mb-2"><i class="bi bi-hourglass-split text-warning me-2"></i>Active Assignments (' + pendingAssigns.length + ')</h6>' + renderSectionWithLimit(pendingAssigns, 'assigns', assignRenderer, !showAll) : '') +
    (showConfirm && pendingConfirm.length > 0 ? '<h6 class="mb-2 mt-3"><i class="bi bi-patch-question text-primary me-2"></i>Awaiting Your Confirmation (' + pendingConfirm.length + ')</h6>' + renderSectionWithLimit(pendingConfirm, 'confirm', confirmRenderer, !showAll) : '') +
    (showPending ? '<h6 class="mb-2 mt-3"><i class="bi bi-exclamation-circle text-warning me-2"></i>Pending This Month (' + pendingList.length + ')</h6>' + (pendingList.length ? renderSectionWithLimit(pendingList, 'pending', pendingRenderer, !showAll) : '<p class="text-muted small text-center py-3">✓ All equipment checked</p>') : '') +
    (showDone ? '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>Completed This Month (' + completedList.length + ')</h6>' + (completedList.length ? renderSectionWithLimit(completedList, 'completed', completedRenderer, !showAll) : '<p class="text-muted small text-center py-3">—</p>') : ''));
}

function renderDirectorHome(){
  // 👇 1. Handle the Report Tab Routing 👇
  if (homeViewMode === 'report') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Monthly Report</h5><small class="text-muted">' + esc(currentUser.fullName) + ' · All Groups</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderTechnicianReportTab());
    return;
  }

  // 👇 2. Handle the History Tab Routing (Just in case you add it later) 👇
  if (homeViewMode === 'history') {
    $('#app').html('<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Manager Home</h5><small class="text-muted">All Groups · ' + dmyToday() + '</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px;">--:--:--</span></button></div>' + renderHomeViewToggle() + renderHomeHistoryTable());
    return;
  }

  const GROUP_ORDER = ['រថយន្ត', 'RTG', 'គ្រឿងចក្រ', 'TCC&FCC'];
  const eqGroups = [...new Set((APP.equipment || []).map(e => e.group).filter(Boolean))];
  const groups = GROUP_ORDER.filter(g => eqGroups.indexOf(g) !== -1);
  eqGroups.forEach(g => { if (groups.indexOf(g) === -1) groups.push(g); });

  const monthSubs = APP.submissions.filter(s => isThisMonth(s.date));
  const allEq     = APP.equipment || [];
  const pendingConfirm = APP.submissions.filter(s => (s.confirmStatus || 'Pending') === 'Confirmed' && !s.directorStatus).sort((a,b) => subMs(b) - subMs(a));
  const monthIssues = monthSubs.filter(s => s.overall === 'Issues').sort((a,b) => subMs(b) - subMs(a));
  const totalEq   = allEq.length;
  const totalDone = allEq.filter(e => monthSubs.some(s => s.equipmentId === e.equipmentId)).length;

  const showAll = homeStatFilter === 'all'; const showDone = showAll || homeStatFilter === 'done'; const showToConfirm = showAll || homeStatFilter === 'toConfirm'; const showIssues = showAll || homeStatFilter === 'issues';
  const cardCls = (f) => 'stat-card clickable-card' + (homeStatFilter === f ? ' active' : '');

  const confirmRenderer = (s) => '<div class="pending-row clickable-card" onclick="viewCheck(\'' + escAttr(s.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:' + (s.overall === 'Issues' ? '#dc3545' : '#28a745') + ';"></span><div class="meta"><strong>' + esc(eqShort(s.equipmentId)) + '</strong> · ' + esc(s.driverName) + '<small>' + esc(s.date) + ' · ' + esc(s.checkId) + '</small></div><button class="btn btn-sm btn-success" onclick="event.stopPropagation();viewCheck(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-check2"></i></button></div>';
  const issueRenderer = (s) => '<div class="pending-row clickable-card" onclick="viewCheck(\'' + escAttr(s.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:#dc3545;"></span><div class="meta"><strong>' + esc(eqShort(s.equipmentId)) + '</strong> · ' + esc(s.driverName) + '<small>' + esc(s.date) + ' · ' + esc(s.checkId) + '</small></div><span class="badge bg-danger">' + esc(s.overall) + '</span></div>';
  const pendingEqRenderer = (g) => (e) => '<div class="driver-status-row clickable-card" onclick="event.stopPropagation();drillTo({equipmentId:\'' + escAttr(e.equipmentId) + '\',group:\'' + escAttr(g) + '\',dateFrom:\'\',dateTo:\'\'})"><div class="left"><i class="bi bi-circle text-secondary" style="font-size:1.1rem;"></i><div><div class="name">' + esc(e.shortName || e.equipmentId) + '</div><div class="eqs">' + esc(e.equipmentId) + ' · ' + esc(e.model || '') + '</div></div></div><div><span class="badge bg-warning text-dark">pending</span></div></div>';

  const groupBlocks = groups.map((g, gIdx) => {
    const gEq = allEq.filter(e => e.group === g); const gSubs = monthSubs.filter(s => s.group === g);
    const doneEq = new Set(gSubs.map(s => s.equipmentId)); const pendingEq = gEq.filter(e => !doneEq.has(e.equipmentId));
    const doneCount = gEq.length - pendingEq.length; const total = gEq.length; const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

    const completedRows = gEq.filter(e => doneEq.has(e.equipmentId)).slice(0, 5).map(e => {
      const latest = gSubs.filter(s => s.equipmentId === e.equipmentId).sort((a,b) => subMs(b) - subMs(a))[0];
      return '<div class="driver-status-row clickable-card" onclick="event.stopPropagation();viewCheck(\'' + escAttr(latest.checkId) + '\')"><div class="left"><i class="bi bi-check-circle-fill text-success" style="font-size:1.1rem;"></i><div><div class="name">' + esc(e.shortName || e.equipmentId) + '</div><div class="eqs">' + esc(latest.driverName) + ' · ' + esc(latest.date) + '</div></div></div><div><span class="badge bg-' + (latest.overall === 'Issues' ? 'danger' : 'success') + '">' + esc(latest.overall) + '</span></div></div>';
    }).join('');

    const collapseId = 'grp-body-' + gIdx; const pendingSectionKey = 'mgr_grp_' + gIdx + '_pending';
    const pendingBlock = pendingEq.length ? '<div class="small text-warning mb-1"><i class="bi bi-exclamation-circle me-1"></i>Pending (' + pendingEq.length + ')</div>' + renderSectionWithLimit(pendingEq, pendingSectionKey, pendingEqRenderer(g), false) : '<div class="small text-success mb-1"><i class="bi bi-check2-circle me-1"></i>All checked this month</div>';

    return '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center clickable-card" data-bs-toggle="collapse" data-bs-target="#' + collapseId + '" style="cursor:pointer;"><span><i class="bi bi-diagram-3 me-2"></i><strong>' + esc(g) + '</strong></span><span class="badge bg-' + (pct === 100 ? 'success' : 'primary') + '">' + doneCount + '/' + total + ' (' + pct + '%)</span></div><div class="collapse show" id="' + collapseId + '"><div class="card-body py-2"><div class="dash-bar mb-2"><div class="track"><div class="fill" style="width:' + pct + '%;background:' + (pct === 100 ? '#28a745' : '#0d6efd') + '"></div></div><span class="val">' + pct + '%</span></div>' + pendingBlock + (completedRows ? '<div class="small text-muted mt-2 mb-1">Recently checked</div>' + completedRows : '') + '</div></div></div>';
  }).join('');

  let html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Manager Home</h5><small class="text-muted">' + dmyToday() + '</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px;">--:--:--</span></button></div>' +
    
    // 👇 3. ADD THE TOGGLE HERE 👇
    renderHomeViewToggle() + 
    
    '<div class="row g-2 mb-3"><div class="col-4"><div class="' + cardCls('done') + '" onclick="setHomeStatFilter(\'done\')"><div class="num text-primary">' + totalDone + '</div><div class="lbl">Checked / ' + totalEq + '</div></div></div><div class="col-4"><div class="' + cardCls('toConfirm') + '" onclick="setHomeStatFilter(\'toConfirm\')"><div class="num text-warning">' + pendingConfirm.length + '</div><div class="lbl">To confirm</div></div></div><div class="col-4"><div class="' + cardCls('issues') + '" onclick="setHomeStatFilter(\'issues\')"><div class="num text-danger">' + monthIssues.length + '</div><div class="lbl">Issues</div></div></div></div>' +
    renderHomeFilterChip();
  
  if (showToConfirm) html += '<h6 class="mb-2"><i class="bi bi-patch-question text-primary me-2"></i>Pending your confirmation (' + pendingConfirm.length + ')</h6>' + (pendingConfirm.length ? renderSectionWithLimit(pendingConfirm, 'dir_confirm', confirmRenderer, !showAll) : '<p class="text-muted small text-center py-3">✓ Nothing to confirm</p>');
  
  if (showDone && !showAll) {
    const completedItems = allEq.map(e => { const subs = monthSubs.filter(s => s.equipmentId === e.equipmentId).sort((a,b) => subMs(b) - subMs(a)); return subs[0] ? { eq: e, latest: subs[0] } : null; }).filter(Boolean).sort((a,b) => subMs(b.latest) - subMs(a.latest));
    const completedRenderer = ({ eq, latest }) => '<div class="pending-row clickable-card" onclick="viewCheck(\'' + escAttr(latest.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:' + (latest.overall === 'Issues' ? '#dc3545' : '#28a745') + ';"></span><div class="meta"><strong>' + esc(eq.shortName || eq.equipmentId) + '</strong> · ' + esc(latest.driverName) + '<small>' + esc(latest.date) + ' ' + esc(latest.time) + ' · ' + esc(latest.checkId) + '</small></div><span class="badge bg-' + (latest.overall === 'Issues' ? 'danger' : 'success') + '">' + esc(latest.overall) + '</span></div>';
    html += '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>Checked This Month (' + completedItems.length + ')</h6>' + (completedItems.length ? renderSectionWithLimit(completedItems, 'dir_completed', completedRenderer, false) : '<p class="text-muted small text-center py-3">—</p>');
  }
  if (showIssues && !showAll) html += '<h6 class="mb-2 mt-3"><i class="bi bi-exclamation-triangle text-danger me-2"></i>Issues This Month (' + monthIssues.length + ')</h6>' + (monthIssues.length ? renderSectionWithLimit(monthIssues, 'dir_issues', issueRenderer, false) : '<p class="text-muted small text-center py-3">—</p>');
  if (showAll) html += '<h6 class="mb-2 mt-3"><i class="bi bi-diagram-3 text-primary me-2"></i>Groups — this month</h6>' + (groupBlocks || '<p class="text-muted text-center py-4">—</p>');

  $('#app').html(html);
}

/* =========================================================
   DAILY HOME VIEWS
   ========================================================= */
function renderDailyHome() {
  const role = normRole(currentUser && currentUser.role);
  if (role === 'driver')                                    renderDailyDriverHome();
  else if (role === 'admin' || role === 'admin-viewer')     renderDailyAdminHome();
  else if (role === 'manager' || role === 'manager-viewer') renderDailyManagerHome();
  else renderDailyManagerHome(); // any other role: read-only group overview (never a blank screen)
}

function renderDailyDriverHome() {
  const myEqIds = dailyMyEquipmentIds();
  const mySubs = dailyShiftOnly(APP.dailySubmissions || []);
  const todaySubs = mySubs.filter(s => isToday(s.date));
  const openShifts = dailyMyOpenShift();
  const sessionCards = openShifts.map(s => dailySessionCard(s)).join('');
  const weeklyDue = myEqIds.map(eqId => ({ eqId: eqId, info: dailyWeeklyInfo(eqId) })).filter(x => x.info.due);

  const cards = myEqIds.map(eqId => {
    const eq = APP.equipmentMap[eqId] || { equipmentId: eqId, shortName: eqId, group: '', model: '' };
    const eqSubsToday = todaySubs.filter(s => s.equipmentId === eqId);
    const latestToday = eqSubsToday[eqSubsToday.length - 1];
    const latest      = dailyLatestSub(eqId);            // newest shift on this equipment (any day)
    const op          = latest ? dailyNormOp(latest.opStatus) : '';
    const mine        = !!latest && latest.username === currentUser.username;
    const myOpen      = mine && dailyIsOpenOp(op);
    const otherOpen   = !!latest && !mine && dailyIsOpenOp(op);
    const waiting     = !!latest && !mine && op === DAILY_OP_WAITING;
    const myFinished  = mine && op === DAILY_OP_WAITING && latest.date === dmyToday();

    const resultSub = latestToday || latest;
    const statusCls = resultSub ? (resultSub.overall === 'Issues' ? 'nok' : 'ok') : 'pending';
    const statusLbl = resultSub ? (resultSub.overall === 'Issues' ? 'Issues' : 'OK') : 'Pending';
    const headBadge = op ? dailyOpBadge(op) : '<span class="status-badge status-'+statusCls+'">'+statusLbl+'</span>';

    // Driver shown on the card = who is on the equipment now, else the last driver, else the assigned driver
    const driverName = mine ? currentUser.fullName
      : (latest && latest.driverName) ? latest.driverName
      : dailyEquipmentDriverName(eqId);
    const weekly = dailyWeeklyInfo(eqId);
    const weeklyLine = weekly.due
      ? '<div class="small text-warning mt-1"><i class="bi bi-calendar-week me-1"></i>Weekly check <strong>due</strong>' +
          (weekly.last ? ' · last ' + esc(weekly.last.date) : ' · never done') + '</div>'
      : '<div class="small text-muted mt-1"><i class="bi bi-calendar-week me-1"></i>Weekly check done ' + esc(weekly.last.date) + ' · next ' + esc(weekly.nextDate) + '</div>';

    let infoLine = '';
    if (myOpen) {
      infoLine = '<div class="small text-success"><i class="bi bi-person-check me-1"></i>You are on shift since <strong>'+esc(latest.date)+' '+esc(latest.time)+'</strong></div>';
    } else if (otherOpen) {
      infoLine = '<div class="small text-warning"><i class="bi bi-person-fill-gear me-1"></i><strong>'+esc(latest.driverName)+'</strong> is using it ('+esc(dailyOpInfo(op).label)+')</div>';
    } else if (waiting) {
      infoLine = '<div class="small text-primary"><i class="bi bi-arrow-left-right me-1"></i><strong>'+esc(latest.driverName)+'</strong> finished — handover review required</div>';
    } else if (myFinished) {
      infoLine = '<div class="small text-primary"><i class="bi bi-hourglass-split me-1"></i>Your shift is finished — waiting for the next driver to verify the handover</div>';
    } else if (latest && op === DAILY_OP_HANDED) {
      infoLine = '<div class="small text-muted"><i class="bi bi-check2-circle me-1"></i>Last shift handed over by '+esc(latest.driverName)+'</div>';
    } else if (latest) {
      infoLine = '<div class="small text-muted"><i class="bi bi-clock-history me-1"></i>Last: '+esc(latest.driverName)+' · '+esc(latest.date)+' '+esc(latest.time)+'</div>';
    } else {
      infoLine = '<div class="small text-warning"><i class="bi bi-exclamation-circle me-1"></i>Not checked yet</div>';
    }

    const countChip = (eqSubsToday.length > 1) ? ' <span class="badge bg-secondary">'+eqSubsToday.length+' today</span>' : '';

    let actions = '';
    if (myOpen) {
      actions = '<button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewDailyCheck(\''+escAttr(latest.checkId)+'\')"><i class="bi bi-eye me-1"></i>View mine</button>';
    } else if (otherOpen) {
      actions = '<button class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-lock me-1"></i>In use</button>';
    } else if (waiting) {
      actions = '<button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewDailyCheck(\''+escAttr(latest.checkId)+'\')"><i class="bi bi-eye me-1"></i>View</button>' +
        '<button class="btn btn-sm btn-warning" onclick="event.stopPropagation();startDailyChecklist(\''+escAttr(eqId)+'\',\''+escAttr(eq.group || '')+'\',\''+escAttr(eq.shortName || eqId)+'\')"><i class="bi bi-arrow-left-right me-1"></i>Review &amp; Handover</button>';
    } else if (myFinished) {
      actions = '<button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewDailyCheck(\''+escAttr(latest.checkId)+'\')"><i class="bi bi-eye me-1"></i>View my Finished Form</button>';
    } else {
      actions = '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();startDailyChecklist(\''+escAttr(eqId)+'\',\''+escAttr(eq.group || '')+'\',\''+escAttr(eq.shortName || eqId)+'\')"><i class="bi bi-play-fill me-1"></i>Start Checklist</button>';
    }

    // Weekly check (7 days) — available even while a daily shift is running
    const weeklyBtn = weekly.due
      ? '<button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation();startWeeklyChecklist(\''+escAttr(eqId)+'\',\''+escAttr(eq.group || '')+'\',\''+escAttr(eq.shortName || eqId)+'\')"><i class="bi bi-calendar-week me-1"></i>Weekly Check</button>'
      : (weekly.last ? '<button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation();viewDailyCheck(\''+escAttr(weekly.last.checkId)+'\')"><i class="bi bi-calendar-check me-1"></i>Weekly done</button>' : '');

    return '<div class="card mb-2 clickable-card unit-card" onclick="drillToDaily({equipmentId:\''+escAttr(eqId)+'\'})">' +
      '<div class="group-header d-flex justify-content-between align-items-center">' +
        '<span><i class="bi bi-truck text-primary me-2"></i><strong>'+esc(eq.shortName || eqId)+'</strong>'+countChip+'</span>' +
        headBadge +
      '</div>' +
      '<div class="card-body py-2">' +
        '<div class="small"><i class="bi bi-person-badge text-muted me-1"></i><strong>'+esc(driverName)+'</strong></div>' +
        '<div class="small text-muted mb-1">'+esc(eq.group || '')+(eq.model ? ' · '+esc(eq.model) : '')+'</div>' +
        infoLine + weeklyLine +
        '<div class="d-flex gap-2 flex-wrap justify-content-end mt-2">' + actions + weeklyBtn + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  const issuesToday = mySubs.filter(s => isToday(s.date) && s.overall === 'Issues').length;

  const weeklySection = weeklyDue.length
    ? '<h6 class="mb-2 mt-3"><i class="bi bi-calendar-week text-info me-2"></i>Weekly Check due (' + weeklyDue.length + ')</h6>' +
      weeklyDue.map(x => {
        const eq = APP.equipmentMap[x.eqId] || {};
        return '<div class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">' +
          '<div><div class="fw-bold"><i class="bi bi-truck text-primary me-1"></i>' + esc(eq.shortName || x.eqId) + '</div>' +
            '<div class="small text-muted">' + esc(eq.equipmentId || x.eqId) + ' · ' + (x.info.last ? 'last ' + esc(x.info.last.date) : 'never done') + '</div></div>' +
          '<button class="btn btn-sm btn-outline-info" onclick="startWeeklyChecklist(\'' + escAttr(x.eqId) + '\',\'' + escAttr(eq.group || '') + '\',\'' + escAttr(eq.shortName || x.eqId) + '\')"><i class="bi bi-play-fill me-1"></i>Start</button>' +
        '</div></div>';
      }).join('')
    : '';

  $('#app').html(
    '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<div><h5 class="mb-0">សូមស្វាគមន៍</h5><small class="text-muted">'+esc(currentUser.fullName)+' · '+esc(currentUser.group)+'</small></div>' +
      '<button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button>' +
    '</div>' +
    '<div class="row g-2 mb-3">' +
      '<div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillToDaily({equipmentId:\'all\',dateFrom:\'\',dateTo:\'\',status:\'all\',driver:\'all\',group:\'all\'})">' +
        '<div class="num text-primary">'+mySubs.length+'</div><div class="lbl">សរុប</div></div></div>' +
      '<div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillToDaily({status:\'all\',dateFrom:\''+isoToday()+'\',dateTo:\''+isoToday()+'\'})">' +
        '<div class="num text-info">'+todaySubs.length+'</div><div class="lbl">ថ្ងៃនេះ</div></div></div>' +
      '<div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillToDaily({status:\'Issues\',dateFrom:\'\',dateTo:\'\'})">' +
        '<div class="num text-danger">'+issuesToday+'</div><div class="lbl">Issues today</div></div></div>' +
      '<div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillToDaily({equipmentId:\'all\',status:\'all\',dateFrom:\'\',dateTo:\'\'})">' +
        '<div class="num text-success">'+myEqIds.length+'</div><div class="lbl">ឧបករណ៍</div></div></div>' +
    '</div>' +
    (sessionCards ? '<h6 class="mb-2"><i class="bi bi-activity text-success me-2"></i>My Shift ('+openShifts.length+')</h6>' + sessionCards : '') +
    weeklySection +
    '<h6 class="mb-2 mt-3"><i class="bi bi-clipboard-check text-primary me-2"></i>ឧបករណ៍របស់ខ្ញុំ ('+myEqIds.length+')</h6>' +
    (cards || '<div class="card"><div class="card-body text-center py-4"><div class="text-muted mb-1"><i class="bi bi-truck fs-3"></i></div>' +
      '<div class="text-muted">មិនមានឧបករណ៍នៅក្នុងគណនីរបស់អ្នកទេ</div>' +
      '<div class="small text-muted mt-1">សូមទាក់ទង Admin ដើម្បីដាក់ឧបករណ៍ (Equipment) ឱ្យគណនី @'+esc(currentUser.username)+'</div></div></div>')
  );
}

function renderDailyAdminHome() {
  const todaySubs = dailyShiftOnly(APP.dailySubmissions || []).filter(s => isToday(s.date));
  const myDrivers = APP.users.filter(u => u.role === 'driver');
  
  let doneDrivers = [];
  let pendingDrivers = [];
  let issuesCount = todaySubs.filter(s => s.overall === 'Issues').length;

  myDrivers.forEach(t => {
    const eqIds = t.equipment || [];
    if (eqIds.length === 0) return;
    const doneToday = todaySubs.filter(s => s.username === t.username);
    const driverObj = { driver: t, count: doneToday.length, total: eqIds.length, hasIssues: doneToday.some(s => s.overall === 'Issues') };
    if (doneToday.length >= eqIds.length) {
      doneDrivers.push(driverObj);
    } else {
      pendingDrivers.push(driverObj);
    }
  });

  const total = doneDrivers.length + pendingDrivers.length;
  const pct = total ? Math.round((doneDrivers.length / total) * 100) : 0;

  const showAll = homeStatFilter === 'all';
  const showDone = showAll || homeStatFilter === 'done';
  const showPending = showAll || homeStatFilter === 'pending';
  const showIssues = showAll || homeStatFilter === 'issues';
  const cardCls = (f) => 'stat-card clickable-card' + (homeStatFilter === f ? ' active' : '');

  const driverRow = ({driver, count, total, hasIssues}) => {
    const eqIds = driver.equipment || [];
    const rowPct = eqIds.length ? Math.round(count / eqIds.length * 100) : 0;
    const badgeCls = count === eqIds.length && eqIds.length > 0 ? 'ok' : (count > 0 ? 'pending' : 'nok');
    const badgeLbl = count === eqIds.length && eqIds.length > 0 ? 'Done' : (count > 0 ? 'Partial' : 'Pending');
    return '<div class="card mb-2 clickable-card" onclick="drillToDaily({driver:\''+escAttr(driver.username)+'\',dateFrom:\''+isoToday()+'\',dateTo:\''+isoToday()+'\'})">' +
      '<div class="card-body py-2">' +
        '<div class="d-flex justify-content-between align-items-center mb-1">' +
          '<strong>'+esc(driver.fullName)+'</strong>' +
          '<div class="d-flex gap-1">' +
            (hasIssues ? '<span class="badge bg-danger">!</span>' : '') +
            '<span class="status-badge status-'+badgeCls+'">'+badgeLbl+'</span>' +
          '</div>' +
        '</div>' +
        '<div class="small text-muted mb-1">'+esc(eqIds.map(id => eqShort(id)).join(', ') || '—')+'</div>' +
        '<div class="dash-bar"><div class="track"><div class="fill" style="width:'+rowPct+'%;background:'+(rowPct===100?'#28a745':'#0d6efd')+'"></div></div><span class="val">'+count+'/'+eqIds.length+'</span></div>' +
      '</div>' +
    '</div>';
  };

  $('#app').html(
    '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<div><h5 class="mb-0">Admin Home (Daily)</h5><small class="text-muted">'+esc(currentUser.group)+' · '+dmyToday()+'</small></div>' +
      '<button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button>' +
    '</div>' +

    '<div class="row g-2 mb-3">' +
      '<div class="col-4"><div class="' + cardCls('done') + '" onclick="setHomeStatFilter(\'done\')"><div class="num text-primary">' + doneDrivers.length + '</div><div class="lbl">Checked / ' + total + '</div></div></div>' +
      '<div class="col-4"><div class="' + cardCls('pending') + '" onclick="setHomeStatFilter(\'pending\')"><div class="num text-warning">' + pendingDrivers.length + '</div><div class="lbl">Pending</div></div></div>' +
      '<div class="col-4"><div class="' + cardCls('issues') + '" onclick="setHomeStatFilter(\'issues\')"><div class="num text-danger">' + issuesCount + '</div><div class="lbl">Issues</div></div></div>' +
    '</div>' +

    renderHomeFilterChip() +

    (showAll ? '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-calendar-check me-2"></i>Daily Progress — ' + esc(currentUser.group) + '</span><span class="badge bg-' + (pct === 100 ? 'success' : 'primary') + '">' + doneDrivers.length + '/' + total + ' (' + pct + '%)</span></div><div class="card-body py-2"><div class="dash-bar"><div class="track"><div class="fill" style="width:' + pct + '%;background:' + (pct === 100 ? '#28a745' : '#0d6efd') + '"></div></div><span class="val">' + pct + '%</span></div></div></div>' : '') +

    '<div class="mb-3"><button class="btn btn-outline-primary w-100" onclick="openManageDrivers()"><i class="bi bi-people me-1"></i>គ្រប់គ្រងអ្នកបើកបរ</button></div>' +

    (showDone ? '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>Completed Today (' + doneDrivers.length + ')</h6>' + (doneDrivers.length ? renderSectionWithLimit(doneDrivers, 'daily_done', driverRow, !showAll) : '<p class="text-muted small text-center py-3">—</p>') : '') +
    
    (showPending ? '<h6 class="mb-2 mt-3"><i class="bi bi-exclamation-circle text-warning me-2"></i>Pending Today (' + pendingDrivers.length + ')</h6>' + (pendingDrivers.length ? renderSectionWithLimit(pendingDrivers, 'daily_pending', driverRow, !showAll) : '<p class="text-muted small text-center py-3">—</p>') : '')
  );
}

function renderDailyManagerHome() {
  const GROUP_ORDER = ['រថយន្ត', 'RTG', 'គ្រឿងចក្រ'];
  const eqGroups = [...new Set((APP.equipment || []).map(e => e.group).filter(Boolean))];
  const groups = GROUP_ORDER.filter(g => eqGroups.indexOf(g) !== -1);
  eqGroups.forEach(g => { if (groups.indexOf(g) === -1) groups.push(g); });

  // FIXED: Using isToday instead of isThisMonth
  const todaySubs = dailyShiftOnly(APP.dailySubmissions || []).filter(s => isToday(s.date));
  const allEq     = APP.equipment || [];
  
  const pendingConfirm = (APP.dailySubmissions || []).filter(s => (s.confirmStatus || 'Pending') === 'Confirmed' && !s.directorStatus).sort((a,b) => subMs(b) - subMs(a));
  const todayIssues = todaySubs.filter(s => s.overall === 'Issues').sort((a,b) => subMs(b) - subMs(a));
  
  const totalEq   = allEq.length;
  const totalDone = allEq.filter(e => todaySubs.some(s => s.equipmentId === e.equipmentId)).length;

  const showAll = homeStatFilter === 'all'; 
  const showDone = showAll || homeStatFilter === 'done'; 
  const showToConfirm = showAll || homeStatFilter === 'toConfirm'; 
  const showIssues = showAll || homeStatFilter === 'issues';
  const cardCls = (f) => 'stat-card clickable-card' + (homeStatFilter === f ? ' active' : '');

  const confirmRenderer = (s) => '<div class="pending-row clickable-card" onclick="viewDailyCheck(\'' + escAttr(s.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:' + (s.overall === 'Issues' ? '#dc3545' : '#28a745') + ';"></span><div class="meta"><strong>' + esc(eqShort(s.equipmentId)) + '</strong> · ' + esc(s.driverName) + '<small>' + esc(s.date) + ' · ' + esc(s.checkId) + '</small></div><button class="btn btn-sm btn-success" onclick="event.stopPropagation();viewDailyCheck(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-check2"></i></button></div>';
  const issueRenderer = (s) => '<div class="pending-row clickable-card" onclick="viewDailyCheck(\'' + escAttr(s.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:#dc3545;"></span><div class="meta"><strong>' + esc(eqShort(s.equipmentId)) + '</strong> · ' + esc(s.driverName) + '<small>' + esc(s.date) + ' · ' + esc(s.checkId) + '</small></div><span class="badge bg-danger">' + esc(s.overall) + '</span></div>';
  const pendingEqRenderer = (g) => (e) => '<div class="driver-status-row clickable-card" onclick="event.stopPropagation();drillToDaily({equipmentId:\'' + escAttr(e.equipmentId) + '\',group:\'' + escAttr(g) + '\',dateFrom:\'\',dateTo:\'\'})"><div class="left"><i class="bi bi-circle text-secondary" style="font-size:1.1rem;"></i><div><div class="name">' + esc(e.shortName || e.equipmentId) + '</div><div class="eqs">' + esc(e.equipmentId) + ' · ' + esc(e.model || '') + '</div></div></div><div><span class="badge bg-warning text-dark">pending</span></div></div>';

  const groupBlocks = groups.map((g, gIdx) => {
    const gEq = allEq.filter(e => e.group === g); const gSubs = todaySubs.filter(s => s.group === g);
    const doneEq = new Set(gSubs.map(s => s.equipmentId)); const pendingEq = gEq.filter(e => !doneEq.has(e.equipmentId));
    const doneCount = gEq.length - pendingEq.length; const total = gEq.length; const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;

    const completedRows = gEq.filter(e => doneEq.has(e.equipmentId)).slice(0, 5).map(e => {
      const latest = gSubs.filter(s => s.equipmentId === e.equipmentId).sort((a,b) => subMs(b) - subMs(a))[0];
      return '<div class="driver-status-row clickable-card" onclick="event.stopPropagation();viewDailyCheck(\'' + escAttr(latest.checkId) + '\')"><div class="left"><i class="bi bi-check-circle-fill text-success" style="font-size:1.1rem;"></i><div><div class="name">' + esc(e.shortName || e.equipmentId) + '</div><div class="eqs">' + esc(latest.driverName) + ' · ' + esc(latest.date) + '</div></div></div><div><span class="badge bg-' + (latest.overall === 'Issues' ? 'danger' : 'success') + '">' + esc(latest.overall) + '</span></div></div>';
    }).join('');

    const collapseId = 'grp-body-' + gIdx; const pendingSectionKey = 'mgr_grp_' + gIdx + '_pending';
    const pendingBlock = pendingEq.length ? '<div class="small text-warning mb-1"><i class="bi bi-exclamation-circle me-1"></i>Pending (' + pendingEq.length + ')</div>' + renderSectionWithLimit(pendingEq, pendingSectionKey, pendingEqRenderer(g), false) : '<div class="small text-success mb-1"><i class="bi bi-check2-circle me-1"></i>All checked today</div>';

    return '<div class="card mb-2"><div class="group-header d-flex justify-content-between align-items-center clickable-card" data-bs-toggle="collapse" data-bs-target="#' + collapseId + '" style="cursor:pointer;"><span><i class="bi bi-diagram-3 me-2"></i><strong>' + esc(g) + '</strong></span><span class="badge bg-' + (pct === 100 ? 'success' : 'primary') + '">' + doneCount + '/' + total + ' (' + pct + '%)</span></div><div class="collapse show" id="' + collapseId + '"><div class="card-body py-2"><div class="dash-bar mb-2"><div class="track"><div class="fill" style="width:' + pct + '%;background:' + (pct === 100 ? '#28a745' : '#0d6efd') + '"></div></div><span class="val">' + pct + '%</span></div>' + pendingBlock + (completedRows ? '<div class="small text-muted mt-2 mb-1">Recently checked</div>' + completedRows : '') + '</div></div></div>';
  }).join('');

  let html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0">Manager Home (Daily)</h5><small class="text-muted">' + dmyToday() + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'home\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' +
    '<div class="row g-2 mb-3"><div class="col-4"><div class="' + cardCls('done') + '" onclick="setHomeStatFilter(\'done\')"><div class="num text-primary">' + totalDone + '</div><div class="lbl">Checked / ' + totalEq + '</div></div></div><div class="col-4"><div class="' + cardCls('toConfirm') + '" onclick="setHomeStatFilter(\'toConfirm\')"><div class="num text-warning">' + pendingConfirm.length + '</div><div class="lbl">To confirm</div></div></div><div class="col-4"><div class="' + cardCls('issues') + '" onclick="setHomeStatFilter(\'issues\')"><div class="num text-danger">' + todayIssues.length + '</div><div class="lbl">Issues</div></div></div></div>' +
    renderHomeFilterChip();

  if (showToConfirm) html += '<h6 class="mb-2"><i class="bi bi-patch-question text-primary me-2"></i>Pending your confirmation (' + pendingConfirm.length + ')</h6>' + (pendingConfirm.length ? renderSectionWithLimit(pendingConfirm, 'dir_confirm', confirmRenderer, !showAll) : '<p class="text-muted small text-center py-3">✓ Nothing to confirm</p>');
  
  if (showDone && !showAll) {
    const completedItems = allEq.map(e => { const subs = todaySubs.filter(s => s.equipmentId === e.equipmentId).sort((a,b) => subMs(b) - subMs(a)); return subs[0] ? { eq: e, latest: subs[0] } : null; }).filter(Boolean).sort((a,b) => subMs(b.latest) - subMs(a.latest));
    const completedRenderer = ({ eq, latest }) => '<div class="pending-row clickable-card" onclick="viewDailyCheck(\'' + escAttr(latest.checkId) + '\')"><span style="width:8px;height:8px;border-radius:50%;background:' + (latest.overall === 'Issues' ? '#dc3545' : '#28a745') + ';"></span><div class="meta"><strong>' + esc(eq.shortName || eq.equipmentId) + '</strong> · ' + esc(latest.driverName) + '<small>' + esc(latest.date) + ' ' + esc(latest.time) + ' · ' + esc(latest.checkId) + '</small></div><span class="badge bg-' + (latest.overall === 'Issues' ? 'danger' : 'success') + '">' + esc(latest.overall) + '</span></div>';
    html += '<h6 class="mb-2 mt-3"><i class="bi bi-check2-circle text-success me-2"></i>Checked Today (' + completedItems.length + ')</h6>' + (completedItems.length ? renderSectionWithLimit(completedItems, 'dir_completed', completedRenderer, false) : '<p class="text-muted small text-center py-3">—</p>');
  }
  
  if (showIssues && !showAll) html += '<h6 class="mb-2 mt-3"><i class="bi bi-exclamation-triangle text-danger me-2"></i>Issues Today (' + todayIssues.length + ')</h6>' + (todayIssues.length ? renderSectionWithLimit(todayIssues, 'dir_issues', issueRenderer, false) : '<p class="text-muted small text-center py-3">—</p>');
  
  if (showAll) html += '<h6 class="mb-2 mt-3"><i class="bi bi-diagram-3 text-primary me-2"></i>Groups — today</h6>' + (groupBlocks || '<p class="text-muted text-center py-4">—</p>');

  $('#app').html(html);
}


/*ScriptChecklist*/

/* =========================================================
   CHECKLIST FORM
   ========================================================= */
window.startChecklist = function(equipmentId, group, shortName, driverUsername, assignmentId){ 
  const grp = String(group || '').trim();
  
  // CRITICAL: Ensure grp is actually matching. If it's undefined, it routes to Truck!
  if (grp === 'TCC&FCC') {
    window.startChecklistFCC(equipmentId, group, shortName, driverUsername, assignmentId);
  } else if (grp === 'RTG' || grp === 'គ្រឿងចក្រ') {
    window.startChecklistRTG(equipmentId, group, shortName, driverUsername, assignmentId);
  } else {
    loadAndRenderChecklistForm(equipmentId, group, shortName, driverUsername, assignmentId, null); 
  }
};

function loadAndRenderChecklistForm(equipmentId, group, shortName, driverUsername, assignmentId, existingSub){
  const eqData = APP.equipmentMap[equipmentId] || {};
  const sg = eqData.specificGroup || '';
  const raw = APP.templates[group + '|' + sg] || APP.templates[group + '|'] || APP.templates[group] || [];
  
  const headers = raw.filter(it => String(it.inputType).toLowerCase() === 'header');
  const items   = raw.filter(it => String(it.inputType).toLowerCase() !== 'header');
  if (items.length === 0) { showAlert('No template for group: '+group, 'danger'); return; }

  const headerBySection = {};
  headers.forEach(h => { headerBySection[String(h.itemId).trim()] = h; });
  const prevSub = (APP.submissions || []).filter(s => s.equipmentId === equipmentId).sort((a, b) => subMs(b) - subMs(a))[0] || null;
  const eq = APP.equipmentMap[equipmentId] || {};
  const isEdit = !!existingSub;

  let formDefaults, checksInit;
    if (isEdit) {
    const s = existingSub;
    formDefaults = { 
      date: isoDate(parseDmyToDate(s.date)), 
      timeIn: s.timeIn || s.time || '', 
      timeOut: s.timeOut || '', 
      odometer: s.odometer || '', 
      lastOpHour: s.lastOpHour || '', 
      previousDate: s.previousDate || '', 
      previousOdometer: s.previousOdometer || '', 
      previousHour: s.previousHour || '', 
      trailerPlateNo: s.trailerPlateNo || '', 
      driverUsername: s.driverUsername || s.username 
    };

    // ★ FIX: Recover Extra Items that were saved in the database
    (s.checks || []).forEach(c => {
      if (String(c.itemId).startsWith('EXT-')) {
        // 1. Add the item back to the list
        if (!items.find(it => it.itemId === c.itemId)) {
          items.push({
            itemId: c.itemId,
            itemKhmer: c.itemKhmer || c.itemId, // Uses the saved name
            itemEng: '',
            inputType: 'oknotok',
            isExtra: true
          });
        }
        // 2. Add the section header back
        const sec = sectionOf(c.itemId);
        if (!headerBySection[sec]) {
          headerBySection[sec] = {
            itemId: sec,
            itemKhmer: sec === 'EXT-TRK' ? 'ផ្នែកផ្សេងៗទៀត' : 'ផ្នែកផ្សេងៗទៀត',
            itemEng: sec === 'EXT-TRK' ? 'Others' : 'Others',
            inputType: 'header'
          };
        }
      }
    });

    checksInit = {};
    items.forEach(it => { checksInit[it.itemId] = { itemId: it.itemId, status: 'N', location: '', note: '', photos: [] }; });
    
    (s.checks || []).forEach(c => {
      let photos = [];
      if (Array.isArray(c.photos)) photos = c.photos.map(p => ({ fileId: p.fileId || '', thumb: p.thumb || '', dataUrl: p.dataUrl || '' }));
      else if (Array.isArray(c.photoIds)) photos = c.photoIds.map(id => ({ fileId: id }));
      else if (c.photoId) photos = [{ fileId: c.photoId }];
      else if (c.photoData) photos = [{ dataUrl: c.photoData }];
      
      if (checksInit[c.itemId]) {
        checksInit[c.itemId].status = normalizeStatus(c.status) || 'N';
        checksInit[c.itemId].location = c.location || '';
        checksInit[c.itemId].note = c.note || '';
        checksInit[c.itemId].photos = photos;
      }
    });
  } else {
    formDefaults = { date: isoDate(new Date()), timeIn: nowTimeStr(), timeOut: '', odometer: '', lastOpHour: '', previousDate: prevSub ? isoDate(parseDmyToDate(prevSub.date)) : '', previousOdometer: prevSub ? (prevSub.odometer || '') : '', previousHour: prevSub ? (prevSub.lastOpHour || '') : '', trailerPlateNo: eq.trailerId || '', driverUsername: driverUsername || currentUser.username };
    checksInit = {};
    items.forEach(it => { checksInit[it.itemId] = { itemId: it.itemId, status: 'N', location: '', note: '', photos: [] }; });
  }

  pendingChecklist = { equipmentId: equipmentId, group: group, shortName: shortName, headers: headers.slice(), headerBySection: headerBySection, items: items.slice(), checks: checksInit, form: formDefaults, assignmentId: assignmentId || '', existingRemark: isEdit ? (existingSub.remark || '') : '' };
  editingCheckId = isEdit ? existingSub.checkId : null;
  renderChecklistForm();
  if (isEdit) setTimeout(() => { $('#checkRemark').val(existingSub.remark || ''); }, 30);
}

function buildInfoForm(c){
  const f = c.form || {};
  const todayDisplay   = formatIsoToDmy(f.date || isoDate(new Date()));
  const timeInDisplay  = f.timeIn  || nowTimeStr();
  const timeOutDisplay = f.timeOut || '';
  if (!f.date)   c.form.date   = isoDate(new Date());
  if (!f.timeIn) c.form.timeIn = timeInDisplay;

  const currentTrailerId = f.trailerPlateNo || '';
  const currentTrailer = (APP.trailers || []).find(t => t.trailerId === currentTrailerId);
  const currentTrailerLabel = currentTrailer ? (currentTrailer.shortName || currentTrailer.trailerId) : currentTrailerId;

  const currentDriverUsername = f.driverUsername || '';
  const currentDriver = (APP.drivers || []).find(d => d.username === currentDriverUsername);
  const currentDriverLabel = currentDriver ? (currentDriver.fullName + ' (@' + currentDriver.username + ')') : currentDriverUsername;

  _selectedChecklistTrailerId       = currentTrailerId;
  _selectedChecklistDriverUsername  = currentDriverUsername;

  const col = (label, inner) => '<div class="col-6 col-md-4"><label class="form-label small fw-bold mb-1">' + esc(label) + '</label>' + inner + '</div>';

  return '<div class="card mb-3 info-card"><div class="card-body"><h6 class="mb-3"><i class="bi bi-clipboard-data text-primary me-2"></i>Inspection Info</h6><div class="row g-2">' +
    col('DATE', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(todayDisplay) + '" readonly>') +
    col('TIME IN', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(timeInDisplay) + '" readonly>') +
    col('TIME OUT', '<input type="text" class="form-control form-control-sm bg-light" id="fldTimeOutDisplay" value="' + escAttr(timeOutDisplay) + '" placeholder="Set on submit" readonly>') +
    col('ODOMETER', '<input type="text" class="form-control form-control-sm" id="fldOdometer" value="' + escAttr(f.odometer || '') + '" placeholder="e.g. 12345" oninput="onFormChange(\'odometer\', this.value)">') +
    col('LAST OP-HOUR', '<input type="text" class="form-control form-control-sm" id="fldLastOpHour" value="' + escAttr(f.lastOpHour || '') + '" placeholder="e.g. 340" oninput="onFormChange(\'lastOpHour\', this.value)">') +
    col('TRAILER PLATE NO', '<div style="position:relative;"><input type="text" class="form-control form-control-sm" id="fldTrailerSearch" placeholder="Type trailer ID or name..." autocomplete="off" value="' + escAttr(currentTrailerLabel) + '" oninput="onChecklistTrailerInput(this.value)" onfocus="showChecklistTrailerDropdown()" onblur="hideChecklistTrailerDropdown()"><input type="hidden" id="fldTrailer" value="' + escAttr(currentTrailerId) + '"><div id="checklistTrailerDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:300px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div></div>') +
    col('TRUCK DRIVER', '<div style="position:relative;"><input type="text" class="form-control form-control-sm" id="fldDriverSearch" placeholder="Type driver name or username..." autocomplete="off" value="' + escAttr(currentDriverLabel) + '" oninput="onChecklistDriverInput(this.value)" onfocus="showChecklistDriverDropdown()" onblur="hideChecklistDriverDropdown()"><input type="hidden" id="fldDriver" value="' + escAttr(currentDriverUsername) + '"><div id="checklistDriverDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:300px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div></div>') +
    '</div><hr class="my-3"><div class="small text-muted mb-2">Previous values (from last check)</div><div class="row g-2">' +
    col('PREVIOUS DATE', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousDate || '—') + '" readonly>') +
    col('PREVIOUS ODOMETER', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousOdometer || '—') + '" readonly>') +
    col('PREVIOUS HOUR', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousHour || '—') + '" readonly>') +
    '</div></div></div>';
}

window.onFormChange = function(key, value){ if (!pendingChecklist) return; if (!pendingChecklist.form) pendingChecklist.form = {}; pendingChecklist.form[key] = value; };

let _checklistTrailerData            = [];
let _checklistDriverData             = [];
let _selectedChecklistTrailerId      = '';
let _selectedChecklistDriverUsername = '';

function initChecklistTrailerData(){ _checklistTrailerData = (APP.trailers || []).map(t => ({ trailerId: t.trailerId, shortName: t.shortName || '' })); }
function renderChecklistTrailerDropdown(filterText){
  const dd = document.getElementById('checklistTrailerDropdown'); if (!dd) return;
  const q = String(filterText || '').toLowerCase().trim();
  let matches = _checklistTrailerData;
  if (q) matches = _checklistTrailerData.filter(t => t.trailerId.toLowerCase().includes(q) || (t.shortName || '').toLowerCase().includes(q));
  if (matches.length === 0) { dd.innerHTML = '<div class="p-2 small text-muted text-center"><i class="bi bi-search me-1"></i>No matching trailer</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(t => {
    const isSelected = t.trailerId === _selectedChecklistTrailerId;
    const label = t.shortName || t.trailerId;
    return '<div class="p-2" style="cursor:pointer; border-bottom:1px solid #f0f0f0;' + (isSelected ? 'background:rgba(13,110,253,.08);' : '') + '" onmousedown="selectChecklistTrailer(\'' + escAttr(t.trailerId) + '\',\'' + escAttr(label) + '\')"><div class="fw-semibold" style="font-size:.85rem;">' + esc(t.shortName || t.trailerId) + '</div>' + (t.shortName && t.shortName !== t.trailerId ? '<div class="small text-muted" style="font-size:.72rem;">' + esc(t.trailerId) + '</div>' : '') + '</div>';
  }).join('');
  dd.style.display = 'block';
}
window.onChecklistTrailerInput = function(value){ _selectedChecklistTrailerId = ''; const hidden = document.getElementById('fldTrailer'); if (hidden) hidden.value = ''; if (pendingChecklist && pendingChecklist.form) pendingChecklist.form.trailerPlateNo = ''; renderChecklistTrailerDropdown(value); };
window.showChecklistTrailerDropdown = function(){ const input = document.getElementById('fldTrailerSearch'); if (input) input.select(); renderChecklistTrailerDropdown(''); };
window.hideChecklistTrailerDropdown = function(){ setTimeout(() => { const dd = document.getElementById('checklistTrailerDropdown'); if (dd) dd.style.display = 'none'; }, 180); };
window.selectChecklistTrailer = function(trailerId, label){
  _selectedChecklistTrailerId = trailerId;
  const hidden = document.getElementById('fldTrailer'); if (hidden) hidden.value = trailerId;
  const input = document.getElementById('fldTrailerSearch'); if (input) input.value = label;
  const dd = document.getElementById('checklistTrailerDropdown'); if (dd) dd.style.display = 'none';
  if (pendingChecklist && pendingChecklist.form) pendingChecklist.form.trailerPlateNo = trailerId;
};

function initChecklistDriverData(group){ _checklistDriverData = (APP.drivers || []).filter(d => !d.group || d.group === group).map(d => ({ username: d.username, fullName: d.fullName, eqShortList: eqShortList(d.equipment || []) })); }
function renderChecklistDriverDropdown(filterText){
  const dd = document.getElementById('checklistDriverDropdown'); if (!dd) return;
  const q = String(filterText || '').toLowerCase().trim();
  let matches = _checklistDriverData;
  if (q) matches = _checklistDriverData.filter(d => d.fullName.toLowerCase().includes(q) || d.username.toLowerCase().includes(q));
  if (matches.length === 0) { dd.innerHTML = '<div class="p-2 small text-muted text-center"><i class="bi bi-search me-1"></i>No matching driver</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(d => {
    const isSelected = d.username === _selectedChecklistDriverUsername;
    const label = d.fullName + ' (@' + d.username + ')';
    return '<div class="p-2" style="cursor:pointer; border-bottom:1px solid #f0f0f0;' + (isSelected ? 'background:rgba(13,110,253,.08);' : '') + '" onmousedown="selectChecklistDriver(\'' + escAttr(d.username) + '\',\'' + escAttr(label) + '\')"><div class="fw-semibold" style="font-size:.85rem;">' + esc(d.fullName) + ' <small class="text-muted">(@' + esc(d.username) + ')</small></div>' + (d.eqShortList ? '<div class="small text-muted" style="font-size:.72rem;">' + esc(d.eqShortList) + '</div>' : '') + '</div>';
  }).join('');
  dd.style.display = 'block';
}
window.onChecklistDriverInput = function(value){ _selectedChecklistDriverUsername = ''; const hidden = document.getElementById('fldDriver'); if (hidden) hidden.value = ''; if (pendingChecklist && pendingChecklist.form) pendingChecklist.form.driverUsername = ''; renderChecklistDriverDropdown(value); };
window.showChecklistDriverDropdown = function(){ const input = document.getElementById('fldDriverSearch'); if (input) input.select(); renderChecklistDriverDropdown(''); };
window.hideChecklistDriverDropdown = function(){ setTimeout(() => { const dd = document.getElementById('checklistDriverDropdown'); if (dd) dd.style.display = 'none'; }, 180); };
window.selectChecklistDriver = function(username, label){
  _selectedChecklistDriverUsername = username;
  const hidden = document.getElementById('fldDriver'); if (hidden) hidden.value = username;
  const input = document.getElementById('fldDriverSearch'); if (input) input.value = label;
  const dd = document.getElementById('checklistDriverDropdown'); if (dd) dd.style.display = 'none';
  if (pendingChecklist && pendingChecklist.form) pendingChecklist.form.driverUsername = username;
};

function renderChecklistForm(){
  const c = pendingChecklist;

  // ★ 1. STRICT SORTING: Forces order to be 1-22 ➔ EXT-TRK ➔ 23-30 ➔ EXT-TRL
  c.items.sort((a, b) => {
    const getRank = (id) => {
      if (String(id).startsWith('EXT-TRK')) return 2;
      if (String(id).startsWith('EXT-TRL')) return 4;
      const num = parseInt(String(id).split(/[-\.]/)[0]);
      if (!isNaN(num)) {
        if (num >= 1 && num <= 22) return 1;  // Standard Truck
        if (num >= 23 && num <= 30) return 3; // Standard Trailer
      }
      return 0;
    };
    return getRank(a.itemId) - getRank(b.itemId);
  });

  let lastSectionShown = '__none__'; 
  let globalNum = 0; 
  let itemsHtml = '';

  const isTruck = String(c.group || '').trim() === 'រថយន្ត';
  let truckBannerShown = false;
  let trailerBannerShown = false;

  const isTruckSec = (id) => {
    if (String(id).startsWith('EXT-TRK')) return true;
    const num = parseInt(String(id).split(/[-\.]/)[0]);
    return num >= 1 && num <= 22;
  };
  const isTrailerSec = (id) => {
    if (String(id).startsWith('EXT-TRL')) return true;
    const num = parseInt(String(id).split(/[-\.]/)[0]);
    return num >= 23 && num <= 30;
  };

  c.items.forEach((it, index) => {
    const sec = sectionOf(it.itemId);
    let headerHtml = '';

    // --- 1. Render Sticky Banners ---
    if (isTruck && sec && sec !== lastSectionShown) {
      const secNum = parseInt(sec);
      const isTruckHeader = (secNum >= 1 && secNum <= 22) || sec === 'EXT-TRK';
      const isTrailerHeader = (secNum >= 23 && secNum <= 30) || sec === 'EXT-TRL';

      if (isTruckHeader && !truckBannerShown) {
        // ★ Note: Change 'top: 56px' if your top header height is different
        headerHtml += '<div class="section-banner" style="position: sticky; top: 56px; z-index: 99; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); background:#7A2B4A; color:#fff; text-align:center; padding:8px; font-weight:bold; margin-top:20px; margin-bottom:10px; border-radius:6px; font-size:14px; letter-spacing:0.5px;">Tractor / រថយន្ត</div>';
        truckBannerShown = true;
      }
      if (isTrailerHeader && !trailerBannerShown) {
        headerHtml += '<div class="section-banner" style="position: sticky; top: 56px; z-index: 99; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); background:#7A2B4A; color:#fff; text-align:center; padding:8px; font-weight:bold; margin-top:20px; margin-bottom:10px; border-radius:6px; font-size:14px; letter-spacing:0.5px;">Trailer / រ៉ឺម៉ក</div>';
        trailerBannerShown = true;
      }
    }

    // --- 2. Render Section Headers ---
    if (sec && sec !== lastSectionShown) {
      lastSectionShown = sec;
      const h = (c.headerBySection || {})[sec];
      if (h) {
        let headerTitle = h.itemKhmer;
        if (!headerTitle.startsWith(sec + '.') && !sec.startsWith('EXT-')) {
          headerTitle = '<span class="sec-num">' + esc(sec) + '.</span>' + esc(headerTitle);
        }
        headerHtml += '<div class="section-divider"><div class="sec-kh">' + headerTitle + '</div>' + (h.itemEng ? '<div class="sec-en">' + esc(h.itemEng) + '</div>' : '') + '</div>';
      }
    }

    // --- 3. Render Item (Inline Input OR Normal Row) ---
    if (it.isEditing) {
      itemsHtml += headerHtml + `
        <div class="check-item" style="background:#e3f2fd; padding:10px; border-radius:8px; margin-bottom:10px; border:1px dashed #0d6efd;">
          <div class="row-line">
            <div class="d-flex w-100 gap-2 flex-wrap">
              <input type="text" id="extra-input-${it.itemId}" class="form-control form-control-sm" placeholder="Type extra item name..." style="flex: 1; min-width: 150px;"
                     value="${escAttr(it.itemKhmer || '')}"
                     onkeypress="if(event.key==='Enter') saveExtraItem('${it.itemId}', this.value)">
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-primary" onclick="saveExtraItem('${it.itemId}', document.getElementById('extra-input-${it.itemId}').value)"><i class="bi bi-check-lg"></i> OK</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="cancelExtraItem('${it.itemId}')">Cancel</button>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      globalNum++; 
      let label = globalNum;
      if (!it.isExtra && String(it.itemId).includes('-')) {
        const parts = String(it.itemId).split('-');
        label = parts[parts.length - 1]; 
      }

      const sel       = c.checks[it.itemId] || { status: 'N', location: '', note: '', photos: [] };
      const statusVal = normalizeStatus(sel.status) || 'N';
      const showNote  = statusVal !== 'N';
      const loc       = sel.location || '';
      const photos    = sel.photos || [];

      const optsHtml = STATUS_OPTIONS.map(o =>
        '<option value="' + escAttr(o.code) + '"' + (statusVal === o.code ? ' selected' : '') + '>' + esc(o.code) + '</option>'
      ).join('');

      const photoTiles = photos.map((p, idx) => {
        const src = photoSrc(p, 200);
        return '<div class="photo-tile" data-photo-idx="' + idx + '" onclick="openLightboxFromForm(\'' + escAttr(it.itemId) + '\',' + idx + ')">' + (src ? '<img src="' + src + '" loading="lazy" decoding="async" alt="">' : '<div style="width:90px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;"><i class="bi bi-image"></i></div>') + '<button type="button" class="photo-remove-btn" onclick="event.stopPropagation();removeItemPhoto(\'' + escAttr(it.itemId) + '\',' + idx + ')">×</button></div>';
      }).join('');

      const addPhotoTile = (photos.length < 10) ? 
  '<div class="photo-tile photo-add-tile" onclick="takePhotoDirectly(\'' + escAttr(it.itemId) + '\')" style="color: #0d6efd; border-color: #0d6efd;" title="Take Photo"><i class="bi bi-camera"></i></div>' +
  '<div class="photo-tile photo-add-tile" onclick="pickFromGalleryDirectly(\'' + escAttr(it.itemId) + '\')" title="Gallery"><i class="bi bi-image"></i></div>' 
  : '';
      
      const numHtml = it.isExtra ? '' : '<span class="item-num">' + esc(label) + '.</span>';

      let extraActions = '';
      if (it.isExtra) {
        extraActions = `
          <div class="d-flex gap-1 ms-2">
            <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="event.stopPropagation(); editExtraItem('${it.itemId}')" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="event.stopPropagation(); deleteExtraItem('${it.itemId}')" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        `;
      }

      itemsHtml += headerHtml + '<div class="check-item" data-item="' + escAttr(it.itemId) + '" data-status="' + escAttr(statusVal) + '"><div class="row-line"><div class="label-part">' + numHtml + '<div class="item-text"><span class="item-name-kh">' + esc(it.itemKhmer) + '</span>' + (it.itemEng ? '<span class="item-name-en">' + esc(it.itemEng) + '</span>' : '') + '</div></div><div class="controls-group">' + extraActions + '<select class="form-select form-select-sm status-select" onchange="setStatus(\'' + escAttr(it.itemId) + '\', this.value)">' + optsHtml + '</select>' + (it.frequency ? '<span class="badge bg-info text-dark" style="font-size:.75rem; padding:4px 8px; margin-left:4px;">' + esc(it.frequency) + '</span>' : '<div class="loc-group" data-item="' + escAttr(it.itemId) + '"><button type="button" class="loc-btn ' + (loc.indexOf('L') !== -1 ? 'loc-on' : '') + '" data-side="L" title="Left" onclick="toggleLocation(\'' + escAttr(it.itemId) + '\', \'L\')">L</button><button type="button" class="loc-btn ' + (loc.indexOf('R') !== -1 ? 'loc-on' : '') + '" data-side="R" title="Right" onclick="toggleLocation(\'' + escAttr(it.itemId) + '\', \'R\')">R</button></div>') + '</div></div><div class="note-row" style="display:' + (showNote ? 'block' : 'none') + ';"><textarea class="form-control form-control-sm js-nok-note" rows="1" placeholder="Describe the issue / បញ្ជាក់បញ្ហា..." oninput="setNokNote(\'' + escAttr(it.itemId) + '\', this.value);autoGrowNote(this)">' + esc(sel.note || '') + '</textarea><div class="item-photo-row mt-2" style="display:' + (showNote ? 'flex' : 'none') + ';">' +
      '<input type="file" accept="image/*" multiple id="photo-input-' + escAttr(it.itemId) + '" style="display:none;" onchange="onItemPhotoPick(\'' + escAttr(it.itemId) + '\', this)">' +
      '<div class="photo-gallery" data-item="' + escAttr(it.itemId) + '">' + photoTiles + addPhotoTile + '</div></div></div></div>';
    }

    // --- 4. Smart Button Injection ---
    // This runs AFTER the item is rendered, so it works for both inline inputs and normal items.
    const nextItem = c.items[index + 1];
    const currIsTruck = isTruckSec(it.itemId);
    const currIsTrailer = isTrailerSec(it.itemId);
    const nextIsTruck = nextItem ? isTruckSec(nextItem.itemId) : false;
    const nextIsTrailer = nextItem ? isTrailerSec(nextItem.itemId) : false;

    // If we are at the end of the Truck items
    if (currIsTruck && !nextIsTruck) {
       itemsHtml += `<div class="mt-2 mb-3"><button class="btn btn-outline-primary w-100" onclick="addExtraRow('Truck')"><i class="bi bi-plus-circle me-1"></i>បន្ថែមផ្នែកផ្សេងទៀត</button></div>`;
    }
    // If we are at the end of the Trailer items
    if (currIsTrailer && !nextIsTrailer) {
       itemsHtml += `<div class="mt-2 mb-3"><button class="btn btn-outline-secondary w-100" onclick="addExtraRow('Trailer')"><i class="bi bi-plus-circle me-1"></i>បន្ថែមផ្នែកផ្សេងទៀត</button></div>`;
    }
  });

  const totalItems = c.items.filter(i => !i.isEditing).length;
  $('#app').html('<div class="container-fluid px-0"><button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelChecklist()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button><div class="card mb-3"><div class="card-body"><h5 class="mb-1">' + esc(c.shortName) + '</h5><div class="small text-muted mb-0">' + esc(c.equipmentId) + ' · ' + esc(c.group) + (APP.equipmentMap[c.equipmentId]?.specificGroup ? ' - ' + esc(APP.equipmentMap[c.equipmentId].specificGroup) : '') + '</div><div class="small text-primary mt-2"><i class="bi bi-person me-1"></i>' + esc(currentUser.fullName) + '</div><div class="small text-muted mt-1"><i class="bi bi-list-check me-1"></i>' + totalItems + ' items' + (c.headers.length ? ' · ' + c.headers.length + ' sections' : '') + '</div></div></div>' + buildInfoForm(c) +
    '<div class="card mb-3 legend-card" style="padding: 12px;"><div class="legend-title" style="text-align: center; font-weight: bold; margin-bottom: 12px;">MONTHLY INSPECTION</div><div class="legend-body" style="text-align: center; font-size: 13px; line-height: 1.8;"><div class="lbl-en mb-2" style="max-width: 100%;"><strong>Acronym:</strong> <span class="acronym">N</span>=Normal, <span class="acronym">UF</span>=Urgent Fixing, <span class="acronym">NF</span>=Need Fixing, <span class="acronym">NA</span>=Need Adjust, <span class="acronym">Ad</span>=Added, <span class="acronym">T</span>=Tightened <span class="d-inline-block ms-2">✓ = Location – (Left or Right)</span></div><div class="lbl-kh" style="max-width: 100%;"><strong>អក្សរកាត់:</strong> N=ធម្មតា, UF=ត្រូវការជួសជុលបន្ទាន់, NF=ត្រូវការជួសជុល, NA=ត្រូវការលៃតម្រូវ, Ad=បានបន្ថែម, T=បានរឹតបន្តឹង <span class="d-inline-block ms-2">✓=បញ្ជាក់អំពីទីតាំង – (ឆ្វេង ឬស្តាំ)</span></div></div></div>' + itemsHtml +
    '<div class="card mt-3"><div class="card-body"><label class="form-label fw-bold">Remark</label><textarea class="form-control form-control-sm" id="checkRemark" rows="2" placeholder="កំណត់សម្គាល់បន្ថែម..."></textarea></div></div><button class="btn btn-primary w-100 mb-4" style="margin-bottom: 100px !important;" onclick="submitChecklistForm()"><i class="bi bi-check-circle me-1"></i>' + (editingCheckId ? 'ធ្វើបច្ចុប្បន្នភាព' : 'បានពិនិត្យរួចរាល់') + '</button></div>');

  initChecklistTrailerData(); initChecklistDriverData(c.group);
  $('.js-nok-note').each(function(){ autoGrowNote(this); });
  if (editingCheckId && c.existingRemark) $('#checkRemark').val(c.existingRemark);
}

window.setStatus = function(itemId, code){
  if (!pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; if (!chk) return;
  if (!code) code = 'N'; chk.status = code;
  const $item = $('.check-item[data-item="'+itemId+'"]');
  $item.attr('data-status', code); $item.find('.status-select').val(code);
  const showNote = code !== 'N';
  $item.find('.note-row').css('display', showNote ? 'block' : 'none');
  $item.find('.item-photo-row').css('display', showNote ? 'flex' : 'none');
  if (!showNote) {
    const chk = pendingChecklist.checks[itemId];
    if (chk && chk.photos && chk.photos.length > 0) { chk.photos = []; $item.find('.photo-gallery').empty(); }
  }
};

window.toggleLocation = function(itemId, side){
  if (!pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; if (!chk) return;
  let loc = chk.location || '';
  if (loc.indexOf(side) !== -1) loc = loc.replace(side, ''); else loc = (loc + side).split('').sort().join('');
  chk.location = loc;
  const $grp = $('.loc-group[data-item="'+itemId+'"]');
  $grp.find('.loc-btn').each(function(){ const btnSide = $(this).attr('data-side'); $(this).toggleClass('loc-on', chk.location.indexOf(btnSide) !== -1); });
};

window.setNokNote = function(itemId, val){ if (!pendingChecklist) return; const chk = pendingChecklist.checks[itemId]; if (chk) chk.note = val; };
window.autoGrowNote = function(el){ if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; };
window.cancelChecklist = function(){ if (confirm('បោះបង់ការត្រួតពិនិត្យ?')) { pendingChecklist = null; editingCheckId = null; showPage('home'); } };

function hasPendingUploads(){
  if (!pendingChecklist) return false;
  for (const itemId of Object.keys(pendingChecklist.checks)) {
    const chk = pendingChecklist.checks[itemId]; if (!chk.photos) continue;
    for (const p of chk.photos) { if (p._uploading || (!p.fileId && p._full)) return true; }
  }
  return false;
}

window.submitChecklistForm = function(){
  if (!pendingChecklist) return;
  const c = pendingChecklist;
  if (hasPendingUploads()) { showLoading('កំពុងបញ្ចូលរូបភាព សូមរង់ចាំ...'); setTimeout(() => { hideLoading(); submitChecklistForm(); }, 900); return; }

  const checks = c.items.map(it => {
    const cc = c.checks[it.itemId] || {};
    const entry = { itemId: it.itemId,itemKhmer: it.itemKhmer, status: cc.status || 'N', location: cc.location || '', note: cc.note || '' };
    const photos = (cc.photos || []).filter(p => p.fileId).map(p => ({ fileId: p.fileId }));
    if (photos.length) entry.photos = photos;
    return entry;
  });

  const overall = checks.every(x => normalizeStatus(x.status) === 'N') ? 'OK' : 'Issues';
  if (!c.form.timeOut) c.form.timeOut = nowTimeStr();
  const payload = { username: currentUser.username, fullName: currentUser.fullName, equipmentId: c.equipmentId, group: c.group, overallStatus: overall, checks: checks, remark: $('#checkRemark').val() || '', form: c.form || {}, assignmentId: c.assignmentId || '' };
  const isEdit = !!editingCheckId;
  if (isEdit) payload.checkId = editingCheckId;

  showLoading('កំពុងរក្សាទុក...');
  const runner = isEdit ? 'updateChecklist' : 'submitChecklist';
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
    const submitNow  = dmyToday(); const submitTime = nowTimeStr();
    let subDate = submitNow; let subTime = submitTime;
    if (isEdit && editingCheckId) { const prev = APP.submissions.find(x => x.checkId === editingCheckId); if (prev) { subDate = prev.date || submitNow; subTime = prev.time || submitTime; } }

    const newSub = { checkId: res.checkId, date: subDate, time: subTime, username: currentUser.username, driverName: currentUser.fullName, equipmentId: c.equipmentId, group: c.group, overall: overall, checks: checks, remark: $('#checkRemark').val() || '', photoIds: [], submittedAt: submitNow + ' ' + submitTime, confirmStatus: 'Pending', confirmedBy: '', confirmedAt: '', confirmRemark: '', timeIn: c.form.timeIn || '', timeOut: c.form.timeOut || '', odometer: c.form.odometer || '', lastOpHour: c.form.lastOpHour || '', previousDate: c.form.previousDate || '', previousOdometer: c.form.previousOdometer || '', previousHour: c.form.previousHour || '', trailerPlateNo: c.form.trailerPlateNo || '', driverUsername: c.form.driverUsername || '', assignmentId: c.assignmentId || '', directorStatus: '', directorBy: '', directorAt: '', directorRemark: '', comments: [], editedAt: '',driverUsername: c.form.driverUsername || '',
      driverConfirmStatus: 'Pending',
      driverConfirmedBy: '',
      driverConfirmedAt: '',
      driverConfirmRemark: '' };

    if (isEdit) {
      const idx = APP.submissions.findIndex(x => x.checkId === editingCheckId);
      if (idx !== -1) {
        const prev = APP.submissions[idx];
        newSub.confirmStatus = prev.confirmStatus; newSub.confirmedBy = prev.confirmedBy; newSub.confirmedAt = prev.confirmedAt; newSub.confirmRemark = prev.confirmRemark; newSub.comments = prev.comments || []; newSub.editedAt = dmyToday() + ' ' + nowTimeStr();
        APP.submissions[idx] = newSub;
      } else { APP.submissions.push(newSub); }
    } else { APP.submissions.push(newSub); }

    if (c.assignmentId) { const a = APP.assignments.find(x => x.assignmentId === c.assignmentId); if (a) { a.status = 'Completed'; a.completedAt = dmyToday() + ' ' + nowTimeStr(); a.handoverCheckId = res.checkId; } }
    showAlert((isEdit ? 'បានធ្វើបច្ចុប្បន្នភាព' : 'ដាក់ស្នើរួចរាល់') + ' — ' + res.checkId, 'success');
    editingCheckId = null; pendingChecklist = null; showPage('home');
  }).withFailureHandler(handleError)[runner](payload);
};

/* =========================================================
   PHOTO PROCESSING & LIGHTBOX
   ========================================================= */
const _WEBP_OK = (function(){ try { const c = document.createElement('canvas'); c.width = 1; c.height = 1; return c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } })();

function processImageFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => { const full = drawAndEncode(img, 1000, 0.68); const thumb = drawAndEncode(img, 96, 0.45); resolve({ full, thumb }); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawAndEncode(img, maxSize, quality){
  let w = img.width, h = img.height;
  if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } } else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  if (_WEBP_OK) { const webp = c.toDataURL('image/webp', quality); if (webp.indexOf('data:image/webp') === 0) return webp; }
  return c.toDataURL('image/jpeg', quality);
}

// Direct Camera Trigger
window.takePhotoDirectly = function(itemId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment'; // Forces camera
  input.style.display = 'none';
  
  input.onchange = function(e) {
    // 1. Send the files to the handler
    handlePhotoSourceSelection(e.target, itemId);
    
    // 2. Safely remove the input AFTER the file is selected
    setTimeout(() => { 
      if (input.parentNode) input.parentNode.removeChild(input); 
    }, 1000);
  };
  
  document.body.appendChild(input);
  input.click();
};

// Direct Gallery Trigger
window.pickFromGalleryDirectly = function(itemId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true; // Allow multiple photos
  input.style.display = 'none';
  
  input.onchange = function(e) {
    handlePhotoSourceSelection(e.target, itemId);
    
    setTimeout(() => { 
      if (input.parentNode) input.parentNode.removeChild(input); 
    }, 1000);
  };
  
  document.body.appendChild(input);
  input.click();
};

// Shared Handler
window.handlePhotoSourceSelection = function(inputEl, itemId) {
  if (!inputEl.files || inputEl.files.length === 0) {
    console.log("No file selected.");
    return;
  }
  
  console.log("File selected successfully. Sending to handler...");
  
  if (itemId === 'DAILY') {
    nokPhotos = Array.from(inputEl.files || []);
    renderCheckPhotos();
  } else if ($('.daily-form-page').length && dailyPhotoBag(itemId)) {
    // Daily checklist / Finished Form item (or one of the extra fuel fields)
    onDailyItemPhotoPick(itemId, inputEl);
  } else {
    onItemPhotoPick(itemId, inputEl);
  }
};

window.onItemPhotoPick = async function(itemId, inputEl){
  const files = Array.from(inputEl.files || []); inputEl.value = '';
  if (files.length === 0 || !pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; if (!chk) return;
  if (!chk.photos) chk.photos = [];
  
  let processed = [];
  try { processed = await Promise.all(files.map(f => processImageFile(f).catch(() => null))); } catch (e) { processed = []; }

  const pushed = [];
  processed.forEach(p => { 
    if (!p) return; 
    const entry = { fileId: '', thumb: p.thumb, _full: p.full, _uploading: true }; 
    chk.photos.push(entry); 
    pushed.push(entry); 
  });
  
  renderItemPhotoPreviews(itemId);
  if (pushed.length === 0) return;

  const payload = pushed.map((p, i) => ({ itemId: itemId, idx: chk.photos.length - pushed.length + i, dataUrl: p._full }));
  
  const clearUploading = () => {
    pushed.forEach(p => { 
      if (!p.fileId) {
        const idx = chk.photos.indexOf(p);
        if (idx > -1) chk.photos.splice(idx, 1);
      }
      delete p._full; 
      delete p._uploading; 
    });
    renderItemPhotoPreviews(itemId);
  };

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success && res.photoIds) {
        pushed.forEach((p, i) => { 
          const key = itemId + '|' + payload[i].idx; 
          const id = res.photoIds[key]; 
          if (id) { p.fileId = id; } 
        });
      }
      clearUploading();
    })
    .withFailureHandler(() => { clearUploading(); })
    .uploadChecklistPhotos({ checkId: editingCheckId || 'NEW', photos: payload });
};

function renderItemPhotoPreviews(itemId){
  if (!pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; if (!chk) return;
  const photos = chk.photos || [];
  const $container = $('.photo-gallery[data-item="' + itemId + '"]'); if (!$container.length) return;
  const tiles = photos.map((p, idx) => {
    const src = photoSrc(p, 200); const uploading = p._uploading;
    return '<div class="photo-tile" data-photo-idx="' + idx + '" onclick="openLightboxFromForm(\'' + escAttr(itemId) + '\',' + idx + ')">' + (src ? '<img src="' + src + '" loading="lazy" decoding="async" alt="">' : '<div style="width:90px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;"><i class="bi bi-image"></i></div>') + (uploading ? '<div class="photo-uploading-spinner"><div class="spinner-border spinner-border-sm text-light"></div></div>' : '') + '<button type="button" class="photo-remove-btn" onclick="event.stopPropagation();removeItemPhoto(\'' + escAttr(itemId) + '\',' + idx + ')">×</button></div>';
  }).join('');

    const addTile = (photos.length < 10) ? 
    '<div class="photo-tile photo-add-tile" onclick="takePhotoDirectly(\'' + itemId + '\')" style="color: #0d6efd; border-color: #0d6efd;" title="Take Photo"><i class="bi bi-camera"></i></div>' +
    '<div class="photo-tile photo-add-tile" onclick="pickFromGalleryDirectly(\'' + itemId + '\')" title="Gallery"><i class="bi bi-image"></i></div>' 
    : '';
  
  $container.html(tiles + addTile);
}

window.removeItemPhoto = function(itemId, idx){ if (!pendingChecklist) return; const chk = pendingChecklist.checks[itemId]; if (!chk || !chk.photos) return; chk.photos.splice(idx, 1); renderItemPhotoPreviews(itemId); };

const _photoCache = {};

// ★ RESTORED: This was missing, causing the error
window.openLightboxFromForm = function(itemId, startIndex){
  if (!pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; 
  if (!chk || !chk.photos || chk.photos.length === 0) return;
  const photos = chk.photos.map(p => { 
    const isRealDataUrl = p.dataUrl && p.dataUrl.indexOf('data:') === 0 && p.dataUrl.length > 5000; 
    return { fileId: p.fileId || '', dataUrl: p._full || (isRealDataUrl ? p.dataUrl : '') }; 
  });
  openLightbox(photos, startIndex);
};

window.toggleItemPhoto = function(itemId, el){
  const $reveal = $('.item-photo-reveal[data-item="' + itemId + '"]'); 
  if (!$reveal.length) return;
  if ($reveal.data('loaded')) { $reveal.slideToggle(120); return; }
  
  const dataStr = $reveal.attr('data-photo-data') || '[]'; 
  let photos = []; 
  try { photos = JSON.parse(dataStr); } catch (e) {}
  if (!photos.length) return;
  
  $reveal.html('<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>').show();
  
  const tiles = photos.map((p, i) => { 
    const src = p.thumb || driveThumbUrl(p.fileId, 400); 
    return '<div class="photo-tile" data-idx="' + i + '" onclick="event.stopPropagation();openLightboxByIdsFromData(\'' + escAttr(dataStr.replace(/'/g, "\\'")) + '\',' + i + ')"><img src="' + src + '" loading="lazy" decoding="async" alt="" style="opacity:0; transition:opacity 0.3s;" onload="this.style.opacity=1;"></div>'; 
  }).join('');
  
  $reveal.html('<div class="photo-gallery mt-2">' + tiles + '</div>'); 
  $reveal.data('loaded', true);
};

window.openLightboxByIdsFromData = function(dataStr, startIndex){ let photos = []; try { photos = JSON.parse(dataStr); } catch (e) {} const mapped = photos.map(p => ({ fileId: p.fileId || '', dataUrl: p.thumb || '' })); openLightbox(mapped, startIndex); };
window.openLightboxByIds = function(idsCsv, startIndex){ const ids = String(idsCsv || '').split(',').map(s => s.trim()).filter(Boolean); const photos = ids.map(id => ({ fileId: id, dataUrl: _photoCache[id] || '' })); openLightbox(photos, startIndex); };

// ★ SINGLE DEFINITION: Removed the duplicate to prevent flashing
window.openLightbox = function(photos, startIndex){
  if (!photos || photos.length === 0) return;
  startIndex = startIndex || 0;
  let $lb = $('#photoLightbox');
  
  if (!$lb.length) {
    $lb = $('<div id="photoLightbox"><div class="lb-topbar"><div class="lb-counter"></div><button type="button" class="lb-close" onclick="closeLightbox()">&times;</button></div><button type="button" class="lb-nav prev" onclick="lbPrev()">&#8249;</button><button type="button" class="lb-nav next" onclick="lbNext()">&#8250;</button><div class="lb-stage"><img class="lb-img" alt=""><div class="lb-spinner" style="display:none;"><div class="spinner-border text-light" role="status"></div></div></div><div class="lb-thumbs"></div></div>').appendTo('body');
    
    $lb.find('.lb-stage').on('click', function(e){ if (e.target === this || e.target.classList.contains('lb-img') === false && $(e.target).closest('.lb-nav').length === 0) { const img = $lb.find('.lb-img')[0]; if (e.target !== img) closeLightbox(); } });
    $(document).on('keydown.lightbox', function(e){ if (!$('#photoLightbox').hasClass('show')) return; if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowLeft') lbPrev(); else if (e.key === 'ArrowRight') lbNext(); });
    
    let _sx = 0, _sy = 0, _dx = 0; const stage = $lb.find('.lb-stage')[0];
    stage.addEventListener('touchstart', e => { const t = e.touches[0]; _sx = t.clientX; _sy = t.clientY; _dx = 0; }, { passive: true });
    stage.addEventListener('touchmove', e => { const t = e.touches[0]; _dx = t.clientX - _sx; if (Math.abs(t.clientY - _sy) > Math.abs(_dx)) _dx = 0; }, { passive: true });
    stage.addEventListener('touchend', () => { if (Math.abs(_dx) > 40) { if (_dx < 0) lbNext(); else lbPrev(); } _dx = 0; });
  }
  
  // ★ Hide old image and show spinner immediately
  $lb.find('.lb-img').attr('src', '').hide();
  $lb.find('.lb-spinner').show();

  $lb.data('photos', photos); 
  $lb.data('index', startIndex);
  $lb.addClass('show'); 
  if (photos.length > 1) $lb.addClass('has-multiple'); else $lb.removeClass('has-multiple');
  
  lbRenderThumbs(); 
  lbShow(startIndex);
};

window.closeLightbox = function(){ 
  const $lb = $('#photoLightbox');
  $lb.removeClass('show'); 
  $lb.find('.lb-img').attr('src', ''); 
};

function lbShow(index){
  const $lb = $('#photoLightbox'); 
  const photos = $lb.data('photos') || [];
  if (photos.length === 0) return;
  if (index < 0) index = photos.length - 1; 
  if (index >= photos.length) index = 0;
  
  $lb.data('index', index);
  
  const p = photos[index]; 
  const $img = $lb.find('.lb-img'); 
  const $spinner = $lb.find('.lb-spinner');
  
  $lb.find('.lb-counter').text((index + 1) + ' / ' + photos.length); 
  $lb.find('.lb-thumb').removeClass('active'); 
  $lb.find('.lb-thumb[data-idx="' + index + '"]').addClass('active');
  
  let src = p.dataUrl || _photoCache[p.fileId] || ''; 
  if (!src && p.fileId) src = driveFullUrl(p.fileId, 1600);
  
  if (src) { 
    $img.hide(); 
    $spinner.show().html('<div class="spinner-border text-light" role="status"></div>');
    
    const tempImg = new Image();
    tempImg.onload = () => {
      $spinner.hide();
      $img.attr('src', src).show(); 
    };
    tempImg.onerror = () => {
      $spinner.show().html('<i class="bi bi-x-circle me-2"></i>Failed to load');
    };
    tempImg.src = src;
    
  } else { 
    $img.hide(); 
    $spinner.show().html('<i class="bi bi-x-circle me-2"></i>Not available'); 
    return; 
  }
  
  [index - 1, index + 1].forEach(i => { 
    const q = photos[(i + photos.length) % photos.length]; 
    if (!q || !q.fileId) return; 
    const pre = new Image(); 
    pre.src = driveFullUrl(q.fileId, 1600); 
  });
}

window.lbPrev = function(){ const $lb = $('#photoLightbox'); lbShow(($lb.data('index') || 0) - 1); };
window.lbNext = function(){ const $lb = $('#photoLightbox'); lbShow(($lb.data('index') || 0) + 1); };

function lbRenderThumbs(){
  const $lb = $('#photoLightbox'); const photos = $lb.data('photos') || []; const strip = $lb.find('.lb-thumbs');
  if (photos.length <= 1) { strip.empty(); return; }
  const html = photos.map((p, i) => { const src = p.fileId ? driveThumbUrl(p.fileId, 100) : (p.dataUrl || _photoCache[p.fileId] || ''); return '<div class="lb-thumb" data-idx="' + i + '" onclick="lbShow(' + i + ')">' + (src ? '<img src="' + src + '" loading="lazy" decoding="async" alt="">' : '<div style="width:100%;height:100%;background:#444;"></div>') + '</div>'; }).join('');
  strip.html(html); $lb.find('.lb-thumb[data-idx="' + ($lb.data('index') || 0) + '"]').addClass('active');
}

window.addExtraItem = function(type) {
  const name = prompt("Enter the extra item name (e.g., Broken Mirror):");
  if (!name || !name.trim()) return;
  
  const sectionId = type === 'Truck' ? 'EXT-TRK' : 'EXT-TRL';
  const itemId = sectionId + '-' + Date.now();
  
  // Create the header for the extra section
  if (!pendingChecklist.headerBySection[sectionId]) {
    pendingChecklist.headerBySection[sectionId] = {
      itemId: sectionId,
      itemKhmer: type === 'Truck' ? 'ផ្នែកផ្សេងៗទៀត' : 'ផ្នែកផ្សេងៗទៀត',
      itemEng: type === 'Truck' ? 'Others' : 'Others',
      inputType: 'header'
    };
  }

  // Add the custom item to the list
  pendingChecklist.items.push({
    itemId: itemId,
    itemKhmer: name.trim(),
    itemEng: '',
    inputType: 'oknotok',
    isExtra: true
  });
  
  // Initialize its check state
  pendingChecklist.checks[itemId] = { itemId: itemId, status: 'N', location: '', note: '', photos: [] };
  
  renderChecklistForm(); // Re-render the form
};

window.addExtraRow = function(type) {
  const sectionId = type === 'Truck' ? 'EXT-TRK' : 'EXT-TRL';
  
  if (!pendingChecklist.headerBySection[sectionId]) {
    pendingChecklist.headerBySection[sectionId] = {
      itemId: sectionId,
      itemKhmer: type === 'Truck' ? 'ផ្នែកផ្សេងៗទៀត' : 'ផ្នែកផ្សេងៗទៀត',
      itemEng: type === 'Truck' ? 'Others' : 'Others',
      inputType: 'header'
    };
  }

  const tempId = sectionId + '-' + Date.now();
  const newItem = { itemId: tempId, itemKhmer: '', itemEng: '', inputType: 'oknotok', isExtra: true, isEditing: true, isNew: true };
  
  // Just push to the end. The sorting logic in renderChecklistForm will place it correctly.
  pendingChecklist.items.push(newItem);
  
  pendingChecklist.checks[tempId] = { itemId: tempId, status: 'N', location: '', note: '', photos: [] };
  renderChecklistForm();
  
  setTimeout(() => { const el = document.getElementById('extra-input-' + tempId); if (el) el.focus(); }, 100);
};

window.saveExtraItem = function(itemId, name) {
  if (!name || !name.trim()) {
    // If empty, remove the item completely
    pendingChecklist.items = pendingChecklist.items.filter(i => i.itemId !== itemId);
    delete pendingChecklist.checks[itemId];
  } else {
    const it = pendingChecklist.items.find(i => i.itemId === itemId);
    if (it) { 
      it.itemKhmer = name.trim(); 
      it.isEditing = false; 
      it.isNew = false; // ★ Mark as no longer new
    }
  }
  renderChecklistForm();
};

window.cancelExtraItem = function(itemId) {
  const it = pendingChecklist.items.find(i => i.itemId === itemId);
  if (!it) return;
  
  if (it.isNew) {
    // If it was just created and empty, delete it
    pendingChecklist.items = pendingChecklist.items.filter(i => i.itemId !== itemId);
    delete pendingChecklist.checks[itemId];
  } else {
    // If it's an existing item, just exit edit mode without changing the name
    it.isEditing = false;
  }
  renderChecklistForm();
};

window.editExtraItem = function(itemId) {
  const it = pendingChecklist.items.find(i => i.itemId === itemId);
  if (it) {
    it.isEditing = true;
    renderChecklistForm();
    setTimeout(() => { const el = document.getElementById('extra-input-' + itemId); if (el) { el.focus(); el.select(); } }, 100);
  }
};

window.deleteExtraItem = function(itemId) {
  if (!confirm('Are you sure you want to delete this extra item?')) return;
  pendingChecklist.items = pendingChecklist.items.filter(i => i.itemId !== itemId);
  delete pendingChecklist.checks[itemId];
  renderChecklistForm();
};



/*ScriptChecklistFCC*/

/* =========================================================
   CHECKLIST FORM (TCC & FCC VERSION)
   ========================================================= */
window.activeFrequencies = ['M', '3M', '6M', '1Y'];

window.startChecklistFCC = function(equipmentId, group, shortName, driverUsername, assignmentId){ 
  loadAndRenderChecklistFormFCC(equipmentId, group, shortName, driverUsername, assignmentId, null); 
};

function loadAndRenderChecklistFormFCC(equipmentId, group, shortName, driverUsername, assignmentId, existingSub){
  const eqData = APP.equipmentMap[equipmentId] || {};
  const sg = eqData.specificGroup || '';
  const raw = APP.templates[group + '|' + sg] || APP.templates[group + '|'] || APP.templates[group] || [];
  
  const headers = raw.filter(it => String(it.inputType).toLowerCase() === 'header');
  const items   = raw.filter(it => String(it.inputType).toLowerCase() !== 'header');
  if (items.length === 0) { showAlert('No template for group: '+group, 'danger'); return; }

  const headerBySection = {};
  headers.forEach(h => { headerBySection[String(h.itemId).trim()] = h; });
  const prevSub = (APP.submissions || []).filter(s => s.equipmentId === equipmentId).sort((a, b) => subMs(b) - subMs(a))[0] || null;
  const isEdit = !!existingSub;

  // Reset filters to all active when loading a checklist
  window.activeFrequencies = ['M', '3M', '6M', '1Y'];

  let formDefaults, checksInit;
  if (isEdit) {
    const s = existingSub;
    formDefaults = { 
      date: isoDate(parseDmyToDate(s.date)), 
      timeIn: s.timeIn || s.time || '', 
      timeOut: s.timeOut || '', 
      lastOpHour: s.lastOpHour || '', 
      previousDate: s.previousDate || '', 
      previousHour: s.previousHour || '',
      customer: s.customer || eqData.companyName || '',
      reportNo: s.reportNo || '',
      driverUsername: s.driverUsername || driverUsername || ''
    };
    
    checksInit = {};
    
    // 👇 1. Reconstruct activeFrequencies from the saved data 👇
    const savedFreqs = new Set();
    items.forEach(it => {
      const savedChk = (s.checks || []).find(c => c.itemId === it.itemId);
      if (savedChk) {
        // If the item has a status, its frequency was active
        if (savedChk.status && String(savedChk.status).trim() !== '') {
           const f = String(it.frequency || '').trim().toUpperCase();
           if (f) savedFreqs.add(f);
        }
      }
    });
    
    // If savedFreqs is empty, default to all
    window.activeFrequencies = savedFreqs.size > 0 ? Array.from(savedFreqs) : ['M', '3M', '6M', '1Y'];

    // 👇 2. Initialize checks based on the reconstructed active frequencies 👇
    items.forEach(it => { 
      const freq = String(it.frequency || '').trim().toUpperCase();
      const isActive = !freq || window.activeFrequencies.includes(freq);
      
      const savedChk = (s.checks || []).find(c => c.itemId === it.itemId);
      
      let photos = [];
      if (savedChk) {
        if (Array.isArray(savedChk.photos)) photos = savedChk.photos.map(p => ({ fileId: p.fileId || '', thumb: p.thumb || '', dataUrl: p.dataUrl || '' }));
        else if (Array.isArray(savedChk.photoIds)) photos = savedChk.photoIds.map(id => ({ fileId: id }));
        else if (savedChk.photoId) photos = [{ fileId: savedChk.photoId }];
        else if (savedChk.photoData) photos = [{ dataUrl: savedChk.photoData }];
      }

      checksInit[it.itemId] = { 
        itemId: it.itemId, 
        status: isActive ? (savedChk ? (normalizeStatus(savedChk.status) || 'N') : 'N') : '', 
        note: savedChk ? (savedChk.note || '') : '', 
        photos: photos 
      }; 
    });
  } else {
    formDefaults = { 
      date: isoDate(new Date()), 
      timeIn: nowTimeStr(), 
      timeOut: '', 
      lastOpHour: '', 
      previousDate: prevSub ? isoDate(parseDmyToDate(prevSub.date)) : '', 
      previousHour: prevSub ? (prevSub.lastOpHour || '') : '',
      customer: eqData.companyName || '', // 👈 AUTOMATICALLY POPULATE COMPANY NAME HERE
      reportNo: '',
      driverUsername: driverUsername || ''
    };
    checksInit = {};
    items.forEach(it => { 
      const freq = String(it.frequency || '').toUpperCase();
      const isActive = !freq || window.activeFrequencies.includes(freq);
      checksInit[it.itemId] = { itemId: it.itemId, status: isActive ? 'N' : '', note: '', photos: [] }; 
    });
  }

  pendingChecklist = { equipmentId: equipmentId, group: group, shortName: shortName, headers: headers.slice(), headerBySection: headerBySection, items: items.slice(), checks: checksInit, form: formDefaults, assignmentId: assignmentId || '', existingRemark: isEdit ? (existingSub.remark || '') : '' };
  editingCheckId = isEdit ? existingSub.checkId : null;
  renderChecklistFormFCC();
  if (isEdit) setTimeout(() => { applyFreqFilter(); }, 50); 
  if (isEdit) setTimeout(() => { $('#checkRemark').val(existingSub.remark || ''); }, 30);
}

function buildInfoFormFCC(c){
  const f = c.form || {};
  const todayDisplay   = formatIsoToDmy(f.date || isoDate(new Date()));
  const timeInDisplay  = f.timeIn  || nowTimeStr();
  const timeOutDisplay = f.timeOut || '';
  if (!f.date)   c.form.date   = isoDate(new Date());
  if (!f.timeIn) c.form.timeIn = timeInDisplay;

  // Get the equipment data (for Serial Number)
  const eqData = APP.equipmentMap[c.equipmentId] || {};
  const serialNo = eqData.serialNumber || '';

  // Driver logic
  const currentDriverUsername = f.driverUsername || '';
  const currentDriver = (APP.drivers || []).find(d => d.username === currentDriverUsername);
  const currentDriverLabel = currentDriver ? (currentDriver.fullName + ' (@' + currentDriver.username + ')') : currentDriverUsername;

  const col = (label, inner) => '<div class="col-6 col-md-4"><label class="form-label small fw-bold mb-1">' + esc(label) + '</label>' + inner + '</div>';

  return '<div class="card mb-3 info-card"><div class="card-body"><h6 class="mb-3"><i class="bi bi-clipboard-data text-primary me-2"></i>Inspection Info</h6><div class="row g-2">' +
    col('កាលបរិច្ឆេទ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(todayDisplay) + '" readonly>') +
    col('ម៉ោងចាប់ផ្ដើម', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(timeInDisplay) + '" readonly>') +
    col('ម៉ោងបញ្ចប់', '<input type="text" class="form-control form-control-sm bg-light" id="fldTimeOutDisplay" value="' + escAttr(timeOutDisplay) + '" placeholder="Set on submit" readonly>') +
    
    col('អតិថិជន', '<input type="text" class="form-control form-control-sm" value="' + escAttr(f.customer || '') + '" placeholder="បញ្ចូលអតិថិជន..." oninput="onFormChange(\'customer\', this.value)">') +
    col('ប្រភេទគ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(c.group) + '" readonly>') +
    col('លេខ​គ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(c.shortName) + '" readonly>') +
    
    // ★ ADDED SERIAL NUMBER HERE ★
    col('លេខកូដ​គ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(serialNo) + '" readonly>') +
    
    col('ម៉ោងគ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm" id="fldLastOpHour" value="' + escAttr(f.lastOpHour || '') + '" placeholder="e.g. 340" oninput="onFormChange(\'lastOpHour\', this.value)">') +
    col('អ្នកត្រួតពិនិត្យ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(currentUser.fullName) + '" readonly>') +
    
    // Driver Dropdown
    col('អ្នកបើកបរ (Driver)', '<div style="position:relative;"><input type="text" class="form-control form-control-sm" id="fldDriverSearch" placeholder="ស្វែងរកអ្នកបើកបរ..." autocomplete="off" value="' + escAttr(currentDriverLabel) + '" oninput="onChecklistDriverInput(this.value)" onfocus="showChecklistDriverDropdown()" onblur="hideChecklistDriverDropdown()"><input type="hidden" id="fldDriver" value="' + escAttr(currentDriverUsername) + '"><div id="checklistDriverDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:300px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div></div>') +
    
    col('របាយការណ៍លេខ', '<input type="text" class="form-control form-control-sm" value="' + escAttr(f.reportNo || '') + '" placeholder="បញ្ចូលលេខរៀង..." oninput="onFormChange(\'reportNo\', this.value)">') +
    '</div><hr class="my-3"><div class="small text-muted mb-2">Previous values (from last check)</div><div class="row g-2">' +
    col('PREVIOUS DATE', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousDate || '—') + '" readonly>') +
    col('PREVIOUS HOUR', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousHour || '—') + '" readonly>') +
    '</div></div></div>';
}

window.toggleFreq = function(freq) {
  if (freq === 'All') {
    if (window.activeFrequencies.length === 4) window.activeFrequencies = [];
    else window.activeFrequencies = ['M', '3M', '6M', '1Y'];
  } else {
    if (window.activeFrequencies.length === 4) {
      window.activeFrequencies = [freq];
    } else {
      if (window.activeFrequencies.includes(freq)) {
        window.activeFrequencies = window.activeFrequencies.filter(f => f !== freq);
      } else {
        window.activeFrequencies.push(freq);
      }
    }
  }
  applyFreqFilter();
};

window.applyFreqFilter = function() {
  const isAll = window.activeFrequencies.length === 4;
  
  $('.freq-btn').each(function() {
    const f = $(this).attr('data-freq');
    if (f === 'All') {
      $(this).toggleClass('btn-secondary', isAll).toggleClass('btn-outline-secondary', !isAll);
    } else {
      const isActive = window.activeFrequencies.includes(f);
      $(this).toggleClass('btn-primary', isActive).toggleClass('btn-outline-primary', !isActive);
    }
  });

  if (!pendingChecklist) return;
  
  pendingChecklist.items.forEach(it => {
    const freq = String(it.frequency || '').toUpperCase();
    const isActive = !freq || window.activeFrequencies.some(af => af.toUpperCase() === freq);
    const $row = $(`.check-item[data-item="${it.itemId}"]`);
    
    if (isActive) {
      $row.slideDown(150);
      if (!pendingChecklist.checks[it.itemId].status) {
        pendingChecklist.checks[it.itemId].status = 'N';
        $row.find('.status-select').val('N');
      }
    } else {
      $row.slideUp(150);
      pendingChecklist.checks[it.itemId].status = '';
    }
  });
};

function renderChecklistFormFCC(){
  const c = pendingChecklist;
  let lastSectionShown = '__none__'; let globalNum = 0; let itemsHtml = '';

  // ★ 1. ADDED THE NEW STATUS OPTIONS HERE
  const fccStatusOptions = [
    { code: 'N' }, { code: 'UF' }, { code: 'NF' }, { code: 'NA' }, 
    { code: 'Ad' }, { code: 'T' }, { code: 'C' }, { code: '✓' }, { code: 'X' }
  ];

  c.items.forEach((it) => {
    const sec = sectionOf(it.itemId);
    let headerHtml = '';

    if (sec) {
      if (sec !== lastSectionShown) {
        lastSectionShown = sec;
        const h = (c.headerBySection || {})[sec];
        if (h) {
          let headerTitle = h.itemKhmer;
          if (!headerTitle.startsWith(sec + '.')) {
            headerTitle = '<span class="sec-num">' + esc(sec) + '.</span>' + esc(headerTitle);
          }
          headerHtml = '<div class="section-divider"><div class="sec-kh">' + headerTitle + '</div>' + (h.itemEng ? '<div class="sec-en">' + esc(h.itemEng) + '</div>' : '') + '</div>';
        }
      }
    }

    globalNum++; 
    let label = globalNum;

    const freq = String(it.frequency || '').toUpperCase();
    const isActive = !freq || window.activeFrequencies.includes(freq);
    const displayStyle = isActive ? '' : 'style="display:none;"';
    
    const sel       = c.checks[it.itemId] || { status: isActive ? 'N' : '', note: '', photos: [] };
    const statusVal = isActive ? (normalizeStatus(sel.status) || 'N') : '';
    const showNote  = statusVal !== 'N' && statusVal !== '';
    const photos    = sel.photos || [];

    // Use the new FCC status options
    const optsHtml = fccStatusOptions.map(o =>
      '<option value="' + escAttr(o.code) + '"' + (statusVal === o.code ? ' selected' : '') + '>' + esc(o.code) + '</option>'
    ).join('');

    const photoTiles = photos.map((p, idx) => {
      const src = photoSrc(p, 200);
      return '<div class="photo-tile" data-photo-idx="' + idx + '" onclick="openLightboxFromForm(\'' + escAttr(it.itemId) + '\',' + idx + ')">' + (src ? '<img src="' + src + '" loading="lazy" decoding="async" alt="">' : '<div style="width:90px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;"><i class="bi bi-image"></i></div>') + '<button type="button" class="photo-remove-btn" onclick="event.stopPropagation();removeItemPhoto(\'' + escAttr(it.itemId) + '\',' + idx + ')">×</button></div>';
    }).join('');

    const addPhotoTile = (photos.length < 10) ? 
  '<div class="photo-tile photo-add-tile" onclick="takePhotoDirectly(\'' + escAttr(it.itemId) + '\')" style="color: #0d6efd; border-color: #0d6efd;" title="Take Photo"><i class="bi bi-camera"></i></div>' +
  '<div class="photo-tile photo-add-tile" onclick="pickFromGalleryDirectly(\'' + escAttr(it.itemId) + '\')" title="Gallery"><i class="bi bi-image"></i></div>' 
  : '';

    itemsHtml += headerHtml + '<div class="check-item" data-item="' + escAttr(it.itemId) + '" data-freq="' + escAttr(freq) + '" data-status="' + escAttr(statusVal) + '" ' + displayStyle + '><div class="row-line"><div class="label-part"><span class="item-num">' + esc(label) + '.</span><div class="item-text"><span class="item-name-kh">' + esc(it.itemKhmer) + '</span>' + (it.itemEng ? '<span class="item-name-en">' + esc(it.itemEng) + '</span>' : '') + '</div></div><div class="controls-group">' + 
      '<select class="form-select form-select-sm status-select" onchange="setStatus(\'' + escAttr(it.itemId) + '\', this.value)">' + optsHtml + '</select>' + 
      (it.frequency ? '<span class="badge bg-info text-dark" style="font-size:.75rem; padding:4px 8px; margin-left:4px;">' + esc(it.frequency) + '</span>' : '') + 
    '</div></div><div class="note-row" style="display:' + (showNote ? 'block' : 'none') + ';"><textarea class="form-control form-control-sm js-nok-note" rows="1" placeholder="Describe the issue / បញ្ជាក់បញ្ហា..." oninput="setNokNote(\'' + escAttr(it.itemId) + '\', this.value);autoGrowNote(this)">' + esc(sel.note || '') + '</textarea><div class="item-photo-row mt-2" style="display:' + (showNote ? 'flex' : 'none') + ';"><input type="file" accept="image/*" multiple id="photo-input-' + escAttr(it.itemId) + '" style="display:none;" onchange="onItemPhotoPick(\'' + escAttr(it.itemId) + '\', this)"><div class="photo-gallery" data-item="' + escAttr(it.itemId) + '">' + photoTiles + addPhotoTile + '</div></div></div></div>';
  });

  // ★ 2. REDESIGNED THE FILTER BLOCK UI
  const freqFilterHtml = `
    <div class="card mb-3 shadow-sm" style="border: 2px solid #0056b3; overflow: hidden;">
      <!-- Header -->
      <div class="text-center fw-bold text-white" style="background: #0056b3; padding: 10px; font-size: 1.1rem;">
        តារាងត្រួតពិនិត្យជាប្រចាំ
      </div>
      <!-- Legend Body -->
      <div class="text-center py-3 px-2" style="background: #eef5fb; color: #000; font-size: 0.95rem; line-height: 1.8;">
        <span class="fw-bold text-primary mb-2 d-block">អក្សរកាត់:</span>
        <span class="mx-2"><span class="badge bg-secondary">N</span> = ធម្មតា</span>
        <span class="mx-2"><span class="badge bg-secondary">UF</span> = ត្រូវការជួសជុលបន្ទាន់</span><br>
        <span class="mx-2"><span class="badge bg-secondary">NF</span> = ត្រូវការជួសជុល (អាចប្រើប្រាស់បណ្តោះអាសន្នបាន)</span>
        <span class="mx-2"><span class="badge bg-secondary">NA</span> = ត្រូវការតម្រូវ</span><br>
        <span class="mx-2"><span class="badge bg-secondary">Ad</span> = បានបន្ថែម</span>
        <span class="mx-2"><span class="badge bg-secondary">T</span> = បានរឹតបន្តឹង</span>
        <span class="mx-2"><span class="badge bg-secondary">C</span> = បានសំអាត</span>
        <span class="mx-2"><span class="badge bg-secondary">✓</span> = ត្រឹមត្រូវ</span>
        <span class="mx-2"><span class="badge bg-secondary">X</span> = មិនត្រឹមត្រូវ</span>
      </div>
      <!-- Filter Buttons -->
      <div class="d-flex align-items-center flex-wrap gap-2 p-3 border-top" style="background: #fff;">
        <span class="fw-bold small text-primary me-2"><i class="bi bi-funnel-fill"></i> Filter:</span>
        
        <button type="button" class="btn btn-sm btn-primary freq-btn rounded-pill px-3" data-freq="M" onclick="toggleFreq('M')">M</button>
        <button type="button" class="btn btn-sm btn-primary freq-btn rounded-pill px-3" data-freq="3M" onclick="toggleFreq('3M')">3M</button>
        <button type="button" class="btn btn-sm btn-primary freq-btn rounded-pill px-3" data-freq="6M" onclick="toggleFreq('6M')">6M</button>
        <button type="button" class="btn btn-sm btn-primary freq-btn rounded-pill px-3" data-freq="1Y" onclick="toggleFreq('1Y')">1Y</button>
        
        <button type="button" class="btn btn-sm btn-secondary freq-btn rounded-pill px-3 ms-auto" onclick="toggleFreq('All')">All</button>
      </div>
    </div>
  `;

  const totalItems = c.items.length;
  $('#app').html('<div class="container-fluid px-0"><button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelChecklist()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button><div class="card mb-3"><div class="card-body"><h5 class="mb-1">' + esc(c.shortName) + '</h5><div class="small text-muted mb-0">' + esc(c.equipmentId) + ' · ' + esc(c.group) + (APP.equipmentMap[c.equipmentId]?.specificGroup ? ' - ' + esc(APP.equipmentMap[c.equipmentId].specificGroup) : '') + '</div><div class="small text-primary mt-2"><i class="bi bi-person me-1"></i>' + esc(currentUser.fullName) + '</div><div class="small text-muted mt-1"><i class="bi bi-list-check me-1"></i>' + totalItems + ' items' + (c.headers.length ? ' · ' + c.headers.length + ' sections' : '') + '</div></div></div>' + buildInfoFormFCC(c) +
    freqFilterHtml + itemsHtml +
    '<div class="card mt-3"><div class="card-body"><label class="form-label fw-bold">Remark</label><textarea class="form-control form-control-sm" id="checkRemark" rows="2" placeholder="កំណត់សម្គាល់បន្ថែម..."></textarea></div></div><button class="btn btn-primary w-100 mb-4" style="margin-bottom: 100px !important;" onclick="submitChecklistFormFCC()"><i class="bi bi-check-circle me-1"></i>' + (editingCheckId ? 'ធ្វើបច្ចុប្បន្នភាព' : 'បានពិនិត្យរួចរាល់') + '</button></div>');

  $('.js-nok-note').each(function(){ autoGrowNote(this); });
  if (editingCheckId && c.existingRemark) $('#checkRemark').val(c.existingRemark);
  initChecklistDriverData(c.group); 
}

window.submitChecklistFormFCC = function(){
  if (!pendingChecklist) return;
  const c = pendingChecklist;
  if (hasPendingUploads()) { showLoading('កំពុងបញ្ចូលរូបភាព សូមរង់ចាំ...'); setTimeout(() => { hideLoading(); submitChecklistFormFCC(); }, 900); return; }

  const checks = c.items.map(it => {
    const cc = c.checks[it.itemId] || {};
    const freq = String(it.frequency || '').toUpperCase();
    const isActive = !freq || window.activeFrequencies.some(af => af.toUpperCase() === freq) || window.activeFrequencies.length === 4;
    
    let status = '';
    let note = '';
    let photos = [];

    if (isActive) {
      status = cc.status || 'N';
      note = cc.note || '';
      photos = (cc.photos || []).filter(p => p.fileId).map(p => ({ fileId: p.fileId }));
    }

    const entry = { itemId: it.itemId, status: status, note: note };
    if (photos.length) entry.photos = photos;
    return entry;
  });

  const activeChecks = checks.filter(x => x.status && x.status !== '');
  const overall = activeChecks.length === 0 || activeChecks.every(x => normalizeStatus(x.status) === 'N') ? 'OK' : 'Issues';
  
  if (!c.form.timeOut) c.form.timeOut = nowTimeStr();
  
  const payload = { 
    username: currentUser.username, 
    fullName: currentUser.fullName, 
    equipmentId: c.equipmentId, 
    group: c.group, 
    overallStatus: overall, 
    checks: checks, 
    remark: $('#checkRemark').val() || '', 
    form: c.form || {}, 
    assignmentId: c.assignmentId || '' 
  };
  
  const isEdit = !!editingCheckId;
  if (isEdit) payload.checkId = editingCheckId;

  showLoading('កំពុងរក្សាទុក...');
  const runner = isEdit ? 'updateChecklist' : 'submitChecklist';
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
    const submitNow  = dmyToday(); const submitTime = nowTimeStr();
    let subDate = submitNow; let subTime = submitTime;
    if (isEdit && editingCheckId) { const prev = APP.submissions.find(x => x.checkId === editingCheckId); if (prev) { subDate = prev.date || submitNow; subTime = prev.time || submitTime; } }

    const newSub = { 
      checkId: res.checkId, 
      date: subDate, 
      time: subTime, 
      username: currentUser.username, 
      driverName: currentUser.fullName, 
      equipmentId: c.equipmentId, 
      group: c.group, 
      overall: overall, 
      checks: checks, 
      remark: $('#checkRemark').val() || '', 
      photoIds: [], 
      submittedAt: submitNow + ' ' + submitTime, 
      confirmStatus: 'Pending', 
      confirmedBy: '', 
      confirmedAt: '', 
      confirmRemark: '', 
      timeIn: c.form.timeIn || '', 
      timeOut: c.form.timeOut || '', 
      lastOpHour: c.form.lastOpHour || '', 
      previousDate: c.form.previousDate || '', 
      previousHour: c.form.previousHour || '', 
      assignmentId: c.assignmentId || '', 
      directorStatus: '', 
      directorBy: '', 
      directorAt: '', 
      directorRemark: '', 
      comments: [], 
      editedAt: '',
      customer: c.form.customer || '',
      reportNo: c.form.reportNo || '',
      driverUsername: c.form.driverUsername || '',
      driverConfirmStatus: 'Pending',
      driverConfirmedBy: '',
      driverConfirmedAt: '',
      driverConfirmRemark: ''
    };

    if (isEdit) {
      const idx = APP.submissions.findIndex(x => x.checkId === editingCheckId);
      if (idx !== -1) {
        const prev = APP.submissions[idx];
        newSub.confirmStatus = prev.confirmStatus; newSub.confirmedBy = prev.confirmedBy; newSub.confirmedAt = prev.confirmedAt; newSub.confirmRemark = prev.confirmRemark; newSub.comments = prev.comments || []; newSub.editedAt = dmyToday() + ' ' + nowTimeStr();
        APP.submissions[idx] = newSub;
      } else { APP.submissions.push(newSub); }
    } else { APP.submissions.push(newSub); }

    if (c.assignmentId) { const a = APP.assignments.find(x => x.assignmentId === c.assignmentId); if (a) { a.status = 'Completed'; a.completedAt = dmyToday() + ' ' + nowTimeStr(); a.handoverCheckId = res.checkId; } }
    showAlert((isEdit ? 'បានធ្វើបច្ចុប្បន្នភាព' : 'ដាក់ស្នើរួចរាល់') + ' — ' + res.checkId, 'success');
    editingCheckId = null; pendingChecklist = null; showPage('home');
  }).withFailureHandler(handleError)[runner](payload);
};


/*ScriptChecklistRTG*/

/* =========================================================
   CHECKLIST FORM (RTG & គ្រឿងចក្រ VERSION)
   ========================================================= */
window.startChecklistRTG = function(equipmentId, group, shortName, driverUsername, assignmentId){ 
  loadAndRenderChecklistFormRTG(equipmentId, group, shortName, driverUsername, assignmentId, null); 
};

function loadAndRenderChecklistFormRTG(equipmentId, group, shortName, driverUsername, assignmentId, existingSub){
  const eqData = APP.equipmentMap[equipmentId] || {};
  const sg = eqData.specificGroup || '';
  const raw = APP.templates[group + '|' + sg] || APP.templates[group + '|'] || APP.templates[group] || [];
  
  const headers = raw.filter(it => String(it.inputType).toLowerCase() === 'header');
  const items   = raw.filter(it => String(it.inputType).toLowerCase() !== 'header');
  if (items.length === 0) { showAlert('No template for group: '+group, 'danger'); return; }

  const headerBySection = {};
  headers.forEach(h => { headerBySection[String(h.itemId).trim()] = h; });
  const prevSub = (APP.submissions || []).filter(s => s.equipmentId === equipmentId).sort((a, b) => subMs(b) - subMs(a))[0] || null;
  const isEdit = !!existingSub;

  let formDefaults, checksInit;
  if (isEdit) {
    const s = existingSub;
    formDefaults = { 
      date: isoDate(parseDmyToDate(s.date)), 
      timeIn: s.timeIn || s.time || '', 
      timeOut: s.timeOut || '', 
      lastOpHour: s.lastOpHour || '', 
      previousDate: s.previousDate || '', 
      previousHour: s.previousHour || '',
      customer: s.customer || '',
      reportNo: s.reportNo || '',
      driverUsername: s.driverUsername || driverUsername || ''
    };
    checksInit = {};
    items.forEach(it => { checksInit[it.itemId] = { itemId: it.itemId, status: 'OK', note: '', photos: [] }; });
    (s.checks || []).forEach(c => {
      let photos = [];
      if (Array.isArray(c.photos)) photos = c.photos.map(p => ({ fileId: p.fileId || '', thumb: p.thumb || '', dataUrl: p.dataUrl || '' }));
      else if (Array.isArray(c.photoIds)) photos = c.photoIds.map(id => ({ fileId: id }));
      else if (c.photoId) photos = [{ fileId: c.photoId }];
      else if (c.photoData) photos = [{ dataUrl: c.photoData }];
      if (checksInit[c.itemId]) {
        checksInit[c.itemId].status = c.status || 'OK'; // Default to OK if empty
        checksInit[c.itemId].note = c.note || '';
        checksInit[c.itemId].photos = photos;
      }
    });
  } else {
    formDefaults = { 
      date: isoDate(new Date()), 
      timeIn: nowTimeStr(), 
      timeOut: '', 
      lastOpHour: '', 
      previousDate: prevSub ? isoDate(parseDmyToDate(prevSub.date)) : '', 
      previousHour: prevSub ? (prevSub.lastOpHour || '') : '',
      customer: '',
      reportNo: '',
      driverUsername: driverUsername || '' 
    };
    checksInit = {};
    items.forEach(it => { checksInit[it.itemId] = { itemId: it.itemId, status: 'OK', note: '', photos: [] }; });
  }

  pendingChecklist = { equipmentId: equipmentId, group: group, shortName: shortName, headers: headers.slice(), headerBySection: headerBySection, items: items.slice(), checks: checksInit, form: formDefaults, assignmentId: assignmentId || '', existingRemark: isEdit ? (existingSub.remark || '') : '' };
  editingCheckId = isEdit ? existingSub.checkId : null;
  renderChecklistFormRTG();
  if (isEdit) setTimeout(() => { $('#checkRemark').val(existingSub.remark || ''); }, 30);
}

function buildInfoFormRTG(c){
  const f = c.form || {};
  const todayDisplay   = formatIsoToDmy(f.date || isoDate(new Date()));
  const timeInDisplay  = f.timeIn  || nowTimeStr();
  const timeOutDisplay = f.timeOut || '';
  if (!f.date)   c.form.date   = isoDate(new Date());
  if (!f.timeIn) c.form.timeIn = timeInDisplay;

  const eqData = APP.equipmentMap[c.equipmentId] || {};
  const serialNo = eqData.serialNumber || '';
  
  // Driver logic
  const currentDriverUsername = f.driverUsername || '';
  const currentDriver = (APP.drivers || []).find(d => d.username === currentDriverUsername);
  const currentDriverLabel = currentDriver ? (currentDriver.fullName + ' (@' + currentDriver.username + ')') : currentDriverUsername;

  const col = (label, inner) => '<div class="col-6 col-md-4"><label class="form-label small fw-bold mb-1">' + esc(label) + '</label>' + inner + '</div>';

  return '<div class="card mb-3 info-card"><div class="card-body"><h6 class="mb-3"><i class="bi bi-clipboard-data text-primary me-2"></i>Inspection Info</h6><div class="row g-2">' +
    col('កាលបរិច្ឆេទ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(todayDisplay) + '" readonly>') +
    col('កាលបរិច្ឆេទចាប់ផ្ដើម', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(timeInDisplay) + '" readonly>') +
    col('កាលបរិច្ឆេទបញ្ចប់', '<input type="text" class="form-control form-control-sm bg-light" id="fldTimeOutDisplay" value="' + escAttr(timeOutDisplay) + '" placeholder="Set on submit" readonly>') +
    
    col('អតិថិជន', '<input type="text" class="form-control form-control-sm" value="' + escAttr(f.customer || '') + '" placeholder="បញ្ចូលអតិថិជន..." oninput="onFormChange(\'customer\', this.value)">') +
    col('លេខសេរ៉េ (Serial No)', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(serialNo) + '" readonly>') +
    col('លេខកូដគ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(c.shortName) + '" readonly>') +
    
    col('ម៉ោងគ្រឿងចក្រ', '<input type="text" class="form-control form-control-sm" id="fldLastOpHour" value="' + escAttr(f.lastOpHour || '') + '" placeholder="e.g. 340" oninput="onFormChange(\'lastOpHour\', this.value)">') +
    col('អ្នកត្រួតពិនិត្យ', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(currentUser.fullName) + '" readonly>') +
    
    // ★ ADDED DRIVER DROPDOWN HERE
    col('អ្នកបើកបរ (Driver)', '<div style="position:relative;"><input type="text" class="form-control form-control-sm" id="fldDriverSearch" placeholder="ស្វែងរកអ្នកបើកបរ..." autocomplete="off" value="' + escAttr(currentDriverLabel) + '" oninput="onChecklistDriverInput(this.value)" onfocus="showChecklistDriverDropdown()" onblur="hideChecklistDriverDropdown()"><input type="hidden" id="fldDriver" value="' + escAttr(currentDriverUsername) + '"><div id="checklistDriverDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:300px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div></div>') +
    
    col('របាយការណ៍លេខ', '<input type="text" class="form-control form-control-sm" value="' + escAttr(f.reportNo || '') + '" placeholder="បញ្ចូលលេខរៀង..." oninput="onFormChange(\'reportNo\', this.value)">') +
    '</div><hr class="my-3"><div class="small text-muted mb-2">Previous values (from last check)</div><div class="row g-2">' +
    col('PREVIOUS DATE', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousDate || '—') + '" readonly>') +
    col('PREVIOUS HOUR', '<input type="text" class="form-control form-control-sm bg-light" value="' + escAttr(f.previousHour || '—') + '" readonly>') +
    '</div></div></div>';
}

function renderChecklistFormRTG(){
  const c = pendingChecklist;
  let lastSectionShown = '__none__'; let globalNum = 0; let itemsHtml = '';

  // Status options for RTG
  const rtgStatusOptions = [
    { code: 'OK', label: 'OK' }, 
    { code: 'NOK', label: 'Not OK' }
  ];

  c.items.forEach((it) => {
    const sec = sectionOf(it.itemId);
    let headerHtml = '';

    // 1. Render Section Headers
    if (sec) {
      if (sec !== lastSectionShown) {
        lastSectionShown = sec;
        const h = (c.headerBySection || {})[sec];
        if (h) {
          // Format prefix: If sec is 'A', show 'A'. If '1', show '1.'
          let prefix = String(sec).match(/^[0-9]+$/) ? sec + '.' : sec; 
          let headerTitle = h.itemKhmer;
          
          if (!headerTitle.startsWith(prefix)) {
            headerTitle = '<span class="sec-num" style="margin-right:5px;">' + prefix + '</span> ' + esc(headerTitle);
          }

          // Grey bar styling for the header
          headerHtml = `
            <div class="section-divider" style="background:#e0e0e0; border:1px solid #000; margin-top:20px; margin-bottom:10px;">
              <div class="sec-kh" style="font-weight:bold; font-size:15px; text-align:center; padding:8px;">${headerTitle}</div>
              ${h.itemEng ? `<div class="sec-en" style="text-align:center; font-size:13px; padding-bottom:8px; border-top:1px dotted #aaa; padding-top:5px;">${esc(h.itemEng)}</div>` : ''}
            </div>`;
        }
      }
    }

    // 2. Render Items
    globalNum++; 
    const sel       = c.checks[it.itemId] || { status: 'OK', note: '', photos: [] };
    const statusVal = sel.status || 'OK';
    const showNote  = statusVal !== 'OK'; // Show note/photos only if Not OK
    const photos    = sel.photos || [];

    const optsHtml = rtgStatusOptions.map(o =>
      '<option value="' + escAttr(o.code) + '"' + (statusVal === o.code ? ' selected' : '') + '>' + esc(o.label) + '</option>'
    ).join('');

    // Render Photo thumbnails
    const photoTiles = photos.map((p, idx) => {
      const src = photoSrc(p, 200);
      return `
        <div class="photo-tile" data-photo-idx="${idx}" onclick="openLightboxFromForm('${escAttr(it.itemId)}',${idx})">
          ${src ? `<img src="${src}" loading="lazy" decoding="async" alt="">` : '<div style="width:90px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;"><i class="bi bi-image"></i></div>'}
          <button type="button" class="photo-remove-btn" onclick="event.stopPropagation();removeItemPhoto('${escAttr(it.itemId)}',${idx})">×</button>
        </div>`;
    }).join('');

const addPhotoTile = (photos.length < 10) ? 
  '<div class="photo-tile photo-add-tile" onclick="takePhotoDirectly(\'' + escAttr(it.itemId) + '\')" style="color: #0d6efd; border-color: #0d6efd;" title="Take Photo"><i class="bi bi-camera"></i></div>' +
  '<div class="photo-tile photo-add-tile" onclick="pickFromGalleryDirectly(\'' + escAttr(it.itemId) + '\')" title="Gallery"><i class="bi bi-image"></i></div>' 
  : '';

    itemsHtml += headerHtml + `
      <div class="check-item" data-item="${escAttr(it.itemId)}" data-status="${escAttr(statusVal)}">
        <div class="row-line">
          <div class="label-part">
            <span class="item-num">${esc(globalNum)}.</span>
            <div class="item-text">
              <span class="item-name-kh">${esc(it.itemKhmer)}</span>
              ${it.itemEng ? `<span class="item-name-en">${esc(it.itemEng)}</span>` : ''}
            </div>
          </div>
          <div class="controls-group">
            <select class="form-select form-select-sm status-select" onchange="setStatusRTG('${escAttr(it.itemId)}', this.value)">
              ${optsHtml}
            </select>
          </div>
        </div>
        <div class="note-row" style="display:${showNote ? 'block' : 'none'};">
          <textarea class="form-control form-control-sm js-nok-note" rows="1" placeholder="Describe the issue / បញ្ជាក់បញ្ហា..." oninput="setNokNote('${escAttr(it.itemId)}', this.value);autoGrowNote(this)">${esc(sel.note || '')}</textarea>
          <div class="item-photo-row mt-2" style="display:${showNote ? 'flex' : 'none'};">
            <input type="file" accept="image/*" multiple id="photo-input-${escAttr(it.itemId)}" style="display:none;" onchange="onItemPhotoPick('${escAttr(it.itemId)}', this)">
            <div class="photo-gallery" data-item="${escAttr(it.itemId)}">${photoTiles}${addPhotoTile}</div>
          </div>
        </div>
      </div>`;
  });

  // 3. Assemble the full page
  const totalItems = c.items.length;
  $('#app').html(`
    <div class="container-fluid px-0">
      <button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelChecklist()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button>
      
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="mb-1">${esc(c.shortName)}</h5>
          <div class="small text-muted mb-0">${esc(c.equipmentId)} · ${esc(c.group)} ${(APP.equipmentMap[c.equipmentId]?.specificGroup ? ' - ' + esc(APP.equipmentMap[c.equipmentId].specificGroup) : '')}</div>
          <div class="small text-primary mt-2"><i class="bi bi-person me-1"></i>${esc(currentUser.fullName)}</div>
          <div class="small text-muted mt-1"><i class="bi bi-list-check me-1"></i>${totalItems} items ${(c.headers.length ? ' · ' + c.headers.length + ' sections' : '')}</div>
        </div>
      </div>
      
      ${buildInfoFormRTG(c)} 
      
      ${itemsHtml}
      
      <div class="card mt-3">
        <div class="card-body">
          <label class="form-label fw-bold">Remark</label>
          <textarea class="form-control form-control-sm" id="checkRemark" rows="2" placeholder="កំណត់សម្គាល់បន្ថែម..."></textarea>
        </div>
      </div>
      
      <button class="btn btn-primary w-100 mb-4" style="margin-bottom: 100px !important;" onclick="submitChecklistFormRTG()">
        <i class="bi bi-check-circle me-1"></i>${editingCheckId ? 'ធ្វើបច្ចុប្បន្នភាព' : 'ដាក់ស្នើ'}
      </button>
    </div>
  `);

  $('.js-nok-note').each(function(){ autoGrowNote(this); });
  if (editingCheckId && c.existingRemark) $('#checkRemark').val(c.existingRemark);
  initChecklistDriverData(c.group); 
}

window.setStatusRTG = function(itemId, code){
  if (!pendingChecklist) return;
  const chk = pendingChecklist.checks[itemId]; if (!chk) return;
  if (!code) code = 'OK'; chk.status = code;
  const $item = $('.check-item[data-item="'+itemId+'"]');
  $item.attr('data-status', code); $item.find('.status-select').val(code);
  const showNote = code !== 'OK';
  $item.find('.note-row').css('display', showNote ? 'block' : 'none');
  $item.find('.item-photo-row').css('display', showNote ? 'flex' : 'none');
  if (!showNote) {
    const chk = pendingChecklist.checks[itemId];
    if (chk && chk.photos && chk.photos.length > 0) { chk.photos = []; $item.find('.photo-gallery').empty(); }
  }
};

window.submitChecklistFormRTG = function(){
  if (!pendingChecklist) return;
  const c = pendingChecklist;
  if (hasPendingUploads()) { showLoading('កំពុងបញ្ចូលរូបភាព សូមរង់ចាំ...'); setTimeout(() => { hideLoading(); submitChecklistFormRTG(); }, 900); return; }

  const checks = c.items.map(it => {
    const cc = c.checks[it.itemId] || {};
    const entry = { itemId: it.itemId, status: cc.status || 'OK', note: cc.note || '' };
    const photos = (cc.photos || []).filter(p => p.fileId).map(p => ({ fileId: p.fileId }));
    if (photos.length) entry.photos = photos;
    return entry;
  });

  // Overall status: 'OK' if all are 'OK', else 'Issues'
  const overall = checks.every(x => x.status === 'OK') ? 'OK' : 'Issues';
  
  if (!c.form.timeOut) c.form.timeOut = nowTimeStr();
  
  const payload = { 
    username: currentUser.username, 
    fullName: currentUser.fullName, 
    equipmentId: c.equipmentId, 
    group: c.group, 
    overallStatus: overall, 
    checks: checks, 
    remark: $('#checkRemark').val() || '', 
    form: c.form || {}, 
    assignmentId: c.assignmentId || '' 
  };
  
  const isEdit = !!editingCheckId;
  if (isEdit) payload.checkId = editingCheckId;

  showLoading('កំពុងរក្សាទុក...');
  const runner = isEdit ? 'updateChecklist' : 'submitChecklist';
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
    const submitNow  = dmyToday(); const submitTime = nowTimeStr();
    let subDate = submitNow; let subTime = submitTime;
    if (isEdit && editingCheckId) { const prev = APP.submissions.find(x => x.checkId === editingCheckId); if (prev) { subDate = prev.date || submitNow; subTime = prev.time || submitTime; } }

    const newSub = { 
      checkId: res.checkId, 
      date: subDate, 
      time: subTime, 
      username: currentUser.username, 
      driverName: currentUser.fullName, 
      equipmentId: c.equipmentId, 
      group: c.group, 
      overall: overall, 
      checks: checks, 
      remark: $('#checkRemark').val() || '', 
      photoIds: [], 
      submittedAt: submitNow + ' ' + submitTime, 
      confirmStatus: 'Pending', 
      confirmedBy: '', 
      confirmedAt: '', 
      confirmRemark: '', 
      timeIn: c.form.timeIn || '', 
      timeOut: c.form.timeOut || '', 
      lastOpHour: c.form.lastOpHour || '', 
      previousDate: c.form.previousDate || '', 
      previousHour: c.form.previousHour || '', 
      assignmentId: c.assignmentId || '', 
      directorStatus: '', 
      directorBy: '', 
      directorAt: '', 
      directorRemark: '', 
      comments: [], 
      editedAt: '',
      customer: c.form.customer || '',
      reportNo: c.form.reportNo || '',
      driverUsername: c.form.driverUsername || '',
      driverConfirmStatus: 'Pending',
      driverConfirmedBy: '',
      driverConfirmedAt: '',
      driverConfirmRemark: ''
    };

    if (isEdit) {
      const idx = APP.submissions.findIndex(x => x.checkId === editingCheckId);
      if (idx !== -1) {
        const prev = APP.submissions[idx];
        newSub.confirmStatus = prev.confirmStatus; newSub.confirmedBy = prev.confirmedBy; newSub.confirmedAt = prev.confirmedAt; newSub.confirmRemark = prev.confirmRemark; newSub.comments = prev.comments || []; newSub.editedAt = dmyToday() + ' ' + nowTimeStr();
        APP.submissions[idx] = newSub;
      } else { APP.submissions.push(newSub); }
    } else { APP.submissions.push(newSub); }

    if (c.assignmentId) { const a = APP.assignments.find(x => x.assignmentId === c.assignmentId); if (a) { a.status = 'Completed'; a.completedAt = dmyToday() + ' ' + nowTimeStr(); a.handoverCheckId = res.checkId; } }
    showAlert((isEdit ? 'បានធ្វើបច្ចុប្បន្នភាព' : 'ដាក់ស្នើរួចរាល់') + ' — ' + res.checkId, 'success');
    editingCheckId = null; pendingChecklist = null; showPage('home');
  }).withFailureHandler(handleError)[runner](payload);
};



/*ScriptData*/



/* =========================================================
   GLOBAL ERROR CATCHER (Helps diagnose silent crashes)
   ========================================================= */
window.onerror = function(msg, url, line, col, error) {
  console.error("CRITICAL ERROR:", msg, "at line", line);
  if (typeof showAlert === 'function') {
    showAlert("System Error: " + msg + " (Line " + line + ")", "danger");
  }
  return false;
};

/* =========================================================
   ISSUE COUNTER (Used by detail modal)
   ========================================================= */
function countIssueCodes(sub){
  const counts = { all: 0, UF: 0, NF: 0, NA: 0, Ad: 0, T: 0 };
  const fixed  = { all: 0, UF: 0, NF: 0, NA: 0, Ad: 0, T: 0 };

  (sub.checks || []).forEach(c => {
    const n = normalizeStatus(c.status);
    if (!n || n === 'N') return;

    counts.all++;
    if (counts[n] !== undefined) counts[n]++;

    // Repaired or "Not Request" both mean this issue item needs no more work
    if (mtnItemDone(sub, c.itemId)) {
      fixed.all++;
      if (fixed[n] !== undefined) fixed[n]++;
    }
  });
  return { counts, fixed };
}

/* =========================================================
   LIST VIEW & DETAIL MODAL
   ========================================================= */
window.drillTo = function(params) {
  listFilters = { status: 'all', confirmStatus: 'all', group: 'all', equipmentId: 'all', driver: 'all', dateFrom: '', dateTo: '', search: '', nokItemIds: [], nokItemLabel: '', issueCode: 'all' };
  Object.keys(params || {}).forEach(k => { listFilters[k] = params[k]; });
  showPage('list');
};

window.drillToIssue = function(itemIdsCsv, label) {
  const ids = String(itemIdsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  drillTo({ status: 'all', nokItemIds: ids, nokItemLabel: label || '' });
};

function applyListFilters(list){
  let out = list.slice();
  if (listFilters.status !== 'all') out = out.filter(s => s.overall === listFilters.status);
  const stage = listFilters.confirmStatus;
  if (stage && stage !== 'all') {
    if (stage === 'Pending-Driver') {
      out = out.filter(s => s.driverUsername && (s.driverConfirmStatus || 'Pending') === 'Pending');
    } 
    else if (stage === 'Pending-Admin') {
      out = out.filter(s => {
        const driverCleared = !s.driverUsername || s.driverConfirmStatus === 'Confirmed';
        return driverCleared && (s.confirmStatus || 'Pending') === 'Pending';
      });
    }
    else if (stage === 'Pending-Manager') {
      out = out.filter(s => (s.confirmStatus || 'Pending') === 'Confirmed' && !s.directorStatus);
    }
    else if (stage === 'Confirmed') {
      out = out.filter(s => s.directorStatus === 'Confirmed');
    }
    else if (stage === 'Rejected') {
      out = out.filter(s => s.confirmStatus === 'Rejected' || s.directorStatus === 'Rejected' || s.driverConfirmStatus === 'Rejected');
    }
    else {
      out = out.filter(s => (s.confirmStatus || 'Pending') === stage);
    }
  }
  if (listFilters.group !== 'all')  out = out.filter(s => s.group === listFilters.group);
  if (listFilters.equipmentId !== 'all') out = out.filter(s => s.equipmentId === listFilters.equipmentId);
  if (listFilters.driver !== 'all') out = out.filter(s => s.username === listFilters.driver);
  if (listFilters.dateFrom) {
    const from = new Date(listFilters.dateFrom + 'T00:00:00').getTime();
    out = out.filter(s => parseDmyToMs(s.date) >= from);
  }
  if (listFilters.dateTo) {
    const to = new Date(listFilters.dateTo + 'T23:59:59').getTime();
    out = out.filter(s => parseDmyToMs(s.date) <= to);
  }
  if (listFilters.search) {
    const q = listFilters.search.toLowerCase();
    out = out.filter(s => {
      const eqShortName = String(eqShort(s.equipmentId) || '').toLowerCase();
      return String(s.equipmentId).toLowerCase().includes(q) || eqShortName.includes(q) || String(s.driverName).toLowerCase().includes(q) || String(s.checkId).toLowerCase().includes(q);
    });
  }
  if (listFilters.nokItemIds && listFilters.nokItemIds.length > 0) {
    const idSet = new Set(listFilters.nokItemIds);
    out = out.filter(s => (s.checks || []).some(c => { const n = normalizeStatus(c.status); return n && n !== 'N' && idSet.has(c.itemId); }));
  }
  if (listFilters.issueCode && listFilters.issueCode !== 'all') {
    const wanted = listFilters.issueCode;
    out = out.filter(s => (s.checks || []).some(c => normalizeStatus(c.status) === wanted));
  }
  out.sort((a, b) => subMs(b) - subMs(a));
  return out;
}

function renderList(){
  try {
    if (!APP.loaded) { bootLoad(); return; }
    if (currentApp === 'daily') { renderDailyList(); return; }
    
    const groups = (APP.filterOptions && APP.filterOptions.groups) ? APP.filterOptions.groups : [];
    const isTech = currentUser.role === 'technician';

    let shell = '<div class="container-fluid px-0">';
    shell += '<div class="d-flex justify-content-between align-items-center mb-3"><h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>បញ្ជីត្រួតពិនិត្យ (Monthly)</h5><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'list\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>';
    shell += '<div class="card mb-2"><div class="card-body py-2">';
    shell += '<input type="text" class="form-control form-control-sm mb-2" id="fSearch" placeholder="ស្វែងរក Check-ID / ឧបករណ៍ / អ្នកបច្ចេកទេស..." value="'+esc(listFilters.search)+'" oninput="onListSearch(this)">';
    shell += '<div class="d-flex gap-1 mb-2 flex-wrap"><button class="btn btn-sm btn-outline-primary date-preset" data-preset="today" onclick="setDatePreset(\'today\')">ថ្ងៃនេះ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="month" onclick="setDatePreset(\'month\')">ខែនេះ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="30d" onclick="setDatePreset(\'30d\')">30 ថ្ងៃ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="all" onclick="setDatePreset(\'all\')">ទាំងអស់</button></div>';
    shell += '<div class="row g-2 mb-2"><div class="col-6"><input type="date" class="form-control form-control-sm" id="fFrom" value="'+listFilters.dateFrom+'" onchange="onListDateChange()"></div><div class="col-6"><input type="date" class="form-control form-control-sm" id="fTo" value="'+listFilters.dateTo+'" onchange="onListDateChange()"></div></div>';
    
    shell += '<div class="tab-bar mb-1" id="statusTabBar" style="display: flex; overflow-x: auto; white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none; border: none; background: transparent; padding-bottom: 2px;">' +
  '<div class="tab list-tab '+(listFilters.status==='all'?'active':'')+'" data-key="status" data-value="all" onclick="setListFilter(\'status\',\'all\')">ទាំងអស់</div>' +
  '<div class="tab list-tab '+(listFilters.status==='OK'?'active':'')+'" data-key="status" data-value="OK" onclick="setListFilter(\'status\',\'OK\')">OK</div>' +
  '<div class="tab list-tab '+(listFilters.status==='Issues'?'active':'')+'" data-key="status" data-value="Issues" onclick="setListFilter(\'status\',\'Issues\')">Issues</div>' +
'</div>';

    if (listFilters.status === 'Issues') {
      const CODES = ['UF', 'NF', 'NA', 'Ad', 'T'];
      shell += '<div class="tab-bar mb-1" style="padding-left:10px;"><div class="tab list-tab ' + (listFilters.issueCode === 'all' ? 'active' : '') + '" data-key="issueCode" data-value="all" onclick="setIssueCode(\'all\')">ទាំងអស់</div>' + CODES.map(code => '<div class="tab list-tab ' + (listFilters.issueCode === code ? 'active' : '') + '" data-key="issueCode" data-value="' + code + '" onclick="setIssueCode(\'' + code + '\')">' + code + '</div>').join('') + '</div>';
    }
    
   shell += '<div class="tab-bar mb-1" id="confirmTabBar" style="display: flex; overflow-x: auto; white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none; border: none; background: transparent; padding-bottom: 2px;">' +
  '<div class="tab list-tab '+(listFilters.confirmStatus==='all'?'active':'')+'" data-key="confirmStatus" data-value="all" onclick="setListFilter(\'confirmStatus\',\'all\')">ទាំងអស់</div>' +
  '<div class="tab list-tab '+(listFilters.confirmStatus==='Pending-Driver'?'active':'')+'" data-key="confirmStatus" data-value="Pending-Driver" onclick="setListFilter(\'confirmStatus\',\'Pending-Driver\')">Pending Driver</div>' +
  '<div class="tab list-tab '+(listFilters.confirmStatus==='Pending-Admin'?'active':'')+'" data-key="confirmStatus" data-value="Pending-Admin" onclick="setListFilter(\'confirmStatus\',\'Pending-Admin\')">Pending Admin</div>' +
  '<div class="tab list-tab '+(listFilters.confirmStatus==='Pending-Manager'?'active':'')+'" data-key="confirmStatus" data-value="Pending-Manager" onclick="setListFilter(\'confirmStatus\',\'Pending-Manager\')">Pending Manager</div>' +
  '<div class="tab list-tab '+(listFilters.confirmStatus==='Confirmed'?'active':'')+'" data-key="confirmStatus" data-value="Confirmed" onclick="setListFilter(\'confirmStatus\',\'Confirmed\')">Completed</div>' +
'</div>';

    if (groups.length > 1 && !isTech) {
      shell += '<div class="tab-bar mb-1" id="groupTabBar" style="display: flex; overflow-x: auto; white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none; border: none; background: transparent; padding-bottom: 2px;">' +
        '<div class="tab list-tab '+(listFilters.group==='all'?'active':'')+'" data-key="group" data-value="all" onclick="setListFilter(\'group\',\'all\')">ក្រុមទាំងអស់</div>';
      
      groups.forEach(g => { 
        shell += '<div class="tab list-tab '+(listFilters.group===g?'active':'')+'" data-key="group" data-value="'+escAttr(g)+'" onclick="setListFilter(\'group\',\''+escAttr(g)+'\')">'+esc(g)+'</div>'; 
      });
      
      shell += '</div>';
    }
    
    shell += '</div></div>';
    
    if (listFilters.nokItemIds && listFilters.nokItemIds.length > 0) {
      shell += '<div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-danger d-flex align-items-center gap-1" style="font-size:.8rem;padding:6px 10px;"><i class="bi bi-x-circle"></i> ' + esc(listFilters.nokItemLabel || 'Issue') + '<span onclick="clearIssueFilter()" style="cursor:pointer;margin-left:6px;font-weight:700;">✕</span></span></div>';
    }
    
    shell += '<div class="d-flex justify-content-between align-items-center mb-2"><small class="text-muted" id="listCount">0 ករណី</small><button class="btn btn-sm btn-outline-secondary" onclick="clearListFilters()"><i class="bi bi-x-lg"></i> Clear</button></div>';
    shell += '<div id="listResults"></div></div>';
    
    $('#app').html(shell);
    initDatePickers('#app'); applyDatePresetActive(); updateListResults();
        $('#app').html(shell);
    initDatePickers('#app'); 
    applyDatePresetActive(); 
    updateListResults();

    // ★ AUTO-CENTER THE ACTIVE TAB
    setTimeout(() => {
      const sBar = document.getElementById('statusTabBar');
      if (sBar) {
        const sActive = sBar.querySelector('.active');
        if (sActive) sActive.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      const cBar = document.getElementById('confirmTabBar');
      if (cBar) {
        const cActive = cBar.querySelector('.active');
        if (cActive) cActive.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      
      // ★ Added Group Tab Bar
      const gBar = document.getElementById('groupTabBar');
      if (gBar) {
        const gActive = gBar.querySelector('.active');
        if (gActive) gActive.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      
    }, 100);

  } catch (err) {
    console.error(err);
    $('#app').html('<div class="alert alert-danger">Failed to load list: ' + err.message + '</div>');
  }
}

function updateListResults(){
  try {
    const filtered = applyListFilters(APP.submissions || []);
    
    // ★ Slice the array to the current limit
    const visible = filtered.slice(0, listDisplayLimit);
    
    const rows = visible.map((s, i) => renderSubmissionCard(s, i)).join('');
    
    let html = rows || '<p class="text-muted text-center py-4">គ្មានទិន្នន័យ</p>';
    
    // ★ Add "View More" button if there are more items
    if (filtered.length > listDisplayLimit) {
      const remaining = filtered.length - listDisplayLimit;
      html += `<div class="text-center mt-3 mb-5"><button class="btn btn-outline-primary shadow-sm px-4" onclick="loadMoreList()"><i class="bi bi-arrow-down-circle me-1"></i> View More (${remaining} remaining)</button></div>`;
    }

    $('#listResults').html(html);
    $('#listCount').text(filtered.length + ' ករណី');
  } catch (err) {
    console.error(err);
    $('#listResults').html('<div class="alert alert-danger">Error rendering cards: ' + err.message + '</div>');
  }
}

window.loadMoreList = function(){
  listDisplayLimit += 20; // Load 20 more
  updateListResults();
};

function renderSubmissionCard(s, i){
  const cls = s.overall === 'Issues' ? 'nok' : 'ok';
  
  // 1. Get Statuses
  const mgrStatus = s.confirmStatus  || 'Pending'; 
  const dirStatus = s.directorStatus || '';
  const drvStatus = s.driverConfirmStatus || 'Pending';

  // 2. Determine Badge Colors
  const mgrCls = mgrStatus === 'Confirmed' ? 'ok' : mgrStatus === 'Rejected' ? 'nok' : 'pending';
  const dirCls = dirStatus === 'Confirmed' ? 'ok' : dirStatus === 'Rejected' ? 'nok' : 'pending';
  const drvCls = drvStatus === 'Confirmed' ? 'ok' : drvStatus === 'Rejected' ? 'nok' : 'pending';
  
  // 3. Build the Confirmation Line (Only show the latest/current step)
  let activeBadge = '';
  if (dirStatus) {
    activeBadge = `<span class="status-badge status-${dirCls}" style="font-size:.65rem;min-width:auto;padding:2px 8px;"><i class="bi bi-patch-check me-1"></i>Manager: ${esc(dirStatus)}</span>`;
  } else if (mgrStatus === 'Confirmed') {
    activeBadge = `<span class="status-badge status-pending" style="font-size:.65rem;min-width:auto;padding:2px 8px;"><i class="bi bi-hourglass-split me-1"></i>Manager: Pending</span>`;
  } else if (drvStatus === 'Confirmed') {
    activeBadge = `<span class="status-badge status-pending" style="font-size:.65rem;min-width:auto;padding:2px 8px;"><i class="bi bi-hourglass-split me-1"></i>Admin: Pending</span>`;
  } else if (s.driverUsername) {
    activeBadge = `<span class="status-badge status-${drvCls}" style="font-size:.65rem;min-width:auto;padding:2px 8px;"><i class="bi bi-truck me-1"></i>Driver: ${esc(drvStatus)}</span>`;
  } else {
    activeBadge = `<span class="status-badge status-pending" style="font-size:.65rem;min-width:auto;padding:2px 8px;"><i class="bi bi-hourglass-split me-1"></i>Admin: Pending</span>`;
  }

  let confirmLine = '<div class="small mt-2 d-flex gap-1 align-items-center flex-wrap">';
  confirmLine += activeBadge;
  confirmLine += (s.editedAt ? '<span class="badge bg-info" style="font-size:.6rem;">edited</span>' : '') + 
                 (s.comments && s.comments.length ? '<span class="badge bg-secondary" style="font-size:.6rem;"><i class="bi bi-chat-left-text me-1"></i>'+s.comments.length+'</span>' : '');
  confirmLine += '</div>';
  
  const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {};
  const sg = eqData.specificGroup;
  const groupText = s.group + (sg ? ' - ' + sg : '');

  // Get Driver Name
  const drvObj = (APP.drivers || []).find(d => d.username === s.driverUsername);
  const actualDriverName = drvObj ? drvObj.fullName : (s.driverUsername || '—');

  // Get Trailer Short Name
  const trlObj = (APP.trailers || []).find(t => t.trailerId === s.trailerPlateNo);
  const trailerShortName = trlObj ? (trlObj.shortName || trlObj.trailerId) : (s.trailerPlateNo || '');

  return `
    <div class="card mb-2 clickable-card" onclick="viewCheck('${escAttr(s.checkId)}')">
      
      <!-- ★ MOBILE ONLY: Group Name on top -->
      <div class="d-flex d-md-none justify-content-center bg-light border-bottom py-1 text-muted fw-bold" style="font-size: 0.85rem;">
        ${esc(groupText)}
      </div>

      <!-- Header: Equipment + Trailer | Group (Desktop Only) | Status -->
      <div class="group-header d-flex justify-content-between align-items-center px-3 py-2 gap-2 position-relative">
        
        <!-- Left: Equipment + Trailer -->
        <div class="d-flex align-items-center gap-1 flex-wrap" style="flex: 1; z-index: 2;">
          <span class="text-muted">${i+1}.</span>
          <strong>${esc(eqShort(s.equipmentId))}</strong>
          ${trailerShortName ? `<span class="badge bg-secondary text-nowrap" style="font-size:.65rem;">${esc(trailerShortName)}</span>` : ''}
        </div>
        
        <!-- Center: Group (Desktop Only) -->
        <!-- ★ FIXED: Used absolute positioning to force perfect dead-center alignment -->
        <div class="d-none d-md-block text-center text-muted fw-bold position-absolute start-50 translate-middle-x" style="font-size:.85rem; z-index: 1; white-space: nowrap;">
          ${esc(groupText)}
        </div>
        
        <!-- Right: Status -->
        <div class="text-end" style="flex: 0 0 auto; z-index: 2;">
          <span class="status-badge status-${cls}">${esc(s.overall)}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="card-body py-2">
        
        <div class="row small g-2">
          
          <!-- Date (Mobile 1st, Desktop 2nd) -->
          <div class="col-12 col-md-6 order-1 order-md-2">
            <i class="bi bi-calendar me-1"></i>${esc(s.date)} ${esc(s.time)}
          </div>

          <!-- Tech (Mobile 2nd, Desktop 1st) -->
          <div class="col-12 col-md-6 order-2 order-md-1 text-truncate">
            <i class="bi bi-steering-wheel me-1"></i>អ្នកត្រួតពិនិត្យ: ${esc(s.driverName)}
          </div>
          
          <!-- Driver (Mobile 3rd, Desktop 3rd) -->
          <div class="col-12 col-md-6 order-3 text-truncate ${s.driverUsername ? 'text-primary' : ''}">
            ${s.driverUsername ? `<i class="bi bi-steering-wheel me-1"></i>អ្នកបើកបរ: <strong>${esc(actualDriverName)}</strong>` : '&nbsp;'}
          </div>
          
          <!-- Check ID (Mobile 4th, Desktop 4th) -->
          <div class="col-12 col-md-6 order-4 text-truncate">
            <i class="bi bi-hash me-1"></i>${esc(s.checkId)}
          </div>
          
        </div>
        
        ${confirmLine}
        
        <div class="text-end mt-2">
          <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewCheck('${escAttr(s.checkId)}')">
            <i class="bi bi-eye"></i> លម្អិត
          </button>
        </div>
        
      </div>
    </div>
  `;
}

window.setListFilter = function(key, value){
  listDisplayLimit = 20;
  listFilters[key] = value;
  if (key === 'status') {
    listFilters.issueCode = 'all';
    if (value === 'all') {
      listFilters.dateFrom = ''; listFilters.dateTo = ''; listFilters.group = 'all'; listFilters.driver = 'all'; listFilters.equipmentId = 'all'; listFilters.search = ''; listFilters.nokItemIds = []; listFilters.nokItemLabel = '';
    }
  }
  renderList();
};

window.setIssueCode = function(code){ listDisplayLimit = 20;listFilters.issueCode = code; $('.list-tab[data-key="issueCode"]').removeClass('active'); $('.list-tab[data-key="issueCode"][data-value="' + code + '"]').addClass('active'); updateListResults(); };
let _searchTmr = null;
window.onListSearch = function(el){ listDisplayLimit = 20; const val = el.value; clearTimeout(_searchTmr); _searchTmr = setTimeout(() => { listFilters.search = val; updateListResults(); }, 300); };
window.onListDateChange = function(){listDisplayLimit = 20; listFilters.dateFrom = $('#fFrom').val() || ''; listFilters.dateTo = $('#fTo').val() || ''; applyDatePresetActive(); updateListResults(); };
window.setDatePreset = function(preset){
  listDisplayLimit = 20;
  const todayIso = isoToday();
  if (preset === 'today') { listFilters.dateFrom = todayIso; listFilters.dateTo = todayIso; }
  else if (preset === 'month') { const d = new Date(); d.setDate(1); listFilters.dateFrom = isoDate(d); listFilters.dateTo = todayIso; }
  else if (preset === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); listFilters.dateFrom = isoDate(d); listFilters.dateTo = todayIso; }
  else { listFilters.dateFrom = ''; listFilters.dateTo = ''; }
  setDateInput('fFrom', listFilters.dateFrom); setDateInput('fTo', listFilters.dateTo); applyDatePresetActive(preset); updateListResults();
};
function applyDatePresetActive(explicit){
  $('.date-preset').removeClass('active'); let preset = explicit;
  if (!preset) {
    const todayIso = isoToday(); const m1 = new Date(); m1.setDate(1); const d30 = new Date(); d30.setDate(d30.getDate() - 29);
    if (listFilters.dateFrom === todayIso && listFilters.dateTo === todayIso) preset = 'today';
    else if (listFilters.dateFrom === isoDate(m1) && listFilters.dateTo === todayIso) preset = 'month';
    else if (listFilters.dateFrom === isoDate(d30) && listFilters.dateTo === todayIso) preset = '30d';
    else if (!listFilters.dateFrom && !listFilters.dateTo) preset = 'all';
  }
  if (preset) $('.date-preset[data-preset="'+preset+'"]').addClass('active');
}
window.clearListFilters = function(){ listDisplayLimit = 20; listFilters = { status:'all', confirmStatus:'all', group:'all', equipmentId:'all', driver:'all', dateFrom:'', dateTo:'', search:'', nokItemIds: [], nokItemLabel: '', issueCode: 'all' }; renderList(); };
window.clearIssueFilter = function(){ listDisplayLimit = 20; listFilters.nokItemIds = []; listFilters.nokItemLabel = ''; renderList(); };

/* =========================================================
   DETAIL MODAL & VIEW CHECK
   ========================================================= */
window.viewCheck = function(checkId){ 
  try {
    const s = (APP.submissions || []).find(x => x.checkId === checkId); 
    if (!s) { showAlert('រកមិនឃើញ (Not found)', 'warning'); return; } 
    renderDetailModal(s, false); 
  } catch (err) {
    console.error(err);
    showAlert("Error opening modal: " + err.message, "danger");
  }
};

window.renderDetailModalById = function(checkId, editMode){ 
  try {
    const s = (APP.submissions || []).find(x => x.checkId === checkId); 
    if (!s) return; 
    renderDetailModal(s, !!editMode); 
  } catch (err) {
    console.error(err);
    showAlert("Error opening modal: " + err.message, "danger");
  }
};

function buildConfirmSection(s, editMode){
  const isManagerRole = (currentUser.role === 'manager'); 
  const isAdminRole = (currentUser.role === 'admin');
  const isDriverRole = (currentUser.role === 'driver');

   if (isViewer()) {
     // Just show the status, no action buttons
     return '<div class="card mb-3"><div class="card-body"><div class="small text-muted">You are in Viewer mode. No actions allowed.</div></div></div>';
  }

  const mgrStatus = s.confirmStatus || 'Pending'; 
  const dirStatus = s.directorStatus || '';
  const drvStatus = s.driverConfirmStatus || 'Pending';
  
  const mgrCls = mgrStatus === 'Confirmed' ? 'ok' : mgrStatus === 'Rejected' ? 'nok' : 'pending';
  const dirCls = dirStatus === 'Confirmed' ? 'ok' : dirStatus === 'Rejected' ? 'nok' : 'pending';
  const drvCls = drvStatus === 'Confirmed' ? 'ok' : drvStatus === 'Rejected' ? 'nok' : 'pending';

  let html = '';
  const driverCleared = (!s.driverUsername) || (drvStatus === 'Confirmed');

  // ==========================================
  // 1. DRIVER CONFIRMATION (Shows if waiting on Driver)
  // ==========================================
  if (s.driverUsername && drvStatus === 'Pending') {
    html += '<div class="card mb-3 confirm-box border-warning" style="border-left: 4px solid #ffc107;"><div class="group-header d-flex justify-content-between align-items-center" style="background:transparent;border-bottom:1px solid var(--border-color);"><span><i class="bi bi-truck me-2 text-warning"></i>Driver Confirmation</span><span class="status-badge status-'+drvCls+'">'+esc(drvStatus)+'</span></div><div class="card-body">';
    
    if (isDriverRole && currentUser.username === s.driverUsername) {
      if (editMode) {
        html += '<textarea class="form-control form-control-sm mb-2" id="confirmRemarkInput" rows="2" placeholder="Remark (optional)..."></textarea><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-success flex-fill" onclick="saveConfirm(\''+escAttr(s.checkId)+'\',\'Confirmed\',\'driver\')"><i class="bi bi-check-circle me-1"></i>Confirm</button><button class="btn btn-sm btn-outline-secondary" onclick="renderDetailModalById(\''+escAttr(s.checkId)+'\', false)">Cancel</button></div>';
      } else {
        html += '<button class="btn btn-sm btn-primary w-100" onclick="renderDetailModalById(\''+escAttr(s.checkId)+'\', true)"><i class="bi bi-pencil-square me-1"></i>Confirm</button>';
      }
    } else {
      html += '<div class="small text-warning fw-bold"><i class="bi bi-hourglass-split me-1"></i>Waiting for Driver to confirm</div>';
    }
    html += '</div></div>';
  }

  // ==========================================
  // 2. ADMIN CONFIRMATION (Shows if waiting on Admin)
  // ==========================================
  else if (driverCleared && mgrStatus === 'Pending') {
    html += '<div class="card mb-3 confirm-box border-info" style="border-left: 4px solid #0dcaf0;"><div class="group-header d-flex justify-content-between align-items-center" style="background:transparent;border-bottom:1px solid var(--border-color);"><span><i class="bi bi-person-check me-2 text-info"></i>Admin Confirmation</span><span class="status-badge status-'+mgrCls+'">'+esc(mgrStatus)+'</span></div><div class="card-body">';
    
    if (isAdminRole) {
      if (editMode) {
        html += '<textarea class="form-control form-control-sm mb-2" id="confirmRemarkInput" rows="2" placeholder="Remark (optional)...">'+esc(s.confirmRemark||'')+'</textarea><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-success flex-fill" onclick="saveConfirm(\''+escAttr(s.checkId)+'\',\'Confirmed\',\'admin\')"><i class="bi bi-check-circle me-1"></i>Confirm</button><button class="btn btn-sm btn-outline-secondary" onclick="renderDetailModalById(\''+escAttr(s.checkId)+'\', false)">Cancel</button></div>';
      } else {
        html += '<button class="btn btn-sm btn-primary w-100" onclick="renderDetailModalById(\''+escAttr(s.checkId)+'\', true)"><i class="bi bi-pencil-square me-1"></i>Confirm</button>';
      }
    } else {
      html += '<div class="small text-warning fw-bold"><i class="bi bi-hourglass-split me-1"></i>Waiting for Admin to confirm</div>';
    }
    html += '</div></div>';
  }

  // ==========================================
  // 3. MANAGER CONFIRMATION (Shows if waiting on Manager OR Completed)
  // ==========================================
  else if (mgrStatus === 'Confirmed' && !dirStatus) {
    html += '<div class="card mb-3 confirm-box border-primary" style="border-left: 4px solid #0d6efd;"><div class="group-header d-flex justify-content-between align-items-center" style="background:transparent;border-bottom:1px solid var(--border-color);"><span><i class="bi bi-patch-check me-2 text-primary"></i>Manager Confirmation</span><span class="status-badge status-pending">Pending</span></div><div class="card-body">';
    
    if (isManagerRole) {
      html += '<textarea class="form-control form-control-sm mb-2" id="confirmRemarkInput" rows="2" placeholder="Remark (optional)..."></textarea><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-success flex-fill" onclick="saveConfirm(\''+escAttr(s.checkId)+'\',\'Confirmed\',\'manager\')"><i class="bi bi-check-circle me-1"></i>Confirm</button></div>';
    } else {
      html += '<div class="small text-warning fw-bold"><i class="bi bi-hourglass-split me-1"></i>Waiting for Manager to confirm</div>';
    }
    html += '</div></div>';
  }

  // ==========================================
  // 4. COMPLETED (Shows if all stages are confirmed)
  // ==========================================
  else if (dirStatus) {
    // ★ Helper to find full name from username
    const getFullName = (username) => {
      if (!username) return 'Confirmed';
      const u = (APP.users || []).find(x => x.username === username);
      return u ? u.fullName : username; 
    };

    html += '<div class="card mb-3 confirm-box border-success" style="border-left: 4px solid #198754; background: rgba(25,135,84,0.05);"><div class="group-header d-flex justify-content-between align-items-center" style="background:transparent;border-bottom:1px solid var(--border-color);"><span><i class="bi bi-check-circle-fill me-2 text-success"></i>Workflow Complete</span><span class="status-badge status-'+dirCls+'">'+esc(dirStatus)+'</span></div><div class="card-body">';
    html += '<div class="small text-success fw-bold mb-1"><i class="bi bi-check2-all me-1"></i>All confirmations completed successfully.</div>';
    
    // ★ Used getFullName() here
    html += '<div class="small mb-1"><i class="bi bi-person-check me-1"></i>Driver: <strong>' + esc(getFullName(s.driverConfirmedBy)) + '</strong>' + (s.driverConfirmedAt ? ', <span class="text-muted">' + esc(s.driverConfirmedAt) + '</span>' : '') + '</div>';
    
    html += '<div class="small mb-1"><i class="bi bi-person-check me-1"></i>Admin: <strong>' + esc(getFullName(s.confirmedBy)) + '</strong>' + (s.confirmedAt ? ', <span class="text-muted">' + esc(s.confirmedAt) + '</span>' : '') + '</div>';
    
    html += '<div class="small"><i class="bi bi-patch-check me-1"></i>Manager: <strong>' + esc(getFullName(s.directorBy)) + '</strong>' + (s.directorAt ? ', <span class="text-muted">' + esc(s.directorAt) + '</span>' : '') + '</div>';
    
    html += '</div></div>';
  }

  // ==========================================
  // 5. COMMENTS (Always visible at the bottom)
  // ==========================================
  const comments = s.comments || [];
  html += '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-chat-left-text me-2"></i>Comments</span><button class="btn btn-sm btn-outline-primary" onclick="addCommentPrompt(\''+escAttr(s.checkId)+'\')"><i class="bi bi-plus-lg"></i> Add</button></div><div class="card-body p-2">';
  if (comments.length === 0) html += '<div class="small text-muted text-center py-2">No comments yet</div>';
  else html += comments.map(c => '<div class="p-2 mb-1" style="background:var(--bg-color);border-radius:6px;"><div class="d-flex justify-content-between"><strong class="small">'+esc(c.name||c.by)+'</strong><small class="text-muted">'+esc((c.at||'').slice(0,10))+'</small></div><div class="small">'+esc(c.text)+'</div></div>').join('');
  html += '</div></div>';
  
  return html;
}

window.saveConfirm = function(checkId, status, role){
  role = role || 'admin';
  const remark = $('#confirmRemarkInput').val() || '';
  showLoading('កំពុងរក្សាទុក...');
  
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
    
    const s = APP.submissions.find(x => x.checkId === checkId);
    
    if (s) {
      if (role === 'manager') { s.directorStatus = status; s.directorBy = currentUser.username; s.directorAt = dmyToday() + ' ' + nowTimeStr(); s.directorRemark = remark; }
      else if (role === 'driver') { s.driverConfirmStatus = status; s.driverConfirmedBy = currentUser.username; s.driverConfirmedAt = dmyToday() + ' ' + nowTimeStr(); s.driverConfirmRemark = remark; }
      else { s.confirmStatus = status; s.confirmedBy = currentUser.username; s.confirmedAt = dmyToday() + ' ' + nowTimeStr(); s.confirmRemark = remark; }
    }
    
    showAlert('បានបញ្ជាក់', 'success');
    if (s) renderDetailModal(s, false);
    refreshCurrentPage();

    // 👇 NEW LOGIC: Bypass sheet check, generate directly for this checklist 👇
    if (role === 'manager' && status === 'Confirmed' && s) {
      console.log(`[Auto-PDF] Manager confirmed. Generating PDFs for ${s.checkId} silently...`);
      
      // Wait 1.5 seconds so the UI finishes updating and the backend saves the status
      setTimeout(() => {
        generatePdfsForSingleChecklist(s, true); 
      }, 1500);
    }
    // 👆 END OF NEW LOGIC 👆

  }).withFailureHandler(handleError).confirmSubmission({ 
    checkId: checkId, 
    managerUsername: currentUser.username, 
    status: status, 
    remark: remark, 
    role: role 
  });
};

window.toggleSignatureVisibility = function(btn) {
  window.include4thSignature = !window.include4thSignature;
  
  if (window.include4thSignature) {
    $(btn).removeClass('btn-outline-info').addClass('btn-info').html('<i class="bi bi-person-check"></i> PPAP');
  } else {
    $(btn).removeClass('btn-info').addClass('btn-outline-info').html('<i class="bi bi-person-check"></i> Other Company');
  }
};

function renderDetailModal(s, editConfirm){
  try {
    $('#modalTitle').text(s.checkId); 
    window.currentDetailCheckId = s.checkId;

    // --- 1. Handle TCC & FCC Signature Toggle ---
    const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {};
    const sg = String(eqData.specificGroup || '').trim().toUpperCase();
    const isTCC = (sg === 'TCC');
    window.include4thSignature = isTCC; 

        // 👇 Toggle Buttons
    let toggleHtml = '';
    if (String(s.group || '').trim() === 'រថយន្ត') {
      window.activeReportForm = 'standard'; // Reset to standard when opening
      toggleHtml = 
        '<div class="btn-group btn-group-sm me-1 mb-1" role="group">' +
          '<button type="button" id="btnFormStandard" class="btn btn-primary" onclick="setReportForm(\'standard\')">ថែទាំ</button>' +
          '<button type="button" id="btnFormTable" class="btn btn-outline-secondary" onclick="setReportForm(\'table\')">បាញ់ខ្លាញ់គោ</button>' +
        '</div>';
    } else {
      window.activeReportForm = 'standard'; 
    }

    // 👇 Action Buttons
    let actionHtml = toggleHtml + 
      '<div class="btn-group btn-group-sm mb-1" role="group">' +
        '<button class="btn btn-outline-primary" onclick="printCurrentReport()" title="Print">' +
          '<i class="bi bi-printer"></i><span class="d-none d-sm-inline ms-1">Print</span>' +
        '</button>' +
        '<button class="btn btn-outline-danger" onclick="saveCurrentReportImage()" title="Download image">' +
          '<i class="bi bi-file-earmark-image"></i><span class="d-none d-sm-inline ms-1">Image</span>' +
        '</button>' +
        '<button class="btn btn-outline-dark" onclick="saveCurrentReportPDF()" title="Download PDF">' +
          '<i class="bi bi-file-earmark-pdf"></i><span class="d-none d-sm-inline ms-1">PDF</span>' +
        '</button>' +
      '</div>';

        // If TCC&FCC, add the static view-only company label
    if (s.group === 'TCC&FCC') {
      // 👇 AUTO-DETECT COMPANY NAME 👇
      const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {};
      const compName = String(eqData.companyName || 'PPAP').trim().toUpperCase();
      
      // Automatically set the 4th signature rule
      window.include4thSignature = (compName === 'PPAP');
      
      // Determine the label text
      let labelText = 'PPAP';
      if (compName === 'PORT STEVEDORING COMPANY LIMITED') labelText = 'Port Stevedoring';
      else if (compName === 'PMNT') labelText = 'PMNT';
      else if (compName !== 'PPAP') labelText = compName;

      // View-only badge (No onclick toggle)
      actionHtml = 
        '<span class="badge bg-info text-dark d-flex align-items-center gap-1 me-2" style="font-size: 0.85rem; padding: 6px 10px; border: 1px solid #0dcaf0;">' +
          '<i class="bi bi-person-check"></i> ' + esc(labelText) +
        '</span>' + actionHtml;
    }
    
    $('#modalActionButtons').html(actionHtml).removeClass('d-none');

    detailItemFilter = 'all'; detailIssueCode  = 'all';
    
    const tplMap = {};
    const tplList = APP.templates[s.group + '|' + sg] || APP.templates[s.group + '|'] || APP.templates[s.group] || [];
    tplList.forEach(t => { tplMap[t.itemId] = t; });

    const sortedChecks = (s.checks || []).slice().sort((a, b) => {
      const getRank = (id) => {
        if (id.startsWith('EXT-TRK')) return 3;
        if (id.startsWith('EXT-TRL')) return 5;
        const num = parseInt(String(id).split(/[-\.]/)[0]);
        if (!isNaN(num)) {
          if (num >= 1 && num <= 22) return 1;
          if (num >= 23 && num <= 30) return 4;
        }
        return 2;
      };
      return getRank(a.itemId) - getRank(b.itemId);
    });

    const checks = sortedChecks.filter(c => { 
      const t = tplMap[c.itemId]; 
      if (t && String(t.inputType).toLowerCase() === 'header') return false; 
      return true; 
    });
    
    const enriched = checks.map(c => {
      const n = normalizeStatus(c.status);
      let photoIds = []; 
      if (Array.isArray(c.photoIds)) photoIds = c.photoIds.slice(); 
      else if (Array.isArray(c.photos)) photoIds = c.photos.map(p => p.fileId).filter(Boolean); 
      else if (c.photoId) photoIds = [c.photoId];
      
      const tpl = tplMap[c.itemId] || {};
      return { 
        itemId: c.itemId, 
        itemKhmer: tpl.itemKhmer || c.itemKhmer || c.itemId, 
        itemEng: tpl.itemEng || '', 
        frequency: tpl.frequency || '',
        status: n, 
        location: c.location || '', 
        note: c.note || '', 
        photoIds: photoIds 
      };
    });
    
    const okCount  = enriched.filter(c => c.status === 'N').length;
    const nokCount = enriched.filter(c => c.status && c.status !== 'N').length;

    const headerBySec = {};
    tplList.forEach(t => { if (String(t.inputType).toLowerCase() === 'header') headerBySec[String(t.itemId).trim()] = t; });
    
    headerBySec['EXT-TRK'] = { itemKhmer: 'ផ្នែកផ្សេងៗទៀត', itemEng: 'Others' };
    headerBySec['EXT-TRL'] = { itemKhmer: 'ផ្នែកផ្សេងៗទៀត', itemEng: 'Others' };

    const blocks = []; let lastSec = '__none__'; let letterIdx = 0; let currentBlock = null;
    
    enriched.forEach((c) => {
      const sec = sectionOf(c.itemId);
      if (sec && sec !== lastSec) { 
        lastSec = sec; letterIdx = 0; 
        currentBlock = { sec: sec, header: headerBySec[sec] || null, items: [] }; 
        blocks.push(currentBlock); 
      }
      else if (!sec) { 
        if (!currentBlock || currentBlock.sec) { 
          currentBlock = { sec: '', header: null, items: [] }; 
          blocks.push(currentBlock); 
        } 
      }
      letterIdx++; 
      const label = sec ? String.fromCharCode(96 + letterIdx) : letterIdx;
      currentBlock.items.push({ c: c, label: label });
    });

    const techObj = (APP.users || []).find(u => u.username === s.username);
    const techName = techObj ? techObj.fullName : (s.driverName || s.username || '—');
    const techPhone = techObj ? (techObj.phone || '') : '';

    const drvObj = (APP.users || []).find(d => d.username === s.driverUsername);
    const driverFullName = drvObj ? drvObj.fullName : (s.driverUsername || '—');
    const driverPhone = drvObj ? (drvObj.phone || '') : ''; 
    
    const trlObj = (APP.trailers || []).find(t => t.trailerId === s.trailerPlateNo);
    const trailerShortName = trlObj ? (trlObj.shortName || trlObj.trailerId) : (s.trailerPlateNo || '—');

    const isTruck = String(s.group || '').trim() === 'រថយន្ត';
    const showTrailer = isTruck && s.trailerPlateNo;

    const infoBlockCell = (icon, label, value, color) => `
      <div class="col-6">
        <div class="p-3 border rounded-3 bg-white h-100 shadow-sm">
          <div class="d-flex align-items-center mb-2">
            <i class="bi bi-${icon} text-${color} me-2" style="font-size: 1.1rem;"></i>
            <span class="text-muted small" style="letter-spacing: 0.5px; font-family: 'Battambang', 'Kantumruy Pro', sans-serif; font-weight: 400;">${label}</span>
          </div>
          <div class="text-dark" style="font-size: 1rem; font-family: 'Battambang', 'Kantumruy Pro', sans-serif; font-weight: 700;">${value || '-'}</div>
        </div>
      </div>
    `;
    
    const techCellHtml = `
      <div>${esc(techName)}</div>
      ${techPhone ? `<div class="small text-muted fw-normal mt-1" style="font-size: 0.85rem;"><i class="bi bi-telephone me-1"></i>${esc(techPhone)}</div>` : ''}
    `;

    const driverCellHtml = `
      <div>${esc(driverFullName)}</div>
      ${driverPhone ? `<div class="small text-muted fw-normal mt-1" style="font-size: 0.85rem;"><i class="bi bi-telephone me-1"></i>${esc(driverPhone)}</div>` : ''}
    `;

    const info = '<div class="p-3">' +
      '<div class="row g-2 mb-3">' +
        infoBlockCell('bi-truck', s.group || 'ឧបករណ៍', eqShort(s.equipmentId), 'primary') +
        (showTrailer ? infoBlockCell('bi-link', 'រ៉ឺម៉ក', trailerShortName, 'secondary') : '') +
        infoBlockCell('bi-person', 'អ្នកត្រួតពិនិត្យ', techCellHtml, 'success') +
        infoBlockCell('bi-person-badge', 'អ្នកបើកបរ', driverCellHtml, 'info') + 
        infoBlockCell('bi-calendar', 'កាលបរិច្ឆេទ', (s.date || '') + ' ' + (s.time || ''), 'warning') +
      '</div>' +

      (function(){ 
        if (isViewer()) return ''; 
        if (currentUser.role !== 'technician') return ''; 
        if (s.username !== currentUser.username) return ''; 
        if ((s.confirmStatus || 'Pending') !== 'Pending') return ''; 
        if (s.driverUsername && s.driverConfirmStatus === 'Confirmed') return ''; 
        return '<div class="mb-3 text-end"><button class="btn btn-sm btn-warning" onclick="editChecklist(\''+escAttr(s.checkId)+'\')"><i class="bi bi-pencil-square me-1"></i>Edit</button></div>'; 
      })() +

      '<div class="row g-2 mb-3">' +
        '<div class="col-6"><div class="stat-card" data-filter="N" onclick="filterDetailItems(\'N\')"><div class="num text-success">'+okCount+'</div><div class="lbl">N – Normal</div></div></div>' +
        '<div class="col-6"><div class="stat-card" data-filter="X" onclick="filterDetailItems(\'X\')"><div class="num text-danger">'+nokCount+'</div><div class="lbl">Issues</div></div></div>' +
      '</div>' +

      (function(){
        const { counts, fixed } = countIssueCodes(s); const codes = ['UF','NF','NA','Ad','T'];
        const cell = (value, label, count, fixedCount, active) => { const allFixed = count > 0 && fixedCount === count; return '<div class="tab list-tab issue-subtab ' + (active ? 'active' : '') + '" data-value="' + value + '" onclick="setDetailIssueCode(\'' + value + '\')"><div class="subtab-code">' + label + (allFixed ? ' <i class="bi bi-check-circle-fill pill-check"></i>' : '') + '</div><div class="subtab-count">' + count + '</div></div>'; };
        return '<div id="detailIssueSubtabs" class="tab-bar mb-3" style="display:none;justify-content:center;">' + cell('all', 'ទាំងអស់', counts.all, fixed.all, true) + codes.map(c => cell(c, c, counts[c], fixed[c], false)).join('') + '</div>';
      })() +

      buildConfirmSection(s, !!editConfirm) +

      '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-list-check me-2"></i>Items</span><small class="text-muted" id="detailItemCount">'+enriched.length+' shown</small></div><div class="card-body p-2" id="detailItemsList"></div></div>' +

      (s.remark ? '<div class="card mb-3"><div class="card-body"><div class="small text-muted">Remark</div><div>'+esc(s.remark)+'</div></div></div>' : '') + 
    '</div>';

    $('#modalBody').html(info);
    renderDetailItemsList(s);
    
    let modalEl = document.getElementById('detailModal');
    if (!modalEl) throw new Error("detailModal element not found in DOM");
    
    if (window.currentDetailModal) {
      window.currentDetailModal.show();
    } else {
      let modal = bootstrap.Modal.getInstance(modalEl);
      if (!modal) modal = new bootstrap.Modal(modalEl);
      modal.show();
    }

  } catch (err) {
    console.error(err);
    showAlert("Error rendering modal: " + err.message, 'danger');
  }
}

window.filterDetailItems = function(status){
  const isSame = (detailItemFilter === status);
  detailItemFilter = isSame ? 'all' : status;
  detailIssueCode  = 'all';
  $('.stat-card[data-filter]').removeClass('active');
  if (detailItemFilter !== 'all') $('.stat-card[data-filter="'+detailItemFilter+'"]').addClass('active');
  const $sub = $('#detailIssueSubtabs');
  if (detailItemFilter === 'X') { $sub.show(); $sub.find('.list-tab').removeClass('active'); $sub.find('.list-tab[data-value="all"]').addClass('active'); }
  else $sub.hide();
  const sub = APP.submissions.find(x => x.checkId === window.currentDetailCheckId);
  if (!sub) return; renderDetailItemsList(sub);
};

window.setDetailIssueCode = function(code){
  detailIssueCode = code;
  $('#detailIssueSubtabs .list-tab').removeClass('active'); $('#detailIssueSubtabs .list-tab[data-value="' + code + '"]').addClass('active');
  const sub = APP.submissions.find(x => x.checkId === window.currentDetailCheckId);
  if (!sub) return; renderDetailItemsList(sub);
};

function renderDetailItemsList(s){
  const tplMap = {};
  const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {};
  const sg = eqData.specificGroup || '';
  const tplList = APP.templates[s.group + '|' + sg] || APP.templates[s.group + '|'] || APP.templates[s.group] || [];
  tplList.forEach(t => { tplMap[t.itemId] = t; });

  const headerBySec = {};
  tplList.forEach(t => { if (String(t.inputType).toLowerCase() === 'header') headerBySec[String(t.itemId).trim()] = t; });
  
  // ★ Inject Extra Headers
  headerBySec['EXT-TRK'] = { itemKhmer: 'ផ្នែកផ្សេងៗទៀត', itemEng: 'Others' };
  headerBySec['EXT-TRL'] = { itemKhmer: 'ផ្នែកផ្សេងៗទៀត', itemEng: 'Others' };

    // ★ SORT: Move EXT-TRK right after 22, and EXT-TRL right after 30
  const sortedChecks = (s.checks || []).slice().sort((a, b) => {
    const getRank = (id) => {
      if (id.startsWith('EXT-TRK')) return 3;
      if (id.startsWith('EXT-TRL')) return 5;
      const num = parseInt(String(id).split(/[-\.]/)[0]);
      if (!isNaN(num)) {
        if (num >= 1 && num <= 22) return 1;
        if (num >= 23 && num <= 30) return 4;
      }
      return 2;
    };
    return getRank(a.itemId) - getRank(b.itemId);
  });

  // 👇 NEW: Filter out blank items (Only for TCC&FCC) 👇
  const isTCC = String(s.group || '').trim() === 'TCC&FCC';
  
  const checks = sortedChecks.filter(c => { 
    const t = tplMap[c.itemId]; 
    if (t && String(t.inputType).toLowerCase() === 'header') return false; 
    
    // If it's TCC&FCC and the status is blank, don't show it in the view
    if (isTCC && (!c.status || String(c.status).trim() === '')) return false;
    
    return true; 
  });

  // Create continuous number map
  const numberMap = {}; let globalNum = 0;
  checks.forEach(c => {
    globalNum++;
    let label = globalNum;
    
    // Extract letter if item ID has a dash (e.g., '1-A' -> 'A')
    if (String(c.itemId).includes('-') && !String(c.itemId).startsWith('EXT-')) {
      const parts = String(c.itemId).split('-');
      label = parts[parts.length - 1]; 
    }
    numberMap[c.itemId] = label;
  });

  const blocks = []; let lastSec = '__none__'; let currentBlock = null;
  checks.forEach(c => {
    const sec = sectionOf(c.itemId); const n = normalizeStatus(c.status);
    let match = false;
    if (detailItemFilter === 'all') match = true;
    else if (detailItemFilter === 'N') match = (n === 'N');
    else if (detailItemFilter === 'X') { if (n && n !== 'N') { match = (detailIssueCode === 'all') ? true : (n === detailIssueCode); } }
    if (!match) return;

    if (sec && sec !== lastSec) { lastSec = sec; currentBlock = { sec: sec, header: headerBySec[sec] || null, items: [] }; blocks.push(currentBlock); }
    else if (!sec && (!currentBlock || currentBlock.sec)) { currentBlock = { sec: '', header: null, items: [] }; blocks.push(currentBlock); }

    let photos = []; if (Array.isArray(c.photos)) photos = c.photos.map(p => ({ fileId: p.fileId || '', thumb: p.thumb || '' })); else if (Array.isArray(c.photoIds)) photos = c.photoIds.map(id => ({ fileId: id, thumb: '' })); else if (c.photoId) photos = [{ fileId: c.photoId, thumb: '' }];
    const tpl = tplMap[c.itemId] || {};
    const mtnLast = mtnLastUpdate(s);
    const iMeta = mtnItemMeta(s, c.itemId);
    currentBlock.items.push({ itemId: c.itemId, itemKhmer: tpl.itemKhmer || c.itemKhmer || c.itemId, itemEng: tpl.itemEng || '', frequency: tpl.frequency || '', status: n, location: c.location || '', note: c.note || '', photos: photos, label: numberMap[c.itemId], mtnStatus: iMeta.status, mtnBy: iMeta.by || (iMeta.status ? ((mtnLast && mtnLast.by) || s.mtnBy || '') : ''), mtnAt: iMeta.at || (iMeta.status ? ((mtnLast && mtnLast.at) || s.mtnAt || '') : ''), mtnRemark: iMeta.remark || (iMeta.status ? ((mtnLast && mtnLast.remark) || s.mtnRemark || '') : '') });
  });

  let truckBannerShown = false;
  let trailerBannerShown = false;

  const itemsHtml = blocks.map(block => {
    let html = '';
    
    // ★ Determine if this block belongs to Truck or Trailer
    const secNum = parseInt(block.sec);
    const isTruck = (secNum >= 1 && secNum <= 22) || block.sec === 'EXT-TRK';
    const isTrailer = (secNum >= 23 && secNum <= 30) || block.sec === 'EXT-TRL';

    // ★ Insert the Trucks Banner
    if (isTruck && !truckBannerShown) {
       html += '<div class="section-banner" style="position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); background:#7A2B4A; color:#fff; text-align:center; padding:6px; font-weight:bold; margin-top:15px; margin-bottom:10px; border-radius:4px; font-size:14px;">Tractor / រថយន្ត</div>';
       truckBannerShown = true;
    }
    // ★ Insert the Trailers Banner
    if (isTrailer && !trailerBannerShown) {
       html += '<div class="section-banner" style="position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); background:#7A2B4A; color:#fff; text-align:center; padding:6px; font-weight:bold; margin-top:15px; margin-bottom:10px; border-radius:4px; font-size:14px;">Trailer / រ៉ឺម៉ក</div>';
       trailerBannerShown = true;
    }

    // Render the actual section header (e.g., "1. Wheels and tires")
    if (block.header) {
      let title = block.header.itemKhmer;
      if (!title.startsWith(block.sec + '.') && !block.sec.startsWith('EXT-')) {
        title = '<span class="sec-num">' + esc(block.sec) + '.</span>' + esc(title);
      }
      html += '<div class="section-divider"><div class="sec-kh">' + title + '</div>' + (block.header.itemEng ? '<div class="sec-en">' + esc(block.header.itemEng) + '</div>' : '') + '</div>';
    }
    
    // Render the items
    block.items.forEach(item => { html += renderDetailItemRow(item); });
    return html;
  }).join('');

  $('#detailItemsList').html(itemsHtml);
  const shown = $('#detailItemsList .check-item').length;
  $('#detailItemCount').text(shown + ' shown');
}

function renderDetailItemRow(c){
  const isOk     = (c.status === 'N');
  const badgeCls = isOk ? 'status-N' : ('status-' + (c.status || ''));
  const caseStatus = c.mtnStatus || '';
  const statusInfo = mtnStatusInfo(caseStatus);
  const showRepair = !!c.status && c.status !== 'N' && caseStatus !== '';

  const hasL = c.location && c.location.indexOf('L') !== -1;
  const hasR = c.location && c.location.indexOf('R') !== -1;

  // ★ Check if this is an Extra Item (used for hiding the number)
  const isExtra = String(c.itemId).startsWith('EXT-');

  let locChip = '';
  // ★ REMOVED: The "Extra Item" badge logic
  
  if (c.frequency) {
    locChip = '<span class="badge bg-info text-dark ms-2" style="font-size:.68rem;">' + esc(c.frequency) + '</span>';
  } else {
    if (hasL) locChip += '<span class="badge bg-secondary ms-2" style="font-size:.68rem;">Left</span>';
    if (hasR) locChip += '<span class="badge bg-secondary ms-2" style="font-size:.68rem;">Right</span>';
  }

  // Hide the number prefix for extra items
  const numHtml = isExtra ? '' : '<span class="item-num">' + esc(c.label) + '.</span>';

  const photos     = c.photos || [];
  const photoCount = photos.length;
  const hasPhoto   = photoCount > 0;
  const clickAttrs = hasPhoto ? ' onclick="toggleItemPhoto(\'' + escAttr(c.itemId) + '\', this)" style="cursor:pointer;"' : '';
  const fixedChip = showRepair ? '<span class="badge bg-' + statusInfo.badge + ' me-2" style="font-size:.68rem;"><i class="bi ' + statusInfo.icon + ' me-1"></i>' + esc(statusInfo.label) + '</span>' : '';
  const fixedDetail = (showRepair && (c.mtnBy || c.mtnAt)) ? '<div class="small mt-1"><i class="bi ' + statusInfo.icon + ' me-1 text-' + statusInfo.badge + '"></i><span class="text-' + statusInfo.badge + '">' + esc(statusInfo.label) + '</span> by <strong>' + esc(c.mtnBy || '—') + '</strong>' + (c.mtnAt ? ' · ' + esc(c.mtnAt) : '') + (c.mtnRemark ? '<div class="mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(c.mtnRemark) + '</div>' : '') + '</div>' : '';

  return '<div class="check-item detail-item" data-item="' + escAttr(c.itemId) + '" data-status="' + (c.status || '') + '"' + (showRepair ? ' data-mtn="' + escAttr(caseStatus) + '"' : '') + clickAttrs + '><div class="row-line"><div class="label-part">' + numHtml + '<div class="item-text"><span class="item-name-kh">' + esc(c.itemKhmer) + '</span>' + (c.itemEng ? '<span class="item-name-en">' + esc(c.itemEng) + '</span>' : '') + '</div></div><div class="controls-group">' + fixedChip + (hasPhoto ? '<i class="bi bi-image text-primary me-2" title="Has ' + photoCount + ' photo(s)"></i>' + (photoCount > 1 ? '<span class="badge bg-secondary me-2" style="font-size:.6rem;">' + photoCount + '</span>' : '') : '') + (c.status ? '<span class="status-badge ' + badgeCls + '">' + esc(c.status) + '</span>' : '') + locChip + '</div></div>' + (c.note ? '<div class="small text-danger mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(c.note) + '</div>' : '') + fixedDetail + (hasPhoto ? '<div class="item-photo-reveal" data-item="' + escAttr(c.itemId) + '" data-photo-data=\'' + escAttr(JSON.stringify(photos)) + '\' style="display:none;"></div>' : '') + '</div>';
}

function infoCell(icon, label, value, color){ return '<div class="col-6"><div class="info-row"><i class="bi bi-'+icon+' icon text-'+color+'"></i><div><span class="label">'+esc(label)+'</span><span class="value">'+esc(value||'-')+'</span></div></div></div>'; }

window.editChecklist = function(checkId){
  const s = APP.submissions.find(x => x.checkId === checkId);
  if (!s) { showAlert('Not found', 'warning'); return; }
  if (s.username !== currentUser.username) { showAlert('Only the original submitter can edit', 'warning'); return; }
  if ((s.confirmStatus || 'Pending') !== 'Pending') { showAlert('Cannot edit — already confirmed by Admin', 'warning'); return; }
  
  if (s.driverUsername && s.driverConfirmStatus === 'Confirmed') { showAlert('Cannot edit — already confirmed by Driver', 'warning'); return; }
  
  // 1. Safely hide the modal
  if (window.currentDetailModal) {
    window.currentDetailModal.hide();
  } else {
    const modalEl = document.getElementById('detailModal');
    if (modalEl) {
      const m = bootstrap.Modal.getInstance(modalEl);
      if (m) m.hide();
    }
  }

  // 2. Wait for the modal animation to finish, then clean up and load the form
  setTimeout(() => {
    // Force remove the dark background and unlock scrolling
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open').css('overflow', 'auto');
    
    // 3. Route to the correct form based on the group
    const grp = String(s.group || '').trim();
    if (grp === 'TCC&FCC') {
      if (typeof loadAndRenderChecklistFormFCC === 'function') {
        loadAndRenderChecklistFormFCC(s.equipmentId, s.group, s.equipmentId, s.driverUsername, s.assignmentId, s);
      }
    } else if (grp === 'RTG' || grp === 'គ្រឿងចក្រ') {
      if (typeof loadAndRenderChecklistFormRTG === 'function') {
        loadAndRenderChecklistFormRTG(s.equipmentId, s.group, s.equipmentId, s.driverUsername, s.assignmentId, s);
      }
    } else {
      loadAndRenderChecklistForm(s.equipmentId, s.group, s.equipmentId, s.driverUsername, s.assignmentId, s);
    }
  }, 300); // 300ms allows the fade-out animation to complete
};

window.addCommentPrompt = function(checkId){
  const text = prompt('Add comment:');
  if (!text || !text.trim()) return;
  showLoading('កំពុងរក្សាទុក...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      showAlert('បានបន្ថែមមតិ', 'success');
      const sub = APP.submissions.find(x => x.checkId === checkId);
      if (sub) { if (!sub.comments) sub.comments = []; sub.comments.push({ by: currentUser.username, name: currentUser.fullName, role: currentUser.role, at: new Date().toISOString(), text: text.trim() }); renderDetailModal(sub, false); }
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).addComment({ checkId: checkId, username: currentUser.username, fullName: currentUser.fullName, role: currentUser.role, text: text.trim() });
};

/* =========================================================
   DASHBOARD & MTN
   ========================================================= */

/* =========================================================
   MTN REPAIR-REQUEST FLOW HELPERS (Monthly)
   Case status : '' (not requested) | Requested | Pending |
                 Done | Confirmed
   Item status : '' (nothing yet)   | Requested | Not Request |
                 Waiting Repairing  | Waiting Spare Part | Repaired
   'Not Request' is display-only: it is shown in badges/chips/tables but
   is never offered as a choice in any dropdown.
   The checklist (case) status is always the rollup of its items; the
   Repair Manager then signs a Done case off as 'Confirmed' (sign-off
   never rewrites the per-item statuses).
   ========================================================= */
const MTN_CASE_STATUS_LIST = ['Requested', 'Pending', 'Done', 'Confirmed'];
const MTN_ITEM_STATUS_LIST = ['Requested', 'Not Request', 'Waiting Repairing', 'Waiting Spare Part', 'Repaired'];
// Statuses the Repair Service can actually pick (display-only ones excluded)
const MTN_ITEM_SELECT_LIST = MTN_ITEM_STATUS_LIST.filter(s => s !== 'Not Request');
const MTN_STATUS_INFO = {
  ''                    : { label: 'Not Requested',      badge: 'secondary', icon: 'bi-dash-circle' },
  'Requested'           : { label: 'Requested',          badge: 'warning',   icon: 'bi-send-check' },
  'Pending'             : { label: 'Pending',            badge: 'info',      icon: 'bi-hourglass-split' },
  'Done'                : { label: 'Done',               badge: 'success',   icon: 'bi-check-circle-fill' },
  'Confirmed'           : { label: 'Confirmed',          badge: 'success',   icon: 'bi-patch-check-fill' },
  'Not Request'         : { label: 'Not Request',        badge: 'dark',      icon: 'bi-slash-circle' },
  'Waiting Repairing'   : { label: 'Waiting Repairing',  badge: 'info',      icon: 'bi-tools' },
  'Waiting Spare Part'  : { label: 'Waiting Spare Part', badge: 'primary',   icon: 'bi-box-seam' },
  'Repaired'            : { label: 'Repaired',           badge: 'success',   icon: 'bi-check-circle-fill' }
};
function mtnStatusInfo(status){ return MTN_STATUS_INFO[status] || MTN_STATUS_INFO['']; }

/* Old rows only knew 'Waiting Repair' / 'Waiting Spare Part' / 'Repaired' */
function mtnNormCaseStatus(raw){
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'requested') return 'Requested';
  if (low === 'confirmed' || low === 'confirm') return 'Confirmed';
  if (low === 'done' || low === 'repaired' || low === 'completed' || low === 'fixed') return 'Done';
  if (low === 'pending' || low === 'partial') return 'Pending';
  if (low.indexOf('spare') !== -1 || low.indexOf('repair') !== -1) return 'Pending';
  return '';
}
function mtnNormItemStatus(raw){
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'requested') return 'Requested';
  if (low === 'not request' || low === 'not requested' || low === 'no request' || low === 'norequest') return 'Not Request';
  if (low === 'repaired' || low === 'completed' || low === 'fixed' || low === 'done') return 'Repaired';
  if (low === 'pending' || low === 'partial') return 'Waiting Repairing';
  if (low.indexOf('spare') !== -1) return 'Waiting Spare Part';
  if (low.indexOf('repair') !== -1) return 'Waiting Repairing';
  return '';
}
/* Case -> item status (used by the legacy case-level setter) */
function mtnCaseToItemStatus(caseStatus){
  const st = mtnNormCaseStatus(caseStatus);
  if (st === 'Confirmed') return 'Repaired';
  if (st === 'Done') return 'Repaired';
  if (st === 'Pending') return 'Waiting Repairing';
  if (st === 'Requested') return 'Requested';
  return '';
}
function mtnHasRequest(sub){
  if (!sub) return false;
  if (sub.mtnItems && sub.mtnItems.__request) return true;
  return !!String(sub.mtnBy || '').trim();
}
function mtnCaseStatus(sub){
  const low = String((sub && sub.mtnStatus) || '').trim().toLowerCase();
  // Legacy 'Pending' / 'None' meant "nothing was requested yet"
  if ((low === 'pending' || low === 'none') && !mtnHasRequest(sub)) return '';
  return mtnNormCaseStatus(sub && sub.mtnStatus);
}
function mtnRequestMeta(sub){
  const m = (sub && sub.mtnItems) || {};
  let meta = (m.__request && typeof m.__request === 'object') ? m.__request : null;
  if (!meta) {
    // Legacy rows: only MTN-By / MTN-At / MTN-Remark exist
    meta = {
      requestedBy: sub ? String(sub.mtnBy || '') : '',
      requestedAt: sub ? String(sub.mtnAt || '') : '',
      history: [],
      lastRemark: sub ? String(sub.mtnRemark || '') : ''
    };
  }
  if (!Array.isArray(meta.history)) meta.history = [];
  return meta;
}
function mtnLastUpdate(sub){
  const meta = mtnRequestMeta(sub);
  if (meta.history.length) return meta.history[meta.history.length - 1];
  if (meta.updatedBy || meta.updatedAt || (sub && sub.mtnAt)) {
    return {
      status: mtnCaseStatus(sub),
      by: meta.updatedBy || (sub && sub.mtnBy) || '',
      at: meta.updatedAt || (sub && sub.mtnAt) || '',
      remark: meta.lastRemark || ''
    };
  }
  return null;
}
/* ---------- Per issue-item repair status ---------- */
function mtnItemStatuses(sub){
  const meta = mtnRequestMeta(sub);
  return (meta && meta.itemStatus && typeof meta.itemStatus === 'object') ? meta.itemStatus : {};
}
/* Items created before item-level statuses inherit the old case status */
function mtnItemFallbackStatus(sub){
  const low = String((sub && sub.mtnStatus) || '').trim().toLowerCase();
  if (!low) return '';
  if (low === 'confirmed' || low === 'confirm') return 'Repaired';
  if (low === 'repaired' || low === 'completed' || low === 'fixed' || low === 'done') return 'Repaired';
  if (low === 'requested') return 'Requested';
  if (low.indexOf('spare') !== -1) return 'Waiting Spare Part';
  if (low.indexOf('repair') !== -1) return 'Waiting Repairing';
  const caseSt = mtnCaseStatus(sub);
  if (caseSt === 'Requested') return 'Requested';
  if (caseSt === 'Done') return 'Repaired';
  if (caseSt === 'Pending') return 'Waiting Repairing';
  return '';
}
function mtnItemStatusOf(sub, itemId){
  const rec = mtnItemStatuses(sub)[itemId];
  const st = rec ? mtnNormItemStatus(rec.status) : '';
  return st || mtnItemFallbackStatus(sub);
}
function mtnItemMeta(sub, itemId){
  const rec = mtnItemStatuses(sub)[itemId] || {};
  return {
    status: mtnItemStatusOf(sub, itemId),
    by: String(rec.by || ''),
    at: String(rec.at || ''),
    remark: String(rec.remark || '')
  };
}
function mtnItemDone(sub, itemId){
  const st = mtnItemStatusOf(sub, itemId);
  return st === 'Repaired' || st === 'Not Request';
}
function mtnItemProgress(sub){
  const items = getIssueItems(sub);
  let done = 0;
  items.forEach(i => { if (mtnItemDone(sub, i.itemId)) done++; });
  return { done: done, total: items.length };
}
/* Item -> case rollup:
   - every item Repaired / Not Request -> Done
   - anything started (or partially closed) -> Pending
   - otherwise -> Requested */
function mtnDeriveCaseStatus(sub, overrides){
  const items = getIssueItems(sub);
  if (!items.length) return mtnCaseStatus(sub);
  let resolved = 0, moving = false;
  items.forEach(i => {
    const has = !!(overrides && Object.prototype.hasOwnProperty.call(overrides, i.itemId));
    const st = has ? mtnNormItemStatus(overrides[i.itemId]) : mtnItemStatusOf(sub, i.itemId);
    if (st === 'Repaired' || st === 'Not Request') resolved++;
    else if (st && st !== 'Requested') moving = true;
  });
  if (resolved === items.length) return 'Done';
  if (moving || resolved) return 'Pending';
  return 'Requested';
}
/* true only when the last update is not simply the request itself
   (prevents "Requested by A · 22:33 / Updated by A · 22:33" duplicates) */
function mtnHasRealUpdate(sub){
  const meta = mtnRequestMeta(sub);
  const last = mtnLastUpdate(sub);
  if (!last || !last.by) return false;
  if (meta.requestedBy && last.by === meta.requestedBy && String(last.at || '') === String(meta.requestedAt || '')) return false;
  return true;
}
function mtnIsRequester(){ return !!currentUser && normRole(currentUser.role) === 'admin'; }
function mtnIsRepairer(){ return !!currentUser && normRole(currentUser.role) === 'repair'; }
function mtnIsRepairManager(){ return !!currentUser && normRole(currentUser.role) === 'repair-manager'; }
function mtnCanAct(){ return mtnIsRequester() || mtnIsRepairer() || mtnIsRepairManager(); }
/* Done + Confirmed are both "the repair work is finished" for the dashboards */
function mtnIsClosedStatus(status){ return status === 'Done' || status === 'Confirmed'; }
function mtnRoleNote(){
  if (mtnIsRequester())     return 'Admin: make the repair request for a case, then follow it up here.';
  if (mtnIsRepairer())      return 'Repair Service: update the repair status of every issue item.';
  if (mtnIsRepairManager()) return 'Repair Manager: confirm (sign off) the cases the Repair Service has finished.';
  return 'Read-only view — requests are created by Admin, repaired by Repair Service and confirmed by Repair Manager.';
}
function mtnCompanyOf(equipmentId){
  const eq = (APP.equipmentMap && APP.equipmentMap[equipmentId]) ? APP.equipmentMap[equipmentId] : {};
  return String(eq.companyName || '').trim();
}
function mtnMonthOf(dateStr){
  const m = String(dateStr || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? (m[3] + '-' + String(m[2]).padStart(2, '0')) : '';
}
function mtnStatusBadge(subOrStatus){
  const isSub = !!(subOrStatus && typeof subOrStatus === 'object');
  const st = isSub ? mtnCaseStatus(subOrStatus) : mtnNormCaseStatus(subOrStatus);
  const info = mtnStatusInfo(st);
  const tone = st === 'Confirmed' ? 'conf'
             : st === 'Done' ? 'done'
             : st === 'Pending' ? 'pend'
             : st === 'Requested' ? 'req' : 'nr';
  let tip = info.label;
  let countHtml = '';
  if (isSub && st) {
    const p = mtnItemProgress(subOrStatus);
    if (p.total > 1) {
      countHtml = '<span class="mtn-pill-c">' + p.done + '/' + p.total + '</span>';
      tip += ' — ' + p.done + ' of ' + p.total + ' issue item(s) done';
    }
  }
  return '<span class="mtn-pill is-' + tone + '" title="' + escAttr(tip) + '"><i class="bi ' + info.icon + '"></i>' + esc(info.label) + countHtml + '</span>';
}
function mtnActionHtml(sub){
  const st = mtnCaseStatus(sub);
  const cid = escAttr(sub.checkId);

  /* Repair Manager: sign off a case the Repair Service has finished */
  if (mtnIsRepairManager()) {
    if (st === 'Done') {
      return '<button class="btn btn-sm btn-success" onclick="confirmMtnCase(\'' + cid + '\')"><i class="bi bi-patch-check me-1"></i>Confirm</button>';
    }
    if (st === 'Confirmed') {
      return '<span class="mtn-pill is-conf" style="font-size:.62rem;" title="Signed off by Repair Manager"><i class="bi bi-patch-check-fill"></i>Confirmed</span>';
    }
    return '<span class="small text-muted"><i class="bi bi-hourglass-split me-1"></i>' + (st === '' ? 'No request yet' : 'Awaiting repair') + '</span>';
  }

  if (mtnIsRequester()) {
    if (st === '') {
      return '<button class="btn btn-sm btn-warning" onclick="requestMtnRepair(\'' + cid + '\')"><i class="bi bi-send me-1"></i>Make a Request</button>';
    }
    if (st === 'Done' || st === 'Confirmed') {
      return '<button class="btn btn-sm btn-outline-warning" onclick="requestMtnRepair(\'' + cid + '\')"><i class="bi bi-arrow-repeat me-1"></i>Request Again</button>';
    }
    return '<span class="small text-muted"><i class="bi bi-hourglass-split me-1"></i>Awaiting Repair Service</span>';
  }

  if (mtnIsRepairer() && st === 'Confirmed') {
    return '<span class="small text-muted"><i class="bi bi-patch-check-fill me-1"></i>Confirmed by Repair Manager</span>';
  }
  if (mtnIsRepairer() && st !== '') {
    return '<button class="btn btn-sm btn-outline-primary" onclick="openMtnStatusEditor(\'' + cid + '\')"><i class="bi bi-pencil-square me-1"></i>Update</button>';
  }
  return '<span class="small text-muted">—</span>';
}

function renderDashboard(){
  if (!APP.loaded) { bootLoad(); return; }
  if (currentUser.role === 'technician' || currentUser.role === 'driver') { showPage('home'); return; }

  const subTabBar = '<div id="mtnSubTabBar" class="tab-bar mb-3" style="border-radius:10px;"><div class="tab ' + (dashboardSubTab === 'overview' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setDashboardSubTab(\'overview\')"><i class="bi bi-bar-chart me-1"></i>Dashboard</div><div class="tab ' + (dashboardSubTab === 'mtn' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setDashboardSubTab(\'mtn\')"><i class="bi bi-wrench-adjustable me-1"></i>MTN Management</div><div class="tab ' + (dashboardSubTab === 'status' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setDashboardSubTab(\'status\')"><i class="bi bi-clipboard2-pulse me-1"></i>MTN Status</div></div>';
  
  if (dashboardSubTab === 'mtn') { renderMtnManagement(subTabBar); return; }
  if (dashboardSubTab === 'status') { renderMtnStatusTab(subTabBar); return; }

  const subs        = APP.submissions;
  const todaySubs   = subs.filter(s => isToday(s.date));
  const issues      = subs.filter(s => s.overall === 'Issues');
  const pending     = subs.filter(s => (s.confirmStatus || 'Pending') === 'Pending');

  const attentionMap = {};
  subs.forEach(s => {
    const tplMap = {};
    const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {};
    const sg = eqData.specificGroup || '';
    const tplList = APP.templates[s.group + '|' + sg] || APP.templates[s.group + '|'] || APP.templates[s.group] || [];
    tplList.forEach(t => { tplMap[t.itemId] = t; });

    (s.checks || []).forEach(c => {
      if (normalizeStatus(c.status) === 'UF') {
        if (!mtnIsClosedStatus(mtnCaseStatus(s))) {
          const tpl = tplMap[c.itemId] || {};
          const kh = tpl.itemKhmer || c.itemId;
          const en = tpl.itemEng || '';
          const key = (en || kh || c.itemId).toLowerCase();

          if (!attentionMap[key]) {
            attentionMap[key] = { key, kh, en, count: 0, latest: s, itemIds: new Set() };
          }
          attentionMap[key].count++;
          attentionMap[key].itemIds.add(c.itemId);
          if (subMs(s) > subMs(attentionMap[key].latest)) attentionMap[key].latest = s;
        }
      }
    });
  });
  
  const attentionList = Object.values(attentionMap).sort((a, b) => b.count - a.count);
  const attentionSlice = needAttentionViewAll ? attentionList : attentionList.slice(0, 10);
  
  let needAttentionHtml = '';
  if (attentionList.length > 0) {
    const rows = attentionSlice.map(it => 
      '<div class="issue-row" onclick="goToMtnFiltered(\'' + escAttr(Array.from(it.itemIds).join(',')) + '\',\'' + escAttr(it.en || it.kh) + '\', true)">' +
        '<span class="rank text-danger"><i class="bi bi-wrench-adjustable"></i></span>' +
        '<div class="name">'+esc(it.kh)+'<small>'+esc(it.en)+'</small></div>' +
        '<span class="count text-danger">'+it.count+'×</span>' +
      '</div>'
    ).join('');
    
    let moreBtn = '';
    if (attentionList.length > 10) {
      moreBtn = needAttentionViewAll
        ? '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-danger" onclick="needAttentionViewAll = false; renderDashboard();">Show Less</button></div>'
        : '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-danger" onclick="needAttentionViewAll = true; renderDashboard();">View All (' + attentionList.length + ')</button></div>';
    }

    needAttentionHtml = `
      <div class="card mb-3 border-danger" style="border-width: 2px;">
        <div class="group-header bg-danger text-white d-flex justify-content-between align-items-center">
          <span><i class="bi bi-exclamation-octagon-fill me-2"></i>Need Attention (Urgent Fixing)</span>
          <span class="badge bg-white text-danger">${attentionList.length} items</span>
        </div>
        <div class="card-body p-2">
          ${rows}
          ${moreBtn}
        </div>
      </div>
    `;
  }

  const summaryHtml = '<div class="row g-2 mb-3"><div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillTo({status:\'all\',confirmStatus:\'all\',dateFrom:\'\',dateTo:\'\',group:\'all\',driver:\'all\',equipmentId:\'all\'})"><div class="num text-primary">'+subs.length+'</div><div class="lbl">សរុប</div></div></div><div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillTo({dateFrom:\''+isoToday()+'\',dateTo:\''+isoToday()+'\',status:\'all\'})"><div class="num text-info">'+todaySubs.length+'</div><div class="lbl">ថ្ងៃនេះ</div></div></div><div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillTo({confirmStatus:\'Pending-Admin\',dateFrom:\'\',dateTo:\'\',status:\'all\'})"><div class="num text-warning">'+pending.length+'</div><div class="lbl">រង់ចាំ Admin</div></div></div><div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillTo({status:\'Issues\',dateFrom:\'\',dateTo:\'\'})"><div class="num text-danger">'+issues.length+'</div><div class="lbl">Issues</div></div></div></div>';

  const issueMap = {};
  subs.forEach(s => { (s.checks || []).forEach(c => { const n = normalizeStatus(c.status); if (n && n !== 'N') { let nameKh = c.itemId, nameEn = ''; const eqData = (APP.equipmentMap && APP.equipmentMap[s.equipmentId]) ? APP.equipmentMap[s.equipmentId] : {}; const sg = eqData.specificGroup || ''; const tplList = APP.templates[s.group + '|' + sg] || APP.templates[s.group + '|'] || APP.templates[s.group] || []; tplList.forEach(t => { if(t.itemId === c.itemId) { nameKh = t.itemKhmer; nameEn = t.itemEng; } }); const key = (nameEn || nameKh || c.itemId).toLowerCase(); if (!issueMap[key]) issueMap[key] = { key: key, kh: nameKh, en: nameEn, itemIds: new Set(), count: 0 }; issueMap[key].itemIds.add(c.itemId); issueMap[key].count++; } }); });
  
  const topIssues = Object.values(issueMap).map(x => ({ key: x.key, kh: x.kh, en: x.en, itemIdsCsv: Array.from(x.itemIds).join(','), count: x.count })).sort((a, b) => b.count - a.count);
  const topIssuesSlice = topIssuesViewAll ? topIssues : topIssues.slice(0, 10);
  
  let topIssuesHtml = '';
  if (topIssues.length > 0) {
    const rows = topIssuesSlice.map((it, i) => 
      '<div class="issue-row" onclick="goToMtnFiltered(\'' + escAttr(it.itemIdsCsv) + '\',\'' + escAttr(it.en || it.kh) + '\', false)">' +
        '<span class="rank">'+(i+1)+'</span>' +
        '<div class="name">'+esc(it.kh)+'<small>'+esc(it.en)+'</small></div>' +
        '<span class="count">'+it.count+'×</span>' +
      '</div>'
    ).join('');
    
    let moreBtn = '';
    if (topIssues.length > 10) {
      moreBtn = topIssuesViewAll
        ? '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-primary" onclick="topIssuesViewAll = false; renderDashboard();">Show Less</button></div>'
        : '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-primary" onclick="topIssuesViewAll = true; renderDashboard();">View All (' + topIssues.length + ')</button></div>';
    }

    topIssuesHtml = `
      <div class="card mb-3">
        <div class="group-header"><i class="bi bi-exclamation-triangle-fill me-2 text-danger"></i>Top Issues</div>
        <div class="card-body p-2">
          ${rows}
          ${moreBtn}
        </div>
      </div>
    `;
  }

  const last7 = []; const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const dStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    const dLabel = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    const daySubs = subs.filter(s => s.date === dStr);
    last7.push({ label: dLabel, total: daySubs.length, ok: daySubs.filter(s => s.overall === 'OK').length, nok: daySubs.filter(s => s.overall === 'Issues').length, isoDate: isoDate(d) });
  }
  const maxDay = Math.max(1, ...last7.map(x => x.total));
  const timelineHtml = '<div class="card mb-3"><div class="group-header"><i class="bi bi-calendar-week me-2"></i>Last 7 Days</div><div class="card-body">' + last7.map(x => { const w = Math.round(x.total / maxDay * 100); const okW = x.total ? Math.round(x.ok / x.total * w) : 0; const nokW = x.total ? Math.round(x.nok / x.total * w) : 0; return '<div class="timeline-row clickable-card" onclick="drillTo({dateFrom:\''+x.isoDate+'\',dateTo:\''+x.isoDate+'\',status:\'all\'})"><span class="day">'+esc(x.label)+'</span><div class="track" style="width:'+Math.max(w,2)+'%;"><div class="seg-ok" style="width:'+okW+'%;"></div><div class="seg-nok" style="width:'+nokW+'%;"></div></div><span class="count">'+x.total+'</span></div>'; }).join('') + '</div></div>';

  const groupsWithData = (APP.filterOptions && APP.filterOptions.groups) ? APP.filterOptions.groups : []; const maxGroup = Math.max(1, ...groupsWithData.map(g => subs.filter(s => s.group === g).length));
  const groupHtml = groupsWithData.length > 1 ? '<div class="card mb-3"><div class="group-header"><i class="bi bi-diagram-3 me-2"></i>By Group</div><div class="card-body">' + groupsWithData.map(g => { const gSubs = subs.filter(s => s.group === g); const gIssues = gSubs.filter(s => s.overall === 'Issues').length; const pct = Math.round(gSubs.length / maxGroup * 100); return '<div class="dash-bar clickable-card" onclick="drillTo({group:\''+escAttr(g)+'\',status:\'all\',dateFrom:\'\',dateTo:\'\'})"><span class="lbl">'+esc(g)+'</span><div class="track"><div class="fill" style="width:'+pct+'%;background:'+(gIssues>0?'#dc3545':'#0d6efd')+'"></div></div><span class="val">'+gSubs.length+'</span></div>'; }).join('') + '</div></div>' : '';

  const recent = subs.slice().sort((a, b) => subMs(b) - subMs(a)).slice(0, 6);
  const recentHtml = recent.length > 0 ? '<div class="card mb-3"><div class="group-header"><i class="bi bi-clock-history me-2"></i>Recent Activity</div><div class="card-body p-0">' + recent.map(s => '<div class="activity-row" onclick="viewCheck(\''+escAttr(s.checkId)+'\')"><span class="dot '+(s.overall === 'Issues' ? 'nok' : 'ok')+'"></span><div class="info"><strong>'+esc(eqShort(s.equipmentId))+'</strong> · '+esc(s.driverName)+'<small>'+esc(s.group)+' · '+esc(s.checkId)+'</small></div><span class="time">'+esc(s.time)+'</span></div>').join('') + '</div></div>' : '';

  $('#app').html('<div class="container-fluid px-0"><div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0"><i class="bi bi-bar-chart me-2"></i>Dashboard</h5><small class="text-muted">'+esc(currentUser.group === 'ALL' ? 'All groups' : currentUser.group)+'</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'dashboard\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + subTabBar + summaryHtml + needAttentionHtml + topIssuesHtml + timelineHtml + groupHtml + recentHtml + '</div>');
}

let needAttentionViewAll = false;
let topIssuesViewAll = false;

window.goToMtnFiltered = function(itemIds, label, isUrgentOnly) {
  dashboardSubTab = 'mtn';
  mtnFilter = 'all';
  mtnItemFilter = String(itemIds).split(',').map(s => s.trim()).filter(Boolean);
  mtnItemLabel = label;
  mtnIsUrgentOnly = isUrgentOnly;
  renderDashboard();
};

window.clearMtnItemFilter = function() {
  mtnItemFilter = null;
  mtnItemLabel = '';
  renderMtnManagement(document.getElementById('mtnSubTabBar').outerHTML);
};

window.setDashboardSubTab = function(tab){ 
  dashboardSubTab = tab; 
  if (tab === 'overview') {
     needAttentionViewAll = false;
     topIssuesViewAll = false;
  }
  renderDashboard(); 
};

window.setMtnFilter = function(f){ 
  mtnFilter = f; 
  mtnDisplayLimit = 10; 
  renderDashboard(); 
};
window.loadMoreMtn = function() {
  mtnDisplayLimit += 10;
  renderMtnManagement(document.getElementById('mtnSubTabBar').outerHTML);
};

function isIssueCheck(c){ const n = normalizeStatus(c.status); return n && n !== 'N'; }

/* Compact result-code pill: re-uses the checklist colours (.status-badge.status-XX) */
function mtnCodeBadge(code, size){
  const known = ['N', 'UF', 'NF', 'NA', 'Ad', 'T'];
  const cls = known.indexOf(code) === -1 ? 'status-NF' : ('status-' + code);
  return '<span class="status-badge ' + cls + ' flex-shrink-0" style="font-size:' + (size || '.58rem') + ';min-width:0;padding:1px 6px;line-height:1.35;">' + esc(code || '—') + '</span>';
}

/* Truck / trailer part of an item — same split as the checklist view banners */
function mtnItemPartOf(itemId){
  const sec = sectionOf(itemId);
  if (!sec) return '';
  if (sec === 'EXT-TRK') return 'truck';
  if (sec === 'EXT-TRL') return 'trailer';
  const num = parseInt(sec, 10);
  if (isNaN(num)) return '';
  if (num >= 1 && num <= 22) return 'truck';
  if (num >= 23 && num <= 30) return 'trailer';
  return '';
}

function getIssueItems(sub){
  const tplMap = {};
  const eqData = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
  const sg = eqData.specificGroup || '';
  const tplList = APP.templates[sub.group + '|' + sg] || APP.templates[sub.group + '|'] || APP.templates[sub.group] || [];
  tplList.forEach(t => { tplMap[t.itemId] = t; });

  return (sub.checks || []).filter(isIssueCheck).map(c => {
    const t = tplMap[c.itemId] || {};
    return {
      itemId: c.itemId,
      code: normalizeStatus(c.status),
      location: c.location || '',
      note: c.note || '',
      // Extra items have no template row: the checklist view shows the name
      // saved with the check, so use the same fallback chain here.
      itemKhmer: t.itemKhmer || c.itemKhmer || c.itemId,
      itemEng: t.itemEng || '',
      frequency: t.frequency || '',
      isExtra: String(c.itemId).startsWith('EXT-')
    };
  }).sort((a, b) => {
    // Checklist order: truck sections -> EXT-TRK -> trailer sections -> EXT-TRL
    const partRank = { truck: 0, '': 1, trailer: 2 };
    const secRank = (id) => {
      const sec = sectionOf(id);
      if (sec === 'EXT-TRK' || sec === 'EXT-TRL') return 999;
      const n = parseInt(sec, 10);
      return isNaN(n) ? 500 : n;
    };
    const pa = mtnItemPartOf(a.itemId), pb = mtnItemPartOf(b.itemId);
    return (partRank[pa] - partRank[pb]) ||
           (secRank(a.itemId) - secRank(b.itemId)) ||
           String(a.itemId).localeCompare(String(b.itemId));
  });
}

// Kept for backward compatibility: one repair status per checklist case
// replaces the old per-item Pending / Partial / Completed rollup.
function mtnRollup(sub){ return mtnCaseStatus(sub); }

let mtnDisplayLimit = 10;
let mtnItemFilter = null;
let mtnItemLabel = '';
let mtnIsUrgentOnly = false;

function renderMtnManagement(subTabBar){
  let issues = (APP.submissions || []).filter(s => s.overall === 'Issues').sort((a, b) => subMs(b) - subMs(a));

  if (mtnItemFilter && mtnItemFilter.length > 0) {
    issues = issues.filter(sub => (sub.checks || []).some(c => {
      if (!mtnItemFilter.includes(c.itemId)) return false;
      if (mtnIsUrgentOnly) return normalizeStatus(c.status) === 'UF' && !mtnIsClosedStatus(mtnCaseStatus(sub));
      return normalizeStatus(c.status) !== 'N';
    }));
  }

  // Checklist (case) statuses: '' (not requested) / Requested / Pending / Done / Confirmed
  const lists = {
    none:      issues.filter(s => mtnCaseStatus(s) === ''),
    requested: issues.filter(s => mtnCaseStatus(s) === 'Requested'),
    pending:   issues.filter(s => mtnCaseStatus(s) === 'Pending'),
    done:      issues.filter(s => mtnCaseStatus(s) === 'Done'),
    confirmed: issues.filter(s => mtnCaseStatus(s) === 'Confirmed')
  };
  const cardCls = (f) => 'stat-card mtn-stat' + (mtnFilter === f ? ' active' : '');

  const issueRow = (sub, item) => {
    let locChip = '';
    if (item.frequency) locChip += '<span class="mtn-chip ms-1">' + esc(item.frequency) + '</span>';
    else {
      if (item.location.indexOf('L') !== -1) locChip += '<span class="mtn-chip ms-1">L</span>';
      if (item.location.indexOf('R') !== -1) locChip += '<span class="mtn-chip ms-1">R</span>';
    }
    const ist = mtnItemStatusOf(sub, item.itemId);
    const istInfo = mtnStatusInfo(ist);
    const istChip = '<span class="mtn-pill is-' + _mtnItemTone(ist) + ' ms-auto flex-shrink-0" style="font-size:.58rem;padding:2px 7px;" title="Repair status"><i class="bi ' + istInfo.icon + '"></i>' + esc(istInfo.label) + '</span>';
    return '<div class="p-2 mb-2" style="background:var(--bg-color);border-radius:8px;">' +
      '<div class="fw-semibold small d-flex align-items-start gap-1" style="line-height:1.25;">' + mtnCodeBadge(item.code, '.62rem') + '<span class="flex-grow-1" style="min-width:0;">' + esc(item.itemKhmer) + locChip + '</span>' + istChip + '</div>' +
      (item.itemEng ? '<div class="small text-muted" style="font-size:.7rem;">' + esc(item.itemEng) + '</div>' : '') +
      (item.note ? '<div class="mtn-cell-sub mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(item.note) + '</div>' : '') +
    '</div>';
  };


  const cardRenderer = (sub) => {
    const eq = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
    const items = getIssueItems(sub);
    const meta = mtnRequestMeta(sub);
    const last = mtnLastUpdate(sub);

    let displayItems = items;
    if (mtnItemFilter && mtnItemFilter.length > 0) {
      displayItems = items.filter(i => mtnItemFilter.includes(i.itemId) && (!mtnIsUrgentOnly || i.code === 'UF'));
    }

    const reqLine = meta.requestedBy
      ? '<div class="mtn-cell-sub mt-1"><i class="bi bi-send me-1"></i>Requested by <strong>' + esc(meta.requestedBy) + '</strong>' + (meta.requestedAt ? ' · ' + esc(meta.requestedAt) : '') + '</div>'
      : '';
    const updLine = (last && last.by && mtnHasRealUpdate(sub))
      ? '<div class="mtn-cell-sub mt-1"><i class="bi bi-clock-history me-1"></i>Updated by <strong>' + esc(last.by) + '</strong>' + (last.at ? ' · ' + esc(last.at) : '') + (last.remark ? '<div class="mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(last.remark) + '</div>' : '') + '</div>'
      : '';

    return '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center gap-2 flex-wrap"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName || sub.equipmentId) + '</strong> <span class="text-muted small ms-2">(' + esc(sub.date) + ')</span></span>' + mtnStatusBadge(sub) + '</div>' +
      '<div class="card-body py-2">' +
        '<div class="mtn-cell-sub mb-2"><i class="bi bi-person me-1"></i>Inspector: ' + esc(sub.driverName || sub.username) + ' · <span class="text-muted">' + esc(sub.checkId) + '</span></div>' +
        '<div class="mtn-issue-meta text-danger mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Issues (' + items.length + ')</strong>' + (function(){ const p = mtnItemProgress(sub); return p.done ? '<span class="ms-1">· ' + p.done + ' done</span>' : ''; })() + '</div>' +
        displayItems.map(i => issueRow(sub, i)).join('') + reqLine + updLine +
        (meta.confirmedBy ? '<div class="mtn-cell-sub mt-1"><i class="bi bi-patch-check-fill me-1"></i>Confirmed by <strong>' + esc(meta.confirmedBy) + '</strong>' + (meta.confirmedAt ? ' · ' + esc(meta.confirmedAt) : '') + '</div>' : '') +
        '<div class="d-flex gap-2 mt-3 flex-wrap"><button class="btn btn-sm btn-outline-primary flex-fill" onclick="viewCheck(\'' + escAttr(sub.checkId) + '\')"><i class="bi bi-eye me-1"></i>View Checklist</button>' + mtnActionHtml(sub) + '</div>' +
      '</div></div>';
  };

  let visible = issues;
  if (mtnFilter === 'none')      visible = lists.none;
  if (mtnFilter === 'requested') visible = lists.requested;
  if (mtnFilter === 'pending')   visible = lists.pending;
  if (mtnFilter === 'done')      visible = lists.done;
  if (mtnFilter === 'confirmed') visible = lists.confirmed;

  const visibleSlice = visible.slice(0, mtnDisplayLimit);

  const emptyMsg = mtnFilter === 'none' ? '✓ No case waiting for a repair request.' : 'No data';
  const listHtml = visibleSlice.length ? visibleSlice.map(cardRenderer).join('') : '<p class="text-muted small text-center py-4">' + emptyMsg + '</p>';

  let loadMoreHtml = '';
  if (visible.length > mtnDisplayLimit) {
    const remaining = visible.length - mtnDisplayLimit;
    loadMoreHtml = '<div class="text-center" style="padding-bottom: 120px; margin-top: 20px;"><button class="btn btn-outline-primary" onclick="loadMoreMtn()"><i class="bi bi-arrow-down-circle me-1"></i> Load More (' + remaining + ' remaining)</button></div>';
  } else {
    loadMoreHtml = '<div style="padding-bottom: 120px;"></div>';
  }


  let filterChip = '';
  if (mtnItemFilter && mtnItemFilter.length > 0) {
    filterChip = '<div class="d-flex align-items-center gap-2 mb-3"><span class="badge bg-danger d-flex align-items-center gap-1" style="font-size:.8rem;padding:6px 10px;"><i class="bi bi-funnel-fill"></i> Filtering by: ' + esc(mtnItemLabel) + '<span onclick="clearMtnItemFilter()" style="cursor:pointer;margin-left:6px;font-weight:700;">✕</span></span></div>';
  }

  const card = (f, tone, icon, label, count) => '<div class="col-6 col-md-4 col-lg"><div class="' + cardCls(f) + '" onclick="setMtnFilter(\'' + f + '\')"><div class="num mtn-num-' + tone + '">' + count + '</div><div class="lbl"><i class="bi ' + icon + ' me-1"></i>' + esc(label) + '</div></div></div>';

  const titleMap = { none: 'Not Requested', requested: 'Requested', pending: 'Pending', done: 'Done', confirmed: 'Confirmed' };
  const heading = (mtnFilter === 'all') ? 'All issue checklists' : (titleMap[mtnFilter] || '');

  $('#app').html('<div class="container-fluid px-0"><div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0"><i class="bi bi-wrench-adjustable me-2"></i>MTN Management</h5><small class="text-muted">' + esc(currentUser.group === 'ALL' ? 'All groups' : currentUser.group) + ' · ' + esc(roleLabel(currentUser.role)) + '</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px;">--:--:--</span></button></div>' + subTabBar + filterChip +
    '<div class="mtn-hint"><i class="bi bi-info-circle me-1"></i>' + esc(mtnRoleNote()) + '</div>' +
    '<div class="row g-2 mb-3">' + card('all', 'all', 'bi-collection', 'All Cases', issues.length) + card('none', 'nr', 'bi-dash-circle', 'Not Requested', lists.none.length) + card('requested', 'req', 'bi-send-check', 'Requested', lists.requested.length) + card('pending', 'pend', 'bi-hourglass-split', 'Pending', lists.pending.length) + card('done', 'done', 'bi-check-circle-fill', 'Done', lists.done.length) + card('confirmed', 'conf', 'bi-patch-check-fill', 'Confirmed', lists.confirmed.length) + '</div>' +
    '<div class="mtn-table-head standalone mb-2"><span class="fw-semibold"><i class="bi bi-list-check me-1"></i>' + esc(heading) + '</span><span class="text-muted">Showing ' + visibleSlice.length + ' of ' + visible.length + '</span></div>' +
    listHtml + loadMoreHtml + '</div>');
}


/* =========================================================
   REPAIR REQUEST ACTIONS
   Admin          -> Make a Request (creates the case request)
   Repair Service -> per item: Requested | Waiting Repairing |
                                Waiting Spare Part | Repaired
   Repair Manager -> Confirm a Done case (sign-off)
   ('Not Request' stays display-only — it is never offered as a choice)
   The checklist status is the rollup: Requested | Pending | Done,
   then Confirmed once the Repair Manager signs it off.
   ========================================================= */
function _applyMtnLocal(checkId, status, remark){
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub) return;
  const stamp = dmyToday() + ' ' + nowTimeStr();
  if (!sub.mtnItems) sub.mtnItems = {};
  let meta = (sub.mtnItems.__request && typeof sub.mtnItems.__request === 'object') ? sub.mtnItems.__request : {};
  if (!Array.isArray(meta.history)) meta.history = [];
  if (!meta.itemStatus || typeof meta.itemStatus !== 'object') meta.itemStatus = {};
  const isConfirm = (status === 'Confirmed');
  if (status === 'Requested') {
    meta.requestedBy = currentUser.username;
    meta.requestedAt = stamp;
    meta.requestedItems = getIssueItems(sub).map(i => ({ itemId: i.itemId, code: i.code }));
    meta.repairedBy = '';
    meta.repairedAt = '';
    meta.confirmedBy = '';
    meta.confirmedAt = '';
  } else if (!meta.requestedBy) {
    meta.requestedBy = currentUser.username;
    meta.requestedAt = stamp;
  }
  meta.history.push({ status: status, by: currentUser.username, at: stamp, remark: remark || '' });
  if (isConfirm) {
    // Sign-off only: the per-item repair statuses stay exactly as repaired
    meta.confirmedBy = currentUser.username;
    meta.confirmedAt = stamp;
  } else {
    const itemSt = mtnCaseToItemStatus(status) || 'Requested';
    getIssueItems(sub).forEach(i => {
      meta.itemStatus[i.itemId] = { status: itemSt, by: currentUser.username, at: stamp, remark: remark || '' };
    });
    meta.confirmedBy = '';
    meta.confirmedAt = '';
  }
  meta.updatedBy = currentUser.username;
  meta.updatedAt = stamp;
  meta.lastRemark = remark || '';
  sub.mtnItems.__request = meta;
  sub.mtnStatus = mtnNormCaseStatus(status);
  sub.mtnBy = currentUser.username;
  sub.mtnAt = stamp;
  sub.mtnRemark = remark || '';
}

/* Per issue-item update: same bookkeeping, but the case status is the rollup */
function _applyMtnItemsLocal(checkId, updates, remark){
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub || !updates || !updates.length) return;
  const stamp = dmyToday() + ' ' + nowTimeStr();
  if (!sub.mtnItems) sub.mtnItems = {};
  let meta = (sub.mtnItems.__request && typeof sub.mtnItems.__request === 'object') ? sub.mtnItems.__request : {};
  if (!Array.isArray(meta.history)) meta.history = [];
  if (!meta.itemStatus || typeof meta.itemStatus !== 'object') meta.itemStatus = {};
  if (!meta.requestedBy) { meta.requestedBy = currentUser.username; meta.requestedAt = stamp; }
  const overrides = {};
  updates.forEach(u => {
    meta.itemStatus[u.itemId] = { status: u.status, by: currentUser.username, at: stamp, remark: remark || '' };
    meta.history.push({ status: u.status, itemId: u.itemId, by: currentUser.username, at: stamp, remark: remark || '' });
    overrides[u.itemId] = u.status;
  });
  sub.mtnItems.__request = meta;
  const derived = mtnDeriveCaseStatus(sub, overrides);
  meta.updatedBy = currentUser.username;
  meta.updatedAt = stamp;
  meta.lastRemark = remark || '';
  if (derived === 'Done') { meta.repairedBy = currentUser.username; meta.repairedAt = stamp; }
  else { meta.repairedBy = ''; meta.repairedAt = ''; }
  // A new repair edit re-opens the case: any earlier sign-off no longer applies
  meta.confirmedBy = '';
  meta.confirmedAt = '';
  sub.mtnStatus = derived;
  sub.mtnBy = currentUser.username;
  sub.mtnAt = stamp;
  sub.mtnRemark = remark || '';
}

window.requestMtnRepair = function(checkId){
  if (!mtnIsRequester()) { showAlert('Only Admin can make a repair request', 'warning'); return; }
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub) return;
  const items = getIssueItems(sub);
  if (!items.length) { showAlert('This checklist has no issues to repair', 'warning'); return; }
  askRemark({
    title: 'Request Repair',
    label: 'ពិពណ៌នាបញ្ហាត្រូវជួសជុល / Describe the repair needed:',
    placeholder: 'ឧ. ជួសជុលកង់ខាងមុខ និងភ្លើងស្តុប...'
  }, function(remark){
    if (remark === null) return;
    showLoading('កំពុងបញ្ជូនសំណើជួសជុល...');
    google.script.run.withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
      _applyMtnLocal(checkId, 'Requested', remark);
      showAlert('បានបញ្ជូនសំណើជួសជុល (' + items.length + ' បញ្ហា)', 'success');
      renderDashboard();
    }).withFailureHandler(handleError).updateMtnRequest({
      checkId: checkId, status: 'Requested', username: currentUser.username, remark: remark || ''
    });
  });
};

/* Repair Manager: sign off a case the Repair Service has finished */
window.confirmMtnCase = function(checkId){
  if (!mtnIsRepairManager()) { showAlert('Only Repair Manager can confirm a repaired case', 'warning'); return; }
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub) { showAlert('Checklist not found', 'danger'); return; }
  const st = mtnCaseStatus(sub);
  if (st === 'Confirmed') { showAlert('This case is already confirmed', 'info'); return; }
  if (st !== 'Done') { showAlert('Only a fully repaired (Done) case can be confirmed', 'warning'); return; }
  const p = mtnItemProgress(sub);
  askRemark({
    title: 'Confirm Repair',
    label: 'All ' + p.total + ' issue item(s) are repaired (' + p.done + '/' + p.total + ' done). Confirm this case? Remark (optional):',
    placeholder: 'ចំណាំបន្ថែម...'
  }, function(remark){
    if (remark === null) return;
    _submitMtnStatus(checkId, 'Confirmed', remark || '');
  });
};

window.setMtnRepairStatus = function(checkId, status){
  if (!mtnIsRepairer()) { showAlert('Only Repair Service can update the repair status', 'warning'); renderDashboard(); return; }
  if (MTN_CASE_STATUS_LIST.indexOf(status) === -1) { renderDashboard(); return; }
  const label = mtnStatusInfo(status).label;
  askRemark({
    title: 'Update Repair Status',
    label: 'Set status to "' + label + '". Remark (optional):',
    placeholder: 'ចំណាំបន្ថែម...'
  }, function(remark){
    if (remark === null) { renderDashboard(); return; }
    _submitMtnStatus(checkId, status, remark || '');
  });
};


/* ---------- Repair status editor: one status per issue item ---------- */
function _mtnEditorRow(label, valueHtml){
  return '<div class="d-flex justify-content-between align-items-start gap-2 py-1 border-bottom" style="border-color:var(--border-color)!important;">' +
    '<span class="text-muted" style="font-size:.72rem;">' + label + '</span>' +
    '<span class="text-end fw-semibold" style="font-size:.75rem;">' + valueHtml + '</span></div>';
}

const MTN_ITEM_COLORS = { 'Requested': '#ffc107', 'Not Request': '#6c757d', 'Waiting Repairing': '#0dcaf0', 'Waiting Spare Part': '#0d6efd', 'Repaired': '#198754' };
const MTN_ITEM_TEXT_COLORS = { '': '#6c757d', 'Requested': '#b8860b', 'Not Request': '#495057', 'Waiting Repairing': '#0aa2c0', 'Waiting Spare Part': '#0a58ca', 'Repaired': '#146c43' };
function _mtnItemColor(status){ return MTN_ITEM_COLORS[status] || '#adb5bd'; }
function _mtnItemTextColor(status){ return MTN_ITEM_TEXT_COLORS[status] || '#6c757d'; }
/* theme-aware icon tone for the per-item status glyph */
function _mtnItemTone(status){
  if (status === 'Repaired') return 'done';
  if (status === 'Waiting Repairing') return 'pend';
  if (status === 'Waiting Spare Part') return 'part';
  if (status === 'Requested') return 'req';
  return 'nr';
}

function _mtnItemEditorRow(sub, item){
  const st = mtnItemStatusOf(sub, item.itemId) || 'Requested';
  const rec = mtnItemMeta(sub, item.itemId);
  const meta = mtnRequestMeta(sub);
  // Do not repeat the request itself as a per-item "updated" line
  const upd = (rec.by && !(rec.by === meta.requestedBy && rec.at === meta.requestedAt)) ? rec : { by: '', at: '' };
  // 'Not Request' is display-only: keep it only for an item that already carries it
  const statusOpts = (MTN_ITEM_SELECT_LIST.indexOf(st) === -1 ? [st] : []).concat(MTN_ITEM_SELECT_LIST);
  const opts = statusOpts.map(s => '<option value="' + escAttr(s) + '"' + (s === st ? ' selected' : '') + '>' + esc(mtnStatusInfo(s).label) + '</option>').join('');
  return '<div class="mtn-item-row p-2 mb-2" data-item-id="' + escAttr(item.itemId) + '" style="background:var(--bg-color);border-radius:8px;border-left:3px solid ' + _mtnItemColor(st) + ';">' +
    '<div class="d-flex align-items-start gap-2">' +
      mtnCodeBadge(item.code, '.6rem') +
      '<div class="flex-grow-1" style="min-width:0;">' +
        '<div class="fw-semibold" style="font-size:.76rem;line-height:1.25;">' + esc(item.itemKhmer) + '</div>' +
        (item.itemEng ? '<div class="text-muted" style="font-size:.68rem;">' + esc(item.itemEng) + '</div>' : '') +
        (item.note ? '<div class="text-muted" style="font-size:.66rem;"><i class="bi bi-chat-left-text me-1"></i>' + esc(item.note) + '</div>' : '') +
        (upd.by ? '<div class="text-muted" style="font-size:.64rem;"><i class="bi bi-clock-history me-1"></i>' + esc(upd.by) + (upd.at ? ' · ' + esc(upd.at) : '') + '</div>' : '') +
      '</div>' +
      '<select class="form-select form-select-sm mtn-item-status flex-shrink-0" style="max-width:158px;font-size:.72rem;" onchange="onMtnItemStatusChange(this)">' + opts + '</select>' +
    '</div>' +
  '</div>';
}

window.openMtnStatusEditor = function(checkId){
  if (!mtnIsRepairer()) { showAlert('Only Repair Service can update the repair status', 'warning'); return; }
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub) { showAlert('Checklist not found', 'danger'); return; }
  const st = mtnCaseStatus(sub);
  if (!st) { showAlert('This checklist has no repair request yet', 'warning'); return; }

  const items = getIssueItems(sub);
  const meta = mtnRequestMeta(sub);
  const last = mtnHasRealUpdate(sub) ? (mtnLastUpdate(sub) || {}) : {};
  const eq = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
  const company = String(eq.companyName || '').trim();

  const setAllBtns = MTN_ITEM_SELECT_LIST.map(s => {
    const info = mtnStatusInfo(s);
    return '<button type="button" class="btn btn-sm py-0 px-2 btn-outline-' + info.badge + '" style="font-size:.66rem;" onclick="setAllMtnItems(\'' + escAttr(s) + '\')"><i class="bi ' + info.icon + ' me-1"></i>' + esc(info.label) + '</button>';
  }).join('');
  const doneInit = items.filter(i => mtnItemDone(sub, i.itemId)).length;
  const initTone = (items.length && doneInit === items.length) ? 'success' : (doneInit ? 'info' : 'secondary');

  const html = '<div class="p-3">' +
    '<div class="card mb-3" style="background:var(--card-bg);"><div class="card-body py-2 px-3">' +
      _mtnEditorRow('Equipment', esc(eq.shortName || sub.equipmentId)) +
      _mtnEditorRow('Checklist', esc(sub.date + ' · ' + (sub.time || '') + ' · ' + sub.checkId)) +
      _mtnEditorRow('Group', esc(sub.group || '—') + (company ? ' · ' + esc(company) : '')) +
      _mtnEditorRow('Requested by', esc(meta.requestedBy || '—') + (meta.requestedAt ? '<div class="text-muted fw-normal" style="font-size:.68rem;">' + esc(meta.requestedAt) + '</div>' : '')) +
      _mtnEditorRow('Last update', (last.by ? esc(last.by) : '—') + (last.at ? '<div class="text-muted fw-normal" style="font-size:.68rem;">' + esc(last.at) + '</div>' : '')) +
    '</div></div>' +
    '<div class="d-flex justify-content-between align-items-center mb-1">' +
      '<label class="form-label small fw-bold mb-0"><i class="bi bi-list-check me-1 text-primary"></i>Issue items (' + items.length + ')</label>' +
      '<span id="mtnEditorProgress" class="badge bg-' + initTone + '" style="font-size:.62rem;">' + doneInit + ' of ' + items.length + ' done</span>' +
    '</div>' +
    '<div class="d-flex flex-wrap gap-1 align-items-center mb-2">' +
      '<span class="text-muted" style="font-size:.68rem;">Set all:</span>' + setAllBtns +
    '</div>' +
    '<div id="mtnEditorItems">' + items.map(i => _mtnItemEditorRow(sub, i)).join('') + '</div>' +
    (items.length ? '' : '<div class="text-muted small text-center py-3">No issue items</div>') +
    '<label class="form-label small fw-bold mb-1 mt-2" for="mtnEditorRemark">Remark (optional)</label>' +
    '<textarea id="mtnEditorRemark" class="form-control form-control-sm" rows="2" placeholder="ចំណាំបន្ថែម..."></textarea>' +
    '<div class="d-flex gap-2 mt-3">' +
      '<button type="button" class="btn btn-sm btn-outline-secondary flex-fill" data-bs-dismiss="modal">Cancel</button>' +
      '<button type="button" class="btn btn-sm btn-primary flex-fill" onclick="saveMtnItemsEditor(\'' + escAttr(sub.checkId) + '\')"><i class="bi bi-check2-circle me-1"></i>Save</button>' +
    '</div>' +
  '</div>';

  $('#modalActionButtons').addClass('d-none');
  $('#modalTitle').text('Update Repair Status');
  $('#modalBody').html(html);
  if (window.currentDetailModal) window.currentDetailModal.show();
  else { const m = new bootstrap.Modal(document.getElementById('detailModal')); m.show(); window.currentDetailModal = m; }
  updateMtnEditorProgress();
};

/* Current select state of the editor: [{ itemId, status }] */
function mtnEditorSelection(){
  const out = [];
  const box = document.getElementById('mtnEditorItems');
  if (!box) return out;
  box.querySelectorAll('.mtn-item-row').forEach(row => {
    const sel = row.querySelector('.mtn-item-status');
    if (!sel) return;
    out.push({ itemId: row.getAttribute('data-item-id'), status: String(sel.value || '') });
  });
  return out;
}

function updateMtnEditorProgress(){
  const el = document.getElementById('mtnEditorProgress');
  if (!el) return;
  const sel = mtnEditorSelection();
  const done = sel.filter(x => x.status === 'Repaired' || x.status === 'Not Request').length;
  el.className = 'badge bg-' + ((sel.length && done === sel.length) ? 'success' : (done ? 'info' : 'secondary'));
  el.textContent = done + ' of ' + sel.length + ' done';
}

window.onMtnItemStatusChange = function(sel){
  const row = (sel && sel.closest) ? sel.closest('.mtn-item-row') : null;
  if (row) row.style.borderLeftColor = _mtnItemColor(sel.value);
  updateMtnEditorProgress();
};

window.setAllMtnItems = function(status){
  const box = document.getElementById('mtnEditorItems');
  if (!box) return;
  box.querySelectorAll('.mtn-item-row').forEach(row => {
    const sel = row.querySelector('.mtn-item-status');
    if (!sel) return;
    sel.value = status;
    row.style.borderLeftColor = _mtnItemColor(status);
  });
  updateMtnEditorProgress();
};

window.saveMtnItemsEditor = function(checkId){
  if (!mtnIsRepairer()) { showAlert('Only Repair Service can update the repair status', 'warning'); return; }
  const sub = (APP.submissions || []).find(x => x.checkId === checkId);
  if (!sub) { showAlert('Checklist not found', 'danger'); return; }
  const sel = mtnEditorSelection();
  if (!sel.length) { showAlert('This checklist has no issue item', 'warning'); return; }
  const changed = sel.filter(x => (mtnItemStatusOf(sub, x.itemId) || 'Requested') !== x.status);
  if (!changed.length) { showAlert('No status changed yet', 'warning'); return; }
  const overrides = {};
  sel.forEach(x => { overrides[x.itemId] = x.status; });
  const caseStatus = mtnDeriveCaseStatus(sub, overrides);
  const remarkEl = document.getElementById('mtnEditorRemark');
  const remark = remarkEl ? String(remarkEl.value || '').trim() : '';
  if (window.currentDetailModal) window.currentDetailModal.hide();
  _submitMtnItems(checkId, changed, caseStatus, remark);
};

function _submitMtnItems(checkId, changed, caseStatus, remark){
  showLoading('កំពុងរក្សាទុក...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); renderDashboard(); return; }
    _applyMtnItemsLocal(checkId, changed, remark);
    const sub = (APP.submissions || []).find(x => x.checkId === checkId);
    const p = sub ? mtnItemProgress(sub) : { done: 0, total: changed.length };
    showAlert('បានរក្សាទុក ' + changed.length + ' ចំណុច · ' + p.done + '/' + p.total + ' done', 'success');
    renderDashboard();
  }).withFailureHandler(handleError).updateMtnRequest({
    checkId: checkId, status: caseStatus, items: changed, username: currentUser.username, remark: remark || ''
  });
}

function _submitMtnStatus(checkId, status, remark){
  const label = mtnStatusInfo(status).label;
  showLoading('កំពុងរក្សាទុក...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); renderDashboard(); return; }
    _applyMtnLocal(checkId, status, remark);
    showAlert('បានកំណត់ស្ថានភាព: ' + label, 'success');
    renderDashboard();
  }).withFailureHandler(handleError).updateMtnRequest({
    checkId: checkId, status: status, username: currentUser.username, remark: remark || ''
  });
}

/* =========================================================
   MTN MANAGEMENT STATUS (table + filters)
   ========================================================= */
function mtnStatusRowsAll(){
  const rows = [];
  (APP.submissions || []).filter(s => s.overall === 'Issues').forEach(sub => {
    const items = getIssueItems(sub);
    if (!items.length) return;
    const eq = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
    const trlId = String(sub.trailerPlateNo || '').trim();
    const trl = trlId ? ((APP.trailers || []).find(t => String(t.trailerId || '').trim() === trlId) || null) : null;
    rows.push({
      sub: sub,
      eq: eq,
      items: items,
      status: mtnCaseStatus(sub),
      meta: mtnRequestMeta(sub),
      last: mtnLastUpdate(sub),
      company: String(eq.companyName || '').trim(),
      isTruckGroup: String(sub.group || '').trim() === 'រថយន្ត',
      trailerId: trlId,
      trailerName: trl ? (trl.shortName || trl.trailerId) : trlId,
      ms: subMs(sub)
    });
  });
  return rows;
}

function mtnStatusFilterRows(rowsAll, ignoreStatus){
  const search = String(mtnStatusSearch || '').trim().toLowerCase();
  return rowsAll.filter(r => {
    if (!ignoreStatus && mtnStatusFilter !== 'all' && r.status !== mtnStatusFilter) return false;
    if (mtnStatusItem && !r.items.some(i => mtnItemStatusOf(r.sub, i.itemId) === mtnStatusItem)) return false;
    if (mtnStatusGroup !== 'all' && r.sub.group !== mtnStatusGroup) return false;
    if (mtnStatusCompany !== 'all' && r.company !== mtnStatusCompany) return false;
    if (mtnStatusMonth && mtnMonthOf(r.sub.date) !== mtnStatusMonth) return false;
    if (search) {
      const hay = [
        r.sub.checkId, r.sub.equipmentId, r.eq.shortName || '', r.sub.group, r.company,
        r.sub.username, r.sub.driverName || '', r.status,
        r.meta.requestedBy || '', (r.last && r.last.by) || '', (r.last && r.last.remark) || '',
        r.items.map(i => i.itemKhmer + ' ' + i.itemEng + ' ' + i.code + ' ' + mtnStatusInfo(mtnItemStatusOf(r.sub, i.itemId)).label).join(' ')
      ].join(' ').toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });
}

function mtnStatusSortRows(rows){
  const order = { '': 0, 'Requested': 1, 'Pending': 2, 'Done': 3, 'Confirmed': 4 };
  const list = rows.slice();
  if (mtnStatusSort === 'oldest') list.sort((a, b) => a.ms - b.ms);
  else if (mtnStatusSort === 'status') list.sort((a, b) => (order[a.status] - order[b.status]) || (b.ms - a.ms));
  else if (mtnStatusSort === 'equipment') list.sort((a, b) => String(a.eq.shortName || a.sub.equipmentId).localeCompare(String(b.eq.shortName || b.sub.equipmentId)));
  else list.sort((a, b) => b.ms - a.ms);
  return list;
}


function renderMtnStatusTab(subTabBar){
  const rowsAll = mtnStatusRowsAll();

  const groups = [];
  rowsAll.forEach(r => { if (r.sub.group && groups.indexOf(r.sub.group) === -1) groups.push(r.sub.group); });
  groups.sort();
  const companyList = [];
  rowsAll.forEach(r => { if (r.company && companyList.indexOf(r.company) === -1) companyList.push(r.company); });
  companyList.sort();

  const rowsForCounts = mtnStatusFilterRows(rowsAll, true);
  const counts = { 'all': rowsForCounts.length, '': 0, 'Requested': 0, 'Pending': 0, 'Done': 0, 'Confirmed': 0 };
  rowsForCounts.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  const rows = mtnStatusSortRows(mtnStatusFilterRows(rowsAll, false));
  const shown = rows.slice(0, mtnStatusLimit);

  const opt = (val, label, selected) => '<option value="' + escAttr(val) + '"' + (String(selected) === String(val) ? ' selected' : '') + '>' + esc(label) + '</option>';

  // Checklist (case) status filter
  const statusSelect = '<select class="form-select form-select-sm" onchange="setMtnStatusFilter(\'status\', this.value)">' +
    opt('all', 'All checklist statuses', mtnStatusFilter) + opt('', 'Not Requested', mtnStatusFilter) +
    MTN_CASE_STATUS_LIST.map(s => opt(s, mtnStatusInfo(s).label, mtnStatusFilter)).join('') + '</select>';

  // Per issue-item status filter (keeps the cases that contain at least one item in that state)
  const itemSelect = '<select class="form-select form-select-sm" onchange="setMtnStatusFilter(\'item\', this.value)">' +
    opt('', 'All item statuses', mtnStatusItem) +
    MTN_ITEM_SELECT_LIST.map(s => opt(s, mtnStatusInfo(s).label, mtnStatusItem)).join('') + '</select>';

  const groupSelect = '<select class="form-select form-select-sm" onchange="setMtnStatusFilter(\'group\', this.value)">' +
    opt('all', 'All groups', mtnStatusGroup) + groups.map(g => opt(g, g, mtnStatusGroup)).join('') + '</select>';

  const companySelect = '<select class="form-select form-select-sm" onchange="setMtnStatusFilter(\'company\', this.value)">' +
    opt('all', 'All companies', mtnStatusCompany) + companyList.map(c => opt(c, c, mtnStatusCompany)).join('') + '</select>';

  const sortSelect = '<select class="form-select form-select-sm" onchange="setMtnStatusFilter(\'sort\', this.value)">' +
    opt('newest', 'Newest first', mtnStatusSort) + opt('oldest', 'Oldest first', mtnStatusSort) +
    opt('status', 'By status', mtnStatusSort) + opt('equipment', 'By equipment', mtnStatusSort) + '</select>';

  const tableHead = '<th class="text-center" style="width:32px;">#</th><th style="width:92px;">Date</th><th style="min-width:150px;">Equipment</th>' +
    '<th style="min-width:220px;">Issues (per item)</th><th class="d-none d-md-table-cell" style="width:130px;">Requested</th><th style="width:150px;">Checklist status</th>' +
    '<th class="d-none d-lg-table-cell" style="width:130px;">Last update</th><th class="d-none d-xl-table-cell">Remark</th><th class="text-end" style="width:150px;">Action</th>';

  let tbody = '';
  shown.forEach((r, idx) => {
    const last = r.last || {};
    const hasUpd = mtnHasRealUpdate(r.sub);
    const remarkTxt = hasUpd ? (last.remark || '') : '';
    const prog = mtnItemProgress(r.sub);
    // One line per issue item: code pill + item name + its repair status
    const issueLine = (i) => {
      const ist = mtnItemStatusOf(r.sub, i.itemId);
      const iInfo = mtnStatusInfo(ist);
      const tip = i.itemKhmer + (i.itemEng ? ' · ' + i.itemEng : '') + (i.isExtra ? ' · Extra item' : '') + ' — ' + iInfo.label;
      return '<div class="mtn-issue-line" title="' + escAttr(tip) + '">' +
        mtnCodeBadge(i.code, '.56rem') +
        '<span class="mtn-issue-name">' + esc(i.itemKhmer) + '</span>' +
        '<i class="bi ' + iInfo.icon + ' mtn-item-ic is-' + _mtnItemTone(ist) + '"></i>' +
      '</div>';
    };
    // Tractor / Trailer mini-banners, same split as the checklist view
    const partBanner = (label, icon) => '<div class="mtn-part-banner"><i class="bi ' + icon + '"></i>' + label + '</div>';
    let issueLines;
    if (r.isTruckGroup) {
      const truckItems = r.items.filter(i => mtnItemPartOf(i.itemId) === 'truck');
      const trlItems = r.items.filter(i => mtnItemPartOf(i.itemId) === 'trailer');
      const otherItems = r.items.filter(i => !mtnItemPartOf(i.itemId));
      const showParts = trlItems.length > 0; // only a truck+trailer case needs the split
      issueLines =
        (truckItems.length ? (showParts ? partBanner('រថយន្ត', 'bi-truck') : '') + truckItems.map(issueLine).join('') : '') +
        (trlItems.length ? (showParts ? partBanner('រ៉ឺម៉ក', 'bi-link-45deg') : '') + trlItems.map(issueLine).join('') : '') +
        otherItems.map(issueLine).join('');
    } else {
      issueLines = r.items.map(issueLine).join('');
    }
    tbody += '<tr class="history-row-clickable" style="cursor:pointer;" title="Click to view checklist" onclick="viewCheck(\'' + escAttr(r.sub.checkId) + '\')">' +
      '<td class="text-center text-muted">' + (idx + 1) + '</td>' +
      '<td><div class="mtn-cell-main">' + esc(r.sub.date) + '</div><div class="mtn-cell-sub">' + esc(r.sub.time || '') + '</div></td>' +
      '<td><div class="mtn-cell-main d-flex align-items-center gap-1 flex-wrap">' + esc(r.eq.shortName || r.sub.equipmentId) +
        ((r.isTruckGroup && r.trailerName) ? ' <span class="badge bg-secondary" style="font-size:.56rem;font-weight:600;" title="រ៉ឺម៉ក · Trailer">' + esc(r.trailerName) + '</span>' : '') +
      '</div><div class="mtn-cell-sub">' + esc(r.sub.checkId) + '</div></td>' +
      '<td><div class="mtn-issue-meta"><i class="bi bi-list-check me-1"></i>' + r.items.length + ' issue · ' + prog.done + '/' + prog.total + ' done</div>' + issueLines + '</td>' +
      '<td class="d-none d-md-table-cell">' + (r.meta.requestedBy
        ? '<div class="mtn-cell-main">' + esc(r.meta.requestedBy) + '</div><div class="mtn-cell-sub">' + esc(r.meta.requestedAt || '') + '</div>'
        : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + mtnStatusBadge(r.sub) + '</td>' +
      '<td class="d-none d-lg-table-cell">' + (hasUpd
        ? '<div class="mtn-cell-main">' + esc(last.by || '') + '</div><div class="mtn-cell-sub">' + esc(last.at || '') + '</div>'
        : '<span class="text-muted">—</span>') + '</td>' +
      '<td class="d-none d-xl-table-cell" style="max-width:220px;"><div class="text-truncate text-muted" style="font-size:.72rem;"' + (remarkTxt ? ' title="' + escAttr(remarkTxt) + '"' : '') + '>' + esc(remarkTxt || '—') + '</div></td>' +
      '<td class="text-end" style="min-width:150px;" onclick="event.stopPropagation()">' + mtnActionHtml(r.sub) + '</td>' +
    '</tr>';
  });

  if (!shown.length) {
    tbody = '<tr><td colspan="9" class="text-center text-muted py-4">No checklist matches these filters.</td></tr>';
  }


  const card = (f, tone, icon, label, count) => {
    const active = (mtnStatusFilter === f) ? ' active' : '';
    return '<div class="col-6 col-md-4 col-lg">' +
      '<div class="stat-card mtn-stat' + active + '" onclick="setMtnStatusFilter(\'status\', \'' + escAttr(f) + '\')">' +
        '<div class="num mtn-num-' + tone + '">' + count + '</div>' +
        '<div class="lbl"><i class="bi ' + icon + ' me-1"></i>' + esc(label) + '</div>' +
      '</div></div>';
  };

  const loadMore = rows.length > mtnStatusLimit
    ? '<div class="text-center mt-3"><button class="btn btn-sm btn-outline-primary" onclick="loadMoreMtnStatus()"><i class="bi bi-arrow-down-circle me-1"></i>Load more (' + (rows.length - mtnStatusLimit) + ' remaining)</button></div>'
    : '';

  const header = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0"><i class="bi bi-clipboard2-pulse me-2"></i>MTN Management Status</h5><small class="text-muted">Repair requests · ' + esc(currentUser.group === 'ALL' ? 'All groups' : currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onclick="syncAllData(true)"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size:.75rem;min-width:55px;">--:--:--</span></button></div>';

  const filters = '<div class="mtn-filters"><div class="row g-2 align-items-end">' +
      '<div class="col-6 col-lg-3"><label class="rpt-lbl"><i class="bi bi-clipboard-check me-1"></i>Checklist status</label>' + statusSelect + '</div>' +
      '<div class="col-6 col-lg-3"><label class="rpt-lbl"><i class="bi bi-wrench me-1"></i>Item status</label>' + itemSelect + '</div>' +
      '<div class="col-6 col-lg-2"><label class="rpt-lbl"><i class="bi bi-people me-1"></i>Group</label>' + groupSelect + '</div>' +
      (companyList.length ? '<div class="col-6 col-lg-2"><label class="rpt-lbl"><i class="bi bi-building me-1"></i>Company</label>' + companySelect + '</div>' : '') +
      '<div class="col-6 col-lg-2"><label class="rpt-lbl"><i class="bi bi-calendar3 me-1"></i>Month</label><input type="month" class="form-control form-control-sm" value="' + escAttr(mtnStatusMonth) + '" onchange="setMtnStatusFilter(\'month\', this.value)"></div>' +
      '<div class="col-6 col-lg-2"><label class="rpt-lbl"><i class="bi bi-sort-down me-1"></i>Sort</label>' + sortSelect + '</div>' +
      '<div class="col-12 col-lg-6"><label class="rpt-lbl"><i class="bi bi-search me-1"></i>Search</label>' +
        '<div class="input-group input-group-sm mtn-search"><span class="input-group-text"><i class="bi bi-search"></i></span>' +
        '<input type="text" id="mtnStatusSearch" class="form-control" placeholder="Equipment, item, status, check ID, technician, remark…" value="' + escAttr(mtnStatusSearch) + '" oninput="setMtnStatusFilter(\'search\', this.value)"></div></div>' +
      '<div class="col-12 col-lg-4"><div class="d-flex gap-2 justify-content-lg-end">' +
        '<button class="btn btn-sm btn-outline-secondary flex-fill flex-lg-grow-0 px-3" onclick="clearMtnStatusFilters()"><i class="bi bi-x-circle me-1"></i>Reset</button>' +
        '<button class="btn btn-sm btn-outline-success flex-fill flex-lg-grow-0 px-3" onclick="exportMtnStatusCsv()"><i class="bi bi-file-earmark-excel me-1"></i>Export</button>' +
      '</div></div>' +
  '</div></div>';

  $('#app').html('<div class="container-fluid px-0">' + header + subTabBar +
    '<div class="row g-2 mb-3 mtn-stats">' +
      card('all', 'all', 'bi-collection', 'All cases', counts['all']) +
      card('', 'nr', 'bi-dash-circle', 'Not Requested', counts['']) +
      card('Requested', 'req', 'bi-send-check', 'Requested', counts['Requested']) +
      card('Pending', 'pend', 'bi-hourglass-split', 'Pending', counts['Pending']) +
      card('Done', 'done', 'bi-check-circle-fill', 'Done', counts['Done']) +
      card('Confirmed', 'conf', 'bi-patch-check-fill', 'Confirmed', counts['Confirmed']) +
    '</div>' + filters +
    '<div class="card">' +
      '<div class="mtn-table-head"><span class="fw-semibold"><i class="bi bi-list-check me-1"></i>Cases</span>' +
        '<span class="text-muted">Showing ' + shown.length + ' of ' + rows.length + '</span></div>' +
      '<div class="table-responsive"><table class="table mtn-table align-middle mb-0" style="white-space:nowrap;"><thead><tr>' + tableHead + '</tr></thead><tbody>' + tbody + '</tbody></table></div>' +
      '<div class="card-footer d-flex justify-content-between align-items-center flex-wrap gap-2 small text-muted"><span><i class="bi bi-info-circle me-1"></i>Click a row to open the checklist</span><span>' + esc(mtnRoleNote()) + '</span></div>' +
    '</div>' +
    loadMore + '<div style="padding-bottom:100px;"></div></div>');

  if (window._mtnStatusFocusSearch) {
    window._mtnStatusFocusSearch = false;
    const el = document.getElementById('mtnStatusSearch');
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  }
}


/* ---------- MTN status tab: filters / export ---------- */
window.setMtnStatusFilter = function(field, value){
  if (field === 'status') mtnStatusFilter = (value == null) ? 'all' : String(value);
  else if (field === 'item') mtnStatusItem = value || '';
  else if (field === 'group') mtnStatusGroup = value || 'all';
  else if (field === 'company') mtnStatusCompany = value || 'all';
  else if (field === 'month') mtnStatusMonth = value || '';
  else if (field === 'sort') mtnStatusSort = value || 'newest';
  else if (field === 'search') { mtnStatusSearch = value || ''; window._mtnStatusFocusSearch = true; }
  mtnStatusLimit = 25;
  renderDashboard();
};

window.clearMtnStatusFilters = function(){
  mtnStatusFilter = 'all';
  mtnStatusItem = '';
  mtnStatusGroup = 'all';
  mtnStatusCompany = 'all';
  mtnStatusMonth = '';
  mtnStatusSearch = '';
  mtnStatusSort = 'newest';
  mtnStatusLimit = 25;
  renderDashboard();
};

window.loadMoreMtnStatus = function(){
  mtnStatusLimit += 25;
  renderDashboard();
};

window.exportMtnStatusCsv = function(){
  const rows = mtnStatusSortRows(mtnStatusFilterRows(mtnStatusRowsAll(), false));
  if (!rows.length) { showAlert('No data to export', 'warning'); return; }
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const header = ['Date', 'Check ID', 'Equipment', 'Group', 'Company', 'Issues (item status)', 'Requested By', 'Requested At', 'Checklist Status', 'Done / Total', 'Updated By', 'Updated At', 'Remark'];
  const lines = [header.map(cell).join(',')];
  rows.forEach(r => {
    const last = r.last || {};
    const hasUpd = mtnHasRealUpdate(r.sub);
    const p = mtnItemProgress(r.sub);
    lines.push([
      r.sub.date, r.sub.checkId, (r.eq.shortName || r.sub.equipmentId), r.sub.group, r.company,
      r.items.map(i => i.itemKhmer + ' (' + i.code + ') [' + mtnStatusInfo(mtnItemStatusOf(r.sub, i.itemId)).label + ']').join(' | '),
      r.meta.requestedBy || '', r.meta.requestedAt || '', mtnStatusInfo(r.status).label,
      p.done + ' / ' + p.total,
      hasUpd ? (last.by || '') : '', hasUpd ? (last.at || '') : '', hasUpd ? (last.remark || '') : ''
    ].map(cell).join(','));
  });
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'MTN_Status_' + isoToday() + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); if (a.parentNode) a.remove(); }, 500);
  showAlert('CSV exported', 'success');
};

/* =========================================================
   ASSIGN DIALOG (Monthly – Admin)
   ========================================================= */
window.openAssignDialog = function(equipmentId){
  const eq = equipmentId ? (APP.equipmentMap[equipmentId] || {}) : {};
  $('#modalActionButtons').addClass('d-none');
  if ((APP.drivers || []).length === 0) { showAlert('No drivers in this group', 'warning'); return; }

  $('#modalTitle').text(equipmentId ? ('Assign — ' + (eq.shortName || equipmentId)) : 'New Assignment');
  $('#modalBody').html(
    '<div class="p-2"><div class="mb-3" style="position:relative;"><label class="form-label small fw-bold">Equipment</label>' +
      (equipmentId ? '<input class="form-control form-control-sm" value="' + esc(eq.shortName || equipmentId) + '" disabled>' : '<input type="text" class="form-control form-control-sm" id="assignEquipmentSearch" placeholder="Type equipment name or ID..." autocomplete="off" oninput="onEquipmentSearchInput(this.value)" onfocus="showEquipmentDropdown()" onblur="hideEquipmentDropdown()"><input type="hidden" id="assignEquipment" value=""><div id="assignEquipmentDropdown" style="display:none; position:absolute; top:100%; left:12px; right:12px; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:420px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div>') +
    '</div><div class="mb-3" style="position:relative;"><label class="form-label small fw-bold">Assign to Driver</label>' +
      '<div style="position:relative;"><input type="text" class="form-control form-control-sm" id="assignDriverSearch" placeholder="Type driver name or username..." autocomplete="off" style="padding-right:32px;" oninput="onDriverSearchInput(this.value)" onfocus="showDriverDropdown()" onblur="hideDriverDropdown()"><i class="bi bi-x-circle-fill" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); cursor:pointer; color:#adb5bd; font-size:14px;" onmousedown="clearDriverSearch(event)" title="Clear"></i></div>' +
      '<input type="hidden" id="assignDriver" value=""><div id="assignDriverDropdown" style="display:none; position:absolute; top:100%; left:12px; right:12px; background:#fff; border:1px solid #dee2e6; border-radius:6px; max-height:420px; overflow-y:auto; z-index:9999; box-shadow:0 6px 16px rgba(0,0,0,.15); margin-top:4px;"></div>' +
      '<div class="small text-muted mt-1"><i class="bi bi-info-circle me-1"></i>Any technician in your group can start the checklist.</div>' +
    '</div><button class="btn btn-primary w-100" onclick="submitAssign(\'' + escAttr(equipmentId || '') + '\')"><i class="bi bi-send me-1"></i>Send Assignment</button></div>'
  );
  
  $('#assignDriverSearch').prop('disabled', false).attr('placeholder', 'Type driver name or username...');
  $('#assignDriverDropdown, #assignEquipmentDropdown').hide();
  if (!equipmentId) { rebuildEquipmentData(); _assignDriverData = []; _selectedDriverUsername = ''; $('#assignDriverSearch').prop('disabled', true).attr('placeholder', 'Select equipment first...').val(''); $('#assignDriver').val(''); } 
  else { rebuildDriverData(equipmentId); }
  
  if (window.currentDetailModal) window.currentDetailModal.show();
  else { let m = new bootstrap.Modal(document.getElementById('detailModal')); m.show(); window.currentDetailModal = m; }
};

window.clearDriverSearch = function(e){
  if (e) e.preventDefault();
  const input = document.getElementById('assignDriverSearch');
  if (input) { input.value = ''; input.focus(); }
  _selectedDriverUsername = '';
  const hidden = document.getElementById('assignDriver');
  if (hidden) hidden.value = '';
  renderDriverDropdown('');
};

let _assignEquipmentData = [];
let _selectedEquipmentId = '';

function rebuildEquipmentData(){
  const list = (APP.equipment || []).filter(e => e.group === currentUser.group);
  _assignEquipmentData = list.map(e => ({ equipmentId: e.equipmentId, shortName: e.shortName || e.equipmentId, group: e.group, model: e.model || '' }));
  _selectedEquipmentId = '';
  const hidden = document.getElementById('assignEquipment');
  if (hidden) hidden.value = '';
  const input = document.getElementById('assignEquipmentSearch');
  if (input) input.value = '';
  renderEquipmentDropdown('');
}

function renderEquipmentDropdown(filterText){
  const dd = document.getElementById('assignEquipmentDropdown');
  if (!dd) return;
  const q = String(filterText || '').toLowerCase().trim();
  let matches = _assignEquipmentData;
  if (q) matches = _assignEquipmentData.filter(e => e.shortName.toLowerCase().includes(q) || e.equipmentId.toLowerCase().includes(q) || (e.model || '').toLowerCase().includes(q));

  const input = document.getElementById('assignEquipmentSearch');
  if (input) {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 20;
    const spaceAbove = rect.top - 20;
    const targetH = Math.min(420, matches.length * 56 + 16 || 100);
    if (spaceBelow >= targetH || spaceBelow >= spaceAbove) {
      dd.style.top = '100%'; dd.style.bottom = 'auto'; dd.style.marginTop = '4px'; dd.style.marginBottom = '0'; dd.style.maxHeight = Math.max(160, Math.min(420, spaceBelow)) + 'px';
    } else {
      dd.style.top = 'auto'; dd.style.bottom = '100%'; dd.style.marginTop = '0'; dd.style.marginBottom = '4px'; dd.style.maxHeight = Math.max(160, Math.min(420, spaceAbove)) + 'px';
    }
  }

  if (matches.length === 0) { dd.innerHTML = '<div class="p-2 small text-muted text-center"><i class="bi bi-search me-1"></i>No matching equipment</div>'; dd.style.display = 'block'; return; }

  dd.innerHTML = matches.map(e => {
    const isSelected = e.equipmentId === _selectedEquipmentId;
    return '<div class="p-2 driver-dd-item" style="cursor:pointer; border-bottom:1px solid #f0f0f0;' + (isSelected ? 'background:rgba(13,110,253,.08);' : '') + '" onmousedown="selectEquipmentOption(\'' + escAttr(e.equipmentId) + '\',\'' + escAttr(e.shortName) + '\')"><div class="fw-semibold" style="font-size:.85rem;">' + esc(e.shortName) + '</div><div class="small text-muted" style="font-size:.72rem;">' + esc(e.equipmentId) + (e.model ? ' · ' + esc(e.model) : '') + '</div></div>';
  }).join('');
  dd.style.display = 'block';
}

window.onEquipmentSearchInput = function(value){ _selectedEquipmentId = ''; const hidden = document.getElementById('assignEquipment'); if (hidden) hidden.value = ''; renderEquipmentDropdown(value); };
window.showEquipmentDropdown = function(){ const input = document.getElementById('assignEquipmentSearch'); renderEquipmentDropdown(input ? input.value : ''); };
window.hideEquipmentDropdown = function(){ setTimeout(() => { const dd = document.getElementById('assignEquipmentDropdown'); if (dd) dd.style.display = 'none'; }, 180); };
window.selectEquipmentOption = function(equipmentId, shortName){
  _selectedEquipmentId = equipmentId;
  const hidden = document.getElementById('assignEquipment'); if (hidden) hidden.value = equipmentId;
  const input = document.getElementById('assignEquipmentSearch'); if (input) input.value = shortName;
  const dd = document.getElementById('assignEquipmentDropdown'); if (dd) dd.style.display = 'none';
  rebuildDriverData(equipmentId);
};

let _assignDriverData = [];
let _selectedDriverUsername = '';

function rebuildDriverData(equipmentId){
  const $drvInput = $('#assignDriverSearch');
  if ($drvInput.length) { $drvInput.prop('disabled', false); $drvInput.attr('placeholder', 'Type driver name or username...'); }
  const drvList = (APP.drivers || []).filter(d => !d.group || d.group === currentUser.group);
  const equipmentDrivers = drvList.filter(d => equipmentId && (d.equipment || []).indexOf(equipmentId) !== -1);
  const otherDrivers = drvList.filter(d => !equipmentId || (d.equipment || []).indexOf(equipmentId) === -1);

  let defaultDriver = '';
  if (equipmentId && equipmentDrivers.length > 0) { const lastUsed = findDefaultDriver(equipmentId); defaultDriver = (lastUsed && equipmentDrivers.some(d => d.username === lastUsed)) ? lastUsed : equipmentDrivers[0].username; }
  else if (equipmentId) { defaultDriver = findDefaultDriver(equipmentId); }

  equipmentDrivers.sort((a, b) => { if (a.username === defaultDriver) return -1; if (b.username === defaultDriver) return 1; return String(a.fullName).localeCompare(String(b.fullName)); });
  otherDrivers.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
  const all = equipmentDrivers.concat(otherDrivers);

  _assignDriverData = all.map(d => ({ username: d.username, fullName: d.fullName, eqShortList: eqShortList(d.equipment || []), isDefault: d.username === defaultDriver, isForEq: equipmentId && (d.equipment || []).indexOf(equipmentId) !== -1 }));

  if (defaultDriver) {
    const def = all.find(d => d.username === defaultDriver);
    if (def) { _selectedDriverUsername = defaultDriver; $('#assignDriver').val(defaultDriver); $('#assignDriverSearch').val(def.fullName + ' (@' + def.username + ')'); }
  } else { _selectedDriverUsername = ''; $('#assignDriver').val(''); $('#assignDriverSearch').val(''); }
  renderDriverDropdown('');
}

function renderDriverDropdown(filterText){
  const dd = document.getElementById('assignDriverDropdown');
  if (!dd) return;
  const q = String(filterText || '').toLowerCase().trim();
  let matches = _assignDriverData;
  if (q) matches = _assignDriverData.filter(d => d.fullName.toLowerCase().includes(q) || d.username.toLowerCase().includes(q));

  const input = document.getElementById('assignDriverSearch');
  if (input) {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 20;
    const spaceAbove = rect.top - 20;
    const targetH = Math.min(420, matches.length * 56 + 16 || 100);
    if (spaceBelow >= targetH || spaceBelow >= spaceAbove) { dd.style.top = '100%'; dd.style.bottom = 'auto'; dd.style.marginTop = '4px'; dd.style.marginBottom = '0'; dd.style.maxHeight = Math.max(160, Math.min(420, spaceBelow)) + 'px'; }
    else { dd.style.top = 'auto'; dd.style.bottom = '100%'; dd.style.marginTop = '0'; dd.style.marginBottom = '4px'; dd.style.maxHeight = Math.max(160, Math.min(420, spaceAbove)) + 'px'; }
  }

  if (matches.length === 0) { dd.innerHTML = '<div class="p-2 small text-muted text-center"><i class="bi bi-search me-1"></i>No matching driver</div>'; dd.style.display = 'block'; return; }

  dd.innerHTML = matches.map(d => {
    const isSelected = d.username === _selectedDriverUsername;
    const label = d.fullName + ' (@' + d.username + ')';
    const badgeDefault = d.isDefault ? ' <span class="badge bg-warning text-dark" style="font-size:.6rem;">⭐ default</span>' : '';
    const badgeMatch = (d.isForEq && !d.isDefault) ? ' <span class="badge bg-success" style="font-size:.6rem;">✓</span>' : '';
    return '<div class="p-2 driver-dd-item" style="cursor:pointer; border-bottom:1px solid #f0f0f0;' + (isSelected ? 'background:rgba(13,110,253,.08);' : '') + '" onmousedown="selectDriverOption(\'' + escAttr(d.username) + '\',\'' + escAttr(label) + '\')"><div class="fw-semibold" style="font-size:.85rem;">' + esc(d.fullName) + ' <small class="text-muted">(@' + esc(d.username) + ')</small>' + badgeDefault + badgeMatch + '</div>' + (d.eqShortList ? '<div class="small text-muted" style="font-size:.72rem;">' + esc(d.eqShortList) + '</div>' : '') + '</div>';
  }).join('');
  dd.style.display = 'block';
}

window.onDriverSearchInput = function(value){ _selectedDriverUsername = ''; const hidden = document.getElementById('assignDriver'); if (hidden) hidden.value = ''; renderDriverDropdown(value); const dd = document.getElementById('assignDriverDropdown'); if (dd) dd.style.display = 'block'; };
window.showDriverDropdown = function(){ const input = document.getElementById('assignDriverSearch'); if (input) input.select(); renderDriverDropdown(''); };
window.hideDriverDropdown = function(){ setTimeout(() => { const dd = document.getElementById('assignDriverDropdown'); if (dd) dd.style.display = 'none'; }, 180); };
window.selectDriverOption = function(username, label){
  _selectedDriverUsername = username;
  const hidden = document.getElementById('assignDriver'); if (hidden) hidden.value = username;
  const input = document.getElementById('assignDriverSearch'); if (input) input.value = label;
  const dd = document.getElementById('assignDriverDropdown'); if (dd) dd.style.display = 'none';
};

window.submitAssignToAll = function(equipmentId){
  const eq = APP.equipmentMap[equipmentId] || {};
  const matching = (APP.drivers || []).filter(d => d.group === eq.group && (d.equipment || []).indexOf(equipmentId) !== -1);
  if (matching.length < 2) { showAlert('មិនមានអ្នកបើកបរគ្រប់គ្រាន់ទេ', 'warning'); return; }

  showLoading('កំពុងផ្ញើទៅអ្នកបើកបរ ' + matching.length + ' នាក់...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      if (window.currentDetailModal) window.currentDetailModal.hide();
      showAlert('បានផ្ញើទៅអ្នកបើកបរ ' + matching.length + ' នាក់', 'success');
      reloadAll('home');
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).createAssignment({ equipmentId: equipmentId, trailerId: eq.trailerId || '', group: eq.group || '', techUsername: currentUser.username, techName: currentUser.fullName, driverUsernames: matching.map(d => ({ username: d.username, fullName: d.fullName })) });
};

window.submitAssign = function(fixedEquipmentId){
  const equipmentId = fixedEquipmentId || $('#assignEquipment').val() || _selectedEquipmentId;
  if (!equipmentId) { showAlert('Please select equipment', 'warning'); return; }
  const driverUsername = $('#assignDriver').val() || _selectedDriverUsername;
  if (!driverUsername) { showAlert('Please select a driver', 'warning'); return; }

  const eq  = APP.equipmentMap[equipmentId] || {};
  const drv = (APP.drivers || []).find(d => d.username === driverUsername) || {};

  showLoading('កំពុងផ្ញើ...');
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      if (window.currentDetailModal) window.currentDetailModal.hide();
      APP.assignments.push({ assignmentId: res.assignmentId, date: dmyToday(), equipmentId: equipmentId, trailerId: eq.trailerId || '', group: eq.group || '', techUsername: '', techName: '', driverUsername: driverUsername, driverName: drv.fullName || driverUsername, status: 'Pending', remark: '', createdAt: dmyToday() + ' ' + nowTimeStr(), confirmedAt: '', completedAt: '', handoverCheckId: '', batchId: '', assignerUsername: currentUser.username, assignerName: currentUser.fullName });
      showAlert('បានផ្ញើ — រង្ងចាំការបញ្ជាក់', 'success');
      refreshCurrentPage();
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).createAssignment({ equipmentId: equipmentId, trailerId: eq.trailerId || '', group: eq.group || '', driverUsername: driverUsername, driverName: drv.fullName || driverUsername, assignerUsername: currentUser.username, assignerName: currentUser.fullName });
};

window.cancelAssign = function(assignmentId){
  if (!confirm('បោះបង់ការចាត់តាំងនេះ?')) return;
  showLoading();
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      const a = APP.assignments.find(x => x.assignmentId === assignmentId);
      if (a) { a.status = 'Cancelled'; a.remark = 'Cancelled by technician'; a.confirmedAt = dmyToday() + ' ' + nowTimeStr(); }
      showAlert('បានបោះបង់', 'success'); refreshCurrentPage();
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).cancelAssignment({ assignmentId: assignmentId, techUsername: currentUser.username });
};

window.cancelAssignBatch = function(batchId, singleId){
  if (!confirm('បោះបង់ការចតតាំងទាំងអស់?')) return;
  showLoading('កំពុងបោះបង់...');
  if (batchId) {
    const siblings = (APP.assignments || []).filter(a => a.batchId === batchId && a.status === 'Pending').map(a => a.assignmentId);
    if (siblings.length === 0) { hideLoading(); return; }
    google.script.run.withSuccessHandler(() => {
      hideLoading();
      siblings.forEach(id => { const a = APP.assignments.find(x => x.assignmentId === id); if (a && a.status === 'Pending') { a.status = 'Cancelled'; a.remark = 'Cancelled by technician'; a.confirmedAt = dmyToday() + ' ' + nowTimeStr(); } });
      showAlert('បានបោះបង់ ' + siblings.length + ' ការចាត់តាំង', 'success'); refreshCurrentPage();
    }).withFailureHandler(handleError).cancelAssignmentBulk({ assignmentIds: siblings, techUsername: currentUser.username });
    return;
  }
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (res && res.success) {
      const a = APP.assignments.find(x => x.assignmentId === singleId);
      if (a) { a.status = 'Cancelled'; a.remark = 'Cancelled by technician'; a.confirmedAt = dmyToday() + ' ' + nowTimeStr(); }
      showAlert('បានបោះបង់', 'success'); refreshCurrentPage();
    } else showAlert((res && res.message) || 'Error', 'danger');
  }).withFailureHandler(handleError).cancelAssignment({ assignmentId: singleId, techUsername: currentUser.username });
};


/*ScriptDaily*/

/* =========================================================
   DAILY CHECKLIST STATE
   ========================================================= */
let pendingDailyChecklist = null;
let nokPhotos = [];
// Finished Form draft (kept here so showPage() can always clear it safely)
let dailyFinishState = { checkId: '', items: [], answers: {}, extras: {} };
let dailyDetailFilter = 'all';

let dailyDashboardSubTab = 'overview';
let dailyMtnFilter = 'pending';
let dailyMtnDisplayLimit = 10;
let dailyMtnItemFilter = null;
let dailyMtnItemLabel = '';
let dailyMtnIsUrgentOnly = false;

let needAttentionViewAllDaily = false;
let topIssuesViewAllDaily = false;

let dailyListFilters = {
  status: 'all', checkType: 'all', confirmStatus: 'all', opStatus: 'all',
  group: 'all', equipmentId: 'all', driver: 'all',
  dateFrom: '', dateTo: '', search: '', nokItemIds: [], nokItemLabel: ''
};

/* =========================================================
   DRILL DOWN & ROUTING
   ========================================================= */
window.drillToDaily = function(params) {
  dailyListFilters = {
    status: 'all', checkType: 'all', confirmStatus: 'all', opStatus: 'all',
    group: 'all', equipmentId: 'all', driver: 'all',
    dateFrom: '', dateTo: '', search: '', nokItemIds: [], nokItemLabel: ''
  };
  Object.keys(params || {}).forEach(k => { dailyListFilters[k] = params[k]; });
  showPage('list');
};

window.drillToDailyIssue = function(itemIdsCsv, label) {
  const ids = String(itemIdsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  drillToDaily({ status: 'all', nokItemIds: ids, nokItemLabel: label || '' });
};

/* =========================================================
   DAILY OPERATIONAL FLOW
   Operating (default on submit) ⇄ Stand By → Finished (form)
   → Waiting Handover → Handed Over (verified by next driver)
   ========================================================= */
const DAILY_OP_OPERATING = 'Operating';
const DAILY_OP_STANDBY   = 'Stand By';
const DAILY_OP_WAITING   = 'Waiting Handover';
const DAILY_OP_HANDED    = 'Handed Over';

function dailyNormOp(v){
  const s = String(v == null ? '' : v).trim();
  const k = s.toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!k) return '';
  if (k === 'operating' || k === 'operate' || k === 'active' || k === 'running') return DAILY_OP_OPERATING;
  if (k === 'stand by' || k === 'standby' || k === 'pause' || k === 'paused' || k === 'break') return DAILY_OP_STANDBY;
  if (k === 'finished' || k === 'finish') return DAILY_OP_WAITING;
  if (k === 'waiting handover' || k === 'waiting for handover' || k === 'awaiting handover') return DAILY_OP_WAITING;
  if (k === 'handed over' || k === 'handedover' || k === 'handover done' || k === 'completed') return DAILY_OP_HANDED;
  return s;
}

function dailyIsOpenOp(op){ return op === DAILY_OP_OPERATING || op === DAILY_OP_STANDBY; }

function dailyOpInfo(status){
  const st = dailyNormOp(status);
  if (st === DAILY_OP_OPERATING) return { status: st, label: 'Operating', icon: 'bi-play-circle-fill', cls: 'op-operating', hint: 'Active work — the equipment is running.' };
  if (st === DAILY_OP_STANDBY)   return { status: st, label: 'Stand By', icon: 'bi-pause-circle-fill', cls: 'op-standby', hint: 'Taking a break — switch back to Operating anytime.' };
  if (st === DAILY_OP_WAITING)   return { status: st, label: 'Waiting Handover', icon: 'bi-hourglass-split', cls: 'op-waiting', hint: 'Finished form sent — the next driver must verify the handover.' };
  if (st === DAILY_OP_HANDED)    return { status: st, label: 'Handed Over', icon: 'bi-check2-circle', cls: 'op-handover', hint: 'Verified by the next driver — this shift is locked.' };
  return { status: '', label: 'Not started', icon: 'bi-dash-circle', cls: 'op-none', hint: '' };
}

function dailyOpBadge(status){
  const info = dailyOpInfo(status);
  if (!info.status) return '';
  return '<span class="op-badge ' + info.cls + '"><i class="bi ' + info.icon + ' me-1"></i>' + esc(info.label) + '</span>';
}

function dailyNumText(v){
  if (v === '' || v == null) return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? String(v) : String(n);
}

// Show a person's full name when we know it, otherwise the username
function dailyUserLabel(username){
  const u = String(username || '');
  if (!u) return '';
  const found = (APP.users || []).find(x => x.username === u);
  return (found && found.fullName) ? found.fullName : u;
}

// Show a trailer short name when we know it, otherwise the raw trailer id
function dailyTrailerShort(trailerId){
  const id = String(trailerId || '').trim();
  if (!id) return '';
  const t = (APP.trailers || []).find(x => x && String(x.trailerId) === id);
  return t ? String(t.shortName || t.trailerId) : id;
}

// Newest DAILY shift for one equipment (weekly checks never own the equipment)
function dailyLatestSub(equipmentId){
  let best = null, bestMs = -1;
  (APP.dailySubmissions || []).forEach(s => {
    if (String(s.equipmentId) !== String(equipmentId)) return;
    if (dailyIsWeekly(s)) return;
    const ms = subMs(s);
    if (ms >= bestMs) { bestMs = ms; best = s; }
  });
  return best;
}

// My own newest shift per equipment, only while it is Operating or Stand By
function dailyMyOpenShift(){
  const me = currentUser && currentUser.username;
  if (!me) return [];
  const seen = {}, out = [];
  dailyShiftOnly(APP.dailySubmissions || [])
    .slice()
    .sort((a, b) => subMs(b) - subMs(a))
    .forEach(s => {
      if (s.username !== me) return;
      if (seen[s.equipmentId]) return;
      seen[s.equipmentId] = 1;
      if (dailyIsOpenOp(dailyNormOp(s.opStatus))) out.push(s);
    });
  return out;
}

function dailyShiftStartValues(prev){
  if (!prev) return { odo: '', hour: '' };
  const num = (v) => {
    if (v === '' || v == null) return '';
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? '' : n;
  };
  return {
    odo: num(prev.endOdo),
    hour: num(prev.endHour)
  };
}

/* =========================================================
   CHECK FREQUENCY — Daily / Weekly / Finish
   Checklist_Template column H (Frequency) decides which form an item
   belongs to. A blank cell = the normal daily checklist, so existing
   templates need no migration.
   ========================================================= */
const DAILY_FREQ_DAILY  = 'Daily';
const DAILY_FREQ_WEEKLY = 'Weekly';
const DAILY_FREQ_FINISH = 'Finish';

function dailyNormFreq(v){
  const k = String(v == null ? '' : v).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!k) return DAILY_FREQ_DAILY;
  if (k === 'weekly' || k === 'week' || k === '7d' || k === '7 day' || k === '7 days' || k === 'every 7 days') return DAILY_FREQ_WEEKLY;
  if (k === 'finish' || k === 'finished' || k === 'finished form' || k === 'finish form' || k === 'end' || k === 'end of shift') return DAILY_FREQ_FINISH;
  return DAILY_FREQ_DAILY;
}

// Items of one group + frequency. Group match is tolerant and falls back to an 'ALL' group.
function dailyTplItems(group, freq){
  const all  = APP.dailyTemplates || {};
  const want = dailyNormFreq(freq);
  const g    = String(group || '').trim().toLowerCase();
  let keys = Object.keys(all).filter(k => k.trim().toLowerCase() === g);
  if (!keys.length) keys = Object.keys(all).filter(k => k.trim().toLowerCase() === 'all');
  let list = [];
  keys.forEach(k => { list = list.concat(all[k] || []); });
  return list
    .filter(it => dailyNormFreq(it.frequency) === want)
    .sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0));
}

function dailyIsWeekly(s){ return !!s && dailyNormFreq(s.checkType) === DAILY_FREQ_WEEKLY; }
function dailyShiftOnly(list){ return (list || []).filter(s => !dailyIsWeekly(s)); }

function dailySetting(key, fallback){
  const s = APP.dailySettings || {};
  const v = s[key];
  return (v === '' || v == null) ? fallback : v;
}

// Wording lives in the Settings sheet (Key = DriverAgreement) — edit it there, no code change needed
function dailyAgreementText(){
  return String(dailySetting('driverAgreement',
    'I confirm that I have not used drugs or alcohol, that I am fit and rested to operate this equipment, ' +
    'and that I will follow all safety rules.'));
}

function dailyWeekDays(){
  const n = parseInt(dailySetting('weeklyIntervalDays', 7), 10);
  return (isNaN(n) || n <= 0) ? 7 : n;
}

function dailyParseDmy(str){
  const m = String(str || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0, 0);
}

function dailyFmtDmy(ms){
  const d = new Date(ms);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

// Weekly (7-day) check state for one equipment
function dailyWeeklyInfo(eqId){
  const days = dailyWeekDays();
  let last = null, lastMs = -1;
  (APP.dailySubmissions || []).forEach(s => {
    if (String(s.equipmentId) !== String(eqId)) return;
    if (!dailyIsWeekly(s)) return;
    const d = dailyParseDmy(s.date);
    if (!d) return;
    if (d.getTime() >= lastMs) { lastMs = d.getTime(); last = s; }
  });
  const today = dailyParseDmy(dmyToday());
  const todayMs = today ? today.getTime() : new Date().setHours(0, 0, 0, 0);
  if (!last) return { due: true, never: true, last: null, days: days, nextDate: '', overdueDays: 0 };
  const dueMs = lastMs + days * 86400000;
  return {
    due: todayMs >= dueMs, never: false, last: last, days: days,
    nextDate: dailyFmtDmy(dueMs),
    overdueDays: Math.max(0, Math.floor((todayMs - dueMs) / 86400000))
  };
}

// Equipment the signed-in driver may check: profile list first, own submissions as a fallback
function dailyMyEquipmentIds(){
  const me = currentUser && currentUser.username;
  const ids = ((currentUser && currentUser.equipment) || []).map(x => String(x).trim()).filter(Boolean);
  if (!ids.length) {
    (APP.dailySubmissions || []).forEach(s => {
      if (s.username !== me) return;
      const id = String(s.equipmentId || '').trim();
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
  }
  return ids;
}

// Assigned driver (full name) for one equipment — used on the driver cards
function dailyEquipmentDriverName(eqId){
  const id = String(eqId || '').trim();
  if (!id) return '';
  const has = (list) => (list || []).map(String).indexOf(id) !== -1;
  const d = (APP.drivers || []).find(x => has(x.equipment));
  if (d) return d.fullName || d.username || '';
  const u = (APP.users || []).find(x => has(x.equipment));
  return (u && (u.fullName || u.username)) || '';
}

function dailyKvRow(label, value){
  if (value === '' || value == null) return '';
  return '<div class="op-kv"><span class="text-muted">' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
}

/* The live shift card shown on the driver home while Operating / Stand By */
function dailySessionCard(s){
  const info = dailyOpInfo(s.opStatus);
  const eq = APP.equipmentMap[s.equipmentId] || {};
  const starts = dailyShiftStartValues(s);
  const startLine = (starts.odo !== '' || starts.hour !== '')
    ? '<div class="small text-muted mt-1"><i class="bi bi-speedometer2 me-1"></i>Start Odometer ' + esc(starts.odo || '—') + ' · OPHour ' + esc(starts.hour || '—') + '</div>'
    : '';
  return '<div class="card session-card mb-2 ' + info.cls + '">' +
    '<div class="card-body py-2">' +
      '<div class="d-flex justify-content-between align-items-start mb-1">' +
        '<div><div class="fw-bold"><i class="bi bi-truck me-1"></i>' + esc(eq.shortName || s.equipmentId) + '</div>' +
          '<div class="small text-muted">' + esc(s.checkId) + ' · since ' + esc(s.date) + ' ' + esc(s.time) + '</div></div>' +
        dailyOpBadge(s.opStatus) +
      '</div>' +
      '<div class="small text-muted">' + esc(info.hint) + '</div>' +
      startLine +
      '<div class="d-flex gap-2 flex-wrap mt-2">' +
        (info.status === DAILY_OP_OPERATING
          ? '<button class="btn btn-sm btn-outline-warning" onclick="event.stopPropagation();setDailyOpStatus(\'' + escAttr(s.checkId) + '\',\'' + DAILY_OP_STANDBY + '\')"><i class="bi bi-pause-circle me-1"></i>Stand By</button>'
          : '<button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation();setDailyOpStatus(\'' + escAttr(s.checkId) + '\',\'' + DAILY_OP_OPERATING + '\')"><i class="bi bi-play-circle me-1"></i>Operating</button>') +
        '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();openDailyFinishForm(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-flag me-1"></i>Finished</button>' +
        '<button class="btn btn-sm btn-outline-primary ms-auto" onclick="event.stopPropagation();viewDailyCheck(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-eye"></i></button>' +
      '</div>' +
    '</div></div>';
}

/* Read-only Finished Form answers (OK / NOT OK / N/A + note per item) */
/* Read-only photo thumbnails for stored ids ({fileId} entries only).
   The gallery stays collapsed — the viewer taps the photo chip on that item
   to reveal the thumbnails (nothing opens by itself). */
function dailyPhotoIdsHtml(photos, size){
  const list = (Array.isArray(photos) ? photos : []).filter(p => p && p.fileId);
  if (!list.length) return '';
  const ids = list.map(p => p.fileId).join(',');
  return '<div class="view-photo-wrap">' +
    '<button type="button" class="photo-chip" onclick="toggleItemPhotos(event, this)">' +
      '<i class="bi bi-camera"></i>' + list.length + ' photo' + (list.length > 1 ? 's' : '') +
      '<i class="bi bi-chevron-down chev"></i>' +
    '</button>' +
    '<div class="photo-gallery mt-1 is-collapsed">' + list.map((p, i) =>
      '<div class="photo-tile" onclick="openLightboxByIds(\'' + escAttr(ids) + '\',' + i + ')">' +
        '<img src="' + driveThumbUrl(p.fileId, size || 200) + '" loading="lazy" decoding="async" alt="">' +
      '</div>').join('') + '</div></div>';
}

/* Tap-to-reveal photos on a read-only item card */
window.toggleItemPhotos = function(ev, btn){
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const $btn = $(btn);
  const $gallery = $btn.closest('.view-photo-wrap').find('.photo-gallery');
  const open = $gallery.hasClass('is-collapsed');
  $gallery.toggleClass('is-collapsed', !open);
  $btn.toggleClass('is-open', open);
};

function dailyFinishChecksHtml(s){
  const list = Array.isArray(s && s.finishChecks) ? s.finishChecks : [];
  if (!list.length) return '';
  const labels = { ok: 'OK', nok: 'NOT OK', na: 'N/A' };
  const rows = list.map((c, i) => {
    const cls  = c.status === 'ok' ? 'ok' : c.status === 'nok' ? 'nok' : 'na';
    const icon = c.status === 'ok' ? 'check-circle' : c.status === 'nok' ? 'x-circle' : 'dash-circle';
    const name = c.itemKhmer || c.itemEng || c.itemId;
    return '<div class="check-item '+cls+'">' +
      '<div class="d-flex justify-content-between align-items-center">' +
        '<div><span class="item-num">'+(i+1)+'.</span><span class="item-name-kh">'+esc(name)+'</span>' +
        (c.itemEng && c.itemKhmer ? '<div class="item-name-en">'+esc(c.itemEng)+'</div>' : '') + '</div>' +
        '<span class="small text-nowrap">'+esc(labels[c.status] || c.status) + ' <i class="bi bi-'+icon+'"></i></span>' +
      '</div>' +
      (c.note ? '<div class="small text-danger mt-1"><i class="bi bi-chat-left-text me-1"></i>'+esc(c.note)+'</div>' : '') +
      dailyPhotoIdsHtml(c.photos) +
    '</div>';
  }).join('');
  return '<div class="card mb-3"><div class="group-header"><i class="bi bi-flag me-2 text-danger"></i>ការត្រួតពិនិត្យក្រោយប្រតិបត្តិការ</div>' +
    '<div class="card-body p-2"><div class="check-grid">' + rows + '</div></div></div>';
}


/* The four Finished Form inputs (End Odometer, End OPHour, Diesel level, Fuel
   added) read back as ONE block — each tile carries its own photos, revealed
   only when the viewer taps that tile's photo chip. */
function dailyFinishExtraHtml(s){
  const fx = (s && s.finishExtra) || {};
  const txt = v => (v === '' || v == null) ? '—' : dailyNumText(v);
  const defs = [
    { key: 'endOdo',    label: 'គីឡូម៉ែត្រចុងក្រោយ',                    en: 'End Odometer', value: s ? s.endOdo  : '' },
    { key: 'endHour',   label: 'ម៉ោងប្រតិបត្តិការចុងក្រោយ',                en: 'End OPHour',   value: s ? s.endHour : '' },
    { key: 'fuelLevel', label: 'កម្រិតប្រេងម៉ាស៊ូត',                    en: 'Diesel level' },
    { key: 'fuelAdded', label: 'បរិមាណប្រេងបានចាក់អំឡុងពេលប្រតិបត្តិការ', en: 'Fuel added' }
  ];
  const tiles = defs.map(d => {
    const v = fx[d.key] || {};
    const value = (d.value !== undefined) ? d.value : v.value;
    const photos = Array.isArray(v.photos) ? v.photos : [];
    const has = (value !== '' && value != null) || photos.length > 0;
    if (!has) return '';
    return '<div class="finish-tile">' +
      '<div class="small text-muted">' + esc(d.label) + ' <span class="fw-normal">(' + esc(d.en) + ')</span></div>' +
      '<div class="finish-val">' + esc(txt(value)) + '</div>' +
      dailyPhotoIdsHtml(photos) +
    '</div>';
  }).join('');
  if (!tiles) return '';
  return '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center">' +
      '<span><i class="bi bi-clipboard2-data me-2"></i>ទិន្នន័យបញ្ចប់ប្រតិបត្តិការ</span>' +
      '<small class="text-muted">4 fields</small>' +
    '</div><div class="card-body p-2"><div class="finish-grid">' + tiles + '</div></div></div>';
}

/* Operational panel used inside the daily detail modal */
function dailyOpSectionHtml(s){
  const info = dailyOpInfo(s.opStatus);
  if (!info.status) return '';
  const isOwner = s.username === (currentUser && currentUser.username);
  const active = dailyIsOpenOp(info.status);

  // Calculate Nets (Difference between Start and End)
  const startOdo  = parseFloat(s.startOdo) || 0;
  const endOdo    = parseFloat(s.endOdo) || 0;
  const startHour = parseFloat(s.startHour) || 0;
  const endHour   = parseFloat(s.endHour) || 0;

  const netOdo  = (s.startOdo !== '' && s.endOdo !== '' && endOdo >= startOdo) ? (endOdo - startOdo) : null;
  const netHour = (s.startHour !== '' && s.endHour !== '' && endHour >= startHour) ? (endHour - startHour) : null;

  // Helper to format numbers (removes trailing .0 if integer)
  const fmt = (val, isNet) => {
    if (val === null || isNaN(val)) return '—';
    let txt = Number.isInteger(val) ? val.toString() : val.toFixed(1);
    return isNet && val > 0 ? '+' + txt : txt;
  };

  // CSS for the clean table layout
  const tableStyle = 'width:100%; border-collapse:collapse; font-size:.82rem; text-align:center;';
  const thStyle = 'padding:6px; background:var(--bg-color); border-bottom:2px solid var(--border-color); color:var(--tab-text); font-weight:700; font-size:.72rem;';
  const tdStyle = 'padding:6px; border-bottom:1px dashed var(--border-color); font-weight:600; color:var(--text-color);';
  const tdNetStyle = 'padding:6px; border-bottom:1px dashed var(--border-color); font-weight:800; color:var(--tab-active);';

  let html = '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-activity me-2"></i>ស្ថានភាពប្រតិបត្តិការ</span>' + dailyOpBadge(s.opStatus) + '</div><div class="card-body py-2 px-2">';
  
  if (s.opAt) html += '<div class="small text-muted mb-3"><i class="bi bi-clock-history me-1"></i>Updated ' + esc(s.opAt) + (s.opBy ? ' · ' + esc(dailyUserLabel(s.opBy)) : '') + '</div>';
  
  // 👇 NEW TABLE VIEW 👇
  html += '<table style="' + tableStyle + '">' +
    '<thead><tr>' +
      '<th style="' + thStyle + ' text-align:left; padding-left:12px;">Start</th>' +
      '<th style="' + thStyle + '">End</th>' +
      '<th style="' + thStyle + '">Net</th>' +
    '</tr></thead>' +
    '<tbody>' +
      '<tr>' +
        '<td style="' + tdStyle + ' text-align:left; padding-left:12px;"><i class="bi bi-speedometer2 me-1 text-muted"></i>កុងទ័រគីឡូម៉ែត្រ</td>' +
        '<td style="' + tdStyle + '">' + fmt(startOdo) + '</td>' +
        '<td style="' + tdStyle + '">' + fmt(endOdo) + '</td>' +
        '<td style="' + tdNetStyle + '">' + fmt(netOdo, true) + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td style="' + tdStyle + ' text-align:left; padding-left:12px;"><i class="bi bi-hourglass-split me-1 text-muted"></i>កុងទ័រម៉ោង</td>' +
        '<td style="' + tdStyle + '">' + fmt(startHour) + '</td>' +
        '<td style="' + tdStyle + '">' + fmt(endHour) + '</td>' +
        '<td style="' + tdNetStyle + '">' + fmt(netHour, true) + '</td>' +
      '</tr>' +
    '</tbody>' +
  '</table>';

  // 👇 Moved Table Headers to match the Row Layout properly 👇
  html = html.replace('<thead><tr><th style="' + thStyle + ' text-align:left; padding-left:12px;">Start</th><th style="' + thStyle + '">End</th><th style="' + thStyle + '">Net</th></tr></thead>', 
    '<thead><tr>' +
      '<th style="' + thStyle + ' text-align:left; padding-left:12px;">Description</th>' +
      '<th style="' + thStyle + '">Start</th>' +
      '<th style="' + thStyle + '">End</th>' +
      '<th style="' + thStyle + '">Net</th>' +
    '</tr></thead>'
  );


  if (s.endRemark) html += '<div class="small mt-3"><span class="text-muted">Final Remark</span><div>' + esc(s.endRemark) + '</div></div>';
  if (s.finishedAt) html += '<div class="small text-muted mt-2"><i class="bi bi-flag me-1"></i>Finished ' + esc(s.finishedAt) + (s.finishedBy ? ' · ' + esc(dailyUserLabel(s.finishedBy)) : '') + '</div>';
  
  if (s.handoverBy) {
    html += '<div class="small text-success mt-2"><i class="bi bi-shield-check me-1"></i>Handover verified by ' + esc(dailyUserLabel(s.handoverBy)) + (s.handoverAt ? ' · ' + esc(s.handoverAt) : '') + '</div>';
    if (s.handoverRemark) html += '<div class="small text-muted mt-1">' + esc(s.handoverRemark) + '</div>';
  }
  
  if (isOwner && active) {
    html += '<div class="d-flex gap-2 flex-wrap mt-3 pt-3 border-top" style="border-color:var(--border-color) !important;">' +
      (info.status === DAILY_OP_OPERATING
        ? '<button class="btn btn-sm btn-outline-warning flex-fill" onclick="dailyDetailOp(\'' + escAttr(s.checkId) + '\',\'' + DAILY_OP_STANDBY + '\')"><i class="bi bi-pause-circle me-1"></i>Stand By</button>'
        : '<button class="btn btn-sm btn-outline-success flex-fill" onclick="dailyDetailOp(\'' + escAttr(s.checkId) + '\',\'' + DAILY_OP_OPERATING + '\')"><i class="bi bi-play-circle me-1"></i>Operating</button>') +
      '<button class="btn btn-sm btn-danger flex-fill" onclick="dailyDetailFinish(\'' + escAttr(s.checkId) + '\')"><i class="bi bi-flag me-1"></i>Finished</button>' +
    '</div>';
  }
  html += '</div></div>';
  return html;
}

window.dailyDetailOp = function(checkId, status){
  const el = document.getElementById('detailModal');
  const m = el ? bootstrap.Modal.getInstance(el) : null;
  if (m) m.hide();
  setDailyOpStatus(checkId, status);
};

window.dailyDetailFinish = function(checkId){
  const el = document.getElementById('detailModal');
  const m = el ? bootstrap.Modal.getInstance(el) : null;
  if (m) m.hide();
  openDailyFinishForm(checkId);
};

/* =========================================================
   START & HANDOVER
   ========================================================= */
window.startDailyChecklist = function(equipmentId, group, shortName){
  const me = currentUser.username;
  const latest = dailyLatestSub(equipmentId);
  const op = latest ? dailyNormOp(latest.opStatus) : '';
  const mine = !!latest && latest.username === me;

  // Equipment is still being used by another driver — no blank checklist allowed
  if (latest && !mine && dailyIsOpenOp(op)) {
    showAlert(latest.driverName + ' is still using this equipment (' + op + '). The shift must be finished first.', 'warning');
    return;
  }

  // Previous driver finished → handover review is mandatory
  if (latest && !mine && op === DAILY_OP_WAITING) {
    renderDailyHandoverConfirmation(latest, equipmentId, group, shortName);
    return;
  }

  // My own shift is still open
  if (latest && mine && dailyIsOpenOp(op)) {
    showAlert('Your shift on this equipment is still open (' + op + '). Use Stand By or Finished on your shift card.', 'warning');
    return;
  }

  // Already finished today → the next driver must verify before this equipment starts again
  if (latest && mine && op === DAILY_OP_WAITING && latest.date === dmyToday()) {
    showAlert('Your shift today is finished. The next driver must verify the handover before a new checklist can start.', 'info');
    return;
  }

  // Finished / handed over shifts pass their odometer + hour meter to the new checklist
  const inherited = (latest && (op === DAILY_OP_WAITING || op === DAILY_OP_HANDED)) ? latest : null;
  loadAndRenderDailyForm(equipmentId, group, shortName, inherited ? inherited.checkId : '', '', inherited, DAILY_FREQ_DAILY);
};

// Weekly check (every 7 days): a plain form — no operating state, no handover, no meter inheritance
window.startWeeklyChecklist = function(equipmentId, group, shortName){
  const info = dailyWeeklyInfo(equipmentId);
  if (!info.due && info.last) {
    showAlert('Weekly check already done on ' + info.last.date + ' — next due ' + info.nextDate, 'info');
    return;
  }
  // loadAndRenderDailyForm self-heals a template that is missing from memory
  loadAndRenderDailyForm(equipmentId, group, shortName, '', '', null, DAILY_FREQ_WEEKLY);
};

function loadAndRenderDailyForm(equipmentId, group, shortName, prevCheckId, handoverRemark, prevSub, checkType){
  const type  = dailyNormFreq(checkType || DAILY_FREQ_DAILY);
  const items = dailyTplItems(group, type);
  if (items.length === 0) {
    const hint = (type === DAILY_FREQ_WEEKLY)
      ? 'No weekly items in the template for group: ' + (group || '—') + '. Add rows with Frequency = Weekly.'
      : (type === DAILY_FREQ_FINISH)
        ? 'No Finished Form items in the template for group: ' + (group || '—') + '. Add rows with Frequency = Finish.'
        : 'No template for group: ' + (group || '—');
    // The template may only be missing from memory (a sync that did not arrive).
    // Reload the daily data once and retry before telling the user it is missing.
    showLoading('កំពុងផ្ទុក template...');
    reloadDailyData(ok => {
      hideLoading();
      if (dailyTplItems(group, type).length) {
        loadAndRenderDailyForm(equipmentId, group, shortName, prevCheckId, handoverRemark, prevSub, type);
        return;
      }
      showAlert(ok ? hint : 'Could not load the checklist data. Check your connection and try again.', 'danger');
    });
    return;
  }
  const starts = (type === DAILY_FREQ_DAILY) ? dailyShiftStartValues(prevSub) : { odo: '', hour: '' };
  const eqInfo = APP.equipmentMap[equipmentId] || {};
  // Trailer: inherited from the previous shift when possible, else the default
  // trailer of the equipment. Weekly checks have no trailer.
  const trailerDefault = (type === DAILY_FREQ_DAILY)
    ? String((prevSub && prevSub.trailerId) || eqInfo.trailerId || '')
    : '';

  pendingDailyChecklist = {
    equipmentId: equipmentId, group: group, shortName: shortName,
    checkType: type,
    handoverCheckId: prevCheckId || '',
    handoverRemark: handoverRemark || '',
    prevDriverName: prevSub ? (prevSub.driverName || '') : '',
    startOdo: starts.odo,
    startHour: starts.hour,
    trailerId: trailerDefault,
    agreed: false,
    items: items.slice(), 
    remarkPhotos: [],
    checks: {}
  };
  
  items.forEach(it => { 
    // OK is the default answer — the driver only changes the items that are not OK
    pendingDailyChecklist.checks[it.itemId] = { itemId: it.itemId, status: 'ok', note: '', photos: [] }; 
  });
  
  renderDailyChecklistForm();
}

function dailyFinishSummaryHtml(prev){
  const hasEnd = (prev.endOdo !== '' && prev.endOdo != null) || (prev.endHour !== '' && prev.endHour != null) || !!prev.endRemark;
  if (!hasEnd) return '';
  return '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-clipboard2-check me-2"></i>Finished Form — previous shift</span>' + dailyOpBadge(prev.opStatus) + '</div>' +
    '<div class="card-body py-2">' +
      dailyKvRow('End Odometer', (prev.endOdo === '' || prev.endOdo == null) ? '' : dailyNumText(prev.endOdo)) +
      dailyKvRow('End OPHour', (prev.endHour === '' || prev.endHour == null) ? '' : dailyNumText(prev.endHour)) +
      (prev.endRemark ? '<div class="small mt-2"><span class="text-muted">Final Remark</span><div>' + esc(prev.endRemark) + '</div></div>' : '') +
      (prev.finishedAt ? '<div class="small text-muted mt-2"><i class="bi bi-clock-history me-1"></i>' + esc(prev.driverName || dailyUserLabel(prev.finishedBy)) + ' · ' + esc(prev.finishedAt) + '</div>' : '') +
    '</div></div>';
}

function renderDailyHandoverConfirmation(prev, equipmentId, group, shortName){
  const tplMap = {};
  ((APP.dailyTemplates || {})[prev.group] || []).forEach(t => { tplMap[t.itemId] = t; });
  
  const enriched = (prev.checks || []).map(c => ({
    itemId: c.itemId,
    itemKhmer: (tplMap[c.itemId] && tplMap[c.itemId].itemKhmer) || c.itemId,
    itemEng: (tplMap[c.itemId] && tplMap[c.itemId].itemEng) || '',
    status: c.status, note: c.note || '',
    photos: Array.isArray(c.photos) ? c.photos : []
  }));
  
  const okCount  = enriched.filter(c => c.status === 'ok').length;
  const nokCount = enriched.filter(c => c.status === 'nok').length;
  const naCount  = enriched.filter(c => c.status === 'na').length;
  const nokItems = enriched.filter(c => c.status === 'nok');
  const overallCls = prev.overall === 'Issues' ? 'nok' : 'ok';
  const overallLbl = prev.overall === 'Issues' ? 'Found Issues' : 'OK';

  let issuesHtml = '';
  if (nokItems.length > 0) {
    issuesHtml =
      '<div class="card mb-3"><div class="group-header" style="background:#f8d7da;color:#721c24;">' +
        '<i class="bi bi-exclamation-triangle-fill me-2"></i>Issues Reported ('+nokItems.length+')</div>' +
        '<div class="card-body p-2"><div class="check-grid">' +
          nokItems.map(c =>
            '<div class="check-item nok"><div><strong>'+esc(c.itemKhmer)+'</strong><div class="item-name-en">'+esc(c.itemEng)+'</div></div>' +
            (c.note ? '<div class="small text-danger mt-1"><i class="bi bi-chat-left-text me-1"></i>'+esc(c.note)+'</div>' : '') +
            dailyPhotoIdsHtml(c.photos) +
            '</div>'
          ).join('') +
        '</div></div>' +
      '</div>';
  }

  const starts = dailyShiftStartValues(prev);
  $('#app').html(
    '<div class="container-fluid px-0">' +
      '<button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelDailyChecklist()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button>' +
      dailyFinishSummaryHtml(prev) +
      dailyFinishChecksHtml(prev) +
            // ── Handover Confirmation ──
      '<div class="card mb-3 confirm-box confirm-pending">' +
        '<div class="group-header d-flex justify-content-between align-items-center">' +
          '<span><i class="bi bi-arrow-left-right me-2"></i>Handover Confirmation</span>' +
          '<span class="status-badge status-pending">Required</span>' +
        '</div>' +
      '<div class="card-body">' +
          '<div class="d-grid gap-2 mt-3">' +
            '<button class="btn btn-primary" onclick="confirmDailyHandover(\''+escAttr(equipmentId)+'\',\''+escAttr(group)+'\',\''+escAttr(shortName)+'\',\''+escAttr(prev.checkId)+'\')"><i class="bi bi-shield-check me-1"></i>Verify &amp; Accept Handover</button>' +
            '<button class="btn btn-outline-primary" onclick="viewDailyCheck(\''+escAttr(prev.checkId)+'\')"><i class="bi bi-eye me-1"></i>View Full Details</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

window.confirmDailyHandover = function(equipmentId, group, shortName, prevCheckId){
  const remark = $('#handoverRemark').val() || '';
  const prev = (APP.dailySubmissions || []).find(x => x.checkId === prevCheckId) || null;

  showLoading('កំពុងផ្ទៀងផ្ទាត់...');
  google.script.run
    .withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }

      const p = prev;
      if (p) {
        p.opStatus = DAILY_OP_HANDED;
        p.opAt = res.handoverAt || (dmyToday() + ' ' + nowTimeStr());
        p.handoverBy = res.handoverBy || currentUser.username;
        p.handoverAt = res.handoverAt || p.opAt;
        if (res.handoverRemark != null) p.handoverRemark = res.handoverRemark;
        p.reviewedBy = p.handoverBy;
        p.reviewedRemark = p.handoverRemark || remark;
        p.reviewedAt = p.handoverAt;
        if (res.endOdo !== undefined) p.endOdo = res.endOdo;
        if (res.endHour !== undefined) p.endHour = res.endHour;
        if (res.endRemark !== undefined) p.endRemark = res.endRemark;
        if (res.finishedAt) p.finishedAt = res.finishedAt;
        if (res.finishedBy) p.finishedBy = res.finishedBy;
      }

      showAlert('Handover verified — your checklist can start now', 'success');
      loadAndRenderDailyForm(equipmentId, group, shortName, prevCheckId, remark, p);
    })
    .withFailureHandler(handleError)
    .verifyDailyHandover({ prevCheckId: prevCheckId, remark: remark });
};

/* =========================================================
   DAILY CHECKLIST FORM
   ========================================================= */
/* Monthly-style white info card: small label on top, bold value underneath */
function dailyInfoCard(icon, label, valueHtml, color){
  return '<div class="col-6"><div class="p-3 border rounded-3 bg-white h-100 shadow-sm daily-info-card">' +
    '<div class="d-flex align-items-center mb-2">' +
      '<i class="bi bi-' + icon + ' text-' + (color || 'primary') + ' me-2" style="font-size:1.1rem;"></i>' +
      '<span class="text-muted small" style="letter-spacing:.5px;font-family:\'Battambang\',\'Kantumruy Pro\',sans-serif;font-weight:400;">' + label + '</span>' +
    '</div>' +
    '<div class="text-dark" style="font-size:1rem;font-family:\'Battambang\',\'Kantumruy Pro\',sans-serif;font-weight:700;">' + (valueHtml || '-') + '</div>' +
  '</div></div>';
}

function dailyInfoCardName(name, phone){
  return '<div>' + esc(name || '—') + '</div>' +
    (phone ? '<div class="small text-muted fw-normal mt-1" style="font-size:.85rem;"><i class="bi bi-telephone me-1"></i>' + esc(phone) + '</div>' : '');
}

/* Live N – Normal / Issues counters above the items (same two cards as the
   monthly checklist, they follow every OK / NOT OK / N/A tap) */
function dailyCountCards(okCount, nokCount, idPrefix){
  const p = idPrefix || 'daily';
  return '<div class="row g-2 mb-3">' +
    '<div class="col-6"><div class="stat-card"><div class="num text-success" id="' + p + 'NormalCount">' + okCount + '</div><div class="lbl">N – Normal</div></div></div>' +
    '<div class="col-6"><div class="stat-card"><div class="num text-danger" id="' + p + 'IssueCount">' + nokCount + '</div><div class="lbl">Issues</div></div></div>' +
  '</div>';
}

function dailyAnswerCounts(state){
  const list = Object.keys((state && state.checks) || (state && state.answers) || {}).map(k => {
    const v = ((state.checks || state.answers) || {})[k];
    return v && v.status;
  });
  return {
    ok:  list.filter(s => s === 'ok').length,
    nok: list.filter(s => s === 'nok').length,
    na:  list.filter(s => s === 'na').length
  };
}

function updateDailyFormCounts(){
  if (!pendingDailyChecklist) return;
  const n = dailyAnswerCounts(pendingDailyChecklist);
  $('#dailyNormalCount').text(n.ok);
  $('#dailyIssueCount').text(n.nok);
  $('#dailyNaCount').text(n.na + ' N/A');
}

function updateDailyFinishCounts(){
  if (!dailyFinishState) return;
  const n = dailyAnswerCounts({ answers: dailyFinishState.answers });
  $('#dailyFinishNormalCount').text(n.ok);
  $('#dailyFinishIssueCount').text(n.nok);
  $('#dailyFinishNaCount').text(n.na + ' N/A');
}

/* "1 item" / "3 items" — keeps the count labels grammatical */
function dailyItemWord(n){ return (n === 1) ? '1 item' : (n + ' items'); }

/* ---------------- Trailer picker (searchable) ----------------
   The choices come from APP.trailers. The search box rebuilds the <select>
   so only matching trailers stay in the list; a trailer picked earlier is
   kept visible even when it no longer matches the filter. */
/* ---------------- Trailer picker (searchable) ---------------- */

function dailyTrailerList(){
  return (APP.trailers || []).filter(t => t && t.trailerId).map(t => {
    const id = String(t.trailerId);
    return { id: id, label: (t.shortName || id) + (t.status ? ' · ' + t.status : '') };
  });
}

function dailyTrailerMatch(list, filter){
  const needle = String(filter || '').trim().toLowerCase();
  if (!needle) return list.slice();
  return list.filter(o =>
    o.label.toLowerCase().indexOf(needle) !== -1 ||
    o.id.toLowerCase().indexOf(needle) !== -1);
}

function dailyTrailerHintHtml(filter, selectedId){
  const all = dailyTrailerList();
  const n = dailyTrailerMatch(all, filter).length;
  if (!n) return '<i class="bi bi-exclamation-circle me-1 text-warning"></i>រកមិនឃើញរ៉ឺម៉ក · No match';
  if (selectedId && n === all.length) {
    return '<i class="bi bi-check-circle me-1 text-success"></i>រ៉ឺម៉កបានជ្រើសរើស · Trailer selected';
  }
  return '<i class="bi bi-info-circle me-1"></i>' + n + ' រ៉ឺម៉ក' +
    (String(filter || '').trim() ? ' · filtered' : ' · available');
}

/* Updated to render the custom floating HTML list instead of native options */
window.filterDailyTrailers = function(q){
  const listEl = document.getElementById('trailerDropdownList');
  if (!listEl) return;

  const all = dailyTrailerList();
  const matches = dailyTrailerMatch(all, q);
  const keep = String(document.getElementById('dailyTrailerSelect')?.value || '');

  let html = '';

  // "No trailer" option
  if (!q || 'ទាំងអស់'.includes(q) || 'no trailer'.includes(q.toLowerCase())) {
    html += '<div class="p-2 border-bottom text-primary fw-bold item-hover" style="cursor: pointer; font-size: .8rem;" onclick="selectTrailerItem(\'\', \'ទាំងអស់ / No trailer\')">' +
      '<i class="bi bi-dash-circle me-1"></i>ទាំងអស់ / No trailer</div>';
  }

  if (matches.length === 0) {
    html += '<div class="p-2 text-muted small text-center">រកមិនឃើញ (Not found)</div>';
  } else {
    matches.forEach(o => {
      const isSelected = (o.id === keep);
      const bg = isSelected ? 'background: var(--bg-color); font-weight: bold; color: var(--tab-active);' : '';
      html += '<div class="p-2 border-bottom item-hover" style="cursor: pointer; font-size: .8rem; ' + bg + '" onclick="selectTrailerItem(\'' + escAttr(o.id) + '\', \'' + escAttr(o.label) + '\')">' +
        '<i class="bi bi-link-45deg text-muted me-1"></i> ' + esc(o.label) + '</div>';
    });
  }

  listEl.innerHTML = html;
  listEl.style.display = 'block';

  const hint = document.getElementById('dailyTrailerHint');
  if (hint) hint.innerHTML = dailyTrailerHintHtml(q, keep);
};

window.showTrailerDropdown = function() {
  const listEl = document.getElementById('trailerDropdownList');
  if (listEl) {
    filterDailyTrailers(document.getElementById('dailyTrailerSearch').value);
  }
};

window.selectTrailerItem = function(id, label) {
  // 1. Update the visible search box with the ShortName
  const searchInput = document.getElementById('dailyTrailerSearch');
  searchInput.value = id ? label.split(' · ')[0] : ''; 
  
  // 2. Update the hidden select (so your existing setDailyTrailer can read it)
  const sel = document.getElementById('dailyTrailerSelect');
  if (sel) sel.value = id;
  
  // 3. Hide the dropdown
  const listEl = document.getElementById('trailerDropdownList');
  if (listEl) listEl.style.display = 'none';

  // 4. Trigger your existing save logic
  if (typeof setDailyTrailer === 'function') {
    setDailyTrailer(id);
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('trailerSearchWrap');
  if (wrap && !wrap.contains(e.target)) {
    const listEl = document.getElementById('trailerDropdownList');
    if (listEl) listEl.style.display = 'none';
  }
});

function renderDailyChecklistForm(){
  const c = pendingDailyChecklist;
  if (!c) return;

  const isWeekly = (c.checkType === DAILY_FREQ_WEEKLY);
  const title = isWeekly ? 'Weekly Check' : 'Daily Checklist';
  const typeBadge = isWeekly
    ? '<span class="badge bg-info text-dark ms-2">Weekly</span>'
    : '<span class="badge bg-primary ms-2">Daily</span>';

  const itemsHtml = c.items.map((it, i) => {
    const sel = c.checks[it.itemId] || { status: 'ok', note: '' };
    const st  = sel.status || 'ok';
    return '<div class="check-item '+st+'" data-item="'+escAttr(it.itemId)+'" data-status="'+escAttr(st)+'">' +
      '<div class="row-line"><div class="label-part"><span class="item-num">'+(i+1)+'.</span><div class="item-text">' +
        '<span class="item-name-kh">'+esc(it.itemKhmer)+'</span>' +
        (it.itemEng ? '<span class="item-name-en">'+esc(it.itemEng)+'</span>' : '') +
      '</div></div></div>' +
      // 👇 BUTTONS MADE SMALLER HERE 👇
      '<div class="check-actions" style="gap: 4px; margin-top: 6px;">' +
        '<button type="button" class="check-btn '+(st==='ok'?'selected-ok':'')+'" style="padding: 4px 2px; font-size: .68rem; border-radius: 12px;" onclick="setDailyCheck(\''+escAttr(it.itemId)+'\',\'ok\')"><i class="bi bi-check-circle me-1"></i>OK</button>' +
        '<button type="button" class="check-btn '+(st==='nok'?'selected-nok':'')+'" style="padding: 4px 2px; font-size: .68rem; border-radius: 12px;" onclick="setDailyCheck(\''+escAttr(it.itemId)+'\',\'nok\')"><i class="bi bi-x-circle me-1"></i>NOT OK</button>' +
        '<button type="button" class="check-btn '+(st==='na'?'selected-na':'')+'" style="padding: 4px 2px; font-size: .68rem; border-radius: 12px;" onclick="setDailyCheck(\''+escAttr(it.itemId)+'\',\'na\')"><i class="bi bi-dash-circle me-1"></i>N/A</button>' +
      '</div>' +
      // 👆 END OF SMALLER BUTTONS 👆
      '<div class="nok-note '+(st==='nok'?'visible':'')+'"><input type="text" class="form-control form-control-sm js-nok-note" placeholder="សូមបញ្ជាក់បញ្ហា / ចំណាំ..." value="'+esc(sel.note)+'" oninput="setDailyNokNote(\''+escAttr(it.itemId)+'\', this.value)"></div>' +
      dailyPhotoGalleryHtml(it.itemId, sel.photos || [], st === 'nok') +
    '</div>';
  }).join('');

  // Agreement gate — monthly-style confirmation block
  const agreementHtml =
    '<div class="card mb-3 confirm-box ' + (c.agreed ? '' : 'confirm-pending') + '" id="dailyAgreementBox" style="border-left: 4px solid ' + (c.agreed ? 'var(--status-ok-text)' : 'var(--status-pending-text)') + '; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.04);">' +
      
      /* Header */
      '<div class="d-flex justify-content-between align-items-center px-3 py-3" style="background: var(--card-bg); border-bottom: 1px solid var(--border-color);">' +
        '<div class="d-flex align-items-center gap-2">' +
          '<div id="dailyAgreementIconBg" class="d-flex align-items-center justify-content-center rounded-circle" style="width: 32px; height: 32px; background: ' + (c.agreed ? 'rgba(25,135,84,.1)' : 'rgba(255,193,7,.15)') + '; color: ' + (c.agreed ? 'var(--status-ok-text)' : 'var(--status-pending-text)') + ';">' +
            '<i class="bi bi-shield-check" style="font-size: 1.1rem;"></i>' +
          '</div>' +
          '<div>' +
            '<h6 class="mb-0 fw-bold" style="font-size: .95rem; color: var(--text-color);">ការព្រមព្រៀងមុនប្រតិបត្តិការ</h6>' +
            '<div class="small fw-semibold" style="color: ' + (c.agreed ? 'var(--status-ok-text)' : 'var(--status-pending-text)') + '; font-size: .75rem;" id="dailyAgreementStateText">' +
              '<i class="bi bi-' + (c.agreed ? 'check2-circle' : 'hourglass-split') + ' me-1"></i>' +
              (c.agreed ? 'បានបញ្ជាក់ការព្រមព្រៀងសុវត្ថិភាព' : 'រង់ចាំការបញ្ជាក់ពីអ្នកបើកបរ') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<span class="badge rounded-pill ' + (c.agreed ? 'bg-success' : 'bg-warning text-dark') + '" style="font-size: .75rem; padding: 6px 12px;" id="dailyAgreementBadge">' + (c.agreed ? 'បានយល់ព្រម' : 'រង់ចាំ') + '</span>' +
      '</div>' +
      
      /* Body */
      '<div class="card-body p-3" style="background: ' + (c.agreed ? 'var(--bg-color)' : 'rgba(255,193,7,.03)') + ';">' +
        '<div class="form-check d-flex align-items-start gap-2 mb-0">' +
          '<input class="form-check-input mt-1 flex-shrink-0" type="checkbox" id="dailyAgree" ' + (c.agreed ? 'checked' : '') + ' onchange="toggleDailyAgreement(this.checked)" style="width: 1.2em; height: 1.2em; cursor: pointer;">' +
          '<label class="form-check-label" for="dailyAgree" style="font-size: .85rem; line-height: 1.5; color: var(--text-color); cursor: pointer;">' + 
            esc(dailyAgreementText()) + 
          '</label>' +
        '</div>' +
      '</div>' +
      
      /* Footer */
      '<div class="px-3 py-2 text-muted d-flex align-items-center gap-2" style="background: var(--header-bg); border-top: 1px solid var(--border-color); font-size: .7rem; border-radius: 0 0 12px 12px;">' +
        '<i class="bi bi-info-circle"></i>' +
        '<span>រក្សាទុកជាមួយបញ្ជីត្រួតពិនិត្យនេះ (កំណត់ពេលវេលា)។</span>' +
      '</div>' +
      
    '</div>';

  const legendHtml =
    '<div class="card mb-3 legend-card">' +
      '<div class="legend-title">' + (isWeekly ? 'WEEKLY CHECK' : 'DAILY CHECK') + '</div>' +
      '<div class="legend-body text-center">' +
        '<div class="lbl-kh"><span class="acronym">OK</span>=ធម្មតា &nbsp; <span class="acronym">NOT OK</span>=មានបញ្ហា &nbsp; <span class="acronym">N/A</span>=N/A</div>' +
      '</div>' +
    '</div>';

  const counts = dailyAnswerCounts(c);
  const myPhone = (currentUser && currentUser.phone) ? currentUser.phone : '';
  const trailerId = String(c.trailerId || '');
  const trailerChoices = (APP.trailers || []).filter(t => t && t.trailerId);
  
  /* Trailer picker: the two cards sit side by side, and the trailer list is
     searchable (the search box rebuilds the <select> options). */
  const trailerCard = (!isWeekly && trailerChoices.length)
    ? '<div class="col-6"><div class="p-3 border rounded-3 bg-white h-100 shadow-sm daily-info-card daily-trailer-card">' +
        '<div class="d-flex align-items-center mb-2">' +
          '<i class="bi bi-link text-secondary me-2" style="font-size:1.1rem;"></i>' +
          '<span class="text-muted small" style="letter-spacing:.5px;font-family:\'Battambang\',\'Kantumruy Pro\',sans-serif;font-weight:400;">រ៉ឺម៉ក · Trailer</span>' +
        '</div>' +
        
        /* 👇 NEW CUSTOM DROPDOWN HTML 👇 */
        '<div style="position: relative;" id="trailerSearchWrap">' +
          '<div class="input-group input-group-sm">' +
            '<span class="input-group-text bg-white px-2" style="border-color: var(--input-border);"><i class="bi bi-search text-muted" style="font-size: .75rem;"></i></span>' +
            '<input type="text" class="form-control form-control-sm" id="dailyTrailerSearch" autocomplete="off" ' +
              'placeholder="ស្វែងរករ៉ឺម៉ក..." oninput="filterDailyTrailers(this.value)" onfocus="showTrailerDropdown()" ' +
              'style="border-color: var(--input-border);">' +
          '</div>' +
          
          /* Hidden select to keep backward compatibility with your existing setDailyTrailer function */
          '<input type="hidden" id="dailyTrailerSelect" value="' + escAttr(trailerId) + '">' +
          
          /* Floating Dropdown Box */
          '<div id="trailerDropdownList" class="shadow-sm" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 1050; max-height: 200px; overflow-y: auto; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 4px;">' +
          '</div>' +
        '</div>' +
        /* 👆 END CUSTOM DROPDOWN HTML 👆 */

        '<div class="small text-muted mt-1" id="dailyTrailerHint">' +
          dailyTrailerHintHtml('', trailerId) +
        '</div>' +
      '</div></div>'
    : '';

  // 👇 UPDATED TO SHOW CURRENT DRIVER 👇
  const currentDriverName = c.driverName || (currentUser && (currentUser.fullName || currentUser.username)) || '';
  
  const headerCard =
    '<div class="row g-2 mb-3">' +
      dailyInfoCard('truck', esc(c.group || 'ឧបករណ៍'),
        '<div>' + esc(c.shortName || c.equipmentId) + typeBadge + '</div>', 'primary') +
      trailerCard +
      dailyInfoCard('person-badge', 'អ្នកបើកបរ', esc(currentDriverName), 'info') +
      dailyInfoCard('calendar', 'កាលបរិច្ឆេទ', esc(dmyToday()) + ' ' + esc(nowTimeStr()), 'warning') +
    '</div>';

  $('#app').html(
    '<div class="container-fluid px-0 daily-form-page">' +
      '<button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelDailyChecklist()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button>' +
      agreementHtml +
      headerCard +
      legendHtml +
      dailyCountCards(counts.ok, counts.nok, 'daily') +
      '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center">' +
        '<span><i class="bi bi-clipboard-check me-2"></i>' + title + '</span>' +
        '<small class="text-muted">' + dailyItemWord(c.items.length) + ' · <span id="dailyNaCount">' + counts.na + ' N/A</span></small>' +
      '</div><div class="card-body p-2"><div class="check-grid is-single">' + itemsHtml + '</div></div></div>' +
      '<div class="card mb-3"><div class="card-body">' +
        '<label class="form-label fw-bold">Remark</label>' +
        '<textarea class="form-control form-control-sm" id="checkRemark" rows="2" placeholder="កំណត់សម្គាល់បន្ថែម..."></textarea>' +
        '<div class="photo-upload-box mt-2">' +
          '<div class="small fw-bold mb-1"><i class="bi bi-image me-1"></i>រូបថតបន្ថែម · Remark photos</div>' +
          dailyPhotoGalleryHtml('remark', c.remarkPhotos || []) +
        '</div>' +
      '</div></div>' +
      '<button class="btn btn-primary w-100" style="margin-bottom: 100px !important;" onclick="submitDailyChecklistForm()"><i class="bi bi-check-circle me-1"></i>' +
        (isWeekly ? 'រក្សាទុក Weekly Check' : 'បានពិនិត្យរួចរាល់') + '</button>' +
    '</div>'
  );
  window.scrollTo(0, 0);
}

/* Trailer chosen at the start of a daily checklist */
window.setDailyTrailer = function(trailerId){
  if (!pendingDailyChecklist) return;
  pendingDailyChecklist.trailerId = String(trailerId || '');
};

window.toggleDailyAgreement = function(checked) {
  if (!pendingDailyChecklist) return;
  pendingDailyChecklist.agreed = !!checked;

  const $box = $('#dailyAgreementBox');
  const $badge = $('#dailyAgreementBadge');
  const $stateText = $('#dailyAgreementStateText');
  const $iconBg = $('#dailyAgreementIconBg');

  // 1. Update the border and background tint
  $box.toggleClass('confirm-pending', !checked);
  $box.css('border-left-color', checked ? 'var(--status-ok-text)' : 'var(--status-pending-text)');

  // 2. Update the Header Icon background and color
  if (checked) {
    $iconBg.css({ background: 'rgba(25,135,84,.1)', color: 'var(--status-ok-text)' });
  } else {
    $iconBg.css({ background: 'rgba(255,193,7,.15)', color: 'var(--status-pending-text)' });
  }

  // 3. Update the Badge (Bootstrap classes instead of status-ok/pending)
  $badge.removeClass('bg-success bg-warning text-dark')
        .addClass(checked ? 'bg-success' : 'bg-warning text-dark')
        .text(checked ? 'បានយល់ព្រម' : 'រង់ចាំ');

  // 4. Update the subtitle text & icon with Khmer translations
  $stateText.parent().css('color', checked ? 'var(--status-ok-text)' : 'var(--status-pending-text)');
  
  $stateText.html(
    '<i class="bi bi-' + (checked ? 'check2-circle' : 'hourglass-split') + ' me-1"></i>' +
    (checked ? 'បានបញ្ជាក់ការព្រមព្រៀងសុវត្ថិភាព' : 'រង់ចាំការបញ្ជាក់ពីអ្នកបើកបរ')
  );
};

/* ---------- Daily item photos (same camera / gallery UX as the monthly form) ----------
   Every daily checklist item, every Finished Form item and the two extra fuel
   fields keep their own photo bag: { status, note, photos:[{fileId, thumb, …}] }. */
const DAILY_PHOTO_MAX = 10;

function dailyPhotoBag(key){
  key = String(key || '');
  if (!key) return null;
  // The Finished Form owns the page while it is open (answers + the two extra fields)
  if (dailyFinishState && dailyFinishState.checkId) {
    if (dailyFinishState.extras && dailyFinishState.extras[key]) return dailyFinishState.extras[key];
    if (dailyFinishState.answers && dailyFinishState.answers[key]) return dailyFinishState.answers[key];
  }
  if (pendingDailyChecklist && pendingDailyChecklist.checks) {
    if (key === 'remark') {
      if (!pendingDailyChecklist.remarkPhotos) pendingDailyChecklist.remarkPhotos = [];
      return { photos: pendingDailyChecklist.remarkPhotos };
    }
    if (pendingDailyChecklist.checks[key]) return pendingDailyChecklist.checks[key];
  }
  return null;
}

function dailyPhotoCheckId(){
  if (dailyFinishState && dailyFinishState.checkId) return dailyFinishState.checkId;
  return 'NEW';
}

function dailyPhotoTilesHtml(key, photos){
  photos = photos || [];
  const tiles = photos.map((p, idx) => {
    const src = photoSrc(p, 200);
    return '<div class="photo-tile" data-photo-idx="' + idx + '" onclick="openDailyPhotoLightbox(\'' + escAttr(key) + '\',' + idx + ')">' +
      (src ? '<img src="' + src + '" loading="lazy" decoding="async" alt="">'
           : '<div style="width:90px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;"><i class="bi bi-image"></i></div>') +
      (p._uploading ? '<div class="photo-uploading-spinner"><div class="spinner-border spinner-border-sm text-light"></div></div>' : '') +
      '<button type="button" class="photo-remove-btn" onclick="event.stopPropagation();removeDailyItemPhoto(\'' + escAttr(key) + '\',' + idx + ')">×</button></div>';
  }).join('');
  const addTile = (photos.length < DAILY_PHOTO_MAX)
    ? '<div class="photo-tile photo-add-tile" onclick="takePhotoDirectly(\'' + escAttr(key) + '\')" style="color:#0d6efd;border-color:#0d6efd;" title="Take Photo"><i class="bi bi-camera"></i></div>' +
      '<div class="photo-tile photo-add-tile" onclick="pickFromGalleryDirectly(\'' + escAttr(key) + '\')" title="Gallery"><i class="bi bi-image"></i></div>'
    : '';
  return tiles + addTile;
}

/* Photo block of one item. `visible` false keeps it collapsed — the daily /
   weekly / Finished Form items only reveal camera + gallery once the driver
   answers NOT OK. */
function dailyPhotoGalleryHtml(key, photos, visible){
  const show = (visible === undefined) ? true : !!visible;
  return '<div class="item-photo-row js-photo-row mt-2"' + (show ? '' : ' style="display:none;"') +
    '><div class="photo-gallery" data-daily-item="' + escAttr(key) + '">' +
    dailyPhotoTilesHtml(key, photos || []) + '</div></div>';
}

function renderDailyItemPhotoPreviews(key){
  const bag = dailyPhotoBag(key); if (!bag) return;
  $('.photo-gallery[data-daily-item="' + key + '"]').html(dailyPhotoTilesHtml(key, bag.photos || []));
}

window.removeDailyItemPhoto = function(key, idx){
  const bag = dailyPhotoBag(key); if (!bag || !bag.photos) return;
  bag.photos.splice(idx, 1);
  renderDailyItemPhotoPreviews(key);
};

window.openDailyPhotoLightbox = function(key, startIndex){
  const bag = dailyPhotoBag(key); if (!bag || !bag.photos || !bag.photos.length) return;
  openLightbox(bag.photos.map(p => ({ fileId: p.fileId || '', dataUrl: p._full || p.thumb || '' })), startIndex);
};

window.onDailyItemPhotoPick = async function(key, inputEl){
  const files = Array.from((inputEl && inputEl.files) || []);
  if (inputEl) inputEl.value = '';
  const bag = dailyPhotoBag(key); if (!bag || files.length === 0) return;
  if (!bag.photos) bag.photos = [];

  let processed = [];
  try { processed = await Promise.all(files.map(f => processImageFile(f).catch(() => null))); } catch (e) { processed = []; }

  const pushed = [];
  processed.forEach(p => {
    if (!p) return;
    const entry = { fileId: '', thumb: p.thumb, _full: p.full, _uploading: true };
    bag.photos.push(entry); pushed.push(entry);
  });
  renderDailyItemPhotoPreviews(key);
  if (!pushed.length) return;

  const base = bag.photos.length - pushed.length;
  const payload = pushed.map((p, i) => ({ itemId: key, idx: base + i, dataUrl: p._full }));

  const clearUploading = () => {
    pushed.forEach(p => {
      if (!p.fileId) { const idx = bag.photos.indexOf(p); if (idx > -1) bag.photos.splice(idx, 1); }
      delete p._full; delete p._uploading;
    });
    renderDailyItemPhotoPreviews(key);
  };

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success && res.photoIds) {
        pushed.forEach((p, i) => {
          const id = res.photoIds[key + '|' + payload[i].idx];
          if (id) p.fileId = id;
        });
      }
      clearUploading();
    })
    .withFailureHandler(() => { clearUploading(); })
    .uploadChecklistPhotos({ checkId: dailyPhotoCheckId(), photos: payload, daily: true });
};

/* True while a photo is still being compressed/uploaded — blocks submit. */
function dailyHasPendingUploads(state){
  if (!state) return false;
  const bags = [];
  if (state.checks)  Object.keys(state.checks).forEach(k => bags.push(state.checks[k]));
  if (state.answers) Object.keys(state.answers).forEach(k => bags.push(state.answers[k]));
  if (state.extras)  Object.keys(state.extras).forEach(k => bags.push(state.extras[k]));
  if (state.remarkPhotos) bags.push({ photos: state.remarkPhotos });
  return bags.some(b => ((b && b.photos) || []).some(p => p._uploading || (!p.fileId && p._full)));
}

/* Only uploaded ids travel to the sheet (never a data URL). */
function dailyPhotosPayload(photos){
  return (Array.isArray(photos) ? photos : [])
    .filter(p => p && p.fileId)
    .slice(0, DAILY_PHOTO_MAX)
    .map(p => ({ fileId: p.fileId }));
}

/* Preview grid for the remark-level photos of the daily checklist */
function renderCheckPhotos(){
  const c = document.getElementById('checkPhotosPreview');
  if (!c) return;
  c.innerHTML = '';
  nokPhotos.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const w = document.createElement('div');
    w.className = 'photo-thumb';
    w.innerHTML = '<img src="'+url+'"><span class="remove-photo" data-idx="'+i+'">×</span>';
    c.appendChild(w);
  });
  $('#checkPhotoCount').text(nokPhotos.length + ' រូប');
}

window.setDailyCheck = function(itemId, status){
  if (!pendingDailyChecklist) return;
  if (!pendingDailyChecklist.checks[itemId]) return;
  pendingDailyChecklist.checks[itemId].status = status;
  const $item = $('.check-item[data-item="'+itemId+'"]');
  $item.removeClass('ok nok na').addClass(status).attr('data-status', status);
  $item.find('.check-btn').removeClass('selected-ok selected-nok selected-na');
  $item.find('.check-btn').eq(status==='ok'?0:status==='nok'?1:2).addClass('selected-'+status);
  // Note + photos belong to NOT OK only — they stay hidden for OK / N/A
  const isNok = (status === 'nok');
  $item.find('.nok-note').toggleClass('visible', isNok);
  $item.find('.js-photo-row').css('display', isNok ? 'flex' : 'none');
  updateDailyFormCounts();
};

window.setDailyNokNote = function(itemId, val){
  if (!pendingDailyChecklist) return;
  if (!pendingDailyChecklist.checks[itemId]) return;
  pendingDailyChecklist.checks[itemId].note = val;
};

window.cancelDailyChecklist = function(){
  if (!pendingDailyChecklist) { showPage('home'); return; }
  if (confirm('បោះបង់ការត្រួតពិនិត្យ?')) {
    pendingDailyChecklist = null;
    hideDailyFlowModal();
    showPage('home');
  }
};

window.submitDailyChecklistForm = function(){
  if (!pendingDailyChecklist) return;
  const c = pendingDailyChecklist;
  const isWeekly = (c.checkType === DAILY_FREQ_WEEKLY);

  const missing = c.items.filter(it => !c.checks[it.itemId].status);
  if (missing.length > 0) { showAlert('សូមជ្រើសរើសគ្រប់ចំណុច ('+missing.length+' ទៀត)', 'warning'); return; }
  if (!c.agreed) { showAlert('Please tick the confirmation box before submitting.', 'warning'); return; }
  if (dailyHasPendingUploads(c)) { showAlert('រូបថតកំពុងផ្ទុកឡើង — សូមរង់ចាំបន្តិច (photos still uploading)', 'warning'); return; }

  const checks = c.items.map(it => {
    const ans = c.checks[it.itemId] || {};
    const entry = {
      itemId: it.itemId, itemKhmer: it.itemKhmer || '', itemEng: it.itemEng || '',
      status: ans.status, note: ans.note || ''
    };
    const photos = dailyPhotosPayload(ans.photos);
    if (photos.length) entry.photos = photos;
    return entry;
  });
  const overall = checks.some(x => x.status === 'nok') ? 'Issues' : 'OK';
  const remarkPhotoIds = dailyPhotosPayload(c.remarkPhotos).map(p => p.fileId);

  const payload = {
    username: currentUser.username, fullName: currentUser.fullName,
    equipmentId: c.equipmentId, group: c.group, overallStatus: overall,
    checks: checks, remark: $('#checkRemark').val() || '', photoIds: remarkPhotoIds,
    handoverCheckId: c.handoverCheckId || '', handoverRemark: c.handoverRemark || '',
    startOdo: c.startOdo === '' || c.startOdo == null ? '' : c.startOdo,
    startHour: c.startHour === '' || c.startHour == null ? '' : c.startHour,
    trailerId: isWeekly ? '' : (c.trailerId || ''),
    checkType: isWeekly ? DAILY_FREQ_WEEKLY : DAILY_FREQ_DAILY,
    agreed: true
  };

  showLoading('កំពុងដាក់ស្នើ...');
  google.script.run
    .withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) {
        // Shift conflicts: leave the form, go back to the cards and reload the sheet state
        if (res && (res.code === 'IN_USE' || res.code === 'HANDOVER' || res.code === 'SHIFT_OPEN')) {
          pendingDailyChecklist = null;
          showAlert(res.message || 'Shift conflict', 'warning');
          showPage('home');
          dailySyncNow();
          return;
        }
        showAlert((res && res.message) || 'Error', 'danger');
        return;
      }

      // 1. Update the local copy first — the card must change even if the network is slow
      const stamp = dmyToday() + ' ' + nowTimeStr();
      const newSub = {
        checkId: res.checkId,
        date: dmyToday(), time: nowTimeStr(),
        username: currentUser.username, driverName: currentUser.fullName,
        equipmentId: c.equipmentId, group: c.group, overall: overall,
        checks: checks, remark: payload.remark, photoIds: remarkPhotoIds,
        handoverCheckId: c.handoverCheckId || '',
        reviewedBy: '', reviewedRemark: '', reviewedAt: '',
        confirmStatus: 'Pending', confirmedBy: '', confirmedAt: '', confirmRemark: '',
        directorStatus: '', directorBy: '', directorAt: '', directorRemark: '',
        mtnStatus: '', mtnBy: '', mtnAt: '', mtnRemark: '', mtnItems: {},
        opStatus: isWeekly ? '' : (res.opStatus || DAILY_OP_OPERATING),
        opAt: isWeekly ? '' : stamp, opBy: isWeekly ? '' : currentUser.username,
        startOdo: (res.startOdo === undefined ? payload.startOdo : res.startOdo),
        startHour: (res.startHour === undefined ? payload.startHour : res.startHour),
        trailerId: isWeekly ? '' : (res.trailerId === undefined ? payload.trailerId : res.trailerId),
        endOdo: '', endHour: '', endRemark: '', finishedAt: '', finishedBy: '',
        handoverBy: '', handoverAt: '', handoverRemark: '',
        checkType: isWeekly ? DAILY_FREQ_WEEKLY : DAILY_FREQ_DAILY,
        finishChecks: [], agreementAt: stamp
      };
      APP.dailySubmissions = [newSub].concat(APP.dailySubmissions || []);
      APP.dailySubmissions.sort((a, b) => subMs(b) - subMs(a));

      hideDailyFlowModal();
      pendingDailyChecklist = null;
      showAlert((isWeekly ? 'Weekly check saved — ' : 'ដាក់ស្នើរួចរាល់ — ') + res.checkId +
        (isWeekly ? '' : ' · Status: Operating'), 'success');
      showPage('home');      // instant repaint from the local copy
      dailySyncNow();        // then reconcile with the sheet and repaint again
    })
    .withFailureHandler(err => { hideLoading(); handleError(err); })
    .submitDailyChecklist(payload);
};

/* =========================================================
   SHIFT STATUS ACTIONS (Operating ⇄ Stand By → Finished)
   ========================================================= */
let dailyFlowModal = null;

function hideDailyFlowModal(){
  const el = document.getElementById('dailyFlowModal');
  if (el) {
    const inst = bootstrap.Modal.getInstance(el);
    if (inst) { try { inst.dispose(); } catch (e) {} }
  }
  dailyFlowModal = null;
  $('#dailyFlowModal').remove();
  // Removing the node mid-animation can leave the backdrop + scroll lock behind
  if (!$('.modal.show').length) {
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open').css('overflow', '');
  }
}

function showDailyFlowModal(titleHtml, bodyHtml, footerHtml, size){
  hideDailyFlowModal();
  const html = '<div class="modal fade" id="dailyFlowModal" tabindex="-1" aria-hidden="true">' +
    '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ' + (size || '') + '">' +
      '<div class="modal-content" style="background:var(--card-bg);color:var(--text-color);">' +
        '<div class="modal-header" style="border-bottom:1px solid var(--border-color);">' +
          '<h6 class="modal-title">' + titleHtml + '</h6>' +
          '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
        '</div>' +
        '<div class="modal-body">' + bodyHtml + '</div>' +
        (footerHtml ? '<div class="modal-footer" style="border-top:1px solid var(--border-color);">' + footerHtml + '</div>' : '') +
      '</div></div></div>';
  $('body').append(html);
  const el = document.getElementById('dailyFlowModal');
  dailyFlowModal = new bootstrap.Modal(el, { backdrop: 'static', keyboard: false });
  el.addEventListener('hidden.bs.modal', function(){ $(el).remove(); dailyFlowModal = null; });
  dailyFlowModal.show();
}

window.setDailyOpStatus = function(checkId, status){
  const s = (APP.dailySubmissions || []).find(x => x.checkId === checkId);
  if (!s) return;
  const next = dailyNormOp(status);
  if (!dailyIsOpenOp(next)) return;
  if (next === dailyNormOp(s.opStatus)) return;

  showLoading('កំពុងរក្សាទុក...');
  google.script.run
    .withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
      s.opStatus = res.opStatus || next;
      s.opAt = res.opAt || (dmyToday() + ' ' + nowTimeStr());
      s.opBy = res.opBy || currentUser.username;
      showAlert('Status: ' + dailyOpInfo(s.opStatus).label, 'success');
      refreshCurrentPage();
      dailySyncNow();
    })
    .withFailureHandler(handleError)
    .setDailyOpStatus({ checkId: checkId, status: next });
};

/* Finished Form — the items come from the Checklist_Template sheet (Frequency = Finish) */

window.setDailyFinishCheck = function(itemId, status){
  if (!dailyFinishState || !dailyFinishState.answers[itemId]) return;
  dailyFinishState.answers[itemId].status = status;
  const $item = $('.check-item[data-finish="' + itemId + '"]');
  $item.removeClass('ok nok na').addClass(status).attr('data-status', status);
  $item.find('.check-btn').removeClass('selected-ok selected-nok selected-na');
  $item.find('.check-btn').eq(status==='ok'?0:status==='nok'?1:2).addClass('selected-'+status);
  // Note + photos belong to NOT OK only — they stay hidden for OK / N/A
  const isNok = (status === 'nok');
  $item.find('.nok-note').toggleClass('visible', isNok);
  $item.find('.js-photo-row').css('display', isNok ? 'flex' : 'none');
  updateDailyFinishCounts();
};

window.setDailyFinishNote = function(itemId, val){
  if (!dailyFinishState || !dailyFinishState.answers[itemId]) return;
  dailyFinishState.answers[itemId].note = val;
};

/* Fuel Level / Fuel Added values (photos are kept by the shared photo bag) */
window.setDailyFinishExtraValue = function(key, val){
  if (!dailyFinishState || !dailyFinishState.extras || !dailyFinishState.extras[key]) return;
  dailyFinishState.extras[key].value = String(val == null ? '' : val);
};

window.openDailyFinishForm = function(checkId){
  const s = (APP.dailySubmissions || []).find(x => x.checkId === checkId);
  if (!s) return;
  const eq = APP.equipmentMap[s.equipmentId] || {};
  const startOdo  = (s.startOdo === '' || s.startOdo == null) ? '' : dailyNumText(s.startOdo);
  const startHour = (s.startHour === '' || s.startHour == null) ? '' : dailyNumText(s.startHour);

  const items = dailyTplItems(s.group, DAILY_FREQ_FINISH);
  const answers = {};
  // OK is the default for every item (same as the daily checklist)
  items.forEach(it => { answers[it.itemId] = { status: 'ok', note: '', photos: [] }; });
  (s.finishChecks || []).forEach(f => {
    if (!answers[f.itemId]) return;
    if (f.status) answers[f.itemId].status = f.status;
    answers[f.itemId].note = f.note || '';
    answers[f.itemId].photos = (Array.isArray(f.photos) ? f.photos : [])
      .filter(p => p && p.fileId).map(p => ({ fileId: p.fileId }));
  });

  // Initialize extras for all 4 inputs so they can hold photos
  const fx = s.finishExtra || {};
  const extras = {};
  ['fuelLevel', 'fuelAdded', 'dailyEndOdo', 'dailyEndHour'].forEach(k => {
    const v = fx[k] || {};
    extras[k] = {
      value: (v.value === '' || v.value == null) ? '' : String(v.value),
      photos: (Array.isArray(v.photos) ? v.photos : []).filter(p => p && p.fileId).map(p => ({ fileId: p.fileId }))
    };
  });

  dailyFinishState = { checkId: checkId, items: items, answers: answers, extras: extras };

  const itemsHtml = items.length
    ? items.map((it, i) => {
        const a = answers[it.itemId] || { status: 'ok', note: '', photos: [] };
        const st = a.status || 'ok';
        return '<div class="check-item '+st+'" data-finish="'+escAttr(it.itemId)+'" data-status="'+escAttr(st)+'">' +
          '<div class="row-line"><div class="label-part"><span class="item-num">'+(i+1)+'.</span><div class="item-text">' +
            '<span class="item-name-kh">'+esc(it.itemKhmer)+'</span>' +
            (it.itemEng ? '<span class="item-name-en">'+esc(it.itemEng)+'</span>' : '') +
          '</div></div></div>' +
          '<div class="check-actions">' +
            '<button type="button" class="check-btn '+(st==='ok'?'selected-ok':'')+'" onclick="setDailyFinishCheck(\''+escAttr(it.itemId)+'\',\'ok\')"><i class="bi bi-check-circle me-1"></i>OK</button>' +
            '<button type="button" class="check-btn '+(st==='nok'?'selected-nok':'')+'" onclick="setDailyFinishCheck(\''+escAttr(it.itemId)+'\',\'nok\')"><i class="bi bi-x-circle me-1"></i>NOT OK</button>' +
            '<button type="button" class="check-btn '+(st==='na'?'selected-na':'')+'" onclick="setDailyFinishCheck(\''+escAttr(it.itemId)+'\',\'na\')"><i class="bi bi-dash-circle me-1"></i>N/A</button>' +
          '</div>' +
          '<div class="nok-note '+(st==='nok'?'visible':'')+'"><input type="text" class="form-control form-control-sm" placeholder="ចំណាំ / បញ្ហា..." value="'+esc(a.note)+'" oninput="setDailyFinishNote(\''+escAttr(it.itemId)+'\', this.value)"></div>' +
          dailyPhotoGalleryHtml(it.itemId, a.photos || [], st === 'nok') +
        '</div>';
      }).join('')
    : '<div class="text-muted small text-center py-3">គ្មានទម្រង់បញ្ចប់ការងារសម្រាប់ក្រុមនេះទេ (No Finished Form items configured).</div>';

  const weeklyItems = dailyTplItems(s.group, DAILY_FREQ_WEEKLY);
  const weekCounts = dailyAnswerCounts({ answers: answers });
  
  const infoGrid =
    '<div class="row g-2 mb-3">' +
      dailyInfoCard('truck', esc(s.group || 'ឧបករណ៍'),
        '<div>' + esc(eq.shortName || s.equipmentId) + '<span class="badge bg-danger ms-2">Finished Form</span></div>', 'primary') +
      dailyInfoCard('calendar', 'កាលបរិច្ឆេទ', esc(s.date) + ' ' + esc(s.time), 'warning') +
    '</div>' +

  const numField = (opts) => {
    // Determine a unique key for photos (extraKey for fuel, or inputId for odometer)
    const photoKey = opts.extraKey || opts.inputId; 
    const inputId = opts.inputId || (opts.extraKey ? 'daily_' + opts.extraKey : '');
    
    return '<div class="finish-field">' +
      '<label class="form-label small fw-bold mb-1"' + (inputId ? ' for="' + inputId + '"' : '') + '>' +
        esc(opts.labelKh) + ' <span class="text-muted fw-normal">(' + esc(opts.labelEn) + ')</span></label>' +
      '<input type="number" step="0.1" min="0" class="form-control form-control-sm"' +
        (inputId ? ' id="' + inputId + '"' : '') +
        ' placeholder="0.0" value="' + escAttr(opts.value == null ? '' : opts.value) + '"' +
        (opts.extraKey ? ' oninput="setDailyFinishExtraValue(\'' + opts.extraKey + '\', this.value)"' : '') + '>' +
      (opts.hint ? '<div class="small text-muted mt-1">' + opts.hint + '</div>' : '') +
      // Renders photos for ALL 4 fields using the photoKey
      (photoKey ? dailyPhotoGalleryHtml(photoKey, opts.photos || []) : '') +
    '</div>';
  };

  const inputsCard =
    '<div class="card mb-3">' +
      '<div class="group-header d-flex justify-content-between align-items-center">' +
        '<span><i class="bi bi-speedometer2 me-2"></i>បញ្ចូលព័ត៌មានបញ្ចប់ការងារ</span>' +
        '<small class="text-muted">៤ ចំណុច</small>' +
      '</div>' +
      '<div class="card-body p-2"><div class="finish-grid">' +
        numField({ 
          inputId: 'dailyEndOdo', 
          labelKh: 'គីឡូម៉ែត្រចុងក្រោយ', 
          labelEn: 'End Odometer',
          value: (s.endOdo === '' || s.endOdo == null) ? '' : s.endOdo,
          hint: '<i class="bi bi-arrow-right-short"></i> Start: ' + esc(startOdo || '—'),
          photos: extras.dailyEndOdo.photos 
        }) +
        numField({ 
          inputId: 'dailyEndHour', 
          labelKh: 'ម៉ោងប្រតិបត្តិការចុងក្រោយ', 
          labelEn: 'End OPHour',
          value: (s.endHour === '' || s.endHour == null) ? '' : s.endHour,
          hint: '<i class="bi bi-arrow-right-short"></i> Start: ' + esc(startHour || '—'),
          photos: extras.dailyEndHour.photos
        }) +
        numField({ 
          extraKey: 'fuelLevel', 
          labelKh: 'កម្រិតប្រេងម៉ាស៊ូត', 
          labelEn: 'Diesel level',
          value: extras.fuelLevel.value,
          photos: extras.fuelLevel.photos
        }) +
        numField({ 
          extraKey: 'fuelAdded', 
          labelKh: 'បរិមាណប្រេងបានចាក់', 
          labelEn: 'Fuel added',
          value: extras.fuelAdded.value,
          photos: extras.fuelAdded.photos
        }) +
      '</div></div>' +
    '</div>';

  $('#app').html(
    '<div class="container-fluid px-0 daily-form-page">' +
      '<button class="btn btn-sm btn-outline-secondary mb-3" onclick="cancelDailyFinish()"><i class="bi bi-arrow-left"></i> ត្រឡប់</button>' +
      infoGrid +
      inputsCard +
      '<div class="card mb-3 legend-card">' +
        '<div class="legend-body text-center">' +
          '<div class="lbl-kh"><span class="acronym">OK</span>=ធម្មតា &nbsp; <span class="acronym">NOT OK</span>=មានបញ្ហា &nbsp; <span class="acronym">N/A</span>=N/A</div>' +
        '</div>' +
      dailyCountCards(weekCounts.ok, weekCounts.nok, 'dailyFinish') +
      '</div>' +
      '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center">' +
        '<span><i class="bi bi-clipboard2-check me-2"></i>ការត្រួតពិនិត្យក្រោយប្រតិបត្តិការ</span>' +
        '<small class="text-muted">' + dailyItemWord(items.length) + ' · <span id="dailyFinishNaCount">' + weekCounts.na + ' N/A</span></small>' +
      '</div><div class="card-body p-2"><div class="check-grid">' + itemsHtml + '</div></div></div>' +
      '<div class="card mb-3"><div class="card-body">' +
        '<label class="form-label fw-bold">កំណត់សម្គាល់ (Remark)</label>' +
        '<textarea class="form-control form-control-sm" id="dailyEndRemark" rows="3" placeholder="Optional...">' + esc(s.endRemark || '') + '</textarea>' +
      '</div></div>' +
      '<button class="btn btn-danger w-100" style="margin-bottom:100px !important;" onclick="submitDailyFinishForm(\'' + escAttr(checkId) + '\')"><i class="bi bi-check2-circle me-1"></i>ដាក់បញ្ជូន</button>' +
    '</div>'
  );
  window.scrollTo(0, 0);
};

window.cancelDailyFinish = function(){
  if (!confirm('បោះបង់ការបញ្ជូន Finished Form?')) return;
  dailyFinishState = { checkId: '', items: [], answers: {}, extras: {} };
  showPage('home');
};

window.submitDailyFinishForm = function(checkId){
  const s = (APP.dailySubmissions || []).find(x => x.checkId === checkId);
  if (!s) return;

  const odoRaw  = String($('#dailyEndOdo').val() || '').trim();
  const hourRaw = String($('#dailyEndHour').val() || '').trim();
  const remark  = $('#dailyEndRemark').val() || '';

  if (!odoRaw && !hourRaw) { showAlert('សូមបំពេញអូដូម៉ែត្រចុងក្រោយ ឬម៉ោងប្រតិបត្តិការចុងក្រោយ (Please fill the End Odometer or the End OPHour)', 'warning'); return; }

  const odo  = odoRaw  === '' ? null : parseFloat(odoRaw);
  const hour = hourRaw === '' ? null : parseFloat(hourRaw);
  if (odo !== null && (isNaN(odo) || odo < 0))    { showAlert('អូដូម៉ែត្រចុងក្រោយត្រូវតែជាលេខវិជ្ជមាន (End Odometer must be a positive number)', 'warning'); return; }
  if (hour !== null && (isNaN(hour) || hour < 0)) { showAlert('ម៉ោងប្រតិបត្តិការចុងក្រោយត្រូវតែជាលេខវិជ្ជមាន (End OPHour must be a positive number)', 'warning'); return; }

  const startOdo  = (s.startOdo === '' || s.startOdo == null) ? null : parseFloat(s.startOdo);
  const startHour = (s.startHour === '' || s.startHour == null) ? null : parseFloat(s.startHour);
  if (odo !== null && startOdo !== null && !isNaN(startOdo) && odo < startOdo) {
    showAlert('អូដូម៉ែត្រចុងក្រោយមិនអាចតិចជាងអូដូម៉ែត្រចាប់ផ្តើមបានទេ (' + startOdo + ')', 'warning'); return;
  }
  if (hour !== null && startHour !== null && !isNaN(startHour) && hour < startHour) {
    showAlert('ម៉ោងប្រតិបត្តិការចុងក្រោយមិនអាចតិចជាងម៉ោងចាប់ផ្តើមបានទេ (' + startHour + ')', 'warning'); return;
  }

  // Every configured Finished Form item must be answered (OK / NOT OK / N/A)
  const st = dailyFinishState || { items: [], answers: {}, extras: {} };
  const unanswered = (st.items || []).filter(it => {
    const a = st.answers[it.itemId];
    return !a || ['ok', 'nok', 'na'].indexOf(a.status) === -1;
  });
  if (unanswered.length) {
    showAlert('សូមឆ្លើយរាល់ចំណុចក្នុងទម្រង់បញ្ចប់ការងារ (Please answer every Finished Form item - ' + unanswered.length + ' left)', 'warning'); return;
  }
  if (dailyHasPendingUploads(st)) {
    showAlert('រូបថតកំពុងផ្ទុកឡើង — សូមរង់ចាំបន្តិច (photos still uploading)', 'warning'); return;
  }

  const finishChecks = (st.items || []).map(it => {
    const a = st.answers[it.itemId] || {};
    const entry = {
      itemId: it.itemId,
      itemKhmer: it.itemKhmer || '',
      itemEng: it.itemEng || '',
      status: a.status,
      note: a.note || ''
    };
    const photos = dailyPhotosPayload(a.photos);
    if (photos.length) entry.photos = photos;
    return entry;
  });

  // Process Extras (Now includes all 4 fields: fuel, fuelAdded, dailyEndOdo, dailyEndHour)
  const extras = st.extras || {};
  const finishExtra = {};
  const extraNums = {};
  let badField = '';
  
  Object.keys(extras).forEach(k => {
    const raw = String(extras[k].value == null ? '' : extras[k].value).trim();
    let value = '';
    if (raw !== '') {
      const n = parseFloat(raw);
      if (isNaN(n) || n < 0) badField = k;
      else value = n;
    }
    
    // Save the value AND the photos for this field
    finishExtra[k] = { 
      value: value, 
      photos: dailyPhotosPayload(extras[k].photos) 
    };
    
    // Only map the fuel numbers to extraNums, since Odo/Hour are handled separately above
    if (k === 'fuelLevel' || k === 'fuelAdded') {
      extraNums[k] = value;
    }
  });

  if (badField) {
    const fieldNames = {
      fuelLevel: 'កម្រិតប្រេងម៉ាស៊ូត',
      fuelAdded: 'បរិមាណបេងបានចាក់',
      dailyEndOdo: 'អូដូម៉ែត្រចុងក្រោយ',
      dailyEndHour: 'ម៉ោងប្រតិបត្តិការចុងក្រោយ'
    };
    showAlert((fieldNames[badField] || badField) + ' ត្រូវតែជាលេខវិជ្ជមាន (must be a positive number)', 'warning');
    return;
  }

  showLoading('កំពុងបញ្ជូន...');
  google.script.run
    .withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) {
        hideLoading();
        showAlert((res && res.message) || 'Error', 'danger');
        return;
      }

      s.opStatus   = DAILY_OP_WAITING;
      s.opAt       = res.opAt || (dmyToday() + ' ' + nowTimeStr());
      s.opBy       = res.opBy || currentUser.username;
      s.endOdo     = (res.endOdo === '' || res.endOdo == null) ? '' : res.endOdo;
      s.endHour    = (res.endHour === '' || res.endHour == null) ? '' : res.endHour;
      s.endRemark  = res.endRemark || '';
      s.finishedAt = res.finishedAt || s.opAt;
      s.finishedBy = res.finishedBy || currentUser.username;
      s.finishChecks = Array.isArray(res.finishChecks) ? res.finishChecks : finishChecks;
      s.finishExtra  = (res.finishExtra && typeof res.finishExtra === 'object') ? res.finishExtra : finishExtra;

      // Leave the form page first, then repaint from the updated local copy
      dailyFinishState = { checkId: '', items: [], answers: {}, extras: {} };
      hideDailyFlowModal();
      showAlert('បានបញ្ចប់ការងារ — ឧបករណ៍កំពុងរង់ចាំការប្រគល់ការងារ (Finished — waiting for handover)', 'success');
      showPage('home');
      dailySyncNow();
    })
    .withFailureHandler(err => { hideLoading(); handleError(err); })
    .finishDailyShift({
      checkId: checkId, endOdo: odo, endHour: hour, remark: remark,
      finishChecks: finishChecks,
      fuelLevel: extraNums.fuelLevel === '' ? '' : extraNums.fuelLevel,
      fuelAdded: extraNums.fuelAdded === '' ? '' : extraNums.fuelAdded,
      finishExtra: finishExtra
    });
};

/* =========================================================
   DAILY LIST VIEW
   ========================================================= */
/* One horizontally scrollable filter tab bar (same look as the Monthly list). */
function dailyListTabBar(id, key, items, current) {
  let h = '<div class="tab-bar mb-1" id="' + id + '" style="display: flex; overflow-x: auto; white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none; border: none; background: transparent; padding-bottom: 2px;">';
  items.forEach(it => {
    h += '<div class="tab list-tab ' + (current === it.value ? 'active' : '') + '" data-key="' + key + '" data-value="' + escAttr(it.value) + '"' +
         ' onclick="setDailyListFilter(\'' + key + '\',\'' + escAttr(it.value) + '\')">' + esc(it.label) + '</div>';
  });
  return h + '</div>';
}

window.renderDailyList = function() {
  const groups    = APP.filterOptions.groups;
  const isDriver  = currentUser.role === 'driver';

  let shell = '<div class="container-fluid px-0">';
  shell += '<div class="d-flex justify-content-between align-items-center mb-3"><h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>បញ្ជីត្រួតពិនិត្យ (Daily)</h5><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'list\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>';
  shell += '<div class="card mb-2"><div class="card-body py-2">';
  shell += '<input type="text" class="form-control form-control-sm mb-2" id="fDailySearch" placeholder="ស្វែងរក Check-ID / ឧបករណ៍ / អ្នកបើកបរ..." value="'+esc(dailyListFilters.search)+'" oninput="onDailyListSearch(this)">';
  shell += '<div class="d-flex gap-1 mb-2 flex-wrap"><button class="btn btn-sm btn-outline-primary date-preset" data-preset="today" onclick="setDailyDatePreset(\'today\')">ថ្ងៃនេះ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="7d" onclick="setDailyDatePreset(\'7d\')">7 ថ្ងៃ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="30d" onclick="setDailyDatePreset(\'30d\')">30 ថ្ងៃ</button><button class="btn btn-sm btn-outline-primary date-preset" data-preset="all" onclick="setDailyDatePreset(\'all\')">ទាំងអស់</button></div>';
  shell += '<div class="row g-2 mb-2"><div class="col-6"><input type="date" class="form-control form-control-sm" id="fDailyFrom" value="'+dailyListFilters.dateFrom+'" onchange="onDailyListDateChange()"></div><div class="col-6"><input type="date" class="form-control form-control-sm" id="fDailyTo" value="'+dailyListFilters.dateTo+'" onchange="onDailyListDateChange()"></div></div>';

    // Frequency — daily shift checks vs weekly checks
  shell += dailyListTabBar('dailyTypeTabBar', 'checkType', [
    { value: 'all',    label: 'ទាំងអស់' },
    { value: 'daily',  label: 'Daily' },
    { value: 'weekly', label: 'Weekly' }
  ], dailyListFilters.checkType);
  
  shell += dailyListTabBar('dailyStatusTabBar', 'status', [
    { value: 'all',    label: 'ទាំងអស់' },
    { value: 'OK',     label: 'OK' },
    { value: 'Issues', label: 'Issues' }
  ], dailyListFilters.status);

  // Confirmation workflow — same two-step flow as the Monthly list
  shell += dailyListTabBar('dailyConfirmTabBar', 'confirmStatus', [
    { value: 'all',             label: 'ទាំងអស់' },
    { value: 'Pending-Admin',   label: 'រង់ចាំ Admin' },
    { value: 'Pending-Manager', label: 'រង់ចាំ Manager' },
    { value: 'Confirmed',       label: 'បានបញ្ជាក់' }
  ], dailyListFilters.confirmStatus);

  // Equipment / shift status (Operating, Stand By, …)
  shell += dailyListTabBar('dailyOpTabBar', 'opStatus', [
    { value: 'all',              label: 'ទាំងអស់' },
    { value: DAILY_OP_OPERATING, label: 'Operating' },
    { value: DAILY_OP_STANDBY,   label: 'Stand By' },
    { value: DAILY_OP_WAITING,   label: 'Waiting Handover' },
    { value: DAILY_OP_HANDED,    label: 'Handed Over' }
  ], dailyListFilters.opStatus);

  if (groups.length > 1 && !isDriver) {
    shell += '<div class="tab-bar mb-1"><div class="tab list-tab '+(dailyListFilters.group==='all'?'active':'')+'" data-key="group" data-value="all" onclick="setDailyListFilter(\'group\',\'all\')">ក្រុមទាំងអស់</div>';
    groups.forEach(g => { shell += '<div class="tab list-tab '+(dailyListFilters.group===g?'active':'')+'" data-key="group" data-value="'+escAttr(g)+'" onclick="setDailyListFilter(\'group\',\''+escAttr(g)+'\')">'+esc(g)+'</div>'; });
    shell += '</div>';
  }
  shell += '</div></div>';
  
  if (dailyListFilters.nokItemIds && dailyListFilters.nokItemIds.length > 0) {
    shell += '<div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-danger d-flex align-items-center gap-1" style="font-size:.8rem;padding:6px 10px;"><i class="bi bi-x-circle"></i> ' + esc(dailyListFilters.nokItemLabel || 'Issue') + '<span onclick="clearDailyIssueFilter()" style="cursor:pointer;margin-left:6px;font-weight:700;">✕</span></span></div>';
  }

  shell += '<div class="d-flex justify-content-between align-items-center mb-2"><small class="text-muted" id="dailyListCount">0 ករណី</small><button class="btn btn-sm btn-outline-secondary" onclick="clearDailyListFilters()"><i class="bi bi-x-lg"></i> Clear</button></div>';
  shell += '<div id="dailyListResults"></div></div>';
  
  $('#app').html(shell);
  initDatePickers('#app'); 
  applyDailyDatePresetActive(); 
  updateDailyListResults();
};

function applyDailyListFilters(list) {
  let out = list.slice();
  if (dailyListFilters.status !== 'all') out = out.filter(s => s.overall === dailyListFilters.status);

  // Frequency: daily shift checks vs weekly checks
  if (dailyListFilters.checkType === 'daily')  out = out.filter(s => !dailyIsWeekly(s));
  if (dailyListFilters.checkType === 'weekly') out = out.filter(s => dailyIsWeekly(s));

  // Confirmation workflow (Admin first, then Manager) — mirrors the Monthly list
  const stage = dailyListFilters.confirmStatus;
  if (stage && stage !== 'all') {
    if (stage === 'Pending-Admin') {
      out = out.filter(s => (s.confirmStatus || 'Pending') === 'Pending');
    } else if (stage === 'Pending-Manager') {
      out = out.filter(s => (s.confirmStatus || 'Pending') === 'Confirmed' && !s.directorStatus);
    } else if (stage === 'Confirmed') {
      out = out.filter(s => s.directorStatus === 'Confirmed');
    } else if (stage === 'Rejected') {
      out = out.filter(s => s.confirmStatus === 'Rejected' || s.directorStatus === 'Rejected');
    } else {
      out = out.filter(s => (s.confirmStatus || 'Pending') === stage);
    }
  }

  // Equipment / shift status chosen in the Daily home or the Finished form
  if (dailyListFilters.opStatus && dailyListFilters.opStatus !== 'all') {
    if (dailyListFilters.opStatus === 'none') out = out.filter(s => !dailyNormOp(s.opStatus));
    else out = out.filter(s => dailyNormOp(s.opStatus) === dailyListFilters.opStatus);
  }

  if (dailyListFilters.group !== 'all')  out = out.filter(s => s.group === dailyListFilters.group);
  if (dailyListFilters.equipmentId !== 'all') out = out.filter(s => s.equipmentId === dailyListFilters.equipmentId);
  if (dailyListFilters.driver !== 'all') out = out.filter(s => s.username === dailyListFilters.driver);
  if (dailyListFilters.dateFrom) {
    const from = new Date(dailyListFilters.dateFrom + 'T00:00:00').getTime();
    out = out.filter(s => parseDmyToMs(s.date) >= from);
  }
  if (dailyListFilters.dateTo) {
    const to = new Date(dailyListFilters.dateTo + 'T23:59:59').getTime();
    out = out.filter(s => parseDmyToMs(s.date) <= to);
  }
  if (dailyListFilters.search) {
    const q = dailyListFilters.search.toLowerCase();
    out = out.filter(s => {
      const shortName = String(eqShort(s.equipmentId) || '').toLowerCase();
      return String(s.equipmentId).toLowerCase().includes(q) ||
        shortName.includes(q) ||
        String(s.driverName).toLowerCase().includes(q) ||
        String(s.checkId).toLowerCase().includes(q);
    });
  }
  if (dailyListFilters.nokItemIds && dailyListFilters.nokItemIds.length > 0) {
    const idSet = new Set(dailyListFilters.nokItemIds);
    out = out.filter(s =>
      (s.checks || []).some(c => c.status === 'nok' && idSet.has(c.itemId))
    );
  }
  out.sort((a, b) => {
    const ta = parseDmyToMs(a.date) + timeToMs(a.time);
    const tb = parseDmyToMs(b.date) + timeToMs(b.time);
    return tb - ta;
  });
  return out;
}

function updateDailyListResults() {
  const filtered = applyDailyListFilters(APP.dailySubmissions || []);
  const rows = filtered.map((s, i) => {
    const cls = s.overall === 'Issues' ? 'nok' : 'ok';
    const ci = dailyConfirmInfo(s);
    let confirmLine = '<div class="small mt-1 d-flex gap-1 align-items-center flex-wrap">' +
      '<span class="status-badge status-' + ci.cls + '" style="font-size:.65rem;min-width:auto;padding:2px 8px;">' +
        '<i class="bi bi-' + ci.icon + ' me-1"></i>' + esc(ci.label) +
      '</span></div>';

    const trailerShort = dailyTrailerShort(s.trailerId || (APP.equipmentMap[s.equipmentId] || {}).trailerId);

    return '<div class="card mb-2 clickable-card" onclick="viewDailyCheck(\''+escAttr(s.checkId)+'\')">' +
      '<div class="group-header d-flex justify-content-between align-items-center">' +
        '<span><span class="text-muted me-2">'+(i+1)+'.</span><strong>'+esc(eqShort(s.equipmentId))+'</strong>'+(dailyIsWeekly(s) ? ' <span class="badge bg-info text-dark" style="font-size:.6rem;">Weekly</span>' : '')+(trailerShort ? ' <span class="badge bg-secondary" style="font-size:.6rem;">'+esc(trailerShort)+'</span>' : '')+'</span>' +
        '<span class="d-flex align-items-center gap-1">' + (s.opStatus ? dailyOpBadge(s.opStatus) : '') + '<span class="status-badge status-'+cls+'">'+esc(s.overall)+'</span></span>' +
      '</div>' +
      '<div class="card-body py-2">' +
        '<div class="row small g-1">' +
          '<div class="col-6"><i class="bi bi-person me-1"></i>'+esc(s.driverName)+'</div>' +
          '<div class="col-6"><i class="bi bi-calendar me-1"></i>'+esc(s.date)+' '+esc(s.time)+'</div>' +
          '<div class="col-6"><i class="bi bi-tag me-1"></i>'+esc(s.group)+'</div>' +
          '<div class="col-6"><i class="bi bi-hash me-1"></i>'+esc(s.checkId)+'</div>' +
        '</div>' +
        confirmLine +
        '<div class="text-end mt-2"><button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation();viewDailyCheck(\''+escAttr(s.checkId)+'\')"><i class="bi bi-eye"></i> លម្អិត</button></div>' +
      '</div>' +
    '</div>';
  }).join('');
  
  $('#dailyListResults').html(rows || '<p class="text-muted text-center py-4">គ្មានទិន្នន័យ</p>');
  $('#dailyListCount').text(filtered.length + ' ករណី');
}

window.setDailyListFilter = function(key, value) {
  dailyListFilters[key] = value;
  if (key === 'status') {
    if (value === 'all') {
      dailyListFilters.dateFrom = '';
      dailyListFilters.dateTo = '';
      dailyListFilters.group = 'all';
      dailyListFilters.driver = 'all';
      dailyListFilters.equipmentId = 'all';
      dailyListFilters.search = '';
      dailyListFilters.nokItemIds = [];
      dailyListFilters.nokItemLabel = '';
      dailyListFilters.checkType = 'all';
      dailyListFilters.confirmStatus = 'all';
      dailyListFilters.opStatus = 'all';
    }
  }
  renderDailyList();
};

let _dailySearchTmr = null;
window.onDailyListSearch = function(el) {
  const val = el.value;
  clearTimeout(_dailySearchTmr);
  _dailySearchTmr = setTimeout(() => {
    dailyListFilters.search = val;
    updateDailyListResults();
  }, 300);
};

window.onDailyListDateChange = function() {
  dailyListFilters.dateFrom = $('#fDailyFrom').val() || '';
  dailyListFilters.dateTo = $('#fDailyTo').val() || '';
  applyDailyDatePresetActive();
  updateDailyListResults();
};

window.setDailyDatePreset = function(preset) {
  const todayIso = isoToday();
  if (preset === 'today') {
    dailyListFilters.dateFrom = todayIso; dailyListFilters.dateTo = todayIso;
  } else if (preset === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    dailyListFilters.dateFrom = isoDate(d); dailyListFilters.dateTo = todayIso;
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 29);
    dailyListFilters.dateFrom = isoDate(d); dailyListFilters.dateTo = todayIso;
  } else {
    dailyListFilters.dateFrom = ''; dailyListFilters.dateTo = '';
  }
  setDateInput('fDailyFrom', dailyListFilters.dateFrom);
  setDateInput('fDailyTo', dailyListFilters.dateTo);
  applyDailyDatePresetActive(preset);
  updateDailyListResults();
};

function applyDailyDatePresetActive(explicit) {
  $('.date-preset').removeClass('active');
  let preset = explicit;
  if (!preset) {
    const todayIso = isoToday();
    const d7 = new Date(); d7.setDate(d7.getDate() - 6);
    const d30 = new Date(); d30.setDate(d30.getDate() - 29);
    if (dailyListFilters.dateFrom === todayIso && dailyListFilters.dateTo === todayIso) preset = 'today';
    else if (dailyListFilters.dateFrom === isoDate(d7) && dailyListFilters.dateTo === todayIso) preset = '7d';
    else if (dailyListFilters.dateFrom === isoDate(d30) && dailyListFilters.dateTo === todayIso) preset = '30d';
    else if (!dailyListFilters.dateFrom && !dailyListFilters.dateTo) preset = 'all';
  }
  if (preset) $('.date-preset[data-preset="'+preset+'"]').addClass('active');
}

window.clearDailyListFilters = function() {
  dailyListFilters = {
    status:'all', checkType:'all', confirmStatus:'all', opStatus:'all',
    group:'all', equipmentId:'all', driver:'all',
    dateFrom:'', dateTo:'', search:'', nokItemIds: [], nokItemLabel: ''
  };
  renderDailyList();
};

window.clearDailyIssueFilter = function() {
  dailyListFilters.nokItemIds = [];
  dailyListFilters.nokItemLabel = '';
  renderDailyList();
};

/* =========================================================
   DAILY DETAIL MODAL
   ========================================================= */
window.viewDailyCheck = function(checkId) {
  const s = (APP.dailySubmissions || []).find(x => x.checkId === checkId);
  if (!s) { showAlert('រកមិនឃើញ', 'warning'); return; }
  renderDailyDetailModal(s);
};

function renderDailyDetailModal(s) {
  $('#modalTitle').text((dailyIsWeekly(s) ? 'Weekly · ' : '') + s.checkId);
  window.currentDetailCheckId = s.checkId;
  $('#modalActionButtons').addClass('d-none'); // Hide print/pdf buttons for daily
  
  const tplMap = {};
  ((APP.dailyTemplates || {})[s.group] || []).forEach(t => { tplMap[t.itemId] = t; });
  
  const enriched = (s.checks || []).map(c => ({
    itemId: c.itemId,
    itemKhmer: (tplMap[c.itemId] && tplMap[c.itemId].itemKhmer) || c.itemId,
    itemEng: (tplMap[c.itemId] && tplMap[c.itemId].itemEng) || '',
    status: c.status, note: c.note || '',
    photos: Array.isArray(c.photos) ? c.photos : []
  }));

  const okCount  = enriched.filter(c => c.status === 'ok').length;
  const nokCount = enriched.filter(c => c.status === 'nok').length;
  const naCount  = enriched.filter(c => c.status === 'na').length;

  const drv = (APP.users || []).find(u => u.username === s.username) || {};
  const rawRemarkPhotos = Array.isArray(s.photoIds) ? s.photoIds : String(s.photoIds || '').split(',');
  const remarkPhotos = rawRemarkPhotos.map(x => String(x || '').trim()).filter(Boolean).map(id => ({ fileId: id }));
  const trailerId = String(s.trailerId || (APP.equipmentMap[s.equipmentId] || {}).trailerId || '');
  const trl = (APP.trailers || []).find(t => t.trailerId && String(t.trailerId) === trailerId);

  const info =
    '<div class="p-3">' +
      '<div class="row g-2 mb-3">' +
        dailyInfoCard('truck', esc(s.group || 'ឧបករណ៍'), esc(eqShort(s.equipmentId)), 'primary') +
        (trl ? dailyInfoCard('link', 'រ៉ឺម៉ក', esc(trl.shortName || trl.trailerId), 'secondary') : '') +
        dailyInfoCard('person', 'អ្នកត្រួតពិនិត្យ', dailyInfoCardName(drv.fullName || s.driverName, drv.phone || ''), 'success') +
        dailyInfoCard('calendar', 'កាលបរិច្ឆេទ', esc(s.date || '') + ' ' + esc(s.time || ''), 'warning') +
      '</div>' +
      
      dailyOpSectionHtml(s) +
      buildDailyConfirmSection(s) +
      dailyFinishExtraHtml(s) +
      dailyFinishChecksHtml(s) +    

    // ── Start Form — Checklist header ──
      '<div class="card mb-3 border-0 shadow-sm">' +
        '<div class="group-header d-flex justify-content-between align-items-center px-3 py-2" ' +
             'style="background:transparent;border-bottom:1px solid var(--border-color);">' +
          '<span class="fw-semibold"><i class="bi bi-play-circle me-2 text-primary"></i>ការត្រួតពិនិត្យមុនប្រតិបត្តិការ</span>' +
          '<small class="text-muted">' + enriched.length + ' items</small>' +
        '</div>' +
      '</div>' +
    

        '<div class="row g-2 mb-3">' +
        '<div class="col-6"><div class="stat-card" data-filter="ok" onclick="filterDailyDetailItems(\'ok\')"><div class="num text-success">'+okCount+'</div><div class="lbl">N – Normal</div></div></div>' +
        '<div class="col-6"><div class="stat-card" data-filter="nok" onclick="filterDailyDetailItems(\'nok\')"><div class="num text-danger">'+nokCount+'</div><div class="lbl">Issues</div></div></div>' +
      '</div>' +
    
      '<div class="card mb-3">' +
        '<div class="group-header d-flex justify-content-between align-items-center">' +
          '<span><i class="bi bi-list-check me-2"></i>Items</span>' +
          '<small class="text-muted"><span id="detailItemCount">'+enriched.length+' shown</span>' + (naCount ? ' · ' + naCount + ' N/A' : '') + '</small>' +
        '</div>' +
    
        '<div class="card-body p-2" id="dailyDetailItemsList"><div class="check-grid">' +
          enriched.map((c, i) => {
            const cls   = c.status === 'ok' ? 'ok' : c.status === 'nok' ? 'nok' : 'na';
            const lbl   = c.status === 'ok' ? 'OK' : c.status === 'nok' ? 'NOT OK' : (c.status === 'na' ? 'N/A' : '—');
            const badge = c.status === 'ok' ? 'status-ok' : c.status === 'nok' ? 'status-nok' : 'status-pending';
            return '<div class="check-item '+cls+'" data-status="'+escAttr(c.status)+'">' +
              '<div class="d-flex justify-content-between align-items-start gap-2">' +
                '<div class="label-part"><span class="item-num">'+(i+1)+'.</span><div class="item-text">' +
                  '<span class="item-name-kh">'+esc(c.itemKhmer)+'</span>' +
                  (c.itemEng ? '<span class="item-name-en">'+esc(c.itemEng)+'</span>' : '') +
                '</div></div>' +
                '<span class="status-badge '+badge+'" style="min-width:auto;padding:2px 8px;font-size:.65rem;">'+lbl+'</span>' +
              '</div>' +
              (c.note ? '<div class="small text-danger mt-1"><i class="bi bi-chat-left-text me-1"></i>'+esc(c.note)+'</div>' : '') +
              dailyPhotoIdsHtml(c.photos) +
            '</div>';
          }).join('') +
        '</div></div>' +
      '</div>' +

      ((s.remark || remarkPhotos.length)
        ? '<div class="card mb-3"><div class="card-body">' +
            (s.remark ? '<div class="small text-muted">Remark</div><div>' + esc(s.remark) + '</div>' : '') +
            (remarkPhotos.length ? '<div class="small text-muted mt-2">រូបថតបន្ថែម · Remark photos</div>' + dailyPhotoIdsHtml(remarkPhotos) : '') +
          '</div></div>'
        : '') +
    '</div>';

  $('#modalBody').html(info);
  currentDetailModal.show();
}

/* Current confirmation stage of a daily shift: Admin first, then Manager. */
function dailyConfirmInfo(s){
  const mgr = String((s && s.confirmStatus) || 'Pending');
  const dir = String((s && s.directorStatus) || '');
  const stage = (mgr === 'Rejected' || dir === 'Rejected') ? 'Rejected'
    : (mgr === 'Confirmed' ? (dir === 'Confirmed' ? 'Confirmed' : 'Pending-Manager') : 'Pending-Admin');
  const label = {
    'Pending-Admin':   'រង់ចាំ Admin',
    'Pending-Manager': 'រង់ចាំ Manager',
    'Confirmed':       'បានបញ្ជាក់'
  }[stage];
  const icon = {
    'Pending-Admin':   'hourglass-split',
    'Pending-Manager': 'hourglass-split',
    'Confirmed':       'patch-check'
  }[stage];
  const cls = stage === 'Confirmed' ? 'ok' : stage === 'Rejected' ? 'nok' : 'pending';
  return { stage: stage, label: label, icon: icon, cls: cls };
}

function buildDailyConfirmSection(s) {
  const isManagerRole = (currentUser.role === 'manager');
  const isAdminRole = (currentUser.role === 'admin');
  const mgrStatus = s.confirmStatus || 'Pending';
  const dirStatus = s.directorStatus || '';
  const ci = dailyConfirmInfo(s);
  const stage = ci.stage;
  const stageLabel = ci.label;
  const stageCls = ci.cls;
  const border = stage === 'Confirmed' ? '#198754' : stage === 'Rejected' ? '#dc3545' : '#0dcaf0';

  let statusLines = '';

  // Only show detailed Admin & Manager info when fully Confirmed (or Rejected)
  if (stage === 'Confirmed' || stage === 'Rejected') {
    statusLines += 
      '<div class="small mb-1"><i class="bi bi-person-check me-1"></i>Admin: <strong>' +
        esc(mgrStatus === 'Pending' ? 'រង់ចាំ' : mgrStatus) + '</strong>' +
        (s.confirmedByName ? ' · ' + esc(s.confirmedByName) : '') + 
        (s.confirmedAt ? ' · ' + esc(s.confirmedAt) : '') + 
      '</div>';
    if (s.confirmRemark) {
      statusLines += '<div class="small text-muted mb-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(s.confirmRemark) + '</div>';
    }

    statusLines += 
      '<div class="small mb-1"><i class="bi bi-patch-check me-1"></i>Manager: <strong>' +
        esc(dirStatus || 'រង់ចាំ') + '</strong>' +
        (s.directorByName ? ' · ' + esc(s.directorByName) : '') + 
        (s.directorAt ? ' · ' + esc(s.directorAt) : '') + 
      '</div>';
    if (s.directorRemark) {
      statusLines += '<div class="small text-muted mb-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(s.directorRemark) + '</div>';
    }
  }

  let html = '<div class="card mb-3 confirm-box" style="border-left:4px solid ' + border + ';">' +
    '<div class="group-header d-flex justify-content-between align-items-center" style="background:transparent;border-bottom:1px solid var(--border-color);">' +
      '<span><i class="bi bi-patch-check me-2 text-info"></i>ការបញ្ជាក់</span>' +
      '<span class="status-badge status-' + stageCls + '">' + esc(stageLabel) + '</span>' +
    '</div><div class="card-body">' +
    statusLines;

  // Action buttons / Waiting messages (no "Locked" message for completed)
  if (stage === 'Pending-Admin' && isAdminRole) {
    html += '<button class="btn btn-sm btn-outline-primary w-100 mt-1" onclick="renderDailyConfirmInput(\'' + escAttr(s.checkId) + '\',\'admin\')"><i class="bi bi-pencil-square me-1"></i>Confirm</button>';
  } else if (stage === 'Pending-Manager' && isManagerRole) {
    html += '<button class="btn btn-sm btn-success w-100 mt-1" onclick="renderDailyConfirmInput(\'' + escAttr(s.checkId) + '\',\'manager\')"><i class="bi bi-check-circle me-1"></i>Confirm</button>';
  } else if (stage === 'Pending-Admin') {
    html += '<div class="small text-muted mt-1"><i class="bi bi-hourglass-split me-1"></i>Waiting for Admin</div>';
  } else if (stage === 'Pending-Manager') {
    html += '<div class="small text-muted mt-1"><i class="bi bi-hourglass-split me-1"></i>Waiting for Manager</div>';
  }
  // No "Locked" message shown for Confirmed/Rejected stages

  html += '</div></div>';
  return html;
}

window.renderDailyConfirmInput = function(checkId, role) {
  const s = (APP.dailySubmissions || []).find(x => x.checkId === checkId);
  if (!s) return;
  
  let html = '';
  html += '<div class="card mb-3 confirm-box"><div class="group-header"><span><i class="bi bi-' + (role === 'admin' ? 'person-check' : 'patch-check') + ' me-2"></i>' + (role === 'admin' ? 'Admin' : 'Manager') + ' Confirm</span></div><div class="card-body">';
  html += '<textarea class="form-control form-control-sm mb-2" id="dailyConfirmRemarkInput" rows="2" placeholder="Remark (optional)...">' + esc(role === 'admin' ? (s.confirmRemark || '') : (s.directorRemark || '')) + '</textarea>';
  html += '<div class="d-flex gap-2 flex-wrap">';
  html += '<button class="btn btn-sm btn-success flex-fill" onclick="saveDailyConfirm(\'' + escAttr(checkId) + '\', \'' + role + '\')"><i class="bi bi-check-circle me-1"></i>Confirm</button>';
  html += '<button class="btn btn-sm btn-outline-secondary" onclick="viewDailyCheck(\'' + escAttr(checkId) + '\')">Cancel</button>';
  html += '</div></div></div>';

  $('#modalBody').html('<div class="p-3">' + html + '</div>');
};

window.saveDailyConfirm = function(checkId, role) {
  const remark = $('#dailyConfirmRemarkInput').val() || '';
  showLoading('កំពុងរក្សាទុក...');
  
  google.script.run.withSuccessHandler(res => {
    hideLoading();
    if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
    
    const s = APP.dailySubmissions.find(x => x.checkId === checkId);
    if (s) {
      if (role === 'manager') {
        s.directorStatus = 'Confirmed';
        s.directorBy = currentUser.username;
        s.directorAt = dmyToday() + ' ' + nowTimeStr();
        s.directorRemark = remark;
      } else {
        s.confirmStatus = 'Confirmed';
        s.confirmedBy = currentUser.username;
        s.confirmedAt = dmyToday() + ' ' + nowTimeStr();
        s.confirmRemark = remark;
      }
    }
    
    showAlert('បានបញ្ជាក់', 'success');
    if (s) renderDailyDetailModal(s);
    refreshCurrentPage();
  }).withFailureHandler(handleError).confirmDailySubmission({
    checkId: checkId,
    managerUsername: currentUser.username,
    status: 'Confirmed',
    remark: remark,
    role: role
  });
};

window.filterDailyDetailItems = function(status) {
  const isSame = (dailyDetailFilter === status);
  dailyDetailFilter = isSame ? 'all' : status;
  $('.stat-card[data-filter]').removeClass('active');
  if (dailyDetailFilter !== 'all') $('.stat-card[data-filter="'+dailyDetailFilter+'"]').addClass('active');
  let shown = 0;
  $('#dailyDetailItemsList .check-item').each(function(){
    const s = $(this).data('status');
    if (dailyDetailFilter === 'all' || s === dailyDetailFilter) { $(this).show(); shown++; }
    else $(this).hide();
  });
  $('#detailItemCount').text(shown + ' shown');
};

/* =========================================================
   DAILY DASHBOARD & MANAGEMENT
   ========================================================= */
window.renderDailyDashboard = function() {
  if (!APP.loaded) { bootLoad(); return; }
  if (currentUser.role === 'driver') { showPage('home'); return; }

  const subTabBar = '<div class="tab-bar mb-3" style="border-radius:10px;"><div class="tab ' + (dailyDashboardSubTab === 'overview' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setDailyDashboardSubTab(\'overview\')"><i class="bi bi-bar-chart me-1"></i>Dashboard</div><div class="tab ' + (dailyDashboardSubTab === 'mtn' ? 'active' : '') + '" style="flex:1;text-align:center;" onclick="setDailyDashboardSubTab(\'mtn\')"><i class="bi bi-wrench-adjustable me-1"></i>Daily Management</div></div>';
  
  if (dailyDashboardSubTab === 'mtn') { renderDailyManagement(subTabBar); return; }

  const subs = APP.dailySubmissions || [];
  const todaySubs = subs.filter(s => isToday(s.date));
  const issues = subs.filter(s => s.overall === 'Issues');
  const pending = subs.filter(s => (s.confirmStatus || 'Pending') === 'Pending');

  // 1. Build Need Attention Map (Pending Issues)
  const attentionMap = {};
  subs.forEach(s => {
    if ((s.confirmStatus || 'Pending') !== 'Pending') return; // Only pending ones
    
    const tplMap = {};
    (APP.dailyTemplates[s.group] || []).forEach(t => { tplMap[t.itemId] = t; });

    (s.checks || []).forEach(c => {
      if (c.status === 'nok') {
        const tpl = tplMap[c.itemId] || {};
        const kh = tpl.itemKhmer || c.itemId;
        const en = tpl.itemEng || '';
        const key = (en || kh || c.itemId).toLowerCase();

        if (!attentionMap[key]) {
          attentionMap[key] = { key, kh, en, count: 0, itemIds: new Set() };
        }
        attentionMap[key].count++;
        attentionMap[key].itemIds.add(c.itemId);
      }
    });
  });

  const attentionList = Object.values(attentionMap).sort((a, b) => b.count - a.count);
  const attentionSlice = needAttentionViewAllDaily ? attentionList : attentionList.slice(0, 10);
  
  let needAttentionHtml = '';
  if (attentionList.length > 0) {
    const rows = attentionSlice.map(it => 
      '<div class="issue-row" onclick="goToDailyMtnFiltered(\'' + escAttr(Array.from(it.itemIds).join(',')) + '\',\'' + escAttr(it.en || it.kh) + '\', true)">' +
        '<span class="rank text-danger"><i class="bi bi-wrench-adjustable"></i></span>' +
        '<div class="name">'+esc(it.kh)+'<small>'+esc(it.en)+'</small></div>' +
        '<span class="count text-danger">'+it.count+'×</span>' +
      '</div>'
    ).join('');
    
    let moreBtn = '';
    if (attentionList.length > 10) {
      moreBtn = needAttentionViewAllDaily
        ? '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-danger" onclick="needAttentionViewAllDaily = false; renderDailyDashboard();">Show Less</button></div>'
        : '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-danger" onclick="needAttentionViewAllDaily = true; renderDailyDashboard();">View All (' + attentionList.length + ')</button></div>';
    }

    needAttentionHtml = `
      <div class="card mb-3 border-danger" style="border-width: 2px;">
        <div class="group-header bg-danger text-white d-flex justify-content-between align-items-center">
          <span><i class="bi bi-exclamation-octagon-fill me-2"></i>Need Attention (Pending Issues)</span>
          <span class="badge bg-white text-danger">${attentionList.length} items</span>
        </div>
        <div class="card-body p-2">
          ${rows}
          ${moreBtn}
        </div>
      </div>
    `;
  }

  // 2. Build Top Issues Map (All Issues)
  const issueMap = {};
  subs.forEach(s => { 
    (s.checks || []).forEach(c => { 
      if (c.status === 'nok') { 
        let nameKh = c.itemId, nameEn = '';
        Object.keys(APP.dailyTemplates).forEach(g => {
          const t = (APP.dailyTemplates[g] || []).find(x => x.itemId === c.itemId);
          if (t) { nameKh = t.itemKhmer; nameEn = t.itemEng; }
        });
        const key = (nameEn || nameKh || c.itemId).toLowerCase();
        if (!issueMap[key]) issueMap[key] = { key: key, kh: nameKh, en: nameEn, itemIds: new Set(), count: 0 };
        issueMap[key].itemIds.add(c.itemId);
        issueMap[key].count++;
      } 
    }); 
  });

  const topIssues = Object.values(issueMap).map(x => ({ key: x.key, kh: x.kh, en: x.en, itemIdsCsv: Array.from(x.itemIds).join(','), count: x.count })).sort((a, b) => b.count - a.count);
  const topIssuesSlice = topIssuesViewAllDaily ? topIssues : topIssues.slice(0, 10);
  
  let topIssuesHtml = '';
  if (topIssues.length > 0) {
    const rows = topIssuesSlice.map((it, i) => 
      '<div class="issue-row" onclick="goToDailyMtnFiltered(\'' + escAttr(it.itemIdsCsv) + '\',\'' + escAttr(it.en || it.kh) + '\', false)">' +
        '<span class="rank">'+(i+1)+'</span>' +
        '<div class="name">'+esc(it.kh)+'<small>'+esc(it.en)+'</small></div>' +
        '<span class="count">'+it.count+'×</span>' +
      '</div>'
    ).join('');
    
    let moreBtn = '';
    if (topIssues.length > 10) {
      moreBtn = topIssuesViewAllDaily
        ? '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-primary" onclick="topIssuesViewAllDaily = false; renderDailyDashboard();">Show Less</button></div>'
        : '<div class="text-center mt-2"><button class="btn btn-sm btn-outline-primary" onclick="topIssuesViewAllDaily = true; renderDailyDashboard();">View All (' + topIssues.length + ')</button></div>';
    }

    topIssuesHtml = `
      <div class="card mb-3">
        <div class="group-header"><i class="bi bi-exclamation-triangle-fill me-2 text-danger"></i>Top Issues</div>
        <div class="card-body p-2">
          ${rows}
          ${moreBtn}
        </div>
      </div>
    `;
  }

  // 3. Timeline
  const last7 = []; const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const dStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    const dLabel = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    const daySubs = subs.filter(s => s.date === dStr);
    last7.push({ label: dLabel, total: daySubs.length, ok: daySubs.filter(s => s.overall === 'OK').length, nok: daySubs.filter(s => s.overall === 'Issues').length, isoDate: isoDate(d) });
  }
  const maxDay = Math.max(1, ...last7.map(x => x.total));
  const timelineHtml = '<div class="card mb-3"><div class="group-header"><i class="bi bi-calendar-week me-2"></i>Last 7 Days</div><div class="card-body">' + last7.map(x => { const w = Math.round(x.total / maxDay * 100); const okW = x.total ? Math.round(x.ok / x.total * w) : 0; const nokW = x.total ? Math.round(x.nok / x.total * w) : 0; return '<div class="timeline-row clickable-card" onclick="drillToDaily({dateFrom:\''+x.isoDate+'\',dateTo:\''+x.isoDate+'\',status:\'all\'})"><span class="day">'+esc(x.label)+'</span><div class="track" style="width:'+Math.max(w,2)+'%;"><div class="seg-ok" style="width:'+okW+'%;"></div><div class="seg-nok" style="width:'+nokW+'%;"></div></div><span class="count">'+x.total+'</span></div>'; }).join('') + '</div></div>';

  // 4. By Group
  const groupsWithData = APP.filterOptions.groups; const maxGroup = Math.max(1, ...groupsWithData.map(g => subs.filter(s => s.group === g).length));
  const groupHtml = groupsWithData.length > 1 ? '<div class="card mb-3"><div class="group-header"><i class="bi bi-diagram-3 me-2"></i>By Group</div><div class="card-body">' + groupsWithData.map(g => { const gSubs = subs.filter(s => s.group === g); const gIssues = gSubs.filter(s => s.overall === 'Issues').length; const pct = Math.round(gSubs.length / maxGroup * 100); return '<div class="dash-bar clickable-card" onclick="drillToDaily({group:\''+escAttr(g)+'\',status:\'all\',dateFrom:\'\',dateTo:\'\'})"><span class="lbl">'+esc(g)+'</span><div class="track"><div class="fill" style="width:'+pct+'%;background:'+(gIssues>0?'#dc3545':'#0d6efd')+'"></div></div><span class="val">'+gSubs.length+'</span></div>'; }).join('') + '</div></div>' : '';

  // 5. Recent Activity
  const recent = subs.slice().sort((a, b) => subMs(b) - subMs(a)).slice(0, 6);
  const recentHtml = recent.length > 0 ? '<div class="card mb-3"><div class="group-header"><i class="bi bi-clock-history me-2"></i>Recent Activity</div><div class="card-body p-0">' + recent.map(s => '<div class="activity-row" onclick="viewDailyCheck(\''+escAttr(s.checkId)+'\')"><span class="dot '+(s.overall === 'Issues' ? 'nok' : 'ok')+'"></span><div class="info"><strong>'+esc(eqShort(s.equipmentId))+'</strong> · '+esc(s.driverName)+'<small>'+esc(s.group)+' · '+esc(s.checkId)+'</small></div><span class="time">'+esc(s.time)+'</span></div>').join('') + '</div></div>' : '';

  // 6. Summary
  const resetParams = "status:'all',checkType:'all',confirmStatus:'all',opStatus:'all',group:'all',driver:'all',equipmentId:'all'";
  const summaryTile = (count, color, label, params) =>
    '<div class="col-6 col-md-3"><div class="stat-card clickable-card" onclick="drillToDaily({' + params + '})">' +
      '<div class="num text-' + color + '">' + count + '</div><div class="lbl">' + label + '</div></div></div>';
  const summaryHtml = '<div class="row g-2 mb-3">' +
    summaryTile(subs.length, 'primary', 'សរុប', resetParams + ",dateFrom:'',dateTo:''") +
    summaryTile(todaySubs.length, 'info', 'ថ្ងៃនេះ', resetParams + ",dateFrom:'" + isoToday() + "',dateTo:'" + isoToday() + "'") +
    summaryTile(pending.length, 'warning', 'រង់ចាំ Admin', resetParams + ",confirmStatus:'Pending-Admin',dateFrom:'',dateTo:''") +
    summaryTile(issues.length, 'danger', 'Issues', resetParams + ",status:'Issues',dateFrom:'',dateTo:''") +
  '</div>';

  // 7. Live shift board — Operating / Stand By / Waiting Handover / Handed Over
  const shiftSubs = dailyShiftOnly(subs);
  const latestByEq = {};
  shiftSubs.forEach(s => {
    const cur = latestByEq[s.equipmentId];
    if (!cur || subMs(s) > subMs(cur)) latestByEq[s.equipmentId] = s;
  });
  const opCount = { operating: 0, standby: 0, waiting: 0, handed: 0, none: 0 };
  (APP.equipment || []).forEach(e => {
    const s = latestByEq[e.equipmentId];
    if (!s) { opCount.none++; return; }
    const op = dailyNormOp(s.opStatus);
    if (op === DAILY_OP_OPERATING) opCount.operating++;
    else if (op === DAILY_OP_STANDBY) opCount.standby++;
    else if (op === DAILY_OP_WAITING) opCount.waiting++;
    else if (op === DAILY_OP_HANDED) opCount.handed++;
    else opCount.none++;
  });
  const totalUnits = Math.max(1, (APP.equipment || []).length);
  const opsRows = [
    { label: 'Operating',        icon: 'bi-play-circle-fill',  color: '#198754', count: opCount.operating },
    { label: 'Stand By',         icon: 'bi-pause-circle-fill', color: '#ffc107', count: opCount.standby },
    { label: 'Waiting Handover', icon: 'bi-hourglass-split',   color: '#0d6efd', count: opCount.waiting },
    { label: 'Handed Over',      icon: 'bi-check2-circle',     color: '#6c757d', count: opCount.handed },
    { label: 'Not started',      icon: 'bi-dash-circle',       color: '#adb5bd', count: opCount.none }
  ].map(r => {
    const pct = Math.round(r.count / totalUnits * 100);
    const drill = "drillToDaily({opStatus:'" + (r.label === 'Not started' ? 'none' : r.label) + "',status:'all',checkType:'all',confirmStatus:'all',dateFrom:'',dateTo:'',group:'all',driver:'all',equipmentId:'all'})";
    return '<div class="dash-bar mb-2 clickable-card" onclick="' + drill + '"><span class="lbl"><i class="bi ' + r.icon + ' me-1" style="color:' + r.color + ';"></i>' + r.label + '</span>' +
      '<div class="track"><div class="fill" style="width:' + pct + '%;background:' + r.color + ';"></div></div>' +
      '<span class="val">' + r.count + '</span></div>';
  }).join('');
  const opsHtml = '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center">' +
      '<span><i class="bi bi-activity me-2"></i>Shift Status</span>' +
      '<span class="badge bg-primary">' + (APP.equipment || []).length + ' units</span></div>' +
      '<div class="card-body">' + opsRows + '</div></div>';


  // 8. Weekly (7-day) check compliance
  const weeklyList = (APP.equipment || []).map(e => ({ eq: e, info: dailyWeeklyInfo(e.equipmentId) }));
  const weeklyDue  = weeklyList.filter(x => x.info.due);
  const weeklyDone = weeklyList.filter(x => !x.info.due);
  const weeklyPct  = weeklyList.length ? Math.round(weeklyDone.length / weeklyList.length * 100) : 0;
  const weeklyRows = weeklyDue.slice(0, 8).map(x => {
    const eq = x.eq;
    return '<div class="driver-status-row clickable-card" onclick="drillToDaily({equipmentId:\'' + escAttr(eq.equipmentId) + '\',checkType:\'weekly\',status:\'all\',dateFrom:\'\',dateTo:\'\'})">' +
      '<div class="left"><i class="bi bi-exclamation-circle text-warning" style="font-size:1.1rem;"></i>' +
        '<div><div class="name">' + esc(eq.shortName || eq.equipmentId) + '</div>' +
        '<div class="eqs">' + (x.info.never ? 'never done' : 'last ' + esc(x.info.last.date)) + ' · ' + esc(eq.group || '—') + '</div></div></div>' +
      '<div><span class="badge bg-warning text-dark">due</span></div></div>';
  }).join('');
  const weeklyHtml = '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center">' +
      '<span><i class="bi bi-calendar-week me-2 text-info"></i>Weekly Check (every ' + dailyWeekDays() + ' days)</span>' +
      '<span class="badge bg-' + (weeklyDue.length ? 'warning text-dark' : 'success') + '">' + weeklyDone.length + '/' + weeklyList.length + ' (' + weeklyPct + '%)</span></div>' +
      '<div class="card-body py-2">' +
        '<div class="dash-bar mb-2"><div class="track"><div class="fill" style="width:' + weeklyPct + '%;background:' + (weeklyDue.length ? '#ffc107' : '#198754') + ';"></div></div><span class="val">' + weeklyPct + '%</span></div>' +
        (weeklyDue.length
          ? '<div class="small text-warning mb-1"><i class="bi bi-exclamation-circle me-1"></i>Due (' + weeklyDue.length + ')</div>' + weeklyRows
          : '<div class="small text-success"><i class="bi bi-check2-circle me-1"></i>All equipment checked this week</div>') +
      '</div></div>';


  $('#app').html('<div class="container-fluid px-0"><div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0"><i class="bi bi-bar-chart me-2"></i>Daily Dashboard</h5><small class="text-muted">'+esc(currentUser.group === 'ALL' ? 'All groups' : currentUser.group)+'</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'dashboard\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + subTabBar + summaryHtml + opsHtml + weeklyHtml + needAttentionHtml + topIssuesHtml + timelineHtml + groupHtml + recentHtml + '</div>');
};

window.setDailyDashboardSubTab = function(tab){ 
  dailyDashboardSubTab = tab; 
  if (tab === 'overview') {
     needAttentionViewAllDaily = false;
     topIssuesViewAllDaily = false;
  }
  renderDailyDashboard(); 
};

window.goToDailyMtnFiltered = function(itemIds, label, isUrgentOnly) {
  dailyDashboardSubTab = 'mtn';
  dailyMtnFilter = isUrgentOnly ? 'pending' : 'all';
  dailyMtnItemFilter = String(itemIds).split(',').map(s => s.trim()).filter(Boolean);
  dailyMtnItemLabel = label;
  dailyMtnIsUrgentOnly = isUrgentOnly;
  renderDailyDashboard();
};

window.clearDailyMtnItemFilter = function() {
  dailyMtnItemFilter = null;
  dailyMtnItemLabel = '';
  renderDailyDashboard(); // <-- FIXED: Render the dashboard instead of passing HTML element
};

window.setDailyMtnFilter = function(f){ 
  dailyMtnFilter = f; 
  dailyMtnDisplayLimit = 10; 
  renderDailyDashboard(); 
};

window.loadMoreDailyMtn = function() {
  dailyMtnDisplayLimit += 10;
  renderDailyDashboard(); // <-- FIXED: Render the dashboard instead of passing HTML element
};

function getDailyIssueItems(sub){
  const tplMap = {}; (APP.dailyTemplates[sub.group] || []).forEach(t => { tplMap[t.itemId] = t; });
  const mtnItems = sub.mtnItems || {};
  return (sub.checks || []).filter(c => c.status === 'nok').map(c => { 
    const t = tplMap[c.itemId] || {}; 
    const m = mtnItems[c.itemId] || {}; 
    return { itemId: c.itemId, code: c.status, location: '', note: c.note || '', itemKhmer: t.itemKhmer || c.itemId, itemEng: t.itemEng || '', mtnStatus: m.status === 'Completed' ? 'Completed' : 'Pending', mtnBy: m.by || '', mtnAt: m.at || '', mtnRemark: m.remark || '' }; 
  }).sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
}

function dailyMtnRollup(sub){
  const items = getDailyIssueItems(sub); if (items.length === 0) return '';
  const fixed = items.filter(i => i.mtnStatus === 'Completed').length;
  if (fixed === 0) return 'Pending'; if (fixed === items.length) return 'Completed'; return 'Partial';
}

function renderDailyManagement(subTabBar){
  let issues = (APP.dailySubmissions || []).filter(s => s.overall === 'Issues').sort((a, b) => subMs(b) - subMs(a));
  
  if (dailyMtnItemFilter && dailyMtnItemFilter.length > 0) {
     issues = issues.filter(sub => {
        return (sub.checks || []).some(c => {
           if (!dailyMtnItemFilter.includes(c.itemId)) return false;
           if (dailyMtnIsUrgentOnly) {
               return c.status === 'nok' && (!(sub.mtnItems || {})[c.itemId] || sub.mtnItems[c.itemId].status !== 'Completed');
           } else {
               return c.status === 'nok';
           }
        });
     });
  }

  const pendingList   = issues.filter(s => dailyMtnRollup(s) === 'Pending');
  const partialList   = issues.filter(s => dailyMtnRollup(s) === 'Partial');
  const completedList = issues.filter(s => dailyMtnRollup(s) === 'Completed');
  const cardCls = (f) => 'stat-card clickable-card' + (dailyMtnFilter === f ? ' active' : '');

  const issueRow = (sub, item) => {
    const isFixed = item.mtnStatus === 'Completed'; const badgeCls = isFixed ? 'ok' : 'pending'; const badgeTxt = isFixed ? 'Fixed' : 'Pending';
    let statusLine = '';
    if (isFixed) statusLine = '<div class="small text-success mt-1"><i class="bi bi-check-circle-fill me-1"></i>Fixed by <strong>' + esc(item.mtnBy || '—') + '</strong>' + (item.mtnAt ? ' · ' + esc(item.mtnAt) : '') + '</div>' + (item.mtnRemark ? '<div class="small mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(item.mtnRemark) + '</div>' : '');
    else if (item.note) statusLine = '<div class="small text-muted mt-1"><i class="bi bi-chat-left-text me-1"></i>' + esc(item.note) + '</div>';
    
    const actionBtn = isFixed 
      ? '<button class="btn btn-outline-secondary" style="padding: 2px 8px; font-size: 0.7rem;" onclick="event.stopPropagation();reopenDailyIssueItem(\'' + escAttr(sub.checkId) + '\',\'' + escAttr(item.itemId) + '\')"><i class="bi bi-arrow-counterclockwise" style="font-size: 0.75rem;"></i> Reopen</button>' 
      : '<button class="btn btn-success" style="padding: 2px 8px; font-size: 0.7rem;" onclick="event.stopPropagation();markDailyIssueItemFixed(\'' + escAttr(sub.checkId) + '\',\'' + escAttr(item.itemId) + '\')"><i class="bi bi-tools" style="font-size: 0.75rem;"></i> Mark Fixed</button>';

    return '<div class="p-2 mb-2" style="background:var(--bg-color);border-radius:8px;' + (isFixed ? 'opacity:.85;' : '') + '"><div class="d-flex align-items-center justify-content-between gap-2 flex-wrap"><div class="flex-grow-1" style="min-width: 200px;"><div class="fw-semibold small" style="line-height:1.25;"><span class="badge bg-danger me-1" style="font-size:.65rem;">' + esc(item.code) + '</span>' + esc(item.itemKhmer) + '</div>' + (item.itemEng ? '<div class="small text-muted" style="font-size:.7rem;">' + esc(item.itemEng) + '</div>' : '') + statusLine + '</div><div class="text-center"><span class="status-badge status-' + badgeCls + '" style="font-size:.65rem;min-width:auto;padding:2px 8px;">' + badgeTxt + '</span></div><div class="text-end">' + actionBtn + '</div></div></div>';
  };

  const cardRenderer = (sub) => {
    const eq = APP.equipmentMap[sub.equipmentId] || {}; const items = getDailyIssueItems(sub); const fixed = items.filter(i => i.mtnStatus === 'Completed').length; const roll = dailyMtnRollup(sub);
    let rollBadgeCls = 'pending'; let rollTxt = 'Pending';
    if (roll === 'Completed') { rollBadgeCls = 'ok'; rollTxt = 'Completed'; } if (roll === 'Partial') { rollBadgeCls = 'pending'; rollTxt = 'Partial ' + fixed + '/' + items.length; }
    const allFixed = fixed === items.length && items.length > 0;
    
    let displayItems = items;
    if (dailyMtnItemFilter && dailyMtnItemFilter.length > 0) {
       displayItems = items.filter(i => {
           if (!dailyMtnItemFilter.includes(i.itemId)) return false;
           if (dailyMtnIsUrgentOnly) return i.code === 'nok';
           return true;
       });
    }

    return '<div class="card mb-3"><div class="group-header d-flex justify-content-between align-items-center"><span><i class="bi bi-truck text-primary me-2"></i><strong>' + esc(eq.shortName || sub.equipmentId) + '</strong> <span class="text-muted small ms-2">(' + esc(sub.date) + ')</span></span><span class="status-badge status-' + rollBadgeCls + '">' + esc(rollTxt) + '</span></div><div class="card-body py-2"><div class="small mb-1"><i class="bi bi-tag me-1 text-muted"></i>' + esc(sub.group) + ' · <i class="bi bi-calendar me-1 text-muted ms-2"></i>' + esc(sub.date) + ' ' + esc(sub.time) + '</div><div class="small mb-2"><i class="bi bi-person me-1 text-muted"></i>Driver: ' + esc(sub.driverName || sub.username) + '</div><div class="small text-danger fw-semibold mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>Issues (' + fixed + ' of ' + items.length + ' fixed)</div>' + displayItems.map(it => issueRow(sub, it)).join('') + '<div class="d-flex gap-2 mt-3"><button class="btn btn-sm btn-outline-primary flex-fill" onclick="viewDailyCheck(\'' + escAttr(sub.checkId) + '\')"><i class="bi bi-eye me-1"></i>View Checklist</button>' + (!allFixed ? '<button class="btn btn-sm btn-success flex-fill" onclick="markAllDailyIssuesFixed(\'' + escAttr(sub.checkId) + '\')"><i class="bi bi-check2-all me-1"></i>Fix All</button>' : '') + '</div></div></div>';
  };

  let visible = issues;
  if (dailyMtnFilter === 'pending') visible = pendingList.concat(partialList);
  if (dailyMtnFilter === 'partial') visible = partialList;
  if (dailyMtnFilter === 'completed') visible = completedList;

  const visibleSlice = visible.slice(0, dailyMtnDisplayLimit);
  
  const listHtml = visibleSlice.length ? visibleSlice.map(cardRenderer).join('') : '<p class="text-muted small text-center py-4">' + (dailyMtnFilter === 'pending' ? '✓ No pending issues — great work!' : 'No data') + '</p>';

  let loadMoreHtml = '';
  if (visible.length > dailyMtnDisplayLimit) {
    const remaining = visible.length - dailyMtnDisplayLimit;
    loadMoreHtml = '<div class="text-center" style="padding-bottom: 120px; margin-top: 20px;"><button class="btn btn-outline-primary" onclick="loadMoreDailyMtn()"><i class="bi bi-arrow-down-circle me-1"></i> Load More (' + remaining + ' remaining)</button></div>';
  } else {
    loadMoreHtml = '<div style="padding-bottom: 120px;"></div>';
  }

  let filterChip = '';
  if (dailyMtnItemFilter && dailyMtnItemFilter.length > 0) {
    filterChip = `
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="badge bg-danger d-flex align-items-center gap-1" style="font-size:.8rem;padding:6px 10px;">
          <i class="bi bi-funnel-fill"></i> Filtering by: ${esc(dailyMtnItemLabel)}
          <span onclick="clearDailyMtnItemFilter()" style="cursor:pointer;margin-left:6px;font-weight:700;">✕</span>
        </span>
      </div>
    `;
  }

  $('#app').html('<div class="container-fluid px-0"><div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-0"><i class="bi bi-wrench-adjustable me-2"></i>Daily Management</h5><small class="text-muted">' + esc(currentUser.group === 'ALL' ? 'All groups' : currentUser.group) + '</small></div><button class="btn btn-sm btn-outline-secondary" onclick="reloadAll(\'dashboard\')"><i class="bi bi-arrow-repeat"></i><span class="last-sync-text" style="font-size: 0.75rem; min-width: 55px; margin-left: 4px;">--:--:--</span></button></div>' + subTabBar + filterChip +
    '<div class="row g-2 mb-3"><div class="col-3"><div class="' + cardCls('pending') + '" onclick="setDailyMtnFilter(\'pending\')"><div class="num text-warning">' + pendingList.length + '</div><div class="lbl">Pending</div></div></div><div class="col-3"><div class="' + cardCls('partial') + '" onclick="setDailyMtnFilter(\'partial\')"><div class="num text-info">' + partialList.length + '</div><div class="lbl">Partial</div></div></div><div class="col-3"><div class="' + cardCls('completed') + '" onclick="setDailyMtnFilter(\'completed\')"><div class="num text-success">' + completedList.length + '</div><div class="lbl">Completed</div></div></div><div class="col-3"><div class="' + cardCls('all') + '" onclick="setDailyMtnFilter(\'all\')"><div class="num text-primary">' + issues.length + '</div><div class="lbl">All</div></div></div></div>' +
    '<h6 class="mb-2"><i class="bi bi-list-check text-primary me-2"></i>' + (dailyMtnFilter === 'pending' ? 'To Fix (' + (pendingList.length + partialList.length) + ')' : dailyMtnFilter === 'partial' ? 'In Progress (' + partialList.length + ')' : dailyMtnFilter === 'completed' ? 'Completed (' + completedList.length + ')' : 'All Issue Checklists (' + issues.length + ')') + '</h6>' + listHtml + loadMoreHtml + '</div>');
}

function _applyLocalDailyItemUpdate(checkId, itemId, status, remark){
  const sub = APP.dailySubmissions.find(x => x.checkId === checkId); if (!sub) return;
  if (!sub.mtnItems) sub.mtnItems = {};
  if (status === 'Completed') sub.mtnItems[itemId] = { status: 'Completed', by: currentUser.username, at: dmyToday() + ' ' + nowTimeStr(), remark: remark || '' };
  else delete sub.mtnItems[itemId];
  sub.mtnStatus = dailyMtnRollup(sub);
}

window.markDailyIssueItemFixed = function(checkId, itemId){
  askRemark({ title: 'Mark Item Fixed', label: 'បញ្ជាក់ការជួសជុល / Remark (optional):', placeholder: 'បានជួសជុលរួច...' }, function(remark){
    if (remark === null) return;
    showLoading('កំពុងរក្សាទុក...');
    google.script.run.withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
      _applyLocalDailyItemUpdate(checkId, itemId, 'Completed', remark);
      showAlert('កត់ត្រាថាជួសជុលរួច', 'success'); renderDailyDashboard();
    }).withFailureHandler(handleError).resolveDailyIssueItem({ checkId: checkId, itemId: itemId, username: currentUser.username, status: 'Completed', remark: remark });
  });
};

window.reopenDailyIssueItem = function(checkId, itemId){
  askRemark({ title: 'Reopen Issue', label: 'Reason for reopening (optional):', placeholder: 'មូលហេតុ...' }, function(remark){
    if (remark === null) return;
    showLoading('កំពុងរក្សាទុក...');
    google.script.run.withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
      _applyLocalDailyItemUpdate(checkId, itemId, 'Pending', '');
      showAlert('បានបើកបញ្ហាឡើងវិញ', 'warning'); renderDailyDashboard();
    }).withFailureHandler(handleError).resolveDailyIssueItem({ checkId: checkId, itemId: itemId, username: currentUser.username, status: 'Pending', remark: '' });
  });
};

window.markAllDailyIssuesFixed = function(checkId){
  const sub = APP.dailySubmissions.find(x => x.checkId === checkId); if (!sub) return;
  const items = getDailyIssueItems(sub).filter(i => i.mtnStatus !== 'Completed'); if (items.length === 0) return;
  askRemark({ title: 'Mark All Fixed', label: 'សម្គាល់ទាំង ' + items.length + ' បញ្ហាថាជួសជុលរួច? / Remark (optional):', placeholder: 'បានជួសជុលរួច...' }, function(remark){
    if (remark === null) return;
    showLoading('កំពុងរក្សាទុក...');
    google.script.run.withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) { showAlert((res && res.message) || 'Error', 'danger'); return; }
      items.forEach(i => _applyLocalDailyItemUpdate(checkId, i.itemId, 'Completed', remark));
      showAlert('បានកត់ត្រា ' + items.length + ' បញ្ហាថាជួសជុលរួច', 'success'); renderDailyDashboard();
    }).withFailureHandler(handleError).resolveDailyIssueItem({ checkId: checkId, username: currentUser.username, status: 'Completed', remark: remark });
  });
};

/* =========================================================
   MANAGE DRIVERS (Daily – Admin)
   Uses currentDetailModal (same pattern as openAssignDialog)
   ========================================================= */
window.openManageDrivers = function(){
  $('#modalActionButtons').addClass('d-none');
  $('#modalTitle').text('គ្រប់គ្រងអ្នកបើកបរ');
  $('#modalBody').html('<div class="p-3" id="manageDriversList"></div>');
  renderManageDriversList();
  currentDetailModal.show();
};

function renderManageDriversList(){
  const myGroup       = currentUser.group;
  const drivers       = (APP.users || []).filter(u =>
    u.role === 'driver' && (myGroup === 'ALL' || u.group === myGroup)
  );
  const groupEquipment = (APP.equipment || []).filter(e =>
    myGroup === 'ALL' || e.group === myGroup
  );

  if (drivers.length === 0) {
    $('#manageDriversList').html(
      '<div class="text-center text-muted py-4">' +
        '<i class="bi bi-person-x" style="font-size:2rem;opacity:.4;"></i>' +
        '<div class="mt-2 small">No drivers in this group</div>' +
      '</div>'
    );
    return;
  }

  const html = drivers.map(d => {
    const driverEqIds = (d.equipment || []).map(String);
    const currentNames = driverEqIds.map(id => {
      const e = groupEquipment.find(x => String(x.equipmentId) === id) || { equipmentId: id };
      return e.shortName || e.equipmentId || id;
    });

    // "New equipment" — one dropdown per driver (current assignment shown above)
    const options = ['<option value="">— គ្មាន / none —</option>']
      .concat(groupEquipment.map(e => {
        const id = String(e.equipmentId);
        const sel = (driverEqIds.length && driverEqIds[0] === id) ? ' selected' : '';
        const label = (e.shortName || id) + (myGroup === 'ALL' && e.group ? ' · ' + e.group : '');
        return '<option value="' + escAttr(id) + '"' + sel + '>' + esc(label) + '</option>';
      })).join('');

    return '<div class="card mb-2"><div class="card-body py-2">' +
      '<div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">' +
        '<strong><i class="bi bi-person-circle me-1"></i>' + esc(d.fullName) +
          ' <small class="text-muted">(@' + esc(d.username) + ')</small></strong>' +
        '<button class="btn btn-sm btn-outline-primary" ' +
          'onclick="saveDriverEquipment(\'' + escAttr(d.username) + '\')">' +
          '<i class="bi bi-check2 me-1"></i>Save</button>' +
      '</div>' +
      '<div class="small fw-bold mb-1">បច្ចុប្បន្ន · Current equipment:</div>' +
      '<div class="d-flex flex-wrap gap-1 mb-2">' +
        (currentNames.length
          ? currentNames.map(n => '<span class="badge bg-secondary">' + esc(n) + '</span>').join('')
          : '<em class="text-muted small">No equipment</em>') +
      '</div>' +
      '<div class="small fw-bold mb-1">ឧបករណ៍ថ្មី · New equipment:</div>' +
      '<select class="form-select form-select-sm driver-eq-select" data-driver="' + escAttr(d.username) + '">' +
        options + '</select>' +
    '</div></div>';
  }).join('');

  $('#manageDriversList').html(html);
}

window.saveDriverEquipment = function(username){
  const equipmentIds = [];
  const $sel = $('.driver-eq-select[data-driver="' + username + '"]');
  if ($sel.length) {
    const picked = $sel.val();
    if (picked) equipmentIds.push(picked);
  } else {
    // Legacy checkbox markup (kept as a fallback)
    $('.driver-eq-check[data-driver="' + username + '"]:checked').each(function(){
      equipmentIds.push($(this).val());
    });
  }

  showLoading('កំពុងរក្សាទុក...');
  google.script.run
    .withSuccessHandler(res => {
      hideLoading();
      if (!res || !res.success) {
        showAlert((res && res.message) || 'Error', 'danger');
        return;
      }
      showAlert('បានរក្សាទុកសម្រាប់ ' + username, 'success');

      // Mirror on local caches so dropdowns reflect the change
      const u = (APP.users  || []).find(x => x.username === username);
      if (u) u.equipment = equipmentIds.slice();
      const drv = (APP.drivers || []).find(x => x.username === username);
      if (drv) drv.equipment = equipmentIds.slice();
      // Repaint the modal so "Current equipment" shows the new value
      renderManageDriversList();
    })
    .withFailureHandler(handleError)
    .updateUserEquipment(username, equipmentIds);
};



/*ReportCore*/

function getCurrentReportSub(){
  const id = window.currentDetailCheckId;
  if (!id) { showAlert('No checklist selected', 'warning'); return null; }
  const sub = APP.submissions.find(x => x.checkId === id);
  if (!sub) { showAlert('Checklist not found', 'danger'); return null; }
  return sub;
}

function getRenderScale() {
  const MAX_CANVAS_W = 4096;
  const PAGE_W = 794;
  const maxSafe = MAX_CANVAS_W / PAGE_W;
  if (maxSafe >= 2)   return 2;
  if (maxSafe >= 1.5) return 1.5;
  return 1.25;
}

function detectForeignObjectSupport() {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const fo  = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    svg.appendChild(fo);
    let ok = 'outerHTML' in svg;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /OS ([0-9]|1[0-3])_/.test(ua)) ok = false;
    return ok;
  } catch (e) { return false; }
}

function snap2(px) {
  return Math.ceil(px);
}

/* ---------- Paginator Router ---------- */
async function paginateReport(sub) {
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('400 12px Hanuman'),
        document.fonts.load('700 12px Hanuman'),
        document.fonts.load('900 12px Hanuman'),
        document.fonts.load('400 11px Hanuman'),
      ]);
    } catch (e) {}
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 100));
  }

  const PAGE_W = 794, PAGE_H = 1123;
  const PAD_TOP = 30, PAD_BOTTOM = 15, PAD_X = 28;
  const FOOTER_H = 28;
  const CONTENT_W = PAGE_W - PAD_X * 2;
  const PAGE_CONTENT_H = PAGE_H - PAD_TOP - PAD_BOTTOM - FOOTER_H; // Base limit: 1050px
  const GAP = 6;

  const grp = String(sub.group || '').trim().toUpperCase();
  const isFCC = grp.includes('TCC') || grp.includes('FCC');
  const isRTG = grp.includes('RTG') || grp.includes('គ្រឿងចក្រ');
  
  // Force colgroup widths to override any inline <th> widths so measurement == render
  const overrideCSS = `.col-no, .col-items, .col-result, .col-side, .col-remark { width: auto !important; }`;
  
  const rawStyleContent = isFCC ? fccReportStyles().replace(/<\/?style[^>]*>/gi, '') : (isRTG ? rtgReportStyles().replace(/<\/?style[^>]*>/gi, '') : truckReportStyles().replace(/<\/?style[^>]*>/gi, ''));
  const measureStyleContent = rawStyleContent.replace(/@import\s+url\([^)]*\);?/gi, ''); // Strip @import for faster measurement
  
    const bodyHTML = isFCC ? buildFCCReportBody(sub) : (isRTG ? buildRTGReportBody(sub) : buildTruckReportBody(sub));

  const colgroupHTML = isFCC 
    ? '<colgroup><col style="width: 4%;"><col style="width: 42%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 34%;"></colgroup>'
    : (isRTG 
        ? '<colgroup><col style="width: 33%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 7%;"><col style="width: 33%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 7%;"></colgroup>'
        : '<colgroup><col style="width: 5%;"><col style="width: 45%;"><col style="width: 8%;"><col style="width: 8%;"><col style="width: 8%;"><col style="width: 26%;"></colgroup>');

  const hidden = document.createElement('div');
  hidden.style.cssText = 'position:fixed;top:0;left:-99999px;width:' + CONTENT_W + 'px;background:#fff;opacity:0;pointer-events:none;z-index:-1;';
  hidden.innerHTML = '<style>' + measureStyleContent + '</style>' + bodyHTML;
  document.body.appendChild(hidden);

  const reportRoot = hidden.querySelector('.report-container');
  if (!reportRoot) {
    document.body.removeChild(hidden);
    return { pages: [], styleContent: rawStyleContent, PAGE_W, PAGE_H, PAD_TOP, PAD_BOTTOM, PAD_X, CONTENT_W, PAGE_CONTENT_H, THEAD_H_MEASURED: 0, SCALE: getRenderScale(), FOREIGN_OBJECT_OK: detectForeignObjectSupport(), isFCC, colgroupHTML };
  }

  reportRoot.style.width      = CONTENT_W + 'px';
  reportRoot.style.minWidth   = CONTENT_W + 'px';
  reportRoot.style.maxWidth   = CONTENT_W + 'px';
  reportRoot.style.margin     = '0';
  reportRoot.style.fontFamily = "'Hanuman','Roboto Condensed','Roboto',Arial,sans-serif";

  const blocks = [];
  Array.from(reportRoot.children).forEach(child => {
    if (child.classList.contains('data-table')) {
      const thead = child.querySelector('thead');
      const theadHTML = thead ? thead.outerHTML : '';
      const rows = Array.from(child.querySelectorAll('tbody > tr'));
      let cur = null;
      rows.forEach(row => {
        const firstCell = row.children[0];
        const rowspan = firstCell ? parseInt(firstCell.getAttribute('rowspan') || '0', 10) : 0;
        const hasColspan = firstCell ? firstCell.hasAttribute('colspan') : false;
        
        if (rowspan > 1 || hasColspan) { 
          if (cur) blocks.push(cur);
          cur = {
            kind: 'section',
            headerHTML: row.outerHTML,
            rowsHTML: [],
            rowHeights: [],
            theadHTML: theadHTML,
            headerH: 0
          };
        } else if (cur) {
          cur.rowsHTML.push(row.outerHTML);
        }
      });
      if (cur) blocks.push(cur);
    } else {
      blocks.push({ kind: 'node', html: child.outerHTML, h: 0 });
    }
  });

  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:-99999px;width:' + CONTENT_W + 'px;opacity:0;pointer-events:none;z-index:-1;';
  probe.innerHTML = '<style>' + measureStyleContent + '</style><div id="probe-inner"></div>';
  document.body.appendChild(probe);
  const probeInner = probe.querySelector('#probe-inner');

  probeInner.style.fontFamily = "'Hanuman','Roboto Condensed','Roboto',Arial,sans-serif";

  function measureRaw(html){
    probeInner.innerHTML = html;
    const h = probeInner.getBoundingClientRect().height;
    probeInner.innerHTML = '';
    return h;
  }

  let THEAD_H_MEASURED = 0;
  const sampleThead = (blocks.find(b => b.kind === 'section' && b.theadHTML) || {}).theadHTML || '';
  if (sampleThead) {
    THEAD_H_MEASURED = snap2(measureRaw('<table class="data-table" style="table-layout: fixed; width: 100%;">' + colgroupHTML + sampleThead + '<tbody><tr><td style="height:1px; padding:0; border:none;"></td></tr></tbody></table>'));
  }

  blocks.forEach(b => {
    if (b.kind === 'node') {
      b.h = snap2(measureRaw(b.html));
      return;
    }
    const fullTable = b.theadHTML
      ? '<table class="data-table" style="table-layout: fixed; width: 100%;">' + colgroupHTML + b.theadHTML + '<tbody>' + b.headerHTML + b.rowsHTML.join('') + '</tbody></table>'
      : '<table class="data-table" style="table-layout: fixed; width: 100%;">' + colgroupHTML + '<tbody>' + b.headerHTML + b.rowsHTML.join('') + '</tbody></table>';

    probeInner.innerHTML = fullTable;
    const trs = probeInner.querySelectorAll('tbody > tr');

    if (trs.length === 0) {
      b.headerH = 2;
      b.rowHeights = [];
    } else {
      // Temporarily remove rowspan to measure the true header height (fixes Truck double-counting)
      const firstTd = trs[0].querySelector('td');
      const oldSpan = firstTd ? firstTd.getAttribute('rowspan') : null;
      if (firstTd && oldSpan) firstTd.setAttribute('rowspan', '1');
      
      b.headerH = Math.max(2, snap2(trs[0].getBoundingClientRect().height));
      
      if (firstTd && oldSpan) firstTd.setAttribute('rowspan', oldSpan);

      b.rowHeights = [];
      for (let i = 1; i < trs.length; i++) {
        b.rowHeights.push(Math.max(2, snap2(trs[i].getBoundingClientRect().height)));
      }
    }
    probeInner.innerHTML = '';
  });

  document.body.removeChild(probe);
  document.body.removeChild(hidden);

  const sumRange = (arr, a, b) => { let s = 0; for (let i = a; i < b; i++) s += arr[i]; return s; };

  const pages = [];
  let curPage = [];

  function pushPage(){
    if (curPage.length) pages.push(curPage);
    curPage = [];
  }

  function getPageLimit() {
    const isPage2Plus = pages.length > 0;
    
    const TRUCK_PAGE1_ADJUSTMENT = 0;       
    const TRUCK_PAGE2_PLUS_ADJUSTMENT = 10;  
    
    const FCC_PAGE1_ADJUSTMENT = -5;         
    const FCC_PAGE2_PLUS_ADJUSTMENT = 15;    

    const RTG_PAGE1_ADJUSTMENT = 700;         
    const RTG_PAGE2_PLUS_ADJUSTMENT = 0;    

    if (isFCC) {
      return PAGE_CONTENT_H + (isPage2Plus ? FCC_PAGE2_PLUS_ADJUSTMENT : FCC_PAGE1_ADJUSTMENT);
    } else if (isRTG) {
      return PAGE_CONTENT_H + (isPage2Plus ? RTG_PAGE2_PLUS_ADJUSTMENT : RTG_PAGE1_ADJUSTMENT);
    } else {
      return PAGE_CONTENT_H + (isPage2Plus ? TRUCK_PAGE2_PLUS_ADJUSTMENT : TRUCK_PAGE1_ADJUSTMENT);
    }
  }

  function computePageH(items){
    let h = 0, tableOpen = false;
    const isPage2Plus = pages.length > 0;

    items.forEach((item, i) => {
      if (item.type === 'section') {
        if (!tableOpen) {
          if (i > 0) h += GAP;
          // Add THEAD height ONLY for Page 1 or Truck (because FCC Page 2+ removes <thead>)
          if (!(isFCC && isPage2Plus)) {
            h += THEAD_H_MEASURED;
          }
          tableOpen = true;
        }
        h += item.h;
      } else {
        tableOpen = false;
        if (i > 0) h += GAP;
        h += item.h;
      }
    });
    return h;
  }

  function addNode(b){
    const candidate = curPage.concat([{ type:'node', html: b.html, h: b.h }]);
    if (computePageH(candidate) > getPageLimit() && curPage.length > 0) {
      pushPage();
      curPage.push({ type:'node', html: b.html, h: b.h });
    } else {
      curPage = candidate;
    }
  }

  function addSection(b){
    const totalRows = b.rowsHTML.length;
    if (totalRows === 0) {
      const item = { type:'section', sectionRef:b, fromRow:0, toRow:0, h:b.headerH };
      const candidate = curPage.concat([item]);
      if (computePageH(candidate) > getPageLimit() && curPage.length > 0) pushPage();
      curPage.push(item);
      return;
    }

    let fromRow = 0;
    while (fromRow < totalRows) {
      let bestK = fromRow;
      const limit = getPageLimit();
      for (let k = fromRow + 1; k <= totalRows; k++) {
        const chunkH = b.headerH + sumRange(b.rowHeights, fromRow, k);
        const item = { type:'section', sectionRef:b, fromRow, toRow:k, h: chunkH };
        const candidate = curPage.concat([item]);
        if (computePageH(candidate) <= limit) bestK = k;
        else break;
      }
      if (bestK === fromRow) {
        if (curPage.length > 0) { pushPage(); continue; }
        bestK = fromRow + 1;
      }
      
      const chunkH = b.headerH + sumRange(b.rowHeights, fromRow, bestK);
      curPage.push({ type:'section', sectionRef:b, fromRow, toRow:bestK, h: chunkH });
      fromRow = bestK;
      if (fromRow < totalRows) pushPage();
    }
  }

  blocks.forEach(b => {
    if (b.kind === 'node') addNode(b);
    else addSection(b);
  });
  pushPage();

  return {
    pages, styleContent: rawStyleContent,
    PAGE_W, PAGE_H, PAD_TOP, PAD_BOTTOM, PAD_X, CONTENT_W, PAGE_CONTENT_H,
    THEAD_H_MEASURED, SCALE: getRenderScale(), FOREIGN_OBJECT_OK: detectForeignObjectSupport(),
    isFCC: isFCC, colgroupHTML: colgroupHTML
  };
}

function pageItemsToHTML(ctx, items, pageNum) {
  const adjustHeaderRowspan = (headerHTML, newRowspan) => {
    const tmp = document.createElement('table');
    tmp.innerHTML = '<tbody>' + headerHTML + '</tbody>';
    const tr = tmp.querySelector('tbody > tr');
    if (tr) {
      const firstTd = tr.querySelector('td');
      if (firstTd && !firstTd.hasAttribute('colspan')) {
        firstTd.setAttribute('rowspan', String(newRowspan));
      }
      return tr.outerHTML;
    }
    return headerHTML;
  };

  let html = '', tableOpen = false;

  items.forEach(it => {
    if (it.type === 'section') {
      const b = it.sectionRef;
      if (!tableOpen) {
        let theadHTML = b.theadHTML;
        let colgroupHTML = ctx.colgroupHTML;
        
        if (ctx.isFCC && pageNum > 1) {
          theadHTML = ''; 
        }

        html += '<table class="data-table" style="table-layout: fixed; width: 100%;">' + colgroupHTML + theadHTML + '<tbody>';
        tableOpen = true;
      }
      html += adjustHeaderRowspan(b.headerHTML, 1 + (it.toRow - it.fromRow));
      for (let i = it.fromRow; i < it.toRow; i++) html += b.rowsHTML[i];
    } else {
      if (tableOpen) { html += '</tbody></table>'; tableOpen = false; }
      html += it.html;
    }
  });
  if (tableOpen) html += '</tbody></table>';

  html += '<div class="page-footer"><div class="footer-bar"></div><div class="page-number">' + pageNum + '</div></div>';

  return html;
}

function renderPageToCanvas(ctx, pageItems, pageNum) {
  const {
    styleContent, PAGE_W, PAGE_H, PAD_TOP, PAD_BOTTOM, PAD_X, CONTENT_W,
    SCALE, FOREIGN_OBJECT_OK
  } = ctx;

  const pageHTML = pageItemsToHTML(ctx, pageItems, pageNum);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
      'position:fixed', 'top:0', 'left:-10000px',
      'width:' + PAGE_W + 'px', 'height:' + PAGE_H + 'px',
      'border:0', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    
    const docHTML = '<!DOCTYPE html>\n<html lang="km">\n<head>\n<meta charset="UTF-8">\n' +
      '<style>' + styleContent + '</style>\n' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700;900&display=swap">\n' +
      '<style>\n' +
      '  html, body { margin: 0; padding: 0; background: #ffffff; }\n' +
      '  .page-wrap { position: relative; width: ' + PAGE_W + 'px; height: ' + PAGE_H + 'px; padding: ' + PAD_TOP + 'px ' + PAD_X + 'px ' + PAD_BOTTOM + 'px ' + PAD_X + 'px; box-sizing: border-box; background: #ffffff; overflow: hidden; display: flex; flex-direction: column; }\n' +
      '  .page-content { flex: 1 1 auto; min-height: 0; overflow: hidden; padding-bottom: 28px; box-sizing: border-box; display: flex; flex-direction: column; }\n' +
      '  .report-container { width: ' + CONTENT_W + 'px; min-width: ' + CONTENT_W + 'px; max-width: ' + CONTENT_W + 'px; margin: 0; font-family: \'Hanuman\',\'Roboto Condensed\',\'Roboto\',Arial,sans-serif; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }\n' +
      '  .page-footer { position: absolute; left: ' + PAD_X + 'px; right: ' + PAD_X + 'px; bottom: ' + PAD_BOTTOM + 'px; margin-top: 0; padding-top: 0; display: flex; align-items: flex-end; gap: 8px; }\n' +
      '</style>\n</head>\n<body>\n  <div class="page-wrap">\n    <div class="page-content">\n      <div class="report-container">' + pageHTML + '</div>\n    </div>\n  </div>\n</body>\n</html>';

    doc.write(docHTML);
    doc.close();

    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const waitFonts = async () => {
      if (!doc.fonts || !doc.fonts.ready) return;
      await Promise.race([doc.fonts.ready, wait(1000)]);
      try { await Promise.all([doc.fonts.load('400 16px Hanuman'), doc.fonts.load('700 16px Hanuman'), doc.fonts.load('900 16px Hanuman')]); } catch (e) {}
    };
    const waitImages = () => {
      const imgs = Array.from(doc.images || []);
      if (!imgs.length) return Promise.resolve();
      return Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 1000); })));
    };

    Promise.all([wait(100), waitFonts(), waitImages()]).then(() => wait(50)).then(() => {
      const target = doc.querySelector('.page-wrap') || doc.body;
      return html2canvas(target, { scale: SCALE, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', foreignObjectRendering: FOREIGN_OBJECT_OK, windowWidth: PAGE_W, width: PAGE_W, height: PAGE_H, scrollX: 0, scrollY: 0 });
    }).then(canvas => {
      try { iframe.remove(); } catch (e) {}
      resolve(canvas);
    }).catch(err => {
      try { iframe.remove(); } catch (e) {}
      reject(err);
    });
  });
}

async function outputPrint(sub) {
  const ctx = await paginateReport(sub);
  const pagesHTML = ctx.pages.map((items, i) => '<div class="print-page"><div class="page-content"><div class="report-container">' + pageItemsToHTML(ctx, items, i + 1) + '</div></div></div>').join('');

  const fullHTML = '<!DOCTYPE html><html lang="km"><head><meta charset="UTF-8"><title>SERVICE REPORT – ' + (sub.checkId || '') + '</title>'
    + '<style>' + ctx.styleContent + '</style>'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700;900&display=swap">'
    + '<style>'
    + '  @page { size: A4 portrait; margin: 0; }'
    + '  html, body { margin: 0; padding: 0; width: 210mm; background: #ffffff; }'
    + '  .print-page { position: relative; width: 210mm; height: 297mm; box-sizing: border-box;'
    + '    padding: 7.94mm 7.41mm 3.97mm 7.41mm; page-break-after: always; break-after: page;'
    + '    overflow: hidden; display: flex; flex-direction: column; background: #ffffff !important; }'
    + '  .print-page:last-child { page-break-after: auto; break-after: auto; }'
    + '  .print-page .page-content { flex: 1 1 auto; min-height: 0; overflow: hidden; padding-bottom: 7.41mm;'
    + '    box-sizing: border-box; display: flex; flex-direction: column; }'
    + '  .print-page .report-container { width: 100% !important; max-width: 100% !important; margin: 0 !important;'
    + '    padding: 0 !important; display: flex !important; flex-direction: column !important;'
    + '    flex: 1 1 auto !important; min-height: 0 !important; }'
    + '  .print-page .page-footer { position: absolute; left: 7.41mm; right: 7.41mm; bottom: 3.97mm;'
    + '    margin-top: 0 !important; padding-top: 0 !important; display: flex !important; align-items: flex-end; gap: 8px; }'
    + '  .data-table, .legend-table { border-collapse: collapse !important; }'
    + '  .data-table th, .data-table td, .legend-table td { border: 1px solid #000 !important; }'
    + '  .data-table thead { display: table-header-group !important; }'
    + '  .data-table tr { page-break-inside: avoid !important; break-inside: avoid !important; }'
    + '  .signature-container { page-break-inside: avoid !important; break-inside: avoid !important; }'
    + '  html, body, *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    + '</style></head><body>' + pagesHTML + '</body></html>';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(fullHTML); doc.close();

  let fired = false;
  const fire = () => {
    if (fired) return; fired = true;
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error(e); }
    setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 60000);
  };
  const ready = () => {
    try {
      const fdoc = iframe.contentWindow.document;
      if (fdoc.fonts && fdoc.fonts.ready) fdoc.fonts.ready.then(() => setTimeout(fire, 500));
      else setTimeout(fire, 1500);
    } catch (e) { setTimeout(fire, 1500); }
  };
  if (iframe.contentWindow.document.readyState === 'complete') ready();
  else { iframe.onload = ready; setTimeout(ready, 2500); }
}

async function outputImage(sub, format) {
  format = (format || 'png').toLowerCase();
  if (typeof html2canvas === 'undefined') { showAlert('html2canvas not loaded — please refresh the page.', 'danger'); return; }

  showAlert('កំពុងបង្កើតរូបភាព...', 'info');
  await new Promise(r => setTimeout(r, 30));
  const ctx = await paginateReport(sub);

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const qual = format === 'jpeg' ? 0.92 : 1.0;
  const ext  = format === 'jpeg' ? 'jpg' : 'png';
  const total = ctx.pages.length;

  try {
    for (let i = 0; i < total; i++) {
      const canvas = await renderPageToCanvas(ctx, ctx.pages[i], i + 1);
      await new Promise(resolve => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `SERVICE_REPORT_${sub.checkId}_p${i + 1}of${total}.${ext}`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 3000); setTimeout(resolve, 400);
        }, mime, qual);
      });
      canvas.width = 0; canvas.height = 0;
      await new Promise(r => setTimeout(r, 80));
    }
    showAlert(`ទាញយករួចរាល់ — ${total} ទំព័រ (${ext.toUpperCase()})`, 'success');
  } catch (err) {
    console.error(err);
    showAlert('Image failed: ' + (err.message || err), 'danger');
  }
}

async function outputPDF(sub) {
  if (typeof html2canvas === 'undefined') { showAlert('html2canvas not loaded — please refresh the page.', 'danger'); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { showAlert('jsPDF not loaded — please refresh the page.', 'danger'); return; }

  showAlert('កំពុងបង្កើត PDF...', 'info');
  await new Promise(r => setTimeout(r, 30));

  const { jsPDF } = window.jspdf;
  const ctx = await paginateReport(sub);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const total = ctx.pages.length;

  if (total === 0) {
    showAlert('No pages to generate.', 'warning');
    return;
  }

  const isBlank = (canvas) => {
    const p = document.createElement('canvas');
    p.width = 32; p.height = 32;
    const pc = p.getContext('2d');
    pc.drawImage(canvas, 0, 0, 32, 32);
    const data = pc.getImageData(0, 0, 32, 32).data;
    let nonWhite = 0;
    for (let k = 0; k < data.length; k += 4) { if (data[k] < 250 || data[k+1] < 250 || data[k+2] < 250) nonWhite++; }
    return nonWhite < 10;
  };

  try {
    for (let i = 0; i < total; i++) {
      let canvas = await renderPageToCanvas(ctx, ctx.pages[i], i + 1);
      if (isBlank(canvas)) { ctx.SCALE = Math.max(1, ctx.SCALE - 0.5); canvas = await renderPageToCanvas(ctx, ctx.pages[i], i + 1); }
      const imgData = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      canvas.width = 0; canvas.height = 0;
      await new Promise(r => setTimeout(r, 80));
    }
    pdf.save('SERVICE_REPORT_' + (sub.checkId || 'export') + '.pdf');
    showAlert(`ទាញយករួចរាល់ — PDF ${total} ទំព័រ`, 'success');
  } catch (err) {
    console.error('[PDF] Failed:', err);
    showAlert('PDF failed: ' + (err.message || err), 'danger');
  }
}

async function generateChecklistPdfBase64(sub) {
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF not loaded');
  await new Promise(resolve => loadSignaturesForReport(sub, resolve));
  if (document.fonts) { try { await Promise.all([document.fonts.load('400 16px Hanuman'), document.fonts.load('700 16px Hanuman'), document.fonts.load('900 16px Hanuman')]); await document.fonts.ready; } catch (e) {} }
  
  const { jsPDF } = window.jspdf;

  window.isGeneratingPdfMode = true;
  
  const ctx = await paginateReport(sub);
  ctx.SCALE = 2.0; 
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < ctx.pages.length; i++) {
    const canvas = await renderPageToCanvas(ctx, ctx.pages[i], i + 1);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    canvas.width = 0; canvas.height = 0;
    await new Promise(r => setTimeout(r, 50));
  }

   window.isGeneratingPdfMode = false;
  
  const dataUri = pdf.output('datauristring');
  return dataUri.split(',')[1];
}

async function generateReport(sub, mode) {
  mode = (mode || 'print').toLowerCase();
  await new Promise(resolve => loadSignaturesForReport(sub, resolve));
  
  if (mode !== 'print' && document.fonts) {
    try { 
      await Promise.all([document.fonts.load('400 16px Hanuman'), document.fonts.load('700 16px Hanuman'), document.fonts.load('900 16px Hanuman')]); 
      await document.fonts.ready; 
    } catch (e) {}
  }
  
  // 👇 SET FLAG TO TRUE BEFORE GENERATING 👇
  window.isGeneratingPdfMode = true;
  
  try {
    if (mode === 'print') return await outputPrint(sub);
    if (mode === 'pdf')   return await outputPDF(sub);
    if (mode === 'jpg' || mode === 'jpeg') return await outputImage(sub, 'jpeg');
    return await outputImage(sub, 'png');
  } finally {
    // 👇 RESET FLAG AFTER FINISHING 👇
    window.isGeneratingPdfMode = false;
  }
}

window.printCurrentReport = function(){ const sub = getCurrentReportSub(); if (!sub) return; generateReport(sub, 'print').catch(e => { console.error(e); showAlert(e.message, 'danger'); }); };
window.saveCurrentReportImage = function(){ const sub = getCurrentReportSub(); if (!sub) return; generateReport(sub, 'png').catch(e => { console.error(e); showAlert(e.message, 'danger'); }); };
window.saveCurrentReportJPG = function(){ const sub = getCurrentReportSub(); if (!sub) return; generateReport(sub, 'jpg').catch(e => { console.error(e); showAlert(e.message, 'danger'); }); };
window.saveCurrentReportPDF = function(){ const sub = getCurrentReportSub(); if (!sub) return; generateReport(sub, 'pdf').catch(e => { console.error(e); showAlert(e.message, 'danger'); }); };


/*TruckReportDaily*/

function truckReportStyles() {
  return `
  <style>
@import url('https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700&family=Pacifico&family=Roboto+Condensed:wght@400;700&family=Roboto:wght@400;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; font-family: 'Hanuman', 'Roboto Condensed', 'Roboto', sans-serif; }
    body { background: #fff; margin: 0; padding: 0; color: #000; }
.report-container { width: 100%; max-width: none; margin: 0 auto; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }

/* ★ FIXED: Replaced broken grid with absolute positioning to align logo, title, and ruler */
.top-row { position: relative; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; padding-bottom: 10px; min-height: 110px; }
.logo-block { display: flex; flex-direction: column; align-items: flex-start; width: 33%; padding-bottom: 24px; }
.pec-logo-img { display: block; height: 68px; width: auto; margin-left: 5px; object-fit: contain; }
.logo-pec { font-size: 58px; font-weight: 900; font-style: italic; font-family: Georgia, serif; background: linear-gradient(180deg, #fff000 0%, #ffc000 50%, #e69900 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 0.9; margin-left: 5px; }
.logo-subtext { position: absolute; left: 5px; bottom: 10px; color: #0b2545; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; white-space: nowrap; }
.report-title-main { position: absolute; left: 50%; transform: translateX(-50%); bottom: 15px; white-space: nowrap; text-align: center; font-size: 18px; font-weight: 900; font-style: italic; color: #000; text-transform: uppercase; letter-spacing: 1px; margin: 0; line-height: 1.1; }
.address-block { width: 33%; text-align: right; color: #0056b3; font-size: 11px; font-weight: 700; line-height: 1.25; }

    .divider-bar { 
      width: 100%; 
      height: 0; 
      border-top: 4px solid #3b82f6; 
      margin-bottom: 15px; 
      display: block !important; 
      flex-shrink: 0; 
    }
    
.form-grid { display: flex; position: relative; padding-left: 12px; }
.form-grid::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3.5px; background-color: #3b82f6; }
.form-column { flex: 1; padding-right: 25px; }
.field-row { display: flex; align-items: flex-end; margin-bottom: 8px; font-size: 12px; }
.field-label { font-weight: 700; color: #000; white-space: nowrap; text-transform: uppercase; }
.col-left .field-label { width: 140px; }
.col-right .field-label { width: 110px; }
.field-value-line { flex: 1; border-bottom: 1.5px dotted #000; text-align: center; font-weight: 600; color: #000; padding-bottom: 1px; min-height: 15px; }
.history-container { display: flex; justify-content: flex-end; margin-top: 15px; margin-bottom: 15px; }
.history-box { position: relative; padding-right: 12px; width: 320px; }
.history-box::after { content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 3px; background-color: #6c757d; }
.history-title { text-align: right; font-weight: 800; color: #0b3c5d; font-size: 12px; margin-bottom: 8px; letter-spacing: 0.5px; }
.history-row { display: flex; align-items: flex-end; margin-bottom: 8px; }
.history-line { flex: 1; border-bottom: 1.5px dotted #000; min-height: 18px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; font-size: 11px; font-weight: 700; color: #000; white-space: nowrap; overflow: hidden; }
.history-label { font-weight: 700; font-size: 11px; color: #000; margin-left: 6px; white-space: nowrap; }
.legend-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 6px; }
.legend-table td { border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; }
.legend-title { text-align: center; font-weight: bold; font-size: 11px; text-decoration: underline; }
.legend-text { line-height: 1.35; }
.tractor-header-cell { text-align: right; font-weight: bold; font-size: 12px; padding-right: 10px; }
.section-banner { background: #d9d9d9; font-weight: bold; text-align: center; font-size: 11px; padding: 3px; border: 1px solid #000; margin-top: 8px; }
.data-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
.data-table thead { display: table-header-group; }
.data-table tr { page-break-inside: avoid; }
.data-table th, .data-table td { border: 1px solid #000; padding: 4px 6px; font-size: 15px; line-height: 22px; vertical-align: middle; }
.data-table th { background: #7A2B4A; color: #FFFFFF; text-align: center; font-weight: bold; }
.center { text-align: center; }
.bold { font-weight: bold; }
.col-no { width: 32px; }
.col-items { width: 300px; }
.col-result { width: 60px; }
.col-side { width: 50px; }
.col-remark { width: 190px; }
.note-cell { white-space: pre-wrap; word-break: break-word; vertical-align: top; }
.signature-container { width: 100%; margin-top: 25px; display: flex; justify-content: flex-start; align-items: flex-start; page-break-inside: avoid; break-inside: avoid; gap: 0; }
.sig-column { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.sig-column:nth-child(1) { flex-grow: 3; margin-right: 8px; }
.sig-column:nth-child(2) { flex-grow: 3; margin-right: 24px; }
.sig-column:nth-child(3) { flex-grow: 4; }
.sig-title { font-size: 11px; font-weight: 700; color: #000; text-align: center; line-height: 1.3; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 2px; white-space: nowrap; }
.sig-title-manager { white-space: normal; }
.sig-last-line { position: relative; display: inline-block; }
.sig-sign-inline { position: absolute; left: 100%; bottom: -6px; height: 20px; width: auto; max-width: 55px; object-fit: contain; margin-left: 4px; }
.sig-space { height: 65px; width: 100%; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.sig-image { max-height: 60px; max-width: 95%; width: auto; object-fit: contain; display: block; }
.dotted-line { width: 100%; border-bottom: 1.5px dotted #000; margin-bottom: 2px; }
.sig-label-center { font-size: 10px; color: #000; text-align: center; margin-bottom: 8px; }
.info-row { width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 4px; margin-bottom: 4px; font-size: 10px; }
.info-label { color: #000; white-space: nowrap; flex: 0 0 auto; }
.info-value { flex: 0 0 auto; min-width: 70px; border-bottom: 1.5px dotted #000; font-weight: 700; color: #000; text-align: center; padding-bottom: 1px; }
.page-content { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.page-footer { flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px; margin-top: auto; padding-top: 10px; }
.footer-bar { flex: 1 1 auto; height: 4px; background: #F5A623; border-radius: 1px; margin-bottom: 4px; }
.page-number { font-size: 11px; font-weight: 700; color: #000; min-width: 24px; text-align: right; margin-bottom: 1px; }
@media print { @page { size: A4 portrait; margin: 7.94mm 7.41mm; } html, body { width: auto !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .report-container { width: 100% !important; min-width: 0 !important; max-width: 100% !important; margin: 0 !important; font-family: 'Hanuman', 'Roboto Condensed', 'Roboto', Arial, sans-serif !important; } .print-page { display: flex !important; flex-direction: column !important; } .page-content { display: flex !important; flex-direction: column !important; } .page-footer { display: flex !important; } .data-table, .legend-table { border-collapse: collapse !important; } .data-table th, .data-table td, .legend-table td { border: 1px solid #000 !important; } .data-table thead { display: table-header-group !important; } .data-table tr { page-break-inside: avoid !important; break-inside: avoid !important; } .signature-container { page-break-inside: avoid !important; break-inside: avoid !important; } }
  </style>`;
}

function buildTruckReportBody(sub) {
  const tplMap = {};
  const headerBySection = {};

  const sigInspector = signatureUrl(sub.username);
  
  // ★ Only show the Driver's signature if they have confirmed
  const sigDriver    = (sub.driverConfirmStatus === 'Confirmed') ? signatureUrl(sub.driverUsername) : ''; 
  
  const sigManager   = signatureUrl(sub.confirmedBy);
  const sigDirector  = signatureUrl(sub.directorBy);
  
  const eqData = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
  const sg = eqData.specificGroup || '';
  const tplList = APP.templates[sub.group + '|' + sg] || APP.templates[sub.group + '|'] || APP.templates[sub.group] || [];
  
  tplList.forEach(t => {
    tplMap[t.itemId] = t;
    if (String(t.inputType).toLowerCase() === 'header') {
      headerBySection[String(t.itemId).trim()] = t;
    }
  });
  
  const eqShortMap = {};
  (APP.equipment || []).forEach(e => { eqShortMap[e.equipmentId] = e.shortName || e.equipmentId; });
  const trlShortMap = {};
  (APP.trailers || []).forEach(t => { trlShortMap[t.trailerId] = t.shortName || t.trailerId; });

  const eqShortName  = eqShortMap[sub.equipmentId]     || sub.equipmentId     || '';
  const trlShortName = trlShortMap[sub.trailerPlateNo] || sub.trailerPlateNo || '';

  const userMap = {};
  (APP.users || []).forEach(u => { userMap[u.username] = u; });

  const _tech = userMap[sub.username]        || {};
  const _drv  = userMap[sub.driverUsername]  || {};
  const _dir  = userMap[sub.directorBy]      || {};

  const techName  = _tech.fullName || sub.driverName || '';
  const techPhone = _tech.phone    || '';
  const drvName   = _drv.fullName  || sub.driverUsername || '';
  const drvPhone  = _drv.phone     || '';
  const dirName   = _dir.fullName  || sub.directorBy || '';
  const dirPhone  = _dir.phone     || '';

    const sections = [];
  const seen = {};
  (sub.checks || []).forEach(c => {
    const sec = sectionOf(c.itemId);
    if (!seen[sec]) {
      seen[sec] = true;
      const h = headerBySection[sec];
      
      // ★ ADD THIS: Hardcode headers for Extra Sections
      let khTitle = h ? h.itemKhmer : '';
      let enTitle = h ? h.itemEng : '';
      if (sec === 'EXT-TRK') { khTitle = 'ផ្នែកផ្សេងៗទៀត'; enTitle = 'Others'; }
      if (sec === 'EXT-TRL') { khTitle = 'ផ្នែកផ្សេងៗទៀត'; enTitle = 'Others'; }

      sections.push({ sid: sec, kh: khTitle, en: enTitle, items: [] });
    }
    const itemTpl = tplMap[c.itemId];
    sections[sections.length - 1].items.push({
      itemId: c.itemId,
      kh: (itemTpl && itemTpl.itemKhmer) ? itemTpl.itemKhmer : (c.itemKhmer || c.itemId), // ★ Use saved name
      en: itemTpl ? itemTpl.itemEng : '',
      status: normalizeStatus(c.status) || 'N',
      location: c.location || '',
      note: c.note || ''
    });
  });

  const isVehicle = String(sub.group || '') === 'រថយន្ត';
  
  // ★ Updated to correctly catch the Extra Truck and Extra Trailer sections
  const tractorSections = isVehicle ? sections.filter(s => Number(s.sid) < 23 || s.sid === 'EXT-TRK') : sections;
  const trailerSections = isVehicle ? sections.filter(s => Number(s.sid) >= 23 || s.sid === 'EXT-TRL') : [];

  const renderRows = (secs) => {
    let html = '';
    secs.forEach(sec => {
      const rowspan = sec.items.length + 1;
      const displaySid = String(sec.sid).startsWith('EXT-') ? '' : sec.sid;
      html += '<tr>' +
        '<td class="center bold" rowspan="' + rowspan + '">' + esc(displaySid) + '</td>' +
        '<td class="bold">' + esc(sec.kh) + (sec.en ? ' / ' + esc(sec.en) : '') + '</td>' +
        '<td></td><td></td><td></td><td></td>' +
      '</tr>';

      sec.items.forEach((it, i) => {
        const letter = String.fromCharCode(97 + i);
        const isLeft  = it.location.indexOf('L') !== -1;
        const isRight = it.location.indexOf('R') !== -1;
        
        html += '<tr>' +
          '<td>' + letter + '. ' + esc(it.kh) + (it.en ? ' / ' + esc(it.en) : '') + '</td>' +
          '<td class="center bold">' + esc(it.status) + '</td>' +
          '<td class="center">' + (isLeft ? '&#10004;' : '') + '</td>' +
          '<td class="center">' + (isRight ? '&#10004;' : '') + '</td>' +
          '<td class="note-cell">' + esc(it.note) + '</td>' +
        '</tr>';
      });
    });
    return html;
  };

  const thead = '<thead><tr>' +
    '<th class="col-no">No.</th>' +
    '<th class="col-items">Items</th>' +
    '<th class="col-result">Result</th>' +
    '<th class="col-side">Left</th>' +
    '<th class="col-side">Right</th>' +
    '<th class="col-remark" style="border-right: 1px solid #000 !important;">Remark</th>' +
  '</tr></thead>';

  return '<div class="report-container">' +
    '<div class="top-row">' +
      '<div class="logo-block">' +
        (APP.logoDataUrl ? '<img class="pec-logo-img" src="' + APP.logoDataUrl + '" alt="Pec">' : '<div class="logo-pec">Pec</div>') +
      '</div>' +
      '<div class="logo-subtext">PORT EQUIPMENT CO., LTD</div>' +
      '<div class="report-title-main">SERVICE REPORT</div>' +
      '<div class="address-block">' +
        'ADDRESS: #649, Room 308 Street Preah<br>' +
        'Sisowath, Sangkat Sras Chork,<br>' +
        'Khan Daun Penh, Phnom Penh, Cambodia<br>' +
        'Phone: +855 61 444 555/92 454 237' +
      '</div>' +
    '</div>' +

    '<div class="divider-bar"></div>' +

    '<div class="form-grid">' +
      '<div class="form-column col-left">' +
        '<div class="field-row"><span class="field-label">DATE:</span><div class="field-value-line">' + esc(sub.date || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">SECTION:</span><div class="field-value-line">' + esc(sub.group) + (trlShortName ? '+រ៉ឺម៉ក' : '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">TRACTOR PLATE NO:</span><div class="field-value-line">' + esc(eqShortName) + '</div></div>' +
        '<div class="field-row"><span class="field-label">TRAILER PLATE NO:</span><div class="field-value-line">' + esc(trlShortName) + '</div></div>' +
        '<div class="field-row"><span class="field-label">INSPECTOR:</span><div class="field-value-line">' + esc(sub.driverName || '') + '</div></div>' +
      '</div>' +
      '<div class="form-column col-right">' +
        '<div class="field-row"><span class="field-label">COMPANY:</span><div class="field-value-line">Phnom Penh Autonomous Port</div></div>' +
        '<div class="field-row"><span class="field-label">TIME IN:</span><div class="field-value-line">' + esc(sub.timeIn || sub.time || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">TIME OUT:</span><div class="field-value-line">' + esc(sub.timeOut || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">ODOMETER :</span><div class="field-value-line">' + esc(sub.odometer || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">LAST OP-HOUR</span><div class="field-value-line">' + esc(sub.lastOpHour || '') + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="history-container">' +
      '<div class="history-box">' +
        '<div class="history-title">MAINTENANCE HISTORY</div>' +
        '<div class="history-row"><div class="history-line">' + esc(sub.previousDate || '') + '</div><span class="history-label">:PREVIOUS DATE</span></div>' +
        '<div class="history-row"><div class="history-line">' + esc(sub.previousOdometer || '') + '</div><span class="history-label">:PREVIOUS ODOMETER</span></div>' +
        '<div class="history-row"><div class="history-line">' + esc(sub.previousHour || '') + '</div><span class="history-label">:PREVIOUS HOUR</span></div>' +
      '</div>' +
    '</div>' +

         (window.activeReportForm === 'table' ? '' : 
      '<table class="legend-table">' +
        '<tr><td colspan="2" class="legend-title">MONTHLY INSPECTION</td></tr>' +
        '<tr><td colspan="2" class="legend-text">' +
          '<u><b>Acronym:</b></u> <b>N</b>=Normal, <b>UF</b>=Urgent Fixing, <b>NF</b>=Need Fixing, <b>NA</b>=Need Adjust, <b>Ad</b>=Added, <b>T</b>=Tightened, <b>&#10004;</b>=Location-(Left or Right)' +
        '</td></tr>' +
        '<tr><td class="legend-text">' +
          '<u><b>អក្សរកាត់:</b></u> <b>N</b>=ធម្មតា, <b>UF</b>=ត្រូវការជួសជុលបន្ទាន់, <b>NF</b>=ត្រូវការជួសជុល (អាចប្រើប្រាស់បណ្តោះអាសន្នបាន),<br>' +
          '<b>NA</b>=ត្រូវការតម្រូវ, <b>Ad</b>=បានបន្ថែម, <b>T</b>=បានរឹតបន្តឹង, <b>&#10004;</b>=បញ្ជាក់អំពីទីតាំង-(ឆ្វេង ឬស្តាំ)' +
        '</td></tr>' +
      '</table>'
    ) +

        (window.activeReportForm === 'table' ? buildAfterInspectionTable() : 
      (isVehicle ? '<div class="section-banner">Tractor / រថយន្ត</div>' : '') +
      '<table class="data-table">' + thead + '<tbody>' + renderRows(tractorSections) + '</tbody></table>' +
      (trailerSections.length > 0 ? 
      '<div class="section-banner">Trailer / រ៉ឺម៉ក</div>' +
      '<table class="data-table">' + thead + '<tbody>' + renderRows(trailerSections) + '</tbody></table>' : '')
    ) +

    '<div class="signature-container">' +
      '<div class="sig-column">' +
        '<div class="sig-title">PE-Inspector</div>' +
        '<div class="sig-space">' + (sigInspector ? '<img class="sig-image" src="' + sigInspector + '" alt="sig">' : '') + '</div>' +
        '<div class="dotted-line"></div>' +
        '<div class="sig-label-center">Signature</div>' +
        '<div class="info-row"><span class="info-label">Full name:</span><div class="info-value">' + esc(techName) + '</div></div>' +
        '<div class="info-row"><span class="info-label">Phone:</span><div class="info-value">' + esc(techPhone) + '</div></div>' +
      '</div>' +
      '<div class="sig-column">' +
        '<div class="sig-title">Truck-Driver</div>' +
        '<div class="sig-space">' + (sigDriver ? '<img class="sig-image" src="' + sigDriver + '" alt="sig">' : '') + '</div>' +
        '<div class="dotted-line"></div>' +
        '<div class="sig-label-center">Signature</div>' +
        '<div class="info-row"><span class="info-label">Full name:</span><div class="info-value">' + esc(drvName) + '</div></div>' +
        '<div class="info-row"><span class="info-label">Phone:</span><div class="info-value">' + esc(drvPhone) + '</div></div>' +
      '</div>' +
      '<div class="sig-column">' +
        '<div class="sig-title sig-title-manager">' +
          'Seen by PPAP-Manager of<br>Handling/Construction<br>' +
          '<span class="sig-last-line">Machinery Services' + (sigManager ? '<img class="sig-sign-inline" src="' + sigManager + '" alt="sig">' : '') + '</span>' +
        '</div>' +
        '<div class="sig-space">' + (sigDirector ? '<img class="sig-image" src="' + sigDirector + '" alt="sig">' : '') + '</div>' +
        '<div class="dotted-line"></div>' +
        '<div class="sig-label-center">Signature</div>' +
        '<div class="info-row"><span class="info-label">Full name:</span><div class="info-value">' + esc(dirName) + '</div></div>' +
        '<div class="info-row"><span class="info-label">Phone:</span><div class="info-value">' + esc(dirPhone) + '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}


/*TCC&FCCReportDaily*/

function fccReportStyles() {
  return `
  <style>
@import url('https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700&family=Moul&family=Pacifico&family=Roboto+Condensed:wght@400;700&family=Roboto:wght@400;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; font-family: 'Hanuman', 'Roboto Condensed', 'Roboto', sans-serif; }
    body { background: #fff; margin: 0; padding: 0; color: #000; }
.report-container { width: 100%; max-width: none; margin: 0 auto; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; padding-top: 10px; }

/* Fixed Logo Cut-off */
.top-row { position: relative; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; padding-bottom: 10px; min-height: 110px; }
.logo-block { display: flex; flex-direction: column; align-items: flex-start; width: 33%; padding-bottom: 24px; }
.pec-logo-img { display: block; height: 68px; width: auto; margin-left: 5px; object-fit: contain; }
.logo-pec { font-size: 58px; font-weight: 900; font-style: italic; font-family: Georgia, serif; background: linear-gradient(180deg, #fff000 0%, #ffc000 50%, #e69900 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 0.9; margin-left: 5px; }
.logo-subtext { position: absolute; left: 5px; bottom: 10px; color: #000; font-size: 14px; font-weight: normal; letter-spacing: normal; font-family: 'Moul', 'Hanuman', sans-serif; white-space: nowrap; }

.report-title-main { position: absolute; left: 50%; transform: translateX(-50%); bottom: 15px; white-space: nowrap; text-align: center; font-size: 16px; font-weight: 500; font-family: 'Moul', 'Hanuman', sans-serif; color: #000; margin: 0; line-height: 1.1; }

.address-block { width: 33%; text-align: right; color: #0056b3; font-size: 10px; font-weight: 500; line-height: 1.4; }

.divider-bar { height: 0; border-top: 3.5px solid #3b82f6; width: 100%; margin-bottom: 15px; }

/* Fixed Ruler for Print (Using Border-Left instead of ::before) */
.form-grid { display: flex; position: relative; padding-left: 15px; border-left: 3.5px solid #F5A623; margin-bottom: 20px; }
.form-column { flex: 1; padding-right: 25px; }
.field-row { display: flex; align-items: flex-end; margin-bottom: 8px; font-size: 12px; }
.field-label { font-weight: 700; color: #000; white-space: nowrap; text-transform: uppercase; }
.col-left .field-label { width: 130px; }
.col-right .field-label { width: 120px; }
.field-value-line { flex: 1; border-bottom: 1.5px dotted #000; text-align: center; font-weight: 600; color: #000; padding-bottom: 1px; min-height: 15px; }

/* Table Fixed Layout */
.data-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
.data-table thead { display: table-header-group; }
.data-table tr { page-break-inside: avoid; }
.data-table th { padding: 3px 4px; font-size: 9px; line-height: 13px; vertical-align: middle; background: #ffffff; color: #0056b3; text-align: center; font-weight: bold; }
.data-table td { border: 1px solid #000 !important; padding: 3px 4px; font-size: 9px; line-height: 13px; vertical-align: middle; }
.center { text-align: center; }
.bold { font-weight: bold; }
.note-cell { white-space: pre-wrap; word-break: break-word; vertical-align: top; }

/* Signature Container */
.signature-container { width: 100%; margin-top: 30px; display: flex; flex-direction: column; gap: 35px; page-break-inside: avoid; break-inside: avoid; }
.signature-row { display: flex; justify-content: space-between; width: 100%; align-items: flex-start; }

.page-content { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.page-footer { flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px; margin-top: auto; padding-top: 10px; }
.footer-bar { flex: 1 1 auto; height: 4px; background: #F5A623; border-radius: 1px; margin-bottom: 4px; }
.page-number { font-size: 11px; font-weight: 700; color: #000; min-width: 24px; text-align: right; margin-bottom: 1px; }

@media print { 
  @page { size: A4 portrait; margin: 7.94mm 7.41mm; } 
  html, body { width: auto !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
  .report-container { width: 100% !important; min-width: 0 !important; max-width: 100% !important; margin: 0 !important; font-family: 'Hanuman', 'Roboto Condensed', 'Roboto', Arial, sans-serif !important; } 
  .print-page { display: flex !important; flex-direction: column !important; } 
  .page-content { display: flex !important; flex-direction: column !important; } 
  .page-footer { display: flex !important; } 
  .data-table, .legend-table { border-collapse: collapse !important; } 
  .data-table th, .data-table td, .legend-table td { border: 1px solid #000 !important; } 
  .data-table thead { display: table-header-group !important; } 
  .data-table tr { page-break-inside: avoid !important; break-inside: avoid !important; } 
  .signature-container { page-break-inside: avoid !important; break-inside: avoid !important; } 
}
  </style>`;
}

function buildFCCReportBody(sub) {
  const tplMap = {};
  const headerBySection = {};

  const eqData = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
  const sg = eqData.specificGroup || '';
  const isTCC = String(sg || '').trim().toUpperCase() === 'TCC';
  
  // 👇 AUTOMATIC COMPANY DETECTION 👇
  const compName = String(eqData.companyName || 'PPAP').trim().toUpperCase();
  window.include4thSignature = (compName === 'PPAP'); // Auto-set toggle for PPAP

  const tplList = APP.templates[sub.group + '|' + sg] || APP.templates[sub.group + '|'] || APP.templates[sub.group] || [];

  tplList.forEach(t => {
    tplMap[t.itemId] = t;
    if (String(t.inputType).toLowerCase() === 'header') {
      headerBySection[String(t.itemId).trim()] = t;
    }
  });

  const eqShortMap = {};
  (APP.equipment || []).forEach(e => { eqShortMap[e.equipmentId] = e.shortName || e.equipmentId; });
  const trlShortMap = {};
  (APP.trailers || []).forEach(t => { trlShortMap[t.trailerId] = t.shortName || t.trailerId; });

  const eqShortName  = eqShortMap[sub.equipmentId]     || sub.equipmentId     || '';
  const trlShortName = trlShortMap[sub.trailerPlateNo] || sub.trailerPlateNo || '';

  // ─── SIGNATURE SETUP ──────────
  const sigInspector = signatureUrl(sub.username);
  const sigDriver    = (sub.driverConfirmStatus === 'Confirmed') ? signatureUrl(sub.driverUsername) : '';
  const sigManager   = signatureUrl(sub.confirmedBy);   // small inline sig
  const sigDirector  = signatureUrl(sub.directorBy);    // big sig in 3rd column

  const userMap = {};
  (APP.users || []).forEach(u => { userMap[u.username] = u; });

  const _tech = userMap[sub.username]       || {};
  const _drv  = userMap[sub.driverUsername] || {};
  const _dir  = userMap[sub.directorBy]     || {};

  const techName  = _tech.fullName || sub.driverName || '';
  const drvName   = _drv.fullName  || sub.driverUsername || '';
  const drvPhone  = _drv.phone     || '';
  const dirName   = _dir.fullName  || sub.directorBy || '';

  // ─── SECTIONS ─────────────────────────────────────────────────────────
  const sections = [];
  const seen = {};
  (sub.checks || []).forEach(c => {
    const sec = sectionOf(c.itemId);
    if (!sec) return;
    if (!seen[sec]) {
      seen[sec] = true;
      const h = headerBySection[sec];
      sections.push({ sid: sec, kh: h ? h.itemKhmer : '', en: h ? h.itemEng : '', items: [] });
    }
    const itemTpl = tplMap[c.itemId];
    sections[sections.length - 1].items.push({
      itemId: c.itemId,
      kh: itemTpl ? itemTpl.itemKhmer : c.itemId,
      en: itemTpl ? itemTpl.itemEng : '',
      status: normalizeStatus(c.status) || '',
      location: c.location || '',
      note: c.note || '',
      frequency: itemTpl ? itemTpl.frequency : ''
    });
  });

  let globalCounter = 0;

  const renderRows = (secs) => {
    let html = '';
    secs.forEach(sec => {
      let headerTitle = sec.kh;
      if (!headerTitle.startsWith(sec.sid + '.') && !headerTitle.match(/^[ក-អ][\.\s]/)) {
         headerTitle = sec.sid + '. ' + headerTitle;
      }

      html += '<tr>' +
        '<td colspan="7" class="bold" style="background:#A9567D; color:#ffffff; text-align:left; padding: 4px 6px; font-size: 11px; border: 1px solid #000 !important;">' +
          esc(headerTitle) +
        '</td>' +
      '</tr>';

      sec.items.forEach((it, i) => {

        if (!window.isGeneratingPdfMode && (!it.status || String(it.status).trim() === '')) return;
        
        globalCounter++;
        const freq = String(it.frequency || '').toUpperCase();
        const statusTxt = esc(it.status);

        html += '<tr>' +
          '<td class="center bold" style="border: 1px solid #000 !important;">' + globalCounter + '</td>' +
          '<td style="border: 1px solid #000 !important;">' + esc(it.kh) + (it.en ? ' / ' + esc(it.en) : '') + '</td>' +
          '<td class="center bold" style="border: 1px solid #000 !important; background:' + (freq === 'M' || freq === 'MONTHLY' ? '#4a90e2' : 'transparent') + ';color:' + (freq === 'M' || freq === 'MONTHLY' ? '#fff' : '#000') + ';">' + (freq === 'M' || freq === 'MONTHLY' ? statusTxt : '') + '</td>' +
          '<td class="center bold" style="border: 1px solid #000 !important; background:' + (freq === '3M' ? '#4a90e2' : 'transparent') + ';color:' + (freq === '3M' ? '#fff' : '#000') + ';">' + (freq === '3M' ? statusTxt : '') + '</td>' +
          '<td class="center bold" style="border: 1px solid #000 !important; background:' + (freq === '6M' ? '#4a90e2' : 'transparent') + ';color:' + (freq === '6M' ? '#fff' : '#000') + ';">' + (freq === '6M' ? statusTxt : '') + '</td>' +
          '<td class="center bold" style="border: 1px solid #000 !important; background:' + (freq === '1Y' || freq === 'ANNUALLY' ? '#4a90e2' : 'transparent') + ';color:' + (freq === '1Y' || freq === 'ANNUALLY' ? '#fff' : '#000') + ';">' + (freq === '1Y' || freq === 'ANNUALLY' ? statusTxt : '') + '</td>' +
          '<td class="note-cell" style="border: 1px solid #000 !important;">' + esc(it.note) + '</td>' +
        '</tr>';
      });
    });
    return html;
  };

  const fccThead = '<thead>' +
    '<tr>' +
      '<th rowspan="2" style="width: 4%; border: 2px solid #0056b3 !important; font-size: 10px;">ល.រ</th>' +
      '<th style="width: 42%; border: 2px solid #0056b3 !important; padding: 5px; font-size: 12px;">តារាងត្រួតពិនិត្យជាប្រចាំ</th>' +
      '<th rowspan="2" style="width: 5%; border: 2px solid #0056b3 !important; padding: 0; position: relative; vertical-align: middle;">' +
        '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); white-space: nowrap; font-size: 9px; font-weight: bold;">រៀងរាល់សប្ដាហ៍</div>' +
      '</th>' +
      '<th rowspan="2" style="width: 5%; border: 2px solid #0056b3 !important; padding: 0; position: relative; vertical-align: middle;">' +
        '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); white-space: nowrap; font-size: 9px; font-weight: bold;">រៀងរាល់៣ខែ</div>' +
      '</th>' +
      '<th rowspan="2" style="width: 5%; border: 2px solid #0056b3 !important; padding: 0; position: relative; vertical-align: middle;">' +
        '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); white-space: nowrap; font-size: 9px; font-weight: bold;">រៀងរាល់៦ខែ</div>' +
      '</th>' +
      '<th rowspan="2" style="width: 5%; border: 2px solid #0056b3 !important; padding: 0; position: relative; vertical-align: middle;">' +
        '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); white-space: nowrap; font-size: 9px; font-weight: bold;">រៀងរាល់ឆ្នាំ</div>' +
      '</th>' +
      '<th rowspan="2" style="width: 34%; border: 2px solid #0056b3 !important; font-size: 10px;">កំណត់ចំណាំផ្សេងៗ</th>' +
    '</tr>' +
    '<tr>' +
      '<th style="font-weight: normal; font-size: 9px; border: 2px solid #0056b3 !important; padding: 4px; line-height: 1.3;">' +
        '<b>អក្សរកាត់:</b> <b>N</b>=ធម្មតា, <b>UF</b>=ត្រូវការជួសជុលបន្ទាន់, <br>' +
        '<b>NF</b>=ត្រូវការជួសជុល (អាចប្រើប្រាស់បណ្តោះអាសន្នបាន), <br>' +
        '<b>NA</b>=ត្រូវការតម្រូវ, <b>Ad</b>=បានបន្ថែម, <b>T</b>=បានរឹតបន្តឹង, <br>' +
        '<b>C</b>=បានសំអាត, <b>&#10004;</b>=ត្រឹមត្រូវ, <b>X</b>=មិនត្រឹមត្រូវ' +
      '</th>' +
    '</tr>' +
  '</thead>';

  // ─── E-SIGNATURE GENERATOR ───────────────────────────────
  const colWidth = '32%';

  const makeSig = (titleHTML, sigUrl, name, secondLabel, secondVal) => {
    return '<div class="sig-column" style="flex: 0 0 ' + colWidth + '; max-width: ' + colWidth + ';">' +
      '<div class="sig-title" style="font-weight:700; font-size:14px; text-align:center; margin-bottom:10px;">' + titleHTML + '</div>' +
      '<div class="sig-space" style="height:60px; display:flex; align-items:center; justify-content:center;">' +
        (sigUrl ? '<img class="sig-image" src="' + sigUrl + '" alt="sig" style="max-height:55px;">' : '') +
      '</div>' +
      '<div class="dotted-line" style="border-top:1px dashed #000; margin:5px 0;"></div>' +
      '<div class="sig-label-center" style="font-size:12px; text-align:center; margin-bottom:20px;">ហត្ថលេខា</div>' +
      '<div class="info-row" style="display:flex; font-size:12px; margin-bottom:8px;">' +
        '<span class="info-label" style="white-space:nowrap;">ឈ្មោះ:</span>' +
        '<div class="info-value" style="flex:1; border-bottom:1px dotted #000; margin-left:5px; text-align:center;">' + esc(name) + '</div>' +
      '</div>' +
      '<div class="info-row" style="display:flex; font-size:12px;">' +
        '<span class="info-label" style="white-space:nowrap;">' + secondLabel + '</span>' +
        '<div class="info-value" style="flex:1; border-bottom:1px dotted #000; margin-left:5px; text-align:center;">' + esc(secondVal) + '</div>' +
      '</div>' +
    '</div>';
  };

  // 👇 DYNAMIC TITLE BASED ON COMPANY 👇
  let managerTitle = 'អតិថិជន';
  let managerRole = 'ប្រធានសេវាដ្ឋាន';

  if (compName === 'PORT STEVEDORING COMPANY LIMITED') {
    managerTitle = 'អតិថិជន';
    managerRole = 'នាយកក្រុមហ៊ុន'; 
  } else if (compName === 'PMNT') {
    managerTitle = 'អតិថិជន';
    managerRole = 'នាយកគ្រប់គ្រង'; 
  }

  const managerTitleHTML =
    managerTitle +
    (sigManager ? '<img class="sig-sign-inline" src="' + sigManager + '" alt="sig" style="height:18px; vertical-align:middle; margin-left:4px;">' : '');

  const signaturesHTML =
    '<div class="signature-container" style="margin-top:20px;">' +
      '<div class="signature-row" style="display:flex; justify-content:space-between; gap:10px;">' +
        makeSig('ត្រួតពិនិត្យដោយ',  sigInspector, techName, 'តួនាទី:', 'ប្រធានក្រុម') +
        makeSig('អ្នកបើកបរ',          sigDriver,    drvName,  'ទូរស័ព្ទ:', drvPhone) +
        makeSig(managerTitleHTML,     sigDirector,  dirName,  'តួនាទី:', managerRole) + 
      '</div>' +
    '</div>';

  return '<div class="report-container">' +
    '<div class="top-row">' +
      '<div class="logo-block">' +
        (APP.logoDataUrl ? '<img class="pec-logo-img" src="' + APP.logoDataUrl + '" alt="Pec">' : '<div class="logo-pec">Pec</div>') +
      '</div>' +
      '<div class="logo-subtext">ផត អេឃ្វីបមិន ឯ.ក</div>' +
      '<div class="report-title-main">របាយការណ៍សេវាកម្ម</div>' +
      '<div class="address-block">' +
        'អាស័យដ្ឋាន: អាគារលេខ៦៤៩<br>' +
        'តិរចិព្រះស៊ីសុវត្ថិ សង្កាត់ស្រះចក<br>' +
        'ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ<br>' +
        'ទំនាក់ទំនង: +855 61 444 555/12 483 143' +
      '</div>' +
    '</div>' +
    '<div class="divider-bar"></div>' +
    '<div class="form-grid">' +
      '<div class="form-column col-left">' +
        '<div class="field-row"><span class="field-label">អតិថិជន:</span><div class="field-value-line">' + esc(sub.customer || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">លេខគ្រឿងចក្រ:</span><div class="field-value-line">' + esc(eqShortName) + '</div></div>' +
        '<div class="field-row"><span class="field-label">លេខកូដគ្រឿងចក្រ:</span><div class="field-value-line">' + esc(eqData.serialNumber || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">ម៉ោងគ្រឿងចក្រ:</span><div class="field-value-line">' + esc(sub.lastOpHour || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">អ្នកត្រួតពិនិត្យ:</span><div class="field-value-line">' + esc(sub.driverName || '') + '</div></div>' +
      '</div>' +
      '<div class="form-column col-right">' +
        '<div class="field-row"><span class="field-label">កាលបរិច្ឆេទ:</span><div class="field-value-line">' + esc(sub.date || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">របាយការណ៍លេខ:</span><div class="field-value-line">' + esc(sub.reportNo || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">ម៉ោងចាប់ផ្ដើម:</span><div class="field-value-line">' + esc(sub.timeIn || sub.time || '') + '</div></div>' +
        '<div class="field-row"><span class="field-label">ម៉ោងបញ្ចប់:</span><div class="field-value-line">' + esc(sub.timeOut || '') + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="text-align: center; font-size: 18px; font-weight: 500; margin-bottom: 20px; font-family: \'Moul\', \'Hanuman\', sans-serif;">' +
      'របាយការណ៍ថែទាំ ' + (isTCC ? 'TCC' : 'FCC') +
    '</div>' +
    '<table class="data-table" style="table-layout: fixed; width: 100%;">' + fccThead + '<tbody>' + renderRows(sections) + '</tbody></table>' +
    signaturesHTML +
  '</div>';
}

/*RTGReportDaily*/

function rtgReportStyles() {
  return `
  <style>
@import url('https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700&family=Roboto+Condensed:wght@400;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; font-family: 'Hanuman', 'Roboto Condensed', 'Roboto', sans-serif !important; }
    body { background: #fff; margin: 0; padding: 0; color: #000; }
    .report-container { width: 100%; max-width: none; margin: 0 auto; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
    
    .header-title { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 2px; color: #000; }
    .header-subtitle { text-align: center; font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #000; }
    
    .rtg-info-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; display: flex; flex-wrap: wrap; }
    .rtg-info-item { width: 50%; margin-bottom: 4px; font-size: 12px; display: flex; align-items: flex-end; }
    .rtg-info-label { font-weight: bold; white-space: nowrap; margin-right: 6px; }
    .rtg-info-value { border-bottom: 1px dotted #000; flex-grow: 1; text-align: center; min-height: 16px; padding-bottom: 1px; }

    /* Critical: Uses 'data-table' so ReportCore paginates it correctly */
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; margin-bottom: 6px; }
    .data-table thead { display: table-header-group; }
    .data-table tr { page-break-inside: avoid; }
    .data-table th, .data-table td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
    .data-table th { background: #f0f0f0; text-align: center; font-weight: bold; font-size: 11px; }
    
    .rtg-section-header { background: #e0e0e0; text-align: center; font-weight: bold; font-size: 11px; padding: 4px !important; }
    .item-cell { word-break: break-word; line-height: 1.2; }
    .item-eng { font-size: 8px; color: #444; }
    .center { text-align: center; }
    
    .signature-container { width: 100%; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start; page-break-inside: avoid; break-inside: avoid; }
    .sig-column { flex: 1; display: flex; flex-direction: column; align-items: center; margin: 0 10px; }
    .sig-title { font-size: 11px; font-weight: 700; color: #000; text-align: center; margin-bottom: 35px; min-height: 25px; }
    .sig-line { width: 100%; border-bottom: 1.5px dotted #000; margin-bottom: 5px; }
    .sig-name { font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 2px; }
    .sig-sub { font-size: 9px; color: #333; text-align: center; }
    
    .page-footer { flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px; margin-top: auto; padding-top: 10px; }
    .footer-bar { flex: 1 1 auto; height: 4px; background: #F5A623; border-radius: 1px; margin-bottom: 4px; }
    .page-number { font-size: 11px; font-weight: 700; color: #000; min-width: 24px; text-align: right; margin-bottom: 1px; }
    
    @media print { 
      @page { size: A4 portrait; margin: 7.94mm 7.41mm; } 
      html, body { width: auto !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
      .report-container { width: 100% !important; min-width: 0 !important; max-width: 100% !important; margin: 0 !important; } 
      .data-table th, .data-table td { border: 1px solid #000 !important; } 
      .data-table thead { display: table-header-group !important; } 
      .data-table tr { page-break-inside: avoid !important; break-inside: avoid !important; } 
    }
  </style>`;
}

function buildRTGReportBody(sub) {
  const tplMap = {};
  const headerBySection = {};

  const eqData = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
  const sg = eqData.specificGroup || '';
  const tplList = APP.templates[sub.group + '|' + sg] || APP.templates[sub.group + '|'] || APP.templates[sub.group] || [];
  
  tplList.forEach(t => {
    tplMap[t.itemId] = t;
    if (String(t.inputType).toLowerCase() === 'header') {
      headerBySection[String(t.itemId).trim()] = t;
    }
  });

  const sections = [];
  const seen = {};
  (sub.checks || []).forEach(c => {
    const sec = sectionOf(c.itemId);
    if (!seen[sec]) {
      seen[sec] = true;
      const h = headerBySection[sec];
      sections.push({ sid: sec, kh: h ? h.itemKhmer : '', en: h ? h.itemEng : '', items: [] });
    }
    const itemTpl = tplMap[c.itemId];
    sections[sections.length - 1].items.push({
      itemId: c.itemId,
      kh: itemTpl ? itemTpl.itemKhmer : c.itemId,
      en: itemTpl ? itemTpl.itemEng : '',
      status: c.status || '',
      note: c.note || ''
    });
  });

  const renderRows = (secs) => {
    let html = '';
    secs.forEach(sec => {
      // Section Header Row (colspan triggers ReportCore to treat it as a section block)
      if (sec.kh || sec.en) {
        html += `<tr><td colspan="8" class="rtg-section-header">${esc(sec.kh)} ${sec.en ? ' / ' + esc(sec.en) : ''}</td></tr>`;
      }

      for (let i = 0; i < sec.items.length; i += 2) {
        const it1 = sec.items[i];
        const it2 = sec.items[i + 1];

        const renderItemCells = (it) => {
          if (!it) return '<td></td><td></td><td></td><td></td>';
          const isOK = (it.status === 'OK');
          const isNOK = (it.status !== 'OK' && it.status !== ''); 
          
          return `
            <td class="item-cell">
              ${esc(it.kh).replace(/<br\/>/g, ' / ')}
              ${it.en ? `<div class="item-eng">${esc(it.en).replace(/<br\/>/g, ' / ')}</div>` : ''}
            </td>
            <td class="center bold" style="font-size: 14px; color: #000;">${isOK ? '✓' : ''}</td>
            <td class="center bold" style="font-size: 14px; color: #dc3545;">${isNOK ? '✓' : ''}</td>
            <td class="item-cell" style="font-size: 9px;">${esc(it.note)}</td>
          `;
        };

        html += `<tr>${renderItemCells(it1)}${renderItemCells(it2)}</tr>`;
      }
    });
    return html;
  };

  const thead = `<thead><tr>
    <th style="width: 33%;">Item</th>
    <th style="width: 5%;">OK</th>
    <th style="width: 5%;">No</th>
    <th style="width: 7%;">បញ្ហាយ (Note)</th>
    <th style="width: 33%;">Item</th>
    <th style="width: 5%;">OK</th>
    <th style="width: 5%;">No</th>
    <th style="width: 7%;">បញ្ហាយ (Note)</th>
  </tr></thead>`;

  return '<div class="report-container">' +
    `<div class="header-title">តារាងថែទាំរថស្ទូច ${esc(sub.group === 'RTG' ? 'RTG Kalmar' : sub.group)}</div>` +
    `<div class="header-subtitle">${esc(sub.group === 'RTG' ? 'RTG Kalmar' : sub.group)} Maintenance Checklist</div>` +
    
    `<div class="rtg-info-box">
      <div class="rtg-info-item"><span class="rtg-info-label">លេខរៀង (${esc(sub.group)} N°):</span><div class="rtg-info-value">${esc(sub.reportNo || '')}</div></div>
      <div class="rtg-info-item"><span class="rtg-info-label">ព្រឹត្តិបត្រពិនិត្យ (Check By):</span><div class="rtg-info-value">${esc(sub.driverName || '')}</div></div>
      <div class="rtg-info-item"><span class="rtg-info-label">ថ្ងៃខែឆ្នាំ (Date):</span><div class="rtg-info-value">${esc(sub.date || '')}</div></div>
      <div class="rtg-info-item"><span class="rtg-info-label">ម៉ោងម៉ាស៊ីន (Engine hour):</span><div class="rtg-info-value">${esc(sub.lastOpHour || '')}</div></div>
    </div>` +

    `<table class="data-table">` + thead + `<tbody>` + renderRows(sections) + `</tbody></table>` +

    `<div style="margin-top: 10px; font-size: 11px; font-weight: bold;">
      កត់ត្រាបន្ថែម (Comment): <span style="font-weight: normal;">${esc(sub.remark || '')}</span>
    </div>` +

    `<div class="signature-container">
      <div class="sig-column">
        <div class="sig-title">អ្នកត្រួតពិនិត្យ<br>(Inspector)</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(sub.driverName || '')}</div>
        <div class="sig-sub">Signature & Date</div>
      </div>
      <div class="sig-column">
        <div class="sig-title">ប្រធានក្រុម<br>(Supervisor)</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(sub.confirmedBy || '')}</div>
        <div class="sig-sub">Signature & Date</div>
      </div>
      <div class="sig-column">
        <div class="sig-title">នាយក<br>(Manager)</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(sub.directorBy || '')}</div>
        <div class="sig-sub">Signature & Date</div>
      </div>
    </div>` +
  '</div>';
}


/*ReportMonthly*/

/* =========================================================
   QR CODE GENERATOR (Used by Monthly Report)
   ========================================================= */
const _qrCache = {};
function getQrDataUrl(text) {
  if (!text) return '';
  if (_qrCache[text]) return _qrCache[text];
  try {
    if (typeof qrcode === 'undefined') return '';
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const url = qr.createDataURL(6, 0);
    _qrCache[text] = url;
    return url;
  } catch (e) {
    console.error('QR generation failed:', e);
    return '';
  }
}

/* =========================================================
   MONTHLY REPORT STYLES
   ========================================================= */
function monthlyReportStyles(){
  return `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700;900&family=Moul&family=Roboto+Condensed:wght@400;700&family=Roboto:wght@700&display=swap');

    @page { size: A4 portrait; margin: 10mm; }

    * { box-sizing: border-box; font-family: 'Hanuman','Roboto Condensed',Arial,sans-serif; }
    html, body {
      background: #fff; margin: 0; padding: 0; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      -webkit-text-size-adjust: none; text-size-adjust: none;
    }

    .mrpt {
      width: 190mm; max-width: 190mm;
      margin: 12mm auto; 
      padding: 10px 0 0 0; 
      color: #000; font-size: 10.5px; line-height: 1.4;
    }

    /* ---------- HEADER ---------- */
    .mrpt-header { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 2px; }
    .mrpt-logo-box { flex: 0 0 110px; display: flex; align-items: flex-start; }
    
    .mrpt-logo-img { display: block; height: 65px; width: auto; max-height: 65px; max-width: 120px; object-fit: contain; }
    .mrpt-logo-pec {
      font-family: Georgia, serif; font-size: 65px; font-weight: 900; font-style: italic;
      background: linear-gradient(180deg,#FFE44D 0%,#F5B800 50%,#D89A00 100%);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: #F5B800;
      line-height: 0.9; letter-spacing: -2px; padding-left: 4px;
    }
    
    .mrpt-company { flex: 1; text-align: center; padding-top: 4px; }
    .mrpt-company-kh { font-size: 16px; font-weight: 900; color: #1c3f5e; letter-spacing: 0.2px; margin-bottom: 2px; line-height: 1.6; padding: 2px 0; }
    .mrpt-company-en { font-family: 'Times New Roman', Times, serif; font-size: 16px; font-weight: 900; color: #1c3f5e; letter-spacing: 1px; }
    
    .mrpt-company-details { padding: 2px 0 4px; font-size: 9px; line-height: 1.4; }
    .mrpt-company-details b { font-weight: 700; }

    /* ---------- DOC TITLE ---------- */
    .mrpt-doc-title { text-align: center; font-size: 14px; font-weight: 900; padding: 4px 0 8px; letter-spacing: 0.3px; line-height: 1.6; }

    /* ---------- CUSTOMER INFO ---------- */
    .mrpt-customer { display: grid; grid-template-columns: 1fr auto; gap: 14px; padding: 4px 0 6px; font-size: 9px; line-height: 1.4; }
    .mrpt-customer-left, .mrpt-customer-right { display: flex; flex-direction: column; gap: 2px; }
    .mrpt-customer-right { text-align: left; }
    .mrpt-customer-row b { font-weight: 700; }

    /* ---------- TABLE ---------- */
    .mrpt-table thead { display: table-row-group; }
    .mrpt-table tr { page-break-inside: avoid; break-inside: avoid; }

    .mrpt-table {
      width: 100%;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed;
      border-top: 1px solid #333333 !important;
      border-left: 1px solid #333333 !important;
      margin-top: 4px;
    }
    .mrpt-table th, .mrpt-table td {
      border-right: 1px solid #333333 !important;
      border-bottom: 1px solid #333333 !important;
      padding: 0 7px;
      font-size: 10.5px;
      line-height: 1.4; 
      vertical-align: middle;
      color: #000;
      box-sizing: border-box !important;
    }

    .mrpt-table .mrpt-head-bar { background: #8B3A62; color: #ffffff; text-align: center; font-weight: 900; padding: 6px 6px; }
    .mrpt-table .mrpt-head-bar .kh { display: block; font-size: 13px; font-weight: 900; line-height: 1.5; }
    .mrpt-table .mrpt-head-bar .en { display: block; font-size: 12px; font-weight: 900; margin-top: 2px; }
    .mrpt-table .mrpt-colhead th { background: #f5e6ec; color: #000; font-weight: 700; text-align: center; padding: 4px 5px; font-size: 10px; }

    .mrpt-table tbody td { text-align: left; }
    .mrpt-table tbody td.center { text-align: center; }

    .mrpt-table tbody tr.mrpt-total-row td {
      background: #f5e6ec; font-weight: 700; text-align: center;
      padding: 10px 7px; 
      font-size: 10.5px; line-height: 1.4;
      border-right: 1px solid #000 !important;
      border-bottom: 1px solid #000 !important;
    }

    /* ---------- SIGNATURES ---------- */
    .mrpt-signatures-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 15px; page-break-inside: avoid; break-inside: avoid; }
    .mrpt-signatures-table td { border: none; padding: 0 3px; text-align: center; vertical-align: top; width: 25%; }
    .mrpt-signatures-table td.mrpt-sig-cell-wide { width: 30%; }
    .mrpt-signatures-table td.mrpt-sig-cell-narrow { width: 23.33%; }

    .mrpt-sig-text {
      font-family: 'Hanuman','Roboto Condensed',Arial,sans-serif !important;
      font-size: 12px !important; 
      font-weight: 400 !important;
      line-height: 1.5 !important; 
      color: #000 !important;
      letter-spacing: 0 !important; margin: 0 !important; padding: 0 !important;
      white-space: nowrap !important;
      -webkit-text-size-adjust: none !important; text-size-adjust: none !important;
    }
    .mrpt-sig-gap  { height: 45px; }
    .mrpt-sig-dots {
      font-size: 11px !important; 
      font-weight: 700 !important;
      letter-spacing: 0 !important; color: #000 !important; text-align: center;
      line-height: 1 !important; margin: 0 0 2px 0;
      white-space: nowrap; overflow: hidden; width: 100%; user-select: none;
    }

    /* ---------- PRINT ---------- */
    @media print {
      @page { size: A4 portrait; margin: 0 !important; }
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { padding: 10mm 10mm 18mm 10mm !important; }

      .mrpt-table {
        border-collapse: separate !important; border-spacing: 0 !important;
        border-top: 1px solid #000 !important; border-left: 1px solid #000 !important;
      }
      .mrpt-table thead { display: table-row-group !important; }
      .mrpt-table th, .mrpt-table td {
        border-right: 1px solid #333333 !important;
        border-bottom: 1px solid #333333 !important;
        box-sizing: border-box !important;
      }
      .mrpt-table tbody tr.mrpt-total-row td {
        background: #f5e6ec !important;
        border-right: 1px solid #000 !important;
        border-bottom: 1px solid #000 !important;
      }
      .mrpt-table .mrpt-head-bar { background: #8B3A62 !important; color: #fff !important; }
      .mrpt-table .mrpt-colhead th { background: #f5e6ec !important; }
      .mrpt-table tr, .mrpt-signatures-table { page-break-inside: avoid !important; break-inside: avoid !important; }

      .mrpt { width: 190mm !important; max-width: 190mm !important; margin: 0 auto !important; }

      .mrpt-sig-dots { color: #000 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .mrpt-sig-text { font-size: 12px !important; font-weight: 400 !important; } 
    }
  </style>`;
}

/* =========================================================
   MONTHLY REPORT BUILDING
   ========================================================= */
function buildMonthlyReportBody(ym){
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const myGroup = isManagerViewing ? (window.managerReportGroup || 'រថយន្ត') : currentUser.group;

  const isAfter = window.techReportForm === 'after';
  const reportTitleKh = isAfter ? 'តារាងបូកសរុបការងារក្នុងកញ្ចប់ទី២' : 'តារាងបូកសរុបការងារក្នុងកញ្ចប់ទី១';
  const tableHeadKh = isAfter ? 'ទិន្នន័យក្នុង កញ្ចប់ទី2' : 'ទិន្នន័យក្នុង កញ្ចប់ទី1';
  const tableHeadEn = isAfter ? 'After Inspection' : 'Monthly Inspection';

  const rawEqList = APP.equipment || [];
  const seen = new Set();
  const eqList = [];
  rawEqList.forEach(e => {
    if (!e || !e.equipmentId) return;
    if (seen.has(e.equipmentId)) return;
    seen.add(e.equipmentId);
    eqList.push(e);
  });

  const monthSubs = (APP.submissions || []).filter(s =>
    s.group === myGroup && isInMonth(s.date, ym)
  );

  const checkedIds = new Set(monthSubs.map(s => s.equipmentId));
  const checkedEqList = eqList.filter(e => checkedIds.has(e.equipmentId));

  const [y, m]   = ym.split('-');
  const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
  const monthKh  = khMonths[parseInt(m, 10) - 1];
  const lastDay  = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  const periodStr = '01 ដល់ ' + String(lastDay).padStart(2, '0') + ' ខែ ' + monthKh + ' ឆ្នាំ ' + y;

  const rptDate = parseDmyToDate(formatIsoToDmy(homeReportDate));
  const monEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = String(rptDate.getDate()).padStart(2,'0') + '-' +
                  monEn[rptDate.getMonth()] + '-' + rptDate.getFullYear();

  const trailerMap = {};
  (APP.trailers || []).forEach(t => {
    if (!t || !t.trailerId) return;
    trailerMap[t.trailerId] = t.shortName || t.trailerId;
  });

  const latestSubByEq = {};
  monthSubs.forEach(s => {
    const prev = latestSubByEq[s.equipmentId];
    if (!prev || subMs(s) > subMs(prev)) latestSubByEq[s.equipmentId] = s;
  });

  const rowsHtml = checkedEqList.map((eq, i) => {
    const sub = latestSubByEq[eq.equipmentId];
    const trailerId = sub ? String(sub.trailerPlateNo || '').trim() : '';
    const trailerShort = trailerId ? (trailerMap[trailerId] || trailerId) : '';

    const tdBase = 'border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;padding:0 7px;vertical-align:middle;font-size:10.5px;line-height:1.4;color:#000;box-sizing:border-box;';
    const tdC    = tdBase + 'text-align:center;';

    const pdfFileId = sub ? String(sub.pdfFileId || '').trim() : '';
    let targetPdfId = '';
    
    // 👇 Dynamically pick the ID based on the active form
    if (pdfFileId) {
      const ids = pdfFileId.split(',').map(s => s.trim());
      if (window.techReportForm === 'after') {
        targetPdfId = ids[1] || ''; // Use After Inspection ID (2nd)
      } else {
        targetPdfId = ids[0] || ''; // Use Standard ID (1st)
      }
    }
    
    const pdfHref = targetPdfId ? ('https://drive.google.com/file/d/' + targetPdfId + '/view') : '';
    const qrDataUrl = pdfHref ? getQrDataUrl(pdfHref) : '';

    const qrCell = qrDataUrl
      ? '<a href="' + escAttr(pdfHref) + '" target="_blank" rel="noopener" style="display:block;text-decoration:none;">' +
          '<img src="' + escAttr(qrDataUrl) + '" alt="QR" ' +
            'style="display:block;width:20mm;height:20mm;margin:0 auto;object-fit:contain;">' +
        '</a>'
      : '<span style="color:#6c757d;">-</span>';

    return '<tr style="height: 29.4mm;">' +
      '<td style="' + tdC + '">' + (i + 1) + '</td>' +
      '<td style="' + tdC + '">' + esc(eq.shortName || eq.equipmentId) + '</td>' +
      '<td style="' + tdC + '">' + esc(trailerShort) + '</td>' +
      '<td style="' + tdC + '">1</td>' +
      '<td style="' + tdC + '">ឈុត</td>' +
      '<td style="' + tdC + ';padding:0 4px;vertical-align:middle;">' + qrCell + '</td>' +
    '</tr>';
  }).join('');

  const totalRow =
    '<tr class="mrpt-total-row">' +
      '<td colspan="3" style="background:#f5e6ec;font-weight:700;text-align:center;padding:10px 7px;border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;box-sizing:border-box;font-size:10.5px;line-height:1.4;">សរុបចំនួនឡាន</td>' +
      '<td style="background:#f5e6ec;font-weight:700;text-align:center;padding:10px 7px;border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;box-sizing:border-box;font-size:10.5px;line-height:1.4;">' + checkedEqList.length + '</td>' +
      '<td style="background:#f5e6ec;font-weight:700;text-align:center;padding:10px 7px;border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;box-sizing:border-box;font-size:10.5px;line-height:1.4;">ឈុត</td>' +
      '<td style="background:#f5e6ec;border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;box-sizing:border-box;"></td>' +
    '</tr>';

  const customerStyle  = 'display:grid;grid-template-columns:1fr auto;gap:14px;padding:4px 0 6px;font-size:9px;line-height:1.4;';
  const custLeftStyle  = 'display:flex;flex-direction:column;gap:2px;';
  const custRightStyle = 'display:flex;flex-direction:column;gap:2px;text-align:left;';

  const cellBorder   = 'border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;box-sizing:border-box;';
  const colStyleBase = 'background:#f5e6ec;color:#000;font-weight:700;text-align:center;padding:4px 5px;font-size:10px;';

  const lineStyle = 'font-family:\'Hanuman\',\'Roboto Condensed\',Arial,sans-serif;' +
                    'font-size:12px;font-weight:400;line-height:1.5;color:#000;' + 
                    'letter-spacing:0;margin:0;padding:0;white-space:nowrap;' +
                    '-webkit-text-size-adjust:none;text-size-adjust:none;';

  const dotLine =
    '<div class="mrpt-sig-dots" style="font-size:11px;font-weight:700;letter-spacing:0;color:#000;' +
      'text-align:center;line-height:1;white-space:nowrap;overflow:hidden;width:100%;margin:0 0 2px 0;user-select:none;">' +
      '............................................................' +
    '</div>';

  const sigGap = '<div class="mrpt-sig-gap" style="height:45px;"></div>';

  const sigCol1 =
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center; font-weight: 700 !important;">អនុញ្ញាតដោយ</div>' +
    sigGap + dotLine +
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center;">ហត្ថលេខា</div>' +
    '<div style="text-align: left; display: inline-block; margin-top: 2px;">' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">ឈ្មោះ: <span style="font-weight: 700 !important;">យ៉ឹម ជឿន</span></div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">តួនាទី: នាយកក្រុមហ៊ុន</div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">កាលបរិច្ឆេទ: ..................................</div>' +
    '</div>';

  const sigCol2 =
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center; font-weight: 700 !important;">ត្រូតពិនិត្យដោយ</div>' +
    sigGap + dotLine +
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center;">ហត្ថលេខា</div>' +
    '<div style="text-align: left; display: inline-block; margin-top: 2px;">' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">ឈ្មោះ: <span style="font-weight: 700 !important;">អ៊ុច សាំងឡី</span></div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">តួនាទី: ផ្នែកបច្ចេកទេស</div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">កាលបរិច្ឆេទ: ..................................</div>' +
    '</div>';

  const sigCol3 =
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center; font-weight: 700 !important;">អតិថិជន</div>' +
    sigGap + dotLine +
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center;">ហត្ថលេខា</div>' +
    '<div style="text-align: left; display: inline-block; margin-top: 2px;">' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">ឈ្មោះ: <span style="font-weight: 700 !important;">ហៃ ម៉ារ៉ាឌី</span></div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">តួនាទី: ប្រធានសេវាដ្ឋាន</div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">កាលបរិច្ឆេទ: ..................................</div>' +
    '</div>';

  const sigCol4 =
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center; font-weight: 700 !important;">អនុញ្ញាតដោយ</div>' +
    sigGap + dotLine +
    '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center;">ហត្ថលេខា</div>' +
    '<div style="text-align: left; display: inline-block; margin-top: 2px;">' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">ឈ្មោះ: <span style="font-weight: 700 !important;">សេង គន្ធា</span></div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">តួនាទី: អគ្គនាយករងបច្ចេកទេស</div>' +
      '<div class="mrpt-sig-text" style="' + lineStyle + '">កាលបរិច្ឆេទ: ..................................</div>' +
    '</div>';

  const signaturesTable =
    '<table class="mrpt-signatures-table" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:15px;">' +
      '<tr>' +
        '<td class="mrpt-sig-cell-narrow" style="width:23.33%;padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sigCol1 + '</td>' +
        '<td class="mrpt-sig-cell-narrow" style="width:23.33%;padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sigCol2 + '</td>' +
        '<td class="mrpt-sig-cell-narrow" style="width:23.33%;padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sigCol3 + '</td>' +
        '<td class="mrpt-sig-cell-wide"   style="width:30%;padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sigCol4 + '</td>' +
      '</tr>' +
    '</table>';

  return '' +
  '<div class="mrpt">' +
    '<div class="mrpt-header" style="position:relative; text-align:center; padding: 5px 0; min-height: 75px; display: flex; align-items: center; justify-content: center;">' +
      '<div style="position:absolute; left:0; top:50%; transform:translateY(-50%);">' +
        (APP.logoDataUrl
          ? '<img class="mrpt-logo-img" src="' + APP.logoDataUrl + '" alt="Pec" style="display:block;height:65px;width:auto;max-height:65px;max-width:120px;object-fit:contain;">'
          : '<div class="mrpt-logo-pec" style="font-size:65px; line-height:1;">Pec</div>') +
      '</div>' +
      '<div class="mrpt-company" style="display:block;">' +
        '<div style="font-family: \'Moul\', cursive; font-size: 16px; line-height: 1.6; padding: 2px 0; margin-bottom: 2px; color: #1d4370;">ក្រុមហ៊ុន ផត អេឃ្វីបមិន ឯ.ក</div>' +
        '<div style="font-family: \'Roboto\', \'Times New Roman\', serif; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; color: #1d4370;">PORT EQUIPMENT CO., LTD.</div>' +
      '</div>' +
    '</div>' +

    '<div class="mrpt-company-details" style="padding:2px 0 4px;font-size:9px;line-height:1.4;">' +
      '<div><b>លេខ អតប/VAT TIN:</b> L001-902202480</div>' +
      '<div><b>អាស័យដ្ឋាន:</b> អគារលេខ៦៤៩ បន្ទប់លេខ៣០៨ តិរវិថីព្រះស៊ីសុវត្ថិ សង្កាត់ស្រះចក </Br>ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</div>' +
      '<div><b>Address:</b> #649, Room 308, Preah Sisowath St, Sras Chork, Daunpenh, Phnom Penh</div>' +
      '<div><b>ទូរស័ព្ទ:</b> +៨៥៥ ៦១ ៤៤៤ ៥៥៥ / ១០ ៤៤៤ ៨៦៨</div>' +
      '<div><b>Phone:</b> +855 61 444 555 / 10 444 868</div>' +
    '</div>' +

    '<div style="text-align: center; padding: 4px 0 8px 0;">' +
      '<div style="text-align: center; padding: 4px 0 8px 0;">' +
      '<span style="font-family: \'Moul\', cursive; font-size: 14px; color: #000000; line-height: 1.6;">' + reportTitleKh + '</span>' +
      '</div>' +
    '</div>' +

    '<div class="mrpt-customer" style="' + customerStyle + '">' +
      '<div class="mrpt-customer-left" style="' + custLeftStyle + '">' +
        '<div class="mrpt-customer-row"><b>ឈ្មោះក្រុមហ៊ុន ឬអតិថិជន:</b> កំពង់ផែស្វយ័តភ្នំពេញ</div>' +
        '<div class="mrpt-customer-row"><b>Company Name/Customer:</b> PHNOM PENH AUTONOMOUS PORT</div>' +
        '<div class="mrpt-customer-row"><b>អាស័យដ្ឋាន:</b> អគារលេខ៦៤៩ តិរវិថីព្រះស៊ីសុវត្ថិ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</div>' +
        '<div class="mrpt-customer-row"><b>លេខ អតប(VAT TIN):</b> L001-100044999</div>' +
        '<div class="mrpt-customer-row"><b>លេខទំនាក់ទំនង/Phone:</b> +855 23 427 802 / 10 444 641</div>' +
      '</div>' +
      '<div class="mrpt-customer-right" style="' + custRightStyle + '">' +
        '<div class="mrpt-customer-row"><b>កាលបរិច្ឆេទ/Date on:</b> ' + esc(dateStr) + '</div>' +
        '<div class="mrpt-customer-row"><b>ផ្តល់សេវាកម្ម ចាប់ពី:</b> ' + esc(periodStr) + '</div>' +
      '</div>' +
    '</div>' +

    '<table class="mrpt-table" style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border-top:1px solid #333333 !important;border-left:1px solid #333333 !important;margin-top:4px;">' +
      '<colgroup>' +
        '<col style="width: 5%;">' +
        '<col style="width: 25%;">' +
        '<col style="width: 25%;">' +
        '<col style="width: 10%;">' +
        '<col style="width: 10%;">' +
        '<col style="width: 25%;">' +
      '</colgroup>' +
      '<thead>' +
        '<tr>' +
          '<th colspan="6" class="mrpt-head-bar" style="background:#8B3A62;color:#ffffff;text-align:center;font-weight:900;padding:6px 6px;line-height:1.4;' + cellBorder + '">' +
            '<span style="display:block;font-size:13px;font-weight:900;color:#ffffff;">' + tableHeadKh + '</span>' +
            '<span style="display:block;font-size:12px;font-weight:900;color:#ffffff;margin-top:2px;">' + tableHeadEn + '</span>' +
          '</th>' +
        '</tr>' +
        '<tr class="mrpt-colhead">' +
          '<th style="' + colStyleBase + cellBorder + '">ល.រ</th>' +
          '<th style="' + colStyleBase + cellBorder + '">រថយន្ត</th>' +
          '<th style="' + colStyleBase + cellBorder + '">រ៉ឹម៉ក</th>' +
          '<th style="' + colStyleBase + cellBorder + '">ចំនួនការងារ</th>' +
          '<th style="' + colStyleBase + cellBorder + '">ឯកតា</th>' +
          '<th style="' + colStyleBase + cellBorder + '">QR</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        (rowsHtml || '<tr><td colspan="6" style="padding:18px;color:#6c757d;text-align:center;border-right:1px solid #333333 !important;border-bottom:1px solid #333333 !important;">No equipment checked this month</td></tr>') +
        totalRow +
      '</tbody>' +
    '</table>' +

    signaturesTable +
  '</div>';
}

function buildTCCMonthlyReportBody(ym) {
  // 👇 1. Determine the ACTUAL group to render 👇
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const myGroup = isManagerViewing ? (window.managerReportGroup || 'TCC&FCC') : currentUser.group;
  
  // 👇 2. Determine the company filter (same value the Report tab shows) 👇
  const selectedCompany = tccSelectedCompany();
  
  // 👇 3. Filter submissions using the correct group and company 👇
  const monthSubs = (APP.submissions || []).filter(s => {
    if (s.group !== myGroup || !isInMonth(s.date, ym)) return false;
    if (selectedCompany === 'ALL') return true; 
    const eqData = APP.equipmentMap[s.equipmentId] || {};
    return tccNormCompany(eqData.companyName) === selectedCompany;
  }).sort((a, b) => parseDmyToMs(a.date) - parseDmyToMs(b.date)); 


  const [y, m]   = ym.split('-');
  const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
  const monthKh  = khMonths[parseInt(m, 10) - 1];
  const lastDay  = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  const periodStr = '01 ដល់ ' + String(lastDay).padStart(2, '0') + ' ខែ ' + monthKh + ' ឆ្នាំ ' + y;

  const rptDate = parseDmyToDate(formatIsoToDmy(homeReportDate));
  const monEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = String(rptDate.getDate()).padStart(2,'0') + '-' + monEn[rptDate.getMonth()] + '-' + rptDate.getFullYear();

  const tdBase = 'border-right:1px solid #333333 !important; border-bottom:1px solid #333333 !important; padding:0 7px; vertical-align:middle; font-size:10.5px; line-height:1.4; color:#000; box-sizing:border-box; text-align:center;';
  const thBase = 'background:#f5e6ec; color:#000; font-weight:700; text-align:center; padding:4px 5px; font-size:10px; border-right:1px solid #333333 !important; border-bottom:1px solid #333333 !important;';

  const rowsHtml = monthSubs.map((sub, i) => {
    const eqData = (APP.equipmentMap && APP.equipmentMap[sub.equipmentId]) ? APP.equipmentMap[sub.equipmentId] : {};
    const serialNo = eqData.serialNumber || sub.equipmentId;
    const checkCount = sub.checks ? sub.checks.filter(c => c.status && String(c.status).trim() !== '').length : 0;
    const otherInfo = eqData.shortName || sub.equipmentId;

    const formattedDate = (function() {
      const d = parseDmyToDate(sub.date);
      if (!d) return esc(sub.date);
      return String(d.getDate()).padStart(2, '0') + '-' + monEn[d.getMonth()] + '-' + d.getFullYear();
    })();

    const pdfFileId = sub ? String(sub.pdfFileId || '').trim() : '';
    const stdPdfId = pdfFileId ? String(pdfFileId).split(',')[0].trim() : '';
    const pdfHref = stdPdfId ? ('https://drive.google.com/file/d/' + stdPdfId + '/view') : '';
    const qrDataUrl = pdfHref ? getQrDataUrl(pdfHref) : '';
    
    const qrCell = qrDataUrl
      ? '<a href="' + escAttr(pdfHref) + '" target="_blank" rel="noopener" style="display:block;text-decoration:none;">' +
          '<img src="' + escAttr(qrDataUrl) + '" alt="QR" style="display:block;width:20mm;height:20mm;margin:0 auto;object-fit:contain;">' +
        '</a>'
      : '<span style="color:#6c757d;">-</span>';

    return '<tr style="height: 29.4mm;">' +
      '<td style="' + tdBase + '">' + (i + 1) + '</td>' +
      '<td style="' + tdBase + '">' + formattedDate + '</td>' +
      '<td style="' + tdBase + '">S/N: ' + esc(serialNo) + '</td>' +
      '<td style="' + tdBase + '">' + checkCount + '</td>' +
      '<td style="' + tdBase + '">មុខ</td>' +
      '<td style="' + tdBase + '">' + esc(otherInfo) + '</td>' +
      '<td style="' + tdBase + ' padding: 0 4px;">' + qrCell + '</td>' +
    '</tr>';
  }).join('');

  // ==========================================
  // DYNAMIC HEADER & SIGNATURES
  // ==========================================
  let reportTitle = '';
  let customerNameKh = '';
  let customerNameEn = '';
  let customerAddress = '';
  let customerAddressEn = ''; // 👈 FIXED: Added missing variable
  let customerVat = '';
  let customerPhone = '';
  let is4Sigs = false; // 👈 NEW: Track if we need 4 signatures

  const lineStyle = 'font-family:\'Hanuman\',\'Roboto Condensed\',Arial,sans-serif;font-size:12px;font-weight:400;line-height:1.5;color:#000;letter-spacing:0;margin:0;padding:0;white-space:nowrap;';
  const dotLine = '<div class="mrpt-sig-dots" style="font-size:11px;font-weight:700;letter-spacing:0;color:#000;text-align:center;line-height:1;white-space:nowrap;overflow:hidden;width:100%;margin:0 0 2px 0;user-select:none;">............................................................</div>';
  const sigGap = '<div class="mrpt-sig-gap" style="height:45px;"></div>';

  const makeSigCol = (title, name, role) => {
    return '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center; font-weight: 700 !important;">' + title + '</div>' +
      sigGap + dotLine +
      '<div class="mrpt-sig-text" style="' + lineStyle + ' text-align: center;">ហត្ថលេខា</div>' +
      '<div style="text-align: left; display: inline-block; margin-top: 2px;">' +
        '<div class="mrpt-sig-text" style="' + lineStyle + '">ឈ្មោះ: <span style="font-weight: 700 !important;">' + name + '</span></div>' +
        '<div class="mrpt-sig-text" style="' + lineStyle + '">តួនាទី: ' + role + '</div>' +
        '<div class="mrpt-sig-text" style="' + lineStyle + '">កាលបរិច្ឆេទ: ..................................</div>' +
      '</div>';
  };

  let sig1, sig2, sig3, sig4;

  if (selectedCompany === 'ALL') {
    // 👈 "All" company: every company in TCC&FCC is merged into one summary report
    reportTitle = 'របាយការណ៍បូកសរុបការងារថែទាំ TCC&FCC ប្រចាំខែ';
    customerNameKh = 'ក្រុមហ៊ុនទាំងអស់ (PPAP / PMNT / Port Stevedoring)';
    customerNameEn = 'ALL COMPANIES (PPAP / PMNT / PORT STEVEDORING)';
    customerAddress = '—';
    customerAddressEn = '—';
    customerVat = '—';
    customerPhone = '—';
    is4Sigs = true; // 👈 4 Signatures (internal approval team)

    sig1 = makeSigCol('អនុញ្ញាតដោយ', 'យ៉ឹម ជឿន', 'នាយកក្រុមហ៊ុន');
    sig2 = makeSigCol('ត្រូតពិនិត្យដោយ', 'អ៊ុច សាំងឡី', 'ប្រធានក្រុម');
    sig3 = makeSigCol('អតិថិជន', 'ហៃ ម៉ារ៉ាឌី', 'ប្រធានសេវាដ្ឋាន');
    sig4 = makeSigCol('អនុញ្ញាតដោយ', 'សេង គន្ធា', 'អគ្គនាយករដ្ឋបច្ចេកទេស');

  } else if (selectedCompany === 'PORT STEVEDORING COMPANY LIMITED') {
    reportTitle = 'របាយការណ៍បូកសរុបការងារថែទាំ FCC ប្រចាំខែ';
    customerNameKh = 'ផត ស្ទេវដរីង ឯ.ក';
    customerNameEn = 'PORT STEVEDORING COMPANY LIMITED';
    customerAddress = 'ផ្ទះលេខ ៤៩D ផ្លូវលេខ ២១៤​ សង្កាត់ បឹងរាំង ខណ្ឌ ដូនពេញ រាជធានីភ្នំពេញ';
    customerAddressEn = '#49D, St, 214, Sangkat Boeng Raing, Khan Daun Penh, Phnom Penh';
    customerVat = 'K003-902004154';
    customerPhone = '+855 89 987 709';
    is4Sigs = false; // 👈 3 Signatures

    sig1 = makeSigCol('អនុញ្ញាតដោយ', 'Name 1', 'នាយកក្រុមហ៊ុន');
    sig2 = makeSigCol('ត្រូតពិនិត្យដោយ', 'Name 2', 'ប្រធានក្រុម');
    sig3 = makeSigCol('អតិថិជន', 'Name 3', 'នាយកក្រុមហ៊ុន');
    sig4 = '';

  } else if (selectedCompany === 'PMNT') {
    reportTitle = 'របាយការណ៍បូកសរុបការងារថែទាំ FCC ប្រចាំខែ';
    customerNameKh = 'ក្រុមហ៊ុន PMNT';
    customerNameEn = 'PMNT';
    customerAddress = 'XXXX'; 
    customerAddressEn = 'XXXX'; // 👈 FIXED: Missing quote
    customerVat = 'K001-XXXXXXX'; 
    customerPhone = '+855 XX XXX XXX'; 
    is4Sigs = false; // 👈 3 Signatures

    sig1 = makeSigCol('អនុញ្ញាតដោយ', 'Name 1', 'នាយកក្រុមហ៊ុន');
    sig2 = makeSigCol('ត្រូតពិនិត្យដោយ', 'Name 2', 'ប្រធានក្រុម');
    sig3 = makeSigCol('អតិថិជន', 'Name 3', 'នាយកក្រុមហ៊ុន');
    sig4 = '';

  } else {
    // Default to PPAP
    reportTitle = 'របាយការណ៍បូកសរុបការងារថែទាំ TCC&FCC ប្រចាំខែ';
    customerNameKh = 'កំពង់ផែស្វយ័តភ្នំពេញ';
    customerNameEn = 'PHNOM PENH AUTONOMOUS PORT';
    customerAddress = 'អគារលេខ៦៤៩ តិរវិថីព្រះស៊ីសុវត្ថិ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ';
    customerAddressEn = '#649, Preah Sisowath Street, Sras Chork Commune, Daun Penh District, Phnom Penh';
    customerVat = 'L001-100044999';
    customerPhone = '+855 23 427 802 / 70 465 659';
    is4Sigs = true; // 👈 4 Signatures

    sig1 = makeSigCol('អនុញ្ញាតដោយ', 'យ៉ឹម ជឿន', 'នាយកក្រុមហ៊ុន');
    sig2 = makeSigCol('ត្រូតពិនិត្យដោយ', 'អ៊ុច សាំងឡី', 'ប្រធានក្រុម');
    sig3 = makeSigCol('អតិថិជន', 'ហៃ ម៉ារ៉ាឌី', 'ប្រធានសេវាដ្ឋាន');
    sig4 = makeSigCol('អនុញ្ញាតដោយ', 'សេង គន្ធា', 'អគ្គនាយករដ្ឋបច្ចេកទេស');
  }

  // 👇 DYNAMICALLY ADJUST COLUMN WIDTHS BASED ON SIGNATURE COUNT 👇
  const colWidth = is4Sigs ? '23.33%' : '33.33%';
  const wideWidth = '30%';

  const signaturesTable =
    '<table class="mrpt-signatures-table" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:15px;">' +
      '<tr>' +
        '<td class="mrpt-sig-cell-narrow" style="width:' + colWidth + ';padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sig1 + '</td>' +
        '<td class="mrpt-sig-cell-narrow" style="width:' + colWidth + ';padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sig2 + '</td>' +
        '<td class="mrpt-sig-cell-narrow" style="width:' + colWidth + ';padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sig3 + '</td>' +
        (is4Sigs ? '<td class="mrpt-sig-cell-wide" style="width:' + wideWidth + ';padding:0 3px;text-align:center;vertical-align:top;border:none;">' + sig4 + '</td>' : '') +
      '</tr>' +
    '</table>';

  return '' +
  '<div class="mrpt" style="font-family: \'Hanuman\', sans-serif;">' +
    '<div class="mrpt-header" style="position:relative; text-align:center; padding: 5px 0; min-height: 75px; display: flex; align-items: center; justify-content: center;">' +
      '<div style="position:absolute; left:0; top:50%; transform:translateY(-50%);">' +
        (APP.logoDataUrl
          ? '<img class="mrpt-logo-img" src="' + APP.logoDataUrl + '" alt="Pec" style="display:block;height:65px;width:auto;max-height:65px;max-width:120px;object-fit:contain;">'
          : '<div class="mrpt-logo-pec" style="font-size:65px; line-height:1;">Pec</div>') +
      '</div>' +
      '<div class="mrpt-company" style="display:block;">' +
        '<div style="font-family: \'Moul\', cursive; font-size: 16px; line-height: 1.6; padding: 2px 0; margin-bottom: 2px; color: #1d4370;">ក្រុមហ៊ុន ផត អេឃ្វីបមិន ឯ.ក</div>' +
        '<div style="font-family: \'Roboto\', \'Times New Roman\', serif; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; color: #1d4370;">PORT EQUIPMENT CO., LTD.</div>' +
      '</div>' +
    '</div>' +

    '<div class="mrpt-company-details" style="padding:2px 0 4px;font-size:9px;line-height:1.4;">' +
      '<div><b>លេខ អតប/VAT TIN:</b> L001-902202480</div>' +
      '<div><b>អាស័យដ្ឋាន:</b> អគារលេខ៦៤៩ បន្ទប់លេខ៣០៨ តិរវិថីព្រះស៊ីសុវត្ថិ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</div>' +
      '<div><b>Address:</b> #649, Room 308, Preah Sisowath St, Sras Chork, Daunpenh, Phnom Penh</div>' +
      '<div><b>ទូរស័ព្ទ:</b> +៨៥៥ ៦១ ៤៤៤ ៥៥៥ / ១០ ៤៤៤ ៨៦៨</div>' +
      '<div><b>Phone:</b> +855 61 444 555 / 70 465 659</div>' +
    '</div>' +

    '<div style="text-align: center; padding: 4px 0 8px 0;">' +
      '<span style="font-family: \'Moul\', cursive; font-size: 14px; color: #000000;">' + reportTitle + '</span>' +
    '</div>' +

    '<div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px;">' +
      '<div>' +
        '<div><b>ឈ្មោះក្រុមហ៊ុន ឬអតិថិជន:</b> ' + customerNameKh + '</div>' +
        '<div><b>Company Name/Customer:</b> ' + customerNameEn + '</div>' +
        '<div class="mrpt-customer-row"><b>អាស័យដ្ឋាន:</b> ' + customerAddress + '</div>' +
        '<div class="mrpt-customer-row"><b>Address:</b> ' + customerAddressEn + '</div>' +
        '<div class="mrpt-customer-row"><b>លេខ អតប(VAT TIN):</b> ' + customerVat + '</div>' +
        '<div class="mrpt-customer-row"><b>លេខទំនាក់ទំនង/Phone:</b> ' + customerPhone + '</div>' +
      '</div>' +
      '<div style="text-align: right;">' +
        '<div><b>កាលបរិច្ឆេទ/Date on:</b> ' + esc(dateStr) + '</div>' +
        '<div><b>ផ្តល់សេវាកម្មចាប់ពី:</b> ' + esc(periodStr) + '</div>' +
      '</div>' +
    '</div>' +

    '<table class="mrpt-table" style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;">' +
      '<thead>' +
        '<tr>' +
          '<th style="' + thBase + ' width: 5%;">ល.រ</th>' +
          '<th style="' + thBase + ' width: 20%;">កាលបរិច្ឆេទចុះត្រួតពិនិត្យ</th>' +
          '<th style="' + thBase + ' width: 20%;">លេខកូដគ្រឿងចក្រ</th>' +
          '<th style="' + thBase + ' width: 10%;">ចំនួនការងារ</th>' +
          '<th style="' + thBase + ' width: 10%;">ឯកតា</th>' +
          '<th style="' + thBase + ' width: 15%;">ផ្សេងៗ</th>' +
          '<th style="' + thBase + ' width: 20%;">QR</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        (rowsHtml || '<tr><td colspan="7" style="' + tdBase + ' text-align: center; padding: 10px;">No checklists this month for ' + esc(selectedCompany === 'ALL' ? 'all companies' : tccCompanyLabel(selectedCompany)) + '</td></tr>') +
      '</tbody>' +
    '</table>' +

    signaturesTable +
  '</div>';
}

function buildMonthlyReportHTML(ym){
  // 👇 Same group resolution as generateMonthlyReportOutput() 👇
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const targetGroup = String((isManagerViewing ? (window.managerReportGroup || 'រថយន្ត') : currentUser.group) || '').trim();
  const reportBody = targetGroup === 'TCC&FCC' ? buildTCCMonthlyReportBody(ym) : buildMonthlyReportBody(ym);

  return '<!DOCTYPE html>' +
    '<html lang="km"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Monthly Inspection Report</title>' +
    monthlyReportStyles() +
    '</head><body>' + reportBody + '</body></html>';
}

async function generateMonthlyReportOutput(ym, mode) {
  if (typeof html2canvas === 'undefined') {
    showAlert('html2canvas not loaded — please refresh.', 'danger');
    return;
  }
  if (mode === 'pdf' && (!window.jspdf || !window.jspdf.jsPDF)) {
    showAlert('PDF libraries not loaded — please refresh.', 'danger');
    return;
  }

  showLoading(mode === 'print' ? 'កំពុងបង្កើត...' : 'កំពុងបង្កើត PDF...');
  await new Promise(r => setTimeout(r, 30));

  // Determine which report to build
  const isManagerViewing = (currentUser.role === 'manager' || currentUser.role === 'manager-viewer');
  const targetGroup = isManagerViewing ? (window.managerReportGroup || 'រថយន្ត') : currentUser.group;
  
  let reportHtml = '';
  if (targetGroup === 'TCC&FCC') {
    reportHtml = buildTCCMonthlyReportBody(ym);
  } else {
    reportHtml = buildMonthlyReportBody(ym);
  }

  const styleContent = monthlyReportStyles().replace(/<\/?style[^>]*>/gi, '');
  const CONTENT_W_PX = 718;

  // Create a hidden iframe to render the report safely
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;top:0;left:-99999px;width:${CONTENT_W_PX}px;height:297mm;border:0;background:#fff;pointer-events:none;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  
  const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styleContent}</style>
    <style>
      body { margin: 0; padding: 0; background: #fff; }
      .mrpt { width: ${CONTENT_W_PX}px !important; max-width: ${CONTENT_W_PX}px !important; margin: 0 auto; background: #fff; }
    </style>
    </head><body>${reportHtml}</body></html>`;
    
  doc.write(fullHTML);
  doc.close();

  try {
    // Wait for fonts and images inside the iframe to load
    if (doc.fonts) {
      try {
        await Promise.all([
          doc.fonts.load('400 12px Hanuman'),
          doc.fonts.load('700 12px Hanuman'),
          doc.fonts.load('900 14px Hanuman')
        ]);
        await doc.fonts.ready;
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));

    const images = Array.from(doc.images || []);
    await Promise.all(images.map(img =>
      img.complete ? Promise.resolve() : new Promise(res => {
        img.addEventListener('load',  res, { once: true });
        img.addEventListener('error', res, { once: true });
        setTimeout(res, 3000);
      })
    ));

    const target = doc.querySelector('.mrpt') || doc.body;
    const scale = 2;

    window.isGeneratingPdfMode = true;
    
    // 👇 Render using html2canvas from inside the iframe context
    const canvas = await html2canvas(target, {
      scale: scale, useCORS: true, allowTaint: true, logging: false,
      backgroundColor: '#ffffff',
      windowWidth: CONTENT_W_PX, width: CONTENT_W_PX,
      scrollX: 0, scrollY: 0
    });

    window.isGeneratingPdfMode = false;
    
    if (!canvas.width || !canvas.height) throw new Error('Empty canvas.');

    const targetRect = target.getBoundingClientRect();
    const pxRatio    = canvas.height / target.offsetHeight;

    const PAGE_W_MM = 210;
    const PAGE_H_MM = 297;
    const MARGIN_MM = 10;
    const PAGE_NUM_RESERVE_MM = mode === 'print' ? 12 : 10;
    const contentW  = PAGE_W_MM - MARGIN_MM * 2;
    const contentH  = PAGE_H_MM - MARGIN_MM * 2 - PAGE_NUM_RESERVE_MM;
    const ratio     = canvas.width / contentW;
    const pageHpx   = contentH * ratio;

    const tbodyEl = target.querySelector('.mrpt-table tbody');
    let dataRowBottoms = [];
    if (tbodyEl) {
      const trs = Array.from(tbodyEl.querySelectorAll('tr'));
      const totalTr = tbodyEl.querySelector('tr.mrpt-total-row');
      const dataTrs = trs.filter(tr => tr !== totalTr);
      dataRowBottoms = dataTrs.map(tr => {
        const r = tr.getBoundingClientRect();
        return Math.round((r.bottom - targetRect.top) * pxRatio);
      });
    }

    const ROWS_PAGE_1 = 6;   
    const ROWS_OTHER  = 9;  

    const slices = [];

    if (dataRowBottoms.length === 0) {
      slices.push({ startY: 0, endY: canvas.height, endsAtRowBoundary: true });
    } else {
      let wanted = Math.min(ROWS_PAGE_1, dataRowBottoms.length) - 1;
      let endY   = dataRowBottoms[wanted];
      slices.push({ startY: 0, endY, endsAtRowBoundary: true });
      let lastIdx = wanted;

      while (lastIdx < dataRowBottoms.length - 1) {
        const startY = slices[slices.length - 1].endY;
        let w2 = Math.min(lastIdx + ROWS_OTHER, dataRowBottoms.length - 1);
        let e2 = dataRowBottoms[w2];
        slices.push({ startY, endY: e2, endsAtRowBoundary: true });
        lastIdx = w2;
      }

      const lastSlice = slices[slices.length - 1];
      if ((canvas.height - lastSlice.startY) <= pageHpx) {
        lastSlice.endY = canvas.height;
        lastSlice.endsAtRowBoundary = false;
      } else {
        slices.push({ startY: lastSlice.endY, endY: canvas.height, endsAtRowBoundary: false });
      }
    }
    const totalPages = slices.length;

    const BORDER_PX    = Math.max(1, Math.round(scale));
    const BORDER_COLOR = '#333333';

    function sliceRowIsBorder(ctx, y, w) {
      if (y < 0 || y >= ctx.canvas.height) return false;
      let data;
      try { data = ctx.getImageData(0, y, w, 1).data; } catch (e) { return false; }
      let dark = 0, total = 0;
      const step = Math.max(16, Math.floor(w / 50) * 4);
      for (let i = 0; i < data.length - 3; i += step) {
        total++;
        if (data[i] < 120 && data[i+1] < 120 && data[i+2] < 120) dark++;
      }
      return total > 0 && (dark / total) >= 0.5;
    }

    function applySliceBorders(ctx, sliceH, idx) {
      if (idx > 0) {
        const hasTop = sliceRowIsBorder(ctx, 0, canvas.width) ||
                       sliceRowIsBorder(ctx, 1, canvas.width);
        if (!hasTop) {
          ctx.fillStyle = BORDER_COLOR;
          ctx.fillRect(0, 0, canvas.width, BORDER_PX);
        }
      }
      if (idx < totalPages - 1 && !slices[idx].endsAtRowBoundary) {
        const h = sliceH - 1;
        const hasBot = sliceRowIsBorder(ctx, h, canvas.width) ||
                       sliceRowIsBorder(ctx, h - 1, canvas.width);
        if (!hasBot) {
          ctx.fillStyle = BORDER_COLOR;
          ctx.fillRect(0, sliceH - BORDER_PX, canvas.width, BORDER_PX);
        }
      }
    }

    if (mode === 'print') {
      const pagesHTML = slices.map((sl, idx) => {
        const sliceH = sl.endY - sl.startY;
        const slice  = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sl.startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        applySliceBorders(ctx, sliceH, idx);

        const dataUrl = slice.toDataURL('image/jpeg', 0.92);
        const renderH = sliceH / ratio;
        slice.width = 0; slice.height = 0;

        return '<div class="print-page">' +
          '<img src="' + dataUrl + '" style="display:block;width:' + contentW + 'mm;height:' + renderH + 'mm;">' +
          '<div class="print-page-num">Page ' + (idx + 1) + ' of ' + totalPages + '</div>' +
        '</div>';
      }).join('');

      const printHTML = '<!DOCTYPE html><html lang="km"><head><meta charset="UTF-8"><title>Monthly Inspection Report</title><style>' +
          '@page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; } html, body { margin: 0; padding: 0; background: #fff; }' +
          '.print-page { position: relative; width: 210mm; height: 297mm; padding: ' + MARGIN_MM + 'mm ' + MARGIN_MM + 'mm ' + (MARGIN_MM + PAGE_NUM_RESERVE_MM) + 'mm ' + MARGIN_MM + 'mm; page-break-after: always; break-after: page; overflow: hidden; background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
          '.print-page:last-child { page-break-after: auto; break-after: auto; } .print-page img { display: block; }' +
          '.print-page-num { position: absolute; left: 0; right: 0; bottom: ' + (MARGIN_MM - 2) + 'mm; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #555; }' +
          '</style></head><body>' + pagesHTML + '</body></html>';

      const printIframe = document.createElement('iframe');
      printIframe.setAttribute('aria-hidden', 'true');
      printIframe.style.cssText = 'position:fixed;top:0;left:-99999px;width:210mm;height:297mm;border:0;background:#fff;pointer-events:none;';
      document.body.appendChild(printIframe);
      const printDoc = printIframe.contentWindow.document;
      printDoc.open(); printDoc.write(printHTML); printDoc.close();

      await new Promise(r => setTimeout(r, 400));
      const printImgs = Array.from(printDoc.images || []);
      await Promise.all(printImgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
        setTimeout(res, 2500);
      })));

      try { printIframe.contentWindow.focus(); printIframe.contentWindow.print(); } catch (err) { console.error(err); }
      const cleanup = () => { try { printIframe.remove(); } catch (e) {} };
      try { printIframe.contentWindow.addEventListener('afterprint', cleanup, { once: true }); } catch (e) {}
      setTimeout(cleanup, 60000);

    } else {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      slices.forEach((sl, idx) => {
        const sliceH = sl.endY - sl.startY;
        const slice  = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sl.startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        applySliceBorders(ctx, sliceH, idx);

        const imgData = slice.toDataURL('image/jpeg', 0.92);
        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, contentW, sliceH / ratio, undefined, 'FAST');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 90, 90);
        pdf.text('Page ' + (idx + 1) + ' of ' + totalPages, PAGE_W_MM / 2, PAGE_H_MM - 5, { align: 'center' });

        slice.width = 0; slice.height = 0;
      });

      const fileLabel = ym.replace('-', '_');
      pdf.save('MONTHLY_INSPECTION_' + targetGroup + '_' + fileLabel + '.pdf');
      showAlert('ទាញយករួចរាល់ — PDF (' + totalPages + ' ទំព័រ)', 'success');
    }

  } catch (err) {
    console.error('[' + mode.toUpperCase() + '] Failed:', err);
    showAlert(mode + ' failed: ' + (err.message || err), 'danger');
  } finally {
    try { iframe.remove(); } catch (e) {}
    hideLoading();
  }
}

window.printMonthlyReport = function() {
  generateMonthlyReportOutput(homeReportMonth, 'print');
};

window.generateMonthlyReportPDF = function() {
  generateMonthlyReportOutput(homeReportMonth, 'pdf');
};

// Global variable for the modal limit


window.openNotificationsModal = function() {
  notifDisplayLimit = 10; // Reset to 10 every time they open it fresh
  renderNotificationsModal();
  
  if (!window.currentDetailModal) {
    window.currentDetailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  }
  window.currentDetailModal.show();
  
  // Mark unread as read
  const unreadNotifs = (APP.notifications || []).filter(n => String(n.read).toUpperCase() === 'FALSE');
  if (unreadNotifs.length > 0) {
    google.script.run.markNotificationsRead(authToken);
    
    // Update locally so the badge clears instantly
    APP.notifications.forEach(n => { n.read = 'TRUE'; });
    updateNotifBadge();
    
    // Re-render so the blue "unread" background disappears
    renderNotificationsModal(); 
  }
};

window.loadMoreNotifications = function() {
  notifDisplayLimit += 10;
  renderNotificationsModal();
};

function renderNotificationsModal() {
  let html = '';
  const allNotifs = APP.notifications || [];
  
  if (allNotifs.length === 0) {
    html = '<div class="text-center py-5">' +
           '<i class="bi bi-bell-slash" style="font-size: 3rem; color: #adb5bd;"></i>' +
           '<div class="mt-3 text-muted">គ្មានការជូនដំណឹងថ្មីៗទេ<br>(No notifications)</div>' +
           '</div>';
  } else {
    const visibleNotifs = allNotifs.slice(0, notifDisplayLimit);
    html = '<div class="list-group list-group-flush">';
    
    visibleNotifs.forEach(n => {
      const isUnread = String(n.read).toUpperCase() === 'FALSE';
      html += `<div class="list-group-item ${isUnread ? 'bg-light' : ''}" style="border-left:4px solid ${isUnread ? '#0d6efd' : 'transparent'};">
        <div class="d-flex justify-content-between">
          <strong>${esc(n.title)}</strong>
          <small class="text-muted">${esc(n.date)} ${esc(n.time)}</small>
        </div>
        <div class="small mt-1">${esc(n.message)}</div>
      </div>`;
    });
    html += '</div>';
    
    // Add View More button if there are more than 10
    if (allNotifs.length > notifDisplayLimit) {
      const remaining = allNotifs.length - notifDisplayLimit;
      html += `<div class="text-center mt-3 mb-2"><button class="btn btn-sm btn-outline-primary" onclick="loadMoreNotifications()"><i class="bi bi-arrow-down-circle me-1"></i> View More (${remaining})</button></div>`;
    }
  }

  $('#modalTitle').text('ការជូនដំណឹង (Notifications)');
  $('#modalActionButtons').addClass('d-none');
  $('#modalBody').html('<div class="p-3">' + html + '</div>');
}

function updateNotifBadge() {
  // 🛡️ STRICT ARRAY CHECK
  const notifications = Array.isArray(APP.notifications) ? APP.notifications : [];
  
  const unread = notifications.filter(n => (n.read === 'FALSE' || n.read === false)).length;
  const $badge = $('#notifBadge');
  
  if (unread > 0) { 
    $badge.text(unread).show(); 
  } else { 
    $badge.hide(); 
  }
}

/* =========================================================
   WEB PUSH SUBSCRIPTION (Toggle Switch)
   ========================================================= */
window.checkPushStatus = async function() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    $('#pushToggle').prop('disabled', true); // Not supported
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    $('#pushToggle').prop('checked', !!sub);
  } catch (e) {
    console.error('Error checking push status:', e);
  }
};

window.autoRegisterPush = async function() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return; 

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      // Save the subscription. Backend will automatically delete old devices for this user
      // and remove this device from any old user.
      google.script.run.savePushSubscription({ subscription: sub })
        .withSuccessHandler(() => console.log('✅ Device auto-linked to user.'));
    }
  } catch (e) {
    console.error('Auto-register push failed:', e);
  }
};

window.togglePushSubscription = async function(isChecked) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.ready;

  if (isChecked) {
    // 👉 SUBSCRIBE
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showAlert('Notification permission denied. Please allow it in browser settings.', 'warning');
        $('#pushToggle').prop('checked', false);
        return;
      }

      // 👇 REPLACE WITH YOUR VAPID PUBLIC KEY 👇
      const VAPID_PUBLIC_KEY = 'BIkd7euBuAQQapXWp6MP_wQ07PHYzA4XmdDQLEa6xlF0V_z6vWz9HMTHM3YGsYu14LA5oYfL5LjKG2tbo927JzQ'; 

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      google.script.run
        .withSuccessHandler(() => showAlert('Push notifications enabled!', 'success'))
        .withFailureHandler(err => showAlert('Error saving subscription', 'danger'))
        .savePushSubscription({ subscription: sub });

    } catch (err) {
      console.error('Subscribe Error:', err);
      $('#pushToggle').prop('checked', false);
    }
  } else {
    // 👉 UNSUBSCRIBE
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        google.script.run
          .withSuccessHandler(() => showAlert('Push notifications turned off.', 'info'))
          .deletePushSubscription();
      }
    } catch (err) {
      console.error('Unsubscribe Error:', err);
    }
  }
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Call this when opening the account modal
const _oldOpenAccountModal = window.openAccountModal;
window.openAccountModal = function() {
  _oldOpenAccountModal();
  checkPushStatus(); // Check if the toggle should be ON or OFF
};

// Helper function for VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
