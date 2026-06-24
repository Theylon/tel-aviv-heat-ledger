# Tel Aviv Heat Ledger

An exploratory Sites dashboard for Tel Aviv Coast historical weather data. The
site turns daily maximum and minimum temperatures into annual trends, summer
rankings, heat-day counts, tropical-night counts, monthly anomaly maps, and
daily year scans.

## Data

The processed dashboard data lives at `app/data/weather.json`. It is generated
from the IMS-style CSV supplied locally:

```bash
npm run data:build
```

By default the script reads:

```text
/Users/eylon/Downloads/data_202606241120.csv
```

You can pass a different input and output path:

```bash
node scripts/build-weather-data.mjs /path/to/weather.csv app/data/weather.json
```

Trend calculations intentionally exclude partial years 2005 and 2026. The
baseline for anomalies is 2006-2015.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

This project uses the Sites vinext starter and builds a Cloudflare
Worker-compatible deployment artifact.
