## CoderCo ROI Calculator (static site)

A simple, dependency-free ROI calculator website you can host anywhere.

### Run locally

From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

### Share it with anyone (public URL)

Localhost links only work on your machine. To share the calculator publicly, deploy this static folder and use the public URL.

See `DEPLOYMENT.md`.

### Notes

- Salary defaults use the guidance you gave: average student earns **~£55k after 6–12 months** in the program.
- Pricing used (from the knowledge base):
  - Standard: **$199/month**
  - Premium: **$1999 upfront**
  - Premium instalments: **$799 × 3**
- The UI is **GBP-first** for visitors: it shows an estimated GBP equivalent (priced in USD) using a default USD→GBP exchange rate, with an optional “Advanced” override.
- This is an informational calculator only. It includes a “no guaranteed outcomes” disclaimer aligned to the T&Cs.


