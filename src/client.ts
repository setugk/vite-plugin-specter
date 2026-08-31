import type { SpecterOptions } from './index.js';

export function getClientScript(options: SpecterOptions): string {
  const activateShortcut = options.shortcuts?.activate ?? 'ctrl+alt+z';
  return `(function() {
  'use strict';
  // Guard against running twice on one page. Use a DOM marker (not just a
  // window global) so the browser-extension build (isolated world) and the
  // Vite-plugin build (page main world) can see each other and only one runs —
  // they share the DOM but not window globals, so a per-world flag misses.
  if (window.__specter || document.documentElement.hasAttribute('data-specter')) return;
  window.__specter = true;
  document.documentElement.setAttribute('data-specter', '');

  // ─── Constants ──────────────────────────────────────────────────────────────
  var PURPLE = '#AD24D3';
  var RED = '#ED3E61';
  var TIP_BG = '#292B32';
  var GREEN = '#22C55E';
  var LABEL = '#8B8D94';
  var MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
  var ZAP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
  var PENCIL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>';
  var TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
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
  // Specs = the unified marks (pick + optional annotation). Each:
  //   { el, path, note, body, kind:'element'|'measure', wrap, pill, num, noteSpan }
  var specs = [];
  var editorEl = null;      // the open Spec-editor box, or null
  var editorSpec = null;    // the Spec being edited
  var editorCommit = null;  // idempotent commit fn for the open editor
  var rafId = null;         // reflow loop handle

  // Tag every Specter-owned node so inspect/hover logic can skip its own UI
  // (no "Specter-ception" — never inspect our own overlays).
  function markUI(el) { el.setAttribute('data-specter-ui', ''); return el; }
  function isUI(el) { return !!(el && el.closest && el.closest('[data-specter-ui]')); }

  // ─── Tooltip ──────────────────────────────────────────────────────────────
  var tooltip = document.createElement('div');
  markUI(tooltip);
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
  markUI(measureOverlay);
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
  markUI(pillWrap);
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

  var clearBtn = document.createElement('span');
  clearBtn.textContent = '✕ Clear';
  clearBtn.title = 'Remove all Specs';
  Object.assign(clearBtn.style, {
    display: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '600',
    flexShrink: '0',
    padding: '2px 8px',
    marginLeft: '2px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.16)',
  });
  clearBtn.addEventListener('click', function (e) { e.stopPropagation(); removeAllSpecs(); });

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
  pill.appendChild(clearBtn);
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
    if (specs.length === 0 && !pinEl) collapsePill();
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
    pill.style.maxWidth = '820px';
    pillText.style.display = 'inline';
    chevron.style.display = 'inline';
    clearBtn.style.display = specs.length > 0 ? 'inline' : 'none';
    pillExpanded = true;
    if (text) { pillText.textContent = text; return; }
    if (specs.length > 0) {
      pillText.textContent = specs.length + (specs.length === 1 ? ' Spec' : ' Specs') + ' · P add · click a Spec to edit · Cmd+C copy';
    } else if (measureMode) {
      pillText.textContent = 'Measure · hover distances · P mark · M pin · Cmd+C copy · Option toggle';
    } else {
      pillText.textContent = 'Properties · P mark / annotate · Cmd+C copy · Option measure';
    }
  }

  function collapsePill() {
    pill.style.maxWidth = '32px';
    pillText.style.display = 'none';
    chevron.style.display = 'none';
    clearBtn.style.display = 'none';
    pillExpanded = false;
  }

  function flashMode() {
    if (pillExpanded && pillWrap.matches(':hover')) return;
    var text = measureMode ? '⬡ Measure mode' : '◉ Properties mode';
    expandPill(text);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      if (!pillWrap.matches(':hover') && specs.length === 0 && !pinEl) collapsePill();
      else expandPill();
    }, 1200);
  }

  // Show/collapse the pill based on whether any Specs exist.
  function updatePill() {
    if (specs.length > 0) expandPill();
    else if (!pillWrap.matches(':hover')) collapsePill();
  }

  // ─── Activate / Deactivate ────────────────────────────────────────────────
  // Esc / toggle only HIDE the plugin — Specs persist and reappear on reactivate.
  function activate() {
    fiActive = true;
    measureMode = false;
    pillWrap.style.display = 'block';
    document.body.style.cursor = 'crosshair';
    updatePill();
    startLoop();
    reflowSpecs();
  }

  function deactivate() {
    commitEditor();
    fiActive = false;
    measureMode = false;
    optionHeld = false;
    lastHovered = null;
    clearPin();
    clearHoverOutline();
    clearMeasureTargetHL();
    pillWrap.style.display = 'none';
    document.body.style.cursor = '';
    hideTooltip();
    clearMeasureOverlay();
    stopLoop();
    reflowSpecs(); // hides all Spec badges while inactive (data kept)
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
    var raw = el.textContent ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
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

  // Lean copy: just enough to fix the issue — which element, and its current
  // key values. Deliberately NO full CSS-rule dump (an AI with the repo finds
  // the rule from the selector; one without it can't edit source anyway).
  function buildLLMClipboard(data) {
    // Identity: tag + component/styleKey + text + dims. Classes live in the
    // selector line, so don't repeat them here.
    var head = '<' + data.tag + '>';
    if (data.component) head += ' ' + data.component;
    if (data.styleKey) head += ' [' + data.styleKey + ']';
    if (data.text) head += ' "' + data.text + (data.textTrunc ? '…' : '') + '"';
    head += ' ' + data.width + '×' + data.height;

    // One compact line of the values that could be the target of the change.
    var props = ['font: ' + data.font.family + ' ' + data.font.weight + ' ' + data.font.size + '/' + data.font.lineHeight];
    if (data.color) props.push('color: ' + data.color.label);
    if (data.bg) props.push('bg: ' + data.bg.label);
    if (data.padding) props.push('padding: ' + data.padding.value);
    if (data.margin) props.push('margin: ' + data.margin.value);
    if (data.radius) props.push('radius: ' + data.radius);
    if (data.display) {
      var d = 'display: ' + data.display;
      if (data.gap) d += ' gap ' + data.gap;
      if (data.flexDir) d += ' ' + data.flexDir;
      props.push(d);
    }

    return ['[Specter]', head, 'selector: ' + getSelector(data.el), props.join('  ·  ')].join('\\n');
  }

  // Copy every Spec — using each Spec's body snapshotted at mark time, so Specs
  // whose element is currently hidden (e.g. inside a closed modal) still copy.
  function buildSpecsCopyText() {
    var n = specs.length;
    return specs.map(function (spec, i) {
      var tag = spec.kind === 'measure' ? 'Specter Measure' : 'Specter';
      var header = n > 1 ? '[' + tag + ' ' + (i + 1) + '/' + n + ']' : '[' + tag + ']';
      if (spec.note) header += '\\n✏️ CHANGE: ' + spec.note;
      return spec.body.replace(/^\\[Specter[^\\]]*\\]/, function () { return header; });
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

  // ─── Specs (marks: pick + optional annotation) ──────────────────────────────
  // A stable-ish CSS path so a Spec can re-find its element if the DOM node is
  // rebuilt (e.g. a modal that recreates its contents on reopen).
  function elementPath(el) {
    if (!el || el.nodeType !== 1) return '';
    var parts = [], cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && parts.length < 6) {
      if (cur.id) { try { parts.unshift('#' + CSS.escape(cur.id)); } catch (e) { parts.unshift('#' + cur.id); } break; }
      var seg = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) seg += ':nth-child(' + (Array.prototype.indexOf.call(parent.children, cur) + 1) + ')';
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function safeQuery(sel) { try { return sel ? document.querySelector(sel) : null; } catch (e) { return null; } }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility) { try { if (!el.checkVisibility()) return false; } catch (e) {} }
    var r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  // Is the element's center covered by something else (e.g. a modal overlay)?
  // Uses elementsFromPoint and skips Specter's own UI so a badge over the point
  // doesn't count as occluding its own element.
  function isOccluded(el, r) {
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return true;
    var stack = document.elementsFromPoint(cx, cy);
    var top = null;
    for (var i = 0; i < stack.length; i++) { if (!isUI(stack[i])) { top = stack[i]; break; } }
    if (!top) return true;
    return !(top === el || el.contains(top) || top.contains(el));
  }

  // Position every Spec badge on its element each frame — follows scroll/layout,
  // hides when the element is hidden or removed (closed modal), reappears when it
  // returns (re-found by CSS path if the node was rebuilt).
  function reflowSpecs() {
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      if (!fiActive) { s.wrap.style.display = 'none'; continue; }
      if (!s.el || !s.el.isConnected) { var f = safeQuery(s.path); if (f) s.el = f; }
      if (!isVisible(s.el)) { s.wrap.style.display = 'none'; continue; }
      var r = s.el.getBoundingClientRect();
      if (isOccluded(s.el, r)) { s.wrap.style.display = 'none'; continue; } // covered (e.g. behind a modal)
      s.wrap.style.display = 'block';
      s.wrap.style.left = (r.left - 10) + 'px'; // -4 circle offset, -6 wrap padding
      s.wrap.style.top = (r.top - 10) + 'px';
    }
  }

  function startLoop() { if (rafId == null) (function loop() { reflowSpecs(); rafId = requestAnimationFrame(loop); })(); }
  function stopLoop() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

  function renumber() { for (var i = 0; i < specs.length; i++) specs[i].num.textContent = String(i + 1); }

  function updateBadgeContent(spec) {
    spec.num.textContent = String(specs.indexOf(spec) + 1);
    if (spec.note) spec.noteSpan.textContent = '✏️ ' + spec.note;
    else spec.noteSpan.textContent = spec.kind === 'measure' ? '⬡ measure' : '';
  }

  // A Spec badge: a circle showing its number that expands (capsule morph) on
  // hover to preview its note, and opens the editor when clicked.
  function createBadge(spec) {
    // wrap carries transparent padding → a larger hover boundary so reaching the
    // trash icon doesn't require pixel-precise aim. reflow offsets for it.
    var wrap = markUI(document.createElement('div'));
    Object.assign(wrap.style, { position: 'fixed', zIndex: '2147483644', display: 'none', padding: '6px' });
    var cap2 = document.createElement('div');
    Object.assign(cap2.style, {
      display: 'inline-flex', alignItems: 'center', height: '20px',
      maxWidth: '20px', overflow: 'hidden', background: PURPLE, color: '#fff',
      borderRadius: '999px', fontFamily: MONO, whiteSpace: 'nowrap',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)', cursor: 'pointer', userSelect: 'none',
      transition: 'max-width 0.2s ease',
    });
    var num = document.createElement('span');
    Object.assign(num.style, { width: '20px', flexShrink: '0', textAlign: 'center', fontSize: '13px', fontWeight: '700', lineHeight: '20px' });
    var noteSpan = document.createElement('span');
    Object.assign(noteSpan.style, { fontSize: '12px', paddingLeft: '3px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' });
    var trash = document.createElement('span');
    trash.innerHTML = TRASH;
    trash.title = 'Delete this Spec';
    Object.assign(trash.style, { display: 'flex', alignItems: 'center', flexShrink: '0', padding: '0 8px 0 6px', color: '#F3B0C0', cursor: 'pointer' });
    cap2.appendChild(num);
    cap2.appendChild(noteSpan);
    cap2.appendChild(trash);
    wrap.appendChild(cap2);
    document.body.appendChild(wrap);
    spec.wrap = wrap; spec.num = num; spec.noteSpan = noteSpan;

    // Grace delay on collapse so a brief cursor dip while moving toward the trash
    // doesn't snap the pill shut.
    var collapseTimer = null;
    wrap.addEventListener('mouseenter', function () { clearTimeout(collapseTimer); cap2.style.maxWidth = '320px'; });
    wrap.addEventListener('mouseleave', function () { collapseTimer = setTimeout(function () { cap2.style.maxWidth = '20px'; }, 220); });
    trash.addEventListener('click', function (e) { e.stopPropagation(); removeSpec(spec); });
    cap2.addEventListener('click', function (e) { e.stopPropagation(); openSpecEditor(spec); });
    updateBadgeContent(spec);
  }

  function findElementSpec(el) {
    for (var i = 0; i < specs.length; i++) if (specs[i].kind === 'element' && specs[i].el === el) return specs[i];
    return null;
  }

  // Press P → create a Spec (+ open its annotation box). Measure mode captures
  // distances instead of properties; a pinned measurement anchors on the pin.
  function markSpec(anchorEl) {
    var kind = 'element', el = anchorEl, body;
    if (measureMode) {
      kind = 'measure';
      if (pinEl && lastHovered && lastHovered !== pinEl) { el = pinEl; body = buildMeasureCopyText(pinEl, lastHovered); }
      else { el = anchorEl; body = buildNeighborCopyText(anchorEl); }
    } else {
      if (findElementSpec(anchorEl)) return; // P over an already-Spec'd element → nothing
      body = buildLLMClipboard(buildInfo(anchorEl));
    }
    clearHoverOutline();
    hideTooltip();
    var spec = { el: el, path: elementPath(el), note: '', body: body, kind: kind };
    specs.push(spec);
    createBadge(spec);
    reflowSpecs();
    updatePill();
    openSpecEditor(spec);
  }

  function removeSpec(spec) {
    var i = specs.indexOf(spec);
    if (i < 0) return;
    specs.splice(i, 1);
    if (spec.wrap) spec.wrap.remove();
    renumber();
    updatePill();
  }

  function removeAllSpecs() {
    commitEditor();
    specs.forEach(function (s) { if (s.wrap) s.wrap.remove(); });
    specs.length = 0;
    updatePill();
  }

  // ─── Spec editor (annotation box: add / edit / delete) ───────────────────────
  function commitEditor() { if (editorCommit) editorCommit(); }
  function closeEditorDom() {
    if (editorEl) { editorEl.remove(); editorEl = null; }
    editorSpec = null; editorCommit = null;
  }

  // Open a Spec's annotation box: prefilled with its note, grows as you type,
  // saves on Enter or blur (click-away), and carries a Delete button.
  function openSpecEditor(spec) {
    commitEditor(); // commit whatever editor is already open
    if (!spec || !spec.el) return;
    editorSpec = spec;
    var rect = spec.el.getBoundingClientRect();

    var box = markUI(document.createElement('div'));
    Object.assign(box.style, {
      position: 'fixed', zIndex: '2147483647', display: 'inline-flex',
      alignItems: 'flex-start', gap: '8px', boxSizing: 'border-box',
      background: TIP_BG, border: '1px solid ' + PURPLE, borderRadius: '8px',
      padding: '11px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.35)', fontFamily: MONO,
    });
    var pen = document.createElement('span');
    pen.innerHTML = PENCIL;
    Object.assign(pen.style, { display: 'flex', alignItems: 'center', flexShrink: '0', marginTop: '2px', color: '#E0A3F5' });
    var input = document.createElement('textarea');
    input.rows = 1;
    input.placeholder = 'Describe the change… (Enter to save)';
    input.value = spec.note || '';
    Object.assign(input.style, {
      flexShrink: '0', background: 'transparent', border: 'none', outline: 'none',
      resize: 'none', overflow: 'hidden', color: '#fff', fontFamily: MONO,
      fontSize: '12px', lineHeight: '18px', padding: '0', margin: '0',
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    });
    var del = document.createElement('button');
    del.innerHTML = TRASH;
    del.title = 'Delete this Spec';
    Object.assign(del.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0',
      width: '24px', height: '24px', marginTop: '-2px', padding: '0',
      background: 'transparent', border: 'none', borderRadius: '6px',
      color: '#ED8FA6', cursor: 'pointer',
    });
    // Hidden mirror to measure single-line text width so the field grows as you type.
    var meas = document.createElement('span');
    Object.assign(meas.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', pointerEvents: 'none', fontFamily: MONO, fontSize: '12px', left: '-9999px', top: '0' });
    box.appendChild(pen);
    box.appendChild(input);
    box.appendChild(del);
    box.appendChild(meas);
    document.body.appendChild(box);
    editorEl = box;

    var margin = 8;
    function textW(t) { meas.textContent = t; return meas.offsetWidth; }
    var anchorL = rect.left, anchorT = rect.top, anchorB = rect.bottom;

    function sizeAndPosition() {
      var vw = window.innerWidth, vh = window.innerHeight;
      var maxBoxW = Math.min(560, vw - margin * 2);
      var maxTextW = Math.max(120, maxBoxW - 90); // room for pencil + delete + gaps + padding
      var placeholderW = textW(input.placeholder);
      var minTextW = Math.min(placeholderW, maxTextW);
      var maxTaH = Math.min(14 * 18, Math.max(18, (vh - margin * 2) - 24)); // cap ~14 lines
      var single = textW(input.value || input.placeholder) + 3;
      input.style.width = Math.min(Math.max(single, minTextW), maxTextW) + 'px';
      input.style.height = 'auto';
      var h = input.scrollHeight;
      if (h > maxTaH) { input.style.height = maxTaH + 'px'; input.style.overflowY = 'auto'; }
      else { input.style.height = h + 'px'; input.style.overflowY = 'hidden'; }
      var bw = box.offsetWidth, bh = box.offsetHeight;
      var left = Math.min(Math.max(anchorL, margin), Math.max(margin, vw - bw - margin));
      var top = anchorT - bh - 8;              // prefer above the element
      if (top < margin) top = anchorB + 8;     // otherwise below
      if (top + bh > vh - margin) top = Math.max(margin, vh - bh - margin);
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    }
    sizeAndPosition();

    var done = false;
    function commit() {
      if (done) return; done = true;
      spec.note = input.value.trim();
      updateBadgeContent(spec);
      closeEditorDom();
      updatePill();
    }
    editorCommit = commit;

    // Delete via mousedown+preventDefault so the textarea doesn't blur-save first.
    del.addEventListener('mousedown', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      done = true; closeEditorDom(); removeSpec(spec);
    });
    input.addEventListener('input', sizeAndPosition);
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Escape') { ev.preventDefault(); commit(); }
    });
    input.addEventListener('blur', function () { setTimeout(commit, 0); });

    setTimeout(function () { input.focus(); }, 0);
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
      pinHighlight = markUI(document.createElement('div'));
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
    measureHL = markUI(document.createElement('div'));
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
    // Never inspect Specter's own UI — and clear the inspect overlays so the
    // properties box / measure lines don't block a Spec's hover pill.
    if (!target || isUI(target)) {
      hideTooltip();
      clearMeasureOverlay();
      clearMeasureTargetHL();
      clearHoverOutline();
      return;
    }

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

    // Spec editor open: let the textarea own its keys (Enter/Esc, native copy,
    // and the letter "p") — never treat them as Specter shortcuts.
    if (editorEl) return;

    if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      optionHeld = true;
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      var text;
      if (specs.length > 0) {
        text = buildSpecsCopyText();
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

    // P — the single mark/annotate key (empty note = a plain mark).
    // preventDefault so the "p" keystroke can't leak into the note box that
    // markSpec is about to focus (was an intermittent stray-"p" race).
    if (e.key === 'p' || e.key === 'P') {
      if (!lastHovered) return;
      e.preventDefault();
      markSpec(lastHovered);
      return;
    }

    if (e.key === 'm' || e.key === 'M') {
      if (!measureMode || !lastHovered) return;
      if (pinEl) {
        clearPin();
        updatePill();
      } else {
        setPin(lastHovered);
        expandPill('Pinned · hover another element · P mark · Cmd+C copy');
      }
      return;
    }

    // Esc only HIDES the plugin — Specs persist and return on reactivate.
    if (e.key === 'Escape') {
      deactivate();
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
