import { Queue } from "bullmq";

export const queue = new Queue("importDocument", {
    connection: {
        host: "127.0.0.1",
        port: 6379,
    }
});