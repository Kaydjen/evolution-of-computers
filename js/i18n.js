// Language of the page (English or Polish): the choice, the interface strings and the image descriptions.
// Card texts are in js/cards-data.js (window.CARDS = { en: [...], pl: [...] }).
(function () {
  var UI = {
    en: { title: 'Evolution of computers' },
    pl: {
      title: 'Ewolucja komputerów',
      'Previous': 'Wstecz', 'Next': 'Dalej', 'Cards': 'Karty',
      'Interesting': 'Ciekawostki',
      'Credits': 'Autorzy', 'Close': 'Zamknij', 'Image credits': 'Autorzy ilustracji', 'Images are scaled; some are cropped.': 'Obrazy zmniejszono; niektóre przycięto.',
      'Breakthrough': 'Przełom', 'Principle': 'Zasada działania', 'Influence': 'Wpływ',
      'Could': 'Potrafił', 'Could not': 'Nie potrafił', 'Parts': 'Elementy',
      'Electromechanical': 'Elektromechaniczne', 'Electronic': 'Elektroniczne',
      'Limitations': 'Ograniczenia', 'Fate': 'Losy', 'First built': 'Pierwsze wykonanie', 'Rival idea': 'Pomysł konkurencyjny'
    }
  };

  // Polish image descriptions by card number: photo list (same order as MEDIA) and diagram.
  var ALT_PL = {
    1: { photo: ['Chiński abakus z kulkami'] },
    2: { photo: ['Fragmenty mechanizmu z Antykithiry'], diagram: 'Układ kół zębatych mechanizmu z Antykithiry' },
    3: { photo: ['Pałeczki Napiera, około 1700 r.'], diagram: 'Pałeczki Napiera z tabliczką mnożenia na każdej pałeczce' },
    4: { photo: ['Rekonstrukcja zegara liczącego Schickarda'] },
    5: { photo: ['Pascalina'], diagram: 'Wnętrze Pascaliny: koła cyfr, przekładnie przeniesienia i rama' },
    6: { photo: ['Maszyna licząca Leibniza'], diagram: 'Walec schodkowy maszyny liczącej' },
    7: { photo: ['Krosno Jacquarda w Narodowym Muzeum Szkocji'] },
    8: { photo: ['Arytmometr'], diagram: 'Mechanizm arytmometru' },
    9: { photo: ['Maszyna różnicowa'], diagram: 'Rysunek maszyny różnicowej' },
    10: { photo: ['Maszyna analityczna Babbage’a, część młyna'] },
    11: { photo: ['Tabulator Holleritha'] },
    12: { photo: ['Maszyna Enigma'], diagram: 'Droga prądu przez wirniki Enigmy' },
    13: { photo: ['Replika Zuse Z3'] },
    14: { photo: ['Colossus'] },
    15: { photo: ['ENIAC', 'Konsola UNIVAC I'] },
    16: { photo: ['Maszyna IAS'], diagram: 'Architektura von Neumanna' },
    17: { photo: ['Konsola IBM 7090'] },
    18: { photo: ['DEC PDP-8/I', 'Komputer pokładowy Apollo'] },
    19: { photo: ['Panel IBM System/360 Model 40'] },
    20: { photo: ['Konsola IBM 7030 Stretch'], diagram: 'Czteroetapowy potok instrukcji' },
    21: { photo: ['Konsola IBM System/360 Model 85'], diagram: 'Odczyt z pamięci podręcznej o skojarzeniu zbiorowym' },
    22: { photo: ['Układ Intel 4004', 'Apple II'] },
    23: { photo: ['Zestaw uruchomieniowy Acorn ARM'], diagram: 'Klasyczny pięcioetapowy potok RISC: pięć nakładających się w czasie instrukcji' },
    25: { photo: ['Rdzeń procesora dwurdzeniowego (Intel Wolfdale)'], diagram: 'Procesor dwurdzeniowy: rdzenie, pamięci podręczne i magistrala' }
  };

  function stored() { try { return localStorage.getItem('lang'); } catch (e) { return null; } }
  function store(l) { try { localStorage.setItem('lang', l); } catch (e) { /* private mode: the choice is just not remembered */ } }

  // First visit: the browser language decides (Polish, else English).
  var lang = stored();
  if (lang !== 'pl' && lang !== 'en') lang = /^pl\b/i.test(navigator.language || '') ? 'pl' : 'en';

  var I18N = {
    get lang() { return lang; },
    // Interface string; English is the key itself, so a missing Polish string shows English.
    t: function (key) { return (UI[lang] && UI[lang][key]) || key; },
    cards: function () { return window.CARDS[lang]; },
    // Image description: Polish from the table, else the English one from MEDIA.
    alt: function (n, kind, i, fallback) {
      var a = lang === 'pl' && ALT_PL[n];
      if (!a) return fallback;
      return (kind === 'diagram' ? a.diagram : a.photo && a.photo[i]) || fallback;
    },
    // Texts that are in index.html (not drawn by cards.js or timeline.js); called at start and after a change.
    applyStatic: function () {
      document.documentElement.lang = lang;
      document.title = I18N.t('title');
      document.getElementById('page-title').textContent = I18N.t('title');
      document.getElementById('back').setAttribute('aria-label', I18N.t('Previous'));
      document.getElementById('fwd').setAttribute('aria-label', I18N.t('Next'));
      document.getElementById('dots').setAttribute('aria-label', I18N.t('Cards'));
      document.getElementById('credits-btn').textContent = I18N.t('Credits');
      Array.prototype.forEach.call(document.querySelectorAll('#lang button'), function (b) {
        b.setAttribute('aria-pressed', b.dataset.lang === lang);
      });
    },
    // Returns true when the language really changed.
    set: function (l) {
      if (l === lang || (l !== 'pl' && l !== 'en')) return false;
      lang = l;
      store(l);
      I18N.applyStatic();
      return true;
    }
  };
  window.I18N = I18N;
  I18N.applyStatic();
})();
