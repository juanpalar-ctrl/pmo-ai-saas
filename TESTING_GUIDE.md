# 🧪 PMO AI SaaS — Testing Agent Guide

Welcome! This guide explains how to use the **Testing Agent** to run automated tests against the production environment.

## Quick Start

### Run Tests Locally

```bash
# Smoke suite (quick sanity check)
npm run test:e2e:smoke

# Critical suite (full regression)
npm run test:e2e:critical

# All tests
npm run test:e2e:all
```

### View Test Results

Each run produces a formatted report:

```
╔════════════════════════════════════════════════════════╗
║              TEST SUITE REPORT                         ║
╚════════════════════════════════════════════════════════╝

Suite: smoke
Total Tests:  5
✓ Passed:     5
✗ Failed:     0
Success Rate: 100.00%

✓ PASS Health Check (145ms)
✓ PASS Landing Page Loads (832ms)
...
```

## Understanding Test Categories

### 📡 API Tests
Test HTTP endpoints with various methods and responses.

**Example in `tests.yaml`:**
```yaml
api_tests:
  - name: "Auth - Login Success"
    method: "POST"
    endpoint: "/api/auth/login"
    body:
      email: "test@example.com"
      password: "password123"
    expected_status: [200, 201]
    tags: ["auth", "critical"]
```

### 🌐 E2E Tests
Test user-facing pages and element visibility.

**Example:**
```yaml
e2e_tests:
  - name: "Landing Page Loads"
    url: "/lara-landing.html"
    checks:
      - type: "element_exists"
        selector: "h1"
      - type: "text_contains"
        text: "LARA"
    tags: ["smoke", "landing"]
```

### 💾 Database Tests
Verify database schema and connectivity.

**Example:**
```yaml
db_tests:
  - name: "Users Table Exists"
    query: "SELECT COUNT(*) FROM users"
    expects_result: true
    tags: ["schema", "data"]
```

### ⚡ Performance Tests
Ensure endpoints respond within time limits.

**Example:**
```yaml
performance_tests:
  - name: "Login Response Time"
    endpoint: "/api/auth/login"
    method: "POST"
    max_response_time_ms: 2000
    tags: ["performance"]
```

## Adding New Tests

### Method 1: Edit tests.yaml (Recommended for Git)

1. Open `tests.yaml` in your editor
2. Find the appropriate category (`api_tests`, `e2e_tests`, etc.)
3. Add your test:

```yaml
api_tests:
  - name: "Chat - Send Message"
    method: "POST"
    endpoint: "/api/chat/send"
    requires_auth: true
    body:
      message: "Hello, AI!"
    expected_status: 200
    tags: ["chat", "critical"]
```

4. Commit and push
5. Tests auto-run on deployment

### Method 2: Use the API (Dynamic, No Git)

For quick updates without a git commit:

```bash
curl -X POST https://pmo-ai-saas.onrender.com/api/testing/add-test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "api_tests",
    "test": {
      "name": "Chat - Send Message",
      "method": "POST",
      "endpoint": "/api/chat/send",
      "requires_auth": true,
      "body": { "message": "Hello!" },
      "expected_status": 200,
      "tags": ["chat"]
    }
  }'
```

### Method 3: Via Claude Code Assistant

Ask the assistant to add tests directly:

> "Add a test for the new /api/notifications endpoint. It should POST with a message and expect 200."

The assistant will:
1. Add the test to `tests.yaml`
2. Run the test suite to verify it works
3. Commit the changes

## Managing Tests

### View Current Tests
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/config
```

### Update an Existing Test
```bash
curl -X PUT https://pmo-ai-saas.onrender.com/api/testing/update-test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "api_tests",
    "testName": "Auth - Login Success",
    "updates": {
      "expected_status": [200, 201, 202]
    }
  }'
```

### Delete a Test
```bash
curl -X DELETE https://pmo-ai-saas.onrender.com/api/testing/delete-test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "api_tests",
    "testName": "Auth - Login Success"
  }'
```

## Test Suites

### Smoke Suite (Fast Checks)
Runs every 6 hours. Great for quick validation:
- Health Check
- Landing Page Loads
- Login Page Accessible
- Data API
- Auth Login

```bash
npm run test:e2e:smoke
```

### Critical Suite (Full Regression)
Runs daily at 2 AM. Comprehensive test before production release:
- All smoke tests
- Full API coverage
- E2E dashboard tests
- Database schema checks

```bash
npm run test:e2e:critical
```

### Custom Suites

You can define your own suites in `tests.yaml`:

```yaml
custom_features_suite:
  - "Chat - Send Message"
  - "Chat - Get History"
  - "Notifications - Subscribe"
  - "Notifications - Get All"
```

Then run via API:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/run/custom_features
```

## Best Practices

### ✅ Do's

- **Add tests for new features** — create test before or immediately after adding endpoint
- **Test the happy path** — make sure normal flows work
- **Tag tests properly** — use tags like `critical`, `smoke`, `auth` for organization
- **Use descriptive names** — "Login with valid credentials" not "Test 1"
- **Keep tests independent** — each test should run alone without side effects
- **Commit test updates** — version control changes to `tests.yaml`

### ❌ Don'ts

- Don't test implementation details (whitebox), test behavior (blackbox)
- Don't make tests depend on other tests running first
- Don't use hardcoded IDs from previous test runs
- Don't put secrets in test definitions (use env vars)
- Don't create tests that modify production data heavily (use test/demo accounts)

## Troubleshooting

### Tests Pass Locally But Fail in CI

**Cause:** Environment mismatch  
**Fix:** Check `RENDER_URL` environment variable in your CI/GitHub Actions:
```bash
export RENDER_URL=https://pmo-ai-saas.onrender.com
npm run test:e2e:smoke
```

### "Timeout: 10000ms exceeded"

**Cause:** Production instance is slow or unreachable  
**Fix:** 
1. Check if Render is up: `curl https://pmo-ai-saas.onrender.com/api/health`
2. Wait a moment and retry (Render instances wake up slowly)
3. Increase timeout in `src/agents/testingAgent.ts` if needed

### "Auth token required"

**Cause:** Missing `Authorization` header  
**Fix:** Include your admin token:
```bash
curl -H "Authorization: Bearer your-admin-token-here" \
  https://pmo-ai-saas.onrender.com/api/testing/run/smoke
```

### "Test not found in suite"

**Cause:** Test name doesn't match  
**Fix:** Verify test name in `tests.yaml` exactly matches (case-sensitive):
```yaml
# This name:
- name: "Auth - Login Success"

# Must match exactly in suite definition:
critical_suite:
  - "Auth - Login Success"  # ✓ Correct
  - "auth - login success"  # ✗ Wrong (case-sensitive)
```

## Integration with CI/CD

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Run Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:e2e:smoke
        env:
          RENDER_URL: https://pmo-ai-saas.onrender.com
```

### Slack Notifications

Capture test results and post to Slack:

```bash
#!/bin/bash
RESULT=$(npm run test:e2e:smoke 2>&1)
if echo "$RESULT" | grep -q "✗"; then
  curl -X POST $SLACK_WEBHOOK -d "{\"text\": \"❌ Tests failed!\n\`\`\`$RESULT\`\`\`\"}"
else
  curl -X POST $SLACK_WEBHOOK -d "{\"text\": \"✅ All tests passed!\"}"
fi
```

## Monitoring & Alerts

The Testing Agent logs to the app logger (`agentLogger`). You can:

1. **Check logs in Render**: View real-time test execution logs
2. **Set up alerts**: Configure Render to alert on test failures
3. **Track trends**: Save test result JSON for historical analysis

Example result JSON:
```json
{
  "success": true,
  "suite": {
    "name": "smoke",
    "total": 5,
    "passed": 5,
    "failed": 0,
    "duration_ms": 3245,
    "timestamp": "2026-07-31T15:30:00Z"
  }
}
```

## Next Steps

1. **Run your first test**: `npm run test:e2e:smoke`
2. **Add a test for your feature** in `tests.yaml`
3. **Commit and deploy** — watch tests auto-run
4. **Monitor results** in logs or via API

## Questions?

- Check `.claude/agents/testing-agent.md` for technical details
- Ask Claude Code: "How do I add a test for..."
- Review existing tests in `tests.yaml` for examples

---

Happy testing! 🚀
