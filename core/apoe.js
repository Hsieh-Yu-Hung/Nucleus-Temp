/**
 * Analysis APOE core for Suspect-X.
 *
 * Run directly by node:
 *   node core/apoe.js \
 *   --[sampleId 1] [sample1_e2.xlsx] [sample1_e3.xlsx] [sample1_e4.xlsx] \
 *   --[sampleId 2] [sample2_e2.xlsx] [sample2_e3.xlsx] [sample2_e4.xlsx] \
 *   -a [ standard1_e2.xlsx ] \
 *   -a [ standard1_e3.xlsx ] \
 *   -a [ standard1_e4.xlsx ] \
 *   -b [ standard2_e2.xlsx ] \
 *   -b [ standard2_e3.xlsx ] \
 *   -b [ standard2_e4.xlsx ] \
 *   [-i qsep100] \
 *   [-r accuinApoe1] \
 *
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qsep100", // Only 'Qsep100' avaliable now
    r: "accuinApoe1", // Only support 'Accuin APOE kit version 1' now
  },
});

/* Define Setting */
const ACT_RFU_CUTOFF = 1;
const E2_RFU_CUTOFF = 0.7;
const E3_RFU_CUTOFF = 0.7;
const E4_RFU_CUTOFF = 0.8;
const EXPECTED_TARGET_BP = 175;
const EXPECTED_TARGET_RANGE_BP = [ 160, 195 ]; // about 175*0.9 - 175*1.1 bp
const EXPECTED_INTERNAL_E2_BP = 223;
const EXPECTED_INTERNAL_E2_RANGE_BP = [ 201, 250 ]; // about 223*0.9 - 223*1.1 bp
const EXPECTED_INTERNAL_E3_BP = 261;
const EXPECTED_INTERNAL_E3_RANGE_BP = [ 251, 300 ]; // about 261*0.9 - 261*1.1 bp
const EXPECTED_INTERNAL_E4_BP = 329;
const EXPECTED_INTERNAL_E4_RANGE_BP = [ 301, 370 ]; // about 329*0.9 - 329*1.1 bp

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment().format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "APOE_" + moment().format("YYYYMMDD_HHmmss") + ".json"
);
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  // If it doesn't exist, create it
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

// Get type information from filePath
function filenameParser(filePath) {
  let filename = path.basename(filePath).replace(/\.[^/.]+$/, "")
  let sampleId = "";

  let parts =  filePath.split("_");
  let well = parts.slice(-2, -1).shift().split("").slice(-3).join("");

  // Get sample ID from G11 cell
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const cellAddress = 'G11';
  const cell = sheet[cellAddress];

  if (cell) {
      sampleId = cell.v;
  } else {
    logger.warn({
      label: "Sample ID error",
      message: "No sample ID been found. Use filename instead.",
    });
    sampleId = filename;
  }

  return {
    filename: filename,
    sampleId: sampleId,
    well: well,
  }
}

function getInternalPeak(raw) {
  if (raw.length > 0) {
    let filteredE2 = raw.filter((r) => r.bp >= EXPECTED_INTERNAL_E2_RANGE_BP[0] && r.bp <= EXPECTED_INTERNAL_E2_RANGE_BP[1]);
    let filteredE3 = raw.filter((r) => r.bp >= EXPECTED_INTERNAL_E3_RANGE_BP[0] && r.bp <= EXPECTED_INTERNAL_E3_RANGE_BP[1]);
    let filteredE4 = raw.filter((r) => r.bp >= EXPECTED_INTERNAL_E4_RANGE_BP[0] && r.bp <= EXPECTED_INTERNAL_E4_RANGE_BP[1]);
    
    // Filter out the peaks rfu < ACT_RFU_CUTOFF
    let e2Peak = filteredE2.filter((r) => r.rfu >= ACT_RFU_CUTOFF).sort((a, b) => b.rfu - a.rfu);
    let e3Peak = filteredE3.filter((r) => r.rfu >= ACT_RFU_CUTOFF).sort((a, b) => b.rfu - a.rfu);
    let e4Peak = filteredE4.filter((r) => r.rfu >= ACT_RFU_CUTOFF).sort((a, b) => b.rfu - a.rfu);

    if (e2Peak.length == 1 && e3Peak.length == 0 && e4Peak.length == 0) {
      return {
        type: "e2",
        bp: e2Peak[0].bp,
        rfu: e2Peak[0].rfu,
      }
    } else if (e3Peak.length == 1 && e2Peak.length == 0 && e4Peak.length == 0) {
      return {
        type: "e3",
        bp: e3Peak[0].bp,
        rfu: e3Peak[0].rfu,
      }
    } else if (e4Peak.length == 1 && e2Peak.length == 0 && e3Peak.length == 0) {
      return {
        type: "e4",
        bp: e4Peak[0].bp,
        rfu: e4Peak[0].rfu,
      }
    } else if (e2Peak.length == 0 && e3Peak.length == 0 && e4Peak.length == 0) {
      logger.warn({
        label: "Internal control peak error",
        message: "No internal control peaks data been found",
      });
      return {
        type: "",
        bp: 0,
        rfu: 0,
      }
    } else if (e2Peak.length > 1 || e3Peak.length > 1 || e4Peak.length > 1) {
      logger.error({
        label: "Internal control peak error",
        message: `Multiple internal control peaks data been found: E2: ${e2Peak.length}, E3: ${e3Peak.length}, E4: ${e4Peak.length}`,
      });
      return {
        type: "",
        bp: 0,
        rfu: 0,
      }
    } else {
      logger.error({
        label: "Internal control peak error",
        message: "Cannot determine the internal control peaks data",
      });
      return {
        type: "",
        bp: 0,
        rfu: 0,
      }
    }
  } else {
    logger.warn({
      label: "Raw data error",
      message: "No peaks data been found",
    });
    return {
      type: "",
      bp: 0,
      rfu: 0,
    }
  }
}

function getTargetPeak(raw) {
  if (raw.length > 0) {
    let filtered = raw.filter((r) => r.bp >= EXPECTED_TARGET_RANGE_BP[0] && r.bp <= EXPECTED_TARGET_RANGE_BP[1]);
    let peak = filtered.sort((a, b) => b.rfu - a.rfu)[0];
    if (peak) {
      return peak;
    } else {
      logger.warn({
        label: "Target peak error",
        message: `No target peaks been found in the range of ${EXPECTED_TARGET_RANGE_BP[0]} - ${EXPECTED_TARGET_RANGE_BP[1]} bp`,
      });
      return {
        bp: 0,
        rfu: 0,
      }
    }
  } else {
    logger.warn({
      label: "Raw data error",
      message: "No peaks data been found",
    });
    return {
      bp: 0,
      rfu: 0,
    }
  }
}

function dataConvert(path) {
  let rawLst = new Array();
  
  // Convert excel result to dictionary
  const dataWorksheet = XLSX.readFile(path).Sheets.FolderReportMainPage;
  let standardRange = XLSX.utils.decode_range(dataWorksheet["!ref"]);

  // Find table position
  Object.keys(dataWorksheet).find(function (cell) {
    if (cell.includes("E")) {
      if (dataWorksheet[cell].v === "No") {
        var standardStart = parseInt(cell.replace("E", ""), 10) - 1;
        standardRange.s.r = standardStart; // Start to read excel from row
      }
    }
  });
  standardRange.s.c = 4; // Start to read excel from column 'E'
  standardRange.e.c = 21; // End to read excel from column 'U'

  // Collect data from result table
  const standardRaw = XLSX.utils.sheet_to_json(dataWorksheet, {
    range: XLSX.utils.encode_range(standardRange),
  });
  standardRaw.forEach(function (filter) {
    let rawBp = parseInt(filter.bp, 10);
    let rawRfu = parseFloat(filter.RFU);
    if (!isNaN(rawBp) && !isNaN(rawRfu)) {
      rawLst.push({
        bp: rawBp,
        rfu: rawRfu,
      });
    }
  });

  return rawLst;
}

function typeAssessment(e2Rfu, e3Rfu, e4Rfu) {
  logger.info({
    label: "RFU delta value",
    message: `
      E2 RFU: ${e2Rfu}
      E3 RFU: ${e3Rfu}
      E4 RFU: ${e4Rfu}
    `,
  });

  // Check invalid ratio
  const typeRatio = [
    parseFloat(e2Rfu).toFixed(2),
    parseFloat(e3Rfu).toFixed(2),
    parseFloat(e4Rfu).toFixed(2),
  ];
  if (typeRatio.every((val) => val === 0)) {
    logger.error({
      label: "Type error",
      message: "All type ratio are zero",
    });
    return {
      type: [],
      ratio: typeRatio
    }
  }

  // Determine the valid type
  let typeResult = typeRatio.slice().sort((a, b) => b - a).slice(0, 2);
  let typeIndex = typeResult.map((val) => typeRatio.indexOf(val));

  // Chek if the first ratio is same as the second ratio
  if (typeResult[0] === typeResult[1]) {
    typeIndex = [];
    for (let i = 0; i < typeRatio.length; i++) {
      if (typeRatio[i] === typeResult[0]) {
        typeIndex.push(i);
      }
    }
  // Check the ratio of second type
  } else if (typeIndex[1] === 0 && typeResult[1] < E2_RFU_CUTOFF) {
    typeResult = [ typeResult[0], typeResult[0] ];
    typeIndex = [ typeIndex[0], typeIndex[0] ];
  } else if (typeIndex[1] === 1 && typeResult[1] < E3_RFU_CUTOFF) {
    typeResult = [ typeResult[0], typeResult[0] ];
    typeIndex = [ typeIndex[0], typeIndex[0] ];
  } else if (typeIndex[1] === 2 && typeResult[1] < E4_RFU_CUTOFF) {
    typeResult = [ typeResult[0], typeResult[0] ];
    typeIndex = [ typeIndex[0], typeIndex[0] ];
  }
  if (typeResult.length !== 2) {
    logger.error({
      label: "Type error",
      message: "Cannot determine the type of sample: More or less than 2 type result(s)",
    });
    return {
      type: [],
      ratio: typeRatio
    }
  }

  // Mark the type
  let typeOutput = typeIndex.map((idx) => ['e2', 'e3', 'e4'][idx]);

  return {
    type: typeOutput.sort((a, b) => a.localeCompare(b)),
    ratio: typeRatio
  }
}

function qcAssessment(e2Rfu, e3Rfu, e4Rfu, scType) {
  let status =  "fail-the-criteria";
  let type = new Array();

  if (scType === 'standard1') {
    type = typeAssessment(e2Rfu, e3Rfu, e4Rfu).type;
    if (type.length === 2 && type.includes('e2') && type.includes('e3')) {
      status = "meet-the-criteria";
    }
  } else if (scType === 'standard2') {
    type = typeAssessment(e2Rfu, e3Rfu, e4Rfu).type;
    if (type.length === 2 && type.includes('e3') && type.includes('e4')) {
      status = "meet-the-criteria";
    }
  } else {
    logger.error({
      label: "Error",
      message: `Unrecognized standard type: ${scType}`
    });
  }

  return {
    type: type,
    status: status,
  };
}

function resultAssessment(typeArr) {
  if (typeArr.length !== 2) {
    logger.error({
      label: "Error",
      message: `Unrecognized sample type: ${typeArr}`
    });
    return "invalid";
  } else {
    if (
      (typeArr[0] === "e2" && typeArr[1] === "e2")
      || (typeArr[0] === "e2" && typeArr[1] === "e3")
    ) {
      return "low-risk";
    } else if (
      (typeArr[0] === "e3" && typeArr[1] === "e3")
    ) {
      return "normal-risk";
    } else if (
      (typeArr[0] === "e2" && typeArr[1] === "e4")
      || (typeArr[0] === "e3" && typeArr[1] === "e4")
      || (typeArr[0] === "e4" && typeArr[1] === "e4")
    ) {
      return "high-risk";
    }
  }
}

function jsonOutput(outputPath, output) {
  //Output result to JSON file
  fs.writeFile(
    outputPath,
    JSON.stringify(output, null, 4),
    "utf8",
    function (err) {
      if (err) {
        logger.warn({
          label: "Log recored error",
          message: `Faile to write JSON Object to ${JSON_OUTPUT}: \n${err}`,
        });
      }
      logger.info(`JSON file has been saved in ${JSON_OUTPUT}`);
    }
  );
  logger.info(`Logger are saved in ${JSON_DIR}`);
}

function mainRun(
  standard1PathList,
  standard2PathList,
  samplePathList,
  instrument,
  reagent
) {
  let qcStatus = "fail-the-criteria";

  /* Standard QC */
  let controlOutput = {
    standard1: {},
    standard2: {},
  };

  // Standard 1 raw data processing and QC
  for (let standardPath of standard1PathList) {
    const fileInfo = filenameParser(standardPath);
    const raw = dataConvert(standardPath);
    const internalPeak = getInternalPeak(raw);
    const targetPeak = getTargetPeak(raw);

    controlOutput.standard1[internalPeak.type] = {
      filename: fileInfo.filename,
      id: fileInfo.sampleId,
      well: fileInfo.well,
      internalQc: internalPeak.type === "" ? "fail-the-criteria" : "meet-the-criteria",
      internalBp: internalPeak.bp,
      internalRfu: internalPeak.rfu,
      bp: targetPeak.bp,
      rfu: targetPeak.rfu,
      raw: raw,
    };
  }
  if (
    !(controlOutput.standard1.e2)
    || !(controlOutput.standard1.e3)
    || !(controlOutput.standard1.e4)
    || (controlOutput.standard1.e2.internalQc === "fail-the-criteria")
    || (controlOutput.standard1.e3.internalQc === "fail-the-criteria")
    || (controlOutput.standard1.e4.internalQc === "fail-the-criteria")
  ) {
    logger.warn({
      label: "Fail the criteria",
      message: `SC1 fail the criteria and skip sample assessment`
    });
    controlOutput.standard1.status = "fail-the-criteria";
    controlOutput.standard1.type = [];
  } else {
    const sc1Result = qcAssessment(
      controlOutput.standard1.e2.rfu / controlOutput.standard1.e2.internalRfu,
      controlOutput.standard1.e3.rfu / controlOutput.standard1.e3.internalRfu,
      controlOutput.standard1.e4.rfu / controlOutput.standard1.e4.internalRfu,
      'standard1'
    );
    controlOutput.standard1.status = sc1Result.status;
    controlOutput.standard1.type = sc1Result.type;
  }

  // Standard 2 raw data processing and QC
  for (let standardPath of standard2PathList) {
    const fileInfo = filenameParser(standardPath);
    const raw = dataConvert(standardPath);
    const internalPeak = getInternalPeak(raw);
    const targetPeak = getTargetPeak(raw);

    controlOutput.standard2[internalPeak.type] = {
      filename: fileInfo.filename,
      id: fileInfo.sampleId,
      well: fileInfo.well,
      internalQc: internalPeak.type === "" ? "fail-the-criteria" : "meet-the-criteria",
      internalBp: internalPeak.bp,
      internalRfu: internalPeak.rfu,
      bp: targetPeak.bp,
      rfu: targetPeak.rfu,
      raw: raw,
    };
  }
  if (
    !(controlOutput.standard2.e2)
    || !(controlOutput.standard2.e3)
    || !(controlOutput.standard2.e4)
    || (controlOutput.standard2.e2.internalQc === "fail-the-criteria")
    || (controlOutput.standard2.e3.internalQc === "fail-the-criteria")
    || (controlOutput.standard2.e4.internalQc === "fail-the-criteria")
  ) {
    logger.warn({
      label: "Fail the criteria",
      message: `SC2 fail the criteria and skip sample assessment`
    });
    controlOutput.standard2.status = "fail-the-criteria";
    controlOutput.standard2.type = [];
  } else {
    const sc2Result = qcAssessment(
      controlOutput.standard2.e2.rfu / controlOutput.standard2.e2.internalRfu,
      controlOutput.standard2.e3.rfu / controlOutput.standard2.e3.internalRfu,
      controlOutput.standard2.e4.rfu / controlOutput.standard2.e4.internalRfu,
      'standard2'
    );
    controlOutput.standard2.status = sc2Result.status;
    controlOutput.standard2.type = sc2Result.type;
  }

  /* Sample Preprocessing */
  // Create result list
  const sampleIdLst = samplePathList.map((sampleObj) => Object.keys(sampleObj)[0]);
  let resultLst = sampleIdLst.map((sampleId) => {
    return {
      sampleId: String(sampleId),
      type: new Array(),
      assessment: "invalid",
    }
  });

  // Sample raw data processing
  resultLst.forEach((result, idx) => {
    for (let samplePath of samplePathList[idx][result.sampleId]) {
      const fileInfo = filenameParser(samplePath);
      const raw = dataConvert(samplePath);
      const internalPeak = getInternalPeak(raw);
      const targetPeak = getTargetPeak(raw);

      result[internalPeak.type] = {
        filename: fileInfo.filename,
        id: fileInfo.sampleId,
        well: fileInfo.well,
        internalQc: internalPeak.type === "" ? "fail-the-criteria" : "meet-the-criteria",
        internalBp: internalPeak.bp,
        internalRfu: internalPeak.rfu,
        bp: targetPeak.bp,
        rfu: targetPeak.rfu,
        raw: raw,
      }
    }

    // Check internal control peak
    if (!(resultLst[idx].e2)) {
      logger.warn({
        label: "Fail the criteria",
        message: `${resultLst[idx].sampleId} lack of E2 internal control peaks data`
      });
      if (resultLst[idx]['']) {
        resultLst[idx].e2 = resultLst[idx][''];
      } else {
        resultLst[idx].e2 = {
          filename: "",
          id: "",
          well: "",
          internalQc: "fail-the-criteria",
          internalBp: 0,
          internalRfu: 0,
          bp: 0,
          rfu: 0,
          raw: [],
        };
      }
    }
    if (!(resultLst[idx].e3)) {
      logger.warn({
        label: "Fail the criteria",
        message: `${resultLst[idx].sampleId} lack of E3 internal control peaks data`
      });
      if (resultLst[idx]['']) {
        resultLst[idx].e3 = resultLst[idx][''];
      } else {
        resultLst[idx].e3 = {
          filename: "",
          id: "",
          well: "",
          internalQc: "fail-the-criteria",
          internalBp: 0,
          internalRfu: 0,
          bp: 0,
          rfu: 0,
          raw: [],
        };
      }
    }
    if (!(resultLst[idx].e4)) {
      logger.warn({
        label: "Fail the criteria",
        message: `${resultLst[idx].sampleId} lack of E4 internal control peaks data`
      });
      if (resultLst[idx]['']) {
        resultLst[idx].e4 = resultLst[idx][''];
      } else {
        resultLst[idx].e4 = {
          filename: "",
          id: "",
          well: "",
          internalQc: "fail-the-criteria",
          internalBp: 0,
          internalRfu: 0,
          bp: 0,
          rfu: 0,
          raw: [],
        };
      }
    }
    delete resultLst[idx][''];
  });

  // Sample assessment
  if (
    (controlOutput.standard1.status === "meet-the-criteria")
    && (controlOutput.standard2.status === "meet-the-criteria") 
  ) {
    qcStatus = "meet-the-criteria";

    resultLst.forEach((result) => {
      if (
        (result.e2.internalQc === "meet-the-criteria")
         && (result.e3.internalQc === "meet-the-criteria")
         && (result.e4.internalQc === "meet-the-criteria")
      ) {
        logger.info({
          label: "Sample ID",
          message: `${result.sampleId}`,
        });
        const sampleType = typeAssessment(
          result.e2.rfu / result.e2.internalRfu,
          result.e3.rfu / result.e3.internalRfu,
          result.e4.rfu / result.e4.internalRfu,
        ).type;
        result.type = sampleType;
        result.assessment = resultAssessment(sampleType);
      } else {
        result.type = [];
        result.assessment = "invalid";
      }
    });
  } else {
    logger.warn({
      label: "Fail the criteria",
      message: `Fail the criteria and skip sample assessment`
    });
    resultLst.forEach((result) => {
      result.type = [];
      result.assessment = "inconclusive";
    });
  }

  let output = {
    config: {
      reagent: reagent,
      instrument: instrument,
      nucleus: "v3.4.3",
      logger: [ JSON_DIR, JSON_OUTPUT ]
    },
    control: controlOutput,
    qc: { status: qcStatus },
    result: resultLst,
  };

  return output;
}

// Run by called
module.exports = {
  runApoe: function (
    standard1PathList,
    standard2PathList,
    samplePathList,
    instrument,
    reagent,
  ) {
    logger.info("******* Running for APOE main process *******");
    try {
      // Check input
      if (!standard1PathList || standard1PathList.length !== 3) {
        logger.error({
          label: "Error",
          message: "Please check the standard 1 files input.",
        });
        return;
      }
      if (!standard2PathList || standard2PathList.length !== 3) {
        logger.error({
          label: "Error",
          message: "Please check the standard 2 files input.",
        });
        return;
      }
      if (!samplePathList) {
        logger.error({
          label: "Error",
          message: "Please check the sample files input.",
        });
        return;
      } else {
        const sampleIdImportError = samplePathList.reduce((acc, obj) => {
          const keys = Object.keys(obj);
          const values = Object.values(obj);
        
          keys.forEach((key, index) => {
            const arr = values[index];
            if (arr.length !== 3) {
              acc.push(key);
            }
          });
        
          return acc;
        }, []);
        if (sampleIdImportError.length > 0) {
          logger.error({
            label: "Error",
            message: `Please check the sample files input for sample ID: ${sampleIdImportError}`,
          });
          return;
        }
      }

      let output = mainRun(
        standard1PathList.map((s1) => s1.trim()),
        standard2PathList.map((s2) => s2.trim()),
        samplePathList,
        instrument ? instrument.trim() : "qsep100",
        reagent ? reagent.trim() : "accuinApoe1",
      );
      jsonOutput(JSON_OUTPUT, output);
  
      return output;
    } catch (error) {
      logger.error({
        label: "Error",
        message: `${error.message}`,
      });
    }
  },
};

// Run by node
if (require.main === module) {
  let samplePathList = new Array();
  
  // Collect sample path
  const sampleIdLst = Object.keys(argv).filter((key) => key !== "_" && key !== "i" && key !== "r" && key !== "a" && key !== "b");
  sampleIdLst.forEach((sampleId) => {
    samplePathList.push({
      [sampleId]: Array.isArray(argv[sampleId])
        ? argv[sampleId].map((s) => s.trim())
        : [argv[sampleId].trim()],
    });
  });
  
  module.exports.runApoe(
    argv.a,
    argv.b,
    samplePathList,
    argv.i,
    argv.r,
  );
}
