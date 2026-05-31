class CalcAlgebraMode {
  constructor(calculator) {
    this.calc = calculator;
    this.state = calculator.state;
    this.parser = calculator.parser;
  }

  _hasNerdamer() {
    return typeof nerdamer !== 'undefined';
  }

  simplify(latex) {
    if (!this._hasNerdamer()) return this._basic(latex);
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer(expr).simplify();
      return { latex: result.toTeX(), text: result.toString(), error: null };
    } catch (e) {
      return { latex: '', text: '', error: e.message };
    }
  }

  expand(latex) {
    if (!this._hasNerdamer()) return this._basic(latex);
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer(expr).expand();
      return { latex: result.toTeX(), text: result.toString(), error: null };
    } catch (e) {
      return { latex: '', text: '', error: e.message };
    }
  }

  factor(latex) {
    if (!this._hasNerdamer()) return { text: latex, error: 'nerdamer not loaded' };
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer(expr).factor();
      return { latex: result.toTeX(), text: result.toString(), error: null };
    } catch (e) {
      return { latex: '', text: '', error: e.message };
    }
  }

  differentiate(latex, variable) {
    if (!this._hasNerdamer()) return { text: latex, error: 'nerdamer not loaded' };
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer(expr).differentiate(variable || 'x');
      return { latex: result.toTeX(), text: result.toString(), error: null };
    } catch (e) {
      return { latex: '', text: '', error: e.message };
    }
  }

  integrate(latex, variable) {
    if (!this._hasNerdamer()) return { text: latex, error: 'nerdamer not loaded' };
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer(expr).integrate(variable || 'x');
      return { latex: result.toTeX(), text: result.toString(), error: null };
    } catch (e) {
      return { text: '', error: e.message };
    }
  }

  solve(latex) {
    if (!this._hasNerdamer()) return { solutions: [], error: 'nerdamer not loaded' };
    try {
      var expr = this._latexToNerd(latex);
      var result = nerdamer.solve(expr, 'x');
      var solutions = result.toString().split(',').map(function(s) { return s.trim(); });
      return { solutions: solutions, error: null };
    } catch (e) {
      return { solutions: [], error: e.message };
    }
  }

  _latexToNerd(latex) {
    if (!latex) return '';
    var s = latex.trim();
    s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
    s = s.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');
    s = s.replace(/\\sin/g, 'sin');
    s = s.replace(/\\cos/g, 'cos');
    s = s.replace(/\\tan/g, 'tan');
    s = s.replace(/\\log/g, 'log');
    s = s.replace(/\\ln/g, 'ln');
    s = s.replace(/\\pi/g, 'pi');
    s = s.replace(/\\times/g, '*');
    s = s.replace(/\\cdot/g, '*');
    s = s.replace(/\\div/g, '/');
    s = s.replace(/\\left/g, '');
    s = s.replace(/\\right/g, '');
    s = s.replace(/\^\{([^}]*)\}/g, '^($1)');
    s = s.replace(/\\/g, '');
    return s;
  }

  _basic(latex) {
    try {
      var js = this.parser.toMathJS(latex, 'RAD');
      var result = Function('"use strict"; return (' + js + ')')();
      return { text: String(result), latex: String(result), error: null };
    } catch (e) {
      return { text: latex, error: e.message };
    }
  }
}
window.CalcAlgebraMode = CalcAlgebraMode;
