/**
 * Analysis core for SMA.
 *
 * Run directly by node:
 *   node core/sma.js \
 *   [-f qs3_result.xlsx] (required) \
 *   [-n ntc_well] (required) \
 *   [-a ctrl1_well] (required) \
 *   [-b ctrl2_well] (required) \
 *   [-i qs3 tower z480] \
 *   [-r accuinSma1 accuinSma2 accuinSma3] \
 *   --fam [sma_465-510.txt] \ (accuinSma3 only)
 *   --vic [sma_540-580.txt] \ (accuinSma3 only)
 *   --cy5 [sma_610-670.txt] \ (accuinSma3 only)
 *   [-m v1 v2 custom] \   (Analyzer v1: Relax protocol / Analyzer v2: Restrict protocol / Custom: Custom protocol)
 */

if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const argv = require("minimist")(process.argv.slice(2), {
  default: {
    i: "qs3", // Only 'QS3' and 'Tower' avaliable now
    r: "accuinSma1", // Follow with the lab reagent
  },
});

const { analysisv1, analysisv2, analysisv3, analysisCustom } = require("./sma_analyzer.js");
const { sma } = require("./config.js");

const FAM_RANGE = '465-510 (465-510)';    // SMN1
const VIC_RANGE = '540-580 (540-580)';    // SMN2
const CY5_RANGE = '610-670 (610-670)';    // RNP

let parameters;

// Logger
const JSON_DIR = path.join(
  os.tmpdir(),
  "ACCUiNspection_" + moment(new Date()).format("YYYYMMDD")
);
const JSON_OUTPUT = path.join(
  JSON_DIR,
  "SMA_" + moment(new Date()).format("YYYYMMDD") + ".json"
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

function rawReadZ(famPath, vicPath, cy5Path) {
  let famData = new Array();
  let vicData = new Array();
  let cy5Data = new Array();
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

  // Parse CY5 file
  const cy5Content = fs.readFileSync(cy5Path, 'utf-8');
  const headerCy5 = cy5Content.split("\n")[0].split("\t")[0];
  const cy5Dye = headerCy5.split("Selected Filter: ").at(1);
  const cy5RawData = cy5Content.split("\n").slice(2, cy5Content.split("\n").length - 1);
  for (const line of cy5RawData) {
    if (line.trim() === '') continue; // Skip empty lines
    const [include, color, pos, name, cp, concentration, standard, status] = line.split('\t');
    if (cy5Dye === CY5_RANGE) {
      logger.error(`CY5 dye: ${cy5Dye} not match with the expected range: ${CY5_RANGE}`)
      cy5Data.push({
        Position: pos,
        Name: name,
        CT: 0,
        Reporter: 'CY5',
      });
    } else {
      cy5Data.push({
        Position: pos,
        Name: name,
        CT: cp,
        Reporter: 'CY5',
      });
    }
  }

  // Merge FAM and VIC and CY5 data
  raw = famData.concat(vicData, cy5Data);

  return {
    raw,
    runID,
  };
}

function resultPreprocessTower(raw, ntcWell, ctrl1Well, ctrl2Well) {
  let result = {
    control: {
      ntc: {
        name: "NTC", // If user did not define sample name, result would show 'NTC'
        well: ntcWell,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // rox
      },
      ctrl1: {
        // SMN1 copy 1
        name: "Standard 1", // If user did not define sample name, result would show 'Standard 1'
        well: ctrl1Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // rox
      },
      ctrl2: {
        // SMN1 copy 2
        name: "Standard 2", // If user did not define sample name, result would show 'Standard 2'
        well: ctrl2Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // rox
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct = (function () {
      let ct = Number(row.CT);
      if (
        ct === "No Ct" || // tower undetermined ct
        ct >= parameters.CT_UNDETERMINED_UPPERBOUND ||
        ct <= parameters.CT_UNDETERMINED_LOWERBOUND ||
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
        smn2: undefined, // vic
        rnp: undefined, // rox
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill the control sample name
    }
    if (row.Reporter === "ROX") {
      result[type][key].rnp = ct;
    } else if (row.Reporter === "VIC") {
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

function resultPreprocessQS3(raw, ntcWell, ctrl1Well, ctrl2Well) {
  let result = {
    control: {
      ntc: {
        name: "NTC", // If user did not define sample name, result would show 'NTC'
        well: ntcWell,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // tamra or rox
      },
      ctrl1: {
        // SMN1 copy 1
        name: "Standard 1", // If user did not define sample name, result would show 'Standard 1'
        well: ctrl1Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // tamra or rox
      },
      ctrl2: {
        // SMN1 copy 2
        name: "Standard 2", // If user did not define sample name, result would show 'Standard 2'
        well: ctrl2Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // tamra or rox
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct = (function () {
      let ct = Number(row.CT);
      if (
        ct === "Undetermined" || // qs3 undetermined ct
        ct >= parameters.CT_UNDETERMINED_UPPERBOUND ||
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
        smn2: undefined, // vic
        rnp: undefined, // tamra or rox
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill the control sample name
    }
    if (row.Reporter === "TAMRA" || row.Reporter === "ROX") {
      result[type][key].rnp = ct;
    } else if (row.Reporter === "VIC") {
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

function resultPreprocessZ480(raw, ntcWell, ctrl1Well, ctrl2Well) {
  let result = {
    control: {
      ntc: {
        name: "NTC", // If user did not define sample name, result would show 'NTC'
        well: ntcWell,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // cy5
      },
      ctrl1: {
        // SMN1 copy 1
        name: "Standard 1", // If user did not define sample name, result would show 'Standard 1'
        well: ctrl1Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // cy5
      },
      ctrl2: {
        // SMN1 copy 2
        name: "Standard 2", // If user did not define sample name, result would show 'Standard 2'
        well: ctrl2Well,
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // cy5
      },
    },
    sample: {},
  };

  function dataGrouping(row, type, key) {
    const ct = row.CT === ''
      ? 0
      : Number(row.CT);

    if (result[type][key] === undefined) {
      result[type][key] = {
        name: filenameParser(String(row.Name)),
        well: String(row.Position),
        smn1: undefined, // fam
        smn2: undefined, // vic
        rnp: undefined, // cy5
      };
    } else {
      result[type][key].name = filenameParser(String(row.Name)); // Fill the control sample name
    }
    if (row.Reporter === "CY5") {
      result[type][key].rnp = ct;
    } else if (row.Reporter === "VIC") {
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
    } else if (c === "ctrl1" || c === "ctrl2") {
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

  return {
    status,
    control
  }
}

function qcAssessmentTower(status, control) {
  let qc = {
    run_id: undefined,
    status: "meet-the-criteria",
    rnp_smn1_1n: undefined,
    rnp_smn1_2n: undefined,
    smn1_3n: 0,
    smn1_4n: 0,
    rnp_smn2_1n: undefined,
    rnp_smn2_2n: undefined,
    smn2_3n: 0,
    smn2_4n: 0,
  };

  if (
    status &&
    (control.ctrl1.rnp - control.ctrl1.smn1) > 0 &&
    (control.ctrl1.rnp - control.ctrl1.smn2) > 0 &&
    (control.ctrl2.rnp - control.ctrl2.smn1) > 0 &&
    (control.ctrl2.rnp - control.ctrl2.smn2) > 0
  ) {
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

    // Calculate delta Ct
    const delta_smn1_2n1n = parseFloat(
      (qc.rnp_smn1_2n - qc.rnp_smn1_1n).toPrecision(3)
    );
    const delta_smn2_2n1n = parseFloat(
      (qc.rnp_smn2_2n - qc.rnp_smn2_1n).toPrecision(3)
    );
    qc.smn1_3n = qc.rnp_smn1_2n + delta_smn1_2n1n;
    qc.smn2_3n = qc.rnp_smn2_2n + delta_smn2_2n1n;
    qc.smn1_4n = qc.smn1_3n + delta_smn1_2n1n;
    qc.smn2_4n = qc.smn2_3n + delta_smn2_2n1n;

  } else {
    qc.rnp_smn1_1n = 0;
    qc.rnp_smn2_1n = 0;
    qc.rnp_smn1_2n = 0;
    qc.rnp_smn2_2n = 0;
    qc.status = "fail-the-criteria";
    logger.error(`Missing some control data or RNP-SMN1, RNP-SMN2 is not > 0`);
  }

  return qc
}

function qcAssessmentQS3(status, control) {
  let qc = {
    run_id: undefined,
    status: "meet-the-criteria",
    rnp_smn1_1n: undefined,
    rnp_smn1_2n: undefined,
    smn1_3n: 0,
    smn1_4n: 0,
    rnp_smn2_1n: undefined,
    rnp_smn2_2n: undefined,
    smn2_3n: 0,
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

    // Calculate delta Ct
    const delta_smn1_2n1n = parseFloat(
      (qc.rnp_smn1_2n - qc.rnp_smn1_1n).toPrecision(3)
    );
    const delta_smn2_2n1n = parseFloat(
      (qc.rnp_smn2_2n - qc.rnp_smn2_1n).toPrecision(3)
    );
    qc.smn1_3n = qc.rnp_smn1_2n + delta_smn1_2n1n;
    qc.smn2_3n = qc.rnp_smn2_2n + delta_smn2_2n1n;
    qc.smn1_4n = qc.smn1_3n + delta_smn1_2n1n;
    qc.smn2_4n = qc.smn2_3n + delta_smn2_2n1n;

    // Criteria of delta Ct
    if (
      !(delta_smn1_2n1n >= parameters.STD_CRITERIA_SMN1_2n1n[0]) ||
      !(delta_smn1_2n1n <= parameters.STD_CRITERIA_SMN1_2n1n[1]) || 
      !(delta_smn2_2n1n >= parameters.STD_CRITERIA_SMN2_2n1n[0]) || 
      !(delta_smn2_2n1n <= parameters.STD_CRITERIA_SMN2_2n1n[1]) ||

      !(qc.rnp_smn1_2n > qc.rnp_smn1_1n) ||    // check rnp_smn1_2n > rnp_smn1_1n
      !(qc.rnp_smn2_2n > qc.rnp_smn2_1n)    // check rnp_smn2_2n > rnp_smn2_1n
    ) {
      console.log('Interval:', {
        SMN1_2N_1N: delta_smn1_2n1n,
        SMN2_2N_1N: delta_smn2_2n1n,
      })
      qc.status = "fail-the-criteria";
      logger.error(`Failed control criteria`);
    }
  } else {
    qc.rnp_smn1_1n = 0;
    qc.rnp_smn2_1n = 0;
    qc.rnp_smn1_2n = 0;
    qc.rnp_smn2_2n = 0;
    qc.status = "fail-the-criteria";
    logger.error(`Missing some control data`);
  }

  return qc
}

function qcAssessmentZ480(status, control) {
  let qc = {
    run_id: undefined,
    status: "meet-the-criteria",
    rnp_smn1_1n: undefined,
    rnp_smn1_2n: undefined,
    smn1_3n: 0,
    smn1_4n: 0,
    rnp_smn2_1n: undefined,
    rnp_smn2_2n: undefined,
    smn2_3n: 0,
    smn2_4n: 0,
  };

  if (
    status
  ) {
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

    // Calculate delta Ct
    const delta_smn1_2n1n = parseFloat(
      (qc.rnp_smn1_2n - qc.rnp_smn1_1n).toPrecision(3)
    );
    const delta_smn2_2n1n = parseFloat(
      (qc.rnp_smn2_2n - qc.rnp_smn2_1n).toPrecision(3)
    );
    qc.smn1_3n = qc.rnp_smn1_2n + delta_smn1_2n1n;
    qc.smn2_3n = qc.rnp_smn2_2n + delta_smn2_2n1n;
    qc.smn1_4n = qc.smn1_3n + delta_smn1_2n1n;
    qc.smn2_4n = qc.smn2_3n + delta_smn2_2n1n;

  } else {
    qc.rnp_smn1_1n = 0;
    qc.rnp_smn2_1n = 0;
    qc.rnp_smn1_2n = 0;
    qc.rnp_smn2_2n = 0;
    qc.status = "fail-the-criteria";
    logger.error(`Missing some control data or RNP-SMN1, RNP-SMN2 is not > 0`);
  }

  return qc
}

function qcAsseseementCustom(status, control) {
  let qc = {
    run_id: undefined,
    status: "meet-the-criteria",
    rnp_smn1_1n: undefined,
    rnp_smn1_2n: undefined,
    smn1_3n: 0,
    smn1_4n: 0,
    rnp_smn2_1n: undefined,
    rnp_smn2_2n: undefined,
    smn2_3n: 0,
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

    // Calculate delta Ct
    const delta_smn1_2n1n = parseFloat(
      (qc.rnp_smn1_2n - qc.rnp_smn1_1n).toPrecision(3)
    );
    const delta_smn2_2n1n = parseFloat(
      (qc.rnp_smn2_2n - qc.rnp_smn2_1n).toPrecision(3)
    );
    qc.smn1_3n = qc.rnp_smn1_2n + delta_smn1_2n1n;
    qc.smn2_3n = qc.rnp_smn2_2n + delta_smn2_2n1n;
    qc.smn1_4n = qc.smn1_3n + delta_smn1_2n1n;
    qc.smn2_4n = qc.smn2_3n + delta_smn2_2n1n;

    // Criteria of delta Ct
    if (
      (parameters.STD_CRITERIA_SMN1_2n1n[0] !== 0 && delta_smn1_2n1n < parameters.STD_CRITERIA_SMN1_2n1n[0]) ||
      (parameters.STD_CRITERIA_SMN1_2n1n[1] !== 0 && delta_smn1_2n1n > parameters.STD_CRITERIA_SMN1_2n1n[1]) ||
      (parameters.STD_CRITERIA_SMN2_2n1n[0] !== 0 && delta_smn2_2n1n < parameters.STD_CRITERIA_SMN2_2n1n[0]) ||
      (parameters.STD_CRITERIA_SMN2_2n1n[1] !== 0 && delta_smn2_2n1n > parameters.STD_CRITERIA_SMN2_2n1n[1])
    ) {
      console.log('Interval:', {
        SMN1_2N_1N: delta_smn1_2n1n,
        SMN2_2N_1N: delta_smn2_2n1n,
      })
      qc.status = "fail-the-criteria";
      logger.error(`Failed control criteria`);
    }
  } else {
    qc.rnp_smn1_1n = 0;
    qc.rnp_smn2_1n = 0;
    qc.rnp_smn1_2n = 0;
    qc.rnp_smn2_2n = 0;
    qc.status = "fail-the-criteria";
    logger.error(`Missing some control data`);
  }

  return qc
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
          message: `Fail to write JSON Object to ${JSON_OUTPUT}: \n${err}`,
        });
      }
      logger.info(`JSON file has been saved in ${JSON_OUTPUT}`);
    }
  );
  logger.info(`Logger are saved in ${JSON_DIR}`);
}

function typeCheck(input) {
  /* Check nput */
  if (typeof input.rawPath !== "string") {
    logger.error(`Input file path need to be a string.`);
    return false
  } else if (typeof input.rawPath === "undefined") {
    logger.error(`No Input file.`);
    return false
  } else if (typeof input.ntcWell === "undefined") {
    logger.error(`No well position for NTC been assigned.`);
    return false
  } else if (typeof input.ntcWell !== "string") {
    logger.error(`NTC well position need to be correct format. (e.g., A1)`);
    return false
  } else if (typeof input.ctrl1Well === "undefined") {
    logger.error(`No well position for Control-1 been assigned.`);
    return false
  } else if (typeof input.ctrl1Well !== "string") {
    logger.error(
      `Control-1 well position need to be correct format. (e.g., B1)`
    );
    return false
  } else if (typeof input.ctrl2Well === "undefined") {
    logger.error(`No well position for Control-2 been assigned.`);
    return false
  } else if (typeof input.ctrl2Well !== "string") {
    logger.error(
      `Control-2 well position need to be correct format. (e.g., C1)`
    );
    return false
  } else if (!['qs3', 'tower', 'z480'].includes(input.instrument)) {
    logger.error(
      `Instrument only support 'qs3' or 'tower' or 'z480'.`
    );
    return false
  } else if (!['accuinSma1', 'accuinSma2', 'accuinSma3'].includes(input.reagent)) {
    logger.error(
      `Reagent only support 'accuinSma1' or 'accuinSma2' or 'accuinSma3'.`
    );
    return false
  } else if (input.instrument === 'z480' && input.reagent !== 'accuinSma3') {
    logger.error(
      `Z480 only support 'accuinSma3'.`
    );
    return false
  } else {
    return true
  }
}

function mainRun(input) {
  /* Analysis */
  let raw;
  let control;
  let qc;
  let sample;
  let result;

  if (input.instrument === "tower" && input.analyzer !== "custom") {
    raw = rawReadT(input.rawPath);

    // Preprocessing
    result = resultPreprocessTower(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    let qcData = qcParsing(result.control);
    control = qcData.control;

    // QC assessment
    qc = qcAssessmentTower(qcData.status, control);
    qc.run_id = raw.runID;
  } else if (input.instrument === "z480" && input.analyzer !== "custom") {
    /* Z480 Parameters */
    parameters.SMN1_FACTOR = 0.47;
    parameters.SMN2_FACTOR = 0.52;

    raw = rawReadZ(input.famPath, input.vicPath, input.cy5Path);

    // Preprocessing
    result = resultPreprocessZ480(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    let qcData = qcParsing(result.control);
    control = qcData.control;

    // QC assessment
    qc = qcAssessmentZ480(qcData.status, control);
    qc.run_id = raw.runID;
  } else if (input.instrument === "qs3" && input.analyzer !== "custom") {
    raw = rawReadQ(input.rawPath);    // Read raw data (must have columns named in: "Position", "Name", "Reporter", "CT")

    // Preprocessing
    result = resultPreprocessQS3(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    let qcData = qcParsing(result.control);
    control = qcData.control;

    // QC assessment
    qc = qcAssessmentQS3(qcData.status, control);
    qc.run_id = raw.runID;
  } else {
    if (input.instrument === 'tower') {
      raw = rawReadT(input.rawPath);
      result = resultPreprocessTower(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    } else if (input.instrument === 'z480') {
      raw = rawReadZ(input.famPath, input.vicPath, input.cy5Path);
      result = resultPreprocessZ480(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    } else if (input.instrument === 'qs3') {
      raw = rawReadQ(input.rawPath);
      result = resultPreprocessQS3(raw.raw, input.ntcWell, input.ctrl1Well, input.ctrl2Well);
    }

    let qcData = qcParsing(result.control);
    control = qcData.control;
    qc = qcAsseseementCustom(qcData.status, control);
    qc.run_id = raw.runID;
  }

  // Support 'v1' and 'v2' and 'V3' and 'custom'
  let smn1_1n = qc.rnp_smn1_1n;
  let smn1_2n = qc.rnp_smn1_2n;
  let smn1_3n = qc.smn1_3n;
  let smn1_4n = qc.smn1_4n;
  let smn2_1n = qc.rnp_smn2_1n;
  let smn2_2n = qc.rnp_smn2_2n;
  let smn2_3n = qc.smn2_3n;
  let smn2_4n = qc.smn2_4n;
  let smn1_threshold = [];
  let smn2_threshold = [];

  if (input.analyzer === "v1") {
    sample = analysisv1(result.sample, qc, parameters);
    smn1_threshold = [
      smn1_1n, smn1_2n, smn1_3n
    ];
    smn2_threshold = [
      smn2_1n, smn2_2n, smn2_3n
    ];
  } else if (input.analyzer === "v2") {
    sample = analysisv2(result.sample, qc, parameters);
    smn1_threshold = [
      smn1_1n, smn1_2n, smn1_3n
    ];
    smn2_threshold = [
      (smn2_1n + smn2_2n) / 2,
      (smn2_2n + smn2_3n) / 2,
      (smn2_3n + smn2_4n) / 2,
    ];
  } else if (input.analyzer === "v3") {
    sample = analysisv3(result.sample, qc, parameters);
    smn1_threshold = [
        (smn1_1n + smn1_2n) / 2,
        (smn1_2n + smn1_3n) / 2,
        (smn1_3n + smn1_4n) / 2,
    ];
    smn2_threshold = [
      (smn2_1n + smn2_2n) / 2,
      (smn2_2n + smn2_3n) / 2,
      (smn2_3n + smn2_4n) / 2,
    ];
  } else if (input.analyzer === "custom") {
    sample = analysisCustom(result.sample, qc, parameters);
    smn1_threshold = [
      parameters.SMN1_1N_THRESHOLD,
      parameters.SMN1_2N_THRESHOLD,
      parameters.SMN1_3N_THRESHOLD,
    ];
    smn2_threshold = [
      parameters.SMN2_1N_THRESHOLD,
      parameters.SMN2_2N_THRESHOLD,
      parameters.SMN2_3N_THRESHOLD,
    ];
  } else {
    logger.error(`Analyzer only support 'v1' or 'v2' or 'v3' or 'custom'.`);
    process.exit()
  }

  let output = {
    parameters: {
      ...parameters,
      ...input.parameters,
      smn1_threshold,
      smn2_threshold,
    },
    config: {
      reagent: input.reagent,
      instrument: input.instrument,
      nucleus: "v3.8.5",
      analyzer: input.analyzer,
      logger: [ JSON_DIR, JSON_OUTPUT ],
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
  runSma: function (p) {
    logger.info("******* Running for SMA main process *******");

    /* Get Parameters */
    parameters = p.analyzer === 'custom'
      ? p.parameters
      : sma[p.instrument];

    const input = {
      rawPath: p.rawPath ? p.rawPath.trim() : "",
      ntcWell: p.ntcWell.trim(),
      ctrl1Well: p.ctrl1Well.trim(),
      ctrl2Well: p.ctrl2Well.trim(),
      instrument: p.instrument ? p.instrument.trim() : "qs3",
      reagent: p.reagent ? p.reagent.trim() : "accuinSma1",
      analyzer: p.analyzer ? p.analyzer.trim() : "v1",
      famPath: p.famPath ? p.famPath.trim() : "",
      vicPath: p.vicPath ? p.vicPath.trim() : "",
      cy5Path: p.cy5Path ? p.cy5Path.trim() : "",
      parameters: p.parameters ? p.parameters : {},
    }
    const check = typeCheck(input);

    if (check) {
      let output = mainRun(input);
      jsonOutput(JSON_OUTPUT, output);
      return output;
    } else {
      process.exit()
    }
  },
};

// Run by node
if (require.main === module) {
  module.exports.runSma({
    rawPath: argv.f,
    ntcWell: argv.n,
    ctrl1Well: argv.a,
    ctrl2Well: argv.b,
    instrument: argv.i,
    reagent: argv.r,
    analyzer: argv.m,
    famPath: argv.fam,
    vicPath: argv.vic,
    cy5Path: argv.cy5,
  });
}
