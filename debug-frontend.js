// Ejecutar en consola del navegador en /projects
fetch('/api/analysis/1/latest')
  .then(r => r.json())
  .then(data => {
    console.log('=== FULL RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== REPORTS ===');
    console.log(data.data?.reports);
    console.log('=== ALTERNATIVE PATH ===');
    console.log(data.data?.output?.reports);
  })
  .catch(e => console.error('Error:', e));
