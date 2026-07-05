// kociemba.js -- near-optimal two-phase solver (Kociemba's algorithm).
// Built on the verified facelet engine; produces ~20-move solutions.
// Works in Node (module.exports) and the browser (window.Kociemba).
//
// Phase 1: reduce to the group G1 = <U,D,R2,L2,F2,B2> (all edges oriented,
//          all corners oriented, the 4 middle-slice edges in the slice).
// Phase 2: solve within G1.
// Each phase is an IDA* search guided by BFS pruning tables.

(function (root, factory) {
  var E = (typeof require !== 'undefined') ? require('./cube-engine.js') : root.CubeEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(E);
  else root.Kociemba = factory(E);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var pos = E.pos, nor = E.nor;

  // ---------- cubie model (derived from facelet geometry) ----------
  var byPos = {};
  for (var i = 0; i < 54; i++) { var k = pos[i].join(','); (byPos[k] = byPos[k] || []).push(i); }
  var cornerGroups = [], edgeGroups = [];
  Object.keys(byPos).forEach(function (k) {
    var g = byPos[k]; if (g.length === 3) cornerGroups.push(g); else if (g.length === 2) edgeGroups.push(g);
  });
  function faceOf(idx) { return Math.floor(idx / 9); }

  // corner slots: [axis(U/D), then clockwise]
  var CS = cornerGroups.map(function (g) {
    var axis = g.filter(function (i) { return faceOf(i) === 0 || faceOf(i) === 3; })[0];
    var sx = g.filter(function (i) { return i !== axis && nor[i][0] !== 0; })[0];
    var sz = g.filter(function (i) { return i !== axis && nor[i][2] !== 0; })[0];
    var p = pos[axis];
    return (p[0] * p[1] * p[2]) > 0 ? [axis, sx, sz] : [axis, sz, sx];
  });
  // edge slots: [ref(U/D else F/B), other]; mark slice edges (no U/D sticker)
  var isSlice = [];
  var ES = edgeGroups.map(function (g, idx) {
    var ref = g.filter(function (i) { return faceOf(i) === 0 || faceOf(i) === 3; })[0];
    var slice = (ref === undefined);
    if (slice) ref = g.filter(function (i) { return faceOf(i) === 2 || faceOf(i) === 5; })[0];
    isSlice[idx] = slice;
    return [ref, g.filter(function (i) { return i !== ref; })[0]];
  });

  // colour set -> home index lookups
  function colsKey(arr) { return arr.slice().sort(function (a, b) { return a - b; }).join(','); }
  var cHome = {}, eHome = {};
  CS.forEach(function (s, idx) { cHome[colsKey(s.map(faceOf))] = idx; });
  ES.forEach(function (s, idx) { eHome[colsKey(s.map(faceOf))] = idx; });

  // read cubie (perm/ori) from a facelet state
  function readCubie(state) {
    var cp = [], co = [], ep = [], eo = [];
    for (var s = 0; s < 8; s++) {
      var sl = CS[s];
      cp[s] = cHome[colsKey([state[sl[0]], state[sl[1]], state[sl[2]]])];
      var ap = 0; for (var p = 0; p < 3; p++) { var c = state[sl[p]]; if (c === 0 || c === 3) { ap = p; break; } }
      co[s] = ap;
    }
    for (var s2 = 0; s2 < 12; s2++) {
      var el = ES[s2];
      ep[s2] = eHome[colsKey([state[el[0]], state[el[1]]])];
      // ref colour belongs to the home cubie's ref face
      var refFace = faceOf(ES[ep[s2]][0]);
      eo[s2] = (state[el[0]] === refFace) ? 0 : 1;
    }
    return { cp: cp, co: co, ep: ep, eo: eo };
  }

  // ---------- moves at cubie level ----------
  var NAMES = ["U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'",
               "D", "D2", "D'", "L", "L2", "L'", "B", "B2", "B'"];
  var PHASE2 = ["U", "U2", "U'", "D", "D2", "D'", "R2", "L2", "F2", "B2"];
  var P2IDX = PHASE2.map(function (n) { return NAMES.indexOf(n); });
  var MOVE = NAMES.map(function (n) {
    var st = E.applySeq(E.solvedState(), n);
    var c = readCubie(st);
    return { cp: c.cp, co: c.co, ep: c.ep, eo: c.eo, name: n, face: n[0] };
  });

  // apply a move (by index) to a cubie state -> new cubie state
  function applyMove(s, mi) {
    var m = MOVE[mi];
    var cp = new Array(8), co = new Array(8), ep = new Array(12), eo = new Array(12);
    for (var i = 0; i < 8; i++) { cp[i] = s.cp[m.cp[i]]; co[i] = (s.co[m.cp[i]] + m.co[i]) % 3; }
    for (var j = 0; j < 12; j++) { ep[j] = s.ep[m.ep[j]]; eo[j] = (s.eo[m.ep[j]] + m.eo[j]) % 2; }
    return { cp: cp, co: co, ep: ep, eo: eo };
  }

  // ---------- coordinate encode/decode ----------
  function C(n, k) { if (k < 0 || k > n) return 0; var r = 1; for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); }

  function twistCoord(co) { var t = 0; for (var i = 0; i < 7; i++) t = t * 3 + co[i]; return t; }
  function flipCoord(eo) { var f = 0; for (var i = 0; i < 11; i++) f = f * 2 + eo[i]; return f; }
  // slice: which 4 of 12 slots hold slice cubies
  function sliceCoord(ep) {
    var occ = []; for (var s = 0; s < 12; s++) if (isSlice[ep[s]]) occ.push(s);
    var idx = 0; for (var n = 0; n < 4; n++) idx += C(occ[n], n + 1); return idx;
  }
  var SLICE_SOLVED = (function () { var occ = []; for (var s = 0; s < 12; s++) if (isSlice[s]) occ.push(s); var idx = 0; for (var n = 0; n < 4; n++) idx += C(occ[n], n + 1); return idx; })();

  // permutation index (Lehmer)
  function permIndex(p) { var n = p.length, idx = 0; for (var i = 0; i < n; i++) { idx *= (n - i); for (var j = i + 1; j < n; j++) if (p[j] < p[i]) idx++; } return idx; }
  function indexPerm(idx, n) { var p = new Array(n), avail = []; for (var i = 0; i < n; i++) avail.push(i); var d = new Array(n); for (var i2 = n - 1; i2 >= 0; i2--) { var r = n - i2; d[i2] = idx % r; idx = Math.floor(idx / r); } for (var i3 = 0; i3 < n; i3++) p[i3] = avail.splice(d[i3], 1)[0]; return p; }

  // phase-2 slot orderings
  var NS = [], SL = [];               // non-slice / slice slot indices
  for (var s = 0; s < 12; s++) (isSlice[s] ? SL : NS).push(s);
  var nsIdxOfHome = {}, slIdxOfHome = {};
  NS.forEach(function (slot, i) { nsIdxOfHome[slot] = i; });
  SL.forEach(function (slot, i) { slIdxOfHome[slot] = i; });

  function cornerPermCoord(cp) { return permIndex(cp); }
  function edge8Coord(ep) { var p = NS.map(function (slot) { return nsIdxOfHome[ep[slot]]; }); return permIndex(p); }
  function slicePermCoord(ep) { var p = SL.map(function (slot) { return slIdxOfHome[ep[slot]]; }); return permIndex(p); }

  // ---------- coordinate move tables (for building pruning tables) ----------
  var N_TWIST = 2187, N_FLIP = 2048, N_SLICE = 495, N_CP = 40320, N_E8 = 40320, N_SP = 24;

  function twistMoveTable() {
    var T = new Int16Array(N_TWIST * 18);
    for (var c = 0; c < N_TWIST; c++) {
      var o = new Array(8), t = c; for (var i = 6; i >= 0; i--) { o[i] = t % 3; t = (t - o[i]) / 3; }
      o[7] = ((3 - (o[0] + o[1] + o[2] + o[3] + o[4] + o[5] + o[6]) % 3) % 3);
      for (var mi = 0; mi < 18; mi++) { var m = MOVE[mi], no = new Array(8); for (var s = 0; s < 8; s++) no[s] = (o[m.cp[s]] + m.co[s]) % 3; T[c * 18 + mi] = twistCoord(no); }
    } return T;
  }
  function flipMoveTable() {
    var T = new Int16Array(N_FLIP * 18);
    for (var c = 0; c < N_FLIP; c++) {
      var o = new Array(12), t = c; for (var i = 10; i >= 0; i--) { o[i] = t % 2; t = (t - o[i]) / 2; }
      o[11] = (o[0] ^ o[1] ^ o[2] ^ o[3] ^ o[4] ^ o[5] ^ o[6] ^ o[7] ^ o[8] ^ o[9] ^ o[10]);
      for (var mi = 0; mi < 18; mi++) { var m = MOVE[mi], no = new Array(12); for (var s = 0; s < 12; s++) no[s] = (o[m.ep[s]] + m.eo[s]) % 2; T[c * 18 + mi] = flipCoord(no); }
    } return T;
  }
  // slice as a set of occupied slots
  function sliceSetToCoord(occSlots) { var idx = 0; for (var n = 0; n < 4; n++) idx += C(occSlots[n], n + 1); return idx; }
  function sliceCoordToSet(coord) { // returns boolean[12]
    var occ = new Array(12); for (var i = 0; i < 12; i++) occ[i] = false;
    var x = coord, k = 4;
    for (var i2 = 11; i2 >= 0; i2--) { if (x >= C(i2, k)) { x -= C(i2, k); occ[i2] = true; k--; if (k === 0) break; } }
    return occ;
  }
  function sliceMoveTable() {
    var T = new Int16Array(N_SLICE * 18);
    for (var c = 0; c < N_SLICE; c++) {
      var occ = sliceCoordToSet(c);
      for (var mi = 0; mi < 18; mi++) {
        var m = MOVE[mi]; var nocc = []; for (var s = 0; s < 12; s++) if (occ[m.ep[s]]) nocc.push(s);
        T[c * 18 + mi] = sliceSetToCoord(nocc);
      }
    } return T;
  }
  // phase-2 permutation move tables (10 moves)
  function permMoveTable(N, n, slotArr, idxOfHome) {
    var T = new Int32Array(N * 10);
    for (var c = 0; c < N; c++) {
      var p = indexPerm(c, n);
      for (var mp = 0; mp < 10; mp++) {
        var m = MOVE[P2IDX[mp]];
        // apply edge/corner perm restricted to slotArr
        var np = new Array(n);
        for (var i = 0; i < n; i++) {
          var slot = slotArr[i];
          var src = m.ep ? m.ep[slot] : null; // edges
          if (slotArr === null) {} // unused
          np[i] = p[idxOfHome[src]];
        }
        T[c * 10 + mp] = permIndex(np);
      }
    } return T;
  }
  function cornerPermMoveTable() {
    var T = new Int32Array(N_CP * 10);
    for (var c = 0; c < N_CP; c++) {
      var p = indexPerm(c, 8);
      for (var mp = 0; mp < 10; mp++) { var m = MOVE[P2IDX[mp]], np = new Array(8); for (var s = 0; s < 8; s++) np[s] = p[m.cp[s]]; T[c * 10 + mp] = permIndex(np); }
    } return T;
  }

  // ---------- pruning tables (BFS in coordinate space) ----------
  function buildPrune(sizeA, sizeB, moveA, moveB, nMoves, startA, startB, moveStride) {
    var total = sizeA * sizeB;
    var dist = new Uint8Array(total); for (var i = 0; i < total; i++) dist[i] = 255;
    var start = startA * sizeB + startB;
    dist[start] = 0;
    var frontier = [start], depth = 0;
    while (frontier.length) {
      var next = [];
      for (var f = 0; f < frontier.length; f++) {
        var idx = frontier[f]; var a = Math.floor(idx / sizeB), b = idx % sizeB;
        for (var mi = 0; mi < nMoves; mi++) {
          var na = moveA[a * moveStride + mi], nb = moveB[b * moveStride + mi];
          var ni = na * sizeB + nb;
          if (dist[ni] === 255) { dist[ni] = depth + 1; next.push(ni); }
        }
      }
      frontier = next; depth++;
    }
    return dist;
  }

  // ---------- build everything (lazy) ----------
  var TBL = null;
  function build() {
    if (TBL) return TBL;
    var twistMv = twistMoveTable(), flipMv = flipMoveTable(), sliceMv = sliceMoveTable();
    var twistSlice = buildPrune(N_TWIST, N_SLICE, twistMv, sliceMv, 18, 0, SLICE_SOLVED, 18);
    var flipSlice = buildPrune(N_FLIP, N_SLICE, flipMv, sliceMv, 18, 0, SLICE_SOLVED, 18);
    var cpMv = cornerPermMoveTable();
    var e8Mv = permMoveTable(N_E8, 8, NS, nsIdxOfHome);
    var spMv = permMoveTable(N_SP, 4, SL, slIdxOfHome);
    var cpSlice = buildPrune(N_CP, N_SP, cpMv, spMv, 10, 0, 0, 10);
    var e8Slice = buildPrune(N_E8, N_SP, e8Mv, spMv, 10, 0, 0, 10);
    TBL = { twistSlice: twistSlice, flipSlice: flipSlice, cpSlice: cpSlice, e8Slice: e8Slice };
    return TBL;
  }

  // ---------- search ----------
  function axis(face) { return face === 'U' || face === 'D' ? 0 : face === 'R' || face === 'L' ? 1 : 2; }

  function solve(facelets, opts) {
    opts = opts || {};
    var T = build();
    var startState = readCubie(facelets);
    var timeBudget = opts.timeBudget || 800;
    var startTime = (opts.now || function () { return new Date().getTime(); })();

    var best = null;
    var sol1 = [];
    var now = (opts.now || function () { return new Date().getTime(); });
    var deadline = startTime + timeBudget;
    var stop = false;

    function phase1(s, depth, lastFace) {
      if (stop) return;
      if (best && (now() > deadline)) { stop = true; return; }
      var tw = twistCoord(s.co), fl = flipCoord(s.eo), sc = sliceCoord(s.ep);
      var h = Math.max(T.twistSlice[tw * N_SLICE + sc], T.flipSlice[fl * N_SLICE + sc]);
      if (h > depth) return;
      if (tw === 0 && fl === 0 && sc === SLICE_SOLVED) {
        // reached G1 -> run phase 2
        tryPhase2(s, sol1.slice());
        return;
      }
      if (depth === 0) return;
      for (var mi = 0; mi < 18; mi++) {
        var f = MOVE[mi].face;
        if (f === lastFace) continue;
        if (lastFace && axis(f) === axis(lastFace) && f > lastFace) continue;
        sol1.push(mi);
        phase1(applyMove(s, mi), depth - 1, f);
        sol1.pop();
        if (best && best.length <= depth) { /* allow continue to find shorter via outer loop */ }
      }
    }

    function tryPhase2(s, p1moves) {
      if (best && p1moves.length >= best.length) return; // can't beat
      var maxd = best ? best.length - p1moves.length - 1 : 30;
      var sol2 = [];
      function p2(st, depth, lastFace) {
        if (stop) return false;
        var cp = cornerPermCoord(st.cp), e8 = edge8Coord(st.ep), sp = slicePermCoord(st.ep);
        var h = Math.max(T.cpSlice[cp * N_SP + sp], T.e8Slice[e8 * N_SP + sp]);
        if (h > depth) return false;
        if (cp === 0 && e8 === 0 && sp === 0) {
          best = p1moves.concat(sol2.slice());
          return true;
        }
        if (depth === 0) return false;
        for (var mp = 0; mp < 10; mp++) {
          var mi = P2IDX[mp], f = MOVE[mi].face;
          if (f === lastFace) continue;
          if (lastFace && axis(f) === axis(lastFace) && f > lastFace) continue;
          sol2.push(mi);
          if (p2(applyMove(st, mi), depth - 1, f)) { return true; }
          sol2.pop();
        }
        return false;
      }
      for (var d = 0; d <= maxd; d++) { sol2 = []; if (p2(s, d, null)) break; }
    }

    for (var d1 = 0; d1 <= 20; d1++) {
      phase1(startState, d1, null);
      if (best && best.length <= d1) break;     // optimal-enough: phase1 alone >= best
      if (stop) break;
      if (best && now() > deadline) break;
    }
    if (!best) return null;
    return best.map(function (mi) { return MOVE[mi].name; });
  }

  return { solve: solve, build: build, _readCubie: readCubie, _MOVE: MOVE, _NAMES: NAMES };
});
