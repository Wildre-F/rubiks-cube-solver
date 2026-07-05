// center.js -- picture-cube centre-orientation solver.
// After the colours are solved, centres may still be rotated (a "picture cube"
// has a definite up-direction per face). Each face turn rotates that face's
// centre, so a centre's net rotation = net quarter-turns of that face (mod 4).
// This module appends colour-neutral "supercube" generator algorithms (each
// verified to leave the colours solved) to rotate the centres upright.
//
// Generators were discovered + verified offline (see center-discover.js): each
// is [twistVector(6, per face U R F D L B, in quarter-turns CW), sequence].

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.CenterSolver = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

  // Verified colour-neutral centre generators (face + slice moves): single
  // and paired 90 / 180 centre rotations. Together they span all 2048
  // reachable centre-orientation states.
  var GENERATORS = [[[2,0,0,0,0,0],"U R L U2 R' L' U R L U2 R' L'"],[[0,0,2,0,0,0],"F R L F2 R' L' F R L F2 R' L'"],[[0,2,0,0,0,0],"R D U R2 D' U' R D U R2 D' U'"],[[0,0,0,2,0,0],"D R L D2 R' L' D R L D2 R' L'"],[[0,0,0,0,0,2],"B D U B2 D' U' B D U B2 D' U'"],[[0,0,0,0,2,0],"L D U L2 D' U' L D U L2 D' U'"],[[1,0,0,0,3,0],"U M E M' U' M E' M'"],[[3,0,0,0,1,0],"M E M' U M E' M' U'"],[[1,3,0,0,0,0],"U M E' M' U' M E M'"],[[3,1,0,0,0,0],"M E' M' U M E M' U'"],[[1,0,0,3,0,0],"U M E2 M' U' M E2 M'"],[[3,0,0,1,0,0],"M E2 M' U M E2 M' U'"],[[1,0,3,0,0,0],"U S E S' U' S E' S'"],[[3,0,1,0,0,0],"S E S' U S E' S' U'"],[[1,0,0,0,0,3],"U S E' S' U' S E S'"],[[3,0,0,0,0,1],"S E' S' U S E S' U'"],[[0,2,0,0,2,0],"U2 R2 U2 S2 U2 R2 U2 S2"],[[0,0,0,2,2,0],"U2 R2 D2 S D2 R2 U2 S'"],[[2,0,0,0,2,0],"U2 R2 D2 S' D2 R2 U2 S"],[[0,2,0,2,0,0],"U2 R2 S R2 U2 L2 S' L2"],[[2,0,0,2,0,0],"U2 R2 S2 R2 U2 R2 S2 R2"],[[0,0,2,0,0,2],"U2 F2 U2 M2 U2 F2 U2 M2"],[[0,0,0,2,0,2],"U2 F2 D2 M D2 F2 U2 M'"],[[2,0,0,0,0,2],"U2 F2 D2 M' D2 F2 U2 M"],[[0,0,2,2,0,0],"U2 F2 M F2 U2 B2 M' B2"],[[2,2,0,0,0,0],"U2 L2 D2 S D2 L2 U2 S'"],[[2,0,2,0,0,0],"U2 B2 D2 M D2 B2 U2 M'"],[[2,0,2,2,0,2],"U2 M U2 S2 D2 M D2 S2"],[[2,2,0,2,2,0],"U2 M2 D2 S D2 M2 U2 S"],[[0,1,0,3,0,0],"R E M E' R' E M' E'"],[[0,3,0,1,0,0],"E M E' R E M' E' R'"],[[0,1,0,0,3,0],"R E M2 E' R' E M2 E'"],[[0,3,0,0,1,0],"E M2 E' R E M2 E' R'"],[[0,1,3,0,0,0],"R S M S' R' S M' S'"],[[0,3,1,0,0,0],"S M S' R S M' S' R'"],[[0,1,0,0,0,3],"R S M' S' R' S M S'"],[[0,3,0,0,0,1],"S M' S' R S M S' R'"],[[0,2,0,0,0,2],"R2 F2 L2 E L2 F2 R2 E'"],[[0,0,0,0,2,2],"R2 F2 L2 E' L2 F2 R2 E"],[[0,0,2,0,2,0],"R2 F2 E' F2 R2 B2 E B2"],[[0,2,2,0,0,0],"R2 B2 L2 E' L2 B2 R2 E"],[[0,2,2,0,2,2],"R2 E R2 S2 L2 E L2 S2"],[[0,0,1,0,3,0],"F M S' M' F' M S M'"],[[0,0,3,0,1,0],"M S' M' F M S M' F'"],[[0,0,1,0,0,3],"F M S2 M' F' M S2 M'"],[[0,0,3,0,0,1],"M S2 M' F M S2 M' F'"],[[0,0,1,3,0,0],"F E S' E' F' E S E'"],[[0,0,3,1,0,0],"E S' E' F E S E' F'"],[[0,0,0,1,3,0],"D M E' M' D' M E M'"],[[0,0,0,3,1,0],"M E' M' D M E M' D'"],[[0,0,0,1,0,3],"D S E S' D' S E' S'"],[[0,0,0,3,0,1],"S E S' D S E' S' D'"],[[0,0,0,0,1,3],"L S M S' L' S M' S'"],[[0,0,0,0,3,1],"S M S' L S M' S' L'"],[[0,1,3,0,3,1],"M E M E' M' S M' S'"],[[0,3,1,0,1,3],"S M S' M E M' E' M'"],[[1,2,1,3,2,3],"E M S M2 E' M S'"],[[1,0,3,3,0,1],"M E M S M' S' M' E'"],[[3,2,3,1,2,1],"S M' E M2 S' M' E'"],[[3,0,1,1,0,3],"E M S M S' M' E' M'"],[[3,3,0,1,1,0],"M E M' E S E' S' E'"],[[1,1,0,3,3,0],"E S E S' E' M E' M'"],[[0,1,1,0,3,3],"M E M' E' M' S M S'"],[[0,3,3,0,1,1],"S M' S' M E M E' M'"],[[3,2,1,1,2,3],"S M' E S' M' E' M2"],[[1,2,3,3,2,1],"M2 E M S E' M S'"],[[2,1,1,2,3,3],"M E M2 S M E' S'"],[[2,3,3,2,1,1],"S E M' S' M2 E' M'"],[[2,1,3,2,3,1],"M E' M2 S' M E S"],[[2,3,1,2,1,3],"S' E' M' S M2 E M'"],[[3,1,0,1,3,0],"M E' M' E S E S' E'"],[[1,3,0,3,1,0],"E S E' S' E' M E M'"],[[1,1,2,3,3,2],"M' E2 S E M S' E"],[[3,3,2,1,1,2],"E' S M' E' S' E2 M"],[[3,1,2,1,3,2],"M' E2 S' E' M S E'"],[[1,3,2,3,1,2],"E S' M' E S E2 M"],[[3,0,3,1,0,1],"M S M E' M' E M' S'"],[[1,0,1,3,0,3],"E' M' S M' S' M E M"]];

  function enc(v) { return ((((v[0] * 4 + v[1]) * 4 + v[2]) * 4 + v[3]) * 4 + v[4]) * 4 + v[5]; }
  function dec(e) { var v = []; for (var i = 5; i >= 0; i--) { v[i] = e % 4; e = (e - v[i]) / 4; } return v; }

  // Dijkstra from origin over the Cayley graph (4096 states), edges = generators
  // weighted by sequence length. Precomputed once.
  var DIST = null, PREDG = null, PREDS = null;
  function build() {
    if (DIST) return;
    var N = 4096;
    DIST = new Int32Array(N); PREDG = new Int16Array(N); PREDS = new Int32Array(N);
    for (var i = 0; i < N; i++) { DIST[i] = 1e9; PREDG[i] = -1; PREDS[i] = -1; }
    var glen = GENERATORS.map(function (g) { return g[1].trim().split(/\s+/).length; });
    var gtw = GENERATORS.map(function (g) { return g[0]; });
    var start = enc([0, 0, 0, 0, 0, 0]);
    DIST[start] = 0;
    // simple Dijkstra (small graph)
    var done = new Uint8Array(N);
    for (var k = 0; k < N; k++) {
      var u = -1, best = 1e9;
      for (var s = 0; s < N; s++) if (!done[s] && DIST[s] < best) { best = DIST[s]; u = s; }
      if (u < 0) break;
      done[u] = 1;
      var uv = dec(u);
      for (var g = 0; g < GENERATORS.length; g++) {
        var tw = gtw[g];
        var nv = [(uv[0] + tw[0]) % 4, (uv[1] + tw[1]) % 4, (uv[2] + tw[2]) % 4,
                  (uv[3] + tw[3]) % 4, (uv[4] + tw[4]) % 4, (uv[5] + tw[5]) % 4];
        var ne = enc(nv), nd = DIST[u] + glen[g];
        if (nd < DIST[ne]) { DIST[ne] = nd; PREDG[ne] = g; PREDS[ne] = u; }
      }
    }
  }

  // residual: per-face current centre orientation that we want to drive to 0.
  // residual is an object {U,R,F,D,L,B} (0..3). Returns {moves:[], gens:[seqStrings]}.
  function solve(residual) {
    build();
    // we need a sequence with twist V = -residual (so residual + V = 0)
    var V = FACES.map(function (f) { return (4 - (residual[f] % 4)) % 4; });
    var target = enc(V);
    if (DIST[target] >= 1e9) return null; // unreachable (shouldn't happen)
    var path = [];
    var cur = target;
    while (cur !== enc([0, 0, 0, 0, 0, 0])) {
      var g = PREDG[cur];
      if (g < 0) return null;
      path.push(g);
      cur = PREDS[cur];
    }
    path.reverse();
    var gens = path.map(function (gi) { return GENERATORS[gi][1]; });
    var moves = [];
    gens.forEach(function (seq) { seq.trim().split(/\s+/).forEach(function (m) { moves.push(m); }); });
    return { moves: moves, gens: gens };
  }

  return { solve: solve, build: build, GENERATORS: GENERATORS };
});
