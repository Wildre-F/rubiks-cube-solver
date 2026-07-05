// test-engine.js  -- sanity checks for the cube model & move generator.
var E = require('./cube-engine.js');

var fails = 0;
function ok(cond, msg) {
  if (!cond) { fails++; console.log('  FAIL: ' + msg); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

var solved = E.solvedState();

// 1) Solved state is solved; a single turn is not.
ok(E.isSolved(solved), 'solved state reports solved');
ok(!E.isSolved(E.applySeq(solved, 'R')), 'one turn is not solved');

// 2) Every face turn has order 4 (X X X X == identity).
E.FACES.forEach(function (f) {
  ok(eq(E.applySeq(solved, [f, f, f, f]), solved), f + ' X4 == identity');
  ok(eq(E.applySeq(solved, [f, f]), E.applySeq(solved, f + '2')), f + '2 == X X');
  ok(eq(E.applySeq(solved, [f, f + "'"]), solved), f + " then " + f + "' == identity");
});

// 3) Geometry / handedness: R clockwise lifts the F right column to the U
//    right column. So after R, U2/U5/U8 must show old F2/F5/F8 colours.
var afterR = E.applySeq(solved, 'R');
ok(afterR[2] === Math.floor(20 / 9), 'R: U2 <- F2'); // F2=20 -> face 2
ok(afterR[5] === Math.floor(23 / 9), 'R: U5 <- F5');
ok(afterR[8] === Math.floor(26 / 9), 'R: U8 <- F8');

// 4) Classic invariant: (R U R' U') has order 6.
var s = solved;
for (var i = 0; i < 6; i++) s = E.applySeq(s, "R U R' U'");
ok(eq(s, solved), "(R U R' U')^6 == identity");

// 5) Sexy move x6 on a scrambled cube also returns to that scramble.
var scr = E.applySeq(solved, "F2 B U2 L D'");
var s2 = scr;
for (var j = 0; j < 6; j++) s2 = E.applySeq(s2, "R U R' U'");
ok(eq(s2, scr), "(R U R' U')^6 identity from a scramble too");

// 6) A scramble followed by its exact inverse returns to solved.
var moves = E.scramble(40);
var inv = moves.slice().reverse().map(function (m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
});
ok(E.isSolved(E.applySeq(E.applySeq(solved, moves), inv)), 'scramble + inverse == solved');

// 7) Centres never move.
var anyScramble = E.applySeq(solved, E.scramble(50));
var centresOk = true;
for (var c = 0; c < 6; c++) if (anyScramble[c * 9 + 4] !== c) centresOk = false;
ok(centresOk, 'centres are invariant under all moves');

console.log(fails === 0 ? 'ENGINE OK — all checks passed' : ('ENGINE: ' + fails + ' failure(s)'));
process.exit(fails === 0 ? 0 : 1);
