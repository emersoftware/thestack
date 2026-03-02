import { describe, it, expect } from 'vitest';
import { getCurrentMondayAt18UTC, getNextMondayAt18UTC } from './newsletter';

function utc(dateStr: string): Date {
  return new Date(dateStr);
}

describe('getCurrentMondayAt18UTC', () => {
  it('on Monday before 18:00 returns same Monday', () => {
    const now = utc('2026-03-02T10:00:00Z'); // Monday 10:00
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Monday at exactly 18:00 returns same Monday', () => {
    const now = utc('2026-03-02T18:00:00Z'); // Monday 18:00
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Monday after 18:00 returns same Monday', () => {
    const now = utc('2026-03-02T19:30:00Z'); // Monday 19:30
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Friday returns the Monday of the same week', () => {
    const now = utc('2026-02-27T12:00:00Z'); // Friday
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-02-23T18:00:00.000Z');
  });

  it('on Sunday returns the Monday of the same week (previous Monday)', () => {
    const now = utc('2026-03-01T12:00:00Z'); // Sunday
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-02-23T18:00:00.000Z');
  });

  it('on Wednesday returns the Monday of the same week', () => {
    const now = utc('2026-03-04T09:00:00Z'); // Wednesday
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Saturday returns the Monday of the same week', () => {
    const now = utc('2026-03-07T09:00:00Z'); // Saturday
    const result = getCurrentMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });
});

describe('getNextMondayAt18UTC', () => {
  it('on Friday returns the upcoming Monday', () => {
    // Friday Feb 27 → next Monday is Mar 2
    const now = utc('2026-02-27T12:00:00Z');
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Monday before 18:00 returns same Monday (still in the future)', () => {
    const now = utc('2026-03-02T10:00:00Z'); // Monday 10:00
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  it('on Monday at exactly 18:00 returns NEXT Monday', () => {
    const now = utc('2026-03-02T18:00:00Z'); // Monday 18:00 — not in the future
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-09T18:00:00.000Z');
  });

  it('on Monday after 18:00 returns NEXT Monday', () => {
    const now = utc('2026-03-02T19:30:00Z'); // Monday 19:30
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-09T18:00:00.000Z');
  });

  it('on Wednesday returns the upcoming Monday', () => {
    const now = utc('2026-03-04T09:00:00Z'); // Wednesday
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-09T18:00:00.000Z');
  });

  it('on Sunday returns next day Monday', () => {
    const now = utc('2026-03-08T12:00:00Z'); // Sunday
    const result = getNextMondayAt18UTC(now);
    expect(result.toISOString()).toBe('2026-03-09T18:00:00.000Z');
  });
});

describe('newsletter scheduling integration scenarios', () => {
  it('cron creates on Friday, send finds it on Monday 18:00', () => {
    // Friday: cron creates draft with scheduledFor = next Monday
    const friday = utc('2026-02-27T18:00:00Z');
    const scheduledFor = getNextMondayAt18UTC(friday);
    expect(scheduledFor.toISOString()).toBe('2026-03-02T18:00:00.000Z');

    // Monday 18:00: send cron looks up by getCurrentMondayAt18UTC
    const mondaySend = utc('2026-03-02T18:00:00Z');
    const lookupDate = getCurrentMondayAt18UTC(mondaySend);
    expect(lookupDate.toISOString()).toBe('2026-03-02T18:00:00.000Z');

    // They match — send will find the draft
    expect(scheduledFor.getTime()).toBe(lookupDate.getTime());
  });

  it('admin edits on Sunday, send finds it on Monday 18:00', () => {
    // Sunday: admin saves draft with scheduledFor = next Monday
    const sunday = utc('2026-03-01T15:00:00Z');
    const scheduledFor = getNextMondayAt18UTC(sunday);
    expect(scheduledFor.toISOString()).toBe('2026-03-02T18:00:00.000Z');

    // Monday 18:00: send cron looks up
    const mondaySend = utc('2026-03-02T18:00:00Z');
    const lookupDate = getCurrentMondayAt18UTC(mondaySend);

    expect(scheduledFor.getTime()).toBe(lookupDate.getTime());
  });

  it('admin edits on Monday morning, send finds it on Monday 18:00', () => {
    const mondayMorning = utc('2026-03-02T10:00:00Z');
    const scheduledFor = getNextMondayAt18UTC(mondayMorning);
    expect(scheduledFor.toISOString()).toBe('2026-03-02T18:00:00.000Z');

    const mondaySend = utc('2026-03-02T18:00:00Z');
    const lookupDate = getCurrentMondayAt18UTC(mondaySend);

    expect(scheduledFor.getTime()).toBe(lookupDate.getTime());
  });

  it('after send, status shows next week countdown', () => {
    // After Monday 18:00, status endpoint uses getNextMondayAt18UTC for countdown
    const afterSend = utc('2026-03-02T18:05:00Z');
    const nextSend = getNextMondayAt18UTC(afterSend);
    expect(nextSend.toISOString()).toBe('2026-03-09T18:00:00.000Z');
  });

  it('Friday cron does not create duplicate if draft already exists for same Monday', () => {
    // First Friday creates for Mar 2
    const friday1 = utc('2026-02-27T18:00:00Z');
    const scheduled1 = getNextMondayAt18UTC(friday1);

    // If cron ran again on Saturday, getNextMondayAt18UTC still points to Mar 2
    const saturday = utc('2026-02-28T18:00:00Z');
    const scheduled2 = getNextMondayAt18UTC(saturday);

    expect(scheduled1.getTime()).toBe(scheduled2.getTime());
  });
});
