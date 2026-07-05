<div align="center">

# 🧩 Rubik's Cube Solver

**A browser-based Rubik's cube solver with two solving engines built from scratch.**

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-5c5fd4?style=flat-square&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-1d9e75?style=flat-square&logoColor=white)
![Algorithm](https://img.shields.io/badge/Kociemba-Two--Phase-7f77dd?style=flat-square&logoColor=white)
![Open Source](https://img.shields.io/badge/Open-Source-ff69b4?style=flat-square&logoColor=white)

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-1d9e75?style=for-the-badge&logoColor=white)](https://wildre-f.github.io/rubiks-cube-solver/)

<img src="https://skillicons.dev/icons?i=js,html,css,nodejs" />

</div>

---

##  Overview

Enter a scrambled cube on the interactive colour net and the app works out a full, step-by-step
solution. It ships with **two independent solving engines** written from scratch (no libraries), and
even handles **picture cubes**, where each face has an up-direction, so centres must end upright too.

Everything runs client-side in a single HTML file. The same solver code also runs in Node, which is
how the test suite verifies it.

##  Features

- **Interactive visual net** for entering the scramble, with validation that flags impossible or
  incomplete cube states before solving.
- **Two solving engines:**
  - **Layer-by-layer solver** that finds each stage through a breadth-first search over a curated
    move library (correct-by-search, not by memorised cases).
  - **Kociemba's two-phase algorithm** that produces near-optimal (~20-move) solutions using
    **IDA\* search guided by BFS pruning tables**.
- **Picture-cube centre orientation:** colour-neutral "supercube" algorithms rotate the face
  centres upright once the colours are solved.
- **Custom cube/facelet engine** that models the cube from its geometry, shared by both solvers.
- **Zero dependencies** and framework-free: just open the page.

##  How it works

| Layer | What it does |
|---|---|
| `cube-engine.js` | The facelet model and move engine (permutations derived from cube geometry). |
| `solver.js` | Layer-by-layer solver: each stage is a small BFS that fixes one set of pieces while preserving the rest. |
| `kociemba.js` | Two-phase solver: Phase 1 reduces the cube to the G1 group, Phase 2 solves within it, both via IDA\* with pruning tables. |
| `center.js` | Picture-cube solver: appends verified colour-neutral sequences to orient the centres. |
| `index.html` | The full UI: interactive net, controls and rendering. |
| `serve.js` | A tiny dependency-free static server for local preview. |

##  Run it locally

```bash
git clone https://github.com/Wildre-F/rubiks-cube-solver.git
cd rubiks-cube-solver

# Option 1: just open index.html in your browser

# Option 2: run the tiny local server
node serve.js
# then open http://localhost:8123
```

Run the test suite (plain Node, no dependencies):

```bash
node test-engine.js
node test-solver.js
node test-kociemba.js
node test-center.js
```

##  Built with

<div align="center">
  <img src="https://skillicons.dev/icons?i=js,html,css,nodejs" />
</div>

<br/>

<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=13&pause=1000&color=7f77dd&center=true&vCenter=true&width=560&lines=Solved+from+scratch%2C+one+algorithm+at+a+time." alt="Footer" />
</div>
