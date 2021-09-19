---
description: The simple tutorial how to use ngi-sync
---

# First Use

## **Create the config**

Go to your project folder and create sync-config.yaml first: ****

```text
ngi-sync init
```

After that you will have :

* xxx\_sync-config.yaml or sync-config.yaml **\(if start from empty project\)** : ****This is a config file for connecting to the server. Rename it to sync-config.yaml

```bash
D:\workspaces\sample>ngi-sync init
You are in: D:\workspaces\sample
Initialize Bootstrap Is Done!
[ undefined, undefined ]
---------------------------------------------------
  Replace xxx_sync-config.yaml to sync-config.yaml
---------------------------------------------------

D:\workspaces\sample>
```

* **.sync\_ignore** This file ignores some file or extension file while sync to the server. The principle is same like .ignore file on git

```bash
.sync_ignore 
sync-config.yaml 
sync-config.yml 
.sync_temp
```

Then open the file, and edit some config to connecting to your server

```bash
project_name: Your project name
username: root
privateKey: C:/Users/donny/.ssh/openssh_nopassword.key
host: 127.0.0.2
port: 22
localPath: D:/workspaces/sample
remotePath: /root/workspaces/sample_project
ignores: []
downloads: []
single_sync: []
trigger_permission:
  unlink_folder: true
  unlink: true
  change: true
  add: true
direct_access:
  config_file: ""
  ssh_configs:
    - Host: sample_project_connection
      HostName: =host
      User: =username
      Port: =port
      RequestTty: force
      IdentityFile: =privateKey
      StrictHostKeyChecking: no
      RemoteCommand: cd =remotePath && bash -l
      ServerAliveInterval: 300
      ServerAliveCountMax: 2
  ssh_commands:
    # This command for use create folder project on server first
    - access_name: Create folder on server
      command: ssh -v -o RemoteCommand=none sample_project_connection -t mkdir =remotePath
    # This command for enter to the server and go to project folder
    - access_name: Enter to Server
      command: ssh -v -o RemoteCommand=none sample_project_connection
```

With this config we have **ssh\_command** that we use to connect to the server

```bash
  ssh_commands:
    # This command for use create folder project on server first
    - access_name: Create folder on server
      command: ssh -v -o RemoteCommand=none sample_project_connection -t mkdir =remotePath
    # This command for enter to the server and go to project folder
    - access_name: Enter to Server
      command: ssh -v sample_project_connection
```

## **Run the ngi-sync**

Make sure your config is valid as a yaml file. Better go to [http://www.yamllint.com](http://www.yamllint.com/)

```bash
D:\workspaces\sample>ngi-sync
You are in: D:\workspaces\sample
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Direct Access List : (Press <enter> to submit)
> Create folder on server
  Enter to Server
  console :: Open Console
  devsync :: Open Devsync
  devsync2 :: Open Devsync2
  clean :: Git clean up : git add --renormalize . && git reset
  Restart
```

#### **Here the following rules:**

* Submit the first command because we need to create a folder first on the server.
* Run ngi-sync again and submit the devsync2 command `devsync :: Open Devsync`. And next choose the first option `safe_sync :: DevSync Basic ...`. It will start synchronizing our code to the server project folder continuously.

```bash
D:\workspaces\sample>ngi-sync
You are in: D:\workspaces\sample
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Direct Access List : devsync2 :: Open Devsync2
? Enter again ⎆:
 ⫸  Initializing...
extra_command null
? Devsync Mode : (Use arrow keys)
> safe_sync :: DevSync Basic Safe Syncronise
  - Trigger by edit file :)
  safe_sync_non_force :: DevSync Basic with non force file
  - Trigger by edit file :). Ignored file not activated except pull sync
  - Caution : This mode will take a long time indexing the file. and need more consume RAM
  safe_pull_sync :: devsync Pull Syncronise
  - This feature only download by your base template
(Move up and down to reveal more choices)
```

* Create file hello\_word.js on our local side with this body and save it

```bash
console.log("Hello world")
```

* When you create and update the hello\_world.js It will sync to the server directly and keep it running.

```bash
? Devsync Mode : safe_sync :: DevSync Basic Safe Syncronise
  - Trigger by edit file :)
 ⫸  Initializing...
rsync command ->  rsync -avzL --size-only --checksum --rsh="ssh -i C:/Users/donny/.ssh/openssh_nopassword.key -p 22" --exclude=sync-config.yaml --exclude=.sync_ignore --exclude=.sync_ignore\  --exclude=sync-config.yaml\  --exclude=sync-config.yml\  --exclude=.sync_temp
 --exclude=.sync_temp root@127.0.0.2:/root/workspaces/sample_project/ ./
This rsync lacks old-style --compress due to its external zlib.  Try -zz.
Continuing without compression.

receiving incremental file list
./

sent 163 bytes  received 43 bytes  137.33 bytes/sec
total size is 0  speedup is 0.00
 ⫸  SFTP-WATCHER ::
-------------------------------------
 ⫸  Initializing...                              Connected 127.0.0.2
-------------------------------------
-------------------------------------
Started monitoring
Quit the script with CONTROL-C".
-----------------------------------------------------------
 ⫸  ENTRY : ADD                                     ✓ Done
 ⫸  ADD :: UPLOADING                                ✓ Done
 ⫸  ENTRY : CHANGE                                  ✓ Done
 ⫸  CHANGED :: UPLOADING                            ✓ Done
```

* Open new command prompt or terminal and Run ngi-sync again and choose recent project folder just open before, if you are not right place project folder.

```bash
C:\Users\donny>ngi-sync
You are in: C:\Users\donny
Initialize Bootstrap Is Done!
[ undefined, undefined ]
Config file not found

USAGE:
Make sure you have the config file by running.
ngi-sync init
------------------------------
For more details please visit. https://github.com/rolldone/ngi-sync
-----------------------------------------------------------------------------
Display recent workspaces :
? Display open recent : (Press <enter> to submit)
> recent : D:/workspaces/sample
  --------------------------------------
  sample : D:/workspaces/sample
```

* It will jump to the project folder directly. And will display the next main menu, choose second menu.

```bash
> Enter to Server
```

* Ok we will enter to the server and check the file that we create it hello\_world.js

```bash
root@ubuntu-focal:~/workspaces/sample_project# ls
hello_word.js
root@ubuntu-focal:~/workspaces/sample_project#
```

Ok that's a basic use for sync our code to the server. And next we will learn a advanced sync our code to the server. For now better we learn which every option on sync-config.yaml  


