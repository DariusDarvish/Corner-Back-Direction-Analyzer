# Cornerback Direction Analysis API Demo

*2026-09-12T18:38:40Z by Showboat 0.6.1*
<!-- showboat-id: b7604717-5c43-4a41-aab8-ec026a96453c -->

This demo exercises the compiled analyzer API in dist/components/cornerback-direction-analyzer.js. It verifies the new directional scoring flow, including average acceleration, de-acceleration magnitude, sustained speed, and the 0-100 ranking score.

```bash
node - <<'NODE'
const { analyzeCornerbackDirections } = require('./dist/components/cornerback-direction-analyzer.js');
const report = analyzeCornerbackDirections({ dataRoot: process.cwd() + '/NFL_DATA' });
console.log('source:', report.source);
console.log('results:', report.results.length);
console.log(JSON.stringify(report.results.slice(0, 3), null, 2));
NODE
```

```output
source: 37,500 CB input windows scanned
results: 629
[
  {
    "player": "Joshua Williams",
    "team": "KC",
    "direction": "South",
    "qualifyingRuns": 5,
    "averageAcceleration": 3.1124999999999985,
    "averageSpeedAfterFive": 6.263999999999999,
    "averageDeceleration": null,
    "score": 52,
    "accelerationSamples": 60,
    "speedSamples": 15
  },
  {
    "player": "L'Jarius Sneed",
    "team": "KC",
    "direction": "North",
    "qualifyingRuns": 9,
    "averageAcceleration": 2.8258947368421055,
    "averageSpeedAfterFive": 7.348222222222223,
    "averageDeceleration": null,
    "score": 62,
    "accelerationSamples": 95,
    "speedSamples": 45
  },
  {
    "player": "Cameron Sutton",
    "team": "DET",
    "direction": "East",
    "qualifyingRuns": 20,
    "averageAcceleration": 1.8589595375722545,
    "averageSpeedAfterFive": 7.16743902439024,
    "averageDeceleration": null,
    "score": 60,
    "accelerationSamples": 173,
    "speedSamples": 82
  }
]
```

A filtered call is also useful when you want to focus on one team or player. The API accepts optional playerNames, teams, directions, minimumDistanceYards, and speedStartDistanceYards filters.

```bash
node - <<'NODE'
const { analyzeCornerbackDirections } = require('./dist/components/cornerback-direction-analyzer.js');
const report = analyzeCornerbackDirections({
  dataRoot: process.cwd() + '/NFL_DATA',
  teams: ['KC'],
  directions: ['North'],
  playerNames: ["L'Jarius Sneed"],
});
console.log(JSON.stringify(report.results, null, 2));
NODE
```

```output
[
  {
    "player": "L'Jarius Sneed",
    "team": "KC",
    "direction": "North",
    "qualifyingRuns": 9,
    "averageAcceleration": 2.8258947368421055,
    "averageSpeedAfterFive": 7.348222222222223,
    "averageDeceleration": null,
    "score": 75,
    "accelerationSamples": 95,
    "speedSamples": 45
  }
]
```
