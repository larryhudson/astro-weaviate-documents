import { weaviateClient } from "./client";

export async function getDocumentsForUser(userId: number) {
    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("Document")
        .withFields("filename _additional { id }")
        .withWhere({
            path: ["userId"],
            operator: "Equal",
            valueNumber: userId
        })
        .do();

    const documents = queryResponse.data.Get.Document.map((document) => {
        return {
            id: document._additional.id,
            filename: document.filename
        }
    });

    return documents;
}



export async function getSimilarBrainstorms({
    brainstormId
}) {
    const brainstormInWeaviate = await getBrainstormFromWeaviateById({
        brainstormId
    });

    if (!brainstormInWeaviate) {
        return [];
    }

    const brainstormWeaviateId = brainstormInWeaviate._additional.id;

    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("Brainstorm")
        .withFields("brainstormId title _additional { distance }")
        .withNearObject({
            id: brainstormWeaviateId
        })
        .withWhere({
            path: ["brainstormId"],
            operator: "NotEqual",
            valueNumber: brainstormId
        })
        .do();

    const similarBrainstorms = queryResponse.data.Get.Brainstorm;

    return similarBrainstorms;
}

export async function getBrainstormById({
    brainstormId
}: {
    brainstormId: string
}) {

    const brainstormObj = await weaviateClient.data
        .getterById()
        .withClassName("Brainstorm")
        .withId(brainstormId)
        .withVector()
        .do();

    if (!brainstormObj) {
        return null;
    }

    return brainstormObj;
}

type BrainstormWithMessages = {
    title: string
    hasMessages: {
        role: string
        content: string
        _additional: {
            id: string
        }
    }[]
    _additional: {
        id: string
    }
}

type DocumentWithChunks = {
    filename: string
    hasChunks: {
        title: string
        content: string
        _additional: {
            id: string
        }
    }[]
    _additional: {
        id: string
    }
}

export async function getDocumentWithChunksById({
    documentId
}: {
    documentId: string
}): Promise<DocumentWithChunks> {

    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("Document")
        .withFields(`
            filename
            hasChunks {
                ... on DocumentChunk {
                    _additional { id }
                    title
                    content
                }
            }
            _additional {
                id
            }
        `)
        .withWhere({
            path: ["id"],
            operator: "Equal",
            valueString: documentId
        })
        .do();

    if (queryResponse.data.Get.Document.length === 0) {
        return null;
    }

    const documentObj = queryResponse.data.Get.Document[0];

    return documentObj;
}

export async function searchDocuments({
    searchQuery
}) {
    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("DocumentChunk")
        .withFields("title content hasDocument { ... on Document { filename } } _additional { id score explainScore  }")
        .withLimit(5)
        .withHybrid({
            query: searchQuery,
        })
        .do();

    const documentChunks = queryResponse.data.Get.DocumentChunk

    return documentChunks;
}

export async function getBrainstormMessageById({
    brainstormMessageId
}: {
    brainstormMessageId: string
}) {

    const brainstormMessageObj = await weaviateClient.data
        .getterById()
        .withClassName("BrainstormMessage")
        .withId(brainstormMessageId)
        .withVector()
        .do();

    if (!brainstormMessageObj) {
        return null;
    }

    return brainstormMessageObj;
}

