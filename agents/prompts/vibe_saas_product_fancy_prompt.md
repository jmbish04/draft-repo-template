# 🎯 Goal
When given a description, API endpoint, or repo link for a new Cloudflare Worker / AI system, evaluate the app’s purpose, data flows, and key user impact areas, then automatically generate a **cinematic landing page** that both documents and markets the system.

Use the aesthetic and structure of the **Vibe Engineer microsite** as the visual and tonal reference:  
modern TailwindCSS layout, strong section rhythm, gradient hero, scroll animations, and narrative-driven copy.

---

## 🔍 Step 1 — Analyze the App
- If a repo or endpoint is provided, **inspect the code or API spec** to understand:
  - The system’s function (e.g., orchestration, automation, data intelligence, workflow, etc.)
  - Key features, APIs, inputs/outputs
  - Real-world use cases or impact (e.g., reduces manual ops, improves accuracy, etc.)
- Identify 3–5 “value pillars” (why this system matters).
- Identify 2–3 “pain points” it solves.

---

## 🧱 Step 2 — Build the Content Blueprint
Create sections using this narrative structure:

1️⃣ **Hero Section (Gradient Background)**
   - Headline: bold one-liner summarizing what this system *changes* (“X redefines how teams do Y”)
   - Subhead: short 2–3 sentence value statement
   - 2 buttons: *Explore System* and *View API Spec*
   - Optional live stats: uptime %, request throughput, avg latency, or usage metrics

2️⃣ **Problem Section**
   - Title: “The Challenge It Solves”
   - Use 3–4 cards showing typical user pain points
   - Include small code or log snippet if relevant

3️⃣ **Solution Section**
   - Title: “How It Works”
   - Explain architecture in simple terms (e.g., Worker → Durable Object → D1)
   - Include a visual (ASCII diagram or SVG placeholder box)
   - Highlight reliability, scalability, and security aspects

4️⃣ **Feature Cards**
   - Grid of 4–6 cards each with:
     - Icon or emoji
     - Feature title
     - 1-sentence description
     - Optional tech tags (e.g., `Durable Objects`, `Workers AI`, `Vectorize`)

5️⃣ **Metrics / Impact**
   - Display quantitative or qualitative results in a 3-column stats bar
     - Examples: “+80% throughput,” “–90% manual tasks,” “99.99% uptime”
   - Each stat has a color-coded badge (emerald = positive, amber = caution)

6️⃣ **Use Cases**
   - Cards describing 3 concrete applications of the system (with persona-focused examples)

7️⃣ **Roadmap or Next Steps**
   - Title: “Where It’s Going Next”
   - Timeline layout: v1 → v2 → v3 milestones

8️⃣ **CTA / Footer**
   - Gradient background again
   - Closing quote or tagline (“The next era of automation starts here.”)
   - Buttons for *Try the API* / *View GitHub Repo* / *Join the Beta*

---

## 🎨 Step 3 — Style Requirements
- Use **TailwindCSS** (CDN ok).
- Typography: `Inter` or `Manrope`.
- Color palette:  
  - Primary: Indigo (`#4f46e5`)  
  - Secondary: Emerald (`#10b981`)  
  - Neutral base: Slate / Stone  
- Alternating section bands (`bg-white`, `bg-stone-50`, `bg-indigo-50`, `bg-emerald-50`).
- Include scroll-triggered `fade-in-up` animations via IntersectionObserver.
- Sticky glass nav bar with section highlighting.
- Optional Alpine.js for simple state (menu toggle, tab switch).

---

## 🧠 Step 4 — Tone and Writing
- Confident, technical, but inspiring — “Apple keynote meets Cloudflare docs.”
- Speak as if the system is explaining itself:  
  “I process millions of requests per day while staying under 50ms latency.”
- Blend documentation and storytelling (spec + marketing hybrid).

---

## 📦 Step 5 — Output Format
Deliver a single **HTML file**:
- Fully responsive (desktop → mobile)
- All animations inline (no dependencies except Tailwind + Alpine)
- Each major section wrapped in `<section id="...">` for nav highlighting
- Ready for drop-in deployment on any Worker domain

---

## 🧩 Optional Add-ons (if data available)
- Generate a “live metrics bar” pulling from `/metrics` endpoint
- Auto-extract feature list from `/openapi.json` or `/schema`
- Generate architecture diagram dynamically if repo includes `wrangler.toml` or `migrations.sql`

---

## ✅ Example Invocation
> “Analyze this Worker: https://core-task-manager-api.colby.workers.dev  
> Generate a landing page using this template to explain what it does, its architecture, and key impact areas.”

---

### 🧠 Output Expectations
A final HTML page similar in spirit to the *Vibe Engineer* site:
- gradient hero  
- smooth scroll  
- animated metrics  
- human-readable “spec as story” narrative  
- self-documenting structure ready for immediate deployment.
