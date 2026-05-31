class PlaygroundShortcuts {
  constructor(state, ctx) {
    this.state = state;
    this.ctx = ctx; // { editor, preview, layout, palette }
    this._handlers = {};
    this._registerDefaults();
    this._bindGlobal();
  }

  _registerDefaults() {
    this.on('ctrl+s', (e) => {
      e.preventDefault();
      this._save();
    });

    this.on('ctrl+enter', (e) => {
      e.preventDefault();
      this.ctx.preview?.build();
    });

    this.on('ctrl+f', (e) => {
      e.preventDefault();
      this.ctx.editor?.find();
    });

    this.on('ctrl+h', (e) => {
      e.preventDefault();
      this.ctx.editor?.replace();
    });

    this.on('ctrl+/', (e) => {
      e.preventDefault();
      this.ctx.editor?.toggleComment();
    });

    this.on('ctrl+b', (e) => {
      e.preventDefault();
      this.ctx.layout?.toggleSidebar();
    });

    this.on('ctrl+`', (e) => {
      e.preventDefault();
      this.ctx.layout?.toggleBottomPanel();
    });

    this.on('ctrl+shift+p', (e) => {
      e.preventDefault();
      this.ctx.palette?.toggle();
    });

    this.on('ctrl+p', (e) => {
      e.preventDefault();
      this.ctx.palette?.showQuickOpen();
    });

    this.on('ctrl+d', (e) => {
      // Allow Monaco to handle multi-cursor natively
    });

    this.on('ctrl+shift+l', (e) => {
      e.preventDefault();
      this.ctx.editor?.selectAllOccurrences();
    });

    this.on('shift+alt+f', (e) => {
      e.preventDefault();
      this.ctx.editor?.formatCode();
    });

    this.on('ctrl+d', (e) => {
      // Multi-cursor next match - let Monaco handle it natively
    });

    this.on('ctrl+shift+f', (e) => {
      e.preventDefault();
      // Global search - show in sidebar
      this.ctx.layout?.toggleSidebar();
    });

    this.on('ctrl+shift+o', (e) => {
      e.preventDefault();
      this.ctx.editor?.toggleOutput();
    });

    this.on('ctrl+shift+5', (e) => {
      e.preventDefault();
      this.ctx.editor?.toggleSplit();
    });

    this.on('ctrl+k', (e) => {
      // Zen mode sequence: Ctrl+K then Z
      this._zenPending = true;
      setTimeout(() => { this._zenPending = false; }, 500);
    });

    document.addEventListener('keydown', (e) => {
      if (this._zenPending && e.key === 'z') {
        e.preventDefault();
        this._zenPending = false;
        this.ctx.layout?.toggleZenMode();
      }
    });

    this.on('escape', (e) => {
      if (this.ctx.palette?._visible) {
        this.ctx.palette.hide();
      }
    });
  }

  on(key, handler) {
    const normalized = key.toLowerCase().replace(/\s+/g, '');
    this._handlers[normalized] = handler;
    return this;
  }

  off(key) {
    delete this._handlers[key.toLowerCase().replace(/\s+/g, '')];
    return this;
  }

  _bindGlobal() {
    document.addEventListener('keydown', (e) => {
      const combo = this._getCombo(e);
      const handler = this._handlers[combo];
      if (handler) {
        handler(e);
      }
    });
  }

  _getCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Only shift if it's a letter key
      if (e.key.length === 1 && e.key >= 'A' && e.key <= 'Z') {
        parts.push('shift');
      }
    }
    if (e.altKey) parts.push('alt');

    let key = e.key;
    if (key === ' ') key = 'space';
    else if (key === '`') key = '`';
    else if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return '';
    else key = key.toLowerCase();

    parts.push(key);
    return parts.join('+');
  }

  _save() {
    try {
      const snapshot = this.state.snapshot();
      const id = this.state.get('project.id');
      localStorage.setItem('pg_saved_' + id, snapshot);
      localStorage.setItem('pg_project_id', id);
      this.state.set('dirtyFiles', new Set());
      this.state.set('lastSaved', Date.now());
    } catch (e) { /* localStorage full */ }
  }
}

window.PlaygroundShortcuts = PlaygroundShortcuts;
