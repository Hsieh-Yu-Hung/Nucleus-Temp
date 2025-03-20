/**
 * Testing SMA core v4 for Suspect-X.
 *
 * Run directly by node:
 *   node sma-v4.js \
 *   --smn1_std1 SMA1_standard1.xlsx \
 *   --smn1_std2 SMA1_standard2.xlsx \
 *   --smn1_sample SMA1_sample.xlsx \
 *   --smn2_std1 SMA2_standard1.xlsx \
 *   --smn2_std2 SMA2_standard2.xlsx \
 *   --smn2_sample SMA2_sample.xlsx
 */

// 載入會用到的模組
if (typeof require !== "undefined") XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const os = require("os");
const moment = require("moment");
const logger = require("../logger/log.js")(module);
const tableParser = require("../tableParser/parseTable.js")(module);
const argv = require("minimist")(process.argv.slice(2), {default: {}});

/* 實驗室定義數值範圍 */
const default_LAB_DEFINED = {
  RANGE: {
    SMN1_IC_SIZE_RANGE: {min: 198, max: 242},
    SMN1_TG_SIZE_RANGE: {min: 107, max: 131},
    SMN2_IC_SIZE_RANGE: {min: 313, max: 352},
    SMN2_TG_SIZE_RANGE: {min: 266, max: 312},
  },
  RFU_THRESHOLD: {
    SMN1_IC: 1.5,
    SMN1_TG: 0,
    SMN2_IC: 1.5,
    SMN2_TG: 0
  },
  PEAK_NUMBER_CHECK: {
    SMN1: 1,
    SMN2: 1
  },
  SC_DIFF_RATIO: {
    SMN1: 1.3,
    SMN2: 1.3
  },
  PEAK_SIZE:{
    SMN1_IC: 229,
    SMN1_TG: 118,
    SMN2_IC: 337,
    SMN2_TG: 297
  },
  COPY_NUMBER_RANGE: {
    smn1: {
      copy_1: {min: 0.5, max: 1.2},
      copy_2: {min: 1.4, max: 1.8},
      invalid: 1.3
    },
    smn2: {
      copy_1: {min: 0.5, max: 1.1},
      copy_2: {min: 1.3, max: 1.8},
      invalid: 1.2
    }
  }
}

// 設定 LAB_DEFINED
let LAB_DEFINED = default_LAB_DEFINED

// 設定 Logger 和存放位置
const JSON_DIR = path.join(os.tmpdir(), "ACCUiNspection_" + moment().format("YYYYMMDD"));
const JSON_OUTPUT = path.join(JSON_DIR, "SMA_v4_" + moment().format("YYYYMMDD_HHmmss") + ".json");
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

// 初始化共用變數
let dataQC_status = ''
let QC_information = []

/* 解析檔案名稱 */
function parseFileName(full_file_path){
  const file_name = path.basename(full_file_path);
  const file_name_without_extension = file_name.split(".")[0];
  const cleaned_name = file_name_without_extension.replace(/^\d+_SMN\d+_/, '');

  // 取得 sample 名稱 = 檔案名稱的第 2 個底線後的文字
  const sample_name = file_name_without_extension.split("_")[2];

  return {
    cleaned_name: cleaned_name,
    sample_name: sample_name
  };
}

/* 搜集 control_id */
function collectControlId(control_file_list){
  let control_id = [];
  control_file_list.forEach(file => {
    if (typeof file === 'object') {
      const file_name = path.basename(file[0]);
      const simple_file_name = file_name.split(".")[0];
      control_id.push(simple_file_name);
    }
    else if (typeof file === 'string'){
      const file_name = path.basename(file);
      const simple_file_name = file_name.split(".")[0];
      control_id.push(simple_file_name);
    }
  });
  const unique_control_id = [...new Set(control_id)];
  return unique_control_id;
}

/* 解析 Excel 檔案內容, 回傳資料表 */
function parseExcel(excelPath) {

  // 設定程式用參數 - 預期輸入表格欄位
  const EXPECT_COLUMNS = {
    'No': '',
    'Time\n(sec.)': '',
    'RFU': '',
    'PeakArea': '',
    'bp': '',
    'Concn.\n(ng/µl)': '',
    'PeakStart\n(sec.)': '',
    'PeakEnd\n(sec.)': '',
  }

  /* 資料表中搜尋目標 */
  function searchTarget(target, excelData) {
    // 初始化輸出物件
    const output = {};

    // 遍歷工作表的每一個儲存格
    for (let cell in excelData) {
      // 跳過工作表的範圍資訊
      if (cell[0] === '!') continue;

      // 檢查儲存格的值是否為 "PeakArea"
      if (excelData[cell].v === target) {
        // 儲存找到的儲存格位址
        output.targetCell = cell;
        break; // 找到後跳出迴圈
      }
    }

    return output;
  }

  // 讀取 Excel 檔案
  const excelData = XLSX.readFile(excelPath);
  const firstSheet = excelData.Sheets[excelData.SheetNames[0]];

  // 搜尋每個目標欄位
  for (let column in EXPECT_COLUMNS) {
    try {
      const targetCell = searchTarget(column, firstSheet);
      EXPECT_COLUMNS[column] = targetCell;
    } catch (error) {
      logger.error({
        label: "Error",
        message: `${error.message}`,
      });
    }
  }

  // 檢查點：找到的欄位是否都在同一行
  tableParser.checkSameRow(EXPECT_COLUMNS);

  // 搜集欄位資料
  const dataCollection = {
    sample: path.basename(excelPath).split(".xlsx")[0],
    file: excelPath,
    table: {}
  };
  for (let column in EXPECT_COLUMNS) {
    dataCollection['table'][column] = tableParser.getColumnValues(column, EXPECT_COLUMNS, firstSheet);
  }

  // 加上 table_index
  let table_index_counter = 0;
  let table_index = {};
  const firstColumn = Object.keys(EXPECT_COLUMNS)[0];
  for (let cell in dataCollection['table'][firstColumn]) {
    table_index[cell] = table_index_counter;
    table_index_counter++;
  }
  dataCollection['table']['table_index'] = table_index;

  // 擷取資料邊界
  const cleanedData = tableParser.cleanUpData(dataCollection['table'], 'No');
  dataCollection['table'] = cleanedData;

  // 將資料表轉換成陣列
  const array_table = tableParser.convertTableToArray(dataCollection['table']);
  dataCollection['table_array'] = array_table;

  // 轉置陣列表格
  const transposed_table = tableParser.transposeArrayTable(array_table);
  dataCollection['table_array_transposed'] = transposed_table;

  // 回傳搜集到的資料s
  return dataCollection;
}

/* Step1: 準備輸入檔案 */
function prepareInputFile(
  smn1_std1, smn1_std2,
  smn2_std1, smn2_std2,
  smn1_sample, smn2_sample
){
  let excel_for_parsing = {};
  if (typeof smn1_std1 === 'object') {
    // 解析 Excel 檔案, std 檔案變成 array 了, 但他們只會有 1 個檔案, 所以取第 0 個
    excel_for_parsing = {
      'smn1_std1': {file: smn1_std1[0], exp_group: 'smn1_std1', label: 'smn1', id:'std1', type:'standard', sample_name: 'smn1_std1'},
      'smn1_std2': {file: smn1_std2[0], exp_group: 'smn1_std2', label: 'smn1', id:'std2', type:'standard', sample_name: 'smn1_std2'},
      'smn2_std1': {file: smn2_std1[0], exp_group: 'smn2_std1', label: 'smn2', id:'std1', type:'standard', sample_name: 'smn2_std1'},
      'smn2_std2': {file: smn2_std2[0], exp_group: 'smn2_std2', label: 'smn2', id:'std2', type:'standard', sample_name: 'smn2_std2'}
    };
  } else{
    excel_for_parsing = {
      'smn1_std1': {file: smn1_std1, exp_group: 'smn1_std1', label: 'smn1', id:'std1', type:'standard', sample_name: 'smn1_std1'},
      'smn1_std2': {file: smn1_std2, exp_group: 'smn1_std2', label: 'smn1', id:'std2', type:'standard', sample_name: 'smn1_std2'},
      'smn2_std1': {file: smn2_std1, exp_group: 'smn2_std1', label: 'smn2', id:'std1', type:'standard', sample_name: 'smn2_std1'},
      'smn2_std2': {file: smn2_std2, exp_group: 'smn2_std2', label: 'smn2', id:'std2', type:'standard', sample_name: 'smn2_std2'}
    };
  }

  // 加入多個 sample 資料
  if (typeof smn1_sample === 'object') {
    for (let sample in smn1_sample) {
      const cleaned_name = parseFileName(smn1_sample[sample]).cleaned_name;
      const sample_name = parseFileName(smn1_sample[sample]).sample_name;
      excel_for_parsing[cleaned_name] = {file: smn1_sample[sample], exp_group: cleaned_name, label: 'smn1', id:'sample', type:'sample', sample_name: sample_name};
    }
    for (let sample in smn2_sample) {
      const cleaned_name = parseFileName(smn2_sample[sample]).cleaned_name;
      const sample_name = parseFileName(smn2_sample[sample]).sample_name;
      excel_for_parsing[cleaned_name] = {file: smn2_sample[sample], exp_group: cleaned_name, label: 'smn2', id:'sample', type:'sample', sample_name: sample_name};
    }
  } else {
    const cleaned_name_1 = parseFileName(smn1_sample).cleaned_name;
    const sample_name_1 = parseFileName(smn1_sample).sample_name;
    excel_for_parsing[cleaned_name_1] = {file: smn1_sample, exp_group: cleaned_name_1, label: 'smn1', id:'sample', type:'sample', sample_name: sample_name_1};
    const cleaned_name_2 = parseFileName(smn2_sample).cleaned_name;
    const sample_name_2 = parseFileName(smn2_sample).sample_name;
    excel_for_parsing[cleaned_name_2] = {file: smn2_sample, exp_group: cleaned_name_2, label: 'smn2', id:'sample', type:'sample', sample_name: sample_name_2};
  }

  // 檢查點：確認輸入檔案存在
  for (let excel in excel_for_parsing) {
    if (!fs.existsSync(excel_for_parsing[excel].file)) {
      throw new Error(`File ${excel_for_parsing[excel].file} does not exist.`);
    }
  }

  // Excel data collection
  const excelDataCollection = {};
  for (let excel in excel_for_parsing) {
    excelDataCollection[excel_for_parsing[excel].exp_group] = parseExcel(excel_for_parsing[excel].file);
    excelDataCollection[excel_for_parsing[excel].exp_group]['label'] = excel_for_parsing[excel].label;
    excelDataCollection[excel_for_parsing[excel].exp_group]['exp_group'] = excel_for_parsing[excel].exp_group;
    excelDataCollection[excel_for_parsing[excel].exp_group]['id'] = excel_for_parsing[excel].id;
    excelDataCollection[excel_for_parsing[excel].exp_group]['type'] = excel_for_parsing[excel].type;
    excelDataCollection[excel_for_parsing[excel].exp_group]['sample_name'] = excel_for_parsing[excel].sample_name;
  }
  return excelDataCollection;
}

/* 找 peak 通用函式 */
function findPeak(excel_data, peak_range, rfu_threshold, select_number, peak_number_check){

  /* 尋找範圍內的數字 */
  function searchRegion(dataList, range){
    // 找出落在範圍內的元素及其索引
    const result = dataList
      .map((value, index) => ({ value, index })) // 將值和索引組合成物件
      .filter(item => parseInt(item.value.replace(/,/g, '')) >= range.min && parseInt(item.value.replace(/,/g, '')) <= range.max); // 過濾出落在範圍內的元素
    return result;
  }

  // 提取data_table
  const data_table = excel_data['table'];

  // 提取 "bp" 欄位資料並轉換成陣列
  const bp_data = Object.values(data_table['bp']);

  // 檢查 bp 欄位資料是否存在
  if (!bp_data) {
    throw new Error('bp data not found.');
  }

  // 尋找 peak
  const peak_data = searchRegion(bp_data, peak_range);

  // 用 index 取得 peak 的 table 資料
  const peak_table = {
    'table_array': {},
    'table_array_transposed': new tableParser.TransposedTable(excel_data['table_array_transposed']['column_names'], {})
  };

  // 檢查 peak 數目是否足夠
  if (peak_data.length < peak_number_check) {
    logger.warn(`${excel_data['exp_group']} 範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
    dataQC_status = 'fail-the-criteria';
    QC_information.push(`${excel_data['exp_group']} 範圍內 Peak 數目小於要求的： ${peak_number_check};`);
  }

  // 搜集 peak 的 table 資料
  peak_data.forEach(item => {
    const transposed_table = excel_data['table_array_transposed'];
    peak_table['table_array_transposed'].data[item.index] = transposed_table.data[item.index];
    peak_table['table_array'] = tableParser.reverseTransposeArrayTable(peak_table['table_array_transposed']);
  });

  // 如果 QC failed, 直接回傳
  if (peak_table['table_array']['RFU'] === undefined) {
    return tableParser.reverseTransposeArrayTable(peak_table['table_array_transposed']);
  }

  // RFU 門檻篩選
  const RFU_arrayData = peak_table['table_array']['RFU'];
  const filteredRFU_arrayData_index = RFU_arrayData.map((item, index) => item >= parseFloat(rfu_threshold) ? index : null).filter(item => item !== null);

  if (filteredRFU_arrayData_index.length < peak_number_check) {
    logger.warn(`${excel_data['exp_group']} RFU 門檻篩選後範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
    dataQC_status = 'fail-the-criteria';
    QC_information.push(`${excel_data['exp_group']} RFU 門檻篩選後範圍內 Peak 數目小於要求的： ${peak_number_check};`);
  }
  for (let column in peak_table['table_array']) {
    peak_table['table_array'][column] = filteredRFU_arrayData_index.map(index => peak_table['table_array'][column][index]);
    peak_table['table_array_transposed'] = tableParser.transposeArrayTable(peak_table['table_array']); // 更新轉置表格
  }

  // 表格以 RFU 排序
  const sorted_table = tableParser.sortTable(peak_table['table_array'], 'RFU', 'table_index', false);
  const transposed_sorted_table = tableParser.transposeArrayTable(sorted_table);

  // 選擇前 select_number 個 peak
  const selected_table = new tableParser.TransposedTable(transposed_sorted_table.column_names, {});
  for (let i = 0; i < select_number; i++) {
    if (transposed_sorted_table.data[i] !== undefined) {
      selected_table.data[i] = transposed_sorted_table.data[i];
    }
  }

  const output_table = tableParser.reverseTransposeArrayTable(selected_table);
  return output_table;
}

/* Step2: 統整 peak 資料 */
function summaryPeakData(fileCollection){

  // 自定義物件 - peak 資料物件
  class SMA_peak_data{
    constructor(exp_group, label, type, ic_peak_table, tg_peak_table, sample_name){
      this.exp_group = exp_group;         // 實驗群組 (ex: smn1_std1)
      this.label = label;                 // 實驗標籤 (ex: smn1)
      this.type = type;                   // 實驗類型 (ex: standard, sample)
      this.ic_peak_table = ic_peak_table; // internal control peak 資料
      this.tg_peak_table = tg_peak_table; // target peak 資料
      this.sample_name = sample_name;     // sample 名稱 (ex: smn1_std1)
    }
  }

  // 尋找 peaks + 條件篩選
  let SMA1_data = {};
  let SMA2_data = {};
  for (let data in fileCollection) {
    if (fileCollection[data]['label'] === 'smn1') {
      const select_top_peak_number = 1;
      const smn1_ic_peak_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMN1_IC_SIZE_RANGE,
        LAB_DEFINED.RFU_THRESHOLD.SMN1_IC,
        select_top_peak_number,
        LAB_DEFINED.PEAK_NUMBER_CHECK.SMN1
      );
      const usePeakNumCheck = fileCollection[data]['type'] == 'standard' ? LAB_DEFINED.PEAK_NUMBER_CHECK.SMN1 :0;
      const smn1_tg_peak_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMN1_TG_SIZE_RANGE,
        LAB_DEFINED.RFU_THRESHOLD.SMN1_TG,
        select_top_peak_number,
        usePeakNumCheck
      );
      const sma1_peak_data = new SMA_peak_data(
        fileCollection[data]['exp_group'],
        fileCollection[data]['label'],
        fileCollection[data]['type'],
        tableParser.getSingelValueTable(smn1_ic_peak_table),
        tableParser.getSingelValueTable(smn1_tg_peak_table),
        fileCollection[data]['sample_name']
      );
      SMA1_data[fileCollection[data]['exp_group']] = sma1_peak_data;
    }
    else if (fileCollection[data]['label'] === 'smn2') {
      const select_top_peak_number = 1;
      const smn2_ic_peak_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMN2_IC_SIZE_RANGE,
        LAB_DEFINED.RFU_THRESHOLD.SMN2_IC,
        select_top_peak_number,
        LAB_DEFINED.PEAK_NUMBER_CHECK.SMN2
      );
      const usePeakNumCheck = fileCollection[data]['type'] == 'standard' ? LAB_DEFINED.PEAK_NUMBER_CHECK.SMN2 :0;
      const smn2_tg_peak_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMN2_TG_SIZE_RANGE,
        LAB_DEFINED.RFU_THRESHOLD.SMN2_TG,
        select_top_peak_number,
        usePeakNumCheck
      );
      const sma2_peak_data = new SMA_peak_data(
        fileCollection[data]['exp_group'],
        fileCollection[data]['label'],
        fileCollection[data]['type'],
        tableParser.getSingelValueTable(smn2_ic_peak_table),
        tableParser.getSingelValueTable(smn2_tg_peak_table),
        fileCollection[data]['sample_name']
      );
      SMA2_data[fileCollection[data]['exp_group']] = sma2_peak_data;
    }
  }

  // 統整資料
  const data_summary = {};
  data_summary['sma1_peak_data'] = SMA1_data;
  data_summary['sma2_peak_data'] = SMA2_data;
  return data_summary;
}

/* Step3: 計算RFU數值 */
function summaryRFUData(data_summary, parameters){
  class experiment_result{
    constructor(internal_control, target, type, smn, sample_name){
      this.internal_control = parseFloat(internal_control);
      this.target = parseFloat(target);
      this.diff = parseFloat((this.target / this.internal_control).toFixed(1));
      this.type = type;
      this.smn = smn;
      this.sample_name = sample_name;
    }
  }
  // 擷取出計算需要的數值
  const SMA1_STD1 = new experiment_result(data_summary['sma1_peak_data']['smn1_std1']['ic_peak_table']['RFU'], data_summary['sma1_peak_data']['smn1_std1']['tg_peak_table']['RFU'], 'standard', 'smn1', data_summary['sma1_peak_data']['smn1_std1']['sample_name']);
  const SMA1_STD2 = new experiment_result(data_summary['sma1_peak_data']['smn1_std2']['ic_peak_table']['RFU'], data_summary['sma1_peak_data']['smn1_std2']['tg_peak_table']['RFU'], 'standard', 'smn1', data_summary['sma1_peak_data']['smn1_std2']['sample_name']);
  const SMA2_STD1 = new experiment_result(data_summary['sma2_peak_data']['smn2_std1']['ic_peak_table']['RFU'], data_summary['sma2_peak_data']['smn2_std1']['tg_peak_table']['RFU'], 'standard', 'smn2', data_summary['sma2_peak_data']['smn2_std1']['sample_name']);
  const SMA2_STD2 = new experiment_result(data_summary['sma2_peak_data']['smn2_std2']['ic_peak_table']['RFU'], data_summary['sma2_peak_data']['smn2_std2']['tg_peak_table']['RFU'], 'standard', 'smn2', data_summary['sma2_peak_data']['smn2_std2']['sample_name']);

  // DataMatrix
  const data_matrix = {
    'smn1': {
      'std1': SMA1_STD1,
      'std2': SMA1_STD2
    },
    'smn2': {
      'std1': SMA2_STD1,
      'std2': SMA2_STD2
    }
  }

  // 加入 sample 資料
  for (let data in data_summary['sma1_peak_data']) {
    if (data_summary['sma1_peak_data'][data]['type'] === 'sample') {
      const SAMPLE_DATA = new experiment_result(
        data_summary['sma1_peak_data'][data]['ic_peak_table']['RFU'],
        data_summary['sma1_peak_data'][data]['tg_peak_table']['RFU'],
        'sample',
        'smn1',
        data_summary['sma1_peak_data'][data]['sample_name']
      );
      data_matrix['smn1'][data] = SAMPLE_DATA;
    }
  }
  for (let data in data_summary['sma2_peak_data']) {
    if (data_summary['sma2_peak_data'][data]['type'] === 'sample') {
      const SAMPLE_DATA = new experiment_result(
        data_summary['sma2_peak_data'][data]['ic_peak_table']['RFU'],
        data_summary['sma2_peak_data'][data]['tg_peak_table']['RFU'],
        'sample',
        'smn2',
        data_summary['sma2_peak_data'][data]['sample_name']
      );
      data_matrix['smn2'][data] = SAMPLE_DATA;
    }
  }

  return data_matrix;
}

/* Step4: 判斷 sample 的 copy number */
function determineCopyNumber(rfu_data, range_data){

  for (let group in rfu_data) {
    for (let sample in rfu_data[group]) {
      if (sample === 'std1') {
        rfu_data[group][sample]['copy_number'] = 1;
      }
      else if (sample === 'std2') {
        rfu_data[group][sample]['copy_number'] = 2;
      }
      else {
        // 如果 interal control 不是 Null, Targer = Null 時將它改成 0
        if (rfu_data[group][sample]['internal_control'] > 0 && isNaN(rfu_data[group][sample]['target'])) {
          rfu_data[group][sample]['target'] = 0;
          rfu_data[group][sample]['diff'] = 0;
        }
        let copy_number = 0;
        const ratio_to_SC1 = (rfu_data[group][sample]['diff'] / rfu_data[group]['std1']['diff']).toFixed(1);
        if (ratio_to_SC1 < range_data[group].copy_1.min) {
          copy_number = 0;
        }
        else if (range_data[group].copy_1.min <= ratio_to_SC1 && ratio_to_SC1 <= range_data[group].copy_1.max) {
          copy_number = 1;
        }
        else if (range_data[group].copy_2.min <= ratio_to_SC1 && ratio_to_SC1 <= range_data[group].copy_2.max) {
          copy_number = 2;
        }
        else if (ratio_to_SC1 > range_data[group].copy_2.max)  {
          copy_number = 3;
        }
        else if (ratio_to_SC1 == range_data[group].invalid) {
          copy_number = 'Invalid';
        }
        else {
          copy_number = 'Invalid';
        }
        rfu_data[group][sample]['copy_number'] = copy_number;
      }
    }
  }

  return rfu_data;
}

/* 處理 Peaks 輸出 */
function handleOutput_peaks(dataObj){
  for (let group in dataObj) {
    for (let std in dataObj[group]) {
      dataObj[group][std]['ic_peak_table']['exp_group'] = std;
      dataObj[group][std]['ic_peak_table']['label'] = dataObj[group][std]['label'];
      dataObj[group][std]['ic_peak_table']['peak_type'] = 'Internal Control';
      dataObj[group][std]['tg_peak_table']['exp_group'] = std;
      dataObj[group][std]['tg_peak_table']['label'] = dataObj[group][std]['label'];
      dataObj[group][std]['tg_peak_table']['peak_type'] = 'Target';
    }
  }
}

/* 處理 RFU 輸出 */
function handleOutput_rfu(dataObj){
  for (let group in dataObj) {
    for (let std in dataObj[group]) {
      dataObj[group][std]['exp_group'] = std;
      dataObj[group][std]['label'] = group;
    }
  }
}

/* 處理輸出 JSON 檔案 */
function jsonOutput(outputPath, output) {
  //Output result to JSON file
  fs.writeFile(
    outputPath,
    JSON.stringify(output, null, 4),
    "utf8",
    function (err) {
      if (err) {
        logger.warn({
          label: "Log recored error",
          message: `Faile to write JSON Object to ${JSON_OUTPUT}: \n${err}`,
        });
      }
      logger.info(`JSON file has been saved in ${JSON_OUTPUT}`);
    }
  );
  logger.info(`Logger are saved in ${JSON_DIR}`);
}

/* Additional function */
const qcAssessment = (control_id, dataQC_status, information) => {
  // Make QC object
  const qc = {
    run_id: control_id,
    status: dataQC_status,
    information: [... new Set(information)],
  };
  return qc;
}

/* 主程式 */
function mainRun(
  smn1_std1, smn1_std2,
  smn2_std1, smn2_std2,
  smn1_sample, smn2_sample
) {

  // 設定實驗室定義參數
  LAB_DEFINED = default_LAB_DEFINED
  logger.info('use default_LAB_DEFINED:')
  logger.info(LAB_DEFINED);

  // 初始化共用變數
  dataQC_status = ''
  QC_information = []

  // 搜集 control_id
  const control_id = collectControlId([
    smn1_std1, smn1_std2,
    smn2_std1, smn2_std2,
  ]);

  // Step1: 準備輸入檔案
  const preparedInputFile = prepareInputFile(
    smn1_std1, smn1_std2,
    smn2_std1, smn2_std2,
    smn1_sample, smn2_sample
  );

  // Step2: 統整 peak 資料
  const peak_data = summaryPeakData(preparedInputFile);

  // 如果 std 的 ic 或 tg peak 資料為空,則 QC 失敗
  if (
    (Object.keys(peak_data['sma1_peak_data']['smn1_std1']['ic_peak_table']).length === 0 || Object.keys(peak_data['sma1_peak_data']['smn1_std1']['tg_peak_table']).length === 0) ||
    (Object.keys(peak_data['sma1_peak_data']['smn1_std2']['ic_peak_table']).length === 0 || Object.keys(peak_data['sma1_peak_data']['smn1_std2']['tg_peak_table']).length === 0) ||
    (Object.keys(peak_data['sma2_peak_data']['smn2_std1']['ic_peak_table']).length === 0 || Object.keys(peak_data['sma2_peak_data']['smn2_std1']['tg_peak_table']).length === 0) ||
    (Object.keys(peak_data['sma2_peak_data']['smn2_std2']['ic_peak_table']).length === 0 || Object.keys(peak_data['sma2_peak_data']['smn2_std2']['tg_peak_table']).length === 0)
  ) {
    dataQC_status = 'fail-the-criteria';
    QC_information.push(`Standard 的 ic 或 tg peak 資料為空.`);
  }

  // Step3: 計算 RFU 數值
  let rfu_data = summaryRFUData(peak_data, LAB_DEFINED);

  // smn1 如果 SC2 除以 SC1 的值小於等於 1.3, 則 QC 失敗
  const sc1_sc2_ratio = (rfu_data['smn1']['std2']['diff'] / rfu_data['smn1']['std1']['diff']).toFixed(1);
  if (sc1_sc2_ratio <= LAB_DEFINED.SC_DIFF_RATIO.SMN1) {
    dataQC_status = 'fail-the-criteria';
    QC_information.push(`Standard smn1 的 SC2 除以 SC1 的值小於等於閾值.`);
  }
  // smn2 如果 SC2 除以 SC1 的值小於 1.3, 則 QC 失敗
  const sc2_sc1_ratio = (rfu_data['smn2']['std2']['diff'] / rfu_data['smn2']['std1']['diff']).toFixed(1);
  if (sc2_sc1_ratio < LAB_DEFINED.SC_DIFF_RATIO.SMN2) {
    dataQC_status = 'fail-the-criteria';
    QC_information.push(`Standard smn2 的 SC2 除以 SC1 的值小於閾值.`);
  }

  // Step4: 判斷 sample 的 copy number
  let labeled_rfu_data = determineCopyNumber(rfu_data, LAB_DEFINED.COPY_NUMBER_RANGE);

  // 整理 sample result
  const sample_list = Object.values(labeled_rfu_data.smn1).filter(sample => sample.type === 'sample').map(sample => sample.sample_name);
  let sample_result = {};
  for (let sample of sample_list) {
    const smn1_num = Object.values(labeled_rfu_data.smn1).find(rfu => rfu.sample_name === sample);
    const smn2_num = Object.values(labeled_rfu_data.smn2).find(rfu => rfu.sample_name === sample);
    sample_result[sample] = {
      'smn1': smn1_num.copy_number,
      'smn2': smn2_num.copy_number,
      'result_str': `${smn1_num.copy_number}:${smn2_num.copy_number}`,
    };
  }

  // Step5: 合併全部結果, 輸出必要的資訊
  const output = {
    'config': {
      'nucleus': "v3.9.4",
      'logger': [JSON_DIR, JSON_OUTPUT],
    },
    'result':{
      'peak_data': peak_data,
      'labeled_rfu_data': labeled_rfu_data,
      'sample_result': sample_result,
      'source_data': preparedInputFile,
    }
  }

  // 處理輸出
  handleOutput_peaks(output['result']['peak_data']);
  handleOutput_rfu(output['result']['labeled_rfu_data']);
  if (dataQC_status === '') { dataQC_status = 'meet-the-criteria'; }
  output['qc'] = qcAssessment(control_id, dataQC_status, QC_information);

  // 回傳主程式輸出
  return output;
}

// Run by called
module.exports = {
  runSmaV4: function (
    smn1_std1, smn1_std2,
    smn2_std1, smn2_std2,
    smn1_sample, smn2_sample
  ) {
    logger.info("******* Running for SMA v4 main process *******");
    try {
      // 執行主程式
      let output = mainRun(
        smn1_std1, smn1_std2,
        smn2_std1, smn2_std2,
        smn1_sample, smn2_sample
      );
      // 將主程式輸出寫入 JSON 檔案
      if (output) {
        jsonOutput(JSON_OUTPUT, output);
      }
      // 回傳主程式輸出
      return output;
    } catch (error) {
      logger.error({
        label: "Error",
        message: `${error.message} \n${error.stack}`,
      });
    }
  },
};

// Run by node
if (require.main === module) {
  module.exports.runSmaV4(
    argv.smn1_std1,
    argv.smn1_std2,
    argv.smn2_std1,
    argv.smn2_std2,
    argv.smn1_sample,
    argv.smn2_sample
  );
}
