/**
 * Uni test script for nucleus/hd-core.js
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/hd.js");

const hdData = require(path.join(__dirname, "/examples/sample-config.json"))[
  "hd"
];

describe("HTD core test", () => {
  hdData.forEach(function (data) {
    describe(`(${data.instrument}) ${data.object} with test cases "${data.path}"`, () => {
      // Run core
      const hdExamplePath = path.join(__dirname, data.path);
      let output = core.runHd(
        path.join(hdExamplePath, data.control.filename),
        data.sample.map((sample) => path.join(hdExamplePath, sample.filename)),
        data.reagent,
        data.instrument
      );

      it("Check output format", (done) => {
        typeCheck(output);
        done();
      });

      it("Check qc and standard control", (done) => {
        // QC status
        assert.equal(
          output.qc.status,
          data.control.qc,
          `qc status should be "${data.control.qc}".`
        );

        // Standard 1
        assert.equal(
          output.control.standard_1.bp,
          data.control.standard1.bp,
          `standard 1 bp should be "${data.control.standard1.bp}".`
        );
        assert.equal(
          output.control.standard_1.status,
          data.control.standard1.status,
          `standard 1 status should be "${data.control.standard1.status}".`
        );

        // Standard 2
        assert.equal(
          output.control.standard_2.bp,
          data.control.standard2.bp,
          `standard 2 bp should be "${data.control.standard2.bp}".`
        );
        assert.equal(
          output.control.standard_2.status,
          data.control.standard2.status,
          `standard 2 status should be "${data.control.standard2.status}".`
        );

        done();
      });

      it("Check assessment, bp, repeats, type and internal qc results", (done) => {
        for (let idx in data.sample) {
          // Assessment
          assert.equal(
            output.result[idx].assessment,
            data.sample[idx].assessment,
            `result: ${output.result[idx].sampleId} assessment should be "${data.sample[idx].assessment}".`
          );

          // BP
          output.result[idx].bp.forEach((bp, i) => {
            assert.equal(
              bp,
              data.sample[idx].bp[i],
              `result: ${output.result[idx].sampleId} bp should contain ${data.sample[idx].bp[i]}.`
            );
          });

          // Repeat
          output.result[idx].repeats.forEach((repeat, i) => {
            assert.equal(
              repeat,
              data.sample[idx].repeats[i],
              `result: ${output.result[idx].sampleId} repeats should contain ${data.sample[idx].repeats[i]}.`
            );
          });

          // Type
          typeValueCheck(output.result[idx]);

          // Internal QC
          assert.equal(
            output.result[idx].internalQc.bp,
            data.sample[idx].internalQc.bp,
            `result: ${output.result[idx].sampleId} internal QC bp should be ${data.sample[idx].internalQc.bp}.`
          );
          assert.equal(
            output.result[idx].internalQc.rfu,
            data.sample[idx].internalQc.rfu,
            `result: ${output.result[idx].sampleId} internal QC rfu should be ${data.sample[idx].internalQc.rfu}.`
          );
          assert.equal(
            output.result[idx].internalQc.status,
            data.sample[idx].internalQc.status,
            `result: ${output.result[idx].sampleId} internal QC status should be ${data.sample[idx].internalQc.status}.`
          );
        }

        done();
      });
    });
  });
});

function typeCheck(output) {
  assert.equal(
    typeof output,
    "object",
    "Core output for sample should be object."
  );
  assert.notEqual(
    typeof output,
    null,
    "Core output for sample cannot be null."
  );

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

  if (output.qc.status === "meet-the-critera") {
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
      Number.isSafeInteger(output.control.standard_1.bp),
      true,
      "expected bp number for standard_1 should be integer."
    );
    assert.equal(
      Number.isSafeInteger(output.control.standard_2.bp),
      true,
      "expected bp number for standard_2 should be integer."
    );
    assert.equal(
      typeof output.control.standard_1.percentage,
      "number",
      "control output percentage for standard_1 should be number."
    );
    assert.equal(
      typeof output.control.standard_2.percentage,
      "number",
      "control output percentage for standard_2 should be number."
    );
    assert.equal(
      typeof output.control.standard_1.status,
      "string",
      "control output status of standard_1 should be string."
    );
    assert.equal(
      typeof output.control.standard_2.status,
      "string",
      "control output status of standard_2 should be string."
    );
  }

  // QC
  assert.equal(typeof output.qc, "object", "qc output should be object.");
  assert.notEqual(typeof output.qc, null, "qc output cannot be null");
  assert.equal(
    typeof output.qc.status,
    "string",
    "qc status output should be string."
  );

  // Sample
  assert.equal(
    Array.isArray(output.result),
    true,
    "result output should be an array."
  );
  output.result.forEach((sample) => {
    assert.equal(
      typeof sample,
      "object",
      "sample result output should be object."
    );
    assert.notEqual(typeof sample, null, "sample result output cannot be null");
    assert.equal(
      typeof sample.sampleId,
      "string",
      "sampleId of sample result output should be string."
    );
    assert.equal(
      typeof sample.assessment,
      "string",
      "assessment of sample result output should be string."
    );
    assert.equal(
      Array.isArray(sample.repeats),
      true,
      "repeats of sample result output should be an array."
    );
    sample.repeats.forEach((r) => {
      assert.equal(
        Number.isSafeInteger(r),
        true,
        "items of repeats of sample result output should be integer."
      );
    });
    assert.equal(
      Array.isArray(sample.raw),
      true,
      "raw of sample result output should be an array."
    );
    sample.raw.forEach((r) => {
      assert.equal(
        Number.isSafeInteger(r.bp),
        true,
        "raw bp of sample result output should be integer."
      );
      assert.equal(
        typeof r.rfu,
        "number",
        "raw rfu of sample result output should be number."
      );
      assert.equal(
        Number.isSafeInteger(r.repeats),
        true,
        "raw repeats of sample result output should be integer."
      );
    });

    if (
      sample.assessment !== "invalid" &&
      sample.assessment !== "inconclusive"
    ) {
      assert.equal(
        Array.isArray(sample.type),
        true,
        "type of sample result output should be an array."
      );
      sample.type.forEach((type) => {
        assert.equal(
          typeof type,
          "string",
          "items of type of sample result output should be string."
        );
      });
      assert.equal(
        Array.isArray(sample.bp),
        true,
        "bp of sample result output should be an array."
      );
      sample.bp.forEach((b) => {
        assert.equal(
          Number.isSafeInteger(b),
          true,
          "items of bp of sample result output should be integer."
        );
      });
      assert.equal(
        Number.isSafeInteger(sample.internalQc.bp),
        true,
        "internalQc bp of sample result output should be integer."
      );
      assert.equal(
        typeof sample.internalQc.rfu,
        "number",
        "internalQc rfu of sample result output should be number."
      );
    }

    if (output.qc.status === "meet-the-critera") {
      assert.equal(
        typeof sample.internalQc,
        "object",
        "internalQc of sample result output should be object."
      );
      assert.notEqual(
        typeof sample.internalQc,
        null,
        "internalQc of sample result output cannot be null."
      );
      assert.equal(
        typeof sample.internalQc.status,
        "string",
        "internalQc status of sample result output should be string."
      );
    }
  });
}

function typeValueCheck(outputSample) {
  if (outputSample.assessment === "hd-full") {
    assert.equal(
      outputSample.type.length,
      2,
      "avaliable result should have two type data."
    );
    assert.notEqual(
      outputSample.repeats.length,
      0,
      "avaliable result should have repeats data."
    );
    assert.equal(
      outputSample.type.includes("hd-full"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "hd-full".`
    );
    assert.equal(
      outputSample.internalQc.status,
      "meet-the-criteria",
      `result: ${outputSample.sample_id} internalQc status should be "meet-the-criteria".`
    );
  } else if (outputSample.assessment === "invalid") {
    assert.equal(
      outputSample.repeats.length,
      0,
      "invalid result should not have repeats data."
    );
  } else if (outputSample.assessment === "hd-intermediate") {
    assert.equal(
      outputSample.type.length,
      2,
      "avaliable result should have two type data."
    );
    assert.notEqual(
      outputSample.repeats.length,
      0,
      "avaliable result should have repeats data."
    );
    assert.equal(
      outputSample.type.includes("hd-intermediate"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "hd-intermediate".`
    );
    assert.equal(
      outputSample.internalQc.status,
      "meet-the-criteria",
      `result: ${outputSample.sample_id} internalQc status should be "meet-the-criteria".`
    );
  } else if (outputSample.assessment === "hd-normal") {
    assert.equal(
      outputSample.type.length,
      2,
      "avaliable result should have two type data."
    );
    assert.notEqual(
      outputSample.repeats.length,
      0,
      "avaliable result should have repeats data."
    );
    assert.equal(
      outputSample.type.includes("hd-normal"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "hd-normal".`
    );
    assert.equal(
      outputSample.internalQc.status,
      "meet-the-criteria",
      `result: ${outputSample.sample_id} internalQc status should be "meet-the-criteria".`
    );
  } else if (outputSample.assessment === "hd-penetrance") {
    assert.equal(
      outputSample.type.length,
      2,
      "avaliable result should have two type data."
    );
    assert.notEqual(
      outputSample.repeats.length,
      0,
      "avaliable result should have repeats data."
    );
    assert.equal(
      outputSample.type.includes("hd-penetrance"),
      true,
      `result: ${outputSample.sample_id} interpretaion should have "hd-penetrance".`
    );
    assert.equal(
      outputSample.internalQc.status,
      "meet-the-criteria",
      `result: ${outputSample.sample_id} internalQc status should be "meet-the-criteria".`
    );
  } else if (outputSample.assessment === "inconclusive") {
    assert.equal(
      outputSample.repeats.length,
      0,
      "inconclusive result should not have repeats data."
    );
  } else {
    assert.fail(`unrecognize sample assessment: ${outputSample.sample_id}.`);
  }
}
