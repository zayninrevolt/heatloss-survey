module.exports = function measureContrast() {
  const rgba = (text) => {
    const n = (String(text).match(/[\d.]+/g) || []).map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n.length > 3 ? n[3] : 1];
  };
  const over = (c, b) => c.slice(0, 3).map((x, i) => x * c[3] + b[i] * (1 - c[3]));
  function background(e) {
    const chain = [];
    for (let p = e; p; p = p.parentElement) chain.push(p);
    return chain.reverse().reduce((b, p) => over(rgba(getComputedStyle(p).backgroundColor), b), [255, 255, 255]);
  }
  const luminance = (c) => c.map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  function selector(e) {
    if (e.id) return '#' + CSS.escape(e.id);
    const parts = [];
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      if (p.id) { parts.unshift('#' + CSS.escape(p.id)); break; }
      const tag = p.tagName.toLowerCase();
      const siblings = p.parentElement ? [...p.parentElement.children].filter((x) => x.tagName === p.tagName) : [];
      parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(p) + 1) + ')');
    }
    return parts.join(' > ');
  }
  const failures = [], measured = [];
  for (const e of document.querySelectorAll('body *')) {
    // SVG glyphs have painted shapes behind them; ancestor CSS is not their background.
    // Checkboxes/radios do not render their internal value as visible text.
    if (e.closest('.sheet') || e instanceof SVGElement || e.matches('input[type=checkbox], input[type=radio], input[type=hidden]')) continue;
    if (['SCRIPT','STYLE','NOSCRIPT','OPTION'].includes(e.tagName) || !e.getClientRects().length || e.matches(':disabled') || e.closest('[aria-disabled="true"]')) continue;
    const rect = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (rect.width <= 1 || rect.height <= 1 || s.visibility === 'hidden') continue;
    let opacity = 1;
    for (let p = e; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
    if (!opacity) continue;
    let text = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
    let colour = s.color, kind = 'text';
    if (['INPUT','TEXTAREA','SELECT'].includes(e.tagName)) {
      text = e.tagName === 'SELECT' ? (e.selectedOptions[0]?.textContent || '') : e.value;
      kind = 'control';
      if (!text && e.getAttribute('placeholder')) { text = e.getAttribute('placeholder'); colour = getComputedStyle(e, '::placeholder').color; kind = 'placeholder'; }
    }
    if (e.tagName.toLowerCase() === 'text') { colour = s.fill; kind = 'svg-text'; }
    if (!text) continue;
    const b = background(e), f = rgba(colour); f[3] *= opacity;
    const l = [luminance(over(f, b)), luminance(b)].sort((a, b) => b - a);
    const ratio = (l[0] + 0.05) / (l[1] + 0.05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    const required = large || /^[×✕▾▴‹›+−]$/.test(text) ? 3 : 4.5;
    const row = { selector: selector(e), tag: e.tagName, id: e.id, classes: String(e.className?.baseVal ?? e.className), text: text.replace(/\s+/g, ' ').slice(0, 160), ratio, required, foreground: colour, background: b.map(Math.round), kind, opacity };
    measured.push(row);
    if (ratio + 0.005 < required) failures.push(row);
  }
  return { theme: localStorage.getItem('surveyTheme'), bodyClass: document.body.className, measuredCount: measured.length, failures: failures.sort((a,b) => a.ratio-b.ratio), workspace: { editors: document.querySelectorAll('.hl-room-editor').length, active: document.querySelectorAll('.hl-room-editor.is-active').length, visible: [...document.querySelectorAll('.hl-room-editor')].filter(e => e.getClientRects().length).length } };
};
