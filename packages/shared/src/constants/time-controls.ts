/** Battle time controls. */

export interface TimeControl {
  id: string;
  label: string;
  durationMs: number;
}

export const TIME_CONTROLS = {
  bullet: { id: 'bullet', label: 'Bullet', durationMs: 3 * 60 * 1000 },
  blitz: { id: 'blitz', label: 'Blitz', durationMs: 5 * 60 * 1000 },
  rapid: { id: 'rapid', label: 'Rapid', durationMs: 10 * 60 * 1000 },
  classical: { id: 'classical', label: 'Classical', durationMs: 20 * 60 * 1000 },
} as const satisfies Record<string, TimeControl>;

export type TimeControlId = keyof typeof TIME_CONTROLS;

export const DEFAULT_TIME_CONTROL: TimeControlId = 'rapid';

export function timeControl(id: string): TimeControl {
  return (TIME_CONTROLS as Record<string, TimeControl>)[id] ?? TIME_CONTROLS[DEFAULT_TIME_CONTROL];
}
