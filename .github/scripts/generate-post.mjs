// ============================================================
// generate-post.mjs
// Reads an issue (title + body) from env vars, asks Claude to draft a
// brand-styled blog post, writes the HTML + thumbnail + posts.json entry.
// The workflow then opens a PR with the changes.
// ============================================================

import fs from 'node:fs/promises';
import path from 'node:path';

// ------- Config -------
const MODEL = 'claude-sonnet-4-5';   // update if you migrate to a newer model
const MAX_TOKENS = 16000;
const ROOT = process.cwd();

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};

const ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY');
const ISSUE_TITLE = env('ISSUE_TITLE');
const ISSUE_BODY = process.env.ISSUE_BODY || '';
const ISSUE_NUMBER = env('ISSUE_NUMBER');

// ------- Read reference material so Claude matches the brand exactly -------
const templateHtml = await fs.readFile(path.join(ROOT, 'posts/_template.html'), 'utf8');
const exampleHtml = await fs.readFile(
  path.join(ROOT, 'posts/7-things-every-business-owner-must-know-about-geo.html'),
  'utf8'
);
const stylesCss = await fs.readFile(path.join(ROOT, 'styles.css'), 'utf8');

// ------- Build the system prompt -------
// (Marked with cache_control below — the reference material is reused
// across every post, so we cache it for ~90% cost reduction on the 2nd+ post.)
const systemPrompt = `
You are the in-house writer for Hub Solutions Digital — a small digital agency
that helps business owners win on AI-first search (GEO).

You write blog posts for blog.hubsolutions.one. Every post you produce must
match the brand voice, structural template, and visual style described below.

# Brand voice
- Confident, plain-English, business-owner friendly. No jargon. No fluff.
- Lead each section with the answer. One idea per paragraph.
- Bold takes. Strong hooks. Concrete examples.
- First-person plural ("we") sparingly; never "I".

# Brand visual system
- Colors: navy #1B2C6B, amber/gold #F5A623, white, light grey #F4F6FB.
- Font: General Sans (already linked in the template).
- Hero section is navy with a small eyebrow pill, large headline (the key phrase
  wrapped in <span class="hl">…</span> rendered amber), short sub-line, byline.
- Numbered sections 01, 02, 03… each with a section label, heading, prose.
- Highlight spans on key phrases inside body prose: <span class="hl">phrase</span>.
- In-content visuals built in HTML/CSS/SVG — never stock images. Pick whichever
  of these GENUINELY illustrate the topic:
    * stat-grid with stat-card (big number + small label)
    * chart-card with an SVG line chart drawn for the topic's actual data
    * compare (two columns — left = grey "old way", right = navy "new way")
    * chips-row with chip elements (example user queries)
    * pullquote (single line, amber left border)
    * callout (grey block, amber left border, starts with bold word)
- Mid-article CTA block + final CTA block, both navy with amber button linking
  to https://geo.hubsolutions.one.
- FAQ section with EXACTLY 5 questions in <details class="faq-item"> blocks.
- Related posts section (rendered by client JS — leave the markup as-is).

# Required SEO + schema
- <title>, <meta description>, canonical URL = https://blog.hubsolutions.one/posts/<slug>.html
- Open Graph tags (og:type=article, og:title, og:description, og:url, og:image).
- JSON-LD Article schema with headline, description, image, datePublished, author "Susan", publisher Hub Solutions Digital.
- JSON-LD FAQPage schema — the 5 questions MUST match the 5 in the <details> accordion verbatim.

# Structural rules
- File lives at posts/<slug>.html — links to styles use ../styles.css.
- Header links to ../index.html for Blog, https://hubsolutions.one for Home, and the amber CTA links to https://geo.hubsolutions.one.
- Footer same as the example.
- Include the same closing <script> block as the example (IntersectionObserver for fade-up + related-posts fetch).

# Reference: the exact template file
\`\`\`html
${templateHtml}
\`\`\`

# Reference: a fully-written example post in the correct style
\`\`\`html
${exampleHtml}
\`\`\`

# Reference: the brand stylesheet (so you know which classes exist)
\`\`\`css
${stylesCss}
\`\`\`

# Output format — strict
Return ONLY a single JSON object with these fields, no preamble, no markdown fence:
{
  "slug": "kebab-case-slug-derived-from-title",
  "date": "YYYY-MM-DD",            // today's date
  "excerpt": "1–2 sentence hook for the homepage card (≤180 chars)",
  "readingTime": "X min read",
  "thumbnailSvg": "<svg ...>…</svg>",   // brand-styled 800x450 SVG, navy bg, amber accent, headline-style typography. NO photos.
  "postHtml": "<!DOCTYPE html>…</html>"  // the COMPLETE post HTML file
}

The postHtml MUST:
- Be a complete, valid HTML5 document.
- Include all SEO + OG + JSON-LD blocks described above with real values.
- Have at least 5 numbered sections (01–05+) AND at least one in-content visual
  (stat-grid, chart-card, compare, or chips-row) that's tailored to the topic.
- Have exactly 5 <details class="faq-item"> blocks in the FAQ section, AND a
  matching FAQPage JSON-LD in the head. The 5 questions in both must be IDENTICAL.
- Have a mid-article cta-block AND a final cta-block, both linking to https://geo.hubsolutions.one.
- Be ready to ship — no placeholder text, no TODOs, no lorem ipsum.
`.trim();

// ------- Build the user message -------
const today = new Date().toISOString().slice(0, 10);
const userMessage = `
Today's date: ${today}

Write a new blog post.

Title (from the issue): ${ISSUE_TITLE.replace(/^\[Post\]\s*/i, '').trim()}

Topic / angle and any options (raw issue body):
"""
${ISSUE_BODY}
"""

Now produce the JSON object as specified.
`.trim();

// ------- Call Claude API -------
console.log(`[generate-post] calling Claude (${MODEL})…`);

const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      // cache_control: ephemeral → the (large) reference material is cached for
      // 5 minutes between calls, dropping cost ~90% on follow-up posts.
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
    ],
    messages: [
      { role: 'user', content: userMessage },
      // Prefill: forces the model to start with `{` so we reliably get JSON.
      { role: 'assistant', content: '{' }
    ]
  })
});

if (!apiRes.ok) {
  const errText = await apiRes.text();
  throw new Error(`Anthropic API ${apiRes.status}: ${errText}`);
}

const apiJson = await apiRes.json();
const cacheStats = apiJson.usage
  ? `(input ${apiJson.usage.input_tokens}, output ${apiJson.usage.output_tokens}, cache_read ${apiJson.usage.cache_read_input_tokens || 0}, cache_write ${apiJson.usage.cache_creation_input_tokens || 0})`
  : '';
console.log(`[generate-post] Claude returned ${cacheStats}`);

const raw = '{' + (apiJson.content?.[0]?.text || '');

// ------- Parse the JSON response -------
let post;
try {
  // Find the outermost {…} just in case the model added trailing text.
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  post = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
} catch (err) {
  console.error('Raw response:', raw.slice(0, 2000));
  throw new Error('Could not parse JSON from Claude response: ' + err.message);
}

const required = ['slug', 'date', 'excerpt', 'readingTime', 'thumbnailSvg', 'postHtml'];
for (const k of required) {
  if (!post[k]) throw new Error(`Claude response missing field: ${k}`);
}

// Belt-and-braces: validate exactly 5 FAQs in the rendered HTML
const faqCount = (post.postHtml.match(/<details\s+class="faq-item"/g) || []).length;
if (faqCount !== 5) {
  throw new Error(`Expected 5 FAQ items, got ${faqCount}. Aborting.`);
}

// ------- Write the files -------
const slug = post.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const postPath = path.join(ROOT, 'posts', `${slug}.html`);
const thumbPath = path.join(ROOT, 'images', `${slug}-thumb.svg`);

await fs.writeFile(postPath, post.postHtml, 'utf8');
await fs.writeFile(thumbPath, post.thumbnailSvg, 'utf8');
console.log(`[generate-post] wrote ${postPath}`);
console.log(`[generate-post] wrote ${thumbPath}`);

// ------- Prepend to posts.json -------
const postsJsonPath = path.join(ROOT, 'posts.json');
const posts = JSON.parse(await fs.readFile(postsJsonPath, 'utf8'));
// Remove any existing entry for this slug (idempotent re-runs)
const filtered = posts.filter((p) => p.slug !== slug);
const newEntry = {
  slug,
  title: ISSUE_TITLE.replace(/^\[Post\]\s*/i, '').trim(),
  date: post.date || today,
  excerpt: post.excerpt,
  thumbnail: `images/${slug}-thumb.svg`,
  readingTime: post.readingTime,
  link: `posts/${slug}.html`
};
filtered.unshift(newEntry);
await fs.writeFile(postsJsonPath, JSON.stringify(filtered, null, 2) + '\n', 'utf8');
console.log(`[generate-post] updated posts.json`);

// ------- Surface outputs to the workflow -------
const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  await fs.appendFile(
    ghOutput,
    `post_title=${newEntry.title}\nslug=${slug}\nreading_time=${post.readingTime}\n`
  );
}

console.log('[generate-post] done ✅');
