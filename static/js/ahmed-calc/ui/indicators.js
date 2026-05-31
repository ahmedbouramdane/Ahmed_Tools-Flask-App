class CalcIndicators {
  constructor(calculator) {
    this.calc = calculator;
    this.state = calculator.state;
    this.el = null;
    this._shiftEl = null;
    this._alphaEl = null;
    this._angleEl = null;
    this._memEl = null;
    this._ansEl = null;
    this._modeEl = null;
    this._errorEl = null;
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'ck-indicators';
    this.el.innerHTML =
      '<span class="ck-ind ck-ind-shift hidden">SHIFT</span>' +
      '<span class="ck-ind ck-ind-alpha hidden">ALPHA</span>' +
      '<span class="ck-ind ck-ind-angle">DEG</span>' +
      '<span class="ck-ind ck-ind-mem hidden">M</span>' +
      '<span class="ck-ind ck-ind-ans hidden">ANS</span>' +
      '<span class="ck-ind-spacer"></span>' +
      '<span class="ck-ind ck-ind-error hidden">ERROR</span>' +
      '<span class="ck-ind ck-ind-mode">COMP</span>';

    container.appendChild(this.el);

    this._shiftEl = this.el.querySelector('.ck-ind-shift');
    this._alphaEl = this.el.querySelector('.ck-ind-alpha');
    this._angleEl = this.el.querySelector('.ck-ind-angle');
    this._memEl = this.el.querySelector('.ck-ind-mem');
    this._ansEl = this.el.querySelector('.ck-ind-ans');
    this._errorEl = this.el.querySelector('.ck-ind-error');
    this._modeEl = this.el.querySelector('.ck-ind-mode');

    var self = this;
    this.state.on('shift:changed', function() { self._updateShift(); });
    this.state.on('alpha:changed', function() { self._updateAlpha(); });
    this.state.on('angle:changed', function(v) { self._updateAngle(v); });
    this.state.on('mode:changed', function(v) { self._updateMode(v); });
  }

  update() {
    this._updateShift();
    this._updateAlpha();
    this._updateAngle(this.state.angleMode);
    this._updateMode(this.state.mode);
    this._updateMem();
    this._updateAns();
    this._updateError();
  }

  _updateShift() {
    if (this._shiftEl) this._shiftEl.classList.toggle('hidden', !this.state.shiftOn);
  }

  _updateAlpha() {
    if (this._alphaEl) this._alphaEl.classList.toggle('hidden', !this.state.alphaOn);
  }

  _updateAngle(mode) {
    if (this._angleEl) this._angleEl.textContent = mode || this.state.angleMode;
  }

  _updateMode(mode) {
    if (this._modeEl) this._modeEl.textContent = mode || this.state.mode;
  }

  _updateMem() {
    if (this._memEl) this._memEl.classList.toggle('hidden', !this.state.hasMemory);
  }

  _updateAns() {
    if (this._ansEl) {
      this._ansEl.classList.toggle('hidden', this.state.ans === 0);
    }
  }

  _updateError() {
    if (this._errorEl) this._errorEl.classList.toggle('hidden', !this.state.error);
  }
}
window.CalcIndicators = CalcIndicators;
