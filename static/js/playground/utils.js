class PlaygroundUtils {
  static escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  static debounce(fn, ms) {
    let timer;
    const debounced = function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
    debounced.cancel = () => clearTimeout(timer);
    debounced.flush = () => { if (timer) { clearTimeout(timer); fn(); } };
    return debounced;
  }

  static throttle(fn, ms) {
    let last = 0, timer;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, args); }
      else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, ms - (now - last)); }
    };
  }

  static loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url.replace(/"/g, '\\"')}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = url; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + url));
      document.body.appendChild(s);
    });
  }

  static loadStyles(url) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${url.replace(/"/g, '\\"')}"]`)) { resolve(); return; }
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = url; l.onload = resolve;
      document.head.appendChild(l);
    });
  }

  static downloadData(filename, dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  static fuzzyMatch(text, query) {
    if (!query) return { match: true, score: 1 };
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0, score = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) { score += 1 + (qi === 0 ? 2 : 0); qi++; }
    }
    return { match: qi === q.length, score };
  }

  static createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    });
    children.forEach(c => { if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  static uniqueId(prefix = 'pg') {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  static getFileIcon(name) {
    const ext = name.split('.').pop();
    const icons = {
      html: 'fab fa-html5 text-orange-500',
      htm: 'fab fa-html5 text-orange-500',
      css: 'fab fa-css3-alt text-blue-500',
      js: 'fab fa-js text-yellow-500',
      jsx: 'fab fa-react text-cyan-500',
      ts: 'fas fa-file-code text-blue-400',
      tsx: 'fab fa-react text-cyan-500',
      json: 'fas fa-brackets-curly text-green-500',
      md: 'fas fa-markdown text-gray-400',
      py: 'fab fa-python text-blue-500',
      xml: 'fas fa-code text-purple-500',
      svg: 'fas fa-image text-red-400',
      yaml: 'fas fa-file-alt text-amber-400',
      yml: 'fas fa-file-alt text-amber-400',
      txt: 'fas fa-file-alt text-gray-400'
    };
    return icons[ext] || 'fas fa-file-code text-gray-400';
  }

  static getLangFromExt(name) {
    const ext = name.split('.').pop();
    const map = {
      html: 'html', htm: 'html', css: 'css', js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown',
      py: 'python', xml: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml',
      txt: 'plaintext'
    };
    return map[ext] || 'plaintext';
  }

  static formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  static timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }
}

window.PlaygroundUtils = PlaygroundUtils;
