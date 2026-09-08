Product Planr UI

Vite + React client for Product Planr.

To run the client locally:

1. cd product-planr
2. npm install
3. npm run dev

The API is a separate project at
`/Users/will/Projects/ProductPlanr/product-planr-server`.

In a second terminal:

1. `cd /Users/will/Projects/ProductPlanr/product-planr-server`
2. `npm install`
3. `npm run dev`

The API listens on port `3001` and stores SQLite data in its own `data/`
directory. Vite proxies `/api` requests to it. Set `PORT` or
`DATABASE_PATH` in the API terminal to override the defaults.

The client includes the interactive graph editor, authentication, multiple
named graphs, and debounced persistence through the local API.
