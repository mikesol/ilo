/** Builds the injected scope for playground code execution. */
export async function createPlaygroundScope(
  fakeConsole: { log: (...args: unknown[]) => void },
  mockInterpreter?: Record<string, unknown>,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const {
    console: _drop,
    consoleInterpreter: _defaultInterp,
    ...consoleRest
  } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole as any),
  );
  const realDefaults = core.defaults;
  const injected: Record<string, unknown> = {
    ...core,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    consoleInterpreter: fakeConsoleInterpreter,
    defaults: (app: any, ...args: any[]) => {
      const interp = realDefaults(app, ...args);
      Object.assign(interp, fakeConsoleInterpreter);
      if (mockInterpreter) Object.assign(interp, mockInterpreter);
      return interp;
    },
  };
  return {
    paramNames: ["console", ...Object.keys(injected)],
    paramValues: [fakeConsole, ...Object.values(injected)],
  };
}
