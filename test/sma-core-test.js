/**
 * Uni test script for sma-core & sma-core-dummy
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/sma.js");

const smaData = require(
  path.join(__dirname, "/examples/sample-config.json")
)["sma"];

describe("SMA core test", () => {
  describe("--- Analyzer v1 ---", () => {
    smaData.forEach((data) => {
      describe(`(${data.instrument}) (${data.reagent}) ${data.object} with test cases "${data.filename ? data.filename : data.fam.filename}"`, () => {
        // Run core
        const smaExamplePath = path.join(__dirname, data.path);
        let output = core.runSma({
          rawPath: data.instrument === 'z480'
            ? ''
            : path.join(smaExamplePath, data.filename),
          ntcWell: data.control.ntc.well,
          ctrl1Well: data.control.ctrl1.well,
          ctrl2Well: data.control.ctrl2.well,
          famPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.fam.filename)
            : '',
          vicPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.vic.filename)
            : '',
          cy5Path: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.cy5.filename)
            : '',
          instrument: data.instrument,
          reagent: data.reagent,
          analyzer: "v1"
        });

        it("Check output format", (done) => {
          typeCheck(output, data.instrument);
          done();
        });

        it("Check qc status", (done) => {
          assert.equal(
            output.qc.status,
            data.control.qc,
            `qc status for control input should be ${data.control.qc}.`
          );
          done();
        });

        it("Check output values", (done) => {
          for (let sample of output.sample) {
            valueCheck(sample);
          };
          done();
        });
      });
    });
  });

  describe("--- Analyzer v2 ---", () => {
    smaData.forEach((data) => {
      describe(`(${data.instrument}) (${data.reagent}) ${data.object} with test cases "${data.filename ? data.filename : data.fam.filename}"`, () => {
        // Run core
        const smaExamplePath = path.join(__dirname, data.path);
        let output = core.runSma({
          rawPath: data.instrument === 'z480'
            ? ''
            : path.join(smaExamplePath, data.filename),
          ntcWell: data.control.ntc.well,
          ctrl1Well: data.control.ctrl1.well,
          ctrl2Well: data.control.ctrl2.well,
          famPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.fam.filename)
            : '',
          vicPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.vic.filename)
            : '',
          cy5Path: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.cy5.filename)
            : '',
          instrument: data.instrument,
          reagent: data.reagent,
          analyzer: "v2",
        });

        it("Check output format", (done) => {
          typeCheck(output, data.instrument);
          done();
        });

        it("Check qc status", (done) => {
          assert.equal(
            output.qc.status,
            data.control.qc,
            `qc status for control input should be ${data.control.qc}.`
          );
          done();
        });

        it("Check output values", (done) => {
          for (let sample of output.sample) {
            valueCheck(sample);
          };
          done();
        });
      });
    });
  });

  describe("--- Analyzer Custom ---", () => {
    for (let data of smaData) {
      describe(`(${data.instrument}) (${data.reagent}) ${data.object} with test cases "${data.filename ? data.filename : data.fam.filename}"`, () => {
        // Run core
        const smaExamplePath = path.join(__dirname, data.path);
        let output = core.runSma({
          rawPath: data.instrument === 'z480'
            ? ''
            : path.join(smaExamplePath, data.filename),
          ntcWell: data.control.ntc.well,
          ctrl1Well: data.control.ctrl1.well,
          ctrl2Well: data.control.ctrl2.well,
          famPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.fam.filename)
            : '',
          vicPath: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.vic.filename)
            : '',
          cy5Path: data.instrument === 'z480'
            ? path.join(smaExamplePath, data.cy5.filename)
            : '',
          instrument: data.instrument,
          reagent: data.reagent,
          analyzer: "custom",

          // Custom parameters
          parameters: {
            STD_CRITERIA_SMN1_2n1n: [ 0, 0 ],
            STD_CRITERIA_SMN1_3n2n: [ 0.58, 1.29 ],
            STD_CRITERIA_SMN2_2n1n: [ 0, 0 ],
            STD_CRITERIA_SMN2_3n2n: [ 0.48, 1.44 ],
            SMN1_1N_THRESHOLD: 1.24,
            SMN1_2N_THRESHOLD: 0.87,
            SMN1_3N_THRESHOLD: 0.62,
            SMN2_1N_THRESHOLD: 1.14,
            SMN2_2N_THRESHOLD: 0.75,
            SMN2_3N_THRESHOLD: 0.51,
            CT_UNDETERMINED_LOWERBOUND: 0,
            CT_UNDETERMINED_UPPERBOUND: 30,
            SMN1_FACTOR: 0.5,
            SMN2_FACTOR: 0.63,
          },
        });

        it("Check output format", (done) => {
          typeCheck(output, data.instrument);
          done();
        });

        it("Check qc status", (done) => {
          assert.equal(
            output.qc.status,
            data.control.qc,
            `qc status for control input should be ${data.control.qc}.`
          );
          done();
        });

        it("Check output values", (done) => {
          for (let sample of output.sample) {
            valueCheck(sample);
          };
          done();
        });
      });
    };
  });
});

function typeCheck(output, instrument) {
  assert.equal(typeof output, "object", "Core output should be object.");
  assert.notEqual(typeof output, null, "Core output cannot be null.");

  // Control
  assert.equal(
    typeof output.control,
    "object",
    "Control output should be object."
  );
  assert.notEqual(typeof output.control, null, "Control output cannot be null");
  assert.equal(
    typeof output.control.ntc,
    "object",
    "Control output for ntc should be object."
  );
  assert.notEqual(
    typeof output.control.ntc,
    null,
    "Control output for ntc cannot be null."
  );
  assert.equal(
    typeof output.control.ctrl1,
    "object",
    "Control output for ctrl1 should be object."
  );
  assert.notEqual(
    typeof output.control.ctrl1,
    null,
    "Control output for ctrl1 cannot be null."
  );
  assert.equal(
    typeof output.control.ctrl2,
    "object",
    "Control output for ctrl2 should be object."
  );
  assert.notEqual(
    typeof output.control.ctrl2,
    null,
    "Control output for ctrl2 cannot be null."
  );
  assert.equal(
    typeof output.control.ntc.name,
    "string",
    "name of control output for ntc should be string."
  );
  assert.equal(
    typeof output.control.ntc.well,
    "string",
    "well of control output for ntc should be string."
  );
  assert.equal(
    typeof output.control.ctrl1.name,
    "string",
    "name of control output for ctrl1 should be string."
  );
  assert.equal(
    typeof output.control.ctrl1.well,
    "string",
    "well of control output for ctrl1 should be string."
  );
  assert.equal(
    typeof output.control.ctrl2.name,
    "string",
    "name of control output for ctrl2 should be string."
  );
  assert.equal(
    typeof output.control.ctrl2.well,
    "string",
    "well of control output for ctrl2 should be string."
  );
  assert.equal(
    typeof output.control.ntc.smn1,
    "number",
    "smn1 value in control ntc should be number."
  );
  assert.equal(
    typeof output.control.ntc.smn2,
    "number",
    "smn2 value in control ntc should be number."
  );
  assert.equal(
    typeof output.control.ntc.rnp,
    "number",
    "rnp value in control ntc should be number."
  );
  assert.equal(
    typeof output.control.ctrl1.smn1,
    "number",
    "smn1 value in control ctrl1 should be number."
  );
  assert.equal(
    typeof output.control.ctrl1.smn2,
    "number",
    "smn2 value in control ctrl1 should be number."
  );
  assert.equal(
    typeof output.control.ctrl1.rnp,
    "number",
    "rnp value in control ctrl1 should be number."
  );
  assert.equal(
    typeof output.control.ctrl2.smn1,
    "number",
    "smn1 value in control ctrl2 should be number."
  );
  assert.equal(
    typeof output.control.ctrl2.smn2,
    "number",
    "smn2 value in control ctrl2 should be number."
  );
  assert.equal(
    typeof output.control.ctrl2.rnp,
    "number",
    "rnp value in control ctrl2 should be number."
  );

  // QC
  assert.equal(typeof output.qc, "object", "qc output should be obeject.");
  assert.notEqual(typeof output.qc, null, "qc output cannot be null");
  assert.equal(
    typeof output.qc.run_id,
    "string",
    "qc run_id should be string."
  );
  assert.equal(
    typeof output.qc.status,
    "string",
    "qc status should be string."
  );
  assert.equal(
    typeof output.qc.rnp_smn1_1n,
    "number",
    "QC output for rnp_smn1_1n should be number."
  );
  assert.equal(
    typeof output.qc.rnp_smn1_2n,
    "number",
    "QC output for rnp_smn1_2n should be number."
  );
  if (instrument === 'qs3') {
    assert.equal(
      typeof output.qc.smn1_3n,
      "number",
      "QC output for smn1_3n should be number."
    );
    assert.equal(
      typeof output.qc.smn1_4n,
      "number",
      "QC output for smn1_4n should be number."
    );
  }
  assert.equal(
    typeof output.qc.rnp_smn2_1n,
    "number",
    "QC output for rnp_smn2_1n should be number."
  );
  assert.equal(
    typeof output.qc.rnp_smn2_2n,
    "number",
    "QC output for rnp_smn2_2n should be number."
  );
  if (instrument === 'qs3') {
    assert.equal(
      typeof output.qc.smn2_3n,
      "number",
      "QC output for smn2_3n should be number."
    );
    assert.equal(
      typeof output.qc.smn2_4n,
      "number",
      "QC output for smn2_4n should be number."
    );
  }

  // Sample
  assert.equal(
    Array.isArray(output.sample),
    true,
    "sample output should be an array."
  );
  output.sample.forEach((s) => {
    assert.equal(
      typeof s,
      "object",
      `sample ${s.name} output should be obeject.`
    );
    assert.notEqual(typeof s, null, `sample ${s.name} output cannot be null`);
    assert.equal(
      typeof s.name,
      "string",
      `name for sample ${s.name} output should be string.`
    );
    assert.equal(
      typeof s.well,
      "string",
      `well for sample ${s.name} position should be string.`
    );
    assert.equal(
      typeof s.smn1,
      "number",
      `SMN1 result for sample ${s.name} output should be string.`
    );
    assert.equal(
      typeof s.smn2,
      "number",
      `SMN2 result for sample ${s.name} output should be string.`
    );
    assert.equal(
      typeof s.rnp,
      "number",
      `RNP result for sample ${s.name} output should be string.`
    );
    assert.equal(
      typeof s.assessment,
      "string",
      `assessment for sample ${s.name} output should be string.`
    );
    assert.equal(
      Number.isSafeInteger(s.smn1_type),
      true,
      `type for sample ${s.name} smn1_type should be integer.`
    );
    assert.equal(
      Number.isSafeInteger(s.smn2_type),
      true,
      `type for sample ${s.name} smn2_type should be integer.`
    );
    assert.equal(
      typeof s.rnp_smn1,
      "number",
      `rnp_smn1 for sample ${s.name} output should be number.`
    );
    assert.equal(
      typeof s.rnp_smn2,
      "number",
      `rnp_smn2 for sample ${s.name} output should be number.`
    );
    assert.equal(
      typeof s.assessment,
      "string",
      `assessment for sample ${s.name} output should be string.`
    );
  });
}

function valueCheck(outputSample) {
  if (outputSample.assessment === "inconclusive") {
    assert.equal(
      outputSample.smn1_type,
      0,
      `inconclusive result: ${outputSample.name} smn1_type should be 0.`
    );
    assert.equal(
      outputSample.smn2_type,
      0,
      `inconclusive result: ${outputSample.name} smn2_type should be 0.`
    );
  } else if (
    outputSample.assessment === "affected"
  ) {
    assert.equal(
      outputSample.smn1_type,
      0,
      `SMA affected result: ${outputSample.name} should be 0 with smn1_type data.`
    );
    assert.equal(
      outputSample.smn2_type,
      1,
      `SMA affected result: ${outputSample.name} should be 1 with smn2_type data.`
    );
  } else if (
    outputSample.assessment === "affected-kuwel"
  ) {
    assert.equal(
      outputSample.smn1_type,
      0,
      `SMA affected (Kugelberg-Welander Disease) result: ${outputSample.name} should be 0 with smn1_type data.`
    );
    assert.equal(
      outputSample.smn2_type,
      4,
      `SMA affected (Kugelberg-Welander Disease) result: ${outputSample.name} should be 4 with smn2_type data.`
    );
  } else if (outputSample.assessment === "carrier") {
    assert.equal(
      outputSample.smn1_type,
      1,
      `SMA carrier result: ${outputSample.name} should be 1 with smn1_type data.`
    );
  } else if (outputSample.assessment === "normal") {
    assert(
      [2, 3, 4].includes(outputSample.smn1_type),
      `SMA normal result: ${outputSample.name} should be 2 or 3 or 4 with smn1_type data.`
    );
  } else if (
    outputSample.assessment === "affected-weho"
  ) {
    assert.equal(
      outputSample.smn1_type,
      0,
      `SMA affected (Werdnig-Hoffmann Disease) result: ${outputSample.name} should be 0 with smn1_type data.`
    );
    assert.equal(
      outputSample.smn2_type,
      2,
      `SMA affected (Werdnig-Hoffmann Disease) result: ${outputSample.name} should be 2 with smn2_type data.`
    );
  } else if (outputSample.assessment === "invalid") {
    assert.equal(
      outputSample.smn1_type,
      0,
      `invalid result: ${outputSample.name} smn1_type should be 0.`
    );
    assert.equal(
      outputSample.smn2_type,
      0,
      `invalid result: ${outputSample.name} smn2_type should be 0.`
    );
  } else if (outputSample.assessment === "affected-dubo") {
    assert.equal(
      outputSample.smn1_type,
      0,
      `SMA affected (Dubowitz disease) result: ${outputSample.name} should be 0 with smn1_type data.`
    );
    assert.equal(
      outputSample.smn2_type,
      3,
      `SMA affected (Dubowitz disease) result: ${outputSample.name} should be 3 with smn1_type data.`
    );
  } else {
    assert.fail(`unrecognize sample assessment: ${outputSample.name}: ${outputSample.assessment}.`);
  }
}
