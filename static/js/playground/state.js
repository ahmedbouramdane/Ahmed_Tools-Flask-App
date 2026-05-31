class PlaygroundState {
  constructor() {
    this._listeners = {};
    this._state = this._defaults();
    this._initialized = false;
  }

  _defaults() {
    return {
      project: { name: 'Untitled', id: Date.now().toString(36) },
      files: {
        'index.html': { name: 'index.html', path: '/index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n  <p>Start editing to see live preview!</p>\n</body>\n</html>', language: 'html' },
        'style.css': { name: 'style.css', path: '/style.css', content: 'body {\n  font-family: system-ui, sans-serif;\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 2rem;\n  line-height: 1.6;\n}\nh1 {\n  color: #6366f1;\n}', language: 'css' },
        'script.js': { name: 'script.js', path: '/script.js', content: '// JavaScript goes here\nconsole.log("Hello from playground!");\n\ndocument.querySelector("h1").addEventListener("click", () => {\n  alert("You clicked the heading!");\n});', language: 'javascript' }
      },
      folderStructure: {
        '/': { name: '/', type: 'folder', children: ['index.html', 'style.css', 'script.js'] }
      },
      activeFile: 'index.html',
      openTabs: ['index.html'],
      dirtyFiles: new Set(),
      layout: {
        sidebarWidth: 220,
        bottomPanelHeight: 200,
        rightPanelWidth: 250,
        sidebarVisible: true,
        bottomPanelVisible: false,
        rightPanelVisible: false,
        activeBottomTab: 'console',
        zenMode: false
      },
      problems: [],
      editor: {
        splitEnabled: false,
        splitPosition: 50,
        splitActiveFile: null,
        showOutput: false,
        showBreadcrumb: true,
        wordWrap: true,
        tabSize: 2,
        insertSpaces: true
      },
      zenMode: false,
      searchResults: [],
      preview: {
        mode: 'desktop',
        autoRefresh: true,
        debounceMs: 500,
        url: ''
      },
      consoleLogs: [],
      terminalHistory: [],
      outputContent: '',
      theme: 'dark',
      editorFont: 'Fira Code',
      editorFontSize: 14,
      editorLigatures: true,
      minimap: true,
      cursorPosition: { line: 1, column: 1 },
      lastSaved: null
    };
  }

  get(key) {
    if (key.includes('.')) {
      return key.split('.').reduce((obj, k) => obj && obj[k], this._state);
    }
    return this._state[key];
  }

  set(key, value) {
    const prev = this.get(key);
    if (key.includes('.')) {
      const parts = key.split('.');
      const last = parts.pop();
      const obj = parts.reduce((o, k) => { if (o[k] === undefined) o[k] = {}; return o[k]; }, this._state);
      obj[last] = value;
    } else {
      this._state[key] = value;
    }
    this._emit(key, value, prev);
    return this;
  }

  on(event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (list) this._listeners[event] = list.filter(f => f !== fn);
  }

  _emit(event, value, prev) {
    (this._listeners[event] || []).forEach(fn => fn(value, prev));
    (this._listeners['*'] || []).forEach(fn => fn(event, value, prev));
  }

  getFileContent(name) {
    const f = this._state.files[name];
    return f ? f.content : '';
  }

  setFileContent(name, content) {
    if (this._state.files[name]) {
      this._state.files[name].content = content;
      this._state.dirtyFiles.add(name);
      this._emit('file:changed', { name, content });
      this._emit('*', 'file:changed', { name, content });
    }
  }

  getActiveContent() {
    return this.getFileContent(this._state.activeFile);
  }

  getActiveLanguage() {
    const f = this._state.files[this._state.activeFile];
    return f ? f.language : 'plaintext';
  }

  openFile(name) {
    if (!this._state.files[name]) return;
    if (!this._state.openTabs.includes(name)) {
      this._state.openTabs.push(name);
    }
    this._state.activeFile = name;
    this._emit('file:opened', name);
    this._emit('*', 'file:opened', name);
  }

  closeTab(name) {
    const idx = this._state.openTabs.indexOf(name);
    if (idx === -1) return;
    this._state.openTabs.splice(idx, 1);
    if (this._state.activeFile === name) {
      this._state.activeFile = this._state.openTabs.length > 0
        ? this._state.openTabs[Math.min(idx, this._state.openTabs.length - 1)]
        : '';
    }
    this._emit('tab:closed', name);
    this._emit('*', 'tab:closed', name);
  }

  renameFile(oldName, newName) {
    if (!this._state.files[oldName]) return false;
    const file = this._state.files[oldName];
    file.name = newName;
    file.path = '/' + newName;
    const ext = newName.split('.').pop();
    file.language = this._extToLang(ext);
    delete this._state.files[oldName];
    this._state.files[newName] = file;
    const tabIdx = this._state.openTabs.indexOf(oldName);
    if (tabIdx > -1) this._state.openTabs[tabIdx] = newName;
    if (this._state.activeFile === oldName) this._state.activeFile = newName;
    this._state.folderStructure['/'].children = this._state.folderStructure['/'].children.map(c => c === oldName ? newName : c);
    this._emit('file:renamed', { oldName, newName });
    return true;
  }

  createFile(name, content = '', language = null) {
    if (this._state.files[name]) return false;
    const ext = name.split('.').pop();
    this._state.files[name] = {
      name, path: '/' + name, content,
      language: language || this._extToLang(ext)
    };
    if (!this._state.folderStructure['/'].children.includes(name)) {
      this._state.folderStructure['/'].children.push(name);
    }
    this._emit('file:created', name);
    return true;
  }

  deleteFile(name) {
    if (!this._state.files[name]) return false;
    if (['index.html', 'style.css', 'script.js'].includes(name)) return false;
    delete this._state.files[name];
    this.closeTab(name);
    this._state.folderStructure['/'].children = this._state.folderStructure['/'].children.filter(c => c !== name);
    this._emit('file:deleted', name);
    return true;
  }

  _extToLang(ext) {
    const map = { html: 'html', htm: 'html', css: 'css', js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown', py: 'python',
      txt: 'plaintext', xml: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml' };
    return map[ext] || 'plaintext';
  }

  addConsoleLog(level, args, timestamp) {
    this._state.consoleLogs.push({
      level, args: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)),
      timestamp: timestamp || Date.now()
    });
    if (this._state.consoleLogs.length > 200) this._state.consoleLogs.shift();
    this._emit('console:log', { level, args });
  }

  clearConsole() {
    this._state.consoleLogs = [];
    this._emit('console:clear');
  }

  setOutputContent(html) {
    this._state.outputContent = html;
    this._emit('output:changed', html);
  }

  getOutputContent() {
    return this._state.outputContent;
  }

  addProblem(problem) {
    this._state.problems.push(problem);
    this._emit('problem:added', problem);
    if (this._state.problems.length > 200) this._state.problems.shift();
  }

  clearProblems() {
    this._state.problems = [];
    this._emit('problems:cleared');
  }

  addSearchResult(result) {
    this._state.searchResults.push(result);
    this._emit('search:result', result);
  }

  clearSearchResults() {
    this._state.searchResults = [];
    this._emit('search:cleared');
  }

  setSearchResults(results) {
    this._state.searchResults = results;
    this._emit('search:results', results);
  }

  toJSON() {
    const s = this._state;
    return {
      project: s.project,
      files: Object.fromEntries(Object.entries(s.files).map(([k, v]) => [k, { name: v.name, content: v.content, language: v.language }])),
      theme: s.theme,
      editorFont: s.editorFont,
      editorFontSize: s.editorFontSize
    };
  }

  fromJSON(json) {
    if (!json) return;
    if (json.project) this._state.project = json.project;
    if (json.files) {
      this._state.files = json.files;
      this._state.openTabs = Object.keys(json.files).slice(0, 1);
      this._state.activeFile = this._state.openTabs[0] || '';
      this._state.folderStructure['/'].children = Object.keys(json.files);
    }
    if (json.theme) this._state.theme = json.theme;
    if (json.editorFont) this._state.editorFont = json.editorFont;
    if (json.editorFontSize) this._state.editorFontSize = json.editorFontSize;
    this._emit('state:loaded', json);
  }

  snapshot() {
    return JSON.stringify(this.toJSON());
  }

  hydrate(json) {
    this.fromJSON(JSON.parse(json));
  }
}

window.PlaygroundState = PlaygroundState;
