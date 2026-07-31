# Testing Agent Documentation

## Overview

The **Testing Agent** is a QA automation system that:
- Reads test definitions from `tests.yaml`
- Executes tests against the production instance (Render)
- Reports results and can be updated dynamically
- Supports API, E2E, database, and performance testing
- Runs on-demand, on deployment, or on schedule

## Architecture

### Components

1. **`tests.yaml`** — Test definitions (edited by development team)
2. **`src/agents/testingAgent.ts`** — Test execution engine
3. **`src/routes/testing.ts`** — REST API for test management
4. **Scheduled Agent** — Periodic test execution (via Claude Agent SDK)

## Test Types

### API Tests
- HTTP method, endpoint, expected status, body checks
- Supports authentication
- Example: `POST /api/auth/login` with status 200/201

### E2E Tests
- Page URL and element presence checks
- Text content validation
- Example: "Landing Page Loads" verifies h1 and "LARA" text exist

### Database Tests
- SQL query execution (via `/api/testing/db-query`)
- Example: `SELECT COUNT(*) FROM users`

### Performance Tests
- Max response time thresholds
- Example: `/api/auth/login` must respond in <2000ms

## Test Suites

Tests are organized into named suites for batch execution:

- **`smoke_suite`** — Quick sanity checks (health, landing page, login)
- **`critical_suite`** — Full regression before production release
- Custom suites can be added in `tests.yaml`

## API Endpoints

### Test Execution
```
GET  /api/testing/run/:suite        # Run named suite
GET  /api/testing/run-all           # Run all tests
POST /api/testing/webhook           # Triggered on deployment
```

### Test Management
```
GET  /api/testing/config             # View current test config
POST /api/testing/add-test           # Add a new test
PUT  /api/testing/update-test        # Update existing test
DELETE /api/testing/delete-test      # Remove a test
```

### Examples

**Run smoke suite:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/run/smoke
```

**Add a new API test:**
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "api_tests",
    "test": {
      "name": "Chat - Post Message",
      "method": "POST",
      "endpoint": "/api/chat/send",
      "requires_auth": true,
      "body": { "message": "test" },
      "expected_status": 200,
      "tags": ["chat", "critical"]
    }
  }' \
  https://pmo-ai-saas.onrender.com/api/testing/add-test
```

## How to Use

### For Development Team

**Edit tests locally:**
1. Open `tests.yaml` in your editor
2. Add/modify/remove tests under the appropriate category
3. Commit changes to git
4. Tests run automatically on deployment

**Add test dynamically:**
```bash
# Via API (no git commit needed)
curl -X POST /api/testing/add-test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "category": "api_tests", "test": { ... } }'
```

### For Claude Code Agents

The Testing Agent can be invoked from other Claude agents:

```typescript
import TestingAgent from './agents/testingAgent';

const agent = new TestingAgent('https://pmo-ai-saas.onrender.com');
const result = await agent.runSuite('critical');
console.log(agent.generateReport(result));
```

## Automation Scheduling

Tests are configured to run automatically:

```yaml
automation:
  smoke_tests:
    enabled: true
    schedule: "0 */6 * * *"  # Every 6 hours
    suites: ["smoke_suite"]

  critical_tests:
    enabled: true
    schedule: "0 2 * * *"    # Daily at 2 AM
    suites: ["critical_suite"]

  webhook_on_deploy:
    enabled: true
    endpoint: "/webhooks/render-deploy"
    runs: ["smoke_suite"]
```

To implement cron scheduling, use Claude's `schedule` skill or set up a cloud job in Render.

## Test Report Format

```
╔════════════════════════════════════════════════════════╗
║              TEST SUITE REPORT                         ║
╚════════════════════════════════════════════════════════╝

Suite: smoke
Timestamp: 2026-07-31T15:30:00Z
Duration: 3245ms

SUMMARY
───────
Total Tests:  5
✓ Passed:     5
✗ Failed:     0
Success Rate: 100.00%

RESULTS
──────────────────────────────────────────────────────────
✓ PASS Health Check (145ms)
✓ PASS Landing Page Loads (832ms)
✓ PASS Login Page Accessible (267ms)
✓ PASS Data - Get Projects (450ms)
✓ PASS Auth - Login Success (551ms)
```

## Configuration

### RENDER_URL
Set in `.env` or environment:
```
RENDER_URL=https://pmo-ai-saas.onrender.com
```

### Authentication
- Endpoints requiring admin auth use `adminAuthMiddleware`
- Pass token via `Authorization: Bearer <token>` header

## Monitoring & Alerts

To integrate with monitoring (e.g., send alerts on failure):

1. Capture the test result JSON response
2. Check `suite.failed` count
3. Send alert if > 0

Example alert webhook:
```bash
if [ $FAILED_COUNT -gt 0 ]; then
  curl -X POST https://alerts.example.com/slack \
    -d '{ "text": "⚠️ Production tests failed: '$FAILED_COUNT' failures" }'
fi
```

## Roadmap

- [ ] Distributed test execution (parallel runners)
- [ ] Test result history & trends
- [ ] Screenshots on E2E failures
- [ ] Slack/webhook alerts on failures
- [ ] Custom assertion library
- [ ] Load testing support
- [ ] Visual regression testing

## Troubleshooting

**"Test config not found"**
- Ensure `tests.yaml` exists in project root
- Verify file is valid YAML

**"Auth token required"**
- Testing API requires `adminAuthMiddleware`
- Provide `Authorization: Bearer <token>` header

**"Endpoint timeout"**
- Production instance may be slow/booting
- Default timeout: 10 seconds (configurable in testingAgent.ts)

**"Tests pass locally but fail in CI"**
- Ensure RENDER_URL env var points to correct instance
- Check network connectivity to Render
