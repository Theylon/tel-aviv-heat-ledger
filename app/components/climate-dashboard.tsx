"use client";

import { useMemo, useState } from "react";

type Annual = {
  year: number;
  avg: number;
  avgMax: number;
  avgMin: number;
  anomaly: number;
  hotDays30: number;
  heatDays33: number;
  tropicalNights25: number;
  summerAvg: number;
  summerAnomaly: number;
  summerHotDays30: number;
  summerHeatDays33: number;
  summerTropicalNights25: number;
  maxTemp: number;
  minTemp: number;
};

type Day = {
  date: string;
  month: number;
  doy: number;
  tmax: number;
  tmin: number;
  tavg: number;
};

type WeatherData = {
  meta: {
    station: string;
    sourceFile: string;
    dateRange: { start: string; end: string };
    yearsUsedForTrend: [number, number];
    baseline: string;
    note: string;
  };
  summary: {
    annualSlopePerDecade: number;
    summerSlopePerDecade: number;
    heatDays33SlopePerDecade: number;
    tropicalNights25SlopePerDecade: number;
    lastYearAnomaly: number;
    firstYear: number;
    lastYear: number;
    hottestSummer: {
      year: number;
      summerAvg: number;
      summerAnomaly: number;
      heatDays33: number;
      tropicalNights25: number;
    };
    coolestSummer: {
      year: number;
      summerAvg: number;
      summerAnomaly: number;
      heatDays33: number;
      tropicalNights25: number;
    };
    hottestYear: Annual;
    coolestYear: Annual;
  };
  annual: Annual[];
  monthAverages: { month: number; name: string; avg: number; max: number; min: number }[];
  monthlyHeatmap: { year: number; month: number; avg: number; anomaly: number }[];
  summerRankings: {
    year: number;
    summerAvg: number;
    summerAnomaly: number;
    heatDays33: number;
    tropicalNights25: number;
  }[];
  recordsByHeat: { date: string; year: number; tmax: number; tmin: number }[];
  recordsByNight: { date: string; year: number; tmax: number; tmin: number }[];
  yearSnapshots: { year: number; days: Day[] }[];
};

const chartWidth = 760;
const chartHeight = 260;
const pad = { top: 24, right: 24, bottom: 34, left: 46 };
const monthTicks = [
  { month: "Jan", day: 1 },
  { month: "Feb", day: 32 },
  { month: "Mar", day: 60 },
  { month: "Apr", day: 91 },
  { month: "May", day: 121 },
  { month: "Jun", day: 152 },
  { month: "Jul", day: 182 },
  { month: "Aug", day: 213 },
  { month: "Sep", day: 244 },
  { month: "Oct", day: 274 },
  { month: "Nov", day: 305 },
  { month: "Dec", day: 335 },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );

const scale = (value: number, domain: [number, number], range: [number, number]) => {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d0 === d1) return (r0 + r1) / 2;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
};

const niceDomain = (values: number[], padding = 0.4): [number, number] => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return [Math.floor(low - padding), Math.ceil(high + padding)];
};

const anomalyColor = (value: number) => {
  if (value >= 2) return "#f2552c";
  if (value >= 1.25) return "#ff7a3d";
  if (value >= 0.5) return "#f6b15f";
  if (value >= 0) return "#f4d49c";
  if (value >= -0.5) return "#8ab6c8";
  return "#4d86aa";
};

const tempColor = (value: number) => {
  if (value >= 34) return "#e83428";
  if (value >= 31) return "#f06b35";
  if (value >= 28) return "#f0a044";
  if (value >= 24) return "#d8c574";
  if (value >= 19) return "#75aeb0";
  return "#497996";
};

const averageByDayOfYear = (snapshots: WeatherData["yearSnapshots"]) => {
  const grouped = new Map<number, Day[]>();

  for (const year of snapshots) {
    for (const day of year.days) {
      if (!grouped.has(day.doy)) grouped.set(day.doy, []);
      grouped.get(day.doy)!.push(day);
    }
  }

  return [...grouped.entries()]
    .map(([doy, days]) => ({
      doy,
      tmax: days.reduce((sum, day) => sum + day.tmax, 0) / days.length,
      tmin: days.reduce((sum, day) => sum + day.tmin, 0) / days.length,
      tavg: days.reduce((sum, day) => sum + day.tavg, 0) / days.length,
    }))
    .sort((a, b) => a.doy - b.doy);
};

const makeLine = <T extends { doy: number }>(
  rows: T[],
  value: (row: T) => number,
  x: (doy: number) => number,
  y: (value: number) => number,
) => rows.map((row, index) => `${index === 0 ? "M" : "L"} ${x(row.doy)} ${y(value(row))}`).join(" ");

function HistoricalDailyChart({ data }: { data: WeatherData }) {
  const years = data.yearSnapshots.map((entry) => entry.year);
  const [selectedYear, setSelectedYear] = useState(years.at(-1)!);
  const [hoverDoy, setHoverDoy] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<"compare" | "allYears">("allYears");
  const normals = useMemo(() => averageByDayOfYear(data.yearSnapshots), [data.yearSnapshots]);
  const selected = data.yearSnapshots.find((entry) => entry.year === selectedYear)!;
  const selectedByDoy = new Map(selected.days.map((day) => [day.doy, day]));
  const hoverDay =
    hoverDoy === null
      ? null
      : selectedByDoy.get(hoverDoy) ??
        selected.days.reduce((closest, day) =>
          Math.abs(day.doy - hoverDoy) < Math.abs(closest.doy - hoverDoy) ? day : closest,
        );

  const width = 980;
  const height = 430;
  const p = { top: 28, right: 28, bottom: 54, left: 54 };
  const allValues = [
    ...normals.flatMap((day) => [day.tmax, day.tmin, day.tavg]),
    ...(chartMode === "allYears"
      ? data.yearSnapshots.flatMap((year) => year.days.map((day) => day.tavg))
      : selected.days.flatMap((day) => [day.tmax, day.tmin, day.tavg])),
  ];
  const yDomain = niceDomain(allValues, 2);
  const x = (doy: number) => scale(doy, [1, 366], [p.left, width - p.right]);
  const y = (value: number) => scale(value, yDomain, [height - p.bottom, p.top]);
  const hoverX = hoverDay ? x(hoverDay.doy) : null;

  return (
    <section className="atlas-section historical-panel" id="historical">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Daily values vs normal</p>
          <h2>
            {chartMode === "allYears"
              ? "All years, daily mean temperature."
              : "Compare any year against Tel Aviv's historical daily pattern."}
          </h2>
        </div>
        <div className="chart-controls">
          <div className="segmented-control" aria-label="Historical chart mode">
            <button
              type="button"
              className={chartMode === "compare" ? "active" : ""}
              onClick={() => setChartMode("compare")}
            >
              Year vs normal
            </button>
            <button
              type="button"
              className={chartMode === "allYears" ? "active" : ""}
              onClick={() => setChartMode("allYears")}
            >
              All years
            </button>
          </div>
          <label htmlFor="history-year">Year</label>
          <select
            id="history-year"
            className="year-select"
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(Number(event.target.value));
              setHoverDoy(null);
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="historical-chart-wrap">
        <svg
          className="historical-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const localX = ((event.clientX - rect.left) / rect.width) * width;
            const doy = Math.round(scale(localX, [p.left, width - p.right], [1, 366]));
            setHoverDoy(Math.min(366, Math.max(1, doy)));
          }}
          onPointerLeave={() => setHoverDoy(null)}
        >
          <title>
            {chartMode === "allYears"
              ? "Daily mean temperatures for every complete year"
              : "Daily high, low, and mean temperatures compared with historical normals"}
          </title>
          {[10, 15, 20, 25, 30, 35, 40].map((tick) => (
            <g key={tick}>
              <line x1={p.left} x2={width - p.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
              <text x={16} y={y(tick) + 4} className="axis-label">
                {tick} C
              </text>
            </g>
          ))}
          {monthTicks.map((tick) => (
            <g key={tick.month}>
              <line x1={x(tick.day)} x2={x(tick.day)} y1={p.top} y2={height - p.bottom} className="month-line" />
              <text x={x(tick.day) + 3} y={height - 18} className="axis-label">
                {tick.month}
              </text>
            </g>
          ))}

          {chartMode === "allYears" ? (
            <>
              {data.yearSnapshots.map((year) => (
                <path
                  key={year.year}
                  d={makeLine(year.days, (day) => day.tavg, x, y)}
                  className={year.year === selectedYear ? "year-mean-line selected" : "year-mean-line"}
                >
                  <title>{`${year.year}: daily mean temperature`}</title>
                </path>
              ))}
              <path d={makeLine(normals, (day) => day.tavg, x, y)} className="normal-line normal-mean all-years-normal" />
            </>
          ) : (
            <>
              <path d={makeLine(normals, (day) => day.tmax, x, y)} className="normal-line normal-max" />
              <path d={makeLine(normals, (day) => day.tmin, x, y)} className="normal-line normal-min" />
              <path d={makeLine(normals, (day) => day.tavg, x, y)} className="normal-line normal-mean" />
              <path d={makeLine(selected.days, (day) => day.tmax, x, y)} className="actual-line actual-high" />
              <path d={makeLine(selected.days, (day) => day.tmin, x, y)} className="actual-line actual-low" />
              <path d={makeLine(selected.days, (day) => day.tavg, x, y)} className="actual-line actual-mean" />
            </>
          )}

          {hoverDay && hoverX !== null ? (
            <g className="hover-layer">
              <line x1={hoverX} x2={hoverX} y1={p.top} y2={height - p.bottom} className="hover-rule" />
              {chartMode === "allYears" ? (
                <circle cx={hoverX} cy={y(hoverDay.tavg)} r="4" className="actual-mean-point" />
              ) : (
                <>
                  <circle cx={hoverX} cy={y(hoverDay.tmax)} r="4" className="actual-high-point" />
                  <circle cx={hoverX} cy={y(hoverDay.tavg)} r="4" className="actual-mean-point" />
                  <circle cx={hoverX} cy={y(hoverDay.tmin)} r="4" className="actual-low-point" />
                </>
              )}
            </g>
          ) : null}
        </svg>
      </div>

      <div className="historical-readout">
        <div className="legend compact">
          {chartMode === "allYears" ? (
            <>
              <span><i className="legend-swatch all-years-swatch" /> Daily mean, every year</span>
              <span><i className="legend-swatch actual-mean-swatch" /> Highlighted year {selectedYear}</span>
              <span><i className="legend-swatch normal-mean-swatch" /> Historical daily mean</span>
            </>
          ) : (
            <>
              <span><i className="legend-swatch actual-high-swatch" /> Daily high {selectedYear}</span>
              <span><i className="legend-swatch actual-low-swatch" /> Daily low {selectedYear}</span>
              <span><i className="legend-swatch actual-mean-swatch" /> Daily mean {selectedYear}</span>
              <span><i className="legend-swatch normal-mean-swatch" /> Historical normal</span>
            </>
          )}
        </div>
        <div className="tooltip-card" aria-live="polite">
          {hoverDay ? (
            <>
              <strong>{formatDate(hoverDay.date)}</strong>
              {chartMode === "compare" ? <span>High {hoverDay.tmax.toFixed(1)} C</span> : null}
              <span>Mean {hoverDay.tavg.toFixed(1)} C</span>
              {chartMode === "compare" ? <span>Low {hoverDay.tmin.toFixed(1)} C</span> : null}
            </>
          ) : (
            <>
              <strong>Hover the chart</strong>
              <span>
                {chartMode === "allYears"
                  ? "Inspect the highlighted year's daily mean across the calendar."
                  : "Inspect daily highs, lows, and mean temperature."}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TrendChart({ annual }: { annual: Annual[] }) {
  const years = annual.map((row) => row.year);
  const values = annual.flatMap((row) => [row.avg, row.summerAvg]);
  const xDomain: [number, number] = [Math.min(...years), Math.max(...years)];
  const yDomain = niceDomain(values, 0.25);
  const x = (year: number) => scale(year, xDomain, [pad.left, chartWidth - pad.right]);
  const y = (value: number) => scale(value, yDomain, [chartHeight - pad.bottom, pad.top]);
  const line = (key: "avg" | "summerAvg") =>
    annual.map((row, index) => `${index === 0 ? "M" : "L"} ${x(row.year)} ${y(row[key])}`).join(" ");

  const last = annual.at(-1)!;

  return (
    <section className="atlas-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Core temperature trend</p>
          <h2>Annual warmth is rising, and summers are rising faster.</h2>
        </div>
        <p className="caption">Complete years only: 2006-2025</p>
      </div>
      <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
        <title>Average and summer average temperature by year</title>
        {[0, 1, 2, 3].map((tick) => {
          const value = yDomain[0] + ((yDomain[1] - yDomain[0]) / 3) * tick;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={chartWidth - pad.right}
                y1={y(value)}
                y2={y(value)}
                className="grid-line"
              />
              <text x={10} y={y(value) + 4} className="axis-label">
                {value.toFixed(0)} C
              </text>
            </g>
          );
        })}
        {years.filter((year) => year % 5 === 0).map((year) => (
          <text key={year} x={x(year)} y={chartHeight - 8} textAnchor="middle" className="axis-label">
            {year}
          </text>
        ))}
        <path d={line("summerAvg")} className="line summer" />
        <path d={line("avg")} className="line annual" />
        {annual.map((row) => (
          <g key={row.year}>
            <circle cx={x(row.year)} cy={y(row.avg)} r="4" className="dot annual-dot">
              <title>{`${row.year}: annual ${row.avg} C, summer ${row.summerAvg} C`}</title>
            </circle>
            <circle cx={x(row.year)} cy={y(row.summerAvg)} r="4" className="dot summer-dot" />
          </g>
        ))}
        <text x={x(last.year) - 8} y={y(last.avg) - 14} textAnchor="end" className="chart-note">
          {last.year}: +{last.anomaly.toFixed(2)} C vs baseline
        </text>
      </svg>
      <div className="legend">
        <span><i className="legend-swatch annual-swatch" /> Annual mean</span>
        <span><i className="legend-swatch summer-swatch" /> Jun-Sep mean</span>
      </div>
    </section>
  );
}

function HeatDaysChart({ annual }: { annual: Annual[] }) {
  const maxValue = Math.max(...annual.flatMap((row) => [row.hotDays30, row.tropicalNights25]));
  const x = (index: number) =>
    scale(index, [0, annual.length - 1], [pad.left, chartWidth - pad.right]);
  const y = (value: number) => scale(value, [0, maxValue], [chartHeight - pad.bottom, pad.top]);
  const barWidth = Math.max(8, (chartWidth - pad.left - pad.right) / annual.length - 6);

  return (
    <section className="atlas-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">What feels unbearable</p>
          <h2>Hot days matter, but warm nights are the clearest escalation.</h2>
        </div>
      </div>
      <svg className="chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
        <title>Hot days and tropical nights by year</title>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={chartWidth - pad.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={12} y={y(tick) + 4} className="axis-label">
              {tick}
            </text>
          </g>
        ))}
        {annual.map((row, index) => (
          <g key={row.year}>
            <rect
              x={x(index) - barWidth / 2}
              y={y(row.hotDays30)}
              width={barWidth}
              height={chartHeight - pad.bottom - y(row.hotDays30)}
              rx="2"
              className="bar hot"
            >
              <title>{`${row.year}: ${row.hotDays30} days at 30 C or hotter`}</title>
            </rect>
            <circle cx={x(index)} cy={y(row.tropicalNights25)} r="5" className="night-dot">
              <title>{`${row.year}: ${row.tropicalNights25} nights at 25 C or warmer`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="legend">
        <span><i className="legend-swatch hot-swatch" /> Days with max {">="} 30 C</span>
        <span><i className="legend-swatch night-swatch" /> Nights with min {">="} 25 C</span>
      </div>
    </section>
  );
}

function MonthlyHeatmap({ data }: { data: WeatherData }) {
  const years = data.annual.map((row) => row.year);
  const months = data.monthAverages.map((row) => row.name);
  const cell = 26;
  const gap = 5;
  const left = 54;
  const top = 30;
  const width = left + months.length * (cell + gap) + 10;
  const height = top + years.length * (cell + gap) + 14;

  return (
    <section className="atlas-section">
      <div className="section-heading stacked">
        <p className="eyebrow">Monthly anomaly map</p>
        <h2>Recent years are warmer in more months, not just in peak summer.</h2>
      </div>
      <svg className="heatmap" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Monthly temperature anomaly by year</title>
        {months.map((month, index) => (
          <text key={month} x={left + index * (cell + gap) + cell / 2} y="17" textAnchor="middle" className="axis-label">
            {month}
          </text>
        ))}
        {years.map((year, yIndex) => (
          <text key={year} x="42" y={top + yIndex * (cell + gap) + 17} textAnchor="end" className="axis-label">
            {year}
          </text>
        ))}
        {data.monthlyHeatmap.map((row) => {
          const yIndex = years.indexOf(row.year);
          return (
            <rect
              key={`${row.year}-${row.month}`}
              x={left + (row.month - 1) * (cell + gap)}
              y={top + yIndex * (cell + gap)}
              width={cell}
              height={cell}
              rx="4"
              fill={anomalyColor(row.anomaly)}
            >
              <title>{`${row.year} ${months[row.month - 1]}: ${row.anomaly > 0 ? "+" : ""}${row.anomaly} C`}</title>
            </rect>
          );
        })}
      </svg>
    </section>
  );
}

function SeasonalProfile({ data }: { data: WeatherData }) {
  const width = 560;
  const height = 260;
  const x = (month: number) => scale(month, [1, 12], [44, width - 18]);
  const domain = niceDomain(data.monthAverages.flatMap((row) => [row.min, row.avg, row.max]), 0.4);
  const y = (value: number) => scale(value, domain, [height - 34, 18]);
  const line = (key: "min" | "avg" | "max") =>
    data.monthAverages.map((row, index) => `${index === 0 ? "M" : "L"} ${x(row.month)} ${y(row[key])}`).join(" ");

  return (
    <section className="atlas-section">
      <div className="section-heading stacked">
        <p className="eyebrow">Seasonal shape</p>
        <h2>The coast shifts from mild winters into long, humid heat.</h2>
      </div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Average monthly minimum, mean, and maximum temperatures</title>
        {[10, 20, 30].map((tick) => (
          <g key={tick}>
            <line x1="44" x2={width - 18} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x="10" y={y(tick) + 4} className="axis-label">{tick} C</text>
          </g>
        ))}
        <path d={line("max")} className="line max-line" />
        <path d={line("avg")} className="line annual" />
        <path d={line("min")} className="line min-line" />
        {data.monthAverages.map((row) => (
          <text key={row.name} x={x(row.month)} y={height - 8} textAnchor="middle" className="axis-label">
            {row.name}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span><i className="legend-swatch max-swatch" /> Avg daily max</span>
        <span><i className="legend-swatch annual-swatch" /> Mean</span>
        <span><i className="legend-swatch min-swatch" /> Avg daily min</span>
      </div>
    </section>
  );
}

function YearCalendar({ data }: { data: WeatherData }) {
  const years = data.yearSnapshots.map((entry) => entry.year);
  const [selectedYear, setSelectedYear] = useState(years.at(-1)!);
  const selected = data.yearSnapshots.find((entry) => entry.year === selectedYear)!;
  const months = data.monthAverages.map((row) => row.name);

  return (
    <section className="atlas-section wide">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Daily texture</p>
          <h2>Scan a year day by day.</h2>
        </div>
        <select
          className="year-select"
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          aria-label="Select year for daily heat calendar"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div className="day-strip" role="img" aria-label={`Daily maximum temperatures in ${selectedYear}`}>
        {selected.days.map((day) => (
          <span
            key={day.date}
            className="day-cell"
            style={{ background: tempColor(day.tmax) }}
            title={`${formatDate(day.date)}: max ${day.tmax} C, min ${day.tmin} C`}
          />
        ))}
      </div>
      <div className="month-ruler">
        {months.map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
    </section>
  );
}

function RankingTable({ data }: { data: WeatherData }) {
  return (
    <section className="atlas-section">
      <div className="section-heading stacked">
        <p className="eyebrow">Summer leaderboard</p>
        <h2>Hottest Jun-Sep seasons in the record.</h2>
      </div>
      <div className="ranking">
        {data.summerRankings.slice(0, 8).map((row, index) => (
          <div className="rank-row" key={row.year}>
            <span className="rank-index">{index + 1}</span>
            <span className="rank-year">{row.year}</span>
            <span className="rank-bar" style={{ width: `${scale(row.summerAvg, [26, 29], [22, 100])}%` }} />
            <span className="rank-value">{row.summerAvg.toFixed(2)} C</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Records({ data }: { data: WeatherData }) {
  const topHeat = data.recordsByHeat.slice(0, 5);
  const topNights = data.recordsByNight.slice(0, 5);

  return (
    <section className="records-grid">
      <div className="panel">
        <div className="section-heading stacked">
          <p className="eyebrow">Daily extremes</p>
          <h2>Hottest afternoons</h2>
        </div>
        <ol className="record-list">
          {topHeat.map((row) => (
            <li key={row.date}>
              <span>{formatDate(row.date)}</span>
              <strong>{row.tmax.toFixed(1)} C</strong>
            </li>
          ))}
        </ol>
      </div>
      <div className="panel">
        <div className="section-heading stacked">
          <p className="eyebrow">Night heat</p>
          <h2>Warmest minimums</h2>
        </div>
        <ol className="record-list">
          {topNights.map((row) => (
            <li key={row.date}>
              <span>{formatDate(row.date)}</span>
              <strong>{row.tmin.toFixed(1)} C</strong>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClimateDashboard({ data }: { data: WeatherData }) {
  const annual = data.annual;
  const lastYear = annual.at(-1)!;
  const firstYear = annual[0];
  const verdict = useMemo(() => {
    const sign = data.summary.annualSlopePerDecade > 0 ? "warmer" : "cooler";
    return `Tel Aviv is getting ${sign}: +${data.summary.annualSlopePerDecade.toFixed(2)} C per decade annually, +${data.summary.summerSlopePerDecade.toFixed(2)} C per decade in summer.`;
  }, [data.summary.annualSlopePerDecade, data.summary.summerSlopePerDecade]);

  return (
    <main className="climate-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Tel Aviv Coast weather, 2005-2026</p>
          <h1>Tel Aviv Heat Ledger</h1>
        </div>
        <nav className="top-nav" aria-label="Dashboard sections">
          <a href="#historical">Daily chart</a>
          <a href="#trends">Trends</a>
          <a href="#daily">Daily scan</a>
        </nav>
      </header>

      <section className="overview">
        <div className="overview-copy">
          <p className="status-label">Current read</p>
          <h2>Complete years show a warmer Tel Aviv, with summer heating faster than the annual average.</h2>
          <p>{verdict}</p>
        </div>
        <div className="headline-stats" aria-label="Headline climate statistics">
          <div>
            <span>Latest complete year</span>
            <strong>{lastYear.year}</strong>
            <em>+{lastYear.anomaly.toFixed(2)} C vs {data.meta.baseline}</em>
          </div>
          <div>
            <span>Hottest summer</span>
            <strong>{data.summary.hottestSummer.year}</strong>
            <em>{data.summary.hottestSummer.summerAvg.toFixed(2)} C mean</em>
          </div>
          <div>
            <span>Tropical nights trend</span>
            <strong>+{data.summary.tropicalNights25SlopePerDecade.toFixed(1)}</strong>
            <em>nights per decade</em>
          </div>
        </div>
      </section>

      <section className="answer-band">
        <article>
          <span className="metric">{data.summary.annualSlopePerDecade.toFixed(2)} C</span>
          <p>annual warming per decade from {firstYear.year} to {lastYear.year}</p>
        </article>
        <article>
          <span className="metric">{data.summary.summerSlopePerDecade.toFixed(2)} C</span>
          <p>summer warming per decade across Jun-Sep</p>
        </article>
        <article>
          <span className="metric">{lastYear.hotDays30}</span>
          <p>days at or above 30 C in {lastYear.year}</p>
        </article>
        <article>
          <span className="metric">{lastYear.tropicalNights25}</span>
          <p>nights at or above 25 C in {lastYear.year}</p>
        </article>
      </section>

      <HistoricalDailyChart data={data} />

      <section id="trends" className="dashboard-grid">
        <TrendChart annual={annual} />
        <HeatDaysChart annual={annual} />
        <MonthlyHeatmap data={data} />
        <SeasonalProfile data={data} />
        <RankingTable data={data} />
      </section>

      <section id="daily" className="dashboard-grid lower">
        <YearCalendar data={data} />
        <Records data={data} />
      </section>

      <footer className="method">
        <p>
          Source: {data.meta.station}, daily maximum and minimum temperatures from {formatDate(data.meta.dateRange.start)} to{" "}
          {formatDate(data.meta.dateRange.end)}. Trend calculations use complete years {data.meta.yearsUsedForTrend[0]}-
          {data.meta.yearsUsedForTrend[1]} and compare anomalies against the {data.meta.baseline} baseline.
        </p>
      </footer>
    </main>
  );
}
