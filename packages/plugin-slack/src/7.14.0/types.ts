import type { Expr } from "@mvfm/core";
import type {
  // Chat
  ChatPostMessageArguments,
  ChatUpdateArguments,
  ChatDeleteArguments,
  ChatPostEphemeralArguments,
  ChatScheduleMessageArguments,
  ChatGetPermalinkArguments,
  ChatPostMessageResponse,
  ChatUpdateResponse,
  ChatDeleteResponse,
  ChatPostEphemeralResponse,
  ChatScheduleMessageResponse,
  ChatGetPermalinkResponse,
  // Conversations
  ConversationsListArguments,
  ConversationsInfoArguments,
  ConversationsCreateArguments,
  ConversationsInviteArguments,
  ConversationsHistoryArguments,
  ConversationsMembersArguments,
  ConversationsOpenArguments,
  ConversationsRepliesArguments,
  ConversationsListResponse,
  ConversationsInfoResponse,
  ConversationsCreateResponse,
  ConversationsInviteResponse,
  ConversationsHistoryResponse,
  ConversationsMembersResponse,
  ConversationsOpenResponse,
  ConversationsRepliesResponse,
  // Users
  UsersInfoArguments,
  UsersListArguments,
  UsersLookupByEmailArguments,
  UsersConversationsArguments,
  UsersInfoResponse,
  UsersListResponse,
  UsersLookupByEmailResponse,
  UsersConversationsResponse,
  // Reactions
  ReactionsAddArguments,
  ReactionsGetArguments,
  ReactionsListArguments,
  ReactionsRemoveArguments,
  ReactionsAddResponse,
  ReactionsGetResponse,
  ReactionsListResponse,
  ReactionsRemoveResponse,
  // Files
  FilesListArguments,
  FilesInfoArguments,
  FilesDeleteArguments,
  FilesListResponse,
  FilesInfoResponse,
  FilesDeleteResponse,
} from "@slack/web-api";

type Primitive = string | number | boolean | null | undefined;

type Exprify<T> = T extends Primitive
  ? T | Expr<T>
  : T extends Array<infer U>
    ? Array<Exprify<U>> | Expr<T>
    : T extends object
      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>
      : T | Expr<T>;

type SlackParams<T> = Exprify<Omit<T, "token">>;

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
      create(params: SlackParams<ConversationsCreateArguments>): Expr<ConversationsCreateResponse>;
      invite(params: SlackParams<ConversationsInviteArguments>): Expr<ConversationsInviteResponse>;
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
