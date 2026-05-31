class CalcState {
  constructor() {
    this._listeners = {};
    this.mode = 'COMP';
    this.angleMode = 'DEG';
    this.shiftOn = false;
    this.alphaOn = false;
    this.symbolicMode = true;
    this.memory = 0;
    this.hasMemory = false;
    this.ans = 0;
    this.result = null;
    this.resultLatex = '';
    this.showResult = false;
    this.error = null;
    this.history = [];
    this.constants = {
      pi: Math.PI, e: Math.E,
      c: 299792458, h: 6.62607015e-34, G: 6.67430e-11,
      g: 9.80665, NA: 6.02214076e23, R: 8.314462618, k: 1.380649e-23
    };
  }

  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    var self = this;
    return function() { self.off(event, fn); };
  }

  off(event, fn) {
    var arr = this._listeners[event];
    if (arr) this._listeners[event] = arr.filter(function(f) { return f !== fn; });
  }

  emit(event, data) {
    var arr = this._listeners[event];
    if (arr) arr.forEach(function(fn) { fn(data); });
  }

  set(key, val) {
    if (this[key] !== undefined && this[key] !== val) {
      this[key] = val;
      this.emit(key + ':changed', val);
      this.emit('changed', { key: key, value: val });
    }
  }

  toggle(key) {
    this.set(key, !this[key]);
  }
}
window.CalcState = CalcState;
