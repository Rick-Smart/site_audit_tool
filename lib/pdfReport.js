import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CSV_TYPES, getTypeLabel } from "./csvTypeDetection";

const PDF_THEMES = {
  gmi: {
    bg: [8, 12, 22],
    line: [66, 43, 50],
    head: [156, 35, 48],
    cell: [20, 13, 16],
    alt: [28, 18, 21],
    accent: [220, 75, 88],
  },
  default: {
    bg: [12, 16, 24],
    line: [58, 66, 78],
    head: [90, 108, 136],
    cell: [24, 30, 40],
    alt: [30, 36, 47],
    accent: [166, 181, 204],
  },
  "classic-blue": {
    bg: [7, 13, 28],
    line: [36, 66, 110],
    head: [43, 125, 233],
    cell: [11, 24, 46],
    alt: [16, 32, 58],
    accent: [88, 166, 255],
  },
};

function loadImageAsDataUrl(path) {
  return fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to fetch image: ${path}`);
      }
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(`Unable to read image: ${path}`));
          reader.readAsDataURL(blob);
        })
    );
}

export async function generatePdf(
  summaries,
  findings,
  images,
  machines,
  selectedExportFieldsByType,
  exportFieldOptionsByType,
  dataByType = {},
  themeName = "gmi"
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const now = new Date();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const palette = PDF_THEMES[themeName] || PDF_THEMES.gmi;
  let logoDataUrl = "";

  try {
    logoDataUrl = await loadImageAsDataUrl(`${basePath}/gmi-logo-white.png`);
  } catch {
    logoDataUrl = "";
  }

  const tocEntries = [];
  let tocPageNumber = 0;
  const deviceMachines = dataByType[CSV_TYPES.DEVICES] || machines || [];
  const nonDeviceTypes = [CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];

  const normalizedSelectedByType = Array.isArray(selectedExportFieldsByType)
    ? { [CSV_TYPES.DEVICES]: selectedExportFieldsByType }
    : selectedExportFieldsByType || {};

  const normalizedOptionsByType = Array.isArray(exportFieldOptionsByType)
    ? { [CSV_TYPES.DEVICES]: exportFieldOptionsByType }
    : exportFieldOptionsByType || {};

  const paintDarkBackground = () => {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setFillColor(...palette.bg);
    doc.rect(0, 0, width, height, "F");
  };

  const tableTheme = {
    styles: {
      fontSize: 8,
      cellPadding: 5,
      textColor: [228, 238, 255],
      fillColor: palette.cell,
      overflow: "ellipsize",
      lineColor: palette.line,
      lineWidth: 0.4,
      valign: "middle",
    },
    headStyles: {
      fillColor: palette.head,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: palette.alt,
    },
  };

  const darkPageHook = () => {
    paintDarkBackground();
  };

  // Returns equal left/right margins based on live page width so tables stay
  // centered regardless of orientation or paper size.
  // Portrait letter (612pt) → ~72pt each side
  // Landscape letter (792pt) → ~36pt each side
  const tableMargins = () => {
    const w = doc.internal.pageSize.getWidth();
    const side = w > 700 ? Math.round(w * 0.045) : Math.round(w * 0.118);
    return { left: side, right: side };
  };

  // Center narrow two-column tables on portrait pages.
  const centeredTwoColLayout = (totalWidth = 360) => {
    const pageW = doc.internal.pageSize.getWidth();
    const left = Math.max(40, Math.round((pageW - totalWidth) / 2));
    return {
      margin: { left, right: left },
      startX: left,
    };
  };

  const getValue = (machine, key) => {
    const value = key.startsWith("raw::") ? machine.raw?.[key.slice(5)] : machine[key];
    if (value === null || value === undefined || String(value).trim() === "") {
      return "n/a";
    }
    return String(value);
  };

  const formatLabel = (key) =>
    String(key)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getGenericValue = (record, key) => {
    const value = key.startsWith("raw::") ? record?.raw?.[key.slice(5)] : record?.[key] ?? record?.raw?.[key];
    if (value === null || value === undefined || String(value).trim() === "") {
      return "n/a";
    }
    return String(value);
  };

  const deviceExportFieldOptions = normalizedOptionsByType[CSV_TYPES.DEVICES] || [];
  const deviceSelectedExportFields = normalizedSelectedByType[CSV_TYPES.DEVICES] || [];

  const selectedMap = new Map(deviceExportFieldOptions.map((item) => [item.key, item.label]));
  const selectedEntries = [];
  const seenLabels = new Set();
  const effectiveFields = deviceSelectedExportFields.length > 0 ? deviceSelectedExportFields : ["displayName", "status", "ip"];

  for (const field of effectiveFields) {
    const label = selectedMap.get(field) || field;
    const dedupeKey = label.trim().toLowerCase();
    if (seenLabels.has(dedupeKey)) {
      continue;
    }
    seenLabels.add(dedupeKey);
    selectedEntries.push({ key: field, label });
  }

  const siteAggregate = new Map();
  for (const machine of deviceMachines) {
    const site = machine.site || "Unassigned";
    if (!siteAggregate.has(site)) {
      siteAggregate.set(site, {
        site,
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0,
        modelCounts: new Map(),
      });
    }

    const bucket = siteAggregate.get(site);
    bucket.total += 1;

    if (machine.statusTone === "healthy") {
      bucket.healthy += 1;
    } else if (machine.statusTone === "unhealthy") {
      bucket.unhealthy += 1;
    } else {
      bucket.unknown += 1;
    }

    if (machine.model) {
      const existing = bucket.modelCounts.get(machine.model) || 0;
      bucket.modelCounts.set(machine.model, existing + 1);
    }
  }

  const quickReadRows = Array.from(siteAggregate.values())
    .sort((a, b) => b.total - a.total)
    .map((row) => {
      const topModels = Array.from(row.modelCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([model, count]) => `${model} (${count})`)
        .join(", ");

      return [
        row.site,
        row.total.toLocaleString(),
        row.healthy.toLocaleString(),
        row.unhealthy.toLocaleString(),
        row.unknown.toLocaleString(),
        topModels || "n/a",
      ];
    });

  // ===== PAGE 1: COVER PAGE =====
  paintDarkBackground();

  if (logoDataUrl) {
    // Top-right corner, small enough not to overlap title
    doc.addImage(logoDataUrl, "PNG", 432, 24, 140, 50, undefined, "FAST");
  }

  doc.setTextColor(232, 242, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("Site Audit Readout", 40, 100);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(210, 229, 255);
  doc.text("Network Equipment Inventory & Health Report", 40, 138);

  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(1.5);
  doc.line(40, 146, 572, 146);

  doc.setFontSize(10);
  doc.setTextColor(151, 167, 197);
  const coverLines = [
    `Report Generated: ${now.toLocaleString()}`,
    `Total Devices Scanned: ${deviceMachines.length.toLocaleString()}`,
    `Total Sites: ${siteAggregate.size}`,
    `CSV Files Processed: ${summaries.length}`,
  ];

  let coverY = 170;
  for (const line of coverLines) {
    doc.text(line, 40, coverY);
    coverY += 20;
  }

  doc.setFontSize(10);
  doc.setTextColor(208, 219, 241);
  doc.text("Site Equipment Overview", 40, coverY + 16);

  doc.setFontSize(9);
  doc.setTextColor(151, 167, 197);
  const totalHealthy = Array.from(siteAggregate.values()).reduce((sum, s) => sum + s.healthy, 0);
  const totalUnhealthy = Array.from(siteAggregate.values()).reduce((sum, s) => sum + s.unhealthy, 0);
  const totalUnknown = Array.from(siteAggregate.values()).reduce((sum, s) => sum + s.unknown, 0);
  const healthPercent = deviceMachines.length > 0 ? ((totalHealthy / deviceMachines.length) * 100).toFixed(1) : "0";

  const equipmentLines = [
    `Online/Healthy: ${totalHealthy} devices (${healthPercent}%)`,
    `Offline/Unhealthy: ${totalUnhealthy} devices`,
    `Unknown Status: ${totalUnknown} devices`,
  ];

  let eqY = coverY + 32;
  for (const line of equipmentLines) {
    doc.text(line, 40, eqY);
    eqY += 16;
  }

  const csvSummaryRows = summaries.map((summary) => [
    summary.filename,
    summary.rows.toLocaleString(),
    String(summary.columns),
    `${summary.nullRatioPct.toFixed(2)}%`,
    summary.statusColumn ?? "n/a",
    summary.unhealthyCount != null ? String(summary.unhealthyCount) : "n/a",
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(208, 219, 241);
  doc.text("CSV Import Summary", 40, eqY + 14);

  let coverTablePageCount = 0;

  autoTable(doc, {
    startY: eqY + 22,
    head: [["CSV", "Rows", "Columns", "Null %", "Status Column", "Unhealthy"]],
    body: csvSummaryRows.length > 0 ? csvSummaryRows : [["No CSV files", "0", "0", "0.00%", "n/a", "n/a"]],
    margin: tableMargins(),
    willDrawPage: () => {
      // Keep existing cover text visible on first table page.
      coverTablePageCount += 1;
      if (coverTablePageCount > 1) {
        paintDarkBackground();
      }
    },
    ...tableTheme,
    styles: {
      ...tableTheme.styles,
      fontSize: 7.5,
      cellPadding: 4,
    },
  });

  const csvSummaryEndY = doc.lastAutoTable ? doc.lastAutoTable.finalY : eqY + 80;

  doc.setFontSize(8);
  doc.setTextColor(113, 128, 150);
  doc.text(
    "This document contains comprehensive network equipment inventory, health status, and detailed engineering data.",
    40,
    csvSummaryEndY + 16
  );
  doc.text("All device details and configuration data is included in the appendix for full traceability.", 40, csvSummaryEndY + 26);

  // ===== PAGE 2: TABLE OF CONTENTS (rendered after all sections are generated) =====
  doc.addPage("letter", "portrait");
  tocPageNumber = doc.getNumberOfPages();

  // ===== PAGE 3+: QUICK READ & FINDINGS =====
  doc.addPage("letter", "portrait");
  paintDarkBackground();
  tocEntries.push({ label: "Quick Read by Site", page: doc.getNumberOfPages() });
  doc.setTextColor(232, 242, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Quick Read by Site", 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(151, 167, 197);
  doc.text(`Last Updated ${now.toLocaleString()}`, 40, 66);

  autoTable(doc, {
    startY: 80,
    head: [["Site", "Devices", "Healthy", "Unhealthy", "Unknown", "Top Models"]],
    body: quickReadRows.length > 0 ? quickReadRows : [["No site labels", "0", "0", "0", "0", "n/a"]],
    margin: tableMargins(),
    willDrawPage: darkPageHook,
    ...tableTheme,
  });

  const quickReadEnd = doc.lastAutoTable ? doc.lastAutoTable.finalY : 150;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(210, 229, 255);
  doc.setFontSize(13);
  doc.text("Executive Findings", 40, quickReadEnd + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(208, 219, 241);

  let findingY = quickReadEnd + 40;
  for (const finding of findings) {
    const wrapped = doc.splitTextToSize(`- ${finding}`, 520);
    doc.text(wrapped, 44, findingY);
    findingY += wrapped.length * 13 + 3;
  }

  // ===== SNAPSHOT PAGE =====
  if (deviceMachines.length > 0) {
    doc.addPage("letter", "landscape");
    paintDarkBackground();
    tocEntries.push({ label: "Machine Inventory Snapshot", page: doc.getNumberOfPages() });
    doc.setTextColor(232, 242, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Machine Inventory Snapshot", 36, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(151, 167, 197);
    doc.text("Compact table for at-a-glance review. Full selected fields are included in appendix pages.", 36, 58);

    const priority = ["displayName", "site", "status", "ip", "mac", "model", "role", "serial", "sourceFile"];
    const compactEntries = [];
    for (const key of priority) {
      const match = selectedEntries.find((entry) => entry.key === key);
      if (match && compactEntries.length < 8) {
        compactEntries.push(match);
      }
    }
    for (const entry of selectedEntries) {
      if (compactEntries.length >= 8) {
        break;
      }
      if (!compactEntries.some((item) => item.key === entry.key)) {
        compactEntries.push(entry);
      }
    }

    const snapshotHeaders = compactEntries.map((entry) => entry.label);
    const snapshotRows = deviceMachines.map((machine) => compactEntries.map((entry) => getValue(machine, entry.key)));
    const snapshotKeys = new Set(compactEntries.map((entry) => entry.key));

    autoTable(doc, {
      startY: 70,
      head: [snapshotHeaders],
      body: snapshotRows,
      margin: tableMargins(),
      willDrawPage: darkPageHook,
      ...tableTheme,
      styles: {
        ...tableTheme.styles,
        fontSize: 7.5,
        overflow: "ellipsize",
      },
    });

    // ===== DEVICE APPENDIX PAGES WITH GROUPED LAYOUT =====
    const coreFields = ["hostname", "status", "ip", "mac", "model", "vendor", "role", "serial"];
    const rawFields = selectedEntries.filter(
      (entry) =>
        !["displayName", "sourceFile", "rowIndex"].includes(entry.key) &&
        !snapshotKeys.has(entry.key) &&
        !coreFields.includes(entry.key)
    );

    if (deviceMachines.length > 0) {
      tocEntries.push({ label: "Device Appendix", page: doc.getNumberOfPages() + 1 });
    }

    for (const machine of deviceMachines) {
      doc.addPage("letter", "portrait");

      const paintDevicePageHeader = () => {
        paintDarkBackground();
        doc.setTextColor(232, 242, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Device Details", 40, 32);
        doc.setFontSize(12);
        doc.text(machine.displayName || "Unknown device", 40, 50);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(151, 167, 197);
        doc.text(`Source: ${machine.sourceFile} | Row: ${machine.rowIndex}`, 40, 62);
      };

      paintDevicePageHeader();

      let currentY = 78;

      // Core Device Info Section
      const coreRows = coreFields
        .map((key) => {
          const entry = selectedEntries.find((e) => e.key === key);
          if (entry) {
            return [entry.label, getValue(machine, key)];
          }
          return null;
        })
        .filter(Boolean);

      if (coreRows.length > 0) {
        const coreLayout = centeredTwoColLayout(360);
        doc.setTextColor(210, 229, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Core Device Information", coreLayout.startX, currentY);
        currentY += 12;

        autoTable(doc, {
          startY: currentY,
          head: [["Property", "Value"]],
          body: coreRows,
          margin: coreLayout.margin,
          ...tableTheme,
          styles: {
            ...tableTheme.styles,
            fontSize: 9,
          },
          columnStyles: {
            0: { cellWidth: 140 },
            1: { cellWidth: 220 },
          },
        });

        currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : currentY + 80;
      }

      // Raw CSV Fields Section
      if (rawFields.length > 0) {
        const rawLayout = centeredTwoColLayout(360);
        doc.setTextColor(210, 229, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Additional Data", rawLayout.startX, currentY);
        currentY += 12;

        const rawRows = rawFields.map((entry) => [entry.label, getValue(machine, entry.key)]);

        autoTable(doc, {
          startY: currentY,
          head: [["Field", "Value"]],
          body: rawRows,
          margin: rawLayout.margin,
          ...tableTheme,
          styles: {
            ...tableTheme.styles,
            fontSize: 8,
          },
          columnStyles: {
            0: { cellWidth: 140 },
            1: { cellWidth: 220 },
          },
          didDrawPage: (data) => {
            const pageCount = doc.getNumberOfPages();
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.getHeight();

            // Repaint background on continuation pages
            if (data.pageNumber > 1) {
              const currentPageIndex = doc.getNumberOfPages();
              doc.setPageSize(pageSize);
              paintDarkBackground();
              doc.setTextColor(210, 229, 255);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.text(`${machine.displayName} (continued)`, 40, 32);
            }
          },
        });
      }
    }
  }

  // ===== NON-DEVICE DATASET SECTIONS =====
  for (const type of nonDeviceTypes) {
    const records = dataByType[type] || [];
    if (records.length === 0) {
      continue;
    }

    const typeLabel = getTypeLabel(type);
    const allRawColumns = Array.from(new Set(records.flatMap((record) => Object.keys(record.raw || {}))));
    const typeOptions = normalizedOptionsByType[type] || [];
    const selectedForType = normalizedSelectedByType[type] || [];
    const optionByKey = new Map(typeOptions.map((item) => [item.key, item.label]));

    const defaultColumns = ["displayName", "sourceFile", "rowIndex", ...allRawColumns.map((item) => `raw::${item}`)];
    const resolvedColumns = selectedForType.length > 0 ? selectedForType : defaultColumns;

    const snapshotColumns = [];
    const seenColumns = new Set();
    for (const key of resolvedColumns) {
      if (snapshotColumns.length >= 8) {
        break;
      }
      if (seenColumns.has(key)) {
        continue;
      }
      seenColumns.add(key);
      snapshotColumns.push(key);
    }

    const snapshotHeaders = snapshotColumns.map((column) => optionByKey.get(column) || formatLabel(column.replace("raw::", "")));
    const snapshotRows = records.map((record) => snapshotColumns.map((column) => getGenericValue(record, column)));

    doc.addPage("letter", "landscape");
    paintDarkBackground();
    tocEntries.push({ label: `${typeLabel} Snapshot`, page: doc.getNumberOfPages() });
    doc.setTextColor(232, 242, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`${typeLabel} Snapshot`, 36, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(151, 167, 197);
    doc.text(`${records.length.toLocaleString()} record(s) from uploaded ${typeLabel.toLowerCase()} CSV files.`, 36, 58);

    autoTable(doc, {
      startY: 72,
      head: [snapshotHeaders.length > 0 ? snapshotHeaders : ["No Columns"]],
      body: snapshotRows.length > 0 ? snapshotRows : [["No rows"]],
      margin: tableMargins(),
      willDrawPage: darkPageHook,
      ...tableTheme,
      styles: {
        ...tableTheme.styles,
        fontSize: 7.5,
        overflow: "ellipsize",
      },
    });

    tocEntries.push({ label: `${typeLabel} Appendix`, page: doc.getNumberOfPages() + 1 });

    for (const record of records) {
      doc.addPage("letter", "portrait");
      paintDarkBackground();
      doc.setTextColor(232, 242, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${typeLabel} Record`, 40, 32);
      doc.setFontSize(12);
      doc.text(record.displayName || "Unknown record", 40, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(151, 167, 197);
      doc.text(`Source: ${record.sourceFile || "n/a"} | Row: ${record.rowIndex || "n/a"}`, 40, 62);

      const detailKeys = selectedForType.length > 0 ? selectedForType : defaultColumns;
      const detailRows = detailKeys.map((key) => [
        optionByKey.get(key) || formatLabel(key.replace("raw::", "")),
        getGenericValue(record, key),
      ]);

      const detailLayout = centeredTwoColLayout(360);

      autoTable(doc, {
        startY: 78,
        head: [["Field", "Value"]],
        body: detailRows,
        margin: detailLayout.margin,
        willDrawPage: darkPageHook,
        ...tableTheme,
        styles: {
          ...tableTheme.styles,
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 150 },
          1: { cellWidth: 210 },
        },
      });
    }
  }

  // ===== TOPOLOGY PAGES =====
  if (images.length > 0) {
    tocEntries.push({ label: "Topology Images", page: doc.getNumberOfPages() + 1 });
  }

  for (const image of images) {
    // Pick orientation based on image aspect ratio so it fills the page.
    const isLandscape = (image.width || 1) >= (image.height || 1);
    const orientation = isLandscape ? "landscape" : "portrait";
    doc.addPage("letter", orientation);
    paintDarkBackground();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setTextColor(232, 242, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Topology: ${image.name}`, 40, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(151, 167, 197);
    doc.text(`${image.width || "?"}×${image.height || "?"} px · ${orientation}`, 40, 50);

    // Scale image to fill available area while preserving aspect ratio.
    const margin = 40;
    const headerHeight = 58;
    const availW = pageWidth - margin * 2;
    const availH = pageHeight - headerHeight - margin;
    const imgAspect = image.width && image.height ? image.width / image.height : availW / availH;
    let drawW = availW;
    let drawH = drawW / imgAspect;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * imgAspect;
    }
    const drawX = margin + (availW - drawW) / 2;
    const drawY = headerHeight;

    doc.setDrawColor(...palette.line);
    doc.rect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
    doc.addImage(image.dataUrl, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST");
  }

  // Render table of contents after all page numbers are finalized.
  if (tocPageNumber > 0) {
    doc.setPage(tocPageNumber);
    paintDarkBackground();

    doc.setTextColor(232, 242, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Table of Contents", 40, 58);

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 406, 24, 152, 54, undefined, "FAST");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(151, 167, 197);
    doc.text("Click any section name to jump to that page.", 40, 76);

    let tocY = 108;
    const maxRows = 28;
    const rows = tocEntries.slice(0, maxRows);

    for (const entry of rows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(208, 219, 241);
      doc.text(entry.label, 44, tocY);

      doc.setDrawColor(98, 44, 53);
      doc.setLineWidth(0.6);
      doc.line(220, tocY - 3, 520, tocY - 3);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(232, 242, 255);
      doc.text(String(entry.page), 530, tocY);

      doc.link(40, tocY - 11, 500, 14, { pageNumber: entry.page });
      tocY += 22;
    }

    if (tocEntries.length > maxRows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(151, 167, 197);
      doc.text(`Additional sections not shown: ${tocEntries.length - maxRows}`, 40, tocY + 8);
    }
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  doc.save(`site_audit_readout_${stamp}.pdf`);
}
