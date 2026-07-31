// ============================================
// FUNCTIONAL TESTING AGENT
// Tests data loading, agent execution, and data accuracy
// ============================================

import axios from 'axios';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { agentLogger } from '../core/logger';

export interface FunctionalTestResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
  details?: any;
}

export interface FunctionalTestSuite {
  name: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  results: FunctionalTestResult[];
  timestamp: string;
}

export class FunctionalTestingAgent {
  private baseUrl: string;
  private testConfigPath: string;
  private authToken?: string;

  constructor(
    baseUrl: string = 'https://pmo-ai-saas.onrender.com',
    testConfigPath: string = 'tests-functional.yaml'
  ) {
    this.baseUrl = baseUrl;
    this.testConfigPath = resolve(testConfigPath);
    agentLogger.info({ baseUrl }, 'FunctionalTestingAgent initialized');
  }

  private async obtainTestAuthToken(): Promise<string> {
    try {
      // Try to login as test user
      const response = await axios.post(
        `${this.baseUrl}/api/auth/login`,
        {
          email: 'test@example.com',
          password: 'password123',
        },
        { timeout: 10000 }
      );

      if (response.data.token) {
        agentLogger.info({}, 'Test auth token obtained successfully');
        return response.data.token;
      }
    } catch (error: any) {
      agentLogger.warn(
        { error: error.message },
        'Failed to obtain test auth token - proceeding without auth'
      );
    }
    return '';
  }

  private loadTestConfig(): any {
    try {
      // Try multiple paths for tests-functional.yaml
      const possiblePaths = [
        this.testConfigPath,
        resolve(__dirname, '../tests-functional.yaml'),
        resolve(__dirname, './tests-functional.yaml'),
        resolve(__dirname, '../../tests-functional.yaml'),
        resolve('./tests-functional.yaml'),
      ];

      let fileContent: string | null = null;
      let foundPath: string | null = null;

      for (const path of possiblePaths) {
        try {
          fileContent = readFileSync(path, 'utf8');
          foundPath = path;
          break;
        } catch (e) {
          // Try next path
        }
      }

      if (!fileContent) {
        throw new Error(
          `Could not find tests-functional.yaml in: ${possiblePaths.join(', ')}`
        );
      }

      const config = yaml.load(fileContent);
      agentLogger.info({ foundPath }, 'Functional test config loaded');
      return config;
    } catch (error: any) {
      agentLogger.error({ err: error.message }, 'Failed to load functional test config');
      throw error;
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  // ============================================
  // DATA LOADING TESTS
  // ============================================
  private async executeDataLoadingTest(test: any): Promise<FunctionalTestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      agentLogger.info({ test: testName }, 'Testing data loading');

      if (test.multipart_file) {
        // File upload test with multipart data
        const filePath = resolve('public', test.multipart_file);
        const fileContent = readFileSync(filePath);
        const form = new FormData();
        form.append('file', new Blob([fileContent]), test.multipart_file);

        const response = await axios.post(`${this.baseUrl}${test.endpoint}`, form, {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
        });

        const duration = Date.now() - startTime;

        if (test.validate_response) {
          for (const validation of test.validate_response) {
            const value = this.getNestedValue(response.data, validation.path);

            if (validation.not_empty && !value) {
              throw new Error(`Validation failed: ${validation.path} is empty`);
            }

            if (validation.type && typeof value !== validation.type) {
              throw new Error(
                `Validation failed: ${validation.path} is ${typeof value}, expected ${validation.type}`
              );
            }
          }
        }

        agentLogger.info({ test: testName, duration }, 'Data loading test PASSED');
        return { name: testName, passed: true, duration_ms: duration };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      agentLogger.warn({ test: testName, error: error.message }, 'Data loading test FAILED');
      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: error.message,
      };
    }

    return { name: testName, passed: false, duration_ms: Date.now() - startTime };
  }

  // ============================================
  // AGENT EXECUTION TESTS
  // ============================================
  private async executeAgentTest(test: any): Promise<FunctionalTestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      agentLogger.info({ test: testName }, 'Testing agent execution');

      const config: any = {
        method: test.method || 'GET',
        timeout: 30000,
      };

      if (this.authToken) {
        config.headers = { Authorization: `Bearer ${this.authToken}` };
      }

      if (test.body) {
        config.data = test.body;
      }

      const response = await axios(`${this.baseUrl}${test.endpoint}`, config);
      const duration = Date.now() - startTime;

      // Validate response
      if (test.validate_response) {
        for (const validation of test.validate_response) {
          const value = this.getNestedValue(response.data, validation.path);

          if (validation.type) {
            if (Array.isArray(value) && validation.type !== 'array') {
              throw new Error(`Expected ${validation.type}, got array`);
            }
            if (typeof value !== validation.type && !Array.isArray(value)) {
              throw new Error(`Expected ${validation.type}, got ${typeof value}`);
            }
          }

          if (validation.not_empty && !value) {
            throw new Error(`${validation.path} is empty`);
          }

          if (validation.greater_than && value <= validation.greater_than) {
            throw new Error(`${validation.path} must be > ${validation.greater_than}, got ${value}`);
          }

          if (validation.min_length && value.length < validation.min_length) {
            throw new Error(
              `${validation.path} length ${value.length} < ${validation.min_length}`
            );
          }

          if (validation.in_range) {
            const [min, max] = validation.in_range;
            if (value < min || value > max) {
              throw new Error(`${validation.path} ${value} not in range [${min}, ${max}]`);
            }
          }
        }
      }

      agentLogger.info({ test: testName, duration }, 'Agent test PASSED');
      return { name: testName, passed: true, duration_ms: duration, details: response.data };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      agentLogger.warn({ test: testName, error: error.message }, 'Agent test FAILED');
      return {
        name: testName,
        passed: false,
        duration_ms: duration,
        error: error.message,
      };
    }
  }

  // ============================================
  // END-TO-END FLOW TESTS
  // ============================================
  private async executeE2eTest(test: any): Promise<FunctionalTestResult> {
    const startTime = Date.now();
    const testName = test.name;

    try {
      agentLogger.info({ test: testName }, 'Testing E2E flow');

      const context: any = {};

      for (const step of test.steps || []) {
        agentLogger.info({ step: step.step, name: step.name }, `Executing step ${step.step}`);

        // Replace template variables
        let endpoint = step.endpoint;
        let body = step.body;

        for (const [key, value] of Object.entries(context)) {
          endpoint = endpoint.replace(`{{${key}}}`, String(value));
          if (body) {
            body = JSON.parse(
              JSON.stringify(body).replace(new RegExp(`{{${key}}}`, 'g'), String(value))
            );
          }
        }

        const config: any = {
          method: step.method || 'GET',
          timeout: 30000,
        };

        if (step.requires_auth && this.authToken) {
          config.headers = { Authorization: `Bearer ${this.authToken}` };
        }

        if (body) {
          config.data = body;
        }

        const response = await axios(`${this.baseUrl}${endpoint}`, config);

        // Capture values for next steps
        if (step.capture) {
          context[step.capture] = this.getNestedValue(response.data, step.capture);
          agentLogger.debug({ captured: step.capture }, `Captured value: ${context[step.capture]}`);
        }

        // Validate
        if (step.validate) {
          for (const validation of step.validate) {
            const value = this.getNestedValue(response.data, validation.path);
            if (validation.expected !== undefined && value !== validation.expected) {
              throw new Error(
                `Step ${step.step}: ${validation.path} = ${value}, expected ${validation.expected}`
              );
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      agentLogger.info({ test: testName, duration }, 'E2E test PASSED');
      return { name: testName, passed: true, duration_ms: duration };
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

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  // ============================================
  // RUN SUITE
  // ============================================
  async runSuite(suiteName: string): Promise<FunctionalTestSuite> {
    agentLogger.info({ suite: suiteName }, 'Starting functional test suite');
    const startTime = Date.now();
    const config = this.loadTestConfig();

    // Obtain auth token if not already set
    if (!this.authToken) {
      this.authToken = await this.obtainTestAuthToken();
    }

    const suiteTests = config[suiteName] || config[`${suiteName}_suite`] || [];

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

    const results: FunctionalTestResult[] = [];

    for (const testName of suiteTests) {
      let test = this.findTestByName(config, testName);
      if (!test) continue;

      let result: FunctionalTestResult;

      if (test.multipart_file) {
        result = await this.executeDataLoadingTest(test);
      } else if (test.steps) {
        result = await this.executeE2eTest(test);
      } else {
        result = await this.executeAgentTest(test);
      }

      results.push(result);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    const suite: FunctionalTestSuite = {
      name: suiteName,
      total: results.length,
      passed,
      failed,
      duration_ms: duration,
      results,
      timestamp: new Date().toISOString(),
    };

    agentLogger.info(
      { suite: suiteName, passed, failed, total: results.length },
      'Functional suite completed'
    );

    return suite;
  }

  private findTestByName(config: any, testName: string): any {
    const categories = [
      'data_loading_tests',
      'agent_execution_tests',
      'data_accuracy_tests',
      'e2e_flow_tests',
    ];

    for (const category of categories) {
      const tests = config[category] || [];
      const test = tests.find((t: any) => t.name === testName);
      if (test) return test;
    }

    return null;
  }

  generateReport(suite: FunctionalTestSuite): string {
    const header = `
╔════════════════════════════════════════════════════════╗
║         FUNCTIONAL TEST SUITE REPORT                  ║
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

export default FunctionalTestingAgent;
