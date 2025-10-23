(() => {
  if (typeof window === 'undefined') return;
  if (window.__YAMAGO_LOGGER_INSTALLED__) return;
  window.__YAMAGO_LOGGER_INSTALLED__ = true;

  const LS_KEY = 'yama_logs';
  const MAX_LS_BYTES = 4_500_000; // ~5MB safety
  const MEMORY_CAP = 1000;

  const mem = [];
  const pushMem = (ev) => { mem.push(ev); if (mem.length > MEMORY_CAP) mem.shift(); };
  const nowIso = () => new Date().toISOString();
  const toLine = (obj) => JSON.stringify(obj) + '\n';

  const appendLS = (line) => {
    try {
      const cur = localStorage.getItem(LS_KEY) || '';
      let next = cur + line;
      if (new Blob([next]).size > MAX_LS_BYTES) {
        const cutIndex = Math.floor(next.length * 0.2);
        let sliced = next.slice(cutIndex);
        const firstNL = sliced.indexOf('\n');
        next = firstNL > -1 ? sliced.slice(firstNL + 1) : sliced;
      }
      localStorage.setItem(LS_KEY, next);
    } catch (_) {}
  };

  const write = (level, payload) => {
    try {
      const entry = {
        app: 'YamaGo',
        level,
        ts: nowIso(),
        url: (typeof location !== 'undefined' && location.href) ? location.href : '',
        ua: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',
        ...payload
      };
      const line = toLine(entry);
      appendLS(line);
      pushMem(entry);
    } catch (_) {}
  };

  // Patch console
  ['log','info','warn','error','debug'].forEach((lv) => {
    const orig = console[lv];
    console[lv] = (...args) => {
      try {
        const msg = args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); }
          catch { return String(a); }
        }).join(' ');
        write(lv, { msg });
      } catch (_) {}
      try { orig.apply(console, args); } catch (_) {}
    };
  });

  // Error capture
  window.addEventListener('error', (e) => {
    write('error', { msg: String(e.message || 'window.error'), src: e.filename, lineno: e.lineno, colno: e.colno, stack: e.error && e.error.stack });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    write('error', { msg: 'unhandledrejection', reason: (r && (r.message || r.toString())) || String(r), stack: r && r.stack });
  });

  // Fetch logging
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async (input, init) => {
      const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      write('info', { msg: 'fetch:start', url, method: (init && init.method) || 'GET' });
      try {
        const res = await origFetch(input, init);
        const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        write(res.ok ? 'info' : 'warn', { msg: 'fetch:end', url, status: res.status, dur_ms: Math.round(end - started) });
        return res;
      } catch (e) {
        const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        write('error', { msg: 'fetch:fail', url, dur_ms: Math.round(end - started), error: String(e) });
        throw e;
      }
    };
  }

  // Public API
  window.YamaGoDebug = {
    log: (msg, extra) => write('log', { msg, extra }),
    dumpNow: () => { try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; } },
    clear: () => { try { localStorage.removeItem(LS_KEY); return true; } catch { return false; } },
    peek: () => [...mem],
  };
})();
