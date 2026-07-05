var E = require('./cube-engine.js');
var K = require('./kociemba.js');

// sanity: phase-2 moves keep slice edges within the slice
(function () {
  var MOVE = K._MOVE, NAMES = K._NAMES;
  // build isSlice via readCubie of solved is not exposed; quick check via names done in module.
})();

var t0 = Date.now();
K.build();
console.log('table build: ' + (Date.now() - t0) + 'ms');

var N = parseInt(process.argv[2] || '30', 10);
var seed = 987654321;
function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

var pass = 0, fail = 0, tot = 0, mx = 0, tSolve = 0;
for (var n = 0; n < N; n++) {
  var scr = E.scramble(25, rng);
  var start = E.applySeq(E.solvedState(), scr);
  var ts = Date.now();
  var sol = K.solve(start, { timeBudget: 800 });
  tSolve += Date.now() - ts;
  if (!sol) { fail++; console.log('NULL solution for: ' + scr.join(' ')); continue; }
  var check = E.applySeq(start, sol);
  if (E.isSolved(check)) { pass++; tot += sol.length; if (sol.length > mx) mx = sol.length; }
  else { fail++; console.log('WRONG: ' + scr.join(' ') + '\n   sol: ' + sol.join(' ')); }
}
console.log('---');
console.log('pass=' + pass + ' fail=' + fail + ' of ' + N);
if (pass) console.log('avg moves=' + (tot / pass).toFixed(1) + ' max=' + mx);
console.log('avg solve=' + (tSolve / N).toFixed(0) + 'ms');
process.exit(fail === 0 ? 0 : 1);
