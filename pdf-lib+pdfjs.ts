import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// This assigns rough proportional weights to characters to fix the "m" / "w" cutoff issue
function getWeightedLength(str: string): number {
    let weight = 0;
    // Narrow characters (approx half width)
    const narrow = 'iltfjI1.,-\'’"!()[]{}\\/ ';
    // Wide characters (approx 1.5x width)
    const wide = 'mwMWOQ@';

    for (const char of str) {
        if (narrow.includes(char)) {
            weight += 0.5;
        } else if (wide.includes(char)) {
            weight += 1.5;
        } else {
            weight += 1.0;
        }
    }
    return weight === 0 ? 1 : weight; // Prevent divide by zero
}


export async function annotatePDFWithPdfJs(
    pdfBuffer: Buffer,
    keyPhrases: string[],
    keywordStyle: 'highlight' | 'underline' = 'highlight'
) {
    const style = keywordStyle.toLowerCase();
    if (style !== 'highlight' && style !== 'underline') {
        throw new Error('Annotation style not supported. Use "highlight" or "underline".');
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        const pdfLibPage = pdfDoc.getPages()[pageIndex];

        for (const item of textContent.items as any[]) {
            const str = item.str;
            const lowerStr = str.toLowerCase();

            for (const phrase of keyPhrases) {
                const lowerPhrase = phrase.toLowerCase();
                let startIndex = lowerStr.indexOf(lowerPhrase);

                while (startIndex !== -1) {
                    // 1. USE WEIGHTED MATH INSTEAD OF NAIVE AVERAGES
                    const totalWeight = getWeightedLength(str);
                    const widthPerUnit = item.width / totalWeight;

                    // Calculate weight of the text coming BEFORE our target word
                    const textBefore = str.substring(0, startIndex);
                    const weightBefore = getWeightedLength(textBefore);

                    // 2. CALCULATE OFFSETS
                    const rawXOffset = weightBefore * widthPerUnit;

                    // Pull back slightly (by half a standard unit) for safety margin
                    const xOffset = Math.max(0, rawXOffset - (widthPerUnit * 0.5));

                    // Calculate the width of the target word itself
                    const phraseWeight = getWeightedLength(phrase);
                    // Add padding to the end (1 full unit) to ensure the last letter is covered
                    const matchWidth = (phraseWeight * widthPerUnit) + (widthPerUnit * 1.0);

                    // 3. APPLY TRANSFORMS
                    const tx = pdfjsLib.Util.transform(
                        viewport.transform,
                        item.transform
                    );

                    const x = tx[4] + xOffset;
                    const y = tx[5];

                    const correctedY = viewport.height - y;
                    const height = item.height || Math.abs(tx[3]) || 12;

                    // 4. DRAW
                    if (style === 'highlight') {
                        pdfLibPage.drawRectangle({
                            x: x,
                            y: correctedY - (height * 0.2),
                            width: matchWidth,
                            height: height * 1.2,
                            color: rgb(1, 1, 0),
                            opacity: 0.4,
                        });
                    } else if (style === 'underline') {
                        const underlineY = correctedY - (height * 0.1);
                        pdfLibPage.drawLine({
                            start: { x: x, y: underlineY },
                            end: { x: x + matchWidth, y: underlineY },
                            thickness: 1.5,
                            color: rgb(0, 0.8, 0),
                            opacity: 1.0,
                        });
                    }

                    // Look for the next occurrence in the same line/chunk
                    startIndex = lowerStr.indexOf(lowerPhrase, startIndex + phrase.length);
                }
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}
