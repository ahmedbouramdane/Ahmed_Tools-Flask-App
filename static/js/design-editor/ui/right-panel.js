class DesignEditorRightPanel {
  constructor(state) {
    this.state = state;
    this.el = null;
    this._unsubs = [];
    this._ignoreUpdate = false;
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'de-right-panel';
    this.el.innerHTML = `
      <div class="de-panel-title">Properties</div>
      <div class="de-props-content">
        <div class="de-prop-placeholder">Select an element to edit its properties</div>
      </div>
    `;
    container.appendChild(this.el);

    this._unsubs.push(
      this.state.on('selectedIds', () => this._update())
    );
  }

  _update() {
    if (this._ignoreUpdate) return;
    const sel = this.state.getSelectedObjects();
    const content = this.el.querySelector('.de-props-content');

    if (sel.length === 0) {
      content.innerHTML = '<div class="de-prop-placeholder">Select an element to edit its properties</div>';
      return;
    }

    if (sel.length > 1) {
      content.innerHTML = '<div class="de-prop-placeholder">' + sel.length + ' elements selected</div>';
      return;
    }

    const obj = sel[0];
    content.innerHTML = this._buildProps(obj);
    this._bindProps(content, obj);
  }

  _buildProps(obj) {
    const type = obj.type;
    let html = '';

    html += this._propRow('X', `<input type="number" class="de-prop-input de-prop-x" value="${Math.round(obj.x || 0)}" step="1">`);
    html += this._propRow('Y', `<input type="number" class="de-prop-input de-prop-y" value="${Math.round(obj.y || 0)}" step="1">`);
    html += this._propRow('W', `<input type="number" class="de-prop-input de-prop-w" value="${Math.round(obj.w || 100)}" step="1" min="1">`);
    html += this._propRow('H', `<input type="number" class="de-prop-input de-prop-h" value="${Math.round(obj.h || 100)}" step="1" min="1">`);

    html += '<div class="de-prop-divider"></div>';

    html += this._propRow('Opacity', `<input type="range" class="de-prop-range de-prop-opacity" min="0" max="1" step="0.05" value="${obj.opacity ?? 1}"><span class="de-prop-range-val">${Math.round((obj.opacity ?? 1) * 100)}%</span>`);
    html += this._propRow('Rotation', `<input type="range" class="de-prop-range de-prop-rotation" min="-180" max="180" step="1" value="${obj.rotation || 0}"><span class="de-prop-range-val">${obj.rotation || 0}°</span>`);

    html += '<div class="de-prop-divider"></div>';

    html += this._propRow('Fill', `<input type="color" class="de-prop-color de-prop-fill" value="${obj.fill || '#6366f1'}">`);

    if (type !== 'text' && type !== 'line' && type !== 'arrow') {
      html += this._propRow('Border Radius', `<input type="range" class="de-prop-range de-prop-radius" min="0" max="50" step="1" value="${obj.borderRadius || 0}"><span class="de-prop-range-val">${obj.borderRadius || 0}</span>`);
    }

    html += this._propRow('Stroke', `<input type="color" class="de-prop-color de-prop-stroke" value="${obj.stroke || '#000000'}">`);
    html += this._propRow('Stroke W', `<input type="number" class="de-prop-input de-prop-stroke-width" value="${obj.strokeWidth || 0}" min="0" max="20" step="1">`);

    html += '<div class="de-prop-divider"></div>';

    html += '<label class="de-prop-check"><input type="checkbox" class="de-prop-locked" ' + (obj.locked ? 'checked' : '') + '> Locked</label>';

    if (type === 'text') {
      html += '<div class="de-prop-divider"></div>';
      html += '<div class="de-panel-title" style="font-size:10px;margin-top:8px">Text Properties</div>';
      html += this._propRow('Font', `<select class="de-prop-select de-prop-font">${DesignEditorObjectUtils.FONTS.map(f => `<option value="${f}" ${obj.fontFamily === f ? 'selected' : ''}>${f.split(',')[0]}</option>`).join('')}</select>`);
      html += this._propRow('Size', `<input type="number" class="de-prop-input de-prop-font-size" value="${obj.fontSize || 24}" min="8" max="200">`);
      html += this._propRow('Weight', `<select class="de-prop-select de-prop-font-weight"><option value="normal" ${obj.fontWeight === 'normal' ? 'selected' : ''}>Normal</option><option value="bold" ${obj.fontWeight === 'bold' ? 'selected' : ''}>Bold</option></select>`);
      html += this._propRow('Style', `<select class="de-prop-select de-prop-font-style"><option value="normal" ${obj.fontStyle === 'normal' ? 'selected' : ''}>Normal</option><option value="italic" ${obj.fontStyle === 'italic' ? 'selected' : ''}>Italic</option></select>`);
      html += this._propRow('Align', `<div class="de-prop-btn-group"><button class="de-prop-btn ${(obj.textAlign || 'left') === 'left' ? 'active' : ''}" data-align="left">L</button><button class="de-prop-btn ${obj.textAlign === 'center' ? 'active' : ''}" data-align="center">C</button><button class="de-prop-btn ${obj.textAlign === 'right' ? 'active' : ''}" data-align="right">R</button></div>`);
      html += this._propRow('Line H', `<input type="number" class="de-prop-input de-prop-line-height" value="${obj.lineHeight || 1.4}" min="0.5" max="3" step="0.1">`);
      html += this._propRow('Spacing', `<input type="number" class="de-prop-input de-prop-letter-spacing" value="${obj.letterSpacing || 0}" min="-5" max="20" step="0.5">`);
    }

    if (type === 'image') {
      html += '<div class="de-prop-divider"></div>';
      html += '<div class="de-panel-title" style="font-size:10px;margin-top:8px">Image Adjustments</div>';
      const f = obj.filters || { brightness: 100, contrast: 100, blur: 0, grayscale: 0, saturation: 100 };
      html += this._propRow('Brightness', `<input type="range" class="de-prop-range de-filter-brightness" min="0" max="200" value="${f.brightness}"><span class="de-prop-range-val">${f.brightness}%</span>`);
      html += this._propRow('Contrast', `<input type="range" class="de-prop-range de-filter-contrast" min="0" max="200" value="${f.contrast}"><span class="de-prop-range-val">${f.contrast}%</span>`);
      html += this._propRow('Blur', `<input type="range" class="de-prop-range de-filter-blur" min="0" max="20" step="0.5" value="${f.blur}"><span class="de-prop-range-val">${f.blur}</span>`);
      html += this._propRow('Grayscale', `<input type="range" class="de-prop-range de-filter-grayscale" min="0" max="100" value="${f.grayscale}"><span class="de-prop-range-val">${f.grayscale}%</span>`);
      html += this._propRow('Saturation', `<input type="range" class="de-prop-range de-filter-saturation" min="0" max="200" value="${f.saturation}"><span class="de-prop-range-val">${f.saturation}%</span>`);
      html += '<div class="de-prop-row"><button class="de-prop-btn de-reset-filters" style="width:100%">Reset Filters</button></div>';
    }

    return html;
  }

  _bindProps(content, obj) {
    const fire = (path, val) => {
      this._ignoreUpdate = true;
      this.state.updateObject(obj.id, val);
      this.state.get('history')?.save();
      this._ignoreUpdate = false;
    };

    content.querySelector('.de-prop-x')?.addEventListener('change', e => fire('x', { x: parseFloat(e.target.value) || 0 }));
    content.querySelector('.de-prop-y')?.addEventListener('change', e => fire('y', { y: parseFloat(e.target.value) || 0 }));
    content.querySelector('.de-prop-w')?.addEventListener('change', e => fire('w', { w: Math.max(1, parseFloat(e.target.value) || 1) }));
    content.querySelector('.de-prop-h')?.addEventListener('change', e => fire('h', { h: Math.max(1, parseFloat(e.target.value) || 1) }));

    content.querySelector('.de-prop-opacity')?.addEventListener('input', e => {
      fire('opacity', { opacity: parseFloat(e.target.value) });
      content.querySelector('.de-prop-opacity + .de-prop-range-val').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
    });
    content.querySelector('.de-prop-rotation')?.addEventListener('input', e => {
      fire('rotation', { rotation: parseFloat(e.target.value) });
      content.querySelector('.de-prop-rotation + .de-prop-range-val').textContent = parseFloat(e.target.value) + '°';
    });

    content.querySelector('.de-prop-fill')?.addEventListener('input', e => fire('fill', { fill: e.target.value }));
    content.querySelector('.de-prop-radius')?.addEventListener('input', e => {
      fire('borderRadius', { borderRadius: parseFloat(e.target.value) });
      content.querySelector('.de-prop-radius + .de-prop-range-val').textContent = e.target.value;
    });
    content.querySelector('.de-prop-stroke')?.addEventListener('input', e => fire('stroke', { stroke: e.target.value }));
    content.querySelector('.de-prop-stroke-width')?.addEventListener('change', e => fire('strokeWidth', { strokeWidth: parseFloat(e.target.value) || 0 }));
    content.querySelector('.de-prop-locked')?.addEventListener('change', e => fire('locked', { locked: e.target.checked }));

    content.querySelector('.de-prop-font')?.addEventListener('change', e => fire('fontFamily', { fontFamily: e.target.value }));
    content.querySelector('.de-prop-font-size')?.addEventListener('change', e => fire('fontSize', { fontSize: parseFloat(e.target.value) || 24 }));
    content.querySelector('.de-prop-font-weight')?.addEventListener('change', e => fire('fontWeight', { fontWeight: e.target.value }));
    content.querySelector('.de-prop-font-style')?.addEventListener('change', e => fire('fontStyle', { fontStyle: e.target.value }));
    content.querySelector('.de-prop-line-height')?.addEventListener('change', e => fire('lineHeight', { lineHeight: parseFloat(e.target.value) || 1.4 }));
    content.querySelector('.de-prop-letter-spacing')?.addEventListener('change', e => fire('letterSpacing', { letterSpacing: parseFloat(e.target.value) || 0 }));

    content.querySelectorAll('.de-prop-btn[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.de-prop-btn[data-align]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fire('textAlign', { textAlign: btn.dataset.align });
      });
    });

    ['brightness', 'contrast', 'blur', 'grayscale', 'saturation'].forEach(filter => {
      const input = content.querySelector('.de-filter-' + filter);
      if (input) {
        input.addEventListener('input', e => {
          const filters = { ...(obj.filters || {}), [filter]: parseFloat(e.target.value) };
          fire('filters', { filters });
          const val = content.querySelector('.de-filter-' + filter + ' + .de-prop-range-val');
          if (val) val.textContent = e.target.value + (filter === 'blur' ? '' : '%');
        });
      }
    });

    content.querySelector('.de-reset-filters')?.addEventListener('click', () => {
      const reset = { brightness: 100, contrast: 100, blur: 0, grayscale: 0, saturation: 100 };
      fire('filters', { filters: reset });
      this._update();
    });
  }

  _propRow(label, input) {
    return `<div class="de-prop-row"><span class="de-prop-label">${label}</span><div class="de-prop-control">${input}</div></div>`;
  }

  dispose() {
    this._unsubs.forEach(u => u());
    this.el?.remove();
  }
}

window.DesignEditorRightPanel = DesignEditorRightPanel;
