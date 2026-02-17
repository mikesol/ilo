# Slack Plugin Typed Params Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `Record<string, unknown>` in the slack plugin's user-facing `SlackMethods` interface with real `@slack/web-api` argument and response types.

**Architecture:** Import argument/response types directly from `@slack/web-api`. Use an `Exprify<T>` utility type (same pattern as plugin-fal) to allow mixed `Expr`/plain values in params. Strip `token` via `Omit` since MVFM manages tokens via `SlackConfig`.

**Tech Stack:** TypeScript, `@slack/web-api` v7.14.1 (already a dev dependency), `@mvfm/core`

---

### Task 1: Add Exprify utility and import @slack/web-api types in types.ts

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/types.ts`

**Step 1: Add the Exprify utility type and SlackParams helper**

Replace the entire contents of `types.ts` with the typed version. The file should look like:

```typescript
import type { Expr } from "@mvfm/core";
import type {
  ChatDeleteArguments,
  ChatGetPermalinkArguments,
  ChatPostEphemeralArguments,
  ChatPostMessageArguments,
  ChatScheduleMessageArguments,
  ChatUpdateArguments,
  ConversationsCreateArguments,
  ConversationsHistoryArguments,
  ConversationsInfoArguments,
  ConversationsInviteArguments,
  ConversationsListArguments,
  ConversationsMembersArguments,
  ConversationsOpenArguments,
  ConversationsRepliesArguments,
  FilesDeleteArguments,
  FilesInfoArguments,
  FilesListArguments,
  ReactionsAddArguments,
  ReactionsGetArguments,
  ReactionsListArguments,
  ReactionsRemoveArguments,
  UsersConversationsArguments,
  UsersInfoArguments,
  UsersListArguments,
  UsersLookupByEmailArguments,
} from "@slack/web-api";
import type {
  ChatDeleteResponse,
  ChatGetPermalinkResponse,
  ChatPostEphemeralResponse,
  ChatPostMessageResponse,
  ChatScheduleMessageResponse,
  ChatUpdateResponse,
  ConversationsCreateResponse,
  ConversationsHistoryResponse,
  ConversationsInfoResponse,
  ConversationsInviteResponse,
  ConversationsListResponse,
  ConversationsMembersResponse,
  ConversationsOpenResponse,
  ConversationsRepliesResponse,
  FilesDeleteResponse,
  FilesInfoResponse,
  FilesListResponse,
  ReactionsAddResponse,
  ReactionsGetResponse,
  ReactionsListResponse,
  ReactionsRemoveResponse,
  UsersConversationsResponse,
  UsersInfoResponse,
  UsersListResponse,
  UsersLookupByEmailResponse,
} from "@slack/web-api";

// ---- Expr-lifting utility -----------------------------------

type Primitive = string | number | boolean | null | undefined;

/**
 * Recursively maps T so each field accepts either the plain value
 * or an Expr-wrapped value. Allows mixed plain/Expr param objects.
 *
 * Matches the pattern used by plugin-fal.
 */
type Exprify<T> = T extends Primitive
  ? T | Expr<T>
  : T extends Array<infer U>
    ? Array<Exprify<U>> | Expr<T>
    : T extends object
      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>
      : T | Expr<T>;

/**
 * Strip `token` (MVFM manages tokens via SlackConfig) and apply
 * Exprify so each field accepts plain or Expr values.
 */
type SlackParams<T> = Exprify<Omit<T, "token">>;

// ---- SlackMethods -------------------------------------------

/**
 * Slack operations added to the DSL context by the slack plugin.
 *
 * Mirrors the `@slack/web-api` SDK resource API: chat, conversations,
 * users, reactions, and files. Each resource group exposes methods
 * that produce namespaced AST nodes.
 */
export interface SlackMethods {
  /** Slack API operations, namespaced under `$.slack`. */
  slack: {
    /** Chat messaging operations. */
    chat: {
      postMessage(params: SlackParams<ChatPostMessageArguments>): Expr<ChatPostMessageResponse>;
      update(params: SlackParams<ChatUpdateArguments>): Expr<ChatUpdateResponse>;
      delete(params: SlackParams<ChatDeleteArguments>): Expr<ChatDeleteResponse>;
      postEphemeral(
        params: SlackParams<ChatPostEphemeralArguments>,
      ): Expr<ChatPostEphemeralResponse>;
      scheduleMessage(
        params: SlackParams<ChatScheduleMessageArguments>,
      ): Expr<ChatScheduleMessageResponse>;
      getPermalink(
        params: SlackParams<ChatGetPermalinkArguments>,
      ): Expr<ChatGetPermalinkResponse>;
    };
    /** Conversation (channel/DM/group) operations. */
    conversations: {
      list(params?: SlackParams<ConversationsListArguments>): Expr<ConversationsListResponse>;
      info(params: SlackParams<ConversationsInfoArguments>): Expr<ConversationsInfoResponse>;
      create(
        params: SlackParams<ConversationsCreateArguments>,
      ): Expr<ConversationsCreateResponse>;
      invite(
        params: SlackParams<ConversationsInviteArguments>,
      ): Expr<ConversationsInviteResponse>;
      history(
        params: SlackParams<ConversationsHistoryArguments>,
      ): Expr<ConversationsHistoryResponse>;
      members(
        params: SlackParams<ConversationsMembersArguments>,
      ): Expr<ConversationsMembersResponse>;
      open(params: SlackParams<ConversationsOpenArguments>): Expr<ConversationsOpenResponse>;
      replies(
        params: SlackParams<ConversationsRepliesArguments>,
      ): Expr<ConversationsRepliesResponse>;
    };
    /** User operations. */
    users: {
      info(params: SlackParams<UsersInfoArguments>): Expr<UsersInfoResponse>;
      list(params?: SlackParams<UsersListArguments>): Expr<UsersListResponse>;
      lookupByEmail(
        params: SlackParams<UsersLookupByEmailArguments>,
      ): Expr<UsersLookupByEmailResponse>;
      conversations(
        params: SlackParams<UsersConversationsArguments>,
      ): Expr<UsersConversationsResponse>;
    };
    /** Emoji reaction operations. */
    reactions: {
      add(params: SlackParams<ReactionsAddArguments>): Expr<ReactionsAddResponse>;
      get(params: SlackParams<ReactionsGetArguments>): Expr<ReactionsGetResponse>;
      list(params?: SlackParams<ReactionsListArguments>): Expr<ReactionsListResponse>;
      remove(params: SlackParams<ReactionsRemoveArguments>): Expr<ReactionsRemoveResponse>;
    };
    /** File operations. */
    files: {
      list(params?: SlackParams<FilesListArguments>): Expr<FilesListResponse>;
      info(params: SlackParams<FilesInfoArguments>): Expr<FilesInfoResponse>;
      delete(params: SlackParams<FilesDeleteArguments>): Expr<FilesDeleteResponse>;
    };
  };
}

/**
 * Configuration for the slack plugin.
 *
 * Requires a bot or user token (`xoxb-...` or `xoxp-...`).
 */
export interface SlackConfig {
  /** Slack bot or user token (e.g. `xoxb-...` or `xoxp-...`). */
  token: string;
}
```

**Step 2: Run build to verify types compile**

Run: `cd packages/plugin-slack && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add packages/plugin-slack/src/7.14.0/types.ts
git commit -m "feat(plugin-slack): replace Record<string, unknown> with @slack/web-api types"
```

### Task 2: Update build-methods.ts to accept typed params

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/build-methods.ts`

**Step 1: Make resolveParams accept any value**

In `build-methods.ts`, change `resolveParams` to accept `unknown` since params are now typed at the interface level. The function's job is just to lift values into AST nodes.

Change line 5 from:
```typescript
  const resolveParams = (params: Expr<Record<string, unknown>> | Record<string, unknown>) =>
```
to:
```typescript
  const resolveParams = (params: unknown) =>
```

Also update the return type of `buildSlackMethods` — it still returns `SlackMethods`, so TypeScript will verify the implementation matches the new interface.

**Step 2: Run build to verify**

Run: `cd packages/plugin-slack && npx tsc --noEmit`
Expected: PASS

**Step 3: Run tests**

Run: `npm test -- --filter plugin-slack`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/plugin-slack/src/7.14.0/build-methods.ts
git commit -m "refactor(plugin-slack): accept unknown in resolveParams for typed params"
```

### Task 3: Run full validation

**Files:** None (validation only)

**Step 1: Run full build**

Run: `npm run build`
Expected: PASS

**Step 2: Run linter**

Run: `npm run check`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Final commit if any fixups needed**

If any fixes were needed, commit them individually with descriptive messages.
