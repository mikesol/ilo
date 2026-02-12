// ============================================================
// ILO PLUGINS
// ============================================================
//
// Each plugin is a self-contained module that contributes:
//   1. Methods/properties added to $
//   2. AST node kinds it emits
//   3. TypeScript types for $
//
// Plugins are composed via ilo(num, str, db(...), ...)
//
// ============================================================

import type { PluginDefinition, PluginContext, Expr, ASTNode } from "./core";

// ---- num -------------------------------------------------

export interface NumMethods {
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  gt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  gte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  neg(a: Expr<number> | number): Expr<number>;
  abs(a: Expr<number> | number): Expr<number>;
  floor(a: Expr<number> | number): Expr<number>;
  ceil(a: Expr<number> | number): Expr<number>;
  round(a: Expr<number> | number): Expr<number>;
  min(...values: (Expr<number> | number)[]): Expr<number>;
  max(...values: (Expr<number> | number)[]): Expr<number>;
}

export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [
    "num/add", "num/sub", "num/mul", "num/div", "num/mod",
    "num/gt", "num/gte", "num/lt", "num/lte",
    "num/neg", "num/abs", "num/floor", "num/ceil", "num/round",
    "num/min", "num/max",
  ],
  build(ctx: PluginContext): NumMethods {
    const binop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<number>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    const unop = (kind: string) => (a: Expr<number> | number) =>
      ctx.expr<number>({ kind, operand: ctx.lift(a).__node });

    const cmpop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<boolean>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    return {
      add: binop("num/add"),
      sub: binop("num/sub"),
      mul: binop("num/mul"),
      div: binop("num/div"),
      mod: binop("num/mod"),
      gt: cmpop("num/gt"),
      gte: cmpop("num/gte"),
      lt: cmpop("num/lt"),
      lte: cmpop("num/lte"),
      neg: unop("num/neg"),
      abs: unop("num/abs"),
      floor: unop("num/floor"),
      ceil: unop("num/ceil"),
      round: unop("num/round"),
      min: (...values) =>
        ctx.expr<number>({
          kind: "num/min",
          values: values.map((v) => ctx.lift(v).__node),
        }),
      max: (...values) =>
        ctx.expr<number>({
          kind: "num/max",
          values: values.map((v) => ctx.lift(v).__node),
        }),
    };
  },
};

// ---- str -------------------------------------------------

export interface StrMethods {
  /** Tagged template literal: $.str`hello ${name}` */
  str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]): Expr<string>;
  concat(...parts: (Expr<string> | string)[]): Expr<string>;
  upper(s: Expr<string> | string): Expr<string>;
  lower(s: Expr<string> | string): Expr<string>;
  trim(s: Expr<string> | string): Expr<string>;
  slice(s: Expr<string> | string, start: Expr<number> | number, end?: Expr<number> | number): Expr<string>;
  includes(haystack: Expr<string> | string, needle: Expr<string> | string): Expr<boolean>;
  startsWith(s: Expr<string> | string, prefix: Expr<string> | string): Expr<boolean>;
  endsWith(s: Expr<string> | string, suffix: Expr<string> | string): Expr<boolean>;
  split(s: Expr<string> | string, delimiter: Expr<string> | string): Expr<string[]>;
  join(arr: Expr<string[]>, separator: Expr<string> | string): Expr<string>;
  replace(s: Expr<string> | string, search: Expr<string> | string, replacement: Expr<string> | string): Expr<string>;
  len(s: Expr<string> | string): Expr<number>;
}

export const str: PluginDefinition<StrMethods> = {
  name: "str",
  nodeKinds: [
    "str/template", "str/concat", "str/upper", "str/lower",
    "str/trim", "str/slice", "str/includes", "str/startsWith",
    "str/endsWith", "str/split", "str/join", "str/replace", "str/len",
  ],
  build(ctx: PluginContext): StrMethods {
    return {
      str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]) {
        return ctx.expr<string>({
          kind: "str/template",
          strings: Array.from(strings),
          exprs: exprs.map((e) => ctx.lift(e).__node),
        });
      },
      concat(...parts) {
        return ctx.expr<string>({
          kind: "str/concat",
          parts: parts.map((p) => ctx.lift(p).__node),
        });
      },
      upper: (s) => ctx.expr<string>({ kind: "str/upper", operand: ctx.lift(s).__node }),
      lower: (s) => ctx.expr<string>({ kind: "str/lower", operand: ctx.lift(s).__node }),
      trim: (s) => ctx.expr<string>({ kind: "str/trim", operand: ctx.lift(s).__node }),
      slice: (s, start, end) =>
        ctx.expr<string>({
          kind: "str/slice",
          operand: ctx.lift(s).__node,
          start: ctx.lift(start).__node,
          ...(end !== undefined ? { end: ctx.lift(end).__node } : {}),
        }),
      includes: (h, n) =>
        ctx.expr<boolean>({
          kind: "str/includes",
          haystack: ctx.lift(h).__node,
          needle: ctx.lift(n).__node,
        }),
      startsWith: (s, p) =>
        ctx.expr<boolean>({
          kind: "str/startsWith",
          operand: ctx.lift(s).__node,
          prefix: ctx.lift(p).__node,
        }),
      endsWith: (s, su) =>
        ctx.expr<boolean>({
          kind: "str/endsWith",
          operand: ctx.lift(s).__node,
          suffix: ctx.lift(su).__node,
        }),
      split: (s, d) =>
        ctx.expr<string[]>({
          kind: "str/split",
          operand: ctx.lift(s).__node,
          delimiter: ctx.lift(d).__node,
        }),
      join: (arr, sep) =>
        ctx.expr<string>({
          kind: "str/join",
          array: arr.__node,
          separator: ctx.lift(sep).__node,
        }),
      replace: (s, search, replacement) =>
        ctx.expr<string>({
          kind: "str/replace",
          operand: ctx.lift(s).__node,
          search: ctx.lift(search).__node,
          replacement: ctx.lift(replacement).__node,
        }),
      len: (s) => ctx.expr<number>({ kind: "str/len", operand: ctx.lift(s).__node }),
    };
  },
};

// ---- db --------------------------------------------------

export interface DbMethods {
  db: {
    one(sql: string, params?: (Expr<unknown> | unknown)[]): Expr<any>;
    many(sql: string, params?: (Expr<unknown> | unknown)[]): Expr<any>;
    exec(sql: string, params?: (Expr<unknown> | unknown)[]): Expr<any>;
  };
}

export interface DbConfig {
  connectionString?: string;
  schema?: string;
}

export function db(config?: DbConfig | string): PluginDefinition<DbMethods> {
  const resolvedConfig: DbConfig =
    typeof config === "string" ? { connectionString: config } : config ?? {};

  return {
    name: "db",
    nodeKinds: ["db/one", "db/many", "db/exec"],
    build(ctx: PluginContext): DbMethods {
      const makeQuery = (kind: string) =>
        (sql: string, params?: (Expr<unknown> | unknown)[]) =>
          ctx.expr({
            kind,
            sql,
            params: (params ?? []).map((p) =>
              ctx.isExpr(p) ? (p as Expr<unknown>).__node : { kind: "core/literal", value: p }
            ),
            config: resolvedConfig,
          });

      return {
        db: {
          one: makeQuery("db/one"),
          many: makeQuery("db/many"),
          exec: makeQuery("db/exec"),
        },
      };
    },
  };
}

// ---- api -------------------------------------------------

export interface ApiMethods {
  api: {
    get<T = unknown>(url: Expr<string> | string, headers?: Record<string, Expr<string> | string>): Expr<T>;
    post<T = unknown>(url: Expr<string> | string, body: Expr<unknown> | unknown, headers?: Record<string, Expr<string> | string>): Expr<T>;
    put<T = unknown>(url: Expr<string> | string, body: Expr<unknown> | unknown, headers?: Record<string, Expr<string> | string>): Expr<T>;
    delete<T = unknown>(url: Expr<string> | string, headers?: Record<string, Expr<string> | string>): Expr<T>;
  };
}

export const api: PluginDefinition<ApiMethods> = {
  name: "api",
  nodeKinds: ["api/get", "api/post", "api/put", "api/delete"],
  build(ctx: PluginContext): ApiMethods {
    const liftHeaders = (headers?: Record<string, Expr<string> | string>) => {
      if (!headers) return undefined;
      return Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, ctx.lift(v).__node])
      );
    };

    return {
      api: {
        get: (url, headers) =>
          ctx.expr({
            kind: "api/get",
            url: ctx.lift(url).__node,
            headers: liftHeaders(headers),
          }),
        post: (url, body, headers) =>
          ctx.expr({
            kind: "api/post",
            url: ctx.lift(url).__node,
            body: ctx.lift(body).__node,
            headers: liftHeaders(headers),
          }),
        put: (url, body, headers) =>
          ctx.expr({
            kind: "api/put",
            url: ctx.lift(url).__node,
            body: ctx.lift(body).__node,
            headers: liftHeaders(headers),
          }),
        delete: (url, headers) =>
          ctx.expr({
            kind: "api/delete",
            url: ctx.lift(url).__node,
            headers: liftHeaders(headers),
          }),
      },
    };
  },
};

// ---- jwt -------------------------------------------------

export interface JwtMethods {
  jwt: {
    verify(token: Expr<string> | string): Expr<Record<string, unknown>>;
    claims(token: Expr<string> | string): Expr<Record<string, unknown>>;
    hasRole(token: Expr<string> | string, role: Expr<string> | string): Expr<boolean>;
  };
}

export function jwt(config?: { issuer?: string; audience?: string }): PluginDefinition<JwtMethods> {
  return {
    name: "jwt",
    nodeKinds: ["jwt/verify", "jwt/claims", "jwt/hasRole"],
    build(ctx: PluginContext): JwtMethods {
      return {
        jwt: {
          verify: (token) =>
            ctx.expr({
              kind: "jwt/verify",
              token: ctx.lift(token).__node,
              config,
            }),
          claims: (token) =>
            ctx.expr({
              kind: "jwt/claims",
              token: ctx.lift(token).__node,
            }),
          hasRole: (token, role) =>
            ctx.expr<boolean>({
              kind: "jwt/hasRole",
              token: ctx.lift(token).__node,
              role: ctx.lift(role).__node,
            }),
        },
      };
    },
  };
}

// ---- crypto ----------------------------------------------

export interface CryptoMethods {
  hash: {
    sha256(input: Expr<string> | string): Expr<string>;
    sha512(input: Expr<string> | string): Expr<string>;
    hmac(key: Expr<string> | string, data: Expr<string> | string): Expr<string>;
  };
}

export const crypto: PluginDefinition<CryptoMethods> = {
  name: "crypto",
  nodeKinds: ["crypto/sha256", "crypto/sha512", "crypto/hmac"],
  build(ctx: PluginContext): CryptoMethods {
    return {
      hash: {
        sha256: (input) =>
          ctx.expr<string>({ kind: "crypto/sha256", input: ctx.lift(input).__node }),
        sha512: (input) =>
          ctx.expr<string>({ kind: "crypto/sha512", input: ctx.lift(input).__node }),
        hmac: (key, data) =>
          ctx.expr<string>({
            kind: "crypto/hmac",
            key: ctx.lift(key).__node,
            data: ctx.lift(data).__node,
          }),
      },
    };
  },
};

// ---- kv (key-value store, e.g. Redis) --------------------

export interface KvMethods {
  kv: {
    get<T = string>(key: Expr<string> | string): Expr<T | null>;
    set(key: Expr<string> | string, value: Expr<unknown> | unknown, ttl?: Expr<number> | number): Expr<void>;
    del(key: Expr<string> | string): Expr<void>;
    incr(key: Expr<string> | string): Expr<number>;
  };
}

export function kv(config?: { url?: string }): PluginDefinition<KvMethods> {
  return {
    name: "kv",
    nodeKinds: ["kv/get", "kv/set", "kv/del", "kv/incr"],
    build(ctx: PluginContext): KvMethods {
      return {
        kv: {
          get: (key) =>
            ctx.expr({ kind: "kv/get", key: ctx.lift(key).__node, config }),
          set: (key, value, ttl) =>
            ctx.expr({
              kind: "kv/set",
              key: ctx.lift(key).__node,
              value: ctx.lift(value).__node,
              ...(ttl !== undefined ? { ttl: ctx.lift(ttl).__node } : {}),
              config,
            }),
          del: (key) =>
            ctx.expr({ kind: "kv/del", key: ctx.lift(key).__node, config }),
          incr: (key) =>
            ctx.expr<number>({ kind: "kv/incr", key: ctx.lift(key).__node, config }),
        },
      };
    },
  };
}
