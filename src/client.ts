import type { SpecterOptions } from './index.js';

export function getClientScript(options: SpecterOptions): string {
  const activateShortcut = options.shortcuts?.activate ?? 'ctrl+alt+z';
  const cb = options.claudeBridge;
  const bridgeUrl = cb === true ? 'http://127.0.0.1:8787' : (cb && typeof cb === 'object' ? cb.url ?? 'http://127.0.0.1:8787' : '');
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
  var BADGE_IDLE = '#6B6D75'; // panel row-number badges sit greyscale; the hovered row's badge colors to PURPLE
  var MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
  var ZAP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
  var PENCIL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>';
  var TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  var LIST = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
  var CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var COPY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var ACTIVATE = ${JSON.stringify(activateShortcut)};
  var BRIDGE = ${JSON.stringify(bridgeUrl)}; // Claude MCP bridge URL, or '' if disabled

  // ─── State ────────────────────────────────────────────────────────────────
  var fiActive = false;
  var measureMode = false;
  var commentMode = false; // C: hide props/measure overlays for design review — Specs still capture them
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
  var lastClick = { label: '', at: 0 }; // last interactive control clicked (likely opener of a modal)
  // Specs = the unified marks (pick + optional annotation). Each:
  //   { el, path, note, body, kind:'element'|'measure', wrap, pill, num, noteSpan }
  var specs = [];
  var editorEl = null;      // the open Spec-editor box, or null
  var editorSpec = null;    // the Spec being edited
  var editorCommit = null;  // idempotent commit fn for the open editor
  var rafId = null;         // reflow loop handle
  var panelOpen = false;    // Specs side panel visible?
  var panelEditSpec = null; // Spec being inline-edited in the panel, or null
  var highlightSpec = null; // Spec whose badge is enlarged (panel-row hover)
  var groupHover = {};       // per-cluster fan-out hover state (keyed by member ids)
  // Per-URL reload insurance: Specs survive an accidental refresh. Zero network —
  // localStorage only, keyed by path so different routes keep separate lists.
  var STORAGE_KEY = '__specter_specs_' + location.pathname;

  // Tag every Specter-owned node so inspect/hover logic can skip its own UI
  // (no "Specter-ception" — never inspect our own overlays).
  function markUI(el) { el.setAttribute('data-specter-ui', ''); return el; }
  function isUI(el) { return !!(el && el.closest && el.closest('[data-specter-ui]')); }

  // Attach a hover effect to an interactive icon/button: apply the "on" styles
  // while hovered, restore the "off" styles on leave (keeps things clickable-feeling).
  function hoverFx(el, on, off) {
    el.style.transition = (el.style.transition ? el.style.transition + ', ' : '') + 'background 0.12s ease, color 0.12s ease, opacity 0.12s ease, transform 0.12s ease';
    el.addEventListener('mouseenter', function () { Object.assign(el.style, on); });
    el.addEventListener('mouseleave', function () { Object.assign(el.style, off); });
  }

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
  hoverFx(closeEl, { transform: 'scale(1.25)' }, { transform: 'scale(1)' });

  iconBtn.appendChild(zapEl);
  iconBtn.appendChild(closeEl);

  var pillText = document.createElement('span');
  Object.assign(pillText.style, { display: 'none', color: '#f3d9fb' });

  var listBtn = document.createElement('span');
  listBtn.innerHTML = LIST;
  listBtn.title = 'Show Specs panel (L)';
  Object.assign(listBtn.style, {
    display: 'none',
    alignItems: 'center',
    cursor: 'pointer',
    color: '#fff',
    flexShrink: '0',
    padding: '4px 6px',
    marginLeft: '2px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.16)',
  });
  listBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePanel(); });
  hoverFx(listBtn, { background: 'rgba(255,255,255,0.32)' }, { background: 'rgba(255,255,255,0.16)' });

  var clearBtn = document.createElement('span');
  clearBtn.textContent = '✕ Delete all';
  clearBtn.title = 'Delete all annotations';
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
  hoverFx(clearBtn, { background: 'rgba(255,255,255,0.32)' }, { background: 'rgba(255,255,255,0.16)' });

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
  hoverFx(chevron, { opacity: '1', transform: 'scale(1.2)' }, { opacity: '0.8', transform: 'scale(1)' });

  // Sync status in the control bar (only when a bridge is configured): spinner while
  // syncing, green when synced, red on error — so you always know what's staged.
  var pillSync = document.createElement('span');
  Object.assign(pillSync.style, {
    display: 'none', width: '8px', height: '8px', borderRadius: '999px',
    background: '#6B7280', flexShrink: '0', boxSizing: 'border-box',
  });
  pillSync.title = 'Sync status — click to re-sync';
  pillSync.addEventListener('click', function (e) { e.stopPropagation(); if (BRIDGE) doSync(); });

  pill.appendChild(iconBtn);
  pill.appendChild(pillSync);
  pill.appendChild(pillText);
  pill.appendChild(listBtn);
  pill.appendChild(clearBtn);
  pill.appendChild(chevron);
  pillWrap.appendChild(pill);
  document.body.appendChild(pillWrap);

  // Keyframes for the sync spinner (injected once).
  var spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes __specterSpin{to{transform:rotate(360deg)}}';
  markUI(spinStyle);
  document.head.appendChild(spinStyle);

  // Shared dot styling for the control-bar AND side-panel sync indicators, so they
  // always match: spinner while syncing, green when synced, red on error.
  function applyDotState(el, state) {
    el.style.boxSizing = 'border-box';
    if (state === 'syncing') {
      Object.assign(el.style, { width: '10px', height: '10px', background: 'transparent', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: '__specterSpin 0.6s linear infinite' });
    } else if (state === 'synced') {
      Object.assign(el.style, { width: '8px', height: '8px', background: GREEN, border: 'none', animation: 'none' });
    } else { // offline / error
      Object.assign(el.style, { width: '8px', height: '8px', background: '#F26D6D', border: 'none', animation: 'none' });
    }
  }
  function setPillSync(state) {
    if (!BRIDGE) { pillSync.style.display = 'none'; return; }
    pillSync.style.display = 'inline-block';
    applyDotState(pillSync, state);
  }

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

  // The mode is shown at all times (persistent prefix), so you always know whether
  // hovering shows properties, measurements, or nothing (Comment).
  function modeLabel() {
    return commentMode ? 'Comment' : (measureMode ? 'Measure' : 'Properties');
  }

  function expandPill(text) {
    pill.style.maxWidth = '820px';
    pillText.style.display = 'inline';
    chevron.style.display = 'inline';
    listBtn.style.display = specs.length > 0 ? 'inline-flex' : 'none';
    clearBtn.style.display = specs.length > 0 ? 'inline' : 'none';
    pillExpanded = true;
    // Just the mode (+ the action buttons when Specs exist). Shortcuts live in the
    // side panel now, so the pill stays short.
    pillText.textContent = text || modeLabel();
  }

  // "Collapsed" = the compact resting state: mode label only, no hints/buttons.
  // Still shows the mode so it's visible at all times.
  function collapsePill() {
    pillText.textContent = modeLabel();
    pillText.style.display = 'inline';
    pill.style.maxWidth = '220px';
    chevron.style.display = 'none';
    listBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    pillExpanded = false;
  }

  function flashMode() {
    if (pillExpanded && pillWrap.matches(':hover')) return;
    var text = commentMode ? 'Comment mode' : (measureMode ? 'Measure mode' : 'Properties mode');
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
    if (panelOpen) renderPanel();
  }

  // ─── Activate / Deactivate ────────────────────────────────────────────────
  // Esc / toggle only HIDE the plugin — Specs persist and reappear on reactivate.
  function activate() {
    fiActive = true;
    measureMode = false;
    commentMode = false;
    pillWrap.style.display = 'block';
    document.body.style.cursor = 'crosshair';
    updatePill();
    startLoop();
    reflowSpecs();
    if (BRIDGE) doSync(); // resolve the control-bar sync dot (green if reachable, red if not)
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
    hidePanel();
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

  // ─── Layer A locator ──────────────────────────────────────────────────────────
  // The single most greppable anchor for an element, so Claude jumps straight to the
  // source instead of searching: a unique test-id → stable id → aria/name → short
  // visible text → a unique class, falling back to the CSS path. Any stack, no build
  // step, one line — fewer agent tool-calls + more accurate edits (the core tenet).
  function uniqueSel(sel) { try { return !!sel && document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }
  function isHashedId(id) { return /:r[0-9a-z]+:/i.test(id) || /[a-f0-9]{8,}/i.test(id) || /__[a-zA-Z0-9]{5,}/.test(id) || /_[a-zA-Z0-9]{6,}$/.test(id); }
  function ownText(el) {
    if (el.children && el.children.length > 2) return '';
    var t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    return (t.length >= 2 && t.length <= 80) ? t : '';
  }
  function ownClass(el) {
    var cls = Array.prototype.slice.call(el.classList || []).filter(function (c) { return c.indexOf('__specter') !== 0 && !/[a-f0-9]{6,}/i.test(c) && !/_[a-zA-Z0-9]{5,}$/.test(c); });
    for (var i = 0; i < cls.length; i++) { if (uniqueSel('.' + cssEsc(cls[i]))) return cls[i]; }
    return '';
  }
  // A 'text "…"' anchor is only safe if that text isn't ALSO the own-text of a
  // DIFFERENT element (an ancestor/descendant sharing it = the same source spot,
  // so those don't count). Prevents an ambiguous grep (e.g. a button and a modal
  // heading both reading "Book a demo").
  function uniqueTextAnchor(el, txt) {
    var all = document.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (o === el || el.contains(o) || o.contains(el)) continue;
      if (ownText(o) === txt) return false;
    }
    return true;
  }
  // Which of {color, background} are altered by a :hover/:active/:focus rule that
  // matches this element — so a value read WHILE the cursor is on it (its computed
  // style is the hovered state) can be flagged instead of reported as the resting
  // value. Detect-only: recovering the resting value would need a cascade parser.
  var STATE_PSEUDO = /:(hover|active|focus|focus-visible|focus-within)\\b/g;
  function hoverAffected(el) {
    var out = {};
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try { rules = sheets[i].cssRules; } catch (e) { continue; } // cross-origin sheet
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r.selectorText || r.selectorText.indexOf(':') < 0) continue;
        STATE_PSEUDO.lastIndex = 0;
        if (!STATE_PSEUDO.test(r.selectorText)) continue;
        var sels = r.selectorText.split(',');
        for (var k = 0; k < sels.length; k++) {
          STATE_PSEUDO.lastIndex = 0;
          var base = sels[k].replace(STATE_PSEUDO, '').trim();
          if (!base) continue;
          var m = false;
          try { m = el.matches(base); } catch (e) { continue; }
          if (!m) continue;
          if (r.style.color) out.color = true;
          if (r.style.background || r.style.backgroundColor) out.bg = true;
        }
      }
    }
    return out;
  }
  function resolveLocator(el) {
    if (!el || el.nodeType !== 1) return '';
    var i, v;
    var testAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];
    for (i = 0; i < testAttrs.length; i++) { v = el.getAttribute(testAttrs[i]); if (v) { var ts = '[' + testAttrs[i] + '="' + cssEsc(v) + '"]'; if (uniqueSel(ts)) return ts; } }
    if (el.id && !isHashedId(el.id) && uniqueSel('#' + cssEsc(el.id))) return '#' + el.id;
    var attrs = ['aria-label', 'name', 'placeholder', 'alt', 'title'];
    for (i = 0; i < attrs.length; i++) { v = el.getAttribute(attrs[i]); if (v && v.trim()) { v = v.trim(); if (uniqueSel('[' + attrs[i] + '="' + cssEsc(v) + '"]')) return attrs[i] + ' "' + v.slice(0, 60) + '"'; } }
    var txt = ownText(el);
    if (txt && uniqueTextAnchor(el, txt)) return 'text "' + txt.slice(0, 40) + (txt.length > 40 ? '…' : '') + '"';
    var cls = ownClass(el);
    if (cls) return '.' + cls;
    return getSelector(el); // fallback: the CSS path
  }

  // ─── Structured data model ──────────────────────────────────────────────────
  function buildInfo(el) {
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var hv = hoverAffected(el);
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
      colorHover: !!hv.color,
      bgHover: !!hv.bg,
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
    if (data.color) h += row('Color', swatch(data.color.hex) + data.color.label + (data.colorHover ? ' <span style="color:' + LABEL + '">(hover)</span>' : ''));
    if (data.bg) h += row('Bg', swatch(data.bg.hex) + data.bg.label + (data.bgHover ? ' <span style="color:' + LABEL + '">(hover)</span>' : ''));
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
    if (data.color) props.push('color: ' + data.color.label + (data.colorHover ? ' (hover)' : ''));
    if (data.bg) props.push('bg: ' + data.bg.label + (data.bgHover ? ' (hover)' : ''));
    if (data.padding) props.push('padding: ' + data.padding.value);
    if (data.margin) props.push('margin: ' + data.margin.value);
    if (data.radius) props.push('radius: ' + data.radius);
    if (data.display) {
      var d = 'display: ' + data.display;
      if (data.gap) d += ' gap ' + data.gap;
      if (data.flexDir) d += ' ' + data.flexDir;
      props.push(d);
    }

    return ['[Specter]', head, 'find: ' + resolveLocator(data.el), props.join('  ·  ')].join('\\n');
  }

  // Group Specs on the SAME element so their identical properties aren't emitted
  // twice — several comments on one thing share ONE property block, each with its
  // own change note. Measure Specs always stand alone (each is a distinct reading).
  function groupSpecs() {
    var groups = [];
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i], g = null;
      if (s.kind === 'element' && s.el) {
        for (var j = 0; j < groups.length; j++) { if (groups[j].kind === 'element' && groups[j].el === s.el) { g = groups[j]; break; } }
      }
      if (g) g.specs.push(s);
      else groups.push({ kind: s.kind, el: s.el, specs: [s] });
    }
    return groups;
  }

  // Copy every Spec — using each Spec's body snapshotted at mark time, so Specs
  // whose element is currently hidden (e.g. inside a closed modal) still copy.
  // Same-element Specs collapse into one block (properties once, notes stacked).
  function buildSpecsCopyText() {
    var groups = groupSpecs();
    var n = groups.length;
    return groups.map(function (g, i) {
      var tag = g.kind === 'measure' ? 'Specter Measure' : 'Specter';
      var header = n > 1 ? '[' + tag + ' ' + (i + 1) + '/' + n + ']' : '[' + tag + ']';
      var notes = g.specs.filter(function (s) { return s.note; }).map(function (s) { return '✏️ CHANGE: ' + s.note; });
      if (notes.length) header += '\\n' + notes.join('\\n');
      return g.specs[0].body.replace(/^\\[Specter[^\\]]*\\]/, function () { return header; });
    }).join('\\n\\n---\\n\\n');
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
    if (commentMode) { hideTooltip(); return; }
    if (measureMode) {
      // Redraw the overlay on scroll/resize; readout box stays hidden (see hover handler).
      if (pinEl && pinEl !== lastHovered) measureBetween(pinEl, lastHovered); else measureToNeighbor(lastHovered);
      hideTooltip();
      return;
    }
    tooltip.innerHTML = buildHumanDisplay(buildInfo(lastHovered));
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

  // Place one badge: wrap at the element's anchor (left/top follows scroll, no
  // transition), offset applied via transform (transitions smoothly). The expand
  // flag grows the circle into its note capsule. A panel-highlighted badge pops to
  // the anchor, enlarges, and rises on top.
  function layoutBadge(s, bx, by, dx, dy, z, expand) {
    var hi = (s === highlightSpec);
    s.wrap.style.display = 'block';
    s.wrap.style.left = bx + 'px';
    s.wrap.style.top = by + 'px';
    s.wrap.style.transform = hi ? 'translate(0px,0px)' : ('translate(' + dx + 'px,' + dy + 'px)');
    s.wrap.style.zIndex = hi ? '2147483645' : String(z);
    // Panel-row hover enlarges the circle (scale 1.5 → 30px). Page hover expands the
    // capsule to the SAME 30px height (taller, matching that enlarged size) + bigger text.
    s.cap.style.transform = hi ? 'scale(1.5)' : '';
    s.cap.style.maxWidth = expand ? '320px' : '20px';
    s.cap.style.height = expand ? '30px' : '20px';
    s.num.style.fontSize = expand ? '14px' : '12px';
    s.num.style.width = expand ? '24px' : '16px';
    s.noteSpan.style.fontSize = expand ? '13px' : '12px';
  }

  // The badge whose wrap sits under the cursor right now (topmost). Drives which
  // single badge is expanded — never more than one.
  function badgeUnderCursor(mx, my) {
    var at = document.elementFromPoint(mx, my);
    if (!at) return null;
    var w = at.closest('[data-specter-ui]');
    return (w && w.__spec) ? w.__spec : null;
  }

  // Position every Spec badge on its element each frame — follows scroll/layout,
  // hides when the element is hidden or removed (closed modal), reappears when it
  // returns (re-found by CSS path if the node was rebuilt). Badges that land on the
  // same spot are clustered: shown side-by-side (latest centered, the previous two
  // tucked half-behind on either side), and fanned into a full row on hover so any
  // one is reachable. Only the badge under the cursor expands to show its note.
  function reflowSpecs() {
    var mx = lastMouse.x, my = lastMouse.y;
    var hoverBadge = fiActive ? badgeUnderCursor(mx, my) : null;

    // Pass 1 — resolve visibility + base anchor for each spec.
    var vis = [];
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      if (!fiActive) { s.wrap.style.display = 'none'; continue; }
      if (s.missing) { s.wrap.style.display = 'none'; continue; } // shared comment whose target is gone/changed
      if (!s.el || !s.el.isConnected) { var f = safeQuery(s.path); if (f) s.el = f; }
      if (!isVisible(s.el)) { s.wrap.style.display = 'none'; continue; }
      var r = s.el.getBoundingClientRect();
      if (isOccluded(s.el, r)) { s.wrap.style.display = 'none'; continue; } // covered (e.g. behind a modal)
      s._bx = r.left - 10; s._by = r.top - 10; // -4 circle offset, -6 wrap padding
      vis.push(s);
    }

    // Pass 2 — cluster badges whose anchors coincide (within ~16px).
    var clusters = [];
    for (var a = 0; a < vis.length; a++) {
      var sp = vis[a], placed = false;
      for (var c = 0; c < clusters.length; c++) {
        var m0 = clusters[c][0];
        if (Math.abs(sp._bx - m0._bx) < 16 && Math.abs(sp._by - m0._by) < 16) { clusters[c].push(sp); placed = true; break; }
      }
      if (!placed) clusters.push([sp]);
    }

    // Pass 3 — lay out each cluster.
    var TOP = 2147483644, MID = 2147483643, HIDE = 2147483640;
    for (var ci = 0; ci < clusters.length; ci++) {
      var members = clusters[ci];
      var bx = members[0]._bx, by = members[0]._by;
      if (members.length === 1) { layoutBadge(members[0], bx, by, 0, 0, TOP, members[0] === hoverBadge); continue; }

      var n = members.length;
      var key = members.map(function (m) { return specs.indexOf(m); }).sort(function (x, y) { return x - y; }).join(':');
      var wasHover = !!groupHover[key];
      var spreadDown = by < window.innerHeight - n * 30; // room below? else fan upward

      // Hysteresis: while fanned, test the tall column bbox; while stacked, the small side-by-side bbox.
      // Fan-out is a vertical column so an expanded badge grows rightward into empty
      // space and never covers its siblings (which sit above/below it).
      var hovered;
      if (wasHover) {
        var colTop = spreadDown ? by : by - (n - 1) * 26;
        hovered = mx >= bx - 8 && mx <= bx + 330 && my >= colTop - 8 && my <= colTop + (n - 1) * 26 + 34;
      } else {
        hovered = mx >= bx - 14 && mx <= bx + 46 && my >= by - 8 && my <= by + 40;
      }
      groupHover[key] = hovered;

      for (var mi = 0; mi < n; mi++) {
        var mem = members[mi];
        if (hovered) {
          // Fanned: vertical column, creation order, only the cursor's badge expands + rises.
          var isHov = (mem === hoverBadge);
          layoutBadge(mem, bx, by, 0, (spreadDown ? 1 : -1) * mi * 26, isHov ? TOP : MID, isHov);
        } else {
          // Stacked: latest centered on top; the two before it peek out half-visible.
          var rank = (n - 1) - mi; // 0 = latest
          if (rank === 0) layoutBadge(mem, bx, by, 0, 0, TOP, false);
          else if (rank === 1) layoutBadge(mem, bx, by, -11, 0, MID, false);
          else if (rank === 2) layoutBadge(mem, bx, by, 11, 0, MID, false);
          else layoutBadge(mem, bx, by, 0, 0, HIDE, false); // extra ones hide behind center
        }
      }
    }
  }

  function startLoop() { if (rafId == null) (function loop() { reflowSpecs(); rafId = requestAnimationFrame(loop); })(); }
  function stopLoop() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

  function renumber() { for (var i = 0; i < specs.length; i++) specs[i].num.textContent = String(i + 1); }

  function updateBadgeContent(spec) {
    spec.num.textContent = String(specs.indexOf(spec) + 1);
    if (spec.note) spec.noteSpan.textContent = spec.note;
    else spec.noteSpan.textContent = spec.kind === 'measure' ? '⬡ measure' : '';
  }

  // A Spec badge: a circle showing its number that expands (capsule morph) on
  // hover to preview its note, and opens the editor when clicked.
  function createBadge(spec) {
    // wrap carries transparent padding → a larger hover boundary so reaching the
    // trash icon doesn't require pixel-precise aim. reflow offsets for it.
    var wrap = markUI(document.createElement('div'));
    Object.assign(wrap.style, { position: 'fixed', zIndex: '2147483644', display: 'none', padding: '6px', transition: 'transform 0.15s ease' });
    var cap2 = document.createElement('div');
    Object.assign(cap2.style, {
      display: 'inline-flex', alignItems: 'center', height: '20px',
      maxWidth: '20px', overflow: 'hidden', background: PURPLE, color: '#fff',
      border: '2px solid #fff', boxSizing: 'border-box',
      borderRadius: '999px', fontFamily: MONO, whiteSpace: 'nowrap',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)', cursor: 'pointer', userSelect: 'none',
      transition: 'max-width 0.2s ease, height 0.15s ease, transform 0.15s ease',
      transformOrigin: '10px 10px',
    });
    var num = document.createElement('span');
    Object.assign(num.style, { width: '16px', flexShrink: '0', textAlign: 'center', fontSize: '12px', fontWeight: '700', lineHeight: '16px' });
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
    wrap.__spec = spec; // so reflow's cursor hit-test can find which Spec a wrap is
    spec.wrap = wrap; spec.num = num; spec.noteSpan = noteSpan; spec.cap = cap2;

    // Expansion (circle → note capsule) is driven per-frame in reflowSpecs from the
    // cursor's exact target, so only the badge under the cursor ever expands.
    hoverFx(trash, { color: '#fff', transform: 'scale(1.15)' }, { color: '#F3B0C0', transform: 'scale(1)' });
    trash.addEventListener('click', function (e) { e.stopPropagation(); removeSpec(spec); });
    cap2.addEventListener('click', function (e) { e.stopPropagation(); openSpecEditor(spec); });
    updateBadgeContent(spec);
  }


  // If the element sits inside a dialog/modal/drawer/menu, produce a hint for how to
  // bring it back when it's later hidden — a declarative opener (aria-controls /
  // data-*target) if the page has one, else the control the user just clicked (the
  // likely opener), else "reopen the <container>". Empty when there's no such container.
  function cssEsc(s) { try { return CSS.escape(s); } catch (e) { return s; } }
  function computeLocateHint(el) {
    if (!el) return '';
    var re = /(modal|dialog|drawer|sheet|popover|offcanvas|overlay|lightbox|menu|dropdown|flyout|popup|tooltip)/i;
    var cur = el, container = null;
    while (cur && cur !== document.body) {
      var role = cur.getAttribute ? cur.getAttribute('role') : null;
      if ((cur.hasAttribute && cur.hasAttribute('aria-modal')) || role === 'dialog' || role === 'menu' ||
          re.test(cur.className || '') || re.test(cur.id || '')) { container = cur; break; }
      cur = cur.parentElement;
    }
    if (!container) return '';
    var tag = (container.className || '') + ' ' + (container.id || '');
    var type = /drawer|offcanvas|sheet/i.test(tag) ? 'drawer' : /menu|dropdown|flyout/i.test(tag) ? 'menu' : 'dialog';
    var opener = '';
    if (container.id) {
      var o = safeQuery('[aria-controls="' + cssEsc(container.id) + '"],[data-target="#' + cssEsc(container.id) + '"],[data-bs-target="#' + cssEsc(container.id) + '"],[data-modal-target="' + cssEsc(container.id) + '"]');
      if (o) opener = (o.getAttribute('aria-label') || o.textContent || '').replace(/\\s+/g, ' ').trim();
    }
    if (!opener && lastClick.label && (Date.now() - lastClick.at) < 120000) opener = lastClick.label;
    if (opener) return 'Open “' + opener.slice(0, 40) + '” to reveal';
    return 'Reopen the ' + type + ' to reveal';
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
      // Multiple Specs per element are allowed in every mode — clustering fans the badges
      // out and same-element output collapses to one property block. Mode only changes
      // what's shown on screen, never whether you can add an annotation.
      body = buildLLMClipboard(buildInfo(anchorEl));
    }
    clearHoverOutline();
    hideTooltip();
    var spec = { el: el, path: elementPath(el), note: '', body: body, kind: kind, locate: computeLocateHint(el) };
    specs.push(spec);
    createBadge(spec);
    reflowSpecs();
    updatePill();
    saveSpecs();
    openSpecEditor(spec);
  }

  function removeSpec(spec) {
    var i = specs.indexOf(spec);
    if (i < 0) return;
    if (highlightSpec === spec) highlightSpec = null;
    if (panelEditSpec === spec) panelEditSpec = null;
    specs.splice(i, 1);
    if (spec.wrap) spec.wrap.remove();
    renumber();
    updatePill();
    saveSpecs();
  }

  function removeAllSpecs() {
    commitEditor();
    highlightSpec = null;
    panelEditSpec = null;
    specs.forEach(function (s) { if (s.wrap) s.wrap.remove(); });
    specs.length = 0;
    updatePill();
    saveSpecs();
  }

  // ─── Reload insurance (localStorage, per-URL, zero network) ──────────────────
  // Persist only the serializable parts of each Spec; the live element ref and
  // DOM nodes are rebuilt on restore (re-anchored best-effort via the CSS path).
  function saveSpecs() {
    try {
      if (!specs.length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(specs.map(function (s) { return { path: s.path, note: s.note, body: s.body, kind: s.kind, locate: s.locate, shared: s.shared, fp: s.fp, missing: s.missing, missReason: s.missReason }; })));
    } catch (e) {}
    scheduleSync(); // keep the Claude bridge mirrored to the current Specs
  }

  function restoreSpecs() {
    var data;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return; }
    if (!Array.isArray(data) || !data.length) return;
    data.forEach(function (d) {
      var spec = { el: d.missing ? null : safeQuery(d.path), path: d.path, note: d.note || '', body: d.body || '', kind: d.kind || 'element', locate: d.locate || '', shared: !!d.shared, fp: d.fp || '', missing: !!d.missing, missReason: d.missReason || '' };
      specs.push(spec);
      createBadge(spec);
    });
    renumber();
  }

  // ─── Share Comments (human↔human) — Steps 1-2 ────────────────────────────────
  // A shared comment is a LOCATOR, not a coordinate: on import we re-find the
  // element and place a badge, exactly like restoreSpecs. Comments only — we carry
  // the note + how to re-find the element, NEVER the props/measurements (body).
  // Step 2 adds change-detection: a fingerprint travels with each comment; if the
  // element is gone OR its signature changed, the comment shows as MISSING (panel
  // only, greyed, with a reason) instead of being drawn on a guessed spot.

  // Normalized element signature for change-detection: stable structural identity,
  // NOT raw outerHTML (which false-trips on any text/attr churn). tag + sorted own
  // classes + a few structural attrs + a short trimmed-text slice. The text slice is
  // the strictness knob — include it to catch content edits, at the cost of a
  // false-MISSING when dynamic text (a price/timestamp) changes under a stable node.
  function normSig(el) {
    if (!el || el.nodeType !== 1) return '';
    var cls = Array.prototype.slice.call(el.classList)
      .filter(function (c) { return c.indexOf('__specter') !== 0; }).sort().join('.');
    var attrs = ['type', 'role', 'name', 'href', 'aria-label'].map(function (a) {
      var v = el.getAttribute(a); return v ? a + '=' + v.trim() : '';
    }).filter(Boolean).join('|');
    var txt = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
    return el.tagName.toLowerCase() + '#' + cls + '#' + attrs + '#' + txt;
  }
  // djb2 xor → short base36 hash. Zero-dep; collisions don't matter (a match just
  // means "unchanged enough", and the re-find already narrowed us to one element).
  function fingerprint(el) {
    var s = normSig(el);
    if (!s) return '';
    var h = 5381, i = s.length;
    while (i) h = (h * 33) ^ s.charCodeAt(--i);
    return (h >>> 0).toString(36);
  }

  // Scan for an element whose OWN text matches (trunc = the stored anchor was cut to
  // 40 chars). Ambiguous (>1 match) → null, so we fall through to the nth-child path
  // rather than guess. Skips Specter's own UI.
  function findByOwnText(val, trunc) {
    var all = document.body ? document.body.getElementsByTagName('*') : [], hit = null;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest && el.closest('[data-specter-ui]')) continue;
      var t = ownText(el);
      if (!t) continue;
      if (trunc ? (t.slice(0, 40) === val) : (t === val)) { if (hit) return null; hit = el; }
    }
    return hit;
  }

  // Real resolver for a resolveLocator() anchor: #id/.class/[attr] query straight;
  // 'attr "value"' rebuilds the attribute selector; 'text "value"' scans own-text.
  // Only trusts an anchor that resolves to EXACTLY ONE element — a class or CSS path
  // shared by siblings (e.g. three .card boxes) would otherwise silently match the
  // first one, mis-anchoring every comment onto it.
  function resolveFind(find) {
    if (!find) return null;
    var c = find.charAt(0);
    if (c === '#' || c === '.' || c === '[') return uniqueSel(find) ? safeQuery(find) : null;
    var q = find.indexOf(' "');
    if (q > 0 && find.charAt(find.length - 1) === '"') {
      var attr = find.slice(0, q), val = find.slice(q + 2, -1), trunc = false;
      if (val.charAt(val.length - 1) === '…') { trunc = true; val = val.slice(0, -1); }
      if (attr === 'text') return findByOwnText(val, trunc);
      if (val.indexOf('"') < 0) { var sel = '[' + attr + '="' + val + '"]'; return uniqueSel(sel) ? safeQuery(sel) : null; }
      return null;
    }
    return uniqueSel(find) ? safeQuery(find) : null; // a bare CSS path — only if unambiguous
  }

  // Re-find a shared comment's element, using the fingerprint to DISAMBIGUATE (not
  // only to detect change): prefer whichever candidate — the find anchor or the
  // nth-child path — actually matches the stored signature. Falls back to a
  // best-effort element so importComments can still tell "changed" from "not found".
  function reFindShared(item) {
    var byFind = resolveFind(item.find);
    if (byFind && (!item.fp || fingerprint(byFind) === item.fp)) return byFind;
    var byPath = safeQuery(item.path);
    if (byPath && (!item.fp || fingerprint(byPath) === item.fp)) return byPath;
    return byFind || byPath || null;
  }

  // URL gate: two people must be on the SAME page for a shared comment to place.
  // Match by origin + pathname only — hash AND query are dropped (the hash is the
  // doSync fork bug; a trailing #route or ?ref shouldn't split the same page).
  function pageKey(href) {
    try { var u = new URL(href || location.href); return u.origin + u.pathname; }
    catch (e) { return location.origin + location.pathname; }
  }

  function exportComments() {
    return {
      url: location.href, // gated on pageKey() at import; full href kept for reference
      comments: specs.map(function (s) {
        return { find: resolveLocator(s.el), path: s.path, fp: fingerprint(s.el), note: s.note || '', kind: s.kind || 'element' };
      }),
    };
  }

  function importComments(payload) {
    if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { return 0; } }
    var comments = null, srcUrl = '';
    if (Array.isArray(payload)) comments = payload; // legacy pre-URL blob: no gate
    else if (payload && Array.isArray(payload.comments)) { comments = payload.comments; srcUrl = payload.url || ''; }
    if (!comments) return 0;
    // Wrong page → decline rather than anchor onto whatever happens to match here.
    if (srcUrl && pageKey(srcUrl) !== pageKey()) {
      console.warn('[Specter] These comments are for ' + pageKey(srcUrl) + ' — not this page (' + pageKey() + '). Not imported.');
      return 0;
    }
    var added = 0;
    comments.forEach(function (item) {
      if (!item) return;
      var el = reFindShared(item), missing = false, reason = '';
      if (!el) { missing = true; reason = 'Couldn’t find this element on the page'; }
      else if (item.fp && fingerprint(el) !== item.fp) { missing = true; reason = 'This element changed — can’t place the comment'; }
      // body stays empty on purpose: comments-only, never the shared element's props.
      // A MISSING spec keeps el=null so it's never drawn or re-anchored via its path.
      var spec = { el: missing ? null : el, path: item.path || '', note: item.note || '', body: '', kind: item.kind || 'element', locate: '', shared: true, fp: item.fp || '', missing: missing, missReason: reason };
      specs.push(spec);
      createBadge(spec);
      added++;
    });
    renumber();
    reflowSpecs();
    updatePill();
    if (panelOpen) renderPanel();
    saveSpecs();
    return added;
  }

  // ── Transport: share link (#spx= fragment) ──────────────────────────────────
  // The link is destination AND payload — pasted into Slack it looks like a normal
  // URL; clicked, it lands the recipient on the exact page, so the URL gate is
  // satisfied automatically. base64url of the JSON (UTF-8 safe, no padding); the
  // split/join dodges regex escaping inside this template-literal client. Compression
  // + the too-big → file fallback are Step 5.
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b = btoa(bin).split('+').join('-').split('/').join('_');
    while (b.charAt(b.length - 1) === '=') b = b.slice(0, -1);
    return b;
  }
  function b64urlDecode(s) {
    s = s.split('-').join('+').split('_').join('/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // Build on the current page (keep query, replace any existing hash). A page that
  // uses hash routing itself conflicts with #spx= — that's the Step 5 file fallback.
  function buildShareLink() {
    return location.origin + location.pathname + location.search + '#spx=' + b64urlEncode(JSON.stringify(exportComments()));
  }

  // On load: if the URL carries #spx=, decode it, strip it from the address bar (so
  // the URL goes clean and a plain reload won't re-import), import, and surface it.
  function importFromHash() {
    var h = location.hash || '', k = h.indexOf('spx=');
    if (k < 0) return 0;
    var enc = h.slice(k + 4);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var json; try { json = b64urlDecode(enc); } catch (e) { return 0; }
    var n = importComments(json);
    if (n > 0) { if (!fiActive) activate(); showPanel(); }
    return n;
  }

  // Re-anchor if the node detached, then scroll it into view. Returns false when
  // the element can't be shown (removed / hidden — e.g. behind a closed modal).
  // The badge enlargement is handled separately via highlightSpec (sustained
  // while the panel row is hovered), so there's no transient ripple to miss.
  function revealSpec(spec) {
    if (!spec.el || !spec.el.isConnected) { var f = safeQuery(spec.path); if (f) spec.el = f; }
    if (!isVisible(spec.el)) return false;
    spec.el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    return true;
  }

  // "Visible" for the panel = renderable (connected, has a box, not display:none) —
  // NOT whether it's currently in the viewport. Off-screen is fine (that's what the
  // hover-scroll is for); only a removed / hidden element (e.g. a closed modal) greys out.
  function specVisible(spec) {
    if (!spec.el || !spec.el.isConnected) { var f = safeQuery(spec.path); if (f) spec.el = f; }
    return isVisible(spec.el);
  }

  // ─── Specs side panel (in-session review) ────────────────────────────────────
  var panelWrap = markUI(document.createElement('div'));
  Object.assign(panelWrap.style, {
    position: 'fixed', top: '0', right: '0', height: '100vh', width: '320px',
    maxWidth: '86vw', zIndex: '2147483645', boxSizing: 'border-box',
    transform: 'translateX(100%)', transition: 'transform 0.22s ease',
    display: 'flex', flexDirection: 'column',
    background: TIP_BG, color: '#fff', fontFamily: MONO,
    borderLeft: '1px solid rgba(173,36,211,0.5)', boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
  });

  var panelHead = document.createElement('div');
  Object.assign(panelHead.style, {
    display: 'flex', alignItems: 'center', gap: '8px', flexShrink: '0',
    padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  });
  var panelTitle = document.createElement('span');
  Object.assign(panelTitle.style, { fontSize: '13px', fontWeight: '700', letterSpacing: '0.02em' });
  var panelSpacer = document.createElement('span');
  panelSpacer.style.flex = '1';
  var panelClose = document.createElement('span');
  panelClose.textContent = '×';
  panelClose.title = 'Close panel (L)';
  Object.assign(panelClose.style, { cursor: 'pointer', fontSize: '20px', lineHeight: '1', padding: '0 4px', color: '#B9BBC2', flexShrink: '0' });
  panelClose.addEventListener('click', function (e) { e.stopPropagation(); hidePanel(); });
  hoverFx(panelClose, { color: '#fff', transform: 'scale(1.2)' }, { color: '#B9BBC2', transform: 'scale(1)' });
  panelHead.appendChild(panelTitle);
  panelHead.appendChild(panelSpacer);
  panelHead.appendChild(panelClose);

  // ── Batch actions toolbar (row under the title) ──
  var panelTools = document.createElement('div');
  Object.assign(panelTools.style, {
    display: 'flex', gap: '8px', alignItems: 'center', flexShrink: '0',
    padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  });

  // Status dot: Specs auto-sync to the Claude bridge; this shows the connection
  // (● synced / ○ offline). Click to force a re-sync. Only shown when a bridge is set.
  var syncDot = document.createElement('div');
  Object.assign(syncDot.style, {
    display: BRIDGE ? 'flex' : 'none', alignItems: 'center', gap: '7px', flex: '1',
    fontSize: '11px', color: LABEL, cursor: 'pointer', userSelect: 'none',
  });
  syncDot.title = 'Specs auto-sync to Claude — click to re-sync now';
  var dot = document.createElement('span');
  Object.assign(dot.style, { width: '8px', height: '8px', borderRadius: '999px', background: '#6B7280', flexShrink: '0', transition: 'background 0.2s ease' });
  var dotLabel = document.createElement('span');
  dotLabel.textContent = 'Bridge offline';
  syncDot.appendChild(dot);
  syncDot.appendChild(dotLabel);
  syncDot.addEventListener('click', function (e) { e.stopPropagation(); doSync(); });

  // Icon-only round button with a native tooltip (title). No label reveal — the
  // hover-expanding text read as janky, so we let the browser tooltip do it.
  function iconPill(svg, title, idleColor, accentRGB) {
    var btn = document.createElement('button');
    btn.title = title;
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      color: idleColor, background: 'transparent', border: '1px solid rgba(' + accentRGB + ',0.5)',
      borderRadius: '999px', width: '32px', height: '32px', padding: '0', flexShrink: '0',
      transition: 'background 0.12s ease, color 0.12s ease',
    });
    var ic = document.createElement('span'); ic.innerHTML = svg;
    Object.assign(ic.style, { display: 'flex', alignItems: 'center' });
    btn.appendChild(ic);
    btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(' + accentRGB + ',0.16)'; btn.style.color = '#fff'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'transparent'; btn.style.color = idleColor; });
    return { btn: btn, icon: ic };
  }

  // Copy all → clipboard. Icon flashes to a check on success.
  var copyAll = iconPill(COPY, 'Copy all', '#E0A3F5', '224,163,245');
  copyAll.btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!specs.length) return;
    navigator.clipboard.writeText(buildSpecsCopyText()).then(function () {
      copyAll.icon.innerHTML = CHECK; copyAll.btn.style.color = GREEN;
      setTimeout(function () { copyAll.icon.innerHTML = COPY; copyAll.btn.style.color = copyAll.btn.matches(':hover') ? '#fff' : '#E0A3F5'; }, 1200);
    }).catch(function () {});
  });

  // Delete all → confirm popover → removeAllSpecs.
  var delAll = iconPill(TRASH, 'Delete all annotations', '#ED8FA6', '237,62,97');
  delAll.btn.addEventListener('click', function (e) { e.stopPropagation(); confirmDeleteAll(delAll.btn); });

  var copyAllBtn = copyAll.btn; // renderPanel toggles these by spec count
  var deleteAllBtn = delAll.btn;
  if (BRIDGE) panelTools.appendChild(syncDot);
  else { var sp = document.createElement('span'); sp.style.flex = '1'; panelTools.appendChild(sp); }
  panelTools.appendChild(copyAllBtn);
  panelTools.appendChild(deleteAllBtn);

  // ── "Delete all?" confirmation popover (Specter's own UI) ──
  var confirmPop = null;
  function closeConfirm() {
    if (confirmPop) { confirmPop.remove(); confirmPop = null; document.removeEventListener('mousedown', onConfirmOutside, true); }
  }
  function onConfirmOutside(e) { if (confirmPop && !confirmPop.contains(e.target)) closeConfirm(); }
  function confirmDeleteAll(anchor) {
    closeConfirm();
    if (!specs.length) return;
    var pop = markUI(document.createElement('div'));
    Object.assign(pop.style, {
      position: 'fixed', zIndex: '2147483647', boxSizing: 'border-box', width: '230px',
      background: TIP_BG, border: '1px solid ' + PURPLE, borderRadius: '8px', padding: '14px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.45)', fontFamily: MONO,
    });
    var msg = document.createElement('div');
    msg.textContent = 'Delete all ' + specs.length + (specs.length === 1 ? ' annotation?' : ' annotations?');
    Object.assign(msg.style, { fontSize: '12px', lineHeight: '17px', color: '#fff', marginBottom: '12px' });
    var btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });
    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    Object.assign(cancel.style, { cursor: 'pointer', fontFamily: MONO, fontSize: '11px', fontWeight: '600', color: '#B9BBC2', background: 'transparent', border: 'none', borderRadius: '999px', padding: '6px 10px' });
    cancel.addEventListener('click', function (e) { e.stopPropagation(); closeConfirm(); });
    hoverFx(cancel, { color: '#fff' }, { color: '#B9BBC2' });
    var confirm = document.createElement('button');
    confirm.textContent = 'Delete all';
    Object.assign(confirm.style, { cursor: 'pointer', fontFamily: MONO, fontSize: '11px', fontWeight: '700', color: '#fff', background: RED, border: 'none', borderRadius: '999px', padding: '6px 12px' });
    confirm.addEventListener('click', function (e) { e.stopPropagation(); closeConfirm(); removeAllSpecs(); });
    hoverFx(confirm, { background: '#C42D4E' }, { background: RED });
    btnRow.appendChild(cancel); btnRow.appendChild(confirm);
    pop.appendChild(msg); pop.appendChild(btnRow);
    document.body.appendChild(pop);
    // Anchor below the delete-all button, right-aligned, clamped to viewport.
    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight, m = 8;
    var left = Math.min(Math.max(r.right - w, m), window.innerWidth - w - m);
    var top = Math.min(r.bottom + 6, window.innerHeight - h - m);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    confirmPop = pop;
    setTimeout(function () { document.addEventListener('mousedown', onConfirmOutside, true); }, 0);
  }

  // Guidance line — tells the user what to actually DO with their annotations.
  var panelHint = document.createElement('div');
  Object.assign(panelHint.style, {
    display: 'none', fontSize: '11px', lineHeight: '17px', color: LABEL,
    padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  });
  function setHint() {
    panelHint.textContent = '';
    if (!specs.length) { panelHint.style.display = 'none'; return; }
    panelHint.style.display = 'block';
    var code = function (t) { var s = document.createElement('span'); s.textContent = t; Object.assign(s.style, { color: '#E0A3F5', fontWeight: '700' }); return s; };
    if (BRIDGE) {
      panelHint.appendChild(document.createTextNode('Switch to Claude Code and run '));
      panelHint.appendChild(code('/spectify'));
      panelHint.appendChild(document.createTextNode(' — it applies these annotations to your code. You can also edit or delete each one above.'));
    } else {
      panelHint.appendChild(document.createTextNode('Press '));
      panelHint.appendChild(code('Cmd+C'));
      panelHint.appendChild(document.createTextNode(' (or Copy all) and paste into Claude to apply these annotations. You can also edit or delete each one above.'));
    }
  }

  var panelList = document.createElement('div');
  // overscroll-behavior:contain stops the panel's scroll from chaining into the page.
  Object.assign(panelList.style, { flex: '1', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' });

  // Keyboard shortcuts reference — collapsible, collapsed by default, lives here (not
  // in the pill) so the pill stays short.
  var panelKeys = document.createElement('div');
  Object.assign(panelKeys.style, {
    flexShrink: '0', fontSize: '11px', lineHeight: '18px', color: LABEL,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  });
  (function () {
    var rows = [
      ['P', 'mark / comment the hovered element'],
      ['C', 'toggle Comment mode (hide properties)'],
      ['\\u2325 Option', 'toggle Measure mode'],
      ['M', 'pin an element to measure from'],
      ['Cmd/Ctrl+C', 'copy all Specs'],
      ['L', 'toggle this panel'],
    ];
    var head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '6px', color: '#8A8D96', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', padding: '10px 16px', cursor: 'pointer', userSelect: 'none' });
    var caret = document.createElement('span');
    caret.textContent = '\\u203A'; // ›
    Object.assign(caret.style, { display: 'inline-block', fontSize: '16px', lineHeight: '1', transition: 'transform 0.15s ease', transform: 'rotate(0deg)' });
    var headText = document.createElement('span');
    headText.textContent = 'Keyboard shortcuts';
    head.appendChild(caret);
    head.appendChild(headText);
    var body = document.createElement('div');
    Object.assign(body.style, { display: 'none', padding: '0 16px 12px' }); // collapsed by default
    rows.forEach(function (r) {
      var row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '8px', marginBottom: '2px' });
      var k = document.createElement('span');
      k.textContent = r[0];
      Object.assign(k.style, { color: '#E0A3F5', fontWeight: '700', minWidth: '78px', flexShrink: '0' });
      var d = document.createElement('span');
      d.textContent = r[1];
      row.appendChild(k); row.appendChild(d);
      body.appendChild(row);
    });
    var open = false;
    head.addEventListener('click', function (e) {
      e.stopPropagation();
      open = !open;
      body.style.display = open ? 'block' : 'none';
      caret.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
    });
    panelKeys.appendChild(head);
    panelKeys.appendChild(body);
  })();

  panelWrap.appendChild(panelHead);
  panelWrap.appendChild(panelTools);
  panelWrap.appendChild(panelHint);
  panelWrap.appendChild(panelList);
  panelWrap.appendChild(panelKeys);
  document.body.appendChild(panelWrap);

  // Panel scroll and page scroll are mutually exclusive: wheel over the scrollable list
  // scrolls it natively (overscroll-behavior:contain stops it chaining at the bounds);
  // wheel over any non-scrolling part of the panel never scrolls the page behind it.
  panelWrap.addEventListener('wheel', function (e) {
    var canScroll = panelList.scrollHeight > panelList.clientHeight;
    if (panelList.contains(e.target) && canScroll) return; // let the list scroll natively
    e.preventDefault();
  }, { passive: false });

  // ── Auto-sync: mirror the browser's current Specs to the local bridge ──
  // Debounced so rapid edits/typing collapse into one POST. The bridge replaces
  // its snapshot for this URL, so it always reflects what's in the panel — no
  // button to press; Claude pulls whatever's current when you run /spectify.
  var syncTimer = null;
  function setSyncState(s) {
    if (!BRIDGE) return;
    setPillSync(s);     // control-bar dot
    applyDotState(dot, s); // side-panel dot — same spinner/green/red
    if (s === 'syncing') { dotLabel.textContent = 'Syncing…'; }
    else if (s === 'synced') { dotLabel.textContent = specs.length ? (specs.length + (specs.length === 1 ? ' Spec synced' : ' Specs synced')) : 'Synced'; }
    else { dotLabel.textContent = 'Bridge offline'; }
  }
  function doSync() {
    if (!BRIDGE) return;
    setSyncState('syncing');
    // Keep the spinner up for at least 1s even on an instant localhost sync, so the
    // feedback is actually perceptible instead of flashing by.
    var started = Date.now();
    var settle = function (state) {
      var wait = Math.max(0, 1000 - (Date.now() - started));
      setTimeout(function () { setSyncState(state); }, wait);
    };
    var payload = {
      url: location.href,
      text: buildSpecsCopyText(),
      specs: groupSpecs().map(function (g, i) {
        return { num: i + 1, note: g.specs.map(function (s) { return s.note; }).filter(Boolean).join('\\n'), kind: g.kind, body: g.specs[0].body };
      }),
    };
    fetch(BRIDGE + '/specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function () { settle('synced'); })
      .catch(function () { settle('offline'); });
  }
  function scheduleSync() {
    if (!BRIDGE) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(doSync, 500);
  }

  function renderPanel() {
    panelTitle.textContent = specs.length + (specs.length === 1 ? ' Spec' : ' Specs');
    panelTools.style.display = (specs.length || BRIDGE) ? 'flex' : 'none';
    copyAllBtn.style.display = specs.length ? 'inline-flex' : 'none';
    deleteAllBtn.style.display = specs.length ? 'inline-flex' : 'none';
    setHint();
    panelList.textContent = '';
    if (!specs.length) {
      var empty = document.createElement('div');
      empty.textContent = 'No Specs yet — hover an element and press P.';
      Object.assign(empty.style, { padding: '24px 16px', fontSize: '12px', lineHeight: '18px', color: LABEL });
      panelList.appendChild(empty);
      return;
    }
    var focusEditor = null, measures = [];
    specs.forEach(function (spec, i) {
      var missing = !!spec.missing;
      var visible = missing ? false : specVisible(spec); // don't specVisible() a missing spec — it would re-anchor via path
      var editing = (panelEditSpec === spec);
      var row = document.createElement('div');
      Object.assign(row.style, {
        position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '12px', boxSizing: 'border-box',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        opacity: '1', transition: 'background 0.12s ease',
      });
      var badge = document.createElement('span');
      badge.textContent = String(i + 1);
      Object.assign(badge.style, {
        flexShrink: '0', width: '20px', height: '20px', borderRadius: '999px',
        background: BADGE_IDLE, color: '#fff', fontSize: '11px', fontWeight: '700',
        border: '1px solid #fff', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s ease',
      });
      var content = document.createElement('div');
      Object.assign(content.style, { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '30px' });

      var selName = (spec.el && spec.el.tagName) ? getSelector(spec.el) : (spec.path.split('>').pop() || '').trim();
      var meta = document.createElement('div');
      Object.assign(meta.style, { fontSize: '11px', color: LABEL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
      meta.textContent = selName;

      if (editing) {
        // ── UPDATE: inline editor ──
        var ta = document.createElement('textarea');
        ta.value = spec.note || '';
        ta.placeholder = 'Describe the change…';
        Object.assign(ta.style, {
          width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)',
          border: '1px solid ' + PURPLE, borderRadius: '6px', fontFamily: MONO,
          fontSize: '14px', lineHeight: '20px', padding: '8px', resize: 'none', outline: 'none',
          overflow: 'hidden', minHeight: '56px',
        });
        // Form controls are the one thing arbitrary pages style hard — force white with
        // !important (and -webkit-text-fill-color, which otherwise wins over the color).
        ta.style.setProperty('color', '#fff', 'important');
        ta.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
        ta.style.setProperty('caret-color', '#fff', 'important');
        var grow = function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
        ta.addEventListener('input', grow);
        var saveEdit = function () { spec.note = ta.value.trim(); updateBadgeContent(spec); panelEditSpec = null; saveSpecs(); updatePill(); };
        var cancelEdit = function () { panelEditSpec = null; renderPanel(); };
        ta.addEventListener('keydown', function (ev) {
          ev.stopPropagation();
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); saveEdit(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancelEdit(); }
        });
        var editActions = document.createElement('div');
        Object.assign(editActions.style, { display: 'flex', gap: '8px', alignItems: 'center' });
        var saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        Object.assign(saveBtn.style, { cursor: 'pointer', fontFamily: MONO, fontSize: '11px', fontWeight: '600', color: '#fff', background: PURPLE, border: 'none', borderRadius: '999px', padding: '5px 12px' });
        saveBtn.addEventListener('click', function (e) { e.stopPropagation(); saveEdit(); });
        hoverFx(saveBtn, { background: '#C13AE0' }, { background: PURPLE });
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, { cursor: 'pointer', fontFamily: MONO, fontSize: '11px', fontWeight: '600', color: '#B9BBC2', background: 'transparent', border: 'none', borderRadius: '999px', padding: '5px 8px' });
        // mousedown+preventDefault so the textarea's blur-save doesn't beat the cancel
        cancelBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); cancelEdit(); });
        hoverFx(cancelBtn, { color: '#fff' }, { color: '#B9BBC2' });
        editActions.appendChild(saveBtn);
        editActions.appendChild(cancelBtn);
        content.appendChild(ta);
        content.appendChild(meta);
        content.appendChild(editActions);
        row.appendChild(badge);
        row.appendChild(content);
        focusEditor = function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); grow(); };
      } else {
        // ── READ: note (collapsed by default, expandable) ──
        var expanded = !!spec._expanded;
        var note = document.createElement('div');
        // Built UNCLAMPED so its true height is measurable after it's in the DOM;
        // the clamp is applied in the post-render measure pass below (only when the
        // note actually overflows two lines — otherwise no chevron is shown).
        Object.assign(note.style, {
          fontSize: '14px', lineHeight: '20px', color: spec.note ? '#fff' : LABEL,
          overflow: 'hidden', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
          cursor: spec.note ? 'pointer' : 'default',
        });
        note.textContent = spec.note || (spec.kind === 'measure' ? '⬡ measurement' : '— no note —');

        // Floated into the top-right corner so they don't reserve note width. On hover
        // they get a background that fades in from the left, masking the note text behind
        // them (instead of overlapping it). paddingLeft is the fade gutter.
        var actions = document.createElement('div');
        Object.assign(actions.style, { position: 'absolute', top: '10px', right: '14px', display: 'flex', gap: '2px', alignItems: 'center', paddingLeft: '22px', borderRadius: '6px' });
        var mkIcon = function (svg, title, color, onClick, onHover) {
          var b = document.createElement('span');
          b.innerHTML = svg; b.title = title;
          Object.assign(b.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', color: color, flexShrink: '0' });
          hoverFx(b, onHover || { background: 'rgba(255,255,255,0.14)', color: '#fff' }, { background: 'transparent', color: color });
          b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
          return b;
        };

        // Show an expand toggle only when the collapsed note actually overflows.
        var chev = mkIcon(CHEV, expanded ? 'Collapse' : 'Expand', '#B9BBC2', function () { spec._expanded = !spec._expanded; renderPanel(); });
        chev.firstChild.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        var editBtn = mkIcon(PENCIL, 'Edit note', '#B9BBC2', function () { panelEditSpec = spec; spec._expanded = true; renderPanel(); });
        var delBtn = mkIcon(TRASH, 'Delete Spec', '#ED8FA6', function () { removeSpec(spec); }, { background: 'rgba(237,62,97,0.30)', color: '#fff' });
        // Edit + delete reveal only on row hover; the expand chevron stays rightmost
        // and fixed (edit/delete appear to its left, so it never shifts).
        editBtn.style.display = delBtn.style.display = 'none';
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        actions.appendChild(chev);

        content.appendChild(note);
        content.appendChild(meta);

        // Shared comment whose target is gone/changed: MISSING (greyed, reason shown,
        // never drawn on the page — design: show missing, don't guess a spot).
        if (missing) {
          row.style.opacity = '0.7';
          var mbar = document.createElement('div');
          Object.assign(mbar.style, { display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px', flexWrap: 'wrap' });
          var mtag = document.createElement('span');
          mtag.textContent = 'MISSING';
          Object.assign(mtag.style, { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', color: '#fff', background: '#8B4A57', borderRadius: '4px', padding: '2px 6px', flexShrink: '0' });
          var mhint = document.createElement('span');
          mhint.textContent = spec.missReason || 'Not on this page';
          Object.assign(mhint.style, { fontSize: '11px', color: '#C9CBD2', overflow: 'hidden', textOverflow: 'ellipsis' });
          mbar.appendChild(mtag);
          mbar.appendChild(mhint);
          content.appendChild(mbar);
        }
        // Hidden element (e.g. inside a closed modal): flag it and say how to reveal it,
        // so hidden Specs are findable in a long list instead of silently unreachable.
        else if (!visible) {
          var hbar = document.createElement('div');
          Object.assign(hbar.style, { display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px', flexWrap: 'wrap' });
          var tag = document.createElement('span');
          tag.textContent = 'HIDDEN';
          Object.assign(tag.style, { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', color: '#3A2A05', background: '#F59E0B', borderRadius: '4px', padding: '2px 6px', flexShrink: '0' });
          var hint = document.createElement('span');
          hint.textContent = spec.locate || 'Not on the page right now';
          Object.assign(hint.style, { fontSize: '11px', color: '#C9CBD2', overflow: 'hidden', textOverflow: 'ellipsis' });
          hbar.appendChild(tag);
          hbar.appendChild(hint);
          content.appendChild(hbar);
        }

        row.appendChild(badge);
        row.appendChild(content);
        row.appendChild(actions);

        note.addEventListener('click', function (e) { if (spec.note) { e.stopPropagation(); spec._expanded = !spec._expanded; renderPanel(); } });
        row.addEventListener('mouseenter', function () {
          row.style.background = 'rgba(255,255,255,0.05)';
          badge.style.background = PURPLE;
          editBtn.style.display = delBtn.style.display = 'flex';
          actions.style.background = 'linear-gradient(to right, rgba(52,54,60,0) 0, rgba(52,54,60,1) 22px)';
          if (visible) { highlightSpec = spec; revealSpec(spec); }
        });
        row.addEventListener('mouseleave', function () {
          row.style.background = 'transparent';
          badge.style.background = BADGE_IDLE;
          editBtn.style.display = delBtn.style.display = 'none';
          actions.style.background = 'transparent';
          if (highlightSpec === spec) highlightSpec = null;
        });

        if (expanded) chev.style.transform = ''; // note stays unclamped; chevron collapses it
        else measures.push({ note: note, chev: chev }); // measured after all rows are in the DOM
      }
      panelList.appendChild(row);
    });

    // Measure pass — now that rows are laid out, clamp collapsed notes that overflow
    // 2 lines and hide the expand chevron on notes that fit.
    measures.forEach(function (m) {
      if (m.note.scrollHeight > 42) { // > two 20px lines (+2 slack)
        m.note.style.display = '-webkit-box';
        m.note.style.whiteSpace = 'normal';
        m.note.style.setProperty('-webkit-box-orient', 'vertical');
        m.note.style.setProperty('-webkit-line-clamp', '2');
      } else {
        m.chev.style.display = 'none';
      }
    });
    if (focusEditor) setTimeout(focusEditor, 0);
  }

  function showPanel() { panelOpen = true; renderPanel(); panelWrap.style.transform = 'translateX(0)'; if (BRIDGE) doSync(); }
  function hidePanel() { panelOpen = false; panelEditSpec = null; panelWrap.style.transform = 'translateX(100%)'; }
  function togglePanel() { if (panelOpen) hidePanel(); else if (fiActive) showPanel(); }

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
    hoverFx(del, { color: '#fff', background: 'rgba(237,62,97,0.35)' }, { color: '#ED8FA6', background: 'transparent' });
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
      saveSpecs();
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
        fontSize: '12px',
        fontFamily: MONO,
        padding: '2px 5px',
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
    var lines = ['[Specter Measure]', '<' + el.tagName.toLowerCase() + '> ' + Math.round(tr.width) + '×' + Math.round(tr.height), 'find: ' + resolveLocator(el)];
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
    lines.push('  find: ' + resolveLocator(fromEl));
    lines.push('To:   <' + tTag + '>' + (tComp ? ' ' + tComp : '') + ' ' + Math.round(tr.width) + '×' + Math.round(tr.height));
    lines.push('  find: ' + resolveLocator(toEl));

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

    // Comment mode: outline only (so you know what you're commenting on), no
    // properties/measure overlay on screen. The Spec still captures everything.
    if (commentMode) {
      clearMeasureOverlay();
      clearMeasureTargetHL();
      setHoverOutline(target);
      hideTooltip();
      return;
    }

    if (measureMode) {
      clearHoverOutline();
      showMeasureTargetHL(target);
      // Draw the on-screen measurement overlay (the px badges + lines) but keep
      // the dark readout box hidden — it occludes the very measurements it reports.
      // The full readout still copies with Cmd+C. (Properties mode keeps its box.)
      if (pinEl && pinEl !== target) measureBetween(pinEl, target); else measureToNeighbor(target);
      hideTooltip();
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

    // Spec editor open (on-page OR panel inline): let the textarea own its keys
    // (Enter/Esc, native copy, the letter "p") — never treat them as shortcuts.
    if (editorEl || panelEditSpec) return;

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

    // L — toggle the Specs review panel.
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      togglePanel();
      return;
    }

    // C — toggle Comment mode (outline only; props/measure hidden but still captured).
    // Plain c only — Cmd/Ctrl+C copy was handled above and returned.
    if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      commentMode = !commentMode;
      if (commentMode && measureMode) { measureMode = false; clearPin(); }
      clearMeasureOverlay();
      clearMeasureTargetHL();
      clearHoverOutline();
      hideTooltip();
      if (lastHovered && commentMode) setHoverOutline(lastHovered);
      flashMode();
      return;
    }

    // Esc only HIDES the plugin — Specs persist and return on reactivate.
    if (e.key === 'Escape') {
      if (panelOpen) { hidePanel(); return; }
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

  // Remember the last interactive control the user clicked (not Specter's own UI).
  // If they open a modal then annotate inside it, this is the opener — used to tell
  // them how to reveal a Spec whose element is later hidden.
  document.addEventListener('click', function (e) {
    try {
      if (isUI(e.target)) return;
      var b = e.target.closest && e.target.closest('button, a, [role="button"], summary, [type="button"], [type="submit"]');
      if (!b) return;
      var t = (b.getAttribute('aria-label') || b.textContent || '').replace(/\\s+/g, ' ').trim();
      if (t) lastClick = { label: t.slice(0, 40), at: Date.now() };
    } catch (err) {}
  }, true);

  window.__specterToggle = function() { if (fiActive) deactivate(); else activate(); };

  // Step 1 test hooks (temporary — real UI comes in Step 6). In the demo console:
  //   var blob = JSON.stringify(__specterExportComments())   // A: capture comments
  //   __specterImportComments(blob)                          // B: re-place them
  window.__specterExportComments = function() { return exportComments(); };
  window.__specterImportComments = function(p) { return importComments(p); };
  window.__specterShareLink = function() { return buildShareLink(); };

  var _rt = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
  if (_rt && _rt.onMessage) {
    _rt.onMessage.addListener(function(msg) {
      if (msg && msg.type === 'specter-toggle') window.__specterToggle();
    });
  }

  restoreSpecs();   // rebuild any Specs saved from a previous load of this URL
  importFromHash(); // if arrived via a #spx= share link, import + reveal the shared comments
  scheduleSync();   // mirror restored Specs to the Claude bridge on load

  console.log('%c👻 Specter — Ctrl+Option+Z to toggle', 'color:#aaa;font-size:11px;');
})();`;
}
