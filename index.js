const MongoClient = require("mongodb").MongoClient;
const elasticsearch = require("elasticsearch");
const readlineSync = require("readline-sync");
const chalk = require("chalk");
const delay = require("delay");
const fs = require("fs");

const options = {
    poolSize: 50,
    keepAlive: 15000,
    socketTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    useNewUrlParser: true,
    useUnifiedTopology: true
};

// Connection MongoDB URL
const url = "mongodb://127.0.0.1:27017/tdsmongodb";

// ElasticSearch Client
const esClient = new elasticsearch.Client({
    host: "localhost:9200"
});

const getDocument = (db, collections) =>
    new Promise((resolve, reject) => {
        const allRecords = db
            .collection(collections)
            .find({})
            .toArray();
        if (!allRecords) {
            reject("Error Mongo", allRecords);
        }

        resolve(allRecords);
    });

(async() => {
    console.log(`
    Please wait.
    Checking MongoDB connection.
   `);
    try {
        const client = await MongoClient.connect(url, options);

        const db = await client.db();
        const errorDoc = [];

        let allCollection;
        let success;

        const dataCol = [{name: "tds_customer_order_dosir_number_suggestion"}];
        allCollection = dataCol;

        console.log("Collection Total : ", allCollection.length + "\n");
        for (let index = 0; index < allCollection.length; index++) {
            const collection = allCollection[index];
            console.log(
                `Progress ${chalk.green(index + 1)} from ${chalk.green(
          allCollection.length
        )}`
            );
            console.log(`Getting document from collection : `, collection.name);
            await delay(5000);
            const document = await getDocument(db, collection.name);
            console.log(`Total document from collection : `, document.length);
            console.log(
                `Try inserting document ${chalk.green(
          collection.name
        )} to elasticsearch.`
            );
            try {
                if (document.length > 0) {
                    let insertToES;
                    for (let indexx = 0; indexx < document.length; indexx++) {
                        const doc = document[indexx]['_source'];
                        const count = indexx + 1;
                        let newDoc = {
                            userId: doc.userId ? doc.userId : '',
                            dosirNumber: doc.numberDosir ? doc.numberDosir : '',
                            serviceName: doc.serviceName ? doc.serviceName : '',
                            location: doc.location ? doc.location : '',
                            createdAt: doc.createdAt,
                            updatedAt: doc.updatedAt
                        }
                        console.log(
                            `Progress uploading document ${collection.name} ${chalk.green(
                count
              )} from ${chalk.green(document.length)}`
                        );
                        const body = [{
                                index: { _index: collection.name.toLowerCase(), _type: "doc", _id: document[indexx]['_id'] }
                            },
                            newDoc
                        ];
                        insertToES = await esClient.bulk({ body: body });
                        if (insertToES.errors == true) {
                            errorDoc.push({
                                document: collection.name,
                                data: JSON.stringify(newDoc),
                                reason: insertToES.items[0].index.error.reason
                            });
                        }
                    }
                    console.log(JSON.stringify(insertToES) + "\n");
                } else {
                    console.log(
                        `Oops Total document ${collection.name} = ${document.length}`
                    );
                    success = false;
                }
            } catch (e) {
                console.log("\n");
                console.log(
                    `Failed in progress  ${chalk.red(index + 1)} from ${chalk.green(
            allCollection.length
          )}`
                );
                console.log(`Error info : ${e}`);
                process.exit();
            }
        }

        if (errorDoc.length > 0) {
            console.log(`Error Trace : `);
            errorDoc.map(data => {
                console.log(
                    chalk.red(`
            Collection error : ${data.document}
            Data: ${data.data}
            Reason : ${data.reason}\n
        `)
                );
            });
            await fs.writeFileSync("logs.json", JSON.stringify(errorDoc, 0, 2));
            console.log(`Logs file saved as logs.json`);
            process.exit();
        } else if (success == false) {
            console.log(chalk.red("Failed!"));
        } else {
            console.log(chalk.green("Success!"));
            process.exit();
        }
    } catch (e) {
        console.log(
            `Error Connection, please check your connection and try again.`
        );
        console.log(chalk.red(`Error Info : ${e}`))
    }
})();