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
  function block(title, tag, cls) {
    return el(tag || 'h3', cls, title);
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
  function frame(img) {
    var f = el('div', 'media');
    if (img && img.src) {
      var i = document.createElement('img');
      i.src = img.src;
      i.alt = img.alt || '';
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
        add(inner, el('h3', '', m.label), para(m.text));
      }
    });
    return add(outer, add(clip, inner));
  }

  function render(c) {
    var media = (window.MEDIA && window.MEDIA[c.n]) || {};
    var card = el('article', 'card ' + c.type);
    var main = el('div', 'main');
    card.setAttribute('aria-label', c.name);

    if (c.type === 'generation') {
      if (c.captions.length) {
        var photos = el('div', 'photos');
        photos.style.setProperty('--n', c.captions.length);
        c.captions.forEach(function (cap, i) {
          var fig = el('figure');
          add(fig, frame(media.photo && media.photo[i]), el('figcaption', '', cap));
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
      add(top, frame(media.photo && media.photo[0]), mid, frame(media.diagram));
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

    var more = el('div', 'more'), btn = el('button', '', 'Interesting');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'panel-' + c.n);
    var pn = panel(c);
    btn.addEventListener('click', function () {
      var open = pn.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
    add(main, add(more, btn));

    return add(card, main, pn);
  }

  // "Could" and "Could not" share one cell, as in the accepted mechanism card.
  function wrapCould(c) {
    var cell = el('div', 'cell'), box = el('div', 'side');
    add(box, block('Could'), lines(c.could), block('Could not'), lines(c.couldNot));
    return add(cell, box);
  }

  window.renderCard = render;
})();
