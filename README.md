# NFL Cover 2 Cornerback Analyzer

This project is an Electron + TypeScript desktop app for analyzing cornerback movement in the provided `NFL_DATA` tracking files.

It focuses on one question: how do cornerbacks accelerate and move at speed when their orientation and movement direction line up in a specific cardinal direction?

## What the app analyzes

The app uses the supplied tracking windows to evaluate cornerback movement by direction:

- North: `315–45`
- East: `46–134`
- South: `135–224`
- West: `225–314`

For each player, the app:

1. Checks only frames where the player's orientation (`o`) and movement direction (`dir`) match the same cardinal direction.
2. Builds a running total of cumulative Euclidean travel from `x`/`y`.
3. Treats a qualifying run as a sequence with at least 5 yards of travel.
4. Averages acceleration (`a`) for the first 0–5 yards of each qualifying run.
5. Averages speed (`s`) from 6 yards onward while the same direction remains active.

The app then aggregates those measurements by player, team, and direction so you can compare cornerbacks in different movement directions.

## Run the app

1. Make sure the `NFL_DATA` folder is present in the project root.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm start
```

The app will build the TypeScript sources and open the Electron window.

## Use the app

From the interface, you can:

- filter by defensive team
- filter by player name
- filter by direction
- view how many qualifying runs were used for each result
- review average acceleration and average speed for each cornerback direction combination

The app is designed specifically for understanding cornerback acceleration and speed in defined directions, not for general NFL data conversion or unrelated analytics.
