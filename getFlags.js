const Axios = require("axios")
const Path = require("path")
const xpath = require('xpath')
    , Dom = require('xmldom').DOMParser
const Fs = require("fs")

const _CONFIG = {
    'flagSize': "40px",
    'dataPath': './generatedData'
}

async function analyseWikipediaPage() {
    const data = await Axios.get("https://en.wikipedia.org/wiki/ISO_3166-1")
    const doc = new Dom().parseFromString(data.data)

    const nodes = xpath.select("/html/body/div[3]/div[3]/div[5]/div[1]/table[2]", doc)

    let node;
    let result;

    const imgs = []
    result = xpath.evaluate(".//img/@src", nodes[0], null, xpath.XPathResult.ANY_TYPE, null)
    node = result.iterateNext();
    while (node) {
        imgs.push(node.textContent)
        node = result.iterateNext();
    }


    const contryNames = []
    result = xpath.evaluate(".//td[1]", nodes[0], null, xpath.XPathResult.ANY_TYPE, null)
    node = result.iterateNext();
    while (node) {
        contryNames.push(node.textContent)
        node = result.iterateNext();
    }

    const shortNames = []
    result = xpath.evaluate(".//td[2]", nodes[0], null, xpath.XPathResult.ANY_TYPE, null)
    node = result.iterateNext();
    while (node) {
        shortNames.push(node.textContent)
        node = result.iterateNext();
    }

    return {
        'shortnames': shortNames,
        'longnames': contryNames,
        'flags': imgs
    }
}

async function downloadSingleFlag(url, path) {
    const writer = Fs.createWriteStream(path)

    const response = await Axios({
        url,
        method: 'GET',
        responseType: 'stream'
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

async function downloadFlags(metadata) {

    for (let i in metadata.flags) {
        const filename = metadata.shortnames[i].toLowerCase() + '_.png'
        const path = Path.resolve(_CONFIG.dataPath, 'flags', filename)
        Fs.mkdirSync(Path.dirname(path), {recursive: true})
        console.log(`  [${i}/${metadata.flags.length}] Downloading `, filename, ' in ', path, '...')
        await downloadSingleFlag(metadata.flags[i], path)
    }
}

async function normalizeContent(metadata) {

    metadata.flags = metadata.flags.map((url) => ('https:' + url).replace(/\d+px-/gm, `${_CONFIG.flagSize}-`))
    metadata.longnames = metadata.longnames.map((longname) => longname.trim())
    return metadata
}

async function generateXML(metadata) {
    const fileContent = []

    fileContent.push("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
        "<resources>\n" +
        "    <string-array name=\"countryCodes\" >")

    for (let i in metadata.longnames) {
        const value = metadata.longnames[i] + '|' + metadata.shortnames[i]
        fileContent.push(`<item>${value}</item>`)
    }

    fileContent.push("    </string-array>\n" +
        "</resources>")

    await Fs.writeFileSync(
        Path.resolve(_CONFIG.dataPath, 'arrays.xml'),
        fileContent.join('\n')
    );

}

async function main() {
    console.log("[1/5] Get raw content from the wikipedia page")
    result = await analyseWikipediaPage()
    console.log("[2/5] Reformat and clean raw content")
    result = await normalizeContent(result)
    console.log("[3/5] Print the number of country found ")
    console.log("  Number of flags: ", result.flags.length)
    console.log("  Number of Country names: ", result.longnames.length)
    console.log("  Number of Country bigrams: ", result.shortnames.length)

    console.log("[4/5] Downloading flags for each county...")
    await downloadFlags(result)
    console.log("[5/5] Generate XML file with all country names")
    await generateXML(result)
    console.log("[OK] Generated files can be found in ", _CONFIG.dataPath)

}

main()


