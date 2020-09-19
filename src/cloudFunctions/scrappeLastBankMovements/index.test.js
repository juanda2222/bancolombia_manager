const { scrappeLastBankMovements } = require('./index');


describe('Testing the cloud function "scrapperLastBankMovements"', () => {

    test('Declaration has no errors', () => {
        expect(scrappeLastBankMovements).toBeTruthy()
    })

    // only do the full test if the test is executed locally on the machine
    if (process.env.LOCAL_ENV) {

        test('Test run has no errors', async () => {

            jest.setTimeout(60000);
            const emulate_pub_sub_object = { data: Buffer.from("some emulated message data") }
            const last_movements_as_json = await scrappeLastBankMovements(emulate_pub_sub_object)
            console.log(last_movements_as_json)
            expect(last_movements_as_json.length).toBeGreaterThanOrEqual(0);

        })
    }
})