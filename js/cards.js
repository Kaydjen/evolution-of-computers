// Builds the DOM of one card from its data (window.CARDS) and optional images (window.MEDIA).
(function () {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
    return parent;
  }
  var t = function (k) { return window.I18N.t(k); };   // interface string in the current language
  function block(title, tag, cls) {
    return el(tag || 'h3', cls, t(title));
  }
  function para(text) { return el('p', '', text); }
  function lines(list) {
    var p = el('p');
    list.forEach(function (t, i) {
      if (i) p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode(t));
    });
    return p;
  }

  // An image frame; without a picture it stays an empty neutral block.
  function frame(img, kind, alt) {
    var f = el('div', 'media' + (kind ? ' ' + kind : ''));
    if (img && img.src) {
      var i = document.createElement('img');
      i.src = img.src;
      i.alt = alt || img.alt || '';
      if (img.aspect) f.style.aspectRatio = img.aspect;   // a frame cut to the picture (no bars)
      i.loading = 'lazy';
      f.appendChild(i);
    } else {
      f.classList.add('empty');
      f.setAttribute('aria-hidden', 'true');
    }
    return f;
  }

  function side(title, content, accent) {
    var cell = el('div', 'cell'), box = el('div', 'side');
    add(box, block(title, 'h3', accent ? 'accent' : ''), content);
    return add(cell, box);
  }
  // accent: 'h2' = large accent heading (Breakthrough), 'h3' = small accent heading, falsy = plain small heading
  function centre(title, content, accent) {
    var cell = el('div', 'cell');
    var h = block(title, accent === 'h2' ? 'h2' : 'h3', accent ? 'accent' : '');
    var nodes = [].concat(content);
    add(cell, h);
    nodes.forEach(function (n) { cell.appendChild(n); });
    return cell;
  }
  function steps(p) {
    var box = el('div', 'steps'), ol = el('ol');
    p.steps.forEach(function (s) { ol.appendChild(el('li', '', s)); });
    return add(box, para(p.lead), ol);
  }

  function panel(c) {
    var outer = el('div', 'panel'), clip = el('div'), inner = el('div', 'panel-inner');
    outer.id = 'panel-' + c.n;
    c.more.forEach(function (m) {
      if (m.kind === 'compare') {
        inner.appendChild(el('h3', 'row-title', c.compare.title));
        var grid = el('div', 'compare');
        c.compare.rows.forEach(function (r) {
          add(grid, el('span', 'name', r.name), el('span', 'eq', r.eq), el('span', 'val', r.value));
        });
        inner.appendChild(grid);
      } else {
        add(inner, el('h3', '', m.key ? t(m.key) : m.label), para(m.text));
      }
    });
    return add(outer, add(clip, inner));
  }

  function render(c) {
    var media = (window.MEDIA && window.MEDIA[c.n]) || {};
    var card = el('article', 'card ' + c.type);
    var alt = function (kind, i) {
      var m = kind === 'diagram' ? media.diagram : media.photo && media.photo[i];
      return window.I18N.alt(c.n, kind, i, m && m.alt);
    };
    var main = el('div', 'main');
    card.setAttribute('aria-label', c.name);

    if (c.type === 'generation') {
      if (c.captions.length) {
        var photos = el('div', 'photos');
        photos.style.setProperty('--n', c.captions.length);
        c.captions.forEach(function (cap, i) {
          var fig = el('figure');
          add(fig, frame(media.photo && media.photo[i], '', alt('photo', i)), el('figcaption', '', cap));
          photos.appendChild(fig);
        });
        main.appendChild(photos);
      }
      main.appendChild(el('div', 'kicker', c.kicker));
    } else {
      var top = el('div', 'top');
      var mid = c.type === 'mechanism'
        ? centre('Breakthrough', para(c.breakthrough), 'h2')
        : centre('Principle', steps(c.principle), false);
      mid.className = 'center-top';
      // A missing picture leaves no frame: the layout adapts to what exists.
      var photo = media.photo && media.photo[0], hasPhoto = !!(photo && photo.src), hasDiagram = !!(media.diagram && media.diagram.src);
      if (hasPhoto) top.appendChild(frame(photo, '', alt('photo', 0)));
      top.appendChild(mid);
      if (hasDiagram) top.appendChild(frame(media.diagram, 'diagram', alt('diagram')));
      top.classList.add(hasPhoto && hasDiagram ? 'both' : hasPhoto ? 'solo' : hasDiagram ? 'nophoto' : 'bare');
      main.appendChild(top);
    }

    add(main, el('h1', '', c.name), el('div', 'meta', c.meta));

    var bottom = el('div', 'bottom');
    if (c.type === 'mechanism') {
      add(bottom, wrapCould(c), centre('Principle', para(c.principle)), side('Influence', para(c.influence)));
    } else if (c.type === 'generation') {
      add(bottom, side('Breakthrough', para(c.breakthrough)), centre('Principle', para(c.principle), 'h3'), side('Influence', para(c.influence)));
    } else {
      var parts = c.parts.map(function (p) { return p.name + ': ' + p.role; });
      add(bottom, side('Parts', lines(parts)), centre('Breakthrough', para(c.breakthrough), 'h2'), side('Influence', para(c.influence)));
    }
    main.appendChild(bottom);

    var more = el('div', 'more'), btn = el('button', '', t('Interesting'));
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'panel-' + c.n);
    var pn = panel(c);
    pn.inert = true;   // a closed panel is hidden from keyboard and screen readers
    var isOpen = false, run = 0;
    // The card grows or shrinks by animating its own height (the card is centred, so it moves smoothly with it).
    // On closing, the scroll position runs to the top with the same easing, so there is no jump even from the bottom.
    // The panel itself switches at once, so nothing reflows while the height changes.
    var ease = function (u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    btn.addEventListener('click', function () {
      isOpen = !isOpen;
      cancelWheel();
      var token = ++run;
      var from = card.offsetHeight, scroll0 = card.scrollTop;   // what the user sees right now
      pn.classList.add('open');                        // measure the target with the panel open ...
      card.style.height = '';
      var openH = card.offsetHeight;
      pn.classList.remove('open');                     // ... and closed
      var closedH = card.offsetHeight;
      var to = isOpen ? openH : closedH;
      pn.classList.add('open');                        // during the move the panel content stays in place
      pn.inert = !isOpen;
      btn.setAttribute('aria-expanded', isOpen);
      var t0 = performance.now(), DUR = 350;
      card.style.height = from + 'px';
      card.scrollTop = scroll0;
      function step(now) {
        if (token !== run) return;
        var u = Math.min(1, (now - t0) / DUR), e = ease(u);
        card.style.height = (from + (to - from) * e) + 'px';
        if (!isOpen) card.scrollTop = scroll0 * (1 - e);
        if (u < 1) { requestAnimationFrame(step); return; }
        card.style.height = '';
        pn.classList.toggle('open', isOpen);
        if (!isOpen) card.scrollTop = 0;
      }
      requestAnimationFrame(step);
    });
    add(main, add(more, btn));

    // Smooth wheel scrolling: the wheel only moves a target, the card eases towards it every frame
    // (the system step of about 100 px per notch looks jerky, and some systems switch their own smoothing off).
    var wTarget = 0, wRaf = 0, wLast = 0;
    function wTick(now) {
      var dt = Math.min(0.05, (now - wLast) / 1000), d = wTarget - card.scrollTop;
      wLast = now;
      if (Math.abs(d) < 0.5) { card.scrollTop = wTarget; wRaf = 0; return; }
      var step = d * (1 - Math.exp(-dt * 12));
      if (Math.abs(step) < 1) step = Math.sign(d) * Math.min(1, Math.abs(d));   // scrollTop is whole pixels: always move at least one
      card.scrollTop += step;
      wRaf = requestAnimationFrame(wTick);
    }
    function cancelWheel() { if (wRaf) cancelAnimationFrame(wRaf); wRaf = 0; }
    card.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.shiftKey || e.deltaY === 0) return;
      var max = card.scrollHeight - card.clientHeight;
      if (max <= 1) return;
      var dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * card.clientHeight : e.deltaY;
      if (!wRaf) wTarget = card.scrollTop;
      e.preventDefault();
      wTarget = Math.max(0, Math.min(max, wTarget + dy));
      if (!wRaf) { wLast = performance.now(); wRaf = requestAnimationFrame(wTick); }
    }, { passive: false });

    // A soft fade at the bottom edge shows that more content is below; it dies away as the end comes near.
    var fade = el('div', 'fade');
    function marks() {
      var left = card.scrollHeight - card.clientHeight - card.scrollTop;   // content still hidden below, px
      fade.style.opacity = Math.max(0, Math.min(1, left / 40));
    }
    card.addEventListener('scroll', marks, { passive: true });
    if (window.ResizeObserver) { var ro = new ResizeObserver(marks); ro.observe(card); ro.observe(main); ro.observe(pn); }
    return add(card, main, pn, fade);
  }

  // "Could" and "Could not" share one cell.
  function wrapCould(c) {
    var cell = el('div', 'cell'), box = el('div', 'side');
    add(box, block('Could'), lines(c.could), block('Could not'), lines(c.couldNot));
    return add(cell, box);
  }

  window.renderCard = render;
})();
