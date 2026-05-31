class CalcGraphMode {
  constructor(calculator) {
    this.calc = calculator;
    this.state = calculator.state;
    this.parser = calculator.parser;
    this.container = null;
    this._plot = null;
    this._timeout = null;
    this.functions = [];
    this.colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  }

  mount(container) {
    this.container = container;
    this._renderUI();
  }

  _renderUI() {
    if (!this.container) return;
    this.container.innerHTML = [
      '<div class="ck-graph-ui">',
      '<div class="ck-graph-input-row">',
      '<span class="ck-graph-prefix">f(x)=</span>',
      '<input class="ck-graph-input" placeholder="e.g. x^2, sin(x)" spellcheck="false">',
      '<button class="ck-graph-add-btn">+</button>',
      '</div>',
      '<div class="ck-graph-function-list"></div>',
      '<div class="ck-graph-canvas"></div>',
      '</div>'
    ].join('');

    var self = this;
    var input = this.container.querySelector('.ck-graph-input');
    var addBtn = this.container.querySelector('.ck-graph-add-btn');

    function addFromInput() {
      var expr = input.value.trim();
      if (expr) {
        self.addFunction(expr);
        input.value = '';
        self.render();
      }
    }

    addBtn.addEventListener('click', addFromInput);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addFromInput();
    });
  }

  addFunction(expr) {
    for (var i = 0; i < this.functions.length; i++) {
      if (this.functions[i].expr === expr) return;
    }
    this.functions.push({
      expr: expr,
      visible: true,
      color: this.colors[this.functions.length % this.colors.length]
    });
    this._renderFunctionList();
  }

  removeFunction(idx) {
    this.functions.splice(idx, 1);
    this._renderFunctionList();
    this.render();
  }

  toggleFunction(idx) {
    if (this.functions[idx]) {
      this.functions[idx].visible = !this.functions[idx].visible;
      this._renderFunctionList();
      this.render();
    }
  }

  _renderFunctionList() {
    var list = this.container?.querySelector('.ck-graph-function-list');
    if (!list) return;
    var self = this;
    if (this.functions.length === 0) {
      list.innerHTML = '<div class="ck-graph-hint">Type a function above and click +</div>';
      return;
    }
    list.innerHTML = this.functions.map(function(f, i) {
      return '<div class="ck-graph-fn-item" data-idx="' + i + '">' +
        '<span class="ck-graph-fn-color" style="background:' + f.color + '; opacity:' + (f.visible ? 1 : 0.3) + '"></span>' +
        '<span class="ck-graph-fn-label" style="text-decoration:' + (f.visible ? 'none' : 'line-through') + '">' + escapeHtml(f.expr) + '</span>' +
        '<button class="ck-graph-fn-del" title="Remove">✕</button>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.ck-graph-fn-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.ck-graph-fn-del')) return;
        var idx = parseInt(this.dataset.idx);
        self.toggleFunction(idx);
      });
    });
    list.querySelectorAll('.ck-graph-fn-del').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var parent = this.closest('.ck-graph-fn-item');
        if (parent) {
          var idx = parseInt(parent.dataset.idx);
          self.removeFunction(idx);
        }
      });
    });
  }

  render() {
    if (typeof functionPlot === 'undefined') {
      var canvas = this.container?.querySelector('.ck-graph-canvas');
      if (canvas) canvas.innerHTML = '<div class="ck-graph-placeholder">Loading graph library...</div>';
      return;
    }
    clearTimeout(this._timeout);
    var self = this;
    this._timeout = setTimeout(function() { self._doPlot(); }, 200);
  }

  _doPlot() {
    var canvas = this.container?.querySelector('.ck-graph-canvas');
    if (!canvas) return;

    var visible = this.functions.filter(function(f) { return f.visible; });
    if (visible.length === 0) {
      canvas.innerHTML = '<div class="ck-graph-empty">Graph will appear here</div>';
      return;
    }

    canvas.innerHTML = '';
    var width = canvas.clientWidth || 380;
    var height = 280;

    var self = this;
    var data = visible.map(function(f) {
      var js = self.parser.toMathJS(f.expr, self.state.angleMode);
      return {
        fn: js || 'x',
        color: f.color,
        graphType: 'polyline'
      };
    }).filter(function(d) { return d.fn; });

    if (data.length === 0) return;

    try {
      this._plot = functionPlot({
        target: canvas,
        width: width,
        height: height,
        grid: true,
        disableZoom: false,
        xAxis: { domain: [-10, 10] },
        yAxis: { domain: [-10, 10] },
        data: data
      });
    } catch (e) {
      canvas.innerHTML = '<div class="ck-graph-error">Graph error: ' + escapeHtml(e.message) + '</div>';
    }
  }

  clear() {
    this.functions = [];
    this._plot = null;
    if (this.container) this._renderUI();
  }

  resize() {
    if (this._plot) this._doPlot();
  }
}
window.CalcGraphMode = CalcGraphMode;