/**
 * Testing SMA core v4 for Suspect-X.
 *
 * Run directly by node:
 *   node test/sma-v4-core-test.js \
 *   --smn1_std1 SMA1_standard1.xlsx \
 *   --smn1_std2 SMA1_standard2.xlsx \
 *   --smn1_std3 SMA1_standard3.xlsx \
 *   --smn1_sample SMA1_sample.xlsx \
 *   --smn2_std1 SMA2_standard1.xlsx \
 *   --smn2_std2 SMA2_standard2.xlsx \
 *   --smn2_std3 SMA2_standard3.xlsx \
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

// 處理命令列參數設定
const argv = require("minimist")(process.argv.slice(2), {default: {}});

/* 實驗室定義數值範圍 */
const LAB_DEFINED = {
  RANGE: {
    SMA1_IC_SIZE_RANGE: {min: 217, max: 265},
    SMA1_TG_SIZE_RANGE: {min: 111, max: 135},
    SMA2_SEARCH_RANGE: {min: 251, max: 337},
    FORTEST: {min: 19, max: 2000}
  },
  THRESHOLD: {
    RFU: 1,
    RFU_FORTEST: 1
  },
  PEAK_NUMBER_CHECK: {
    SMA1: 1,
    SMA2: 2
  }
}

// 設定 Logger 和存放位置
const JSON_DIR = path.join(os.tmpdir(), "ACCUiNspection_" + moment().format("YYYYMMDD"));
const JSON_OUTPUT = path.join(JSON_DIR, "SMA_v4_" + moment().format("YYYYMMDD_HHmmss") + ".json");
const jsonOutputDir = path.dirname(JSON_OUTPUT);
if (!fs.existsSync(jsonOutputDir)) {
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

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

/* 解析檔案名稱 */
function parseFileName(full_file_path){
  const file_name = path.basename(full_file_path);
  const file_name_without_extension = file_name.split(".")[0];
  return file_name_without_extension;
}

/* 解析 Excel 檔案內容, 回傳資料表 */
function parseExcel(excelPath) {

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
  smn1_std1, smn1_std2, smn1_std3,
  smn2_std1, smn2_std2, smn2_std3,
  smn1_sample, smn2_sample
){
  // 解析 Excel 檔案
  let excel_for_parsing = {
    'smn1_std1': {file: smn1_std1, exp_group: 'smn1_std1', label: 'smn1', id:'std1', type:'standard'},
    'smn1_std2': {file: smn1_std2, exp_group: 'smn1_std2', label: 'smn1', id:'std2', type:'standard'},
    'smn1_std3': {file: smn1_std3, exp_group: 'smn1_std3', label: 'smn1', id:'std3', type:'standard'},
    'smn2_std1': {file: smn2_std1, exp_group: 'smn2_std1', label: 'smn2', id:'std1', type:'standard'},
    'smn2_std2': {file: smn2_std2, exp_group: 'smn2_std2', label: 'smn2', id:'std2', type:'standard'},
    'smn2_std3': {file: smn2_std3, exp_group: 'smn2_std3', label: 'smn2', id:'std3', type:'standard'}
  };

  // 加入多個 sample 資料
  if (typeof smn1_sample === 'object') {
    for (let sample in smn1_sample) {
      excel_for_parsing[parseFileName(smn1_sample[sample])] = {file: smn1_sample[sample], exp_group: parseFileName(smn1_sample[sample]), label: 'smn1', id:'sample', type:'sample'};
    }
    for (let sample in smn2_sample) {
      excel_for_parsing[parseFileName(smn2_sample[sample])] = {file: smn2_sample[sample], exp_group: parseFileName(smn2_sample[sample]), label: 'smn2', id:'sample', type:'sample'};
    }
  } else {
    excel_for_parsing[parseFileName(smn1_sample)] = {file: smn1_sample, exp_group: parseFileName(smn1_sample), label: 'smn1', id:'sample', type:'sample'};
    excel_for_parsing[parseFileName(smn2_sample)] = {file: smn2_sample, exp_group: parseFileName(smn2_sample), label: 'smn2', id:'sample', type:'sample'};
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
    logger.warn(`範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
    throw new Error(`範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
  }

  // 搜集 peak 的 table 資料
  peak_data.forEach(item => {
    const transposed_table = excel_data['table_array_transposed'];
    peak_table['table_array_transposed'].data[item.index] = transposed_table.data[item.index];
    peak_table['table_array'] = tableParser.reverseTransposeArrayTable(peak_table['table_array_transposed']);
  });

  // RFU 門檻篩選
  const RFU_arrayData = peak_table['table_array']['RFU'];
  const filteredRFU_arrayData_index = RFU_arrayData.map((item, index) => item >= rfu_threshold ? index : null).filter(item => item !== null);
  if (filteredRFU_arrayData_index.length < peak_number_check) {
    logger.warn(`RFU 門檻篩選後範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
    throw new Error(`RFU 門檻篩選後範圍內 Peak 數目小於要求的： ${peak_number_check} 判定為無效.`);
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
    selected_table.data[i] = transposed_sorted_table.data[i];
  }
  const output_table = tableParser.reverseTransposeArrayTable(selected_table);
  return output_table;
}

/* Step2: 統整 peak 資料 */
function summaryPeakData(fileCollection){

  // 自定義物件 - peak 資料物件
  class SMA_peak_data{
    constructor(exp_group, label, type, ic_peak_table, tg_peak_table){
      this.exp_group = exp_group;         // 實驗群組 (ex: smn1_std1)
      this.label = label;                 // 實驗標籤 (ex: smn1)
      this.type = type;                   // 實驗類型 (ex: standard, sample)
      this.ic_peak_table = ic_peak_table; // internal control peak 資料
      this.tg_peak_table = tg_peak_table; // target peak 資料
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
        LAB_DEFINED.RANGE.SMA1_IC_SIZE_RANGE,
        LAB_DEFINED.THRESHOLD.RFU,
        select_top_peak_number,
        LAB_DEFINED.PEAK_NUMBER_CHECK.SMA1
      );
      const smn1_tg_peak_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMA1_TG_SIZE_RANGE,
        LAB_DEFINED.THRESHOLD.RFU,
        select_top_peak_number,
        LAB_DEFINED.PEAK_NUMBER_CHECK.SMA1
      );
      const sma1_peak_data = new SMA_peak_data(
        fileCollection[data]['exp_group'],
        fileCollection[data]['label'],
        fileCollection[data]['type'],
        tableParser.getSingelValueTable(smn1_ic_peak_table),
        tableParser.getSingelValueTable(smn1_tg_peak_table)
      );
      SMA1_data[fileCollection[data]['exp_group']] = sma1_peak_data;
    } else if (fileCollection[data]['label'] === 'smn2') {
      const select_top_peak_number = 2;
      const smn2_peaks_table = findPeak(
        fileCollection[data],
        LAB_DEFINED.RANGE.SMA2_SEARCH_RANGE,
        LAB_DEFINED.THRESHOLD.RFU,
        select_top_peak_number,
        LAB_DEFINED.PEAK_NUMBER_CHECK.SMA2
      );

      // 將表格以 bp 排序
      const bp_sorted_sma2_peak_table = tableParser.sortTable(smn2_peaks_table, 'bp', 'table_index', false);
      const transposed_bp_sorted_sma2_peak_table = tableParser.transposeArrayTable(bp_sorted_sma2_peak_table);

      // 取比較大的 peak (排序第一個) 為 SMA2 target peak
      const selected_sma2_peak_table = new tableParser.TransposedTable(transposed_bp_sorted_sma2_peak_table.column_names, {});
      selected_sma2_peak_table.data[0] = transposed_bp_sorted_sma2_peak_table.data[0];
      const sma2_target_peak_data = tableParser.reverseTransposeArrayTable(selected_sma2_peak_table);

      // 取比較小的 peak (排序最後一個) 為 internal control peak
      const selected_internal_control_peak_table = new tableParser.TransposedTable(transposed_bp_sorted_sma2_peak_table.column_names, {});
      selected_internal_control_peak_table.data[0] = transposed_bp_sorted_sma2_peak_table.data[1];
      const sma2_internal_control_peak_data = tableParser.reverseTransposeArrayTable(selected_internal_control_peak_table);

      const sma2_peak_data = new SMA_peak_data(
        fileCollection[data]['exp_group'],
        fileCollection[data]['label'],
        fileCollection[data]['type'],
        tableParser.getSingelValueTable(sma2_target_peak_data),
        tableParser.getSingelValueTable(sma2_internal_control_peak_data)
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
function summaryRFUData(data_summary){
  class experiment_result{
    constructor(internal_control, target, type, smn){
      this.internal_control = parseFloat(internal_control);
      this.target = parseFloat(target);
      this.diff = parseFloat((this.target / this.internal_control).toFixed(3));
      this.type = type;
      this.smn = smn;
    }
  }
  // 擷取出計算需要的數值
  const SMA1_STD1 = new experiment_result(data_summary['sma1_peak_data']['smn1_std1']['ic_peak_table']['RFU'], data_summary['sma1_peak_data']['smn1_std1']['tg_peak_table']['RFU'], 'standard', 'smn1');
  const SMA1_STD2 = new experiment_result(data_summary['sma1_peak_data']['smn1_std2']['ic_peak_table']['RFU'], data_summary['sma1_peak_data']['smn1_std2']['tg_peak_table']['RFU'], 'standard', 'smn1');
  const SMA1_STD3 = new experiment_result(data_summary['sma1_peak_data']['smn1_std3']['ic_peak_table']['RFU'], data_summary['sma1_peak_data']['smn1_std3']['tg_peak_table']['RFU'], 'standard', 'smn1');
  const SMA2_STD1 = new experiment_result(data_summary['sma2_peak_data']['smn2_std1']['ic_peak_table']['RFU'], data_summary['sma2_peak_data']['smn2_std1']['tg_peak_table']['RFU'], 'standard', 'smn2');
  const SMA2_STD2 = new experiment_result(data_summary['sma2_peak_data']['smn2_std2']['ic_peak_table']['RFU'], data_summary['sma2_peak_data']['smn2_std2']['tg_peak_table']['RFU'], 'standard', 'smn2');
  const SMA2_STD3 = new experiment_result(data_summary['sma2_peak_data']['smn2_std3']['ic_peak_table']['RFU'], data_summary['sma2_peak_data']['smn2_std3']['tg_peak_table']['RFU'], 'standard', 'smn2');

  // DataMatrix
  const data_matrix = {
    'smn1': {
      'std1': SMA1_STD1,
      'std2': SMA1_STD2,
      'std3': SMA1_STD3
    },
    'smn2': {
      'std1': SMA2_STD1,
      'std2': SMA2_STD2,
      'std3': SMA2_STD3
    }
  }

  // 加入 sample 資料
  for (let data in data_summary['sma1_peak_data']) {
    if (data_summary['sma1_peak_data'][data]['type'] === 'sample') {
      const SAMPLE_DATA = new experiment_result(
        data_summary['sma1_peak_data'][data]['ic_peak_table']['RFU'],
        data_summary['sma1_peak_data'][data]['tg_peak_table']['RFU'],
        'sample',
        'smn1'
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
        'smn2'
      );
      data_matrix['smn2'][data] = SAMPLE_DATA;
    }
  }

  return data_matrix;
}

/* 判斷數值範圍 */
function determineRange(data_matrix){
  // SMA1 (2:2 和 1:1 的差值) & (3:3 和 2:2 的差值)
  const sma1_diff_2_1 = data_matrix['smn1']['std2']['diff'] - data_matrix['smn1']['std1']['diff'];
  const sma1_diff_3_2 = data_matrix['smn1']['std3']['diff'] - data_matrix['smn1']['std2']['diff'];

  // SMA2 (2:1 和 1:1 的差值) & (3:3 和 2:2 的差值)
  const sma2_diff_2_1 = data_matrix['smn2']['std2']['diff'] - data_matrix['smn2']['std1']['diff'];
  const sma2_diff_3_2 = data_matrix['smn2']['std3']['diff'] - data_matrix['smn2']['std2']['diff'];

  // 計算判斷間距
  const SMA1_D1 = data_matrix['smn1']['std1']['diff']
  const SMA1_RANGES = {
    '1': {min: SMA1_D1, max: SMA1_D1 + sma1_diff_2_1/2},
    '2': {min: SMA1_D1 + sma1_diff_2_1/2, max: SMA1_D1 + sma1_diff_2_1/2 + sma1_diff_3_2/2},
    '3': {min: SMA1_D1 + sma1_diff_2_1/2 + sma1_diff_3_2/2, max: Infinity},
  }
  const SMA2_D1 = data_matrix['smn2']['std1']['diff']
  const SMA2_RANGES = {
    '1': {min: SMA2_D1, max: SMA2_D1 + sma2_diff_2_1/2},
    '2': {min: SMA2_D1 + sma2_diff_2_1/2, max: SMA2_D1 + sma2_diff_2_1/2 + sma2_diff_3_2/2},
    '3': {min: SMA2_D1 + sma2_diff_2_1/2 + sma2_diff_3_2/2, max: Infinity},
  }
  const SMA_RANGES = {
    'smn1': SMA1_RANGES,
    'smn2': SMA2_RANGES,
  }
  return SMA_RANGES;
}

/* Step4: 判斷 sample 的 copy number */
function determineCopyNumber(rfu_data, range_data){
  const smn1_range_1_copy = range_data['smn1']['1'];
  const smn1_range_2_copy = range_data['smn1']['2'];
  const smn1_range_3_copy = range_data['smn1']['3'];
  const smn2_range_1_copy = range_data['smn2']['1'];
  const smn2_range_2_copy = range_data['smn2']['2'];
  const smn2_range_3_copy = range_data['smn2']['3'];

  for (let group in rfu_data) {
    for (let std in rfu_data[group]) {
      if (rfu_data[group][std]['smn'] === 'smn1') {
        if (rfu_data[group][std]['diff'] >= smn1_range_3_copy['min']){
          rfu_data[group][std]['copy_number'] = 3;
        } else if (rfu_data[group][std]['diff'] >= smn1_range_2_copy['min']){
          rfu_data[group][std]['copy_number'] = 2;
        } else if (rfu_data[group][std]['diff'] >= smn1_range_1_copy['min']){
          rfu_data[group][std]['copy_number'] = 1;
        } else{
          rfu_data[group][std]['copy_number'] = 0;
        }
      } else if (rfu_data[group][std]['smn'] === 'smn2') {
        if (rfu_data[group][std]['diff'] >= smn2_range_3_copy['min']){
          rfu_data[group][std]['copy_number'] = 3;
        } else if (rfu_data[group][std]['diff'] >= smn2_range_2_copy['min']){
          rfu_data[group][std]['copy_number'] = 2;
        } else if (rfu_data[group][std]['diff'] >= smn2_range_1_copy['min']){
          rfu_data[group][std]['copy_number'] = 1;
        } else{
          rfu_data[group][std]['copy_number'] = 0;
        }
      }
    }
  }
  return rfu_data;
}

/* 處理 Excel 輸出 */
function handleExcelOutput_peaks(dataObj){
  let output_json = [];
  for (let group in dataObj) {
    for (let std in dataObj[group]) {
      dataObj[group][std]['ic_peak_table']['exp_group'] = std;
      dataObj[group][std]['ic_peak_table']['label'] = dataObj[group][std]['label'];
      dataObj[group][std]['ic_peak_table']['peak_type'] = 'Internal Control';
      dataObj[group][std]['tg_peak_table']['exp_group'] = std;
      dataObj[group][std]['tg_peak_table']['label'] = dataObj[group][std]['label'];
      dataObj[group][std]['tg_peak_table']['peak_type'] = 'Target';
      output_json.push(dataObj[group][std]['ic_peak_table']);
      output_json.push(dataObj[group][std]['tg_peak_table']);
    }
  }
  return output_json;
}
function handleExcelOutput_rfu(dataObj){
  let output_json = [];
  for (let group in dataObj) {
    for (let std in dataObj[group]) {
      dataObj[group][std]['exp_group'] = std;
      dataObj[group][std]['label'] = group;
      output_json.push(dataObj[group][std]);
    }
  }
  return output_json;
}
function handleExcelOutput_range(dataObj){
  let output_json = [];
  for (let label in dataObj) {
    for (let copy_number in dataObj[label]) {
      dataObj[label][copy_number]['label'] = label;
      dataObj[label][copy_number]['copy_number'] = copy_number;
      output_json.push(dataObj[label][copy_number]);
    }
  }
  return output_json;
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
/* Step 5: 輸出 Excel 檔案 */
function outputExcel(data_jsons){
  const workbook = XLSX.utils.book_new();
  for (let data_json in data_jsons) {
    const worksheet = XLSX.utils.json_to_sheet(data_jsons[data_json]);
    XLSX.utils.book_append_sheet(workbook, worksheet, data_json);
  }
  XLSX.writeFile(workbook, 'output.xlsx');
}

/* 主程式 */
function mainRun(
  smn1_std1, smn1_std2, smn1_std3,
  smn2_std1, smn2_std2, smn2_std3,
  smn1_sample, smn2_sample
) {

  // Step1: 準備輸入檔案
  const preparedInputFile = prepareInputFile(
    smn1_std1, smn1_std2, smn1_std3,
    smn2_std1, smn2_std2, smn2_std3,
    smn1_sample, smn2_sample);

  // Step2: 統整 peak 資料
  const peak_data = summaryPeakData(preparedInputFile);

  // Step3: 計算 RFU 數值
  const rfu_data = summaryRFUData(peak_data);

  // Step4: 判斷 sample 的 copy number
  const range = determineRange(rfu_data); // 判斷範圍
  const labeled_rfu_data = determineCopyNumber(rfu_data, range);

  // Step5: 合併全部結果, 輸出 JSON 和 Excel
  const output = {
    'peak_data': peak_data,
    'range': range,
    'labeled_rfu_data': labeled_rfu_data
  }

  // 輸出 JSON 檔案
  const peak_output_json = handleExcelOutput_peaks(output['peak_data']);
  const range_output_json = handleExcelOutput_range(output['range']);
  const rfu_output_json = handleExcelOutput_rfu(output['labeled_rfu_data']);

  // 輸出 Excel 檔案
  outputExcel({
    'peak_data': peak_output_json,
    'rfu_data': rfu_output_json,
    'range_data': range_output_json,
  });

  // 回傳主程式輸出
  return output;
}

// Run by called
module.exports = {
  runSmaV4: function (
    smn1_std1, smn1_std2, smn1_std3,
    smn2_std1, smn2_std2, smn2_std3,
    smn1_sample, smn2_sample,
  ) {
    logger.info("******* Running for SMA v4 main process *******");
    try {
      // 執行主程式
      let output = mainRun(
        smn1_std1, smn1_std2, smn1_std3,
        smn2_std1, smn2_std2, smn2_std3,
        smn1_sample, smn2_sample,
      );
      // 將主程式輸出寫入 JSON 檔案
      jsonOutput(JSON_OUTPUT, output);
      // 回傳主程式輸出
      return output;
    } catch (error) {
      logger.error({
        label: "Error",
        message: `${error.message}`,
      });
    }
  },
};

// Run by node
if (require.main === module) {
  module.exports.runSmaV4(
    argv.smn1_std1,
    argv.smn1_std2,
    argv.smn1_std3,
    argv.smn2_std1,
    argv.smn2_std2,
    argv.smn2_std3,
    argv.smn1_sample,
    argv.smn2_sample
  );
}
