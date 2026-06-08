const COLUMNS = [
  "time",
  "visitorName",
  "contact",
  "email",
  "consent",
  "animalId",
  "animalName",
  "cardId",
  "species",
  "sourceUrl",
  "answers",
  "dailyCountAfterIssue",
  "storageMode",
];

const DEFAULT_DATA_PATH = "submissions.csv";
const DEFAULT_BRANCH = "main";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-write-key",
  };
}

function jsonResponse(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(env),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function textResponse(text, env, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(text, {
    status,
    headers: {
      ...corsHeaders(env),
      "content-type": contentType,
    },
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function csvValue(value) {
  const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(record) {
  return COLUMNS.map((column) => csvValue(record[column])).join(",");
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function githubConfig(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error("GitHub storage is not configured.");
  }

  return {
    owner,
    repo,
    token,
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
    path: env.DATA_PATH || DEFAULT_DATA_PATH,
  };
}

async function githubRequest(env, url, options = {}) {
  const { token } = githubConfig(env);
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  return response;
}

async function readCsvFile(env) {
  const { owner, repo, branch, path } = githubConfig(env);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const response = await githubRequest(env, url);

  if (response.status === 404) {
    return { sha: null, content: `${COLUMNS.join(",")}\n` };
  }
  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    content: decodeBase64(data.content || ""),
  };
}

async function writeCsvFile(env, content, sha) {
  const { owner, repo, branch, path } = githubConfig(env);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: `Append NIKA Afisha submission ${new Date().toISOString()}`,
    content: encodeBase64(content),
    branch,
  };
  if (sha) body.sha = sha;

  return githubRequest(env, url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function appendRecord(env, record) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const file = await readCsvFile(env);
    const base = file.content.trimEnd() || COLUMNS.join(",");
    const nextCsv = `${base}\n${csvRow(record)}\n`;
    const response = await writeCsvFile(env, nextCsv, file.sha);
    if (response.ok) return;
    if (response.status !== 409) {
      throw new Error(`GitHub write failed: ${response.status}`);
    }
  }
  throw new Error("GitHub write conflict. Try again.");
}

function normalizeRecord(input) {
  return {
    time: Number.isNaN(Date.parse(input.time)) ? new Date().toISOString() : input.time,
    visitorName: String(input.visitorName || "").slice(0, 120),
    contact: String(input.contact || "").slice(0, 160),
    email: String(input.email || "").slice(0, 160),
    consent: input.consent === "yes" ? "yes" : "no",
    animalId: String(input.animalId || "").slice(0, 80),
    animalName: String(input.animalName || "").slice(0, 120),
    cardId: String(input.cardId || "").slice(0, 80),
    species: String(input.species || "").slice(0, 40),
    sourceUrl: String(input.sourceUrl || "").slice(0, 300),
    answers: input.answers || {},
    dailyCountAfterIssue: Number(input.dailyCountAfterIssue || 0),
    storageMode: "remote",
  };
}

function requireWriteAccess(request, env) {
  if (!env.WRITE_KEY) return true;
  return request.headers.get("x-write-key") === env.WRITE_KEY;
}

function requireAdminAccess(url, env) {
  return Boolean(env.ADMIN_KEY && url.searchParams.get("key") === env.ADMIN_KEY);
}

async function handleStats(env) {
  const file = await readCsvFile(env);
  const rows = parseCsv(file.content);
  const date = todayKey();
  const todayRows = rows.filter((row) => String(row.time || "").startsWith(date));
  const counts = {};
  todayRows.forEach((row) => {
    if (!row.animalId) return;
    counts[row.animalId] = (counts[row.animalId] || 0) + 1;
  });
  const recent = todayRows
    .slice()
    .reverse()
    .map((row) => row.animalId)
    .filter(Boolean)
    .slice(0, 4);

  return jsonResponse({ date, counts, recent, total: rows.length }, env);
}

async function handleSubmission(request, env) {
  if (!requireWriteAccess(request, env)) {
    return textResponse("Wrong write key.", env, 401);
  }

  const input = await request.json();
  const record = normalizeRecord(input);
  if (!record.visitorName || !record.animalId || record.consent !== "yes") {
    return textResponse("Required fields are missing.", env, 400);
  }

  await appendRecord(env, record);
  return jsonResponse({ ok: true }, env);
}

async function handleExport(url, env) {
  if (!requireAdminAccess(url, env)) {
    return textResponse("Wrong export code.", env, 401);
  }

  const file = await readCsvFile(env);
  return textResponse(file.content, env, 200, "text/csv; charset=utf-8");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true }, env);
      }
      if (request.method === "GET" && url.pathname === "/stats") {
        return handleStats(env);
      }
      if (request.method === "GET" && url.pathname === "/export") {
        return handleExport(url, env);
      }
      if (request.method === "POST" && url.pathname === "/submission") {
        return handleSubmission(request, env);
      }
      return textResponse("Not found.", env, 404);
    } catch (error) {
      return textResponse(error.message || "Server error.", env, 500);
    }
  },
};
