import type { SpecterOptions } from './index.js';

export function getClientScript(options: SpecterOptions): string {
  const activateShortcut = options.shortcuts?.activate ?? 'ctrl+alt+z';
  return `(function() {
  'use strict';
  if (window.__specter) return; window.__specter = true;

  // ─── State ────────────────────────────────────────────────────────────────
  let fiActive = false;
  let measureMode = false;
  let pinEl = null;
  let lastHovered = null;
  let optionHeld = false;
  const selectedEls = [];
  const selectedBadges = [];

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

  // Measure overlay
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
    if (selectedEls.length === 0 && !pinEl) collapsePill();
  });

  function expandPill(text) {
    pill.style.maxWidth = '700px';
    pillText.style.visibility = 'visible';
    pillClose.style.visibility = 'visible';
    if (text) {
      pillText.textContent = text;
      return;
    }
    if (selectedEls.length > 0) {
      pillText.textContent = \`\${selectedEls.length} selected · Cmd+C → copy all · Esc → clear\`;
    } else if (measureMode) {
      pillText.textContent = 'Measure · hover → distances · M → pin · Cmd+C → copy · Option → toggle mode';
    } else {
      pillText.textContent = 'Properties · hover → inspect · P → pick · Cmd+C → copy · Option → measure mode';
    }
  }

  function collapsePill() {
    pill.style.maxWidth = '32px';
    pillText.style.visibility = 'hidden';
    pillClose.style.visibility = 'hidden';
  }

  function updatePillForSelection() {
    if (selectedEls.length > 0) {
      expandPill();
    } else if (!pill.matches(':hover')) {
      collapsePill();
    }
  }

  function flashMode() {
    const text = measureMode ? '⬡ Measure mode' : '◉ Properties mode';
    expandPill(text);
    setTimeout(() => {
      if (!pill.matches(':hover') && selectedEls.length === 0 && !pinEl) collapsePill();
      else if (selectedEls.length > 0 || pinEl) expandPill();
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
    optionHeld = false;
    lastHovered = null;
    clearSelection();
    clearPin();
    pill.style.display = 'none';
    hideTooltip();
    clearMeasureOverlay();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function hideTooltip() { tooltip.style.display = 'none'; }

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
    if (!m) return { hex: str, alpha: 1 };
    const [, r, g, b, a = '1'] = m;
    return { hex: toHex(r, g, b), alpha: parseFloat(a) };
  }

  function colorLabel(str) {
    const c = parseColor(str);
    if (!c) return null;
    if (c.alpha < 1) return \`\${c.hex} (\${Math.round(c.alpha * 100)}% opacity)\`;
    return c.hex;
  }

  function getComponentName(el) {
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
          if (rule.type !== 1) continue;
          const sel = rule.selectorText;
          if (!sel) continue;
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

  // ─── Build info ───────────────────────────────────────────────────────────
  function buildInfo(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const comp = getComponentName(el);
    const dataStyle = el.dataset?.style;
    const lines = [];

    let header = \`<\${tag}>\`;
    if (comp) header += \` \${comp}\`;
    if (dataStyle) header += \` [\${dataStyle}]\`;
    header += \` \${Math.round(rect.width)}×\${Math.round(rect.height)}\`;
    lines.push(header);

    const text = el.textContent?.trim().slice(0, 40);
    if (text) lines.push(\`"\${text}\${el.textContent.trim().length > 40 ? '…' : ''}"\`);

    const ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    lines.push(\`font: \${ff} \${cs.fontWeight} \${cs.fontSize}/\${cs.lineHeight}\`);

    const color = colorLabel(cs.color);
    if (color) lines.push(\`color: \${color}\`);

    const bg = colorLabel(cs.backgroundColor);
    if (bg) lines.push(\`bg: \${bg}\`);

    const [pt, pr, pb, pl] = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    if ([pt, pr, pb, pl].some(v => v !== '0px')) lines.push(\`padding: \${pt} \${pr} \${pb} \${pl}\`);

    const [mt, mr, mb, ml] = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft];
    if ([mt, mr, mb, ml].some(v => v !== '0px')) lines.push(\`margin: \${mt} \${mr} \${mb} \${ml}\`);

    if (cs.borderRadius && cs.borderRadius !== '0px') lines.push(\`radius: \${cs.borderRadius}\`);

    const disp = cs.display;
    if (['flex','grid','inline-flex','inline-grid'].includes(disp)) {
      let d = \`display: \${disp}\`;
      if (cs.gap && cs.gap !== 'normal') d += \`  gap: \${cs.gap}\`;
      if (disp.includes('flex') && cs.flexDirection !== 'row') d += \`  dir: \${cs.flexDirection}\`;
      lines.push(d);
    }

    return lines.join('\\n');
  }

  function buildCopyText(el) {
    const info = buildInfo(el);
    const rules = getMatchingRules(el);
    let out = \`[Specter]\\n\${info}\\n  selector: \${getSelector(el)}\`;
    if (rules.length) out += \`\\n\\n--- CSS Rules ---\\n\${rules.join('\\n\\n')}\`;
    return out;
  }

  function buildMultiSelectCopyText() {
    return selectedEls.map((el, i) => {
      const info = buildInfo(el);
      const rules = getMatchingRules(el);
      let out = \`[Inspekt \${i + 1}/\${selectedEls.length}]\\n\${info}\\n  selector: \${getSelector(el)}\`;
      if (rules.length) out += \`\\n\\n--- CSS Rules ---\\n\${rules.join('\\n\\n')}\`;
      return out;
    }).join('\\n\\n' + '─'.repeat(40) + '\\n\\n');
  }

  // ─── Multi-select ─────────────────────────────────────────────────────────
  function makeBadge(el, index) {
    const rect = el.getBoundingClientRect();
    const badge = document.createElement('div');
    badge.textContent = String(index + 1);
    Object.assign(badge.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: '18px',
      height: '18px',
      background: '#9b59b6',
      color: '#fff',
      fontSize: '10px',
      fontWeight: '700',
      fontFamily: 'ui-monospace, monospace',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483644',
      pointerEvents: 'none',
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      transform: 'translate(-50%, -50%)',
    });
    document.body.appendChild(badge);
    return badge;
  }

  function rebuildBadges() {
    selectedBadges.forEach(b => b.remove());
    selectedBadges.length = 0;
    selectedEls.forEach((el, i) => {
      selectedBadges.push(makeBadge(el, i));
    });
  }

  function toggleSelection(el) {
    const idx = selectedEls.indexOf(el);
    if (idx >= 0) {
      selectedEls.splice(idx, 1);
    } else {
      selectedEls.push(el);
    }
    rebuildBadges();
    updatePillForSelection();
  }

  function clearSelection() {
    selectedEls.length = 0;
    selectedBadges.forEach(b => b.remove());
    selectedBadges.length = 0;
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
      Object.assign(line.style, {
        left: Math.min(x1, x2) + 'px', top: (y1 - 0.5) + 'px',
        width: Math.abs(x2 - x1) + 'px', height: '1px',
      });
    } else {
      Object.assign(line.style, {
        left: (x1 - 0.5) + 'px', top: Math.min(y1, y2) + 'px',
        width: '1px', height: Math.abs(y2 - y1) + 'px',
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
        const cx = (Math.min(x1, x2) + Math.max(x1, x2)) / 2;
        lbl.style.left = cx + 'px';
        lbl.style.top = (y1 - 14) + 'px';
        lbl.style.transform = 'translateX(-50%)';
      } else {
        const cy = (Math.min(y1, y2) + Math.max(y1, y2)) / 2;
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
      left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
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
    let measured = false;
    let cur = targetEl.parentElement;

    for (let depth = 0; depth < 3 && cur && !measured; depth++) {
      const children = Array.from(cur.children).filter(c => c !== targetEl && c.offsetParent !== null);
      if (children.length === 0) { cur = cur.parentElement; continue; }

      const closest = { top: null, bottom: null, left: null, right: null };
      const gaps = { top: Infinity, bottom: Infinity, left: Infinity, right: Infinity };

      for (const sib of children) {
        const sr = sib.getBoundingClientRect();
        if (sr.bottom <= tr.top) {
          const g = tr.top - sr.bottom;
          if (g < gaps.top) { gaps.top = g; closest.top = sib; }
        }
        if (sr.top >= tr.bottom) {
          const g = sr.top - tr.bottom;
          if (g < gaps.bottom) { gaps.bottom = g; closest.bottom = sib; }
        }
        if (sr.right <= tr.left) {
          const g = tr.left - sr.right;
          if (g < gaps.left) { gaps.left = g; closest.left = sib; }
        }
        if (sr.left >= tr.right) {
          const g = sr.left - tr.right;
          if (g < gaps.right) { gaps.right = g; closest.right = sib; }
        }
      }

      if (closest.top || closest.bottom || closest.left || closest.right) {
        measured = true;
        const cx = (tr.left + tr.right) / 2;
        const cy = (tr.top + tr.bottom) / 2;
        if (closest.top) drawLine(cx, closest.top.getBoundingClientRect().bottom, cx, tr.top, Math.round(gaps.top) + 'px');
        if (closest.bottom) drawLine(cx, tr.bottom, cx, closest.bottom.getBoundingClientRect().top, Math.round(gaps.bottom) + 'px');
        if (closest.left) drawLine(closest.left.getBoundingClientRect().right, cy, tr.left, cy, Math.round(gaps.left) + 'px');
        if (closest.right) drawLine(tr.right, cy, closest.right.getBoundingClientRect().left, cy, Math.round(gaps.right) + 'px');
      } else {
        const pr = cur.getBoundingClientRect();
        const cx = (tr.left + tr.right) / 2;
        const cy = (tr.top + tr.bottom) / 2;
        const gT = tr.top - pr.top, gB = pr.bottom - tr.bottom;
        const gL = tr.left - pr.left, gR = pr.right - tr.right;
        if (gT > 0) drawLine(cx, pr.top, cx, tr.top, Math.round(gT) + 'px');
        if (gB > 0) drawLine(cx, tr.bottom, cx, pr.bottom, Math.round(gB) + 'px');
        if (gL > 0) drawLine(pr.left, cy, tr.left, cy, Math.round(gL) + 'px');
        if (gR > 0) drawLine(tr.right, cy, pr.right, cy, Math.round(gR) + 'px');
        measured = true;
      }

      cur = cur.parentElement;
    }

    measureOverlay.style.display = 'block';
    const tag = targetEl.tagName.toLowerCase();
    const rect = targetEl.getBoundingClientRect();
    return \`⬡ Measure  (M → pin element)\\n<\${tag}> \${Math.round(rect.width)}×\${Math.round(rect.height)}\`;
  }

  function measureBetween(fromEl, toEl) {
    clearMeasureOverlay();
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const fTag = fromEl.tagName.toLowerCase(), tTag = toEl.tagName.toLowerCase();
    const fComp = getComponentName(fromEl), tComp = getComponentName(toEl);

    const lines = ['⬡ Measure  (Cmd+C → copy)'];
    lines.push(\`From: <\${fTag}>\${fComp ? ' ' + fComp : ''} \${Math.round(fr.width)}×\${Math.round(fr.height)}\`);
    lines.push(\`To:   <\${tTag}>\${tComp ? ' ' + tComp : ''} \${Math.round(tr.width)}×\${Math.round(tr.height)}\`);

    const fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    const toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;

    if (fromContainsTo || toContainsFrom) {
      const outer = fromContainsTo ? fr : tr;
      const inner = fromContainsTo ? tr : fr;
      const cx = (inner.left + inner.right) / 2, cy = (inner.top + inner.bottom) / 2;
      const iT = inner.top - outer.top, iB = outer.bottom - inner.bottom;
      const iL = inner.left - outer.left, iR = outer.right - inner.right;
      if (iT > 0) drawLine(cx, outer.top, cx, inner.top, Math.round(iT) + 'px');
      if (iB > 0) drawLine(cx, inner.bottom, cx, outer.bottom, Math.round(iB) + 'px');
      if (iL > 0) drawLine(outer.left, cy, inner.left, cy, Math.round(iL) + 'px');
      if (iR > 0) drawLine(inner.right, cy, outer.right, cy, Math.round(iR) + 'px');
      lines.push(\`inset: \${Math.round(iT)}px \${Math.round(iR)}px \${Math.round(iB)}px \${Math.round(iL)}px\`);
    } else {
      const vGap = fr.bottom <= tr.top ? tr.top - fr.bottom : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      const hGap = fr.right <= tr.left ? tr.left - fr.right : tr.right <= fr.left ? fr.left - tr.right : 0;
      const cx = (fr.left + fr.right) / 2, cy = (fr.top + fr.bottom) / 2;
      if (vGap > 0) {
        const y1 = fr.bottom <= tr.top ? fr.bottom : tr.bottom;
        const y2 = fr.bottom <= tr.top ? tr.top : fr.top;
        drawLine(cx, y1, cx, y2, Math.round(vGap) + 'px');
        lines.push(\`vertical gap: \${Math.round(vGap)}px (\${fr.bottom <= tr.top ? 'From above To' : 'To above From'})\`);
      }
      if (hGap > 0) {
        const x1 = fr.right <= tr.left ? fr.right : tr.right;
        const x2 = fr.right <= tr.left ? tr.left : fr.left;
        drawLine(x1, cy, x2, cy, Math.round(hGap) + 'px');
        lines.push(\`horizontal gap: \${Math.round(hGap)}px\`);
      }
      if (vGap === 0 && hGap === 0) lines.push('Elements overlap');
    }

    measureOverlay.style.display = 'block';
    return lines.join('\\n');
  }

  function buildMeasureCopyText(fromEl, toEl) {
    const fr = fromEl.getBoundingClientRect(), tr = toEl.getBoundingClientRect();
    const fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    const toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;
    const fTag = fromEl.tagName.toLowerCase(), tTag = toEl.tagName.toLowerCase();
    const fComp = getComponentName(fromEl), tComp = getComponentName(toEl);
    const fText = fromEl.textContent?.trim().slice(0, 40);
    const tText = toEl.textContent?.trim().slice(0, 40);

    const lines = ['[Inspekt Measure]'];
    lines.push(\`From: <\${fTag}>\${fComp ? ' ' + fComp : ''} \${Math.round(fr.width)}×\${Math.round(fr.height)}\${fText ? ' "' + fText + '"' : ''}\`);
    lines.push(\`  selector: \${getSelector(fromEl)}\`);
    lines.push(\`To:   <\${tTag}>\${tComp ? ' ' + tComp : ''} \${Math.round(tr.width)}×\${Math.round(tr.height)}\${tText ? ' "' + tText + '"' : ''}\`);
    lines.push(\`  selector: \${getSelector(toEl)}\`);

    if (fromContainsTo || toContainsFrom) {
      const outer = fromContainsTo ? fr : tr, inner = fromContainsTo ? tr : fr;
      lines.push(\`inset: \${Math.round(inner.top - outer.top)}px \${Math.round(outer.right - inner.right)}px \${Math.round(outer.bottom - inner.bottom)}px \${Math.round(inner.left - outer.left)}px\`);
    } else {
      const vGap = fr.bottom <= tr.top ? tr.top - fr.bottom : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      const hGap = fr.right <= tr.left ? tr.left - fr.right : tr.right <= fr.left ? fr.left - tr.right : 0;
      if (vGap > 0) lines.push(\`vertical gap: \${Math.round(vGap)}px (\${fr.bottom <= tr.top ? 'From above To' : 'To above From'})\`);
      if (hGap > 0) lines.push(\`horizontal gap: \${Math.round(hGap)}px\`);
      if (vGap === 0 && hGap === 0) lines.push('Elements overlap');
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
    const eCode = e.code.toLowerCase();
    return eKey === key || eCode === \`key\${key}\` || (key === 'period' && (eKey === '.' || eCode === 'period'));
  }

  // ─── Mouse ────────────────────────────────────────────────────────────────
  function onMouseMove(e) {
    if (!fiActive) return;
    const target = e.target;
    if (!target || target === pill || pill.contains(target)) return;
    if (target === tooltip || tooltip.contains(target)) return;

    lastHovered = target;

    if (measureMode) {
      const text = (pinEl && pinEl !== target)
        ? measureBetween(pinEl, target)
        : measureToNeighbor(target);
      tooltip.textContent = text;
      positionTooltip(e.clientX, e.clientY);
    } else {
      clearMeasureOverlay();
      tooltip.textContent = buildInfo(target);
      positionTooltip(e.clientX, e.clientY);
    }
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function isInputFocused() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  document.addEventListener('keydown', (e) => {
    if (matchesActivate(e)) {
      e.preventDefault();
      if (fiActive) deactivate(); else activate();
      return;
    }

    if (!fiActive) return;

    // Option tap (keydown only — actual toggle fires on keyup)
    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      optionHeld = true;
      return;
    }

    // Cmd+C — copy
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      let text;
      if (selectedEls.length > 0) {
        text = buildMultiSelectCopyText();
      } else if (measureMode && pinEl && lastHovered && lastHovered !== pinEl) {
        text = buildMeasureCopyText(pinEl, lastHovered);
      } else if (lastHovered) {
        text = buildCopyText(lastHovered);
      }
      if (text) navigator.clipboard.writeText(text).catch(() => {});
      return;
    }

    if (isInputFocused()) return;

    // P — pick/unpick element (multi-select), Properties mode only
    if (e.key === 'p' || e.key === 'P') {
      if (measureMode || !lastHovered) return;
      toggleSelection(lastHovered);
      return;
    }

    // M — pin element for measure-from, Measure mode only
    if (e.key === 'm' || e.key === 'M') {
      if (!measureMode || !lastHovered) return;
      if (pinEl) {
        clearPin();
        collapsePill();
      } else {
        pinEl = lastHovered;
        pinHighlight = highlightEl(pinEl, '#9b59b6');
        expandPill('Pinned · hover another element · Cmd+C → copy · Esc → clear');
      }
      return;
    }

    // Escape cascade: pin → selection → exit
    if (e.key === 'Escape') {
      if (pinEl) {
        clearPin();
        clearMeasureOverlay();
        hideTooltip();
        updatePillForSelection();
      } else if (selectedEls.length > 0) {
        clearSelection();
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
      if (!measureMode) clearPin();
      hideTooltip();
      flashMode();
    }
  }, true);

  document.addEventListener('mousemove', onMouseMove, { passive: true });

  console.log('%c👻 Specter — Ctrl+Option+Z to toggle', 'color:#aaa;font-size:11px;');
})();`;
}
