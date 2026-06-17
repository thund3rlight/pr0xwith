export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const key = url.searchParams.get("key") || "";
    const token = url.searchParams.get("t");
    const action = url.searchParams.get("action");
    const copyAttempt = url.searchParams.get("copy");
    const path = url.searchParams.get("path");

    await ensureDatabase(env);

    const encodeToken = (data) =>
      btoa(JSON.stringify(data))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const decodeToken = (str) => {
      const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
      return JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
    };

    let decoded = null;
    if (token) {
      try {
        decoded = decodeToken(token);
      } catch {
        decoded = null;
      }
    }

    const target = decoded?.url || null;
    const expires = decoded?.exp || null;

    if (expires && Date.now() > expires) {
      return new Response("Link expired", { status: 403 });
    }

    const row = await env.DB.prepare("SELECT password FROM settings WHERE id = 1").first();
    const PASSWORD = row?.password || "change-me-now";

    const homePage = (message = "") => `<!doctype html>
<html>
<head>
  <title>Proxy Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#fff7e6;color:#3b2f2f;margin:0;padding:40px 16px}.container{max-width:900px;margin:auto}h1{font-size:28px;margin-bottom:20px;color:#2f1f1f}.card{background:#fffaf0;border:1px solid #f0e2c6;border-radius:14px;padding:18px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.04)}.muted{color:#7a6a5a;font-size:14px}input{width:100%;box-sizing:border-box;padding:12px;margin-top:8px;margin-bottom:10px;border-radius:10px;border:1px solid #e6d5b8;background:#fffdf7;color:#3b2f2f;outline:none}input:focus{border-color:#d8b27a;box-shadow:0 0 0 2px rgba(216,178,122,.2)}button{padding:12px;width:100%;border:none;border-radius:10px;background:#d8a15d;color:white;font-weight:600;cursor:pointer;transition:.2s}button:hover{background:#c98d45}.danger{background:#c46a4a}.danger:hover{background:#a94f35}.msg{padding:10px;border-radius:10px;margin-bottom:15px;background:#fff1dc;border-left:4px solid #d8a15d;color:#5a4633}code{display:block;padding:10px;background:#fff3db;border-radius:10px;color:#6b4e2e;word-break:break-all}.toast{position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:#3b2f2f;color:#fff7e6;padding:12px 18px;border-radius:10px;opacity:0;pointer-events:none;transition:.25s}.toast.show{opacity:1;transform:translateX(-50%) translateY(-5px)}
  </style>
</head>
<body>
<div class="container">
  <h1>Proxy Dashboard</h1>
  ${message ? `<div class="msg">${escapeHtml(message)}</div>` : ""}
  <div class="card">
    <h3>Generate Proxy Link With Password</h3>
    <div class="muted">Default Password Is: <code>change-me-now</code> Change the password NOW using the change password function below.</div><br>
    <code>Enter your password and stream URL below, pick an expiry time, click generate URL, then copy URL.</code>
  </div>
  <div class="card">
    <h3>Generate Proxy Link</h3>
    <input id="keyInput" placeholder="Enter Password" type="password" />
    <input id="urlInput" placeholder="Stream URL (.m3u / .m3u8)" />
    <input id="expiryInput" placeholder="Expiry in minutes (0 = never)" inputmode="numeric" />
    <button onclick="generate()">Generate URL</button>
    <input id="output" readonly placeholder="Generated URL" />
    <button onclick="copyUrl()">Copy URL</button>
  </div>
  <div class="card">
    <h3>Change Password</h3>
    <form method="GET">
      <input type="hidden" name="action" value="change" />
      <input name="key" placeholder="Current password" type="password" required />
      <input name="newpass" placeholder="New password" type="password" required />
      <button class="danger" type="submit">Update Password</button>
    </form>
  </div>
</div>
<div id="toast" class="toast">Copied!</div>
<script>
function ensureM3U(url){try{const u=new URL(url);if(!u.pathname.endsWith('.m3u')&&!u.pathname.endsWith('.m3u8'))u.pathname+='.m3u8';return u.toString()}catch{return url}}
function generate(){const key=document.getElementById('keyInput').value;let url=document.getElementById('urlInput').value;const expiryMinutes=parseInt(document.getElementById('expiryInput').value||'0',10);if(!key||!url){alert('Please enter both password and URL');return}url=ensureM3U(url);const exp=expiryMinutes>0?Date.now()+expiryMinutes*60*1000:null;const token=btoa(JSON.stringify({url,exp})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');document.getElementById('output').value=window.location.origin+'/?key='+encodeURIComponent(key)+'&t='+token}
async function copyUrl(){const out=document.getElementById('output').value;if(!out)return;await fetch(out+'&copy=1');await navigator.clipboard.writeText(out);showToast('Copied!')}
function showToast(msg){const toast=document.getElementById('toast');toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2000)}
</script>
</body>
</html>`;

    if (action === "change") {
      const newpass = url.searchParams.get("newpass");
      if (!newpass) return html(homePage("Missing new password"), 400);
      if (key !== PASSWORD) return html(homePage("Wrong password"), 401);
      await env.DB.prepare("UPDATE settings SET password = ? WHERE id = 1").bind(newpass).run();
      return html(homePage("Password updated!"));
    }

    if (key !== PASSWORD) {
      if (copyAttempt === "1") return html(homePage("Invalid key"), 401);
      return html(homePage());
    }

    if (!target) return html(homePage());

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response("Invalid token", { status: 400 });
    }

    if (path) parsed = new URL(path, parsed.origin);

    if (!parsed.pathname.endsWith(".m3u") && !parsed.pathname.endsWith(".m3u8") && !path) {
      parsed.pathname += ".m3u8";
    }

    const res = await fetch(parsed.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let body = await res.text();
      body = body
        .replaceAll(/href="\/(.*?)"/g, `href="?key=${encodeURIComponent(key)}&t=${encodeURIComponent(token || "")}&path=/$1"`)
        .replaceAll(/src="\/(.*?)"/g, `src="?key=${encodeURIComponent(key)}&t=${encodeURIComponent(token || "")}&path=/$1"`);
      return new Response(body, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    const headers = new Headers(res.headers);
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    return new Response(res.body, { status: res.status, headers });
  }
};

async function ensureDatabase(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), password TEXT NOT NULL)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO settings (id, password) VALUES (1, 'change-me-now')").run();
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/html;charset=UTF-8" } });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
