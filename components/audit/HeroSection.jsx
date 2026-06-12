import Image from "next/image";

export default function HeroSection({ theme, themeOptions, onThemeChange }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <section className="hero-card reveal">
      <div>
        <p className="eyebrow">InfraLens</p>
        <h1>Infrastructure Audit and Change Review</h1>
        <p className="lead">
          Audit, compare, and review CSV exports across infrastructure, users, equipment, and network data with
          topology context and clean change reporting.
        </p>
      </div>

      <div className="hero-side">
        <Image src={`${basePath}/gmi-logo-white.png`} alt="GMI" className="hero-logo" width={220} height={79} priority />
        <div className="hero-meta">
          <p>Theme</p>
          <select
            className="theme-select"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value)}
            aria-label="Select color theme"
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p>Runtime Mode</p>
          <strong>Client-side Analysis</strong>
          <p>Report Output</p>
          <strong>PDF</strong>
        </div>
      </div>
    </section>
  );
}
