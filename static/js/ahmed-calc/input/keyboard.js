class CalcKeyboard {
  constructor(calculator) {
    this.calc = calculator;
    this._handler = null;
    this._map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '.':'decimal', ',':'decimal',
      '+':'add', '-':'subtract', '*':'multiply', '/':'divide',
      'Enter':'equals', '=':'equals',
      'Backspace':'del', 'Delete':'del',
      'Escape':'ac',
      '(':'lparen', ')':'rparen',
      '%':'percent',
      'p':'const'
    };
  }

  bind() {
    var self = this;
    this._handler = function(e) {
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'MATH-FIELD') return;
      var key = e.key;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var mapped = self._map[key];
      if (mapped) {
        self.calc.handleButton(mapped);
        e.preventDefault();
      } else if (key === '^') {
        self.calc.handleButton('power');
        e.preventDefault();
      } else if (key === 's') {
        self.calc.handleButton('sin');
        e.preventDefault();
      } else if (key === 'c' && !e.ctrlKey) {
        self.calc.handleButton('cos');
        e.preventDefault();
      } else if (key === 't') {
        self.calc.handleButton('tan');
        e.preventDefault();
      } else if (key === 'l') {
        self.calc.handleButton('log');
        e.preventDefault();
      } else if (key === 'r') {
        self.calc.handleButton('sqrt');
        e.preventDefault();
      } else if (key === 'q') {
        self.calc.handleButton('square');
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', this._handler);
  }

  unbind() {
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
      this._handler = null;
    }
  }
}
window.CalcKeyboard = CalcKeyboard;
