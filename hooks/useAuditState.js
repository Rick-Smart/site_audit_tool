import { useEffect, useMemo, useState } from "react";
import { buildFindings } from "../lib/audit";
import { buildExportFieldOptions, buildGenericExportFieldOptions } from "../lib/exportFields";
import { readDataUrl, getImageDimensions } from "../lib/fileReaders";
import { CSV_TYPES } from "../lib/csvTypeDetection";
import { ingestCsvFiles } from "../lib/csvIngest";
import { buildDiffReport, filterDiffReport } from "../lib/diffEngine";

const DEFAULT_XLSX_EXPORT_OPTIONS = {
  includeSummary: true,
  includeNormalized: false,
  sheetNameMode: "filename",
  filePrefix: "infralens_export",
};

const XLSX_EXPORT_OPTIONS_STORAGE_KEY = "audit-xlsx-export-options";
const DIFF_EXPORT_OPTIONS_STORAGE_KEY = "audit-diff-export-options";

const DEFAULT_DIFF_EXPORT_OPTIONS = {
  changeTypeFilter: "all",
  exportScope: "full",
};

const XLSX_EXPORT_PRESETS = {
  RAW_ONLY: {
    includeSummary: false,
    includeNormalized: false,
    sheetNameMode: "filename",
    filePrefix: "infralens_export",
  },
  FULL_WORKBOOK: {
    includeSummary: true,
    includeNormalized: true,
    sheetNameMode: "type-filename",
    filePrefix: "infralens_export",
  },
};

export function useAuditState() {
  const [dataByType, setDataByType] = useState({});
  const [baselineDataByType, setBaselineDataByType] = useState({});
  const [csvFiles, setCsvFiles] = useState([]);
  const [baselineCsvFiles, setBaselineCsvFiles] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topologies, setTopologies] = useState([]);
  const [fileFilter, setFileFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMachineId, setActiveMachineId] = useState("");
  const [selectedExportFieldsByType, setSelectedExportFieldsByType] = useState({});
  const [xlsxExportOptions, setXlsxExportOptions] = useState(DEFAULT_XLSX_EXPORT_OPTIONS);
  const [diffExportOptions, setDiffExportOptions] = useState(DEFAULT_DIFF_EXPORT_OPTIONS);

  const findings = useMemo(() => {
    if (summaries.length === 0) {
      return [];
    }
    return buildFindings(summaries);
  }, [summaries]);

  const machineInventory = useMemo(() => {
    return dataByType[CSV_TYPES.DEVICES] || [];
  }, [dataByType]);

  const diffReport = useMemo(() => {
    return buildDiffReport(dataByType, baselineDataByType);
  }, [dataByType, baselineDataByType]);

  const filteredDiffReport = useMemo(() => {
    return filterDiffReport(diffReport, diffExportOptions.changeTypeFilter);
  }, [diffReport, diffExportOptions.changeTypeFilter]);

  const stats = useMemo(() => {
    const totalRows = summaries.reduce((sum, item) => sum + item.rows, 0);
    const unhealthy = summaries.reduce((sum, item) => sum + (item.unhealthyCount ?? 0), 0);
    const avgNull =
      summaries.length > 0
        ? summaries.reduce((sum, item) => sum + item.nullRatioPct, 0) / summaries.length
        : 0;

    return {
      files: summaries.length,
      baselineFiles: baselineCsvFiles.length,
      totalRows,
      unhealthy,
      avgNull,
      topologyCount: topologies.length,
      devices: machineInventory.length,
    };
  }, [summaries, baselineCsvFiles, topologies, machineInventory]);

  const fileOptions = useMemo(
    () => ["all", ...Array.from(new Set(machineInventory.map((item) => item.sourceFile))).sort()],
    [machineInventory]
  );

  const siteOptions = useMemo(
    () => ["all", ...Array.from(new Set(machineInventory.map((item) => item.site).filter(Boolean))).sort()],
    [machineInventory]
  );

  const hasSiteData = siteOptions.length > 1;

  const filteredInventory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return machineInventory.filter((item) => {
      if (fileFilter !== "all" && item.sourceFile !== fileFilter) {
        return false;
      }
      if (siteFilter !== "all" && item.site !== siteFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.statusTone !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        item.displayName,
        item.hostname,
        item.ip,
        item.mac,
        item.serial,
        item.model,
        item.vendor,
        item.role,
        item.site,
        item.status,
        item.sourceFile,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [machineInventory, fileFilter, siteFilter, statusFilter, searchQuery]);

  const activeMachine = useMemo(
    () => filteredInventory.find((item) => item.id === activeMachineId) || null,
    [filteredInventory, activeMachineId]
  );

  const exportFieldOptionsByType = useMemo(() => {
    return {
      [CSV_TYPES.DEVICES]: buildExportFieldOptions(dataByType[CSV_TYPES.DEVICES] || []),
      [CSV_TYPES.ADMINS]: buildGenericExportFieldOptions(dataByType[CSV_TYPES.ADMINS] || []),
      [CSV_TYPES.USERS]: buildGenericExportFieldOptions(dataByType[CSV_TYPES.USERS] || []),
      [CSV_TYPES.GENERIC]: buildGenericExportFieldOptions(dataByType[CSV_TYPES.GENERIC] || []),
    };
  }, [dataByType]);

  const exportFieldOptions = exportFieldOptionsByType[CSV_TYPES.DEVICES] || [];
  const selectedExportFields = selectedExportFieldsByType[CSV_TYPES.DEVICES] || [];

  useEffect(() => {
    setSelectedExportFieldsByType((current) => {
      const next = { ...current };
      let changed = false;

      for (const [type, options] of Object.entries(exportFieldOptionsByType)) {
        const defaultFieldKeys = options.map((item) => item.key);
        const optionKeys = new Set(defaultFieldKeys);
        const existing = current[type] || [];

        if (options.length === 0) {
          if (existing.length > 0) {
            next[type] = [];
            changed = true;
          }
          continue;
        }

        const intersected = existing.filter((field) => optionKeys.has(field));
        const nextKeys = intersected.length > 0 ? intersected : defaultFieldKeys;

        if (nextKeys.length !== existing.length || nextKeys.some((field, index) => field !== existing[index])) {
          next[type] = nextKeys;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [exportFieldOptionsByType]);

  useEffect(() => {
    if (!activeMachineId && filteredInventory.length > 0) {
      setActiveMachineId(filteredInventory[0].id);
      return;
    }
    if (activeMachineId && !filteredInventory.some((item) => item.id === activeMachineId)) {
      setActiveMachineId(filteredInventory[0]?.id || "");
    }
  }, [filteredInventory, activeMachineId]);

  useEffect(() => {
    if (!hasSiteData && siteFilter !== "all") {
      setSiteFilter("all");
    }
  }, [hasSiteData, siteFilter]);

  useEffect(() => {
    const saved = window.localStorage.getItem(XLSX_EXPORT_OPTIONS_STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setXlsxExportOptions((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // Ignore malformed persisted options and keep defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(XLSX_EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(xlsxExportOptions));
  }, [xlsxExportOptions]);

  useEffect(() => {
    const saved = window.localStorage.getItem(DIFF_EXPORT_OPTIONS_STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setDiffExportOptions((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // Ignore malformed persisted options and keep defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DIFF_EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(diffExportOptions));
  }, [diffExportOptions]);

  const toggleExportField = (type, key) => {
    setSelectedExportFieldsByType((current) => {
      const currentTypeSelection = current[type] || [];
      const nextTypeSelection = currentTypeSelection.includes(key)
        ? currentTypeSelection.filter((item) => item !== key)
        : [...currentTypeSelection, key];

      return {
        ...current,
        [type]: nextTypeSelection,
      };
    });
  };

  const updateXlsxExportOption = (key, value) => {
    setXlsxExportOptions((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyXlsxExportPreset = (presetKey) => {
    const preset = XLSX_EXPORT_PRESETS[presetKey];
    if (!preset) {
      return;
    }

    setXlsxExportOptions((current) => ({
      ...current,
      ...preset,
    }));
  };

  const updateDiffExportOption = (key, value) => {
    setDiffExportOptions((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const onCsvChange = async (event) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setIsProcessing(true);
    const ingested = await ingestCsvFiles(files, {
      dataByType,
      csvFiles,
      summaries,
      errors,
    });

    setDataByType(ingested.dataByType);
    setCsvFiles(ingested.csvFiles);
    setSummaries(ingested.summaries);
    setErrors(ingested.errors);
    setIsProcessing(false);

    event.target.value = "";
  };

  const onBaselineCsvChange = async (event) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setIsProcessing(true);
    const ingested = await ingestCsvFiles(files);

    setBaselineDataByType(ingested.dataByType);
    setBaselineCsvFiles(ingested.csvFiles);
    setIsProcessing(false);
    event.target.value = "";
  };

  const onPngChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    const next = [...topologies];

    for (const file of files) {
      const dataUrl = await readDataUrl(file);
      const { width, height } = await getImageDimensions(dataUrl);
      next.push({ name: file.name, dataUrl, width, height });
    }

    setTopologies(next);
    event.target.value = "";
  };

  const clearAllData = () => {
    setDataByType({});
    setBaselineDataByType({});
    setCsvFiles([]);
    setBaselineCsvFiles([]);
    setSummaries([]);
    setErrors([]);
    setActiveMachineId("");
    setSelectedExportFieldsByType({});
    setXlsxExportOptions(DEFAULT_XLSX_EXPORT_OPTIONS);
    setDiffExportOptions(DEFAULT_DIFF_EXPORT_OPTIONS);
    setTopologies([]);
  };

  return {
    csvFiles,
    summaries,
    machineInventory,
    dataByType,
    baselineDataByType,
    errors,
    isProcessing,
    topologies,
    fileFilter,
    siteFilter,
    statusFilter,
    searchQuery,
    activeMachineId,
    selectedExportFields,
    selectedExportFieldsByType,
    xlsxExportOptions,
    diffExportOptions,
    baselineCsvFiles,
    diffReport,
    filteredDiffReport,
    findings,
    stats,
    fileOptions,
    siteOptions,
    hasSiteData,
    filteredInventory,
    activeMachine,
    exportFieldOptions,
    exportFieldOptionsByType,
    onCsvChange,
    onBaselineCsvChange,
    onPngChange,
    setFileFilter,
    setSiteFilter,
    setStatusFilter,
    setSearchQuery,
    setActiveMachineId,
    toggleExportField,
    updateXlsxExportOption,
    updateDiffExportOption,
    applyXlsxExportPreset,
    clearAllData,
  };
}
