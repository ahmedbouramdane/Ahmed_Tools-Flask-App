class DesignEditorToolbar {
  constructor(state, workspace) {
    this.state = state;
    this.workspace = workspace;
    this.el = null;
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'de-toolbar';
    this.el.innerHTML = `
      <div class="de-toolbar-group">
        <button class="de-tb-btn" data-action="undo" title="Undo (Ctrl+Z)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><polyline points="7 6 3 10 7 14"/></svg></button>
        <button class="de-tb-btn" data-action="redo" title="Redo (Ctrl+Shift+Z)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H8a4 4 0 0 0 0 8h9"/><polyline points="17 6 21 10 17 14"/></svg></button>
      </div>
      <div class="de-toolbar-divider"></div>
      <div class="de-toolbar-group">
        <button class="de-tb-btn" data-action="zoom-out" title="Zoom Out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
        <span class="de-tb-label de-zoom-label">100%</span>
        <button class="de-tb-btn" data-action="zoom-in" title="Zoom In"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
        <button class="de-tb-btn" data-action="zoom-fit" title="Fit to Screen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></button>
      </div>
      <div class="de-toolbar-divider"></div>
      <div class="de-toolbar-group">
        <button class="de-tb-btn" data-action="grid" title="Toggle Grid"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg></button>
        <button class="de-tb-btn" data-action="snap" title="Toggle Snap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3"/></svg></button>
      </div>
      <div class="de-toolbar-divider"></div>
      <div class="de-toolbar-group">
        <button class="de-tb-btn de-tb-active" data-tool="select" title="Select (V)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg></button>
        <button class="de-tb-btn" data-tool="text" title="Text (T)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></button>
        <button class="de-tb-btn" data-tool="rectangle" title="Rectangle (R)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></button>
        <button class="de-tb-btn" data-tool="circle" title="Circle (C)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></button>
        <button class="de-tb-btn" data-tool="triangle" title="Triangle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 22 2 22"/></svg></button>
        <button class="de-tb-btn" data-tool="line" title="Line (L)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="3"/></svg></button>
        <button class="de-tb-btn" data-tool="arrow" title="Arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/></svg></button>
        <button class="de-tb-btn" data-tool="hand" title="Hand (H)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.21 0-4.21-.9-5.66-2.34L3.5 15.5a1.5 1.5 0 0 1 2.12-2.12L8 15.5"/></svg></button>
      </div>
      <div class="de-toolbar-divider"></div>
      <div class="de-toolbar-group">
        <button class="de-tb-btn" data-action="duplicate" title="Duplicate (Ctrl+D)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="de-tb-btn" data-action="delete" title="Delete (Del)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
      <div class="de-toolbar-spacer"></div>
      <div class="de-toolbar-file-group">
        <span class="de-toolbar-project-name">Untitled Design</span>
        <button class="de-tb-btn" data-action="project-save" title="Save Project"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l7 7v9a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
        <button class="de-tb-btn" data-action="project-load" title="Load Project"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M4 21h16"/></svg></button>
        <button class="de-tb-btn" data-action="project-share" title="Share Project"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/></svg></button>
      </div>
      <div class="de-toolbar-group">
        <button class="de-tb-btn" data-action="export" title="Export"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</button>
      </div>
    `;

    this._bindEvents();
    this._bindState();
    const label = this.el.querySelector('.de-toolbar-project-name');
    const meta = this.state.get('projectMeta');
    if (label && meta?.name) {
      label.textContent = meta.name;
    }
    container.appendChild(this.el);
  }

  _bindEvents() {
    this.el.addEventListener('click', e => {
      const btn = e.target.closest('.de-tb-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const tool = btn.dataset.tool;

      if (tool) {
        this.state.set('activeTool', tool);
        this.el.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('de-tb-active'));
        btn.classList.add('de-tb-active');
        return;
      }

      switch (action) {
        case 'undo':
          this.state.get('history')?.undo();
          break;
        case 'redo':
          this.state.get('history')?.redo();
          break;
        case 'zoom-in':
          this.workspace.zoomIn();
          break;
        case 'zoom-out':
          this.workspace.zoomOut();
          break;
        case 'zoom-fit':
          this.workspace.zoomToFit();
          break;
        case 'grid':
          this.state.set('gridEnabled', !this.state.get('gridEnabled'));
          break;
        case 'snap':
          this.state.set('snapEnabled', !this.state.get('snapEnabled'));
          break;
        case 'duplicate': {
          const sel = this.state.get('selectedIds');
          if (sel.length > 0) {
            sel.forEach(id => this.state.duplicateObject(id));
            this.state.get('history')?.save();
          }
          break;
        }
        case 'delete': {
          const sel = [...this.state.get('selectedIds')];
          sel.forEach(id => this.state.removeObject(id));
          this.state.get('history')?.save();
          break;
        }
        case 'project-save':
          this._saveProject();
          break;
        case 'project-load':
          this._loadProject();
          break;
        case 'project-share':
          this._shareProject();
          break;
        case 'export':
          this._triggerExport();
          break;
      }
    });
  }

  _triggerExport() {
    const dialog = document.querySelector('.de-export-dialog');
    if (dialog) {
      dialog.classList.add('de-visible');
    } else {
      const evt = new CustomEvent('de:open-export');
      document.dispatchEvent(evt);
    }
  }

  _saveProject() {
    const project = this.workspace.getProjectData();
    const name = project.projectMeta?.name || 'design';
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name.replace(/\s+/g, '-') + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    localStorage.setItem('de_last_saved_project', data);
    showToast('Project saved locally');
  }

  _loadProject() {
    if (!this._fileInput) {
      this._fileInput = document.createElement('input');
      this._fileInput.type = 'file';
      this._fileInput.accept = '.json';
      this._fileInput.style.display = 'none';
      this._fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
          try {
            const data = JSON.parse(event.target.result);
            this.workspace.loadProject(data);
            showToast('Project loaded');
          } catch (err) {
            showToast('Invalid project file', 'error');
          }
        };
        reader.readAsText(file);
      });
      document.body.appendChild(this._fileInput);
    }
    this._fileInput.click();
  }

  async _shareProject() {
    const project = this.workspace.getProjectData();
    try {
      const response = await fetch('/tools/api/design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: project })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unable to share project');
      }
      const url = data.url;
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard');
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Share link ready',
          html: `<div style="word-break:break-all; text-align:left; font-size:0.95rem;">${escapeHtml(url)}</div>`,
          confirmButtonText: 'Close',
          width: 'min(600px, 90vw)'
        });
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Share failed', 'error');
    }
  }

  _bindState() {
    this.state.on('zoom', z => {
      const label = this.el.querySelector('.de-zoom-label');
      if (label) label.textContent = Math.round(z * 100) + '%';
    });
    this.state.on('activeTool', tool => {
      this.el.querySelectorAll('[data-tool]').forEach(b => {
        b.classList.toggle('de-tb-active', b.dataset.tool === tool);
      });
    });
    this.state.on('gridEnabled', val => {
      const btn = this.el.querySelector('[data-action="grid"]');
      if (btn) btn.classList.toggle('de-tb-active', val);
    });
    this.state.on('snapEnabled', val => {
      const btn = this.el.querySelector('[data-action="snap"]');
      if (btn) btn.classList.toggle('de-tb-active', val);
    });
    this.state.on('*', () => {
      const label = this.el.querySelector('.de-toolbar-project-name');
      const meta = this.state.get('projectMeta');
      if (label && meta?.name) {
        label.textContent = meta.name;
      }
    });
  }
}

window.DesignEditorToolbar = DesignEditorToolbar;
