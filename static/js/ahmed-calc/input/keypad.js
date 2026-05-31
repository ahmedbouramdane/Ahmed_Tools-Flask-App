class CalcKeypad {
  constructor() {
    this._shiftOn = false;
  }

  setShift(on) {
    this._shiftOn = on;
  }

  getLayout(mode) {
    if (mode === 'COMP' || mode === 'EQN') return this._compLayout();
    if (mode === 'GRAPH') return this._graphLayout();
    if (mode === 'TABLE') return this._tableLayout();
    return this._compLayout();
  }

  _compLayout() {
    return [
      R(                 { id:'shift', label:'SHIFT', ls:'SHIFT', cls:'ck-shift', s:1 },
                        { id:'alpha', label:'ALPHA', ls:'ALPHA', cls:'ck-alpha', s:1 },
                        { id:'mode', label:'MODE', ls:'MODE', cls:'ck-mode', s:1 },
                        { id:'ac', label:'AC', ls:'AC', cls:'ck-ac', s:1 },
                        { id:'del', label:'DEL', ls:'DEL', cls:'ck-del', s:1 } ),
      R( { id:'sd', label:'S⇔D', ls:'S⇔D', latex:'', cls:'ck-fn' },
                        { id:'eng', label:'ENG', ls:'ENG', latex:'×10^{#?}', cls:'ck-fn' },
                        { id:'lparen', label:'(', ls:'(', latex:'(#?)', cls:'ck-op' },
                        { id:'rparen', label:')', ls:')', latex:')', cls:'ck-op' },
                        { id:'percent', label:'%', ls:'%', latex:'\\%', cls:'ck-fn' } ),
      R( { id:'sin', label:'sin', ls:'sin⁻¹', latex:'\\sin(#?)', ll:'\\arcsin(#?)', cls:'ck-sci' },
                        { id:'cos', label:'cos', ls:'cos⁻¹', latex:'\\cos(#?)', ll:'\\arccos(#?)', cls:'ck-sci' },
                        { id:'tan', label:'tan', ls:'tan⁻¹', latex:'\\tan(#?)', ll:'\\arctan(#?)', cls:'ck-sci' },
                        { id:'log', label:'log', ls:'10ˣ', latex:'\\log(#?)', ll:'10^{#?}', cls:'ck-sci' },
                        { id:'ln', label:'ln', ls:'eˣ', latex:'\\ln(#?)', ll:'e^{#?}', cls:'ck-sci' } ),
      R( { id:'sqrt', label:'√', ls:'∛', latex:'\\sqrt{#?}', ll:'\\sqrt[3]{#?}', cls:'ck-sci' },
                        { id:'square', label:'x²', ls:'x⁻¹', latex:'^{#?}', ll:'^{-#?}', cls:'ck-sci' },
                        { id:'power', label:'xʸ', ls:'ˣ√', latex:'^{#?}', ll:'\\sqrt[#?]{#?}', cls:'ck-sci' },
                        { id:'exp', label:'EXP', ls:'×10ˣ', latex:'×10^{#?}', ll:'×10^{#?}', cls:'ck-sci' },
                        { id:'frac', label:'a/b', ls:'a/b', latex:'\\frac{#?}{#?}', ll:'\\frac{#?}{#?}', cls:'ck-sci' } ),
      R( { id:'7', label:'7', latex:'7', cls:'ck-num' },
                        { id:'8', label:'8', latex:'8', cls:'ck-num' },
                        { id:'9', label:'9', latex:'9', cls:'ck-num' },
                        { id:'multiply', label:'×', ls:'×', latex:'\\times', cls:'ck-op' },
                        { id:'divide', label:'÷', ls:'÷', latex:'\\div', cls:'ck-op' } ),
      R( { id:'4', label:'4', latex:'4', cls:'ck-num' },
                        { id:'5', label:'5', latex:'5', cls:'ck-num' },
                        { id:'6', label:'6', latex:'6', cls:'ck-num' },
                        { id:'add', label:'+', latex:'+', cls:'ck-op' },
                        { id:'subtract', label:'−', latex:'-', cls:'ck-op' } ),
      R( { id:'1', label:'1', latex:'1', cls:'ck-num' },
                        { id:'2', label:'2', latex:'2', cls:'ck-num' },
                        { id:'3', label:'3', latex:'3', cls:'ck-num' },
                        { id:'ans', label:'ANS', latex:'ans', cls:'ck-mem' },
                        { id:'equals', label:'=', latex:'=', cls:'ck-eq', s:2 } ),
      R( { id:'negate', label:'(−)', latex:'(-#?)', cls:'ck-op' },
                        { id:'0', label:'0', latex:'0', cls:'ck-num' },
                        { id:'decimal', label:'.', latex:'.', cls:'ck-num' },
                        { id:'const', label:'CONST', latex:'\\pi', cls:'ck-fn' },
                        { id:'graph', label:'GRAPH', latex:'', cls:'ck-fn' },
                        { id:'comma', label:',', latex:',', cls:'ck-op' } ),
    ];
  }

  _graphLayout() {
    return [
      R( { id:'shift', label:'SHIFT', ls:'SHIFT', cls:'ck-shift', s:1 },
                        { id:'alpha', label:'ALPHA', ls:'ALPHA', cls:'ck-alpha', s:1 },
                        { id:'mode', label:'MODE', ls:'MODE', cls:'ck-mode', s:1 },
                        { id:'ac', label:'AC', ls:'AC', cls:'ck-ac', s:1 },
                        { id:'del', label:'DEL', ls:'DEL', cls:'ck-del', s:1 } ),
      R( { id:'sd', label:'S⇔D', ls:'S⇔D', latex:'', cls:'ck-fn' },
                        { id:'x', label:'X', ls:'X', latex:'x', cls:'ck-var' },
                        { id:'lparen', label:'(', ls:'(', latex:'(#?)', cls:'ck-op' },
                        { id:'rparen', label:')', ls:')', latex:')', cls:'ck-op' },
                        { id:'sqrt', label:'√', ls:'∛', latex:'\\sqrt{#?}', cls:'ck-sci' } ),
      R( { id:'7', label:'7', latex:'7', cls:'ck-num' },
                        { id:'8', label:'8', latex:'8', cls:'ck-num' },
                        { id:'9', label:'9', latex:'9', cls:'ck-num' },
                        { id:'power', label:'xʸ', ls:'xʸ', latex:'^{#?}', cls:'ck-sci' },
                        { id:'exp', label:'EXP', ls:'×10ˣ', latex:'×10^{#?}', cls:'ck-sci' } ),
      R( { id:'4', label:'4', latex:'4', cls:'ck-num' },
                        { id:'5', label:'5', latex:'5', cls:'ck-num' },
                        { id:'6', label:'6', latex:'6', cls:'ck-num' },
                        { id:'multiply', label:'×', ls:'×', latex:'\\times', cls:'ck-op' },
                        { id:'divide', label:'÷', ls:'÷', latex:'\\div', cls:'ck-op' } ),
      R( { id:'1', label:'1', latex:'1', cls:'ck-num' },
                        { id:'2', label:'2', latex:'2', cls:'ck-num' },
                        { id:'3', label:'3', latex:'3', cls:'ck-num' },
                        { id:'add', label:'+', latex:'+', cls:'ck-op' },
                        { id:'subtract', label:'−', latex:'-', cls:'ck-op' } ),
      R( { id:'negate', label:'(−)', latex:'(-#?)', cls:'ck-op' },
                        { id:'0', label:'0', latex:'0', cls:'ck-num' },
                        { id:'decimal', label:'.', latex:'.', cls:'ck-num' },
                        { id:'const', label:'CONST', latex:'\\pi', cls:'ck-fn' },
                        { id:'graph', label:'PLOT', latex:'', cls:'ck-fn' } ),
    ];
  }

  _tableLayout() {
    return this._graphLayout();
  }
}

function R() {
  var arr = [];
  for (var i = 0; i < arguments.length; i++) {
    var b = arguments[i];
    if (!b.s) b.s = 1;
    arr.push(b);
  }
  return arr;
}

window.CalcKeypad = CalcKeypad;
