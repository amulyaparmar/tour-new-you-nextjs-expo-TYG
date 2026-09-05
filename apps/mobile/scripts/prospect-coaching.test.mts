import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
type NativeNode = { type: string; props: Record<string, any> };
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const cardSource = readFileSync(new URL("../src/components/session/prospect-insights-card.tsx", import.meta.url), "utf8");
const sharedSource = readFileSync(new URL("../../../packages/shared/src/session.ts", import.meta.url), "utf8");
const shared: Record<string, any> = {};
runInNewContext(compile(sharedSource), { exports: shared });
const participantSource = readFileSync(new URL("../../../packages/shared/src/speaker-labels.ts", import.meta.url), "utf8");
runInNewContext(compile(participantSource), { exports: shared });

function flatten(node: any): NativeNode[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}

function textLeaves(value: any): string[] {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textLeaves);
  if (!value || typeof value !== "object") return [];
  return textLeaves(value.props?.children);
}

// Run the actual card and the actual shared normalization implementation. Child
// native components become inspectable nodes, not screenshot approximations.
function renderCard(props: Record<string, any> = {}) {
  const jsx = (type: string | ((props: any) => any), props: Record<string, any>): NativeNode =>
    typeof type === "function" ? type(props) : { type, props };
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {},
    "react-native": { View: "View", StyleSheet: { create: (styles: any) => styles } },
    "@tour/shared": shared,
    "lucide-react-native": {
      ArrowUpRight: "ArrowUpRight", CircleAlert: "CircleAlert", HeartHandshake: "HeartHandshake", Target: "Target",
    },
    "@/components/custom-text": { CustomText: "Text" },
    "@/components/ui/icon": { Icon: "Icon" },
    "@/theme/tokens": { ACCENT: "blue", BACKGROUND: "gray", CARD: "white", SMALL_CORNER: 16 },
    "@/theme/tour-brand": { tourColors: { textSec: "gray", amberBg: "amber" } },
  };
  const module = { exports: {} as any };
  runInNewContext(compile(cardSource), {
    exports: module.exports,
    require: (name: string) => {
      assert.ok(name in mocks, `Unexpected card dependency: ${name}`);
      return mocks[name];
    },
  });
  const root = module.exports.ProspectInsightsCard({ analysis: null, ...props });
  return { root, nodes: flatten(root), text: textLeaves(root).join("\n") };
}

test("prospect card accepts null and sparse analysis without inventing information", () => {
  for (const analysis of [null, undefined, {}, { prospectInsights: null }, { prospectInsights: {} }]) {
    const card = renderCard({ analysis });
    assert.ok(card.root);
    assert.match(card.text, /prospect/i);
    assert.doesNotMatch(card.text, /undefined|\[object Object\]/);
  }
});

test("provided interests remain visible before analysis exists", () => {
  const card = renderCard({ providedInterests: [{ id: "pets", category: "pets", detail: "Two indoor cats" }] });
  assert.match(card.text, /Two indoor cats/);
  assert.match(card.text, /Provided before the session/);
});

test("concerns-only and intent-only insights are not mistaken for an empty prospect", () => {
  const concerns = renderCard({ analysis: { prospectInsights: { objections: ["Needs a quieter bedroom"] } } });
  assert.match(concerns.text, /Open concerns/);
  assert.match(concerns.text, /Needs a quieter bedroom/);
  const intent = renderCard({ analysis: { prospectInsights: { intentStage: "considering" } } });
  assert.match(intent.text, /considering/);
  const rationale = renderCard({ analysis: { prospectInsights: { intentRationale: "Comparing two floor plans" } } });
  assert.match(rationale.text, /Comparing two floor plans/);
});

test("needs retain source, evidence, response, coverage and conversion guidance", () => {
  const card = renderCard({ analysis: { prospectInsights: {
    summary: "Needs room to work from home",
    intentStage: "ready",
    intentRationale: "Asked how to submit an application",
    interests: [{
      category: "floor_plan", detail: "A separate office", importance: "high", source: "stated",
      evidence: "I need a door I can close for meetings", timestamp: "02:14",
      agentResponse: "Showed the two-bedroom layout", coverage: "addressed",
    }],
    conversionDrivers: ["Quiet workspace"], objections: ["Concerned about noise"],
    nextBestAction: "Send availability for the two-bedroom plan",
  } } });
  for (const expected of [
    "Needs room to work from home", "Asked how to submit an application", "A separate office",
    "I need a door I can close for meetings", "02:14", "Showed the two-bedroom layout", "Addressed",
    "Quiet workspace", "Concerned about noise", "Send availability for the two-bedroom plan",
  ]) assert.ok(card.text.includes(expected), `Missing prospect context: ${expected}`);
  assert.match(card.text, /From conversation/);
});

test("multiple checked-in guests retain their own contact details and context", () => {
  const leads = [
    {
      name: "Alex Morgan", email: "alex@example.test", phone: "1112223333", createdAt: "first",
      reason: "Find a larger apartment", notes: "Works from home",
      questionAnswers: { move_in: "September", floor_plan: "Two bedrooms" },
    },
    {
      name: "Jordan Lee", email: "jordan@example.test", phone: "4445556666", createdAt: "second",
      reason: "Shorter commute", notes: "Needs parking",
      questionAnswers: { move_in: "October", floor_plan: "One bedroom" },
    },
  ];
  const card = renderCard({ prospectName: "Alex Morgan", leads });
  for (const [own, other] of [[leads[0], leads[1]], [leads[1], leads[0]]]) {
    const candidates = card.nodes.filter((node) => {
      const text = textLeaves(node).join("\n");
      return text.includes(own.name) && text.includes(own.email) && text.includes(own.phone);
    });
    assert.ok(candidates.length, `Missing named contact row for ${own.name}`);
    const ownRow = candidates.sort((a, b) => textLeaves(a).join("").length - textLeaves(b).join("").length)[0];
    const rowText = textLeaves(ownRow).join("\n");
    assert.doesNotMatch(rowText, new RegExp(other.email.replaceAll(".", "\\.")));
    assert.ok(rowText.includes(own.reason));
    assert.ok(rowText.includes(own.notes));
    assert.ok(rowText.includes(own.questionAnswers.move_in));
    assert.ok(rowText.includes(own.questionAnswers.floor_plan));
  }
});

test("prospect name alone is visible without borrowing another guest's identity", () => {
  const card = renderCard({ prospectName: "Taylor" });
  assert.match(card.text, /Taylor/);
  assert.doesNotMatch(card.text, /undefined|null/);
});

test("malformed insight collections and unknown coverage are normalized safely", () => {
  for (const prospectInsights of ["broken", null, { interests: "broken", objections: 42 }, {
    interests: [null, 17, {}, { detail: "A quiet unit", category: "invalid", coverage: "invalid", source: "invalid" }],
  }]) {
    const card = renderCard({ analysis: { prospectInsights } });
    assert.ok(card.root);
    assert.doesNotMatch(card.text, /undefined/);
    if (typeof prospectInsights === "object" && Array.isArray(prospectInsights?.interests)) {
      assert.match(card.text, /A quiet unit/);
      assert.match(card.text, /Not discussed/);
    }
  }
});

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const appAst = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const coachingDeclarations: string[] = [];
for (const node of appAst.statements) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "SessionCoachingScreen") coachingDeclarations.push(node.getText(appAst));
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some((item: any) => item.name.getText(appAst) === "EMPTY_COACHING_ACTIONS")) {
    coachingDeclarations.push(node.getText(appAst));
  }
}
assert.equal(coachingDeclarations.length, 2, "Extract actual Coaching and its stable empty action list");
const coachingCompiled = compile(`${coachingDeclarations.join("\n")}\nexports.SessionCoachingScreen = SessionCoachingScreen;`);
type QueryName = "sample" | "actions" | "session" | "analysis";
type QueryState = { data?: any; isLoading: boolean; error: any; refetch: () => Promise<any> };
type StateHook = { value?: any; deps?: any[]; cleanup?: () => void };

function createCoaching(options: {
  props?: Record<string, any>;
  queries?: Partial<Record<QueryName, Partial<QueryState>>>;
  deferredRefresh?: boolean;
} = {}) {
  const hooks: StateHook[] = [];
  const effects: (() => void)[] = [];
  const queryCalls: { name: QueryName; sessionId: string; enabled: boolean }[] = [];
  const refetches: QueryName[] = [];
  const pendingRefresh: (() => void)[] = [];
  const queries = {} as Record<QueryName, QueryState>;
  for (const name of ["sample", "actions", "session", "analysis"] as const) {
    queries[name] = {
      isLoading: false, error: null,
      refetch: () => {
        refetches.push(name);
        if (options.deferredRefresh) return new Promise((resolve) => pendingRefresh.push(() => resolve({ data: queries[name].data })));
        return Promise.resolve({ data: queries[name].data });
      },
      ...options.queries?.[name],
    };
  }
  let props = { sessionId: "tour-one", onBack: () => {}, ...options.props };
  let cursor = 0;
  let dirty = false;
  let root: NativeNode;
  function slot() { return hooks[cursor++] ?? (hooks[cursor - 1] = {}); }
  function equalDeps(left?: any[], right?: any[]) {
    return Boolean(left && right && left.length === right.length
      && left.every((value, index) => Object.is(value, right[index])));
  }
  const jsx = (type: string, props: Record<string, any>): NativeNode => ({ type, props });
  const queryHook = (name: QueryName) => (sessionId: string, enabled = true) => {
    queryCalls.push({ name, sessionId, enabled });
    return queries[name];
  };
  const exports: Record<string, any> = {};
  runInNewContext(coachingCompiled, {
    exports, Error,
    require: (name: string) => {
      assert.equal(name, "react/jsx-runtime");
      return { jsx, jsxs: jsx };
    },
    useState: (initialValue: any) => {
      const hook = slot();
      if (!("value" in hook)) hook.value = typeof initialValue === "function" ? initialValue() : initialValue;
      return [hook.value, (next: any) => {
        const value = typeof next === "function" ? next(hook.value) : next;
        if (!Object.is(value, hook.value)) { hook.value = value; dirty = true; }
      }];
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const hook = slot();
      if (equalDeps(hook.deps, deps)) return;
      hook.deps = deps;
      effects.push(() => { hook.cleanup?.(); hook.cleanup = effect(); });
    },
    useCallback: (callback: any, deps: any[]) => {
      const hook = slot();
      if (!equalDeps(hook.deps, deps)) { hook.value = callback; hook.deps = deps; }
      return hook.value;
    },
    useSampleSessionQuery: queryHook("sample"), useActionsQuery: queryHook("actions"),
    useSessionQuery: queryHook("session"), useAnalysisQuery: queryHook("analysis"),
    useSafeAreaInsets: () => ({ top: 47, bottom: 34 }),
    View: "View", ScrollView: "ScrollView", RefreshControl: "RefreshControl",
    ErrorBanner: "ErrorBanner", LoadingBox: "LoadingBox", ActionsTab: "ActionsTab",
    ProspectInsightsCard: "ProspectInsightsCard", CustomText: "Text", TourScreenHeader: "TourScreenHeader",
    reviewSt: { root: {}, commentsPageContent: {} }, ACCENT: "blue",
    PAGE_SHEET_HEADER_INSET: 20, glassNavContentInset: (top: number) => top + 70,
  });
  function render(propsPatch: Record<string, any> = {}) {
    props = { ...props, ...propsPatch };
    let passes = 0;
    do {
      assert.ok(++passes < 12, "Coaching must not rerender forever when query data is missing");
      dirty = false;
      cursor = 0;
      root = exports.SessionCoachingScreen(props);
      while (effects.length) effects.shift()!();
    } while (dirty);
    return root;
  }
  render();
  return {
    queries, queryCalls, refetches, render,
    get root() { return root; },
    get nodes() { return flatten(root); },
    find(type: string) { return flatten(root).find((node) => node.type === type); },
    get refreshControl() { return flatten(root).find((node) => node.type === "ScrollView")!.props.refreshControl.props; },
    resolveRefresh: () => { while (pendingRefresh.length) pendingRefresh.shift()!(); },
  };
}

const liveSession = {
  prospectName: "Alex Morgan",
  leads: [{ name: "Alex Morgan", email: "alex@example.test", phone: "1112223333" }],
  customerInterests: [{ id: "quiet", category: "other", detail: "Quiet unit" }],
};
const liveAnalysis = { prospectInsights: { summary: "Needs quiet working space" } };
const liveActions = [{ id: "action-one", title: "Send available floor plans" }];

function loadedQueries() {
  return {
    session: { data: { session: liveSession } }, analysis: { data: { analysis: liveAnalysis } },
    actions: { data: { actions: liveActions } },
  };
}

test("live Coaching loads prospect detail and analysis, displaying the card above actions", () => {
  const ui = createCoaching({ queries: loadedQueries() });
  const prospect = ui.find("ProspectInsightsCard")!;
  assert.ok(prospect);
  assert.equal(prospect.props.analysis, liveAnalysis);
  assert.equal(prospect.props.prospectName, liveSession.prospectName);
  assert.equal(prospect.props.leads, liveSession.leads);
  assert.equal(prospect.props.providedInterests, liveSession.customerInterests);
  const actions = ui.find("ActionsTab")!;
  assert.equal(actions.props.actions, liveActions);
  assert.equal(actions.props.readOnly, false);
  assert.ok(ui.nodes.indexOf(prospect) < ui.nodes.indexOf(actions));
  for (const name of ["session", "analysis", "actions", "sample"] as const) {
    const call = ui.queryCalls.filter((call) => call.name === name).at(-1)!;
    assert.equal(call.enabled, name !== "sample", name);
    assert.equal(call.sessionId, "tour-one");
  }
});

test("sample Coaching exclusively uses the sample bundle and read-only actions", async () => {
  const sampleSession = { prospectName: "Sample guest", leads: [], customerInterests: [] };
  const sampleAnalysis = { prospectInsights: { summary: "Sample insights" } };
  const sampleActions = [{ id: "sample-action", title: "Sample follow-up" }];
  const ui = createCoaching({
    props: { sample: true },
    queries: { ...loadedQueries(), sample: { data: { session: sampleSession, analysis: sampleAnalysis, actions: sampleActions } } },
  });
  assert.equal(ui.find("ProspectInsightsCard")!.props.analysis, sampleAnalysis);
  assert.equal(ui.find("ProspectInsightsCard")!.props.prospectName, "Sample guest");
  assert.equal(ui.find("ActionsTab")!.props.actions, sampleActions);
  assert.equal(ui.find("ActionsTab")!.props.readOnly, true);
  for (const name of ["session", "analysis", "actions", "sample"] as const) {
    assert.equal(ui.queryCalls.filter((call) => call.name === name).at(-1)!.enabled, name === "sample", name);
  }
  await ui.find("ActionsTab")!.props.onUpdate();
  assert.deepEqual(ui.refetches, ["sample"]);
});

test("failed sample loading never falls back to cached live prospect data or actions", async () => {
  const ui = createCoaching({
    props: { sample: true },
    queries: { ...loadedQueries(), sample: { error: new Error("Sample unavailable") } },
  });
  assert.equal(ui.find("ProspectInsightsCard"), undefined);
  assert.equal(ui.find("ErrorBanner")!.props.message, "Sample unavailable");
  assert.equal(ui.find("ActionsTab")!.props.actions.length, 0);
  assert.equal(ui.find("ActionsTab")!.props.readOnly, true);
  await ui.find("ErrorBanner")!.props.onRetry();
  assert.deepEqual(ui.refetches, ["sample"]);
});

test("actions loading or failure cannot hide available prospect information", () => {
  for (const actions of [
    { data: undefined, isLoading: true },
    { data: undefined, error: new Error("Actions unavailable") },
  ]) {
    const ui = createCoaching({ queries: { ...loadedQueries(), actions } });
    assert.equal(ui.find("ProspectInsightsCard")!.props.analysis, liveAnalysis);
    if (actions.isLoading) assert.ok(ui.find("LoadingBox"));
    else assert.equal(ui.find("ErrorBanner")!.props.message, "Actions unavailable");
  }
});

test("prospect loading or failure cannot hide loaded follow-up actions", () => {
  for (const prospect of [
    { data: undefined, isLoading: true },
    { data: undefined, error: new Error("Prospect unavailable") },
  ]) {
    const ui = createCoaching({ queries: { actions: { data: { actions: liveActions } }, session: prospect, analysis: prospect } });
    assert.equal(ui.find("ActionsTab")!.props.actions, liveActions);
    assert.equal(ui.find("ProspectInsightsCard"), undefined);
    if (prospect.isLoading) assert.ok(ui.find("LoadingBox"));
    else assert.equal(ui.find("ErrorBanner")!.props.message, "Prospect unavailable");
  }
});

test("contact or cached analysis data remains available when the other prospect query fails", () => {
  const contacts = createCoaching({ queries: {
    ...loadedQueries(), analysis: { data: undefined, error: new Error("Analysis unavailable") },
  } });
  assert.equal(contacts.find("ProspectInsightsCard")!.props.analysis, null);
  assert.equal(contacts.find("ProspectInsightsCard")!.props.leads, liveSession.leads);
  const insights = createCoaching({ queries: {
    ...loadedQueries(), session: { data: undefined, error: new Error("Contacts unavailable") },
  } });
  assert.equal(insights.find("ProspectInsightsCard")!.props.analysis, liveAnalysis);
  assert.equal(insights.find("ActionsTab")!.props.actions, liveActions);
});

test("available contacts are shown while analysis is still loading", () => {
  const ui = createCoaching({ queries: {
    ...loadedQueries(), analysis: { data: undefined, isLoading: true },
  } });
  const prospect = ui.find("ProspectInsightsCard")!;
  assert.ok(prospect);
  assert.equal(prospect.props.analysis, null);
  assert.equal(prospect.props.leads, liveSession.leads);
  assert.equal(ui.find("ActionsTab")!.props.actions, liveActions);
});

test("missing query data settles without a render loop and keeps Coaching sections usable", () => {
  const ui = createCoaching();
  assert.ok(ui.find("ProspectInsightsCard"));
  assert.ok(ui.find("ActionsTab"));
  assert.equal(ui.find("ActionsTab")!.props.actions.length, 0);
  assert.equal(ui.find("ProspectInsightsCard")!.props.analysis, null);
});

test("live refresh starts actions, detail and analysis concurrently", async () => {
  const ui = createCoaching({ queries: loadedQueries(), deferredRefresh: true });
  const refreshed = ui.find("ActionsTab")!.props.onUpdate();
  assert.deepEqual(ui.refetches, ["actions", "session", "analysis"]);
  ui.resolveRefresh();
  await refreshed;
});

test("pull-to-refresh refreshes the prospect card along with actions", async () => {
  const ui = createCoaching({ queries: loadedQueries(), deferredRefresh: true });
  ui.refreshControl.onRefresh();
  ui.render();
  assert.equal(ui.refreshControl.refreshing, true);
  assert.deepEqual(ui.refetches, ["actions", "session", "analysis"]);
  ui.resolveRefresh();
  for (let count = 0; count < 5; count++) await Promise.resolve();
  ui.render();
  assert.equal(ui.refreshControl.refreshing, false);
});

test("sheet Coaching embeds prospect content without adding another page header", () => {
  const ui = createCoaching({ props: { presentation: "sheet" }, queries: loadedQueries() });
  assert.ok(ui.find("ProspectInsightsCard"));
  assert.ok(ui.find("ActionsTab"));
  assert.equal(ui.find("TourScreenHeader"), undefined);
});

test("useSessionQuery remains enabled by default and accepts explicit sample disabling", async () => {
  const source = readFileSync(new URL("../src/queries.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("queries.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements.find((node: any) => ts.isFunctionDeclaration(node) && node.name?.text === "useSessionQuery");
  assert.ok(declaration);
  const configs: any[] = [];
  const fetches: string[] = [];
  const exports: Record<string, any> = {};
  runInNewContext(compile(declaration.getText(ast)), {
    exports,
    useQuery: (config: any) => { configs.push(config); return config; },
    queryKeys: { session: (id: string) => ["session", id] },
    fetchSession: async (id: string) => { fetches.push(id); return { session: null }; },
  });
  exports.useSessionQuery("live-tour");
  exports.useSessionQuery("sample-tour", false);
  assert.equal(configs[0].enabled, true);
  assert.equal(configs[1].enabled, false);
  await configs[0].queryFn();
  assert.deepEqual(fetches, ["live-tour"]);
});
