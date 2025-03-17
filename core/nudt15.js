/**
 * Analysis core for NUDT15. (qPCR)
 *
 * Run directly by node:
 *   node core/nudt15-core.js \
 *   -f [qs3_result.xlsx] \
 *   -c [control_well] \
 *   -n [ntc_well] \
 *   -i [qs3 z480] \
 *   -r [accuinNUDT151 accuinNUDT152] \
 *   --fam [nudt15_465-510.txt]
 *   --vic [nudt15_540-580.txt]
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qs3", // 'QS3' and 'Roche z480' avaliable now
    r: "accuinNUDT151", // support 'Accuin NUDT15 kit version 1' now
  },
});

const FAM_RANGE = '465-510 (465-510)';    // MUT
const VIC_RANGE = '540-580 (540-580)';    // WT
const DELTA_CT_THRESHOLD = 4;

var CT_THRESHOLD;

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment(new Date()).format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "NUDT15_" + moment(new Date()).format("YYYYMMDD_HHmmss") + ".json"
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

function rawReadZ(famPath, vicPath) {
  let famData = new Array();
  let vicData = new Array();
  let raw = new Array();

  // Parse FAM file
  const famContent = fs.readFileSync(famPath, 'utf-8');
  const lines = famContent.split("\n");
  const headerFam = lines[0].split("\t")[0];
  const famDye = headerFam.split("Selected Filter: ").at(1);
  const famRawData = lines.slice(2, lines.length - 1);
  for (const line of famRawData) {
    if (line.trim() === '') continue; // Skip empty lines
    const [include, color, pos, name, cp, concentration, standard, status] = line.split('\t');
    if (famDye === FAM_RANGE) {
      logger.error(`FAM dye: ${famDye} not match with the expected range: ${FAM_RANGE}`)
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
  const vicDye = headerVic.split("Selected Filter: ").at(1);
  const vicRawData = vicContent.split("\n").slice(2, vicContent.split("\n").length - 1);
  for (const line of vicRawData) {
    if (line.trim() === '') continue; // Skip empty lines
    const [include, color, pos, name, cp, concentration, standard, status] = line.split('\t');
    if (vicDye === VIC_RANGE) {
      logger.error(`VIC dye: ${vicDye} not match with the expected range: ${VIC_RANGE}`)
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

// Result preprocess
function resultPreprocess(raw, ctrlWell, ntcWell) {
  let result = {
    control: {
      nudt15: {
        name: undefined,
        well: ctrlWell,
        wt: undefined, // vic
        mut: undefined, // fam
      },
      ntc: {
        name: undefined,
        well: ntcWell,
        wt: undefined, // vic
        mut: undefined, // fam
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
        wt: undefined, // vic
        mut: undefined, // fam
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill control and ntc sample name
    }
    if (row.Reporter === "FAM") {
      result[type][key].mut = ct;
    } else if (row.Reporter === "VIC") {
      result[type][key].wt = ct;
    }
  }

  raw.forEach((r) => {
    if (String(r.Position) === ctrlWell) {
      dataGrouping(r, "control", "nudt15");
    } else if (String(r.Position) === ntcWell) {
      dataGrouping(r, "control", "ntc");
    } else {
      dataGrouping(r, "sample", r.Position);
    }
  });

  return result;
}

// QC assessment
function qcAssessment(result) {
  let qc = {
    runId: undefined,
    status: "meet-the-criteria",
  };

  // Check control value
  ["wt", "mut"].forEach((target) => {
    if (result.control.nudt15[target] == 0) {
      logger.warn(`Fail the criteria: Control ${target} has no data`);
      qc.status = "fail-the-criteria";
    } else if (typeof result.control.nudt15[target] !== "number") {
      logger.warn(
        `Fail the criteria: Control ${target} Ct value is not a number`
      );
      qc.status = "fail-the-criteria";
    } else if (result.control.ntc[target] !== 0) {
      logger.warn(`Fail the criteria: NTC ${target} Ct value is not 0`);
      qc.status = "fail-the-criteria";
    }
  });

  return {
    qc: qc,
    control: result.control,
  };
}

// Analysis
function resultlAnalysis(sample, qc) {
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

      // Define sample type
      if (
        (typeof sample[w].mut !== "undefined") &&
        (typeof sample[w].wt !== "undefined") &&
        !(sample[w].mut === 0 && sample[w].wt === 0)
      ) {
        if (sample[w].mut !== 0 && sample[w].wt !== 0) {
          let ctLst = [sample[w].mut, sample[w].wt].sort((a, b) => b - a);
          if (ctLst[0] - ctLst[1] <= DELTA_CT_THRESHOLD) {
            sample[w].type = ["c", "t"];
          } else if (sample[w].mut < sample[w].wt) {
            sample[w].type = ["t", "t"];
          } else if (sample[w].wt < sample[w].mut) {
            sample[w].type = ["c", "c"];
          }
        } else {
          sample[w].type = [
            sample[w].mut === 0 ? "c" : "t",
            sample[w].wt === 0 ? "t" : "c",
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
        sample[w].type = [ "c", "t" ]; // Fix NUDT15 result type as "C/T"
        sample[w].assessment = "high-risk";
      } else if (sample[w].type.includes("c")) {
        sample[w].assessment = "low-risk";
      } else if (sample[w].type.includes("t")) {
        sample[w].assessment = "high-risk";
      } else {
        sample[w].type = new Array();
        sample[w].assessment = "invalid";
        logger.warn(
          `Sample assessment unsuccessful: Cannot recofnize ${w} sample NUDT15 type`
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
  if (instrument === "qs3") {
    CT_THRESHOLD = 35;
    raw = rawReadQ(rawPath);
  } else if (instrument === "z480") {
    raw = rawReadZ(famPath, vicPath);
  }

  let result = resultPreprocess(raw.raw, ctrlWell, ntcWell);
  let qcData = qcAssessment(result);
  qcData.qc.runId = raw.runID;
  let qc = qcData.qc;
  let control = qcData.control;
  let sample = resultlAnalysis(result.sample, qc);

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
  runNudt15: function (
    rawPath,
    ctrlWell,
    ntcWell,
    instrument,
    reagent,
    famPath,
    vicPath
  ) {
    let output;

    logger.info("******* Running for NUDT15 main process *******");

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
      (instrument === "z480") && (!famPath || !vicPath)
    ) {
      logger.error(
        `Please provide the path of the FAM and VIC files for NUDT15 reagent v1.`
      );
      return;
    } else if (
      (instrument === "z480") && (famPath || vicPath)
    ) {
      output = mainRun(
        "",
        ctrlWell.trim(),
        ntcWell.trim(),
        "z480",
        "accuinNUDT152",
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
        reagent ? reagent.trim() : "accuinNUDT151",
      );
      jsonOutput(JSON_OUTPUT, output);
      return output;
    }
  },
};

// Run by node
if (require.main === module) {
  module.exports.runNudt15(
    argv.f,
    argv.c,
    argv.n,
    argv.i,
    argv.r,
    argv.fam,
    argv.vic
  );
}
