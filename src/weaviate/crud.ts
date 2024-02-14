import { weaviateClient } from "./client";
import { convertDocxToMarkdownChunks } from "@src/extractors/docx";
import path from "path";
import fs from "fs";

export async function createTag({
    userId,
    name
}: {
    userId: number,
    name: string
}) {
    const createdTag = await weaviateClient.data.creator()
        .withClassName("DocumentTag")
        .withProperties({
            userId,
            name
        }).do();

    return createdTag;
}

export async function deleteTag({ tagId }) {
    const tagObj = await weaviateClient.data.getterById().withClassName("DocumentTag").withId(tagId).do();
    const documentIds = tagObj.properties.hasDocuments.map((document) => document.beacon.split("/").at(-1));

    for (const documentId of documentIds) {
        console.log("Deleting reference from document to tag")
        console.log("Document ID", documentId)
        await deleteReference({
            fromClass: "Document",
            fromId: documentId,
            fromProperty: "hasTags",
            toClass: "DocumentTag",
            toId: tagId
        });
    }

    const tag = await weaviateClient.data.deleter().withClassName("DocumentTag").withId(tagId).do();
    return tag;
}

export async function uploadDocument({
    fileBuffer,
    filename,
    filetype,
    userId,
    tagIds }: {
        fileBuffer: Buffer,
        filename: string,
        filetype: string,
        userId: number,
        tagIds: string[]
    }) {
    const currentDate = new Date().toISOString();

    const diskFilename = `${currentDate}_${filename}`;
    console.log({ diskFilename, filename, filetype })

    const allowedFiletypes = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

    if (!allowedFiletypes.includes(filetype)) {
        throw new Error("Invalid file type. Allowed filetypes are: .doc, .docx");
    }

    // write the file buffer to the uploads folder
    const uploadsFolder = path.join(".", "uploads");

    // sort of hacky
    try {
        await fs.promises.access(uploadsFolder);
    } catch (error) {
        await fs.promises.mkdir(uploadsFolder);
    }

    const uploadPath = path.join(uploadsFolder, diskFilename);

    await fs.promises.writeFile(uploadPath, fileBuffer);


    // create the document in weaviate
    const createdDocument = await weaviateClient.data.creator()
        .withClassName("Document")
        .withProperties({
            filename,
            userId,
            filepath: uploadPath,
            filetype,
            createdAt: currentDate
        }).do();

    // TODO: this should happen in a background task, rather than within the HTTP request
    const markdownChunks = await convertDocxToMarkdownChunks(uploadPath);

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

async function deleteDocumentChunks({ documentId }: { documentId: string }) {
    const documentObj = await weaviateClient.data.getterById().withClassName("Document").withId(documentId).do();
    if (!documentObj.properties.hasChunks) {
        return;
    }
    console.log("Here's the document object from the getterById")
    console.log(JSON.stringify(documentObj, null, 2))
    const documentChunkIds = documentObj.properties.hasChunks.map((chunk) => chunk.beacon.split("/").at(-1));

    for (const chunkId of documentChunkIds) {
        await weaviateClient.data.deleter().withClassName("DocumentChunk").withId(chunkId).do();
    }
}

async function deleteFileFromUploadsFolder(filePath: string) {
    if (!filePath) {
        throw new Error("File not found");
    }

    const isInsideUploadsFolder = filePath.includes("uploads");

    if (!isInsideUploadsFolder) {
        throw new Error("Invalid file path");
    }

    try {
        const fileExists = await fs.promises.access(filePath)

        console.log({ fileExists })

        await fs.promises.rm(filePath);
    } catch (error) {
        console.log("Error deleting file", error);
    }

}

export async function deleteDocument({ documentId }: { documentId: string }) {
    const documentObj = await weaviateClient.data.getterById().withClassName("Document").withId(documentId).do();
    const filePath = documentObj.properties.filepath;

    await deleteFileFromUploadsFolder(filePath);

    await deleteDocumentChunks({ documentId });

    const document = await weaviateClient.data.deleter().withClassName("Document").withId(documentId).do();
    return document;
}

async function deleteReference({ fromClass, fromId, fromProperty, toClass, toId }: { fromClass: string, fromId: string, fromProperty: string, toClass: string, toId: string }) {
    await weaviateClient.data.referenceDeleter()
        .withClassName(fromClass)
        .withId(fromId)
        .withReferenceProperty(fromProperty)
        .withReference(
            weaviateClient.data.referencePayloadBuilder()
                .withClassName(toClass)
                .withId(toId)
                .payload()
        )
        .do();
}