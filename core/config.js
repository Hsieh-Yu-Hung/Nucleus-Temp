const config = {
  sma: {
    qs3: {
      // QC
      STD_CRITERIA_SMN1_2n1n: [ 0.87, 1.46 ],
      STD_CRITERIA_SMN1_3n2n: [ 0.58, 1.29 ],
      STD_CRITERIA_SMN2_2n1n: [ 0.75, 1.44 ],
      STD_CRITERIA_SMN2_3n2n: [ 0.48, 1.44 ],

      // Ct value
      CT_UNDETERMINED_UPPERBOUND: 30,
    },
    z480: {
      SMN1_FACTOR: 0.47,
      SMN2_FACTOR: 0.52,
    },
    tower: {
      // QC
      STD_CRITERIA_SMN1_2n1n: [ 0.87, 1.46 ],
      STD_CRITERIA_SMN1_3n2n: [ 0.58, 1.29 ],
      STD_CRITERIA_SMN2_2n1n: [ 0.75, 1.44 ],
      STD_CRITERIA_SMN2_3n2n: [ 0.48, 1.44 ],

      // Ct value
      CT_UNDETERMINED_LOWERBOUND: 15,
      CT_UNDETERMINED_UPPERBOUND: 30,
    },
  },
};

module.exports = {
  sma: config.sma,
};