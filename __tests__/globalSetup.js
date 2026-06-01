const { Logger } = require("@celigo/aut-logger");
require("ts-node/register");

module.exports = async () => {
  const path = require("path");
  const { getDataFromNodeProcess } = require("@celigo/rest-api-ia-automation");
  const { getData, loadEnv } = require("@celigo/rest-api-ia-automation/dist/src/util/fileUtils");
  const { getFlakyTestIdsForSuite } = require("@celigo/rest-api-ia-automation/dist/src/util/flakyTestsApi");
  const { labelMap } = require("@celigo/rest-api-ia-automation/dist/src/helper/settings");
  const config = require("@celigo/rest-api-ia-automation/dist/config/config").default;

  const dir = path.join(process.env.PWD, "testcases");

  await getDataFromNodeProcess();
  Logger.info("ENVIRONMENT - " + process.env.NODE_ENV);

  try {
    const skipFlaky = process.env.SKIP_FLAKY_TESTS === "true";
    if (skipFlaky && !process.env.SUITE) {
      throw new Error("SKIP_FLAKY_TESTS=true requires SUITE env var.");
    }

    if (process.env.SUITE !== undefined) {
      let flakyTestIds = [];
      if (skipFlaky) {
        try {
          flakyTestIds = await getFlakyTestIdsForSuite(process.env.SUITE);
        } catch (err) {
          Logger.warn(`[FlakySkip] Could not load flaky list: ${err?.message || err}`);
          flakyTestIds = [];
        }
      }
      global.inputData = getData(dir + "/" + process.env.SUITE, flakyTestIds);
      Logger.info("SUITE INFO - " + process.env.SUITE);
    } else {
      global.inputData = getData(dir);
    }

    if (process.env.TAG) {
      Logger.info("TAG INFO - " + process.env.TAG);
    }

    if (process.env.NODE_ENV !== "dev") {
      await loadEnv();
    }

    config.initialize();
    Logger.info("Loading All Labels Into The Map ......");
    await labelMap();

    process.env.PBI = process.env.PBI || "SQNS";
    Logger.info("Square mode (PBI=SQNS) — skipping Shopify taxSetupCheck");

    const { applySquareNsSavedSearchPatch } = require("../config/squareNsSavedSearchPatch");
    applySquareNsSavedSearchPatch();
    Logger.info("Applied Square NS saved-search column patch");

    const shopifyModule = require("@celigo/rest-api-ia-automation/dist/src/dataCreation/shopify");
    const { squareDataCreationHandlers } = require("../helpers/squareDataCreation");
    Object.assign(shopifyModule.shopifyDataCreationHandlers, squareDataCreationHandlers);
    Logger.info("Registered Square data-creation handlers");
  } catch (error) {
    Logger.error("Error in global setup: " + error);
    throw error;
  }

  process.on("uncaughtException", (error) => {
    Logger.error("Uncaught Exception: " + error.message);
  });

  process.on("unhandledRejection", (reason) => {
    Logger.error("Unhandled Rejection: " + reason);
  });
};
