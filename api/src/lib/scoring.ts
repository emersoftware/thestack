import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DEFAULT_SCORING_PARAMS, type ScoringParams } from './utils';

export interface ScoringConfig extends ScoringParams {
  recalcWindowHours: number;
}

const DEFAULTS: ScoringConfig = {
  ...DEFAULT_SCORING_PARAMS,
  recalcWindowHours: 720,
};

export async function getScoringConfig(db: any): Promise<ScoringConfig> {
  try {
    const [config] = await db
      .select()
      .from(schema.scoringConfig)
      .where(eq(schema.scoringConfig.id, 'default'))
      .limit(1);
    if (!config) return { ...DEFAULTS };
    return {
      gravity: config.gravity,
      boost: config.boost,
      ageOffsetHours: config.ageOffsetHours,
      recalcWindowHours: config.recalcWindowHours,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
