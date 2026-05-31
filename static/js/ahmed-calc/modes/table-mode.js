class CalcTableMode {
  constructor(calculator) {
    this.calc = calculator;
    this.state = calculator.state;
    this.parser = calculator.parser;
    this.container = null;
    this._currentFn = 'x';
    this._start = -5;
    this._end = 5;
    this._step = 1;
  }

  mount(container) {
    this.container = container;
    this._renderUI();
  }

  _renderUI(data) {
    if (!this.container) return;
    var hasData = data && data.length > 0;
    this.container.innerHTML = [
      '<div class="ck-table-ui">',
      '<div class="ck-table-input-row">',
      '<span class="ck-table-prefix">f(x)=</span>',
      '<input class="ck-table-fn" value="' + escapeAttr(this._currentFn) + '" spellcheck="false">',
      '</div>',
      '<div class="ck-table-params">',
      '<label>Start</label><input class="ck-table-start" type="number" value="' + this._start + '">',
      '<label>End</label><input class="ck-table-end" type="number" value="' + this._end + '">',
      '<label>Step</label><input class="ck-table-step" type="number" value="' + this._step + '" step="0.5">',
      '<button class="ck-table-gen">Generate</button>',
      '</div>',
      '<div class="ck-table-data">',
      hasData ? this._buildTableHtml(data) : '<div class="ck-table-empty">Set parameters and click Generate</div>',
      '</div>',
      '</div>'
    ].join('');

    var self = this;
    var genBtn = this.container.querySelector('.ck-table-gen');
    if (genBtn) {
      genBtn.addEventListener('click', function() { self._generateFromUI(); });
    }
    var inputs = this.container.querySelectorAll('.ck-table-fn, .ck-table-start, .ck-table-end, .ck-table-step');
    inputs.forEach(function(el) {
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') self._generateFromUI();
      });
    });
  }

  _generateFromUI() {
    var fn = this.container?.querySelector('.ck-table-fn')?.value || 'x';
    var start = parseFloat(this.container?.querySelector('.ck-table-start')?.value) || -5;
    var end = parseFloat(this.container?.querySelector('.ck-table-end')?.value) || 5;
    var step = parseFloat(this.container?.querySelector('.ck-table-step')?.value) || 1;
    this._currentFn = fn;
    this._start = start;
    this._end = end;
    this._step = step;
    this.generateTable(fn, start, end, step);
  }

  generateTable(latex, start, end, step) {
    if (start === undefined) start = this._start;
    if (end === undefined) end = this._end;
    if (step === undefined) step = this._step;
    this._currentFn = latex || 'x';
    this._start = start;
    this._end = end;
    this._step = step;

    var data = this._generate(latex || this._currentFn, start, end, step);
    this._renderUI(data);
  }

  _generate(latex, start, end, step) {
    var js = this.parser.toMathJS(latex || 'x', this.state.angleMode);
    if (!js) return [];
    var results = [];
    var scope = this.calc.modes.getEvalScope();
    for (var x = start; x <= end + 0.0001; x += step) {
      scope.x = Math.round(x * 10000) / 10000;
      try {
        var val = math.evaluate(js, scope);
        results.push({
          x: scope.x,
          y: isFinite(val) ? Math.round(val * 10000) / 10000 : '—'
        });
      } catch (e) {
        results.push({ x: scope.x, y: 'Error' });
      }
    }
    return results;
  }

  _buildTableHtml(data) {
    return '<table><thead><tr><th>x</th><th>f(x)</th></tr></thead><tbody>' +
      data.map(function(d) { return '<tr><td>' + d.x + '</td><td>' + d.y + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  clear() {
    if (this.container) this._renderUI();
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.CalcTableMode = CalcTableMode;