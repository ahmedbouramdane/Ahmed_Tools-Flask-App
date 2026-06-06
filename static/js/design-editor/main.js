class DesignEditor {
  constructor(mountId) {
    this.mountId = mountId;
    this.container = document.getElementById(mountId);
    this.state = new DesignEditorState();
    this.history = new DesignEditorHistory(this.state);
    this.autosave = new DesignEditorAutosave(this.state);

    this.state.set('history', this.history);

    this.workspace = null;
    this.toolbar = null;
    this.leftPanel = null;
    this.rightPanel = null;
    this.layerPanel = null;
    this.exportDialog = null;
    this.plugins = new DesignEditorPluginSystem(this);

  }

  init() {
    this.autosave.restore();
    this._buildUI();
    this.autosave.start();
    this._loadGoogleFonts();
    this._bindGlobalKeys();
  }

  _buildUI() {
    this.container.innerHTML = '';
    this.container.className = 'de-editor';

    const layout = document.createElement('div');
    layout.className = 'de-layout';
    layout.innerHTML = `
      <div class="de-toolbar-area"></div>
      <div class="de-main-area">
        <div class="de-left-area"></div>
        <div class="de-canvas-area"></div>
        <div class="de-right-column">
          <div class="de-right-area"></div>
          <div class="de-layer-area"></div>
        </div>
      </div>
    `;

    this.container.appendChild(layout);

    this.workspace = new DesignEditorWorkspace(this.state, layout.querySelector('.de-canvas-area'));

    this.toolbar = new DesignEditorToolbar(this.state, this.workspace);
    this.toolbar.mount(layout.querySelector('.de-toolbar-area'));

    this.leftPanel = new DesignEditorLeftPanel(this.state);
    this.leftPanel.mount(layout.querySelector('.de-left-area'));

    this.rightPanel = new DesignEditorRightPanel(this.state);
    this.rightPanel.mount(layout.querySelector('.de-right-area'));

    this.layerPanel = new DesignEditorLayerPanel(this.state);
    this.layerPanel.mount(layout.querySelector('.de-layer-area'));

    this.exportDialog = new DesignEditorExportDialog(this.state, this.workspace);
    this.exportDialog.mount(this.container);

    this._initPlugins();
  }

  _initPlugins() {
    const defaultPlugins = [];
    defaultPlugins.forEach(p => this.plugins.register(p));
  }

  getProjectData() {
    return this.state.serialize();
  }

  loadProject(data) {
    if (!data) return;
    this.state.deserialize(data);
    this.state.set('projectMeta.modified', Date.now());
    this.state.set('selectedIds', []);
    if (this.workspace) this.workspace.scheduleRender();
  }

  async loadSharedProject(projectId) {
    try {
      const response = await fetch('/tools/api/design/load/' + encodeURIComponent(projectId));
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unable to load shared project');
      }
      this.loadProject(data.project);
      showToast('Shared design loaded');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load shared design', 'error');
    }
  }

  _bindGlobalKeys() {
    this._globalKeyHandler = e => {
      if (!this.container?.isConnected) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.history.undo();
        return;
      }
      if (e.ctrlKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this.history.redo();
        return;
      }
      if (e.ctrlKey && e.key === 'Z') {
        e.preventDefault();
        this.history.redo();
        return;
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const sel = this.state.get('selectedIds');
        sel.forEach(id => this.state.duplicateObject(id));
        this.history.save();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = [...this.state.get('selectedIds')];
        if (sel.length > 0) {
          e.preventDefault();
          sel.forEach(id => this.state.removeObject(id));
          this.history.save();
        }
        return;
      }

      const toolKeys = { v: 'select', t: 'text', r: 'rectangle', c: 'circle', l: 'line', h: 'hand' };
      if (!e.ctrlKey && !e.metaKey && toolKeys[e.key]) {
        this.state.set('activeTool', toolKeys[e.key]);
      }
    };
    document.addEventListener('keydown', this._globalKeyHandler);
  }

  _loadGoogleFonts() {
    const href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap';
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  dispose() {
    this.autosave.stop();
    if (this._globalKeyHandler) document.removeEventListener('keydown', this._globalKeyHandler);
    this.workspace?.dispose();
    this.rightPanel?.dispose();
    this.layerPanel?.dispose();
    this.exportDialog?.dispose();
    this.container.innerHTML = '';
    this.container.className = '';
  }
}

window.DesignEditor = DesignEditor;
