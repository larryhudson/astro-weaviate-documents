import type { EmbeddedClient } from "weaviate-ts-embedded";
import { createBrainstorm, createBrainstormMessage } from "./crud";

const DOCUMENT_CLASS = {
  class: "Document",
  description: "Documents",
  properties: [
    {
      name: "userId",
      dataType: ["number"],
      description: "User ID",
    },
    {
      name: "filename",
      dataType: ["text"],
      description: "Document title",
    },
    {
      name: "filepath",
      dataType: ["text"],
      description: "File path",
      moduleConfig: {
        "text2vec-openai": {
          skip: true,
        },
      },
    },
    {
      name: "filetype",
      dataType: ["text"],
      description: "File type",
      moduleConfig: {
        "text2vec-openai": {
          skip: true,
        },
      },
    },
    {
      name: "summary",
      dataType: ["text"],
      description: "Document summary",
    },
    {
      name: "createdAt",
      dataType: ["date"],
      description: "Created at",
    },
  ]
}

const DOCUMENT_CHUNK_CLASS = {
  class: "DocumentChunk",
  description: "Document chunks",
  properties: [
    {
      name: "title",
      dataType: ["text"],
      description: "Title",
    },
    {
      name: "content",
      dataType: ["text"],
      description: "Content",
    },
    {
      name: "hasDocument",
      dataType: ["Document"],
      description: "Document",
    },
    {
      name: "createdAt",
      dataType: ["date"],
      description: "Created at",
    }
  ]
}

const DOCUMENT_TAG_CLASS = {
  class: "DocumentTag",
  description: "Document tags",
  properties: [
    {
      name: "name",
      dataType: ["text"],
      description: "Tag name",
    },
    {
      name: "userId",
      dataType: ["number"],
      description: "User ID",
    },
    {
      name: "hasDocuments",
      dataType: ["Document"],
      description: "Document",
    },
  ]
}

// async function addSeedData() {
//   for (const brainstorm of SEED_BRAINSTORMS) {
//     const createdBrainstorm = await createBrainstorm({
//       userId: brainstorm.userId,
//       title: brainstorm.title
//     });

//     const createdBrainstormId = createdBrainstorm.id as string;

//     for (const message of brainstorm.messages) {
//       await createBrainstormMessage({
//         brainstormId: createdBrainstormId,
//         role: message.role,
//         content: message.content,
//       });
//     }

//   }
// }

export async function initialiseSchema(weaviateClient: EmbeddedClient) {

  const documentSchemaExists = await weaviateClient.schema.exists(DOCUMENT_CLASS.class);

  if (!documentSchemaExists) {
    await weaviateClient.schema.classCreator().withClass(DOCUMENT_CLASS).do();

    const documentChunkSchemaExists = await weaviateClient.schema.exists(DOCUMENT_CHUNK_CLASS.class);

    if (!documentChunkSchemaExists) {
      await weaviateClient.schema.classCreator().withClass(DOCUMENT_CHUNK_CLASS).do();
    }

    // add reference from Document to DocumentChunk
    await weaviateClient.schema
      .propertyCreator()
      .withClassName("Document")
      .withProperty({
        name: "hasChunks",
        dataType: ["DocumentChunk"],
        description: "Document chunks",
      })
      .do();

    const documentTagSchemaExists = await weaviateClient.schema.exists(DOCUMENT_TAG_CLASS.class);

    if (!documentTagSchemaExists) {
      await weaviateClient.schema.classCreator().withClass(DOCUMENT_TAG_CLASS).do();
    }

    // add reference from Document to DocumentTag
    await weaviateClient.schema
      .propertyCreator()
      .withClassName("Document")
      .withProperty({
        name: "hasTags",
        dataType: ["DocumentTag"],
        description: "Document tags",
      })
      .do();
  }

  // await addSeedData();
}