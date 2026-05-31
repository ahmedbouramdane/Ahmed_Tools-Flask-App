class CalcModeManager {
  constructor(calculator) {
    this.calc = calculator;
    this.state = calculator.state;
    this._modes = ['COMP', 'GRAPH', 'TABLE', 'EQN'];
    this._angles = ['DEG', 'RAD', 'GRAD'];
  }

  cycleMode() {
    var idx = this._modes.indexOf(this.state.mode);
    var next = this._modes[(idx + 1) % this._modes.length];
    this.state.mode = next;
    this.state.emit('mode:changed', next);
    this.calc._rebuildKeypad();
  }

  cycleAngle() {
    var idx = this._angles.indexOf(this.state.angleMode);
    var next = this._angles[(idx + 1) % this._angles.length];
    this.state.angleMode = next;
    this.state.emit('angle:changed', next);
  }

  toggleShift() {
    this.state.shiftOn = !this.state.shiftOn;
    this.state.emit('shift:changed', this.state.shiftOn);
    this.calc._rebuildKeypad();
  }

  toggleAlpha() {
    this.state.alphaOn = !this.state.alphaOn;
    this.state.emit('alpha:changed', this.state.alphaOn);
  }

  getAngleSuffix() {
    return this.state.angleMode === 'DEG' ? '_deg' : this.state.angleMode === 'GRAD' ? '_grad' : '_rad';
  }

  getEvalScope() {
    var mode = this.state.angleMode;
    var self = this;
    return {
      sin_deg: function(x) { return Math.sin(x * Math.PI / 180); },
      cos_deg: function(x) { return Math.cos(x * Math.PI / 180); },
      tan_deg: function(x) { return Math.tan(x * Math.PI / 180); },
      sin_rad: function(x) { return Math.sin(x); },
      cos_rad: function(x) { return Math.cos(x); },
      tan_rad: function(x) { return Math.tan(x); },
      sin_grad: function(x) { return Math.sin(x * Math.PI / 200); },
      cos_grad: function(x) { return Math.cos(x * Math.PI / 200); },
      tan_grad: function(x) { return Math.tan(x * Math.PI / 200); },
      arcsin_deg: function(x) { return Math.asin(x) * 180 / Math.PI; },
      arccos_deg: function(x) { return Math.acos(x) * 180 / Math.PI; },
      arctan_deg: function(x) { return Math.atan(x) * 180 / Math.PI; },
      arcsin_rad: function(x) { return Math.asin(x); },
      arccos_rad: function(x) { return Math.acos(x); },
      arctan_rad: function(x) { return Math.atan(x); },
      arcsin_grad: function(x) { return Math.asin(x) * 200 / Math.PI; },
      arccos_grad: function(x) { return Math.acos(x) * 200 / Math.PI; },
      arctan_grad: function(x) { return Math.atan(x) * 200 / Math.PI; },
      log10: Math.log10 || function(x) { return Math.log(x) / Math.LN10; },
      log: Math.log,
      sqrt: Math.sqrt,
      abs: Math.abs,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      pi: Math.PI,
      e: Math.E,
      ans: this.state.ans
    };
  }
}
window.CalcModeManager = CalcModeManager;
