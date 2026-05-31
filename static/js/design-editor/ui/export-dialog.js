class DesignEditorExportDialog {
  constructor(state, workspace) {
    this.state = state;
    this.workspace = workspace;
    this.el = null;
    this._visible = false;
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'de-export-dialog';
    this.el.innerHTML = `
      <div class="de-export-overlay"></div>
      <div class="de-export-modal">
        <div class="de-export-header">
          <span class="de-panel-title" style="margin:0">Export Design</span>
          <button class="de-export-close">&times;</button>
        </div>
        <div class="de-export-body">
          <div class="de-export-section">
            <label class="de-prop-label">Format</label>
            <select class="de-export-format de-prop-select">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
          <div class="de-export-section">
            <label class="de-prop-label">Scale</label>
            <select class="de-export-scale de-prop-select">
              <option value="1">1×</option>
              <option value="2" selected>2× (High Quality)</option>
              <option value="3">3×</option>
              <option value="4">4× (Ultra)</option>
            </select>
          </div>
          <div class="de-export-section">
            <label class="de-prop-label">Quality</label>
            <input type="range" class="de-export-quality de-prop-range" min="0.1" max="1" step="0.1" value="0.9">
            <span class="de-prop-range-val de-export-quality-val">90%</span>
          </div>
          <div class="de-export-section">
            <label class="de-prop-check">
              <input type="checkbox" class="de-export-transparent" ${this.state.get('canvas').transparentBg ? 'checked' : ''}>
              Transparent Background
            </label>
          </div>
          <div class="de-export-preview">
            <canvas class="de-export-preview-canvas"></canvas>
          </div>
        </div>
        <div class="de-export-footer">
          <button class="de-btn de-btn-secondary de-export-cancel">Cancel</button>
          <button class="de-btn de-btn-primary de-export-download">Download</button>
        </div>
      </div>
    `;

    this._bindEvents();
    container.appendChild(this.el);

    document.addEventListener('de:open-export', () => this.show());
  }

  _bindEvents() {
    this.el.querySelector('.de-export-overlay').addEventListener('click', () => this.hide());
    this.el.querySelector('.de-export-close').addEventListener('click', () => this.hide());
    this.el.querySelector('.de-export-cancel').addEventListener('click', () => this.hide());

    this.el.querySelector('.de-export-format').addEventListener('change', () => this._refreshPreview());
    this.el.querySelector('.de-export-scale').addEventListener('change', () => this._refreshPreview());
    this.el.querySelector('.de-export-quality').addEventListener('input', e => {
      this.el.querySelector('.de-export-quality-val').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
    });

    this.el.querySelector('.de-export-download').addEventListener('click', () => this._export());
  }

  show() {
    if (this.el) {
      this.el.classList.add('de-visible');
      this._refreshPreview();
    }
  }

  hide() {
    if (this.el) this.el.classList.remove('de-visible');
  }

  _renderToCanvas(targetCanvas, scale, transparentBg) {
    const state = this.state;
    const canvas = state.get('canvas');
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    targetCanvas.width = w;
    targetCanvas.height = h;
    const ctx = targetCanvas.getContext('2d');

    if (transparentBg) {
      const checkerSize = 10 * scale;
      for (let x = 0; x < w; x += checkerSize * 2) {
        for (let y = 0; y < h; y += checkerSize * 2) {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(x, y, checkerSize, checkerSize);
          ctx.fillRect(x + checkerSize, y + checkerSize, checkerSize, checkerSize);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + checkerSize, y, checkerSize, checkerSize);
          ctx.fillRect(x, y + checkerSize, checkerSize, checkerSize);
        }
      }
    } else {
      ctx.fillStyle = canvas.background || '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    const zoom = state.get('zoom');
    const panX = state.get('panX');
    const panY = state.get('panY');

    ctx.save();
    state.getObjectsSorted().forEach(obj => {
      if (obj.visible === false) return;
      ctx.save();
      ctx.globalAlpha = (obj.opacity ?? 1);

      const cx2 = (obj.x + (obj.w || 50) / 2) * scale;
      const cy2 = (obj.y + (obj.h || 50) / 2) * scale;
      if (obj.rotation) {
        ctx.translate(cx2, cy2);
        ctx.rotate(obj.rotation * Math.PI / 180);
        ctx.translate(-cx2, -cy2);
      }

      const x = (obj.x || 0) * scale;
      const y = (obj.y || 0) * scale;
      const w2 = (obj.w || 100) * scale;
      const h2 = (obj.h || 100) * scale;

      if (obj.type === 'image' && obj._img) {
        ctx.save();
        const f = obj.filters;
        if (f) {
          const parts = [];
          if (f.brightness !== undefined && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
          if (f.contrast !== undefined && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
          if (f.blur !== undefined && f.blur > 0) parts.push(`blur(${f.blur}px)`);
          if (f.grayscale !== undefined && f.grayscale > 0) parts.push(`grayscale(${f.grayscale}%)`);
          if (f.saturation !== undefined && f.saturation !== 100) parts.push(`saturate(${f.saturation}%)`);
          if (parts.length) ctx.filter = parts.join(' ');
        }
        if (obj.borderRadius) {
          const r = obj.borderRadius * scale;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w2 - r, y);
          ctx.arcTo(x + w2, y, x + w2, y + r, r);
          ctx.lineTo(x + w2, y + h2 - r);
          ctx.arcTo(x + w2, y + h2, x + w2 - r, y + h2, r);
          ctx.lineTo(x + r, y + h2);
          ctx.arcTo(x, y + h2, x, y + h2 - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
          ctx.clip();
        }
        ctx.drawImage(obj._img, x, y, w2, h2);
        ctx.restore();
      } else if (obj.type === 'text') {
        const fontSize = (obj.fontSize || 24) * scale;
        ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontWeight || 'normal'} ${fontSize}px ${obj.fontFamily || 'Inter, sans-serif'}`;
        ctx.fillStyle = obj.fill || '#1f2937';
        ctx.textAlign = obj.textAlign || 'left';
        ctx.textBaseline = 'top';
        const lines = (obj.text || '').split('\n');
        const lineH = fontSize * (obj.lineHeight || 1.4);
        lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineH));
      } else {
        ctx.fillStyle = obj.fill || '#6366f1';
        if (obj.type === 'rectangle') {
          if (obj.borderRadius) {
            const r = obj.borderRadius * scale;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w2 - r, y);
            ctx.arcTo(x + w2, y, x + w2, y + r, r);
            ctx.lineTo(x + w2, y + h2 - r);
            ctx.arcTo(x + w2, y + h2, x + w2 - r, y + h2, r);
            ctx.lineTo(x + r, y + h2);
            ctx.arcTo(x, y + h2, x, y + h2 - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.rect(x, y, w2, h2);
            ctx.fill();
          }
        } else if (obj.type === 'circle') {
          ctx.beginPath();
          ctx.ellipse(x + w2 / 2, y + h2 / 2, w2 / 2, h2 / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(x + w2 / 2, y);
          ctx.lineTo(x + w2, y + h2);
          ctx.lineTo(x, y + h2);
          ctx.closePath();
          ctx.fill();
        } else if (obj.type === 'sticker') {
          const sticker = DesignEditorObjectUtils.STICKERS.find(s => s.id === obj.stickerId);
          ctx.font = `${Math.min(w2, h2) * 0.8}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sticker ? sticker.icon : '⭐', x + w2 / 2, y + h2 / 2);
        } else if (obj.type === 'line' || obj.type === 'arrow') {
          ctx.strokeStyle = obj.stroke || '#6b7280';
          ctx.lineWidth = (obj.strokeWidth || 2) * scale;
          ctx.beginPath();
          ctx.moveTo(x, y + h2 / 2);
          ctx.lineTo(x + w2, y + h2 / 2);
          ctx.stroke();
        }
        if (obj.stroke && obj.strokeWidth && obj.type !== 'line' && obj.type !== 'arrow') {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = (obj.strokeWidth || 0) * scale;
          ctx.stroke();
        }
      }
      ctx.restore();
    });
    ctx.restore();
  }

  _refreshPreview() {
    const previewCanvas = this.el.querySelector('.de-export-preview-canvas');
    if (!previewCanvas) return;
    const canvas = this.state.get('canvas');
    const container = previewCanvas.parentElement;
    const maxW = container.clientWidth || 300;
    const maxH = 200;
    const ratio = canvas.width / canvas.height;
    let pw = maxW, ph = maxW / ratio;
    if (ph > maxH) { ph = maxH; pw = maxH * ratio; }
    previewCanvas.style.width = pw + 'px';
    previewCanvas.style.height = ph + 'px';
    this._renderToCanvas(previewCanvas, Math.min(pw / canvas.width, ph / canvas.height), false);
  }

  _export() {
    const format = this.el.querySelector('.de-export-format').value;
    const scale = parseInt(this.el.querySelector('.de-export-scale').value) || 1;
    const quality = parseFloat(this.el.querySelector('.de-export-quality').value) || 0.9;
    const transparent = this.el.querySelector('.de-export-transparent').checked;

    const canvas = this.state.get('canvas');
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width * scale;
    exportCanvas.height = canvas.height * scale;

    this._renderToCanvas(exportCanvas, scale, transparent);

    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const dataUrl = exportCanvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = (this.state.get('projectMeta').name || 'design') + '.' + format;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.hide();
  }

  dispose() {
    this.el?.remove();
  }
}

window.DesignEditorExportDialog = DesignEditorExportDialog;
