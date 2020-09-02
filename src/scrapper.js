
//https://rominirani.com/using-puppeteer-in-google-cloud-functions-809a14856e14
const puppeteer = require('puppeteer');
const fs = require("fs")
const path = require("path")
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');



const input_password_keyboard_image_path = path.join(__dirname, "temp", 'screenshot.jpg')
const secrets_path = path.join(__dirname, '..', 'credentials', 'secrets.json')
const input_number_button_box_size = 38 // px
const input_number_button_margin = 4 // px


async function main () {

  // read the secrets
  const secrets_json = JSON.parse(fs.readFileSync(secrets_path))

  // set up puppeteer browser
  let browser = await puppeteer.launch(
    {headless:false}
  );
  let page = await browser.newPage();
  await page.setViewport({ width: 700, height: 1200});
  await page.goto('https://sucursalpersonas.transaccionesbancolombia.com/mua/initAuthProcess');

  // log in 
  await page.$eval('input[id="username"]', (el, localValue) => el.value = localValue, secrets_json.username);
  await page.$eval( 'button[id="btnGo"]', form => form.click() );
  
  // Get a picture of the page keyboard:
  let keyboard_object = await page.waitForSelector('table[id="_KEYBRD"]')
  await page.waitForSelector('input[id="password"]')
  await page.$eval( 'area[class="cursorContrast"]', form => form.click() );
  await keyboard_object.screenshot({
    path: input_password_keyboard_image_path
  });

  // Load the tesseract Computer vision objects
  const worker = createWorker();
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  // Loop all 10 different numbers to slice, recognize and create a coordinates dictionary: 
  let keyboard_number_coordinates_map = {}
  for ( let index = 0; index < 10; index++ ) {

    let offset_x = (index % 3) * input_number_button_box_size + ((index % 3) + 1) * input_number_button_margin 
    let offset_y = Math.floor(index / 3) * input_number_button_box_size + (Math.floor(index / 3) + 1) * input_number_button_margin 
    let input_password_keyboard__current_button_image_path = path.join(__dirname, "temp", `screenshot_${index}.jpg`)

    // Slice the picture to 10 different pictures with each button to improve tesseract results
    await new Promise((fulfill, reject) =>  {
      sharp(input_password_keyboard_image_path).extract({ 
        width: input_number_button_box_size, 
        height: input_number_button_box_size, 
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
    console.log(filtered_result_number)
    keyboard_number_coordinates_map[filtered_result_number] = {
      x: offset_x + ( input_number_button_box_size / 2 ), 
      y: offset_y + ( input_number_button_box_size / 2 ), 
    }
  }

  await worker.terminate();  
  console.log(keyboard_number_coordinates_map)
  
  // input the password with clicks and submit:
  let keyboard_coordinates = await keyboard_object.boundingBox()
  console.log("keyboard boundaries: ", keyboard_coordinates)
  secrets_json.password.split("").forEach( async (password_digit) => {
    await page.mouse.click( 
      keyboard_coordinates.x + keyboard_number_coordinates_map[password_digit].x , 
      keyboard_coordinates.y + keyboard_number_coordinates_map[password_digit].y
    )
  });
  await page.$eval( 'input[id="btnGo"]', form => form.click() );
  
  // get the iframe with the page content
  await page.waitForSelector('iframe[id="ifrm"]')
  console.log("iframe loaded")
  const frame = await page.frames().find(f => f.name() === 'ifrm');
  

  // open the account last movements
  await frame.waitForSelector('div[id="accaccount0"')
  console.log("selector loaded")
  await frame.$eval( 'div[id="accaccount0"]', form => form.click() );
  await frame.waitForSelector('a[id="mov_assets_option"]')
  await frame.$eval( 'a[id="mov_assets_option"]', form => form.click() );
  

  // get the information from the table:
  await frame.waitForSelector('table[id="gridDetail_savings"]')
  let account_history_html_table = await frame.evaluate(
    () => document.querySelector('table[id="gridDetail_savings"]').innerHTML
  );
  console.log(account_history_html_table)

  //await browser.close();

  
}


main()