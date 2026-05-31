class PlaygroundPreview {
  constructor(state) {
    this.state = state;
    this.iframe = null;
    this._container = null;
    this._debouncedUpdate = null;
    this._mode = 'desktop';
    this._buildTimer = null;
  }

  mount(container) {
    this._container = container;
    const mode = this.state.get('preview.mode');

    container.innerHTML = `
      <div class="flex flex-col h-full bg-white dark:bg-gray-900">
        <div class="flex items-center justify-between px-2.5 py-1 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 shrink-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400"><i class="fas fa-eye mr-1"></i> Preview</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="flex rounded overflow-hidden border border-gray-300 dark:border-gray-500">
              <button class="pg-preview-mode px-1.5 py-0.5 text-[9px] ${mode === 'desktop' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'} hover:bg-indigo-500 hover:text-white transition" data-mode="desktop" title="Desktop"><i class="fas fa-desktop"></i></button>
              <button class="pg-preview-mode px-1.5 py-0.5 text-[9px] ${mode === 'tablet' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'} hover:bg-indigo-500 hover:text-white transition" data-mode="tablet" title="Tablet"><i class="fas fa-tablet-alt"></i></button>
              <button class="pg-preview-mode px-1.5 py-0.5 text-[9px] ${mode === 'mobile' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'} hover:bg-indigo-500 hover:text-white transition" data-mode="mobile" title="Mobile"><i class="fas fa-mobile-alt"></i></button>
            </div>
            <button class="pg-preview-refresh px-1.5 py-0.5 text-[9px] text-gray-500 dark:text-gray-400 hover:text-indigo-500 transition" title="Refresh"><i class="fas fa-sync-alt"></i></button>
            <button class="pg-preview-fullscreen px-1.5 py-0.5 text-[9px] text-gray-500 dark:text-gray-400 hover:text-indigo-500 transition" title="Fullscreen"><i class="fas fa-expand"></i></button>
            <label class="flex items-center gap-1 text-[9px] text-gray-400 cursor-pointer">
              <input type="checkbox" class="pg-preview-autorun w-2.5 h-2.5" ${this.state.get('preview.autoRefresh') ? 'checked' : ''}> Auto
            </label>
          </div>
        </div>
        <div class="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-2 overflow-auto">
          <div class="pg-preview-frame-wrapper transition-all duration-300 ${this._frameClass(mode)}">
            <iframe class="pg-preview-iframe w-full h-full rounded shadow-lg bg-white" sandbox="allow-scripts allow-downloads" security="restricted"></iframe>
          </div>
        </div>
      </div>
    `;

    this.iframe = container.querySelector('.pg-preview-iframe');
    this._bindEvents();
    this._debouncedUpdate = PlaygroundUtils.debounce(() => this.build(), this.state.get('preview.debounceMs'));
    this.state.on('file:changed', () => {
      if (this.state.get('preview.autoRefresh')) this._debouncedUpdate();
    });
    setTimeout(() => this.build(), 200);
  }

  _frameClass(mode) {
    const classes = { desktop: 'w-full h-full', tablet: 'w-[768px] h-full', mobile: 'w-[375px] h-full' };
    return classes[mode] || classes.desktop;
  }

  _bindEvents() {
    this._container.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('.pg-preview-mode');
      if (modeBtn) {
        const mode = modeBtn.dataset.mode;
        this.state.set('preview.mode', mode);
        const wrapper = this._container.querySelector('.pg-preview-frame-wrapper');
        if (wrapper) wrapper.className = `pg-preview-frame-wrapper transition-all duration-300 ${this._frameClass(mode)}`;
        this._container.querySelectorAll('.pg-preview-mode').forEach(b => {
          const isActive = b.dataset.mode === mode;
          b.className = `pg-preview-mode px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'} hover:bg-indigo-500 hover:text-white transition`;
        });
        return;
      }
      if (e.target.closest('.pg-preview-refresh')) {
        this.build();
        return;
      }
      if (e.target.closest('.pg-preview-fullscreen')) {
        this._toggleFullscreen();
        return;
      }
    });

    const autorun = this._container.querySelector('.pg-preview-autorun');
    if (autorun) {
      autorun.addEventListener('change', () => {
        this.state.set('preview.autoRefresh', autorun.checked);
      });
    }
  }

  build() {
    if (!this.iframe) return;
    const files = this.state.get('files');
    const html = this._buildHTML(files);
    this.state.setOutputContent(html);
    try {
      this.iframe.srcdoc = html;
    } catch (e) {
      try {
        const doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
      } catch(e2) {}
    }
    this._injectConsoleCapture();
  }

  _buildHTML(files) {
    const htmlFile = files['index.html'];
    const cssFile = files['style.css'];
    const jsFile = files['script.js'];

    let html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';

    // Inline CSS
    if (cssFile) {
      html += '<style>\n' + cssFile.content + '\n</style>\n';
    }

    // Include other HTML head content
    if (htmlFile) {
      const headMatch = htmlFile.content.match(/<head>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        html += headMatch[1] + '\n';
      }
    }

    html += '</head>\n<body>\n';

    // Body content from index.html
    if (htmlFile) {
      const bodyMatch = htmlFile.content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        html += bodyMatch[1] + '\n';
      } else {
        // If no body tags, use entire content (stripping doctype/head)
        let bodyContent = htmlFile.content
          .replace(/<!DOCTYPE[^>]*>/i, '')
          .replace(/<head>[\s\S]*?<\/head>/i, '')
          .replace(/<html[^>]*>|<\/html>/gi, '')
          .replace(/<body[^>]*>|<\/body>/gi, '')
          .trim();
        html += bodyContent + '\n';
      }
    }

    // Inline JS with console capture wrapper
    if (jsFile) {
      html += '<script>\n(function() {\n' +
        'const _origLog = console.log;\n' +
        'const _origError = console.error;\n' +
        'const _origWarn = console.warn;\n' +
        'const _origInfo = console.info;\n' +
        'console.log = function() { _origLog.apply(console, arguments); window.parent.postMessage({type:"pg-console",level:"log",args:Array.from(arguments).map(a=>typeof a==="object"?JSON.stringify(a):String(a))},"*"); };\n' +
        'console.error = function() { _origError.apply(console, arguments); window.parent.postMessage({type:"pg-console",level:"error",args:Array.from(arguments).map(a=>typeof a==="object"?JSON.stringify(a):String(a))},"*"); };\n' +
        'console.warn = function() { _origWarn.apply(console, arguments); window.parent.postMessage({type:"pg-console",level:"warn",args:Array.from(arguments).map(a=>typeof a==="object"?JSON.stringify(a):String(a))},"*"); };\n' +
        'console.info = function() { _origInfo.apply(console, arguments); window.parent.postMessage({type:"pg-console",level:"info",args:Array.from(arguments).map(a=>typeof a==="object"?JSON.stringify(a):String(a))},"*"); };\n' +
        'window.onerror = function(msg, src, line, col) { window.parent.postMessage({type:"pg-console",level:"error",args:[msg+" at "+src+":"+line]},"*"); };\n' +
        '})();\n' +
        '<\/script>\n';
      html += '<script>\n' + jsFile.content + '\n<\/script>\n';
    }

    html += '\n</body>\n</html>';
    return html;
  }

  _injectConsoleCapture() {
    if (this._consoleHandler) return;
    this._consoleHandler = (e) => {
      if (e.data && e.data.type === 'pg-console') {
        this.state.addConsoleLog(e.data.level, e.data.args);
      }
    };
    try {
      window.addEventListener('message', this._consoleHandler);
    } catch (e) {}
  }

  _toggleFullscreen() {
    const wrapper = this._container.querySelector('.pg-preview-frame-wrapper');
    if (!wrapper) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapper.requestFullscreen?.();
    }
  }

  setMode(mode) {
    this.state.set('preview.mode', mode);
    const wrapper = this._container.querySelector('.pg-preview-frame-wrapper');
    if (wrapper) wrapper.className = `pg-preview-frame-wrapper transition-all duration-300 ${this._frameClass(mode)}`;
  }

  dispose() {
    if (this._consoleHandler) {
      window.removeEventListener('message', this._consoleHandler);
      this._consoleHandler = null;
    }
    if (this.iframe) {
      this.iframe.src = 'about:blank';
    }
  }
}

window.PlaygroundPreview = PlaygroundPreview;
