export const CSV_TYPES = {
  DEVICES: "devices",
  ADMINS: "admins",
  USERS: "users",
  GENERIC: "generic",
};

const TYPE_SIGNATURES = {
  devices: {
    type: CSV_TYPES.DEVICES,
    keywords: ["hostname", "ip", "status", "model", "mac", "serial", "vendor", "role"],
    minMatches: 3,
  },
  admins: {
    type: CSV_TYPES.ADMINS,
    keywords: ["username", "email", "department", "role", "admin", "access", "privilege"],
    minMatches: 3,
  },
  users: {
    type: CSV_TYPES.USERS,
    keywords: ["username", "email", "name", "department", "manager", "employee", "user"],
    minMatches: 3,
  },
};

export function detectCsvType(columns) {
  if (!columns || columns.length === 0) {
    return CSV_TYPES.GENERIC;
  }

  const lowerColumns = new Set(columns.map((col) => col.toLowerCase().trim()));

  for (const typeKey in TYPE_SIGNATURES) {
    const signature = TYPE_SIGNATURES[typeKey];
    const matches = signature.keywords.filter((keyword) => {
      return Array.from(lowerColumns).some((col) => col.includes(keyword));
    });

    if (matches.length >= signature.minMatches) {
      return signature.type;
    }
  }

  return CSV_TYPES.GENERIC;
}

export function getTypeLabel(type) {
  const labels = {
    [CSV_TYPES.DEVICES]: "Network Equipment",
    [CSV_TYPES.ADMINS]: "Administrative Users",
    [CSV_TYPES.USERS]: "End Users",
    [CSV_TYPES.GENERIC]: "Data",
  };
  return labels[type] || "Unknown";
}

export function sortByType(items) {
  const typeOrder = [CSV_TYPES.DEVICES, CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];
  return items.sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.type);
    const bIndex = typeOrder.indexOf(b.type);
    return aIndex - bIndex;
  });
}
