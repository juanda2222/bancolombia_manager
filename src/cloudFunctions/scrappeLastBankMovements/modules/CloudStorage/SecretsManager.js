

const fs = require('fs');
const path = require("path")
const {Storage} = require('@google-cloud/storage');

// constants relative to the gcp project
const SECRET_BUCKET_NAME = "secret_files_bucket"


class SecretsManager{

    constructor() {

        //create the accesible data based on promises
        this.are_files_downloaded = new Promise( (resolve, reject) =>  {
            this.resolve_download = resolve
            this.reject_download = reject
        })

        //Create the google storage manager
        this.storage = new Storage();

        //create the cloud storage constanst needed
        this.credentials_dir_path = path.normalize(path.dirname(require.main.filename)+"/credentials")

        // create the promises fot the secure data info
        this.secureBucket = this.storage.bucket(SECRET_BUCKET_NAME);
        
    }
      
    /**
     * This will download the secrets.json file from the credentials folder
     * @returns {Promise<JSON.Object>}  Returns parsed file after the promise 
     */

    get_secrets_as_json = async () => {

        const json_secrets = JSON.parse( (await this.download_file("credentials/secrets.json")).toString() )
        return json_secrets
    }

    /**
     * This will save all the credentials files on a folder named credentials in root
     * @returns {Promise}       Returns texts after the promise 
     */
    
    save_all_secrets = async () => {
        
        console.debug(">> Saving credentials here: "+ this.credentials_dir_path)
        
        if (!fs.existsSync(this.credentials_dir_path)){
            fs.mkdirSync(this.credentials_dir_path);
            console.debug("> dir created!")
            
            // create the oauth2
            var file_path = this.credentials_dir_path+`/oauth2_client.json`
            var bucket_path = `credentials/oauth2_client.json`
            var oauth2_client = await this.download_file(bucket_path)
            fs.writeFileSync(file_path, oauth2_client);
            
            // create the oauth2
            var file_path = this.credentials_dir_path+`/juan_email_creds.json`
            var bucket_path = `credentials/juan_email_creds.json`
            var juan_email_creds = await this.download_file(bucket_path)
            fs.writeFileSync(file_path, juan_email_creds);

            // create the oauth2
            var file_path = this.credentials_dir_path+`/secrets.json`
            var bucket_path = `credentials/secrets.json`
            var secrets = await this.download_file(bucket_path)
            fs.writeFileSync(file_path, secrets);

            console.debug("> files created!")
            this.resolve_download(true)
            return "Directory downloaded"
        }else{
            this.resolve_download(true)
            return "Directory already created"
        }
        
    }
    
    /**
     * This will return the json file without parsing
     */
    download_file = async (bucket_file_path) => {

        const file = this.secureBucket.file(bucket_file_path)
    
        return new Promise((fulfill, reject) =>  {
            file.download( (err, fileContents) => {
                if (err) {
                    console.log(`error downloading file: ${err}`)
                    reject(`error downloading file: ${err}`)
                } else {
                    fulfill(fileContents)
                }
            })
        })
    };
  }

  
module.exports = SecretsManager


