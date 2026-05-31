class DesignEditorLayerPanel {
  constructor(state) {
    this.state = state;
    this.el = null;
    this._unsubs = [];
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'de-layer-panel';
    this.el.innerHTML = `
      <div class="de-layer-header">
        <span class="de-panel-title" style="margin:0">Layers</span>
        <div class="de-layer-actions">
          <button class="de-layer-action-btn" data-action="bring-forward" title="Bring Forward"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>
          <button class="de-layer-action-btn" data-action="send-backward" title="Send Backward"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>
          <button class="de-layer-action-btn" data-action="bring-to-front" title="Bring to Front"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 8 22 12 18 16"/><polyline points="6 8 2 12 6 16"/><line x1="2" y1="12" x2="22" y2="12"/></svg></button>
          <button class="de-layer-action-btn" data-action="send-to-back" title="Send to Back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 16 2 12 6 8"/><polyline points="18 16 22 12 18 8"/><line x1="2" y1="12" x2="22" y2="12"/></svg></button>
        </div>
      </div>
      <div class="de-layer-list"></div>
    `;

    this._bindActions();
    this._unsubs.push(
      this.state.on('objects', () => this._renderList()),
      this.state.on('selectedIds', () => this._renderList())
    );

    container.appendChild(this.el);
    this._renderList();
  }

  _bindActions() {
    this.el.addEventListener('click', e => {
      const actionBtn = e.target.closest('.de-layer-action-btn');
      if (!actionBtn) return;

      const sel = this.state.get('selectedIds');
      if (sel.length !== 1) return;
      const id = sel[0];

      switch (actionBtn.dataset.action) {
        case 'bring-forward': this.state.bringForward(id); break;
        case 'send-backward': this.state.sendBackward(id); break;
        case 'bring-to-front': this.state.bringToFront(id); break;
        case 'send-to-back': this.state.sendToBack(id); break;
      }
      this.state.get('history')?.save();
    });
  }

  _renderList() {
    const list = this.el.querySelector('.de-layer-list');
    if (!list) return;
    const objects = this.state.getObjectsSorted();
    const selectedIds = this.state.get('selectedIds');

    if (objects.length === 0) {
      list.innerHTML = '<div class="de-layer-empty">No layers</div>';
      return;
    }

    list.innerHTML = [...objects].reverse().map(obj => {
      const isSelected = selectedIds.includes(obj.id);
      const icon = this._typeIcon(obj.type);
      return `<div class="de-layer-item ${isSelected ? 'de-layer-selected' : ''}" data-id="${obj.id}">
        <span class="de-layer-icon">${icon}</span>
        <span class="de-layer-name">${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}${obj.text ? ': ' + obj.text.slice(0, 20) : ''}</span>
        <span class="de-layer-vis" data-vis="${obj.id}">${obj.visible === false ? '👁️‍🗨️' : '👁️'}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.de-layer-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.de-layer-vis')) return;
        const id = item.dataset.id;
        this.state.set('selectedIds', [id]);
      });

      const visBtn = item.querySelector('.de-layer-vis');
      if (visBtn) {
        visBtn.addEventListener('click', e => {
          e.stopPropagation();
          const id = visBtn.dataset.vis;
          const obj = this.state.getObject(id);
          if (obj) {
            this.state.updateObject(id, { visible: obj.visible === false ? true : false });
            this.state.get('history')?.save();
          }
        });
      }
    });
  }

  _typeIcon(type) {
    const icons = {
      rectangle: '▣', circle: '●', triangle: '▲', line: '━', arrow: '→',
      text: 'T', image: '🖼', sticker: '⭐', group: '📁'
    };
    return icons[type] || '■';
  }

  dispose() {
    this._unsubs.forEach(u => u());
    this.el?.remove();
  }
}

window.DesignEditorLayerPanel = DesignEditorLayerPanel;
