# `@zxn/motion-mcp`

A [Model Context Protocol](https://modelcontextprotocol.io) server that teaches an AI agent to write good ZXN Motion films. It serves the same documentation and the same verified example films the website publishes, and checks the source an agent writes before anyone has to look at it.

Left alone, an agent builds character rain from a `<div>` per glyph, reaches for `Date.now()`, lets GSAP play itself, and copies a 4K project size. It cannot see the result, so it never finds out. This gives it the rules, the nearest working example, and a checker that catches all of those.

## Tools

| Tool | What it does |
| --- | --- |
| `authoring_rules` | The short list of rules for a film that is deterministic, fast and good-looking. Read first. |
| `search_docs` | Searches the docs and examples; returns the matching sections and recipes, best first. |
| `list_docs` / `read_doc` | The documentation topics, and one page in full. |
| `list_examples` / `get_example` | The verified example films, and one film's complete source. |
| `check_film` | Type-checks source against the real SDK and reports imports a film may not use and habits that make it slow or unrepeatable. Nothing is executed. |

## Run it

Not on npm yet, so from a clone:

```bash
git clone https://github.com/zinxan/motion-graphics.git
cd motion-graphics && npm install && npm run build
```

Claude Code:

```bash
claude mcp add zxn-motion -- node /absolute/path/to/motion-graphics/packages/mcp/dist/bin.js
```

Any client that reads an `mcpServers` map (`.mcp.json`, `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "zxn-motion": { "command": "node", "args": ["/absolute/path/to/motion-graphics/packages/mcp/dist/bin.js"] }
  }
}
```

See [Writing films with an AI agent](../../docs/ai-agents.md) for the workflow and a rules file to drop into a project.
