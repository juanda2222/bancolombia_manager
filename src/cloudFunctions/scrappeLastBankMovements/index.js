
//https://rominirani.com/using-puppeteer-in-google-cloud-functions-809a14856e14
const puppeteer = require('puppeteer');
const fs = require("fs")
const path = require("path")
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const tabletojson = require('tabletojson').Tabletojson;
const SecretsManager = require("./modules/CloudStorage/SecretsManager")

// constants relative to bancolombias password pad
const INPUT_PASSWORD_KEYBOARD_IMAGE_PATH = path.join(__dirname, "temp", 'screenshot.jpg')
const INPUT_NUMBER_BUTTON_BOX_SIZE = 38  //px
const INPUT_NUMBER_BUTTON_MARGIN = 4  //px


/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 * scrapper of the bank account las movements.
 *
 * @param {object} pubsubMessage The Cloud Pub/Sub Message object.
 * @param {string} pubsubMessage.data The "data" property of the Cloud Pub/Sub Message.
 */

async function scrappeLastBankMovements (pubsubMessage) {

  // download the files:
  const secretsManager = new SecretsManager()

  // read the secrets
  const secrets_json = await secretsManager.get_secrets_as_json()

  // set up puppeteer browser
  console.debug("Loading puppeteer...")
  let browser = await puppeteer.launch({
    headless: process.env.PRODUCTION == "true"
  });
  let page = await browser.newPage();
  await page.setViewport({ width: 700, height: 1200});
  await page.goto('https://sucursalpersonas.transaccionesbancolombia.com/mua/initAuthProcess');

  // log in 
  console.debug("Logging in...")
  await page.$eval(
    'input[id="username"]', 
    (el, localValue) => el.value = localValue, secrets_json.BANCOLOMBIA_PERSONAS_USERNAME
  );
  await page.$eval( 'button[id="btnGo"]', form => form.click() );
  
  // Get a picture of the page keyboard:
  console.debug("Taking screenshot...")
  let keyboard_object = await page.waitForSelector('table[id="_KEYBRD"]')
  await page.waitForSelector('input[id="password"]')
  await page.$eval( 'area[class="cursorContrast"]', form => form.click() );
  await keyboard_object.screenshot({
    path: INPUT_PASSWORD_KEYBOARD_IMAGE_PATH
  });

  // Load the tesseract Computer vision objects
  console.debug("Setting up tesseract...")
  const worker = createWorker();
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  // Loop all 10 different numbers to slice, recognize and create a coordinates dictionary: 
  console.debug("Image recognition started!")
  let keyboard_number_coordinates_map = {}
  for ( let index = 0; index < 10; index++ ) {

    let offset_x = (index % 3) * INPUT_NUMBER_BUTTON_BOX_SIZE + ((index % 3) + 1) * INPUT_NUMBER_BUTTON_MARGIN 
    let offset_y = Math.floor(index / 3) * INPUT_NUMBER_BUTTON_BOX_SIZE + (Math.floor(index / 3) + 1) * INPUT_NUMBER_BUTTON_MARGIN 
    let input_password_keyboard__current_button_image_path = path.join(__dirname, "temp", `screenshot_${index}.jpg`)

    // Slice the picture to 10 different pictures with each button to improve tesseract results
    await new Promise((fulfill, reject) =>  {
      sharp(INPUT_PASSWORD_KEYBOARD_IMAGE_PATH).extract({ 
        width: INPUT_NUMBER_BUTTON_BOX_SIZE, 
        height: INPUT_NUMBER_BUTTON_BOX_SIZE, 
        left: offset_x,
        top: offset_y,
      })
      .toFile(input_password_keyboard__current_button_image_path)
      .then(function(new_file_info) {
          console.log("Image cropped and saved!");
          fulfill()
      })
      .catch(function(err) {
          console.log("An error occurred", err);
          reject(err)
      });
    })

    // Get the text of the keyboard using machine vision:
    const { data } = await worker.recognize(input_password_keyboard__current_button_image_path); // text with next line and spaces

    // Map to a dictionary the coordinates
    let filtered_result_number = data.text.match(/[0-9]+/g)
    console.debug(filtered_result_number)
    keyboard_number_coordinates_map[filtered_result_number] = {
      x: offset_x + ( INPUT_NUMBER_BUTTON_BOX_SIZE / 2 ), 
      y: offset_y + ( INPUT_NUMBER_BUTTON_BOX_SIZE / 2 ), 
    }
  }
  await worker.terminate();  
  console.debug(keyboard_number_coordinates_map)
  
  // input the password with clicks and submit:
  console.debug("Submitting password...")
  let keyboard_coordinates = await keyboard_object.boundingBox()
  console.debug("keyboard boundaries: ", keyboard_coordinates)
  secrets_json.BANCOLOMBIA_PERSONAS_PASSWORD.split("").forEach( async (password_digit) => {
    await page.mouse.click( 
      keyboard_coordinates.x + keyboard_number_coordinates_map[password_digit].x , 
      keyboard_coordinates.y + keyboard_number_coordinates_map[password_digit].y
    )
  });
  await page.$eval( 'input[id="btnGo"]', form => form.click() );
  
  // get the iframe with the page content
  console.debug("Loading main iFrame...")
  await page.waitForSelector('iframe[id="ifrm"]')
  const frame = await page.frames().find(f => f.name() === 'ifrm');
  

  // open the account last movements
  console.debug("Opening the account movements...")
  await frame.waitForSelector('div[id="accaccount0"')
  await frame.$eval( 'div[id="accaccount0"]', form => form.click() );
  await frame.waitForSelector('a[id="mov_assets_option"]')
  await frame.$eval( 'a[id="mov_assets_option"]', form => form.click() );
  

  // get the information from the table:
  console.debug("Scrape the savings table...")
  await frame.waitForSelector('table[id="gridDetail_savings"]')
  await frame.waitForSelector('tr[id="1"]')
  let account_history_html_table = await frame.evaluate(
    () => document.querySelector('table[id="gridDetail_savings"]').innerHTML
  );

  // format the data to a json
  console.debug("Formatting scrapped html to json...")
  const converted = tabletojson.convert(`
    <html>
      <table>
        ${account_history_html_table}
      </table>
    </html>
  `);
  const table_columns = {
    '0': "fecha", 
    '1': "oficina", 
    '2': "descripcion", 
    '3': "referencia", 
    '4': "monto" 
  }
  converted[0][0] = table_columns // put tittles in the first index
  process.env.PRODUCTION == "true" && await browser.close();
  
  // Print out the data from Pub/Sub, to prove that it worked
  console.log(">> Message: " + Buffer.from(pubsubMessage.data, 'base64').toString());
  return converted
}

if (module === require.main) {
  scrappeLastBankMovements({
    data: Buffer.from("some test data passed to the cloud function through the pub-sub message")
  })
}

module.exports = {
  scrappeLastBankMovements
}