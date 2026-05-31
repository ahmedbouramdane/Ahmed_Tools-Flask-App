class Playground {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) throw new Error('Playground container not found');

    this.state = new PlaygroundState();
    this.explorer = new PlaygroundFileSystem(this.state);
    this.editor = new PlaygroundEditor(this.state);
    this.preview = new PlaygroundPreview(this.state);
    this.console = new PlaygroundConsole(this.state);
    this.terminal = new PlaygroundTerminal(this.state);
    this.theme = new PlaygroundTheme(this.state);
    this.extensions = new PlaygroundExtensions(this.state);

    this.layout = new PlaygroundLayout(this.state, {
      explorer: this.explorer,
      editor: this.editor,
      preview: this.preview,
      console: this.console,
      terminal: this.terminal
    });

    this.palette = new PlaygroundCommandPalette(this.state, {
      editor: this.editor,
      preview: this.preview,
      console: this.console,
      terminal: this.terminal,
      layout: this.layout
    });

    this.shortcuts = new PlaygroundShortcuts(this.state, {
      editor: this.editor,
      preview: this.preview,
      layout: this.layout,
      palette: this.palette
    });

    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this.theme.init();
    const editorReady = this.layout.mount(this.container);
    this.extensions.init();

    const cursorEl = document.getElementById('pg-status-cursor');
    if (cursorEl && this.editor) this.editor.setStatusBar(cursorEl);

    this.state.on('output:changed', (html) => {
      if (this.state.get('editor.showOutput')) {
        this.editor.refreshOutput();
      }
    });

    this.preview.build();
    this._initProblemsListener();

    Promise.resolve(editorReady).then(() => {
      this._loadProject();
    }, () => {
      this._loadProject();
    });

    this._setupAutosave();
    this._handleDispose();

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'p' || e.key === 'P')) {}
    });

    const runBtn = this.container.querySelector('.pg-layout-btn-run');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.preview.build();
        if (this.state.get('editor.showOutput')) {
          this.editor.refreshOutput();
        }
      });
    }

    window.__playground = this;
  }

  _storeProjectId() {
    try {
      localStorage.setItem('pg_project_id', this.state.get('project.id'));
    } catch(e) {}
  }

  _setupAutosave() {
    setInterval(() => {
      const dirty = this.state.get('dirtyFiles');
      if (dirty.size > 0) {
        try {
          const snapshot = this.state.snapshot();
          localStorage.setItem('pg_autosave_' + this.state.get('project.id'), snapshot);
          this._storeProjectId();
          const el = document.getElementById('pg-status-autosave');
          if (el) {
            el.classList.remove('hidden');
            setTimeout(() => el.classList.add('hidden'), 2000);
          }
        } catch (e) {}
      }
    }, 30000);
  }

  _loadProject() {
    try {
      const lastId = localStorage.getItem('pg_project_id');
      if (lastId) {
        const autosave = localStorage.getItem('pg_autosave_' + lastId);
        if (autosave) {
          this.state.hydrate(autosave);
          return;
        }
        const saved = localStorage.getItem('pg_saved_' + lastId);
        if (saved) {
          this.state.hydrate(saved);
          return;
        }
      }
      const id = this.state.get('project.id');
      const autosave = localStorage.getItem('pg_autosave_' + id);
      if (autosave) { this.state.hydrate(autosave); return; }
      const saved = localStorage.getItem('pg_saved_' + id);
      if (saved) { this.state.hydrate(saved); }
    } catch (e) {}
  }

  _handleDispose() {
    window.addEventListener('beforeunload', () => {
      try {
        const snapshot = this.state.snapshot();
        localStorage.setItem('pg_autosave_' + this.state.get('project.id'), snapshot);
        this._storeProjectId();
      } catch (e) {}
    });
  }

  _initProblemsListener() {
    const checkMarkers = () => {
      if (!window.monaco || !this.editor?.editor) return;
      const model = this.editor.editor.getModel();
      if (!model) return;
      try {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const problems = markers.map(m => ({
          message: m.message,
          file: this.state.get('activeFile'),
          line: m.startLineNumber,
          column: m.startColumn,
          severity: m.severity === monaco.MarkerSeverity.Error ? 'error' :
                   m.severity === monaco.MarkerSeverity.Warning ? 'warning' : 'info'
        }));
        this.state.clearProblems();
        problems.forEach(p => this.state.addProblem(p));
      } catch(e) {}
    };
    this.state.on('file:changed', PlaygroundUtils.debounce(checkMarkers, 500));
    this.state.on('file:opened', () => setTimeout(checkMarkers, 500));
    setInterval(checkMarkers, 3000);
  }

  dispose() {
    this.shortcuts?.off();
    this.editor?.dispose();
    this.layout?.dispose();
    this.container.innerHTML = '';
  }
}

window.Playground = Playground;