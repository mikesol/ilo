import { describe, expect, expectTypeOf, it } from "vitest";
import type { Expr } from "../src";
import { eq, ilo, num, semiring, str } from "../src";

const app = ilo(num, str, semiring);

describe("typed inputs (generic parameter)", () => {
  it("$.input.name resolves to Expr<string> when schema declares name: string", () => {
    app<{ name: string; age: number }>(($) => {
      expectTypeOf($.input.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.age).toEqualTypeOf<Expr<number>>();
      return $.input.name;
    });
  });

  it("$.input.x without a schema declaration is a type error", () => {
    app(($) => {
      // @ts-expect-error — no input schema declared (I=never), property access forbidden
      $.input.x;
      return $.add(1, 2);
    });
  });

  it("$.add($.input.name, 1) is a type error when name: string", () => {
    app<{ name: string }>(($) => {
      // @ts-expect-error — name is Expr<string>, not Expr<number>
      return $.add($.input.name, 1);
    });
  });

  it("nested record access preserves types", () => {
    app<{ user: { name: string; score: number } }>(($) => {
      expectTypeOf($.input.user).toEqualTypeOf<Expr<{ name: string; score: number }>>();
      expectTypeOf($.input.user.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.user.score).toEqualTypeOf<Expr<number>>();
      return $.input.user.name;
    });
  });

  it("Expr<string> is a leaf — no extra properties", () => {
    app<{ name: string }>(($) => {
      // @ts-expect-error — string is a leaf type, no .foo property
      $.input.name.foo;
      return $.input.name;
    });
  });
});

describe("typed inputs (runtime schema)", () => {
  it("$.input.name resolves to Expr<string> with schema", () => {
    app({ name: "string", age: "number" }, ($) => {
      expectTypeOf($.input.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.age).toEqualTypeOf<Expr<number>>();
      return $.input.name;
    });
  });

  it("nested schema preserves types", () => {
    app({ user: { name: "string", score: "number" } }, ($) => {
      expectTypeOf($.input.user.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.user.score).toEqualTypeOf<Expr<number>>();
      return $.input.user.name;
    });
  });

  it("$.add($.input.name, 1) is a type error when name: 'string'", () => {
    expect(() =>
      app({ name: "string" }, ($) => {
        // @ts-expect-error — name is Expr<string>, not Expr<number>
        return $.add($.input.name, 1);
      }),
    ).toThrow();
  });
});

describe("typeclass type safety — negative tests", () => {
  // Skip until eq plugin is converted to use TypeclassSlot (Task 2).
  // The @ts-expect-error directives below require eq to declare
  // TypeclassSlot<"eq"> instead of hardcoded EqMethods overloads.
  it.skip("eq without type plugins is a type error", () => {
    const app = ilo(eq);
    app(($) => {
      // @ts-expect-error — no type plugin provides eq
      $.eq(1, 2);
      // @ts-expect-error — no type plugin provides neq
      $.neq(1, 2);
      return $.input;
    });
  });
});
