class DesignEditorWorkspace {
  constructor(state, container) {
    this.state = state;
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._dragging = null;
    this._resizing = null;
    this._dragOffset = { x: 0, y: 0 };
    this._selectionRect = null;
    this._scale = 1;
    this._rafId = null;
    this._inlineTextEdit = null;
    this._onResizeFn = null;

    this._bindState();
    this._initCanvas();
    this._bindEvents();
    this.render();
  }

  _initCanvas() {
    this.container.innerHTML = '<div class="de-workspace"><canvas class="de-canvas"></canvas></div>';
    this.canvas = this.container.querySelector('.de-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this._scale = devicePixelRatio;
  }

  _bindState() {
    this._unsubs = [
      this.state.on('objects', () => this.scheduleRender()),
      this.state.on('selectedIds', () => this.scheduleRender()),
      this.state.on('zoom', () => this.scheduleRender()),
      this.state.on('panX', () => this.scheduleRender()),
      this.state.on('panY', () => this.scheduleRender()),
      this.state.on('canvas', () => this.scheduleRender()),
      this.state.on('gridEnabled', () => this.scheduleRender()),
    ];
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', e => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', e => this._onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this._onResizeFn = () => {
      this._resizeCanvas();
      this.scheduleRender();
    };
    window.addEventListener('resize', this._onResizeFn);
  }

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const zoom = this.state.get('zoom');
    const panX = this.state.get('panX');
    const panY = this.state.get('panY');
    const x = (e.clientX - rect.left - this.canvas.width / (2 * this._scale)) / zoom - panX;
    const y = (e.clientY - rect.top - this.canvas.height / (2 * this._scale)) / zoom - panY;
    return { x, y };
  }

  _snap(val) {
    if (!this.state.get('snapEnabled')) return val;
    const gridSize = this.state.get('gridSize');
    return Math.round(val / gridSize) * gridSize;
  }

  _onMouseDown(e) {
    const tool = this.state.get('activeTool');
    const pos = this._getCanvasCoords(e);

    if (e.button === 1 || (e.button === 0 && e.shiftKey && tool === 'select')) {
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    if (tool === 'hand') {
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const hit = this._hitTest(pos.x, pos.y);
    if (hit && tool === 'select') {
      this.state.set('selectedIds', [hit.id]);
      this._dragging = { id: hit.id, type: hit.type };
      this._dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
      this.canvas.style.cursor = 'move';

      const edge = this._hitEdge(hit, pos.x, pos.y);
      if (edge) {
        this._resizing = { id: hit.id, edge, startX: pos.x, startY: pos.y, origBounds: { x: hit.x, y: hit.y, w: hit.w, h: hit.h } };
        this._dragging = null;
        this.canvas.style.cursor = edge;
      }
    } else if (tool !== 'select') {
      const obj = this._createObjectAt(tool, pos);
      if (obj) {
        this.state.addObject(obj);
        this.state.get('history')?.save();
      }
    } else {
      this.state.set('selectedIds', []);
      this._selectionRect = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    }

    this.scheduleRender();
  }

  _onMouseMove(e) {
    if (this._isPanning) {
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      const zoom = this.state.get('zoom');
      this.state.set('panX', this.state.get('panX') + dx / zoom);
      this.state.set('panY', this.state.get('panY') + dy / zoom);
      this._panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    const pos = this._getCanvasCoords(e);

    if (this._dragging) {
      const obj = this.state.getObject(this._dragging.id);
      if (obj) {
        const newX = this._snap(pos.x - this._dragOffset.x);
        const newY = this._snap(pos.y - this._dragOffset.y);
        this.state.updateObject(obj.id, { x: newX, y: newY });
        this.scheduleRender();
      }
      return;
    }

    if (this._resizing) {
      const { id, edge, startX, startY, origBounds } = this._resizing;
      const dx = pos.x - startX;
      const dy = pos.y - startY;
      let { x, y, w, h } = origBounds;

      if (edge.includes('e')) w = Math.max(10, origBounds.w + dx);
      if (edge.includes('w')) { x = origBounds.x + dx; w = Math.max(10, origBounds.w - dx); }
      if (edge.includes('s')) h = Math.max(10, origBounds.h + dy);
      if (edge.includes('n')) { y = origBounds.y + dy; h = Math.max(10, origBounds.h - dy); }

      this.state.updateObject(id, { x, y, w, h });
      this.scheduleRender();
      return;
    }

    if (this._selectionRect) {
      this._selectionRect.x2 = pos.x;
      this._selectionRect.y2 = pos.y;
      this.scheduleRender();
      return;
    }

    const tool = this.state.get('activeTool');
    if (tool === 'select') {
      const hit = this._hitTest(pos.x, pos.y);
      this.canvas.style.cursor = hit ? (this._hitEdge(hit, pos.x, pos.y) || 'move') : 'default';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  _onMouseUp(e) {
    if (this._dragging) {
      this.state.get('history')?.save();
      this._dragging = null;
    }
    if (this._resizing) {
      this.state.get('history')?.save();
      this._resizing = null;
    }
    if (this._isPanning) {
      this._isPanning = false;
      this.canvas.style.cursor = this.state.get('activeTool') === 'hand' ? 'grab' : 'default';
    }
    if (this._selectionRect) {
      const r = this._selectionRect;
      const minX = Math.min(r.x1, r.x2);
      const maxX = Math.max(r.x1, r.x2);
      const minY = Math.min(r.y1, r.y2);
      const maxY = Math.max(r.y1, r.y2);
      const selected = this.state.getObjectsSorted().filter(o =>
        !o.locked && o.x >= minX && o.x + (o.w || 50) <= maxX &&
        o.y >= minY && o.y + (o.h || 50) <= maxY
      ).map(o => o.id);
      if (selected.length > 0) {
        this.state.set('selectedIds', selected);
      }
      this._selectionRect = null;
      this.scheduleRender();
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const zoom = Math.max(0.1, Math.min(10, this.state.get('zoom') + delta));
      this.state.set('zoom', zoom);
    } else {
      this.state.set('panX', this.state.get('panX') - e.deltaX / (this.state.get('zoom') * 2));
      this.state.set('panY', this.state.get('panY') - e.deltaY / (this.state.get('zoom') * 2));
    }
  }

  _onDoubleClick(e) {
    const pos = this._getCanvasCoords(e);
    const hit = this._hitTest(pos.x, pos.y);
    if (hit && hit.type === 'text') {
      this._startInlineTextEdit(hit);
    }
  }

  _hitTest(x, y) {
    const objects = this.state.getObjectsSorted();
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.locked) continue;
      const bounds = this._getBounds(o);
      if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
        return { ...o, ...bounds };
      }
    }
    return null;
  }

  _getBounds(obj) {
    const x = obj.x || 0;
    const y = obj.y || 0;
    const w = obj.w || (obj.type === 'text' ? (obj.text || 'Text').length * (obj.fontSize || 24) * 0.6 : 100);
    const h = obj.h || (obj.type === 'text' ? (obj.fontSize || 24) * 1.4 : 100);
    return { x, y, w, h };
  }

  _hitEdge(obj, x, y, margin = 6) {
    const b = this._getBounds(obj);
    let edge = '';
    if (Math.abs(x - b.x) < margin) edge += 'w';
    if (Math.abs(x - (b.x + b.w)) < margin) edge += 'e';
    if (Math.abs(y - b.y) < margin) edge += 'n';
    if (Math.abs(y - (b.y + b.h)) < margin) edge += 's';
    const map = { 'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize', 'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize' };
    return map[edge] || null;
  }

  _createObjectAt(tool, pos) {
    const x = this._snap(pos.x);
    const y = this._snap(pos.y);
    const props = { x, y };
    switch (tool) {
      case 'rectangle':
        return DesignEditorObjectUtils.createObject('rectangle', { x, y, w: 120, h: 90 });
      case 'circle':
        return DesignEditorObjectUtils.createObject('circle', { x, y, w: 100, h: 100 });
      case 'triangle':
        return DesignEditorObjectUtils.createObject('triangle', { x, y, w: 100, h: 100 });
      case 'line':
        return DesignEditorObjectUtils.createObject('line', { x, y });
      case 'text':
        return DesignEditorObjectUtils.createObject('text', { x, y, text: 'Double-click to edit' });
      case 'arrow':
        return DesignEditorObjectUtils.createObject('arrow', { x, y });
      default:
        return null;
    }
  }

  _startInlineTextEdit(obj) {
    if (this._inlineTextEdit) return;
    const zoom = this.state.get('zoom');
    const panX = this.state.get('panX');
    const panY = this.state.get('panY');
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const input = document.createElement('textarea');
    input.className = 'de-inline-text-input';
    input.value = obj.text || '';
    input.style.left = ((obj.x + panX) * zoom + cx) + 'px';
    input.style.top = ((obj.y + panY) * zoom + cy) + 'px';
    input.style.fontSize = (obj.fontSize || 24) * zoom + 'px';
    input.style.fontFamily = obj.fontFamily || 'Inter, sans-serif';
    input.style.fontWeight = obj.fontWeight || 'normal';
    input.style.fontStyle = obj.fontStyle || 'normal';
    input.style.color = obj.fill || '#1f2937';
    input.style.textAlign = obj.textAlign || 'left';
    input.style.letterSpacing = (obj.letterSpacing || 0) + 'px';
    input.style.lineHeight = obj.lineHeight || 1.4;
    input.style.width = Math.max(50, (obj.w || 200) * zoom) + 'px';
    input.style.minHeight = (obj.h || 36) * zoom + 'px';
    input.style.transform = `rotate(${obj.rotation || 0}deg)`;

    this._inlineTextEdit = { id: obj.id, input };
    this.container.appendChild(input);
    input.focus();
    input.select();

    const finish = () => {
      const newText = input.value;
      this.state.updateObject(obj.id, { text: newText });
      this.state.get('history')?.save();
      input.remove();
      this._inlineTextEdit = null;
      this.scheduleRender();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = obj.text;
        finish();
      }
    });
  }

  render() {
    const ctx = this.ctx;
    const zoom = this.state.get('zoom');
    const panX = this.state.get('panX');
    const panY = this.state.get('panY');
    const canvas = this.state.get('canvas');
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this._scale;

    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, w / s, h / s);

    const cx = w / (2 * s);
    const cy = h / (2 * s);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(panX, panY);

    if (canvas.transparentBg) {
      const checkerSize = 10 / zoom;
      for (let x = 0; x < canvas.width; x += checkerSize * 2) {
        for (let y = 0; y < canvas.height; y += checkerSize * 2) {
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
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (this.state.get('gridEnabled')) {
      const gridSize = this.state.get('gridSize');
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    const selectedIds = this.state.get('selectedIds');
    const objects = this.state.getObjectsSorted();

    objects.forEach(obj => {
      ctx.save();
      ctx.globalAlpha = obj.opacity ?? 1;
      const rot = obj.rotation || 0;
      const cx2 = obj.x + (obj.w || 50) / 2;
      const cy2 = obj.y + (obj.h || 50) / 2;
      if (rot) {
        ctx.translate(cx2, cy2);
        ctx.rotate(rot * Math.PI / 180);
        ctx.translate(-cx2, -cy2);
      }
      this._renderObject(ctx, obj);
      ctx.restore();
    });

    objects.forEach(obj => {
      if (obj.locked) return;
      if (selectedIds.includes(obj.id)) {
        ctx.save();
        const b = this._getBounds(obj);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.strokeRect(b.x - 2 / zoom, b.y - 2 / zoom, b.w + 4 / zoom, b.h + 4 / zoom);
        ctx.setLineDash([]);

        const hs = 6 / zoom;
        const handles = [
          { x: b.x, y: b.y }, { x: b.x + b.w / 2, y: b.y },
          { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h / 2 },
          { x: b.x + b.w, y: b.y + b.h }, { x: b.x + b.w / 2, y: b.y + b.h },
          { x: b.x, y: b.y + b.h }, { x: b.x, y: b.y + b.h / 2 }
        ];
        handles.forEach(h2 => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5 / zoom;
          ctx.fillRect(h2.x - hs / 2, h2.y - hs / 2, hs, hs);
          ctx.strokeRect(h2.x - hs / 2, h2.y - hs / 2, hs, hs);
        });
        ctx.restore();
      }
    });

    if (this._selectionRect) {
      const r = this._selectionRect;
      const minX = Math.min(r.x1, r.x2);
      const minY = Math.min(r.y1, r.y2);
      const rw = Math.abs(r.x2 - r.x1);
      const rh = Math.abs(r.y2 - r.y1);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      ctx.fillRect(minX, minY, rw, rh);
      ctx.strokeRect(minX, minY, rw, rh);
    }

    ctx.restore();
  }

  _renderObject(ctx, obj) {
    const x = obj.x || 0;
    const y = obj.y || 0;
    const w = obj.w || 100;
    const h = obj.h || 100;
    const zoom = this.state.get('zoom');

    if (obj.type === 'image' && obj._img && obj._img.complete && obj._img.naturalWidth > 0) {
      ctx.save();
      if (obj.filters) {
        const f = obj.filters;
        const filterParts = [];
        if (f.brightness !== undefined && f.brightness !== 100) filterParts.push(`brightness(${f.brightness}%)`);
        if (f.contrast !== undefined && f.contrast !== 100) filterParts.push(`contrast(${f.contrast}%)`);
        if (f.blur !== undefined && f.blur > 0) filterParts.push(`blur(${f.blur}px)`);
        if (f.grayscale !== undefined && f.grayscale > 0) filterParts.push(`grayscale(${f.grayscale}%)`);
        if (f.saturation !== undefined && f.saturation !== 100) filterParts.push(`saturate(${f.saturation}%)`);
        if (filterParts.length) ctx.filter = filterParts.join(' ');
      }
      if (obj.borderRadius) {
        ctx.beginPath();
        this._roundRect(ctx, x, y, w, h, obj.borderRadius);
        ctx.clip();
      }
      ctx.drawImage(obj._img, x, y, w, h);
      ctx.restore();
      if (obj.stroke && obj.strokeWidth) {
        ctx.save();
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth / zoom;
        ctx.beginPath();
        this._roundRect(ctx, x, y, w, h, (obj.borderRadius || 0));
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    if (obj.type === 'image') {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${24 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🖼', x + w / 2, y + h / 2);
      if (obj.stroke && obj.strokeWidth) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth / zoom;
        ctx.beginPath();
        this._roundRect(ctx, x, y, w, h, (obj.borderRadius || 0));
        ctx.stroke();
      }
      return;
    }

    switch (obj.type) {
      case 'rectangle':
        ctx.fillStyle = obj.fill || '#6366f1';
        this._roundRect(ctx, x, y, w, h, (obj.borderRadius || 0));
        ctx.fill();
        if (obj.stroke && obj.strokeWidth) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.strokeWidth / zoom;
          ctx.stroke();
        }
        break;

      case 'circle':
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = obj.fill || '#10b981';
        ctx.fill();
        if (obj.stroke && obj.strokeWidth) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.strokeWidth / zoom;
          ctx.stroke();
        }
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fillStyle = obj.fill || '#f59e0b';
        ctx.fill();
        if (obj.stroke && obj.strokeWidth) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.strokeWidth / zoom;
          ctx.stroke();
        }
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h / 2);
        ctx.strokeStyle = obj.stroke || '#6b7280';
        ctx.lineWidth = (obj.strokeWidth || 2) / zoom;
        ctx.stroke();
        break;

      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h / 2);
        ctx.strokeStyle = obj.stroke || '#6b7280';
        ctx.lineWidth = (obj.strokeWidth || 2) / zoom;
        ctx.stroke();
        const headLen = 10 / zoom;
        ctx.beginPath();
        ctx.moveTo(x + w, y + h / 2);
        ctx.lineTo(x + w - headLen, y + h / 2 - headLen * 0.5);
        ctx.lineTo(x + w - headLen, y + h / 2 + headLen * 0.5);
        ctx.closePath();
        ctx.fillStyle = obj.stroke || '#6b7280';
        ctx.fill();
        break;

      case 'sticker': {
        const sticker = DesignEditorObjectUtils.STICKERS.find(s => s.id === obj.stickerId);
        ctx.font = `${Math.min(w, h) * 0.8 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker ? sticker.icon : '⭐', x + w / 2, y + h / 2);
        break;
      }

      case 'text': {
        ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontWeight || 'normal'} ${(obj.fontSize || 24) / zoom}px ${obj.fontFamily || 'Inter, sans-serif'}`;
        ctx.fillStyle = obj.fill || '#1f2937';
        ctx.textAlign = obj.textAlign || 'left';
        ctx.textBaseline = 'top';

        if (obj.textShadow) {
          ctx.shadowColor = obj.textShadow.color || 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = obj.textShadow.blur || 4;
          ctx.shadowOffsetX = obj.textShadow.offsetX || 1;
          ctx.shadowOffsetY = obj.textShadow.offsetY || 1;
        }

        const lines = (obj.text || '').split('\n');
        const lineH = (obj.fontSize || 24) * (obj.lineHeight || 1.4);
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * lineH);
        });

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        if (obj.textStroke) {
          ctx.strokeStyle = obj.textStroke.color || '#000';
          ctx.lineWidth = (obj.textStroke.width || 1) / zoom;
          lines.forEach((line, i) => {
            ctx.strokeText(line, x, y + i * lineH);
          });
        }
        break;
      }

      default:
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#6b7280';
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + w / 2, y + h / 2);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  scheduleRender() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.render();
    });
  }

  zoomTo(factor) {
    this.state.set('zoom', Math.max(0.1, Math.min(10, factor)));
  }

  zoomIn() {
    this.zoomTo(this.state.get('zoom') + 0.2);
  }

  zoomOut() {
    this.zoomTo(this.state.get('zoom') - 0.2);
  }

  zoomToFit() {
    this.state.set('panX', 0);
    this.state.set('panY', 0);
    this.zoomTo(1);
  }

  centerView() {
    this.state.set('panX', 0);
    this.state.set('panY', 0);
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._unsubs.forEach(u => u());
    if (this._onResizeFn) window.removeEventListener('resize', this._onResizeFn);
    this._inlineTextEdit?.input?.remove();
    this.canvas?.remove();
    this.container.innerHTML = '';
  }
}

window.DesignEditorWorkspace = DesignEditorWorkspace;
