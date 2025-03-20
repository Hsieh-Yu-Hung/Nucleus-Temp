const { runFx } = require("./fragileX.js");
const { runHd } = require("./hd.js");
const { runMthfr } = require("./mthfr.js");
const { runSma } = require("./sma.js");
const { runSmaRf } = require("./sma_rf.js");
const { runApoe } = require("./apoe.js");
const { runNudt15 } = require("./nudt15.js");
const { runSmaV4 } = require("./sma_v4.js");

/**
 * @param {Object} input
 * @param {Array} input.sample
 * @param {Array} input.control
 * @param {String} input.instrument
 * @param {String} input.reagent
 * @param {Boolean} input.dummy
 * @returns {Object} result
 */
async function core(input) {
  let result;
  try {
    if (input.reagent === "accuinFx1" || input.reagent === "accuinFx2") {
      result = await runFx(
        input.control,
        input.sample,
        input.instrument,
        input.reagent
      );
    } else if (input.reagent === "accuinHD1") {
      result = await runHd(
        input.control,
        input.sample,
        input.instrument,
        input.reagent,
        input.dummy
      );
    } else if (input.reagent === "accuinMTHFR1" || input.reagent === "accuinMTHFR2") {
      result = await runMthfr(
        input.sample,
        input.control,
        input.ntc,
        input.instrument,
        input.reagent
      );
    } else if (input.reagent === "accuinMTHFR3") {
      result = await runMthfr(
        "",
        input.control,
        input.ntc,
        input.instrument,
        input.reagent,
        input.sample[0],
        input.sample[1],
      );
    } else if (input.reagent === "accuinSma1" && input.model1 && input.model2) {
      result = await runSmaRf(
        input.sample,
        input.control[0],
        input.control[1],
        input.control[2],
        input.control[3],
        input.instrument,
        input.reagent,
        input.predict,
        input.model1,
        input.model2
      );
    } else if (
      (input.reagent === "accuinSma1" || input.reagent === "accuinSma2" || input.reagent === "accuinSma3")
      && (input.instrument === 'qs3'|| input.instrument === 'tower')
      && input.analyzer !== 'custom'
      && !input.model1
      && !input.model2
    ) {
      result = await runSma({
        rawPath: input.sample,
        ntcWell: input.control[0],
        ctrl1Well: input.control[1],
        ctrl2Well: input.control[2],
        instrument: input.instrument,
        reagent: input.reagent,
        analyzer: input.analyzer,
      });
    } else if (
      (input.reagent === "accuinSma1" || input.reagent === "accuinSma2" || input.reagent === "accuinSma3")
      && input.instrument === 'z480'
      && input.analyzer !== 'custom'
      && !input.model1
      && !input.model2
    ) {
      result = await runSma({
        ntcWell: input.control[0],
        ctrl1Well: input.control[1],
        ctrl2Well: input.control[2],
        instrument: input.instrument,
        reagent: input.reagent,
        analyzer: input.analyzer,
        famPath: input.sample[0],
        vicPath: input.sample[1],
        cy5Path: input.sample[2],
      });
    } else if (
      input.reagent === "accuinSma3"
      && input.analyzer === 'custom'
    ) {
      result = await runSma({
        ntcWell: input.control[0],
        ctrl1Well: input.control[1],
        ctrl2Well: input.control[2],
        instrument: input.instrument,
        reagent: input.reagent,
        analyzer: input.analyzer,
        parameters: input.parameters,
        famPath: input.sample[0],
        vicPath: input.sample[1],
        cy5Path: input.sample[2],
      });
    } else if (
      (input.reagent === "accuinSma1" || input.reagent === "accuinSma2")
      && input.analyzer === 'custom'
    ) {
      result = await runSma({
        rawPath: input.sample,
        ntcWell: input.control[0],
        ctrl1Well: input.control[1],
        ctrl2Well: input.control[2],
        instrument: input.instrument,
        reagent: input.reagent,
        analyzer: input.analyzer,
        parameters: input.parameters,
      });
    } else if (input.reagent === "accuinSma4") {
      result = await runSmaV4(
        input.smn1_std1_file,
        input.smn1_std2_file,
        input.smn2_std1_file,
        input.smn2_std2_file,
        input.smn1_sample_files,
        input.smn2_sample_files,
      );
    } else if (input.reagent === "accuinApoe1") {
      result = await runApoe(
        input.control[0],
        input.control[1],
        input.sample,
        input.instrument,
        input.reagent
      );
    } else if (input.reagent === "accuinNUDT151" && input.instrument === 'qs3') {
      result = await runNudt15(
        input.sample,
        input.control,
        input.ntc,
        input.instrument,
        input.reagent
      );
    } else if (input.reagent === "accuinNUDT152" && input.instrument === 'z480') {
      result = await runNudt15(
        "",
        input.control,
        input.ntc,
        input.instrument,
        input.reagent,
        input.sample[0],
        input.sample[1],
      );
    } else {
      result = {};
      console.log(input)
      throw "UndefinedReagentError";
    }
  } catch (err) {
    result = {};
    if (err === "UndefinedReagentError") {
      console.log("ERROR: Unrecognize reagent.");
    } else {
      console.log(err);
      console.log("ERROR: Run core error.");
    }
  }

  return result;
}

module.exports = core;
