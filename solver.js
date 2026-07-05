// solver.js
// Layer-by-layer 3x3 solver built on cube-engine.js.
//
// Design: the solve proceeds through the usual LBL stages (bottom cross ->
// bottom corners -> middle edges -> last-layer orient -> last-layer permute).
// Each stage is expressed as "make this set of facelets correct while keeping
// this other set correct", and a small breadth-first search over a curated
// move/algorithm library finds the shortest sequence that does it. This is
// correct-by-search rather than correct-by-memorised-cases.
//
// Works in Node (module.exports) and the browser (window.CubeSolver).

(function (root, factory) {
  var E = (typeof require !== 'undefined') ? require('./cube-engine.js')
        : (root.CubeEngine);
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(E);
  else root.CubeSolver = factory(E);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var MOVES = E.MOVES, applyPerm = E.applyPerm, parse = E.parse, pos = E.pos;

  function solvedVal(i) { return Math.floor(i / 9); }

  // ---- facelet index groups (derived from geometry, see comments) --------
  // Bottom (D) cross edge slots: [D-sticker, side-sticker]
  var CROSS = {
    F: [28, 25], R: [32, 16], B: [34, 52], L: [30, 43]
  };
  // Bottom (D) corner slots: 3 facelets each
  var FL_CORNERS = {
    DRF: [29, 26, 15], DRB: [35, 17, 51], DBL: [33, 53, 42], DLF: [27, 44, 24]
  };
  // Middle (E) edge slots: 2 facelets each
  var MID = {
    FR: [23, 12], RB: [14, 48], BL: [50, 39], LF: [41, 21]
  };

  var U_FACE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  var U_EDGES = [1, 3, 5, 7];
  var U_CORNER_SIDES = [18, 20, 9, 11, 45, 47, 36, 38]; // top-row corner stickers of F,R,B,L
  var ALL_IDX = []; for (var z = 0; z < 54; z++) ALL_IDX.push(z);
  var F2L_IDX = ALL_IDX.filter(function (i) { return pos[i][1] !== 1; }); // not in U layer

  function correct(state, idxs) {
    for (var k = 0; k < idxs.length; k++) if (state[idxs[k]] !== solvedVal(idxs[k])) return false;
    return true;
  }

  // ---- move-library relabelling (for generating slot variants) -----------
  // y-rotation letter map: F->R->B->L->F, U/D fixed. Applied k times.
  var YMAP = { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' };
  function relabelTok(tok, k) {
    var face = tok[0], suf = tok.slice(1);
    for (var n = 0; n < k; n++) face = YMAP[face];
    return face + suf;
  }
  function relabelSeq(seq, k) {
    return parse(seq).map(function (t) { return relabelTok(t, k); }).join(' ');
  }
  function rotations(seq) {
    var out = [];
    for (var k = 0; k < 4; k++) out.push(relabelSeq(seq, k));
    return out;
  }

  // ---- move libraries ----------------------------------------------------
  var LIB_CROSS = ['U', "U'", 'U2', 'F', 'F2', "F'", 'R', 'R2', "R'",
                   'B', 'B2', "B'", 'L', 'L2', "L'"];
  var LIB_CORNER = ['U', "U'", 'U2', 'R', 'R2', "R'", 'F', 'F2', "F'",
                    'L', 'L2', "L'", 'B', 'B2', "B'"];
  // Middle: AUF + the two F2L edge-insert triggers, in all 4 slot rotations.
  var LIB_MID = ['U', "U'", 'U2']
    .concat(rotations("U R U' R' U' F' U F"))
    .concat(rotations("U' L' U L U F U' F'"));
  // Last layer:
  var LIB_EO = ['U', "U'", 'U2', "F R U R' U' F'", "F U R U' R' F'"];
  var LIB_CO = ['U', "U'", 'U2', "R U R' U R U2 R'", "R U2 R' U' R U' R'",
                "R' U' R U' R' U2 R", "L' U' L U' L' U2 L"];
  var LIB_CP = ['U', "U'", 'U2', "R' F R' B2 R F' R' B2 R2", "R B' R F2 R' B R F2 R2"];
  var LIB_EP = ['U', "U'", 'U2', "R U' R U R U R U' R' U' R2",
                "R2 U R U R' U' R' U' R' U R'"];

  function applyTokens(state, tokens) {
    var s = state;
    for (var i = 0; i < tokens.length; i++) s = applyPerm(s, MOVES[tokens[i]]);
    return s;
  }

  // Breadth-first search over a move library.
  //  goalIdx     : facelets that must be correct at the end
  //  preserveIdx : facelets that must also be correct at the end
  //  maxDepth    : maximum number of LIBRARY STEPS (not move tokens)
  //  prunePreserve: if true, require preserveIdx correct at EVERY node (only
  //                 valid when every library entry preserves them) -> fast.
  var CAP = 1500000; // node budget guard
  function findSeq(start, lib, goalIdx, preserveIdx, maxDepth, prunePreserve) {
    var libTok = lib.map(parse);
    // face of a single-move entry (null for multi-move algorithms)
    var libFace = libTok.map(function (t) { return t.length === 1 ? t[0][0] : null; });
    function done(s) { return correct(s, goalIdx) && correct(s, preserveIdx); }
    if (done(start)) return [];
    var visited = {}; visited[start.join('')] = 1;
    var queue = [{ s: start, m: [], d: 0, lf: null }], head = 0;
    while (head < queue.length) {
      var node = queue[head++];
      if (node.d >= maxDepth) continue;
      for (var li = 0; li < libTok.length; li++) {
        // same-face pruning, only between two single-move entries (safe: a
        // shortest solution never has two consecutive same-face turns).
        if (libFace[li] && node.lf && libFace[li] === node.lf) continue;
        var ns = applyTokens(node.s, libTok[li]);
        if (prunePreserve && !correct(ns, preserveIdx)) continue;
        var key = ns.join('');
        if (visited[key]) continue;
        visited[key] = 1;
        var nm = node.m.concat(libTok[li]);
        if (correct(ns, goalIdx) && correct(ns, preserveIdx)) return nm;
        if (head + queue.length < CAP) {
          queue.push({ s: ns, m: nm, d: node.d + 1, lf: libFace[li] });
        }
      }
    }
    return null;
  }

  // Collapse a token list: combine consecutive same-face turns, drop no-ops.
  function simplify(tokens) {
    var amt = { '': 1, "'": 3, '2': 2 };
    var sufOf = [null, '', '2', "'"];
    var out = tokens.slice();
    var changed = true;
    while (changed) {
      changed = false;
      var res = [];
      for (var i = 0; i < out.length; i++) {
        if (res.length) {
          var prev = res[res.length - 1];
          if (prev[0] === out[i][0]) {
            var tot = (amt[prev.slice(1)] + amt[out[i].slice(1)]) % 4;
            res.pop();
            if (tot !== 0) res.push(out[i][0] + sufOf[tot]);
            changed = true;
            continue;
          }
        }
        res.push(out[i]);
      }
      out = res;
    }
    return out;
  }

  // ---- the staged plan ---------------------------------------------------
  function buildPlan() {
    var plan = [];
    var acc = [];
    // 1) bottom cross, one edge at a time
    ['F', 'R', 'B', 'L'].forEach(function (side) {
      var g = CROSS[side];
      plan.push({ name: 'Bottom cross: ' + side + ' edge', lib: LIB_CROSS,
                  goal: g, preserve: acc.slice(), depth: 7, prune: false });
      acc = acc.concat(g);
    });
    // 2) bottom corners
    ['DRF', 'DRB', 'DBL', 'DLF'].forEach(function (c) {
      var g = FL_CORNERS[c];
      plan.push({ name: 'Bottom corner: ' + c, lib: LIB_CORNER,
                  goal: g, preserve: acc.slice(), depth: 8, prune: false });
      acc = acc.concat(g);
    });
    // 3) middle edges (first layer fully solved now -> can prune)
    var firstLayer = acc.slice();
    ['FR', 'RB', 'BL', 'LF'].forEach(function (m) {
      var g = MID[m];
      plan.push({ name: 'Middle edge: ' + m, lib: LIB_MID,
                  goal: g, preserve: firstLayer.concat(midSoFar(m)), depth: 5, prune: true });
    });
    function midSoFar(upTo) {
      var order = ['FR', 'RB', 'BL', 'LF'], r = [];
      for (var i = 0; i < order.length && order[i] !== upTo; i++) r = r.concat(MID[order[i]]);
      return r;
    }
    // 4) last layer
    plan.push({ name: 'Top cross (orient edges)', lib: LIB_EO,
                goal: U_EDGES, preserve: F2L_IDX, depth: 4, prune: true });
    plan.push({ name: 'Orient last layer (top face)', lib: LIB_CO,
                goal: U_FACE, preserve: F2L_IDX.concat(U_EDGES), depth: 8, prune: true });
    plan.push({ name: 'Position top corners', lib: LIB_CP,
                goal: U_CORNER_SIDES, preserve: F2L_IDX.concat(U_FACE), depth: 6, prune: true });
    plan.push({ name: 'Position top edges', lib: LIB_EP,
                goal: ALL_IDX, preserve: F2L_IDX.concat(U_FACE), depth: 6, prune: true });
    return plan;
  }
  var PLAN = buildPlan();

  function solve(state) {
    var s = state.slice();
    var stages = [];
    for (var i = 0; i < PLAN.length; i++) {
      var st = PLAN[i];
      var seq = findSeq(s, st.lib, st.goal, st.preserve, st.depth, st.prune);
      if (seq === null) {
        throw new Error('Solver stuck at stage: ' + st.name);
      }
      s = applyTokens(s, seq);
      stages.push({ name: st.name, moves: simplify(seq) });
    }
    // overall move list
    var all = [];
    stages.forEach(function (st) { all = all.concat(st.moves); });
    return { moves: simplify(all), stages: stages, solved: E.isSolved(s) };
  }

  return { solve: solve, simplify: simplify, PLAN: PLAN };
});
