'use strict'

const fs = require('fs')
const path = require('path')

const SLOW_THRESHOLD_MS = 60000
const RETRY_STATS_FILE = path.join(process.cwd(), '.cache', 'retry-stats.json')

class SummaryReporter {
  constructor () {
    this._passed = 0
    this._failed = 0
    this._skipped = 0
    this._failures = []
    this._slowTests = []
  }

  onTestResult (_test, testResult) {
    for (const t of testResult.testResults) {
      switch (t.status) {
        case 'passed':
          this._passed++
          if (t.duration > SLOW_THRESHOLD_MS) {
            this._slowTests.push({ name: t.fullName, duration: t.duration })
          }
          break
        case 'failed':
          this._failed++
          this._failures.push({
            name: t.fullName,
            messages: t.failureMessages
          })
          if (t.duration > SLOW_THRESHOLD_MS) {
            this._slowTests.push({ name: t.fullName, duration: t.duration })
          }
          break
        case 'pending':
        case 'skipped':
          this._skipped++
          break
        default:
          break
      }
    }
  }

  onRunComplete () {
    const total = this._passed + this._failed + this._skipped
    const divider = '='.repeat(70)

    console.log('\n' + divider)
    console.log('  TEST SUITE SUMMARY')
    console.log(divider)
    console.log(`  Total:   ${total}`)
    console.log(`  Passed:  ${this._passed}`)
    console.log(`  Failed:  ${this._failed}`)
    console.log(`  Skipped: ${this._skipped}`)
    console.log(divider)

    if (this._failures.length > 0) {
      console.log('\n  FAILED TESTS:')
      console.log('-'.repeat(70))
      for (const f of this._failures) {
        console.log(`  ✗ ${f.name}`)
        for (const msg of f.messages) {
          const firstLine = msg.split('\n')[0]
          console.log(`    → ${firstLine}`)
        }
      }
      console.log('-'.repeat(70))
    }

    if (this._slowTests.length > 0) {
      this._slowTests.sort((a, b) => b.duration - a.duration)
      console.log('\n  SLOW TESTS (> 60s):')
      console.log('-'.repeat(70))
      for (const s of this._slowTests) {
        const secs = (s.duration / 1000).toFixed(1)
        console.log(`  ⏱ ${secs}s  ${s.name}`)
      }
      console.log('-'.repeat(70))
    }

    let retryStats = null
    try {
      retryStats = JSON.parse(fs.readFileSync(RETRY_STATS_FILE, 'utf8'))
      fs.unlinkSync(RETRY_STATS_FILE)
    } catch { /* file may not exist if no retries occurred */ }
    if (retryStats && retryStats.retried > 0) {
      console.log('\n  RETRY STATISTICS:')
      console.log('-'.repeat(70))
      console.log(`  Tests retried:          ${retryStats.retried}`)
      console.log(`  Recovered after retry:  ${retryStats.recoveredAfterRetry}`)
      console.log(`  Failed after all tries: ${retryStats.failedAfterRetry}`)
      if (retryStats.details && retryStats.details.length > 0) {
        console.log('')
        for (const d of retryStats.details) {
          const icon = d.recovered ? '✔' : '✗'
          console.log(`  ${icon} ${d.test} — ${d.attempts} attempt(s) [${d.finalCategory}]`)
        }
      }
      console.log('-'.repeat(70))
    }

    console.log('')
  }
}

module.exports = SummaryReporter
