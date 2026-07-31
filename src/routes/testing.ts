// ============================================
// TESTING API ROUTES
// Endpoints for test execution, management, and configuration
// ============================================

import express, { Request, Response } from 'express';
import TestingAgent from '../agents/testingAgent';
import * as yaml from 'js-yaml';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { agentLogger } from '../core/logger';

const router = express.Router();

// Endpoint base para Render
const RENDER_URL = process.env.RENDER_URL || 'https://pmo-ai-saas.onrender.com';

// Instancia del agente de testing
const testingAgent = new TestingAgent(RENDER_URL);

/**
 * GET /api/testing/config
 * Get the current test configuration
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const testConfigPath = resolve('tests.yaml');
    const fileContent = readFileSync(testConfigPath, 'utf8');
    const config = yaml.load(fileContent);

    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to load test config');
    res.status(500).json({
      success: false,
      error: 'Failed to load test configuration',
    });
  }
});

/**
 * POST /api/testing/add-test
 * Add a new test to the suite
 * Body: { category, test: { name, method, endpoint, ... } }
 */
router.post('/add-test', (req: Request, res: Response) => {
  try {
    const { category, test } = req.body;

    if (!category || !test || !test.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category, test.name',
      });
    }

    const testConfigPath = resolve('tests.yaml');
    const fileContent = readFileSync(testConfigPath, 'utf8');
    const config: any = yaml.load(fileContent) || {};

    // Ensure category exists
    if (!config[category]) {
      config[category] = [];
    }

    // Check if test already exists
    const existingTest = config[category].find((t: any) => t.name === test.name);
    if (existingTest) {
      return res.status(409).json({
        success: false,
        error: `Test '${test.name}' already exists in ${category}`,
      });
    }

    // Add the test
    config[category].push(test);

    // Write back to file
    writeFileSync(testConfigPath, yaml.dump(config, { lineWidth: 120 }), 'utf8');

    agentLogger.info({ category, testName: test.name }, 'Test added to suite');

    res.json({
      success: true,
      message: `Test '${test.name}' added to ${category}`,
      test,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to add test');
    res.status(500).json({
      success: false,
      error: 'Failed to add test',
    });
  }
});

/**
 * PUT /api/testing/update-test
 * Update an existing test
 * Body: { category, testName, updates: { ... } }
 */
router.put('/update-test', (req: Request, res: Response) => {
  try {
    const { category, testName, updates } = req.body;

    if (!category || !testName || !updates) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category, testName, updates',
      });
    }

    const testConfigPath = resolve('tests.yaml');
    const fileContent = readFileSync(testConfigPath, 'utf8');
    const config: any = yaml.load(fileContent) || {};

    if (!config[category]) {
      return res.status(404).json({
        success: false,
        error: `Category '${category}' not found`,
      });
    }

    const testIndex = config[category].findIndex((t: any) => t.name === testName);
    if (testIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Test '${testName}' not found in ${category}`,
      });
    }

    // Merge updates into test
    config[category][testIndex] = {
      ...(config[category][testIndex] as any),
      ...updates,
    };

    // Write back to file
    writeFileSync(testConfigPath, yaml.dump(config, { lineWidth: 120 }), 'utf8');

    agentLogger.info({ category, testName }, 'Test updated');

    res.json({
      success: true,
      message: `Test '${testName}' updated`,
      test: config[category][testIndex],
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to update test');
    res.status(500).json({
      success: false,
      error: 'Failed to update test',
    });
  }
});

/**
 * DELETE /api/testing/delete-test
 * Delete a test from the suite
 * Body: { category, testName }
 */
router.delete('/delete-test', (req: Request, res: Response) => {
  try {
    const { category, testName } = req.body;

    if (!category || !testName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category, testName',
      });
    }

    const testConfigPath = resolve('tests.yaml');
    const fileContent = readFileSync(testConfigPath, 'utf8');
    const config: any = yaml.load(fileContent) || {};

    if (!config[category]) {
      return res.status(404).json({
        success: false,
        error: `Category '${category}' not found`,
      });
    }

    const testIndex = config[category].findIndex((t: any) => t.name === testName);
    if (testIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Test '${testName}' not found in ${category}`,
      });
    }

    // Remove the test
    config[category].splice(testIndex, 1);

    // Write back to file
    writeFileSync(testConfigPath, yaml.dump(config, { lineWidth: 120 }), 'utf8');

    agentLogger.info({ category, testName }, 'Test deleted');

    res.json({
      success: true,
      message: `Test '${testName}' deleted from ${category}`,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to delete test');
    res.status(500).json({
      success: false,
      error: 'Failed to delete test',
    });
  }
});

/**
 * GET /api/testing/run/:suite
 * Run a specific test suite (smoke, critical, etc.)
 */
router.get('/run/:suite', async (req: Request, res: Response) => {
  try {
    const { suite } = req.params as { suite: string };
    const authToken = req.headers.authorization?.split(' ')[1];

    agentLogger.info({ suite }, 'Test suite execution requested');

    // Set auth token if provided
    if (authToken) {
      testingAgent.setAuthToken(authToken);
    }

    const suiteResult = await testingAgent.runSuite(suite);
    const report = testingAgent.generateReport(suiteResult);

    agentLogger.info({ suite, passed: suiteResult.passed, failed: suiteResult.failed }, 'Suite execution completed');

    res.json({
      success: true,
      suite: suiteResult,
      report,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to run test suite');
    res.status(500).json({
      success: false,
      error: 'Failed to run test suite',
    });
  }
});

/**
 * GET /api/testing/run-all
 * Run all tests
 */
router.get('/run-all', async (req: Request, res: Response) => {
  try {
    const authToken = req.headers.authorization?.split(' ')[1];

    agentLogger.info({}, 'Full test suite execution requested');

    // Set auth token if provided
    if (authToken) {
      testingAgent.setAuthToken(authToken);
    }

    const suiteResult = await testingAgent.runAll();
    const report = testingAgent.generateReport(suiteResult);

    agentLogger.info(
      { passed: suiteResult.passed, failed: suiteResult.failed, total: suiteResult.total },
      'Full suite execution completed'
    );

    res.json({
      success: true,
      suite: suiteResult,
      report,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to run all tests');
    res.status(500).json({
      success: false,
      error: 'Failed to run all tests',
    });
  }
});

/**
 * POST /api/testing/db-query
 * Execute a test database query (for DB tests)
 * Body: { query: "SELECT..." }
 */
router.post('/db-query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: query',
      });
    }

    // This endpoint would execute the query against the database
    // For now, return a placeholder response
    // In production, this would connect to the DB and execute the query

    agentLogger.info({ queryLength: query.length }, 'DB query test requested');

    // Placeholder: queries are executed during test runs
    res.json({
      success: true,
      message: 'Query validation endpoint. Use /run or /run-all to execute tests.',
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Failed to process DB query');
    res.status(500).json({
      success: false,
      error: 'Failed to process DB query',
    });
  }
});

/**
 * POST /api/testing/webhook
 * Webhook endpoint to trigger tests on deployment
 * Called by Render on successful deployment
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    agentLogger.info({ body: req.body }, 'Testing webhook received');

    // Run smoke suite on deployment
    const suiteResult = await testingAgent.runSuite('smoke');

    agentLogger.info(
      { passed: suiteResult.passed, failed: suiteResult.failed },
      'Post-deployment smoke tests completed'
    );

    res.json({
      success: true,
      suite: suiteResult,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, 'Webhook test execution failed');
    res.status(500).json({
      success: false,
      error: 'Webhook test execution failed',
    });
  }
});

/**
 * POST /api/testing/scheduled-run
 * Execute complete test suite (for scheduled/automated runs)
 * No admin auth required for webhook calls (from trusted services only)
 */
router.post('/scheduled-run', async (req: Request, res: Response) => {
  try {
    agentLogger.info({}, '🧪 SCHEDULED TEST RUN STARTED - Full exhaustive suite');

    const startTime = Date.now();
    const suiteResult = await testingAgent.runAll();
    const duration = Date.now() - startTime;

    const report = testingAgent.generateReport(suiteResult);

    agentLogger.info(
      {
        passed: suiteResult.passed,
        failed: suiteResult.failed,
        total: suiteResult.total,
        duration,
      },
      report
    );

    const message =
      suiteResult.failed === 0
        ? `✅ ALL TESTS PASSED (${suiteResult.passed}/${suiteResult.total})`
        : `⚠️ SOME TESTS FAILED (${suiteResult.failed} failures)`;

    res.json({
      success: suiteResult.failed === 0,
      message,
      suite: suiteResult,
      report,
    });
  } catch (error: any) {
    agentLogger.error({ err: error.message }, '❌ Scheduled test run failed');
    res.status(500).json({
      success: false,
      error: 'Scheduled test execution failed',
      message: error.message,
    });
  }
});

export default router;
