# TfL Bus Network Observatory

A standalone Data Observatory display and operator panel for the TfL Gold-layer
bus-arrival snapshot in `apps/website/src/data/tfl_gold_insights.json`. The
snapshot represents the Gold output of a Bronze → Silver → Gold medallion
pipeline, aggregated into five-minute windows by route, station, and direction.
No TfL API, database, or external backend is required at runtime.

## Run locally

This repository is a pnpm workspace using Vite+:

```bash
pnpm install
pnpm dev
```

Open the root URL for the display-wall preview. The full-screen Display is at
`/screen`; the operator Panel is at `/control`.

## Use the Panel and Display

- Scrub the available five-minute windows or press **Play** to advance every
  three seconds.
- Select bus routes and inbound/outbound direction to filter the Display.
- Choose **Overview**, **Congestion & Wait Times**, **Bunching Hotspots**, or
  **Live Countdown Board** to change the Display focus.
- Open `/screen` and `/control` in separate same-origin tabs or iframes; state
  changes synchronize through the browser's `BroadcastChannel` API.

The Display calculates its KPIs, wait-time and bunching bar charts, and
countdown table directly from the bundled snapshot. The charts use native
browser rendering, so no additional charting package or network service is
needed.
