# Importing widgets with download buttons

Given a json file for a Thingsboard widget, this code adds two CSV export buttons and configures the axes (particularly relevant when there are multiple series being displayed).

Tested against the same target as the rest of this folder: ThingsBoard CE 4.0.1.

## Usage

### Export

Export the widget that you want to add download buttons to. Ensure all the series you wish to display are present.

- Select `Edit mode` at the top right-hand corner of the dashboard
- Hover over the widget and select `Export widget` in the top right-hand corner

This will download a json file.

### Run the Python script

Configuration settings can be adjusted in `dashboard_config.py`.

The most important part to check is the `AXIS_PLAN`, which configures each variable.
- The dictionary key represents each variable, e.g. `h`, `t`, etc.
- `axis`: There must be a `default` axis, and the others should be named according to the variable
name
  - E.g. `h` is `default`, and `t` and `v` are set as `temperature` and `velocity`
- `divisor` and `decimals` control how the raw data is converted and the number of decimal places
displayed in both the chart and in the download
- `order` controls the order of the axes, relevant if there are multiple axes on the same side of the chart

To run the code, execute the Python script, specifying the source file (the json exported in the step above) and, optionally,
an output directory (this is `output/` by default) and the dashboard title, if relevant.

E.g.,


```bash
python build_dashboard.py --source line_chart_rl000590.json
```

or 

```bash
python build_dashboard.py --source line_chart_rl000590.json --output-dir my-output-dir --title my-dashboard-title
```

### Import the widget

**Whole dashboard**
- Dashboards → **+** → *Import dashboard* → upload
`rl000590_dashboard.json`.

**Just the chart**
- Into a dashboard you already have — edit the dashboard →
*Add widget* → **Import widget** → upload `rl000590_widget.json`.

Both files are generated. Do not hand-edit them; see *Rebuilding* below.

---

## What the buttons do

Two buttons appear in the chart's header, top right.

| Button | Icon | Range exported |
|---|---|---|
| Download visible window | `file_download` | Exactly what the dashboard time picker is showing |
| Download all history | `cloud_download` | The device's full history, ignoring the time picker |

Both write a **wide** CSV — one row per timestamp, one column per series:

```csv
Timestamp,DateTime,Temperature (centi-°C),Distance (mm),Voltage (mV)
1735689600000,2025-01-01T00:00:00.000Z,1204,1430,3812
1735689900000,2025-01-01T00:05:00.000Z,1204,1428,3811
```

`Timestamp` is Unix milliseconds, `DateTime` is ISO 8601 UTC. Column headers use
the widget's data-key labels rather than the raw `t` / `h` / `v` codes, so the
file is readable outside ThingsBoard — but the **units are the raw transmitted
ones**, not the chart's. See *Scaling is display-only* below.

*Download all history* asks for confirmation first, then pages backwards from
now in 50,000-point requests until the server stops returning full pages. It
stops at 20 pages (1M points per key) as a runaway guard; if it hits that limit
the success dialog says so explicitly rather than quietly handing you a
truncated file.

Both buttons authenticate with the JWT in `localStorage`. If you get an auth
error, refresh the page — the token has expired.

---

## Axes

The source export put all three series on one unlabelled axis. They carry
different units on very different scales (mm in the thousands, °C in the tens,
mV in the thousands), so a single axis cannot be given a label that means
anything. Each series now has its own:

| Series | Key | Axis | Label | Colour | Scaling | Decimals | Range |
|---|---|---|---|---|---|---|---|
| Distance | `h` | left | Distance (mm) | green `#4caf50` | raw | 0 | auto |
| Temperature | `t` | right | Temperature (°C) | blue `#2196f3` | ÷ 100 | 1 | auto |
| Voltage | `v` | right | Voltage (V) | red `#f44336` | ÷ 1000 | 1 | **0 – 4.2 V** |

The voltage axis is pinned rather than autoscaled: on a battery rail that barely
moves, autoscaling blows millivolt ripple up to full height and the shape tells
you nothing. Fixed against the cell's usable range, the trend is what you see.
Set `min`/`max` to `None` in `AXIS_PLAN` to go back to autoscaling.

Each axis — label, ticks, tick labels and axis line — is coloured to match its
series, so you can read a value off the right axis without tracing the line back
to the legend.

The x-axis is labelled *Time*. Only the left axis draws gridlines — three
overlapping sets of split lines is just noise. The legend is switched on
(it was off in the source export); with three axes it is needed to map colour
back to series, but its aggregate columns are off — see below.

To go back to one shared axis, point every `axis` in `AXIS_PLAN` in
`build_dashboard.py` at `"default"` and rebuild.

### Scaling is done in both the display and the CSV export

*To do: make this a configurable setting*

The node transmits centidegrees and millivolts. `AXIS_PLAN`'s `divisor` becomes
a ThingsBoard **post-processing function** on the data key
(`return value / 100;`), which applies to the chart AND the CSV export.

The download buttons call the raw telemetry API, which knows nothing about
widget post-processing, so **exported CSVs stay in raw units**. So the CSV shows the processed data, the scaling is applied a
second time inside `actions/_common.js`.

### Legend aggregates

The source export had `legendConfig.showAvg: true`. That column is invisible
while the legend is off, but became visible once the legend was switched on, and
an average is not meaningful across three series in three different units. All
five aggregate columns (`showAvg`, `showMin`, `showMax`, `showTotal`,
`showLatest`) are now off, leaving the legend as series names only.

Note this is separate from the **time-window aggregation**, which was already
`{"type": "NONE"}` in the source and is untouched — the chart plots raw points,
not bucketed averages.

---

## Files

```
build_dashboard.py            generator — run this after any edit
dashboard_config.py           configure the AXIS_PLAN and other settings
actions/
  _common.js                  shared helpers, spliced into both actions
  download_window.js          "Download visible window"
  download_all.js             "Download all history"
source/
  line_chart_rl000590.json    an example exported widget
```

ThingsBoard evaluates a custom action as one self-contained function body, so
`_common.js` cannot be imported at runtime — the build concatenates it onto the
front of each action script instead. That is why the two scripts share code in
this folder but appear duplicated in the generated JSON.

---

## Rebuilding

```bash
cd telemetry_pipeline/ThingsBoard/dashboards
python3 build_dashboard.py
```

No dependencies beyond the standard library. Widget and action ids are derived
with `uuid5` from a fixed namespace, so rebuilds are byte-stable and re-importing
updates the existing dashboard instead of creating a duplicate.

*To do: check this*

---

## Retargeting to another device

The datasource carries a literal device id, copied from the original export:

```
2a153aa0-6d58-11f1-832a-41dc5547a1f2   # RL000590
```

For a one-off, change `deviceId` in `source/line_chart_rl000590.json` and
rebuild. If you want one dashboard that can switch between nodes, replace the
datasource with an entity alias in the ThingsBoard UI after importing — the
action scripts read the device from `widgetContext.datasources[0]` at click time
and work unchanged with aliases.

---

## Relationship to `../download_button/`

The action scripts started as `download_button/download_button.js` and
`download_button/download_full_button_with_pagination.js`. Changes made while
adapting them:

- **Entity resolution.** The originals read the `entityId` argument, which
  ThingsBoard only populates for row-click and cell-button actions — it is
  undefined for a header button. `resolveEntity()` falls back to
  `widgetContext.datasources[0]`.
- **CSV assembly.** The originals ran `Array.prototype.find` over every point
  for every timestamp, which is quadratic and hangs the tab on a full-history
  export. Replaced with a timestamp → value lookup built once per key.
- **Deduplication.** The paginated version concatenated pages without checking
  for overlap, so points on a page boundary could appear twice. Timestamps are
  now tracked in a `Set` per key.
- **Truncation is reported.** Hitting the page limit previously produced a
  silently short file.
- **CSV escaping**, so values containing commas or quotes survive the round trip.
