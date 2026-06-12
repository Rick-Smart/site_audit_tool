"use client";

import { useEffect, useState } from "react";
import HeroSection from "../components/audit/HeroSection";
import StatsSection from "../components/audit/StatsSection";
import UploadSection from "../components/audit/UploadSection";
import ReportSections from "../components/audit/ReportSections";
import { useAuditState } from "../hooks/useAuditState";
import { generatePdf } from "../lib/pdfReport";

const THEME_OPTIONS = [
  { value: "gmi", label: "GMI Brand" },
  { value: "default", label: "Default Dark" },
  { value: "classic-blue", label: "Classic Blue" },
];

export default function HomePage() {
  const audit = useAuditState();
  const [theme, setTheme] = useState("gmi");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("audit-theme");
    if (savedTheme && THEME_OPTIONS.some((item) => item.value === savedTheme)) {
      setTheme(savedTheme);
      return;
    }
    setTheme("gmi");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("audit-theme", theme);
  }, [theme]);

  return (
    <main className="page-shell">
      <HeroSection
        theme={theme}
        themeOptions={THEME_OPTIONS}
        onThemeChange={setTheme}
      />
      <StatsSection stats={audit.stats} />

      <UploadSection
        stats={audit.stats}
        onCsvChange={audit.onCsvChange}
        onPngChange={audit.onPngChange}
        onClearData={audit.clearAllData}
      />

      {audit.isProcessing && <p className="status">Analyzing CSV files...</p>}

      <button
        type="button"
        className={`fab-download${audit.summaries.length > 0 ? " fab-download--active" : ""}`
        }
        disabled={audit.summaries.length === 0}
        onClick={() => {
          void generatePdf(
            audit.summaries,
            audit.findings,
            audit.topologies,
            audit.filteredInventory,
            audit.selectedExportFieldsByType,
            audit.exportFieldOptionsByType,
            audit.dataByType,
            theme
          );
        }}
      >
        <span className="fab-download__icon" aria-hidden="true">⬇</span>
        <span className="fab-download__label">Download PDF</span>
      </button>

      <ReportSections
        errors={audit.errors}
        findings={audit.findings}
        summaries={audit.summaries}
        machineInventory={audit.machineInventory}
        filteredInventory={audit.filteredInventory}
        fileOptions={audit.fileOptions}
        fileFilter={audit.fileFilter}
        onFileFilterChange={audit.setFileFilter}
        hasSiteData={audit.hasSiteData}
        siteOptions={audit.siteOptions}
        siteFilter={audit.siteFilter}
        onSiteFilterChange={audit.setSiteFilter}
        statusFilter={audit.statusFilter}
        onStatusFilterChange={audit.setStatusFilter}
        searchQuery={audit.searchQuery}
        onSearchChange={audit.setSearchQuery}
        activeMachineId={audit.activeMachineId}
        onActiveMachineChange={audit.setActiveMachineId}
        activeMachine={audit.activeMachine}
        selectedExportFieldsByType={audit.selectedExportFieldsByType}
        exportFieldOptionsByType={audit.exportFieldOptionsByType}
        onToggleField={audit.toggleExportField}
        dataByType={audit.dataByType}
        topologies={audit.topologies}
      />
    </main>
  );
}
