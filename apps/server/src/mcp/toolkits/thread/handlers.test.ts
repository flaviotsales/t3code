import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ProviderThreadId,
  ProviderTurnId,
  ThreadId,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as ThreadSearch from "../../../orchestration-v2/ThreadSearch.ts";
import * as ScheduledTasks from "../../../scheduledTasks/ScheduledTaskService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import * as ThreadHandlers from "./handlers.ts";
import { ThreadToolkit } from "./tools.ts";

it.effect("t3_thread_context_usage returns context usage from latest turn of active provider thread", () =>
  Effect.gen(function* () {
    const threadId = ThreadId.make("thread-1");
    const projectId = ProjectId.make("project-1");
    const providerInstanceId = ProviderInstanceId.make("claudeAgent");
    const providerThreadId = ProviderThreadId.make("provider-thread-1");

    const caller = {
      id: threadId,
      projectId,
      providerInstanceId,
      modelSelection: { instanceId: providerInstanceId, model: "claude-3-7-sonnet" },
      runtimeMode: "full-access",
      interactionMode: "default",
      activeRunId: "run-1",
      archivedAt: null,
      deletedAt: null,
    } as OrchestrationV2ThreadShell;

    const layerDependencies = Layer.mergeAll(
      NodeCrypto.layer,
      NodeServices.layer,
      Layer.succeed(McpInvocationContext.McpInvocationContext, {
        environmentId: EnvironmentId.make("environment-1"),
        requestNamespace: "session-1",
        thread: {
          threadId,
          providerSessionId: "session-1",
          providerInstanceId,
        },
        client: undefined,
        issuedAt: 0,
        capabilities: new Set(["orchestration" as const]),
      }),
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: () => Effect.succeed(caller),
        getProjectThreadRecords: () =>
          Effect.succeed({
            thread: {
              id: threadId,
              projectId,
              activeProviderThreadId: providerThreadId,
            },
            providerThreads: [
              {
                id: providerThreadId,
                driver: "claude",
                providerInstanceId,
                status: "active",
              },
            ],
            providerTurns: [
              {
                id: ProviderTurnId.make("turn-1"),
                providerThreadId,
                ordinal: 1,
                tokenUsage: {
                  usedTokens: 1000,
                  maxTokens: 10000,
                  inputTokens: 800,
                  cachedInputTokens: 200,
                  outputTokens: 200,
                  reasoningOutputTokens: 50,
                  updatedAt: "2026-10-14T01:00:00.000Z",
                },
              },
              {
                id: ProviderTurnId.make("turn-2"),
                providerThreadId,
                ordinal: 2,
                tokenUsage: {
                  usedTokens: 2500,
                  maxTokens: 10000,
                  inputTokens: 2000,
                  cachedInputTokens: 500,
                  outputTokens: 500,
                  reasoningOutputTokens: 100,
                  updatedAt: "2026-10-14T01:05:00.000Z",
                },
              },
            ],
          } as never),
      }),
      Layer.mock(ThreadSearch.ThreadSearch)({}),
      Layer.mock(ScheduledTasks.ScheduledTaskService)({}),
    );

    const toolkit = yield* ThreadToolkit.pipe(
      Effect.provide(
        McpToolAccess.HandlersLayer.layer(ThreadHandlers.layer).pipe(
          Layer.provide(layerDependencies),
        ),
      ),
    );

    const result = yield* toolkit
      .handle("t3_thread_context_usage", {})
      .pipe(Stream.unwrap, Stream.runCollect, Effect.provide(layerDependencies));

    expect(result.at(-1)?.result).toEqual({
      threadId,
      usedTokens: 2500,
      maxTokens: 10000,
      remainingTokens: 7500,
      usedPercent: 25,
      remainingPercent: 75,
      inputTokens: 2000,
      cachedInputTokens: 500,
      outputTokens: 500,
      reasoningOutputTokens: 100,
      updatedAt: "2026-10-14T01:05:00.000Z",
    });
  }),
);

it.effect("t3_thread_context_usage returns defaults when token usage is not yet recorded", () =>
  Effect.gen(function* () {
    const threadId = ThreadId.make("thread-2");
    const projectId = ProjectId.make("project-1");
    const providerInstanceId = ProviderInstanceId.make("claudeAgent");

    const caller = {
      id: threadId,
      projectId,
      providerInstanceId,
      modelSelection: { instanceId: providerInstanceId, model: "claude-3-7-sonnet" },
      runtimeMode: "full-access",
      interactionMode: "default",
      activeRunId: "run-2",
      archivedAt: null,
      deletedAt: null,
    } as OrchestrationV2ThreadShell;

    const layerDependencies = Layer.mergeAll(
      NodeCrypto.layer,
      NodeServices.layer,
      Layer.succeed(McpInvocationContext.McpInvocationContext, {
        environmentId: EnvironmentId.make("environment-1"),
        requestNamespace: "session-2",
        thread: {
          threadId,
          providerSessionId: "session-2",
          providerInstanceId,
        },
        client: undefined,
        issuedAt: 0,
        capabilities: new Set(["orchestration" as const]),
      }),
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: () => Effect.succeed(caller),
        getProjectThreadRecords: () =>
          Effect.succeed({
            thread: {
              id: threadId,
              projectId,
              activeProviderThreadId: null,
            },
            providerThreads: [],
            providerTurns: [],
          } as never),
      }),
      Layer.mock(ThreadSearch.ThreadSearch)({}),
      Layer.mock(ScheduledTasks.ScheduledTaskService)({}),
    );

    const toolkit = yield* ThreadToolkit.pipe(
      Effect.provide(
        McpToolAccess.HandlersLayer.layer(ThreadHandlers.layer).pipe(
          Layer.provide(layerDependencies),
        ),
      ),
    );

    const result = yield* toolkit
      .handle("t3_thread_context_usage", { threadId })
      .pipe(Stream.unwrap, Stream.runCollect, Effect.provide(layerDependencies));

    expect(result.at(-1)?.result).toEqual({
      threadId,
      usedTokens: 0,
      maxTokens: null,
      remainingTokens: null,
      usedPercent: null,
      remainingPercent: null,
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      reasoningOutputTokens: null,
      updatedAt: null,
    });
  }),
);
