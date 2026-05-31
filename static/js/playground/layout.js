class PlaygroundLayout {
  constructor(state, components) {
    this.state = state;
    this.components = components;
    this._container = null;
    this._root = null;
    this._resizing = null;
    this._minSidebar = 160;
    this._maxSidebar = 500;
    this._minBottom = 100;
    this._maxBottom = 500;
  }

  mount(container) {
    this._container = container;
    this._buildLayout();
    const editorReady = this._mountEditor();
    this._mountSidebarContent();
    this._mountBottomContent();
    this._mountPreview();
    this._mountRightContent();
    this._bindActivityBar();
    this._bindBottomTabs();
    this._bindTrafficLights();
    this._bindStatusBarUpdates();
    this._bindSidebarClicks();
    this._bindResizeHandlers();
    this._bindShortcuts();

    this.state.on('file:opened', () => this._updateStatusBar());
    this.state.on('file:changed', () => this._updateStatusBar());
    this.state.on('layout.zenMode', (val) => this._applyZenMode(val));

    return editorReady;
  }

  _buildLayout() {
    const sidebarVis = this.state.get('layout.sidebarVisible');
    const bottomVis = this.state.get('layout.bottomPanelVisible');
    const rightVis = this.state.get('layout.rightPanelVisible');
    const sidebarW = this.state.get('layout.sidebarWidth');
    const bottomH = this.state.get('layout.bottomPanelHeight');
    const rightW = this.state.get('layout.rightPanelWidth');

    this._container.innerHTML = `
      <div class="vscode-playground flex flex-col h-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-gray-700 shadow-xl" style="min-height:500px">
        <!-- Title Bar -->
        <div class="pg-titlebar flex items-center bg-[#3c3c3c] px-3 py-1 shrink-0">
          <div class="flex items-center gap-1.5 mr-3">
            <div class="w-3 h-3 rounded-full bg-red-500 cursor-pointer hover:brightness-110 transition" id="pg-btn-close"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-500 cursor-pointer hover:brightness-110 transition" id="pg-btn-minimize"></div>
            <div class="w-3 h-3 rounded-full bg-green-500 cursor-pointer hover:brightness-110 transition" id="pg-btn-maximize"></div>
          </div>
          <span class="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
            <i class="fas fa-laptop-code text-[10px]"></i>
            <span id="pg-project-name">${PlaygroundUtils.escapeHtml(this.state.get('project.name'))}</span>
          </span>
          <div class="ml-auto flex items-center gap-1 text-[10px]">
            <button class="pg-layout-btn-zen px-2 py-0.5 text-gray-400 hover:text-white transition flex items-center gap-1" title="Zen Mode (Ctrl+K Z)"><i class="fas fa-expand-arrows-alt"></i></button>
            <button class="pg-layout-btn-split px-2 py-0.5 text-gray-400 hover:text-white transition flex items-center gap-1" title="Split Editor"><i class="fas fa-columns"></i></button>
            <button class="pg-layout-btn-output px-2 py-0.5 text-gray-400 hover:text-white transition flex items-center gap-1" title="Toggle Output"><i class="fas fa-eye"></i></button>
            <button class="pg-layout-btn-download px-2 py-0.5 text-gray-400 hover:text-white transition flex items-center gap-1" title="Download ZIP"><i class="fas fa-download"></i></button>
            <span class="w-px h-4 bg-gray-600 mx-1"></span>
            <button class="pg-layout-btn-run px-2.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-medium hover:bg-emerald-700 transition flex items-center gap-1">
              <i class="fas fa-play text-[8px]"></i> Run
            </button>
          </div>
        </div>
        <!-- Breadcrumb -->
        <div class="pg-breadcrumb flex items-center bg-[#252526] px-3 py-0.5 text-[10px] text-gray-500 border-b border-[#3c3c3c] shrink-0" id="pg-breadcrumb">
          <span class="text-gray-400">/</span> <span class="text-white">index.html</span>
        </div>

        <!-- Main Content -->
        <div class="flex flex-1 overflow-hidden">
          <!-- Activity Bar -->
          <div class="pg-activitybar flex flex-col items-center gap-2 py-2 px-1 bg-[#333333] shrink-0">
            <button class="pg-activity-btn active w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] text-gray-400 hover:text-white transition text-xs" data-panel="explorer" title="Explorer (Ctrl+B)"><i class="fas fa-files"></i></button>
            <button class="pg-activity-btn w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] text-gray-400 hover:text-white transition text-xs" data-panel="search" title="Search (Ctrl+Shift+F)"><i class="fas fa-search"></i></button>
            <div class="flex-1"></div>
            <button class="pg-activity-btn w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] text-gray-400 hover:text-white transition text-xs" data-panel="extensions" title="Extensions"><i class="fas fa-puzzle-piece"></i></button>
            <button class="pg-activity-btn w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#3c3c3c] text-gray-400 hover:text-white transition text-xs" data-panel="settings" title="Settings"><i class="fas fa-cog"></i></button>
          </div>

          <!-- Sidebar -->
          <div class="pg-sidebar flex flex-col bg-[#252526] border-r border-[#3c3c3c] shrink-0 overflow-hidden" style="width:${sidebarVis ? sidebarW : 0}px;${!sidebarVis ? 'display:none' : ''}">
            <div class="flex-1 overflow-y-auto" id="pg-sidebar-content"></div>
          </div>
          <div class="pg-sidebar-resize w-1 cursor-col-resize bg-transparent hover:bg-indigo-500 transition shrink-0 ${!sidebarVis ? 'hidden' : ''}" style="cursor:col-resize"></div>

          <!-- Center: Editor + Bottom Panel -->
          <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div class="flex-1 min-h-0" id="pg-editor-area"></div>

            <!-- Bottom Panel Resize Handle -->
            <div class="pg-bottom-resize h-1 cursor-row-resize bg-transparent hover:bg-indigo-500 transition shrink-0 ${!bottomVis ? 'hidden' : ''}" style="cursor:row-resize"></div>

            <!-- Bottom Panel -->
            <div class="pg-bottom-panel flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c] shrink-0 overflow-hidden" style="height:${bottomVis ? bottomH : 0}px;${!bottomVis ? 'display:none' : ''}">
              <div class="flex items-center bg-[#252526] border-b border-[#3c3c3c] shrink-0" id="pg-bottom-tabs">
                <button class="pg-bottom-tab active px-3 py-1 text-[10px] font-medium bg-[#1e1e1e] text-white border-r border-[#3c3c3c]" data-panel="console"><i class="fas fa-terminal mr-1"></i> Console <span class="pg-console-badge hidden text-[8px] bg-indigo-500 text-white rounded-full px-1 ml-1">0</span></button>
                <button class="pg-bottom-tab px-3 py-1 text-[10px] font-medium text-gray-400 hover:text-white border-r border-[#3c3c3c]" data-panel="terminal"><i class="fas fa-window-terminal mr-1"></i> Terminal</button>
                <button class="pg-bottom-tab px-3 py-1 text-[10px] font-medium text-gray-400 hover:text-white border-r border-[#3c3c3c]" data-panel="problems"><i class="fas fa-exclamation-triangle mr-1"></i> Problems <span class="pg-problems-badge hidden text-[8px] bg-red-500 text-white rounded-full px-1 ml-1">0</span></button>
              </div>
              <div class="flex-1 min-h-0 overflow-hidden" id="pg-bottom-content"></div>
            </div>
          </div>

          <!-- Right Panel Resize Handle -->
          <div class="pg-right-resize w-1 cursor-col-resize bg-transparent hover:bg-indigo-500 transition shrink-0 ${!rightVis ? 'hidden' : ''}" style="cursor:col-resize"></div>

          <!-- Right Panel -->
          <div class="pg-right-panel flex flex-col bg-[#252526] border-l border-[#3c3c3c] shrink-0 overflow-hidden" style="width:${rightVis ? rightW : 0}px;${!rightVis ? 'display:none' : ''}">
            <div class="flex-1 overflow-y-auto p-3" id="pg-right-content">
              <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</div>
              <div id="pg-preview-area" class="h-48"></div>
            </div>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="pg-statusbar flex items-center justify-between bg-[#007acc] text-white px-3 py-0.5 text-[10px] shrink-0">
          <div class="flex items-center gap-3">
            <span id="pg-status-cursor">Ln 1, Col 1</span>
            <span class="opacity-50">|</span>
            <span id="pg-status-lang">HTML</span>
            <span class="opacity-50">|</span>
            <span id="pg-status-indent" class="cursor-pointer hover:bg-[#005a9e] px-1 rounded" title="Click to toggle tabs/spaces"><i class="fas fa-indent text-[8px] mr-0.5"></i> Spaces: 2</span>
            <span class="opacity-50">|</span>
            <span id="pg-status-encoding">UTF-8</span>
            <span class="opacity-50">|</span>
            <span id="pg-status-wordwrap" class="cursor-pointer hover:bg-[#005a9e] px-1 rounded" title="Click to toggle word wrap"><i class="fas fa-wrap-text text-[8px] mr-0.5"></i> Wrap</span>
          </div>
          <div class="flex items-center gap-3">
            <span id="pg-status-problems" class="cursor-pointer hover:bg-[#005a9e] px-1 rounded" title="Toggle Problems"><i class="fas fa-exclamation-circle text-[8px] mr-0.5"></i> 0</span>
            <span id="pg-status-autosave" class="hidden"><i class="fas fa-check text-[8px] mr-0.5"></i> Saved</span>
            <span id="pg-status-line-end" class="cursor-pointer hover:bg-[#005a9e] px-1 rounded" title="Line Endings">LF</span>
            <span id="pg-status-theme" class="cursor-pointer hover:bg-[#005a9e] px-1 rounded"><i class="fas fa-moon text-[8px] mr-0.5"></i> ${this.state.get('theme') === 'dark' ? 'Dark' : 'Light'}</span>
          </div>
        </div>
      </div>
    `;

    this._root = this._container.querySelector('.vscode-playground');
  }

  _mountSidebarContent() {
    const el = document.getElementById('pg-sidebar-content');
    if (el && this.components.explorer) {
      this.components.explorer.mount(el);
    }
  }

  _mountEditor() {
    const el = document.getElementById('pg-editor-area');
    if (el && this.components.editor) {
      return this.components.editor.init(el);
    }
  }

  _mountBottomContent() {
    const el = document.getElementById('pg-bottom-content');
    if (!el) return;
    const activeTab = this.state.get('layout.activeBottomTab');
    el.innerHTML = `<div class="h-full" id="pg-bottom-console"></div>
      <div class="h-full hidden" id="pg-bottom-terminal"></div>
      <div class="h-full hidden" id="pg-bottom-problems">
        <div class="flex flex-col h-full bg-[#1e1e1e]">
          <div class="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
            <span class="text-[10px] font-medium text-gray-400"><i class="fas fa-exclamation-triangle mr-1"></i> Problems</span>
            <span class="text-[9px] text-gray-500" id="pg-problems-count">No problems</span>
          </div>
          <div class="flex-1 overflow-y-auto font-mono text-[11px]" id="pg-problems-output">
            <div class="text-gray-500 text-center py-6 text-[10px]">No problems detected</div>
          </div>
        </div>
      </div>`;

    if (this.components.console) {
      const consoleEl = document.getElementById('pg-bottom-console');
      this.components.console.mount(consoleEl);
    }
    if (this.components.terminal) {
      const termEl = document.getElementById('pg-bottom-terminal');
      this.components.terminal.mount(termEl);
    }
  }

  _mountPreview() {
    const el = document.getElementById('pg-preview-area');
    if (el && this.components.preview) {
      this.components.preview.mount(el);
    }
  }

  _mountRightContent() {
    const el = document.getElementById('pg-right-content');
    if (el && !document.getElementById('pg-preview-area')) {}
  }

  _bindSidebarClicks() {
    this.state.on('search:results', () => this._refreshSidebar());
    this.state.on('search:cleared', () => this._refreshSidebar());
  }

  _refreshSidebar() {
    const activePanel = this._root?.querySelector('.pg-activity-btn.active')?.dataset.panel;
    const content = document.getElementById('pg-sidebar-content');
    if (!content) return;
    if (activePanel === 'search') {
      this._showSearchPanel(content);
    } else if (activePanel === 'explorer') {
      if (this.components.explorer) {
        content.innerHTML = '';
        this.components.explorer.mount(content);
      }
    }
  }

  _showSearchPanel(container) {
    const results = this.state.get('searchResults');
    container.innerHTML = `
      <div class="p-2">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Search</div>
        <div class="relative">
          <input type="text" id="pg-search-input" class="w-full bg-[#3c3c3c] text-gray-200 text-[11px] px-2 py-1.5 rounded border border-gray-600 outline-none focus:border-indigo-500" placeholder="Search across files..." autocomplete="off">
        </div>
        <div class="mt-2 text-[10px] text-gray-500" id="pg-search-summary">${results.length > 0 ? results.length + ' results' : 'Type to search'}</div>
        <div class="mt-1 space-y-0.5 max-h-[300px] overflow-y-auto" id="pg-search-results">
          ${results.map(r => `
            <div class="pg-search-item flex items-start gap-1 px-1 py-0.5 hover:bg-[#3c3c3c] rounded cursor-pointer text-[10px]" data-file="${r.file}" data-line="${r.line}">
              <span class="text-gray-500 shrink-0 w-6 text-right">${r.line}</span>
              <span class="text-gray-400 truncate">${PlaygroundUtils.escapeHtml(r.text)}</span>
              <span class="text-indigo-400 shrink-0 ml-auto">${r.file}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const input = document.getElementById('pg-search-input');
    if (input) {
      input.addEventListener('input', PlaygroundUtils.debounce(() => {
        this._performSearch(input.value);
      }, 300));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._performSearch(input.value);
        if (e.key === 'Escape') input.blur();
      });
      setTimeout(() => input.focus(), 100);
    }

    container.addEventListener('click', (e) => {
      const item = e.target.closest('.pg-search-item');
      if (item) {
        const file = item.dataset.file;
        const line = parseInt(item.dataset.line);
        if (file && this.components.editor) {
          this.state.openFile(file);
          // Go to line after a brief delay
          setTimeout(() => this.components.editor.goToLine(), 100);
        }
      }
    });
  }

  _performSearch(query) {
    if (!query || query.length < 2) {
      this.state.clearSearchResults();
      return;
    }
    const files = this.state.get('files');
    const results = [];
    const q = query.toLowerCase();
    Object.entries(files).forEach(([name, file]) => {
      const lines = file.content.split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(q)) {
          results.push({ file: name, line: i + 1, text: line.trim() });
        }
      });
    });
    this.state.setSearchResults(results);
  }

  _bindActivityBar() {
    this._root?.querySelectorAll('.pg-activity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        if (panel === 'explorer') {
          this.toggleSidebar();
        } else if (panel === 'search') {
          this._activateSearch();
        } else if (panel === 'settings') {
          this._showSettings();
        }
        this._root.querySelectorAll('.pg-activity-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.classList.toggle('text-white', b === btn);
          b.classList.toggle('text-gray-400', b !== btn);
        });
      });
    });
  }

  _activateSearch() {
    const sidebar = this._root?.querySelector('.pg-sidebar');
    if (sidebar) {
      sidebar.style.display = '';
      sidebar.style.width = this.state.get('layout.sidebarWidth') + 'px';
      this.state.set('layout.sidebarVisible', true);
    }
    const resize = this._root?.querySelector('.pg-sidebar-resize');
    if (resize) resize.classList.remove('hidden');
    this._refreshSidebar();
  }

  _bindBottomTabs() {
    const tabs = document.getElementById('pg-bottom-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.pg-bottom-tab');
      if (!tab) return;
      const panel = tab.dataset.panel;
      this.state.set('layout.activeBottomTab', panel);
      tabs.querySelectorAll('.pg-bottom-tab').forEach(t => {
        t.classList.remove('active', 'bg-[#1e1e1e]', 'text-white');
        t.classList.add('text-gray-400');
      });
      tab.classList.add('active', 'bg-[#1e1e1e]', 'text-white');
      tab.classList.remove('text-gray-400');

      ['pg-bottom-console', 'pg-bottom-terminal', 'pg-bottom-problems'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !id.includes(panel));
      });
    });
  }

  _bindTrafficLights() {
    const close = document.getElementById('pg-btn-close');
    if (close) close.addEventListener('click', () => this.state.closeTab(this.state.get('activeFile')));
    const zenBtn = document.getElementById('pg-btn-maximize');
    if (zenBtn) zenBtn.addEventListener('click', () => this.toggleZenMode());

    const zenAction = this._container.querySelector('.pg-layout-btn-zen');
    if (zenAction) zenAction.addEventListener('click', () => this.toggleZenMode());

    const splitAction = this._container.querySelector('.pg-layout-btn-split');
    if (splitAction) splitAction.addEventListener('click', () => this.components.editor?.toggleSplit());
    const outputAction = this._container.querySelector('.pg-layout-btn-output');
    if (outputAction) outputAction.addEventListener('click', () => this.components.editor?.toggleOutput());
    const downloadAction = this._container.querySelector('.pg-layout-btn-download');
    if (downloadAction) {
      downloadAction.addEventListener('click', () => {
        const pg = window.__playground;
        if (pg && pg.palette) pg.palette._exportZip();
      });
    }
  }

  _bindStatusBarUpdates() {
    this.state.on('file:opened', (name) => {
      const lang = this.state.getActiveLanguage();
      const el = document.getElementById('pg-status-lang');
      if (el) el.textContent = lang.toUpperCase();
      const bc = document.getElementById('pg-breadcrumb');
      if (bc) {
        bc.innerHTML = name ? `<span class="text-gray-400">/</span> <span class="text-white">${PlaygroundUtils.escapeHtml(name)}</span>` : '';
      }
    });
    this.state.on('cursorPosition', (pos) => {
      const el = document.getElementById('pg-status-cursor');
      if (el) el.textContent = `Ln ${pos.line}, Col ${pos.column}`;
    });
    this.state.on('lastSaved', (ts) => {
      const el = document.getElementById('pg-status-autosave');
      if (el) {
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
      }
    });
    this.state.on('problems', () => this._updateProblems());
    this.state.on('problem:added', () => this._updateProblems());
    this.state.on('problems:cleared', () => this._updateProblems());

    // Status bar click handlers
    setTimeout(() => {
      const wrapEl = document.getElementById('pg-status-wordwrap');
      if (wrapEl) wrapEl.addEventListener('click', () => this._toggleWordWrap());
      const indentEl = document.getElementById('pg-status-indent');
      if (indentEl) indentEl.addEventListener('click', () => this._toggleIndent());
      const themeEl = document.getElementById('pg-status-theme');
      if (themeEl) themeEl.addEventListener('click', () => this._cycleTheme());
      const problemsStatus = document.getElementById('pg-status-problems');
      if (problemsStatus) problemsStatus.addEventListener('click', () => this.toggleBottomPanel());
    }, 200);
  }

  _toggleWordWrap() {
    const val = !this.state.get('editor.wordWrap');
    this.state.set('editor.wordWrap', val);
    const editor = this.components.editor?.editor;
    if (editor) editor.updateOptions({ wordWrap: val ? 'on' : 'off' });
    if (this.components.editor?.editor2) {
      this.components.editor.editor2.updateOptions({ wordWrap: val ? 'on' : 'off' });
    }
    const el = document.getElementById('pg-status-wordwrap');
    if (el) {
      el.innerHTML = val ? '<i class="fas fa-wrap-text text-[8px] mr-0.5"></i> Wrap' : '<i class="fas fa-wrap-text text-[8px] mr-0.5"></i> No Wrap';
    }
  }

  _toggleIndent() {
    const spaces = !this.state.get('editor.insertSpaces');
    this.state.set('editor.insertSpaces', spaces);
    const size = this.state.get('editor.tabSize');
    const editor = this.components.editor?.editor;
    if (editor) editor.updateOptions({ insertSpaces: spaces });
    const el = document.getElementById('pg-status-indent');
    if (el) {
      el.innerHTML = `<i class="fas fa-indent text-[8px] mr-0.5"></i> ${spaces ? 'Spaces' : 'Tabs'}: ${size}`;
    }
  }

  _cycleTheme() {
    const themes = ['dark', 'light', 'hc-black'];
    const current = this.state.get('theme');
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    this.state.set('theme', next);
    const map = { dark: 'vs-dark', light: 'vs', 'hc-black': 'hc-black' };
    const editor = this.components.editor?.editor;
    if (editor) editor.updateOptions({ theme: map[next] || 'vs-dark' });
    if (this.components.editor?.editor2) {
      this.components.editor.editor2.updateOptions({ theme: map[next] || 'vs-dark' });
    }
    document.documentElement.classList.toggle('dark', next !== 'light');
    const el = document.getElementById('pg-status-theme');
    if (el) {
      const icons = { dark: 'fa-moon', light: 'fa-sun', 'hc-black': 'fa-adjust' };
      el.innerHTML = `<i class="fas ${icons[next] || 'fa-moon'} text-[8px] mr-0.5"></i> ${next === 'hc-black' ? 'High Contrast' : next.charAt(0).toUpperCase() + next.slice(1)}`;
    }
    // Also update the settings panel if open
    const themeSelect = document.querySelector('.pg-setting-theme');
    if (themeSelect) themeSelect.value = next;
  }

  _updateProblems() {
    const problems = this.state.get('problems') || [];
    const count = problems.length;
    const badge = document.querySelector('.pg-problems-badge');
    if (badge) {
      if (count > 0) { badge.classList.remove('hidden'); badge.textContent = count; }
      else badge.classList.add('hidden');
    }
    const statusEl = document.getElementById('pg-status-problems');
    if (statusEl) statusEl.innerHTML = `<i class="fas fa-exclamation-circle text-[8px] mr-0.5"></i> ${count}`;

    // Update problems panel
    const output = document.getElementById('pg-problems-output');
    if (output) {
      if (count === 0) {
        output.innerHTML = '<div class="text-gray-500 text-center py-6 text-[10px]">No problems detected</div>';
      } else {
        const pCount = document.getElementById('pg-problems-count');
        if (pCount) pCount.textContent = count + ' problem' + (count > 1 ? 's' : '');
        output.innerHTML = problems.map(p => `
          <div class="pg-problem-item flex items-start gap-2 px-3 py-1 hover:bg-[#2a2a2a] cursor-pointer border-b border-[#2a2a2a]" data-file="${p.file || ''}" data-line="${p.line || 1}">
            <span class="text-red-400 text-[9px] mt-0.5">✖</span>
            <span class="text-gray-300 text-[10px] flex-1">${PlaygroundUtils.escapeHtml(p.message)}</span>
            <span class="text-gray-500 text-[9px] shrink-0">${p.file ? p.file + ':' : ''}${p.line || 1}</span>
          </div>
        `).join('');
        // Click to navigate
        output.addEventListener('click', (e) => {
          const item = e.target.closest('.pg-problem-item');
          if (item && item.dataset.file) {
            this.state.openFile(item.dataset.file);
            setTimeout(() => this.components.editor?.goToLine(), 100);
          }
        });
      }
    }
  }

  _applyZenMode(zen) {
    const parts = ['.pg-titlebar', '.pg-breadcrumb', '.pg-activitybar', '.pg-sidebar',
      '.pg-sidebar-resize', '.pg-bottom-panel', '.pg-bottom-resize',
      '.pg-right-panel', '.pg-right-resize', '.pg-statusbar'];
    parts.forEach(sel => {
      const el = this._root?.querySelector(sel);
      if (el) el.style.display = zen ? 'none' : '';
    });
    if (zen) {
      this._root?.classList.add('pg-zen-mode');
    } else {
      this._root?.classList.remove('pg-zen-mode');
    }
    this._triggerLayout();
    // Add/remove zen CSS
    if (zen) {
      document.getElementById('pg-mount')?.classList.add('playground-fullscreen');
    }
  }

  toggleZenMode() {
    const zen = !this.state.get('layout.zenMode');
    this.state.set('layout.zenMode', zen);
    this._applyZenMode(zen);
  }

  _bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        this.toggleBottomPanel();
      }
      // Ctrl+K Z for Zen mode
      if (e.ctrlKey && e.key === 'k') {
        this._zenPending = true;
        setTimeout(() => { this._zenPending = false; }, 500);
      }
      if (this._zenPending && e.key === 'z') {
        e.preventDefault();
        this._zenPending = false;
        this.toggleZenMode();
      }
      // Escape exits Zen mode
      if (e.key === 'Escape' && this.state.get('layout.zenMode')) {
        this.toggleZenMode();
      }
    });
  }

  toggleSidebar() {
    const vis = !this.state.get('layout.sidebarVisible');
    this.state.set('layout.sidebarVisible', vis);
    const sidebar = this._root?.querySelector('.pg-sidebar');
    if (sidebar) {
      sidebar.style.display = vis ? '' : 'none';
      sidebar.style.width = vis ? this.state.get('layout.sidebarWidth') + 'px' : '0px';
    }
    const resize = this._root?.querySelector('.pg-sidebar-resize');
    if (resize) resize.classList.toggle('hidden', !vis);
    this._triggerLayout();
  }

  toggleBottomPanel() {
    const vis = !this.state.get('layout.bottomPanelVisible');
    this.state.set('layout.bottomPanelVisible', vis);
    const panel = this._root?.querySelector('.pg-bottom-panel');
    if (panel) {
      panel.style.display = vis ? '' : 'none';
      panel.style.height = vis ? this.state.get('layout.bottomPanelHeight') + 'px' : '0px';
    }
    const resize = this._root?.querySelector('.pg-bottom-resize');
    if (resize) resize.classList.toggle('hidden', !vis);
    this._triggerLayout();
  }

  toggleRightPanel() {
    const vis = !this.state.get('layout.rightPanelVisible');
    this.state.set('layout.rightPanelVisible', vis);
    const panel = this._root?.querySelector('.pg-right-panel');
    if (panel) {
      panel.style.display = vis ? '' : 'none';
      panel.style.width = vis ? this.state.get('layout.rightPanelWidth') + 'px' : '0px';
    }
    const resize = this._root?.querySelector('.pg-right-resize');
    if (resize) resize.classList.toggle('hidden', !vis);
    this._triggerLayout();
  }

  _showSettings() {
    const el = document.getElementById('pg-right-content');
    if (!el) return;
    el.innerHTML = `
      <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</div>
      <div class="space-y-3 text-[11px]">
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Theme</span>
          <select class="pg-setting-theme bg-gray-700 text-gray-200 rounded px-2 py-0.5 text-[10px] border border-gray-600">
            <option value="dark" ${this.state.get('theme') === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${this.state.get('theme') === 'light' ? 'selected' : ''}>Light</option>
            <option value="hc-black" ${this.state.get('theme') === 'hc-black' ? 'selected' : ''}>High Contrast</option>
          </select>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Font Size</span>
          <input type="number" class="pg-setting-fontsize bg-gray-700 text-gray-200 rounded px-2 py-0.5 text-[10px] border border-gray-600 w-16" value="${this.state.get('editorFontSize')}" min="10" max="32">
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Tab Size</span>
          <select class="pg-setting-tabsize bg-gray-700 text-gray-200 rounded px-2 py-0.5 text-[10px] border border-gray-600">
            <option value="2" ${this.state.get('editor.tabSize') === 2 ? 'selected' : ''}>2</option>
            <option value="4" ${this.state.get('editor.tabSize') === 4 ? 'selected' : ''}>4</option>
            <option value="8" ${this.state.get('editor.tabSize') === 8 ? 'selected' : ''}>8</option>
          </select>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Minimap</span>
          <label class="switch"><input type="checkbox" class="pg-setting-minimap" ${this.state.get('minimap') ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Word Wrap</span>
          <label class="switch"><input type="checkbox" class="pg-setting-wordwrap" ${this.state.get('editor.wordWrap') ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Auto-run Preview</span>
          <label class="switch"><input type="checkbox" class="pg-setting-autorun" ${this.state.get('preview.autoRefresh') ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-gray-400">Ligatures</span>
          <label class="switch"><input type="checkbox" class="pg-setting-ligatures" ${this.state.get('editorLigatures') ? 'checked' : ''}><span class="slider"></span></label>
        </div>
      </div>
    `;

    el.querySelector('.pg-setting-theme')?.addEventListener('change', function() {
      const next = this.value;
      const editor = window.__playground?.editor?.editor;
      const map = { dark: 'vs-dark', light: 'vs', 'hc-black': 'hc-black' };
      if (editor) editor.updateOptions({ theme: map[next] || 'vs-dark' });
      document.documentElement.classList.toggle('dark', next !== 'light');
    });
    el.querySelector('.pg-setting-fontsize')?.addEventListener('change', function() {
      const pg = window.__playground;
      if (pg?.editor) {
        const newSize = Math.max(10, Math.min(32, parseInt(this.value) || 14));
        const oldSize = pg.state.get('editorFontSize') || 14;
        pg.editor.changeFontSize(newSize - oldSize);
      }
    });
    el.querySelector('.pg-setting-tabsize')?.addEventListener('change', function() {
      const editor = window.__playground?.editor?.editor;
      if (editor) editor.updateOptions({ tabSize: parseInt(this.value) });
    });
    el.querySelector('.pg-setting-minimap')?.addEventListener('change', function() {
      window.__playground?.editor?.toggleMinimap();
    });
    el.querySelector('.pg-setting-wordwrap')?.addEventListener('change', function() {
      const editor = window.__playground?.editor?.editor;
      if (editor) editor.updateOptions({ wordWrap: this.checked ? 'on' : 'off' });
    });
    el.querySelector('.pg-setting-autorun')?.addEventListener('change', function() {
      const pg = window.__playground;
      if (pg) pg.state.set('preview.autoRefresh', this.checked);
    });
    el.querySelector('.pg-setting-ligatures')?.addEventListener('change', function() {
      const editor = window.__playground?.editor?.editor;
      if (editor) editor.updateOptions({ fontLigatures: this.checked });
    });
  }

  _bindResizeHandlers() {
    const sidebarResize = this._root?.querySelector('.pg-sidebar-resize');
    if (sidebarResize) {
      sidebarResize.addEventListener('mousedown', (e) => {
        this._resizing = { target: 'sidebar', startX: e.clientX, startW: this.state.get('layout.sidebarWidth') };
        document.addEventListener('mousemove', this._onResize);
        document.addEventListener('mouseup', this._stopResize);
        e.preventDefault();
      });
    }
    const bottomResize = this._root?.querySelector('.pg-bottom-resize');
    if (bottomResize) {
      bottomResize.addEventListener('mousedown', (e) => {
        this._resizing = { target: 'bottom', startY: e.clientY, startH: this.state.get('layout.bottomPanelHeight') };
        document.addEventListener('mousemove', this._onResize);
        document.addEventListener('mouseup', this._stopResize);
        e.preventDefault();
      });
    }
    const rightResize = this._root?.querySelector('.pg-right-resize');
    if (rightResize) {
      rightResize.addEventListener('mousedown', (e) => {
        this._resizing = { target: 'right', startX: e.clientX, startW: this.state.get('layout.rightPanelWidth') };
        document.addEventListener('mousemove', this._onResize);
        document.addEventListener('mouseup', this._stopResize);
        e.preventDefault();
      });
    }
  }

  get _onResize() {
    return (e) => {
      if (!this._resizing) return;
      if (this._resizing.target === 'sidebar') {
        const w = Math.max(this._minSidebar, Math.min(this._maxSidebar, this._resizing.startW + (e.clientX - this._resizing.startX)));
        this.state.set('layout.sidebarWidth', w);
        const el = this._root?.querySelector('.pg-sidebar');
        if (el) el.style.width = w + 'px';
      } else if (this._resizing.target === 'bottom') {
        const h = Math.max(this._minBottom, Math.min(this._maxBottom, this._resizing.startH - (e.clientY - this._resizing.startY)));
        this.state.set('layout.bottomPanelHeight', h);
        const el = this._root?.querySelector('.pg-bottom-panel');
        if (el) el.style.height = h + 'px';
      } else if (this._resizing.target === 'right') {
        const w = Math.max(150, Math.min(500, this._resizing.startW - (e.clientX - this._resizing.startX)));
        this.state.set('layout.rightPanelWidth', w);
        const el = this._root?.querySelector('.pg-right-panel');
        if (el) el.style.width = w + 'px';
      }
      this._triggerLayout();
    };
  }

  get _stopResize() {
    return () => {
      this._resizing = null;
      document.removeEventListener('mousemove', this._onResize);
      document.removeEventListener('mouseup', this._stopResize);
    };
  }

  _triggerLayout() {
    if (this.components.editor?.editor) {
      this.components.editor.editor.layout();
    }
  }

  _updateStatusBar() {
    const active = this.state.get('activeFile');
    const file = this.state.get('files')[active];
    const langEl = document.getElementById('pg-status-lang');
    if (langEl && file) langEl.textContent = file.language.toUpperCase();
  }

  static _lastCtx = null;

  dispose() {
    this._container.innerHTML = '';
    document.removeEventListener('mousemove', this._onResize);
    document.removeEventListener('mouseup', this._stopResize);
  }
}

window.PlaygroundLayout = PlaygroundLayout;