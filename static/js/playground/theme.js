class PlaygroundTheme {
  constructor(state) {
    this.state = state;
    this._theme = state.get('theme') || 'dark';
    this._font = state.get('editorFont') || 'Fira Code';
    this._fontSize = state.get('editorFontSize') || 14;
    this._ligatures = state.get('editorLigatures') !== false;
  }

  init() {
    this.apply(this._theme);
    this.state.on('theme', (theme) => this.apply(theme));
  }

  apply(theme) {
    this._theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');

    // Apply to Monaco if loaded
    if (window.monaco && window.monaco.editor) {
      const map = { dark: 'vs-dark', light: 'vs', 'hc-black': 'hc-black' };
      const editors = window.monaco.editor.getEditors();
      editors.forEach(ed => ed.updateOptions({ theme: map[theme] || 'vs-dark' }));
    }

    // Update status bar theme indicator
    const statusTheme = document.getElementById('pg-status-theme');
    if (statusTheme) {
      statusTheme.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'moon' : 'sun'} text-[8px] mr-0.5"></i> ${theme === 'dark' ? 'Dark' : 'Light'}`;
    }

    // CSS variable overrides
    document.documentElement.style.setProperty('--pg-bg', theme === 'dark' ? '#1e1e1e' : '#ffffff');
    document.documentElement.style.setProperty('--pg-sidebar', theme === 'dark' ? '#252526' : '#f3f3f3');
    document.documentElement.style.setProperty('--pg-text', theme === 'dark' ? '#cccccc' : '#333333');
  }

  setFont(font) {
    this._font = font;
    this.state.set('editorFont', font);
    this._applyEditorOptions({ fontFamily: `'${font}', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace` });
  }

  setFontSize(size) {
    this._fontSize = Math.max(10, Math.min(32, size));
    this.state.set('editorFontSize', this._fontSize);
    this._applyEditorOptions({ fontSize: this._fontSize });
  }

  toggleLigatures() {
    this._ligatures = !this._ligatures;
    this.state.set('editorLigatures', this._ligatures);
    this._applyEditorOptions({ fontLigatures: this._ligatures });
  }

  _applyEditorOptions(opts) {
    if (window.monaco) {
      window.monaco.editor.getEditors().forEach(ed => ed.updateOptions(opts));
    }
  }

  getFonts() {
    return ['Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Source Code Pro', 'Consolas', 'Monaco', 'monospace'];
  }

  get current() { return this._theme; }
  get font() { return this._font; }
  get fontSize() { return this._fontSize; }
  get ligatures() { return this._ligatures; }
}

window.PlaygroundTheme = PlaygroundTheme;
