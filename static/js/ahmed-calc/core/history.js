class CalcHistory {
  constructor(state) {
    this.state = state;
    this._maxLen = 100;
  }

  add(entry) {
    this.state.history.unshift({
      latex: entry.latex || '',
      result: entry.result || '',
      resultLatex: entry.resultLatex || '',
      mode: entry.mode || this.state.mode,
      angleMode: entry.angleMode || this.state.angleMode,
      ts: Date.now()
    });
    if (this.state.history.length > this._maxLen) this.state.history.pop();
    this.state.emit('history:changed', this.state.history);
  }

  recall(index) {
    var entry = this.state.history[index];
    if (!entry) return null;
    return entry;
  }

  clear() {
    this.state.history = [];
    this.state.emit('history:changed', this.state.history);
  }

  getEntries() {
    return this.state.history.slice();
  }
}
window.CalcHistory = CalcHistory;
