const { getDataFromNodeProcess } = require("@celigo/rest-api-ia-automation");

module.exports = async () => {
  await getDataFromNodeProcess();

  if (!process.env.PBI) {
    process.env.PBI = "SQNS";
  }

  const apiKey = process.env.RP_API_KEY;
  const feature = process.env.SUITE || "Square_Suite";
  const reportOption = process.env.RP_REPORT_OPTION || "local";
  const Environment = process.env.ENVIRONMENT || "dev";
  let RPProject = process.env.RP_PROJECT || "IA_SQUARE_SUITES";
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  const RPLaunch = nodeEnv === "dev" ? "IA_API_SQUARE" : process.env.RP_LAUNCH || "IA_API_SQUARE";
  process.env.RP_LAUNCH = RPLaunch;

  const JestConfig = {
    pageTitle: `Square Order Import Test Report — ${Environment}`,
    outputPath: "./report/index.html",
    includeFailureMsg: true,
    includeConsoleLog: false,
    useCssFile: false,
    sort: "default",
    append: false,
  };

  let reporters = ["default", ["jest-html-reporter", JestConfig]];

  if (reportOption === "remote" && apiKey) {
    reporters.push([
      "@reportportal/agent-js-jest",
      {
        token: apiKey,
        endpoint: "https://reportportal.qa.staging.integrator.io/api/v1",
        project: RPProject,
        launch: `${RPLaunch}_${feature}`.toUpperCase(),
        attributes: [
          { key: "Build", value: new Date().toISOString().slice(0, 10) },
          { key: "Feature", value: feature },
          { key: "Environment", value: Environment },
          { key: "Suite", value: process.env.SUITE || "Square_Suite" },
          { key: "PBI", value: "SQNS" },
        ],
        description: RPLaunch,
        includeTestSteps: true,
        rerun: false,
      },
    ]);
  }

  const tag = process.env.TAG || "";
  const isLongSquareRun =
    /batch[89]|fullsuite|batch1\|batch2/i.test(tag) ||
    (process.env.SUITE === "Square_Suite" && tag.split("|").length >= 5);

  return {
    transform: {
      "^.+\\.tsx?$": "./node_modules/ts-jest",
    },
    testEnvironment: "node",
    testMatch: ["**/__tests__/**/*.[t]s?(x)"],
    testPathIgnorePatterns: ["/dist/", "/node_modules/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    verbose: true,
    testTimeout: isLongSquareRun ? 1800000 : 900000,
    reporters: [...reporters, "./reporters/summaryReporter.js"],
    moduleNameMapper: {
      "^@TestData(.*)$": "<rootDir>/test-data$1",
    },
    setupFiles: [
      "<rootDir>/__tests__/globalSetup.js",
      "./node_modules/dotenv/config",
    ],
    globalTeardown: "./node_modules/@celigo/rest-api-ia-automation/dist/src/util/uploadReport.js",
  };
};
