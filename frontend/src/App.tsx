import { useState } from 'react';

export default function App() {
  const [selectedSkill, setSelectedSkill] = useState('Scrum');

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 5px 0' }}>PMO SaaS</h1>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>Gestión de Proyectos Potenciada por IA</p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '12px', fontWeight: 'bold' }}>ROI</p>
            <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>+28%</p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '12px', fontWeight: 'bold' }}>COSTOS PLANEADOS</p>
            <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>$150K</p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '12px', fontWeight: 'bold' }}>COSTOS REALES</p>
            <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>$142K</p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '12px', fontWeight: 'bold' }}>PROYECTOS ACTIVOS</p>
            <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#a855f7' }}>8</p>
          </div>
        </div>

        {/* Skills */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '22px' }}>Framework de Gestión</h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            {['Scrum', 'Kanban', 'SAFe'].map((skill) => (
              <button
                key={skill}
                onClick={() => setSelectedSkill(skill)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: selectedSkill === skill ? '#1e3a8a' : '#e5e7eb',
                  color: selectedSkill === skill ? 'white' : '#333',
                  fontSize: '14px'
                }}
              >
                {skill}
              </button>
            ))}
          </div>

          <div style={{ backgroundColor: '#eef2ff', padding: '20px', borderRadius: '6px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e3a8a' }}>
              {selectedSkill === 'Scrum' && '🎯 Framework Scrum'}
              {selectedSkill === 'Kanban' && '📋 Metodología Kanban'}
              {selectedSkill === 'SAFe' && '🏢 SAFe (Scaled Agile)'}
            </h3>
            
            <p style={{ margin: '0 0 15px 0', color: '#555', lineHeight: '1.6' }}>
              {selectedSkill === 'Scrum' && 'Sprints de 2 semanas, Daily Standups y Retrospectivas para iteración continua.'}
              {selectedSkill === 'Kanban' && 'Flujo continuo de trabajo, limitación de WIP y mejora incremental sin iteraciones fijas.'}
              {selectedSkill === 'SAFe' && 'Escalado ágil empresarial con múltiples equipos, roadmaps de largo plazo e integración estratégica.'}
            </p>

            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', fontSize: '13px', color: '#666' }}>
              <p style={{ margin: '5px 0' }}>✅ Actualmente usando: <strong style={{ color: '#1e3a8a' }}>{selectedSkill}</strong></p>
              <p style={{ margin: '5px 0' }}>📅 Próxima revisión: Semana 26</p>
              <p style={{ margin: '5px 0' }}>👥 Equipos involucrados: 3</p>
            </div>
          </div>
        </div>

        {/* Proyectos */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '22px' }}>Proyectos Activos</h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>Proyecto</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>Estado</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>Progreso</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>Equipo</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Website Redesign', status: 'En Progreso', progress: 65, team: 'Frontend' },
                { name: 'API Integration', status: 'En Progreso', progress: 80, team: 'Backend' },
                { name: 'Mobile App v2', status: 'Planeado', progress: 20, team: 'Full Stack' },
              ].map((project) => (
                <tr key={project.name} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{project.name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: project.status === 'En Progreso' ? '#dbeafe' : '#f3f4f6',
                      color: project.status === 'En Progreso' ? '#0369a1' : '#666'
                    }}>
                      {project.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
                      <div style={{ width: `${project.progress}%`, height: '100%', backgroundColor: '#1e3a8a' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#999' }}>{project.progress}%</span>
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>{project.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center', marginTop: '30px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>Listo para Integrar con IA</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.9 }}>Conecta con Slack, Jira y automatiza actualizaciones inteligentes</p>
          <button style={{ backgroundColor: 'white', color: '#1e3a8a', padding: '12px 30px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Configurar Integraciones
          </button>
        </div>
      </div>
    </div>
  );
}