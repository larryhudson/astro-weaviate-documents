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

export async function getTagsForUser(userId: number) {
    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("DocumentTag")
        .withFields("name _additional { id }")
        .withWhere({
            path: ["userId"],
            operator: "Equal",
            valueNumber: userId
        })
        .do();

    const tags = queryResponse.data.Get.DocumentTag.map((tag) => {
        return {
            id: tag._additional.id,
            name: tag.name
        }
    })

    return tags;
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
            hasTags {
                ... on DocumentTag {
                    _additional { id }
                    name
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

export async function getTagWithDocumentsById({ tagId }: { tagId: string }) {
    const queryResponse = await weaviateClient.graphql
        .get()
        .withClassName("DocumentTag")
        .withFields(`
            name
            hasDocuments {
                ... on Document {
                    filename
                    _additional { id }
                }
            }
            _additional {
                id
            }
        `)
        .withWhere({
            path: ["id"],
            operator: "Equal",
            valueString: tagId
        })
        .do();

    if (queryResponse.data.Get.DocumentTag.length === 0) {
        return null;
    }

    const tagObj = queryResponse.data.Get.DocumentTag[0];

    return tagObj;

}

export async function searchDocuments({
    searchQuery,
    tagFilter,
    generativeType,
    generativePrompt
}: {
    searchQuery: string
    tagFilter: string | null
    generativeType: "" | "grouped-task" | "single-prompt"
    generativePrompt: string
}) {
    let query = weaviateClient.graphql
        .get()
        .withClassName("DocumentChunk")
        .withFields("title content hasDocument { ... on Document { filename } }")
        .withLimit(5)
        .withHybrid({
            query: searchQuery,
        })

    if (tagFilter) {
        query = query
            .withWhere({
                path: ["hasDocument", "Document", "hasTags", "DocumentTag", "id"],
                operator: "Equal",
                valueString: tagFilter
            })
    }

    if (generativeType === "grouped-task") {
        query = query.withGenerate({ groupedTask: generativePrompt })
    } else if (generativeType === "single-prompt") {
        query = query.withGenerate({ singlePrompt: generativePrompt })
    }

    const queryResponse = await query.do();

    const documentChunks = queryResponse.data.Get.DocumentChunk

    return documentChunks;
}