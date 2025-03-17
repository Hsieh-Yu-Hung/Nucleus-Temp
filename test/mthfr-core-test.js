/**
 * Uni test script for mthfr-core
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/mthfr.js");

const mthfrExamplePath = path.join(__dirname, "/examples/mthfr");

/*
  1 QC passed result
  1 QC failed result
**/
const mthfrSampleLst = [
  "qs3_pass_v1_E12_G12.xlsx",
  "qs3_fail_v1_E12_G12.xlsx",
  "tower_pass_v1_C9_C10.csv",
  "qs3_pass_v2_E5_F5.xls",
  [ "z480_pass_v3_FAM.txt", "z480_pass_v3_VIC.txt" ],
  [ "z480ii_pass_v3_FAM.txt", "z480ii_pass_v3_VIC.txt" ],
];

describe("MTHFR core test", () => {
  describe("- Check output JSON format", () => {
    /*
      "Meet the criteria" standard of QS3
    **/
    it("(QS3) Meet the criteria v1", (done) => {
      let meet_output = core.runMthfr(
        path.join(mthfrExamplePath, mthfrSampleLst[0]),
        "E12", // Control well
        "G12" // NTC well
      );
      assert.equal(
        meet_output.qc.status,
        "meet-the-criteria",
        'qc status for available control input should be "meet-the-criteria".'
      );
      typeCheck(meet_output, "accuinMTHFR1");

      // Sample
      meet_output.sample.forEach((sample) => {
        valueCheck(sample, "accuinMTHFR1");
      });

      done();
    });

    /*
      "Fail the criteria" standard of QS3
    **/
    it("(QS3) Fail the criteria v1", (done) => {
      let fail_output = core.runMthfr(
        path.join(mthfrExamplePath, mthfrSampleLst[1]),
        "E12", // Control well
        "G12" // NTC well
      );
      assert.equal(
        fail_output.qc.status,
        "fail-the-criteria",
        'qc status for available control input should be "fail-the-criteria".'
      );
      typeCheck(fail_output, "accuinMTHFR1");

      // Inconclusive Sample
      fail_output.sample.forEach((sample) => {
        assert.equal(
          sample.assessment,
          "inconclusive",
          'sample assessment when fail criteria should be "inconclusive".'
        );
        valueCheck(sample, "accuinMTHFR1");
      });

      done();
    });

    /*
      "Meet the criteria" standard of qTOWER
    **/
    it("(qTOWER) Meet the criteria v1", (done) => {
      let meet_output = core.runMthfr(
        path.join(mthfrExamplePath, mthfrSampleLst[2]),
        "C9", // Control well
        "C10", // NTC well
        "tower"
      );
      assert.equal(
        meet_output.qc.status,
        "meet-the-criteria",
        'qc status for available control input should be "meet-the-criteria".'
      );
      typeCheck(meet_output, "accuinMTHFR1");

      // Sample
      meet_output.sample.forEach((sample) => {
        valueCheck(sample, "accuinMTHFR1");
      });

      done();
    });

    /*
      "Meet the criteria" standard of QS3 v2
    **/
    it("(QS3) Meet the criteria v2", (done) => {
      let meet_output = core.runMthfr(
        path.join(mthfrExamplePath, mthfrSampleLst[3]),
        "E5", // Control well
        "F5", // NTC well
        "",
        "accuinMTHFR2"
      );
      assert.equal(
        meet_output.qc.status,
        "meet-the-criteria",
        'qc status for available control input should be "meet-the-criteria".'
      );
      typeCheck(meet_output, "accuinMTHFR2");

      // Sample
      meet_output.sample.forEach((sample) => {
        valueCheck(sample, "accuinMTHFR2");
      });

      done();
    });

    /*
      "Meet the criteria" standard of z480 v3
    **/
      it("(z480) Meet the criteria v3", (done) => {
        let meet_output = core.runMthfr(
          "",
          "G1", // Control well
          "H1", // NTC well
          "z480",
          "accuinMTHFR3",
          path.join(mthfrExamplePath, mthfrSampleLst[4][0]),
          path.join(mthfrExamplePath, mthfrSampleLst[4][1])
        );
        assert.equal(
          meet_output.qc.status,
          "meet-the-criteria",
          'qc status for available control input should be "meet-the-criteria".'
        );
        typeCheck(meet_output, "accuinMTHFR3");
  
        // Sample
        meet_output.sample.forEach((sample) => {
          valueCheck(sample, "accuinMTHFR3");
        });
  
        done();
      });

      it("(z480ii) Meet the criteria v3", (done) => {
        let meet_output = core.runMthfr(
          "",
          "A3", // Control well
          "A4", // NTC well
          "z480",
          "accuinMTHFR3",
          path.join(mthfrExamplePath, mthfrSampleLst[5][0]),
          path.join(mthfrExamplePath, mthfrSampleLst[5][1])
        );
        assert.equal(
          meet_output.qc.status,
          "meet-the-criteria",
          'qc status for available control input should be "meet-the-criteria".'
        );
        typeCheck(meet_output, "accuinMTHFR3");
  
        // Sample
        meet_output.sample.forEach((sample) => {
          valueCheck(sample, "accuinMTHFR3");
        });
  
        done();
      });
  });
});

function typeCheck(output, reagent) {
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
    typeof output.control.mthfr,
    "object",
    "Control output for mthfr should be object."
  );
  assert.notEqual(
    typeof output.control.mthfr,
    null,
    "Control output for mthfr cannot be null."
  );
  assert.equal(
    typeof output.control.mthfr.name,
    "string",
    "mthfr control name should be string."
  );
  assert.equal(
    typeof output.control.mthfr.well,
    "string",
    "mthfr control well should be string."
  );
  assert.equal(
    typeof output.control.mthfr.c677.wt,
    "number",
    "mthfr control c677 wt should be number."
  );
  assert.equal(
    typeof output.control.mthfr.c677.mut,
    "number",
    "mthfr control c677 mut should be number."
  );
  if (reagent === 'accuinMTHFR2') {
    assert.equal(
      typeof output.control.mthfr.c1298.wt,
      "number",
      "mthfr control c1298 wt should be number."
    );
    assert.equal(
      typeof output.control.mthfr.c1298.mut,
      "number",
      "mthfr control c1298 mut should be number."
    );
  }

  // QC
  assert.equal(typeof output.qc, "object", "qc output should be obeject.");
  assert.notEqual(typeof output.qc, null, "qc output cannot be null");
  assert.equal(typeof output.qc.runId, "string", "qc run_id should be string.");
  assert.equal(
    typeof output.qc.status,
    "string",
    "qc status should be string."
  );

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
      typeof s.c677.wt,
      "number",
      `c677 wt for sample ${s.name} output should be number.`
    );
    assert.equal(
      typeof s.c677.mut,
      "number",
      `mut for sample ${s.name} output should be number.`
    );
    if (reagent === 'accuinMTHFR2') {
      assert.equal(
        typeof s.c1298.wt,
        "number",
        `c1298 wt for sample ${s.name} output should be number.`
      );
      assert.equal(
        typeof s.c1298.mut,
        "number",
        `c1298 mut for sample ${s.name} output should be number.`
      );
    }
    assert.equal(
      Array.isArray(s.type),
      true,
      `type for sample ${s.name} output should be an string array.`
    );
    s.type.forEach((t) => {
      assert.equal(
        typeof t,
        "string",
        `type items for sample ${s.name} position should be string.`
      );
    });
    assert.equal(
      typeof s.assessment,
      "string",
      `assessment for sample ${s.name} output should be string.`
    );
  });
}

function valueCheck(outputSample, reagent) {
  let assessmentType = outputSample.type.join('');
  let normal = [
    'ccac',
    'ctaa',
    'cccc'
  ];
  let high = [
    'ctac',
    'ctcc',
    'ttac',
    'ttcc',
    'ttaa',
  ]

  if (outputSample.assessment === "inconclusive") {
    assert.equal(
      outputSample.type.length,
      0,
      `inconclusive result: ${outputSample.name} should not have type data.`
    );
  } else if (outputSample.assessment === "invalid") {
    assert.equal(
      outputSample.type.length,
      0,
      `invalid result: ${outputSample.name} should not have type data.`
    );
  } else if (outputSample.assessment === "low-risk") {
    assert.equal(
      outputSample.type.slice(0, 2).join(''),    // c677 type
      'cc',
      `low-risk result: ${outputSample.name} c677 should be "cc" type data.`
    );
    if ((reagent === 'accuinMTHFR1') || (reagent === 'accuinMTHFR3')) {
      assert.equal(
        outputSample.type.length,
        2,
        `avaliable result: ${outputSample.name} should have 2 types data.`
      );
    } else if (reagent === 'accuinMTHFR2') {
      assert.equal(
        outputSample.type.length,
        4,
        `avaliable result: ${outputSample.name} should have 4 types data.`
      );
      assert.equal(
        outputSample.type.slice(2, 4).join(''),    // c1298 type
        'aa',
        `low-risk result: ${outputSample.name} c1298 should be "aa" type data.`
      );
    }
  } else if (outputSample.assessment === "normal-risk") {
    if ((reagent === 'accuinMTHFR1') || (reagent === 'accuinMTHFR3')) {
      assert.equal(
        outputSample.type.length,
        2,
        `avaliable result: ${outputSample.name} should have 2 types data.`
      );
      assert.equal(
        outputSample.type.includes("c"),
        true,
        `normal-risk result: ${outputSample.name} c677 should have "c" type data.`
      );
      assert.equal(
        outputSample.type.includes("t"),
        true,
        `noraml-risk result: ${outputSample.name} c677 should have "t" type data.`
      );
    } else if (reagent === 'accuinMTHFR2') {
      assert.equal(
        outputSample.type.length,
        4,
        `avaliable result: ${outputSample.name} should have 4 types data.`
      );
      assert.equal(
        normal.includes(assessmentType),
        true,
        `noraml-risk result: ${outputSample.name} is not normal type data.`
      );
    }
  } else if (outputSample.assessment === "high-risk") {
    if ((reagent === 'accuinMTHFR1') || (reagent === 'accuinMTHFR3')) {
      assert.equal(
        outputSample.type.length,
        2,
        `avaliable result: ${outputSample.name} should have 2 types data.`
      );
      assert.equal(
        outputSample.type.includes("t"),
        true,
        `high-risk result: ${outputSample.name} c677 should have "t" type data.`
      );
      assert.notEqual(
        outputSample.type.includes("c"),
        true,
        `high-risk result: ${outputSample.name} should not have "c" type data.`
      );
    } else if (reagent === 'accuinMTHFR2') {
      assert.equal(
        outputSample.type.length,
        4,
        `avaliable result: ${outputSample.name} should have 4 types data.`
      );
      assert.equal(
        high.includes(assessmentType),
        true,
        `high-risk result: ${outputSample.name} is not high risk type data.`
      );
    }
  } else {
    assert.fail(`unrecognize sample assessment: ${outputSample.name}.`);
  }
}
