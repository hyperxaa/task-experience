export type HousePerson = 'A' | 'I' | 'X' | 'M';
export type Point = readonly [number, number];
export type Activity = 'sofa' | 'kitchen' | 'bath' | 'bedroom' | 'terrace';

type Segment = { start: number; end: number; from: Point; to: Point; activity?: Activity };
export type MotionPlan = { segments: Segment[]; duration: number };
export type MotionSample = { point: Point; activity?: Activity; idleFor: number };

export const WALK_SPEED = 78;
export const DAY_END = 78;
export const ASLEEP_START = 88;
export const WAKE_START = 100;
export const CYCLE_SECONDS = 108;

const HUB: Point = [188, 385];
const BEDS: Record<HousePerson, Point> = { A: [55, 585], I: [220, 582], X: [325, 586], M: [348, 586] };
const BED_TO_HUB: Record<HousePerson, readonly Point[]> = {
  A: [BEDS.A, [116, 585], [116, 550], [116, 520], [116, 490], [188, 490], [188, 405], HUB],
  I: [BEDS.I, [182, 582], [182, 550], [182, 520], [182, 490], [188, 490], [188, 405], HUB],
  X: [BEDS.X, [300, 586], [300, 530], [300, 505], [300, 460], [284, 460], [260, 460], [188, 460], [188, 405], HUB],
  M: [BEDS.M, [300, 586], [300, 530], [300, 505], [300, 460], [284, 460], [260, 460], [188, 460], [188, 405], HUB],
};

const SOFA: Record<HousePerson, Point> = { A: [270, 262], I: [305, 262], X: [345, 224], M: [345, 184] };
const KITCHEN: Record<HousePerson, Point> = { A: [278, 363], I: [293, 363], X: [316, 363], M: [334, 363] };

function destinationPath(person: HousePerson, activity: Activity): Point[] {
  if (activity === 'sofa') {
    const approach: Point[] = [HUB, [188, 320], [188, 280], [240, 280]];
    return person === 'A' || person === 'I'
      ? [...approach, SOFA[person]]
      : [...approach, [315, 280], [345, 273], SOFA[person]];
  }
  if (activity === 'kitchen') return [HUB, [188, 363], [245, 363], [260, 363], KITCHEN[person]];
  if (activity === 'terrace') return [HUB, [188, 320], [188, 280], [240, 280], [240, 145], [300, 145], [300, 112], [300, 78]];
  if (activity === 'bath') return person === 'A' || person === 'I'
    ? [HUB, [188, 405], [188, 460], [125, 460], [98, 460], person === 'A' ? [62, 474] : [78, 474]]
    : [HUB, [188, 405], [188, 460], [260, 460], [284, 460], person === 'X' ? [308, 460] : [326, 460]];
  if (person === 'A') return [HUB, [188, 405], [188, 490], [116, 490], [116, 520], [116, 550], [100, 585]];
  if (person === 'I') return [HUB, [188, 405], [188, 490], [182, 490], [182, 520], [182, 550], [180, 590]];
  return [HUB, [188, 405], [188, 460], [260, 460], [284, 460], [300, 460], [300, 505], [300, 530], person === 'X' ? [325, 545] : [350, 545]];
}

function distance(a: Point, b: Point) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
function pathLength(points: readonly Point[]) { return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0); }
function interpolate(a: Point, b: Point, ratio: number): Point { return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]; }

function pointAlong(points: readonly Point[], distanceTravelled: number): Point {
  let remaining = Math.max(0, distanceTravelled);
  for (let index = 1; index < points.length; index++) {
    const length = distance(points[index - 1], points[index]);
    if (remaining <= length) return interpolate(points[index - 1], points[index], length ? remaining / length : 1);
    remaining -= length;
  }
  return points.at(-1)!;
}

function randomGenerator(seed: number) {
  let value = seed >>> 0 || 1;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function buildDayPlan(person: HousePerson, seed: number): MotionPlan {
  const random = randomGenerator(seed ^ person.charCodeAt(0));
  const segments: Segment[] = [];
  let cursor = ['A', 'I', 'X', 'M'].indexOf(person) * 0.55;
  let bag: Activity[] = [];
  const addPath = (points: readonly Point[]) => {
    for (let index = 1; index < points.length; index++) {
      const duration = distance(points[index - 1], points[index]) / WALK_SPEED;
      segments.push({ start: cursor, end: cursor + duration, from: points[index - 1], to: points[index] });
      cursor += duration;
    }
  };
  while (cursor < DAY_END - 8) {
    if (!bag.length) bag = shuffle<Activity>(['sofa', 'kitchen', 'bath', 'bedroom', 'terrace'], random);
    const activity = bag[0];
    const path = destinationPath(person, activity);
    const dwell = 3.5 + random() * 2.5;
    if (cursor + 2 * pathLength(path) / WALK_SPEED + dwell > DAY_END - 1) break;
    bag.shift();
    addPath(path);
    const point = path.at(-1)!;
    segments.push({ start: cursor, end: cursor + dwell, from: point, to: point, activity });
    cursor += dwell;
    addPath([...path].reverse());
  }
  return { segments, duration: cursor };
}

function samplePlan(plan: MotionPlan, time: number, fallback: Point): MotionSample {
  const segment = plan.segments.find(step => time >= step.start && time < step.end);
  if (!segment) return { point: fallback, idleFor: 0 };
  return {
    point: interpolate(segment.from, segment.to, (time - segment.start) / (segment.end - segment.start)),
    activity: segment.activity,
    idleFor: segment.activity ? time - segment.start : 0,
  };
}

export function samplePerson(person: HousePerson, plan: MotionPlan, time: number): MotionSample {
  if (time < DAY_END) return samplePlan(plan, time, HUB);
  const bedToHub = BED_TO_HUB[person];
  if (time < ASLEEP_START) return { point: pointAlong([...bedToHub].reverse(), (time - DAY_END) * WALK_SPEED), idleFor: 0 };
  if (time < WAKE_START) return { point: BEDS[person], idleFor: 0 };
  return { point: pointAlong(bedToHub, (time - WAKE_START) * WALK_SPEED), idleFor: 0 };
}

const CAT_SOFA: Point = [258, 226];
const CAT_HUB: Point = [230, 226];
const CAT_PATHS: readonly Point[][] = [
  [CAT_HUB, [200, 202]],
  [CAT_HUB, [230, 177]],
  [CAT_HUB, [230, 173], [300, 173]],
  [CAT_HUB, [230, 243], [300, 243], [300, 225]],
];

export function buildCatPlan(seed: number): MotionPlan {
  const random = randomGenerator(seed ^ 0x9e3779b9);
  const segments: Segment[] = [];
  let cursor = 0;
  let bag: number[] = [];
  while (cursor < DAY_END - 7) {
    if (!bag.length) bag = shuffle([0, 1, 2, 3], random);
    const path = CAT_PATHS[bag[0]];
    const dwell = 3 + random() * 4;
    if (cursor + 2 * pathLength(path) / WALK_SPEED + dwell > DAY_END - 1) break;
    bag.shift();
    for (const travel of [path, [...path].reverse()]) {
      for (let index = 1; index < travel.length; index++) {
        const duration = distance(travel[index - 1], travel[index]) / WALK_SPEED;
        segments.push({ start: cursor, end: cursor + duration, from: travel[index - 1], to: travel[index] });
        cursor += duration;
      }
      if (travel === path) {
        const point = path.at(-1)!;
        segments.push({ start: cursor, end: cursor + dwell, from: point, to: point, activity: 'sofa' });
        cursor += dwell;
      }
    }
  }
  return { segments, duration: cursor };
}

export function sampleCat(plan: MotionPlan, time: number): MotionSample {
  if (time < DAY_END) return samplePlan(plan, time, CAT_HUB);
  if (time < ASLEEP_START) return { point: pointAlong([CAT_HUB, CAT_SOFA], (time - DAY_END) * WALK_SPEED), idleFor: 0 };
  if (time < WAKE_START) return { point: CAT_SOFA, idleFor: 0 };
  return { point: pointAlong([CAT_SOFA, CAT_HUB], (time - WAKE_START) * WALK_SPEED), idleFor: 0 };
}
