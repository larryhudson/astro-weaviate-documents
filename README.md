# `astro-weaviate-documents`

This is a project to build a searchable document database with Astro and Weaviate. It's a work in progress. 

This is based on my other project [astro-weaviate-brainstorm](https://github.com/larryhudson/astro-weaviate-brainstorm).

I will flesh out this README soon.

## How does this work?
- This is an Astro web app that uses the `@astrojs/node` adapter to render the web app on the server.
- The database is an [embedded instance of Weaviate](https://weaviate.io/developers/weaviate/installation/embedded) that runs within the same process as the Astro web server. When the Weaviate client is imported within the Astro application code, it sets up a dedicated Weaviate instance and connects to it.
- When the Weaviate instance is initialised, it creates the `Document` and `DocumentChunk` classes.
- The user uses the web app to upload documents. 

## How to get started
- Clone this Git repository. `cd` into the directory and run `npm install` to install the dependencies.
- Duplicate `.env.sample` to `.env` and edit with your OpenAI API key. 
- Run `npm run dev` to start up the local dev server. 
- Go to [http://localhost:4321](http://localhost:4321) in your web browser.