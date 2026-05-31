class PlaygroundEditor {
  constructor(state) {
    this.state = state;
    this.editor = null;
    this.editor2 = null;
    this._models = {};
    this._container = null;
    this._tabsContainer = null;
    this._statusBarEl = null;
    this._decorations = [];
    this._initPromise = null;
    this._ready = false;
  }

  async init(container) {
    this._container = container;
    container.innerHTML = `
      <div class="flex flex-col h-full bg-[#1e1e1e]">
        <div class="flex items-center bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto shrink-0" id="pg-editor-tabs"></div>
        <div class="flex-1 relative overflow-hidden" id="pg-editor-main" style="display:flex;flex-direction:row">
          <div class="flex-1 h-full" id="pg-editor-pane1" style="min-width:0"></div>
          <div class="hidden" id="pg-editor-split-divider"></div>
          <div class="hidden h-full" id="pg-editor-pane2" style="min-width:0"></div>
          <div class="hidden" id="pg-editor-output"></div>
        </div>
      </div>
    `;
    this._tabsContainer = container.querySelector('#pg-editor-tabs');

    this.state.on('file:opened', (name) => this._onFileOpened(name));
    this.state.on('tab:closed', () => this._renderTabs());
    this.state.on('file:renamed', ({ oldName, newName }) => {
      const model = this._models[oldName];
      if (model) { delete this._models[oldName]; this._models[newName] = model; }
      this._renderTabs();
    });
    this.state.on('file:created', () => this._renderTabs());
    this.state.on('file:deleted', (name) => {
      if (this._models[name]) { this._models[name].dispose(); delete this._models[name]; }
      this._renderTabs();
    });
    this.state.on('openTabs', () => this._renderTabs());
    this.state.on('state:loaded', () => {
      if (!this.editor) return;
      Object.values(this._models).forEach(m => m.dispose());
      this._models = {};
      this._initModels();
      const active = this.state.get('activeFile');
      if (active && this._models[active]) this.editor.setModel(this._models[active]);
      this._renderTabs();
      this._syncBreadcrumb();
    });

    try {
      await this._loadMonaco();
      this._createEditor();
      this._initModels();
      this._renderTabs();
      this._bindEvents();
      this._bindSplitEvents();
      this._bindTabDrag();
      this._ready = true;
    } catch (e) {
      container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500 text-[11px]">Failed to load editor: ' + PlaygroundUtils.escapeHtml(e.message) + '</div>';
      this._ready = false;
    }
    return this;
  }

  async _loadMonaco() {
    if (window.monaco) return;
    await PlaygroundUtils.loadStyles('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.min.css');
    const loaderUrl = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js';
    await PlaygroundUtils.loadScript(loaderUrl);
    await Promise.race([
      new Promise((resolve) => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
          this._defineMonacoLanguages();
          resolve();
        });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Monaco load timeout')), 15000))
    ]);
  }

  _defineMonacoLanguages() {
    monaco.languages.register({ id: 'playground-html' });
    monaco.languages.register({ id: 'playground-css' });
    monaco.languages.register({ id: 'playground-javascript' });
    monaco.languages.register({ id: 'playground-python' });
    monaco.languages.register({ id: 'playground-json' });
    monaco.languages.register({ id: 'playground-markdown' });
  }

  _createEditor() {
    const container = this._container.querySelector('#pg-editor-pane1');
    this.editor = monaco.editor.create(container, {
      value: '',
      language: 'html',
      theme: this.state.get('theme') === 'dark' ? 'vs-dark' : 'vs',
      fontSize: this.state.get('editorFontSize'),
      fontFamily: `'${this.state.get('editorFont')}', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace`,
      fontLigatures: this.state.get('editorLigatures'),
      minimap: { enabled: this.state.get('minimap') },
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      scrollBeyondLastLine: false,
      wordWrap: this.state.get('editor.wordWrap') ? 'on' : 'off',
      tabSize: this.state.get('editor.tabSize'),
      insertSpaces: this.state.get('editor.insertSpaces'),
      folding: true,
      foldingHighlight: true,
      foldingStrategy: 'indentation',
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'inline',
      tabCompletion: 'on',
      selectionHighlight: true,
      occurrencesHighlight: 'singleFile',
      renderWhitespace: 'selection',
      renderControlCharacters: true,
      padding: { top: 12, bottom: 12 },
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      fixedOverflowWidgets: true,
    });

    this.editor.onDidChangeModelContent(() => {
      const model = this.editor.getModel();
      if (model) {
        const name = this._modelToFile(model);
        if (name) {
          this.state.setFileContent(name, model.getValue());
          this._renderTabs();
        }
      }
    });

    this.editor.onDidChangeCursorPosition((e) => {
      this.state.set('cursorPosition', { line: e.position.lineNumber, column: e.position.column });
      this._updateStatusBar();
    });

    window.addEventListener('resize', () => { if (this.editor) this.editor.layout(); });
  }

  _bindSplitEvents() {
    this.state.on('editor.splitEnabled', () => this._updateSplitUI());
    this.state.on('editor.showOutput', (val) => this._updateOutputUI(val));
  }

  _updateSplitUI() {
    const split = this.state.get('editor.splitEnabled');
    const pane1 = document.getElementById('pg-editor-pane1');
    const pane2 = document.getElementById('pg-editor-pane2');
    const divider = document.getElementById('pg-editor-split-divider');
    const output = document.getElementById('pg-editor-output');
    if (!pane1) return;
    if (output) output.classList.remove('active');
    this.state.set('editor.showOutput', false);
    if (split) {
      const pct = this.state.get('editor.splitPosition');
      pane1.style.width = pct + '%';
      pane1.style.flex = 'none';
      if (pane2) { pane2.classList.remove('hidden'); pane2.style.width = (100 - pct) + '%'; pane2.style.flex = 'none'; }
      if (divider) divider.classList.remove('hidden');
      this._initSplitEditor();
    } else {
      pane1.style.width = ''; pane1.style.flex = '';
      if (pane2) { pane2.classList.add('hidden'); pane2.style.width = ''; }
      if (divider) divider.classList.add('hidden');
    }
    if (this.editor) this.editor.layout();
    if (this.editor2) this.editor2.layout();
  }

  _initSplitEditor() {
    if (this.editor2) return;
    const pane2 = document.getElementById('pg-editor-pane2');
    if (!pane2) return;
    const files = this.state.get('files');
    const names = Object.keys(files);
    const active = this.state.get('activeFile');
    const secondFile = names.find(n => n !== active) || names[0];

    this.editor2 = monaco.editor.create(pane2, {
      value: '', language: 'html',
      theme: this.state.get('theme') === 'dark' ? 'vs-dark' : 'vs',
      fontSize: this.state.get('editorFontSize'),
      fontFamily: `'${this.state.get('editorFont')}', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace`,
      fontLigatures: this.state.get('editorLigatures'),
      minimap: { enabled: false }, lineNumbers: 'on',
      renderLineHighlight: 'all', cursorBlinking: 'smooth',
      smoothScrolling: true, automaticLayout: true,
      bracketPairColorization: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: this.state.get('editor.wordWrap') ? 'on' : 'off',
      tabSize: this.state.get('editor.tabSize'),
      insertSpaces: this.state.get('editor.insertSpaces'),
      folding: true, padding: { top: 12, bottom: 12 },
      overviewRulerBorder: false, hideCursorInOverviewRuler: true,
    });

    this.editor2.onDidChangeModelContent(() => {
      const model = this.editor2.getModel();
      if (model) {
        const name = this._modelToFile2(model);
        if (name) this.state.setFileContent(name, model.getValue());
      }
    });

    if (this._models[secondFile]) this.editor2.setModel(this._models[secondFile]);
    this.state.set('editor.splitActiveFile', secondFile);
  }

  _modelToFile2(model) {
    if (!model) return null;
    for (const [name, m] of Object.entries(this._models)) {
      if (m === model) return name;
    }
    const uri = model.uri.toString();
    return decodeURIComponent(uri.split('file:///').pop());
  }

  _updateOutputUI(show) {
    const pane1 = document.getElementById('pg-editor-pane1');
    const pane2 = document.getElementById('pg-editor-pane2');
    const divider = document.getElementById('pg-editor-split-divider');
    const output = document.getElementById('pg-editor-output');
    if (!output) return;
    if (show) {
      this.state.set('editor.splitEnabled', false);
      if (pane1) pane1.style.display = 'none';
      if (pane2) pane2.classList.add('hidden');
      if (divider) divider.classList.add('hidden');
      output.classList.add('active');
      output.innerHTML = `
        <div class="pg-output-toolbar">
          <span class="text-gray-300 font-medium"><i class="fas fa-eye mr-1"></i> Output Preview</span>
          <span class="flex-1"></span>
          <button class="pg-output-refresh cursor-pointer mr-1" title="Refresh Output"><i class="fas fa-sync-alt"></i></button>
          <button class="pg-output-close cursor-pointer" title="Close Output"><i class="fas fa-times"></i> Close</button>
        </div>
        <div class="pg-output-content">
          <iframe id="pg-output-frame" sandbox="allow-scripts allow-downloads" style="width:100%;height:100%;border:none;background:white;border-radius:4px;"></iframe>
        </div>
      `;
      output.querySelector('.pg-output-close')?.addEventListener('click', () => this.toggleOutput());
      output.querySelector('.pg-output-refresh')?.addEventListener('click', () => {
        if (window.__playground?.preview) window.__playground.preview.build();
        this._refreshOutput();
      });
      this._refreshOutput();
    } else {
      output.classList.remove('active');
      if (pane1) pane1.style.display = '';
    }
    if (this.editor) this.editor.layout();
  }

  _refreshOutput() {
    const iframe = document.getElementById('pg-output-frame');
    if (!iframe) return;
    const active = this.state.get('activeFile');
    if (active && (active.endsWith('.md') || active.endsWith('.markdown'))) {
      const mdContent = PlaygroundUtils.escapeHtml(this.state.getFileContent(active));
      const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;line-height:1.7;color:#d4d4d4;background:#1e1e1e}' +
        'h1,h2,h3{color:#e0e0e0;border-bottom:1px solid #333;padding-bottom:0.3em}' +
        'code{background:#2d2d2d;padding:0.2em 0.4em;border-radius:3px;font-size:0.9em}' +
        'pre code{display:block;padding:1em;overflow-x:auto}' +
        'a{color:#569cd6}img{max-width:100%}blockquote{border-left:3px solid #569cd6;margin:0;padding:0 1em;color:#888}' +
        'table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:0.5em}</style></head><body>' +
        '<div id="content">' + mdContent.replace(/\n/g, '<br>') + '</div>' +
        '</body></html>';
      try { iframe.srcdoc = html; } catch(e) {}
      return;
    }
    let html = this.state.getOutputContent();
    if (!html && window.__playground?.preview) {
      window.__playground.preview.build();
      html = this.state.getOutputContent();
    }
    if (html) {
      try { iframe.srcdoc = html; } catch(e) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.open(); doc.write(html); doc.close();
        } catch(e) {}
      }
    }
  }

  _initModels() {
    const files = this.state.get('files');
    Object.keys(files).forEach(name => this._createModel(name));
    const active = this.state.get('activeFile');
    if (active && this._models[active]) this.editor.setModel(this._models[active]);
  }

  _createModel(name) {
    const file = this.state.get('files')[name];
    if (!file) return;
    const uri = monaco.Uri.parse('file:///' + name);
    const lang = this._monacoLang(file.language);
    let model = monaco.editor.getModel(uri);
    if (!model) model = monaco.editor.createModel(file.content, lang, uri);
    this._models[name] = model;
    return model;
  }

  _switchToFile(name) {
    if (name === '--output--') { this.state.set('editor.showOutput', true); return; }
    if (name === this._modelToFile(this.editor.getModel())) return;
    if (!this._models[name]) this._createModel(name);
    const model = this._models[name];
    if (model) { this.editor.setModel(model); this.editor.focus(); }
  }

  _modelToFile(model) {
    if (!model) return null;
    for (const [name, m] of Object.entries(this._models)) {
      if (m === model) return name;
    }
    const uri = model.uri.toString();
    return decodeURIComponent(uri.split('file:///').pop());
  }

  _monacoLang(lang) {
    const map = {
      html: 'html', css: 'css', javascript: 'javascript', typescript: 'typescript',
      json: 'json', markdown: 'markdown', python: 'python', xml: 'xml',
      yaml: 'yaml', plaintext: 'plaintext'
    };
    return map[lang] || 'plaintext';
  }

  _renderTabs() {
    if (!this._tabsContainer) return;
    const openTabs = this.state.get('openTabs');
    const active = this.state.get('activeFile');
    const dirty = this.state.get('dirtyFiles');
    const showOutput = this.state.get('editor.showOutput');

    let html = openTabs.map((name, idx) => {
      const isActive = name === active && !showOutput;
      const isDirty = dirty.has(name);
      const icon = PlaygroundUtils.getFileIcon(name);
      return `<div class="pg-tab flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer border-r border-[#3c3c3c] whitespace-nowrap ${isActive ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:text-gray-200'}" data-tab="${name}" draggable="true" data-idx="${idx}">
        <i class="${icon} text-[10px]"></i>
        <span>${name}</span>
        ${isDirty ? '<span class="text-indigo-400 text-[9px]">●</span>' : ''}
        <span class="pg-tab-close ml-1 text-[10px] text-gray-500 hover:text-red-400 ${!isActive ? 'opacity-0 hover:opacity-100' : ''}">&times;</span>
      </div>`;
    }).join('');

    const isOutput = showOutput || active === '--output--';
    html += `<div class="pg-tab flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer border-r border-[#3c3c3c] whitespace-nowrap ${isOutput ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:text-gray-200'}" data-tab="--output--">
      <i class="fas fa-eye text-[10px] text-indigo-400"></i>
      <span>Output Preview</span>
    </div>`;

    this._tabsContainer.innerHTML = html;
    if (openTabs.length === 0 && !showOutput) {
      this._tabsContainer.innerHTML = '<div class="text-[11px] text-gray-500 px-3 py-1.5">No files open</div>';
    }
  }

  _bindTabDrag() {
    this._tabsContainer?.addEventListener('dragstart', (e) => {
      const tab = e.target.closest('.pg-tab');
      if (!tab || tab.dataset.tab === '--output--') { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.dataset.tab);
      tab.style.opacity = '0.4';
    });
    this._tabsContainer?.addEventListener('dragend', (e) => {
      const tab = e.target.closest('.pg-tab');
      if (tab) tab.style.opacity = '';
    });
    this._tabsContainer?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    this._tabsContainer?.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedName = e.dataTransfer.getData('text/plain');
      const target = e.target.closest('.pg-tab');
      if (!target || !draggedName || draggedName === target.dataset.tab) return;
      const openTabs = this.state.get('openTabs');
      const fromIdx = openTabs.indexOf(draggedName);
      const toIdx = openTabs.indexOf(target.dataset.tab);
      if (fromIdx === -1 || toIdx === -1) return;
      openTabs.splice(fromIdx, 1);
      openTabs.splice(toIdx, 0, draggedName);
      this.state.set('openTabs', openTabs);
      this._renderTabs();
    });
  }

  _onFileOpened(name) {
    this._switchToFile(name);
    this._renderTabs();
    this._syncBreadcrumb();
  }

  _bindEvents() {
    this._tabsContainer?.addEventListener('click', (e) => {
      const tab = e.target.closest('.pg-tab');
      const close = e.target.closest('.pg-tab-close');
      if (close) {
        e.stopPropagation();
        const tabName = tab.dataset.tab;
        if (tabName === '--output--') { this.state.set('editor.showOutput', false); this._renderTabs(); return; }
        this.state.closeTab(tab.dataset.tab);
        return;
      }
      if (tab) {
        const tabName = tab.dataset.tab;
        if (tabName === '--output--') { this.state.set('editor.showOutput', true); this._renderTabs(); }
        else this.state.openFile(tabName);
      }
    });
  }

  _syncBreadcrumb() {
    const el = document.getElementById('pg-breadcrumb');
    if (!el) return;
    const active = this.state.get('activeFile');
    el.innerHTML = active ? `<span class="text-gray-400">/</span> <span class="text-white">${PlaygroundUtils.escapeHtml(active)}</span>` : '';
  }

  _updateStatusBar() {
    if (!this._statusBarEl) return;
    const pos = this.state.get('cursorPosition');
    this._statusBarEl.textContent = `Ln ${pos.line}, Col ${pos.column}`;
  }

  setStatusBar(el) { this._statusBarEl = el; this._updateStatusBar(); }

  formatCode() { this.editor?.getAction('editor.action.formatDocument')?.run(); }
  find() { this.editor?.getAction('actions.find')?.run(); }
  replace() { this.editor?.getAction('editor.action.startFindReplaceAction')?.run(); }
  goToLine() { this.editor?.getAction('editor.action.gotoLine')?.run(); }
  toggleComment() { this.editor?.getAction('editor.action.commentLine')?.run(); }

  toggleMinimap() {
    const val = !this.state.get('minimap');
    this.state.set('minimap', val);
    this.editor?.updateOptions({ minimap: { enabled: val } });
  }

  changeFontSize(delta) {
    const size = Math.max(10, Math.min(32, this.state.get('editorFontSize') + delta));
    this.state.set('editorFontSize', size);
    this.editor?.updateOptions({ fontSize: size });
    this.editor2?.updateOptions({ fontSize: size });
  }

  toggleSplit() { this.state.set('editor.splitEnabled', !this.state.get('editor.splitEnabled')); }

  toggleOutput() {
    const val = !this.state.get('editor.showOutput');
    this.state.set('editor.showOutput', val);
    if (val) this._refreshOutput();
  }

  refreshOutput() { this._refreshOutput(); }

  selectAllOccurrences() {
    this.editor?.getAction('editor.action.selectAllOccurrences')?.run();
  }

  addCursorToNext() {
    this.editor?.getAction('editor.action.addSelectionToNextFindMatch')?.run();
  }

  getQuickOpenFiles() {
    const files = this.state.get('files');
    const active = this.state.get('activeFile');
    return Object.keys(files).map(name => ({
      name,
      icon: PlaygroundUtils.getFileIcon(name),
      isActive: name === active
    }));
  }

  dispose() {
    Object.values(this._models).forEach(m => m.dispose());
    this.editor?.dispose();
    if (this.editor2) this.editor2.dispose();
  }
}

window.PlaygroundEditor = PlaygroundEditor;