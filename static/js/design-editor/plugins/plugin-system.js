class DesignEditorPluginSystem {
  constructor(editor) {
    this.editor = editor;
    this.plugins = {};
  }

  register(plugin) {
    if (!plugin.id || !plugin.name) {
      console.warn('Plugin must have id and name');
      return false;
    }
    if (this.plugins[plugin.id]) {
      console.warn('Plugin already registered:', plugin.id);
      return false;
    }
    this.plugins[plugin.id] = plugin;
    if (plugin.onRegister) {
      plugin.onRegister(this.editor);
    }
    console.log(`Plugin registered: ${plugin.name} (${plugin.id})`);
    return true;
  }

  unregister(id) {
    const plugin = this.plugins[id];
    if (!plugin) return false;
    if (plugin.onUnregister) {
      plugin.onUnregister(this.editor);
    }
    delete this.plugins[id];
    return true;
  }

  get(id) {
    return this.plugins[id] || null;
  }

  getAll() {
    return Object.values(this.plugins);
  }

  getEnabled() {
    return Object.values(this.plugins).filter(p => p.enabled !== false);
  }

  enable(id) {
    const plugin = this.plugins[id];
    if (!plugin) return false;
    plugin.enabled = true;
    if (plugin.onEnable) plugin.onEnable(this.editor);
    return true;
  }

  disable(id) {
    const plugin = this.plugins[id];
    if (!plugin) return false;
    plugin.enabled = false;
    if (plugin.onDisable) plugin.onDisable(this.editor);
    return true;
  }
}

window.DesignEditorPluginSystem = DesignEditorPluginSystem;
