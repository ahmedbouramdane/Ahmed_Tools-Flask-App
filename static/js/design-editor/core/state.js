class DesignEditorState {
  constructor() {
    this._listeners = {};
    this._data = {
      objects: [],
      selectedIds: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      gridEnabled: true,
      snapEnabled: true,
      gridSize: 20,
      canvas: {
        width: 800,
        height: 600,
        background: '#ffffff',
        transparentBg: false
      },
      activeTool: 'select',
      activePanel: 'elements',
      projectMeta: {
        name: 'Untitled Design',
        created: Date.now(),
        modified: Date.now()
      },
      ui: {
        darkMode: document.documentElement.classList.contains('dark'),
        leftPanelOpen: true,
        rightPanelOpen: true,
        layerPanelOpen: true
      }
    };
  }

  get(path) {
    if (!path) return this._data;
    const parts = path.split('.');
    let val = this._data;
    for (const p of parts) {
      if (val == null) return undefined;
      val = val[p];
    }
    return val;
  }

  set(path, value) {
    const parts = path.split('.');
    const key = parts.pop();
    let obj = this._data;
    for (const p of parts) {
      if (!obj[p] || typeof obj[p] !== 'object') obj[p] = {};
      obj = obj[p];
    }
    const old = obj[key];
    obj[key] = value;
    this._emit(path, value, old);
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  }

  _emit(path, value, old) {
    (this._listeners[path] || []).forEach(fn => fn(value, old));
    (this._listeners['*'] || []).forEach(fn => fn(path, value, old));
  }

  addObject(obj) {
    const objects = [...this.get('objects')];
    obj.id = obj.id || 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    obj.zIndex = objects.length;
    objects.push(obj);
    this.set('objects', objects);
    this.set('selectedIds', [obj.id]);
    return obj;
  }

  updateObject(id, props) {
    let matched = false;
    const objects = this.get('objects').map(o => {
      if (o.id === id) { matched = true; return { ...o, ...props }; }
      return o;
    });
    if (matched) this.set('objects', objects);
  }

  removeObject(id) {
    let objects = this.get('objects').filter(o => o.id !== id);
    objects = objects.map((o, i) => ({ ...o, zIndex: i }));
    this.set('objects', objects);
    const selected = this.get('selectedIds').filter(s => s !== id);
    this.set('selectedIds', selected);
  }

  getObject(id) {
    return this.get('objects').find(o => o.id === id);
  }

  getSelectedObjects() {
    const ids = this.get('selectedIds');
    return this.get('objects').filter(o => ids.includes(o.id));
  }

  moveObject(id, dx, dy) {
    const obj = this.getObject(id);
    if (obj) this.updateObject(id, { x: obj.x + dx, y: obj.y + dy });
  }

  bringForward(id) {
    const objects = this.get('objects');
    const idx = objects.findIndex(o => o.id === id);
    if (idx < objects.length - 1) {
      const swapped = [...objects];
      [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
      swapped.forEach((o, i) => o.zIndex = i);
      this.set('objects', [...swapped]);
    }
  }

  sendBackward(id) {
    const objects = this.get('objects');
    const idx = objects.findIndex(o => o.id === id);
    if (idx > 0) {
      const swapped = [...objects];
      [swapped[idx], swapped[idx - 1]] = [swapped[idx - 1], swapped[idx]];
      swapped.forEach((o, i) => o.zIndex = i);
      this.set('objects', [...swapped]);
    }
  }

  bringToFront(id) {
    let objects = this.get('objects').filter(o => o.id !== id);
    const obj = this.getObject(id);
    if (obj) {
      obj.zIndex = objects.length;
      objects.push({ ...obj });
      objects.forEach((o, i) => o.zIndex = i);
      this.set('objects', [...objects]);
    }
  }

  sendToBack(id) {
    let objects = this.get('objects').filter(o => o.id !== id);
    const obj = this.getObject(id);
    if (obj) {
      obj.zIndex = 0;
      objects.unshift({ ...obj });
      objects.forEach((o, i) => o.zIndex = i);
      this.set('objects', [...objects]);
    }
  }

  duplicateObject(id) {
    const obj = this.getObject(id);
    if (!obj) return null;
    const clone = JSON.parse(JSON.stringify(obj));
    clone.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    clone.x += 20;
    clone.y += 20;
    return this.addObject(clone);
  }

  getObjectsSorted() {
    return [...this.get('objects')].sort((a, b) => a.zIndex - b.zIndex);
  }

  _reloadImageObjs(arr) {
    return arr.map(obj => {
      if (obj.type === 'image' && obj.src && !obj._img) {
        const img = new Image();
        img.src = obj.src;
        obj._img = img;
      }
      return obj;
    });
  }

  serialize() {
    const data = JSON.parse(JSON.stringify(this._data));
    data.objects = data.objects.map(o => {
      if (o._img) { const c = { ...o }; delete c._img; return c; }
      return o;
    });
    return data;
  }

  deserialize(data) {
    this._data = JSON.parse(JSON.stringify(data));
    this._reloadImageObjs(this._data.objects);
    this._emit('objects', this._data.objects, null);
    this._emit('selectedIds', this._data.selectedIds, null);
    this._emit('zoom', this._data.zoom, null);
    this._emit('panX', this._data.panX, null);
    this._emit('panY', this._data.panY, null);
    this._emit('gridEnabled', this._data.gridEnabled, null);
    this._emit('snapEnabled', this._data.snapEnabled, null);
    this._emit('canvas', this._data.canvas, null);
    this._emit('activeTool', this._data.activeTool, null);
    this._emit('*', 'deserialized', null);
  }
}

window.DesignEditorState = DesignEditorState;
