export type MemberRole = 'adult' | 'child';
export type Member = { id: string; name: string; role: MemberRole };

export const demoMembers: Member[] = [
  { id: 'aina', name: 'Aina', role: 'child' },
  { id: 'iara', name: 'Iara', role: 'child' },
  { id: 'xavi', name: 'Xavi', role: 'adult' },
  { id: 'mireia', name: 'Mireia', role: 'adult' },
];

export function familyMembers(state?: { members?: Member[] } | null): Member[] {
  return state?.members?.length ? state.members : demoMembers;
}

export function childrenOf(state?: { members?: Member[] } | null): string[] {
  return familyMembers(state).filter(member => member.role === 'child').map(member => member.id);
}

export function adultsOf(state?: { members?: Member[] } | null): string[] {
  return familyMembers(state).filter(member => member.role === 'adult').map(member => member.id);
}

export function memberName(state: { members?: Member[] } | null | undefined, id: string): string {
  return familyMembers(state).find(member => member.id === id)?.name ?? id;
}

export function memberRole(state: { members?: Member[] } | null | undefined, id: string): MemberRole | null {
  return familyMembers(state).find(member => member.id === id)?.role ?? null;
}

export function parseFamilyMembers(value: unknown): Member[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 12) throw new Error('Invalid family');
  const members: Member[] = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid member');
    const input = entry as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 40 || /[\u0000-\u001f]/.test(name) || (input.role !== 'adult' && input.role !== 'child')) throw new Error('Invalid member');
    return { id: `member-${index + 1}`, name, role: input.role };
  });
  if (new Set(members.map(member => member.name.toLocaleLowerCase())).size !== members.length) throw new Error('Duplicate family name');
  if (!members.some(member => member.role === 'adult') || !members.some(member => member.role === 'child')) throw new Error('Invalid family');
  return members;
}
