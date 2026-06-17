// ============================================
// ÍNDICE DE FRAMEWORKS
// Aquí se importan y exportan todos los skills
// ============================================

import { scrum } from './scrum';
import { kanban } from './kanban';
import { safe } from './safe';

// EXPORTAR todos los frameworks en un objeto
// Así se pueden usar en las rutas y el dashboard
export const allSkills = {
  // Acceder como: allSkills.scrum, allSkills.kanban, allSkills.safe
  scrum,
  kanban,
  safe,
};

// También exportar individualmente por si se necesitan
export { scrum, kanban, safe };