import { Job, Worker } from "bullmq";
import { importDocx } from "./jobs/import-docx";

async function handleImportDocument(job: Job) {
    if (job.name === "importDocx") {
        return await importDocx(job.data);
    }
}

const redisOptions = {
    connection: {
        host: "127.0.0.1",
        port: 6379,
    },
}

const importDocumentWorker = new Worker("importDocument", handleImportDocument, redisOptions);

importDocumentWorker.on("active", (job) => {
    console.log(`${job.id} has started!`);
});

importDocumentWorker.on("completed", (job) => {
    console.log(`${job.id} has completed!`);
});

importDocumentWorker.on("failed", (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});