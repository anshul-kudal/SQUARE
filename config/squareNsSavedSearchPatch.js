/**
 * Square NS account (TSTDRV1463095) does not have Shopify-specific line columns
 * custcol_location_id / custcolcust_delivery_method_id. Strip them from saved
 * search column sets so IO proxy validation works with Test NS connection.
 */
const SQUARE_EXCLUDED_COLUMNS = new Set([
  "custcol_location_id",
  "custcolcust_delivery_method_id",
]);

function stripColumns(columnsJson) {
  const columns = JSON.parse(columnsJson);
  return JSON.stringify(
    columns.filter((col) => !SQUARE_EXCLUDED_COLUMNS.has(col.name))
  );
}

function applySquareNsSavedSearchPatch() {
  const { SavedSearch } = require("@celigo/rest-api-ia-automation/dist/config/NSConfig/SavedSearch");

  if (SavedSearch.__squarePatchApplied) {
    return;
  }

  SavedSearch.SALESORDER_COLUMNS = stripColumns(SavedSearch.SALESORDER_COLUMNS);
  SavedSearch.SALESORDER_COLUMNS_INV_STATUS_ENABLED = stripColumns(
    SavedSearch.SALESORDER_COLUMNS_INV_STATUS_ENABLED
  );
  SavedSearch.CASHSALE_COLUMNS = stripColumns(SavedSearch.CASHSALE_COLUMNS);

  SavedSearch.__squarePatchApplied = true;
}

module.exports = { applySquareNsSavedSearchPatch, SQUARE_EXCLUDED_COLUMNS };
