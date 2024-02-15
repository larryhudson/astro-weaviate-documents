import { weaviateClient } from "@src/weaviate/client";
import { convertDocxToHtml, convertHtmlToMarkdownChunks } from "@src/extractors/docx";

export async function importDocx({
    uploadPath,
    filename,
    filetype,
    userId,
    tagIds,
    currentDate
}: {
    uploadPath: string,
    filename: string,
    filetype: string,
    userId: number,
    tagIds: string[],
    currentDate: string
}) {
    console.log("Importing document from this path:", uploadPath)

    const htmlContent = await convertDocxToHtml(uploadPath);

    // create the document in weaviate
    const createdDocument = await weaviateClient.data.creator()
        .withClassName("Document")
        .withProperties({
            filename,
            userId,
            filepath: uploadPath,
            filetype,
            htmlContent,
            createdAt: currentDate
        }).do();


    // TODO: this should happen in a background task, rather than within the HTTP request
    const markdownChunks = await convertHtmlToMarkdownChunks(htmlContent);

    // create a DocumentChunk for each markdown chunk
    for (const [index, chunk] of markdownChunks.entries()) {
        const createdChunk = await weaviateClient.data.creator()
            .withClassName("DocumentChunk")
            .withProperties({
                title: `Chunk ${index + 1}`,
                content: chunk
            }).do();

        // add a reference from the chunk to the document
        await weaviateClient.data.referenceCreator()
            .withClassName("Document")
            .withId(createdDocument.id as string)
            .withReferenceProperty("hasChunks")
            .withReference(
                weaviateClient.data
                    .referencePayloadBuilder()
                    .withClassName("DocumentChunk")
                    .withId(createdChunk.id as string)
                    .payload()
            )
            .do();

        // add a reference from the document to the chunk
        await weaviateClient.data.referenceCreator()
            .withClassName("DocumentChunk")
            .withId(createdChunk.id as string)
            .withReferenceProperty("hasDocument")
            .withReference(
                weaviateClient.data
                    .referencePayloadBuilder()
                    .withClassName("Document")
                    .withId(createdDocument.id as string)
                    .payload()
            )
            .do();
    }

    if (tagIds.length > 0) {
        for (const tagId of tagIds) {
            await weaviateClient.data.referenceCreator()
                .withClassName("Document")
                .withId(createdDocument.id as string)
                .withReferenceProperty("hasTags")
                .withReference(
                    weaviateClient.data
                        .referencePayloadBuilder()
                        .withClassName("DocumentTag")
                        .withId(tagId)
                        .payload()
                )
                .do();

            await weaviateClient.data.referenceCreator()
                .withClassName("DocumentTag")
                .withId(tagId)
                .withReferenceProperty("hasDocuments")
                .withReference(
                    weaviateClient.data
                        .referencePayloadBuilder()
                        .withClassName("Document")
                        .withId(createdDocument.id as string)
                        .payload()
                )
                .do();
        }
    }

    return createdDocument
}