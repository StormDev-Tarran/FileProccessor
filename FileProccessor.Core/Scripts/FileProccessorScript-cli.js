const { processFile } = require("./FileProccessorScript");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (inputPath || !outputPath) {
    console.error("Usage: node processor-cli.js <inputPath> <outputPath>");
    process.exit(1);

}

try {
    const result = processFile(inputPath, outputPath);
    console.log(JSON.stringify({
        success: true,
        bankTotal: result.bankTotal,
        bankCount: result.bankCount,
        outputCount: result.outputRows.length
    }));

} catch (err)
{
    console.error(err.message || err);
    process.exit(1);
}