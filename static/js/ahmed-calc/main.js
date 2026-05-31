class AhmedCalculator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.state = new CalcState();
    this.parser = new LatexParser();
    this.historyEngine = new CalcHistory(this.state);
    this.keypad = new CalcKeypad();
    this.keyboard = new CalcKeyboard(this);
    this.modes = new CalcModeManager(this);
    this.graphMode = new CalcGraphMode(this);
    this.tableMode = new CalcTableMode(this);
    this.algebra = new CalcAlgebraMode(this);
    this.indicators = new CalcIndicators(this);

    this._mathField = null;
    this._resultEl = null;
    this._keypadContainer = null;
    this._historyContainer = null;
    this._sidePanel = null;
    this._debounceTimer = null;
    this._evalTimer = null;
  }

  init() {
    var self = this;
    this.container.innerHTML = '';
    this.container.className = 'ahmed-calc';

    if (!this._mathLiveReady()) {
      this.container.innerHTML = '<div class="ck-loading">Loading calculator...</div>';
      this._loadMathLive(function() { self._buildUI(); });
    } else {
      this._buildUI();
    }

    this.keyboard.bind();
  }

  _mathLiveReady() {
    return typeof MathLive !== 'undefined' && customElements.get('math-field');
  }

  _loadMathLive(callback) {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathlive@0.102.0/dist/mathlive.min.js';
    script.onload = function() { if (callback) setTimeout(callback, 100); };
    script.onerror = function() {
      document.getElementById('ahmed-calc-mount').innerHTML = '<div class="ck-loading ck-loading-error">Failed to load math editor. Please check your internet connection and refresh.</div>';
    };
    document.body.appendChild(script);
  }

  _buildUI() {
    this.container.innerHTML = this._uiHtml();
    this._mountComponents();
    this._loadLibraries();
    this.indicators.update();
  }

  _uiHtml() {
    return [
      '<div class="ck-layout">',
      '<div class="ck-main-col">',
      '<div class="ck-display-area"></div>',
      '<div class="ck-keypad-area"></div>',
      '<div class="ck-extras-area"></div>',
      '</div>',
      '<div class="ck-side-col">',
      '<div class="ck-side-tabs">',
      '<button class="ck-side-tab active" data-tab="history"><i class="fas fa-history"></i> History</button>',
      '<button class="ck-side-tab" data-tab="graph"><i class="fas fa-chart-line"></i> Graph</button>',
      '<button class="ck-side-tab" data-tab="table"><i class="fas fa-table"></i> Table</button>',
      '<button class="ck-side-tab" data-tab="algebra"><i class="fas fa-superscript"></i> Algebra</button>',
      '</div>',
      '<div class="ck-side-content">',
      '<div class="ck-side-panel active" id="ck-panel-history"><div class="ck-history-list"><div class="ck-empty-state">No calculations yet</div></div></div>',
      '<div class="ck-side-panel" id="ck-panel-graph"><div class="ck-graph-area"></div></div>',
      '<div class="ck-side-panel" id="ck-panel-table"><div class="ck-table-area"></div></div>',
      '<div class="ck-side-panel" id="ck-panel-algebra"><div class="ck-algebra-area"></div></div>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');
  }

  _mountComponents() {
    var displayArea = this.container.querySelector('.ck-display-area');
    this.indicators.mount(displayArea);
    this._createMathField(displayArea);
    this._createResultArea(displayArea);

    this._keypadContainer = this.container.querySelector('.ck-keypad-area');
    this._renderKeypad();

    this._historyContainer = this.container.querySelector('.ck-history-list');
    this._graphContainer = this.container.querySelector('.ck-graph-area');
    this._tableContainer = this.container.querySelector('.ck-table-area');
    this._algebraContainer = this.container.querySelector('.ck-algebra-area');

    this.graphMode.mount(this._graphContainer);
    this.tableMode.mount(this._tableContainer);
    this._bindSideTabs();
    this._bindHistoryClicks();
    this._bindAlgebraUI();

    var self = this;
    this.state.on('history:changed', function() { self._renderHistory(); });
  }

  _createMathField(container) {
    var mf = document.createElement('math-field');
    mf.className = 'ck-math-field';
    mf.setAttribute('virtual-keyboard-mode', 'off');
    mf.setAttribute('smart-fence', 'true');
    mf.setAttribute('smart-mode', 'true');
    mf.setAttribute('remove-extraneous-parentheses', 'true');
    container.appendChild(mf);
    this._mathField = mf;

    var self = this;
    mf.addEventListener('input', function() { self._onFieldInput(); });
    mf.addEventListener('focus', function() { self.indicators.update(); });
  }

  _createResultArea(container) {
    this._resultEl = document.createElement('div');
    this._resultEl.className = 'ck-result';
    this._resultEl.innerHTML = '<span class="ck-result-placeholder">Press EXE or = to evaluate</span>';
    container.appendChild(this._resultEl);
  }

  _onFieldInput() {
    var self = this;
    clearTimeout(this._evalTimer);
    this._evalTimer = setTimeout(function() {
      var latex = self._mathField.value.trim();
      if (latex) self._previewEvaluate(latex);
      else self._clearResult();
    }, 600);
  }

  _previewEvaluate(latex) {
    if (typeof math === 'undefined') return;
    var scope = this.modes.getEvalScope();
    scope.ans = this.state.ans;
    var result = this.parser.evaluate(latex, this.state.angleMode, scope);
    if (!result.error) {
      this._resultEl.innerHTML = '<span class="ck-result-preview">= ' + this._formatResult(result.value) + '</span>';
    }
  }

  _autoReleaseShift() {
    if (this.state.shiftOn) this.modes.toggleShift();
  }

  _autoReleaseAlpha() {
    if (this.state.alphaOn) this.modes.toggleAlpha();
  }

  handleButton(key) {
    var s = this.state;
    var mf = this._mathField;
    if (!mf) return;

    switch (key) {
      case 'shift': this.modes.toggleShift(); return;
      case 'alpha': this.modes.toggleAlpha(); return;
      case 'mode': {
        this.modes.cycleMode();
        return;
      }
      case 'ac':
        mf.value = '';
        this._clearResult();
        s.error = null;
        s.showResult = false;
        this.indicators.update();
        mf.focus();
        return;
      case 'del':
        this._autoReleaseShift();
        mf.executeCommand('deleteBackward');
        mf.focus();
        return;
      case 'sd':
        this._autoReleaseShift();
        s.toggle('symbolicMode');
        this._updateResultDisplay();
        return;
      case 'ans':
        this._autoReleaseShift();
        if (s.ans !== null && s.ans !== undefined && s.ans !== 0 && s.showResult) {
          mf.insert(String(s.ans));
          mf.focus();
        }
        return;
      case 'equals': {
        var latex = mf.value.trim();
        if (latex) {
          this._autoReleaseShift();
          this._evaluate(latex);
        }
        return;
      }
      case 'graph': {
        this._autoReleaseShift();
        this._openGraphTab();
        var glatex = mf.value.trim();
        if (glatex && glatex.includes('x')) {
          this.graphMode.addFunction(glatex);
        }
        this.graphMode.render();
        return;
      }
      case 'const': {
        this._autoReleaseShift();
        this._cycleConst();
        return;
      }
      default: {
        var btn = this._findButton(key);
        if (btn) {
          var cmd = s.shiftOn && btn.ll ? btn.ll : btn.latex;
          if (cmd && cmd !== '') {
            if (key === 'lparen') cmd = '(#?)';
            else if (key === 'rparen') cmd = ')';
            mf.insert(cmd);
            mf.focus();
          }
        }
        this._autoReleaseShift();
        return;
      }
    }
  }

  _findButton(key) {
    var layout = this.keypad.getLayout(this.state.mode);
    for (var i = 0; i < layout.length; i++) {
      for (var j = 0; j < layout[i].length; j++) {
        if (layout[i][j].id === key) return layout[i][j];
      }
    }
    return null;
  }

  _cycleConst() {
    var c = this.state.constants;
    var keys = Object.keys(c);
    var idx = this._constIdx !== undefined ? (this._constIdx + 1) % keys.length : 0;
    this._constIdx = idx;
    var name = keys[idx];
    if (this._mathField) {
      this._mathField.insert(name);
      this._mathField.focus();
    }
    this._resultEl.innerHTML = '<span class="ck-result-const">' + name + ' = ' + c[name] + '</span>';
  }

  _evaluate(latex) {
    var self = this;
    if (typeof math === 'undefined') {
      this._renderError('Loading math engine...');
      var attempts = 0;
      var check = setInterval(function() {
        attempts++;
        if (typeof math !== 'undefined') {
          clearInterval(check);
          self._evaluate(latex);
        } else if (attempts > 50) {
          clearInterval(check);
          self._renderError('Failed to load math.js');
        }
      }, 200);
      return;
    }
    var s = this.state;
    var scope = this.modes.getEvalScope();
    scope.ans = s.ans;
    var result = this.parser.evaluate(latex, s.angleMode, scope);

    if (result.error) {
      s.error = result.error;
      this._renderError(result.error);
      this.indicators.update();
      return;
    }

    s.error = null;
    var val = result.value;
    var numVal = typeof val === 'number' ? val : parseFloat(String(val));
    if (isFinite(numVal)) s.ans = numVal;
    s.result = val;
    s.showResult = true;

    this._renderResult(val, latex);
    this.historyEngine.add({
      latex: latex,
      result: this._formatResult(val),
      resultLatex: this._toLatex(val),
      mode: s.mode,
      angleMode: s.angleMode
    });

    this.indicators.update();

    if (s.mode === 'GRAPH' && latex.includes('x')) {
      this._openGraphTab();
      this.graphMode.addFunction(latex);
      this.graphMode.render();
    }
    if (s.mode === 'TABLE' && latex.includes('x')) {
      this._openTableTab();
      this.tableMode.generateTable(latex);
    }
  }

  _renderResult(val, latex) {
    var html = '<div class="ck-result-value">';
    var formatted = this._formatResult(val);

    if (this.state.symbolicMode && typeof katex !== 'undefined') {
      try {
        var tmp = document.createElement('div');
        var resultLatex = this._toLatex(val);
        if (resultLatex) {
          katex.render('=' + resultLatex, tmp, { displayMode: false, throwOnError: false });
          html += tmp.innerHTML;
        } else {
          html += '= ' + formatted;
        }
      } catch (e) {
        html += '= ' + formatted;
      }
    } else {
      html += '= ' + formatted;
    }
    html += '</div>';
    this._resultEl.innerHTML = html;
  }

  _renderError(msg) {
    this._resultEl.innerHTML = '<span class="ck-result-error">Error: ' + escapeHtml(msg) + '</span>';
  }

  _formatResult(val) {
    if (val === null || val === undefined) return '0';
    if (typeof val === 'number') {
      if (!isFinite(val)) return (val === Infinity ? '∞' : val === -Infinity ? '-∞' : 'Error');
      if (Number.isInteger(val)) return String(val);
      var s = parseFloat(val.toFixed(10)).toString();
      if (s.includes('e')) return s;
      return s;
    }
    if (typeof val === 'object' && val.entries) {
      return val.toString();
    }
    return String(val);
  }

  _toLatex(val) {
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return String(val);
      if (this.state.symbolicMode && Math.abs(val) < 1e10) {
        var s = parseFloat(val.toFixed(10)).toString();
        if (s.includes('e')) return s.replace(/e\+?(\d+)/g, '\\times 10^{$1}');
        return s;
      }
      var s = val.toExponential(4);
      return s.replace(/e\+?(\d+)/g, '\\times 10^{$1}');
    }
    return '';
  }

  _clearResult() {
    this.state.showResult = false;
    this.state.error = null;
    this._resultEl.innerHTML = '<span class="ck-result-placeholder">Press EXE or = to evaluate</span>';
    this.indicators.update();
  }

  _updateResultDisplay() {
    if (this.state.showResult && this.state.result !== null) {
      this._renderResult(this.state.result, '');
    }
  }

  _rebuildKeypad() {
    this._renderKeypad();
  }

  _renderKeypad() {
    var rows = this.keypad.getLayout(this.state.mode);
    var self = this;

    this._keypadContainer.innerHTML = '<div class="ck-keypad">' +
      rows.map(function(row) {
        return '<div class="ck-keypad-row">' +
          row.map(function(btn) {
            var label = self.state.shiftOn && btn.ls ? btn.ls : btn.label;
            var extra = btn.s > 1 ? ' style="flex:' + btn.s + '"' : '';
            return '<button class="ck-btn ' + btn.cls + '" data-key="' + btn.id + '"' + extra + '>' + label + '</button>';
          }).join('') +
          '</div>';
      }).join('') +
      '</div>';

    this._keypadContainer.addEventListener('click', function(e) {
      var btnEl = e.target.closest('.ck-btn');
      if (btnEl) {
        self.handleButton(btnEl.dataset.key);
        btnEl.style.transform = 'scale(0.93)';
        setTimeout(function() { btnEl.style.transform = ''; }, 100);
      }
    });
  }

  _renderHistory() {
    var list = this._historyContainer;
    if (!list) return;
    var h = this.state.history;
    if (h.length === 0) {
      list.innerHTML = '<div class="ck-empty-state">No calculations yet</div>';
      return;
    }
    var self = this;
    list.innerHTML = h.map(function(item, i) {
      return '<div class="ck-history-item" data-idx="' + i + '">' +
        '<div class="ck-history-expr">' + escapeHtml(item.latex) + '</div>' +
        '<div class="ck-history-result">' + escapeHtml(item.result) + '</div>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.ck-history-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        var item = self.historyEngine.recall(idx);
        if (item && self._mathField) {
          self._mathField.value = item.latex;
          self._mathField.focus();
          if (item.result) {
            self._resultEl.innerHTML = '<div class="ck-result-value">= ' + escapeHtml(item.result) + '</div>';
          }
        }
      });
    });
  }

  _bindHistoryClicks() {
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-clear-history]')) {
        this.historyEngine.clear();
      }
    }.bind(this));
  }

  _bindSideTabs() {
    var tabs = this.container.querySelector('.ck-side-tabs');
    if (!tabs) return;
    var self = this;
    tabs.addEventListener('click', function(e) {
      var tab = e.target.closest('.ck-side-tab');
      if (!tab) return;
      var panel = tab.dataset.tab;
      tabs.querySelectorAll('.ck-side-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      self.container.querySelectorAll('.ck-side-panel').forEach(function(p) { p.classList.remove('active'); });
      var target = self.container.querySelector('#ck-panel-' + panel);
      if (target) target.classList.add('active');

      // Auto-update graph when graph tab opens
      if (panel === 'graph') {
        self.graphMode.render();
      }
      // Auto-update table when table tab opens
      if (panel === 'table') {
        var mf = self._mathField;
        if (mf) {
          var latex = mf.value.trim();
          if (latex && latex.includes('x')) {
            self.tableMode.generateTable(latex);
          }
        }
      }
    });
  }

  _bindAlgebraUI() {
    if (!this._algebraContainer) return;
    var self = this;
    this._algebraContainer.innerHTML = [
      '<div class="ck-algebra-tools">',
      '<div class="ck-algebra-row">',
      '<input class="ck-algebra-input" placeholder="Enter expression, e.g. x^2 + 2x + 1" spellcheck="false">',
      '<div class="ck-algebra-btns">',
      '<button class="ck-alg-btn" data-op="simplify">Simplify</button>',
      '<button class="ck-alg-btn" data-op="expand">Expand</button>',
      '<button class="ck-alg-btn" data-op="factor">Factor</button>',
      '<button class="ck-alg-btn" data-op="diff">diff/dx</button>',
      '<button class="ck-alg-btn" data-op="integrate">∫ dx</button>',
      '<button class="ck-alg-btn" data-op="solve">Solve=0</button>',
      '</div>',
      '</div>',
      '<div class="ck-algebra-result"></div>',
      '</div>'
    ].join('');

    this._algebraContainer.addEventListener('click', function(e) {
      var btn = e.target.closest('.ck-alg-btn');
      if (!btn) return;
      var input = self._algebraContainer.querySelector('.ck-algebra-input');
      var expr = input?.value.trim();
      if (!expr) return;
      var op = btn.dataset.op;
      var result;
      switch (op) {
        case 'simplify': result = self.algebra.simplify(expr); break;
        case 'expand': result = self.algebra.expand(expr); break;
        case 'factor': result = self.algebra.factor(expr); break;
        case 'diff': result = self.algebra.differentiate(expr); break;
        case 'integrate': result = self.algebra.integrate(expr); break;
        case 'solve': result = self.algebra.solve(expr); break;
      }
      self._showAlgebraResult(result);
    });
  }

  _showAlgebraResult(result) {
    var el = this._algebraContainer?.querySelector('.ck-algebra-result');
    if (!el) return;
    if (result.error) { el.innerHTML = '<div class="ck-alg-error">' + escapeHtml(result.error) + '</div>'; return; }
    var html = '';
    if (result.solutions) {
      html = '<div class="ck-alg-answer">Solutions: ' + result.solutions.join(', ') + '</div>';
    } else if (result.latex && typeof katex !== 'undefined') {
      var tmp = document.createElement('div');
      try { katex.render(result.latex, tmp, { displayMode: true, throwOnError: false }); html = tmp.innerHTML; }
      catch(e) { html = '<div class="ck-alg-answer">' + escapeHtml(result.text) + '</div>'; }
    } else {
      html = '<div class="ck-alg-answer">' + escapeHtml(result.text || result) + '</div>';
    }
    el.innerHTML = html;
  }

  _openGraphTab() {
    var tab = this.container?.querySelector('.ck-side-tab[data-tab="graph"]');
    if (tab) tab.click();
  }

  _openTableTab() {
    var tab = this.container?.querySelector('.ck-side-tab[data-tab="table"]');
    if (tab) tab.click();
  }

  _loadLibraries() {
    if (typeof math === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjs@12.4.1/lib/browser/math.js';
      document.body.appendChild(script);
    }
    if (typeof katex === 'undefined') {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      document.body.appendChild(script);
    }
    if (typeof functionPlot === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/function-plot@1.23.0/dist/function-plot.min.js';
      document.body.appendChild(script);
    }
    if (typeof nerdamer === 'undefined') {
      var s1 = document.createElement('script');
      s1.src = 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.min.js';
      document.body.appendChild(s1);
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Algebra.min.js';
      document.body.appendChild(s2);
    }
  }

  dispose() {
    this.keyboard.unbind();
    this.graphMode.clear();
    clearTimeout(this._evalTimer);
    clearTimeout(this._debounceTimer);
    this.state.emit('dispose');
    this.container.innerHTML = '';
    this.container.className = '';
  }
}

window.AhmedCalculator = AhmedCalculator;
