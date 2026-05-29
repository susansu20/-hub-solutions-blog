# Hub Solutions Digital — Blog

A pure HTML / CSS / vanilla-JS blog. No build step. No CMS. No frameworks.
Edit files, push to GitHub, Vercel deploys.

Live: **blog.hubsolutions.one**

---

## Folder structure

```
hub-solutions-blog/
├── index.html        # Homepage — reads posts.json and renders post cards
├── styles.css        # All shared styles (navy/amber, hero, sections, FAQ, animations)
├── posts.json        # Single source of truth for which posts appear on the homepage
├── README.md         # This file
├── posts/
│   ├── _template.html
│   └── <slug>.html   # One HTML file per post
└── images/
    └── <slug>-thumb.svg   # Thumbnail per post (SVG or PNG/JPG)
```

The homepage fetches `posts.json` and renders the cards client-side. Each post
file is fully self-contained (its own SEO, Open Graph, Article schema,
FAQPage schema, visuals, and 5 FAQs).

---

## How a staff member publishes a new post (no Claude account needed)

Your team can publish posts without touching Claude Code, the terminal, or your
Claude account. They just open a GitHub issue.

### The staff workflow

1. Go to the repo on GitHub → **Issues** → **New issue**.
2. Pick the **"✍️ Write a new blog post"** template.
3. Fill in **title** + **topic / angle** (and optionally eyebrow, reading time,
   preferred visuals).
4. Submit.
5. Within ~1 minute, a draft **pull request** appears. You (the owner) review,
   tweak if needed, click **Merge**. Vercel deploys to `blog.hubsolutions.one`.

That's it. Staff never sees the code.

### One-time setup (owner does this once)

1. **Get an Anthropic API key**
   - Go to https://console.anthropic.com → API Keys → Create key.
   - Copy the key (`sk-ant-…`).

2. **Add it to GitHub repo secrets**
   - Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste the key. Save.

3. **Allow the Action to open PRs**
   - Repo → **Settings** → **Actions** → **General**.
   - Scroll to **Workflow permissions** → check **"Allow GitHub Actions to create and approve pull requests"**. Save.

4. **Add staff as a collaborator**
   - Repo → **Settings** → **Collaborators** → invite their GitHub username.
   - Give them **Write** access (so they can open issues and labels apply).

5. **Test it**
   - Open a test issue using the template — a PR should appear in 30–90 seconds.

### Costs

- Each generated post uses ~$0.10–$0.30 of Anthropic API credit.
- Anthropic's prompt cache (already enabled in the script) drops follow-up posts
  in the same hour to roughly half that.
- Staff's GitHub seat: free.

### Editing the post style

The Action reads `posts/_template.html` and the latest example post as reference.
If you change the template, future posts automatically match. If you want to
tweak Claude's system prompt (voice, structural rules), edit
`.github/scripts/generate-post.mjs` — search for `systemPrompt`.

---

## How to publish a new post with Claude Code

The whole point of this setup is that publishing is one command to Claude Code.

### The prompt

In a Claude Code session inside this folder, say:

> "Write a new blog post titled **<your title>** about <one-sentence topic>.
> Build relevant in-content visuals (stat cards / chart / comparison / chips),
> add 5 FAQs relevant to the title, then add it to `posts.json`."

Claude Code will:

1. Copy `posts/_template.html` to `posts/<slug>.html`.
2. Fill in the hero, numbered sections, in-content visuals built in HTML/CSS/SVG
   that genuinely illustrate the topic, a mid-article and final CTA pointing to
   `geo.hubsolutions.one`, and **5 topic-relevant FAQs** (with matching
   `FAQPage` JSON-LD schema).
3. Set the SEO `<title>`, `<meta description>`, canonical URL, Open Graph tags,
   and `Article` JSON-LD schema.
4. Create a brand-styled SVG thumbnail in `/images/`.
5. Prepend an entry to `posts.json`:

   ```json
   {
     "slug": "your-slug",
     "title": "Your title",
     "date": "YYYY-MM-DD",
     "excerpt": "One- to two-sentence hook for the card.",
     "thumbnail": "images/your-slug-thumb.svg",
     "readingTime": "X min read",
     "link": "posts/your-slug.html"
   }
   ```

6. Ask you to review, then commit and push.

### Pushing to GitHub (PAT inline)

```bash
git add .
git commit -m "Add post: <title>"
git push https://<USERNAME>:<PAT>@github.com/<USERNAME>/<REPO>.git main
```

Vercel auto-deploys on push.

---

## How to publish a new post manually (fallback)

1. **Copy the template**
   ```bash
   cp posts/_template.html posts/your-slug.html
   ```

2. **Fill in `your-slug.html`** — every `{{PLACEHOLDER}}` in the file. In
   particular:
   - SEO block at the top (title, meta description, canonical, OG, JSON-LD)
   - Hero: eyebrow label, headline (wrap the key phrase in `<span class="hl">…</span>`), sub-line, date, reading time
   - 5+ numbered sections (`01`, `02`, …)
   - Visuals (stat cards, chart, comparison columns, query chips) — pick whichever fit your topic
   - Mid-article CTA + final CTA (both link to `https://geo.hubsolutions.one`)
   - **Exactly 5 FAQs** in the `<details>` accordion AND in the `FAQPage`
     JSON-LD block at the top — they must match

3. **Make a thumbnail.** Drop a brand-styled SVG (or 1600×900 PNG) into
   `/images/your-slug-thumb.svg`.

4. **Add to `posts.json`** — prepend a new object so it's newest-first. The
   homepage sorts by `date` descending anyway, so the order in the file is just
   for your own readability.

5. **Test locally** — see "Running locally" below.

6. **Push to GitHub** — Vercel deploys automatically.

---

## Running locally

`posts.json` is fetched via `fetch()`, which browsers block from `file://` URLs.
You need a local server:

```bash
# from inside hub-solutions-blog/
python3 -m http.server 8080
# then open http://localhost:8080
```

Or any equivalent (`npx serve`, etc.). On Vercel this all works without any
config — it's a normal static site.

---

## Brand tokens (defined in `styles.css`)

| Token         | Value     | Used for                          |
|---------------|-----------|-----------------------------------|
| `--navy`      | `#1B2C6B` | Headers, hero backgrounds, CTAs   |
| `--amber`     | `#F5A623` | Accent, CTA button, highlights    |
| `--white`     | `#FFFFFF` | Body background, hero text        |
| `--grey`      | `#F4F6FB` | Light section backgrounds         |
| Font          | General Sans (Fontshare CDN), 400/500/600/700 |

---

## Deploying — Vercel + Cloudways reverse proxy

The blog lives at **`hubsolutions.one/blog/`** — a subfolder of the main domain
for SEO benefit (subfolders inherit the parent domain's authority; subdomains
don't).

The architecture:

```
Visitor → hubsolutions.one/blog/...  →  Cloudways (Nginx) → reverse-proxy → Vercel static files
```

The blog is hosted on Vercel (fast, free, auto-deploys on every push). The main
site on Cloudways simply forwards any request for `/blog/*` to Vercel. Google
sees one unified site; you keep the simple deploy workflow.

### Step 1 — Deploy the blog to Vercel

1. Go to https://vercel.com → **Add New Project** → import the GitHub repo.
2. Framework Preset: **Other** (no build step needed).
3. **Deploy**. After ~30 seconds you'll get a URL like
   `hub-solutions-blog-xxxxx.vercel.app`. Copy this URL — you'll need it for
   Step 2.
4. Test it: open the Vercel URL in your browser, confirm the blog renders.

### Step 2 — Set up the Cloudways reverse proxy

Goal: make `hubsolutions.one/blog/...` serve the Vercel files.

1. **Log in to Cloudways** → open your application (the main `hubsolutions.one` app).
2. **Application Settings → Nginx** (sometimes labelled "Vary" or "Manage Application Settings").
   - On the Starter plan this lives under a slightly different menu — if you
     can't find it, contact Cloudways support; they'll point you to the
     correct file (usually `/etc/nginx/sites-available/<app>.conf`).
3. Paste this `location` block **above** any existing PHP/WordPress location blocks:

   ```nginx
   # === Hub Solutions Blog — reverse proxy to Vercel ===
   location ^~ /blog/ {
       proxy_pass https://YOUR-VERCEL-URL.vercel.app/;
       proxy_http_version 1.1;
       proxy_set_header Host YOUR-VERCEL-URL.vercel.app;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
       proxy_ssl_server_name on;
       proxy_intercept_errors on;
       proxy_redirect off;
   }

   # Optional: send /blog (no trailing slash) to /blog/
   location = /blog {
       return 301 /blog/;
   }
   ```

   Replace **both occurrences** of `YOUR-VERCEL-URL` with the actual subdomain
   from Step 1 (e.g. `hub-solutions-blog-xxxxx`).

4. **Save** → Cloudways reloads Nginx automatically (or click "Restart Nginx").
5. **Test**: open `https://hubsolutions.one/blog/` in a fresh browser tab.
   You should see the blog homepage. Click into the example post — that should
   load at `https://hubsolutions.one/blog/posts/...html`.

### Step 3 — Update Vercel project settings (one tweak)

Since the blog is now served from the parent domain via reverse proxy, the
canonical URL (`https://hubsolutions.one/blog/`) and not the Vercel URL is what
Google indexes. We've already set the canonical tag in every HTML file, so
nothing to change in code.

**Optional but recommended**: in Vercel → Project Settings → Domains, *don't*
add a custom domain. Leave the auto-generated `*.vercel.app` URL as the only
domain. This way the Vercel URL itself isn't indexed (it's only used internally
by your Cloudways proxy).

### Troubleshooting

- **404 on `/blog/posts/...html`** — Vercel needs the path to exactly match.
  Check that `proxy_pass` ends with a trailing slash AND `/blog/` in the
  location block also has a trailing slash. Both must match.
- **Mixed content / HTTPS warnings** — make sure `X-Forwarded-Proto https` is
  set; this tells the blog it's being served over HTTPS.
- **Images broken** — confirm `proxy_redirect off;` is in the block, otherwise
  Vercel-side redirects can rewrite paths incorrectly.
- **WordPress catches the path before Nginx does** — the `^~` prefix in
  `location ^~ /blog/` tells Nginx "match this prefix and stop looking",
  which beats the default WordPress catch-all. If WordPress still hijacks
  `/blog/`, ask Cloudways support to add the rule directly to the
  server-level config (not the app-level).

---

## (Legacy) Deploying with a `blog.` subdomain

This is the older approach — not recommended for SEO, kept here as reference.

1. **Create a Vercel project** linked to this GitHub repo.
   - Framework preset: **Other** (it's a static site).
   - No build command. Output directory: `.` (project root).
   - Hit **Deploy**.

2. **Add the domain** in the Vercel project → Settings → Domains:
   - Add `blog.hubsolutions.one`.

3. **DNS** — at whichever registrar holds `hubsolutions.one`, add:

   ```
   Type:  CNAME
   Name:  blog
   Value: cname.vercel-dns.com
   ```

   (Vercel will show you the exact target on the Domains screen if it differs.)

4. Wait for DNS to propagate (usually minutes). Vercel issues an HTTPS cert
   automatically.

5. **Done.** Every `git push` to `main` redeploys the blog.

---

## Conventions for new posts

- **Slugs** — lowercase, hyphenated, no dates (`why-geo-matters-for-saas`, not `2026-05-why-geo-matters.html`).
- **Dates** — ISO `YYYY-MM-DD` in `posts.json` and the `article:published_time` meta tag.
- **Highlights** — wrap key phrases in `<span class="hl">…</span>` (amber underline).
- **Visuals** — every post must include at least one in-content visual built in
  HTML/CSS/SVG. No stock photos. Stat cards, charts, comparison columns, query
  chips, dot grids, callouts, pull quotes — pick whichever genuinely illustrate
  the section.
- **FAQs** — exactly 5. The accordion in the body AND the `FAQPage` JSON-LD at
  the top of the file must be in sync.
- **CTAs** — one mid-article and one final, both pointing to
  `https://geo.hubsolutions.one`.
