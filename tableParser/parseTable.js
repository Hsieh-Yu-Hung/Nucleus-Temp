/**
 * Table parser for Suspect-X.
 *
 * 自製的 Table Parser 用來處理表格資料
 *
 */


/* 定義 Table Parser */
module.exports = function(callModule) {
  return {
    checkSameRow: checkSameRow,
    parseColumnAddress: parseColumnAddress,
    getColumnValues: getColumnValues,
    convertTableToArray: convertTableToArray,
    transposeArrayTable: transposeArrayTable,
    reverseTransposeArrayTable: reverseTransposeArrayTable,
    cleanUpData: cleanUpData,
    sortTable: sortTable,
    getSingelValueTable: getSingelValueTable,
    TransposedTable: TransposedTable
  }
}

// 自定義物件 - 轉置表格
class TransposedTable{
  constructor(column_names, data){
    // 檢查 column_names 是否為陣列
    if (!Array.isArray(column_names)) {
      throw new Error("column_names 必須為陣列");
    }
    this.column_names = column_names;
    this.data = data;
  }
}

/* 將資料表轉換成陣列 */
function convertTableToArray(data_table){
  const array_table = {};
  for (let column in data_table) {
    array_table[column] = Object.values(data_table[column]);
  }
  return array_table;
}

/* 搜集欄位資料 */
function getColumnValues(columnName, expectColumns, excelData) {

  // 初始化輸出物件
  const columnValues = {};

  // 取得目標欄位位址
  const columnAddress = expectColumns[columnName]?.targetCell;

  // 如果目標欄位不存在, 回傳空物件
  if (!columnAddress) {
    logger.warn(`Column ${columnName} not found.`);
    return columnValues;
  }

  // 取得目標欄位字母和數字
  const parsedColumnAddress = parseColumnAddress(columnAddress);

  // 遍歷資料表, 搜集目標欄位資料
  for (let cell in excelData) {
    const cellNumber = cell.match(/\d+/)?.[0];
    if (cell.startsWith(parsedColumnAddress.columnLetter) && cell !== columnAddress && parseInt(cellNumber) > parseInt(parsedColumnAddress.columnNumber)) {
      columnValues[cell] = excelData[cell].v;
    }
  }

  // 回傳搜集到的資料
  return columnValues;
}

/* 解析欄位字母和數字 */
function parseColumnAddress(columnAddress) {
  const output = {};
  const columnLetter = columnAddress.match(/[A-Z]+/)[0];
  const columnNumber = columnAddress.match(/\d+/)[0];
  output.columnLetter = columnLetter;
  output.columnNumber = columnNumber;
  return output;
}

/* 轉置陣列表格 */
function transposeArrayTable(array_table){
  const column_names = Object.keys(array_table);
  const transposed_table = new TransposedTable(column_names, {});
  const dataLength = array_table[column_names[0]].length;
  for (let i = 0; i < dataLength; i++) {
    transposed_table['data'][i] = column_names.map(column => array_table[column][i]);
  }
  return transposed_table;
}

/* 轉置回去陣列表格*/
function reverseTransposeArrayTable(transposed_table){
  const array_table = {};
  const column_length = transposed_table.column_names.length;
  for (let i = 0; i < column_length; i++) {
    const keys = Object.keys(transposed_table.data);
    const value_collection = [];
    for (let key of keys) {
      value_collection.push(transposed_table.data[key][i]);
    }
    array_table[transposed_table.column_names[i]] = value_collection;
  }
  return array_table;
}

// 檢查點：找到的欄位是否都在同一行
function checkSameRow(expectColumns) {
  let checkList = [];
  for (let column in expectColumns) {
    const parsedTargetCell = parseColumnAddress(expectColumns[column].targetCell);
    checkList.push(parsedTargetCell.columnNumber);
  }
  const firstColumnNumber = checkList[0];
  checkList.forEach((item, index) => {
    if (item !== firstColumnNumber) {
      const columnName = Object.keys(expectColumns)[index];
      logger.error(`Column "${columnName}" is not in the same row: Column number: ${item}`);
      throw new Error(`Column "${columnName}" is not in the same row.`);
    }
  });
}

/* 擷取資料邊界, 以目標欄位為主 */
function cleanUpData(Data, targetColumnName) {
  const targetColumn = Data[targetColumnName];
  const keys = Object.keys(targetColumn);
  let lastKey = null;

  // 找到最後一個值為正整數的鍵
  keys.forEach(key => {
    const targetCell = targetColumn[key];
    if (/^\d+$/.test(targetCell)){
      const value = parseInt(targetCell, 10);
      if (Number.isInteger(value) && value > 0) {
        lastKey = key;
      }
    }
  });

  // 取得最後一個值為正整數的鍵
  const parsedLastKey = parseColumnAddress(lastKey);

  // 擷取資料邊界
  const cleanedData = {};
  for (let column in Data) {
    cleanedData[column] = {};
    const columnData = Data[column];
    for (let key in columnData) {
      const parsedKey = parseColumnAddress(key);
      if (parseInt(parsedKey.columnNumber) <= parseInt(parsedLastKey.columnNumber)) {
        cleanedData[column][key] = columnData[key];
      }
    }
  }
  return cleanedData;
}

/* 表格排序 */
function sortTable(table_array, sort_column, table_index_column, ascending = true){
  // 檢查排序欄位是否存在
  if (!table_array[sort_column]) {
    throw new Error(`Column ${sort_column} not found.`);
  }
  if (!table_index_column) {
    throw new Error(`Table index column not found.`);
  }
  // 取出 table_index 欄位資料
  const table_index_data = table_array[table_index_column];
  // 取出排序欄位資料
  const sort_column_data = table_array[sort_column];
  // 組成對照表
  const sort_table = {};
  for (let i = 0; i < sort_column_data.length; i++) {
    sort_table[sort_column_data[i]] =table_index_data[i];
  }

  // 用對照表排序表格
  let sorted_table = {};
  // 複製一份 sort_column_data
  const sort_column_data_copy = [...sort_column_data];
  let sorted_array = [];
  if (ascending) {
    sorted_array = sort_column_data_copy.sort((a, b) => parseFloat(a.replace(/,/g, '')) - parseFloat(b.replace(/,/g, '')));
  } else {
    sorted_array = sort_column_data_copy.sort((a, b) => parseFloat(b.replace(/,/g, '')) - parseFloat(a.replace(/,/g, '')));
  }

  // 加入到 sorted_table, 並將整數加上小數點
  sorted_array.forEach(item => {
    item_adjusted = item.toString().replace(/,/g, '');
    if (!item_adjusted.includes('.')) {
      item_adjusted += '.0';
    }
    sorted_table[item_adjusted] = sort_table[item];
  });

  // order
  const order = Object.values(sorted_table);
  const column_names = Object.keys(table_array);
  const newTransposedTable = new TransposedTable(column_names, {});
  order.forEach(item => {
    // 遍歷所有欄位
    for (let column of column_names) {
      // 找出 table_index = item 的資料
      const index = table_array[table_index_column].indexOf(item);
      if (index !== -1) {
        // 將該筆資料加入新表格
        if (!newTransposedTable.data[order.indexOf(item)]) {
          newTransposedTable.data[order.indexOf(item)] = {};
        }
        let data_value = [];
        for (let column of column_names) {
          data_value.push(table_array[column][index]);
        }
        newTransposedTable.data[order.indexOf(item)] = data_value;
      }
    }
  });
  const output_table = reverseTransposeArrayTable(newTransposedTable);
  return output_table;
}

/* 清理表格, 取第一行 */
function getSingelValueTable(table_array){
  for (let column in table_array) {
    table_array[column] = table_array[column][0];
  }
  return table_array;
}
