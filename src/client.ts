import type { InspektOptions } from './index.js';

export function getClientScript(options: InspektOptions): string {
  const activateShortcut = options.shortcuts?.activate ?? 'ctrl+alt+period';
  return `(function() {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let fiActive = false;
  let measureMode = false;   // toggled by tapping Option
  let pinEl = null;          // measure-from pinned element
  let lastHovered = null;
  let optionHeld = false;

  const ACTIVATE = ${JSON.stringify(activateShortcut)};

  // ─── Tooltip ──────────────────────────────────────────────────────────────
  const tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'fixed',
    zIndex: '2147483646',
    pointerEvents: 'none',
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    background: '#1a1a1a',
    color: '#e8e8e8',
    padding: '12px 16px',
    borderRadius: '8px',
    maxWidth: '560px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    display: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
  });
  document.body.appendChild(tooltip);

  // Measure overlay canvas-like div
  const measureOverlay = document.createElement('div');
  Object.assign(measureOverlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483645',
    pointerEvents: 'none',
    display: 'none',
  });
  document.body.appendChild(measureOverlay);

  // ─── Pill ─────────────────────────────────────────────────────────────────
  const pill = document.createElement('div');
  Object.assign(pill.style, {
    position: 'fixed',
    bottom: '16px',
    left: '16px',
    zIndex: '2147483647',
    display: 'none',
    alignItems: 'center',
    gap: '8px',
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    padding: '6px 10px 6px 8px',
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    fontSize: '11px',
    color: '#e8e8e8',
    cursor: 'default',
    userSelect: 'none',
    transition: 'max-width 0.2s ease',
    overflow: 'hidden',
    maxWidth: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  });

  const pillIcon = document.createElement('span');
  pillIcon.textContent = '⚡';
  Object.assign(pillIcon.style, { fontSize: '13px', flexShrink: '0' });

  const pillText = document.createElement('span');
  Object.assign(pillText.style, { visibility: 'hidden', whiteSpace: 'nowrap', color: '#aaa' });

  const pillClose = document.createElement('span');
  pillClose.textContent = '×';
  pillClose.title = 'Close Inspekt';
  Object.assign(pillClose.style, {
    cursor: 'pointer',
    color: '#666',
    fontSize: '15px',
    lineHeight: '1',
    visibility: 'hidden',
    flexShrink: '0',
    padding: '0 2px',
  });
  pillClose.addEventListener('click', (e) => { e.stopPropagation(); deactivate(); });

  pill.appendChild(pillIcon);
  pill.appendChild(pillText);
  pill.appendChild(pillClose);
  document.body.appendChild(pill);

  pill.addEventListener('mouseenter', () => {
    clearMeasureOverlay();
    hideTooltip();
    expandPill();
  });
  pill.addEventListener('mouseleave', () => {
    if (!pinEl) collapsePill();
  });

  function expandPill() {
    pill.style.maxWidth = '600px';
    pillText.style.visibility = 'visible';
    pillClose.style.visibility = 'visible';
    const mode = measureMode ? 'Measure' : 'Properties';
    const shortcuts = measureMode
      ? 'Hover → distances  M → pin  Cmd+C → copy  Option → toggle mode'
      : 'Hover → inspect  Cmd+C → copy  Option → measure mode';
    pillText.textContent = \`\${mode} · \${shortcuts}\`;
  }

  function collapsePill() {
    pill.style.maxWidth = '32px';
    pillText.style.visibility = 'hidden';
    pillClose.style.visibility = 'hidden';
  }

  function flashMode() {
    const mode = measureMode ? '⬡ Measure mode' : '◉ Properties mode';
    pillText.style.visibility = 'visible';
    pillClose.style.visibility = 'visible';
    pill.style.maxWidth = '600px';
    pillText.textContent = mode;
    setTimeout(() => {
      if (!pill.matches(':hover') && !pinEl) collapsePill();
    }, 1200);
  }

  // ─── Activate / Deactivate ────────────────────────────────────────────────
  function activate() {
    fiActive = true;
    measureMode = false;
    pill.style.display = 'flex';
    collapsePill();
  }

  function deactivate() {
    fiActive = false;
    measureMode = false;
    pinEl = null;
    lastHovered = null;
    optionHeld = false;
    pill.style.display = 'none';
    hideTooltip();
    clearMeasureOverlay();
    clearPin();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  function positionTooltip(x, y) {
    tooltip.style.display = 'block';
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    let left = x + 16;
    let top = y + 16;
    if (left + tw > vw - margin) left = x - tw - 16;
    if (top + th > vh - margin) top = y - th - 16;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return { raw: str, hex: str, alpha: 1 };
    const [, r, g, b, a = '1'] = m;
    const alpha = parseFloat(a);
    const hex = toHex(r, g, b);
    return { raw: str, hex, alpha };
  }

  function colorLabel(str) {
    const c = parseColor(str);
    if (!c) return null;
    if (c.alpha < 1) return \`\${c.hex} (\${Math.round(c.alpha * 100)}% opacity)\`;
    return c.hex;
  }

  function getComponentName(el) {
    // React fiber
    for (const key of Object.keys(el)) {
      if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
        let fiber = el[key];
        while (fiber) {
          const name = fiber.type?.displayName || fiber.type?.name;
          if (name && name.length > 3 && /^[A-Z]/.test(name)) return name;
          fiber = fiber.return;
        }
      }
    }
    // Vue 3
    if (el.__vueParentComponent) {
      const name = el.__vueParentComponent.type?.name || el.__vueParentComponent.type?.__name;
      if (name && name.length > 3) return name;
    }
    return null;
  }

  function getMatchingRules(el) {
    const results = [];
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type !== 1) continue; // CSSStyleRule only
          const sel = rule.selectorText;
          if (!sel) continue;
          // Skip universal/reset selectors
          if (/^[*,]|^:root|^html|^body$|^::before|^::after/.test(sel.trim())) continue;
          try {
            if (el.matches(sel)) {
              const props = [];
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                const val = rule.style.getPropertyValue(prop);
                if (val) props.push(\`  \${prop}: \${val};\`);
              }
              if (props.length) results.push(\`\${sel} {\\n\${props.join('\\n')}\\n}\`);
            }
          } catch {}
        }
      }
    } catch {}
    return results;
  }

  function getSelector(el) {
    const parts = [];
    let cur = el;
    for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) { part += '#' + cur.id; parts.unshift(part); break; }
      if (cur.classList.length) part += '.' + Array.from(cur.classList).slice(0, 2).join('.');
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // ─── Build info text ──────────────────────────────────────────────────────
  function buildInfo(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const tag = el.tagName.toLowerCase();
    const comp = getComponentName(el);
    const dataStyle = el.dataset?.style;

    const lines = [];

    // Header line
    let header = \`<\${tag}>\`;
    if (comp) header += \` \${comp}\`;
    if (dataStyle) header += \` [\${dataStyle}]\`;
    header += \` \${w}×\${h}\`;
    lines.push(header);

    // Text content
    const text = el.textContent?.trim().slice(0, 40);
    if (text) lines.push(\`"\${text}\${el.textContent.trim().length > 40 ? '…' : ''}"\`);

    // Font
    const ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    const fw = cs.fontWeight;
    const fs = cs.fontSize;
    const lh = cs.lineHeight;
    lines.push(\`font: \${ff} \${fw} \${fs}/\${lh}\`);

    // Color
    const color = colorLabel(cs.color);
    if (color) lines.push(\`color: \${color}\`);

    // Background
    const bg = colorLabel(cs.backgroundColor);
    if (bg) lines.push(\`bg: \${bg}\`);

    // Padding
    const pt = cs.paddingTop, pr = cs.paddingRight, pb = cs.paddingBottom, pl = cs.paddingLeft;
    if ([pt,pr,pb,pl].some(v => v !== '0px')) {
      lines.push(\`padding: \${pt} \${pr} \${pb} \${pl}\`);
    }

    // Margin
    const mt = cs.marginTop, mr = cs.marginRight, mb = cs.marginBottom, ml = cs.marginLeft;
    if ([mt,mr,mb,ml].some(v => v !== '0px')) {
      lines.push(\`margin: \${mt} \${mr} \${mb} \${ml}\`);
    }

    // Border radius
    if (cs.borderRadius && cs.borderRadius !== '0px') {
      lines.push(\`radius: \${cs.borderRadius}\`);
    }

    // Display (only non-trivial)
    const disp = cs.display;
    if (disp === 'flex' || disp === 'grid' || disp === 'inline-flex' || disp === 'inline-grid') {
      let dispLine = \`display: \${disp}\`;
      if (cs.gap && cs.gap !== 'normal') dispLine += \`  gap: \${cs.gap}\`;
      if (disp.includes('flex') && cs.flexDirection !== 'row') dispLine += \`  dir: \${cs.flexDirection}\`;
      lines.push(dispLine);
    }

    return lines.join('\\n');
  }

  function buildCopyText(el) {
    const info = buildInfo(el);
    const rules = getMatchingRules(el);
    const selector = getSelector(el);
    let out = \`[Inspekt]\\n\${info}\\n  selector: \${selector}\`;
    if (rules.length) {
      out += \`\\n\\n--- CSS Rules ---\\n\${rules.join('\\n\\n')}\`;
    }
    return out;
  }

  // ─── Measure mode ─────────────────────────────────────────────────────────
  let pinHighlight = null;

  function clearPin() {
    if (pinHighlight) { pinHighlight.remove(); pinHighlight = null; }
    pinEl = null;
  }

  function clearMeasureOverlay() {
    measureOverlay.innerHTML = '';
    measureOverlay.style.display = 'none';
  }

  function drawLine(x1, y1, x2, y2, label) {
    const isHoriz = Math.abs(y2 - y1) < 1;
    const line = document.createElement('div');
    Object.assign(line.style, {
      position: 'absolute',
      background: '#e53e3e',
      pointerEvents: 'none',
    });

    if (isHoriz) {
      const left = Math.min(x1, x2);
      const width = Math.abs(x2 - x1);
      Object.assign(line.style, {
        left: left + 'px', top: (y1 - 0.5) + 'px',
        width: width + 'px', height: '1px',
      });
    } else {
      const top = Math.min(y1, y2);
      const height = Math.abs(y2 - y1);
      Object.assign(line.style, {
        left: (x1 - 0.5) + 'px', top: top + 'px',
        width: '1px', height: height + 'px',
      });
    }

    measureOverlay.appendChild(line);

    if (label && label !== '0px') {
      const lbl = document.createElement('div');
      lbl.textContent = label;
      Object.assign(lbl.style, {
        position: 'absolute',
        background: '#e53e3e',
        color: '#fff',
        fontSize: '10px',
        fontFamily: 'ui-monospace, monospace',
        padding: '1px 4px',
        borderRadius: '3px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      });
      if (isHoriz) {
        const cx = (Math.min(x1,x2) + Math.max(x1,x2)) / 2;
        lbl.style.left = cx + 'px';
        lbl.style.top = (y1 - 14) + 'px';
        lbl.style.transform = 'translateX(-50%)';
      } else {
        const cy = (Math.min(y1,y2) + Math.max(y1,y2)) / 2;
        lbl.style.left = (x1 + 6) + 'px';
        lbl.style.top = cy + 'px';
        lbl.style.transform = 'translateY(-50%)';
      }
      measureOverlay.appendChild(lbl);
    }
  }

  function highlightEl(el, color) {
    const rect = el.getBoundingClientRect();
    const hl = document.createElement('div');
    Object.assign(hl.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      border: \`2px solid \${color}\`,
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: '2147483644',
      boxSizing: 'border-box',
    });
    document.body.appendChild(hl);
    return hl;
  }

  function measureToNeighbor(targetEl) {
    clearMeasureOverlay();
    const tr = targetEl.getBoundingClientRect();

    // Walk up to find siblings or parent
    let measured = false;
    let cur = targetEl.parentElement;
    for (let depth = 0; depth < 3 && cur && !measured; depth++) {
      const children = Array.from(cur.children).filter(c => c !== targetEl && c.offsetParent !== null);
      if (children.length === 0) { cur = cur.parentElement; continue; }

      // Find closest sibling above, below, left, right
      let closest = { top: null, bottom: null, left: null, right: null };
      let gaps = { top: Infinity, bottom: Infinity, left: Infinity, right: Infinity };

      for (const sib of children) {
        const sr = sib.getBoundingClientRect();
        // Above: sib bottom <= target top
        if (sr.bottom <= tr.top) {
          const g = tr.top - sr.bottom;
          if (g < gaps.top) { gaps.top = g; closest.top = sib; }
        }
        // Below: sib top >= target bottom
        if (sr.top >= tr.bottom) {
          const g = sr.top - tr.bottom;
          if (g < gaps.bottom) { gaps.bottom = g; closest.bottom = sib; }
        }
        // Left: sib right <= target left
        if (sr.right <= tr.left) {
          const g = tr.left - sr.right;
          if (g < gaps.left) { gaps.left = g; closest.left = sib; }
        }
        // Right: sib left >= target right
        if (sr.left >= tr.right) {
          const g = sr.left - tr.right;
          if (g < gaps.right) { gaps.right = g; closest.right = sib; }
        }
      }

      // If we have siblings in at least one direction, draw and stop
      if (closest.top || closest.bottom || closest.left || closest.right) {
        measured = true;
        const cx = (tr.left + tr.right) / 2;
        const cy = (tr.top + tr.bottom) / 2;

        if (closest.top) {
          const sr = closest.top.getBoundingClientRect();
          drawLine(cx, sr.bottom, cx, tr.top, Math.round(gaps.top) + 'px');
        }
        if (closest.bottom) {
          const sr = closest.bottom.getBoundingClientRect();
          drawLine(cx, tr.bottom, cx, sr.top, Math.round(gaps.bottom) + 'px');
        }
        if (closest.left) {
          const sr = closest.left.getBoundingClientRect();
          drawLine(sr.right, cy, tr.left, cy, Math.round(gaps.left) + 'px');
        }
        if (closest.right) {
          const sr = closest.right.getBoundingClientRect();
          drawLine(tr.right, cy, sr.left, cy, Math.round(gaps.right) + 'px');
        }
      } else {
        // No siblings found — show distance to parent edges
        const pr = cur.getBoundingClientRect();
        const cx = (tr.left + tr.right) / 2;
        const cy = (tr.top + tr.bottom) / 2;
        const gapTop = tr.top - pr.top;
        const gapBottom = pr.bottom - tr.bottom;
        const gapLeft = tr.left - pr.left;
        const gapRight = pr.right - tr.right;
        if (gapTop > 0) drawLine(cx, pr.top, cx, tr.top, Math.round(gapTop) + 'px');
        if (gapBottom > 0) drawLine(cx, tr.bottom, cx, pr.bottom, Math.round(gapBottom) + 'px');
        if (gapLeft > 0) drawLine(pr.left, cy, tr.left, cy, Math.round(gapLeft) + 'px');
        if (gapRight > 0) drawLine(tr.right, cy, pr.right, cy, Math.round(gapRight) + 'px');
        measured = true;
      }

      cur = cur.parentElement;
    }

    measureOverlay.style.display = 'block';

    // Tooltip with distances summary
    const lines = [];
    lines.push('⬡ Measure mode  (M → pin element)');
    const tag = targetEl.tagName.toLowerCase();
    const rect = targetEl.getBoundingClientRect();
    lines.push(\`<\${tag}> \${Math.round(rect.width)}×\${Math.round(rect.height)}\`);
    return lines.join('\\n');
  }

  function measureBetween(fromEl, toEl) {
    clearMeasureOverlay();
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();

    const lines = [];
    lines.push('⬡ Measure  (Cmd+C → copy)');

    const fTag = fromEl.tagName.toLowerCase();
    const tTag = toEl.tagName.toLowerCase();
    const fComp = getComponentName(fromEl);
    const tComp = getComponentName(toEl);
    lines.push(\`From: <\${fTag}>\${fComp ? ' ' + fComp : ''} \${Math.round(fr.width)}×\${Math.round(fr.height)}\`);
    lines.push(\`To:   <\${tTag}>\${tComp ? ' ' + tComp : ''} \${Math.round(tr.width)}×\${Math.round(tr.height)}\`);

    // Check containment
    const fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    const toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;

    if (fromContainsTo || toContainsFrom) {
      const outer = fromContainsTo ? fr : tr;
      const inner = fromContainsTo ? tr : fr;
      const insetTop = inner.top - outer.top;
      const insetBottom = outer.bottom - inner.bottom;
      const insetLeft = inner.left - outer.left;
      const insetRight = outer.right - inner.right;

      const cx = (inner.left + inner.right) / 2;
      const cy = (inner.top + inner.bottom) / 2;
      if (insetTop > 0) drawLine(cx, outer.top, cx, inner.top, Math.round(insetTop) + 'px');
      if (insetBottom > 0) drawLine(cx, inner.bottom, cx, outer.bottom, Math.round(insetBottom) + 'px');
      if (insetLeft > 0) drawLine(outer.left, cy, inner.left, cy, Math.round(insetLeft) + 'px');
      if (insetRight > 0) drawLine(inner.right, cy, outer.right, cy, Math.round(insetRight) + 'px');

      lines.push(\`inset-top: \${Math.round(insetTop)}px\`);
      lines.push(\`inset-bottom: \${Math.round(insetBottom)}px\`);
      lines.push(\`inset-left: \${Math.round(insetLeft)}px\`);
      lines.push(\`inset-right: \${Math.round(insetRight)}px\`);
    } else {
      // Gap between separate elements
      const vertGap = fr.bottom <= tr.top ? tr.top - fr.bottom
                    : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      const horizGap = fr.right <= tr.left ? tr.left - fr.right
                     : tr.right <= fr.left ? fr.left - tr.right : 0;

      const cx = (fr.left + fr.right) / 2;
      const cy = (fr.top + fr.bottom) / 2;

      if (vertGap > 0) {
        const yFrom = fr.bottom <= tr.top ? fr.bottom : tr.bottom;
        const yTo = fr.bottom <= tr.top ? tr.top : fr.top;
        drawLine(cx, yFrom, cx, yTo, Math.round(vertGap) + 'px');
        lines.push(\`vertical gap: \${Math.round(vertGap)}px (\${fr.bottom <= tr.top ? 'From above To' : 'To above From'})\`);
      }
      if (horizGap > 0) {
        const xFrom = fr.right <= tr.left ? fr.right : tr.right;
        const xTo = fr.right <= tr.left ? tr.left : fr.left;
        drawLine(xFrom, cy, xTo, cy, Math.round(horizGap) + 'px');
        lines.push(\`horizontal gap: \${Math.round(horizGap)}px\`);
      }
      if (vertGap === 0 && horizGap === 0) {
        lines.push('Elements overlap');
      }
    }

    measureOverlay.style.display = 'block';
    return lines.join('\\n');
  }

  function buildMeasureCopyText(fromEl, toEl) {
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    const toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;
    const fTag = fromEl.tagName.toLowerCase();
    const tTag = toEl.tagName.toLowerCase();
    const fComp = getComponentName(fromEl);
    const tComp = getComponentName(toEl);
    const fText = fromEl.textContent?.trim().slice(0, 40);
    const tText = toEl.textContent?.trim().slice(0, 40);

    const lines = ['[Inspekt Measure]'];
    lines.push(\`From: <\${fTag}>\${fComp ? ' ' + fComp : ''} \${Math.round(fr.width)}×\${Math.round(fr.height)}\${fText ? ' "' + fText + '"' : ''}\`);
    lines.push(\`  selector: \${getSelector(fromEl)}\`);
    lines.push(\`To:   <\${tTag}>\${tComp ? ' ' + tComp : ''} \${Math.round(tr.width)}×\${Math.round(tr.height)}\${tText ? ' "' + tText + '"' : ''}\`);
    lines.push(\`  selector: \${getSelector(toEl)}\`);

    if (fromContainsTo || toContainsFrom) {
      const outer = fromContainsTo ? fr : tr;
      const inner = fromContainsTo ? tr : fr;
      lines.push(\`inset-top: \${Math.round(inner.top - outer.top)}px\`);
      lines.push(\`inset-bottom: \${Math.round(outer.bottom - inner.bottom)}px\`);
      lines.push(\`inset-left: \${Math.round(inner.left - outer.left)}px\`);
      lines.push(\`inset-right: \${Math.round(outer.right - inner.right)}px\`);
    } else {
      const vertGap = fr.bottom <= tr.top ? tr.top - fr.bottom : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      const horizGap = fr.right <= tr.left ? tr.left - fr.right : tr.right <= fr.left ? fr.left - tr.right : 0;
      if (vertGap > 0) lines.push(\`vertical gap: \${Math.round(vertGap)}px (\${fr.bottom <= tr.top ? 'From above To' : 'To above From'})\`);
      if (horizGap > 0) lines.push(\`horizontal gap: \${Math.round(horizGap)}px\`);
      if (vertGap === 0 && horizGap === 0) lines.push('Elements overlap');
    }
    return lines.join('\\n');
  }

  // ─── Shortcut parser ──────────────────────────────────────────────────────
  function matchesActivate(e) {
    const parts = ACTIVATE.toLowerCase().split('+');
    const needCtrl = parts.includes('ctrl');
    const needAlt = parts.includes('alt');
    const needShift = parts.includes('shift');
    const needMeta = parts.includes('meta') || parts.includes('cmd');
    const key = parts.find(p => !['ctrl','alt','shift','meta','cmd'].includes(p));
    if (needCtrl !== e.ctrlKey) return false;
    if (needAlt !== e.altKey) return false;
    if (needShift !== e.shiftKey) return false;
    if (needMeta !== e.metaKey) return false;
    if (!key) return false;
    const eKey = e.key.toLowerCase();
    return eKey === key || eKey === '.' && key === 'period';
  }

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  function onMouseMove(e) {
    if (!fiActive) return;
    const target = e.target;
    if (!target || target === pill || pill.contains(target)) return;
    if (target === tooltip || tooltip.contains(target)) return;

    lastHovered = target;

    if (measureMode) {
      if (pinEl && pinEl !== target) {
        const text = measureBetween(pinEl, target);
        tooltip.textContent = text;
        positionTooltip(e.clientX, e.clientY);
      } else {
        const text = measureToNeighbor(target);
        tooltip.textContent = text;
        positionTooltip(e.clientX, e.clientY);
      }
    } else {
      clearMeasureOverlay();
      const text = buildInfo(target);
      tooltip.textContent = text;
      positionTooltip(e.clientX, e.clientY);
    }
  }

  // ─── Keyboard handlers ────────────────────────────────────────────────────
  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    // Activate toggle — always listen
    if (matchesActivate(e)) {
      e.preventDefault();
      if (fiActive) deactivate(); else activate();
      return;
    }

    if (!fiActive) return;

    // Option tap to toggle measure mode
    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      optionHeld = true;
      return;
    }

    // Cmd+C to copy
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
      if (!lastHovered) return;
      let text;
      if (measureMode && pinEl && lastHovered !== pinEl) {
        text = buildMeasureCopyText(pinEl, lastHovered);
      } else {
        text = buildCopyText(lastHovered);
      }
      navigator.clipboard.writeText(text).catch(() => {});
      e.preventDefault();
      return;
    }

    if (isInputFocused()) return;

    // M key — pin element in measure mode
    if (e.key === 'm' || e.key === 'M') {
      if (!measureMode || !lastHovered) return;
      if (pinEl) {
        clearPin();
      } else {
        pinEl = lastHovered;
        pinHighlight = highlightEl(pinEl, '#9b59b6');
        pillText.style.visibility = 'visible';
        pillText.textContent = 'Pinned · hover another element · Cmd+C → copy · Esc → clear';
        pill.style.maxWidth = '600px';
        pillClose.style.visibility = 'visible';
      }
      return;
    }

    // Escape cascade
    if (e.key === 'Escape') {
      if (pinEl) {
        clearPin();
        clearMeasureOverlay();
        hideTooltip();
        collapsePill();
      } else {
        deactivate();
      }
      return;
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (!fiActive) return;
    if (e.key === 'Alt' && optionHeld) {
      optionHeld = false;
      measureMode = !measureMode;
      clearMeasureOverlay();
      if (!pinEl) clearPin();
      hideTooltip();
      flashMode();
    }
  }, true);

  // Attach mouse listener
  document.addEventListener('mousemove', onMouseMove, { passive: true });

  console.log('%c⚡ Inspekt active — Ctrl+Option+. to toggle', 'color:#aaa;font-size:11px;');
})();`;
}
