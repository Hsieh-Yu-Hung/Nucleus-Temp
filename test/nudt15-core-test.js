/**
 * Uni test script for nudt15-core
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/nudt15.js");

const nudt15Data = require(
  path.join(__dirname, "/examples/sample-config.json"))["nudt15"];

describe("NUDT15 core test", () => {
  nudt15Data.forEach((data) => {
    describe(`(${data.instrument}) (${data.reagent}) ${data.object} with test cases "${data.path}"`, () => {
      // Run core
      const nudt15ExamplePath = path.join(__dirname, data.path);

      let output;
      if (data.instrument === "z480") {
        output = core.runNudt15(
          "",
          data.control.nudt15.well,
          data.control.ntc.well,
          data.instrument,
          data.reagent,
          path.join(nudt15ExamplePath, data.fam.filename),
          path.join(nudt15ExamplePath, data.vic.filename)
        );
      } else if (data.instrument === "qs3") {
        output = core.runNudt15(
          path.join(nudt15ExamplePath, data.filename),
          data.control.nudt15.well,
          data.control.ntc.well,
          data.instrument,
          data.reagent,
        );
      } else {
        assert.fail(`Unrecognize instrument: ${data.instrument}.`);
      }

      it("Check output format", (done) => {
        typeCheck(output);
        done();
      });

      it("Check qc status", (done) => {
        // QC status
        assert.equal(
          output.qc.status,
          data.control.qc,
          `QC status should be ${data.control.qc}.`
        );
        done();
      });

      it ("Check output values", (done) => {
        for (let idx in output.sample) {
          valueCheck(output.sample[idx]);
        }
        done();
      });
    });
  });
});

function typeCheck(output) {
  assert.equal(typeof output, "object", "Core output should be object.");
  assert.notEqual(typeof output, null, "Core output cannot be null.");

  // Control
  assert.equal(
    typeof output.control,
    "object",
    "Control output should be object."
  );
  assert.notEqual(typeof output.control, null, "Control output cannot be null");
  [ "nudt15", "ntc" ].forEach((key) => {
    assert.equal(
      typeof output.control[key],
      "object",
      `Control ${key} output should be object.`
    );
    assert.notEqual(
      typeof output.control[key],
      null,
      `Control ${key} output cannot be null.`
    );
    assert.equal(
      typeof output.control[key].name,
      "string",
      `Control ${key} name should be string.`
    );
    assert.equal(
      typeof output.control[key].well,
      "string",
      `Control ${key} well should be string.`
    );
    assert.equal(
      typeof output.control[key].wt,
      "number",
      `Control ${key} wt should be number.`
    );
    assert.equal(
      typeof output.control[key].mut,
      "number",
      `Control ${key} mut should be number.`
    );
  });

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
      typeof s.wt,
      "number",
      `wt for sample ${s.name} output should be number.`
    );
    assert.equal(
      typeof s.mut,
      "number",
      `mut for sample ${s.name} output should be number.`
    );
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

function valueCheck(outputSample) {
  let assessmentType = outputSample.type.join('');
  let lowType = "cc";
  let highType = [ "tt", "ct" ];

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
      outputSample.type.length,
      2,
      `avaliable result: ${outputSample.name} should have 2 types data.`
    );
    assert.equal(
      assessmentType,
      lowType,
      `low-risk result: ${outputSample.name} should be ${lowType} type data.`
    );
  } else if (outputSample.assessment === "high-risk") {
    assert.equal(
      outputSample.type.length,
      2,
      `high-risk result: ${outputSample.name} should have 2 types data.`
    );
    assert.ok(
      assessmentType === highType[0] || assessmentType === highType[1],
      `high-risk result: ${outputSample.name} should be ${highType[0]} or ${highType[1]} type data.`
    );
  } else {
    assert.fail(`unrecognize sample assessment: ${outputSample.name}.`);
  }
}
