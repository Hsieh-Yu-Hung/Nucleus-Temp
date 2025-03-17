/**
 * Analysis HD core for Suspect-X.
 *
 * Run directly by node:
 *   node core/hd.js \
 *   [sample1.xlsx] [sample2.xlsx] \
 *   [-c standard.xlsx] \
 *   [-i qsep100] \
 *   [-r accuinHD1] \
 *   [--dummy]
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
    r: "accuinHD1", // Only support 'Accuin HD kit version 1' now
  },
});

/* Define Setting */
const ACTIN_BP = 453;
const CONTROL_RANGE_BP = [
  // Expected standard: 453 bp with ±10% deviation
  Math.round(ACTIN_BP * 0.9, 10), // 408 bp
  Math.round(ACTIN_BP * 1.1, 10), // 498 bp
];
const FLANKING = 67;
const HTD_RANGE_BP = [70, 350];
const HTD_RFU_CUTOFF = 1; // > 1 rfu will select
const HTD_RUF_RATIO_CUTOFF = 0.4;
const HTD_BP_THRESHOLD = 60;
const NORMAL_CUTOFF = [26];
const INTERMEDIATE_CUTOFF = [27, 35];
const PENETRANCE_CUTOFF = [36, 39];
const FULL_CUTOFF = 40;
const STANDARD_BP = [121, 199];
const STANDARD_RANGE_BP = [0.9, 1.1]; // 109 - 133 bp && 179 - 219 bp

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

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function filenameParser(id) {
  return id.replace(/[/\\?%*:|"<>.]/g, "-"); // convert illegal characters from filenmae
}

function bpToRepeats(bp) {
  return Math.round((bp - FLANKING) / 3);
}

function resultConvert(samplePath) {
  let rawLst = new Array();

  // Convert excel result to dictionary
  const sampleWorksheet = XLSX.readFile(samplePath).Sheets.FolderReportMainPage;
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
  const sampleRaw = XLSX.utils.sheet_to_json(sampleWorksheet, {
    range: XLSX.utils.encode_range(sampleRange),
  });
  sampleRaw.forEach(function (filter) {
    let rawBp = parseInt(filter.bp, 10);
    let rawRfu = parseFloat(filter.RFU);
    if (!isNaN(rawBp) && !isNaN(rawRfu)) {
      rawLst.push({
        bp: rawBp,
        rfu: rawRfu,
        repeats: bpToRepeats(rawBp),
      });
    }
  });
  return rawLst;
}

function standardConvert(standardPath) {
  let rawLst = new Array();

  // Convert excel result to dictionary
  const standardWorksheet =
    XLSX.readFile(standardPath).Sheets.FolderReportMainPage;
  let standardRange = XLSX.utils.decode_range(standardWorksheet["!ref"]);

  // Find table position
  Object.keys(standardWorksheet).find(function (cell) {
    if (cell.includes("E")) {
      if (standardWorksheet[cell].v === "No") {
        var standardStart = parseInt(cell.replace("E", ""), 10) - 1;
        standardRange.s.r = standardStart; // Start to read excel from row
      }
    }
  });
  standardRange.s.c = 4; // Start to read excel from column 'E'
  standardRange.e.c = 21; // End to read excel from column 'U'

  // Collect data from result table
  const standardRaw = XLSX.utils.sheet_to_json(standardWorksheet, {
    range: XLSX.utils.encode_range(standardRange),
  });
  standardRaw.forEach(function (filter) {
    let rawBp = parseInt(filter.bp, 10);
    let rawRfu = parseFloat(filter.RFU);
    let rawConcn = parseFloat(filter["Concn.\n(ng/µl)"]);
    if (!isNaN(rawBp) && !isNaN(rawRfu) && !isNaN(rawConcn)) {
      rawLst.push({
        bp: rawBp,
        rfu: rawRfu,
        repeats: bpToRepeats(rawBp),
      });
    }
  });
  return rawLst;
}

function standardQcAssessment(standardRaw) {
  let standard = new Array();
  let standardQc = {
    status: "fail-the-criteria",
  };
  let standardCandidate = standardRaw
    .sort(function (a, b) {
      return b.rfu - a.rfu;
    })
    .slice(0, 2)
    .sort(function (a, b) {
      return a.bp - b.bp;
    });
  standardCandidate.map((s, idx) => {
    let standardObject = {
      bp: s.bp ? s.bp : null,
      percentage: s.bp ? s.bp / STANDARD_BP[idx] : null,
      status: "fail-the-criteria",
    };
    standard.push(standardObject);
    if (
      standardObject.percentage >= STANDARD_RANGE_BP[0] &&
      standardObject.percentage <= STANDARD_RANGE_BP[1]
    ) {
      standardObject.status = "meet-the-criteria";
      standardQc.status = "meet-the-criteria";
    } else {
      standardQc.status = "fail-the-criteria";
    }
  });

  return {
    standard,
    standardQc,
  };
}

function qcAssessment(controlRaw) {
  let qc = {
    bp: null,
    rfu: null,
    status: "fail-the-criteria",
  };

  // Internal control QC
  if (controlRaw.length === 0) {
    logger.warn({
      label: "Fail the criteria",
      message: `No internal control peak`,
    });
  } else {
    // Choose the highest rfu peak in standard bp range
    qc.bp = controlRaw[0].bp;
    qc.rfu = controlRaw[0].rfu;
    qc.status = "meet-the-criteria";
  }

  return qc;
}

function sampleAnalysis(sampleRaw, dummy) {
  let bp = new Array();
  let type = new Array();
  let repeats = new Array();
  let assessment;

  if (dummy === true) {
    const dummySampleRawLength = random([0, 1, 2]);
    const repeatsMin = bpToRepeats(70);
    const repeatsMax = bpToRepeats(350);
    const len = repeatsMax - repeatsMin + 1;
    for (let i = 0; i < dummySampleRawLength; i++) {
      repeats.push(
        random(
          Array.from({ length: len }, (_, i) => i + bpToRepeats(repeatsMin))
        )
      );
    }
  } else {
    if (sampleRaw.length === 0) {
      logger.warn({
        label: "Fail to assessment",
        message: `No HD result peaks`,
      });
      assessment = "invalid";
    } else {
      let topPeak = sampleRaw[0];
      let candidate = sampleRaw.sort((a, b) => a.bp - b.bp);

      // Filter candidate
      candidate.forEach(function (dicPos) {
        if (
          dicPos.bp <= topPeak.bp + HTD_BP_THRESHOLD &&
          dicPos.rfu / topPeak.rfu >= HTD_RUF_RATIO_CUTOFF
        ) {
          bp.push(dicPos.bp);
          repeats.push(dicPos.repeats);
        } else if (dicPos.bp > topPeak.bp + HTD_BP_THRESHOLD) {
          bp.push(dicPos.bp);
          repeats.push(dicPos.repeats);
        }
      });
    }
  }

  return { assessment, type, bp, repeats };
}

function sampleAssessment(sample) {
  // Set assessment category
  function isNormal(repeats) {
    return repeats <= NORMAL_CUTOFF[0];
  }
  function isIntermediate(repeats) {
    return (
      INTERMEDIATE_CUTOFF[0] <= repeats && repeats <= INTERMEDIATE_CUTOFF[1]
    );
  }
  function isPenetrance(repeats) {
    return PENETRANCE_CUTOFF[0] <= repeats && repeats <= PENETRANCE_CUTOFF[1];
  }
  function isFull(repeats) {
    return FULL_CUTOFF <= repeats;
  }

  // Result assessment by repeats
  if (sample.repeats.length > 2) {
    logger.warn({
      label: "Fail to assessment",
      message: "More than 2 result peaks of HTD",
    });
    sample.repeats = new Array();
    sample.assessment = "invalid";
  } else {
    if (sample.repeats.some(isNormal)) {
      if (sample.repeats.some(isIntermediate)) {
        sample.assessment = "hd-intermediate";
        sample.type.push("hd-normal");
        sample.type.push("hd-intermediate");
      } else if (sample.repeats.some(isPenetrance)) {
        sample.assessment = "hd-penetrance";
        sample.type.push("hd-normal");
        sample.type.push("hd-penetrance");
      } else if (sample.repeats.some(isFull)) {
        sample.assessment = "hd-full";
        sample.type.push("hd-normal");
        sample.type.push("hd-full");
      } else {
        sample.type = new Array(2).fill("hd-normal");
        sample.assessment = "hd-normal";
      }
    } else if (sample.repeats.some(isIntermediate)) {
      if (sample.repeats.some(isPenetrance)) {
        sample.type.push("hd-intermediate");
        sample.type.push("hd-penetrance");
        sample.assessment = "hd-full";
      } else if (sample.repeats.some(isFull)) {
        sample.type.push("hd-intermediate");
        sample.type.push("hd-full");
        sample.assessment = "hd-full";
      } else {
        sample.type = new Array(2).fill("hd-intermediate");
        sample.assessment = "hd-intermediate";
      }
    } else if (sample.repeats.some(isPenetrance)) {
      if (sample.repeats.some(isFull)) {
        sample.assessment = "hd-full";
        sample.type.push("hd-penetrance");
        sample.type.push("hd-full");
      } else {
        sample.assessment = "hd-penetrance";
        sample.type = new Array(2).fill("hd-penetrance");
      }
    } else if (sample.repeats.some(isFull)) {
      sample.assessment = "hd-full";
      sample.type = new Array(2).fill("hd-full");
    } else {
      logger.warn({
        label: "Fail to assessment",
        message: "No result signal",
      });
      sample.repeats = new Array();
      sample.assessment = "invalid";
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

function mainRun(standardPath, samplePathList, instrument, reagent, dummy) {
  let resultLst = new Array();

  /* Standard QC */
  const standardRaw = standardConvert(standardPath);
  const standardQc = standardQcAssessment(standardRaw);

  /* Preprocessing */
  const rawLst = samplePathList.map(resultConvert);
  rawLst.forEach((raw, i) => {
    let result = {
      sampleId: filenameParser(
        path.basename(samplePathList[i]).replace(/\.[^/.]+$/, "")
      ),
      assessment: "inconclusive",
      type: [],
      bp: [],
      repeats: new Array(),
      internalQc: {
        status: "fail-the-criteria",
        bp: null,
        rfu: null,
      },
      raw: raw,
    };
    if (standardQc.standardQc.status === "meet-the-criteria") {
      const rawControlList = raw
        .filter(function (r) {
          return r.bp >= CONTROL_RANGE_BP[0] && r.bp <= CONTROL_RANGE_BP[1];
        })
        .sort((a, b) => b.rfu - a.rfu);
      const rawResultList = raw
        .filter(function (r) {
          return (
            r.bp >= HTD_RANGE_BP[0] &&
            r.bp <= HTD_RANGE_BP[1] &&
            r.rfu > HTD_RFU_CUTOFF
          );
        })
        .sort((a, b) => b.rfu - a.rfu);

      /* Internal control QC */
      result.internalQc = qcAssessment(rawControlList);
      if (dummy === true) {
        result.internalQc.status = random([
          "fail-the-criteria",
          "meet-the-criteria",
        ]);
      }
      if (result.internalQc.status === "fail-the-criteria") {
        result.assessment = "invalid";
        logger.warn({
          label: "Fail the criteria",
          message: `Fail the criteria and skip sample assessment sample ${result.sampleId}`,
        });
      } else if (result.internalQc.status === "meet-the-criteria") {
        let sample = sampleAnalysis(rawResultList, dummy);
        sampleAssessment(sample);
        result.assessment = sample.assessment;
        result.type = sample.type;
        result.bp = sample.bp;
        result.repeats = sample.repeats;
      } else {
        logger.warn({
          label: "QC error",
          message: `Cannot recognize QC status of sample ${sample.sampleId}`,
        });
      }
    }
    resultLst.push(result);
  });

  let output = {
    config: {
      reagent: reagent,
      instrument: instrument,
      nucleus: "v3.4.3",
      logger: [JSON_DIR, JSON_OUTPUT]
    },
    control: {
      control_id: filenameParser(
        path.basename(standardPath).replace(/\.[^/.]+$/, "")
      ),
      standard_1: standardQc.standard[0]
        ? standardQc.standard[0]
        : { bp: null, percentage: null, status: "fail-the-criteria" },
      standard_2: standardQc.standard[1]
        ? standardQc.standard[1]
        : { bp: null, percentage: null, status: "fail-the-criteria" },
    },
    qc: standardQc.standardQc,
    result: resultLst,
  };
  logger.info(JSON.stringify(output, null, 4));
  return output;
}

// Run by called
module.exports = {
  runHd: function (
    standardPath,
    samplePathList,
    instrument,
    reagent,
    dummy
  ) {
    logger.info("******* Running for HTD main process *******");
    let output = mainRun(
      standardPath.trim(),
      samplePathList.map((s) => s.trim()),
      instrument ? instrument.trim() : "qsep100",
      reagent ? reagent.trim() : "accuinHD1",
      dummy
    );
    jsonOutput(JSON_OUTPUT, output);
    return output;
  },
};

// Run by node
if (require.main === module) {
  let samplePathList = argv._;
  
  module.exports.runHd(
    argv.c,
    samplePathList,
    argv.i,
    argv.r,
    argv.dummy
  );
}
