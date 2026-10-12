// Draws stats.svg for the profile README from GitHub's own public data:
// public repos, stars, followers, contributions in the last year, and the top
// languages across public repos (by bytes). No third-party service, so it
// cannot go down. Run by .github/workflows/stats.yml every day.
import { writeFileSync } from "node:fs";

const USER = "preinfection";
const token = process.env.GITHUB_TOKEN;
const gh = async (path) => {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { "user-agent": "profile-stats", accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

const user = await gh(`/users/${USER}`);
const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork);
const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
const langs = {};
for (const r of repos) {
  const l = await gh(`/repos/${USER}/${r.name}/languages`);
  for (const [k, v] of Object.entries(l)) langs[k] = (langs[k] || 0) + v;
}
const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5);
// contributions in the last year: the public calendar page
const cal = await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: { "user-agent": "profile-stats" } })).text();
const contrib = Number((cal.match(/([\d,]+)\s+contributions?\s+in the last year/i) || [, "0"])[1].replace(/,/g, ""));

const fmt = (n) => n.toLocaleString("en-US");
const rows = [["Public repos", user.public_repos], ["Stars", stars], ["Followers", user.followers], ["Contributions, last year", contrib]];
const COLORS = { Python: "#3572A5", TypeScript: "#3178c6", JavaScript: "#f1e05a", HTML: "#e34c26", CSS: "#563d7c", GLSL: "#5686a5", Shell: "#89e051", PowerShell: "#012456", "Inno Setup": "#264b99" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let y = 0;
const W = 720, H = 150;
const left = rows.map(([k, v], i) => `<text x="0" y="${36 + i * 30}" class="k">${esc(k)}</text><text x="300" y="${36 + i * 30}" class="v" text-anchor="end">${fmt(v)}</text>`).join("");
let bx = 0;
const bar = top.map(([k, v]) => { const w = (v / total) * 320; const r = `<rect x="${380 + bx}" y="24" width="${Math.max(w, 2)}" height="8" fill="${COLORS[k] || "#8b949e"}"/>`; bx += w; return r; }).join("");
const legend = top.map(([k, v], i) => `<circle cx="${386 + (i % 2) * 165}" cy="${58 + Math.floor(i / 2) * 26}" r="5" fill="${COLORS[k] || "#8b949e"}"/><text x="${398 + (i % 2) * 165}" y="${62 + Math.floor(i / 2) * 26}" class="l">${esc(k)} ${((v / total) * 100).toFixed(1)}%</text>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats for ${USER}">
<style>.k{font:400 15px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#c9d1d9}.v{font:600 15px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#ffffff}.l{font:400 13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#c9d1d9}.h{font:600 13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;fill:#8b949e}</style>
<text x="0" y="12" class="h">GITHUB</text>${left}
<text x="380" y="12" class="h">TOP LANGUAGES</text><clipPath id="c"><rect x="380" y="24" width="320" height="8" rx="4"/></clipPath><g clip-path="url(#c)">${bar}</g>${legend}
</svg>
`;
writeFileSync(new URL("../stats.svg", import.meta.url), svg);
console.log("stats.svg:", rows.map(([k, v]) => `${k} ${v}`).join(", "), "|", top.map(([k]) => k).join(", "));
