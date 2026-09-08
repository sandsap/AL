// Self-contained owner dashboard served by the control API at `/`. Vanilla JS
// fetches the metrics + calls endpoints and renders the ROI view. First version;
// graduates to Next.js + Tailwind (ARCHITECTURE.md §3.5) against Postgres.

export function dashboardHtml(tenantId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Al — Owner Dashboard</title>
<style>
  :root{
    --bg:#F5F6F8;--surface:#fff;--surface-2:#FbFcFd;--ink:#14202E;--text:#26333F;
    --muted:#5B6875;--border:#DEE3E8;--accent:#D9770B;--steel:#2E5A7A;--pos:#177046;
    --warn:#B45309;--crit:#B42318;--shadow:0 1px 2px rgba(20,32,46,.06),0 8px 24px -12px rgba(20,32,46,.14);
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#0E1620;--surface:#16212D;--surface-2:#1A2734;--ink:#EDF1F5;--text:#CDD6DF;
    --muted:#8B98A7;--border:#26333F;--accent:#F0942A;--steel:#7FB0D6;--pos:#46BE86;
    --warn:#E0A24A;--crit:#F0857A;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px -14px rgba(0,0,0,.6);
  }}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5}
  .wrap{max-width:1080px;margin:0 auto;padding:28px 24px 80px}
  header{display:flex;align-items:baseline;gap:12px;margin-bottom:4px}
  .brand{font-weight:800;font-size:26px;color:var(--ink);letter-spacing:-.02em}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);display:inline-block}
  .sub{color:var(--muted);font-size:13px}
  .tag{margin-left:auto;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
    border:1px solid var(--border);border-radius:999px;padding:4px 10px}
  h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:28px 0 12px;font-weight:600}
  .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .tile{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow)}
  .tile .k{font-size:12px;color:var(--muted);margin-bottom:8px}
  .tile .v{font-size:30px;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .tile.hero{background:var(--ink)}
  .tile.hero .k{color:#AEB9C4}.tile.hero .v{color:#fff}.tile.hero .v .u{color:var(--accent);font-size:.6em}
  table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);
    border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
  th,td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--border);font-size:14px}
  th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--surface-2)}
  tbody tr{cursor:pointer}tbody tr:hover{background:var(--surface-2)}
  tbody tr:last-child td{border-bottom:0}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px}
  .pill.booked{color:var(--pos);background:color-mix(in srgb,var(--pos) 14%,transparent)}
  .pill.message{color:var(--steel);background:color-mix(in srgb,var(--steel) 14%,transparent)}
  .pill.escalated{color:var(--crit);background:color-mix(in srgb,var(--crit) 14%,transparent)}
  .after{color:var(--warn);font-size:12px}
  .panel{position:fixed;top:0;right:0;height:100%;width:min(440px,92vw);background:var(--surface);
    border-left:1px solid var(--border);box-shadow:-12px 0 40px -20px rgba(0,0,0,.4);
    transform:translateX(100%);transition:transform .18s ease;padding:22px;overflow-y:auto}
  .panel.open{transform:none}
  .panel h3{margin:0 0 2px;color:var(--ink)}
  .panel .close{position:absolute;top:16px;right:16px;border:0;background:transparent;font-size:22px;color:var(--muted);cursor:pointer}
  .bubble{margin:10px 0;padding:10px 12px;border-radius:12px;max-width:88%}
  .bubble.al{background:var(--surface-2);border:1px solid var(--border)}
  .bubble.caller{background:color-mix(in srgb,var(--accent) 12%,transparent);margin-left:auto}
  .who{font-size:11px;color:var(--muted);margin-bottom:2px}
  @media (max-width:720px){.tiles{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="brand">Al</span><span class="dot"></span>
    <span class="sub">Lone Star Heating &amp; Air · front-office dashboard</span>
    <span class="tag">Example data</span>
  </header>

  <h2>This week</h2>
  <div class="tiles" id="tiles"></div>

  <h2>Recent calls</h2>
  <table>
    <thead><tr><th>Time</th><th>From</th><th>Outcome</th><th>Job</th><th class="num">Value</th><th class="num">p95 latency</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
</div>

<div class="panel" id="panel">
  <button class="close" onclick="closePanel()">×</button>
  <h3 id="p-title"></h3>
  <div class="sub" id="p-meta"></div>
  <div id="p-transcript" style="margin-top:16px"></div>
</div>

<script>
const TENANT = ${JSON.stringify(tenantId)};
const fmtUsd = n => n ? "$" + n.toLocaleString() : "—";
const fmtTime = iso => new Date(iso).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});

async function load(){
  const [m, calls] = await Promise.all([
    fetch(\`/api/tenants/\${TENANT}/metrics\`).then(r=>r.json()),
    fetch(\`/api/tenants/\${TENANT}/calls\`).then(r=>r.json()),
  ]);
  document.getElementById("tiles").innerHTML = [
    \`<div class="tile hero"><div class="k">Revenue captured</div><div class="v"><span class="u">$</span>\${m.revenueCapturedUsd.toLocaleString()}</div></div>\`,
    \`<div class="tile"><div class="k">Jobs booked</div><div class="v">\${m.jobsBooked}</div></div>\`,
    \`<div class="tile"><div class="k">Calls handled</div><div class="v">\${m.callsHandled}</div></div>\`,
    \`<div class="tile"><div class="k">Booking rate</div><div class="v">\${m.bookingRatePct}%</div></div>\`,
    \`<div class="tile"><div class="k">After-hours calls</div><div class="v">\${m.afterHoursCalls}</div></div>\`,
    \`<div class="tile"><div class="k">Escalated to on-call</div><div class="v">\${m.escalated}</div></div>\`,
    \`<div class="tile"><div class="k">Avg p95 latency</div><div class="v">\${m.avgLatencyMs}<span style="font-size:.5em;color:var(--muted)">ms</span></div></div>\`,
  ].join("");

  window._calls = {};
  document.getElementById("rows").innerHTML = calls.map(c=>{
    window._calls[c.id]=c;
    return \`<tr onclick="openCall('\${c.id}')">
      <td>\${fmtTime(c.startedAt)} \${c.afterHours?'<span class="after">· after-hours</span>':''}</td>
      <td>\${c.fromNumber}</td>
      <td><span class="pill \${c.outcome}">\${c.outcome}</span></td>
      <td>\${c.jobType||"—"}</td>
      <td class="num">\${fmtUsd(c.jobValueUsd)}</td>
      <td class="num">\${c.latencyP95Ms} ms</td>
    </tr>\`;
  }).join("");
}

function openCall(id){
  const c = window._calls[id];
  document.getElementById("p-title").textContent = c.jobType || "Call " + c.id;
  document.getElementById("p-meta").textContent =
    \`\${fmtTime(c.startedAt)} · \${c.fromNumber} · \${Math.round(c.durationSec/60*10)/10} min\${c.bookingId? " · "+c.bookingId : ""}\`;
  document.getElementById("p-transcript").innerHTML = c.transcript.map(l=>
    \`<div class="bubble \${l.role}"><div class="who">\${l.role==="al"?"Al":"Caller"}</div>\${l.text}</div>\`
  ).join("");
  document.getElementById("panel").classList.add("open");
}
function closePanel(){document.getElementById("panel").classList.remove("open");}

load();
</script>
</body>
</html>`;
}
