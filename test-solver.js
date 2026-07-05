// test-solver.js -- scramble many cubes, solve, verify the solution solves.
var E = require('./cube-engine.js');
var S = require('./solver.js');

var N = parseInt(process.argv[2] || '50', 10);
var SCRAMBLE_LEN = 25;

// deterministic RNG so failures are reproducible
var seed = 123456789;
function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

var pass = 0, fail = 0, totalMoves = 0, maxMoves = 0;
var t0 = Date.now();

for (var n = 0; n < N; n++) {
  var scr = E.scramble(SCRAMBLE_LEN, rng);
  var start = E.applySeq(E.solvedState(), scr);
  var res;
  try {
    res = S.solve(start);
  } catch (e) {
    fail++;
    console.log('FAIL (' + e.message + ') scramble: ' + scr.join(' '));
    continue;
  }
  // verify: applying the solution to the scrambled cube yields solved
  var check = E.applySeq(start, res.moves);
  if (E.isSolved(check) && res.solved) {
    pass++;
    totalMoves += res.moves.length;
    if (res.moves.length > maxMoves) maxMoves = res.moves.length;
  } else {
    fail++;
    console.log('FAIL (wrong solution) scramble: ' + scr.join(' '));
    console.log('   solution: ' + res.moves.join(' '));
  }
}

var dt = Date.now() - t0;
console.log('---');
console.log('pass=' + pass + ' fail=' + fail + ' of ' + N);
if (pass) console.log('avg moves=' + (totalMoves / pass).toFixed(1) + ' max=' + maxMoves);
console.log('time=' + dt + 'ms (' + (dt / N).toFixed(1) + 'ms/cube)');
process.exit(fail === 0 ? 0 : 1);
