class PlaygroundFileSystem {
  constructor(state) {
    this.state = state;
    this._container = null;
    this._treeEl = null;
    this._ctxMenu = null;
  }

  mount(container) {
    this._container = container;
    this._render();
    this._bindEvents();
    this.state.on('file:created', () => this._render());
    this.state.on('file:deleted', () => this._render());
    this.state.on('file:renamed', () => this._render());
    this.state.on('file:changed', () => this._updateDirtyMarkers());
    this.state.on('file:opened', () => this._updateActive());
  }

  _render() {
    if (!this._container) return;
    const files = this.state.get('folderStructure');
    const children = files['/'] ? files['/'].children : Object.keys(this.state.get('files'));

    this._container.innerHTML = `
      <div class="p-2">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span><i class="fas fa-folder-open mr-1"></i> Explorer</span>
          <div class="flex gap-1">
            <button class="pg-fs-new px-1 py-0.5 text-[9px] text-gray-400 hover:text-white rounded hover:bg-gray-700/50 transition" title="New File"><i class="fas fa-plus"></i></button>
            <button class="pg-fs-refresh px-1 py-0.5 text-[9px] text-gray-400 hover:text-white rounded hover:bg-gray-700/50 transition" title="Refresh"><i class="fas fa-sync-alt"></i></button>
          </div>
        </div>
        <div class="space-y-0.5" id="pg-file-tree">
          ${children.map(name => this._renderFileItem(name)).join('')}
        </div>
      </div>
      <div class="px-2 pb-2">
        <button class="pg-fs-new w-full text-[10px] px-2 py-1 rounded border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition flex items-center justify-center gap-1">
          <i class="fas fa-plus text-[8px]"></i> New File
        </button>
      </div>
    `;
    this._treeEl = this._container.querySelector('#pg-file-tree');
    this._updateActive();
  }

  _renderFileItem(name) {
    const active = this.state.get('activeFile') === name;
    const isDirty = this.state.get('dirtyFiles').has(name);
    const icon = PlaygroundUtils.getFileIcon(name);
    return `<div class="pg-file-item flex items-center gap-1.5 px-2 py-1 rounded text-[11px] cursor-pointer ${active ? 'bg-indigo-900/30 text-indigo-300' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}" data-file="${name}" title="Right-click for options">
      <i class="${icon} text-[10px]"></i>
      <span class="flex-1 truncate">${name}</span>
      ${isDirty ? '<span class="text-indigo-400 text-[9px]">●</span>' : ''}
    </div>`;
  }

  _bindEvents() {
    if (!this._container) return;
    this._container.addEventListener('click', (e) => {
      const item = e.target.closest('.pg-file-item');
      if (item && !e.target.closest('.pg-fs-rename')) {
        this.state.openFile(item.dataset.file);
        return;
      }
      if (e.target.closest('.pg-fs-new')) this._promptNewFile();
      this._closeContextMenu();
    });

    this._container.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.pg-file-item');
      if (item) this._promptRename(item.dataset.file);
    });

    this._container.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.pg-file-item');
      if (!item) return;
      e.preventDefault();
      this._showContextMenu(e.clientX, e.clientY, item.dataset.file);
    });

    document.addEventListener('click', () => this._closeContextMenu());
  }

  _showContextMenu(x, y, name) {
    this._closeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'pg-fs-context-menu';
    menu.className = 'fixed z-50 bg-[#252526] border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px] text-[11px]';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const items = [
      { label: '<i class="fas fa-file mr-2 text-indigo-400"></i> Open', action: () => this.state.openFile(name) },
      { label: '<i class="fas fa-pen mr-2 text-blue-400"></i> Rename', action: () => this._promptRename(name) },
      { label: '<i class="fas fa-copy mr-2 text-gray-400"></i> Duplicate', action: () => this._promptDuplicate(name) },
      { type: 'separator' },
      { label: '<i class="fas fa-trash mr-2 text-red-400"></i> Delete', action: () => this._promptDelete(name) },
    ];

    items.forEach(item => {
      if (item.type === 'separator') {
        menu.innerHTML += '<div class="border-t border-gray-600 my-1"></div>';
      } else {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-1.5 text-gray-300 hover:bg-[#3c3c3c] hover:text-white flex items-center';
        btn.innerHTML = item.label;
        btn.addEventListener('click', (e) => { e.stopPropagation(); item.action(); this._closeContextMenu(); });
        menu.appendChild(btn);
      }
    });

    document.body.appendChild(menu);
    this._ctxMenu = menu;

    // Ensure it stays within viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
  }

  _closeContextMenu() {
    if (this._ctxMenu) { this._ctxMenu.remove(); this._ctxMenu = null; }
  }

  _updateActive() {
    if (!this._treeEl) return;
    const active = this.state.get('activeFile');
    this._treeEl.querySelectorAll('.pg-file-item').forEach(el => {
      const isActive = el.dataset.file === active;
      el.className = `pg-file-item flex items-center gap-1.5 px-2 py-1 rounded text-[11px] cursor-pointer ${isActive ? 'bg-indigo-900/30 text-indigo-300' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`;
    });
  }

  _updateDirtyMarkers() {
    if (!this._treeEl) return;
    const dirty = this.state.get('dirtyFiles');
    this._treeEl.querySelectorAll('.pg-file-item').forEach(el => {
      const name = el.dataset.file;
      let dot = el.querySelector('.dirty-dot');
      if (dirty.has(name)) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'dirty-dot text-indigo-400 text-[9px] ml-1';
          dot.textContent = '●';
          el.querySelector('span')?.after(dot);
        }
      } else {
        dot?.remove();
      }
    });
  }

  _promptNewFile() {
    const name = prompt('Enter file name (e.g. app.js):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (this.state.get('files')[trimmed]) { alert('File already exists'); return; }
    this.state.createFile(trimmed, '');
    this.state.openFile(trimmed);
  }

  _promptRename(name) {
    const newName = prompt('Rename "' + name + '" to:', name);
    if (!newName || newName === name) return;
    if (this.state.get('files')[newName]) { alert('File already exists'); return; }
    this.state.renameFile(name, newName);
  }

  _promptDuplicate(name) {
    const file = this.state.get('files')[name];
    if (!file) return;
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const base = ext ? name.slice(0, -ext.length) : name;
    let newName = base + '-copy' + ext;
    let count = 1;
    while (this.state.get('files')[newName]) { count++; newName = base + '-copy-' + count + ext; }
    this.state.createFile(newName, file.content, file.language);
    this.state.openFile(newName);
  }

  _promptDelete(name) {
    if (confirm('Delete "' + name + '"?')) {
      this.state.deleteFile(name);
    }
  }
}

window.PlaygroundFileSystem = PlaygroundFileSystem;