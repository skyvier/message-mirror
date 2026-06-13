# message-mirror

## Development

Enter the pinned development shell:

```sh
nix develop
```

The shell provides the basic TypeScript toolchain:

- Node.js
- pnpm
- TypeScript compiler
- TypeScript language server
- Biome formatter/linter
- jq for JSON fixture work

Quick checks:

```sh
nix develop --command node --version
nix develop --command pnpm --version
nix develop --command tsc --version
nix develop --command typescript-language-server --version
nix develop --command biome --version
```
