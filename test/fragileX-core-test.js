/**
 * Uni test script for nucleus/fragileX-core.js
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/fragileX.js");

const fxData = require(path.join(__dirname, "/examples/sample-config.json"))[
  "fx"
];

describe("Fragile X core test", () => {
  fxData.forEach(function (data) {
    describe(`(${data.instrument}) (${data.reagent}) ${data.object} with test cases "${data.path}"`, () => {
      // Run core
      const fxExamplePath = path.join(__dirname, data.path);
      let output = core.runFx(
        path.join(fxExamplePath, data.control.filename),
        data.sample.map((sample) => path.join(fxExamplePath, sample.filename)),
        data.instrument,
        data.reagent
      );

      it("Check output format", (done) => {
        typeCheck(output);
        done();
      });

      it("Check qc status and linear", (done) => {
        // QC status
        assert.equal(
          output.qc.status,
          data.control.qc,
          `qc status should be "${data.control.qc}".`
        );

        // QC linear
        assert.equal(
          output.qc.linear[0][0],
          data.control.linear[0][0],
          `qc linear of x1 should be ${data.control.linear[0][0]}.`
        );
        assert.equal(
          output.qc.linear[0][1],
          data.control.linear[0][1],
          `qc linear of y1 should be ${data.control.linear[0][1]}.`
        );
        assert.equal(
          output.qc.linear[1][0],
          data.control.linear[1][0],
          `qc linear of x2 should be ${data.control.linear[1][0]}.`
        );
        assert.equal(
          output.qc.linear[1][1],
          data.control.linear[1][1],
          `qc linear of y2 should be ${data.control.linear[1][1]}.`
        );

        done();
      });

      it("Check assessment, interpretaion, position number and gender results", (done) => {
        for (let idx in data.sample) {
          try {
            // Assessment
            assert.equal(
              output.result[idx].assessment,
              data.sample[idx].assessment,
              `result: ${output.result[idx].sample_id} assessment should be "${data.sample[idx].assessment}".`
            );

            // Interpretation
            interpretationValueCheck(output.result[idx]);
          } catch (err) {
            // Get repeats
            const repeatsLst = output.result[idx].position.map((p) => {
              return p.repeats;
            });

            console.log(
              `${output.result[idx].sample_id} assessment: ${output.result[idx].assessment}`
            );
            console.error(
              `${output.result[idx].sample_id} repeats: ${repeatsLst}`
            );
            console.log(err.message);
          }

          // Repeat position
          assert.equal(
            output.result[idx].position.length,
            data.sample[idx].positionNum,
            `result: ${output.result[idx].sample_id} position number should be "${data.sample[idx].positionNum}".`
          );

          // Gender
          assert.equal(
            output.result[idx].gender,
            data.sample[idx].gender,
            `result: ${output.result[idx].sample_id} gender should be "${data.sample[idx].gender}".`
          );
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
    "control output should be object."
  );
  assert.notEqual(typeof output.control, null, "control output cannot be null");
  assert.equal(
    typeof output.control.control_id,
    "string",
    "output control_id should be string."
  );
  assert.equal(
    typeof output.control.standard_1,
    "object",
    "control output for standard_1 should be object."
  );
  assert.notEqual(
    typeof output.control.standard_1,
    null,
    "control output for standard_1 cannot be null."
  );
  assert.equal(
    typeof output.control.standard_2,
    "object",
    "control output for standard_2 should be object."
  );
  assert.notEqual(
    typeof output.control.standard_2,
    null,
    "control output for standard_2 cannot be null."
  );
  assert.equal(
    typeof output.control.standard_3,
    "object",
    "control output for standard_3 should be object."
  );
  assert.notEqual(
    typeof output.control.standard_3,
    null,
    "control output for standard_3 cannot be null."
  );
  assert.equal(
    Number.isSafeInteger(output.control.standard_1.repeats_standard),
    true,
    "expected repeats number for standard_1 should be integer."
  );
  assert.equal(
    Number.isSafeInteger(output.control.standard_2.repeats_standard),
    true,
    "expected repeats number for standard_2 should be integer."
  );
  assert.equal(
    Number.isSafeInteger(output.control.standard_3.repeats_standard),
    true,
    "expected repeats number for standard_3 should be integer."
  );

  if (output.qc.status === "Meet the critera") {
    assert.equal(
      Number.isSafeInteger(output.control.standard_1.bp),
      true,
      "input bp for standard_1 should be integer."
    );
    assert.equal(
      Number.isSafeInteger(output.control.standard_2.bp),
      true,
      "input bp for standard_2 should be integer."
    );
    assert.equal(
      Number.isSafeInteger(output.control.standard_3.bp),
      true,
      "input bp for standard_3 should be integer."
    );
    assert.equal(
      Number.isSafeInteger(output.control.standard_4.bp),
      true,
      "input bp for standard_4 should be integer."
    );
    assert.equal(
      typeof output.control.standard_1.conc,
      "number",
      "input concentration for standard_1 should be number."
    );
    assert.equal(
      typeof output.control.standard_2.conc,
      "number",
      "input concentration for standard_2 should be number."
    );
    assert.equal(
      typeof output.control.standard_3.conc,
      "number",
      "input concentration for standard_3 should be number."
    );
  }

  // QC
  assert.equal(typeof output.qc, "object", "qc output should be obeject.");
  assert.notEqual(typeof output.qc, null, "qc output cannot be null");
  assert.equal(
    typeof output.qc.status,
    "string",
    "qc status should be string."
  );
  assert.equal(
    Array.isArray(output.qc.linear),
    true,
    "qc linear should be an array."
  );
  assert.equal(
    Number.isSafeInteger(output.qc.max_bp),
    true,
    "maximum bp should be integer."
  );
  assert.equal(
    Number.isSafeInteger(output.qc.max_repeats),
    true,
    "maximum repeats number should be interger."
  );

  if (output.qc.status === "Meet the critera") {
    assert.equal(
      typeof output.qc.r_squared,
      "number",
      "qc r_square should be number."
    );
    assert.equal(
      typeof output.qc.slope,
      "number",
      "qc slope should be number."
    );
    output.qc.linear.forEach((spot) => {
      assert.equal(
        Array.isArray(spot),
        true,
        "qc linear spot should be an array."
      );
      spot.forEach((coordinate) => {
        assert.equal(
          typeof coordinate,
          "number",
          "qc linear spot coordinate should be number."
        );
      });
    });
  }

  // Sample
  assert.equal(
    Array.isArray(output.result),
    true,
    "result output should be an array."
  );
  output.result.forEach((result) => {
    assert.equal(
      typeof result,
      "object",
      "result output for sample should be object."
    );
    assert.notEqual(
      typeof result,
      null,
      "result output for sample cannot be null"
    );
    assert.equal(
      typeof result.sample_id,
      "string",
      "sample_id should be string."
    );
    assert.equal(
      typeof result.gender,
      "string",
      `result: ${result.sample_id} gender should be string.`
    );
    assert.equal(
      typeof result.assessment,
      "string",
      `result: ${result.sample_id} assessment should be string.`
    );
    if (
      result.assessment !== "Invalid" &&
      result.assessment !== "Inconclusive"
    ) {
      assert.equal(
        typeof result.x_rfu,
        "number",
        `result: ${result.sample_id} x_rfu should be number.`
      );
    }
    assert.equal(
      Array.isArray(result.interpretation),
      true,
      `result: ${result.sample_id} interpretation should be an string array.`
    );
    assert.equal(
      Array.isArray(result.position),
      true,
      "result position for chart should be an array."
    );

    if (output.qc.status === "Meet the critera") {
      result.interpretation.forEach((interpretation) => {
        assert.equal(
          typeof interpretation,
          "string",
          "items of result interpretation should be string."
        );
      });
      result.position.forEach((position) => {
        assert.equal(
          typeof position,
          "object",
          "items of result position should be obeject."
        );
        assert.notEqual(
          typeof position,
          null,
          "item of result position cannot be null"
        );
        assert.equal(
          Number.isSafeInteger(position.repeats),
          true,
          "item repeats of result position should be integer."
        );
        assert.equal(
          Number.isSafeInteger(position.bp),
          true,
          "item bp of result position should be integer."
        );
        assert.equal(
          typeof position.rfu,
          "number",
          "item rfu of result position should be number."
        );
      });
    }
    assert.equal(
      Array.isArray(result.raw),
      true,
      "all raw data for sample result should be an array"
    );
    result.raw.forEach((r) => {
      assert.equal(
        typeof r,
        "object",
        "raw data for sample result should be object."
      );
      assert.notEqual(
        typeof r,
        null,
        "raw data for sample result cannot be null."
      );
      assert.equal(
        Number.isSafeInteger(r.bp),
        true,
        "bp in raw data for sample result should be integer."
      );
      assert.equal(
        typeof r.conc,
        "number",
        "concentrstion in raw data for sample result should be number."
      );
      assert.equal(
        typeof r.rfu,
        "number",
        "rfu in raw data for sample result should be number."
      );
      if (result.assessment !== "Inconclusive") {
        assert.equal(
          Number.isSafeInteger(r.repeats),
          true,
          "repeats in raw data for sample result should be integer."
        );
      }
      assert.equal(
        Number.isSafeInteger(r.expected_repeats),
        true,
        "expected_repeats in raw data for sample result should be integer."
      );
    });
  });

  // Different check by reagent
  if (output.reagent === "accuinFx2") {
    // Control
    assert.equal(
      typeof output.control.standard_4,
      "object",
      "control output for standard_4 should be object."
    );
    assert.notEqual(
      typeof output.control.standard_4,
      null,
      "control output for standard_4 cannot be null."
    );
    assert.equal(
      Number.isSafeInteger(output.control.standard_4.repeats_standard),
      true,
      "expected repeats number for standard_4 should be integer."
    );
    if (output.qc.status === "Meet the critera") {
      assert.equal(
        typeof output.control.standard_4.conc,
        "number",
        "input concentration for standard_4 should be number."
      );
    }
  }
}

function interpretationValueCheck(outputSample) {
  if (outputSample.assessment === "Normal/Intermediate") {
    assert.equal(
      outputSample.interpretation.includes("Normal"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "Normal".`
    );
    assert.equal(
      outputSample.interpretation.includes("Intermediate"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "Intermediate".`
    );
  } else if (outputSample.assessment === "Normal/Premutation") {
    assert.equal(
      outputSample.interpretation.includes("Normal"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "Normal".`
    );
    assert.equal(
      outputSample.interpretation.includes("Premutation"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "Premutation".`
    );
  } else if (outputSample.assessment === "Normal") {
    assert.equal(
      outputSample.interpretation[0],
      "Normal",
      `result: ${outputSample.sample_id} interpretaion should have "Normal".`
    );
  } else if (outputSample.assessment === "Premutation") {
    assert.equal(
      outputSample.interpretation[0],
      "Premutation",
      `result: ${outputSample.sample_id} interpretaion should have "Premutation".`
    );
  } else if (outputSample.assessment === "Invalid") {
    assert.equal(
      outputSample.interpretation.length,
      0,
      `invalid result: ${outputSample.sample_id} should not have interpretaion data.`
    );
    assert.equal(
      outputSample.position.length,
      0,
      `invalid result: ${outputSample.sample_id} should not have position data.`
    );
  } else if (outputSample.assessment === "Inconclusive") {
    assert.equal(
      outputSample.interpretation.length,
      0,
      `inconclusive result: ${outputSample.sample_id} should not have interpretaion data.`
    );
    assert.equal(
      outputSample.position.length,
      0,
      `inconclusive result: ${outputSample.sample_id} should not have position data.`
    );
  } else {
    assert.fail(
      `unrecognize sample ${outputSample.assessment} assessment: ${outputSample.assessment}.`
    );
  }
}
