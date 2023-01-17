import axios from "axios";
import * as cheerio from "cheerio";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let url = "https://www.descubre.vc/?page=2";

const getWebContent = async (url) => {
  try {
    return await axios.get(url);
  } catch (error) {
    console.log(`Request failed. error:`, error.response);
  }
};

const withDB = async (operations) => {
  const dbName = "amela-webscraper-dev";

  // const url = "mongodb://127.0.0.1:27017";
  const url = `mongodb+srv://${process.env.MONGOUSER}:${process.env.MONGOPASS}@personalwebsite.r9tnm38.mongodb.net/?retryWrites=true&w=majority`;
  console.log(url);

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    const db = client.db(dbName);
    const collection = db.collection("companies");

    await operations(collection);
    client.close();
  } catch (error) {
    console.log(
      `The following error was found with the DB operation: ${error}`
    );
  }
};

getWebContent(url)
  .then((response) => {
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
        levantoObjArr.push(levantoObj);
        // here
      });

      withDB(async (collection) => {
        await collection
          .insertMany(levantoObjArr)
          .then((insertResult) => {
            console.log(insertResult);
          })
          .catch((error) => {
            console.error(`The following error was found: ${error}`);
          });
      });

      console.log(levantoObjArr);
    }
  })
  .catch((err) => {
    console.log(`Request failed. error:`, err);
  });
