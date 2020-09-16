

'''
    -------------------------------------
    -- Manual configuration is needed: --
    -------------------------------------

    1)  Connect the github repository to gcloud build here:
        https://console.cloud.google.com/cloud-build/triggers/connect?project=encoded-road-275921
        (this is not needed if we add a gcloud repository as remote)
        

'''


import os
import subprocess
import shlex

from pathlib import Path

PROJECT_ID = "bancolombia-manager-dashboard"
PROJECT_NAME = "Bancolombias account manager"
BILLING_ACCOUNT = "015438-E1A05A-684E0E"
REGION = "us-central"
GET_LAST_MOVEMENTS__PUBSUB_TOPIC = "read_and_respond_wa_messages"
GET_LAST_MOVEMENTS__TOPIC_PATH = "projects/{}/topics/{}".format(
    PROJECT_ID, GET_LAST_MOVEMENTS__PUBSUB_TOPIC)
SECRET_BUCKET_NAME = "secret_files_bucket"
REPOSITORY_NAME = "bancolombia_manager"
REPOSITORY_OWNER = "juanda2222"


# (stdoutdata, stderrdata) = process.communicate() # this is a blocking command
def create_and_configure_project():

    commands = [
        # create the project
        'gcloud projects create {} \
        --name="{}"'.format(PROJECT_ID, PROJECT_NAME),

        # add a billing account
        "gcloud beta billing projects link {} \
        --billing-account={}".format(PROJECT_ID, BILLING_ACCOUNT),

        # services needed
        "gcloud services enable \
        appengine.googleapis.com \
        cloudscheduler.googleapis.com \
        cloudfunctions.googleapis.com \
        cloudbuild.googleapis.com \
        --project={}".format(PROJECT_ID)
    ]

    # execute commands
    for command in commands:
        process = subprocess.run(command,
                                 # stdin =subprocess.PIPE, # to input dynamically
                                 text=True,
                                 shell=True)  # this means is an executable progrAM

        print('------>> Return Code:', process.returncode)


def create_cloud_build_trigger_from_github():

    command = ' \
    gcloud beta builds triggers create github \
    --repo-owner="{}" \
    --repo-name="{}" \
    --name="trigger-by-master-push" \
    --description="Default trigger from master branch" \
    --pull-request-pattern="^master$" \
    --build-config="cloudbuild.yaml" \
    --project="{}" \
    '.format(
        REPOSITORY_OWNER,
        REPOSITORY_NAME,
        PROJECT_ID
    )
    print(command)
    process = subprocess.run(command,
                             # stdin =subprocess.PIPE, # to input dynamically
                             text=True,
                             shell=True)  # this means is an executable program

    print('------>> Return Code:', process.returncode)


def create_cron_job():

    commands = [
        # create an app engine instance (needed to the scheduler)
        "gcloud app create \
        --project={} \
        --region={}".format(PROJECT_ID, REGION),

        # create the scheduler (will create a pubsub topic)
        # for cron testing use https://crontab.guru/
        ' \
        gcloud scheduler jobs create pubsub \
        readAndRespondMessagesSignal \
        --schedule="0 11,22 * * *" \
        --topic={} \
        --project={} \
        --message-body="Robot is up and ready to read the messages" \
        '.format(GET_LAST_MOVEMENTS__TOPIC_PATH, PROJECT_ID)
    ]

    # execute commands
    for command in commands:
        process = subprocess.run(command,
                                 # stdin =subprocess.PIPE, # to input dynamically
                                 text=True,
                                 shell=True)  # this means is an executable program

        print('------>> Return Code:', process.returncode)


def deploy_scrappeLastBankMovements_function():

    function_folder_path = Path(
        "./src/cloudFunctions/scrappeLastBankMovements")

    command = ' \
     gcloud functions deploy scrappeLastBankMovements \
    --runtime nodejs12 \
    --project={} \
    --source="{}" \
    --trigger-topic {} \
    --set-env-vars PRODUCTION=True \
    --retry \
    --timeout=400s \
    '.format(
        PROJECT_ID,
        function_folder_path,
        GET_LAST_MOVEMENTS__TOPIC_PATH
    )
    process = subprocess.run(command,
                             # stdin =subprocess.PIPE, # to input dynamically
                             text=True,
                             shell=True)  # this means is an executable program

    print('------>> Return Code:', process.returncode)


def create_secrets_bucket():

    command = "gsutil mb gs://{} \
            -p {} \
        ".format(
        SECRET_BUCKET_NAME,
        PROJECT_ID
    )

    process = subprocess.run(command,
                             # stdin =subprocess.PIPE, # to input dynamically
                             text=True,
                             shell=True)  # this means is an executable progrAM

    print('------>> Return Code:', process.returncode)


def upload_credentials_folder():

    credentials_folder_path = Path("./credentials")

    command = " \
        gsutil cp {} \
            gs://{}/ \
            -p {} \
    ".format(
        credentials_folder_path,
        SECRET_BUCKET_NAME,
        PROJECT_ID
    )

    process = subprocess.run(command,
                             # stdin =subprocess.PIPE, # to input dynamically
                             text=True,
                             shell=True)  # this means is an executable progrAM

    print('------>> Return Code:', process.returncode)


def execute_free_form_command(command: str):
    process = subprocess.Popen(command,
                               # stdin=subprocess.PIPE, # to input dynamically
                               stdout=subprocess.PIPE,
                               text=True,
                               shell=True)  # this means is an executable program

    while True:
        output = process.stdout.readline()
        print(output.strip())

        # Do something else with the return code
        return_code = process.poll()
        if return_code is not None:
            print('RETURN CODE', return_code)
            # Process has finished, read rest of the output
            for output in process.stdout.readlines():
                print(output.strip())
            break


if __name__ == "__main__":
    create_and_configure_project()
    # create_cloud_build_trigger_from_github()
    # create_cron_job()
    # create_secrets_bucket()
    # upload_credentials_folder()
    # deploy_scrappeLastBankMovements_function()
    
