/**
 * Analysis core for MTHFR. (qPCR)
 *
 * Run directly by node:
 *   node core/mthfr-core.js \
 *   -f [qs3_result.xlsx] \
 *   -c [control_well] \
 *   -n [ntc_well] \
 *   -i [qs3 tower z480] \
 *   -r [accuinMTHFR1 accuinMTHFR2 accuinMTHFR3]
 *   --fam [mthfr_465-510.txt]
 *   --vic [mthfr_540-580.txt]
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qs3", // 'QS3' and 'qTOWER' and 'Roche z480' avaliable now
    r: "accuinMTHFR1", // support 'Accuin MTHFR kit version 1, 2, 3' now
  },
});

const FAM_RANGE_z480 = '465-510 (465-510)';
const FAM_RANGE_z480ii = 'FAM (465-510)';
const VIC_RANGE_z480 = '540-580 (540-580)';
const VIC_RANGE_z480ii = 'VIC / HEX / Yellow555 (533-580)';
const DELTA_CT_THRESHOLD_V3 = 4;

var CT_THRESHOLD;

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment(new Date()).format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "MTHFR_" + moment(new Date()).format("YYYYMMDD_HHmmss") + ".json"
);
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  // If it doesn't exist, create it
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

function filenameParser(id) {
  return id.replace(/[/\\?%*:|"<>.]/g, "-"); // convert illegal characters from filename
}

function rawReadQ(rawPath) {
  let runID = path.basename(rawPath).replace(/\.[^/.]+$/, "");
  runID = filenameParser(runID);

  logger.info(`Run ID: ${runID}`);
  let resultSheet = XLSX.readFile(rawPath).Sheets.Results;
  let resultRange = XLSX.utils.decode_range(resultSheet["!ref"]);

  // Find result table position
  Object.keys(resultSheet).find(function (cell) {
    if (cell.includes("A")) {
      if (resultSheet[cell].v === "Well") {
        resultRange.s.r = parseInt(cell.replace("A", ""), 10) - 1; // Start to read excel from row
      } else if (resultSheet[cell].v === "Analysis Type") {
        resultRange.e.r = parseInt(cell.replace("A", ""), 10) - 3; // End to read excel from row
      }
    }
  });
  resultRange.s.c = 0; // Start to read excel from column 'A'
  let raw = XLSX.utils.sheet_to_json(resultSheet, {
    range: XLSX.utils.encode_range(resultRange),
  });
  raw = raw.map(
    ({
      "Well Position": Position,
      "Sample Name": Name,
      "Target Name": Target,
      ...rest
    }) => ({
      Position,
      Name,
      Target,
      ...rest,
    })
  );

  return {
    raw,
    runID,
  };
}

function rawReadT(rawPath) {
  // Must include "Well", "Sample name", "Dye", "Ct" columns
  let runID = path.basename(rawPath).replace(/\.[^/.]+$/, "");
  runID = filenameParser(runID);

  logger.info(`Run ID (Tower): ${runID}`);

  let raw = new Array();
  let col;
  let isHeader = true;
  let rows = fs.readFileSync(rawPath).toLocaleString().split("\r\n");
  rows.forEach((r) => {
    let row = r.split(",");
    if (isHeader && row[0] === "Well") {
      col = row;
      isHeader = false;
    } else if (!isHeader && row[0] !== "") {
      let record = Object.fromEntries(col.map((k) => [k, undefined]));
      row.map((d, idx) => {
        record[col[idx]] = d;
      });
      delete record[""];
      raw.push(record);
    }
  });
  raw = raw.map(
    ({
      Well: Position,
      "Sample name": Name,
      Dye: Reporter,
      Ct: CT,
      ...rest
    }) => ({
      Position,
      Name,
      CT,
      Reporter,
      ...rest,
    })
  );

  return {
    raw,
    runID,
  };
}

function rawReadZ(famPath, vicPath) {
  let famData = new Array();
  let vicData = new Array();
  let raw = new Array();

  // Parse FAM file
  const famContent = fs.readFileSync(famPath, 'utf-8');
  const lines = famContent.split("\n");
  const headerFam = lines[0].split("\t")[0];
  const famDye = headerFam.split("Selected Filter: ")[1].trim();
  const famRawData = lines.slice(2, lines.length - 1);
  for (const line of famRawData) {
    if (line.trim() === '') continue; // Skip empty lines
    const [include, color, pos, name, cp, concentration, standard, status] = line.split('\t');
    if (famDye !== FAM_RANGE_z480 && famDye !== FAM_RANGE_z480ii) {
      logger.error(`FAM dye: ${famDye} not match with the expected range: ${FAM_RANGE_z480} or ${FAM_RANGE_z480ii}`)
      famData.push({
        Position: pos,
        Name: name,
        CT: 0,
        Reporter: 'FAM',
      });
    } else {
      famData.push({
        Position: pos,
        Name: name,
        CT: cp,
        Reporter: 'FAM',
      });
    }
  }

  // Get run ID
  const runID = headerFam.split("Experiment: ").at(1).split(" ").at(0);
  logger.info(`Run ID: ${runID}`);

  // Parse VIC file
  const vicContent = fs.readFileSync(vicPath, 'utf-8');
  const headerVic = vicContent.split("\n")[0].split("\t")[0];
  const vicDye = headerVic.split("Selected Filter: ")[1].trim();
  const vicRawData = vicContent.split("\n").slice(2, vicContent.split("\n").length - 1);
  for (const line of vicRawData) {
    if (line.trim() === '') continue; // Skip empty lines
    const [include, color, pos, name, cp, concentration, standard, status] = line.split('\t');
    if (vicDye !== VIC_RANGE_z480 && vicDye !== VIC_RANGE_z480ii) {
      logger.error(`VIC dye: ${vicDye} not match with the expected range: ${VIC_RANGE_z480} or ${VIC_RANGE_z480ii}`)
      vicData.push({
        Position: pos,
        Name: name,
        CT: 0,
        Reporter: 'VIC',
      });
    } else {
      vicData.push({
        Position: pos,
        Name: name,
        CT: cp,
        Reporter: 'VIC',
      });
    }
  }

  // Merge FAM and VIC data
  raw = famData.concat(vicData);

  return {
    raw,
    runID,
  };
}

// Result preprocess for c.677 (reagent v1)
function resultPreprocess1(raw, ctrlWell, ntcWell) {
  let result = {
    control: {
      mthfr: {
        name: undefined,
        well: ctrlWell,
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
      ntc: {
        name: undefined,
        well: ntcWell,
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct =
      row.CT === "Undetermined" || row.CT === "No Ct"
        ? 0
        : row.CT > CT_THRESHOLD
          ? 0
          : Number(row.CT);

    if (result[type][key] === undefined) {
      result[type][key] = {
        name: filenameParser(String(row.Name)),
        well: String(row.Position),
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill control and ntc sample name
    }
    if (row.Reporter === "FAM") {
      result[type][key].c677.mut = ct;
    } else if (row.Reporter === "VIC") {
      result[type][key].c677.wt = ct;
    }
  }

  raw.forEach((r) => {
    if (String(r.Position) === ctrlWell) {
      dataGrouping(r, "control", "mthfr");
    } else if (String(r.Position) === ntcWell) {
      dataGrouping(r, "control", "ntc");
    } else {
      dataGrouping(r, "sample", r.Position);
    }
  });

  return result;
}

// Result preprocess for c.677 and c.1298 (reagent v2)
function resultPreprocess2(raw, ctrlWell, ntcWell) {
  let result = {
    control: {
      mthfr: {
        name: undefined,
        well: ctrlWell,
        c1298: {
          wt: undefined, // tamra
          mut: undefined, // rox
        },
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
      ntc: {
        name: undefined,
        well: ntcWell,
        c1298: {
          wt: undefined, // tamra
          mut: undefined, // rox
        },
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct =
      row.CT === "Undetermined" || row.CT === "No Ct"
        ? 0
        : row.CT > CT_THRESHOLD
          ? 0
          : Number(row.CT);

    if (result[type][key] === undefined) {
      result[type][key] = {
        name: filenameParser(String(row.Name)),
        well: String(row.Position),
        c1298: {
          wt: undefined, // tamra
          mut: undefined, // rox
        },
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill control and ntc sample name
    }
    if (row.Reporter === "FAM") {
      result[type][key].c677.mut = ct;
    } else if (row.Reporter === "VIC") {
      result[type][key].c677.wt = ct;
    } else if (row.Reporter === "ROX") {
      result[type][key].c1298.mut = ct;
    } else if (row.Reporter === "TAMRA") {
      result[type][key].c1298.wt = ct;
    }
  }

  raw.forEach((r) => {
    if (String(r.Position) === ctrlWell) {
      dataGrouping(r, "control", "mthfr");
    } else if (String(r.Position) === ntcWell) {
      dataGrouping(r, "control", "ntc");
    } else {
      dataGrouping(r, "sample", r.Position);
    }
  });

  return result;
}

// Result preprocess for c.677 with z480 data (reagent v3)
function resultPreprocess3(raw, ctrlWell, ntcWell) {
  let result = {
    control: {
      mthfr: {
        name: undefined,
        well: ctrlWell,
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
      ntc: {
        name: undefined,
        well: ntcWell,
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct = row.CT
      ? Number(row.CT)
      : 0;

    if (result[type][key] === undefined) {
      result[type][key] = {
        name: filenameParser(String(row.Name)),
        well: String(row.Position),
        c677: {
          wt: undefined, // vic
          mut: undefined, // fam
        }
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill control and ntc sample name
    }
    if (row.Reporter === "FAM") {
      result[type][key].c677.mut = ct;
    } else if (row.Reporter === "VIC") {
      result[type][key].c677.wt = ct;
    }
  }

  raw.forEach((r) => {
    if (String(r.Position) === ctrlWell) {
      dataGrouping(r, "control", "mthfr");
    } else if (String(r.Position) === ntcWell) {
      dataGrouping(r, "control", "ntc");
    } else {
      dataGrouping(r, "sample", r.Position);
    }
  });

  return result;
}

// QC assessment for c.677 (reagent v1)
function qcAssessment1(result) {
  let qc = {
    runId: undefined,
    status: "meet-the-criteria",
  };

  // Check control value
  ["wt", "mut"].forEach((target) => {
    if (result.control.mthfr.c677[target] == 0) {
      logger.warn(`Fail the criteria: Control ${target} has no data`);
      qc.status = "fail-the-criteria";
    } else if (typeof result.control.mthfr.c677[target] !== "number") {
      logger.warn(
        `Fail the criteria: Control ${target} Ct value is not a number`
      );
      qc.status = "fail-the-criteria";
    } else if (result.control.ntc.c677[target] !== 0) {
      logger.warn(`Fail the criteria: NTC ${target} Ct value is not 0`);
      qc.status = "fail-the-criteria";
    }
  });

  return {
    qc: qc,
    control: result.control,
  };
}

// QC assessment for c.677 and c.1298 (reagent v2)
function qcAssessment2(result) {
  let qc = {
    runId: undefined,
    status: "meet-the-criteria",
  };

  // Check control value
  ["c677", "c1298"].forEach((target) => {
    if (result.control.mthfr[target].wt == 0) {
      logger.warn(`Fail the criteria: Control ${target} WT has no data`);
      qc.status = "fail-the-criteria";
    } else if (result.control.mthfr[target].mut == 0) {
      logger.warn(`Fail the criteria: Control ${target} MUT has no data`);
      qc.status = "fail-the-criteria";
    } else if (typeof result.control.mthfr[target].wt !== "number") {
      logger.warn(
        `Fail the criteria: Control ${target} WT Ct value is not a number`
      );
      qc.status = "fail-the-criteria";
    } else if (typeof result.control.mthfr[target].mut !== "number") {
      logger.warn(
        `Fail the criteria: Control ${target} MUT Ct value is not a number`
      );
      qc.status = "fail-the-criteria";
    } else if (result.control.ntc[target].wt !== 0) {
      logger.warn(`Fail the criteria: NTC ${target} WT Ct value is not 0`);
      qc.status = "fail-the-criteria";
    } else if (result.control.ntc[target].mut !== 0) {
      logger.warn(`Fail the criteria: NTC ${target} MUT Ct value is not 0`);
      qc.status = "fail-the-criteria";
    }
  });

  return {
    qc: qc,
    control: result.control,
  };
}

// QC assessment for c.677 with z480 data (reagent v3)
function qcAssessment3(result) {
  let qc = {
    runId: undefined,
    status: "meet-the-criteria",
  };

  // Check control value
  ["wt", "mut"].forEach((target) => {
    if (result.control.mthfr.c677[target] == 0) {
      logger.warn(`Fail the criteria: Control ${target} has no data`);
      qc.status = "fail-the-criteria";
    } else if (typeof result.control.mthfr.c677[target] !== "number") {
      logger.warn(
        `Fail the criteria: Control ${target} Ct value is not a number`
      );
      qc.status = "fail-the-criteria";
    } else if (result.control.ntc.c677[target] !== 0) {
      logger.warn(`Fail the criteria: NTC ${target} Ct value is not 0`);
      qc.status = "fail-the-criteria";
    }
  });

  // Check control type
  let ctLst = [ result.control.mthfr.c677.mut, result.control.mthfr.c677.wt ].sort((a, b) => b - a);
  if (ctLst[0] - ctLst[1] > DELTA_CT_THRESHOLD_V3) {
    logger.warn(`Fail the criteria: Control Ct value delta is larger than ${DELTA_CT_THRESHOLD_V3}`);
    qc.status = "fail-the-criteria";
  }

  return {
    qc: qc,
    control: result.control,
  };
}

// Analysis c.677 (reagent v1)
function resultlAnalysis1(sample, qc) {
  let sampleLst = Object.keys(sample);
  let sampleOutput = new Array();
  logger.info(`Samples: ${sampleLst}`);

  // Calculate sample delta Ct value
  for (let w in sample) {
    sample[w].assessment = "inconclusive";
    sample[w].type = new Array();
    if (qc.status === "fail-the-criteria") {
      sample[w].assessment = "inconclusive";
      logger.warn(`Sample assessment unsuccessful: Fail the criteria`);
    } else if (qc.status === "meet-the-criteria") {

      // Define c677 sample type
      if (
        (typeof sample[w].c677.mut !== "undefined") &&
        (typeof sample[w].c677.wt !== "undefined") &&
        !(sample[w].c677.mut === 0 && sample[w].c677.wt === 0)
      ) {
        sample[w].type = [
          sample[w].c677.mut === 0 ? "c" : "t",
          sample[w].c677.wt === 0 ? "t" : "c",
        ];
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: ${w} sample is missing data for assessment.`
        );
      }

      // Analysis sample type
      if (
        sample[w].type.includes("t") &&
        sample[w].type.includes("c")
      ) {
        sample[w].type = [ "c", "t" ]; // Fix MTHFR result type as "C/T"
        sample[w].assessment = "normal-risk";
      } else if (sample[w].type.includes("c")) {
        sample[w].assessment = "low-risk";
      } else if (sample[w].type.includes("t")) {
        sample[w].assessment = "high-risk";
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: Cannot recofnize ${w} sample MTHFR type`
        );
      }
    }

    sampleOutput.push(sample[w]);
  }

  return sampleOutput;
}

// Analysis c.677 and c.1298 (reagent v2)
function resultlAnalysis2(sample, qc) {
  let sampleLst = Object.keys(sample);
  let sampleOutput = new Array();
  logger.info(`Samples: ${sampleLst}`);

  // Calculate sample delta Ct value
  for (let w in sample) {
    sample[w].assessment = "inconclusive";
    sample[w].type = new Array();
    if (qc.status === "fail-the-criteria") {
      sample[w].assessment = "inconclusive";
      logger.warn(`Sample assessment unsuccessful: Fail the criteria`);
    } else if (qc.status === "meet-the-criteria") {

      // Define c677 & c1298 sample type
      if (
        (typeof sample[w].c677.mut !== "undefined") &&
        (typeof sample[w].c677.wt !== "undefined") &&
        (typeof sample[w].c1298.mut !== "undefined") &&
        (typeof sample[w].c1298.wt !== "undefined") &&
        !(sample[w].c677.mut === 0 && sample[w].c677.wt === 0) &&
        !(sample[w].c1298.mut === 0 && sample[w].c1298.wt === 0)
      ) {
        sample[w].type = [
          sample[w].c677.mut === 0 ? "c" : "t",
          sample[w].c677.wt === 0 ? "t" : "c",
          sample[w].c1298.mut === 0 ? "a" : "c",
          sample[w].c1298.wt === 0 ? "c" : "a",
        ];
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: some ${w} sample data are missing for assessment.`
        );
      }

      // Analysis sample type
      var c677Type = sample[w].type.slice(0, 2).join('');
      var c1298ype = sample[w].type.slice(2, 4).join('');
      if (c677Type === 'ct' || c677Type === 'tc') {
        sample[w].type[0] = "c"; // Fix MTHFR result type as "C/T"
        sample[w].type[1] = "t";
      }
      if (c1298ype === 'ac' || c1298ype === 'ca') {
        sample[w].type[2] = "a"; // Fix MTHFR result type as "A/C"
        sample[w].type[3] = "c";
      }

      if (
        (c677Type === 'cc' && c1298ype === 'aa')
      ) {
        sample[w].assessment = "low-risk";
      } else if (
        (c677Type === 'cc' && c1298ype === 'ac') ||
        (c677Type === 'cc' && c1298ype === 'ca') ||
        (c677Type === 'cc' && c1298ype === 'cc') ||
        (c677Type === 'ct' && c1298ype === 'aa') ||
        (c677Type === 'tc' && c1298ype === 'aa')
      ) {
        sample[w].assessment = "normal-risk";
      } else if (
        (c677Type === 'ct' && c1298ype === 'ac') ||
        (c677Type === 'ct' && c1298ype === 'ca') ||
        (c677Type === 'tc' && c1298ype === 'ac') ||
        (c677Type === 'tc' && c1298ype === 'ca') ||
        (c677Type === 'ct' && c1298ype === 'cc') ||
        (c677Type === 'tc' && c1298ype === 'cc') ||
        (c677Type === 'tt' && c1298ype === 'aa') ||
        (c677Type === 'tt' && c1298ype === 'ac') ||
        (c677Type === 'tt' && c1298ype === 'ca') ||
        (c677Type === 'tt' && c1298ype === 'cc')
      ) {
        sample[w].assessment = "high-risk";
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: Cannot recofnize ${w} sample MTHFR type`
        );
      }
    }

    sampleOutput.push(sample[w]);
  }

  return sampleOutput;
}

// Analysis c.677 with z480 data (reagent v3)
function resultlAnalysis3(sample, qc) {
  let sampleLst = Object.keys(sample);
  let sampleOutput = new Array();
  logger.info(`Samples: ${sampleLst}`);

  // Calculate sample delta Ct value
  for (let w in sample) {
    sample[w].assessment = "inconclusive";
    sample[w].type = new Array();
    if (qc.status === "fail-the-criteria") {
      sample[w].assessment = "inconclusive";
      logger.warn(`Sample assessment unsuccessful: Fail the criteria`);
    } else if (qc.status === "meet-the-criteria") {

      // Define c677 sample type
      if (
        (typeof sample[w].c677.mut !== "undefined") &&
        (typeof sample[w].c677.wt !== "undefined") &&
        !(sample[w].c677.mut === 0 && sample[w].c677.wt === 0)
      ) {
        if (sample[w].c677.mut !== 0 && sample[w].c677.wt !== 0) {
          let ctLst = [ sample[w].c677.mut, sample[w].c677.wt ].sort((a, b) => b - a);
          if (ctLst[0] - ctLst[1] <= DELTA_CT_THRESHOLD_V3) {
            sample[w].type = [ "t", "c" ];
          } else {
            let ctSmall = ctLst[1];
            sample[w].type = [
              ctSmall === sample[w].c677.mut ? "t" : "c",
              ctSmall === sample[w].c677.wt ? "c" : "t",
            ];
          }
        } else {
          sample[w].type = [
            sample[w].c677.mut === 0 ? "c" : "t",
            sample[w].c677.wt === 0 ? "t" : "c",
          ];
        }
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: ${w} sample is missing data for assessment.`
        );
      }

      // Analysis sample type
      if (
        sample[w].type.includes("t") &&
        sample[w].type.includes("c")
      ) {
        sample[w].type = [ "c", "t" ]; // Fix MTHFR result type as "C/T"
        sample[w].assessment = "normal-risk";
      } else if (sample[w].type.includes("c")) {
        sample[w].assessment = "low-risk";
      } else if (sample[w].type.includes("t")) {
        sample[w].assessment = "high-risk";
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: Cannot recofnize ${w} sample MTHFR type`
        );
      }
    }

    sampleOutput.push(sample[w]);
  }

  return sampleOutput;
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

function mainRun(rawPath, ctrlWell, ntcWell, instrument, reagent, famPath, vicPath) {

  /* Analysis */
  let raw;
  let result;
  let sample;
  let qc;
  let control;

  if (instrument === "tower") {
    CT_THRESHOLD = 38;

    raw = rawReadT(rawPath);
  } else if (instrument === "qs3") {
    CT_THRESHOLD = 35;

    raw = rawReadQ(rawPath);
  } else if (instrument === "z480") {
    raw = rawReadZ(famPath, vicPath);
  }

  if (reagent === 'accuinMTHFR1') {
    result = resultPreprocess1(raw.raw, ctrlWell, ntcWell);
    let qcData = qcAssessment1(result);
    qcData.qc.runId = raw.runID;
    qc = qcData.qc;
    control = qcData.control;
    sample = resultlAnalysis1(result.sample, qc);
  } else if (reagent === 'accuinMTHFR2') {
    result = resultPreprocess2(raw.raw, ctrlWell, ntcWell);
    let qcData = qcAssessment2(result);
    qcData.qc.runId = raw.runID;
    qc = qcData.qc;
    control = qcData.control;
    sample = resultlAnalysis2(result.sample, qc);
  } else if (reagent === 'accuinMTHFR3') {
    result = resultPreprocess3(raw.raw, ctrlWell, ntcWell);
    let qcData = qcAssessment3(result);
    qcData.qc.runId = raw.runID;
    qc = qcData.qc;
    control = qcData.control;
    sample = resultlAnalysis3(result.sample, qc);
  }

  let output = {
    config: {
      reagent: reagent,
      instrument: instrument,
      nucleus: "v3.4.3",
      logger: [JSON_DIR, JSON_OUTPUT],
    },
    control,
    qc,
    sample,
  };
  logger.info(JSON.stringify(output, null, 4));
  return output;
}

// Run by called
module.exports = {
  runMthfr: function (
    rawPath,
    ctrlWell,
    ntcWell,
    instrument,
    reagent,
    famPath,
    vicPath
  ) {
    let output;

    logger.info("******* Running for MTHFR main process *******");

    /* Check input */
    if (typeof rawPath !== "string" && typeof famPath !== "string" && typeof vicPath !== "string") {
      logger.error(`Input file path need to be a string.`);
      return;
    } else if (typeof rawPath === "undefined" && typeof famPath === "undefined" && typeof vicPath === "undefined") {
      logger.error(`No Input file.`);
      return;
    } else if (typeof ctrlWell === "undefined") {
      logger.error(`No well position for Control been assigned.`);
      return;
    } else if (typeof ctrlWell !== "string") {
      logger.error(`Control well position need to be correct format. (e.g., A1)`);
      return;
    } else if (typeof ntcWell === "undefined") {
      logger.error(`No well position for NTC been assigned.`);
      return;
    } else if (typeof ntcWell !== "string") {
      logger.error(`NTC well position need to be correct format. (e.g., A1)`);
      return;
    }

    if (
      (reagent === "accuinMTHFR3" || instrument === "z480")
      && (!famPath || !vicPath)
    ) {
      logger.error(
        `Please provide the path of the FAM and VIC files for MTHFR reagent v3.`
      );
      return;
    } else if (
      (reagent === "accuinMTHFR3" || instrument === "z480")
      && (famPath || vicPath)
    ) {
      output = mainRun(
        "",
        ctrlWell.trim(),
        ntcWell.trim(),
        "z480",
        "accuinMTHFR3",
        famPath.trim(),
        vicPath.trim(),
      );
      jsonOutput(JSON_OUTPUT, output);
      return output;
    } else {
      output = mainRun(
        rawPath.trim(),
        ctrlWell.trim(),
        ntcWell.trim(),
        instrument ? instrument.trim() : "qs3",
        reagent ? reagent.trim() : "accuinMTHFR1",
      );
      jsonOutput(JSON_OUTPUT, output);
      return output;
    }
  },
};

// Run by node
if (require.main === module) {
  module.exports.runMthfr(
    argv.f,
    argv.c,
    argv.n,
    argv.i,
    argv.r,
    argv.fam,
    argv.vic
  );
}
