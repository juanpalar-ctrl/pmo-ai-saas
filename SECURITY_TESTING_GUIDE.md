# 🔐 Security Testing Guide — PMO AI SaaS

**Access Level**: Admin Only  
**Last Updated**: 2026-07-31  
**Maintained By**: Security Team

---

## Overview

The comprehensive security testing suite covers **10 major security domains** with **70+ automated tests**. All tests are **admin-only** and protected by `adminAuthMiddleware`.

## Quick Reference

```bash
# Run security-focused tests only
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/run/security

# Run exhaustive tests (complete security audit)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://pmo-ai-saas.onrender.com/api/testing/run/exhaustive

# CLI: security suite
npm run test:e2e:security 2>/dev/null
```

---

## 1. Authentication & Authorization Tests (12 tests)

### What's Tested

#### ✅ Valid Authentication
- **Test**: `Auth - Register New User`
  - Verifies new user registration works with proper validation
  - Expects: 200/201
  
- **Test**: `Auth - Login Valid Credentials`
  - Valid username/password returns auth token
  - Expects: 200/201

#### ❌ Invalid Authentication (Rejection)
- **Test**: `Auth - Login Invalid Credentials`
  - Wrong password rejected
  - Expects: 401 (Unauthorized)
  
- **Test**: `Auth - Login Nonexistent User`
  - Non-existent user rejected
  - Expects: 401 (Unauthorized)

#### 🔒 Session & Token Validation
- **Test**: `Auth - Access Protected Endpoint Without Token`
  - Unauthenticated access to protected endpoint blocked
  - Expects: 401 (Unauthorized)
  - **Why Critical**: Ensures no unauthorized data exposure

- **Test**: `Auth - Access Protected Endpoint with Invalid Token`
  - Malformed/fake JWT rejected
  - Expects: 401 (Unauthorized)
  - **Why Critical**: Validates JWT signature verification

- **Test**: `Auth - Expired Token Rejection`
  - Expired tokens not accepted
  - Expects: 401 (Unauthorized)
  - **Why Critical**: Time-based session invalidation works

#### 🍪 Cookie Security
- **Test**: `Security - Inspect Auth Cookie Flags`
  - Validates `httpOnly`, `secure`, `sameSite` flags
  - **Why Critical**: Prevents XSS cookie theft and CSRF attacks
  - Missing flags = **HIGH SEVERITY ISSUE**

#### 🛡️ Authorization (Least Privilege)
- **Test**: `Authz - User Cannot Access Other User Projects`
  - User A cannot read User B's projects
  - Expects: 403 (Forbidden)
  - **Why Critical**: Prevents IDOR (Insecure Direct Object Reference)

- **Test**: `Authz - User Cannot Modify Other User Data`
  - User A cannot modify User B's data
  - Expects: 403/404
  - **Why Critical**: Write-level access control

- **Test**: `Authz - Non-Admin Cannot Access Admin Endpoints`
  - Regular users blocked from `/api/admin/*`
  - Expects: 403 (Forbidden)
  - **Why Critical**: Role-based access control (RBAC)

- **Test**: `Authz - User Cannot Delete Other User Account`
  - Account deletion only by owner/admin
  - Expects: 403/404
  - **Why Critical**: Prevents account hijacking

---

## 2. SQL Injection Prevention (2 tests)

### Attack Vectors Tested

#### 🔴 Email Field SQL Injection
```sql
-- Malicious input
email: "admin' OR '1'='1"

-- What it would do (without protection)
SELECT * FROM users WHERE email='admin' OR '1'='1';
-- Returns ALL users, bypassing authentication
```

**Test**: `Security - SQL Injection in Login Email`
- Expects: 401 (rejected, NOT authenticated)
- **Result**: ✅ Parameterized queries / prepared statements work

#### 🔴 Password Field SQL Injection
```sql
password: "' OR '1'='1"
```

**Test**: `Security - SQL Injection in Password`
- Expects: 401 (rejected)
- **Result**: ✅ Input sanitization/parameterization works

### How Protection Works
- ✅ **Parameterized queries** (recommended)
- ✅ **ORM with escaping** (TypeORM, Sequelize)
- ✅ **Input validation** (type checking)

---

## 3. XSS (Cross-Site Scripting) Prevention (3 tests)

### Attack Vectors Tested

#### 🔴 Script Tag Injection
```html
<!-- Malicious input -->
name: "<script>alert('XSS')</script>"

<!-- What it could do (without protection)
Stolen cookies, redirect to phishing, steal session tokens -->
```

**Test**: `XSS - Script Tag in Project Name`
- Expects: 200 or 400 (either sanitized or rejected)
- **Critical**: Never returns 200 with unescaped `<script>`

#### 🔴 Event Handler Injection
```html
<!-- Malicious input -->
description: "<img src=x onerror='alert(1)'>"

<!-- Triggers JavaScript when image fails to load -->
```

**Test**: `XSS - Event Handler in Description`
- Expects: 200 or 400
- **Critical**: Never accepts `onerror=`, `onload=`, etc.

#### ✅ HTML Encoding Verification
```html
<!-- Input -->
name: "<b>Bold Test</b>"

<!-- Should be rendered as -->
&lt;b&gt;Bold Test&lt;/b&gt;
```

**Test**: `XSS - HTML Encoding Verification`
- Expects: 200 (safely escaped)
- **Why**: Legitimate use of HTML entities should work

### How Protection Works
- ✅ **HTML entity encoding** (& → &amp;, < → &lt;)
- ✅ **Content-Security-Policy header** (blocks inline scripts)
- ✅ **Input sanitization** (DOMPurify, sanitize-html)
- ✅ **Output escaping** (template engines with auto-escape)

---

## 4. Input Validation Tests (5 tests)

### Boundary & Format Testing

#### 🔴 Extremely Long Input (DoS Prevention)
```
Input: String of 50,000 characters
Purpose: Prevent buffer overflow / memory exhaustion
Expects: 400 or 413 (Bad Request / Payload Too Large)
```

#### 🔴 Null Byte Injection
```
Input: "Project\x00Name"
Purpose: Prevent null-byte attacks in legacy systems
Expects: 400 (rejected)
```

#### 🔴 Invalid UTF-8 Characters
```
Input: "\xFF\xFE"
Purpose: Prevent encoding attacks
Expects: 400 (rejected)
```

#### ✅ Email Format Validation
```
Invalid: "not-an-email"
Expects: 400 (rejected)
Valid patterns: RFC 5322 compliant
```

#### 🔐 Password Strength
```
Weak: "123"
Expects: 400 (rejected)
Minimum: 8+ chars, mix of upper/lower/numbers/symbols
```

---

## 5. CSRF (Cross-Site Request Forgery) Protection (1 test)

### What's Tested

#### 🛡️ CSRF Token Validation
```
POST /api/data/projects (without CSRF token)
Expects: 403 (Forbidden) or 400 (Bad Request)
```

**Test**: `CSRF - Missing CSRF Token`
- Ensures POST/PUT/DELETE require CSRF token
- **Why Critical**: Prevents unauthorized actions from 3rd party sites

### How Protection Works
- ✅ **SameSite cookie attribute** (prevents cross-site cookie sending)
- ✅ **CSRF token in forms** (double-submit cookie pattern)
- ✅ **Origin/Referer header validation**

---

## 6. Security Headers Validation (4 tests)

### Critical Headers Checked

#### 1️⃣ Content-Security-Policy (CSP)
```
Expected: Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Purpose: Prevent XSS by controlling what content can load
✅ Test: `Headers - Content-Security-Policy`
```

#### 2️⃣ Strict-Transport-Security (HSTS)
```
Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains
Purpose: Force HTTPS, prevent man-in-the-middle attacks
✅ Test: `Headers - Strict-Transport-Security`
```

#### 3️⃣ X-Content-Type-Options
```
Expected: X-Content-Type-Options: nosniff
Purpose: Prevent MIME-type sniffing (e.g., serving JS as HTML)
✅ Test: `Headers - X-Content-Type-Options`
```

#### 4️⃣ X-Frame-Options
```
Expected: X-Frame-Options: SAMEORIGIN or DENY
Purpose: Prevent clickjacking attacks (iframe embedding)
✅ Test: `Headers - X-Frame-Options`
```

---

## 7. Rate Limiting Tests (2 tests)

### Attack Prevention

#### 🔴 Brute Force Attack Simulation
```
POST /api/auth/login (25 attempts in rapid succession)
Limit: 20 attempts per 15 minutes
Expects: 429 (Too Many Requests) after limit exceeded
```

**Test**: `RateLimit - Auth Endpoint Limits`
- **Why Critical**: Prevents password guessing attacks
- **Impact**: Blocks 1000s of login attempts/day from same IP

#### 🔴 API Abuse Simulation
```
POST /api/chat/send (70 messages in 1 minute)
Limit: 60 messages per minute
Expects: 429 (Too Many Requests)
```

**Test**: `RateLimit - Chat Endpoint Limits`
- **Why Critical**: Prevents resource exhaustion
- **Impact**: Protects AI backend from spam

---

## 8. Data Integrity & Consistency (6 tests)

### Schema & Referential Integrity

#### ✅ Table Existence
```sql
-- Test: Data - Projects Table Exists and Indexed
SELECT COUNT(*) FROM projects;
Expects: Success (table exists and is indexed)
```

#### ✅ Foreign Key Integrity
```sql
-- Test: Data - User Foreign Key Integrity
SELECT COUNT(*) FROM projects WHERE user_id NOT IN (SELECT id FROM users);
Expects: 0 (no orphaned records)
```

**Why Critical**: Orphaned records indicate:
- Failed delete cascades
- Database corruption
- Incomplete migrations

#### ✅ Encryption Verification
```sql
-- Test: Data - Encryption Verification
SELECT COUNT(*) FROM users WHERE password IS NULL OR password = '';
Expects: 0 (no plaintext passwords)
```

**Why Critical**: 
- Plaintext passwords = instant account takeover
- Should use bcrypt/Argon2

#### ✅ No Hardcoded Secrets
```sql
-- Test: Data - No Hardcoded Test Tokens
SELECT COUNT(*) FROM sessions WHERE token LIKE '%test%' OR token LIKE '%admin%';
Expects: 0 (no dummy tokens)
```

**Why Critical**: Prevents credential leakage in production

---

## 9. Performance Tests (5 tests)

### Response Time SLAs

| Endpoint | Max Time | Test Name |
|----------|----------|-----------|
| Login | 2000ms | `Performance - Auth Login Response Time` |
| List Projects | 3000ms | `Performance - Data API Response Time` |
| Trigger Analysis | 5000ms | `Performance - Analysis Trigger Response` |
| Chat Message | 3000ms | `Performance - Chat Message Latency` |
| Portfolio Load | 4000ms | `Performance - Portfolio Load Time` |

**Why Critical**: 
- Slow auth = poor UX + potential DoS vector
- Slow API = blocked requests = server exhaustion

---

## 10. API Endpoint Coverage (15+ tests)

### All Endpoints Tested

| Category | Endpoint | Tests |
|----------|----------|-------|
| **Auth** | `/api/auth/*` | Register, Login, Get Me, Logout |
| **Data** | `/api/data/projects` | CRUD operations |
| **Analysis** | `/api/analysis/*` | Trigger, Results, History |
| **Team** | `/api/team/*` | Health, Breakdown |
| **Chat** | `/api/chat/*` | Send, History |
| **Portfolio** | `/api/portfolio/*` | Summary, Analysis |
| **Branding** | `/api/branding/*` | Get, Update (admin) |

---

## Test Suites Explained

### 🟢 Smoke Suite (4 tests, ~1 second)
**When**: Every 6 hours  
**Purpose**: Quick health check  
**Tests**:
- Health endpoint
- Login works
- Landing page loads
- Data API responds

### 🟡 Critical Suite (22 tests, ~30 seconds)
**When**: Daily at 2 AM  
**Purpose**: Full regression before production  
**Tests**: Smoke + Auth + Authorization + Core security + Perf

### 🔴 Security Suite (30 tests, ~45 seconds)
**When**: Weekly (Sunday 3 AM)  
**Purpose**: Deep security audit  
**Tests**: All auth, injection, XSS, CSRF, headers, rate limit, data integrity

### 🔵 Exhaustive Suite (70+ tests, ~3 minutes)
**When**: Weekly (Sunday 4 AM)  
**Purpose**: Complete system validation  
**Tests**: Everything listed above

---

## Interpreting Test Results

### ✅ PASS (Green)
Test completed and assertion succeeded. System is secure for this vector.

### ❌ FAIL (Red)
**CRITICAL**: Investigate immediately.

#### Common Failures

| Test | Failure Reason | Severity | Fix |
|------|---|---|---|
| SQL Injection | Query executed instead of rejected | 🔴 CRITICAL | Use parameterized queries |
| XSS in Project Name | `<script>` returned unescaped | 🔴 CRITICAL | Add HTML entity encoding |
| Cookie httpOnly missing | JavaScript can read auth cookie | 🔴 CRITICAL | Set `httpOnly: true` |
| No HSTS header | HTTPS not enforced | 🟠 HIGH | Add `Strict-Transport-Security` header |
| Rate limit not working | 1000s of requests processed | 🟠 HIGH | Enable rate limiter middleware |
| Orphaned records | Foreign key constraint violated | 🟠 HIGH | Fix database migrations |

---

## Running Manual Security Tests

### Test a Specific Vulnerability

#### Test: SQL Injection
```bash
curl -X POST https://pmo-ai-saas.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'"'"' OR '"'"'1'"'"'='"'"'1","password":"test"}'

# Should return 401, NOT authenticate
```

#### Test: XSS
```bash
curl -X POST https://pmo-ai-saas.onrender.com/api/data/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>"}'

# Check response: <script> should be escaped as &lt;script&gt;
```

#### Test: Missing Auth
```bash
curl https://pmo-ai-saas.onrender.com/api/data/projects

# Should return 401, NOT return user data
```

---

## Security Incident Response

If a test fails:

1. **Immediate**: Mark as security incident
2. **Within 1 hour**: Isolate affected component
3. **Within 4 hours**: Develop fix
4. **Within 24 hours**: Deploy hotfix to production
5. **Post-incident**: 
   - Add regression test (prevent repeat)
   - Root cause analysis
   - Security review of similar code

---

## Test Maintenance

### When to Add Tests
- New endpoint added
- Security vulnerability discovered
- Third-party library updated
- Compliance requirement added

### How to Add Tests
Edit `tests.yaml` and add to appropriate category:

```yaml
security_tests:
  - name: "MyNewTest"
    method: "POST"
    endpoint: "/api/endpoint"
    body: { ... }
    expected_status: 401
    tags: ["security", "critical"]
```

Then commit and tests auto-run on deploy.

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Auth0 Security Best Practices](https://auth0.com/docs/get-started/auth-basics)

---

## Support

Questions? Contact: security-team@example.com
