import mammoth from "mammoth";
import TurndownService from "turndown";
import { chunk } from "llm-chunk";

function chunkText(text: string) {
    return chunk(text, {
        minLength: 1000,
        maxLength: 2000,
        splitter: "paragraph",
        overlap: 200,
    });
}

export async function convertDocxToHtml(filePath: string): Promise<string> {
    return await mammoth.convertToHtml({ path: filePath }).then((result) => result.value);
}


export async function convertHtmlToMarkdownChunks(html: string): Promise<string[]> {

    const turndownService = new TurndownService({
        headingStyle: "atx", // use # for headings
    });

    const markdown = turndownService.turndown(html);

    const markdownChunks = chunkText(markdown);

    console.log("Split document into", markdownChunks.length, "chunks")

    return markdownChunks;
}