"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildFindings, summarizeCsv } from "../lib/audit";

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors[0].message));
          return;
        }
        resolve(result.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

async function generatePdf(summaries, findings, images) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Site Audit Readout", 40, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 72);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Executive Findings", 40, 102);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let cursorY = 122;
  for (const finding of findings) {
    const wrapped = doc.splitTextToSize(`- ${finding}`, 520);
    doc.text(wrapped, 44, cursorY);
    cursorY += wrapped.length * 14 + 4;
  }

  autoTable(doc, {
    startY: cursorY + 10,
    head: [["CSV", "Rows", "Columns", "Null %", "Status Column", "Unhealthy"]],
    body: summaries.map((summary) => [
      summary.filename,
      summary.rows.toLocaleString(),
      String(summary.columns),
      `${summary.nullRatioPct.toFixed(2)}%`,
      summary.statusColumn ?? "n/a",
      summary.unhealthyCount !== null ? String(summary.unhealthyCount) : "n/a",
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  for (const image of images) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Topology: ${image.name}`, 40, 44);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Uploaded topology visual", 40, 60);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - 80;
    const maxHeight = pageHeight - 120;

    doc.addImage(image.dataUrl, "PNG", 40, 80, maxWidth, maxHeight, undefined, "FAST");
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  doc.save(`site_audit_readout_${stamp}.pdf`);
}

export default function HomePage() {
  const [summaries, setSummaries] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topologies, setTopologies] = useState([]);

  const findings = useMemo(() => {
    if (summaries.length === 0) {
      return [];
    }
    return buildFindings(summaries);
  }, [summaries]);

  const onCsvChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    setErrors([]);

    if (files.length === 0) {
      setSummaries([]);
      return;
    }

    setIsProcessing(true);

    const nextSummaries = [];
    const nextErrors = [];

    for (const file of files) {
      try {
        const text = await readTextFile(file);
        const rows = await parseCsvText(text);
        nextSummaries.push(summarizeCsv(file.name, rows));
      } catch (error) {
        nextErrors.push({
          file: file.name,
          message: error instanceof Error ? error.message : "Unknown parse failure",
        });
      }
    }

    setSummaries(nextSummaries);
    setErrors(nextErrors);
    setIsProcessing(false);
  };

  const onPngChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    const next = [];

    for (const file of files) {
      const dataUrl = await readDataUrl(file);
      next.push({ name: file.name, dataUrl });
    }

    setTopologies(next);
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Network Engineering Toolkit</p>
        <h1>Site Audit Readout Generator</h1>
        <p className="lead">
          Upload Meraki and other managed network CSV exports, add topology PNGs, and export a polished PDF
          report for stakeholders.
        </p>
      </section>

      <section className="upload-grid">
        <label className="upload-card" htmlFor="csv-input">
          <span className="upload-title">CSV Exports</span>
          <span className="upload-subtitle">Upload one or more dashboard exports</span>
          <input id="csv-input" type="file" multiple accept=".csv,text/csv" onChange={onCsvChange} />
        </label>

        <label className="upload-card" htmlFor="png-input">
          <span className="upload-title">Topology PNGs</span>
          <span className="upload-subtitle">Optional visuals appended to the report</span>
          <input id="png-input" type="file" multiple accept=".png,image/png" onChange={onPngChange} />
        </label>
      </section>

      {isProcessing && <p className="status">Analyzing CSV files...</p>}

      {errors.length > 0 && (
        <section className="panel panel-warning">
          <h2>Parse Warnings</h2>
          <ul>
            {errors.map((error) => (
              <li key={`${error.file}-${error.message}`}>
                {error.file}: {error.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {findings.length > 0 && (
        <section className="panel">
          <h2>Executive Findings</h2>
          <ul>
            {findings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </section>
      )}

      {summaries.length > 0 && (
        <section className="panel">
          <h2>CSV Summary</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CSV</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>Null %</th>
                  <th>Status Column</th>
                  <th>Unhealthy</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => (
                  <tr key={summary.filename}>
                    <td>{summary.filename}</td>
                    <td>{summary.rows.toLocaleString()}</td>
                    <td>{summary.columns}</td>
                    <td>{summary.nullRatioPct.toFixed(2)}%</td>
                    <td>{summary.statusColumn ?? "n/a"}</td>
                    <td>{summary.unhealthyCount ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {topologies.length > 0 && (
        <section className="panel">
          <h2>Topology Preview</h2>
          <div className="topology-grid">
            {topologies.map((image) => (
              <figure key={image.name} className="topology-card">
                <Image
                  src={image.dataUrl}
                  alt={image.name}
                  width={1000}
                  height={700}
                  unoptimized
                  style={{ width: "100%", height: "210px", objectFit: "contain", background: "#f8fafc" }}
                />
                <figcaption>{image.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="actions">
        <button
          type="button"
          disabled={summaries.length === 0}
          onClick={() => {
            void generatePdf(summaries, findings, topologies);
          }}
        >
          Download PDF Readout
        </button>
      </section>
    </main>
  );
}
