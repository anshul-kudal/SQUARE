import fs from "fs";
import path from "path";
import { Logger } from "@celigo/aut-logger";
import { runSpec, validateResponse, validateStatusCode, handleDataValidation, pre_request_validation } from "@celigo/rest-api-ia-automation";
import { ia } from "../config/ia";
import { resetAdvanceSettings, resetFlowStatus, restorePendingMappings } from "@celigo/rest-api-ia-automation";

let _isTransientFailure: (err: any, resp?: any) => boolean;
let _classifyFailure: (err: any, resp?: any) => string;
try {
  const mod = require("@celigo/rest-api-ia-automation");
  _isTransientFailure = mod.isTransientFailure;
  _classifyFailure = mod.classifyFailure;
} catch { /* not yet available */ }
if (!_classifyFailure) {
  _classifyFailure = (err: any) => {
    const msg = String(err?.message || err || '');
    if (/timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) return 'NLB_TIMEOUT';
    if (/rate.?limit|429|SSS_REQUEST_LIMIT_EXCEEDED/i.test(msg)) return 'NS_RATE_LIMIT';
    return 'UNKNOWN';
  };
}
if (!_isTransientFailure) {
  _isTransientFailure = (err: any) => {
    const cat = _classifyFailure(err);
    return ['NLB_TIMEOUT', 'NS_RATE_LIMIT', 'NS_TRANSIENT', 'NO_DATA', 'CONVERGENCE_TIMEOUT', 'NS_SCRIPT_TIMEOUT'].includes(cat);
  };
}

const logDir = path.join(process.cwd(), 'logs');
try { fs.mkdirSync(logDir, { recursive: true }); } catch { /* ignore */ }
const suite = (process.env.SUITE || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
const env = (process.env.NODE_ENV || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
const logFilePath = path.join(logDir, `test-run-${env}-${suite}-${Date.now()}.log`);

(Logger as any).configure({
  enableFileTransport: true,
  enableCallerInfo: true,
  enableTestContext: true,
  logFilePath,
});

const _parsed = parseInt(process.env.TEST_MAX_RETRIES ?? '2');
const MAX_RETRIES = Number.isNaN(_parsed) ? 2 : Math.max(0, _parsed);
const BACKOFF_SCHEDULE = [5000, 15000];

function backoffDelay(attempt: number): number {
  return BACKOFF_SCHEDULE[Math.min(attempt, BACKOFF_SCHEDULE.length - 1)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RETRY_STATS_FILE = path.join(process.cwd(), '.cache', 'retry-stats.json');
(global as any).__retryStats = { retried: 0, recoveredAfterRetry: 0, failedAfterRetry: 0, details: [] as any[] };

const STATE_DIR = path.join(__dirname, '..', '.test-state');


function saveState(tag: string, map: Map<string, any>) {
 if (!tag) return;
 if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
 const filePath = path.join(STATE_DIR, `${tag}.json`);
 fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(map), null, 2));
 Logger.info(`State saved to ${filePath}`);
}


function loadState(tag: string): Map<string, any> | null {
 if (!tag) return null;
 const filePath = path.join(STATE_DIR, `${tag}.json`);
 if (!fs.existsSync(filePath)) return null;
 const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
 return new Map(Object.entries(data));
}


describe(`SHOPIFY IA API TEST EXECUTION`, function () {
 const td1 = Array.isArray(global.inputData) ? global.inputData : [];
 let uniqueIds = new Map();

  afterAll(() => {
    try {
      fs.mkdirSync(path.dirname(RETRY_STATS_FILE), { recursive: true });
      fs.writeFileSync(RETRY_STATS_FILE, JSON.stringify((global as any).__retryStats));
    } catch { /* ignore */ }
  });

  if (td1.length === 0) {
   it('should have test data available', () => {
     throw new Error('No test data available. Please ensure global.inputData is properly loaded.');
   });
   return;
 }
  for (const td of td1) {
   if (!Array.isArray(td)) {
     Logger.info("Skipping invalid test data group:" + JSON.stringify(td));
     continue;
   }
   for (const t of td) {
     if (!t || !t.suite) {
       Logger.info("Skipping test case with missing suite:" + JSON.stringify(t));
       continue;
     }
     const suiteName = t.suite;
     describe(suiteName, function () {
       if (Array.isArray(t?.interactions) && t.interactions.length > 0) {
         beforeAll(async () => {
           uniqueIds.clear();
           if (!process.env.RESUME && process.env.TAG) {
             const stateFile = path.join(STATE_DIR, `${process.env.TAG}.json`);
             if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
           }
           if (process.env.RESUME) {
             const saved = loadState(process.env.TAG);
             if (saved) {
               saved.forEach((v, k) => uniqueIds.set(k, v));
               Logger.info(`Restored state for resume from: ${process.env.RESUME}`);
             }
           }
           if (t?.storeName) {
             process.env.storeName = t.storeName;
           }
           if (process?.env?.RUN_WITH_RESTAPI === 'true') {
             const deprecatedListPath = path.join(__dirname, "../config/listOfDeprecatedFlows.json");
             process.env.DEPRECATED_FLOW_LIST_PATH = deprecatedListPath;
           }
           Logger.info(`Running Reset Advance Settings For : ${t?.suite}`);
           const isSquare = process.env.PBI === "SQNS";
           await resetFlowStatus(
             { "request": { "payload": isSquare ? "/config/resetFlowStatus_Square.json" : "/config/resetFlowStatus.json" } },
             uniqueIds,
             t?.storeName
           );
           await resetAdvanceSettings(
             { "request": { "payload": isSquare ? "/config/resetSettings_Square.json" : "/config/resetSettings.json" } },
             uniqueIds,
             t?.storeName
           );
         });
         // Restore any import mappings that were modified by this testcase's
         // interactions (e.g. updateMappingsThruAPI / deleteFlowMappingThruAPI
         // calls in T1435 / T1437 quantity-override pattern). Runs once per
         // testcase after all `it()` interactions complete, regardless of
         // pass/fail/throw — Jest invokes `afterAll` even when individual
         // tests throw, so a failed interaction never leaves a leaked
         // mapping modification on the import.
         //
         // `restorePendingMappings()` itself early-returns silently when
         // its in-memory `pendingMappingSnapshots` Map is empty (i.e. no
         // modify helper was invoked during this testcase), so testcases
         // that perform no mapping modifications produce zero log noise
         // and zero API calls from this hook. The `[Mapping Cleanup]
         // Restoring N import mapping(s)` / `Restored import <id>` log
         // lines emitted by the framework only fire when there is real
         // work to do.
         afterAll(async () => {
           try {
             await restorePendingMappings();
           } catch (e) {
             Logger.error(`[Mapping Cleanup] Failed to restore mappings for ${t?.suite}: ${e}`);
           }
         });
         const [resumeInteraction, resumeIdx] = (process.env.RESUME || '').split(':');
         let resumeReached = !process.env.RESUME;
         for (const i of t.interactions) {
           if (process.env.RESUME && i?.test_title?.startsWith(resumeInteraction)) {
             resumeReached = true;
           }
           if (!resumeReached) {
             it.skip(`${i?.test_title} [skipped - resuming]`, () => {});
             continue;
           }
           if (i?.test_title && !i.test_title.includes("skip")) {
             it(`${i?.test_title} with ${i?.request?.path}`, async () => {
              global.testCaseStartTime = new Date();
              process.env.testCaseName = i.test_title;
              process.env.testStepLabel = '';
              try {
              let lastError: any = null;
              for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                  if (attempt > 0) {
                    const delayMs = backoffDelay(attempt - 1);
                    Logger.warn(`[RETRY] Attempt ${attempt + 1}/${MAX_RETRIES + 1} for "${i.test_title}" after ${delayMs / 1000}s backoff (prev: ${_classifyFailure(lastError)})`);
                    await sleep(delayMs);
                  }

                  // Fresh copy each attempt so handleStoreDetails filterKey mutation is not cumulative on retry.
                  const interaction = structuredClone(i);

                  Logger.info(`Running Test Case : ${interaction?.test_title}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
                  uniqueIds.set("test_title", interaction?.test_title);
                  const isResumedInteraction = resumeInteraction && interaction?.test_title?.startsWith(resumeInteraction);
                  const skipPreIdx = isResumedInteraction && resumeIdx ? resumeIdx : null;
                  if (Array.isArray(interaction?.pre_request)) {
                    const pre = interaction.pre_request;
                    for (let idx = 0; idx < pre.length; idx++) {
                      if (skipPreIdx === 'main') continue;
                      if (skipPreIdx && idx < parseInt(skipPreIdx)) continue;
                      const p = pre[idx];
                      process.env.testStepLabel = `pre_request:${idx + 1}/${pre.length}`;
                      if (p?.response?.hasOwnProperty("dataValidationMethod")) {
                        await handleDataValidation(p, uniqueIds);
                      } else {
                        await executeAPIRequest(uniqueIds, p, true);
                      }
                      saveState(process.env.TAG, uniqueIds);
                    }
                  }
                  const mapSnapshot: Record<string, unknown> = {};
                  uniqueIds.forEach((v: unknown, k: string) => { mapSnapshot[k] = v; });
                  Logger.info("MAP >> " + JSON.stringify(mapSnapshot));
                  process.env.testStepLabel = 'validation';
                  if (skipPreIdx === 'main' && !interaction?.response?.hasOwnProperty("dataValidationMethod")) {
                    Logger.info(`Skipping main request — resuming validation only`);
                  }
                  if (interaction?.response?.hasOwnProperty("dataValidationMethod")) {
                    await handleDataValidation(interaction, uniqueIds);
                  } else {
                    await executeAPIRequest(uniqueIds, interaction, false);
                  }
                  saveState(process.env.TAG, uniqueIds);

                  if (attempt > 0) {
                    (global as any).__retryStats.recoveredAfterRetry++;
                    (global as any).__retryStats.details.push({
                      test: interaction.test_title,
                      attempts: attempt + 1,
                      finalCategory: 'RECOVERED',
                      recovered: true,
                    });
                    Logger.info(`[RETRY] "${interaction.test_title}" RECOVERED on attempt ${attempt + 1}`);
                  }
                  lastError = null;
                  break;
                } catch (err) {
                  lastError = err;
                    const category = _classifyFailure(err);
                    const isTransient = _isTransientFailure(err);
                  Logger.error(`[RETRY] "${i.test_title}" attempt ${attempt + 1} failed — [${category}] ${(err as Error).message}`);

                  if (!isTransient || attempt >= MAX_RETRIES) {
                    if (attempt > 0) {
                      (global as any).__retryStats.failedAfterRetry++;
                      (global as any).__retryStats.details.push({
                        test: i.test_title,
                        attempts: attempt + 1,
                        finalCategory: category,
                        recovered: false,
                      });
                      const exhausted = attempt >= MAX_RETRIES;
                      const detail = exhausted
                        ? `EXHAUSTED all ${MAX_RETRIES + 1} attempts`
                        : `gave up after ${attempt + 1} attempt(s) (non-transient)`;
                      Logger.error(`[RETRY] "${i.test_title}" ${detail} (${category})`);
                    }
                    throw err;
                  }

                  if (attempt === 0) {
                    (global as any).__retryStats.retried++;
                  }
                }
              }
              } finally {
                const elapsed = Date.now() - global.testCaseStartTime.getTime();
                Logger.info(`Test completed in ${(elapsed / 1000).toFixed(1)}s`);
                process.env.testStepLabel = '';
                process.env.testCaseName = '';
              }
             });
           } else {
             it.skip(`${i?.test_title} with ${i?.request?.path}`, async () => {
               Logger.info("Skipped :" + (i?.test_title));
             });
           }
         }
       }
     });
   }
 }
});
async function executeAPIRequest(uniqueIds, i, is_pre_request) {
 if (!i || !i.request) {
   Logger.info("Skipping invalid API request - missing request object:" + JSON.stringify(i));
   return;
 }
  let loop = i?.request?.loopFor || 1;
 for(let j = 0; j < loop; j++){
   if(loop > 1){
     if (i?.request) {
       i.request.callCounter = j + 1;
     }
   }
   const response = await runSpec(uniqueIds, i);
  
   if (i.response) {
     validateStatusCode(i.response, response);
     await validateResponse(i.response, response, uniqueIds);
   }
  
   if(is_pre_request){
     await validatePrequestResponse(i, response);
   }
 }
}


async function validatePrequestResponse(data, response) {
 if (!data || !data.request) {
   Logger.info("Skipping pre-request validation - missing data or request object:" + JSON.stringify(data));
   return;
 }
  if(!data?.request?.skipThePreRequestValidation){
   const validationResult = await pre_request_validation(
     response,
     JSON.stringify(data.request)
   );
   expect(validationResult).toBe(true);
 }
}
