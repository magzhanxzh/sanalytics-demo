// ClickHouse warehouse connection (ClickHouse reads PostgreSQL itself through
// a bridge table engine, so no separate PG credentials are needed). Managed from the Integrations
// UI; when set, it takes priority over environment variables. Not used in the demo.
export type ChConnection = {
  url: string;
  username: string;
  password: string;
  database: string;
};

export function emptyConnection(): ChConnection {
  return { url: "", username: "", password: "", database: "" };
}

// The password is never sent to the browser, only a flag that it is set.
export type ChConnectionView = {
  source: "ui" | "env" | "none"; // where the active connection comes from
  url: string;
  username: string;
  database: string;
  hasPassword: boolean;
};
