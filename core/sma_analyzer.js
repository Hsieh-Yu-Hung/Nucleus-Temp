/**
 * Analysis core for SMA v1 (Relax protocol) and SMA v2 (Restrict protocol)
 */

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
  return ["01", "02", "03", "04"].includes(typeArray);
}
function isInvalid(typeArray) {
  return ["00"].includes(typeArray);
}

// Calculate sample delta Ct value
function calculateDeltaCt(sampleRaw, qc) {
  let sample_output = new Array();

  for (let w in sampleRaw) {
    sampleRaw[w].smn1_type = 0;
    sampleRaw[w].smn2_type = 0;
    sampleRaw[w].rnp_smn1 = 0;
    sampleRaw[w].rnp_smn2 = 0;
    sampleRaw[w].assessment = "invalid";

    if (qc.status === "fail-the-criteria") {
      sampleRaw[w].assessment = "inconclusive";
      console.warn(`Sample assessment unsuccessful: fail the criteria`);
    } else if (qc.status === "meet-the-criteria") {
      // If sample has no rnp data
      if (sampleRaw[w].rnp === 0) {
        console.warn(
          `Sample assessment unsuccessful: ${w} sample has no rnp data for assessment.`
        );
      } else if (typeof sampleRaw[w].rnp === "number") {

        // If sample has smn1 data
        if (typeof sampleRaw[w].smn1 === "number") {
          sampleRaw[w].rnp_smn1 = parseFloat(
            (sampleRaw[w].rnp - sampleRaw[w].smn1).toPrecision(3)
          );
        } else if (sampleRaw[w].smn1 !== 0) {
          console.warn(
            `Sample assessment unsuccessful: Cannot determined ${w} sample smn1 data.`
          );
          sampleRaw[w].rnp_smn1 = 0;
          sampleRaw[w].rnp_smn2 = 0;
        }

        // If sample has smn2 data
        if (typeof sampleRaw[w].smn2 === "number") {
          sampleRaw[w].rnp_smn2 = parseFloat(
            (sampleRaw[w].rnp - sampleRaw[w].smn2).toPrecision(3)
          );
        } else if (sampleRaw[w].smn2 !== 0) {
          console.warn(
            `Sample assessment unsuccessful: Cannot determined ${w} sample smn2 data.`
          );
        }
      } else {
        console.warn(
          `Sample assessment unsuccessful: Cannot determined ${w} sample rnp data`
        );
      }
    }

    sample_output.push(sampleRaw[w]);
  }

  return sample_output;
}

/**
 * Analyzer v1
 * loose threshold for client side
 */
function analyzerV1(sampleRow, qc) {
  let smn1_type = 0;
  let smn2_type = 0;

  if (
    qc.status === "meet-the-criteria"
    && typeof sampleRow.rnp === "number"
    && typeof sampleRow.smn1 === "number"
    && typeof sampleRow.smn2 === "number"
    && sampleRow.rnp !== 0
  ) {
    if (!(sampleRow.smn1 === 0 && sampleRow.smn2 === 0)) {
      // SMN1
      const smn1_lst = qc.rnp_smn1_3n    // If rnp_smn1_3n is not defined, use smn1_3n
        ? [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.rnp_smn1_3n, qc.smn1_4n ]
        : [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.smn1_3n, qc.smn1_4n ];
      if (sampleRow.smn1 === 0) {
        smn1_type = 0;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[0]) {
        smn1_type = 1;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[1]) {
        smn1_type = 2;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[2]) {
        smn1_type = 3;
      } else if (sampleRow.rnp_smn1 > smn1_lst[2]) {
        smn1_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful:  cannot define smn1 type of result assessment: ${sampleRow.rnp_smn1}`
        );
      }

      // SMN2
      const smn2_lst = qc.rnp_smn2_3n    // If rnp_smn2_3n is not defined, use smn2_3n
        ? [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.rnp_smn2_3n, qc.smn2_4n ]
        : [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.smn2_3n, qc.smn2_4n ];
      if (sampleRow.smn2 === 0) {
        smn2_type = 0;
      } else if (sampleRow.rnp_smn2 <= smn2_lst[0]) {
        smn2_type = 1;
      } else if (sampleRow.rnp_smn2 <= smn2_lst[1]) {
        smn2_type = 2;
      } else if (sampleRow.rnp_smn2 <= smn2_lst[2]) {
        smn2_type = 3;
      } else if (sampleRow.rnp_smn2 > smn2_lst[2]) {
        smn2_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn2 type of result assessment: ${sampleRow.rnp_smn2}`
        );
      
      }
    }
  }

  return { smn1_type, smn2_type };
}

/** 
 * Analyzer v2
 * 1/2 restriction for lab protocol
 */
function analyzerV2(sampleRow, qc) {
  let smn1_type = 0;
  let smn2_type = 0;

  if (
    qc.status === "meet-the-criteria"
    && typeof sampleRow.rnp === "number"
    && typeof sampleRow.smn1 === "number"
    && typeof sampleRow.smn2 === "number"
    && sampleRow.rnp !== 0
  ) {
    if (!(sampleRow.smn1 === 0 && sampleRow.smn2 === 0)) {
      // SMN1
      const smn1_lst = qc.rnp_smn1_3n    // If rnp_smn1_3n is not defined, use smn1_3n
        ? [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.rnp_smn1_3n, qc.smn1_4n ]
        : [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.smn1_3n, qc.smn1_4n ];
      if (sampleRow.smn1 === 0) {
        smn1_type = 0;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[0]) {
        smn1_type = 1;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[1]) {
        smn1_type = 2;
      } else if (sampleRow.rnp_smn1 <= smn1_lst[2]) {
        smn1_type = 3;
      } else if (sampleRow.rnp_smn1 > smn1_lst[2]) {
        smn1_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn1 type of result assessment: ${sampleRow.rnp_smn1}`
        );
      }

      // SMN2
      const smn2_lst = qc.rnp_smn2_3n    // If rnp_smn2_3n is not defined, use smn2_3n
        ? [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.rnp_smn2_3n, qc.smn2_4n ]
        : [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.smn2_3n, qc.smn2_4n ];
      const smn2_distance_lst = [
        (smn2_lst[1] + smn2_lst[0]) / 2,
        (smn2_lst[2] + smn2_lst[1]) / 2,
        (smn2_lst[3] + smn2_lst[2]) / 2,
      ];
      if (sampleRow.smn2 === 0) {
        smn2_type = 0;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[0]) {
        smn2_type = 1;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[1]) {
        smn2_type = 2;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[2]) {
        smn2_type = 3;
      } else if (sampleRow.rnp_smn2 > smn2_distance_lst[2]) {
        smn2_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn2 type of result assessment: ${sampleRow.rnp_smn2}`
        );
      }
    }
  }

  return { smn1_type, smn2_type };
}

/**
 * Analyzer v3
 * 1/3 (SMN1) and 2/3 (SMN2) restriction for Z480 protocol
 * use factor for RNP-SMN1 and RNP-SMN2
 */
function analyzerV3(sampleRow, qc) {
  let smn1_type = 0;
  let smn2_type = 0;

  if (
    qc.status === "meet-the-criteria"
    && typeof sampleRow.rnp === "number"
    && typeof sampleRow.smn1 === "number"
    && typeof sampleRow.smn2 === "number"
    && sampleRow.rnp !== 0
  ) {
    if (!(sampleRow.smn1 === 0 && sampleRow.smn2 === 0)) {
      // SMN1
      const smn1_lst = qc.rnp_smn1_3n    // If rnp_smn1_3n is not defined, use smn1_3n
        ? [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.rnp_smn1_3n, qc.smn1_4n ]
        : [ qc.rnp_smn1_1n, qc.rnp_smn1_2n, qc.smn1_3n, qc.smn1_4n ];
      const smn1_distance_lst = [
        (smn1_lst[1] + smn1_lst[0]) / 2,
        (smn1_lst[2] + smn1_lst[1]) / 2,
        (smn1_lst[3] + smn1_lst[2]) / 2,
      ];
      if (sampleRow.smn1 === 0) {
        smn1_type = 0;
      } else if (sampleRow.rnp_smn1 <= smn1_distance_lst[0]) {
        smn1_type = 1;
      } else if (sampleRow.rnp_smn1 <= smn1_distance_lst[1]) {
        smn1_type = 2;
      } else if (sampleRow.rnp_smn1 <= smn1_distance_lst[2]) {
        smn1_type = 3;
      } else if (sampleRow.rnp_smn1 > smn1_distance_lst[2]) {
        smn1_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful:  cannot define smn1 type of result assessment: ${sampleRow.rnp_smn1}`
        );
      }

      // SMN2
      const smn2_lst = qc.rnp_smn2_3n    // If rnp_smn2_3n is not defined, use smn2_3n
        ? [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.rnp_smn2_3n, qc.smn2_4n ]
        : [ qc.rnp_smn2_1n, qc.rnp_smn2_2n, qc.smn2_3n, qc.smn2_4n ];
      const smn2_distance_lst = [
        (smn2_lst[1] + smn2_lst[0]) / 2,
        (smn2_lst[2] + smn2_lst[1]) / 2,
        (smn2_lst[3] + smn2_lst[2]) / 2,
      ];
      if (sampleRow.smn2 === 0) {
        smn2_type = 0;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[0]) {
        smn2_type = 1;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[1]) {
        smn2_type = 2;
      } else if (sampleRow.rnp_smn2 <= smn2_distance_lst[2]) {
        smn2_type = 3;
      } else if (sampleRow.rnp_smn2 > smn2_distance_lst[2]) {
        smn2_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn2 type of result assessment: ${sampleRow.rnp_smn2}`
        );
      
      }
    }
  }

  return { smn1_type, smn2_type };
}

// Calculate sample type with custom threshold
function analyzerCustom(sampleRow, qc, parameters) {
  let smn1_type = 0;
  let smn2_type = 0;

  if (
    qc.status === "meet-the-criteria"
    && typeof sampleRow.rnp === "number"
    && typeof sampleRow.smn1 === "number"
    && typeof sampleRow.smn2 === "number"
    && sampleRow.rnp !== 0
  ) {
    if (!(sampleRow.smn1 === 0 && sampleRow.smn2 === 0)) {
      // SMN1
      const smn1_threshold_lst = [
        parameters.SMN1_1N_THRESHOLD,
        parameters.SMN1_2N_THRESHOLD,
        parameters.SMN1_3N_THRESHOLD,
      ];
      if (sampleRow.smn1 === 0) {
        smn1_type = 0;
      } else if (sampleRow.rnp_smn1 <= smn1_threshold_lst[0]) {
        smn1_type = 1;
      } else if (sampleRow.rnp_smn1 <= smn1_threshold_lst[1]) {
        smn1_type = 2;
      } else if (sampleRow.rnp_smn1 <= smn1_threshold_lst[2]) {
        smn1_type = 3;
      } else if (sampleRow.rnp_smn1 > smn1_threshold_lst[2]) {
        smn1_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn1 type of result assessment: ${sampleRow.rnp_smn1}`
        );
      }

      // SMN2
      const smn2_threshold_lst = [
        parameters.SMN2_1N_THRESHOLD,
        parameters.SMN2_2N_THRESHOLD,
        parameters.SMN2_3N_THRESHOLD,
      ];
      if (sampleRow.smn2 === 0) {
        smn2_type = 0;
      } else if (sampleRow.rnp_smn2 <= smn2_threshold_lst[0]) {
        smn2_type = 1;
      } else if (sampleRow.rnp_smn2 <= smn2_threshold_lst[1]) {
        smn2_type = 2;
      } else if (sampleRow.rnp_smn2 <= smn2_threshold_lst[2]) {
        smn2_type = 3;
      } else if (sampleRow.rnp_smn2 > smn2_threshold_lst[2]) {
        smn2_type = 4;
      } else {
        console.warn(
          `Sample assessment unsuccessful: cannot define smn2 type of result assessment: ${sampleRow.rnp_smn2}`
        );
      }
    }
  }

  return { smn1_type, smn2_type };
}

// SMN type interpretation
function smnTypeInterpretation(smn1, smn2) {
  let type = String(smn1) + String(smn2);
  
  if (isNormal(type)) {
    // Defined "Noraml" by SMN1:SMN2 =
    // 2:0 or 2:1 or 2:2 or 2:3 or 2:4 or
    // 3:0 or 3:1 or 3:2 or 3:3 or 3:4 or
    // 4:1 or 4:2 or 4:3 or 4:4
    return "normal";
  } else if (isCarrier(type)) {
    // Defined "SMA carrier" by SMN1:SMN2 =
    // 1:0 or 1:1 or 1:2 or 1:3 or 1:4
    return "carrier";
  } else if (isAffected(type)) {
    if (smn2 === 2) {
      // Defined "SMA affected (Werdnig-Hoffmann Disease)" by SMN1:SMN2 =
      // 0:2
      return "affected-weho";
    } else if (smn2 === 3) {
      // Defined "SMA affected (Dubowitz Disease)" by SMN1:SMN2 =
      // 0:3
      return "affected-dubo";
    } else if (smn2 === 1) {
      // Defined "SMA affected" by SMN1:SMN2 =
      // 0:1
      return "affected";
    } else if (smn2 === 4) {
      // Defined "SMA affected (Kugelberg-Welander Disease)" by SMN1:SMN2 =
      // 0:4
      return "affected-kuwel";
    }
  } else if (isInvalid(type)) {
    // Defined "Invalid" (nonsense value) by SMN1:SMN2 =
    // 0:0
    return "invalid";
  } else {
    console.warn(
      `Sample assessment unsuccessful: cannot define sma type of result assessment: ${type}`
    );
    return "invalid"
  }

}

// Run by called
module.exports = {
  analysisv1: function (sampleRaw, qc, parameters) {
    console.log("******* Run SMA Analyzer v1 (Relax) *******");

    // Calculate delta Ct
    var sample = calculateDeltaCt(sampleRaw, qc);

    // Sample Analysis
    if (qc.status === "meet-the-criteria") {
      for (let w in sample) {
        // Use factor to adjust the sample
        if (parameters && parameters.SMN1_FACTOR && parameters.SMN1_FACTOR !== 0) {
          sample[w].rnp_smn1 = sample[w].rnp_smn1 - parameters.SMN1_FACTOR;
        }
        if (parameters && parameters.SMN2_FACTOR && parameters.SMN2_FACTOR !== 0) {
          sample[w].rnp_smn2 = sample[w].rnp_smn2 - parameters.SMN2_FACTOR;
        }

        sample[w].smn1_type = analyzerV1(sample[w], qc).smn1_type;
        sample[w].smn2_type = analyzerV1(sample[w], qc).smn2_type;
        sample[w].assessment = smnTypeInterpretation(sample[w].smn1_type, sample[w].smn2_type);
      }
    }

    return sample;
  },
  analysisv2: function (sampleRaw, qc, parameters) {
    console.log("******* Run SMA Analyzer v2 (Restrict) *******");

    // Calculate delta Ct
    var sample = calculateDeltaCt(sampleRaw, qc);

    // Sample Analysis
    if (qc.status === "meet-the-criteria") {
      for (let w in sample) {
        // Use factor to adjust the sample
        if (parameters && parameters.SMN1_FACTOR && parameters.SMN1_FACTOR !== 0) {
          sample[w].rnp_smn1 = sample[w].rnp_smn1 - parameters.SMN1_FACTOR;
        }
        if (parameters && parameters.SMN2_FACTOR && parameters.SMN2_FACTOR !== 0) {
          sample[w].rnp_smn2 = sample[w].rnp_smn2 - parameters.SMN2_FACTOR;
        }

        sample[w].smn1_type = analyzerV2(sample[w], qc).smn1_type;
        sample[w].smn2_type = analyzerV2(sample[w], qc).smn2_type;
        sample[w].assessment = smnTypeInterpretation(sample[w].smn1_type, sample[w].smn2_type);
      }
    }

    return sample;
  },
  analysisv3: function (sampleRaw, qc, parameters) {
    console.log("******* Run SMA Analyzer v3 (Z480) *******");

    // Calculate delta Ct
    var sample = calculateDeltaCt(sampleRaw, qc);

    // Sample Analysis
    if (qc.status === "meet-the-criteria") {
      for (let w in sample) {
        // Use factor to adjust the sample
        if (parameters && parameters.SMN1_FACTOR && parameters.SMN1_FACTOR !== 0) {
          sample[w].rnp_smn1 = sample[w].rnp_smn1 - parameters.SMN1_FACTOR;
        }
        if (parameters && parameters.SMN2_FACTOR && parameters.SMN2_FACTOR !== 0) {
          sample[w].rnp_smn2 = sample[w].rnp_smn2 - parameters.SMN2_FACTOR;
        }

        sample[w].smn1_type = analyzerV3(sample[w], qc).smn1_type;
        sample[w].smn2_type = analyzerV3(sample[w], qc).smn2_type;
        sample[w].assessment = smnTypeInterpretation(sample[w].smn1_type, sample[w].smn2_type);
      }
    }

    return sample;
  },
  analysisCustom: function (sampleRaw, qc, parameters) {
    console.log("******* Run SMA Analyzer with custom threshold *******");

    // Calculate delta Ct
    var sample = calculateDeltaCt(sampleRaw, qc);

    // Sample Analysis
    if (qc.status === "meet-the-criteria") {
      for (let w in sample) {
        // Use factor to adjust the sample
        if (parameters && parameters.SMN1_FACTOR && parameters.SMN1_FACTOR !== 0) {
          sample[w].rnp_smn1 = sample[w].rnp_smn1 - parameters.SMN1_FACTOR;
        }
        if (parameters && parameters.SMN2_FACTOR && parameters.SMN2_FACTOR !== 0) {
          sample[w].rnp_smn2 = sample[w].rnp_smn2 - parameters.SMN2_FACTOR;
        }

        sample[w].smn1_type = analyzerCustom(sample[w], qc, parameters).smn1_type;
        sample[w].smn2_type = analyzerCustom(sample[w], qc, parameters).smn2_type;
        sample[w].assessment = smnTypeInterpretation(sample[w].smn1_type, sample[w].smn2_type);
      }
    }

    return sample;
  }
};
