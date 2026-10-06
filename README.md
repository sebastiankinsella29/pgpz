# VEIL ARG portal

This is a static frontend with a Netlify Function that checks access and level answers. Puzzle answers are never included in browser code.

## Deploy

Deploy this repository with Netlify. GitHub Pages can host static files, but it cannot execute the validation function or protect answers. Use GitHub as the source repository and Netlify as the site host so `/.netlify/functions/validate-answer` is same-origin.

In Netlify, add these environment variables under **Site configuration → Environment variables**, then redeploy:

- `ARG_ENTRY_PASSWORD`: the entry passphrase you chose
- `ARG_LEVEL_1_ANSWER` through `ARG_LEVEL_7_ANSWER`: each level's answer
- `ARG_LEVEL_1_DOC` through `ARG_LEVEL_7_DOC`: each level's Google Docs URL, including the initial Level 1 brief

The function reveals only the next level's document URL after a correct answer. Answers are compared case-insensitively after trimming whitespace. Keep the answer variables scoped to the Netlify Functions runtime where that option is available; do not add them to frontend/build variables or commit them to this repository.

Until the environment variables are configured, validation intentionally returns a setup message. Locally, the function can be exercised with the Netlify CLI using `netlify dev` after installing the CLI.
