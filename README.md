# spun

Deploy SSR apps with one command. Live in seconds, expires in 24 hours.

## Install

```
npm i -g spunrun
```

## Deploy

Run from any SSR project directory:

```
spun deploy
```

That's it. You'll get a live URL at `https://your-app.spun.run`.

No config, no SSH keys, no accounts. Deployments expire after 24 hours.

## Commands

```
spun deploy          # deploy current directory
spun deploy my-app   # deploy with a custom name
spun ls              # list your deployed apps
spun rm <name>       # remove an app
```

## Supported frameworks

Next.js, Remix, Nuxt, SvelteKit, Astro, TanStack Start, SolidStart, and any Node.js app with a `start` script.

## How it works

1. Detects your framework and package manager
2. Creates a source tarball (excludes `node_modules`, build artifacts)
3. Uploads to the build server
4. Server runs `install`, `build`, and starts your app with PM2
5. Provisions a TLS cert and returns your URL

## Limits

- Source must be under 10MB (no `node_modules`)
- Apps expire after 24 hours
- 2 concurrent builds on the server

## License

MIT
