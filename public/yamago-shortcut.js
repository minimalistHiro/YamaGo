// Safari Shortcuts snippet for exporting YamaGo logs.
// Usage: In the "Safari WebページでJavaScriptを実行" action, paste the contents of this file.
(() => {
  const safeGet = (fn) => {
    try {
      return fn();
    } catch {
      return '';
    }
  };

  const header = {
    app: 'YamaGo',
    title: safeGet(() => document.title || ''),
    url: safeGet(() => window.location.href || ''),
    ua: safeGet(() => navigator.userAgent || ''),
    ts: new Date().toISOString(),
    type: 'header',
  };

  const stored = (() => {
    if (window.YamaGoDebug && typeof window.YamaGoDebug.dumpNow === 'function') {
      return window.YamaGoDebug.dumpNow();
    }
    return safeGet(() => localStorage.getItem('yama_logs') || '');
  })();

  const payload = JSON.stringify(header) + '\n' + stored;
  if (typeof completion === 'function') {
    completion(payload);
  } else {
    return payload;
  }
})();
