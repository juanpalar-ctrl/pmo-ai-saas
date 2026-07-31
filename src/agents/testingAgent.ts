// ============================================
// TESTING AGENT - Automated test execution against Render
// Reads tests.yaml, executes, reports results
// ============================================

import axios, { AxiosError } from 'axios';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { agentLogger } from '../core/logger';

export interface TestResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  results: TestResult[];
  timestamp: string;
}

export class TestingAgent {
  private baseUrl: string;
  private testConfigPath: string;
  private authToken?: string;

  constructor(
    baseUrl: string = 'https://pmo-ai-saas.onrender.com',
    testConfigPath: string = 'tests.yaml'
  ) {
    this.baseUrl = baseUrl;
    this.testConfigPath = resolve(testConfigPath);
    agentLogger.info({ baseUrl }, 'TestingAgent initialized');
  }

  /**
   * Load test configuration from YAML
   */
  private loadTestConfig(): any {
    try {
      const filePath = this.testConfigPath;
      const fileContent = readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContent);
      agentLogger.info({ configPath: filePath }, 'Test config loaded');
      return config;
    } catch (error: any) {
      agentLogger.error({ err: error.message }, 'Failed to load test config');
      throw error;
    }
  }

  /**
   * Set authentication token for protected endpoints
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Execute a single API test
   */
  private async executeApiTest(test: any): Promise<TestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      const url = `${this.baseUrl}${test.endpoint}`;

      const config: any = {
        method: test.method || 'GET',
        timeout: 10000,
      };

      if (test.requires_auth && this.authToken) {
        config.headers = {
          Authorization: `Bearer ${this.authToken}`,
        };
      }

      if (test.body) {
        config.data = test.body;
      }

      agentLogger.debug({ url, method: config.method }, `Testing API endpoint`);
      const response = await axios(url, config);

      const statusValid = Array.isArray(test.expected_status)
        ? test.expected_status.includes(response.status)
        : response.status === test.expected_status;

      let bodyValid = true;
      if (test.expected_body_contains && Array.isArray(test.expected_body_contains)) {
        const responseStr = JSON.stringify(response.data);
        bodyValid = test.expected_body_contains.every((item: string) =>
          responseStr.includes(item)
        );
      }

      const passed = statusValid && bodyValid;
      const duration = Date.now() - startTime;

      if (passed) {
        agentLogger.info({ test: testName, duration }, 'API test PASSED');
      }

      return {
        name: testName,
        passed,
        duration_ms: duration,
        details: { status: response.status },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.response?.statusText || error.message;

      agentLogger.warn({ test: testName, error: errorMsg }, 'API test FAILED');

      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: errorMsg,
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
        },
      };
    }
  }

  /**
   * Execute a single E2E/UI test
   */
  private async executeE2eTest(test: any): Promise<TestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      const url = `${this.baseUrl}${test.url}`;

      agentLogger.debug({ url }, 'Testing E2E: page load');
      const response = await axios.get(url, { timeout: 10000 });

      // Basic checks: page loaded (200) and contains expected elements
      const html = response.data;
      let allChecksPassed = true;

      if (test.checks && Array.isArray(test.checks)) {
        for (const check of test.checks) {
          if (check.type === 'element_exists') {
            // Simple text search as fallback for selector validation
            if (!html.includes(check.selector)) {
              agentLogger.warn({ test: testName, selector: check.selector }, 'Element not found');
              allChecksPassed = false;
            }
          } else if (check.type === 'text_contains') {
            if (!html.includes(check.text)) {
              agentLogger.warn({ test: testName, text: check.text }, 'Text not found');
              allChecksPassed = false;
            }
          } else if (check.type === 'page_title') {
            if (!html.includes(check.contains)) {
              allChecksPassed = false;
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      if (allChecksPassed) {
        agentLogger.info({ test: testName, duration }, 'E2E test PASSED');
      }

      return {
        name: testName,
        passed: allChecksPassed,
        duration_ms: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      agentLogger.warn({ test: testName, error: error.message }, 'E2E test FAILED');

      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: error.message,
      };
    }
  }

  /**
   * Execute a database test (if database access available)
   */
  private async executeDbTest(test: any): Promise<TestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      // Query execution would go through a dedicated endpoint
      const url = `${this.baseUrl}/api/testing/db-query`;

      agentLogger.debug({ test: testName }, 'Testing database query');

      const response = await axios.post(
        url,
        { query: test.query },
        {
          headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
          timeout: 10000,
        }
      );

      const duration = Date.now() - startTime;
      const passed = response.data.success === true;

      agentLogger.info({ test: testName, duration, passed }, 'DB test result');

      return {
        name: testName,
        passed,
        duration_ms: duration,
        details: response.data,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      agentLogger.warn({ test: testName, error: error.message }, 'DB test FAILED');

      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: error.message,
      };
    }
  }

  /**
   * Execute a performance test
   */
  private async executePerformanceTest(test: any): Promise<TestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      const url = `${this.baseUrl}${test.endpoint}`;

      const config: any = {
        method: test.method || 'GET',
        timeout: 15000,
      };

      if (test.requires_auth && this.authToken) {
        config.headers = {
          Authorization: `Bearer ${this.authToken}`,
        };
      }

      if (test.body) {
        config.data = test.body;
      }

      agentLogger.debug({ url, maxTime: test.max_response_time_ms }, 'Testing performance');

      const responseStartTime = Date.now();
      const response = await axios(url, config);
      const responseTime = Date.now() - responseStartTime;

      const duration = Date.now() - startTime;
      const passed = responseTime <= test.max_response_time_ms;

      agentLogger.info(
        { test: testName, responseTime, maxTime: test.max_response_time_ms, passed },
        'Performance test result'
      );

      return {
        name: testName,
        passed,
        duration_ms: duration,
        details: { response_time_ms: responseTime, max_allowed_ms: test.max_response_time_ms },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      agentLogger.warn({ test: testName, error: error.message }, 'Performance test FAILED');

      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: error.message,
      };
    }
  }

  /**
   * Run a specific test suite by name
   */
  async runSuite(suiteName: string): Promise<TestSuite> {
    agentLogger.info({ suite: suiteName }, 'Starting test suite');
    const startTime = Date.now();
    const config = this.loadTestConfig();

    // Get test names from smoke_suite or critical_suite
    const suiteTests = config[`${suiteName.replace('-', '_')}_suite`] || [];

    if (!suiteTests.length) {
      agentLogger.warn({ suite: suiteName }, 'No tests found for suite');
      return {
        name: suiteName,
        total: 0,
        passed: 0,
        failed: 0,
        duration_ms: 0,
        results: [],
        timestamp: new Date().toISOString(),
      };
    }

    const results: TestResult[] = [];

    // Execute each test
    for (const testName of suiteTests) {
      let test = this.findTestByName(config, testName);
      if (test) {
        let result: TestResult;

        if (test.endpoint) {
          result = await this.executeApiTest(test);
        } else if (test.url) {
          result = await this.executeE2eTest(test);
        } else if (test.query) {
          result = await this.executeDbTest(test);
        } else if (test.max_response_time_ms) {
          result = await this.executePerformanceTest(test);
        } else {
          result = {
            name: testName,
            passed: false,
            duration_ms: 0,
            error: 'Unknown test type',
          };
        }

        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    const suite: TestSuite = {
      name: suiteName,
      total: results.length,
      passed,
      failed,
      duration_ms: duration,
      results,
      timestamp: new Date().toISOString(),
    };

    agentLogger.info({ suite: suiteName, passed, failed, total: results.length }, 'Suite completed');

    return suite;
  }

  /**
   * Run all tests from config
   */
  async runAll(): Promise<TestSuite> {
    agentLogger.info({}, 'Starting full test run');
    const startTime = Date.now();
    const config = this.loadTestConfig();

    const allResults: TestResult[] = [];

    // Collect all test categories
    const categories = ['api_tests', 'e2e_tests', 'db_tests', 'performance_tests'];

    for (const category of categories) {
      const tests = config[category] || [];

      for (const test of tests) {
        let result: TestResult;

        if (category === 'api_tests') {
          result = await this.executeApiTest(test);
        } else if (category === 'e2e_tests') {
          result = await this.executeE2eTest(test);
        } else if (category === 'db_tests') {
          result = await this.executeDbTest(test);
        } else if (category === 'performance_tests') {
          result = await this.executePerformanceTest(test);
        } else {
          continue;
        }

        allResults.push(result);
      }
    }

    const duration = Date.now() - startTime;
    const passed = allResults.filter((r) => r.passed).length;
    const failed = allResults.length - passed;

    const suite: TestSuite = {
      name: 'full',
      total: allResults.length,
      passed,
      failed,
      duration_ms: duration,
      results: allResults,
      timestamp: new Date().toISOString(),
    };

    agentLogger.info({ passed, failed, total: allResults.length }, 'Full test run completed');

    return suite;
  }

  /**
   * Find a test by name across all categories
   */
  private findTestByName(config: any, testName: string): any {
    const categories = ['api_tests', 'e2e_tests', 'db_tests', 'performance_tests'];

    for (const category of categories) {
      const tests = config[category] || [];
      const test = tests.find((t: any) => t.name === testName);
      if (test) return test;
    }

    return null;
  }

  /**
   * Generate a test report
   */
  generateReport(suite: TestSuite): string {
    const header = `
╔════════════════════════════════════════════════════════╗
║              TEST SUITE REPORT                         ║
╚════════════════════════════════════════════════════════╝

Suite: ${suite.name}
Timestamp: ${suite.timestamp}
Duration: ${suite.duration_ms}ms

SUMMARY
───────
Total Tests:  ${suite.total}
✓ Passed:     ${suite.passed}
✗ Failed:     ${suite.failed}
Success Rate: ${((suite.passed / suite.total) * 100).toFixed(2)}%

RESULTS
──────────────────────────────────────────────────────────
    `;

    const results = suite.results
      .map((r) => {
        const status = r.passed ? '✓ PASS' : '✗ FAIL';
        const error = r.error ? `\n        Error: ${r.error}` : '';
        return `${status} ${r.name} (${r.duration_ms}ms)${error}`;
      })
      .join('\n');

    return header + results;
  }
}

export default TestingAgent;
