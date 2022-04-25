const fs = require("fs");
const puppeteer = require("puppeteer");

const domain = "";

(async () => {
    if (!fs.existsSync("./output")){
        fs.mkdirSync("./output");
    }
    fs.readdirSync("./output").forEach(f => fs.unlinkSync("./output/" + f));

    const browser = await puppeteer.launch({"ignoreHTTPSErrors": true});
    const page = await browser.newPage();

    await Promise.all([
        page.coverage.startCSSCoverage(),
        page.coverage.startJSCoverage(),
    ]);

    async function scrape (scrapped, links) {
        let [url] = links;
        console.log(url);
        await page.goto(url);
        links.delete(url);
        scrapped.add(url);
        // now we scrape all 1st party links to get complete coverage
        let hrefs = await page.evaluate(() => {
            let hrefs = [];
            let elements = document.querySelectorAll('a');
            for (let element of elements) hrefs.push(element.href);
            return hrefs;
        });
        for (let href of hrefs) {
            let basic_link = href.split("?")[0];
            if (basic_link.startsWith("https://" + domain)) {
                if (!scrapped.has(basic_link) && !links.has(basic_link)) links.add(basic_link);
            }
        }
        console.log(scrapped, links);
        if (links.size > 0) await scrape(scrapped, links);
    }
    await scrape(new Set(), new Set(["https://" + domain]));

    const [css_coverage, js_coverage] = await Promise.all([
        page.coverage.stopCSSCoverage(),
        page.coverage.stopJSCoverage(),
    ]);

    for (const entry of [...css_coverage, ...js_coverage]) {
        // we can only change files we host
        if (entry.url.includes(domain)) {
            let split_path = entry.url.split("/");
            let filename = split_path.slice(split_path.indexOf(domain)+1).join("_").split("?")[0];

            if (filename.endsWith(".css") || filename.endsWith(".js")) {

                let content = "";
                for (const range of entry.ranges){
                    content += entry.text.slice(range.start, range.end) + "\n";
                }
                fs.writeFile("./output/" + filename, content, function(e) {
                   if (e) console.log(e);
                })
            }
        }
    }

    await browser.close();
})();
