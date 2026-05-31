class PlaygroundCommandPalette {
  constructor(state, ctx) {
    this.state = state;
    this.ctx = ctx; // { editor, preview, console, terminal, layout }
    this._overlay = null;
    this._input = null;
    this._results = null;
    this._commands = [];
    this._visible = false;
    this._selectedIdx = -1;
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register({
      id: 'file.save', label: 'Save Project', category: 'File',
      shortcut: 'Ctrl+S', action: () => this._saveProject()
    });
    this.register({
      id: 'file.new', label: 'New File', category: 'File',
      shortcut: '', action: () => {
        const name = prompt('File name:');
        if (name) this.state.createFile(name.trim(), '');
      }
    });
    this.register({
      id: 'file.format', label: 'Format Code', category: 'File',
      shortcut: 'Shift+Alt+F', action: () => this.ctx.editor?.formatCode()
    });
    this.register({
      id: 'edit.find', label: 'Find', category: 'Edit',
      shortcut: 'Ctrl+F', action: () => this.ctx.editor?.find()
    });
    this.register({
      id: 'edit.replace', label: 'Find & Replace', category: 'Edit',
      shortcut: 'Ctrl+H', action: () => this.ctx.editor?.replace()
    });
    this.register({
      id: 'edit.comment', label: 'Toggle Comment', category: 'Edit',
      shortcut: 'Ctrl+/', action: () => this.ctx.editor?.toggleComment()
    });
    this.register({
      id: 'view.toggleSidebar', label: 'Toggle Sidebar', category: 'View',
      shortcut: 'Ctrl+B', action: () => this.ctx.layout?.toggleSidebar()
    });
    this.register({
      id: 'view.toggleConsole', label: 'Toggle Console', category: 'View',
      shortcut: 'Ctrl+`', action: () => this.ctx.layout?.toggleBottomPanel()
    });
    this.register({
      id: 'view.togglePreview', label: 'Toggle Preview Panel', category: 'View',
      shortcut: '', action: () => this.ctx.layout?.toggleRightPanel()
    });
    this.register({
      id: 'view.toggleOutput', label: 'Toggle Output Tab', category: 'View',
      shortcut: '', action: () => this.ctx.editor?.toggleOutput()
    });
    this.register({
      id: 'view.toggleSplit', label: 'Toggle Split Editor', category: 'View',
      shortcut: '', action: () => this.ctx.editor?.toggleSplit()
    });
    this.register({
      id: 'view.fullscreen', label: 'Toggle Fullscreen Preview', category: 'View',
      shortcut: '', action: () => {
        const preview = document.querySelector('.pg-preview-frame-wrapper');
        if (preview) preview.requestFullscreen?.();
      }
    });
    this.register({
      id: 'view.fullscreenPlayground', label: 'Toggle Fullscreen Playground', category: 'View',
      shortcut: '', action: () => {
        const mount = document.getElementById('pg-mount');
        if (mount) mount.classList.toggle('playground-fullscreen');
      }
    });
    this.register({
      id: 'view.zenMode', label: 'Toggle Zen Mode', category: 'View',
      shortcut: 'Ctrl+K Z', action: () => this.ctx.layout?.toggleZenMode()
    });
    this.register({
      id: 'view.search', label: 'Search in Files', category: 'View',
      shortcut: 'Ctrl+Shift+F', action: () => this.ctx.layout?._activateSearch()
    });
    this.register({
      id: 'view.toggleProblems', label: 'Toggle Problems Panel', category: 'View',
      shortcut: '', action: () => this.ctx.layout?.toggleBottomPanel()
    });
    this.register({
      id: 'editor.wordWrap', label: 'Toggle Word Wrap', category: 'Editor',
      shortcut: '', action: () => {
        const pg = window.__playground;
        if (pg && pg.layout) pg.layout._toggleWordWrap();
      }
    });
    this.register({
      id: 'preview.run', label: 'Run Preview', category: 'Preview',
      shortcut: 'Ctrl+Enter', action: () => this.ctx.preview?.build()
    });
    this.register({
      id: 'preview.desktop', label: 'Preview: Desktop', category: 'Preview',
      shortcut: '', action: () => this.ctx.preview?.setMode('desktop')
    });
    this.register({
      id: 'preview.tablet', label: 'Preview: Tablet', category: 'Preview',
      shortcut: '', action: () => this.ctx.preview?.setMode('tablet')
    });
    this.register({
      id: 'preview.mobile', label: 'Preview: Mobile', category: 'Preview',
      shortcut: '', action: () => this.ctx.preview?.setMode('mobile')
    });
    this.register({
      id: 'theme.dark', label: 'Theme: VS Code Dark', category: 'Theme',
      shortcut: '', action: () => this._setTheme('dark')
    });
    this.register({
      id: 'theme.light', label: 'Theme: Light', category: 'Theme',
      shortcut: '', action: () => this._setTheme('light')
    });
    this.register({
      id: 'theme.highcontrast', label: 'Theme: High Contrast', category: 'Theme',
      shortcut: '', action: () => this._setTheme('hc-black')
    });
    this.register({
      id: 'font.increase', label: 'Increase Font Size', category: 'Editor',
      shortcut: 'Ctrl+=', action: () => this.ctx.editor?.changeFontSize(1)
    });
    this.register({
      id: 'font.decrease', label: 'Decrease Font Size', category: 'Editor',
      shortcut: 'Ctrl+-', action: () => this.ctx.editor?.changeFontSize(-1)
    });
    this.register({
      id: 'editor.minimap', label: 'Toggle Minimap', category: 'Editor',
      shortcut: '', action: () => this.ctx.editor?.toggleMinimap()
    });
    this.register({
      id: 'console.clear', label: 'Clear Console', category: 'Console',
      shortcut: '', action: () => this.state.clearConsole()
    });
    this.register({
      id: 'export.zip', label: 'Export as ZIP', category: 'Export',
      shortcut: '', action: () => this._exportZip()
    });
    this.register({
      id: 'export.json', label: 'Export as JSON', category: 'Export',
      shortcut: '', action: () => this._exportJSON()
    });
    this.register({
      id: 'project.duplicate', label: 'Duplicate Project', category: 'Project',
      shortcut: '', action: () => this._duplicateProject()
    });
  }

  register(cmd) {
    this._commands.push(cmd);
    return this;
  }

  showQuickOpen() {
    const files = window.__playground?.editor?.getQuickOpenFiles() || [];
    if (files.length === 0) return;

    if (this._visible) { this.hide(); return; }
    this._visible = true;
    this._quickOpenMode = true;

    this._overlay = document.createElement('div');
    this._overlay.className = 'fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60';
    this._overlay.innerHTML = `
      <div class="bg-[#252526] rounded-xl shadow-2xl border border-gray-600 w-full max-w-[500px] overflow-hidden">
        <div class="flex items-center px-4 py-3 border-b border-gray-600">
          <i class="fas fa-search text-gray-400 mr-3 text-xs"></i>
          <input type="text" id="pg-quickopen-input" placeholder="Type to search files..." class="flex-1 bg-transparent text-sm text-gray-200 outline-none border-none" autocomplete="off" spellcheck="false">
          <kbd class="text-[9px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div class="max-h-[350px] overflow-y-auto p-1" id="pg-quickopen-results">
          ${files.map((f, i) => `
            <div class="pg-quickopen-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[12px] hover:bg-gray-700/50 ${f.isActive ? 'selected bg-gray-700/70' : ''}" data-idx="${i}">
              <i class="${f.icon} text-[10px]"></i>
              <span class="flex-1 text-gray-200">${PlaygroundUtils.escapeHtml(f.name)}</span>
              ${f.isActive ? '<span class="text-[9px] text-indigo-400">current</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(this._overlay);
    this._filtered = files;

    const input = this._overlay.querySelector('#pg-quickopen-input');
    const results = this._overlay.querySelector('#pg-quickopen-results');

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      const allFiles = window.__playground?.editor?.getQuickOpenFiles() || [];
      this._filtered = q ? allFiles.filter(f => f.name.toLowerCase().includes(q)) : allFiles;
      results.innerHTML = this._filtered.map((f, i) => `
        <div class="pg-quickopen-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[12px] hover:bg-gray-700/50 ${f.isActive ? 'selected bg-gray-700/70' : ''}" data-idx="${i}">
          <i class="${f.icon} text-[10px]"></i>
          <span class="flex-1 text-gray-200">${PlaygroundUtils.escapeHtml(f.name)}</span>
        </div>
      `).join('');
      this._selectQuickOpen(0);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const sel = results.querySelector('.selected');
        if (sel) {
          const idx = parseInt(sel.dataset.idx);
          if (!isNaN(idx) && this._filtered[idx]) {
            window.__playground?.state?.openFile(this._filtered[idx].name);
          }
        }
        this.hide();
      } else if (e.key === 'ArrowDown') { this._selectQuickOpen((parseInt(results.querySelector('.selected')?.dataset.idx || '-1')) + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this._selectQuickOpen((parseInt(results.querySelector('.selected')?.dataset.idx || '0')) - 1); e.preventDefault(); }
      else if (e.key === 'Escape') this.hide();
    });

    results.addEventListener('click', (e) => {
      const item = e.target.closest('.pg-quickopen-item');
      if (item) {
        const idx = parseInt(item.dataset.idx);
        if (!isNaN(idx) && this._filtered[idx]) {
          window.__playground?.state?.openFile(this._filtered[idx].name);
        }
        this.hide();
      }
    });

    this._overlay.addEventListener('mousedown', (e) => { if (e.target === this._overlay) this.hide(); });

    setTimeout(() => input?.focus(), 50);
    document.addEventListener('keydown', this._escHandler);
  }

  _selectQuickOpen(idx) {
    const items = this._overlay?.querySelectorAll('.pg-quickopen-item');
    if (!items || items.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= items.length) idx = items.length - 1;
    items.forEach(i => i.classList.remove('selected', 'bg-gray-700/70'));
    items[idx].classList.add('selected', 'bg-gray-700/70');
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    if (this._visible) return;
    this._visible = true;
    this._build();
    setTimeout(() => this._input?.focus(), 50);
    document.addEventListener('keydown', this._escHandler);
  }

  hide() {
    if (!this._visible) return;
    this._visible = false;
    this._quickOpenMode = false;
    this._overlay?.remove();
    this._overlay = null;
    document.removeEventListener('keydown', this._escHandler);
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60';
    this._overlay.innerHTML = `
      <div class="bg-[#252526] dark:bg-[#252526] bg-white rounded-xl shadow-2xl border border-gray-600 w-full max-w-[600px] overflow-hidden">
        <div class="flex items-center px-4 py-3 border-b border-gray-600">
          <i class="fas fa-search text-gray-400 mr-3 text-xs"></i>
          <input type="text" id="pg-palette-input" placeholder="Type a command..." class="flex-1 bg-transparent text-sm text-gray-200 dark:text-gray-200 text-gray-800 outline-none border-none" autocomplete="off" spellcheck="false">
          <kbd class="text-[9px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div id="pg-palette-results" class="max-h-[400px] overflow-y-auto p-1"></div>
      </div>
    `;
    document.body.appendChild(this._overlay);

    this._input = this._overlay.querySelector('#pg-palette-input');
    this._results = this._overlay.querySelector('#pg-palette-results');
    this._renderResults('');

    this._input.addEventListener('input', () => this._renderResults(this._input.value));
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const selected = this._results.querySelector('.pg-palette-item.selected');
        if (selected) {
          const idx = parseInt(selected.dataset.idx);
          if (!isNaN(idx)) this._execute(this._filtered[idx]);
        }
      } else if (e.key === 'ArrowDown') {
        this._select(this._selectedIdx + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        this._select(this._selectedIdx - 1);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });

    this._overlay.addEventListener('mousedown', (e) => {
      if (e.target === this._overlay) this.hide();
    });

    this._results.addEventListener('click', (e) => {
      const item = e.target.closest('.pg-palette-item');
      if (item) {
        const idx = parseInt(item.dataset.idx);
        if (!isNaN(idx)) this._execute(this._filtered[idx]);
      }
    });
  }

  _renderResults(query) {
    this._filtered = query
      ? this._commands.filter(c => PlaygroundUtils.fuzzyMatch(c.label + ' ' + c.category, query).match || PlaygroundUtils.fuzzyMatch(c.category, query).match)
      : this._commands;
    this._selectedIdx = -1;

    if (this._filtered.length === 0) {
      this._results.innerHTML = '<div class="text-gray-500 text-center py-6 text-xs">No commands found</div>';
      return;
    }

    this._results.innerHTML = this._filtered.map((cmd, i) => {
      const label = this._highlight(cmd.label, query);
      const cat = cmd.category;
      return `<div class="pg-palette-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[12px] hover:bg-gray-700/50" data-idx="${i}" data-cmd="${cmd.id}">
        <span class="text-gray-400 text-[9px] w-16 shrink-0">${cat}</span>
        <span class="flex-1 text-gray-200">${label}</span>
        ${cmd.shortcut ? `<kbd class="text-[9px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">${cmd.shortcut}</kbd>` : ''}
      </div>`;
    }).join('');
  }

  _highlight(text, query) {
    if (!query) return PlaygroundUtils.escapeHtml(text);
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let result = '', qi = 0;
    for (let i = 0; i < text.length; i++) {
      if (qi < q.length && t[i] === q[qi]) {
        result += '<span class="text-indigo-400">' + PlaygroundUtils.escapeHtml(text[i]) + '</span>';
        qi++;
      } else {
        result += PlaygroundUtils.escapeHtml(text[i]);
      }
    }
    return result;
  }

  _select(idx) {
    const items = this._results?.querySelectorAll('.pg-palette-item');
    if (!items || items.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= items.length) idx = items.length - 1;
    items.forEach(i => i.classList.remove('selected', 'bg-gray-700/70'));
    items[idx].classList.add('selected', 'bg-gray-700/70');
    items[idx].scrollIntoView({ block: 'nearest' });
    this._selectedIdx = idx;
  }

  _execute(cmd) {
    if (cmd) {
      this.hide();
      try { cmd.action(); } catch (e) { console.error('Command error:', e); }
    }
  }

  get escHandler() {
    if (!this._escHandler) {
      this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
    }
    return this._escHandler;
  }

  _saveProject() {
    try {
      const snapshot = this.state.snapshot();
      const id = this.state.get('project.id');
      localStorage.setItem('pg_saved_' + id, snapshot);
      localStorage.setItem('pg_project_id', id);
      this.state.set('dirtyFiles', new Set());
      this.state.set('lastSaved', Date.now());
    } catch (e) { console.error('Save failed:', e); }
  }

  _exportJSON() {
    const snapshot = this.state.snapshot();
    PlaygroundUtils.downloadData('playground.json', 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(snapshot))));
  }

  _exportZip() {
    this._saveProject();
    if (window.JSZip) {
      this._buildZip();
    } else {
      PlaygroundUtils.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
        .then(() => this._buildZip())
        .catch(() => alert('Failed to load ZIP library'));
    }
  }

  _buildZip() {
    const files = this.state.get('files');
    const zip = new JSZip();
    Object.entries(files).forEach(([name, file]) => zip.file(name, file.content));
    zip.generateAsync({ type: 'blob' }).then(content => {
      PlaygroundUtils.downloadData('playground.zip', URL.createObjectURL(content));
    });
  }

  _duplicateProject() {
    const json = this.state.toJSON();
    json.project = { name: json.project.name + ' (copy)', id: Date.now().toString(36) };
    this.state.fromJSON(json);
  }

  _setTheme(theme) {
    this.state.set('theme', theme);
    const editor = this.ctx.editor?.editor;
    if (editor) {
      const map = { dark: 'vs-dark', light: 'vs', 'hc-black': 'hc-black' };
      editor.updateOptions({ theme: map[theme] || 'vs-dark' });
    }
    document.documentElement.classList.toggle('dark', theme !== 'light');
  }
}

window.PlaygroundCommandPalette = PlaygroundCommandPalette;
