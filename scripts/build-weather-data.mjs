import { readFile, writeFile } from "node:fs/promises";

const inputPath = process.argv[2] ?? "/Users/eylon/Downloads/data_202606241120.csv";
const outputPath = process.argv[3] ?? "app/data/weather.json";

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((entry) => entry.some(Boolean));
};

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const max = (values) => Math.max(...values);
const min = (values) => Math.min(...values);

const linearRegression = (points) => {
  const n = points.length;
  const sx = points.reduce((sum, point) => sum + point.x, 0);
  const sy = points.reduce((sum, point) => sum + point.y, 0);
  const sxx = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const sxy = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const denominator = n * sxx - sx * sx;
  const slope = denominator === 0 ? 0 : (n * sxy - sx * sy) / denominator;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const parseDate = (value) => {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const ymd = (date) => date.toISOString().slice(0, 10);
const dayOfYear = (date) =>
  Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);

const csv = await readFile(inputPath, "utf8");
const [headers, ...records] = parseCsv(csv);
const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

const daily = records
  .map((record) => {
    const date = parseDate(record[headerIndex.Date]);
    const tmax = Number.parseFloat(record[headerIndex["Maximum Temperature (°C)"]]);
    const tmin = Number.parseFloat(record[headerIndex["Minimum Temperature (°C)"]]);
    if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) return null;
    return {
      date: ymd(date),
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      doy: dayOfYear(date),
      tmax: round(tmax, 1),
      tmin: round(tmin, 1),
      tavg: round((tmax + tmin) / 2, 1),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date));

const byYear = new Map();
const byYearMonth = new Map();

for (const day of daily) {
  if (!byYear.has(day.year)) byYear.set(day.year, []);
  byYear.get(day.year).push(day);

  const key = `${day.year}-${String(day.month).padStart(2, "0")}`;
  if (!byYearMonth.has(key)) byYearMonth.set(key, []);
  byYearMonth.get(key).push(day);
}

const completeYears = [...byYear.entries()]
  .filter(([, days]) => days.length >= 350)
  .map(([year]) => year)
  .filter((year) => year !== 2005 && year !== 2026)
  .sort((a, b) => a - b);

const baselineYears = completeYears.filter((year) => year >= 2006 && year <= 2015);
const baselineDays = baselineYears.flatMap((year) => byYear.get(year));
const baselineAvg = mean(baselineDays.map((day) => day.tavg));
const baselineSummer = mean(
  baselineDays.filter((day) => day.month >= 6 && day.month <= 9).map((day) => day.tavg),
);

const annual = completeYears.map((year) => {
  const days = byYear.get(year);
  const summerDays = days.filter((day) => day.month >= 6 && day.month <= 9);
  const avg = mean(days.map((day) => day.tavg));
  const avgMax = mean(days.map((day) => day.tmax));
  const avgMin = mean(days.map((day) => day.tmin));
  const summerAvg = mean(summerDays.map((day) => day.tavg));
  return {
    year,
    days: days.length,
    avg: round(avg),
    avgMax: round(avgMax),
    avgMin: round(avgMin),
    anomaly: round(avg - baselineAvg),
    hotDays30: days.filter((day) => day.tmax >= 30).length,
    heatDays33: days.filter((day) => day.tmax >= 33).length,
    tropicalNights25: days.filter((day) => day.tmin >= 25).length,
    summerAvg: round(summerAvg),
    summerAnomaly: round(summerAvg - baselineSummer),
    summerHotDays30: summerDays.filter((day) => day.tmax >= 30).length,
    summerHeatDays33: summerDays.filter((day) => day.tmax >= 33).length,
    summerTropicalNights25: summerDays.filter((day) => day.tmin >= 25).length,
    maxTemp: round(max(days.map((day) => day.tmax)), 1),
    minTemp: round(min(days.map((day) => day.tmin)), 1),
  };
});

const annualTrend = linearRegression(annual.map((row) => ({ x: row.year, y: row.avg })));
const summerTrend = linearRegression(annual.map((row) => ({ x: row.year, y: row.summerAvg })));
const hotDaysTrend = linearRegression(annual.map((row) => ({ x: row.year, y: row.heatDays33 })));
const tropicalNightsTrend = linearRegression(
  annual.map((row) => ({ x: row.year, y: row.tropicalNights25 })),
);

const monthAverages = monthNames.map((name, index) => {
  const month = index + 1;
  const days = daily.filter((day) => completeYears.includes(day.year) && day.month === month);
  return {
    month,
    name,
    avg: round(mean(days.map((day) => day.tavg))),
    max: round(mean(days.map((day) => day.tmax))),
    min: round(mean(days.map((day) => day.tmin))),
  };
});

const monthlyHeatmap = [...byYearMonth.entries()]
  .map(([key, days]) => {
    const [year, month] = key.split("-").map(Number);
    if (!completeYears.includes(year)) return null;
    const avg = mean(days.map((day) => day.tavg));
    const baselineMonth = daily.filter(
      (day) => baselineYears.includes(day.year) && day.month === month,
    );
    const monthBaseline = mean(baselineMonth.map((day) => day.tavg));
    return {
      year,
      month,
      avg: round(avg),
      anomaly: round(avg - monthBaseline),
    };
  })
  .filter(Boolean);

const summerRankings = annual
  .map((row) => ({
    year: row.year,
    summerAvg: row.summerAvg,
    summerAnomaly: row.summerAnomaly,
    heatDays33: row.summerHeatDays33,
    tropicalNights25: row.summerTropicalNights25,
  }))
  .sort((a, b) => b.summerAvg - a.summerAvg);

const recordsByHeat = [...daily]
  .sort((a, b) => b.tmax - a.tmax)
  .slice(0, 10)
  .map((day) => ({
    date: day.date,
    year: day.year,
    tmax: day.tmax,
    tmin: day.tmin,
  }));

const recordsByNight = [...daily]
  .sort((a, b) => b.tmin - a.tmin)
  .slice(0, 10)
  .map((day) => ({
    date: day.date,
    year: day.year,
    tmax: day.tmax,
    tmin: day.tmin,
  }));

const yearSnapshots = completeYears.map((year) => {
  const days = byYear.get(year);
  return {
    year,
    days: days.map((day) => ({
      date: day.date,
      month: day.month,
      doy: day.doy,
      tmax: day.tmax,
      tmin: day.tmin,
      tavg: day.tavg,
    })),
  };
});

const firstYear = annual[0];
const lastYear = annual.at(-1);
const hottestSummer = summerRankings[0];
const coolestSummer = summerRankings.at(-1);

const output = {
  meta: {
    station: "Tel Aviv Coast",
    sourceFile: inputPath.split("/").at(-1),
    generatedAt: new Date().toISOString(),
    dateRange: {
      start: daily[0].date,
      end: daily.at(-1).date,
    },
    yearsUsedForTrend: [firstYear.year, lastYear.year],
    baseline: "2006-2015",
    note: "Trend metrics exclude partial years 2005 and 2026.",
  },
  summary: {
    annualSlopePerDecade: round(annualTrend.slope * 10),
    summerSlopePerDecade: round(summerTrend.slope * 10),
    heatDays33SlopePerDecade: round(hotDaysTrend.slope * 10, 1),
    tropicalNights25SlopePerDecade: round(tropicalNightsTrend.slope * 10, 1),
    firstYearAvg: firstYear.avg,
    lastYearAvg: lastYear.avg,
    firstYear: firstYear.year,
    lastYear: lastYear.year,
    lastYearAnomaly: lastYear.anomaly,
    hottestSummer,
    coolestSummer,
    hottestYear: [...annual].sort((a, b) => b.avg - a.avg)[0],
    coolestYear: [...annual].sort((a, b) => a.avg - b.avg)[0],
  },
  annual,
  monthAverages,
  monthlyHeatmap,
  summerRankings,
  recordsByHeat,
  recordsByNight,
  yearSnapshots,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${outputPath} from ${daily.length} daily observations`);
