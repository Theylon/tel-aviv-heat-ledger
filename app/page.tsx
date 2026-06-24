import weather from "./data/weather.json";
import { ClimateDashboard } from "./components/climate-dashboard";

export default function Home() {
  return <ClimateDashboard data={weather} />;
}
