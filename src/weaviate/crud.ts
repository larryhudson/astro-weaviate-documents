import { weaviateClient } from "./client";
import { getBrainstormMessageById } from "./query";
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

export async function createBrainstorm({ userId, title }: { userId: number, title: string }) {
    const createdBrainstorm = await weaviateClient.data.creator()
        .withClassName("Brainstorm")
        .withProperties({
            userId,
            title
        }).do();

    const defaultCoachMessage = "What do you want to brainstorm?";

    // create a default message for the brainstorm
    await createBrainstormMessage({
        brainstormId: createdBrainstorm.id as string,
        role: "assistant",
        content: defaultCoachMessage
    });

    return createdBrainstorm;
}

type BrainstormMessage = {
    role: string;
    content: string;
    _additional: {
        id: string;
    }
}

export async function getLastMessageIdInBrainstorm({ brainstormId }: { brainstormId: string }): Promise<BrainstormMessage> {
    const queryResponse = await weaviateClient.graphql.get()
        .withClassName("BrainstormMessage")
        .withWhere(
            {
                path: ["hasBrainstorm", "Brainstorm", "id"],
                operator: "Equal",
                valueString: brainstormId
            }
        )
        .withFields("role content _additional { id }")
        .withSort([
            {
                path: ["createdAt"],
                order: "desc"
            }
        ])
        .withLimit(1)
        .do();

    return queryResponse.data.Get.BrainstormMessage[0]._additional.id;
}

export async function createBrainstormMessage({ brainstormId, role, content }: { brainstormId: string, role: string, content: string }) {
    const currentDate = new Date().toISOString();

    const createdMessage = await weaviateClient.data.creator()
        .withClassName("BrainstormMessage")
        .withProperties({
            role,
            content,
            createdAt: currentDate
        }).do();

    // add a reference from the message to the brainstorm
    await weaviateClient.data.referenceCreator()
        .withClassName("Brainstorm")
        .withId(brainstormId)
        .withReferenceProperty("hasMessages")
        .withReference(
            weaviateClient.data
                .referencePayloadBuilder()
                .withClassName("BrainstormMessage")
                .withId(createdMessage.id as string)
                .payload()
        )
        .do();

    // add a reference from the brainstorm to the message
    await weaviateClient.data.referenceCreator()
        .withClassName("BrainstormMessage")
        .withId(createdMessage.id as string)
        .withReferenceProperty("hasBrainstorm")
        .withReference(
            weaviateClient.data
                .referencePayloadBuilder()
                .withClassName("Brainstorm")
                .withId(brainstormId)
                .payload()
        )
        .do();

    return createdMessage;
}

export async function updateBrainstormSummary({ brainstormId, summary }: { brainstormId: string, summary: string }) {
    const updatedBrainstorm = await weaviateClient.data.merger()
        .withClassName("Brainstorm")
        .withId(brainstormId)
        .withProperties({
            summary
        }).do();

    return updatedBrainstorm;
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

export async function deleteBrainstorm({ brainstormId }: { brainstormId: string }) {
    // lookup message IDs
    const messageQueryResponse = await weaviateClient.graphql.get()
        .withClassName("BrainstormMessage")
        .withWhere({
            path: ["hasBrainstorm", "Brainstorm", "id"],
            operator: "Equal",
            valueString: brainstormId
        })
        .withFields("hasBrainstorm { ... on Brainstorm { _additional { id } } } _additional { id }")
        .do();

    const messageIds = messageQueryResponse.data.Get.BrainstormMessage.map((message: { _additional: { id: string } }) => message._additional.id);

    await deleteBrainstormMessages({
        brainstormId,
        messageIds
    });

    await weaviateClient.data.deleter().withClassName("Brainstorm").withId(brainstormId).do();
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

export async function deleteBrainstormMessages({ brainstormId, messageIds }: { brainstormId: string, messageIds: string[] }) {

    // remove the references from the messages to the brainstorm
    for (const messageId of messageIds) {
        // not sure if we need to do this
        await deleteReference({
            fromClass: "BrainstormMessage",
            fromId: messageId,
            fromProperty: "hasBrainstorm",
            toClass: "Brainstorm",
            toId: brainstormId
        });
        await deleteReference({
            fromClass: "Brainstorm",
            fromId: brainstormId,
            fromProperty: "hasMessages",
            toClass: "BrainstormMessage",
            toId: messageId
        });
    }

    if (messageIds.length > 0) {
        await weaviateClient.batch.objectsBatchDeleter()
            .withClassName("BrainstormMessage")
            .withWhere({
                path: ["id"],
                operator: "ContainsAny",
                valueTextArray: messageIds
            })
            .do();
    }
}


export async function deleteMessageAndNewer({ brainstormId, brainstormMessageId }: { brainstormId: string, brainstormMessageId: string }) {
    const brainstormMessage = await getBrainstormMessageById({ brainstormMessageId });
    if (!brainstormMessage) {
        throw new Error("Message not found");
    }

    const thisMessageId = brainstormMessage.id;
    const createdAt = brainstormMessage.properties.createdAt;

    // query to find messages newer than the one to delete
    const newerMessagesResponse = await weaviateClient.graphql.get()
        .withClassName("BrainstormMessage")
        .withWhere({
            operator: "And",
            operands: [
                {
                    path: ["createdAt"],
                    operator: "GreaterThan",
                    valueDate: createdAt
                },
                {
                    path: ["hasBrainstorm", "Brainstorm", "id"],
                    operator: "Equal",
                    valueString: brainstormId
                }
            ]
        })
        .withFields("hasBrainstorm { ... on Brainstorm {  _additional { id } } } _additional { id }")
        .do();

    const newerMessageIds = newerMessagesResponse.data.Get.BrainstormMessage.map((message: { _additional: { id: string } }) => message._additional.id);

    const messageIdsToDelete = [thisMessageId, ...newerMessageIds];

    await deleteBrainstormMessages({
        brainstormId,
        messageIds: messageIdsToDelete
    })
}