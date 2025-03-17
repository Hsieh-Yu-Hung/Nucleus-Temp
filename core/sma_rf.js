/**
 * Analysis core for SMA by random forest model.
 *
 * Run directly by node:
 *   node core/sma_rf.js \
 *   [-f qs3_result.xlsx] \
 *   [-n ntc_well] \
 *   [-a ctrl1_well] \
 *   [-b ctrl2_well] \
 *   [-c ctrl3_well] \
 *   [-i qs3 tower] \
 *   [-r accuinSma1] \
 *   [-p dist/predict/predict] \
 *   [-o dist/models/model1.joblib] \
 *   [-t dist/models/model2.joblib]
 *
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const { execFile } = require('child_process');
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qs3", // Only 'QS3' avaliable now
    r: "accuinSma1", // Only support 'Accuin SMA kit version 1' now
  },
});

/* Define Setting */
// const CT_UNDETERMINED_THRESHOLD = 35; // Ct value is defined in undetermined
// const STD_CRITERIA_SMN1_2n1n = [0.73, 1.38]; // average of passed delta Ct of 2n-1n (1.06 +- 1.5*0.22)
// const STD_CRITERIA_SMN1_3n2n = [0.76, 1.51]; // average of passed delta Ct of 2n-1n (1.14 +- 1.5*0.25)
// const STD_CRITERIA_SMN2_2n1n = [0.65, 1.24]; // average of passed delta Ct of 3n-2n (0.95 +- 2.0*0.15)
// const STD_CRITERIA_SMN2_3n2n = [0.69, 1.55]; // average of passed delta Ct of 3n-2n (1.12 +- 2.0*0.22)

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment(new Date()).format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "SMA_RF_" + moment(new Date()).format("YYYYMMDD_HHmmss") + ".json"
);
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  // If it doesn't exist, create it
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

async function runPredict(sampleObj, model, predict) {
  const inputData = JSON.stringify([[
    sampleObj.smn1_std1smn1,
    sampleObj.rnp_std1rnp,
    sampleObj.smn1_std2smn1,
    sampleObj.rnp_std2rnp,
    sampleObj.smn1_std3smn1,
    sampleObj.rnp_std3rnp,
  ]])

  return new Promise((resolve, reject) => {
    execFile(predict, [model, inputData], (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    })
  });
}

function filenameParser(id) {
  return id.replace(/[/\\?%*:|"<>.]/g, "-"); // convert illegal characters from filename
}

function rawReadQ(rawPath) {
  // Must include "Well Position", "Sample Name", "Reporter", "Ct" columns
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
    ({ "Well Position": Position, "Sample Name": Name, ...rest }) => ({
      Position,
      Name,
      ...rest,
    })
  );

  return {
    raw,
    runID,
  };
}

function resultPreprocess(raw, ntcWell, ctrl1Well, ctrl2Well, ctrl3Well) {
  let result = {
    control: {
      ntc: {
        name: "NTC", // If user did not define sample name, result would show 'NTC'
        well: ntcWell,
        smn1: undefined, // fam
        smn2: undefined, // qs3: vic (tower: joe)
        rnp: undefined, // tamra
      },
      ctrl1: {
        // SMN1 copy 1
        name: "Standard 1", // If user did not define sample name, result would show 'Standard 1'
        well: ctrl1Well,
        smn1: undefined, // fam
        smn2: undefined, // qs3: vic (tower: joe)
        rnp: undefined, // tamra
      },
      ctrl2: {
        // SMN1 copy 2
        name: "Standard 2", // If user did not define sample name, result would show 'Standard 2'
        well: ctrl2Well,
        smn1: undefined, // fam
        smn2: undefined, // qs3: vic (tower: joe)
        rnp: undefined, // tamra
      },
      ctrl3: {
        // SMN1 copy 3
        name: "Standard 3", // If user did not define sample name, result would show 'Standard 2'
        well: ctrl3Well,
        smn1: undefined, // fam
        smn2: undefined, // qs3: vic (tower: joe)
        rnp: undefined, // tamra
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct = (function () {
      let ct = Number(row.CT);
      if (
        ct === "Undetermined" || // qs3 undetermined ct
        // ct >= CT_UNDETERMINED_THRESHOLD ||
        isNaN(ct)
      ) {
        return (ct = 0);
      } else {
        return parseFloat(ct);
      }
    })();

    if (result[type][key] === undefined) {
      result[type][key] = {
        name: filenameParser(String(row.Name)),
        well: String(row.Position),
        smn1: undefined, // fam
        smn2: undefined, // qs3: vic (tower: joe)
        rnp: undefined, // TAMRA
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill the control sample name
    }
    if (row.Reporter === "TAMRA") {
      result[type][key].rnp = ct;
    } else if (row.Reporter === "VIC" || row.Reporter === "JOE") {
      result[type][key].smn2 = ct;
    } else if (row.Reporter === "FAM") {
      result[type][key].smn1 = ct;
    }
  }

  raw.forEach((r) => {
    if (String(r.Position) === ntcWell) {
      dataGrouping(r, "control", "ntc");
    } else if (String(r.Position) === ctrl1Well) {
      dataGrouping(r, "control", "ctrl1");
    } else if (String(r.Position) === ctrl2Well) {
      dataGrouping(r, "control", "ctrl2");
    } else if (String(r.Position) === ctrl3Well) {
      dataGrouping(r, "control", "ctrl3");
    } else {
      if (
        r.Name && // Filter data without sample ID
        r.Name !== "" &&
        r.Position
      ) {
        dataGrouping(r, "sample", r.Position);
      }
    }
  });

  return result;
}

function qcParsing(control) {
  let status = true;

  // Parsing control value
  for (let c in control) {
    if (c === "ntc") {
      for (let v in control[c]) {
        if (v !== "name" && v !== "well") {
          if (control.ntc[v] === undefined) {
            control.ntc[v] = 0;
            logger.warn(`Fail the criteria: NTC ${v} has no data`);
            status = false;
          } else if (control.ntc[v] !== 0) {
            logger.warn(`Fail the criteria: Ct value of NTC ${v} is not null`);
            status = false;
          } else if (typeof control.ntc[v] !== "number") {
            logger.warn(`Fail the criteria: NTC ${v} Ct value is not a number`);
            status = false;
          }
        }
      }
    } else if (c === "ctrl1" || c === "ctrl2" || c === "ctrl3") {
      for (let k in control[c]) {
        if (k !== "name" && k !== "well") {
          if (control[c][k] === undefined) {
            control[c][k] = 0;
            logger.warn(`Fail the criteria: ${c} ${k} has no data`);
            status = false;
          } else if (control[c][k] === 0) {
            logger.warn(`Fail the criteria: ${c} ${k} has no Ct value`);
            status = false;
          } else if (typeof control[c][k] !== "number") {
            logger.warn(
              `Fail the criteria: ${c} ${k} Ct value is not a number`
            );
            status = false;
          }
        }
      }
    }
  }

  return [status, control]
}

function qcAssessment(status, control) {
  let qc = {
    run_id: undefined,
    status: "Meet the criteria",
    rnp_smn1_1n: undefined,
    rnp_smn1_2n: undefined,
    rnp_smn1_3n: undefined,
    smn1_4n: 0,
    rnp_smn2_1n: undefined,
    rnp_smn2_2n: undefined,
    rnp_smn2_3n: undefined,
    smn2_4n: 0,
  };

  if (status) {
    // Calculate control delta Ct value
    qc.rnp_smn1_1n = parseFloat(
      (control.ctrl1.rnp - control.ctrl1.smn1).toPrecision(3)
    );
    qc.rnp_smn2_1n = parseFloat(
      (control.ctrl1.rnp - control.ctrl1.smn2).toPrecision(3)
    );
    qc.rnp_smn1_2n = parseFloat(
      (control.ctrl2.rnp - control.ctrl2.smn1).toPrecision(3)
    );
    qc.rnp_smn2_2n = parseFloat(
      (control.ctrl2.rnp - control.ctrl2.smn2).toPrecision(3)
    );
    qc.rnp_smn1_3n = parseFloat(
      (control.ctrl3.rnp - control.ctrl3.smn1).toPrecision(3)
    );
    qc.rnp_smn2_3n = parseFloat(
      (control.ctrl3.rnp - control.ctrl3.smn2).toPrecision(3)
    );

    // Calculate delta Ct
    const delta_smn1_2n1n = parseFloat(
      (qc.rnp_smn1_2n - qc.rnp_smn1_1n).toPrecision(3)
    );
    const delta_smn2_2n1n = parseFloat(
      (qc.rnp_smn2_2n - qc.rnp_smn2_1n).toPrecision(3)
    );
    const delta_smn1_3n2n = parseFloat(
      (qc.rnp_smn1_3n - qc.rnp_smn1_2n).toPrecision(3)
    );
    const delta_smn2_3n2n = parseFloat(
      (qc.rnp_smn2_3n - qc.rnp_smn2_2n).toPrecision(3)
    );
    qc.smn1_4n = qc.rnp_smn1_3n + delta_smn1_3n2n;
    qc.smn2_4n = qc.rnp_smn2_3n + delta_smn2_3n2n;

    // Criteria of delta Ct
    // if (
    //   !(delta_smn1_2n1n >= STD_CRITERIA_SMN1_2n1n[0]) ||
    //   !(delta_smn1_2n1n <= STD_CRITERIA_SMN1_2n1n[1]) || 
    //   !(delta_smn2_2n1n >= STD_CRITERIA_SMN2_2n1n[0]) || 
    //   !(delta_smn2_2n1n <= STD_CRITERIA_SMN2_2n1n[1]) || 
    //   !(delta_smn1_3n2n >= STD_CRITERIA_SMN1_3n2n[0]) || 
    //   !(delta_smn1_3n2n <= STD_CRITERIA_SMN1_3n2n[1]) || 
    //   !(delta_smn2_3n2n >= STD_CRITERIA_SMN2_3n2n[0]) || 
    //   !(delta_smn2_3n2n <= STD_CRITERIA_SMN2_3n2n[1])
    // ) {
    //   console.log('Interval:', {
    //     SMN1_2N_1N: delta_smn1_2n1n,
    //     SMN1_3N_2N: delta_smn1_3n2n,
    //     SMN2_2N_1N: delta_smn2_2n1n,
    //     SMN2_3N_2N: delta_smn2_3n2n,
    //   })
    //   qc.status = "Fail the criteria";
    //   logger.error(`Failed control criteria`);
    // }
  } else {
    qc.rnp_smn1_1n = 0;
    qc.rnp_smn2_1n = 0;
    qc.rnp_smn1_2n = 0;
    qc.rnp_smn2_2n = 0;
    qc.rnp_smn1_3n = 0;
    qc.rnp_smn2_3n = 0;
    qc.status = "Fail the criteria";
    logger.error(`Missing some control data`);
  }

  return qc
}

async function resultlAnalysis(sample, control, qc, model1, model2, predict) {
  let sample_output = new Array();

  // Defined interpretation
  function isNormal(typeArray) {
    return [
      "20",
      "21",
      "22",
      "23",
      "24",
      "30",
      "31",
      "32",
      "33",
      "34",
      "40",
      "41",
      "42",
      "43",
      "44",
    ].includes(typeArray);
  }
  function isCarrier(typeArray) {
    return ["10", "11", "12", "13", "14"].includes(typeArray);
  }
  function isAffected(typeArray) {
    return ["02", "03", "04"].includes(typeArray);
  }
  function isInvalid(typeArray) {
    return ["00", "01"].includes(typeArray);
  }

  // Calculate sample delta Ct value
  for (let w in sample) {
    sample[w].type = new Array();
    sample[w].assessment = 0;
    sample[w].smn1_std1smn1 = parseFloat(
      (sample[w].smn1 - control.ctrl1.smn1).toPrecision(3)
    );
    sample[w].smn1_std2smn1 = parseFloat(
      (sample[w].smn1 - control.ctrl2.smn1).toPrecision(3)
    );
    sample[w].smn1_std3smn1 = parseFloat(
      (sample[w].smn1 - control.ctrl3.smn1).toPrecision(3)
    );
    sample[w].smn2_std1smn2 = parseFloat(
      (sample[w].smn2 - control.ctrl1.smn2).toPrecision(3)
    );
    sample[w].smn2_std2smn2 = parseFloat(
      (sample[w].smn2 - control.ctrl2.smn2).toPrecision(3)
    );
    sample[w].smn2_std3smn2 = parseFloat(
      (sample[w].smn2 - control.ctrl3.smn2).toPrecision(3)
    );
    sample[w].rnp_std1rnp = parseFloat(
      (sample[w].rnp - control.ctrl1.rnp).toPrecision(3)
    );
    sample[w].rnp_std2rnp = parseFloat(
      (sample[w].rnp - control.ctrl2.rnp).toPrecision(3)
    );
    sample[w].rnp_std3rnp = parseFloat(
      (sample[w].rnp - control.ctrl3.rnp).toPrecision(3)
    );
    if (qc.status === "Fail the criteria") {
      sample[w].assessment = "Inconclusive";
      logger.warn(`Sample assessment unsuccessful: fail the criteria`);
    } else if (qc.status === "Meet the criteria") {
      sample[w].assessment = "Invalid";

      // Define sample type
      // RNP
      if (sample[w].rnp === 0) {
        logger.warn(
          `Sample assessment unsuccessful: ${w} sample has no rnp data for assessment.`
        );
      } else if (typeof sample[w].rnp === "number") {
        // SMN1
        if (sample[w].smn1 === 0) {
          sample[w].type.push(0);
        } else if (typeof sample[w].smn1 === "number") {
          try {
            let pred_smn1 = parseInt(await runPredict(sample[w], model1, predict))
            sample[w].type.push(pred_smn1);
          } catch (err) {
            logger.error(err)
            logger.error(`Sample assessment unsuccessful: Cannot predict ${w} sample smn1 type.`);
          }
        } else {
          logger.warn(
            `Sample assessment unsuccessful: Cannot determine ${w} sample smn1 data.`
          );
        }

        // SMN2
        if (sample[w].smn2 === 0) {
          sample[w].type.push(0);
        } else if (typeof sample[w].smn2 === "number") {
          try {
            let pred_smn2 = parseInt(await runPredict(sample[w], model2, predict))
            sample[w].type.push(pred_smn2);
          } catch (err) {
            logger.error(err)
            logger.error(`Sample assessment unsuccessful: Cannot predict ${w} sample smn1 type.`);
          }
        } else {
          logger.warn(
            `Sample assessment unsuccessful: Cannot determined ${w} sample smn2 data.`
          );
          sample[w].type = new Array();
        }
      } else {
        logger.warn(
          `Sample assessment unsuccessful: Cannot determined ${w} sample rnp data`
        );
      }

      // Sample Analysis
      const sma_type = String(sample[w].type[0]) + String(sample[w].type[1]);
      if (isNormal(sma_type)) {
        // Defined "Noraml" by SMN1:SMN2 =
        // 2:0 or 2:1 or 2:2 or 2:3 or 2:4 or
        // 3:0 or 3:1 or 3:2 or 3:3 or 3:4 or
        // 4:0 or 4:1 or 4:2 or 4:3 or 4:4
        sample[w].assessment = "Normal";
        if (sma_type.includes("4")) {
          sample[w].type[sma_type.indexOf(4)] = 3; // Replace copy 4 by showing copy 3
          if (sample[w].type.indexOf(4)) {
            // if 4:4
            sample[w].type[sample[w].type.indexOf(4)] = 3; // Replace copy 4 by showing copy 3
          }
        }
      } else if (isCarrier(sma_type)) {
        // Defined "SMA carrier" by SMN1:SMN2 =
        // 1:0 or 1:1 or 1:2 or 1:3 or 1:4
        sample[w].assessment = "SMA carrier";
        if (sma_type.includes("4")) {
          sample[w].type[sma_type.indexOf(4)] = 3; // Replace copy 4 by showing copy 3
        }
      } else if (isAffected(sma_type)) {
        if (sample[w].type[1] === 2) {
          // Defined "SMA affected (Werdnig-Hoffmann Disease)" by SMN1:SMN2 =
          // 0:2
          sample[w].assessment = "SMA affected (Werdnig-Hoffmann Disease)";
        } else if (sample[w].type[1] === 3) {
          // Defined "SMA affected (Dubowitz disease)" by SMN1:SMN2 =
          // 0:3
          sample[w].assessment = "SMA affected (Dubowitz disease)";
        } else if (sample[w].type[1] === 4) {
          // Defined "SMA affected (Kugelberg-Welander Disease)" by SMN1:SMN2 =
          // 0:4
          sample[w].assessment = "SMA affected (Kugelberg-Welander Disease)";
        } else {
          logger.warn(
            `Sample assessment unsuccessful: Cannot recofnize ${w} sample sma type`
          );
        }
      } else if (isInvalid(sma_type)) {
        // Defined "Invalid" (nonsense value) by SMN1:SMN2 =
        // 0:0 or 0:1
        sample[w].type = new Array(); // Initial nonsense result
      } else {
        logger.warn(
          `Sample assessment unsuccessful: cannot define sma type in ${w} result assessment`
        );
      }
    } else {
      sample[w].assessment = "Inconclusive";
      logger.warn(
        "Sample assessment unsuccessful: cannot recognize qc status in result assessment"
      );
    }

    sample_output.push(sample[w]);
  }

  return sample_output;
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

async function mainRun(rawPath, ntcWell, ctrl1Well, ctrl2Well, ctrl3Well, instrument, reagent, predict, model1, model2) {
  /* Check nput */
  if (typeof rawPath !== "string") {
    logger.error(`Input file path need to be a string.`);
    return;
  } else if (typeof rawPath === "undefined") {
    logger.error(`No Input file.`);
    return;
  } else if (typeof ntcWell === "undefined") {
    logger.error(`No well position for NTC been assigned.`);
    return;
  } else if (typeof ntcWell !== "string") {
    logger.error(`NTC well position need to be correct format. (e.g., A1)`);
    return;
  } else if (typeof ctrl1Well === "undefined") {
    logger.error(`No well position for Control-1 been assigned.`);
    return;
  } else if (typeof ctrl1Well !== "string") {
    logger.error(
      `Control-1 well position need to be correct format. (e.g., B1)`
    );
    return;
  } else if (typeof ctrl2Well === "undefined") {
    logger.error(`No well position for Control-2 been assigned.`);
    return;
  } else if (typeof ctrl2Well !== "string") {
    logger.error(
      `Control-2 well position need to be correct format. (e.g., C1)`
    );
    return;
  } else if (typeof ctrl3Well === "undefined") {
    logger.error(`No well position for Control-3 been assigned.`);
    return;
  } else if (typeof ctrl3Well !== "string") {
    logger.error(
      `Control-3 well position need to be correct format. (e.g., C1)`
    );
    return;
  } else {
    /* Analysis */
    let rawArray;
    let runID;

    // Read raw data (must have columns named in: "Position", "Name", "Reporter", "CT")
    let raw = rawReadQ(rawPath);
    rawArray = raw.raw;
    runID = raw.runID;
    let result = resultPreprocess(rawArray, ntcWell, ctrl1Well, ctrl2Well, ctrl3Well);
    let [status, control] = qcParsing(result.control);
    let qc = qcAssessment(status, control);
    qc.run_id = runID;
    let sample = await resultlAnalysis(result.sample, result.control, qc, model1, model2, predict);
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
}

// Run by called
module.exports = {
  runSmaRf: async function (
    rawPath,
    ntcWell,
    ctrl1Well,
    ctrl2Well,
    ctrl3Well,
    instrument,
    reagent,
    predict,
    model1,
    model2,
  ) {
    logger.info("******* Running for SMA main process by random forest model *******");
    let output = await mainRun(
      rawPath.trim(),
      ntcWell.trim(),
      ctrl1Well.trim(),
      ctrl2Well.trim(),
      ctrl3Well.trim(),
      instrument ? instrument.trim() : "qs3",
      reagent ? reagent.trim() : "accuinSma1",
      predict.trim(),
      model1.trim(),
      model2.trim(),
    );
    jsonOutput(JSON_OUTPUT, output);
    return output;
  },
};

// Run by node
if (require.main === module) {
  module.exports.runSmaRf(
    argv.f,
    argv.n,
    argv.a,
    argv.b,
    argv.c,
    argv.i,
    argv.r,
    argv.p,
    argv.o,
    argv.t,
  );
}
