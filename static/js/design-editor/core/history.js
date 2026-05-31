class DesignEditorHistory {
  constructor(state, maxSteps = 50) {
    this.state = state;
    this.maxSteps = maxSteps;
    this._stack = [];
    this._index = -1;
    this._saving = false;
    this._checkpoint(state.serialize());
  }

  _checkpoint(snapshot) {
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }
    this._stack.push(snapshot);
    if (this._stack.length > this.maxSteps) {
      this._stack.shift();
    }
    this._index = this._stack.length - 1;
  }

  save() {
    if (this._saving) return;
    this._saving = true;
    this._checkpoint(this.state.serialize());
    this._saving = false;
  }

  undo() {
    if (this._index <= 0) return false;
    this._index--;
    this.state.deserialize(this._stack[this._index]);
    return true;
  }

  redo() {
    if (this._index >= this._stack.length - 1) return false;
    this._index++;
    this.state.deserialize(this._stack[this._index]);
    return true;
  }

  canUndo() {
    return this._index > 0;
  }

  canRedo() {
    return this._index < this._stack.length - 1;
  }

  clear() {
    this._stack = [];
    this._index = -1;
    this._checkpoint(this.state.serialize());
  }
}

window.DesignEditorHistory = DesignEditorHistory;
