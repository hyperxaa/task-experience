import { readFileSync, writeFileSync } from 'node:fs';

const files=['app/task-xp.tsx','app/activity-controls.tsx','app/progress-view.tsx','app/xp-house.tsx','app/rotating-copy.tsx','app/layout.tsx','public/manifest.webmanifest'];
for(const file of files){
  const current=readFileSync(file,'utf8');
  const next=current.replaceAll('Task XP','Task eXperience').replace(/\bXP\b/g,'Xp');
  writeFileSync(file,next);
}
