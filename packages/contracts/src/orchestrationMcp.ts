import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ThreadId,
} from "./baseSchemas.ts";

export const ThreadContextUsageResult = Schema.Struct({
  threadId: ThreadId,
  usedTokens: NonNegativeInt,
  maxTokens: Schema.NullOr(PositiveInt),
  remainingTokens: Schema.NullOr(NonNegativeInt),
  usedPercent: Schema.NullOr(Schema.Number),
  remainingPercent: Schema.NullOr(Schema.Number),
  inputTokens: Schema.NullOr(NonNegativeInt),
  cachedInputTokens: Schema.NullOr(NonNegativeInt),
  outputTokens: Schema.NullOr(NonNegativeInt),
  reasoningOutputTokens: Schema.NullOr(NonNegativeInt),
  updatedAt: Schema.NullOr(IsoDateTime),
});
export type ThreadContextUsageResult = typeof ThreadContextUsageResult.Type;
