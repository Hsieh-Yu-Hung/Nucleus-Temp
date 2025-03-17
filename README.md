# Nucleus

Nucleus is a command-line tool for analyzing genetic data from qPCR instruments. It not only supports the analysis of Fragile X, HTD, MTHFR, and SMA data but also seamlessly integrates with the *core* function, allowing additional custom analyses via modules.

## Usage

### Module - Core Function
To utilize the `core` function, provide an input object with the following properties:

- `sample` (Array): Array of samples to be analyzed.
- `control` (Array): Array of control samples.
- `instrument` (String): Type of qPCR instrument.
- `reagent` (String): Type of reagent used.
- `dummy` (Boolean): Flag indicating if dummy data is used.

The `core` function returns an object containing the analysis result. Ensure to handle any potential errors, such as an undefined reagent, during execution.

#### Example:
```javascript
const core = require('../Nucleus');

// Example input object
const input = {
  sample: ['sample1', 'sample2'],
  control: ['control1', 'control2'],
  instrument: 'qs3',
  reagent: 'accuinSma1',
  dummy: false
};

// Calling the core function
core(input)
  .then(result => {
    // Handle the result
    console.log('Analysis result:', result);
  })
  .catch(error => {
    // Handle errors
    console.error('An error occurred during analysis:', error);
  });
```

### CLI - Fragile X Analysis

#### Command Syntax and options:
  ```
  node core/fragileX.js [options] [input_file1] [input_file2] [ -c control_file ]
  ```

#### Options:

- **-i**: Specify the instrument type. Default is "_qsep100_". Only "_qsep100_" is supported.
- **-r**: Specify the reagent type. Default is "_accuinFx1_". Supported reagent types are "_accuinFx1_" and "_accuinFx2_".

#### Examples:
1. Analyze Fragile X data using default settings:
    ```bash
    node fragileX.js \
    -c control.xlsx \
    sample1.xlsx sample2.xlsx
    ```

2. Analyze Fragile X data with a control file and custom reagent type:
    ```bash
    node fragileX.js \
    -c control.xlsx \
    -r accuinFx2 \
    sample1.xlsx sample2.xlsx
    ```

### CLI - HTD Analysis

#### Command Syntax and options:
  ```
  node core/hd.js [input_file1] [input_file2] [ -c control_file ] [options] 
  ```

#### Options:

- **-i**: Specify the instrument type. Default is "_qsep100_". Only "_qsep100_" is supported.
- **-r**: Specify the reagent type. Default is "_accuinHD1_". Only "_accuinHD1_" is supported.
- **--dummy**: Set to true to run dummy data for testing.

### CLI - MTHFR Analysis

#### Command Syntax and options:
  ```
  node core/mthfr.js [options] [ -f input_file ] [ -c control_file ] [ -n ntc_well ]
  ```

#### Options:

- **-i**: Specify the instrument type. Default is "_qs3_". Supported instrument types are "_qs3_" and "_qTOWER_".
- **-r**: Specify the reagent type. Default is "_accuinMTHFR1_". Only "_accuinMTHFR1_" is supported.

#### Examples:
1. Analyze MTHFR data using default settings:
    ```bash
    node mthfr.js \
    -f sample.xlsx \
    -c control.xlsx \
    -n A1
    ```

### CLI - SMA Analysis

#### Command Syntax and options:
  ```
  node core/sma.js [options] [ -f input_file ] [ -n ntc_well ] [ -a ctrl1_well ] [ -b ctrl2_well ] [ -c ctrl3_well ]
  ```

#### Options:

- **-i**: Specify the instrument type. Default is "_qs3_". Supported instrument types are "_qs3_" and "_qTOWER_".
- **-r**: Specify the reagent type. Default is "_accuinSMA1_". Supported reagent types are "_accuinSMA1_" and "_accuinSMA2_".
- **-m**: Specify the analysis method. Default is "_v1_". Supported analysis methods are "_v1_" and "_v2_".

#### Examples:
1. Analyze SMA data using default settings:
    ```bash
    node sma.js \
    -f sample.xlsx \
    -n A1 \
    -a C7 \
    -b D7 \
    -c E7
    ```
2. Analyze SMA data with custom settings:
    ```bash
    node sma.js \
    -f sample.xlsx \
    -n A1 \
    -a C7 \
    -b D7 \
    -c E7 \
    -i qTOWER \
    -r accuinSMA2 \
    -m v2
    ```
### CLI - SMA Analysis v4 (New)

#### Command Syntax and options:
  ```bash
  node core/sma_v4.js [options]
        [ --parameters ]
        [ --smn1_std1 SMA1_standard1.xlsx ]
        [ --smn1_std2 SMA1_standard2.xlsx ]
        [ --smn1_std3 SMA1_standard3.xlsx ]
        [ --smn1_sample SMA1_sampleA.xlsx  ] [ --smn1_sample SMA1_sampleB.xlsx  ] ... 
        [ --smn2_std1 SMA1_standard1.xlsx ]
        [ --smn2_std2 SMA1_standard2.xlsx ]
        [ --smn2_std3 SMA1_standard3.xlsx ]
        [ --smn2_sample SMA2_sampleA.xlsx  ] [ --smn2_sample SMA2_sampleB.xlsx  ] ... 
  ```

#### Options:

- **--parameters**: \[Optional\] Provide the peak definition parameters in Object format, see example. 
- **--smn1_std1 ~ 3**: Specify the SMN1 standard 1 to 3 standard experiment Qseq100 output excels.
- **--smn2_std1 ~ 3**: Specify the SMN2 standard 1 to 3 standard experiment Qseq100 output excels.
- **--smn1_sample**: Specify the SMN1 sample experiment Qseq100 output excels. Multiple samples can share one set of standard curve.
- **--smn2_sample**: Specify the SMN2 sample experiment Qseq100 output excels. Multiple samples can share one set of standard curve.

#### Examples:
1. Analyze SMA data using default parameters, one sample data:
    ```bash
    node sma_v4.js \
    --smn1_std1 SMA1_standard1.xlsx \
    --smn1_std2 SMA1_standard1.xlsx \
    --smn1_std3 SMA1_standard1.xlsx \
    --smn1_sample SMA1_SampleA.xlsx \
    --smn2_std1 SMA2_standard1.xlsx \
    --smn2_std2 SMA2_standard1.xlsx \
    --smn2_std3 SMA2_standard1.xlsx \
    --smn2_sample SMA2_SampleB.xlsx
    ```
2. Analyze SMA data using new parameters, one sample data:
    ```bash
    new_parameters="{
      RANGE: {
        SMA1_IC_SIZE_RANGE: {min: 217, max: 265},
        SMA1_TG_SIZE_RANGE: {min: 111, max: 135},
        SMA2_SEARCH_RANGE: {min: 275, max: 374}
        },
        RFU_THRESHOLD: {
          SMN1_IC: 1,
          SMN1_TG: 1,
          SMN2: 1
        },
        PEAK_NUMBER_CHECK: {
          SMA1: 1,
          SMA2: 2
        },
        PEAK_SIZE:{
          SMA1_IC: 241,
          SMA1_TG: 123,
          SMA2_IC: 340,
          SMA2_TG: 306
        }
    }"
    node sma_v4.js \
    --parameters new_parameters \
    --smn1_std1 SMA1_standard1.xlsx \
    --smn1_std2 SMA1_standard1.xlsx \
    --smn1_std3 SMA1_standard1.xlsx \
    --smn1_sample SMA1_SampleA.xlsx \
    --smn2_std1 SMA2_standard1.xlsx \
    --smn2_std2 SMA2_standard1.xlsx \
    --smn2_std3 SMA2_standard1.xlsx \
    --smn2_sample SMA2_SampleB.xlsx
    ```
3. Analyze SMA data using default parameters, multiple samples:
    ```bash
    node sma_v4.js \
    --smn1_std1 SMA1_standard1.xlsx \
    --smn1_std2 SMA1_standard1.xlsx \
    --smn1_std3 SMA1_standard1.xlsx \
    --smn1_sample SMA1_SampleA1.xlsx \
    --smn1_sample SMA1_SampleB1.xlsx \
    --smn1_sample SMA1_SampleC1.xlsx \
    --smn2_std1 SMA2_standard1.xlsx \
    --smn2_std2 SMA2_standard1.xlsx \
    --smn2_std3 SMA2_standard1.xlsx \
    --smn2_sample SMA2_SampleA2.xlsx \
    --smn2_sample SMA2_SampleB2xlsx \
    --smn2_sample SMA2_SampleC2.xlsx \
    ```
#### SMA v4 (Qsep 100)
* Select peaks:
  - SMA1
  ```
  internal control: 241 bp +- 10%, RFU > 1, if multiple peaks were found, select RFU top 1.
  target (SMA1)   : 123 bp +- 10%, RFU > 1, if multiple peaks were found, select RFU top 1.
  ```

  - SMA2

  internal control-1: 279 bp, RFU > 1 (Before 2024 Nov.)

  internal control-2: 340 bp, RFU > 1 (<-- Current use)

  target (SMA2): 306 bp

  Range from {small size}*0.9 ~ {large size} *1.1 bp, at least 2 peaks, assign top 1 & 2 peak as internal control and target peak, depends on their peak size.

  (Current case) Range from 275 ~ 374 bp, at least 2 peaks, top 1 peak is internal control; top 2 peak is SMN2 target.

* QC fail:
  1. Not enough peaks within the theoretical range.
  2. Not enough RFU-threshold-passed peaks within the theoretical range.
  3. Standard curve RFU did not increase as copy number, for example, standard 3 (3 copy) RFU < standard 1 (1 copy).
  
* Copy numbers:

  std = standard1(1), standard2(2), or standard3(3)

  D(stdn) = RFU \[target peak\](stdn) / RFU \[ctrl peak\](stdn)

  DIFF(stdn1,stdn2) = D(stdn2) - D(stdn1)

  DIFF21 = D(2) - D(1)
  
  DIFF32 = D(3) - D(2)

  |copy number|low boundary               |high boundary                |
  |-----------|---------------------------|-----------------------------|
  |1 copy     |D1                         |D1 + DIFF21 * 0.5            |
  |2 copy     |DIFF21 * 0.5               |DIFF21 * 0.5 + DIFF32 * 0.5  |
  |3 copy     |DIFF21 * 0.5 + DIFF32 * 0.5| value above count as 3 copy |

### CLI - SMA Prediction Model

1. Use SMA prediction model, simply run the predict executable file generated in the previous step.
    ```
    # Example
    dist/predict/predict \
    core/sma_model/smn1_230325_rf.joblib \
    "[ [ 0.676, 0.412, -0.176, -0.166, 0.331, 0.269 ] ]"
    ```
2. Run with Python script directly.
    ```
    # Example
    python3 core/sma_model/predict.py \
    core/sma_model/smn1_230325_rf.joblib \
    "[ [ 0.676, 0.412, -0.176, -0.166, 0.331, 0.269 ] ]"
    ```
3. Run by `sma_rf.js`.
    ```
    # Example
    node core/sma_rf.js \
    -f SMA_20230407_0401,0405TE.xls \
    -n G11 \
    -a C7 \
    -b D7 \
    -c E7 \
    -o core/sma_model/smn1_230325_rf.joblib \
    -t core/sma_model/smn2_230325_rf.joblib \
    -p dist/predict/predict
    ```

## Distribution of SMA Prediction Model

### Requirements
- Python 3.7 or higher

### Installation
1. Create a Python virtual environment using the smaRf_requirements.txt file.
    ```
    python -m venv myenv
    source myenv/bin/activate
    pip install -r smaRf_requirements.txt
    ```
2. Run the following command in the virtual environment to create the executable:
    ```
    pyinstaller --hidden-import=sklearn.ensemble._forest core/sma_model/predict.py
    ```
3. The executable file will be generated in the `dist` folder with the name `predict`.

## Test
Run the following command to test the analysis method with the test data.
```bash
npm run test
```
