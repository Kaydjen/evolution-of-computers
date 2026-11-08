// Credits panel: author, source and licence of every image (CC BY / CC BY-SA need the author's name). Data: js/credits-data.js.
(function () {
  var btn = document.getElementById('credits-btn');
  var panel = document.getElementById('credits');
  var t = function (k) { return window.I18N.t(k); };
  var opener = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function link(href, text) {
    var a = el('a', '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  // The list is built on every opening, so it always follows the current language.
  function build() {
    var names = window.I18N.cards().map(function (c) { return c.name; });
    panel.textContent = '';
    var box = el('div', 'credits-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'credits-title');
    var head = el('div', 'credits-head');
    var h = el('h2', '', t('Image credits'));
    h.id = 'credits-title';
    var close = el('button', 'credits-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', hide);
    head.appendChild(h);
    head.appendChild(close);

    var list = el('div', 'credits-list');
    window.CREDITS.forEach(function (x) {
      var row = el('div', 'credits-row');
      var img = document.createElement('img');
      img.src = x.local;
      img.alt = '';
      img.loading = 'lazy';
      var what = el('div', 'credits-what');
      what.appendChild(el('strong', '', names[x.n - 1]));
      what.appendChild(link(x.page, x.title));
      var who = el('div', 'credits-who', x.author);
      var lic = el('div', 'credits-lic');
      lic.appendChild(x.licenceUrl ? link(x.licenceUrl, x.licence) : document.createTextNode(x.licence));
      [img, what, who, lic].forEach(function (n) { row.appendChild(n); });
      list.appendChild(row);
    });
    var note = el('p', 'credits-note', t('Images are scaled; some are cropped.'));
    box.appendChild(head);
    box.appendChild(list);
    box.appendChild(note);
    panel.appendChild(box);
    return close;
  }

  function show() {
    opener = document.activeElement;
    var close = build();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('credits-open');
    close.focus();
  }
  function hide() {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('credits-open');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  btn.addEventListener('click', show);
  panel.addEventListener('click', function (e) { if (e.target === panel) hide(); });
  // Capture phase: the arrow keys must not move the timeline while the panel is open.
  addEventListener('keydown', function (e) {
    if (panel.hidden) return;
    if (e.key === 'Escape') { hide(); e.stopPropagation(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
  }, true);

})();
