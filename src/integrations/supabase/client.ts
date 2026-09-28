/**
 * Supabase cloud disconnected.
 * All CRM auth + website leads go through Python API (Docker).
 * This stub keeps old imports from crashing while returning empty data.
 */

type AnyRec = Record<string, unknown>;

function emptyResult() {
  return Promise.resolve({
    data: null as AnyRec | AnyRec[] | null,
    error: null as { message: string } | null,
    count: 0,
    status: 200,
    statusText: "OK",
  });
}

function queryBuilder(): AnyRec {
  const self: AnyRec = {};
  const chain = (..._args: unknown[]) => self;
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "is",
    "in",
    "contains",
    "containedBy",
    "rangeGt",
    "rangeGte",
    "rangeLt",
    "rangeLte",
    "rangeAdjacent",
    "overlaps",
    "textSearch",
    "match",
    "not",
    "or",
    "filter",
    "order",
    "limit",
    "range",
    "abortSignal",
    "single",
    "maybeSingle",
    "csv",
    "geoNear",
    "returns",
    "throwOnError",
  ];
  for (const m of methods) self[m] = chain;
  self.then = (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
    emptyResult().then(onfulfilled, onrejected);
  return self;
}

export const supabase = {
  from: (_table: string) => queryBuilder(),
  rpc: (_fn: string, _args?: unknown) => queryBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { message: "Supabase removed — use Docker CRM admin login" },
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: "Signup disabled — Docker CRM is admin-only" },
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    resetPasswordForEmail: async () => ({
      data: {},
      error: { message: "Password reset disabled on Docker CRM" },
    }),
    updateUser: async () => ({ data: { user: null }, error: { message: "Disabled" } }),
    exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
    verifyOtp: async () => ({ data: { user: null, session: null }, error: { message: "Disabled" } }),
    resend: async () => ({ data: {}, error: { message: "Disabled" } }),
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: { message: "Storage moved off Supabase" } }),
      download: async () => ({ data: null, error: { message: "Storage moved off Supabase" } }),
      remove: async () => ({ data: null, error: null }),
      list: async () => ({ data: [], error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
      createSignedUrl: async () => ({ data: null, error: { message: "Disabled" } }),
    }),
  },
  functions: {
    invoke: async () => ({ data: null, error: { message: "Edge functions disabled" } }),
  },
  channel: (_name: string) => ({
    on: () => ({ subscribe: () => ({ status: "CLOSED" }) }),
    subscribe: () => ({ status: "CLOSED" }),
    unsubscribe: () => undefined,
  }),
  removeChannel: () => undefined,
};

export type { Database } from "./types";
