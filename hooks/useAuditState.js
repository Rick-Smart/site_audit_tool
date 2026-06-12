import { useEffect, useMemo, useState } from "react";
import { buildFindings, buildMachineInventory, summarizeCsv } from "../lib/audit";
import { buildExportFieldOptions, buildGenericExportFieldOptions } from "../lib/exportFields";
import { readDataUrl, readTextFile, parseCsvText, getImageDimensions } from "../lib/fileReaders";
import { detectCsvType, CSV_TYPES } from "../lib/csvTypeDetection";
import { buildGenericInventory, buildCsvSummary } from "../lib/genericCsvProcessor";

export function useAuditState() {
  const [dataByType, setDataByType] = useState({});
  const [csvFiles, setCsvFiles] = useState([]);
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

  const findings = useMemo(() => {
    if (summaries.length === 0) {
      return [];
    }
    return buildFindings(summaries);
  }, [summaries]);

  const machineInventory = useMemo(() => {
    return dataByType[CSV_TYPES.DEVICES] || [];
  }, [dataByType]);

  const stats = useMemo(() => {
    const totalRows = summaries.reduce((sum, item) => sum + item.rows, 0);
    const unhealthy = summaries.reduce((sum, item) => sum + (item.unhealthyCount ?? 0), 0);
    const avgNull =
      summaries.length > 0
        ? summaries.reduce((sum, item) => sum + item.nullRatioPct, 0) / summaries.length
        : 0;

    return {
      files: summaries.length,
      totalRows,
      unhealthy,
      avgNull,
      topologyCount: topologies.length,
      devices: machineInventory.length,
    };
  }, [summaries, topologies, machineInventory]);

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

  const onCsvChange = async (event) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setIsProcessing(true);
    const nextDataByType = { ...dataByType };
    const nextCsvFiles = [...csvFiles];
    const nextSummaries = [...summaries];
    const nextErrors = [...errors];

    for (const file of files) {
      try {
        const text = await readTextFile(file);
        const rows = await parseCsvText(text);

        if (rows.length === 0) {
          nextErrors.push({
            file: file.name,
            message: "CSV file is empty",
          });
          continue;
        }

        const columns = Object.keys(rows[0]);
        const detectedType = detectCsvType(columns, file.name);

        nextCsvFiles.push({
          fileName: file.name,
          detectedType,
          headers: columns,
          rows,
        });

        if (detectedType === CSV_TYPES.DEVICES) {
          const summary = summarizeCsv(file.name, rows);
          const inventory = buildMachineInventory(file.name, rows);
          nextSummaries.push(summary);

          if (!nextDataByType[CSV_TYPES.DEVICES]) {
            nextDataByType[CSV_TYPES.DEVICES] = [];
          }
          nextDataByType[CSV_TYPES.DEVICES].push(...inventory.records);
        } else {
          const summary = buildCsvSummary(file.name, rows, detectedType);
          const inventory = buildGenericInventory(file.name, rows, detectedType);
          nextSummaries.push(summary);

          if (!nextDataByType[detectedType]) {
            nextDataByType[detectedType] = [];
          }
          nextDataByType[detectedType].push(...inventory.records);
        }
      } catch (error) {
        nextErrors.push({
          file: file.name,
          message: error instanceof Error ? error.message : "Unknown parse failure",
        });
      }
    }

    setDataByType(nextDataByType);
    setCsvFiles(nextCsvFiles);
    setSummaries(nextSummaries);
    setErrors(nextErrors);
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
    setCsvFiles([]);
    setSummaries([]);
    setErrors([]);
    setActiveMachineId("");
    setSelectedExportFieldsByType({});
    setTopologies([]);
  };

  return {
    csvFiles,
    summaries,
    machineInventory,
    dataByType,
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
    onPngChange,
    setFileFilter,
    setSiteFilter,
    setStatusFilter,
    setSearchQuery,
    setActiveMachineId,
    toggleExportField,
    clearAllData,
  };
}
