import Image from "next/image";

export default function HeroSection() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <section className="hero-card reveal">
      <div>
        <p className="eyebrow">Network Engineering Toolkit</p>
        <h1>Site Audit Readout Generator</h1>
        <p className="lead">
          Analyze dashboard exports, validate data quality, overlay topology context, and generate a clean audit
          package for review.
        </p>
      </div>

      <div className="hero-side">
        <Image src={`${basePath}/gmi-logo-white.png`} alt="GMI" className="hero-logo" width={220} height={79} priority />
        <div className="hero-meta">
          <p>Runtime Mode</p>
          <strong>Client-side Analysis</strong>
          <p>Report Output</p>
          <strong>PDF</strong>
        </div>
      </div>
    </section>
  );
}
