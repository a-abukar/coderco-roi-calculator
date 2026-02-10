## Deploying the CoderCo ROI Calculator (so anyone can use it)

Right now, if you run this locally you’ll see URLs like `http://localhost:8080/...`.
That works **only on your laptop**.

To share it with anyone, you need to host the static files and get a public URL like:
`https://roi.coderco.com/?s=28000&o=t&m=9&p=a`

This project is a **static site** (just HTML/CSS/JS), so deployment is easy.

---

### Option A (fastest): Netlify “drag & drop”

1. Go to Netlify and choose **Add new site → Deploy manually**
2. Drag the entire `coderco-roi-calculator/` folder into Netlify
3. Netlify gives you a public URL immediately

Then your **Copy shareable link** button will produce a link on that public domain.

---

### Option B: Cloudflare Pages (simple + fast)

1. Create a new Pages project
2. Connect your repo
3. Set the site root / output directory to `coderco-roi-calculator`
4. Deploy

---

### Option C: Vercel (static deploy)

1. Import your repo into Vercel
2. Set the root directory to `coderco-roi-calculator`
3. Deploy (no build command needed)

---

### Option D: GitHub Pages (if this is a GitHub repo)

You can deploy the folder via GitHub Pages (either as the root, or via a `/docs` style setup).
If you want this route, tell me how this repo is hosted and I’ll tailor the exact steps.

---

### After deploying

- Open the deployed site once (public URL)
- Enter some values
- Click **Copy shareable link**

Now the copied URL is shareable to anyone, because it points to the public domain.


