// Подключение к хранилищу ClickHouse (ClickHouse сам читает PostgreSQL через
// табличный движок-мост, поэтому отдельные креды к PG не нужны). Управляется из UI
// Интеграций; если задано, имеет приоритет над переменными окружения. В демо не используется.
export type ChConnection = {
  url: string;
  username: string;
  password: string;
  database: string;
};

export function emptyConnection(): ChConnection {
  return { url: "", username: "", password: "", database: "" };
}

// Пароль наружу (в браузер) не отдаём – только признак, что он задан.
export type ChConnectionView = {
  source: "ui" | "env" | "none"; // откуда берётся активное подключение
  url: string;
  username: string;
  database: string;
  hasPassword: boolean;
};
