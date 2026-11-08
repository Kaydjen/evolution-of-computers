// ============================================================================================
// Timeline movement. Two arrows live on one horizontal line: a forward arrow (right of the current
// card) and a back arrow (left of it). A click moves the screen to the neighbouring card and the
// clicked arrow rides with the screen centre, goes under the next card and comes out on its far side.
// The other arrow is left behind in the world and, after the move, comes out of the new card.
// Everything is written in world coordinates (px along the line); card i has its centre at i * SPACING.
// ============================================================================================
(function () {
'use strict';

// ---------- tunables ----------
const CARD_W_MAX = 980;     // card width on a wide screen, px (on a narrow screen the card is narrower)
const CARD_W_MIN = 260;
const CARD_GAP = 680;       // empty line between two neighbouring cards, px
const ARROW_SIZE = 56;      // arrow button size, px
const DURATION = 4000;      // one move, ms (ease in-out cubic)
const LEAD_START = 180;     // the arrow sets off when the screen centre is this far before it, px
const SYNC_TIME = 1.0;      // max time for the arrow to merge with the screen centre (position and speed), s
const GLIDE_IN = 20;        // 1/s: pull to the rest place while under a card (fast; nobody sees it)
const GLIDE_OUT = 5;        // 1/s: pull at the card's far edge and beyond (the arrow brakes exponentially, smooth)
const SLIDE_IN_MS = 300;    // an arrow that is not needed slides under its card this fast (accelerating)
const OUT_DELAY = 200;      // ms after a move: the other arrow starts to come out of the new card
const IN_DELAY = 300;       // ms after a move: an arrow with nowhere to go slides under its card
const LINE_OVERHANG = 700;  // the line extends this far past the first and last card centres
const END_FADE = 450;       // fade-out length at the ends of the line, px
const GAP_CLEAR = 22;       // line fully empty around an arrow centre, px
const GAP_RAMP = 110;       // soft fade length beyond it, px
const TRAIL_MAX = 200;      // longest trail behind the moving arrow, px
const JUMP_BASE = 500;      // a jump by dots: base time, ms ...
const JUMP_PER_CARD = 60;   // ... plus this per card passed ...
const JUMP_MAX = 1400;      // ... but never longer than this, ms
const PRELOAD = 2;          // images of this many cards on each side of the current one are loaded in advance
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');   // then moves are short and have no trail
const moveTime = () => REDUCED.matches ? 300 : DURATION;

const CARDS = window.CARDS;

// ---------- geometry (depends on the screen width, see layout()) ----------
let CARD_W = CARD_W_MAX, SPACING = CARD_W + CARD_GAP, ARROW_GAP = 60, REST_OFF = CARD_W / 2 + ARROW_GAP;
const HIDE_OFF = 60;        // a hidden arrow waits this far from its card centre (its line gap stays inside the card)

// ---------- pure math (no DOM) ----------
const clamp01 = v => Math.max(0, Math.min(1, v));
const smoothstep = u => u * u * (3 - 2 * u);
const easeInOutCubic = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

// Distance by which the moving arrow is ahead of the screen centre while it merges with it.
// A cubic Hermite curve over u in [0, 1]: starts at o0 with slope -v0 (so the arrow's own speed starts at 0),
// ends at 0 with slope 0 (so at the end the arrow's speed equals the screen speed). time = merge time in s.
function mergeOffset(u, o0, v0, time) {
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u;
  return Math.max(0, h00 * o0 - h10 * time * v0);
}
// Merge time: SYNC_TIME, but short enough that the curve stays monotonic (needs v0 * time <= 3 * o0).
const mergeTime = (o0, v0) => Math.min(SYNC_TIME, 2.5 * o0 / Math.max(v0, 1));

// One step of the glide to the rest place, in "forward" coordinates (xq grows towards endQ).
// The pull is strong inside the card and fades to GLIDE_OUT exactly at its far edge, so the speed is continuous there.
function glide(xq, endQ, farQ, dt) {
  const inside = clamp01((farQ - xq) / CARD_W);
  return endQ - (endQ - xq) * Math.exp(-(GLIDE_OUT + (GLIDE_IN - GLIDE_OUT) * inside) * dt);
}
const frameDt = (now, last) => Math.max(0.001, Math.min(0.05, (now - last) / 1000));   // s, protected against hiccups

const centre = i => i * SPACING;
const restX = (i, kind) => centre(i) + kind * REST_OFF;
const hiddenX = (i, kind) => centre(i) + kind * HIDE_OFF;
const hasCard = (i, kind) => i + kind >= 0 && i + kind < CARDS.length;   // is there a card in this direction?

// ---------- DOM: cards, line, camera ----------
const track = document.getElementById('track');
const line = document.getElementById('line');
const trail = document.getElementById('trail');
const cardEls = CARDS.map(c => { const e = window.renderCard(c); track.appendChild(e); return e; });
let lineLeft = 0;

// Card width follows the screen: the arrows beside the card must stay on screen. Called at start and when the screen is resized.
function layout() {
  ARROW_GAP = innerWidth < 760 ? 20 : 60;
  CARD_W = Math.round(Math.max(CARD_W_MIN, Math.min(CARD_W_MAX, innerWidth - 2 * (ARROW_GAP + ARROW_SIZE / 2 + 6))));
  SPACING = CARD_W + CARD_GAP;
  REST_OFF = CARD_W / 2 + ARROW_GAP;
  cardEls.forEach((e, i) => { e.style.width = CARD_W + 'px'; e.style.left = (centre(i) - CARD_W / 2) + 'px'; });
  lineLeft = centre(0) - LINE_OVERHANG;
  line.style.left = lineLeft + 'px';
  line.style.width = (centre(CARDS.length - 1) - centre(0) + 2 * LINE_OVERHANG) + 'px';
}

// Mask of the line: faded ends AND a gap around each arrow. The gap positions are CSS variables (--ax, --bx).
function gapMask(xVar) {
  const N = 8, left = [], right = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N, d = GAP_CLEAR + GAP_RAMP * (1 - u);       // u = 0 far from the arrow ... 1 at the arrow
    const stop = `rgb(0 0 0 / ${(1 - smoothstep(u)).toFixed(3)})`;
    left.push(`${stop} calc(var(${xVar}) - ${d.toFixed(1)}px)`);
    right.unshift(`${stop} calc(var(${xVar}) + ${d.toFixed(1)}px)`);
  }
  return `linear-gradient(to right, ${left.concat(right).join(', ')})`;
}
const endsMask = `linear-gradient(to right, transparent, #000 ${END_FADE}px, #000 calc(100% - ${END_FADE}px), transparent)`;
line.style.webkitMaskImage = line.style.maskImage = `${endsMask}, ${gapMask('--ax')}, ${gapMask('--bx')}`;
line.style.webkitMaskComposite = 'source-in, source-in';
line.style.maskComposite = 'intersect, intersect';

const setCamera = x => { track.style.transform = `translateX(${innerWidth / 2 - x}px)`; };

// Accent (forward) or dim (back) trail behind the moving arrow, as long as the arrow is fast; none at rest.
function setTrail(kind, x, speed) {
  const len = Math.min(TRAIL_MAX, speed * 0.45);
  const color = kind > 0 ? 'var(--accent)' : 'var(--main-mid)';
  trail.style.background = `linear-gradient(to ${kind > 0 ? 'right' : 'left'}, transparent, ${color})`;
  trail.style.width = len + 'px';
  trail.style.left = (kind > 0 ? x - GAP_CLEAR - len : x + GAP_CLEAR) + 'px';
  trail.style.opacity = Math.min(1, speed / 120);
}

// Only the card on the screen can be focused or clicked (a focused card far away would scroll the page sideways).
const setCurrent = i => cardEls.forEach((e, k) => { e.inert = i === null || k !== i; });

// ---------- arrows ----------
// state: 'rest' (clickable) | 'moving' | 'hidden' (under its card) | 'left' (left behind during a move)
class Arrow {
  constructor(kind, el, xVar, state) {
    Object.assign(this, { kind, el, xVar, state, x: 0, token: 0, leaving: false });
  }
  setX(x) {
    this.x = x;
    this.el.style.left = x + 'px';
    line.style.setProperty(this.xVar, (x - lineLeft) + 'px');
  }
  setEnabled(on) { this.el.disabled = !on; }

  // Slide under the card of index i: starts slowly and accelerates, like being pulled in.
  slideIn(i, delay = 0, done = null) {
    const token = ++this.token;
    this.leaving = false;
    this.state = 'moving';
    this.setEnabled(false);
    const from = this.x, to = hiddenX(i, this.kind), t0 = performance.now() + delay;
    const step = now => {
      if (token !== this.token) return;                          // a newer animation took over
      const u = clamp01((now - t0) / SLIDE_IN_MS);
      this.setX(from + (to - from) * u * u);
      if (u < 1) { requestAnimationFrame(step); return; }
      this.state = 'hidden';
      if (done) done();
    };
    requestAnimationFrame(step);
  }

  // Come out of the card of index i to the rest place and brake smoothly (same law as the moving arrow's exit).
  slideOut(i, delay = 0) {
    const token = ++this.token;
    this.leaving = false;
    this.state = 'moving';
    this.setEnabled(false);
    const k = this.kind, endQ = k * restX(i, k), farQ = k * centre(i) + CARD_W / 2;
    let xq = k * this.x, last = performance.now() + delay;
    const step = now => {
      if (token !== this.token) return;
      if (now < last) { requestAnimationFrame(step); return; }   // still in the delay
      xq = glide(xq, endQ, farQ, frameDt(now, last)); last = now;
      if (endQ - xq > 0.5) { this.setX(k * xq); requestAnimationFrame(step); return; }
      this.setX(k * endQ);
      // If a new move started meanwhile, the arrow finishes coming out but stays disabled: it is being left behind.
      this.state = this.leaving ? 'left' : 'rest';
      this.setEnabled(!this.leaving);
    };
    requestAnimationFrame(step);
  }

  // A move started and this arrow is not the one that moves: it stays where it stands, not clickable.
  // An animation in progress is not cut off (no arrow freezes half way out of a card): it finishes first.
  leaveBehind() {
    this.setEnabled(false);
    if (this.state === 'moving') this.leaving = true; else this.state = 'left';
  }
}

const ARROWS = {
  1:    new Arrow(1,  document.getElementById('fwd'),  '--ax', 'rest'),
  '-1': new Arrow(-1, document.getElementById('back'), '--bx', 'hidden'),
};

// ---------- dots (fast jump to any card) ----------
const dotsEl = document.getElementById('dots');
// Tooltip above a dot: centred on the dot, kept inside the screen (the little pointer stays on the dot).
const tipEl = document.createElement('div');
tipEl.id = 'dot-tip';
tipEl.setAttribute('aria-hidden', 'true');
document.body.appendChild(tipEl);
function showTip(dot, text) {
  tipEl.textContent = text;
  const r = dot.getBoundingClientRect(), cx = r.left + r.width / 2, w = tipEl.offsetWidth, m = 8;
  const left = Math.max(m, Math.min(innerWidth - m - w, cx - w / 2));
  tipEl.style.left = left + 'px';
  tipEl.style.setProperty('--pointer', (cx - left) + 'px');
  tipEl.classList.add('show');
}
function hideTip() { tipEl.classList.remove('show'); }
const dotEls = CARDS.map((c, i) => {
  const b = document.createElement('button');
  b.className = 'dot';
  b.setAttribute('aria-label', c.name);
  b.addEventListener('click', () => { hideTip(); jumpTo(i); });
  b.addEventListener('pointerenter', e => { preload(i, 1); if (e.pointerType === 'mouse') showTip(b, c.name); });
  b.addEventListener('focus', () => { preload(i, 1); if (b.matches(':focus-visible')) showTip(b, c.name); });
  b.addEventListener('pointerleave', hideTip);
  b.addEventListener('blur', hideTip);
  dotsEl.appendChild(b);
  return b;
});
// Lazy images of cards near the target are loaded in advance, so a card never arrives with grey frames.
function preload(i, r) {
  cardEls.forEach((e, k) => { if (Math.abs(k - i) <= r) e.querySelectorAll('img[loading="lazy"]').forEach(m => { m.loading = 'eager'; }); });
}
const markDot = i => dotEls.forEach((b, k) => { b.classList.toggle('current', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });

// ---------- state ----------
let index = 0;             // current card
let busy = false;          // a move is running
let resizePending = false; // the screen was resized during a move

function place(i) {
  setCamera(centre(i));
  markDot(i);
  preload(i, PRELOAD);
  setCurrent(i);
  for (const a of Object.values(ARROWS)) {
    const on = hasCard(i, a.kind);
    a.token++;
    a.leaving = false;
    a.setX(on ? restX(i, a.kind) : hiddenX(i, a.kind));
    a.state = on ? 'rest' : 'hidden';
    a.setEnabled(on);
  }
}

// ---------- one move ----------
// dir = +1: forward, -1: back. The motion is written for "forward"; for back it is mirrored:
// q = dir * x turns every world position into forward-style coordinates, and results are mirrored back (x = dir * q).
function go(dir) {
  const mover = ARROWS[dir], other = ARROWS[-dir];
  if (busy || !hasCard(index, dir) || mover.state !== 'rest') return;
  busy = true;
  setCurrent(null);
  mover.state = 'moving';
  mover.setEnabled(false);
  mover.el.classList.add('active');
  other.leaveBehind();
  const oldIndex = index;
  const dur = moveTime();
  const active = document.activeElement;
  const keepFocus = !!active && (active === mover.el || (active.closest && !!active.closest('.card')));

  const fromQ = dir * centre(index);
  const restQ = fromQ + REST_OFF;           // where the arrow waits at the start
  const nextQ = fromQ + SPACING;
  const cardNear = nextQ - CARD_W / 2;      // the arrow disappears under the next card at this edge ...
  const cardFar = nextQ + CARD_W / 2;       // ... and comes out at this one
  const endQ = nextQ + REST_OFF;            // its rest place beside the next card
  const t0 = performance.now();
  let last = t0, prevCam = fromQ, prevX = restQ;
  let merge = null;                         // {t, o0, v0, time}: set when the arrow sets off
  let glideX = null;                        // arrow position once it is under the next card

  function frame(now) {
    const t = clamp01((now - t0) / dur);
    const cam = fromQ + SPACING * easeInOutCubic(t);   // screen centre
    setCamera(dir * cam);
    const dt = frameDt(now, last); last = now;
    const camSpeed = (cam - prevCam) / dt; prevCam = cam;

    let x = restQ;
    if (glideX === null) {
      // 1) The arrow waits; when the screen centre is LEAD_START before it, it sets off from speed 0, stays ahead
      //    of the centre and merges with it (position and speed together), then rides exactly with it.
      if (merge === null && restQ - cam <= LEAD_START) {
        const o0 = restQ - cam;
        merge = { t: now, o0, v0: camSpeed, time: mergeTime(o0, camSpeed) };
      }
      if (merge !== null) {
        const u = clamp01((now - merge.t) / 1000 / merge.time);
        x = cam + mergeOffset(u, merge.o0, merge.v0, merge.time);
      }
      // 2) It reaches the next card and disappears under it (the "active" brightness fades while it is hidden).
      if (x >= cardNear) {
        x = glideX = Math.max(x, cardNear);
        mover.el.classList.remove('active');
      }
    } else {
      // 3) Under the card it is pulled hard to its rest place; at the far edge the pull is weaker, the arrow comes out slowing down.
      x = glideX = glide(glideX, endQ, cardFar, dt);
    }

    mover.setX(dir * x);
    setTrail(dir, dir * x, REDUCED.matches ? 0 : (x - prevX) / dt);
    prevX = x;
    if (t < 1 || endQ - x > 0.5) { requestAnimationFrame(frame); return; }
    finish();
  }

  function finish() {
    mover.setX(dir * endQ);
    mover.el.classList.remove('active');
    index += dir;
    setCurrent(index);
    markDot(index);
    preload(index, PRELOAD);
    mover.state = 'rest';
    mover.setEnabled(true);
    // Nowhere to go further in this direction: the arrow slides under its card.
    if (!hasCard(index, dir)) mover.slideIn(index, IN_DELAY);
    // The left-behind arrow is far off screen now: carry it under the new card (invisible) and let it come out.
    // If it is still in view (very wide screen) and not already under its old card, it first slides under that card.
    const bringOther = () => { other.setX(hiddenX(index, other.kind)); other.slideOut(index, OUT_DELAY); };
    const underOldCard = Math.abs(other.x - centre(oldIndex)) <= CARD_W / 2 - 20;
    const inView = Math.abs(other.x - centre(index)) < innerWidth / 2 + 60;
    if (inView && !underOldCard) other.slideIn(oldIndex, 0, bringOther); else bringOther();
    busy = false;
    // Keyboard focus was on the arrow or inside the old card, which became inert: move it to the arrow (or the current dot).
    if (keepFocus) (hasCard(index, dir) ? mover.el : dotEls[index]).focus({ preventScroll: true });
    if (resizePending) { resizePending = false; layout(); place(index); }
  }
  requestAnimationFrame(frame);
}

// ---------- jump by a dot ----------
// Both arrows slide under the current card, the screen glides to the chosen card (shorter than one arrow move),
// then both arrows come out of the new card.
function jumpTo(target) {
  if (busy || target === index) return;
  busy = true;
  setCurrent(null);
  markDot(target);
  preload(target, PRELOAD);
  for (const a of Object.values(ARROWS)) {
    a.el.classList.remove('active');
    if (a.state === 'rest') a.slideIn(index);
    else { a.token++; a.leaving = false; a.setX(hiddenX(index, a.kind)); a.state = 'hidden'; a.setEnabled(false); }   // an arrow still coming out is taken in at once
  }
  const from = centre(index), to = centre(target);
  const dur = REDUCED.matches ? 250 : Math.min(JUMP_MAX, JUMP_BASE + JUMP_PER_CARD * Math.abs(target - index));
  const t0 = performance.now() + SLIDE_IN_MS;
  function frame(now) {
    const u = clamp01((now - t0) / dur);
    setCamera(from + (to - from) * easeInOutCubic(u));
    if (u < 1) { requestAnimationFrame(frame); return; }
    index = target;
    setCurrent(index);
    for (const a of Object.values(ARROWS)) {
      a.token++;
      a.leaving = false;
      a.setX(hiddenX(index, a.kind));
      if (hasCard(index, a.kind)) a.slideOut(index, OUT_DELAY); else { a.state = 'hidden'; a.setEnabled(false); }
    }
    busy = false;
    if (resizePending) { resizePending = false; layout(); place(index); }
  }
  requestAnimationFrame(frame);
}

// ---------- input ----------
ARROWS[1].el.addEventListener('click', () => go(1));
ARROWS['-1'].el.addEventListener('click', () => go(-1));
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});
addEventListener('resize', () => {
  if (busy) { resizePending = true; return; }
  layout();
  place(index);
});

layout();
place(0);
})();
