class DesignEditorLeftPanel {
  constructor(state) {
    this.state = state;
    this.el = null;
    this._tabs = { elements: null, images: null, stickers: null, templates: null, ai: null };
  }

  mount(container) {
    this.el = document.createElement('div');
    this.el.className = 'de-left-panel';
    this.el.innerHTML = `
      <div class="de-left-tabs">
        <button class="de-left-tab de-left-tab-active" data-tab="elements"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Elements</span></button>
        <button class="de-left-tab" data-tab="text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg><span>Text</span></button>
        <button class="de-left-tab" data-tab="images"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Images</span></button>
        <button class="de-left-tab" data-tab="stickers"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v9h-9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 15a3 3 0 0 0 6 0"/></svg><span>Stickers</span></button>
        <button class="de-left-tab" data-tab="templates"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg><span>Templates</span></button>
        <button class="de-left-tab" data-tab="ai"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M5.64 5.64l2.83 2.83"/><path d="M15.54 15.54l2.83 2.83"/><path d="M3 12h2"/><path d="M19 12h2"/><circle cx="12" cy="12" r="3"/></svg><span>AI</span></button>
      </div>
      <div class="de-left-content">
        <div class="de-left-tab-content de-left-tab-active" id="de-tab-elements">
          <div class="de-panel-title">Shapes</div>
          <div class="de-shape-grid">
            <button class="de-shape-btn" data-tool="rectangle"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/></svg><span>Rect</span></button>
            <button class="de-shape-btn" data-tool="circle"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg><span>Circle</span></button>
            <button class="de-shape-btn" data-tool="triangle"><svg viewBox="0 0 24 24"><polygon points="12 2 22 22 2 22" fill="currentColor"/></svg><span>Triangle</span></button>
            <button class="de-shape-btn" data-tool="line"><svg viewBox="0 0 24 24"><line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2"/></svg><span>Line</span></button>
            <button class="de-shape-btn" data-tool="arrow"><svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="2"/><polyline points="12 5 19 5 19 12" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Arrow</span></button>
          </div>
        </div>
        <div class="de-left-tab-content" id="de-tab-text">
          <div class="de-panel-title">Add Text</div>
          <button class="de-add-text-btn" data-font-size="24">Add Heading</button>
          <button class="de-add-text-btn" data-font-size="16">Add Subheading</button>
          <button class="de-add-text-btn" data-font-size="12">Add Body Text</button>
        </div>
        <div class="de-left-tab-content" id="de-tab-images">
          <div class="de-panel-title">Upload Image</div>
          <div class="de-upload-zone" id="de-image-upload">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Click to upload or drag image</span>
            <input type="file" accept="image/*" hidden>
          </div>
          <div class="de-panel-title" style="margin-top:12px">Filters</div>
          <div class="de-filter-presets">
            <button class="de-filter-btn" data-filter="none">Original</button>
            <button class="de-filter-btn" data-filter="grayscale">Grayscale</button>
            <button class="de-filter-btn" data-filter="sepia">Sepia</button>
            <button class="de-filter-btn" data-filter="blur">Blur</button>
            <button class="de-filter-btn" data-filter="bright">Bright</button>
            <button class="de-filter-btn" data-filter="contrast">Contrast</button>
          </div>
        </div>
        <div class="de-left-tab-content" id="de-tab-stickers">
          <div class="de-panel-title">Stickers</div>
          <div class="de-sticker-grid"></div>
        </div>
        <div class="de-left-tab-content" id="de-tab-templates">
          <div class="de-panel-title">Templates</div>
          <div class="de-template-grid"></div>
          <div class="de-panel-title" style="margin-top:14px">Backgrounds</div>
          <div class="de-background-grid"></div>
        </div>
        <div class="de-left-tab-content" id="de-tab-ai">
          <div class="de-panel-title">AI Design Assistant</div>
          <textarea class="de-ai-prompt" placeholder="Describe your design idea, color mood, or text style..."></textarea>
          <div class="de-ai-actions">
            <button class="de-ai-btn" data-ai="headline">Generate Headline</button>
            <button class="de-ai-btn" data-ai="palette">Generate Palette</button>
            <button class="de-ai-btn" data-ai="background">Create Background</button>
          </div>
          <div class="de-ai-output">Enter a prompt and choose an AI action.</div>
          <button class="de-ai-insert-btn">Insert Result</button>
        </div>
      </div>
    `;

    this._bindTabs();
    this._bindShapes();
    this._bindText();
    this._bindImageUpload();
    this._bindStickers();
    this._bindTemplates();
    this._bindBackgrounds();
    this._bindFilters();
    this._bindAi();

    container.appendChild(this.el);
  }

  _bindTabs() {
    this.el.querySelectorAll('.de-left-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.el.querySelectorAll('.de-left-tab').forEach(t => t.classList.remove('de-left-tab-active'));
        this.el.querySelectorAll('.de-left-tab-content').forEach(c => c.classList.remove('de-left-tab-active'));
        tab.classList.add('de-left-tab-active');
        const content = this.el.querySelector('#de-tab-' + tab.dataset.tab);
        if (content) content.classList.add('de-left-tab-active');
      });
    });
  }

  _bindShapes() {
    this.el.querySelectorAll('.de-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.set('activeTool', btn.dataset.tool);
      });
    });
  }

  _bindText() {
    this.el.querySelectorAll('.de-add-text-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const obj = DesignEditorObjectUtils.createObject('text', {
          x: 100, y: 100, w: 300, h: 40,
          fontSize: parseInt(btn.dataset.fontSize),
          text: btn.dataset.fontSize === '24' ? 'Heading Text' : btn.dataset.fontSize === '16' ? 'Subheading text here' : 'Body text goes here'
        });
        this.state.addObject(obj);
        this.state.set('activeTool', 'select');
        this.state.get('history')?.save();
      });
    });
  }

  _bindImageUpload() {
    const zone = this.el.querySelector('#de-image-upload');
    const input = zone.querySelector('input');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('de-dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('de-dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('de-dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this._loadImage(file);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) this._loadImage(input.files[0]);
    });
  }

  _loadImage(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const obj = DesignEditorObjectUtils.createObject('image', {
          x: 100, y: 100, w, h,
          src: e.target.result,
          _img: img
        });
        this.state.addObject(obj);
        this.state.set('activeTool', 'select');
        this.state.get('history')?.save();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _bindFilters() {
    this.el.querySelectorAll('.de-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const sel = this.state.getSelectedObjects();
        sel.forEach(obj => {
          if (obj.type === 'image') {
            const f = { brightness: 100, contrast: 100, blur: 0, grayscale: 0, saturation: 100 };
            switch (filter) {
              case 'grayscale': f.grayscale = 100; break;
              case 'sepia': f.saturation = 50; f.grayscale = 30; break;
              case 'blur': f.blur = 4; break;
              case 'bright': f.brightness = 150; break;
              case 'contrast': f.contrast = 150; break;
            }
            this.state.updateObject(obj.id, { filters: f });
            this.state.get('history')?.save();
          }
        });
      });
    });
  }

  _bindAi() {
    const promptEl = this.el.querySelector('.de-ai-prompt');
    const outputEl = this.el.querySelector('.de-ai-output');
    let currentResult = { type: null, content: '' };

    const setOutput = (html) => {
      outputEl.innerHTML = html;
    };

    this.el.querySelectorAll('.de-ai-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.ai;
        const prompt = promptEl.value.trim();
        if (!prompt) {
          showToast('Enter an AI prompt first', 'error');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Generating...';
        try {
          const response = await fetch('/tools/api/design/ai-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type, prompt: prompt })
          });
          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || 'AI generation failed');
          }
          currentResult = { type: type, content: data.result, palette: data.palette || [] };
          let html = `<div>${data.result}</div>`;
          if (data.palette && data.palette.length) {
            html += '<div class="de-palette">' + data.palette.map(c => `<div class="de-ai-swatch" style="background:${c}" title="${c}"></div>`).join('') + '</div>';
          }
          setOutput(html);
        } catch (err) {
          setOutput('<div style="color:#f87171">' + escapeHtml(err.message || 'AI failed') + '</div>');
        } finally {
          btn.disabled = false;
          btn.textContent = btn.dataset.ai === 'headline' ? 'Generate Headline' : btn.dataset.ai === 'palette' ? 'Generate Palette' : 'Create Background';
        }
      });
    });

    this.el.querySelector('.de-ai-insert-btn').addEventListener('click', () => {
      if (!currentResult.content) {
        showToast('Generate a result before inserting', 'error');
        return;
      }
      if (currentResult.type === 'headline' || currentResult.type === 'background') {
        const obj = DesignEditorObjectUtils.createObject('text', {
          x: 100,
          y: 100,
          w: 420,
          h: 160,
          fontSize: currentResult.type === 'headline' ? 32 : 20,
          fontWeight: '700',
          text: currentResult.content,
          fill: '#111827'
        });
        this.state.addObject(obj);
      } else if (currentResult.type === 'palette' && currentResult.palette && currentResult.palette.length) {
        currentResult.palette.forEach((color, index) => {
          const obj = DesignEditorObjectUtils.createObject('rectangle', {
            x: 80 + index * 90,
            y: 120,
            w: 80,
            h: 80,
            fill: color,
            borderRadius: 16
          });
          this.state.addObject(obj);
        });
      }
      this.state.set('activeTool', 'select');
      this.state.get('history')?.save();
      showToast('AI result inserted');
    });
  }

  _bindStickers() {
    const grid = this.el.querySelector('.de-sticker-grid');
    DesignEditorObjectUtils.STICKERS.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'de-sticker-btn';
      btn.textContent = s.icon;
      btn.title = s.id;
      btn.addEventListener('click', () => {
        const obj = DesignEditorObjectUtils.createObject('sticker', { stickerId: s.id, x: 100, y: 100 });
        this.state.addObject(obj);
        this.state.get('history')?.save();
      });
      grid.appendChild(btn);
    });
  }

  _bindTemplates() {
    const grid = this.el.querySelector('.de-template-grid');
    const templates = [
      { name: 'Instagram Post', w: 600, h: 600, bg: '#fef3c7' },
      { name: 'Twitter Banner', w: 1200, h: 600, bg: '#dbeafe' },
      { name: 'YouTube Thumbnail', w: 1280, h: 720, bg: '#fce7f3' },
      { name: 'Facebook Cover', w: 820, h: 312, bg: '#d1fae5' },
      { name: 'Business Card', w: 600, h: 350, bg: '#f3e8ff' },
      { name: 'Certificate', w: 900, h: 600, bg: '#fef9c3' },
      { name: 'Poster A4', w: 800, h: 1130, bg: '#ffffff' },
      { name: 'Blank Canvas', w: 800, h: 600, bg: '#ffffff' },
    ];
    templates.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'de-template-btn';
      btn.innerHTML = `<div class="de-template-preview" style="background:${t.bg}"><span>${t.w}×${t.h}</span></div><span class="de-template-name">${t.name}</span>`;
      btn.addEventListener('click', () => {
        this.state.set('canvas', { ...this.state.get('canvas'), width: t.w, height: t.h, background: t.bg });
        this.state.get('history')?.save();
        showToast(`${t.name} template applied`);
      });
      grid.appendChild(btn);
    });
  }

  _bindBackgrounds() {
    const grid = this.el.querySelector('.de-background-grid');
    const backgrounds = [
      { name: 'Soft Breeze', bg: '#EFF6FF' },
      { name: 'Warm Sunset', bg: '#FDE68A' },
      { name: 'Mint Dream', bg: '#D1FAE5' },
      { name: 'Night Sky', bg: '#0F172A' },
      { name: 'Peach Glow', bg: '#FBCFE8' },
      { name: 'Slate Mist', bg: '#E2E8F0' },
    ];
    backgrounds.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'de-background-btn';
      btn.innerHTML = `<span class="de-background-swatch" style="background:${b.bg}"></span><span>${b.name}</span>`;
      btn.addEventListener('click', () => {
        this.state.set('canvas', { ...this.state.get('canvas'), background: b.bg });
        this.state.get('history')?.save();
        showToast('Background applied');
      });
      grid.appendChild(btn);
    });
  }
}

window.DesignEditorLeftPanel = DesignEditorLeftPanel;
