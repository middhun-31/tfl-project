# TfL Bus Network Observatory

A standalone Data Observatory display wall and operator panel for the TfL
Gold-layer bus-arrival snapshot in
`apps/website/src/data/tfl_gold_insights.json`. No TfL API, database, or external
backend is required at runtime.

## Run locally

This repository is a pnpm workspace using Vite+:

```bash
pnpm install
pnpm dev
```

Open the root URL for the 2 × 3 display-wall preview. The full-screen combined
Overview is at `/screen`; the operator Panel is at `/control`.

## 6-Screen Wall Layout

The root preview opens six synchronized `/screen` tiles. Each tile has its own
view, while all tiles respond to the same Panel time, route, and direction
filters:

| Tile             | View                                                   |
| ---------------- | ------------------------------------------------------ |
| `/screen?tile=1` | Network KPIs                                           |
| `/screen?tile=2` | Congestion and longest average waits                   |
| `/screen?tile=3` | Bus bunching hotspots                                  |
| `/screen?tile=4` | Network average-wait trend across all snapshot windows |
| `/screen?tile=5` | Per-route average wait and active bus comparison       |
| `/screen?tile=6` | Top imminent arrivals countdown board                  |

Open `/screen` without a `tile` parameter for the combined Overview. The charts
use native HTML and SVG rendering; no charting dependency is required.

## Data Pipeline Context

`tfl_gold_insights.json` is exported from a local Apache Spark, Delta Lake, and
Unity Catalog OSS Medallion pipeline. Its Bronze → Silver → Gold processing
produces five-minute windowed aggregations of TfL bus arrivals by route,
station, and direction.

## Use the Panel and Display

- Scrub the available five-minute windows or press **Play** to advance every
  three seconds.
- Select bus routes and inbound/outbound direction to filter the Display.
- Choose **Overview**, **Congestion & Wait Times**, **Bunching Hotspots**, or
  **Live Countdown Board** to change the Display focus.
- Open `/screen` and `/control` in separate same-origin tabs or iframes; state
  changes synchronize through the browser's `BroadcastChannel` API.

The Display calculates its KPIs, wait-time and bunching bar charts, wait trend,
route comparisons, and countdown board directly from the bundled snapshot.
