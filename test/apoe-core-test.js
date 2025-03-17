/**
 * Uni test script for nucleus/apoe-core.js
 *
 * mocha@9.1.1
 * should@13.2.3
 */

const assert = require("assert");
const path = require("path");
const core = require("../core/apoe.js");

const apoeData = require(path.join(__dirname, "/examples/sample-config.json"))[
  "apoe"
];

const typeKeys = [ 'e2', 'e3', 'e4' ];
const controlKeys = [ 'standard1', 'standard2' ];

describe("APOE core test", () => {
  for (let i = 0; i < apoeData.length; i++) {
    const data = apoeData[i];
    describe(`(${data.instrument}) ${data.object} with test cases "${data.path}"`, () => {
      // Run core
      const apoeExamplePath = path.join(__dirname, data.path);
      const apoeSC1Path = data.control.standard1.files.map((filepath) => {
        return path.join(apoeExamplePath, filepath);
      });
      const apoeSC2Path = data.control.standard2.files.map((filepath) => {
        return path.join(apoeExamplePath, filepath);
      });
      const apoeSamplePath = data.sample.map((sample) => {
        return {
          [sample.sampleId]: sample.files.map((filepath) => {
            return path.join(apoeExamplePath, filepath);
          }),
        }
      });
      let output = core.runApoe(
        apoeSC1Path,
        apoeSC2Path,
        apoeSamplePath,
        data.instrument,
        data.reagent
      )

      it("Check output format", (done) => {
        typeCheck(output);
        done();
      });

      it("Check output value", (done) => {
        // QC status
        assert.equal(
          output.qc.status,
          data.control.qc,
          `qc status should be "${data.control.qc}".`
        );

        // Standard 1
        assert.equal(
          output.control.standard1.status,
          data.control.standard1.status,
          `standard 1 status should be "${ data.control.standard1.bp }".`
        );
        assert.equal(
          output.control.standard1.type.join("/"),
          data.control.standard1.type,
          `standard 1 type should be "${ data.control.standard1.type }".`
        );
        typeKeys.forEach((type) => {
          assert.equal(
            output.control.standard1[type].internalQc,
            data.control.standard1.status,
            `standard 1 ${type} internalQc should be "${ data.control.standard1.internalQc }".`
          );
        });

        // Standard 2
        assert.equal(
          output.control.standard2.status,
          data.control.standard2.status,
          `standard 2 status should be "${ data.control.standard2.bp }".`
        );
        assert.equal(
          output.control.standard2.type.join("/"),
          data.control.standard2.type,
          `standard 2 type should be "${ data.control.standard2.type }".`
        );
        typeKeys.forEach((type) => {
          assert.equal(
            output.control.standard2[type].internalQc,
            data.control.standard2.status,
            `standard 2 ${type} internalQc should be "${ data.control.standard2.internalQc }".`
          );
        });

        // Sample
        output.result.forEach((sample) => {
          assert.equal(
            sample.type.join("/"),
            data.sample.find((s) => s.sampleId === sample.sampleId).type,
            `sample ${sample.sampleId} type should be "${data.sample.find((s) => s.sampleId === sample.sampleId).type}".`
          );
          assert.equal(
            sample.assessment,
            data.sample.find((s) => s.sampleId === sample.sampleId).assessment,
            `sample ${sample.sampleId} assessment should be "${data.sample.find((s) => s.sampleId === sample.sampleId).assessment}".`
          );

          if (
            (sample.assessment !== "invalid") &&
            (sample.assessment !== "inconclusive")
          ) {
            typeKeys.forEach((type) => {
              assert.equal(
                sample[type].internalQc,
                "meet-the-criteria",
                `sample ${sample.sampleId} ${type} internalQc should be "meet-the-critera".`
              );
            });
          }
        });

        done();
      });

      // Hook to log error if the test fails
      afterEach(function() {
        if (this.currentTest.state === 'failed') {
          console.log("Output:")
          console.log(JSON.stringify(output, null, 4))
        }
      });
    });
  };
});

function typeCheck(output) {
  assert.equal(
    typeof output,
    "object",
    "Core output should be object."
  );
  assert.notEqual(
    typeof output,
    null,
    "Core output cannot be null."
  );
  assert.equal(
    typeof output.control,
    "object",
    "control output should be object."
  );
  assert.notEqual(typeof output.control, null, "control output cannot be null");

  // Control
  controlTypeCheck(output.control, output.qc.status);

  // QC
  assert.equal(
    typeof output.qc.status,
    "string",
    "qc status should be string."
  );

  // Sample
  sampleTypeCheck(output.result);
}

function controlTypeCheck(controlOutput, qcStatus) {
  if (qcStatus === "meet-the-critera") {
    controlKeys.forEach((key) => {
      assert.equal(
        typeof controlOutput[key],
        "object",
        `control output for ${key} should be object.`
      );
      assert.notEqual(
        typeof controlOutput[key],
        null,
        `control output for ${key} cannot be null.`
      );
      assert.equal(
        typeof controlOutput[key].status,
        "string",
        `control output status for ${key} should be string.`
      );
      assert.equal(
        Array.isArray(controlOutput[key].type),
        true,
        `control output type for ${key} should be an array.`
      );
      controlOutput[key].type.forEach((t) => {
        assert.equal(
          typeof t,
          "string",
          `items of type of control output for ${key} should be string.`
        );
      });
      
      typeKeys.forEach((type) => {
        assert.equal(
          typeof controlOutput[key][type],
          "object",
          `control output for ${key} ${type} should be object.`
        );
        assert.notEqual(
          typeof controlOutput[key][type],
          null,
          `control output for ${key} ${type} cannot be null.`
        );
        assert.equal(
          typeof controlOutput[key][type].filename,
          "string",
          `control output filename for ${key} ${type} should be string.`
        );
        assert.equal(
          typeof controlOutput[key][type].id,
          "string",
          `control output id for ${key} ${type} should be string.`
        );
        assert.equal(
          typeof controlOutput[key][type].well,
          "string",
          `control output well for ${key} ${type} should be string.`
        );
        assert.equal(
          typeof controlOutput[key][type].internalQc,
          "string",
          `control output internalQc for ${key} ${type} should be string.`
        );
        assert.equal(
          Number.isSafeInteger(controlOutput[key][type].intenalBp),
          true,
          `control output intenalBp for ${key} ${type} should be integer.`
        );
        assert.equal(
          Number.isSafeInteger(controlOutput[key][type].bp),
          true,
          `control output bp for ${key} ${type} should be integer.`
        );
        assert.equal(
          typeof controlOutput[key][type].intenalRfu,
          "number",
          `control output intenalRfu for ${key} ${type} should be number.`
        );
        assert.equal(
          typeof controlOutput[key][type].rfu,
          "number",
          `control output rfu for ${key} ${type} should be number.`
        );
        assert.equal(
          Array.isArray(controlOutput[key][type].raw),
          true,
          `control output raw for ${key} ${type} should be an array.`
        );

        controlOutput[key][type].raw.forEach((r) => {
          assert.equal(
            typeof r,
            "object",
            `items of raw of control output for ${key} ${type} should be object.`
          );
          assert.notEqual(
            typeof r,
            null,
            `items of raw of control output for ${key} ${type} cannot be null.`
          );
          assert.equal(
            Number.isSafeInteger(r.bp),
            true,
            `raw bp of control output for ${key} ${type} should be integer.`
          );
          assert.equal(
            typeof r.rfu,
            "number",
            `raw rfu of control output for ${key} ${type} should be number.`
          );
        });
      });
    });
  }
};

function sampleTypeCheck(sampleOutput) {
  assert.equal(
    Array.isArray(sampleOutput),
    true,
    "result output should be an array."
  );
  sampleOutput.forEach((sample) => {
    assert.equal(
      typeof sample,
      "object",
      "sample result output should be object."
    );
    assert.notEqual(
      typeof sample,
      null,
      "sample result output cannot be null"
    );
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
      Array.isArray(sample.type),
      true,
      "type of sample result output should be an array."
    );
    sample.type.forEach((t) => {
      assert.equal(
        typeof t,
        "string",
        "items of type of sample result output should be string."
      );
    });

    typeKeys.forEach((typeKey) => {
      assert.equal(
        typeof sample[typeKey],
        "object",
        `items of ${typeKey} of sample result output should be object.`
      );
      assert.notEqual(
        typeof sample[typeKey],
        null,
        `items of ${typeKey} of sample result output cannot be null.`
      );
      assert.equal(
        typeof sample[typeKey].filename,
        "string",
        `filename of ${typeKey} of sample result output should be string.`
      );
      assert.equal(
        typeof sample[typeKey].id,
        "string",
        `id of ${typeKey} of sample result output should be string.`
      );
      assert.equal(
        typeof sample[typeKey].well,
        "string",
        `well of ${typeKey} of sample result output should be string.`
      );
      assert.equal(
        typeof sample[typeKey].internalQc,
        "string",
        `internalQc of ${typeKey} of sample result output should be string.`
      );
      assert.equal(
        Number.isSafeInteger(sample[typeKey].internalBp),
        true,
        `intenalBp of ${typeKey} of sample result output should be integer.`
      );
      assert.equal(
        Number.isSafeInteger(sample[typeKey].bp),
        true,
        `bp of ${typeKey} of sample result output should be integer.`
      );
      assert.equal(
        typeof sample[typeKey].internalRfu,
        "number",
        `internalRfu of ${typeKey} of sample result output should be number.`
      );
      assert.equal(
        typeof sample[typeKey].rfu,
        "number",
        `rfu of ${typeKey} of sample result output should be number.`
      );
      assert.equal(
        Array.isArray(sample[typeKey].raw),
        true,
        `raw of ${typeKey} of sample result output should be an array.`
      );
      sample[typeKey].raw.forEach((r) => {
        assert.equal(
          typeof r,
          "object",
          `items of raw of ${typeKey} of sample result output should be object.`
        );
        assert.notEqual(
          typeof r,
          null,
          `items of raw of ${typeKey} of sample result output cannot be null.`
        );
        assert.equal(
          Number.isSafeInteger(r.bp),
          true,
          `raw bp of ${typeKey} of sample result output should be integer.`
        );
        assert.equal(
          typeof r.rfu,
          "number",
          `raw rfu of ${typeKey} of sample result output should be number.`
        );
      });
    });
  });
};
