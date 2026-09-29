const defaultIcons: Record<string, { from: string; to: string }> = {
  room: { from: 'sparkles', to: 'bedroom' },
  teeth: { from: 'shower', to: 'toothbrush' },
  'kids-us': { from: 'book', to: 'headphones' },
  plan: { from: 'list', to: 'calendar' },
  'school-homework': { from: 'book', to: 'pencil' },
  'new-food': { from: 'utensils', to: 'apple' },
};

export function updatedMissionIcon(taskId: string, icon?: string) {
  const mapping = defaultIcons[taskId];
  return mapping && (!icon || icon === mapping.from) ? mapping.to : icon;
}
