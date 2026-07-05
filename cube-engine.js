// cube-engine.js
// Core 3x3 cube model: 54 facelets, the 6 face turns, apply/scramble/solved.
// Works in both Node (module.exports) and the browser (window.CubeEngine).
//
// Facelet layout (URFDLB, row-major per face):
//   U = 0..8, R = 9..17, F = 18..26, D = 27..35, L = 36..44, B = 45..53
//
// A "state" is an Int array of length 54 where each entry is the face index
// (0=U,1=R,2=F,3=D,4=L,5=B) that the sticker's COLOUR belongs to.
// The cube is solved when state[i] === Math.floor(i / 9) for every i.
//
// Moves are generated from 3D sticker geometry (position + outward normal),
// not hand-typed permutation tables, so the turn metric is correct by
// construction. CW = clockwise when looking at that face from outside.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CubeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

  // ---- 3D geometry for every sticker -------------------------------------
  // Coordinate frame: x = L(-1)..R(+1), y = D(-1)..U(+1), z = B(-1)..F(+1).
  // Local (row r top->bottom, col c left->right as seen looking at the face
  // from outside) maps to 3D as follows (derived once, verified by tests):
  var pos = new Array(54), nor = new Array(54);

  function setFace(base, fn, normal) {
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        var i = base + r * 3 + c;
        pos[i] = fn(r, c);
        nor[i] = normal.slice();
      }
    }
  }
  setFace(0,  function (r, c) { return [c - 1, 1, r - 1]; }, [0, 1, 0]);   // U
  setFace(9,  function (r, c) { return [1, 1 - r, 1 - c]; }, [1, 0, 0]);   // R
  setFace(18, function (r, c) { return [c - 1, 1 - r, 1]; }, [0, 0, 1]);   // F
  setFace(27, function (r, c) { return [c - 1, -1, 1 - r]; }, [0, -1, 0]); // D
  setFace(36, function (r, c) { return [-1, 1 - r, c - 1]; }, [-1, 0, 0]); // L
  setFace(45, function (r, c) { return [1 - c, 1 - r, -1]; }, [0, 0, -1]); // B

  function vkey(p, n) { return p[0] + ',' + p[1] + ',' + p[2] + '|' + n[0] + ',' + n[1] + ',' + n[2]; }
  var slotByKey = {};
  for (var i = 0; i < 54; i++) slotByKey[vkey(pos[i], nor[i])] = i;

  // Rotate a vector by +/-90 degrees about an axis. s = sin(theta) (+1 or -1),
  // cos(theta) = 0.
  function rotv(v, axis, s) {
    var x = v[0], y = v[1], z = v[2];
    if (axis === 'x') return [x, -s * z, s * y];
    if (axis === 'y') return [s * z, y, -s * x];
    return [-s * y, s * x, z]; // z
  }
  function axisOf(p, axis) { return axis === 'x' ? p[0] : axis === 'y' ? p[1] : p[2]; }

  // Build the CW quarter-turn permutation for one face.
  // perm[j] = i means: after the turn, slot j shows what was at slot i.
  function genMove(axis, layer, s) {
    var perm = new Array(54);
    for (var k = 0; k < 54; k++) perm[k] = k;
    for (var k2 = 0; k2 < 54; k2++) {
      if (axisOf(pos[k2], axis) === layer) {
        var np = rotv(pos[k2], axis, s);
        var nn = rotv(nor[k2], axis, s);
        var j = slotByKey[vkey(np, nn)];
        perm[j] = k2;
      }
    }
    return perm;
  }

  // CW-from-outside: faces whose normal points along +axis use s=-1,
  // faces along -axis use s=+1.
  // Slice moves: M follows L (x-mid), E follows D (y-mid), S follows F (z-mid).
  var base = {
    U: genMove('y', 1, -1),
    D: genMove('y', -1, 1),
    R: genMove('x', 1, -1),
    L: genMove('x', -1, 1),
    F: genMove('z', 1, -1),
    B: genMove('z', -1, 1),
    M: genMove('x', 0, 1),
    E: genMove('y', 0, 1),
    S: genMove('z', 0, -1)
  };

  function compose(a, b) { // apply a, then b  => b after a
    var r = new Array(54);
    for (var k = 0; k < 54; k++) r[k] = a[b[k]];
    return r;
  }
  function invert(p) {
    var r = new Array(54);
    for (var k = 0; k < 54; k++) r[p[k]] = k;
    return r;
  }

  // Full move table: X, X', X2 for each face.
  var MOVES = {};
  ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S'].forEach(function (f) {
    var p = base[f];
    MOVES[f] = p;
    MOVES[f + "'"] = invert(p);
    MOVES[f + '2'] = compose(p, p);
  });

  function applyPerm(state, perm) {
    var r = new Array(54);
    for (var k = 0; k < 54; k++) r[k] = state[perm[k]];
    return r;
  }

  function solvedState() {
    var s = new Array(54);
    for (var k = 0; k < 54; k++) s[k] = Math.floor(k / 9);
    return s;
  }

  // Parse a move string like "R U R' U2" into a token list.
  function parse(seq) {
    if (Array.isArray(seq)) return seq.slice();
    return seq.trim().length ? seq.trim().split(/\s+/) : [];
  }

  function applySeq(state, seq) {
    var toks = parse(seq), s = state;
    for (var k = 0; k < toks.length; k++) {
      var p = MOVES[toks[k]];
      if (!p) throw new Error('Unknown move: ' + toks[k]);
      s = applyPerm(s, p);
    }
    return s;
  }

  function isSolved(state) {
    for (var k = 0; k < 54; k++) if (state[k] !== Math.floor(k / 9)) return false;
    return true;
  }

  var ALL = [];
  FACES.forEach(function (f) { ALL.push(f, f + "'", f + '2'); });

  // Random scramble of n moves (avoids same-face repeats). rng() in [0,1).
  function scramble(n, rng) {
    rng = rng || Math.random;
    var faces = FACES.slice(), out = [], last = null;
    for (var k = 0; k < n; k++) {
      var f;
      do { f = faces[Math.floor(rng() * 6)]; } while (f === last);
      last = f;
      var suf = ['', "'", '2'][Math.floor(rng() * 3)];
      out.push(f + suf);
    }
    return out;
  }

  function clone(state) { return state.slice(); }

  return {
    FACES: FACES,
    MOVES: MOVES,
    ALL_MOVES: ALL,
    base: base,
    pos: pos,
    nor: nor,
    solvedState: solvedState,
    applyPerm: applyPerm,
    applySeq: applySeq,
    isSolved: isSolved,
    scramble: scramble,
    parse: parse,
    clone: clone,
    invert: invert,
    compose: compose
  };
});
