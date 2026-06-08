# appealofai content

This folder is intentionally simple.

The live site currently reads only one file automatically:

```text
content/articles.json
```

That file powers the moving `NOTES` ticker. If an item has a `tickerTitle`,
it can appear in the ticker. The full article text is not generated
automatically yet.

## Structure

```text
content/
  articles.json
  how-it-works.txt
  drafts/
    ai-culture-public-imagination.txt
    ai-culture-public-imagination.sources.txt
    ai-culture-public-imagination.x.txt
```

## Workflow

1. Write the article draft in `content/drafts/name.txt`.
2. Put source notes in `content/drafts/name.sources.txt`.
3. Put the companion post for 𝕏 in `content/drafts/name.x.txt`.
4. Add or update the public metadata in `content/articles.json`.
5. When ready, manually copy the final article into an HTML page.

Later, this can become automatic with a tiny build script. For now, keeping it
manual is safer and easier to edit.
