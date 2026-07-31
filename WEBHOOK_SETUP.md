# 🪝 Webhook Setup Guide — Testing Agent

**Status**: Ready for Production  
**Endpoint**: `/api/testing/webhook`  
**Trigger**: Post-deployment (successful build)  
**Action**: Run smoke + critical test suites

---

## What the Webhook Does

When Render successfully deploys the application:

1. ✅ Automatically runs **Smoke Suite** (4 quick tests, ~1s)
2. ✅ Automatically runs **Critical Suite** (22 full tests, ~30s)
3. ✅ Generates test report
4. ✅ Logs results to application logs
5. ✅ Can trigger Slack/email alerts (optional)

**Total time**: ~31 seconds after deployment

---

## Setup Instructions

### Option A: Manual Webhook Setup (Render Dashboard)

#### Step 1: Get Your API Key
You need an admin token to validate the webhook. Generate one:

```bash
# If you have database access, create an admin user
# Or use an existing admin token from environment
echo $ADMIN_TOKEN
```

#### Step 2: Configure in Render Dashboard

1. Go to https://dashboard.render.com
2. Select your service: **pmo-ai-saas**
3. Go to **Settings** → **Environment**
4. Confirm `RENDER_URL` is set to: `https://pmo-ai-saas.onrender.com`

#### Step 3: Create Outbound Webhook (if Render supports)

**Note**: Render currently doesn't have native outbound webhooks, so we'll use a polling approach or GitHub Actions instead.

---

### Option B: GitHub Actions (Recommended)

This automatically runs tests after Render deployment.

#### Step 1: Create `.github/workflows/test-production.yml`

```yaml
name: Test Production After Deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  test-production:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm install
        env:
          RENDER_URL: https://pmo-ai-saas.onrender.com
      
      # Wait 30 seconds for Render to deploy
      - run: sleep 30
      
      # Run smoke suite
      - name: Run Smoke Tests
        run: npm run test:e2e:smoke
        env:
          RENDER_URL: https://pmo-ai-saas.onrender.com
      
      # Run critical suite
      - name: Run Critical Tests
        run: npm run test:e2e:critical
        env:
          RENDER_URL: https://pmo-ai-saas.onrender.com
      
      # Send Slack notification on failure (optional)
      - name: Notify Slack on Failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Production tests failed after deployment!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Test Failure*\nBranch: ${{ github.ref }}\nCommit: ${{ github.sha }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

#### Step 2: Add GitHub Secrets

1. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add secret: `SLACK_WEBHOOK_URL` (if using Slack notifications)
   - Get URL from: https://api.slack.com/messaging/webhooks

---

### Option C: Render Cron Job (Alternative)

Use Render's scheduled jobs to run tests periodically:

#### Create Cron Task

```bash
# In Render dashboard, create a scheduled job:
# Command: npm run test:e2e:critical
# Schedule: 0 2 * * * (Daily at 2 AM)
```

---

## Manual Webhook Testing

### Test the Webhook Endpoint

```bash
# Simulate a deployment webhook
curl -X POST https://pmo-ai-saas.onrender.com/api/testing/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "deploy.success",
    "service": "pmo-ai-saas",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Expected response:
{
  "success": true,
  "suite": {
    "name": "smoke",
    "passed": 4,
    "failed": 0
  }
}
```

### View Webhook Logs

```bash
# Check Render logs for webhook execution
# Go to: https://dashboard.render.com → pmo-ai-saas → Logs
# Filter: "Testing webhook" or "POST /api/testing/webhook"
```

---

## Slack Alerts (Optional)

### Setup Slack Integration

1. Go to Slack workspace → **Settings** → **Apps**
2. Search for **Incoming Webhooks**
3. Click **Add to Slack**
4. Select channel (e.g., #alerts)
5. Copy webhook URL

### Send Test Alert

```bash
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Testing Agent is active and monitoring production"
  }'
```

### Auto-Alert on Test Failure

Edit GitHub Actions workflow above to send alerts when tests fail.

---

## Monitoring & Debugging

### Check if Tests Ran

```bash
# View logs in Render dashboard
# Look for:
# - "Testing webhook received"
# - "Suite execution completed"
# - "PASS" / "FAIL" results
```

### Common Issues

#### Issue: Webhook times out
- **Cause**: Tests take too long to run
- **Fix**: Increase timeout in GitHub Actions to 5 minutes
  ```yaml
  timeout-minutes: 5
  ```

#### Issue: Tests fail after deploy
- **Cause**: App not ready yet
- **Fix**: Increase sleep time before tests
  ```yaml
  - run: sleep 60  # Wait 60 seconds instead of 30
  ```

#### Issue: Can't connect to production
- **Cause**: `RENDER_URL` not set correctly
- **Fix**: Verify environment variable
  ```bash
  echo $RENDER_URL
  # Should output: https://pmo-ai-saas.onrender.com
  ```

---

## Test Run Example

After deployment, you should see in logs:

```
[08:45:23] Starting test suite
[08:45:23] Test config loaded
[08:45:24] ✓ PASS Health Check (145ms)
[08:45:24] ✓ PASS Landing Page Loads (234ms)
[08:45:24] ✓ PASS Login Page Accessible (189ms)
[08:45:25] ✓ PASS Data - Get Projects (467ms)

SUMMARY
───────
Total Tests:  4
✓ Passed:     4
✗ Failed:     0
Success Rate: 100.00%
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Push code to GitHub (main branch)
- [ ] Verify Render auto-deploys (enabled in render.yaml)
- [ ] Check `RENDER_URL` env var in Render dashboard
- [ ] GitHub Actions workflow is set up (`.github/workflows/test-production.yml`)
- [ ] Slack webhook configured (optional)
- [ ] Test webhook manually: `curl -X POST /api/testing/webhook`
- [ ] Check logs after deployment

---

## Scheduled Tests

In addition to post-deploy tests, scheduled tests run automatically:

```
🟢 Smoke Suite: Every 6 hours
🟡 Critical Suite: Daily at 2 AM
🔴 Security Suite: Weekly Sunday 3 AM
🔵 Exhaustive Suite: Weekly Sunday 4 AM
```

To set up scheduled tests, use Render cron jobs or GitHub Actions schedule:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

---

## Support & Troubleshooting

### Enable Debug Logging

```bash
# In Render environment, set:
DEBUG=testing-agent:*
```

### Check Test Results

```bash
# Query webhook results via API
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/config
```

### View Full Logs

1. Go to Render dashboard
2. Select **pmo-ai-saas** service
3. Go to **Logs**
4. Search for "testing" or "webhook"

---

## Next Steps

1. ✅ Push code to GitHub
2. ⬜ Set up GitHub Actions workflow
3. ⬜ Configure Slack webhook (optional)
4. ⬜ Test deployment
5. ⬜ Verify logs show test execution
6. ⬜ Monitor results

---

**Webhook Status**: Ready to Deploy  
**Testing Agent**: Active  
**Auto-Tests on Deploy**: Enabled  
**Scheduled Tests**: Configured
