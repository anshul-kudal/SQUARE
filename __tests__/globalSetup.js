const { Logger } = require("@celigo/aut-logger");
require("ts-node/register");

module.exports = async () => {
  const path = require("path");
  const { getDataFromNodeProcess } = require("@celigo/rest-api-ia-automation");
  const { getData, loadEnv } = require("@celigo/rest-api-ia-automation/dist/src/util/fileUtils");
  const { getFlakyTestIdsForSuite } = require("@celigo/rest-api-ia-automation/dist/src/util/flakyTestsApi");
  const { labelMap } = require("@celigo/rest-api-ia-automation/dist/src/helper/settings");
  const config = require("@celigo/rest-api-ia-automation/dist/config/config").default;
  const { taxSetupCheck } = require("@celigo/rest-api-ia-automation/dist/src/dataCreation/netsuite");

  const dir = path.join(process.env.PWD, "testcases");

  await getDataFromNodeProcess();
  Logger.info("ENVIRONMENT - " + process.env.NODE_ENV);

  try {
    const skipFlaky = process.env.SKIP_FLAKY_TESTS === "true";
    if (skipFlaky && !process.env.SUITE) {
      throw new Error(
        "SKIP_FLAKY_TESTS=true requires SUITE env var to be set. Cannot determine which suite's flaky tests to skip."
      );
    }

    if (process.env.SUITE !== undefined) {
      let flakyTestIds = [];
      if (skipFlaky) {
        Logger.info(
          `[FlakySkip] SKIP_FLAKY_TESTS=true detected for suite "${process.env.SUITE}". Fetching flaky test list from S3...`
        );
        try {
          flakyTestIds = await getFlakyTestIdsForSuite(process.env.SUITE);
          Logger.info(
            `[FlakySkip] Loaded ${flakyTestIds.length} flaky test id(s) for suite "${process.env.SUITE}": ${JSON.stringify(flakyTestIds)}`
          );
        } catch (err) {
          Logger.warn(
            `[FlakySkip] Failed to load flaky master list, running ALL tests for safety: ${err?.message || err}`
          );
          flakyTestIds = [];
        }
      }
      global.inputData = getData(dir + "/" + process.env.SUITE, flakyTestIds);
      Logger.info("SUITE INFO - " + process.env.SUITE);
    } else {
      global.inputData = getData(dir);
    }

    if (process.env.TAG !== undefined && process.env.TAG !== "") {
      Logger.info("TAG INFO - " + process.env.TAG);
    }

    if (process.env.NODE_ENV !== "dev") {
      await loadEnv();
    }

    config.initialize();
    Logger.info("Loading All Labels Into The Map ......");
    await labelMap();

    if (process.env.PBI === "SQNS") {
      Logger.info("Skipping taxSetupCheck for Square (PBI=SQNS)");
      const { applySquareNsSavedSearchPatch } = require("../config/squareNsSavedSearchPatch");
      applySquareNsSavedSearchPatch();
      Logger.info("Applied Square NS saved-search column patch (removed Shopify-only columns)");

      const shopifyModule = require("@celigo/rest-api-ia-automation/dist/src/dataCreation/shopify");
      const { squareDataCreationHandlers } = require("../helpers/squareDataCreation");
      Object.assign(shopifyModule.shopifyDataCreationHandlers, squareDataCreationHandlers);
      Logger.info("Registered Square data-creation handlers");
    } else {
      const check = await taxSetupCheck();
      if (check) {
        throw new Error(
          "INVALID TAX SETUP: Tax configuration validation failed. Check NS account tax settings."
        );
      }
    }
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
