class PlaygroundTerminal {
  constructor(state) {
    this.state = state;
    this._container = null;
    this._term = null;
    this._socket = null;
    this._ready = false;
    this._pendingOutput = '';
    this._fitAddon = null;
    this._resizeObserver = null;
    this._visibilityObserver = null;
  }

  mount(container) {
    this._container = container;
    this._initTerminal(container);
  }

  async _initTerminal(container) {
    container.innerHTML = `
      <div class="flex flex-col h-full bg-[#1e1e1e]">
        <div class="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-medium text-gray-400"><i class="fas fa-terminal mr-1"></i> Terminal</span>
          </div>
          <div class="flex items-center gap-2 text-[9px] text-gray-500">
            <button class="pg-term-clear hover:text-white transition"><i class="fas fa-trash"></i> Clear</button>
            <button class="pg-term-restart hover:text-white transition"><i class="fas fa-redo"></i> Restart</button>
            <span>${os_name()}</span>
          </div>
        </div>
        <div class="flex-1 min-h-0" id="pg-terminal-xterm"></div>
      </div>
    `;

    container.querySelector('.pg-term-clear')?.addEventListener('click', () => this.clear());
    container.querySelector('.pg-term-restart')?.addEventListener('click', () => this._restart());

    if (!window.Terminal) {
      try {
        await this._loadXterm();
      } catch {
        this._showError('Failed to load xterm.js. Check your internet connection.');
        return;
      }
    }
    if (!window.Terminal || !window.FitAddon) {
      this._showError('Terminal library not available.');
      return;
    }
    this._createTerminal();
    this._connectSocket();
  }

  _showError(msg) {
    const el = document.getElementById('pg-terminal-xterm');
    if (el) {
      el.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500 text-[11px] p-4 text-center">${PlaygroundUtils.escapeHtml(msg)}</div>`;
    }
  }

  _loadXterm() {
    return Promise.all([
      PlaygroundUtils.loadStyles('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css'),
      PlaygroundUtils.loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js'),
      PlaygroundUtils.loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js'),
    ]);
  }

  _createTerminal() {
    const el = document.getElementById('pg-terminal-xterm');
    if (!el) return;

    this._term = new Terminal({
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#252526', red: '#f44747', green: '#6a9955',
        yellow: '#d7ba7d', blue: '#569cd6', magenta: '#c586c0',
        cyan: '#4ec9b0', white: '#d4d4d4',
        brightBlack: '#666666', brightRed: '#d16969', brightGreen: '#6a9955',
        brightYellow: '#d7ba7d', brightBlue: '#569cd6', brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0', brightWhite: '#e0e0e0',
      },
      cursorBlink: true,
      cursorStyle: 'line',
      convertEol: true,
      scrollback: 5000,
    });

    this._fitAddon = new FitAddon.FitAddon();
    this._term.loadAddon(this._fitAddon);
    this._term.open(el);

    this._term.onData((data) => {
      if (this._socket?.connected) {
        this._socket.emit('terminal_input', { data });
      }
    });

    this._resizeObserver = new ResizeObserver(() => {
      if (this._fitAddon && this._container?.offsetParent !== null) {
        try { this._fitAddon.fit(); } catch(e) {}
      }
    });
    this._resizeObserver.observe(el);

    this._visibilityObserver = new MutationObserver(() => {
      if (this._container?.offsetParent !== null && this._fitAddon) {
        setTimeout(() => {
          try { this._fitAddon.fit(); } catch(e) {}
        }, 50);
      }
    });
    if (this._container) {
      this._visibilityObserver.observe(this._container, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        subtree: false,
      });
    }

    setTimeout(() => {
      if (this._fitAddon && this._container?.offsetParent !== null) {
        try { this._fitAddon.fit(); } catch(e) {}
      }
      this._ready = true;
      if (this._pendingOutput) {
        this._term.write(this._pendingOutput);
        this._pendingOutput = '';
      }
    }, 100);
  }

  async _connectSocket() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
    if (!window.io) {
      try {
        await PlaygroundUtils.loadScript('https://cdn.socket.io/4.7.2/socket.io.min.js');
      } catch {
        this._term?.writeln('\r\n\x1b[33mSocket.IO library failed to load. Terminal unavailable.\x1b[0m');
        return;
      }
    }
    this._socket = io('/terminal', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    this._socket.on('connect', () => {
      this._term?.writeln('\r\n\x1b[32mTerminal connected\x1b[0m');
    });
    this._socket.on('terminal:output', (data) => {
      if (this._ready && this._term) {
        this._term.write(data.data);
      } else {
        this._pendingOutput += data.data;
      }
    });
    this._socket.on('disconnect', () => {
      this._term?.writeln('\r\n\x1b[31mTerminal disconnected\x1b[0m');
    });
    this._socket.on('connect_error', () => {
      this._term?.writeln('\r\n\x1b[31mConnection error. Retrying...\x1b[0m');
    });
  }

  _restart() {
    if (this._socket) { this._socket.disconnect(); this._socket = null; }
    if (this._term) { this._term.dispose(); this._term = null; }
    this._ready = false;
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._visibilityObserver) this._visibilityObserver.disconnect();
    const el = document.getElementById('pg-terminal-xterm');
    if (el) el.innerHTML = '';
    this._initTerminal(this._container);
  }

  clear() {
    if (this._term) this._term.clear();
  }

  write(text, level) {
    const colors = { error: '\x1b[31m', warn: '\x1b[33m', success: '\x1b[32m', info: '' };
    const color = colors[level] || '';
    if (this._term) this._term.writeln(color + text + '\x1b[0m');
  }

  dispose() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._visibilityObserver) this._visibilityObserver.disconnect();
    if (this._socket) this._socket.disconnect();
    if (this._term) this._term.dispose();
    this._ready = false;
  }
}

function os_name() {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'cmd.exe';
  if (ua.includes('Mac')) return 'zsh';
  if (ua.includes('Linux')) return 'bash';
  return 'Shell';
}

window.PlaygroundTerminal = PlaygroundTerminal;