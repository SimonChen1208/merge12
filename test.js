// Rule checks + AI self-play. Usage: node test.js [games] [maxRounds]
const fs = require('fs'), assert = require('assert');
const engineOf = f => fs.readFileSync(__dirname + '/' + f, 'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const src = engineOf('index.html');
// the phone page carries its own copy of the rules; it must stay identical
assert.strictEqual(engineOf('mobile.html'), src, 'mobile.html engine differs from index.html: copy the <script id="engine"> block over');
const E = new Function(src + '\nreturn Engine;')();

// one row, slid left
const row = (cells, dir = 'left') => {
  const r = E.slide([...cells, ...Array(12).fill(0)], dir);
  return r && { line: r.board.slice(0, 4), merges: r.merges, mergePts: r.mergePts, combo: r.combo };
};
assert.deepStrictEqual(row([1, 1, 2, 3]), { line: [4, 0, 0, 0], merges: 3, mergePts: 4 + 8 + 16, combo: 5 });
assert.deepStrictEqual(row([1, 1, 1, 1]), { line: [3, 0, 0, 0], merges: 3, mergePts: 4 + 4 + 8, combo: 5 });
assert.deepStrictEqual(row([2, 1, 1, 0]), { line: [3, 0, 0, 0], merges: 2, mergePts: 4 + 8, combo: 3 });
assert.deepStrictEqual(row([0, 0, 0, 1]), { line: [1, 0, 0, 0], merges: 0, mergePts: 0, combo: 0 });
assert.deepStrictEqual(row([11, 11, 12, 0]), { line: [12, 12, 0, 0], merges: 1, mergePts: 4096, combo: 0 });
assert.strictEqual(row([1, 2, 1, 2]), null);          // nothing moves
assert.strictEqual(row([12, 12, 0, 0]), null);        // 12 is the cap
assert.deepStrictEqual(row([3, 2, 1, 1], 'right'), { line: [0, 0, 0, 4], merges: 3, mergePts: 28, combo: 5 }); // chains toward col 3
assert.deepStrictEqual(row([2, 2, 1, 0], 'right').line, [0, 0, 3, 1]);   // 1 lands first, the two 2s merge behind it

// every row collapses three times: 12-combo, the cap of the bonus table
const full = Array(4).fill([1, 1, 2, 3]).flat();
assert.strictEqual(E.slide(full, 'left').merges, 12);
assert.strictEqual(E.slide(full, 'left').combo, 30);
// columns
const col = [1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0];
assert.deepStrictEqual(E.slide(col, 'up').board, [3, ...Array(15).fill(0)]);
assert.strictEqual(E.slide(col, 'down').board[12], 3);
// skip and dead boards
const dead = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
assert.ok(E.isDead(dead));
assert.strictEqual(E.apply(dead, 'skip'), null);
assert.ok(E.apply([0, ...dead.slice(1)], 'skip'));
// spawn odds sum to 1
for (const k of [1, 2, 5, 14]) {
  const b = Array(16).fill(3); for (let i = 0; i < k; i++) b[i] = 0;
  const o = E.outcomes(b);
  assert.strictEqual(o.length, 2 * k * k);
  assert.ok(Math.abs(o.reduce((s, [, p]) => s + p, 0) - 1) < 1e-9);
}
console.log('rules ok');

// Self-play: one game until stuck or maxRounds, AI choosing every move.
const games = +process.argv[2] || 10, maxRounds = +process.argv[3] || 300;
const opt = JSON.parse(process.argv[4] || '{}');
let tot = { score: 0, rounds: 0, dead: 0, ms: 0, moves: 0 }, tiers = [];
for (let g = 0; g < games; g++) {
  let s = E.spawn(Array(16).fill(0)), b = s.board, score = s.pts, rounds = 0;
  while (rounds < maxRounds) {
    const t0 = Date.now(), res = E.best(b, opt);
    tot.ms += Date.now() - t0; tot.moves++;
    if (!res) { tot.dead++; break; }
    const r = E.apply(b, res.action);
    s = E.spawn(r.board);
    score += r.pts + s.pts; b = s.board; rounds++;
  }
  tot.score += score; tot.rounds += rounds; tiers.push(Math.max(...b));
}
console.log(`games ${games}  avg score ${(tot.score / games).toFixed(0)}  avg rounds ${(tot.rounds / games).toFixed(0)}  ` +
  `score/round ${(tot.score / tot.rounds).toFixed(1)}  stuck ${tot.dead}/${games}  max tiers ${tiers.join(',')}  ${(tot.ms / tot.moves).toFixed(1)} ms/move`);
