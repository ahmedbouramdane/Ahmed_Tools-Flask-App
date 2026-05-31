class DesignEditorAutosave {
  constructor(state, key = 'de_autosave', interval = 5000) {
    this.state = state;
    this.key = key;
    this.interval = interval;
    this._timer = null;
    this._dirty = false;
    this._enabled = true;

    state.on('*', () => {
      this._dirty = true;
    });
  }

  start() {
    this._tick();
    return this;
  }

  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    return this;
  }

  _tick() {
    if (this._dirty && this._enabled) {
      try {
        const data = this.state.serialize();
        localStorage.setItem(this.key, JSON.stringify(data));
        this._dirty = false;
      } catch (e) {
        console.warn('Autosave failed:', e);
      }
    }
    this._timer = setTimeout(() => this._tick(), this.interval);
  }

  restore() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const data = JSON.parse(raw);
        this.state.deserialize(data);
        return true;
      }
    } catch (e) {
      console.warn('Autosave restore failed:', e);
    }
    return false;
  }

  clearSaved() {
    localStorage.removeItem(this.key);
  }

  setEnabled(val) {
    this._enabled = val;
  }
}

window.DesignEditorAutosave = DesignEditorAutosave;
