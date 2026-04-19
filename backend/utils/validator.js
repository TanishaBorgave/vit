/**
 * GST Data Validation Engine
 * Validates invoice data before export to ensure GST compliance
 * Includes Section 17(5) CGST Act — Blocked ITC (Negative List) validation
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * ═══════════════════════════════════════════════════════════════
 * GST NEGATIVE LIST — Section 17(5) CGST Act, 2017
 * Items/services where Input Tax Credit (ITC) is BLOCKED
 * ═══════════════════════════════════════════════════════════════
 */
const GST_NEGATIVE_LIST = [
  {
    id: "MOTOR_VEHICLES",
    category: "Motor Vehicles & Conveyances",
    section: "Section 17(5)(a)",
    description: "Motor vehicles for transportation of persons (seating ≤13), vessels, and aircraft. ITC blocked unless used for further supply, passenger transport, or driving training.",
    hsnCodes: ["8702", "8703", "8704", "8711", "8901", "8802", "8803"],
    keywords: [
      "motor vehicle", "car purchase", "car lease", "automobile", "sedan", "suv",
      "hatchback", "vehicle purchase", "two wheeler", "motorcycle", "scooter",
      "boat", "yacht", "vessel", "aircraft", "helicopter", "airplane",
      "car rental", "vehicle rental", "car hire"
    ],
  },
  {
    id: "MOTOR_VEHICLE_SERVICES",
    category: "Motor Vehicle Related Services",
    section: "Section 17(5)(ab)",
    description: "General insurance, servicing, repair and maintenance of motor vehicles where ITC on vehicle itself is blocked.",
    sacCodes: ["9971", "9987"],
    keywords: [
      "vehicle insurance", "car insurance", "motor insurance", "vehicle servicing",
      "car servicing", "car repair", "vehicle repair", "car maintenance",
      "vehicle maintenance", "auto repair", "auto service", "garage service",
      "car wash", "denting", "painting vehicle", "tyre replacement"
    ],
  },
  {
    id: "FOOD_BEVERAGES",
    category: "Food, Beverages & Outdoor Catering",
    section: "Section 17(5)(b)(i)",
    description: "Food and beverages, outdoor catering. ITC blocked unless used for same category outward supply or obligatory under law.",
    hsnCodes: ["0901", "0902", "2101", "2106", "2201", "2202"],
    sacCodes: ["9963"],
    keywords: [
      "food", "beverage", "catering", "restaurant", "hotel food", "meals",
      "lunch", "dinner", "breakfast", "snacks", "tea coffee", "refreshment",
      "outdoor catering", "party food", "canteen", "mess charges", "tiffin",
      "sweets", "bakery", "confectionery", "pantry supplies"
    ],
  },
  {
    id: "HEALTH_BEAUTY",
    category: "Beauty Treatment, Health Services & Cosmetic Surgery",
    section: "Section 17(5)(b)(ii)",
    description: "Beauty treatment, health services, cosmetic and plastic surgery. ITC blocked unless used for same category outward supply.",
    sacCodes: ["9993", "9992"],
    keywords: [
      "beauty treatment", "beauty salon", "beauty parlour", "beauty parlor",
      "spa", "massage", "facial", "cosmetic surgery", "plastic surgery",
      "botox", "hair treatment", "skin treatment", "dermatology",
      "cosmetic", "grooming", "personal care service", "manicure", "pedicure"
    ],
  },
  {
    id: "CLUB_MEMBERSHIP",
    category: "Club, Health & Fitness Centre Membership",
    section: "Section 17(5)(b)(iii)",
    description: "Membership of a club, health and fitness centre. ITC blocked entirely.",
    sacCodes: ["9996"],
    keywords: [
      "club membership", "gym membership", "fitness centre", "fitness center",
      "health club", "sports club", "swimming pool membership", "yoga centre",
      "country club", "golf club", "recreation club", "gymnasium"
    ],
  },
  {
    id: "TRAVEL_BENEFITS",
    category: "Travel Benefits to Employees",
    section: "Section 17(5)(b)(iv)",
    description: "Travel benefits extended to employees on vacation such as Leave Travel Concession (LTC) or Home Travel Concession.",
    sacCodes: ["9964", "9966"],
    keywords: [
      "leave travel", "ltc", "home travel concession", "htc",
      "vacation travel", "employee travel benefit", "employee leave travel",
      "holiday travel", "employee vacation"
    ],
  },
  {
    id: "WORKS_CONTRACT_CONSTRUCTION",
    category: "Works Contract & Construction of Immovable Property",
    section: "Section 17(5)(c)(d)",
    description: "Works contract services for construction of immovable property (other than plant & machinery). Also goods/services for construction on own account.",
    sacCodes: ["9954", "9987"],
    hsnCodes: ["6801", "6802", "6807", "6808", "6810", "6811", "6901", "6902", "6904", "6905", "6907", "6908", "7003", "7004", "7005", "7006", "7007", "7008", "7213", "7214", "7215", "7216", "7228"],
    keywords: [
      "works contract", "construction", "building construction",
      "civil work", "civil construction", "immovable property",
      "building material", "cement", "brick", "sand", "steel rods",
      "rebar", "concrete", "plumbing work", "electrical wiring",
      "flooring", "painting contractor", "interior decoration",
      "renovation", "false ceiling", "waterproofing"
    ],
  },
  {
    id: "GIFTS_FREE_SAMPLES",
    category: "Goods Disposed as Gifts or Free Samples",
    section: "Section 17(5)(h)",
    description: "Goods lost, stolen, destroyed, written off, or disposed of by way of gift or free samples. ITC must be reversed.",
    keywords: [
      "gift", "free sample", "complimentary", "giveaway", "promotional gift",
      "corporate gift", "diwali gift", "festival gift", "gift hamper",
      "gift voucher", "gift card", "donation goods", "free distribution"
    ],
  },
  {
    id: "PERSONAL_CONSUMPTION",
    category: "Goods/Services for Personal Consumption",
    section: "Section 17(5)(g)",
    description: "Goods or services or both used for personal consumption. ITC not available.",
    keywords: [
      "personal use", "personal consumption", "household", "domestic use",
      "home appliance personal", "personal grooming", "personal shopping"
    ],
  },
  {
    id: "RENT_A_CAB",
    category: "Rent-a-Cab, Life Insurance, Health Insurance",
    section: "Section 17(5)(b)(i)(iii)",
    description: "Rent-a-cab services, life insurance, health insurance (unless obligatory under law for employees).",
    sacCodes: ["9966", "9971"],
    keywords: [
      "rent a cab", "cab rental", "taxi hire", "cab booking", "ola uber",
      "life insurance premium", "health insurance premium",
      "mediclaim", "group insurance", "keyman insurance"
    ],
  },
];

/**
 * Extract HSN/SAC code from invoice rawData
 */
function extractHSNFromInvoice(invoice) {
  const codes = [];
  if (invoice.rawData?.hsnCode) {
    codes.push(String(invoice.rawData.hsnCode));
  }
  // Check if rawText contains HSN/SAC patterns
  if (invoice.rawData?.rawText) {
    const hsnPattern = /(?:HSN|SAC|HSN\/SAC)[\s:.\-]*(\d{4,8})/gi;
    let match;
    while ((match = hsnPattern.exec(invoice.rawData.rawText)) !== null) {
      codes.push(match[1]);
    }
  }
  return codes;
}

/**
 * Check if an invoice falls under the GST negative list (blocked ITC)
 * Returns array of matched negative list categories
 */
function validateNegativeList(invoice) {
  const warnings = [];

  // Build searchable text from invoice fields
  const searchParts = [
    invoice.partyName || "",
    invoice.rawData?.rawText || "",
    invoice.rawData?.description || "",
    invoice.rawData?.itemDescription || "",
    invoice.rawData?.productName || "",
  ];
  const searchText = searchParts.join(" ").toLowerCase();

  // Extract HSN/SAC codes from invoice
  const invoiceHSNCodes = extractHSNFromInvoice(invoice);

  for (const negItem of GST_NEGATIVE_LIST) {
    let matched = false;
    let matchReason = "";

    // Check HSN codes
    if (negItem.hsnCodes && invoiceHSNCodes.length > 0) {
      for (const invCode of invoiceHSNCodes) {
        for (const negCode of negItem.hsnCodes) {
          if (invCode.startsWith(negCode)) {
            matched = true;
            matchReason = `HSN code ${invCode} matches blocked category (${negCode}xx)`;
            break;
          }
        }
        if (matched) break;
      }
    }

    // Check SAC codes
    if (!matched && negItem.sacCodes && invoiceHSNCodes.length > 0) {
      for (const invCode of invoiceHSNCodes) {
        for (const negCode of negItem.sacCodes) {
          if (invCode.startsWith(negCode)) {
            matched = true;
            matchReason = `SAC code ${invCode} matches blocked category (${negCode}xx)`;
            break;
          }
        }
        if (matched) break;
      }
    }

    // Check keywords in invoice text
    if (!matched && searchText.length > 0) {
      for (const kw of negItem.keywords) {
        if (searchText.includes(kw.toLowerCase())) {
          matched = true;
          matchReason = `Invoice text contains "${kw}" — possible blocked ITC category`;
          break;
        }
      }
    }

    if (matched) {
      warnings.push({
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        gstin: invoice.gstin,
        field: "negativeList",
        message: `⚠ Negative List [${negItem.section}]: ${negItem.category}. ${matchReason}. ${negItem.description}`,
        severity: "WARNING",
        negativeListId: negItem.id,
        negativeListCategory: negItem.category,
      });
    }
  }

  return warnings;
}

/**
 * Validate GSTIN format
 */
function validateGSTIN(gstin) {
  if (!gstin) return { valid: false, message: "GSTIN is missing" };
  const cleaned = gstin.toUpperCase().replace(/\s+/g, "");
  if (!GSTIN_REGEX.test(cleaned)) {
    return { valid: false, message: `Invalid GSTIN format: ${gstin}` };
  }
  return { valid: true };
}

/**
 * Validate invoice number
 */
function validateInvoiceNo(invoiceNo) {
  if (!invoiceNo || String(invoiceNo).trim() === "") {
    return { valid: false, message: "Invoice number is missing" };
  }
  if (String(invoiceNo).length > 16) {
    return {
      valid: false,
      message: `Invoice number exceeds 16 characters: ${invoiceNo}`,
    };
  }
  return { valid: true };
}

/**
 * Validate invoice date within a return period
 */
function validateInvoiceDate(invoiceDate, periodMonth, periodYear) {
  if (!invoiceDate) {
    return { valid: false, message: "Invoice date is missing" };
  }

  const date = new Date(invoiceDate);
  if (isNaN(date.getTime())) {
    return { valid: false, message: "Invalid invoice date" };
  }

  // Financial year check - allow invoices from the same financial year
  const invMonth = date.getMonth() + 1;
  const invYear = date.getFullYear();

  // Determine financial year of the return period
  const fyStart = periodMonth >= 4 ? periodYear : periodYear - 1;
  const fyEnd = fyStart + 1;

  // Invoice should be within financial year (Apr fyStart to Mar fyEnd)
  const fyStartDate = new Date(fyStart, 3, 1); // April 1
  const fyEndDate = new Date(fyEnd, 2, 31, 23, 59, 59); // March 31

  if (date < fyStartDate || date > fyEndDate) {
    return {
      valid: false,
      severity: "WARNING",
      message: `Invoice date ${date.toLocaleDateString("en-IN")} is outside the financial year ${fyStart}-${fyEnd}`,
    };
  }

  // Check if date is in the future
  if (date > new Date()) {
    return {
      valid: false,
      message: `Invoice date ${date.toLocaleDateString("en-IN")} is in the future`,
    };
  }

  return { valid: true };
}

/**
 * Validate tax calculation correctness
 */
function validateTaxCalculation(invoice) {
  const errors = [];

  const { taxableValue, cgst, sgst, igst, gstAmount } = invoice;

  // Check negative values
  if (taxableValue < 0) {
    errors.push({
      field: "taxableValue",
      message: "Taxable value is negative",
      severity: "WARNING",
    });
  }

  // Verify GST component sum
  const componentSum = Math.round(((cgst || 0) + (sgst || 0) + (igst || 0)) * 100) / 100;
  if (gstAmount > 0 && componentSum > 0) {
    const diff = Math.abs(gstAmount - componentSum);
    if (diff > 1) {
      errors.push({
        field: "gstAmount",
        message: `GST amount (₹${gstAmount}) does not match sum of CGST+SGST+IGST (₹${componentSum})`,
        severity: "WARNING",
      });
    }
  }

  // Check IGST vs CGST+SGST (shouldn't have both)
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    errors.push({
      field: "igst",
      message: "Invoice has both IGST and CGST/SGST. Only one type should apply.",
      severity: "WARNING",
    });
  }

  // Verify CGST = SGST for intra-state
  if (cgst > 0 && sgst > 0) {
    const diff = Math.abs(cgst - sgst);
    if (diff > 1) {
      errors.push({
        field: "cgst",
        message: `CGST (₹${cgst}) and SGST (₹${sgst}) should be equal for intra-state supplies`,
        severity: "WARNING",
      });
    }
  }

  // Check reasonable GST rates (common rates: 5%, 12%, 18%, 28%)
  if (taxableValue > 0 && gstAmount > 0) {
    const effectiveRate = Math.round((gstAmount / taxableValue) * 100);
    const validRates = [0, 0.1, 0.25, 1, 3, 5, 6, 7.5, 9, 12, 14, 18, 28];
    const isStandardRate = validRates.some(
      (r) => Math.abs(effectiveRate - r) <= 1
    );
    if (!isStandardRate && effectiveRate > 30) {
      errors.push({
        field: "gstAmount",
        message: `Effective GST rate (${effectiveRate}%) seems unusually high`,
        severity: "WARNING",
      });
    }
  }

  return errors;
}

/**
 * Check for duplicate invoices
 */
function findDuplicates(invoices) {
  const seen = new Map();
  const duplicates = [];

  for (const inv of invoices) {
    const key = `${inv.gstin}|${inv.invoiceNo}`;
    if (seen.has(key)) {
      duplicates.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "invoiceNo",
        message: `Duplicate invoice: ${inv.invoiceNo} for GSTIN ${inv.gstin}`,
        severity: "ERROR",
      });
    } else {
      seen.set(key, inv._id);
    }
  }

  return duplicates;
}

/**
 * Validate all invoices for a return period
 */
function validateInvoices(invoices, periodMonth, periodYear) {
  const errors = [];

  // Check duplicates first
  const duplicates = findDuplicates(invoices);
  errors.push(...duplicates);

  for (const inv of invoices) {
    // Validate GSTIN
    const gstinResult = validateGSTIN(inv.gstin);
    if (!gstinResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "gstin",
        message: gstinResult.message,
        severity: "ERROR",
      });
    }

    // Validate Invoice Number
    const invNoResult = validateInvoiceNo(inv.invoiceNo);
    if (!invNoResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo || "(empty)",
        gstin: inv.gstin,
        field: "invoiceNo",
        message: invNoResult.message,
        severity: "ERROR",
      });
    }

    // Validate Date
    const dateResult = validateInvoiceDate(inv.invoiceDate, periodMonth, periodYear);
    if (!dateResult.valid) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        field: "invoiceDate",
        message: dateResult.message,
        severity: dateResult.severity || "ERROR",
      });
    }

    // Validate Tax Calculations
    const taxErrors = validateTaxCalculation(inv);
    for (const err of taxErrors) {
      errors.push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        gstin: inv.gstin,
        ...err,
      });
    }

    // Validate against GST Negative List (Section 17(5) blocked ITC)
    const negativeListWarnings = validateNegativeList(inv);
    errors.push(...negativeListWarnings);
  }

  const totalErrors = errors.filter((e) => e.severity === "ERROR").length;
  const totalWarnings = errors.filter((e) => e.severity === "WARNING").length;

  return { errors, totalErrors, totalWarnings };
}

module.exports = {
  validateGSTIN,
  validateInvoiceNo,
  validateInvoiceDate,
  validateTaxCalculation,
  validateNegativeList,
  findDuplicates,
  validateInvoices,
  GST_NEGATIVE_LIST,
};
