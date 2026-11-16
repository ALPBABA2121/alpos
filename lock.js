// =============================================================
// Alps passcode lock.
// Load FIRST in <head> on every page (not deferred):
//     <script src="lock.js"></script>
//
// • First visit: choose a passcode (only a salted SHA-256 hash is stored).
// • Stays unlocked while you're active; locks after IDLE_MINUTES idle.
// • Lock now: the "Lock" button on the hub, or Ctrl/Cmd + Shift + L.
// • Locking or unlocking in one tab does the same in every open tab.
//
// This is a privacy screen, not encryption: your data lives in this
// browser's local storage, and anyone with access to the browser's
// developer tools could still read it.
//
// Forgot the passcode? Open the browser console on the site and run:
//     localStorage.removeItem('alps:lock:hash')
// then reload — you'll be asked to choose a new one. No data is lost.
// =============================================================
(function () {
  'use strict';

  var IDLE_MINUTES = 30;   // auto-lock after this much inactivity
  var MAX_TRIES    = 5;    // wrong attempts before a cooldown
  var COOLDOWN_SEC = 30;   // length of that cooldown

  var K_HASH   = 'alps:lock:hash';
  var K_SALT   = 'alps:lock:salt';
  var K_ACTIVE = 'alps:lock:active';     // last activity time while unlocked
  var K_FAILS  = 'alps:lock:fails';
  var K_UNTIL  = 'alps:lock:cooldown';   // cooldown ends at (ms)

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var root = document.documentElement;

  // ---------- Hide the page immediately (before the body is parsed) ----------
  var style = document.createElement('style');
  style.textContent = [
    'html.alps-locked body > :not(#alps-lock) { visibility: hidden !important; }',
    'html.alps-locked, html.alps-locked body { overflow: hidden !important; }',
    '#alps-lock {',
    '  position: fixed; inset: 0; z-index: 2147483000;',
    '  display: flex; align-items: center; justify-content: center;',
    '  padding: 16px;',
    '  background:',
    '    radial-gradient(ellipse at 70% 10%, rgba(201,169,110,0.10), transparent 55%),',
    '    radial-gradient(ellipse at 15% 95%, rgba(147,166,190,0.05), transparent 55%),',
    '    #0F0E0C;',
    '  color: #B5AD9F;',
    '  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  -webkit-font-smoothing: antialiased;',
    '  opacity: 1; transition: opacity 0.6s ease;',
    '}',
    '#alps-lock.is-leaving { opacity: 0; pointer-events: none; }',
    '#alps-lock .al-box { width: min(340px, 100%); text-align: center; animation: al-rise 0.9s cubic-bezier(0.22,1,0.36,1); }',
    '@keyframes al-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }',
    '#alps-lock .al-mark {',
    '  width: 58px; height: 58px; margin: 0 auto 26px;',
    '  display: flex; align-items: center; justify-content: center;',
    '  border: 1px solid rgba(201,169,110,0.4); border-radius: 50%;',
    '  font-family: "Cormorant Garamond", Garamond, Georgia, serif;',
    '  font-size: 28px; color: #C9A96E;',
    '}',
    '#alps-lock .al-title {',
    '  margin: 0 0 6px;',
    '  font-family: "Cormorant Garamond", Garamond, Georgia, serif;',
    '  font-weight: 500; font-size: 40px; letter-spacing: -0.01em; color: #EDE6D8;',
    '}',
    '#alps-lock .al-sub {',
    '  margin: 0 0 34px;',
    '  font-family: "Cormorant Garamond", Garamond, Georgia, serif;',
    '  font-style: italic; font-size: 18px; color: #7D766A;',
    '}',
    '#alps-lock .al-input {',
    '  display: block; width: 100%;',
    '  padding: 10px 4px; margin: 0 0 14px;',
    '  border: 0; border-bottom: 1px solid rgba(237,230,216,0.16); border-radius: 0;',
    '  background: transparent; color: #EDE6D8; caret-color: #C9A96E;',
    '  font: inherit; font-size: 22px; letter-spacing: 0.35em; text-align: center;',
    '  outline: none; transition: border-color 0.3s;',
    '}',
    '#alps-lock .al-input:focus { border-bottom-color: rgba(201,169,110,0.7); }',
    '#alps-lock .al-input::placeholder { color: #4F4A42; letter-spacing: 0.2em; font-size: 13px; text-transform: uppercase; }',
    '#alps-lock .al-input:disabled { opacity: 0.4; }',
    '#alps-lock .al-msg {',
    '  min-height: 18px; margin: 4px 0 22px;',
    '  font-size: 10.5px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase;',
    '  color: #7D766A;',
    '}',
    '#alps-lock .al-msg.is-error { color: #C98A7A; }',
    '#alps-lock .al-btn {',
    '  padding: 11px 34px;',
    '  border: 1px solid rgba(201,169,110,0.45); border-radius: 999px;',
    '  background: transparent; color: #EDE6D8;',
    '  font: inherit; font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;',
    '  cursor: pointer; transition: background 0.3s, border-color 0.3s;',
    '}',
    '#alps-lock .al-btn:hover { background: rgba(201,169,110,0.12); border-color: rgba(201,169,110,0.75); }',
    '#alps-lock .al-btn:disabled { opacity: 0.4; cursor: default; }',
    '#alps-lock .al-btn:focus-visible { outline: 1px solid rgba(201,169,110,0.7); outline-offset: 3px; }',
    '#alps-lock .al-box.is-shaking { animation: al-shake 0.42s cubic-bezier(0.36,0.07,0.19,0.97); }',
    '@keyframes al-shake {',
    '  20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  #alps-lock, #alps-lock .al-box { animation: none !important; transition: none !important; }',
    '}'
  ].join('\n');
  (document.head || root).appendChild(style);

  // ---------- Helpers ----------
  function hasPasscode() { return !!get(K_HASH); }
  function isUnlocked() {
    var t = +get(K_ACTIVE) || 0;
    return hasPasscode() && Date.now() - t < IDLE_MINUTES * 60000;
  }
  function randomSalt() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function hash(text) {
    var data = (get(K_SALT) || '') + '|' + text;
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(function (buf) {
        return 'sha256:' + Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    // Fallback for very old browsers (no Web Crypto): FNV-1a.
    var h = 0x811c9dc5;
    for (var i = 0; i < data.length; i++) { h ^= data.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return Promise.resolve('fnv:' + h.toString(16));
  }
  function onReady(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  // ---------- Overlay ----------
  var overlay = null;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'alps-lock';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'al-title');
    overlay.innerHTML =
      '<form class="al-box" autocomplete="off" novalidate>' +
        '<div class="al-mark" aria-hidden="true">A</div>' +
        '<h1 class="al-title" id="al-title">Alps</h1>' +
        '<p class="al-sub"></p>' +
        '<input class="al-input" type="password" inputmode="text" autocomplete="current-password" aria-label="Passcode">' +
        '<div class="al-msg" aria-live="polite"></div>' +
        '<button class="al-btn" type="submit"></button>' +
      '</form>';
    document.body.appendChild(overlay);
    overlay.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    return overlay;
  }

  var mode = 'unlock';     // 'unlock' | 'setup' | 'confirm'
  var pending = '';        // first entry during setup
  var cooldownTimer = null;

  function els() {
    return {
      box:   overlay.querySelector('.al-box'),
      sub:   overlay.querySelector('.al-sub'),
      input: overlay.querySelector('.al-input'),
      msg:   overlay.querySelector('.al-msg'),
      btn:   overlay.querySelector('.al-btn')
    };
  }

  function setMode(m, message, isError) {
    mode = m;
    var e = els();
    e.sub.textContent = m === 'unlock' ? 'Enter your passcode'
                      : m === 'setup'  ? 'Choose a passcode'
                      :                  'Enter it once more';
    e.btn.textContent = m === 'unlock' ? 'Unlock' : 'Continue';
    e.input.placeholder = m === 'unlock' ? '' : 'At least 4 characters';
    e.input.autocomplete = m === 'unlock' ? 'current-password' : 'new-password';
    e.input.value = '';
    e.msg.textContent = message || '';
    e.msg.classList.toggle('is-error', !!isError);
    checkCooldown();
    setTimeout(function () { if (!e.input.disabled) e.input.focus(); }, 30);
  }

  function shake() {
    var box = els().box;
    box.classList.remove('is-shaking');
    void box.offsetWidth;
    box.classList.add('is-shaking');
  }

  function checkCooldown() {
    var e = els();
    var left = Math.ceil(((+get(K_UNTIL) || 0) - Date.now()) / 1000);
    clearTimeout(cooldownTimer);
    if (mode === 'unlock' && left > 0) {
      e.input.disabled = true; e.btn.disabled = true;
      e.msg.textContent = 'Too many attempts · wait ' + left + 's';
      e.msg.classList.add('is-error');
      cooldownTimer = setTimeout(checkCooldown, 1000);
    } else if (e.input.disabled) {
      e.input.disabled = false; e.btn.disabled = false;
      e.msg.textContent = ''; e.msg.classList.remove('is-error');
      e.input.focus();
    }
  }

  function submit() {
    var e = els();
    var value = e.input.value;
    if (e.input.disabled) return;

    if (mode === 'setup') {
      if (value.length < 4) { shake(); e.msg.textContent = 'At least 4 characters'; e.msg.classList.add('is-error'); return; }
      pending = value;
      setMode('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (value !== pending) { pending = ''; shake(); setMode('setup', "Didn't match · try again", true); return; }
      set(K_SALT, randomSalt());
      hash(value).then(function (h) { set(K_HASH, h); pending = ''; unlock(); });
      return;
    }
    // unlock
    if (!value) { shake(); return; }
    hash(value).then(function (h) {
      if (h === get(K_HASH)) {
        del(K_FAILS); del(K_UNTIL);
        unlock();
      } else {
        var fails = (+get(K_FAILS) || 0) + 1;
        set(K_FAILS, fails);
        shake();
        e.input.value = '';
        if (fails >= MAX_TRIES) {
          set(K_FAILS, 0);
          set(K_UNTIL, Date.now() + COOLDOWN_SEC * 1000);
          checkCooldown();
        } else {
          e.msg.textContent = 'Incorrect passcode';
          e.msg.classList.add('is-error');
        }
      }
    });
  }

  function show() {
    onReady(function () {
      build();
      overlay.classList.remove('is-leaving');
      overlay.style.display = '';
      setMode(hasPasscode() ? 'unlock' : 'setup');
    });
  }

  function hide() {
    root.classList.remove('alps-locked');
    if (!overlay) return;
    overlay.classList.add('is-leaving');
    var o = overlay;
    setTimeout(function () { if (!root.classList.contains('alps-locked')) o.style.display = 'none'; }, 650);
  }

  function unlock() {
    set(K_ACTIVE, String(Date.now()));
    hide();
  }

  function lock() {
    del(K_ACTIVE);
    root.classList.add('alps-locked');
    show();
  }

  // ---------- Start ----------
  if (isUnlocked()) {
    set(K_ACTIVE, String(Date.now()));
  } else {
    root.classList.add('alps-locked');
    show();
  }

  // Activity keeps you unlocked (throttled to one write every 15s).
  var lastWrite = 0;
  function touch() {
    if (root.classList.contains('alps-locked')) return;
    var now = Date.now();
    if (now - lastWrite > 15000) { lastWrite = now; set(K_ACTIVE, String(now)); }
  }
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, touch, { passive: true, capture: true });
  });

  // Idle check.
  setInterval(function () {
    if (!root.classList.contains('alps-locked') && !isUnlocked()) lock();
  }, 20000);

  // Keep tabs in step: lock/unlock elsewhere applies here too.
  window.addEventListener('storage', function (e) {
    if (e.key !== K_ACTIVE) return;
    var locked = root.classList.contains('alps-locked');
    if (!e.newValue && !locked) lock();
    else if (e.newValue && locked && isUnlocked()) hide();
  });

  // Ctrl/Cmd + Shift + L locks immediately.
  window.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      if (!root.classList.contains('alps-locked')) lock();
    }
  });

  window.AlpsLock = { lock: lock };
})();
