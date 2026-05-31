class PlaygroundExtensions {
  constructor(state) {
    this.state = state;
    this._extensions = new Map();
    this._commands = [];
    this._panels = [];
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;
    // Load built-in extensions
    this._loadBuiltins();
    // Restore user extensions from localStorage
    this._loadUserExtensions();
  }

  register(extension) {
    if (!extension || !extension.name) {
      console.error('Extension must have a name');
      return false;
    }
    if (this._extensions.has(extension.name)) {
      console.warn(`Extension "${extension.name}" already registered`);
      return false;
    }

    const ext = {
      name: extension.name,
      version: extension.version || '1.0.0',
      description: extension.description || '',
      author: extension.author || 'unknown',
      active: extension.active !== false,
      activate: extension.activate || (() => {}),
      deactivate: extension.deactivate || (() => {}),
      commands: extension.commands || [],
      panels: extension.panels || [],
      hooks: extension.hooks || {},
      _instance: null
    };

    this._extensions.set(ext.name, ext);
    this._commands.push(...ext.commands.map(c => ({ ...c, extension: ext.name })));
    this._panels.push(...ext.panels.map(p => ({ ...p, extension: ext.name })));

    // Activate if active
    if (ext.active) {
      this._activateExtension(ext);
    }

    return true;
  }

  unregister(name) {
    const ext = this._extensions.get(name);
    if (!ext) return false;
    this._deactivateExtension(ext);
    this._commands = this._commands.filter(c => c.extension !== name);
    this._panels = this._panels.filter(p => p.extension !== name);
    this._extensions.delete(name);
    return true;
  }

  _activateExtension(ext) {
    try {
      ext._instance = ext.activate({
        state: this.state,
        commands: this,
        registerCommand: (id, handler) => this._commands.push({ id, handler, extension: ext.name }),
        addPanel: (panel) => this._panels.push({ ...panel, extension: ext.name }),
        getFileContent: (name) => this.state.getFileContent(name),
        setFileContent: (name, content) => this.state.setFileContent(name, content),
        getFiles: () => this.state.get('files'),
        getActiveFile: () => this.state.get('activeFile'),
      });
    } catch (e) {
      console.error(`Failed to activate extension "${ext.name}":`, e);
    }
  }

  _deactivateExtension(ext) {
    try {
      if (ext.deactivate && ext._instance) {
        ext.deactivate(ext._instance);
      }
    } catch (e) {
      console.error(`Failed to deactivate extension "${ext.name}":`, e);
    }
    ext._instance = null;
  }

  _loadBuiltins() {
    // AI Code Assistant (placeholder)
    this.register({
      name: 'AI Assistant',
      version: '0.1.0',
      description: 'AI-powered code suggestions',
      active: false,
      commands: [
        { id: 'ai.complete', label: 'AI: Complete Code', action: () => alert('AI completion not configured') },
        { id: 'ai.explain', label: 'AI: Explain Code', action: () => alert('AI explanation not configured') },
      ],
      activate: (api) => {
        console.log('AI Assistant extension loaded');
        return { api };
      }
    });

    // Code Formatter extension
    this.register({
      name: 'Code Formatter',
      version: '1.0.0',
      description: 'Code formatting using built-in tools',
      active: true,
      commands: [
        { id: 'format.document', label: 'Format Document', action: () => {
          const editor = document.querySelector('.PlaygroundEditor')?.editor;
          if (editor) editor.getAction('editor.action.formatDocument')?.run();
        }}
      ],
      activate: () => console.log('Formatter extension loaded')
    });

    // Snippet Manager extension
    this.register({
      name: 'Snippets',
      version: '1.0.0',
      description: 'Code snippet manager',
      active: true,
      commands: [],
      panels: [],
      activate: (api) => {
        // Simple snippet insertion
        api.registerCommand('snippet.html5', {
          label: 'HTML5 Boilerplate',
          action: () => {
            const content = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>';
            const active = api.getActiveFile();
            if (active) api.setFileContent(active, content);
          }
        });
        return {};
      }
    });
  }

  _loadUserExtensions() {
    try {
      const saved = localStorage.getItem('pg_extensions');
      if (saved) {
        const exts = JSON.parse(saved);
        exts.forEach(e => this.register(e));
      }
    } catch (e) { /* ignore */ }
  }

  getCommands() {
    return this._commands;
  }

  getPanels() {
    return this._panels;
  }

  getExtensions() {
    return Array.from(this._extensions.values()).map(e => ({
      name: e.name, version: e.version, description: e.description,
      author: e.author, active: e.active
    }));
  }

  toggleExtension(name) {
    const ext = this._extensions.get(name);
    if (!ext) return false;
    ext.active = !ext.active;
    if (ext.active) {
      this._activateExtension(ext);
    } else {
      this._deactivateExtension(ext);
    }
    this._saveUserExtensions();
    return ext.active;
  }

  _saveUserExtensions() {
    try {
      const userExts = Array.from(this._extensions.values())
        .filter(e => !['AI Assistant', 'Code Formatter', 'Snippets'].includes(e.name))
        .map(e => ({ name: e.name, version: e.version, description: e.description, active: e.active }));
      localStorage.setItem('pg_extensions', JSON.stringify(userExts));
    } catch (e) { /* ignore */ }
  }
}

window.PlaygroundExtensions = PlaygroundExtensions;
