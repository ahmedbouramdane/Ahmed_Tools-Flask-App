class LatexParser {
  constructor() {
    this.trigFns = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot'];
    this.trigInv = ['arcsin', 'arccos', 'arctan'];
  }

  toMathJS(latex, angleMode) {
    if (!latex || !latex.trim()) return '';
    var s = latex.trim();
    s = s.replace(/^\$\$?/, '').replace(/\$\$?$/, '');
    s = this._convert(s, angleMode || 'RAD');
    return s;
  }

  _convert(s, angleMode) {
    s = this._handleFrac(s, angleMode);
    s = this._handleSqrt(s, angleMode);
    s = this._handleInverseTrig(s);
    s = this._handleTrig(s, angleMode);
    s = this._handleLog(s);
    s = this._handlePowers(s, angleMode);
    s = this._handleSubscripts(s);
    s = this._handleBraces(s, angleMode);
    s = this._handleOperators(s);
    s = this._handleConstants(s);
    s = this._cleanup(s);
    return s;
  }

  _handleFrac(s, angleMode) {
    var result = s, prev;
    do {
      prev = result;
      result = result.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, function(m, num, den) {
        var self = this;
        return '(' + self._convert(num, angleMode) + ')/(' + self._convert(den, angleMode) + ')';
      }.bind(this));
    } while (result !== prev);
    return result;
  }

  _handleSqrt(s, angleMode) {
    var self = this;
    return s.replace(/\\sqrt(?:\[([^\]]*)\])?\{([^}]*)\}/g, function(m, n, x) {
      var inner = self._convert(x, angleMode);
      if (n) return '(' + inner + ')^(1/' + n + ')';
      return 'sqrt(' + inner + ')';
    });
  }

  _handleInverseTrig(s) {
    s = s.replace(/\\sin\^\{-1\}\s*/g, 'arcsin');
    s = s.replace(/\\cos\^\{-1\}\s*/g, 'arccos');
    s = s.replace(/\\tan\^\{-1\}\s*/g, 'arctan');
    s = s.replace(/\\csc\^\{-1\}\s*/g, 'arccsc');
    s = s.replace(/\\sec\^\{-1\}\s*/g, 'arcsec');
    s = s.replace(/\\cot\^\{-1\}\s*/g, 'arccot');
    return s;
  }

  _handleTrig(s, angleMode) {
    var suff = angleMode === 'DEG' ? '_deg' : angleMode === 'GRAD' ? '_grad' : '_rad';
    var self = this;
    this.trigFns.forEach(function(fn) {
      var re = new RegExp('\\\\' + fn + '\\b', 'g');
      s = s.replace(re, fn + suff);
    });
    if (angleMode !== 'RAD') {
      this.trigInv.forEach(function(fn) {
        var re = new RegExp('\\\\' + fn + '\\b', 'g');
        s = s.replace(re, fn + suff);
      });
    }
    return s;
  }

  _handleLog(s) {
    s = s.replace(/\\log(?:_\{([^}]*)\})?/g, function(m, base) {
      return base ? 'log' + base : 'log10';
    });
    s = s.replace(/\\ln/g, 'log');
    s = s.replace(/\\lg/g, 'log10');
    return s;
  }

  _handlePowers(s, angleMode) {
    var self = this;
    s = s.replace(/\^\{([^}]*)\}/g, function(m, e) {
      return '^(' + self._convert(e, angleMode) + ')';
    });
    s = s.replace(/\^([a-zA-Z0-9πeτ])/g, '^$1');
    return s;
  }

  _handleSubscripts(s) {
    s = s.replace(/_\{(.+?)\}/g, '_($1)');
    s = s.replace(/_([a-zA-Z0-9])/g, '_$1');
    s = s.replace(/_(\([^)]*\))/g, '_$1');
    return s;
  }

  _handleBraces(s, angleMode) {
    var self = this;
    return s.replace(/\{([^}]*)\}/g, function(m, c) {
      return '(' + self._convert(c, angleMode) + ')';
    });
  }

  _handleOperators(s) {
    s = s.replace(/\\times/g, '*');
    s = s.replace(/\\cdot/g, '*');
    s = s.replace(/\\div/g, '/');
    s = s.replace(/\\pm/g, '+-');
    s = s.replace(/\\mp/g, '-+');
    s = s.replace(/\\left/g, '');
    s = s.replace(/\\right/g, '');
    return s;
  }

  _handleConstants(s) {
    s = s.replace(/\\pi/g, 'pi');
    s = s.replace(/\\tau/g, 'tau');
    s = s.replace(/\\infty/g, 'Infinity');
    s = s.replace(/\\mathrm\{d\}/g, '');
    return s;
  }

  _cleanup(s) {
    s = s.replace(/\\([,.!?:;])/g, '$1');
    s = s.replace(/\\[,;:\!\ ]/g, '');
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
  }

  evaluate(latex, angleMode, scope) {
    try {
      var js = this.toMathJS(latex, angleMode);
      if (!js || js.trim() === '') return { error: 'Empty expression' };
      if (typeof math === 'undefined') return { error: 'Math engine still loading, press = again' };
      var result = math.evaluate(js, scope || {});
      return { value: result, error: null };
    } catch (e) {
      return { error: e.message };
    }
  }

  validate(latex) {
    if (!latex || latex.trim() === '') return { valid: false, error: 'Empty' };
    try {
      var js = this.toMathJS(latex, 'RAD');
      if (!js || js.trim() === '') return { valid: false, error: 'Empty after conversion' };
      if (typeof math === 'undefined') return { valid: false, error: 'math.js not loaded' };
      math.parse(js);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}
window.LatexParser = LatexParser;
