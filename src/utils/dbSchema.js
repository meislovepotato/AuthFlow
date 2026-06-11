import db from "../database/index.js";

const cache = new Map();

export const getTableColumns = async (tableName) => {
  const key = tableName;
  if (cache.has(key)) return cache.get(key);
  try {
    const qi = db.sequelize.getQueryInterface();
    const desc = await qi.describeTable(tableName);
    const cols = Object.keys(desc || {});
    cache.set(key, cols);
    return cols;
  } catch (e) {
    // if table doesn't exist or error, return empty list
    cache.set(key, []);
    return [];
  }
};

export const hasColumn = async (tableName, columnName) => {
  const cols = await getTableColumns(tableName);
  return cols.indexOf(columnName) !== -1;
};
