import { scrumSkill } from './scrum';
import { kanbanSkill } from './kanban';
import { safeSkill } from './safe';

export const allSkills = {
  scrum: scrumSkill,
  kanban: kanbanSkill,
  safe: safeSkill
};

export type SkillName = keyof typeof allSkills;
