# ⏰ Scheduled Testing Setup — Weekly Automated Tests

**Objetivo**: Ejecutar suite completa de pruebas cada miércoles a las 5 AM automáticamente  
**Servicio**: Upstash Cron (gratuito, confiable)  
**Tests**: Exhaustive suite (70+ tests)

---

## 🚀 Setup en 5 Minutos

### Paso 1: Registrarse en Upstash

1. Ve a: https://upstash.com
2. Click: **Sign Up** (gratis)
3. Completa el registro

### Paso 2: Crear Cron Job

1. En Upstash dashboard, ve a: **Cron**
2. Click: **Create**
3. Llena los campos:

```
Name: LARA Weekly Testing
Schedule: 0 5 * * 3    # Miércoles 5 AM UTC
Timezone: America/Bogota  # Tu zona horaria

Destination: HTTPS POST
URL: https://pmo-ai-saas.onrender.com/api/testing/scheduled-run

Headers (add):
  Content-Type: application/json

Body:
{
  "source": "upstash-cron",
  "suite": "exhaustive"
}
```

4. Click: **Save**

✅ **Listo.** Cada miércoles a las 5 AM se ejecutarán todos los tests automáticamente.

---

## 📊 Qué Pasa Cada Miércoles a las 5 AM

1. Upstash envía POST a `/api/testing/scheduled-run`
2. App ejecuta suite exhaustiva (70+ tests):
   - ✓ 12 tests de auth & autorización
   - ✓ 2 tests de SQL injection
   - ✓ 3 tests de XSS
   - ✓ 5 tests de validación
   - ✓ 1 test de CSRF
   - ✓ 4 tests de headers
   - ✓ 2 tests de rate limiting
   - ✓ 6 tests de integridad
   - ✓ 5 tests de performance
   - ✓ 15+ tests de endpoints
3. Resultados se guardan en logs de Render
4. Si hay fallos, se reportan

**Duración**: ~3 minutos  
**Resultado**: JSON con pass/fail + reporte

---

## 💬 Ejecutar a Demanda desde el Chat

Para ejecutar pruebas cuando quieras, simplemente escribe:

```
ejecuta agente de pruebas
```

Y yo (Claude Code) ejecutaré:

```bash
curl -X POST https://pmo-ai-saas.onrender.com/api/testing/scheduled-run \
  -H "Content-Type: application/json" \
  -d '{
    "source": "chat-manual",
    "suite": "exhaustive"
  }'
```

**Resultado**: Te mostraré el reporte completo de pruebas en segundos.

---

## 📝 Ejemplos de Uso

### Desde el Chat
```
Usuario: ejecuta agente de pruebas
Claude: [ejecuta los 70+ tests y muestra resultados]
```

### Desde Terminal (si lo necesitas)
```bash
# Ejecutar tests manualmente
curl -X POST https://pmo-ai-saas.onrender.com/api/testing/scheduled-run \
  -H "Content-Type: application/json" \
  -d '{}'

# Ver resultados
curl https://pmo-ai-saas.onrender.com/api/testing/config \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🔍 Ver Resultados de Tests

### En Render Logs
1. Ve a: https://dashboard.render.com → pmo-ai-saas → Logs
2. Busca: "SCHEDULED TEST RUN" o "exhaustive"
3. Verás: Todos los resultados de las pruebas

### Ejemplo de Log:
```
[05:00:00] 🧪 SCHEDULED TEST RUN STARTED - Full exhaustive suite
[05:00:15] ✓ PASS Auth - Login Valid Credentials (182ms)
[05:00:16] ✓ PASS Security - SQL Injection Prevention (145ms)
[05:00:45] ✅ ALL TESTS PASSED (70/70)
```

---

## ✨ Qué Incluye la Suite Exhaustiva

### 1. Authentication & Authorization
- Login/logout, tokens, cookies
- Cross-user access prevention
- Admin role validation

### 2. Security
- SQL injection attempts
- XSS prevention
- CSRF protection
- Security headers (CSP, HSTS, etc.)

### 3. Rate Limiting
- Brute force protection
- API abuse detection

### 4. Data Integrity
- Schema validation
- Foreign key integrity
- Encryption verification
- No hardcoded secrets

### 5. Performance
- Auth response time <2s
- API response time <3s
- Analysis trigger <5s
- Chat latency <3s
- Portfolio load <4s

### 6. API Coverage
- All CRUD operations
- Error handling
- Data validation
- Edge cases

---

## 🆘 Troubleshooting

### El cron no se ejecuta
1. Verifica Upstash dashboard → Logs
2. Comprueba URL: `https://pmo-ai-saas.onrender.com/api/testing/scheduled-run`
3. Verifica timezone en Upstash
4. Renderización UTC: `0 10 * * 3` para 5 AM Bogotá (UTC-5)

### Tests fallan
1. Ve a Render logs → filtra "SCHEDULED TEST RUN"
2. Lee error específico
3. Ejecuta manualmente: `ejecuta agente de pruebas` en el chat

### Quiero cambiar el horario
1. Ve a Upstash → Cron job
2. Edita schedule: `0 5 * * 3` 
   - `0` = minuto
   - `5` = hora (UTC)
   - `*` = cualquier día
   - `*` = cualquier mes
   - `3` = miércoles (0=domingo, 3=miércoles)

---

## 📋 Checklist de Configuración

- [ ] Registrarse en Upstash (https://upstash.com)
- [ ] Crear Cron job con:
  - Schedule: `0 5 * * 3` (Miércoles 5 AM)
  - URL: `https://pmo-ai-saas.onrender.com/api/testing/scheduled-run`
  - Method: POST
  - Body: `{"source": "upstash-cron"}`
- [ ] Verificar en Render logs que se ejecuta
- [ ] Probar: Escribir "ejecuta agente de pruebas" en el chat
- [ ] Listo ✅

---

## 🎯 Summary

**Automated**: Cada miércoles 5 AM se ejecutan 70+ tests automáticamente  
**On-Demand**: Escribe "ejecuta agente de pruebas" para pruebas manuales  
**Reporting**: Resultados en Render logs + Upstash dashboard  
**Coverage**: Funcionalidad, seguridad, carga, user flows todo cubierto  

---

**Próximo paso**: Configura Upstash Cron (5 minutos) y listo. 

Luego solo espera cada miércoles a las 5 AM o ejecuta manualmente cuando lo necesites.
