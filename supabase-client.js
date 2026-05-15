(function () {
  const VALID_PATHS = ["jogador", "tecnico", "presidente"];
  const PATH_ROUTES = {
    jogador: "jogador.html",
    tecnico: "tecnico.html",
    presidente: "presidente.html"
  };

  const SUPABASE_CONFIG = window.FUTBROWSER_SUPABASE_CONFIG || {
    url: "",
    anonKey: "",
    profileTables: ["profiles", "perfis", "usuarios"],
    profileIdColumns: ["id", "user_id", "usuario_id"]
  };

  function getMetaContent(name) {
    const tag = document.querySelector(`meta[name="${name}"]`);
    return tag ? tag.content.trim() : "";
  }

  function readGlobalValue(name) {
    if (window[name]) return window[name];

    try {
      return Function(`return typeof ${name} !== "undefined" ? ${name} : ""`)();
    } catch {
      return "";
    }
  }

  function getWindowConfigValue(key) {
    const names = key === "url"
      ? ["SUPABASE_URL", "supabaseUrl", "supabaseURL", "FUTBROWSER_SUPABASE_URL"]
      : ["SUPABASE_ANON_KEY", "SUPABASE_KEY", "supabaseAnonKey", "supabaseKey", "FUTBROWSER_SUPABASE_ANON_KEY"];

    for (const name of names) {
      const value = readGlobalValue(name);
      if (value) return value;
    }

    return "";
  }

  function getConfigValue(key, metaName) {
    return String(SUPABASE_CONFIG[key] || getMetaContent(metaName) || getWindowConfigValue(key) || "").trim();
  }

  function getExistingClient() {
    const candidates = [
      window.futbrowserSupabase,
      window.supabaseClient,
      window.SUPABASE_CLIENT,
      window.sbClient,
      window.sb
    ];

    return candidates.find(client => client && client.auth && typeof client.from === "function") || null;
  }

  function getStoredSessionConfig() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        const match = key && key.match(/^sb-(.+)-auth-token$/);
        if (!match) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const accessToken = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token));

        if (accessToken) {
          return {
            url: `https://${match[1]}.supabase.co`,
            anonKey: accessToken
          };
        }
      }
    } catch {}

    return { url: "", anonKey: "" };
  }

  function getProfileTables() {
    const value = SUPABASE_CONFIG.profileTable || getMetaContent("futbrowser-profile-table");
    if (value) return [value];

    return Array.isArray(SUPABASE_CONFIG.profileTables) && SUPABASE_CONFIG.profileTables.length
      ? SUPABASE_CONFIG.profileTables
      : ["profiles", "perfis", "usuarios"];
  }

  function getProfileIdColumns() {
    const value = SUPABASE_CONFIG.profileIdColumn || getMetaContent("futbrowser-profile-id-column");
    if (value) return [value];

    return Array.isArray(SUPABASE_CONFIG.profileIdColumns) && SUPABASE_CONFIG.profileIdColumns.length
      ? SUPABASE_CONFIG.profileIdColumns
      : ["id", "user_id", "usuario_id"];
  }

  function normalizePath(path) {
    const normalized = String(path || "").trim().toLowerCase();
    return VALID_PATHS.includes(normalized) ? normalized : "";
  }

  function getPathRoute(path) {
    return PATH_ROUTES[normalizePath(path)] || "escolha-caminho.html";
  }

  function createClient() {
    const existingClient = getExistingClient();
    if (existingClient) {
      window.futbrowserSupabase = existingClient;
      return existingClient;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Biblioteca do Supabase não foi carregada.");
    }

    const storedSessionConfig = getStoredSessionConfig();
    const url = getConfigValue("url", "futbrowser-supabase-url") || storedSessionConfig.url;
    const anonKey = getConfigValue("anonKey", "futbrowser-supabase-anon-key") || storedSessionConfig.anonKey;

    if (!url || !anonKey) {
      throw new Error("Configure a URL e a chave anon pública do Supabase.");
    }

    window.futbrowserSupabase = window.supabase.createClient(url, anonKey);
    return window.futbrowserSupabase;
  }

  async function getCurrentUser() {
    const client = createClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  function isMissingTableOrColumn(error) {
    const code = error && String(error.code || "");
    const message = error && String(error.message || "").toLowerCase();

    return ["42P01", "42703", "PGRST200", "PGRST204"].includes(code)
      || message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("column")
      || message.includes("relation");
  }

  async function findProfileLocation(userId) {
    const client = createClient();
    const tables = getProfileTables();
    const columns = getProfileIdColumns();
    let lastError = null;

    for (const table of tables) {
      for (const idColumn of columns) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .eq(idColumn, userId)
          .maybeSingle();

        if (!error) return { table, idColumn, profile: data || null };
        lastError = error;

        if (!isMissingTableOrColumn(error)) {
          return { table, idColumn, profile: null, error };
        }
      }
    }

    if (lastError) throw lastError;
    return { table: tables[0], idColumn: columns[0], profile: null };
  }

  async function getProfile(userId) {
    const location = await findProfileLocation(userId);
    if (location.error) throw location.error;
    return location;
  }

  async function ensureProfile(user, extraFields) {
    const client = createClient();
    const location = await getProfile(user.id);
    if (location.profile) return location;

    const payload = {
      [location.idColumn]: user.id,
      email: user.email || null,
      ...(extraFields || {})
    };

    let response = await client
      .from(location.table)
      .upsert(payload, { onConflict: location.idColumn })
      .select("*")
      .maybeSingle();

    if (response.error && isMissingTableOrColumn(response.error)) {
      response = await client
        .from(location.table)
        .upsert({ [location.idColumn]: user.id }, { onConflict: location.idColumn })
        .select("*")
        .maybeSingle();
    }

    if (response.error) throw response.error;
    return { ...location, profile: response.data || payload };
  }

  async function savePathForCurrentUser(path) {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) throw new Error("Caminho inválido.");

    const user = await getCurrentUser();
    if (!user) throw new Error("Faça login para escolher seu caminho.");

    const client = createClient();
    const location = await getProfile(user.id);
    const payload = {
      caminho: normalizedPath,
      role: normalizedPath,
      modo_jogo: normalizedPath,
      updated_at: new Date().toISOString()
    };

    let response;
    if (location.profile) {
      response = await client
        .from(location.table)
        .update(payload)
        .eq(location.idColumn, user.id)
        .select("*")
        .maybeSingle();
    } else {
      response = await client
        .from(location.table)
        .upsert({ [location.idColumn]: user.id, email: user.email || null, ...payload }, { onConflict: location.idColumn })
        .select("*")
        .maybeSingle();
    }

    if (response.error && isMissingTableOrColumn(response.error)) {
      const minimalPayload = { caminho: normalizedPath };
      const retryPayload = location.profile
        ? minimalPayload
        : { [location.idColumn]: user.id, ...minimalPayload };

      response = location.profile
        ? await client.from(location.table).update(retryPayload).eq(location.idColumn, user.id).select("*").maybeSingle()
        : await client.from(location.table).upsert(retryPayload, { onConflict: location.idColumn }).select("*").maybeSingle();
    }

    if (response.error) throw response.error;

    localStorage.setItem("futbrowser_selected_path", normalizedPath);
    localStorage.setItem("futbrowser_profile_table", location.table);
    localStorage.setItem("futbrowser_profile_id_column", location.idColumn);

    return response.data || { caminho: normalizedPath };
  }

  async function getCurrentPath() {
    const user = await getCurrentUser();
    if (!user) return "";

    const { profile } = await getProfile(user.id);
    return normalizePath(profile && (profile.caminho || profile.role || profile.modo_jogo || profile.modoJogo));
  }

  async function redirectLoggedUserByPath() {
    const path = await getCurrentPath();
    window.location.href = path ? getPathRoute(path) : "escolha-caminho.html";
  }

  window.FutbrowserSupabase = {
    VALID_PATHS,
    PATH_ROUTES,
    createClient,
    ensureProfile,
    getCurrentUser,
    getCurrentPath,
    getPathRoute,
    normalizePath,
    redirectLoggedUserByPath,
    savePathForCurrentUser
  };
}());
