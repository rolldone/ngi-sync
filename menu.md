---
description: Explanations each ngi-sync menu
---

# Menu

## **Init `ngi-sync init`**

Is used for create configuration for new project. After run this command you will get 2 files

* **.sync\_ignore** This file ignores some file or extension file while sync to the server. The principle is same like .ignore file on git
* **sync-config.yaml**  
  xxx\_sync-config.yaml or sync-config.yaml \(if start from empty project\)

  This is a config file for connecting to the server. Rename it to sync-config.yaml

## **Devsync `ngi-sync devsync`**

This is a main feature of this tool. There are a few menus with a few different techniques to sync. This tool uses rsync, ssh2, and chokidar as main work. Rsync is used when running for the first time and ssh2 used for simple upload and download when listening from a chokidar listener.

```bash
$ ngi-sync devsync
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
 ⫸  Initializing...
extra_command undefined
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

### **safe\_sync :: DevSync Basic Safe Synchronize**

* Trigger by edit file :\)

### **safe\_sync\_non\_force :: DevSync Basic with non force file**

* Trigger by edit file :\). Ignored file not activated except pull sync
* Caution : This mode will take a long time indexing the file. and need more consume RAM

### **safe\_pull\_sync :: devsync Pull Synchronize**

* This feature only download by your base template
* And ignore all file you define on config file and .sync\_ignore :\)

### **soft\_push\_sync :: DevSync Soft Push Data.**

* Your sensitive data will be safe on target :\)

### **force\_push\_sync :: DevSync Force Push Data**

* "DANGER : Your sensitive data will destroy if have no define \_ignore on your folder data on local :\("

### **force\_single\_sync :: DevSync Single Synchronize**

* You can download or upload a simple file or folder. This menu is call `ngi-sync singlesync`

### **A few response after you run this menu:**

* **WATCH ON SERVER SFTP ::**  Sftp Watch works for watch files or folders on the target remote. It's recursive every 1 minute to check simultan. It will stop if there is no activity from the chokidar listener.

```bash
 ⫸  SFTP-WATCHER ::                                Started
 ⫸  WATCH ON SERVER SFTP :"package.json"            ✓ Done
 ⫸  WATCH ON SERVER SFTP :"configuration.js"        ✓ Done
```

* **ENTRY : \[...ADD,CHANGE,UNLINK\] ::** Chokidar listens to file activity like create, update, delete. So every file gets updated it will put an entry first before uploading.

```bash
⫸  ENTRY : ADD                                     ✓ Done
⫸  ENTRY : CHANGE                                  ✓ Done
⫸  ENTRY : UNLINK                                  ✓ Done
```

* **\[...ADD, CHANGED, UNLINK\] ::** File will be uploaded if the file get an entry from chokidar. The upload is use ssh  ****

```bash
⫸  ADD :: UPLOADING                                ✓ Done
⫸  CHANGED :: UPLOADING                            ✓ Done
⫸  UNLINK :: DONE  D:/workspaces/artywiz-webapp/dist/a.txt
```

* **CHANGE ERR ::** Error response sometimes while file being uploaded or downloading.

```bash
⫸  CHANGE ERR :: [the file path] Fails File edited by system dont let uploaded.
```

```bash
⫸  UNLINK ERR :: D:/workspaces/artywiz-webapp/dist/48.page-editor.jersey.chunk.js Fails Error deleting file File could not be deleted or maybe just deleted from target.
```

### **How does work :**

![](https://lh5.googleusercontent.com/NjTLQkdVAFWnfs_Mj6D0M_JXQQubw06ZzOmmf8sz1LK_3l54z3A9iY_erxms7R1x-wLfxOC1LBd-9KauDiOYp35ViqHYkXTtHUI4EzjMjIoILYY-7Fxz2lum3r0ZmjAdhSo_dZ7H=s0)

Here the explained picture above on number:

1. Ngi-sync will explore each register directory or file simulant. Attention : just for the register directory or file that you defined. Each discovery will get modified time on file stats.
2. After that will check, is the file modified time is newer than the local file?. 
3. If yes, ngi-sync will allow the permission to download the file. And ngi-sync will record the file just downloaded, for help on checking uploading.
4. Every file gets changed, it will listen to events like add, change, and delete. And before upload will check if it exists on the record file downloaded is it there or not. If it exists, that prevents uploading.
5. Download will be allowed if you get permission on check condition on number 4.

## **Devsync2 `ngi-sync devsync2`**

This is a second feature. Like [`devsync` ](https://donny-rollproject.gitbook.io/ngi-sync/menu#devsync-ngi-sync-devsync)but the workflow is a bit different. Devsync2 is designed for two way sync and needs to install devsync\_remote on the remote side.  But the pros is there is no sftp watch remote running on the client side. Because the feature is run on the remote side, use chokidar to watch the registered folder or file. 

Every file change it will respond to client side via http request with reverse port between client server use ssh reverse port. 

### **How does work :**

![](https://lh5.googleusercontent.com/I6mYgcKuTfdbdvbI2cGkMi2WTSD0Nc_fifu3O64EHZzaJX8xB800NZop5o6YXPhNr_wevCECDgICtnM0Xo8C4xZJ3XceL767qjl03_mxHr5F9F0QbJ2Ewy388TdWDaw15xcL7-_A=s0)

Here the explained picture above on number:

1. Every file changed will trigger an event add, change, or delete. Before the request upload the file it will check before, if the file is changed by remote or changed by local side. 
2. If the file changes not by remote file, it will have permission to upload the file change. At the same time it will record a file edited by a local store.
3. On the remote side every file change will trigger an event add, change, or delete  also. And every trigger will be sent to the client side via http request. 
4. The client side will get a request from the remote side via http request. And will continue to request a download file. Before it, will check first if the file is changed from the local side?.
5. If the checking process result is no, the request download will continue to the remote side. At the same time the file download will record to “file edited by remote”.

## **Direct access `ngi-sync direct`**

Is used for managing commands that you still use every work. Like a shortcut, you can create a command to connect to the server via ssh, or you can use it for running webpack, and a lot of other things. But first you need to define it in the direct\_access config.

```bash
$ ngi-sync direct
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Direct Access List : (Press <enter> to submit)
> stmux
  Compile webpack
  WSL Server Only
  Login to container
  console :: Open Console
  devsync2 :: Open Devsync2
  clean :: Git clean up : git add --renormalize . && git reset
(Move up and down to reveal more choices)
```

## **Recent folder `ngi-sync open`**

Is used for you to jump to a recent project that you were just working on before.

```bash
$ ngi-sync open
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Display open recent : (Press <enter> to submit)
> recent : D:/workspaces/artywiz-webapp
  --------------------------------------
  prestashop_study : D:/workspaces/prestashop_study
  mas-adapter-webapp : D:/workspaces/mas-adapter-webapp
  croso_new : D:/workspaces/croso_new
  artywiz-webapp : D:/workspaces/artywiz-webapp
  generator-headless : D:/workspaces/generator-headless
(Move up and down to reveal more choices)
```

## **Sync register folder** `ngi-sync singlesync`

Is used for you have to upload and download manually which folder you had defined it.

```bash
$ ngi-sync singlesync
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Single Sync : (Use arrow keys)
> Download
  Upload
```

It will display two options: Download and Upload. And after that you choose which folder you have to upload or download.

```bash
$ ngi-sync singlesync
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Single Sync : Download
? Which file / folder : (Use arrow keys)
> node_modules
  dist
```

## **Load and Save Config `ngi-sync data`**

Is used for you need to save your configuration. Load and save it will store on .sync\_collection folder, you can commit on git this folder.

```bash
$ ngi-sync data
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Action Mode : (Use arrow keys)
> save
  load
  delete
```

After that It will display three options: Download, Upload and Delete. 

```bash
$ ngi-sync data
You are in: D:\workspaces\artywiz-webapp
Initialize Bootstrap Is Done!
[ undefined, undefined ]
? Action Mode : save
? Display data saved : (Press <enter> to submit)
> donny_desktop
  donny_notebook
  last_open
  New file
```



