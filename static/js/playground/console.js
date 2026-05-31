class PlaygroundConsole {
  constructor(state) {
    this.state = state;
    this._container = null;
    this._logEl = null;
  }

  mount(container) {
    this._container = container;
    const logs = this.state.get('consoleLogs');

    container.innerHTML = `
      <div class="flex flex-col h-full bg-[#1e1e1e]">
        <div class="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-medium text-gray-400"><i class="fas fa-terminal mr-1"></i> Console</span>
            <span class="pg-console-count text-[9px] text-gray-500">${logs.length > 0 ? logs.length + ' logs' : ''}</span>
          </div>
          <div class="flex items-center gap-1">
            <button class="pg-console-clear px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-white rounded hover:bg-gray-700/50 transition" title="Clear"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed" id="pg-console-output">
          ${logs.length === 0 ? '<div class="text-gray-500 text-center py-6 text-[10px]">Console output will appear here</div>' : ''}
          ${logs.map(l => this._renderLog(l)).join('')}
        </div>
      </div>
    `;

    this._logEl = container.querySelector('#pg-console-output');

    this.state.on('console:log', ({ level, args }) => {
      this._appendLog(this.state.get('consoleLogs').slice(-1)[0]);
    });

    this.state.on('console:clear', () => {
      if (this._logEl) {
        this._logEl.innerHTML = '<div class="text-gray-500 text-center py-6 text-[10px]">Console cleared</div>';
      }
      this._updateCount();
    });

    this._container.addEventListener('click', (e) => {
      if (e.target.closest('.pg-console-clear')) {
        this.state.clearConsole();
      }
    });
  }

  _renderLog(log) {
    const colors = { log: 'text-gray-300', error: 'text-red-400', warn: 'text-yellow-400', info: 'text-blue-400' };
    const icons = { log: '●', error: '✖', warn: '⚠', info: 'ℹ' };
    const time = new Date(log.timestamp).toLocaleTimeString();
    return `<div class="pg-console-line px-3 py-0.5 hover:bg-[#2a2a2a] flex items-start gap-2 ${colors[log.level] || 'text-gray-300'}">
      <span class="text-[9px] opacity-50 shrink-0 mt-0.5">${time}</span>
      <span class="shrink-0">${icons[log.level] || '●'}</span>
      <span class="break-all">${log.args.join(' ')}</span>
    </div>`;
  }

  _appendLog(log) {
    if (!this._logEl) return;
    if (this._logEl.children.length === 1 && this._logEl.children[0].classList.contains('text-center')) {
      this._logEl.innerHTML = '';
    }
    const div = document.createElement('div');
    div.innerHTML = this._renderLog(log);
    this._logEl.appendChild(div.firstElementChild);
    this._logEl.scrollTop = this._logEl.scrollHeight;
    this._updateCount();
  }

  _updateCount() {
    const countEl = this._container?.querySelector('.pg-console-count');
    if (countEl) {
      const len = this.state.get('consoleLogs').length;
      countEl.textContent = len > 0 ? len + ' logs' : '';
    }
  }
}

window.PlaygroundConsole = PlaygroundConsole;
