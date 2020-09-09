

import os
import subprocess
import shlex

from pathlib import Path

PROJECT_ID = "bancolombia-manager-dashboard"
PROJECT_NAME = "Bancolombias account manager"
BILLING_ACCOUNT = "015438-E1A05A-684E0E"
REGION = "us-central"
GET_LAST_MOVEMENTS__PUBSUB_TOPIC = "read_and_respond_wa_messages"
GET_LAST_MOVEMENTS__TOPIC_PATH = "projects/{}/topics/{}".format(PROJECT_ID, GET_LAST_MOVEMENTS__PUBSUB_TOPIC)

REPOSITORY_NAME = "bancolombia_manager"
REPOSITORY_OWNER = "juanda2222"


# (stdoutdata, stderrdata) = process.communicate() # this is a blocking command
def create_and_configure_project():

    commands = [
    'gcloud projects create {} \
    --name="{}"'.format(PROJECT_ID, PROJECT_NAME),

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
                                #stdin =subprocess.PIPE, # to input dynamically
                                text=True,
                                shell=True) # this means is an executable progrAM
        
        print('------>> Return Code:', process.returncode)
 

def create_cron_job():

    commands = [
        #create an app engine instance (needed to the scheduler)
        "gcloud app create \
        --project={} \
        --region={}".format(PROJECT_ID, REGION),

        #create the scheduler (will create a pubsub topic)
        # for cron testing use https://crontab.guru/
        """ \
        gcloud scheduler jobs create pubsub \
        readAndRespondMessagesSignal \
        --schedule="0 11,22 * * *" \
        --topic={} \
        --project={} \
        --message-body="Robot is up and ready to read the messages"
        """.format(GET_LAST_MOVEMENTS__TOPIC_PATH, PROJECT_ID)
    ]

    # execute commands
    for command in commands:
        process = subprocess.run(command, 
                                #stdin =subprocess.PIPE, # to input dynamically
                                text=True,
                                shell=True) # this means is an executable program
        
        print('------>> Return Code:', process.returncode)
    

def deploy_scrappeLastBankMovements_function():

    function_folder_path = Path("./read_and_respond_messages")

    command = """ \
     gcloud functions deploy read_and_respond_messages \
    --runtime python37 \
    --project={} \
    --source="{}" \
    --trigger-topic {} \
    --set-env-vars PRODUCTION=True \
    --retry \
    --timeout=400s \
    """.format(
        PROJECT_ID,
        function_folder_path,
        GET_LAST_MOVEMENTS__TOPIC_PATH
        )
    process = subprocess.run(command, 
                                #stdin =subprocess.PIPE, # to input dynamically
                                text=True,
                                shell=True) # this means is an executable program
        
    print('------>> Return Code:', process.returncode)


def create_cloud_build_trigger_from_github():

    function_folder_path = Path("./on_message_received")

    command = """ \
    gcloud beta builds triggers create github \
    --name="trigger_by_master_push" \
    --repo-owner="{}" \
    --repo-name="{}" \
    --pull-request-pattern="^master$" \
    --build-config="cloudbuild.yaml" \
    """.format(
        REPOSITORY_NAME,
        REPOSITORY_OWNER
    )
    process = subprocess.run(command, 
                                #stdin =subprocess.PIPE, # to input dynamically
                                stdout=subprocess.PIPE,
                                text=True,
                                shell=True) # this means is an executable program

    if process.returncode is not None:
        print(process.stdout)
        
        # search the line with the url
        for line in process.stdout.split("\n"):
            if "url" in line:
                on_message_received_url = line.split(": ")[1]
                print("Url obtained: ", on_message_received_url)
                #on_message_received_url = filter(lambda char: "" if char is 
    
    print('------>> Return Code:', process.returncode)


def execute_free_form_command(command:str):
    process = subprocess.Popen(command, 
                            #stdin=subprocess.PIPE, # to input dynamically
                            stdout=subprocess.PIPE,
                            text=True,
                            shell=True) # this means is an executable program


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
    #create_and_configure_project()
    #create_cron_job()
    #deploy_scrappeLastBankMovements_function()
    create_cloud_build_trigger_from_github()