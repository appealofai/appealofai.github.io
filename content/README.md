# appealofai content

The setup is intentionally simple.

## What the site reads automatically

```text
content/articles.json
```

Only items with `"status": "published"` are used for the live Notes ticker.
Draft items can stay in the file later, but they will not appear in the ticker.

## What is still manual

Article pages are normal static HTML files in:

```text
articles/
```

That means the public site is predictable and easy to review. Nothing becomes a
published article until an HTML page exists and `content/articles.json` points to
it.

## Optional writing workspace

The draft folder is only for writing:

```text
content/drafts/
  article-id.txt
  article-id.sources.txt
  article-id.x.txt
```

- `.txt` is the website draft.
- `.sources.txt` is the source and claim checklist.
- `.x.txt` is the companion post for X.

The website does not read these files automatically.

## Current publishing shape

- `Journal`: the current front page.
- `Articles`: the archive of published notes.
- `About`: project context and contact route.

The website is the canonical archive. X is the distribution and conversation
layer. The X version should keep the same thesis, but it should be written
natively for the feed.
