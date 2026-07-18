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
  var PENCIL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>';
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
  var noteMap = new Map();
  var noteInputEl = null;
  var noteTargetEl = null;

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
      pillText.textContent = selectedEls.length + ' selected · N annotate · Cmd+C copy all · Esc clear';
    } else if (measureMode) {
      pillText.textContent = 'Measure · hover distances · M pin · Cmd+C copy · Option toggle';
    } else {
      pillText.textContent = 'Properties · hover · P pick · N annotate · Cmd+C copy · Option measure';
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

  function colorObj(str) {
    var c = parseColor(str);
    if (!c) return null;
    var label = c.alpha < 1 ? c.hex + ' (' + Math.round(c.alpha * 100) + '% opacity)' : c.hex;
    return { raw: str, hex: c.hex, alpha: c.alpha, label: label };
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

  // Collapse a rule's declarations to their shortest lossless form: drop
  // 'initial' (= default, no signal) and always-'normal' noise, and fold
  // side/corner longhands back into shorthands (margin/padding/radius/gap/transition).
  function cleanDecls(style) {
    var m = {}, order = [];
    for (var i = 0; i < style.length; i++) {
      var p = style[i];
      var v = style.getPropertyValue(p);
      if (!v) continue;
      if (v === 'initial') continue;
      if (p === 'transition-behavior') continue;
      if (!(p in m)) order.push(p);
      m[p] = v;
    }
    var used = {}, collapses = {};
    function four(name, t, r, b, l) {
      if (m[t] === undefined || m[r] === undefined || m[b] === undefined || m[l] === undefined) return;
      used[t] = used[r] = used[b] = used[l] = 1;
      var a = m[t], c = m[r], d = m[b], e = m[l], sh;
      if (a === c && c === d && d === e) sh = a;
      else if (a === d && c === e) sh = a + ' ' + c;
      else if (c === e) sh = a + ' ' + c + ' ' + d;
      else sh = a + ' ' + c + ' ' + d + ' ' + e;
      collapses[t] = name + ': ' + sh;
    }
    four('margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left');
    four('padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left');
    four('border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius');
    if (m['row-gap'] !== undefined && m['column-gap'] !== undefined) {
      var g = m['row-gap'] === m['column-gap'] ? m['row-gap'] : m['row-gap'] + ' ' + m['column-gap'];
      collapses['row-gap'] = 'gap: ' + g; used['row-gap'] = used['column-gap'] = 1;
    }
    if (m['transition-property'] !== undefined) {
      var tr = 'transition: ' + m['transition-property'];
      if (m['transition-duration'] !== undefined) tr += ' ' + m['transition-duration'];
      if (m['transition-timing-function'] !== undefined) tr += ' ' + m['transition-timing-function'];
      if (m['transition-delay'] !== undefined && m['transition-delay'] !== '0s') tr += ' ' + m['transition-delay'];
      collapses['transition-property'] = tr;
      used['transition-property'] = used['transition-duration'] = used['transition-timing-function'] = used['transition-delay'] = 1;
    }
    var out = [];
    order.forEach(function (p) {
      if (collapses[p]) { out.push('  ' + collapses[p] + ';'); return; }
      if (used[p]) return;
      out.push('  ' + p + ': ' + m[p] + ';');
    });
    return out;
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
              var props = cleanDecls(rule.style);
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
    var n = selectedEls.length;
    return selectedEls.map(function (el, i) {
      var body = buildLLMClipboard(buildInfo(el));
      var note = noteMap.get(el);
      var header = n > 1 ? '[Specter ' + (i + 1) + '/' + n + ']' : '[Specter]';
      if (note) header += '\\n✏️ CHANGE: ' + note;
      return body.replace('[Specter]', header);
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
      outlinedEl.style.outlineOffset = '';
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
  function makeBadge(el, index, note) {
    var rect = el.getBoundingClientRect();
    var wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'fixed',
      left: (rect.left - 4) + 'px',
      top: (rect.top - 4) + 'px',
      zIndex: '2147483644',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '4px',
    });
    var badge = document.createElement('div');
    badge.textContent = String(index + 1);
    Object.assign(badge.style, {
      width: '20px',
      height: '20px',
      flexShrink: '0',
      background: PURPLE,
      color: '#fff',
      fontSize: '11px',
      fontWeight: '700',
      fontFamily: MONO,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    });
    wrap.appendChild(badge);
    if (note) {
      var chip = document.createElement('div');
      chip.textContent = '✏️ ' + (note.length > 32 ? note.slice(0, 32) + '…' : note);
      Object.assign(chip.style, {
        maxWidth: '240px',
        background: TIP_BG,
        color: '#fff',
        fontSize: '10px',
        lineHeight: '16px',
        fontFamily: MONO,
        padding: '2px 6px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        border: '1px solid ' + PURPLE,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      });
      wrap.appendChild(chip);
    }
    document.body.appendChild(wrap);
    return wrap;
  }

  function rebuildBadges() {
    selectedBadges.forEach(function (b) { b.remove(); });
    selectedBadges.length = 0;
    selectedEls.forEach(function (el, i) {
      selectedBadges.push(makeBadge(el, i, noteMap.get(el)));
    });
  }

  function toggleSelection(el) {
    var idx = selectedEls.indexOf(el);
    if (idx >= 0) {
      selectedEls.splice(idx, 1);
      el.style.outline = '';
      noteMap.delete(el);
    } else {
      selectedEls.push(el);
      el.style.outline = '2px solid ' + PURPLE;
      el.style.outlineOffset = '-1px';
    }
    rebuildBadges();
    updatePillForSelection();
  }

  function clearSelection() {
    closeNoteInput();
    selectedEls.forEach(function (el) { el.style.outline = ''; el.style.outlineOffset = ''; });
    selectedEls.length = 0;
    selectedBadges.forEach(function (b) { b.remove(); });
    selectedBadges.length = 0;
    noteMap.clear();
  }

  function updatePillForSelection() {
    if (selectedEls.length > 0) expandPill();
    else if (!pillWrap.matches(':hover')) collapsePill();
  }

  // ─── Annotations (inline change notes) ──────────────────────────────────────
  function openNoteInput(el) {
    closeNoteInput();
    if (selectedEls.indexOf(el) < 0) {
      clearHoverOutline();
      hideTooltip();
      selectedEls.push(el);
      el.style.outline = '2px solid ' + PURPLE;
      el.style.outlineOffset = '-1px';
    }
    noteTargetEl = el;
    var rect = el.getBoundingClientRect();

    var box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: '8px',
      boxSizing: 'border-box',
      background: TIP_BG,
      border: '1px solid ' + PURPLE,
      borderRadius: '8px',
      padding: '11px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      fontFamily: MONO,
    });
    var pen = document.createElement('span');
    pen.innerHTML = PENCIL;
    Object.assign(pen.style, {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
      marginTop: '2px',
      color: '#E0A3F5',
    });
    var input = document.createElement('textarea');
    input.rows = 1;
    input.placeholder = 'Describe the change… (Enter to save)';
    input.value = noteMap.get(el) || '';
    Object.assign(input.style, {
      flexShrink: '0',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: MONO,
      fontSize: '12px',
      lineHeight: '18px',
      padding: '0',
      margin: '0',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    });
    // Hidden mirror to measure single-line text width so the field grows as you type.
    var meas = document.createElement('span');
    Object.assign(meas.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      pointerEvents: 'none',
      fontFamily: MONO,
      fontSize: '12px',
      left: '-9999px',
      top: '0',
    });
    box.appendChild(pen);
    box.appendChild(input);
    box.appendChild(meas);
    document.body.appendChild(box);
    noteInputEl = box;

    var margin = 8;
    function textW(t) { meas.textContent = t; return meas.offsetWidth; }

    // Anchor to the element; the box is repositioned around this as it grows.
    var anchorL = rect.left, anchorT = rect.top, anchorB = rect.bottom;

    function sizeAndPosition() {
      var vw = window.innerWidth, vh = window.innerHeight;
      var maxBoxW = Math.min(560, vw - margin * 2);
      var maxTextW = Math.max(120, maxBoxW - 55);        // room for icon + gaps + padding
      var placeholderW = textW(input.placeholder);
      var minTextW = Math.min(placeholderW, maxTextW);
      var maxTaH = Math.min(14 * 18, Math.max(18, (vh - margin * 2) - 24)); // cap ~14 lines, never past viewport

      // Width: grow with content up to the max, then wrapping takes over.
      var single = textW(input.value || input.placeholder) + 3;
      input.style.width = Math.min(Math.max(single, minTextW), maxTextW) + 'px';
      // Height: fit wrapped content, scroll only in the extreme case.
      input.style.height = 'auto';
      var h = input.scrollHeight;
      if (h > maxTaH) { input.style.height = maxTaH + 'px'; input.style.overflowY = 'auto'; }
      else { input.style.height = h + 'px'; input.style.overflowY = 'hidden'; }

      // Keep the whole box on screen.
      var bw = box.offsetWidth, bh = box.offsetHeight;
      var left = Math.min(Math.max(anchorL, margin), Math.max(margin, vw - bw - margin));
      var top = anchorT - bh - 8;                        // prefer sitting above the element
      if (top < margin) top = anchorB + 8;               // otherwise below it
      if (top + bh > vh - margin) top = Math.max(margin, vh - bh - margin);
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    }
    sizeAndPosition();

    input.addEventListener('input', sizeAndPosition);
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitNote(input.value); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeNoteInput(); }
    });

    rebuildBadges();
    updatePillForSelection();
    setTimeout(function () { input.focus(); }, 0);
  }

  function commitNote(val) {
    val = (val || '').trim();
    if (noteTargetEl) {
      if (val) noteMap.set(noteTargetEl, val);
      else noteMap.delete(noteTargetEl);
    }
    closeNoteInput();
    rebuildBadges();
  }

  function closeNoteInput() {
    if (noteInputEl) { noteInputEl.remove(); noteInputEl = null; }
    noteTargetEl = null;
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
    if (noteInputEl && (target === noteInputEl || noteInputEl.contains(target))) return;

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

    // Note editor open: let the field handle its own keys (Enter/Esc) and native copy/paste.
    if (noteInputEl) return;

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
      if (!lastHovered) return;
      clearHoverOutline();
      toggleSelection(lastHovered);
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      if (!lastHovered) return;
      openNoteInput(lastHovered);
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
      if (pinEl || selectedEls.length > 0) {
        clearPin();
        clearSelection();
        clearMeasureOverlay();
        hideTooltip();
        collapsePill();
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

  var _rt = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
  if (_rt && _rt.onMessage) {
    _rt.onMessage.addListener(function(msg) {
      if (msg && msg.type === 'specter-toggle') window.__specterToggle();
    });
  }

  console.log('%c👻 Specter — Ctrl+Option+Z to toggle', 'color:#aaa;font-size:11px;');
})();`;
}
