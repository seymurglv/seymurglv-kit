// Dev-server side of the collection: the showcase asks for the list over HTTP,
// so no tracked page ever imports a file from the probes folder.

import { collect } from './collect.mjs'

const ROUTE = '/showcase/collection.json'

/**
 * Answers GET /showcase/collection.json with the current list, read anew on every request.
 * @param {{ root: string, probes?: string }} options  the same options collect() takes
 * @returns {import('vite').Plugin}
 */
export function banuiCollection({ root, probes }) {
  return {
    name: 'banui-collection',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || req.url?.split('?')[0] !== ROUTE) return next()
        try {
          // dir is a path on this machine; the page only needs the url
          const items = collect({ root, probes }).map(({ dir, ...item }) => item)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(items))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
