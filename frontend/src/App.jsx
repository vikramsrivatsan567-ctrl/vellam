import { useEffect, useState } from "react";
import ReportView from "./views/ReportView.jsx";
import MapView from "./views/MapView.jsx";
import DashboardView from "./views/DashboardView.jsx";
import OutlookView from "./views/OutlookView.jsx";
import OfficerSignIn from "./views/OfficerSignIn.jsx";
import { useSession } from "./auth.js";

const VIEWS = [
  { id: "report", label: "Report flooding", short: "Report" },
  { id: "map", label: "Live map", short: "Map" },
  { id: "outlook", label: "Flood outlook", short: "Outlook" },
  { id: "dashboard", label: "Officer dashboard", signedOut: "Officer sign-in", short: "Officer" },
];

function currentView() {
  const hash = window.location.hash.replace("#", "");
  return VIEWS.some((v) => v.id === hash) ? hash : "report";
}

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3z" fill="#6CC4D8" />
      <path d="M8.5 22.5c2.5-2 5-2 7.5 0s5 2 7.5 0" fill="none" stroke="#13243B" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState(currentView);
  const session = useSession();

  useEffect(() => {
    const onHash = () => setView(currentView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className={`app app--${view}`}>
      <header className="topbar">
        <a className="brand" href="#report">
          <BrandMark />
          <span className="brand__name">Vellam</span>
          <span className="brand__tag">Live street flooding in Chennai</span>
        </a>
        <nav className="nav" aria-label="Sections">
          {VIEWS.map((v) => (
            <a key={v.id} href={`#${v.id}`} className="nav__link" aria-current={view === v.id ? "page" : undefined}>
              <span className="nav__full">{!session && v.signedOut ? v.signedOut : v.label}</span>
              <span className="nav__short">{v.short}</span>
            </a>
          ))}
        </nav>
      </header>
      <main className="main">
        {view === "report" && <ReportView />}
        {view === "map" && <MapView />}
        {view === "outlook" && <OutlookView />}
        {view === "dashboard" && (session ? <DashboardView /> : <OfficerSignIn />)}
      </main>
    </div>
  );
}
