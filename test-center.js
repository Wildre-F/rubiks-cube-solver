var E = require('./cube-engine.js');
var K = require('./kociemba.js');
var CEN = require('./center.js');

// slice-aware centre-orientation tracker (frames)
var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
var GEOM = { U:['y',1,-1], D:['y',-1,1], R:['x',1,-1], L:['x',-1,1], F:['z',1,-1], B:['z',-1,1], M:['x',0,1], E:['y',0,1], S:['z',0,-1] };
var NORM = { U:[0,1,0], R:[1,0,0], F:[0,0,1], D:[0,-1,0], L:[-1,0,0], B:[0,0,-1] };
var UP = { U:[0,0,-1], R:[0,1,0], F:[0,1,0], D:[0,0,1], L:[0,1,0], B:[0,1,0] };
function rot(v, a, s) { var x=v[0],y=v[1],z=v[2]; if(a==='x')return[x,-s*z,s*y]; if(a==='y')return[s*z,y,-s*x]; return[-s*y,s*x,z]; }
function ai(a){ return a==='x'?0:a==='y'?1:2; }
function centerTwist(tokens) {
  var st = FACES.map(function(f){ return { n:NORM[f].slice(), u:UP[f].slice() }; });
  tokens.forEach(function(m){ var g=GEOM[m[0]],axis=g[0],layer=g[1],s=g[2],suf=m.slice(1),times=suf==='2'?2:1; if(suf==="'")s=-s;
    for(var t=0;t<times;t++) st.forEach(function(c){ if(c.n[ai(axis)]===layer){ c.n=rot(c.n,axis,s); c.u=rot(c.u,axis,s);} }); });
  return FACES.map(function(f,i){ var c=st[i],N=NORM[f],U0=UP[f];
    var cr=[U0[1]*c.u[2]-U0[2]*c.u[1],U0[2]*c.u[0]-U0[0]*c.u[2],U0[0]*c.u[1]-U0[1]*c.u[0]];
    var t=Math.round(Math.atan2(N[0]*cr[0]+N[1]*cr[1]+N[2]*cr[2], U0[0]*c.u[0]+U0[1]*c.u[1]+U0[2]*c.u[2])/(Math.PI/2));
    return ((-t)%4+4)%4; });
}

K.build(); CEN.build();
var N = parseInt(process.argv[2] || '40', 10);
var seed = 24681012;
function rng(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }

var pass=0, fail=0, totFix=0, mxFix=0, nullCount=0;
for (var n=0;n<N;n++){
  var scr = E.scramble(25, rng);
  var start = E.applySeq(E.solvedState(), scr);
  var colorSol = K.solve(start, { timeBudget: 700 });
  if (!colorSol){ fail++; console.log('no color solution'); continue; }
  // residual centre orientation after the colour solve
  var resArr = centerTwist(scr.concat(colorSol));
  var residual = {}; FACES.forEach(function(f,i){ residual[f]=resArr[i]; });
  var fix = CEN.solve(residual);
  if (!fix){ fail++; nullCount++; console.log('NO FIX for residual '+resArr.join(',')); continue; }
  var full = colorSol.concat(fix.moves);
  var colorsOK = E.isSolved(E.applySeq(start, full));
  var finalC = centerTwist(scr.concat(full));
  var centersOK = finalC.every(function(v){ return v===0; });
  if (colorsOK && centersOK){ pass++; totFix+=fix.moves.length; if(fix.moves.length>mxFix)mxFix=fix.moves.length; }
  else { fail++; console.log('FAIL colors='+colorsOK+' centers='+centersOK+' resid='+resArr.join(',')+' final='+finalC.join(',')); }
}
console.log('---');
console.log('pass='+pass+' fail='+fail+' of '+N+(nullCount?(' ('+nullCount+' unsolvable residuals)'):''));
if (pass) console.log('avg centre-fix moves='+(totFix/pass).toFixed(1)+' max='+mxFix);
process.exit(fail===0?0:1);
