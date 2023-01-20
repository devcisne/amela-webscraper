import axios from "axios";
import * as cheerio from "cheerio";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let url = "https://www.descubre.vc/";

const withDB = async (operations) => {
  const dbName = "amela-webscraper-dev";

  // const url = "mongodb://127.0.0.1:27017";
  const url = `mongodb+srv://${process.env.MONGOUSER}:${process.env.MONGOPASS}@personalwebsite.r9tnm38.mongodb.net/?retryWrites=true&w=majority`;

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    const db = client.db(dbName);
    const collection = db.collection("companies");

    let operationResult = await operations(collection);
    client.close();
    return operationResult;
  } catch (error) {
    console.log(
      `The following error was found with the DB operation: ${error}`
    );
  }
};

const getCompaniesInfoArr = async () => {
  let result = await withDB(async (collection) => {
    return await collection
      .find()
      .toArray()
      .then((companiesInfoArr) => {
        console.log("existing companiesInfoArr :", companiesInfoArr);
        return companiesInfoArr;
      })
      .catch((error) => {
        console.error(`The following error was found: ${error}`);
        return error;
      });
  });
  return result;
};

const containsObject = (list, obj) => {
  for (let i = 0; i < list.length; i++) {
    if (list[i].company == obj.company && list[i].amount == obj.amount) {
      console.log(
        `filtering company ${obj.company} from entries to insert for duplicate`
      );
      return true;
    }
  }
  return false;
};
const insertCompanies = async (companiesArr) => {
  return await withDB(async (collection) => {
    return await collection
      .insertMany(companiesArr)
      .then((insertResult) => {
        console.log("successfully inserted", insertResult);
        return insertResult;
      })
      .catch((error) => {
        console.error(`The following error was found: ${error}`);
        return error;
      });
  });
};

const processInfo = async (companiesInfoArr) => {
  await axios
    .get(url)
    .then(async (response) => {
      // console.log(response.data);
      const $ = cheerio.load(response.data);
      const selection = $("h2:contains('levantó')");
      let selectionArray = [];
      // selection.filter();
      // console.log(selection.length);
      if (selection.length) {
        let levantoObjArr = [];

        selection.each((i, element) => {
          let levantoObj = { links: [] };

          if (element.parent.attribs.class != "flex") {
            let contentUL = $(element.parent.parent.nextSibling)
              .find("ul")
              .html();
            levantoObj.content = contentUL.trim();

            let noticiaSpan = $(element.parent.parent.nextSibling.nextSibling)
              .find("a")
              .each((i, element) => {
                // console.log("el", $(element).attr("href"));
                levantoObj.links.push($(element).attr("href"));
              });
          }

          // console.log("wtf", noticiaSpan);
          let levantoString = $(element).text();
          var emojiRE = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
          levantoString = levantoString.replace(emojiRE, "").trim();
          // console.log(levantoString);
          levantoObj.company = levantoString.split(" ")[0];
          levantoObj.amount = levantoString.split(" ")[2];
          levantoObj.createdAt = new Date();

          if (!containsObject(companiesInfoArr, levantoObj)) {
            levantoObjArr.push(levantoObj);
          }
        });

        if (levantoObjArr.length > 0) {
          let insertedCompanies = await insertCompanies(levantoObjArr);
          console.log("insertedCompanies: ", insertedCompanies);
        } else {
          console.log("No new entries to insert in database");
        }
      }
    })
    .catch((err) => {
      console.log(`Request failed. error:`, err);
    });
};

// let companiesInfoArr = await getCompaniesInfoArr();
// await processInfo(companiesInfoArr);

export const handler = async (event) => {
  let companiesInfoArr = await getCompaniesInfoArr();
  await processInfo(companiesInfoArr);

  const response = {
    statusCode: 200,
    body: JSON.stringify(
      "The lambda function has completed running successfully"
    ),
  };
  return response;
};
