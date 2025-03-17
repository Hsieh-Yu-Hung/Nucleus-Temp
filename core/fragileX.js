/**
 * Analysis core for Suspect-X. (Everclear)
 *
 * Run directly by node:
 *   node core/fragileX.js \
 *   [sample1.xlsx] [sample2.xlsx] \
 *   [-c control.xlsx] \
 *   [-i qsep100] \
 *   [-r accuinFx1]
 *
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const regression = require("regression");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qsep100", // Only 'Qsep100' avaliable now
    r: "accuinFx1", // Support 'Accuin FragileX kit v1 & v2'
  },
});

/* Define Setting */
const ASSESSMENT_BP_BOUND = [250, 1000];
const BP_THRESHOLD = 15; // bp size deviation for gender define
const X_BP = 158;
const Y_BP = 195;
const FLANKING_SIZE = 221;
const NORMAL_CUTOFF = 45; // repeats
const INTERMEDIATE_CUTOFF = 55; // repeats
const MUTATION_CUTOFF = 200; // repeats
const GENDER_RFU_CUTOFF = 1.5;
const FX_RFU_CUTOFF = 1;
const FX_BP_THRESHOLD = 60;
const FX_RUF_RATIO_CUTOFF = 0.2;

var STANDARD_REPEATS;
var STANDARD_LENGTH;
var STANDARD_SIZE_DEVIATION;

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment(new Date()).format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "HTD_" + moment(new Date()).format("YYYYMMDD_HHmmss") + ".json"
);
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  // If it doesn't exist, create it
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

function filenameParser(id) {
  return id.replace(/[/\\?%*:|"<>.]/g, "-"); // convert illegal characters from filenmae
}

function v1controlConvert(controlPath) {
  logger.info(`Control: ${controlPath}`);

  let output = {
    control_id: undefined,
    standard_1: {
      repeats_standard: STANDARD_REPEATS[0],
      bp: undefined,
      conc: undefined,
    },
    standard_2: {
      repeats_standard: STANDARD_REPEATS[1],
      bp: undefined,
      conc: undefined,
    },
    standard_3: {
      repeats_standard: STANDARD_REPEATS[2],
      bp: undefined,
      conc: undefined,
    },
  };

  output.control_id = filenameParser(
    path.basename(controlPath).replace(/\.[^/.]+$/, "")
  );
  // Convert excel control to dictionary
  let result = new Array();
  let ctrlWorksheet = XLSX.readFile(controlPath).Sheets.FolderReportMainPage;
  let ctrlRange = XLSX.utils.decode_range(ctrlWorksheet["!ref"]);

  // Find table position
  var ctrlStart = Object.keys(ctrlWorksheet).find(function (cell) {
    if (cell.includes("E")) {
      if (ctrlWorksheet[cell].v === "No") {
        return cell;
      }
    }
  });
  ctrlRange.s.r = parseInt(ctrlStart.replace("E", ""), 10) - 1; // Start to read excel from row
  ctrlRange.s.c = 4; // Start to read excel from column 'E'
  ctrlRange.e.c = 21; // End to read excel from column 'U'
  let controlRaw = XLSX.utils.sheet_to_json(ctrlWorksheet, {
    range: XLSX.utils.encode_range(ctrlRange),
  });
  let ctrlConcn = ctrlWorksheet[ctrlStart.replace("E", "O")].v; // find Concentration header

  // Filter standard candidate by top 3 high rfu
  let controlStandard = controlRaw
    .filter(function (filter) {
      return filter.bp >= 300 && filter.bp <= 1000;
    })
    .sort(function (a, b) {
      return b.RFU - a.RFU;
    });
  if (controlStandard.length > 3) {
    controlStandard = controlStandard.slice(0, 3);
  }

  // Sort ascending by bp size
  controlStandard = controlStandard.sort(function (a, b) {
    return a.bp - b.bp;
  });

  // Define standard
  controlStandard.forEach(function (standardDict) {
    if (
      STANDARD_LENGTH[0] * STANDARD_SIZE_DEVIATION[0][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[0] * STANDARD_SIZE_DEVIATION[0][1]
    ) {
      if (typeof output.standard_1.bp === "undefined") {
        output.standard_1.bp = parseInt(standardDict.bp);
        output.standard_1.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_1.bp, STANDARD_REPEATS[0]]);
      } else if (
        STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][0] <= standardDict.bp &&
        standardDict.bp <= STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][1]
      ) {
        if (typeof output.standard_2.bp === "undefined") {
          output.standard_2.bp = parseInt(standardDict.bp);
          output.standard_2.conc = parseFloat(standardDict[ctrlConcn]);
          result.push([output.standard_2.bp, STANDARD_REPEATS[1]]);
        }
      }
    } else if (
      STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][1]
    ) {
      if (typeof output.standard_2.bp === "undefined") {
        output.standard_2.bp = parseInt(standardDict.bp);
        output.standard_2.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_2.bp, STANDARD_REPEATS[1]]);
      }
    } else if (
      STANDARD_LENGTH[2] * STANDARD_SIZE_DEVIATION[2][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[2] * STANDARD_SIZE_DEVIATION[2][1]
    ) {
      if (typeof output.standard_3.bp === "undefined") {
        output.standard_3.bp = parseInt(standardDict.bp);
        output.standard_3.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_3.bp, STANDARD_REPEATS[2]]);
      }
    } else {
      result.push([parseInt(standardDict.bp), undefined]);
    }
  });

  logger.info(`    Standard 1: ${JSON.stringify(output.standard_1)}`);
  logger.info(`    Standard 2: ${JSON.stringify(output.standard_2)}`);
  logger.info(`    Standard 3: ${JSON.stringify(output.standard_3)}`);

  return {
    result,
    output,
  };
}

function v2controlConvert(controlPath) {
  logger.info(`Control: ${controlPath}`);

  let output = {
    control_id: undefined,
    standard_1: {
      repeats_standard: STANDARD_REPEATS[0],
      bp: undefined,
      conc: undefined,
    },
    standard_2: {
      repeats_standard: STANDARD_REPEATS[1],
      bp: undefined,
      conc: undefined,
    },
    standard_3: {
      repeats_standard: STANDARD_REPEATS[2],
      bp: undefined,
      conc: undefined,
    },
    standard_4: {
      repeats_standard: STANDARD_REPEATS[3],
      bp: undefined,
      conc: undefined,
    },
  };

  output.control_id = filenameParser(
    path.basename(controlPath).replace(/\.[^/.]+$/, "")
  );
  // Convert excel control to dictionary
  let result = new Array();
  let ctrlWorksheet = XLSX.readFile(controlPath).Sheets.FolderReportMainPage;
  let ctrlRange = XLSX.utils.decode_range(ctrlWorksheet["!ref"]);

  // Find table position
  var ctrlStart = Object.keys(ctrlWorksheet).find(function (cell) {
    if (cell.includes("E")) {
      if (ctrlWorksheet[cell].v === "No") {
        return cell;
      }
    }
  });
  ctrlRange.s.r = parseInt(ctrlStart.replace("E", ""), 10) - 1; // Start to read excel from row
  ctrlRange.s.c = 4; // Start to read excel from column 'E'
  ctrlRange.e.c = 21; // End to read excel from column 'U'
  let controlRaw = XLSX.utils.sheet_to_json(ctrlWorksheet, {
    range: XLSX.utils.encode_range(ctrlRange),
  });
  let ctrlConcn = ctrlWorksheet[ctrlStart.replace("E", "O")].v; // find Concentration header

  // Filter standard candidate by top 4 high rfu
  let controlStandard = controlRaw
    .filter(function (filter) {
      return filter.bp >= 300 && filter.bp <= 1000;
    })
    .sort(function (a, b) {
      return b.RFU - a.RFU;
    });
  if (controlStandard.length > 4) {
    controlStandard = controlStandard.slice(0, 4);
  }

  // Sort ascending by bp size
  controlStandard = controlStandard.sort(function (a, b) {
    return a.bp - b.bp;
  });

  // Define standard
  controlStandard.forEach(function (standardDict) {
    if (
      STANDARD_LENGTH[0] * STANDARD_SIZE_DEVIATION[0][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[0] * STANDARD_SIZE_DEVIATION[0][1]
    ) {
      if (typeof output.standard_1.bp === "undefined") {
        output.standard_1.bp = parseInt(standardDict.bp);
        output.standard_1.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_1.bp, STANDARD_REPEATS[0]]);
      } else if (
        STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][0] <= standardDict.bp &&
        standardDict.bp <= STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][1]
      ) {
        if (typeof output.standard_2.bp === "undefined") {
          output.standard_2.bp = parseInt(standardDict.bp);
          output.standard_2.conc = parseFloat(standardDict[ctrlConcn]);
          result.push([output.standard_2.bp, STANDARD_REPEATS[1]]);
        }
      }
    } else if (
      STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[1] * STANDARD_SIZE_DEVIATION[1][1]
    ) {
      if (typeof output.standard_2.bp === "undefined") {
        output.standard_2.bp = parseInt(standardDict.bp);
        output.standard_2.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_2.bp, STANDARD_REPEATS[1]]);
      }
    } else if (
      STANDARD_LENGTH[2] * STANDARD_SIZE_DEVIATION[2][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[2] * STANDARD_SIZE_DEVIATION[2][1]
    ) {
      if (typeof output.standard_3.bp === "undefined") {
        output.standard_3.bp = parseInt(standardDict.bp);
        output.standard_3.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_3.bp, STANDARD_REPEATS[2]]);
      }
    } else if (
      STANDARD_LENGTH[3] * STANDARD_SIZE_DEVIATION[3][0] <= standardDict.bp &&
      standardDict.bp <= STANDARD_LENGTH[3] * STANDARD_SIZE_DEVIATION[3][1]
    ) {
      if (typeof output.standard_4.bp === "undefined") {
        output.standard_4.bp = parseInt(standardDict.bp);
        output.standard_4.conc = parseFloat(standardDict[ctrlConcn]);
        result.push([output.standard_4.bp, STANDARD_REPEATS[3]]);
      }
    } else {
      result.push([parseInt(standardDict.bp), undefined]);
    }
  });

  logger.info(`    Standard 1: ${JSON.stringify(output.standard_1)}`);
  logger.info(`    Standard 2: ${JSON.stringify(output.standard_2)}`);
  logger.info(`    Standard 3: ${JSON.stringify(output.standard_3)}`);
  logger.info(`    Standard 4: ${JSON.stringify(output.standard_4)}`);

  return {
    result,
    output,
  };
}

function v1controlAssessment(controlResult) {
  /**
   * Control criteria
   *      1. Must exist all 3 control results
   *      2. r-square >= 0.99
   *      3. slope ?
   */

  let output = {
    status: undefined,
    r_squared: undefined,
    slope: undefined,
    linear: new Array(), // [x, y] = [bp length, repeats]
    max_bp: 1200,
    max_repeats: 300,
  };

  // Check standards are exist
  if (controlResult.length === 3) {
    let standard_lst = new Array();
    controlResult.forEach(function (lst) {
      standard_lst.push(lst[1]);
    });
    if (!STANDARD_REPEATS.every((r) => standard_lst.includes(r))) {
      output.status = "Fail the criteria";
      output.linear.push([undefined, undefined]);
      output.linear.push([undefined, undefined]);
      logger.warn({
        label: "Fail the criteria",
        message: "Some standard are missing and duplicate",
      });
    } else {
      // Check r-square
      let qcLinear = regression.linear(controlResult);
      let qcR2 = qcLinear.r2;
      logger.info(`    QC Equation: ${qcLinear.string}`);
      if (qcR2 >= 0.99) {
        output.status = "Meet the criteria";
        output.r_squared = parseFloat(qcR2);
        output.slope = qcLinear.equation[0];
        output.linear.push(qcLinear.predict(-1));
        output.linear.push(qcLinear.predict(output.max_bp));
      } else if (Number.isNaN(qcR2)) {
        output.status = "Fail the criteria";
        output.linear.push([undefined, undefined]);
        output.linear.push([undefined, undefined]);
        logger.warn({
          label: "Fail the criteria",
          message: "Cannot calculate R-squared",
        });
      } else {
        output.status = "Fail the criteria";
        output.linear.push([undefined, undefined]);
        output.linear.push([undefined, undefined]);
        logger.warn({
          label: "Fail the criteria",
          message: "R-squared < 0.99",
        });
      }
    }
  } else {
    logger.warn({
      label: "Fail the criteria",
      message: "Some standard are missing",
    });
    output.status = "Fail the criteria";
    output.linear.push([undefined, undefined]);
    output.linear.push([undefined, undefined]);
  }
  return {
    output,
  };
}

function v2controlAssessment(controlResult) {
  /**
   * Control criteria
   *      1. Must exist all 4 control results
   *      2. r-square >= 0.99
   *      3. slope ?
   */

  let output = {
    status: undefined,
    r_squared: undefined,
    slope: undefined,
    linear: new Array(), // [x, y] = [bp length, repeats]
    max_bp: 1200,
    max_repeats: 300,
  };

  // Check standards are exist
  if (controlResult.length === 4) {
    let standard_lst = new Array();
    controlResult.forEach(function (lst) {
      standard_lst.push(lst[1]);
    });
    if (!STANDARD_REPEATS.every((r) => standard_lst.includes(r))) {
      output.status = "Fail the criteria";
      output.linear.push([undefined, undefined]);
      output.linear.push([undefined, undefined]);
      logger.warn({
        label: "Fail the criteria",
        message: "Some standard are missing and duplicate",
      });
    } else {
      // Check r-square
      let qcLinear = regression.linear(controlResult);
      let qcR2 = qcLinear.r2;
      logger.info(`    QC Equation: ${qcLinear.string}`);
      if (qcR2 >= 0.99) {
        output.status = "Meet the criteria";
        output.r_squared = parseFloat(qcR2);
        output.slope = qcLinear.equation[0];
        output.linear.push(qcLinear.predict(-1));
        output.linear.push(qcLinear.predict(output.max_bp));
      } else if (Number.isNaN(qcR2)) {
        output.status = "Fail the criteria";
        output.linear.push([undefined, undefined]);
        output.linear.push([undefined, undefined]);
        logger.warn({
          label: "Fail the criteria",
          message: "Cannot calculate R-squared",
        });
      } else {
        output.status = "Fail the criteria";
        output.linear.push([undefined, undefined]);
        output.linear.push([undefined, undefined]);
        logger.warn({
          label: "Fail the criteria",
          message: "R-squared < 0.99",
        });
      }
    }
  } else {
    logger.warn({
      label: "Fail the criteria",
      message: "Some standard are missing",
    });
    output.status = "Fail the criteria";
    output.linear.push([undefined, undefined]);
    output.linear.push([undefined, undefined]);
  }
  return {
    output,
  };
}

function resultConvert(samplePath) {
  let result = {
    sample_id: undefined,
    gender: "-",
    assessment: "Invalid",
    x_rfu: undefined,
    interpretation: new Array(),
    position: new Array(),
    raw: new Array(),
  };
  result.sample_id = filenameParser(
    path.basename(samplePath).replace(/\.[^/.]+$/, "")
  );

  // Convert excel result to dictionary
  let sampleWorksheet = XLSX.readFile(samplePath).Sheets.FolderReportMainPage;
  let sampleRange = XLSX.utils.decode_range(sampleWorksheet["!ref"]);

  // Find table position
  var sampleStart = Object.keys(sampleWorksheet).find(function (cell) {
    if (cell.includes("E")) {
      if (sampleWorksheet[cell].v === "No") {
        return cell;
      }
    }
  });
  sampleRange.s.r = parseInt(sampleStart.replace("E", ""), 10) - 1; // Start to read excel from row
  sampleRange.s.c = 4; // Start to read excel from column 'E'
  sampleRange.e.c = 21; // End to read excel from column 'U'

  // Collect data from result table
  let sampleRaw = XLSX.utils.sheet_to_json(sampleWorksheet, {
    range: XLSX.utils.encode_range(sampleRange),
  });
  let sampleConcn = sampleWorksheet[sampleStart.replace("E", "O")].v; // find Concentration header
  sampleRaw.forEach(function (filter) {
    let raw_bp = parseInt(filter.bp, 10);
    let raw_concn = parseFloat(filter[sampleConcn]);
    let raw_rfu = parseFloat(filter.RFU);
    if (!isNaN(raw_bp) && !isNaN(raw_rfu)) {
      let raw_dict = {
        bp: undefined,
        conc: undefined,
        rfu: undefined,
        expected_repeats: undefined,
      };
      raw_dict.bp = raw_bp;
      raw_dict.conc = raw_concn;
      raw_dict.rfu = raw_rfu;
      raw_dict.expected_repeats = Math.round((raw_bp - FLANKING_SIZE) / 3, 10);
      result.raw.push(raw_dict);
    }
  });
  return result;
}

function genderDefine(rawGenderList, sampleDict) {
  if (rawGenderList.length === 1) {
    if (
      X_BP - BP_THRESHOLD <= rawGenderList[0].bp &&
      rawGenderList[0].bp <= X_BP + BP_THRESHOLD
    ) {
      sampleDict.gender = "female";
      sampleDict.x_rfu = rawGenderList[0].rfu;
    } else {
      logger.warn({
        label: "Gender undefined",
        message: "Bp size of x is not existed",
      });
    }
  } else if (rawGenderList.length > 1) {
    const candidateYLst = rawGenderList
      .filter((dict) => {
        if (Y_BP - BP_THRESHOLD <= dict.bp && dict.bp <= Y_BP + BP_THRESHOLD) {
          return true;
        } else {
          return false;
        }
      })
      .sort(function (a, b) {
        return b.rfu - a.rfu;
      });
    const candidateXLst = rawGenderList
      .filter((dict) => {
        if (X_BP - BP_THRESHOLD <= dict.bp && dict.bp <= X_BP + BP_THRESHOLD) {
          return true;
        } else {
          return false;
        }
      })
      .sort(function (a, b) {
        return b.rfu - a.rfu;
      });
    if (candidateXLst.length === 0) {
      logger.warn({
        label: "Gender undefined",
        message: "No chr X peak",
      });
    } else if (candidateYLst.length === 0) {
      sampleDict.gender = "female";
      sampleDict.x_rfu = candidateXLst[0].rfu;
    } else {
      sampleDict.gender = "male";
      sampleDict.x_rfu = candidateXLst[0].rfu;
      sampleDict.y_rfu = candidateYLst[0].rfu;
    }
  } else {
    logger.warn({
      label: "Gender undefined",
      message: `No bp signal within chr X & Y region (${
        X_BP - BP_THRESHOLD
      } to ${Y_BP + BP_THRESHOLD})`,
    });
  }
  logger.info(`Sample ID: ${sampleDict.sample_id}`);
  logger.info(`    Gender: ${sampleDict.gender}`);
  logger.info(`    RFU of X: ${sampleDict.x_rfu}`);
  logger.info(`    RFU of Y: ${sampleDict.y_rfu}`);
}

function mutantDefine(rawMutantList, sampleDict) {
  let sampleBp = new Array();
  let sampleRepeats = new Array();

  // Set assessment category
  function isNormal(repeats) {
    return repeats < NORMAL_CUTOFF;
  }
  function isIntermediate(repeats) {
    return NORMAL_CUTOFF <= repeats && repeats < INTERMEDIATE_CUTOFF;
  }
  function isPremutation(repeats) {
    return INTERMEDIATE_CUTOFF <= repeats && repeats < MUTATION_CUTOFF;
  }
  function isFullMutation(repeats) {
    return MUTATION_CUTOFF <= repeats;
  }

  // Result position
  let repeatMutantList = new Array();
  if (sampleDict.gender === "female") {
    let resultDictFemale = rawMutantList;

    resultDictFemale.forEach(function (dicPos) {
      if (
        (dicPos.bp <= rawMutantList[0].bp + FX_BP_THRESHOLD &&
          dicPos.rfu / rawMutantList[0].rfu >= FX_RUF_RATIO_CUTOFF) ||
        dicPos.bp > rawMutantList[0].bp + FX_BP_THRESHOLD
      ) {
        sampleDict.position.push({
          repeats: Math.round(
            (dicPos.repeats + dicPos.expected_repeats) / 2,
            10
          ),
          bp: dicPos.bp,
          rfu: dicPos.rfu,
        });
        repeatMutantList.push(
          Math.round((dicPos.repeats + dicPos.expected_repeats) / 2, 10)
        );
        sampleRepeats.push(dicPos.repeats);
        sampleBp.push(dicPos.bp);
      }
    });
  } else if (sampleDict.gender === "male") {
    sampleDict.position.push({
      repeats: Math.round(
        (rawMutantList[0].repeats + rawMutantList[0].expected_repeats) / 2,
        10
      ),
      bp: rawMutantList[0].bp,
      rfu: rawMutantList[0].rfu,
    });
    repeatMutantList.push(
      Math.round(
        (rawMutantList[0].repeats + rawMutantList[0].expected_repeats) / 2,
        10
      )
    );
    sampleRepeats.push(Math.round(rawMutantList[0].repeats, 10));
    sampleBp.push(rawMutantList[0].bp);
  }

  // Result assessment by repeats
  if (repeatMutantList.length > 2) {
    logger.warn({
      label: "Fail to assessment",
      message: 'Female has more than 2 result signal',
    });
    logger.warn({
      message: sampleDict.position,
    });
    sampleDict.gender = "-";
    sampleDict.position = [];
  } else {
    if (repeatMutantList.some(isNormal)) {
      if (repeatMutantList.some(isIntermediate)) {
        sampleDict.assessment = "Normal/Intermediate";
        sampleDict.interpretation.push("Normal");
        sampleDict.interpretation.push("Intermediate");
      } else if (repeatMutantList.some(isPremutation)) {
        sampleDict.assessment = "Normal/Premutation";
        sampleDict.interpretation.push("Normal");
        sampleDict.interpretation.push("Premutation");
      } else if (repeatMutantList.some(isFullMutation)) {
        sampleDict.assessment = "Normal/Full mutation";
        sampleDict.interpretation.push("Normal");
        sampleDict.interpretation.push("Full mutation");
      } else {
        sampleDict.assessment = "Normal";
        sampleDict.interpretation.push("Normal");
      }
    } else if (repeatMutantList.some(isIntermediate)) {
      if (repeatMutantList.some(isPremutation)) {
        sampleDict.assessment = "Intermediate/Premutation";
        sampleDict.interpretation.push("Intermediate");
        sampleDict.interpretation.push("Premutation");
      } else if (repeatMutantList.some(isFullMutation)) {
        sampleDict.assessment = "Intermediate/Full mutation";
        sampleDict.interpretation.push("Full mutation");
      } else {
        sampleDict.assessment = "Intermediate";
        sampleDict.interpretation.push("Intermediate");
      }
    } else if (repeatMutantList.some(isPremutation)) {
      if (repeatMutantList.some(isFullMutation)) {
        sampleDict.assessment = "Premutation/Full mutation";
        sampleDict.interpretation.push("Premutation");
        sampleDict.interpretation.push("Full mutation");
      } else {
        sampleDict.assessment = "Premutation";
        sampleDict.interpretation.push("Premutation");
      }
    } else if (repeatMutantList.some(isFullMutation)) {
      sampleDict.assessment = "Full mutation";
      sampleDict.interpretation.push("Full mutation");
    } else {
      logger.warn({
        label: "Fail to assessment",
        message: "No result signal",
      });
      sampleDict.gender = "-";
      sampleDict.position = [];
    }
  }
  logger.info(`    Assessment: ${sampleDict.assessment}`);
  logger.info(`    Interpretation: ${sampleDict.interpretation}`);
  return {
    // return maximum values of bp & repeats
    repeats: sampleRepeats,
    bp: sampleBp,
  };
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

function mainRun(controlPath, samplePathList, instrument, reagent) {
  /* Analysis */
  let control;
  let qc;

  if (reagent === "accuinFx1") {
    STANDARD_REPEATS = [30, 50, 80];
    STANDARD_LENGTH = [311, 374, 462];
    STANDARD_SIZE_DEVIATION = [
      [0.9, 1.1], // ±10% for standard 1
      [0.9, 1.1], // ±10% for standard 2
      [0.9, 1.1], // ±10% for standard 3
    ];

    control = v1controlConvert(controlPath);
    logger.info(`Control ID: ${control.output.control_id}`);
    qc = v1controlAssessment(control.result);
  } else if (reagent === "accuinFx2") {
    STANDARD_REPEATS = [30, 50, 80, 200];
    STANDARD_LENGTH = [311, 374, 462, 823];
    STANDARD_SIZE_DEVIATION = [
      [0.9, 1.1], // ±10% for standard 1
      [0.9, 1.1], // ±10% for standard 2
      [0.9, 1.1], // ±10% for standard 3
      [0.9, 1.1], // ±10% for standard 4
    ];

    control = v2controlConvert(controlPath);
    logger.info(`Control ID: ${control.output.control_id}`);
    qc = v2controlAssessment(control.result);
  } else {
    logger.error({
      label: "Fail to read standard control raw data",
      message: "Unrecognize reagent version",
    });
    return;
  }
  logger.info(`    QC Status: ${qc.output.status}`);
  logger.info(`    QC R-saquare: ${qc.output.r_squared}`);
  logger.info(`    QC slope: ${qc.output.slope}`);
  logger.info(
    `    QC linear: (${qc.output.linear[0]}), (${qc.output.linear[1]})`
  );
  let sample = samplePathList.map(resultConvert);
  if (qc.output.status === "Meet the criteria") {
    sample.map(function (sampleDict) {
      // logger.info(`Sample ${i}: ${samplePath}`);
      sampleDict.raw = sampleDict.raw.sort(function (a, b) {
        return b.rfu - a.rfu;
      });
      let qcLinear = regression.linear(qc.output.linear);
      sampleDict.raw.forEach(function (rawDict) {
        rawDict.repeats = parseInt(qcLinear.predict(rawDict.bp)[1]);
      });

      // Gender define (X peak 158 - 10 bp <= Gender peak <= Y peak 195 + 10 bp)
      let rawGenderList = sampleDict.raw.filter(function (d) {
        return (
          d.bp <= Y_BP + BP_THRESHOLD &&
          X_BP - BP_THRESHOLD <= d.bp &&
          d.rfu > GENDER_RFU_CUTOFF
        );
      });
      genderDefine(rawGenderList, sampleDict);

      // Result assessment (250 bp <= Result peak <= 1000 bp)
      if (sampleDict.gender !== "-") {
        let rawMutantList = sampleDict.raw.filter(function (d) {
          return (
            d.bp >= ASSESSMENT_BP_BOUND[0] &&
            d.bp <= ASSESSMENT_BP_BOUND[1] &&
            d.rfu > FX_RFU_CUTOFF
          );
        });
        if (rawMutantList.length > 0) {
          let sample = mutantDefine(rawMutantList, sampleDict);
          if (Math.max(...sample.bp) > qc.output.max_bp) {
            qc.output.max_bp = Math.round(Math.max(...sample.bp) / 10) * 10;
          }
          if (Math.max(...sample.repeats) > qc.output.max_repeats) {
            qc.output.max_repeats =
              Math.round(Math.max(...sample.repeats) / 10) * 10;
          }
        } else {
          logger.warn({
            label: "Fail to assessment",
            message: "No result signal",
          });
        }
      } else {
        logger.warn({
          label: "Fail to assessment",
          message: "Gender not defined",
        });
      }
    });
    logger.info(`Maximum bp: ${qc.output.max_bp}`);
    logger.info(`Maximum repeats: ${qc.output.max_repeats}`);
  } else if (qc.output.status === "Fail the criteria") {
    sample.map(function (sampleDict) {
      sampleDict.assessment = "Inconclusive";
      logger.info(`Sample ID: ${sampleDict.sample_id}`);
    });
  } else {
    logger.error({
      label: "Fail to assessment",
      message: "QC status are not defined.",
    });
    return;
  }

  let outputDict = {
    config: {
      reagent: reagent,
      instrument: instrument,
      nucleus: "v3.4.3",
      logger: [JSON_DIR, JSON_OUTPUT]
    },
    control: control.output,
    qc: qc.output,
    result: sample,
  };
  logger.info(JSON.stringify(outputDict, null, 4));
  return outputDict;
}

// Run by called
module.exports = {
  runFx: function (
    controlPath,
    samplePathList,
    instrument,
    reagent
  ) {
    logger.info("******* Running for Fxs main process *******");
    let outputDict = mainRun(
      controlPath.trim(),
      samplePathList.map((s) => s.trim()),
      instrument ? instrument.trim() : "qsep100",
      reagent ? reagent.trim() : "accuinFx1",
    );
    jsonOutput(JSON_OUTPUT, outputDict);
    return outputDict;
  },
};

// Run by node
if (require.main === module) {
  let controlPath = argv.c;
  let samplePathList = argv._;

  module.exports.runFx(
    controlPath,
    samplePathList,
    argv.i,
    argv.r
  );
}
