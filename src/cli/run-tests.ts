#!/usr/bin/env ts-node
// ============================================
// TESTING CLI - Run tests from command line
// Usage:
//   npm run test:e2e smoke
//   npm run test:e2e critical
//   npm run test:e2e all
// ============================================

import TestingAgent from '../agents/testingAgent';
import { agentLogger } from '../core/logger';

const RENDER_URL = process.env.RENDER_URL || 'https://pmo-ai-saas.onrender.com';
const suite = process.argv[2] || 'smoke';

async function runTests() {
  try {
    console.log(`\n🧪 PMO AI SaaS - Testing Agent`);
    console.log(`📍 Target: ${RENDER_URL}`);
    console.log(`📋 Suite: ${suite}\n`);

    const agent = new TestingAgent(RENDER_URL);

    let result;

    if (suite === 'all') {
      result = await agent.runAll();
    } else {
      result = await agent.runSuite(suite);
    }

    const report = agent.generateReport(result);
    console.log(report);

    // Exit with appropriate code
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error(`\n❌ Error running tests: ${error.message}`);
    process.exit(1);
  }
}

runTests();
