import type { SpecterOptions } from './index.js';

export function getClientScript(options: SpecterOptions): string {
  const activateShortcut = options.shortcuts?.activate ?? 'ctrl+alt+z';
  return `(function() {
  'use strict';
  if (window.__specter) return; window.__specter = true;

  // ─── Constants ──────────────────────────────────────────────────────────────
  var PURPLE = '#AD24D3';
  var RED = '#ED3E61';
  var TIP_BG = '#292B32';
  var GREEN = '#22C55E';
  var LABEL = '#8B8D94';
  var MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
  var ZAP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
  var ACTIVATE = ${JSON.stringify(activateShortcut)};

  // ─── State ────────────────────────────────────────────────────────────────
  var fiActive = false;
  var measureMode = false;
  var pinEl = null;
  var pinHighlight = null;
  var lastHovered = null;
  var optionHeld = false;
  var pillExpanded = false;
  var sideRight = false;
  var outlinedEl = null;
  var prevOutline = '';
  var measureHL = null;
  var copiedTimer = null;
  var flashTimer = null;
  var lastMouse = { x: 0, y: 0 };
  var selectedEls = [];
  var selectedBadges = [];

  // ─── Tooltip ──────────────────────────────────────────────────────────────
  var tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'fixed',
    zIndex: '2147483646',
    pointerEvents: 'none',
    fontFamily: MONO,
    fontSize: '13px',
    lineHeight: '20px',
    background: TIP_BG,
    color: '#FFFFFF',
    padding: '24px',
    borderRadius: '8px',
    maxWidth: '480px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    display: 'none',
  });
  document.body.appendChild(tooltip);

  // Measure overlay
  var measureOverlay = document.createElement('div');
  Object.assign(measureOverlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483645',
    pointerEvents: 'none',
    display: 'none',
  });
  document.body.appendChild(measureOverlay);

  // ─── Pill ─────────────────────────────────────────────────────────────────
  var pillWrap = document.createElement('div');
  Object.assign(pillWrap.style, {
    position: 'fixed',
    bottom: '4px',
    left: '4px',
    zIndex: '2147483647',
    padding: '12px',
    display: 'none',
    boxSizing: 'border-box',
  });

  var pill = document.createElement('div');
  Object.assign(pill.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: PURPLE,
    borderRadius: '16px',
    height: '32px',
    padding: '0 9px',
    fontFamily: MONO,
    fontSize: '11px',
    fontWeight: '400',
    color: '#fff',
    cursor: 'default',
    userSelect: 'none',
    boxShadow: '0 4px 12px rgba(173,36,211,0.4)',
    overflow: 'hidden',
    maxWidth: '32px',
    transition: 'max-width 0.2s ease',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  });

  var iconBtn = document.createElement('div');
  Object.assign(iconBtn.style, {
    position: 'relative',
    width: '14px',
    height: '14px',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  var zapEl = document.createElement('span');
  zapEl.innerHTML = ZAP;
  Object.assign(zapEl.style, {
    position: 'absolute',
    display: 'flex',
    transition: 'transform 0.4s ease, opacity 0.2s ease',
  });

  var closeEl = document.createElement('span');
  closeEl.textContent = '×';
  Object.assign(closeEl.style, {
    position: 'absolute',
    fontSize: '17px',
    lineHeight: '1',
    opacity: '0',
    transition: 'opacity 0.2s ease',
    cursor: 'pointer',
  });
  closeEl.addEventListener('click', function (e) { e.stopPropagation(); deactivate(); });

  iconBtn.appendChild(zapEl);
  iconBtn.appendChild(closeEl);

  var pillText = document.createElement('span');
  Object.assign(pillText.style, { display: 'none', color: '#f3d9fb' });

  var chevron = document.createElement('span');
  chevron.textContent = '›';
  chevron.title = 'Move to other side';
  Object.assign(chevron.style, {
    display: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '14px',
    flexShrink: '0',
    padding: '0 2px',
    opacity: '0.8',
  });
  chevron.addEventListener('click', function (e) { e.stopPropagation(); moveSide(); });

  pill.appendChild(iconBtn);
  pill.appendChild(pillText);
  pill.appendChild(chevron);
  pillWrap.appendChild(pill);
  document.body.appendChild(pillWrap);

  pillWrap.addEventListener('mouseenter', function () {
    clearMeasureOverlay();
    clearMeasureTargetHL();
    hideTooltip();
    expandPill();
    zapEl.style.transform = 'rotate(360deg)';
    zapEl.style.opacity = '0';
    closeEl.style.opacity = '1';
  });
  pillWrap.addEventListener('mouseleave', function () {
    if (selectedEls.length === 0 && !pinEl) collapsePill();
    zapEl.style.transform = 'rotate(0deg)';
    zapEl.style.opacity = '1';
    closeEl.style.opacity = '0';
  });

  function moveSide() {
    sideRight = !sideRight;
    if (sideRight) {
      pillWrap.style.left = 'auto';
      pillWrap.style.right = '4px';
      chevron.textContent = '‹';
    } else {
      pillWrap.style.right = 'auto';
      pillWrap.style.left = '4px';
      chevron.textContent = '›';
    }
  }

  function expandPill(text) {
    pill.style.maxWidth = '760px';
    pillText.style.display = 'inline';
    chevron.style.display = 'inline';
    pillExpanded = true;
    if (text) { pillText.textContent = text; return; }
    if (selectedEls.length > 0) {
      pillText.textContent = selectedEls.length + ' selected · Cmd+C copy all · Esc clear';
    } else if (measureMode) {
      pillText.textContent = 'Measure · hover distances · M pin · Cmd+C copy · Option toggle';
    } else {
      pillText.textContent = 'Properties · hover inspect · P pick · Cmd+C copy · Option measure';
    }
  }

  function collapsePill() {
    pill.style.maxWidth = '32px';
    pillText.style.display = 'none';
    chevron.style.display = 'none';
    pillExpanded = false;
  }

  function flashMode() {
    if (pillExpanded && pillWrap.matches(':hover')) return;
    var text = measureMode ? '⬡ Measure mode' : '◉ Properties mode';
    expandPill(text);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      if (!pillWrap.matches(':hover') && selectedEls.length === 0 && !pinEl) collapsePill();
      else expandPill();
    }, 1200);
  }

  // ─── Activate / Deactivate ────────────────────────────────────────────────
  function activate() {
    fiActive = true;
    measureMode = false;
    pillWrap.style.display = 'block';
    document.body.style.cursor = 'crosshair';
    collapsePill();
  }

  function deactivate() {
    fiActive = false;
    measureMode = false;
    optionHeld = false;
    lastHovered = null;
    clearSelection();
    clearPin();
    clearHoverOutline();
    clearMeasureTargetHL();
    pillWrap.style.display = 'none';
    document.body.style.cursor = '';
    hideTooltip();
    clearMeasureOverlay();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function hideTooltip() { tooltip.style.display = 'none'; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function positionTooltip(x, y) {
    tooltip.style.display = 'block';
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 16;
    var left = x + 16;
    var top = y + 16;
    if (left + tw > vw - margin) left = x - tw - 16;
    if (top + th > vh - margin) top = y - th - 16;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join('');
  }

  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { hex: toHex(m[1], m[2], m[3]), alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }

  function colorLabel(str) {
    var c = parseColor(str);
    if (!c) return null;
    if (c.alpha < 1) return c.hex + ' (' + Math.round(c.alpha * 100) + '% opacity)';
    return c.hex;
  }

  function colorObj(str) {
    var c = parseColor(str);
    if (!c) return null;
    return { raw: str, hex: c.hex, alpha: c.alpha, label: colorLabel(str) };
  }

  function edge(t, r, b, l) {
    if ([t, r, b, l].every(function (v) { return v === '0px'; })) return null;
    return { value: t + ' ' + r + ' ' + b + ' ' + l };
  }

  function weightName(w) {
    var m = { '100': 'Thin', '200': 'ExtraLight', '300': 'Light', '400': 'Regular', '500': 'Medium', '600': 'Semibold', '700': 'Bold', '800': 'ExtraBold', '900': 'Black', 'normal': 'Regular', 'bold': 'Bold' };
    return m[w] || w;
  }

  function swatch(hex) {
    return '<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + hex + ';margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.2)"></span>';
  }

  function getComponentName(el) {
    for (var key in el) {
      if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
        var fiber = el[key];
        while (fiber) {
          var name = (fiber.type && (fiber.type.displayName || fiber.type.name));
          if (name && name.length > 3 && /^[A-Z]/.test(name)) return name;
          fiber = fiber.return;
        }
      }
    }
    if (el.__vueParentComponent) {
      var vname = el.__vueParentComponent.type && (el.__vueParentComponent.type.name || el.__vueParentComponent.type.__name);
      if (vname && vname.length > 3) return vname;
    }
    return null;
  }

  function getMatchingRules(el) {
    var results = [];
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        var sheet = document.styleSheets[s];
        var rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var r = 0; r < rules.length; r++) {
          var rule = rules[r];
          if (rule.type !== 1) continue;
          var sel = rule.selectorText;
          if (!sel) continue;
          if (/^[*,]|^:root|^html|^body$|^::before|^::after/.test(sel.trim())) continue;
          try {
            if (el.matches(sel)) {
              var props = [];
              for (var i = 0; i < rule.style.length; i++) {
                var prop = rule.style[i];
                var val = rule.style.getPropertyValue(prop);
                if (val) props.push('  ' + prop + ': ' + val + ';');
              }
              if (props.length) results.push(sel + ' {\\n' + props.join('\\n') + '\\n}');
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return results;
  }

  function getSelector(el) {
    var parts = [];
    var cur = el;
    for (var i = 0; i < 3 && cur && cur !== document.body; i++) {
      var part = cur.tagName.toLowerCase();
      if (cur.id) { part += '#' + cur.id; parts.unshift(part); break; }
      var cls = Array.prototype.slice.call(cur.classList).filter(function (c) { return c.indexOf('__specter') !== 0; });
      if (cls.length) {
        part += '.' + cls.slice(0, 2).join('.');
      } else if (cur.parentElement) {
        var sameTag = Array.prototype.slice.call(cur.parentElement.children).filter(function (c) { return c.tagName === cur.tagName; });
        if (sameTag.length > 1) {
          part += ':nth-child(' + (Array.prototype.indexOf.call(cur.parentElement.children, cur) + 1) + ')';
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // ─── Structured data model ──────────────────────────────────────────────────
  function buildInfo(el) {
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    var raw = el.textContent ? el.textContent.trim() : '';
    return {
      el: el,
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.prototype.slice.call(el.classList).filter(function (c) { return c.indexOf('__specter') !== 0; }),
      component: getComponentName(el),
      styleKey: el.dataset ? el.dataset.style : null,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      text: raw.slice(0, 40),
      textTrunc: raw.length > 40,
      font: { family: ff, weight: cs.fontWeight, size: cs.fontSize, lineHeight: cs.lineHeight },
      color: colorObj(cs.color),
      bg: colorObj(cs.backgroundColor),
      padding: edge(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft),
      margin: edge(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft),
      radius: (cs.borderRadius && cs.borderRadius !== '0px') ? cs.borderRadius : null,
      display: ['flex', 'grid', 'inline-flex', 'inline-grid'].indexOf(cs.display) >= 0 ? cs.display : null,
      gap: (cs.gap && cs.gap !== 'normal') ? cs.gap : null,
      flexDir: (cs.display.indexOf('flex') >= 0 && cs.flexDirection !== 'row') ? cs.flexDirection : null,
      rules: getMatchingRules(el),
    };
  }

  function row(label, val) {
    return '<div style="display:flex;margin-bottom:8px"><span style="color:' + LABEL + ';min-width:76px;flex-shrink:0">' + label + '</span><span style="color:#fff;word-break:break-word">' + val + '</span></div>';
  }

  function buildHumanDisplay(data) {
    var h = '';
    var id = '<span style="color:#fff">&lt;' + data.tag + '&gt;</span>';
    if (data.id) id += '<span style="color:#F0B86E">#' + esc(data.id) + '</span>';
    if (data.classes.length) id += '<span style="color:#5FD3C0">.' + data.classes.map(esc).join('.') + '</span>';
    if (data.component) id += ' <span style="color:#E0A3F5;font-weight:600">' + esc(data.component) + '</span>';
    if (data.styleKey) id += ' <span style="color:' + LABEL + '">[' + esc(data.styleKey) + ']</span>';
    id += ' <span style="color:' + LABEL + '">' + data.width + '×' + data.height + '</span>';
    h += '<div style="margin-bottom:8px">' + id + '</div>';
    if (data.text) h += '<div style="color:' + LABEL + ';font-style:italic;margin-bottom:8px">"' + esc(data.text) + (data.textTrunc ? '…' : '') + '"</div>';
    h += '<div style="height:8px"></div>';
    h += row('Font', esc(data.font.family) + ' · ' + weightName(data.font.weight) + ' · ' + data.font.size + '/' + data.font.lineHeight);
    if (data.color) h += row('Color', swatch(data.color.hex) + data.color.label);
    if (data.bg) h += row('Bg', swatch(data.bg.hex) + data.bg.label);
    if (data.padding) h += row('Padding', data.padding.value);
    if (data.margin) h += row('Margin', data.margin.value);
    if (data.radius) h += row('Radius', data.radius);
    if (data.display) {
      var d = data.display;
      if (data.gap) d += ' · gap ' + data.gap;
      if (data.flexDir) d += ' · ' + data.flexDir;
      h += row('Display', d);
    }
    return h;
  }

  function buildLLMClipboard(data) {
    var lines = ['[Specter]'];
    var head = '<' + data.tag + '>';
    if (data.id) head += '#' + data.id;
    if (data.classes.length) head += '.' + data.classes.join('.');
    if (data.component) head += ' ' + data.component;
    if (data.styleKey) head += ' [' + data.styleKey + ']';
    head += ' ' + data.width + '×' + data.height;
    lines.push(head);
    if (data.text) lines.push('"' + data.text + (data.textTrunc ? '…' : '') + '"');
    lines.push('font: ' + data.font.family + ' ' + data.font.weight + ' ' + data.font.size + '/' + data.font.lineHeight);
    if (data.color) lines.push('color: ' + data.color.label);
    if (data.bg) lines.push('bg: ' + data.bg.label);
    if (data.padding) lines.push('padding: ' + data.padding.value);
    if (data.margin) lines.push('margin: ' + data.margin.value);
    if (data.radius) lines.push('radius: ' + data.radius);
    if (data.display) {
      var d = 'display: ' + data.display;
      if (data.gap) d += '  gap: ' + data.gap;
      if (data.flexDir) d += '  dir: ' + data.flexDir;
      lines.push(d);
    }
    lines.push('selector: ' + getSelector(data.el));
    var out = lines.join('\\n');
    if (data.rules && data.rules.length) out += '\\n\\n--- CSS Rules ---\\n' + data.rules.join('\\n\\n');
    return out;
  }

  function buildMultiSelectCopyText() {
    return selectedEls.map(function (el, i) {
      var body = buildLLMClipboard(buildInfo(el));
      return body.replace('[Specter]', '[Specter ' + (i + 1) + '/' + selectedEls.length + ']');
    }).join('\\n\\n' + Array(41).join('─') + '\\n\\n');
  }

  function linesToHTML(str) {
    return str.split('\\n').map(function (l) {
      return '<div style="margin-bottom:4px;color:#fff">' + esc(l) + '</div>';
    }).join('');
  }

  // ─── Hover outline ──────────────────────────────────────────────────────────
  function setHoverOutline(el) {
    if (outlinedEl === el) return;
    clearHoverOutline();
    if (!el) return;
    outlinedEl = el;
    prevOutline = el.style.outline;
    el.style.outline = '2px solid ' + PURPLE;
    el.style.outlineOffset = '-1px';
  }

  function clearHoverOutline() {
    if (outlinedEl) {
      outlinedEl.style.outline = prevOutline;
      outlinedEl = null;
    }
  }

  // ─── Copied feedback ────────────────────────────────────────────────────────
  function showCopied() {
    tooltip.innerHTML = '<div style="color:' + GREEN + ';font-weight:600;display:flex;align-items:center;gap:6px"><span>✓</span><span>Copied!</span></div>';
    tooltip.style.display = 'block';
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(function () {
      if (fiActive && lastHovered) reRenderTooltip();
      else hideTooltip();
    }, 1200);
  }

  function reRenderTooltip() {
    if (measureMode) {
      var text = (pinEl && pinEl !== lastHovered) ? measureBetween(pinEl, lastHovered) : measureToNeighbor(lastHovered);
      tooltip.innerHTML = linesToHTML(text);
    } else {
      tooltip.innerHTML = buildHumanDisplay(buildInfo(lastHovered));
    }
    positionTooltip(lastMouse.x, lastMouse.y);
  }

  // ─── Multi-select ─────────────────────────────────────────────────────────
  function makeBadge(el, index) {
    var rect = el.getBoundingClientRect();
    var badge = document.createElement('div');
    badge.textContent = String(index + 1);
    Object.assign(badge.style, {
      position: 'fixed',
      left: (rect.left - 4) + 'px',
      top: (rect.top - 4) + 'px',
      width: '20px',
      height: '20px',
      background: PURPLE,
      color: '#fff',
      fontSize: '11px',
      fontWeight: '700',
      fontFamily: MONO,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483644',
      pointerEvents: 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(badge);
    return badge;
  }

  function rebuildBadges() {
    selectedBadges.forEach(function (b) { b.remove(); });
    selectedBadges.length = 0;
    selectedEls.forEach(function (el, i) {
      selectedBadges.push(makeBadge(el, i));
    });
  }

  function toggleSelection(el) {
    var idx = selectedEls.indexOf(el);
    if (idx >= 0) {
      selectedEls.splice(idx, 1);
      el.style.outline = '';
    } else {
      selectedEls.push(el);
      el.style.outline = '2px solid ' + PURPLE;
      el.style.outlineOffset = '-1px';
    }
    rebuildBadges();
    updatePillForSelection();
  }

  function clearSelection() {
    selectedEls.forEach(function (el) { el.style.outline = ''; });
    selectedEls.length = 0;
    selectedBadges.forEach(function (b) { b.remove(); });
    selectedBadges.length = 0;
  }

  function updatePillForSelection() {
    if (selectedEls.length > 0) expandPill();
    else if (!pillWrap.matches(':hover')) collapsePill();
  }

  // ─── Pin (measure) ──────────────────────────────────────────────────────────
  function setPin(el) {
    pinEl = el;
    updatePinHL();
  }

  function updatePinHL() {
    if (!pinEl) return;
    var r = pinEl.getBoundingClientRect();
    if (!pinHighlight) {
      pinHighlight = document.createElement('div');
      Object.assign(pinHighlight.style, {
        position: 'fixed',
        border: '2px dashed ' + RED,
        background: 'rgba(237,62,97,0.05)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: '2147483643',
      });
      document.body.appendChild(pinHighlight);
    }
    pinHighlight.style.left = r.left + 'px';
    pinHighlight.style.top = r.top + 'px';
    pinHighlight.style.width = r.width + 'px';
    pinHighlight.style.height = r.height + 'px';
  }

  function clearPin() {
    if (pinHighlight) { pinHighlight.remove(); pinHighlight = null; }
    pinEl = null;
  }

  function clearMeasureOverlay() {
    measureOverlay.innerHTML = '';
    measureOverlay.style.display = 'none';
  }

  function showMeasureTargetHL(el) {
    clearMeasureTargetHL();
    var r = el.getBoundingClientRect();
    measureHL = document.createElement('div');
    Object.assign(measureHL.style, {
      position: 'fixed',
      left: r.left + 'px',
      top: r.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
      background: 'rgba(173,36,211,0.08)',
      border: '1.5px solid ' + PURPLE,
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '2147483643',
    });
    document.body.appendChild(measureHL);
  }

  function clearMeasureTargetHL() {
    if (measureHL) { measureHL.remove(); measureHL = null; }
  }

  // ─── Measurement drawing ────────────────────────────────────────────────────
  function cap(x, y, mainHoriz) {
    var c = document.createElement('div');
    Object.assign(c.style, { position: 'absolute', background: RED, pointerEvents: 'none' });
    if (mainHoriz) {
      c.style.left = (x - 0.5) + 'px';
      c.style.top = (y - 4) + 'px';
      c.style.width = '1px';
      c.style.height = '8px';
    } else {
      c.style.left = (x - 4) + 'px';
      c.style.top = (y - 0.5) + 'px';
      c.style.width = '8px';
      c.style.height = '1px';
    }
    measureOverlay.appendChild(c);
  }

  function drawLine(x1, y1, x2, y2, label) {
    var isHoriz = Math.abs(y2 - y1) < 1;
    var line = document.createElement('div');
    Object.assign(line.style, { position: 'absolute', background: RED, pointerEvents: 'none' });
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
    cap(x1, y1, isHoriz);
    cap(x2, y2, isHoriz);

    if (label && label !== '0px') {
      var lbl = document.createElement('div');
      lbl.textContent = label;
      Object.assign(lbl.style, {
        position: 'absolute',
        background: RED,
        color: '#fff',
        fontSize: '10px',
        fontFamily: MONO,
        padding: '1px 4px',
        borderRadius: '3px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      });
      if (isHoriz) {
        var cxl = (Math.min(x1, x2) + Math.max(x1, x2)) / 2;
        lbl.style.left = cxl + 'px';
        lbl.style.top = (y1 - 16) + 'px';
        lbl.style.transform = 'translateX(-50%)';
      } else {
        var cyl = (Math.min(y1, y2) + Math.max(y1, y2)) / 2;
        lbl.style.left = (x1 + 6) + 'px';
        lbl.style.top = cyl + 'px';
        lbl.style.transform = 'translateY(-50%)';
      }
      measureOverlay.appendChild(lbl);
    }
  }

  // ─── Neighbor computation (parent-first w/ container fallback) ───────────────
  function edgeToAncestor(targetEl, tr, dir) {
    var cur = targetEl.parentElement;
    var ctx = 'parent';
    for (var i = 0; i < 4 && cur && cur !== document.body; i++) {
      var pr = cur.getBoundingClientRect();
      var gap;
      if (dir === 'top') gap = tr.top - pr.top;
      else if (dir === 'bottom') gap = pr.bottom - tr.bottom;
      else if (dir === 'left') gap = tr.left - pr.left;
      else gap = pr.right - tr.right;
      if (gap > 0.5) {
        var ed;
        if (dir === 'top') ed = pr.top;
        else if (dir === 'bottom') ed = pr.bottom;
        else if (dir === 'left') ed = pr.left;
        else ed = pr.right;
        return { gap: gap, ctx: ctx, edge: ed };
      }
      cur = cur.parentElement;
      ctx = 'container';
    }
    return null;
  }

  function computeNeighbors(targetEl, tr) {
    var out = { top: null, bottom: null, left: null, right: null };
    var parent = targetEl.parentElement;
    if (parent) {
      var sibs = Array.prototype.slice.call(parent.children).filter(function (c) { return c !== targetEl && c.offsetParent !== null; });
      sibs.forEach(function (sib) {
        var sr = sib.getBoundingClientRect();
        if (sr.bottom <= tr.top) { var g = tr.top - sr.bottom; if (!out.top || g < out.top.gap) out.top = { gap: g, ctx: 'sibling', edge: sr.bottom }; }
        if (sr.top >= tr.bottom) { var g2 = sr.top - tr.bottom; if (!out.bottom || g2 < out.bottom.gap) out.bottom = { gap: g2, ctx: 'sibling', edge: sr.top }; }
        if (sr.right <= tr.left) { var g3 = tr.left - sr.right; if (!out.left || g3 < out.left.gap) out.left = { gap: g3, ctx: 'sibling', edge: sr.right }; }
        if (sr.left >= tr.right) { var g4 = sr.left - tr.right; if (!out.right || g4 < out.right.gap) out.right = { gap: g4, ctx: 'sibling', edge: sr.left }; }
      });
    }
    ['top', 'bottom', 'left', 'right'].forEach(function (k) { if (!out[k]) out[k] = edgeToAncestor(targetEl, tr, k); });
    return out;
  }

  function measureToNeighbor(targetEl) {
    clearMeasureOverlay();
    var tr = targetEl.getBoundingClientRect();
    var dirs = computeNeighbors(targetEl, tr);
    var cx = (tr.left + tr.right) / 2;
    var cy = (tr.top + tr.bottom) / 2;
    if (dirs.top) drawLine(cx, dirs.top.edge, cx, tr.top, Math.round(dirs.top.gap) + 'px');
    if (dirs.bottom) drawLine(cx, tr.bottom, cx, dirs.bottom.edge, Math.round(dirs.bottom.gap) + 'px');
    if (dirs.left) drawLine(dirs.left.edge, cy, tr.left, cy, Math.round(dirs.left.gap) + 'px');
    if (dirs.right) drawLine(tr.right, cy, dirs.right.edge, cy, Math.round(dirs.right.gap) + 'px');
    measureOverlay.style.display = 'block';
    var tag = targetEl.tagName.toLowerCase();
    var lines = ['⬡ Measure  (M pin · Cmd+C copy)', '<' + tag + '> ' + Math.round(tr.width) + '×' + Math.round(tr.height)];
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      if (dirs[k]) lines.push(k + ': ' + Math.round(dirs[k].gap) + 'px (to ' + dirs[k].ctx + ')');
    });
    return lines.join('\\n');
  }

  function buildNeighborCopyText(el) {
    var tr = el.getBoundingClientRect();
    var dirs = computeNeighbors(el, tr);
    var lines = ['[Specter Measure]', '<' + el.tagName.toLowerCase() + '> ' + Math.round(tr.width) + '×' + Math.round(tr.height), 'selector: ' + getSelector(el)];
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      if (dirs[k]) lines.push(k + ': ' + Math.round(dirs[k].gap) + 'px (to ' + dirs[k].ctx + ')');
    });
    return lines.join('\\n');
  }

  function measureBetween(fromEl, toEl) {
    clearMeasureOverlay();
    var fr = fromEl.getBoundingClientRect();
    var tr = toEl.getBoundingClientRect();
    var fTag = fromEl.tagName.toLowerCase(), tTag = toEl.tagName.toLowerCase();
    var fComp = getComponentName(fromEl), tComp = getComponentName(toEl);

    var lines = ['⬡ Measure  (Cmd+C copy)'];
    lines.push('From: <' + fTag + '>' + (fComp ? ' ' + fComp : '') + ' ' + Math.round(fr.width) + '×' + Math.round(fr.height));
    lines.push('To:   <' + tTag + '>' + (tComp ? ' ' + tComp : '') + ' ' + Math.round(tr.width) + '×' + Math.round(tr.height));

    var fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    var toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;

    if (fromContainsTo || toContainsFrom) {
      var outer = fromContainsTo ? fr : tr;
      var inner = fromContainsTo ? tr : fr;
      var cx = (inner.left + inner.right) / 2, cy = (inner.top + inner.bottom) / 2;
      var iT = inner.top - outer.top, iB = outer.bottom - inner.bottom;
      var iL = inner.left - outer.left, iR = outer.right - inner.right;
      if (iT > 0) drawLine(cx, outer.top, cx, inner.top, Math.round(iT) + 'px');
      if (iB > 0) drawLine(cx, inner.bottom, cx, outer.bottom, Math.round(iB) + 'px');
      if (iL > 0) drawLine(outer.left, cy, inner.left, cy, Math.round(iL) + 'px');
      if (iR > 0) drawLine(inner.right, cy, outer.right, cy, Math.round(iR) + 'px');
      lines.push('inset: ' + Math.round(iT) + 'px ' + Math.round(iR) + 'px ' + Math.round(iB) + 'px ' + Math.round(iL) + 'px');
    } else {
      var vGap = fr.bottom <= tr.top ? tr.top - fr.bottom : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      var hGap = fr.right <= tr.left ? tr.left - fr.right : tr.right <= fr.left ? fr.left - tr.right : 0;
      var cx2 = (fr.left + fr.right) / 2, cy2 = (fr.top + fr.bottom) / 2;
      if (vGap > 0) {
        var y1 = fr.bottom <= tr.top ? fr.bottom : tr.bottom;
        var y2 = fr.bottom <= tr.top ? tr.top : fr.top;
        drawLine(cx2, y1, cx2, y2, Math.round(vGap) + 'px');
        lines.push('vertical gap: ' + Math.round(vGap) + 'px');
      }
      if (hGap > 0) {
        var x1 = fr.right <= tr.left ? fr.right : tr.right;
        var x2 = fr.right <= tr.left ? tr.left : fr.left;
        drawLine(x1, cy2, x2, cy2, Math.round(hGap) + 'px');
        lines.push('horizontal gap: ' + Math.round(hGap) + 'px');
      }
      if (vGap === 0 && hGap === 0) lines.push('Elements overlap');
    }

    measureOverlay.style.display = 'block';
    return lines.join('\\n');
  }

  function buildMeasureCopyText(fromEl, toEl) {
    var fr = fromEl.getBoundingClientRect(), tr = toEl.getBoundingClientRect();
    var fromContainsTo = fr.left <= tr.left && fr.top <= tr.top && fr.right >= tr.right && fr.bottom >= tr.bottom;
    var toContainsFrom = tr.left <= fr.left && tr.top <= fr.top && tr.right >= fr.right && tr.bottom >= fr.bottom;
    var fTag = fromEl.tagName.toLowerCase(), tTag = toEl.tagName.toLowerCase();
    var fComp = getComponentName(fromEl), tComp = getComponentName(toEl);

    var lines = ['[Specter Measure]'];
    lines.push('From: <' + fTag + '>' + (fComp ? ' ' + fComp : '') + ' ' + Math.round(fr.width) + '×' + Math.round(fr.height));
    lines.push('  selector: ' + getSelector(fromEl));
    lines.push('To:   <' + tTag + '>' + (tComp ? ' ' + tComp : '') + ' ' + Math.round(tr.width) + '×' + Math.round(tr.height));
    lines.push('  selector: ' + getSelector(toEl));

    if (fromContainsTo || toContainsFrom) {
      var outer = fromContainsTo ? fr : tr, inner = fromContainsTo ? tr : fr;
      lines.push('inset: ' + Math.round(inner.top - outer.top) + 'px ' + Math.round(outer.right - inner.right) + 'px ' + Math.round(outer.bottom - inner.bottom) + 'px ' + Math.round(inner.left - outer.left) + 'px');
    } else {
      var vGap = fr.bottom <= tr.top ? tr.top - fr.bottom : tr.bottom <= fr.top ? fr.top - tr.bottom : 0;
      var hGap = fr.right <= tr.left ? tr.left - fr.right : tr.right <= fr.left ? fr.left - tr.right : 0;
      if (vGap > 0) lines.push('vertical gap: ' + Math.round(vGap) + 'px');
      if (hGap > 0) lines.push('horizontal gap: ' + Math.round(hGap) + 'px');
      if (vGap === 0 && hGap === 0) lines.push('Elements overlap');
    }
    return lines.join('\\n');
  }

  // ─── Shortcut parser ──────────────────────────────────────────────────────
  function matchesActivate(e) {
    var parts = ACTIVATE.toLowerCase().split('+');
    var needCtrl = parts.indexOf('ctrl') >= 0;
    var needAlt = parts.indexOf('alt') >= 0;
    var needShift = parts.indexOf('shift') >= 0;
    var needMeta = parts.indexOf('meta') >= 0 || parts.indexOf('cmd') >= 0;
    var key = parts.filter(function (p) { return ['ctrl', 'alt', 'shift', 'meta', 'cmd'].indexOf(p) < 0; })[0];
    if (needCtrl !== e.ctrlKey) return false;
    if (needAlt !== e.altKey) return false;
    if (needShift !== e.shiftKey) return false;
    if (needMeta !== e.metaKey) return false;
    if (!key) return false;
    var eKey = e.key.toLowerCase();
    var eCode = e.code.toLowerCase();
    return eKey === key || eCode === 'key' + key || (key === 'period' && (eKey === '.' || eCode === 'period'));
  }

  // ─── Mouse ────────────────────────────────────────────────────────────────
  function onMouseMove(e) {
    if (!fiActive) return;
    lastMouse.x = e.clientX; lastMouse.y = e.clientY;
    var target = e.target;
    if (!target || target === pillWrap || pillWrap.contains(target)) return;
    if (target === tooltip || tooltip.contains(target)) return;

    lastHovered = target;

    if (measureMode) {
      clearHoverOutline();
      showMeasureTargetHL(target);
      var text = (pinEl && pinEl !== target) ? measureBetween(pinEl, target) : measureToNeighbor(target);
      tooltip.innerHTML = linesToHTML(text);
      positionTooltip(e.clientX, e.clientY);
      if (pinEl) updatePinHL();
    } else {
      clearMeasureOverlay();
      clearMeasureTargetHL();
      setHoverOutline(target);
      tooltip.innerHTML = buildHumanDisplay(buildInfo(target));
      positionTooltip(e.clientX, e.clientY);
    }
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function isInputFocused() {
    var el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  document.addEventListener('keydown', function (e) {
    if (matchesActivate(e)) {
      e.preventDefault();
      if (fiActive) deactivate(); else activate();
      return;
    }

    if (!fiActive) return;

    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      optionHeld = true;
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      var text;
      if (selectedEls.length > 0) {
        text = buildMultiSelectCopyText();
      } else if (measureMode && pinEl && lastHovered && lastHovered !== pinEl) {
        text = buildMeasureCopyText(pinEl, lastHovered);
      } else if (measureMode && lastHovered) {
        text = buildNeighborCopyText(lastHovered);
      } else if (lastHovered) {
        text = buildLLMClipboard(buildInfo(lastHovered));
      }
      if (text) navigator.clipboard.writeText(text).then(showCopied).catch(function () {});
      return;
    }

    if (isInputFocused()) return;

    if (e.key === 'p' || e.key === 'P') {
      if (measureMode || !lastHovered) return;
      clearHoverOutline();
      toggleSelection(lastHovered);
      return;
    }

    if (e.key === 'm' || e.key === 'M') {
      if (!measureMode || !lastHovered) return;
      if (pinEl) {
        clearPin();
        collapsePill();
      } else {
        setPin(lastHovered);
        expandPill('Pinned · hover another element · Cmd+C copy · Esc clear');
      }
      return;
    }

    if (e.key === 'Escape') {
      if (pinEl) {
        clearPin();
        clearMeasureOverlay();
        hideTooltip();
        updatePillForSelection();
      } else {
        deactivate();
      }
      return;
    }
  }, true);

  document.addEventListener('keyup', function (e) {
    if (!fiActive) return;
    if (e.key === 'Alt' && optionHeld) {
      optionHeld = false;
      measureMode = !measureMode;
      clearMeasureOverlay();
      clearHoverOutline();
      clearMeasureTargetHL();
      if (!measureMode) clearPin();
      hideTooltip();
      flashMode();
    }
  }, true);

  document.addEventListener('mousemove', onMouseMove, { passive: true });

  window.__specterToggle = function() { if (fiActive) deactivate(); else activate(); };

  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(function(msg) {
      if (msg && msg.type === 'specter-toggle') window.__specterToggle();
    });
  }

  console.log('%c👻 Specter — Ctrl+Option+Z to toggle', 'color:#aaa;font-size:11px;');
})();`;
}
