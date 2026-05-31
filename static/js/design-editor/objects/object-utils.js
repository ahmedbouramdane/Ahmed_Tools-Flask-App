class DesignEditorObjectUtils {
  static createObject(type, props = {}) {
    const base = {
      id: 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type,
      x: props.x || 100,
      y: props.y || 100,
      w: props.w || 100,
      h: props.h || 100,
      fill: props.fill || '#6366f1',
      stroke: props.stroke || null,
      strokeWidth: props.strokeWidth || 0,
      opacity: props.opacity ?? 1,
      rotation: props.rotation || 0,
      locked: props.locked || false,
      zIndex: props.zIndex || 0,
      borderRadius: props.borderRadius || 0,
    };

    const types = {
      rectangle: () => ({ ...base, fill: '#6366f1' }),
      circle: () => ({ ...base, fill: '#10b981' }),
      triangle: () => ({ ...base, fill: '#f59e0b', w: 120 }),
      line: () => ({ ...base, type: 'line', fill: undefined, stroke: '#6b7280', strokeWidth: 2, h: 2 }),
      arrow: () => ({ ...base, type: 'arrow', fill: undefined, stroke: '#6b7280', strokeWidth: 2, h: 2 }),
      text: () => ({
        ...base, type: 'text', fill: '#1f2937', w: 200, h: 36,
        text: 'Double-click to edit', fontFamily: 'Inter, sans-serif', fontSize: 24,
        fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', lineHeight: 1.4, letterSpacing: 0, textShadow: null, textStroke: null
      }),
      image: () => ({
        ...base, type: 'image', fill: 'transparent', src: null, _img: null,
        filters: { brightness: 100, contrast: 100, blur: 0, grayscale: 0, saturation: 100 },
        flipH: false, flipV: false, crop: null, borderRadius: 0
      }),
      sticker: () => ({
        ...base, type: 'sticker', w: 80, h: 80,
        stickerId: props.stickerId || 'star', fill: '#6366f1'
      }),
    };

    const fn = types[type];
    return fn ? { ...fn(), ...props } : { ...base, ...props };
  }

  static getBounds(obj) {
    return {
      x: obj.x || 0,
      y: obj.y || 0,
      w: obj.w || (obj.type === 'text' ? (obj.text || 'X').length * (obj.fontSize || 24) * 0.6 : 100),
      h: obj.h || (obj.type === 'text' ? (obj.fontSize || 24) * 1.4 : 100)
    };
  }

  static hitTest(objects, x, y) {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      const b = DesignEditorObjectUtils.getBounds(o);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { ...o, ...b };
      }
    }
    return null;
  }

  static hitEdge(obj, px, py, margin = 6) {
    const b = DesignEditorObjectUtils.getBounds(obj);
    let edge = '';
    if (Math.abs(px - b.x) < margin) edge += 'w';
    if (Math.abs(px - (b.x + b.w)) < margin) edge += 'e';
    if (Math.abs(py - b.y) < margin) edge += 'n';
    if (Math.abs(py - (b.y + b.h)) < margin) edge += 's';
    const map = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize', n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize' };
    return map[edge] || null;
  }

  static getShapePoints(type, x, y, w, h) {
    switch (type) {
      case 'triangle':
        return [{ x: x + w / 2, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
      case 'diamond':
        return [{ x: x + w / 2, y: y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x: x, y: y + h / 2 }];
      case 'pentagon': {
        const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
        return Array.from({ length: 5 }, (_, i) => {
          const a = (i * 72 - 90) * Math.PI / 180;
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        });
      }
      case 'star': {
        const cx = x + w / 2, cy = y + h / 2, outer = Math.min(w, h) / 2, inner = outer * 0.4;
        return Array.from({ length: 10 }, (_, i) => {
          const a = (i * 36 - 90) * Math.PI / 180;
          const r = i % 2 === 0 ? outer : inner;
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        });
      }
      default:
        return [];
    }
  }

  static STICKERS = [
    { id: 'star', icon: '⭐' }, { id: 'heart', icon: '❤️' }, { id: 'smile', icon: '😊' },
    { id: 'fire', icon: '🔥' }, { id: 'thumbs', icon: '👍' }, { id: 'check', icon: '✅' },
    { id: 'rocket', icon: '🚀' }, { id: 'lightbulb', icon: '💡' }, { id: 'crown', icon: '👑' },
    { id: 'arrow-up', icon: '⬆️' }, { id: 'target', icon: '🎯' }, { id: 'medal', icon: '🏅' },
  ];

  static FONTS = [
    'Inter, sans-serif', 'Plus Jakarta Sans, sans-serif', 'Georgia, serif',
    'Courier New, monospace', 'Arial, sans-serif', 'Times New Roman, serif',
    'Impact, sans-serif', 'Comic Sans MS, cursive', 'Trebuchet MS, sans-serif',
    'Verdana, sans-serif'
  ];
}

window.DesignEditorObjectUtils = DesignEditorObjectUtils;
