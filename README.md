# NFL Cover 2 Cornerback Analyzer

An Electron + TypeScript desktop app for examining cornerback movement in the tracking files in `NFL_DATA`.

## Start the app

```bash
npm install
npm start
```

The first analysis can take a little time because `NFL_DATA` is approximately 824 MB. Select a defensive team and/or type a cornerback's name, then choose **Apply**.

### Direction analysis

The app implements these ranges exactly: North `315–45` (wrapping through 0), East `46–134`, South `135–224`, and West `225–314`. It accepts a frame only when the player's orientation (`o`) and movement direction (`dir`) land in the same range. It then:

1. Uses cumulative Euclidean travel from `x`/`y` to find runs of at least 5 yards.
2. Averages acceleration (`a`) over yards 0–5 of each qualifying run.
3. Averages speed (`s`) from yard 6 onward, while the orientation/direction still match that cardinal direction.

The data does not include `ball_snap` or `pass_forward` event labels. The full supplied input window is therefore used as a snap-to-pass-forward proxy.

### Reusable analyzer component

The movement calculation is a reusable TypeScript module at `src/components/cornerback-direction-analyzer.ts`, rather than being embedded in the Electron window. Call it from Electron's main process, another Node service, or a test:

```ts
import { analyzeCornerbackDirections } from './components/cornerback-direction-analyzer';

const report = analyzeCornerbackDirections({
  dataRoot: '/absolute/path/to/NFL_DATA',
  teams: ['KC'],
  playerNames: ['LJarius Sneed'],
  directions: ['North', 'West'],
  minimumDistanceYards: 5,
  speedStartDistanceYards: 6,
});
```

All filters are optional. The Electron bridge accepts the same parameters except `dataRoot`, which is fixed to this project's `NFL_DATA` folder for safety.

## CSV to JSON converter

The converter processes one file at a time, so it does not load the entire data set into memory. It creates a standard JSON array for every source CSV and preserves the source folder structure.

### Test the converter with one small file

This is the recommended first test. It converts only the play metadata CSV, writes output to a temporary location, and leaves `NFL_DATA` unchanged.

```bash
npm run convert:data -- \
  --source NFL_DATA/supplementary_data.csv \
  --output /private/tmp/nfl-json-test
```

Confirm the result is valid JSON and inspect the first record:

```bash
node -e "const x=require('/private/tmp/nfl-json-test/supplementary_data.json'); console.log(x.length, x[0])"
```

Expected result: `18009` records, followed by the first play object.

### Convert every NFL CSV file

```bash
npm run convert:data
```

This writes files beneath `NFL_DATA_JSON/`. For example:

```text
NFL_DATA/supplementary_data.csv       → NFL_DATA_JSON/supplementary_data.json
NFL_DATA/train/input_2023_w01.csv     → NFL_DATA_JSON/train/input_2023_w01.json
```

The full export is large and can take time; make sure you have several GB of free disk space before running it.

### Use a different source or destination

```bash
npm run convert:data -- --source path/to/csv-or-folder --output path/to/json-output
```

When `--source` is a single CSV, its JSON file is placed directly inside the output folder. When the source is a folder, its nested layout is retained.

## Measurement definition

The supplied input tracking data has no explicit snap event. The app therefore uses a defensive CB's first available tracking frame as the initial position. It normalizes movement for the offense's play direction, measures depth as movement away from the line of scrimmage, and defines “settled” as the first point at 90% or more of the player's maximum depth followed by three frames at 0.75 yd/s or slower. Tracking frames are treated as 10 Hz.
